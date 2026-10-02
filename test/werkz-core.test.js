'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CAPABILITIES, MODULES, WerkZError, InMemoryRepository, WerkZCore
} = require('../src');

function harness() {
  let sequence = 0;
  let tick = 0;
  const core = new WerkZCore(new InMemoryRepository(), {
    id: prefix => prefix + '_' + String(++sequence).padStart(4, '0'),
    clock: () => new Date(Date.UTC(2026, 9, 1, 8, 0, tick++))
  });
  return core;
}

function context(org, user) {
  return { organisationId: org.id, actorId: user.id };
}

test('Solo completes customer-to-billing flow without fake approval', () => {
  const core = harness();
  const org = core.createOrganisation({ name: 'Solo Demo', approvalRequired: false });
  const solo = core.createUser({ organisationId: org.id, name: 'Alex', rolePreset: 'solo' });
  const ctx = context(org, solo);

  const customer = core.createCustomer(ctx, { name: 'Schulte', idempotencyKey: 'customer-1' });
  const order = core.createOrder(ctx, {
    customerId: customer.id,
    title: 'Fenster montieren',
    location: { address: 'Musterweg 1' },
    idempotencyKey: 'order-1'
  });
  const timer = core.startTime(ctx, { orderId: order.id, idempotencyKey: 'time-start-1' });
  core.addEvidence(ctx, {
    orderId: order.id,
    kind: 'note',
    content: { text: 'Montage abgeschlossen' },
    idempotencyKey: 'evidence-note-1'
  });
  core.stopTime(ctx, { timerId: timer.id, idempotencyKey: 'time-stop-1' });
  core.completeOrder(ctx, { orderId: order.id, idempotencyKey: 'complete-1' });
  const result = core.prepareBilling(ctx, { orderId: order.id, idempotencyKey: 'billing-1' });

  assert.equal(result.order.billingState, 'ready');
  assert.equal(result.approval, null);
  assert.deepEqual(core.listOrders(ctx).map(value => value.id), [order.id]);
  assert.deepEqual(
    core.timeline(ctx, order.id).map(event => event.eventType),
    ['order.created', 'evidence.note.added', 'order.completed', 'billing.prepared']
  );
});

test('Team capabilities are enforced server-side', () => {
  const core = harness();
  const org = core.createOrganisation({ name: 'Team Demo' });
  const worker = core.createUser({ organisationId: org.id, name: 'Mira', rolePreset: 'field_worker' });
  const ctx = context(org, worker);

  assert.throws(
    () => core.createCustomer(ctx, { name: 'Forbidden', idempotencyKey: 'deny-1' }),
    error => error instanceof WerkZError && error.code === 'FORBIDDEN'
  );
});

test('tenant boundaries hide foreign entities', () => {
  const core = harness();
  const orgA = core.createOrganisation({ name: 'A' });
  const orgB = core.createOrganisation({ name: 'B' });
  const userA = core.createUser({ organisationId: orgA.id, name: 'A User', rolePreset: 'solo' });
  const userB = core.createUser({ organisationId: orgB.id, name: 'B User', rolePreset: 'solo' });
  const customerA = core.createCustomer(context(orgA, userA), { name: 'A Customer', idempotencyKey: 'a-customer' });

  assert.throws(
    () => core.createOrder(context(orgB, userB), {
      customerId: customerA.id,
      title: 'Cross tenant',
      idempotencyKey: 'cross-order'
    }),
    error => error instanceof WerkZError && error.code === 'NOT_FOUND'
  );
  assert.equal(core.listOrders(context(orgB, userB)).length, 0);
});

test('disabled modules fail independently', () => {
  const core = harness();
  const org = core.createOrganisation({
    name: 'Time Only',
    enabledModules: [MODULES.TIME],
    approvalRequired: false
  });
  const solo = core.createUser({ organisationId: org.id, name: 'Time User', rolePreset: 'solo' });
  const ctx = context(org, solo);
  const timer = core.startTime(ctx, { customerLabel: 'Direktkunde', idempotencyKey: 'time-only-start' });

  assert.equal(timer.orderId, null);
  assert.throws(
    () => core.createCustomer(ctx, { name: 'Disabled', idempotencyKey: 'disabled-customer' }),
    error => error instanceof WerkZError && error.code === 'MODULE_DISABLED'
  );
});

test('idempotency executes a command exactly once', () => {
  const core = harness();
  const org = core.createOrganisation({ name: 'Idempotent' });
  const solo = core.createUser({ organisationId: org.id, name: 'Solo', rolePreset: 'solo' });
  const ctx = context(org, solo);
  const first = core.createCustomer(ctx, { name: 'Einmal', idempotencyKey: 'same-command' });
  const replay = core.createCustomer(ctx, { name: 'Ignored replay', idempotencyKey: 'same-command' });

  assert.deepEqual(replay, first);
  const state = core.repository.read();
  assert.equal(Object.keys(state.customers).length, 1);
  assert.equal(state.audit.filter(event => event.eventType === 'customer.created').length, 1);
});

test('approval request and replayed decision are recorded once', () => {
  const core = harness();
  const org = core.createOrganisation({ name: 'Approval Team', approvalRequired: true });
  const solo = core.createUser({ organisationId: org.id, name: 'Owner', rolePreset: 'solo' });
  const ctx = context(org, solo);
  const customer = core.createCustomer(ctx, { name: 'Kunde', idempotencyKey: 'c1' });
  const order = core.createOrder(ctx, { customerId: customer.id, title: 'Auftrag', idempotencyKey: 'o1' });
  core.completeOrder(ctx, { orderId: order.id, idempotencyKey: 'done1' });
  const prepared = core.prepareBilling(ctx, { orderId: order.id, idempotencyKey: 'prepare1' });
  const input = { approvalId: prepared.approval.id, decision: 'approved', idempotencyKey: 'decision1' };
  const first = core.decideApproval(ctx, input);
  const replay = core.decideApproval(ctx, input);

  assert.deepEqual(replay, first);
  const state = core.repository.read();
  assert.equal(state.orders[order.id].billingState, 'ready');
  assert.equal(state.audit.filter(event => event.eventType === 'approval.approved').length, 1);
});

test('backup, mutation and restore return to the backed-up state', () => {
  const repository = new InMemoryRepository();
  const core = new WerkZCore(repository);
  const org = core.createOrganisation({ name: 'Backup Org' });
  const solo = core.createUser({ organisationId: org.id, name: 'Owner', rolePreset: 'solo' });
  const ctx = context(org, solo);
  core.createCustomer(ctx, { name: 'Vor Backup', idempotencyKey: 'before' });
  const backup = repository.backup();

  core.createCustomer(ctx, { name: 'Nach Backup', idempotencyKey: 'after' });
  assert.equal(Object.keys(repository.read().customers).length, 2);
  repository.restore(backup);
  assert.equal(Object.keys(repository.read().customers).length, 1);
  repository.assertIntegrity();
});

test('invalid restore is rejected without losing current state', () => {
  const repository = new InMemoryRepository();
  const before = repository.read();
  assert.throws(() => repository.restore('{"schemaVersion":999}'), /schema version/);
  assert.deepEqual(repository.read(), before);
});
