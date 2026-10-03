'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {
  WerkZCore,InMemoryRepository,ModuleRegistry,EntitlementService,EntitlementDeniedError,
  CommercialCatalog,LocalApprovalChannel,managementCockpit
}=require('../src');
const catalogV2=require('../config/catalog/werkz-v0.2.json');
const historicalV1=require('../config/catalog/werkz-v0.1.json');

function harness(){
  let i=0;
  const core=new WerkZCore(new InMemoryRepository(),{id:p=>p+'_'+(++i),clock:()=>new Date('2026-10-01T10:00:00Z')});
  const registry=new ModuleRegistry(),audit=[];
  const entitlements=new EntitlementService({registry,clock:()=>new Date('2026-10-01T10:00:00Z'),audit:e=>audit.push(e)});
  return {core,registry,entitlements,audit};
}

test('all business modules expose complete production contracts',()=>{
  const {registry}=harness();assert.equal(registry.list().length,16);
  for(const module of registry.list()){assert.ok(module.id.startsWith('werkz.'));assert.ok(module.sku.startsWith('WZ-'));assert.deepEqual(module.websitePublisherDependencies,[]);assert.ok(module.compatibility.core);}
});

test('WerkZ Einfach remains modular and optional',()=>{
  const {registry}=harness();
  const simple=registry.get('werkz.simple'),crypto=registry.get('werkz.crypto-monitor');
  assert.deepEqual(simple.hardDependencies,[]);
  assert.ok(simple.optionalIntegrations.includes('werkz.channel.gmail'));
  assert.deepEqual(crypto.capabilities,['market.read']);
});

test('time-only organisation works and orders can be entitled later',()=>{
  const {core,entitlements}=harness(),version=catalogV2.version;
  const org=core.createOrganisation({name:'Zeitbetrieb',enabledModules:['time']});
  const user=core.createUser({organisationId:org.id,name:'Solo',rolePreset:'solo'});
  entitlements.set({organisationId:org.id,moduleId:'werkz.time',catalogVersion:version});
  const timer=entitlements.execute(org.id,'werkz.time',()=>core.startTime({organisationId:org.id,actorId:user.id},{customerLabel:'Direktkunde',idempotencyKey:'start'}));
  assert.equal(timer.orderId,null);
  assert.throws(()=>entitlements.require(org.id,'werkz.orders'),EntitlementDeniedError);
  entitlements.set({organisationId:org.id,moduleId:'werkz.orders',catalogVersion:version});
  assert.equal(entitlements.require(org.id,'werkz.orders').status,'active');
});

test('organisations receive independent module entitlements',()=>{
  const {entitlements}=harness(),version=catalogV2.version;
  entitlements.set({organisationId:'org-a',moduleId:'werkz.time',catalogVersion:version});
  entitlements.set({organisationId:'org-b',moduleId:'werkz.orders',catalogVersion:version});
  assert.equal(entitlements.isActive('org-a','werkz.time'),true);assert.equal(entitlements.isActive('org-a','werkz.orders'),false);assert.equal(entitlements.isActive('org-b','werkz.orders'),true);
});

test('server guard denies suspended module while preserving and restoring data',()=>{
  const {core,entitlements,audit}=harness(),version=catalogV2.version;
  const org=core.createOrganisation({name:'Pause',enabledModules:['time']});
  const user=core.createUser({organisationId:org.id,name:'User',rolePreset:'solo'}),ctx={organisationId:org.id,actorId:user.id};
  entitlements.set({organisationId:org.id,moduleId:'werkz.time',catalogVersion:version});
  const timer=entitlements.execute(org.id,'werkz.time',()=>core.startTime(ctx,{customerLabel:'Kunde',idempotencyKey:'one'}));
  entitlements.set({organisationId:org.id,moduleId:'werkz.time',status:'suspended',catalogVersion:version});
  assert.throws(()=>entitlements.execute(org.id,'werkz.time',()=>core.stopTime(ctx,{timerId:timer.id,idempotencyKey:'stop'})),EntitlementDeniedError);
  assert.ok(core.repository.read().timers[timer.id]);
  entitlements.set({organisationId:org.id,moduleId:'werkz.time',status:'active',catalogVersion:version});
  assert.ok(entitlements.execute(org.id,'werkz.time',()=>core.stopTime(ctx,{timerId:timer.id,idempotencyKey:'stop'})).endedAt);
  assert.equal(audit.filter(x=>x.eventType==='entitlement.changed').length,3);
});

test('analytics is optional and contributes no operational dependency',()=>{
  const {registry}=harness();for(const id of ['werkz.time','werkz.customers','werkz.orders'])assert.equal(registry.get(id).hardDependencies.includes('werkz.analytics'),false);
});

test('v0.2 composes setup managed operation and deployment as separate offer axes',()=>{
  const catalog=new CommercialCatalog(catalogV2);
  const quote=catalog.composeOffer({id:'q-v2',organisationId:'o1',setupSku:'WZ-SETUP-TEAM',managedOperationSku:'WZ-OPS-TEAM',deploymentSkus:['WZ-CONNECTOR-SETUP','WZ-CONNECTOR-OPS'],entitlementSkus:['WZ-TIME','WZ-ORDERS']});
  assert.deepEqual(quote.items.map(x=>x.category),['implementation','managed_operation','deployment','deployment']);
  assert.deepEqual(quote.entitlementSkus,['WZ-TIME','WZ-ORDERS']);
  assert.equal(quote.catalogVersion,'2026-10-01.v0.2');
});

test('v0.2 has no permanent free tier or priceable small module lines',()=>{
  const catalog=new CommercialCatalog(catalogV2);
  assert.notEqual(catalogV2.permanentFreeTier,true);
  for(const sku of catalogV2.modulePricing.skus)assert.throws(()=>catalog.item(sku),/Unknown priceable SKU/);
  assert.equal([...catalog.items.values()].some(x=>x.billing==='free'),false);
});

test('historical quote snapshot survives migration from v0.1 to v0.2',()=>{
  const catalog=new CommercialCatalog(historicalV1);
  const old=catalog.quote({id:'old',organisationId:'o1',skus:['WZ-TIME']});
  catalog.load(catalogV2);
  assert.equal(old.items[0].unitAmountCents,1900);
  assert.equal(old.items[0].catalogVersion,'2026-10-01.v0.1');
  assert.equal(old.catalogModel,'legacy_items_and_presets');
});

test('priceable contract lines and module entitlements map independently',()=>{
  const catalog=new CommercialCatalog(catalogV2),registry=new ModuleRegistry();
  const contract=catalog.composeOffer({id:'q2',organisationId:'o2',setupSku:'WZ-SETUP-SOLO',managedOperationSku:'WZ-OPS-SOLO',deploymentSkus:['WZ-DEPLOY-CLOUD'],entitlementSkus:['WZ-TIME','WZ-CUSTOMERS']});
  const mapped=catalog.entitlementsForContract(contract,registry);
  assert.deepEqual(mapped.map(x=>x.moduleId),['werkz.time','werkz.customers']);
  assert.equal(mapped.every(x=>x.contractItemId===null),true);
});

test('local approval request and decision replay execute once',()=>{
  const channel=new LocalApprovalChannel(),request={organisationId:'o1',actorId:'u1',entityType:'quote',entityId:'q1',command:'approve',idempotencyKey:'request-1'};
  const message=channel.request(request);assert.deepEqual(channel.request({...request,command:'changed'}),message);
  const action={messageId:message.messageId,decision:'approved',actorId:'u2',idempotencyKey:'decision-1'};
  const first=channel.decide(action);assert.deepEqual(channel.decide({...action,decision:'returned'}),first);assert.equal(channel.decisions.size,1);
});

test('management module may be disabled while core and approvals remain usable',()=>{
  const {core,entitlements}=harness();const org=core.createOrganisation({name:'No cockpit'});
  entitlements.set({organisationId:org.id,moduleId:'werkz.approvals',catalogVersion:catalogV2.version});
  assert.equal(entitlements.isActive(org.id,'werkz.management'),false);assert.doesNotThrow(()=>managementCockpit(core.repository.read(),org.id));assert.equal(entitlements.require(org.id,'werkz.approvals').status,'active');
});

test('simulation contract has no route to mutate operational modules',()=>{
  const simulation=new ModuleRegistry().get('werkz.simulation');assert.deepEqual(simulation.hardDependencies,[]);assert.deepEqual(simulation.routes,['/api/simulation']);
});
