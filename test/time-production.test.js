'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {
  ModuleRegistry,EntitlementService,LocalAuthPort,RevisionConflictError,
  InMemoryTenantTimeRepository,InMemoryPrivateEvidenceStorage,
  OfflineCommandQueue,TimeProductionService
}=require('../src');

function setup(){
  let n=0;
  const entitlements=new EntitlementService({registry:new ModuleRegistry(),clock:()=>new Date('2026-10-01T08:00:00Z')});
  entitlements.set({organisationId:'org-a',moduleId:'werkz.time',catalogVersion:'v1'});
  entitlements.set({organisationId:'org-b',moduleId:'werkz.time',catalogVersion:'v1'});
  const capabilities=['time.start','time.stop','time.correct','document.upload'];
  const auth=new LocalAuthPort({a:{organisationId:'org-a',actorId:'user-a',capabilities},b:{organisationId:'org-b',actorId:'user-b',capabilities}});
  const repository=new InMemoryTenantTimeRepository(),storage=new InMemoryPrivateEvidenceStorage(),audit=[];
  const service=new TimeProductionService({auth,repository,storage,entitlements,id:p=>p+'_'+(++n),clock:()=>new Date('2026-10-01T09:00:00Z'),audit:e=>audit.push(e)});
  return {service,repository,storage,entitlements,audit};
}

test('AuthPort rejects unknown sessions and tenant repository does not leak records',()=>{
  const {service,repository}=setup();
  assert.throws(()=>service.start('invalid',{idempotencyKey:'x'}),error=>error.code==='UNAUTHENTICATED');
  const record=service.start('a',{customerLabel:'Kunde A',idempotencyKey:'start-a'});
  assert.equal(repository.get('org-b',record.id),null);
  assert.deepEqual(repository.list('org-b'),[]);
});

test('Time production works without order and retains optional mileage',()=>{
  const {service}=setup();
  const started=service.start('a',{customerLabel:'Direktkunde',mileageStart:12000,idempotencyKey:'start'});
  assert.equal(started.orderId,null);
  const stopped=service.stop('a',{id:started.id,expectedRevision:1,mileageEnd:12042,idempotencyKey:'stop'});
  assert.equal(stopped.mileageEnd,12042);
  assert.equal(stopped.revision,2);
});

test('client-generated stable Time IDs support offline chains and reject collisions',()=>{
  const {service}=setup();
  const started=service.start('a',{id:'time_offline_1',idempotencyKey:'offline-start'});
  assert.equal(started.id,'time_offline_1');
  const stopped=service.stop('a',{id:started.id,expectedRevision:1,idempotencyKey:'offline-stop'});
  assert.equal(stopped.status,'finished');
  assert.throws(
    ()=>service.start('a',{id:'time_offline_1',idempotencyKey:'different-command'}),
    error=>error.code==='ID_CONFLICT'
  );
});

test('history correction requires reason and preserves before/changes audit data',()=>{
  const {service}=setup();
  const started=service.start('a',{note:'roh',idempotencyKey:'s'});
  assert.throws(()=>service.correct('a',{id:started.id,expectedRevision:1,reason:'',changes:{note:'neu'},idempotencyKey:'bad'}),/reason/);
  const corrected=service.correct('a',{id:started.id,expectedRevision:1,reason:'Kundennachweis',changes:{note:'korrigiert',mileageStart:5},idempotencyKey:'fix'});
  assert.equal(corrected.note,'korrigiert');
  assert.equal(corrected.corrections.length,1);
  assert.equal(corrected.corrections[0].before.note,'roh');
});

test('stale multi-device update becomes a visible revision conflict',()=>{
  const {service}=setup();
  const started=service.start('a',{idempotencyKey:'s'});
  service.stop('a',{id:started.id,expectedRevision:1,idempotencyKey:'stop-1'});
  assert.throws(()=>service.correct('a',{id:started.id,expectedRevision:1,reason:'offline stale',changes:{note:'x'},idempotencyKey:'stale'}),RevisionConflictError);
});

test('private photo metadata and gallery remain tenant scoped',()=>{
  const {service,storage}=setup();
  const record=service.start('a',{idempotencyKey:'s'});
  const photo=service.addPhoto('a',{timeRecordId:record.id,mime:'image/jpeg',size:1234,hash:'sha256:abc',objectKey:'org-a/private/a.jpg'});
  assert.equal(photo.visibility,'private');
  assert.equal(service.gallery('a',record.id).length,1);
  assert.throws(()=>storage.getPrivate('org-b',photo.id),error=>error.code==='NOT_FOUND');
  assert.throws(()=>service.gallery('b',record.id),error=>error.code==='NOT_FOUND');
});

test('offline queue synchronizes an idempotency key exactly once',async()=>{
  const queue=new OfflineCommandQueue();let calls=0;
  const command={id:'cmd-1',idempotencyKey:'idem-1',organisationId:'org-a',actorId:'user-a',createdAtLocal:'2026-10-01T09:00:00+02:00',type:'time.start',payload:{}};
  queue.enqueue(command);queue.enqueue({...command,id:'duplicate'});
  await queue.sync(async()=>{calls++;return {id:'server-1'}});
  await queue.sync(async()=>{calls++;return {id:'server-2'}});
  assert.equal(calls,1);
  assert.equal(queue.snapshot().length,1);
  assert.equal(queue.snapshot()[0].status,'synced');
});

test('offline stale command is retained as conflict instead of last-write-wins',async()=>{
  const queue=new OfflineCommandQueue();
  queue.enqueue({id:'cmd-2',idempotencyKey:'idem-2',organisationId:'org-a',actorId:'user-a',createdAtLocal:'2026-10-01T09:00:00+02:00',type:'time.correct',expectedRevision:1,payload:{}});
  await queue.sync(async()=>{throw new RevisionConflictError('time-1',1,2)});
  const entry=queue.snapshot()[0];
  assert.equal(entry.status,'conflict');
  assert.deepEqual(entry.lastError,{code:'REVISION_CONFLICT',message:'Revision conflict',expected:1,actual:2});
});

test('Time production source contains no WebsitePublisher runtime tokens',()=>{
  const fs=require('node:fs');
  const source=fs.readFileSync(require.resolve('../src/time/production'),'utf8').toLowerCase();
  for(const token of ['websitepublisher','admin_token','project23947','mapi'])assert.equal(source.includes(token),false);
});
