'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {
  WerkZCore,InMemoryRepository,ModuleRegistry,EntitlementService,EntitlementDeniedError,
  CommercialCatalog,LocalApprovalChannel,managementCockpit
}=require('../src');
const seed=require('../config/catalog/werkz-v0.1.json');

function harness(){
  let i=0;
  const core=new WerkZCore(new InMemoryRepository(),{id:p=>p+'_'+(++i),clock:()=>new Date('2026-10-01T10:00:00Z')});
  const registry=new ModuleRegistry();
  const audit=[];
  const entitlements=new EntitlementService({registry,clock:()=>new Date('2026-10-01T10:00:00Z'),audit:e=>audit.push(e)});
  return {core,registry,entitlements,audit};
}

test('all business modules expose complete production contracts',()=>{
  const {registry}=harness();
  assert.equal(registry.list().length,11);
  for(const module of registry.list()){
    assert.ok(module.id.startsWith('werkz.'));
    assert.ok(module.sku.startsWith('WZ-'));
    assert.deepEqual(module.websitePublisherDependencies,[]);
    assert.ok(module.compatibility.core);
  }
});

test('time-only organisation works and orders can be entitled later',()=>{
  const {core,entitlements}=harness();
  const org=core.createOrganisation({name:'Zeitbetrieb',enabledModules:['time']});
  const user=core.createUser({organisationId:org.id,name:'Solo',rolePreset:'solo'});
  entitlements.set({organisationId:org.id,moduleId:'werkz.time',catalogVersion:seed.version});
  const timer=entitlements.execute(org.id,'werkz.time',()=>core.startTime(
    {organisationId:org.id,actorId:user.id},{customerLabel:'Direktkunde',idempotencyKey:'start'}
  ));
  assert.equal(timer.orderId,null);
  assert.throws(()=>entitlements.require(org.id,'werkz.orders'),EntitlementDeniedError);
  entitlements.set({organisationId:org.id,moduleId:'werkz.orders',catalogVersion:seed.version});
  assert.equal(entitlements.require(org.id,'werkz.orders').status,'active');
});

test('organisations receive independent module sets',()=>{
  const {entitlements}=harness();
  entitlements.set({organisationId:'org-a',moduleId:'werkz.time',catalogVersion:seed.version});
  entitlements.set({organisationId:'org-b',moduleId:'werkz.orders',catalogVersion:seed.version});
  assert.equal(entitlements.isActive('org-a','werkz.time'),true);
  assert.equal(entitlements.isActive('org-a','werkz.orders'),false);
  assert.equal(entitlements.isActive('org-b','werkz.orders'),true);
});

test('server guard denies suspended module while preserving and restoring data',()=>{
  const {core,entitlements,audit}=harness();
  const org=core.createOrganisation({name:'Pause',enabledModules:['time']});
  const user=core.createUser({organisationId:org.id,name:'User',rolePreset:'solo'});
  const ctx={organisationId:org.id,actorId:user.id};
  entitlements.set({organisationId:org.id,moduleId:'werkz.time',catalogVersion:seed.version});
  const timer=entitlements.execute(org.id,'werkz.time',()=>core.startTime(ctx,{customerLabel:'Kunde',idempotencyKey:'one'}));
  entitlements.set({organisationId:org.id,moduleId:'werkz.time',status:'suspended',catalogVersion:seed.version});
  assert.throws(()=>entitlements.execute(org.id,'werkz.time',()=>core.stopTime(ctx,{timerId:timer.id,idempotencyKey:'stop'})),EntitlementDeniedError);
  assert.ok(core.repository.read().timers[timer.id]);
  entitlements.set({organisationId:org.id,moduleId:'werkz.time',status:'active',catalogVersion:seed.version});
  assert.ok(entitlements.execute(org.id,'werkz.time',()=>core.stopTime(ctx,{timerId:timer.id,idempotencyKey:'stop'})).endedAt);
  assert.equal(audit.filter(x=>x.eventType==='entitlement.changed').length,3);
});

test('analytics is optional and contributes no operational dependency',()=>{
  const {registry}=harness();
  for(const id of ['werkz.time','werkz.customers','werkz.orders']){
    assert.equal(registry.get(id).hardDependencies.includes('werkz.analytics'),false);
  }
});

test('quote freezes its price after catalog replacement',()=>{
  const catalog=new CommercialCatalog(seed);
  const quote=catalog.quote({id:'q1',organisationId:'o1',skus:['WZ-TIME']});
  const changed=structuredClone(seed);
  changed.version='2026-11-01.v0.2';
  changed.items.find(x=>x.sku==='WZ-TIME').amountCents=2500;
  catalog.load(changed);
  assert.equal(quote.items[0].unitAmountCents,1900);
  assert.equal(quote.items[0].catalogVersion,'2026-10-01.v0.1');
  assert.equal(catalog.item('WZ-TIME').amountCents,2500);
});

test('sales preset expands to editable independent SKU items',()=>{
  const catalog=new CommercialCatalog(seed);
  const items=catalog.expandPreset('solo-start',{chooseOne:'WZ-TIME'});
  assert.deepEqual(items.map(x=>x.sku),['WZ-CORE','WZ-CUSTOMERS','WZ-SETUP-SOLO','WZ-TIME']);
  items.pop();
  assert.equal(catalog.expandPreset('solo-start',{chooseOne:'WZ-ORDERS'}).at(-1).sku,'WZ-ORDERS');
});

test('contract items map module SKUs to independent entitlements',()=>{
  const catalog=new CommercialCatalog(seed),registry=new ModuleRegistry();
  const quote=catalog.quote({id:'q2',organisationId:'o2',skus:['WZ-CORE','WZ-TIME','WZ-TEAM-5']});
  const mapped=catalog.entitlementsForContract({...quote,organisationId:'o2'},registry);
  assert.deepEqual(mapped.map(x=>x.moduleId),['werkz.time']);
  assert.equal(mapped[0].contractItemId,'q2:WZ-TIME');
});

test('local approval request and decision replay execute once',()=>{
  const channel=new LocalApprovalChannel();
  const request={organisationId:'o1',actorId:'u1',entityType:'quote',entityId:'q1',command:'approve',idempotencyKey:'request-1'};
  const message=channel.request(request);
  assert.deepEqual(channel.request({...request,command:'changed'}),message);
  const action={messageId:message.messageId,decision:'approved',actorId:'u2',idempotencyKey:'decision-1'};
  const first=channel.decide(action);
  assert.deepEqual(channel.decide({...action,decision:'returned'}),first);
  assert.equal(channel.decisions.size,1);
});

test('management module may be disabled while core and approvals remain usable',()=>{
  const {core,entitlements}=harness();
  const org=core.createOrganisation({name:'No cockpit'});
  entitlements.set({organisationId:org.id,moduleId:'werkz.approvals',catalogVersion:seed.version});
  assert.equal(entitlements.isActive(org.id,'werkz.management'),false);
  assert.doesNotThrow(()=>managementCockpit(core.repository.read(),org.id));
  assert.equal(entitlements.require(org.id,'werkz.approvals').status,'active');
});

test('simulation contract has no route to mutate operational modules',()=>{
  const {registry}=harness(),simulation=registry.get('werkz.simulation');
  assert.deepEqual(simulation.hardDependencies,[]);
  assert.deepEqual(simulation.routes,['/api/simulation']);
});
