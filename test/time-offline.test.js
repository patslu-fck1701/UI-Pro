'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {MemoryOfflineQueueDriver,PersistentOfflineQueue,RevisionConflictError}=require('../src');

function command(overrides={}){
  return {
    id:'cmd-1',idempotencyKey:'idem-1',organisationId:'org-a',actorId:'user-a',
    createdAtLocal:'2026-10-01T11:00:00+02:00',type:'time.correct',
    expectedRevision:1,payload:{id:'time-1',reason:'offline',changes:{note:'neu'}},...overrides
  };
}

test('persistent offline queue deduplicates per tenant and survives application reload',async()=>{
  const driver=new MemoryOfflineQueueDriver();
  let queue=new PersistentOfflineQueue(driver);
  await queue.enqueue(command());
  await queue.enqueue(command({id:'duplicate'}));
  assert.equal((await queue.list()).length,1);

  queue=new PersistentOfflineQueue(driver);
  let calls=0;
  const state=await queue.sync(async entry=>{calls++;return {ok:true,data:{serverId:entry.id}};});
  assert.equal(calls,1);assert.equal(state[0].status,'synced');
  await queue.sync(async()=>{calls++;return {ok:true,data:{}};});
  assert.equal(calls,1);
});

test('conflict state remains visible after reload and is not silently retried',async()=>{
  const driver=new MemoryOfflineQueueDriver(),queue=new PersistentOfflineQueue(driver);
  await queue.enqueue(command());
  await queue.sync(async()=>{throw new RevisionConflictError('time-1',1,2);});

  const reloaded=new PersistentOfflineQueue(driver),entry=(await reloaded.list())[0];
  assert.equal(entry.status,'conflict');
  assert.deepEqual(entry.lastError,{code:'REVISION_CONFLICT',message:'Revision conflict',expectedRevision:1,actualRevision:2});

  let calls=0;await reloaded.sync(async()=>{calls++;});
  assert.equal(calls,0);
});

test('failed commands persist attempts and can be explicitly retried',async()=>{
  const driver=new MemoryOfflineQueueDriver(),queue=new PersistentOfflineQueue(driver);
  await queue.enqueue(command());
  await queue.sync(async()=>{const error=new Error('private provider detail');error.code='NETWORK_ERROR';throw error;});
  let entry=(await queue.list())[0];
  assert.equal(entry.status,'failed');assert.equal(entry.attempts,1);
  assert.equal(entry.lastError.message,'Synchronization failed');

  await queue.retry(entry.id);
  await queue.sync(async()=>({ok:true,data:{accepted:true}}));
  entry=(await queue.list())[0];
  assert.equal(entry.status,'synced');assert.equal(entry.attempts,2);assert.deepEqual(entry.result,{accepted:true});
});

test('same idempotency key remains independent across organisations',async()=>{
  const queue=new PersistentOfflineQueue(new MemoryOfflineQueueDriver());
  await queue.enqueue(command());
  await queue.enqueue(command({id:'cmd-b',organisationId:'org-b'}));
  assert.equal((await queue.list()).length,2);
});

test('invalid offline envelopes are rejected before persistence',async()=>{
  const queue=new PersistentOfflineQueue(new MemoryOfflineQueueDriver());
  await assert.rejects(()=>queue.enqueue(command({actorId:''})),error=>error.code==='VALIDATION_ERROR');
  assert.deepEqual(await queue.list(),[]);
});
