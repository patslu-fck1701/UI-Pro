'use strict';

const { WerkZCore, InMemoryRepository } = require('../src');

const core = new WerkZCore(new InMemoryRepository());
const organisation = core.createOrganisation({ name: 'WerkZ Demo Solo', approvalRequired: false });
const user = core.createUser({ organisationId: organisation.id, name: 'Demo-Handwerker', rolePreset: 'solo' });
const context = { organisationId: organisation.id, actorId: user.id };
const customer = core.createCustomer(context, { name: 'Musterkunde Schulte', idempotencyKey: 'demo-customer' });
const order = core.createOrder(context, {
  customerId: customer.id,
  title: 'Fenstermontage',
  appointmentAt: '2026-10-05T07:00:00.000Z',
  location: { address: 'Musterweg 1, 00000 Musterstadt' },
  idempotencyKey: 'demo-order'
});
const timer = core.startTime(context, { orderId: order.id, idempotencyKey: 'demo-start' });
core.addEvidence(context, {
  orderId: order.id,
  kind: 'note',
  content: { text: 'Montage ohne offene Mängel abgeschlossen.' },
  idempotencyKey: 'demo-note'
});
core.stopTime(context, { timerId: timer.id, idempotencyKey: 'demo-stop' });
core.completeOrder(context, { orderId: order.id, idempotencyKey: 'demo-complete' });
core.prepareBilling(context, { orderId: order.id, idempotencyKey: 'demo-billing' });

process.stdout.write(JSON.stringify(core.repository.read(), null, 2) + '\n');
