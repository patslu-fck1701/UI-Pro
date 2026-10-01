'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {InMemorySecretStore,OAuthAccountLifecycle,RetryJobWorker,FileRetryJobState}=require('../src');
test('OAuth lifecycle stores token references, rotates and revokes without exposing tokens',()=>{
  const secrets=new InMemorySecretStore(),lifecycle=new OAuthAccountLifecycle({secretStore:secrets});
  const account=lifecycle.connect({organisationId:'org-a',provider:'example',connectionKey:'primary',accessToken:'access-secret',refreshToken:'refresh-secret'});
  assert.equal(JSON.stringify(account).includes('access-secret'),false);
  assert.equal(lifecycle.resolveAccess('org-a','example','primary'),'access-secret');
  assert.throws(()=>lifecycle.resolveAccess('org-b','example','primary'),error=>error.code==='ACCOUNT_UNAVAILABLE');
  lifecycle.rotate({organisationId:'org-a',provider:'example',connectionKey:'primary',accessToken:'new-secret'});
  assert.equal(lifecycle.resolveAccess('org-a','example','primary'),'new-secret');
  lifecycle.disconnect({organisationId:'org-a',provider:'example',connectionKey:'primary'});
  assert.throws(()=>lifecycle.resolveAccess('org-a','example','primary'),error=>error.code==='ACCOUNT_UNAVAILABLE');
});
test('retry worker deduplicates per tenant, backs off and moves exhausted jobs to dead letter',async()=>{
  let current=new Date('2026-10-01T00:00:00Z');
  const worker=new RetryJobWorker({clock:()=>current,maxAttempts:2,baseDelayMs:1000});
  const job=worker.enqueue({organisationId:'org-a',idempotencyKey:'event-1',kind:'sync',payload:{id:1}});
  assert.equal(worker.enqueue({organisationId:'org-a',idempotencyKey:'event-1',kind:'sync',payload:{id:1}}).id,job.id);
  assert.throws(()=>worker.enqueue({organisationId:'org-a',idempotencyKey:'event-1',kind:'sync',payload:{id:2}}),error=>error.code==='IDEMPOTENCY_CONFLICT');
  const reorderedWorker=new RetryJobWorker();
  const ordered=reorderedWorker.enqueue({organisationId:'org-a',idempotencyKey:'event-ordered',kind:'sync',payload:{a:1,b:2}});
  assert.equal(reorderedWorker.enqueue({organisationId:'org-a',idempotencyKey:'event-ordered',kind:'sync',payload:{b:2,a:1}}).id,ordered.id);
  assert.throws(()=>worker.enqueue({organisationId:'org-a',idempotencyKey:'event-1',kind:'notify',payload:{id:1}}),error=>error.code==='IDEMPOTENCY_CONFLICT');
  assert.notEqual(worker.enqueue({organisationId:'org-b',idempotencyKey:'event-1',kind:'sync'}).id,job.id);
  await worker.runDue(async entry=>{if(entry.organisationId==='org-a')throw new Error('secret provider detail');return {ok:true}});
  assert.equal(worker.get(job.id).status,'retry');assert.equal(worker.get(job.id).lastError.message,'Integration operation failed');
  assert.equal((await worker.runDue(async()=>({ok:true}))).length,0);
  current=new Date('2026-10-01T00:00:02Z');await worker.runDue(async()=>{throw new Error('again')});
  assert.equal(worker.get(job.id).status,'dead_letter');assert.equal(worker.health('org-a').deadLetter,1);
});

test('durable retry state survives restart, denies changed-key replay and recovers interrupted job',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-retry-'));
  try{
    const state=new FileRetryJobState(path.join(root,'jobs.json'));
    const first=new RetryJobWorker({stateStore:state});
    const job=first.enqueue({organisationId:'org-a',idempotencyKey:'fixed',kind:'sync',payload:{id:1}});
    assert.equal(new RetryJobWorker({stateStore:state}).enqueue({organisationId:'org-a',idempotencyKey:'fixed',kind:'sync',payload:{id:1}}).id,job.id);
    assert.throws(()=>new RetryJobWorker({stateStore:state}).enqueue({organisationId:'org-a',idempotencyKey:'fixed',kind:'sync',payload:{id:2}}),error=>error.code==='IDEMPOTENCY_CONFLICT');
    const saved=state.load();saved.jobs[0].status='running';saved.jobs[0].attempts=1;state.save(saved);
    const recovered=new RetryJobWorker({stateStore:state});
    assert.equal(recovered.get(job.id).status,'retry');
    assert.equal((await recovered.runDue(async()=>({done:true})))[0].status,'completed');
    const again=new RetryJobWorker({stateStore:state});
    assert.equal(again.get(job.id).status,'completed');
    assert.equal((await again.runDue(async()=>{throw new Error('should not run')})).length,0);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});
