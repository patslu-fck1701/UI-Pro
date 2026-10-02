'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {
  ConnectorPort,InMemorySecretStore,ConnectorRegistry,IntegrationStore,WebhookGateway,MappingEngine
}=require('../src');

class FakeConnector extends ConnectorPort {
  async connect(){return {connected:true}}
  async refresh(){return {refreshed:true}}
  async pull(){return []}
  async push(){return {accepted:true}}
  async verifyWebhook({headers}){return headers.signature==='valid'}
  async handleWebhook({rawBody}){const input=JSON.parse(rawBody);return {externalEventId:input.id,eventType:input.type,metadata:{objectId:input.objectId}}}
  async health(){return {status:'healthy'}}
  async disconnect(){return {disconnected:true}}
}

test('secret store exposes references only and isolates organisations',()=>{
  const audit=[],store=new InMemorySecretStore({id:prefix=>prefix+'_1',clock:()=>new Date('2026-10-01T10:00:00Z'),audit:event=>audit.push(event)});
  const reference=store.put({organisationId:'org-a',purpose:'oauth-refresh',value:'super-secret-value'});
  assert.equal(Object.hasOwn(reference,'value'),false);
  assert.equal(JSON.stringify(reference).includes('super-secret-value'),false);
  assert.equal(JSON.stringify(audit).includes('super-secret-value'),false);
  assert.equal(store.resolve('org-a',reference.id),'super-secret-value');
  assert.throws(()=>store.resolve('org-b',reference.id),error=>error.code==='CREDENTIAL_UNAVAILABLE');

  const rotated=store.rotate('org-a',reference.id,'replacement-secret');
  assert.equal(rotated.version,2);assert.equal(store.resolve('org-a',reference.id),'replacement-secret');
  store.revoke('org-a',reference.id);
  assert.throws(()=>store.resolve('org-a',reference.id),error=>error.code==='CREDENTIAL_UNAVAILABLE');
});

test('webhook gateway verifies, resolves tenant, deduplicates and queues without domain mutation',async()=>{
  let n=0;const id=prefix=>prefix+'_'+(++n),audit=[];
  const registry=new ConnectorRegistry().register('fake',new FakeConnector());
  const store=new IntegrationStore({id,clock:()=>new Date('2026-10-01T10:00:00Z')});
  store.account({organisationId:'org-a',provider:'fake',connectionKey:'public-opaque-key'});
  const gateway=new WebhookGateway({registry,store,audit:event=>audit.push(event)});

  await assert.rejects(()=>gateway.receive({
    provider:'fake',connectionKey:'public-opaque-key',headers:{signature:'invalid'},rawBody:'{"id":"evt-1","type":"changed"}'
  }),error=>error.code==='WEBHOOK_UNVERIFIED');

  const input={provider:'fake',connectionKey:'public-opaque-key',headers:{signature:'valid'},rawBody:'{"id":"evt-1","type":"changed","objectId":"remote-7"}'};
  const first=await gateway.receive(input),replay=await gateway.receive(input);
  assert.equal(first.accepted,true);assert.equal(first.duplicate,false);assert.equal(replay.duplicate,true);
  assert.equal(store.listJobs('org-a').length,1);assert.deepEqual(store.listJobs('org-b'),[]);
  assert.equal(audit.length,1);
  assert.deepEqual(Object.keys(first).sort(),['accepted','duplicate','eventId','jobId']);
});

test('mapping profiles normalize provider objects through explicit versioned fields',()=>{
  const engine=new MappingEngine();
  const result=engine.apply({
    id:'map-contact',version:'2',objectType:'customer',
    fields:{name:'contact.displayName',externalId:'contact.id',city:'address.city'}
  },{contact:{id:'p-1',displayName:'Muster GmbH',ignored:'provider-only'},address:{city:'Köln'}});
  assert.deepEqual(result,{
    profileId:'map-contact',profileVersion:'2',objectType:'customer',
    value:{name:'Muster GmbH',externalId:'p-1',city:'Köln'}
  });
  assert.equal(JSON.stringify(result).includes('provider-only'),false);
});

test('connector registry rejects unknown or non-contract adapters',()=>{
  const registry=new ConnectorRegistry();
  assert.throws(()=>registry.register('bad',{}));
  assert.throws(()=>registry.get('missing'),error=>error.code==='CONNECTOR_UNAVAILABLE');
});
