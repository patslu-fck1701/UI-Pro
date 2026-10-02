'use strict';

const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {FileTimeRepository,FilePrivateEvidenceStorage,backupTimeData,verifyTimeBackup,restoreTimeData}=require('../src');
test('Time recovery restores records, private bytes and tenant isolation after mutation',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-recovery-')),root=path.join(temp,'live'),backup=path.join(temp,'backup');
  fs.mkdirSync(root);
  try{
    const repo=new FileTimeRepository(path.join(root,'time.json')),storage=new FilePrivateEvidenceStorage(path.join(root,'evidence'));
    const a=repo.create({id:'time-a',organisationId:'org-a',actorId:'user-a',startedAt:'2026-10-01T00:00:00Z'},'start-a');
    const b=repo.create({id:'time-b',organisationId:'org-b',actorId:'user-b',startedAt:'2026-10-01T00:00:00Z'},'start-b');
    const bytes=Buffer.from('private photo'),hash='sha256:'+crypto.createHash('sha256').update(bytes).digest('hex');
    const photo=storage.putPrivate({organisationId:'org-a',ownerId:'user-a',timeRecordId:a.id,mime:'image/jpeg',bytes,hash,idempotencyKey:'photo-a'});
    const manifest=backupTimeData({sourceRoot:root,targetRoot:backup});assert.equal(manifest.count.records,2);assert.equal(manifest.count.evidence,1);
    repo.update('org-a',a.id,{expectedRevision:1,idempotencyKey:'edit-a',apply:r=>({...r,note:'changed'})});
    storage.putPrivate({organisationId:'org-b',ownerId:'user-b',timeRecordId:b.id,mime:'image/jpeg',bytes,hash,idempotencyKey:'photo-b'});
    const result=restoreTimeData({backupRoot:backup,targetRoot:root});
    const restoredRepo=new FileTimeRepository(path.join(root,'time.json')),restoredStorage=new FilePrivateEvidenceStorage(path.join(root,'evidence'));
    assert.equal(restoredRepo.get('org-a','time-a').revision,1);
    assert.equal(restoredRepo.get('org-b','time-b').revision,1);
    assert.equal(restoredStorage.listPrivate('org-a','time-a').length,1);
    assert.equal(restoredStorage.listPrivate('org-b','time-b').length,0);
    assert.equal(restoredStorage.getPrivate('org-a',photo.id).bytes.toString(),'private photo');
    assert.throws(()=>restoredStorage.getPrivate('org-b',photo.id),error=>error.code==='NOT_FOUND');
    assert.equal(fs.existsSync(result.priorRoot),true);
  }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
test('tampered backup fails before replacing live data',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-recovery-')),root=path.join(temp,'live'),backup=path.join(temp,'backup');
  fs.mkdirSync(root);
  try{
    new FileTimeRepository(path.join(root,'time.json')).create({id:'time-a',organisationId:'org-a'},'start-a');
    new FilePrivateEvidenceStorage(path.join(root,'evidence'));
    backupTimeData({sourceRoot:root,targetRoot:backup});
    fs.appendFileSync(path.join(backup,'time.json'),'tamper');
    assert.throws(()=>verifyTimeBackup(backup),/mismatch/);
    assert.throws(()=>restoreTimeData({backupRoot:backup,targetRoot:root}),/mismatch/);
    assert.equal(new FileTimeRepository(path.join(root,'time.json')).get('org-a','time-a').id,'time-a');
  }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
