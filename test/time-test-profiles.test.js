'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {once}=require('node:events');

function startServer(){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-https-profiles-'));
  const child=spawn(process.execPath,[path.join(__dirname,'..','tools','time-test-server.js')],{
    cwd:path.join(__dirname,'..'),
    env:{
      ...process.env,
      PORT:'0',
      WERKZ_TIME_DATA_DIR:path.join(temp,'data'),
      WERKZ_TEST_SESSION_TOKEN:'https-profile-primary-session',
      WERKZ_TEST_LOGIN_CODE:'https-profile-login-code',
      WERKZ_ENABLE_TEST_PROFILES:'1',
      WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS:''
    },
    stdio:['ignore','pipe','pipe']
  });
  return {child,temp};
}
async function waitReady(child){
  let buffer='';
  return await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('server ready timeout')),10000);
    child.stdout.on('data',chunk=>{
      buffer+=chunk.toString('utf8');
      const lines=buffer.split('\n');buffer=lines.pop();
      for(const line of lines){
        if(!line.trim())continue;
        try{
          const value=JSON.parse(line);
          if(value.kind==='ready'){
            clearTimeout(timer);resolve(value);return;
          }
        }catch{}
      }
    });
    child.once('exit',code=>{clearTimeout(timer);reject(new Error('server exited before ready: '+code));});
    child.stderr.on('data',chunk=>{});
  });
}
function cookieFrom(response,name){
  const raw=response.headers.get('set-cookie')||'';
  const match=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));
  return match||'';
}
async function stopServer(child,temp){
  if(child.exitCode===null){
    child.kill('SIGTERM');
    await Promise.race([once(child,'exit'),new Promise(resolve=>setTimeout(resolve,2000))]);
    if(child.exitCode===null)child.kill('SIGKILL');
  }
  fs.rmSync(temp,{recursive:true,force:true});
}

test('code-gated HTTPS profile flow keeps worker and manager sessions separate',async()=>{
  const {child,temp}=startServer();
  try{
    const ready=await waitReady(child);
    assert.equal(ready.testProfilesEnabled,true);
    assert.deepEqual(ready.profileIds,['manager','worker-a','worker-b']);
    const base='http://127.0.0.1:'+ready.port;

    const denied=await fetch(base+'/test-profiles?return=/',{redirect:'manual'});
    assert.equal(denied.status,303);
    assert.equal(denied.headers.get('location'),'/test-login?return=%2F');

    const loginPage=await fetch(base+denied.headers.get('location'));
    assert.equal(loginPage.status,200);
    assert.match(await loginPage.text(),/Testcode/);

    const wrong=await fetch(base+'/test-login',{
      method:'POST',redirect:'manual',
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({code:'wrong',return:'/'})
    });
    assert.equal(wrong.status,401);

    const accepted=await fetch(base+'/test-login',{
      method:'POST',redirect:'manual',
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({code:'https-profile-login-code',return:'/'})
    });
    assert.equal(accepted.status,303);
    assert.equal(accepted.headers.get('location'),'/test-profiles?return=%2F');
    const accessCookie=cookieFrom(accepted,'werkz_test_access');
    assert.ok(accessCookie);

    const profiles=await fetch(base+'/test-profiles?return=/',{headers:{cookie:accessCookie}});
    assert.equal(profiles.status,200);
    const profileHtml=await profiles.text();
    assert.match(profileHtml,/Chef/);
    assert.match(profileHtml,/Mitarbeiter A/);
    assert.match(profileHtml,/Mitarbeiter B/);

    const workerLogin=await fetch(base+'/test-login?profile=worker-a&return=/',{
      redirect:'manual',headers:{cookie:accessCookie}
    });
    assert.equal(workerLogin.status,303);
    const workerCookie=cookieFrom(workerLogin,'werkz_session');
    assert.ok(workerCookie);

    const workerSession=await fetch(base+'/api/session',{headers:{cookie:workerCookie}});
    assert.equal(workerSession.status,200);
    const worker=await workerSession.json();
    assert.equal(worker.actorId,'worker-a');
    assert.equal(worker.actorLabel,'Mitarbeiter A');
    assert.equal(worker.capabilities.includes('time.read.all'),false);

    const managerLogin=await fetch(base+'/test-login?profile=manager&return=/',{
      redirect:'manual',headers:{cookie:accessCookie}
    });
    const managerCookie=cookieFrom(managerLogin,'werkz_session');
    const manager=await (await fetch(base+'/api/session',{headers:{cookie:managerCookie}})).json();
    assert.equal(manager.actorLabel,'Chef');
    assert.equal(manager.capabilities.includes('time.read.all'),true);
  }finally{
    await stopServer(child,temp);
  }
});
