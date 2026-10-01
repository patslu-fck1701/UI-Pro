'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {FileTimeRepository,FilePrivateEvidenceStorage,RevisionConflictError}=require('../src');

function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),'werkz-durable-'))}
function record(){return {id:'same-id',organisationId:'org-a',actorId:'u1',orderId:null,startedAt:'2026-10-01T08:00:00Z',endedAt:null,status:'running'}}

test('durable Time records and idempotency survive adapter restart',()=>{
  const root=temp(),file=path.join(root,'time.json');
  try{
    let repo=new FileTimeRepository(file);
    const first=repo.create(record(),'start-1');
    repo=new FileTimeRepository(file);
    assert.deepEqual(repo.get('org-a','same-id'),first);
    assert.deepEqual(repo.create({...record(),id:'different'},'start-1'),first);
    assert.equal(repo.list('org-a').length,1);
    assert.equal(repo.integrity(),true);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('revision conflict and tenant separation survive restart',()=>{
  const root=temp(),file=path.join(root,'time.json');
  try{
    let repo=new FileTimeRepository(file);repo.create(record(),'create');
    repo.update('org-a','same-id',{expectedRevision:1,idempotencyKey:'stop',apply:x=>({...x,status:'finished'})});
    repo=new FileTimeRepository(file);
    assert.equal(repo.get('org-a','same-id').revision,2);
    assert.equal(repo.get('org-b','same-id'),null);
    assert.throws(()=>repo.update('org-a','same-id',{expectedRevision:1,idempotencyKey:'stale',apply:x=>x}),RevisionConflictError);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('private evidence stores bytes outside business rows and survives restart',()=>{
  const root=temp(),bytes=Buffer.from('private-photo-fixture'),hash=crypto.createHash('sha256').update(bytes).digest('hex');
  try{
    let store=new FilePrivateEvidenceStorage(root);
    const meta=store.putPrivate({organisationId:'org-a',ownerId:'u1',timeRecordId:'t1',mime:'image/jpeg',bytes,hash:'sha256:'+hash,idempotencyKey:'upload-1'});
    assert.equal(Object.prototype.hasOwnProperty.call(meta,'bytes'),false);
    store=new FilePrivateEvidenceStorage(root);
    const loaded=store.getPrivate('org-a',meta.id);
    assert.deepEqual(loaded.bytes,bytes);assert.equal(loaded.metadata.visibility,'private');assert.equal(store.integrity(),true);
    assert.throws(()=>store.getPrivate('org-b',meta.id),error=>error.code==='NOT_FOUND');
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('evidence retry is idempotent and hash mismatch is deterministic',()=>{
  const root=temp(),bytes=Buffer.from('same');
  try{
    const store=new FilePrivateEvidenceStorage(root);
    const input={organisationId:'org-a',ownerId:'u1',timeRecordId:'t1',mime:'image/jpeg',bytes,idempotencyKey:'retry-1'};
    const first=store.putPrivate(input),again=store.putPrivate({...input,bytes:Buffer.from('ignored-on-replay')});
    assert.deepEqual(again,first);assert.equal(store.listPrivate('org-a','t1').length,1);
    assert.throws(()=>store.putPrivate({...input,idempotencyKey:'bad',hash:'sha256:deadbeef'}),error=>error.code==='HASH_MISMATCH');
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});
