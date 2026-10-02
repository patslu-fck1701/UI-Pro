'use strict';

const crypto = require('node:crypto');

const CAPABILITIES = Object.freeze({
  CUSTOMER_READ: 'customer.read',
  CUSTOMER_WRITE: 'customer.write',
  ORDER_READ: 'order.read',
  ORDER_CREATE: 'order.create',
  ORDER_ASSIGN: 'order.assign',
  ORDER_COMPLETE: 'order.complete',
  TIME_START: 'time.start',
  TIME_STOP: 'time.stop',
  DOCUMENT_UPLOAD: 'document.upload',
  MATERIAL_WRITE: 'material.write',
  BILLING_PREPARE: 'billing.prepare',
  BILLING_APPROVE: 'billing.approve',
  APPROVAL_DECIDE: 'approval.decide',
  AUDIT_READ: 'audit.read'
});

const ROLE_PRESETS = Object.freeze({
  solo: Object.values(CAPABILITIES),
  field_worker: [
    CAPABILITIES.CUSTOMER_READ, CAPABILITIES.ORDER_READ,
    CAPABILITIES.TIME_START, CAPABILITIES.TIME_STOP,
    CAPABILITIES.DOCUMENT_UPLOAD, CAPABILITIES.MATERIAL_WRITE,
    CAPABILITIES.ORDER_COMPLETE
  ],
  office: [
    CAPABILITIES.CUSTOMER_READ, CAPABILITIES.CUSTOMER_WRITE,
    CAPABILITIES.ORDER_READ, CAPABILITIES.ORDER_CREATE,
    CAPABILITIES.ORDER_ASSIGN, CAPABILITIES.BILLING_PREPARE
  ],
  management: [
    CAPABILITIES.CUSTOMER_READ, CAPABILITIES.ORDER_READ,
    CAPABILITIES.BILLING_PREPARE, CAPABILITIES.BILLING_APPROVE,
    CAPABILITIES.APPROVAL_DECIDE, CAPABILITIES.AUDIT_READ
  ]
});

const MODULES = Object.freeze({
  CUSTOMERS: 'customers',
  ORDERS: 'orders',
  TIME: 'time',
  FIELD_EVIDENCE: 'field_evidence',
  BILLING: 'billing',
  APPROVALS: 'approvals'
});

class WerkZError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'WerkZError';
    this.code = code;
    this.details = details || null;
  }
}

function copy(value) {
  return structuredClone(value);
}

function nonEmpty(value, field) {
  const result = String(value || '').trim();
  if (!result) throw new WerkZError('VALIDATION_ERROR', field + ' is required');
  return result;
}

function newId(prefix) {
  return prefix + '_' + crypto.randomUUID();
}

function initialState() {
  return {
    schemaVersion: 1,
    revision: 0,
    organisations: {},
    users: {},
    customers: {},
    orders: {},
    timers: {},
    evidence: {},
    approvals: {},
    audit: [],
    idempotency: {}
  };
}

class InMemoryRepository {
  constructor(seed) {
    this.state = seed ? copy(seed) : initialState();
    this.assertIntegrity();
  }

  read() {
    return copy(this.state);
  }

  transaction(operation) {
    const draft = copy(this.state);
    const result = operation(draft);
    draft.revision += 1;
    this.state = draft;
    return copy(result);
  }

  backup() {
    return JSON.stringify(this.state);
  }

  restore(serialized) {
    const candidate = JSON.parse(serialized);
    const before = this.state;
    this.state = candidate;
    try {
      this.assertIntegrity();
    } catch (error) {
      this.state = before;
      throw error;
    }
  }

  assertIntegrity() {
    const s = this.state;
    if (!s || s.schemaVersion !== 1) {
      throw new WerkZError('UNSUPPORTED_SCHEMA', 'Expected schema version 1');
    }
    for (const name of ['organisations', 'users', 'customers', 'orders', 'timers', 'evidence', 'approvals', 'idempotency']) {
      if (!s[name] || Array.isArray(s[name])) {
        throw new WerkZError('INTEGRITY_ERROR', 'Invalid collection: ' + name);
      }
    }
    if (!Array.isArray(s.audit)) throw new WerkZError('INTEGRITY_ERROR', 'Invalid audit log');
  }
}

class WerkZCore {
  constructor(repository, options = {}) {
    this.repository = repository || new InMemoryRepository();
    this.clock = options.clock || (() => new Date());
    this.id = options.id || newId;
  }

  createOrganisation({ name, enabledModules = Object.values(MODULES), approvalRequired = true }) {
    const org = {
      id: this.id('org'),
      name: nonEmpty(name, 'name'),
      enabledModules: [...new Set(enabledModules)],
      approvalRequired: Boolean(approvalRequired),
      createdAt: this.now()
    };
    return this.repository.transaction(s => {
      s.organisations[org.id] = org;
      this.audit(s, org.id, null, 'organisation', org.id, 'organisation.created', 'Organisation created');
      return org;
    });
  }

  createUser({ organisationId, name, capabilities = [], rolePreset }) {
    const org = this.organisation(organisationId);
    const grants = rolePreset ? ROLE_PRESETS[rolePreset] : capabilities;
    if (!grants) throw new WerkZError('VALIDATION_ERROR', 'Unknown role preset');
    const user = {
      id: this.id('usr'),
      organisationId: org.id,
      name: nonEmpty(name, 'name'),
      capabilities: [...new Set(grants)],
      createdAt: this.now()
    };
    return this.repository.transaction(s => {
      s.users[user.id] = user;
      this.audit(s, org.id, user.id, 'user', user.id, 'user.created', 'User created');
      return user;
    });
  }

  createCustomer(context, input) {
    this.require(context, CAPABILITIES.CUSTOMER_WRITE);
    this.module(context.organisationId, MODULES.CUSTOMERS);
    return this.command(context, input.idempotencyKey, s => {
      const customer = {
        id: this.id('cus'),
        organisationId: context.organisationId,
        name: nonEmpty(input.name, 'name'),
        contact: String(input.contact || '').trim(),
        revision: 1,
        createdAt: this.now()
      };
      s.customers[customer.id] = customer;
      this.audit(s, context.organisationId, context.actorId, 'customer', customer.id, 'customer.created', 'Customer created');
      return customer;
    });
  }

  createOrder(context, input) {
    this.require(context, CAPABILITIES.ORDER_CREATE);
    this.module(context.organisationId, MODULES.ORDERS);
    return this.command(context, input.idempotencyKey, s => {
      const customer = s.customers[input.customerId];
      this.sameTenant(customer, context.organisationId, 'customer');
      const order = {
        id: this.id('ord'),
        organisationId: context.organisationId,
        customerId: customer.id,
        title: nonEmpty(input.title, 'title'),
        appointmentAt: input.appointmentAt || null,
        location: input.location || null,
        orgUnitId: input.orgUnitId || null,
        siteId: input.siteId || null,
        teamId: input.teamId || null,
        responsibleUserIds: [...new Set(input.responsibleUserIds || [])],
        status: 'open',
        billingState: 'not_ready',
        revision: 1,
        createdAt: this.now()
      };
      for (const userId of order.responsibleUserIds) this.sameTenant(s.users[userId], context.organisationId, 'user');
      s.orders[order.id] = order;
      this.audit(s, context.organisationId, context.actorId, 'order', order.id, 'order.created', 'Order created');
      return order;
    });
  }

  startTime(context, input) {
    this.require(context, CAPABILITIES.TIME_START);
    this.module(context.organisationId, MODULES.TIME);
    return this.command(context, input.idempotencyKey, s => {
      if (Object.values(s.timers).some(t => t.organisationId === context.organisationId && t.actorId === context.actorId && !t.endedAt)) {
        throw new WerkZError('ACTIVE_TIMER_EXISTS', 'Actor already has an active timer');
      }
      if (input.orderId) this.sameTenant(s.orders[input.orderId], context.organisationId, 'order');
      const timer = {
        id: this.id('tim'),
        organisationId: context.organisationId,
        actorId: context.actorId,
        orderId: input.orderId || null,
        customerLabel: input.customerLabel || null,
        startedAt: this.now(),
        endedAt: null
      };
      s.timers[timer.id] = timer;
      this.audit(s, context.organisationId, context.actorId, 'timer', timer.id, 'time.started', 'Working time started', { orderId: timer.orderId });
      return timer;
    });
  }

  addEvidence(context, input) {
    this.module(context.organisationId, MODULES.FIELD_EVIDENCE);
    const allowed = {
      note: CAPABILITIES.ORDER_READ,
      voice: CAPABILITIES.ORDER_READ,
      gps: CAPABILITIES.ORDER_READ,
      address: CAPABILITIES.ORDER_READ,
      photo: CAPABILITIES.DOCUMENT_UPLOAD,
      material: CAPABILITIES.MATERIAL_WRITE,
      additional_work: CAPABILITIES.MATERIAL_WRITE,
      problem: CAPABILITIES.ORDER_READ
    };
    this.require(context, allowed[input.kind]);
    return this.command(context, input.idempotencyKey, s => {
      this.sameTenant(s.orders[input.orderId], context.organisationId, 'order');
      const evidence = {
        id: this.id('evd'),
        organisationId: context.organisationId,
        orderId: input.orderId,
        actorId: context.actorId,
        kind: nonEmpty(input.kind, 'kind'),
        content: copy(input.content || {}),
        capturedAt: input.capturedAt || this.now()
      };
      s.evidence[evidence.id] = evidence;
      this.audit(s, context.organisationId, context.actorId, 'order', input.orderId, 'evidence.' + evidence.kind + '.added', 'Field evidence added', { evidenceId: evidence.id });
      return evidence;
    });
  }

  stopTime(context, input) {
    this.require(context, CAPABILITIES.TIME_STOP);
    this.module(context.organisationId, MODULES.TIME);
    return this.command(context, input.idempotencyKey, s => {
      const timer = s.timers[input.timerId];
      this.sameTenant(timer, context.organisationId, 'timer');
      if (timer.actorId !== context.actorId) throw new WerkZError('FORBIDDEN', 'Cannot stop another actor timer');
      if (timer.endedAt) return timer;
      timer.endedAt = this.now();
      this.audit(s, context.organisationId, context.actorId, 'timer', timer.id, 'time.stopped', 'Working time stopped');
      return timer;
    });
  }

  completeOrder(context, input) {
    this.require(context, CAPABILITIES.ORDER_COMPLETE);
    return this.command(context, input.idempotencyKey, s => {
      const order = s.orders[input.orderId];
      this.sameTenant(order, context.organisationId, 'order');
      order.status = 'completed';
      order.completedAt = this.now();
      order.revision += 1;
      this.audit(s, context.organisationId, context.actorId, 'order', order.id, 'order.completed', 'Order completed');
      return order;
    });
  }

  prepareBilling(context, input) {
    this.require(context, CAPABILITIES.BILLING_PREPARE);
    this.module(context.organisationId, MODULES.BILLING);
    return this.command(context, input.idempotencyKey, s => {
      const order = s.orders[input.orderId];
      const org = s.organisations[context.organisationId];
      this.sameTenant(order, context.organisationId, 'order');
      if (order.status !== 'completed') throw new WerkZError('INVALID_STATE', 'Order must be completed');
      order.billingState = org.approvalRequired ? 'approval_pending' : 'ready';
      order.revision += 1;
      let approval = null;
      if (org.approvalRequired) {
        approval = {
          id: this.id('apr'),
          organisationId: org.id,
          orderId: order.id,
          state: 'pending',
          requestedAt: this.now(),
          decidedAt: null,
          decidedBy: null
        };
        s.approvals[approval.id] = approval;
        this.audit(s, org.id, context.actorId, 'approval', approval.id, 'approval.requested', 'Billing approval requested', { orderId: order.id });
      }
      this.audit(s, org.id, context.actorId, 'order', order.id, 'billing.prepared', 'Billing prepared');
      return { order, approval };
    });
  }

  decideApproval(context, input) {
    this.require(context, CAPABILITIES.APPROVAL_DECIDE);
    this.module(context.organisationId, MODULES.APPROVALS);
    return this.command(context, input.idempotencyKey, s => {
      const approval = s.approvals[input.approvalId];
      this.sameTenant(approval, context.organisationId, 'approval');
      if (approval.state !== 'pending') return approval;
      if (!['approved', 'returned', 'deferred'].includes(input.decision)) {
        throw new WerkZError('VALIDATION_ERROR', 'Invalid approval decision');
      }
      approval.state = input.decision;
      approval.decidedAt = this.now();
      approval.decidedBy = context.actorId;
      const order = s.orders[approval.orderId];
      if (input.decision === 'approved') order.billingState = 'ready';
      if (input.decision === 'returned') order.billingState = 'changes_requested';
      this.audit(s, context.organisationId, context.actorId, 'approval', approval.id, 'approval.' + input.decision, 'Approval decision recorded', { orderId: order.id });
      return approval;
    });
  }

  listOrders(context) {
    this.require(context, CAPABILITIES.ORDER_READ);
    return Object.values(this.repository.read().orders).filter(o => o.organisationId === context.organisationId);
  }

  timeline(context, orderId) {
    this.require(context, CAPABILITIES.ORDER_READ);
    const state = this.repository.read();
    this.sameTenant(state.orders[orderId], context.organisationId, 'order');
    return state.audit.filter(e => e.organisationId === context.organisationId && e.entityId === orderId);
  }

  now() {
    return this.clock().toISOString();
  }

  organisation(id) {
    const org = this.repository.read().organisations[id];
    if (!org) throw new WerkZError('NOT_FOUND', 'Organisation not found');
    return org;
  }

  module(organisationId, moduleName) {
    const org = this.organisation(organisationId);
    if (!org.enabledModules.includes(moduleName)) {
      throw new WerkZError('MODULE_DISABLED', 'Module disabled: ' + moduleName);
    }
  }

  require(context, capability) {
    if (!capability) throw new WerkZError('VALIDATION_ERROR', 'Unsupported operation kind');
    const state = this.repository.read();
    const user = state.users[context.actorId];
    this.sameTenant(user, context.organisationId, 'user');
    if (!user.capabilities.includes(capability)) throw new WerkZError('FORBIDDEN', 'Missing capability: ' + capability);
  }

  sameTenant(entity, organisationId, type) {
    if (!entity) throw new WerkZError('NOT_FOUND', type + ' not found');
    if (entity.organisationId !== organisationId) throw new WerkZError('NOT_FOUND', type + ' not found');
  }

  command(context, key, operation) {
    const idempotencyKey = nonEmpty(key, 'idempotencyKey');
    const state = this.repository.read();
    const prior = state.idempotency[context.organisationId + ':' + idempotencyKey];
    if (prior) return copy(prior.result);
    return this.repository.transaction(s => {
      const result = operation(s);
      s.idempotency[context.organisationId + ':' + idempotencyKey] = {
        actorId: context.actorId,
        recordedAt: this.now(),
        result: copy(result)
      };
      return result;
    });
  }

  audit(state, organisationId, actorId, entityType, entityId, eventType, summary, payload = {}) {
    state.audit.push({
      id: this.id('evt'),
      organisationId,
      timestampUtc: this.now(),
      actorId,
      entityType,
      entityId,
      eventType,
      summary,
      payload,
      source: 'core',
      correlationId: null,
      causationId: null
    });
  }
}

module.exports = {
  CAPABILITIES,
  ROLE_PRESETS,
  MODULES,
  WerkZError,
  InMemoryRepository,
  WerkZCore
};
