'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {
  ModuleRegistry,EntitlementService,LocalAuthPort,FileTimeRepository,FilePrivateEvidenceStorage,
  TimeProductionService,TimeApplication
}=require('../src');

function fixture(root){
  let sequence=0;
  const entitlements=new EntitlementService({registry:new ModuleRegistry(),clock:()=>new Date('2026-10-01T08:00:00Z')});
  entitlements.set({organisationId:'org-a',moduleId:'werkz.time',catalogVersion:'v0.2'});
  entitlements.set({organisationId:'org-b',moduleId:'werkz.time',catalogVersion:'v0.2'});
  const capabilities=['time.start','time.stop','time.correct','document.upload'];
  const auth=new LocalAuthPort({
    'device-a':{organisationId:'org-a',actorId:'user-a',capabilities},
    'device-b':{organisationId:'org-a',actorId:'user-a',capabilities},
    'tenant-b':{organisationId:'org-b',actorId:'user-b',capabilities}
  });
  const audit=[];
  const build=()=>new TimeApplication(new TimeProductionService({
    auth,entitlements,repository:new FileTimeRepository(path.join(root,'time.json')),
    storage:new FilePrivateEvidenceStorage(path.join(root,'evidence')),
    id:prefix=>prefix+'_'+(++sequence),clock:()=>new Date('2026-10-01T09:00:00Z'),audit:event=>audit.push(event)
  }));
  return {build,audit};
}

test('application boundary exposes deterministic conflict without leaking another tenant',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-app-'));
  try{
    const {build,audit}=fixture(root),app=build();
    const start=app.execute('device-a',{operation:'time.start',input:{customerLabel:'Ohne Auftrag',idempotencyKey:'start-1'}});
    assert.equal(start.ok,true);assert.equal(start.data.orderId,null);

    const stopped=app.execute('device-a',{operation:'time.stop',input:{id:start.data.id,expectedRevision:1,idempotencyKey:'stop-1'}});
    assert.equal(stopped.ok,true);assert.equal(stopped.data.revision,2);

    const stale=app.executeOffline('device-b',{
      id:'offline-1',type:'time.correct',idempotencyKey:'correct-stale',createdAtLocal:'2026-10-01T11:00:00+02:00',
      expectedRevision:1,payload:{id:start.data.id,reason:'zweites Gerät',changes:{note:'offline'}}
    });
    assert.deepEqual(stale,{ok:false,error:{code:'REVISION_CONFLICT',message:'The record changed on another device',details:{
      entityId:start.data.id,expectedRevision:1,actualRevision:2
    }}});

    const hidden=app.execute('tenant-b',{operation:'time.get',input:{id:start.data.id}});
    assert.deepEqual(hidden,{ok:false,error:{code:'NOT_FOUND',message:'Resource not found',details:{}}});
    assert.equal(audit.some(event=>event.eventType==='time.conflict'),true);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('application operations, private evidence and idempotency survive adapter restart',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-app-'));
  try{
    const {build,audit}=fixture(root);
    let app=build();
    const start=app.execute('device-a',{operation:'time.start',input:{idempotencyKey:'start-1'}}).data;
    const stop=app.execute('device-a',{operation:'time.stop',input:{id:start.id,expectedRevision:1,idempotencyKey:'stop-1'}}).data;
    const correction=app.execute('device-a',{operation:'time.correct',input:{
      id:start.id,expectedRevision:stop.revision,idempotencyKey:'correct-1',reason:'Beleg geprüft',changes:{note:'korrigiert'}
    }});
    assert.equal(correction.ok,true);

    const evidence=app.execute('device-a',{operation:'time.evidence.add',input:{
      timeRecordId:start.id,idempotencyKey:'photo-1',mime:'image/jpeg',bytes:Buffer.from('private-binary-photo')
    }});
    assert.equal(evidence.ok,true);assert.equal(evidence.data.visibility,'private');
    assert.equal(Object.hasOwn(evidence.data,'bytes'),false);

    app=build();
    const replay=app.execute('device-b',{operation:'time.start',input:{idempotencyKey:'start-1'}});
    assert.equal(replay.ok,true);assert.equal(replay.data.id,start.id);
    const loaded=app.execute('device-b',{operation:'time.get',input:{id:start.id}});
    assert.equal(loaded.data.revision,3);assert.equal(loaded.data.note,'korrigiert');
    assert.equal(app.execute('device-b',{operation:'time.gallery',input:{timeRecordId:start.id}}).data.length,1);

    for(const type of ['time.started','time.stopped','time.corrected','time.evidence.added']){
      assert.equal(audit.some(event=>event.eventType===type),true,type);
    }
    const serialized=JSON.stringify(audit);
    assert.equal(serialized.includes('private-binary-photo'),false);
    assert.equal(serialized.includes('"bytes"'),false);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('multipart-neutral evidence boundary validates binary size and persists private bytes',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-app-'));
  try{
    const {build}=fixture(root),app=build();
    const record=app.execute('device-a',{operation:'time.start',input:{idempotencyKey:'start-upload'}}).data;
    const bytes=Buffer.from('binary-photo-body'),hash='sha256:'+crypto.createHash('sha256').update(bytes).digest('hex');
    const uploaded=app.uploadEvidence('device-a',{
      fields:{timeRecordId:record.id,idempotencyKey:'upload-multipart',size:String(bytes.length),hash},
      file:{mime:'image/jpeg',size:bytes.length,bytes}
    });
    assert.equal(uploaded.ok,true);assert.equal(uploaded.data.size,bytes.length);assert.equal(uploaded.data.hash,hash);
    assert.equal(Object.hasOwn(uploaded.data,'bytes'),false);

    const mismatch=app.uploadEvidence('device-a',{
      fields:{timeRecordId:record.id,idempotencyKey:'bad-size',size:String(bytes.length+1),hash},
      file:{mime:'image/jpeg',bytes}
    });
    assert.deepEqual(mismatch,{ok:false,error:{code:'VALIDATION_ERROR',message:'Invalid request',details:{field:'size'}}});
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('application boundary validates requests and returns stable public errors',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-app-'));
  try{
    const {build}=fixture(root),app=build();
    assert.deepEqual(app.execute('device-a',{operation:'time.stop',input:{}}),{
      ok:false,error:{code:'VALIDATION_ERROR',message:'Invalid request',details:{field:'id'}}
    });
    assert.deepEqual(app.execute('invalid',{operation:'time.list',input:{}}),{
      ok:false,error:{code:'UNAUTHENTICATED',message:'Authentication required',details:{}}
    });
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
