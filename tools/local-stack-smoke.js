'use strict';

const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {once}=require('node:events');

const watchdog=setTimeout(()=>{
  process.stderr.write('local-stack-smoke: TIMEOUT after 15s\n',()=>process.exit(2));
},15000);

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-local-stack-smoke-'));
const previous={
  PORT:process.env.PORT,
  WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS:process.env.WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS,
  WERKZ_TIME_DATA_DIR:process.env.WERKZ_TIME_DATA_DIR,
  WERKZ_TEST_SESSION_TOKEN:process.env.WERKZ_TEST_SESSION_TOKEN,
  WERKZ_TEST_LOGIN_CODE:process.env.WERKZ_TEST_LOGIN_CODE
};
process.env.PORT='0';
process.env.WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS='1';
process.env.WERKZ_TIME_DATA_DIR=path.join(temp,'data');
process.env.WERKZ_TEST_SESSION_TOKEN='local-stack-smoke-session';
process.env.WERKZ_TEST_LOGIN_CODE='local-stack-smoke-code';

const {server}=require('./time-test-server');

function assert(condition,message){if(!condition)throw new Error(message);}
const request=(url,options={})=>fetch(url,{signal:AbortSignal.timeout(5000),...options});

async function closeServer(){
  if(!server.listening)return;
  const closed=new Promise(resolve=>server.close(resolve));
  server.closeAllConnections?.();
  await Promise.race([closed,new Promise(resolve=>setTimeout(resolve,1000))]);
}
function restoreEnvironment(){
  for(const [key,value] of Object.entries(previous)){
    if(value===undefined)delete process.env[key];
    else process.env[key]=value;
  }
  fs.rmSync(temp,{recursive:true,force:true});
}
async function login(base,profile,returnTo='/'){
  const response=await request(base+'/test-login?profile='+encodeURIComponent(profile)+'&return='+encodeURIComponent(returnTo),{redirect:'manual'});
  assert(response.status===303,'test login redirect failed for '+profile);
  assert(response.headers.get('location')===returnTo,'test login return target invalid for '+profile);
  const cookie=(response.headers.get('set-cookie')||'').split(';')[0];
  assert(cookie.startsWith('werkz_session='),'test session cookie missing for '+profile);
  return cookie;
}
async function command(base,cookie,operation,input={}){
  const response=await request(base+'/api/time/commands',{
    method:'POST',headers:{cookie,'content-type':'application/json'},
    body:JSON.stringify({operation,input})
  });
  const body=await response.json();
  assert(response.status===200&&body.ok===true,operation+' failed');
  return body.data;
}
async function run(){
  if(!server.listening)await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;

  const health=await request(base+'/healthz');
  assert(health.status===200,'healthz failed');
  const healthBody=await health.json();
  assert(healthBody.ok===true&&healthBody.demoSeed===false,'health payload must be seed-free');

  const assistant=await request(base+'/');
  assert(assistant.status===200,'assistant root failed');
  const assistantHtml=await assistant.text();
  assert(assistantHtml.includes('Chef-Assistent'),'assistant HTML missing');
  assert((assistant.headers.get('content-security-policy')||'').includes("connect-src 'self'"),'assistant CSP missing');

  const hub=await request(base+'/hub/');
  assert(hub.status===404,'legacy demo hub must not be mounted in personal test runtime');

  const icon=await request(base+'/assistant/apple-touch-icon.png');
  assert(icon.status===200,'assistant apple touch icon failed');
  assert((icon.headers.get('content-type')||'').startsWith('image/png'),'assistant apple touch icon mime invalid');
  assert((await icon.arrayBuffer()).byteLength>1000,'assistant apple touch icon bytes missing');

  const time=await request(base+'/time/');
  assert(time.status===200,'time app failed');
  assert((await time.text()).includes('WerkZ'),'time app HTML missing');

  const profiles=await request(base+'/test-profiles?return=/');
  assert(profiles.status===200,'test profile page failed');
  const profilesHtml=await profiles.text();
  for(const label of ['Chef','Mitarbeiter A','Mitarbeiter B'])assert(profilesHtml.includes(label),'missing test profile '+label);

  const workerACookie=await login(base,'worker-a','/time/');
  const workerBCookie=await login(base,'worker-b','/time/');
  const managerCookie=await login(base,'manager','/');

  const workerASession=await request(base+'/api/session',{headers:{cookie:workerACookie}});
  const workerAIdentity=await workerASession.json();
  assert(workerAIdentity.actorId==='worker-a'&&workerAIdentity.actorLabel==='Mitarbeiter A','worker A session identity invalid');
  assert(!workerAIdentity.capabilities.includes('time.read.all'),'worker A must not receive time.read.all');

  const managerSession=await request(base+'/api/session',{headers:{cookie:managerCookie}});
  const managerIdentity=await managerSession.json();
  assert(managerIdentity.actorLabel==='Chef','manager session identity invalid');
  assert(managerIdentity.capabilities.includes('time.read.all'),'manager must receive time.read.all');
  assert(managerIdentity.capabilities.includes('assistant.capture'),'manager must receive assistant capture');

  const audit=await request(base+'/api/assistant/source-audit',{headers:{cookie:managerCookie}});
  const auditBody=await audit.json();
  assert(audit.status===200&&auditBody.ok===true,'assistant source audit failed');
  assert(auditBody.data.findings.some(item=>item.id==='electronic-repair-kit-visual'&&item.status==='error'),'confirmed ToxicZ decoder source error missing');

  const emptyBriefing=await request(base+'/api/assistant/briefing',{headers:{cookie:managerCookie}});
  const emptyPayload=await emptyBriefing.json();
  assert(emptyBriefing.status===200&&emptyPayload.ok===true,'assistant briefing failed');
  assert(emptyPayload.data.counts.open===0,'personal assistant must start without synthetic open work');

  const capture=await request(base+'/api/assistant/capture',{
    method:'POST',headers:{cookie:managerCookie,'content-type':'application/json'},
    body:JSON.stringify({text:'Idee für KOTH Marker prüfen',source:'manual',captureType:'idea',idempotencyKey:'smoke-idea'})
  });
  const captureBody=await capture.json();
  assert(capture.status===200&&captureBody.ok===true,'assistant capture failed');
  assert(captureBody.data.kind==='idea','capture hint not applied');

  const startEvent=await request(base+'/api/assistant/event-tests',{
    method:'POST',headers:{cookie:managerCookie,'content-type':'application/json'},
    body:JSON.stringify({id:'eventtest-smoke',eventId:'koth',startedAt:new Date().toISOString(),idempotencyKey:'smoke-event-start'})
  });
  assert(startEvent.status===200&&(await startEvent.json()).ok===true,'event test start failed');
  const observation=await request(base+'/api/assistant/event-tests/eventtest-smoke/observations',{
    method:'POST',headers:{cookie:managerCookie,'content-type':'application/json'},
    body:JSON.stringify({text:'KOTH startet sauber und KOTH beendet, Slot frei',source:'voice',idempotencyKey:'smoke-event-observation'})
  });
  assert(observation.status===200&&(await observation.json()).ok===true,'event observation failed');
  const finishEvent=await request(base+'/api/assistant/event-tests/eventtest-smoke/finish',{
    method:'POST',headers:{cookie:managerCookie,'content-type':'application/json'},
    body:JSON.stringify({idempotencyKey:'smoke-event-finish'})
  });
  const finishBody=await finishEvent.json();
  assert(finishEvent.status===200&&finishBody.ok===true,'event test finish failed');
  assert(finishBody.data.report.counts.observed>=2,'event test report did not evaluate narration');

  const projections=await request(base+'/api/assistant/projections',{headers:{cookie:managerCookie}});
  const projectionBody=await projections.json();
  assert(projections.status===200&&projectionBody.ok===true&&projectionBody.data.length>=1,'mapper projection missing');

  const recordA=await command(base,workerACookie,'time.start',{
    idempotencyKey:'local-stack-worker-a-start',customerLabel:'Baustelle A'
  });
  const recordB=await command(base,workerBCookie,'time.start',{
    idempotencyKey:'local-stack-worker-b-start',customerLabel:'Baustelle B'
  });
  assert(recordA.actorLabel==='Mitarbeiter A','worker A label not persisted from trusted session');
  assert(recordB.actorLabel==='Mitarbeiter B','worker B label not persisted from trusted session');

  const listA=await command(base,workerACookie,'time.list');
  const listB=await command(base,workerBCookie,'time.list');
  const managerList=await command(base,managerCookie,'time.list');
  assert(listA.length===1&&listA[0].actorId==='worker-a','worker A read scope leaked');
  assert(listB.length===1&&listB[0].actorId==='worker-b','worker B read scope leaked');
  assert(managerList.length===2,'manager must see both worker records');
  assert(new Set(managerList.map(record=>record.actorId)).size===2,'manager records must come from distinct actors');
}
(async()=>{
  let failure=null;
  try{await run();}catch(error){failure=error;}
  finally{await closeServer();restoreEnvironment();}
  clearTimeout(watchdog);
  if(failure){process.stderr.write('local-stack-smoke: FAILED: '+failure.stack+'\n',()=>process.exit(1));return;}
  process.stdout.write('local-stack-smoke: OK\n',()=>process.exit(0));
})();
