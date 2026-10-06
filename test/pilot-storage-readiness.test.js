'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {inside,inspectPilotStorage,assertPilotStorageReady}=require('../src/pilot/storage-readiness');

test('persistent storage guard distinguishes writable from declared persistent storage',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-storage-readiness-'));
  try{
    const data=path.join(temp,'plain-data');
    const normal=inspectPilotStorage({dataDir:data,requirePersistent:false});
    assert.equal(normal.ready,true);assert.equal(normal.declaredPersistent,false);assert.equal(normal.writeProbePassed,true);assert.equal(normal.externalRestartProofRequired,true);

    assert.throws(()=>assertPilotStorageReady({dataDir:data,requirePersistent:true}),error=>{
      assert.equal(error.code,'PILOT_STORAGE_NOT_READY');assert.equal(error.details.error,'persistent-root-not-configured');return true;
    });
  }finally{fs.rmSync(temp,{recursive:true,force:true})}
});

test('persistent storage guard requires data directory to live inside an existing declared root',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-storage-root-'));
  try{
    const root=path.join(temp,'persistent');fs.mkdirSync(root);
    const good=path.join(root,'pilot');
    const bad=path.join(temp,'elsewhere');
    assert.equal(inside(root,good),true);assert.equal(inside(root,bad),false);
    const accepted=assertPilotStorageReady({dataDir:good,persistentRoot:root,requirePersistent:true});
    assert.equal(accepted.ready,true);assert.equal(accepted.declaredPersistent,true);assert.equal(accepted.pathWithinDeclaredRoot,true);assert.equal(accepted.writeProbePassed,true);
    assert.throws(()=>assertPilotStorageReady({dataDir:bad,persistentRoot:root,requirePersistent:true}),error=>{
      assert.equal(error.code,'PILOT_STORAGE_NOT_READY');assert.equal(error.details.error,'data-dir-outside-persistent-root');return true;
    });
  }finally{fs.rmSync(temp,{recursive:true,force:true})}
});

function startServer({dataDir,persistentRoot,requirePersistent='1'}){
  const child=spawn(process.execPath,[path.join(__dirname,'..','tools','time-test-server.js')],{
    cwd:path.join(__dirname,'..'),
    env:{
      ...process.env,PORT:'0',WERKZ_TIME_DATA_DIR:dataDir,
      WERKZ_PILOT_REQUIRE_PERSISTENT_STORAGE:requirePersistent,
      WERKZ_PILOT_PERSISTENT_ROOT:persistentRoot||'',
      WERKZ_TEST_SESSION_TOKEN:'storage-manager-session',WERKZ_TEST_LOGIN_CODE:'storage-login-code',
      WERKZ_ENABLE_TEST_PROFILES:'1',WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS:'',
      WERKZ_PILOT_SESSION_TOKEN:'storage-pilot-session',WERKZ_PILOT_LOGIN_CODE:'storage-pilot-login'
    },stdio:['ignore','pipe','pipe']
  });
  return child;
}
async function waitReady(child){
  let buffer='',stderr='';child.stderr.on('data',chunk=>{stderr+=chunk.toString('utf8')});
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('server ready timeout '+stderr)),10000);
    child.stdout.on('data',chunk=>{
      buffer+=chunk.toString('utf8');const lines=buffer.split('\n');buffer=lines.pop();
      for(const line of lines){if(!line.trim())continue;try{const x=JSON.parse(line);if(x.kind==='ready'){clearTimeout(timer);resolve(x);return}}catch{}}
    });
    child.once('exit',code=>{clearTimeout(timer);reject(new Error('server exited '+code+' '+stderr))});
  });
}
async function stop(child){if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,1500))]);if(child.exitCode===null)child.kill('SIGKILL')}}

test('server health exposes declared persistent storage readiness without claiming restart proof',async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-storage-server-'));
  const root=path.join(temp,'mount');fs.mkdirSync(root);
  const child=startServer({dataDir:path.join(root,'data'),persistentRoot:root});
  try{
    const ready=await waitReady(child);assert.equal(ready.persistentStorageRequired,true);assert.equal(ready.persistentStorageDeclared,true);
    const health=await fetch('http://127.0.0.1:'+ready.port+'/healthz').then(r=>r.json());
    assert.equal(health.ok,true);assert.equal(health.storageReady,true);assert.equal(health.persistentStorageRequired,true);assert.equal(health.persistentStorageDeclared,true);assert.equal(health.externalRestartProofRequired,true);
  }finally{await stop(child);fs.rmSync(temp,{recursive:true,force:true})}
});

test('server refuses production-persistent mode when data directory is outside declared root',async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-storage-refuse-'));
  const root=path.join(temp,'mount');fs.mkdirSync(root);
  const child=startServer({dataDir:path.join(temp,'outside'),persistentRoot:root});
  let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk.toString('utf8')});
  try{
    const [code]=await once(child,'exit');
    assert.notEqual(code,0);assert.match(stderr,/Pilot storage readiness failed: data-dir-outside-persistent-root/);
  }finally{await stop(child);fs.rmSync(temp,{recursive:true,force:true})}
});
