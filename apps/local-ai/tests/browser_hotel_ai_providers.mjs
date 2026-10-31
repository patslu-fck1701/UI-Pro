import {chromium} from '../frontend/node_modules/@playwright/test/index.mjs';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=await new Promise((resolve,reject)=>{
  const probe=net.createServer();
  probe.once('error',reject);
  probe.listen(0,'127.0.0.1',()=>{const address=probe.address();probe.close(()=>resolve(address.port));});
});
const base='http://127.0.0.1:'+port;
const data=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-hotel-ai-browser-'));
const python=process.env.WERKZ_TEST_PYTHON||path.join(root,'.venv','Scripts','python.exe');
const childEnv={...process.env};
for(const key of Object.keys(childEnv)){
  if(key.startsWith('WERKZ_HOTEL_')||key.startsWith('WERKZ_QWEN_')||key.startsWith('WERKZ_SYNTHETIC_')||['OPENAI_API_KEY','DATABASE_URL','RENDER_EXTERNAL_HOSTNAME'].includes(key))delete childEnv[key];
}
Object.assign(childEnv,{WERKZ_AI_DATA:data,WERKZ_AI_PACKAGE:'hotel',WERKZ_AI_MODE:'production',WERKZ_HOTEL_OPENAI_ENABLED:'0',WERKZ_HOTEL_POSTGRES_ENABLED:'0',WERKZ_ONLINE_TEST:'0'});
const server=spawn(python,['-m','uvicorn','backend.app:app','--host','127.0.0.1','--port',String(port),'--no-access-log'],{
  cwd:root,
  env:childEnv,
  stdio:['ignore','pipe','pipe'],
});
let serverLog='';
let serverExit=null;
server.stdout.on('data',value=>serverLog+=value);
server.stderr.on('data',value=>serverLog+=value);
server.once('exit',(code,signal)=>{serverExit={code,signal};});

let browser;
try{
  let ready=false;
  for(let i=0;i<100;i++){
    if(serverExit)throw Error('Synthetic server exited before readiness: '+JSON.stringify(serverExit)+' '+serverLog);
    try{if((await fetch(base+'/api/setup')).ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  assert.ok(ready,serverLog);
  const launch={headless:true};
  if(process.env.WERKZ_BROWSER_CHANNEL)launch.channel=process.env.WERKZ_BROWSER_CHANNEL;
  browser=await chromium.launch(launch);
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));

  const credentials={username:'synthetic_ai_owner',password:'synthetic-only-test'};
  assert.equal((await context.request.post(base+'/api/setup',{headers:{origin:base},data:credentials})).status(),201);
  assert.equal((await context.request.post(base+'/api/login',{headers:{origin:base},data:credentials})).status(),200);

  // An online production Hotel login must remain available on phones.  The
  // online-test label is not the same thing as public demo authentication.
  // This test uses a mock status response; it performs no live online request.
  const anonymous=await browser.newContext({viewport:{width:390,height:844}});
  await anonymous.route('**/api/health',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({app:'ok',name:'WERKZ Hotel',package:'hotel',mode:'production',
      engine:'offline',models:[],localOnly:false,onlineTest:true,storage:'postgres'}),
  }));
  const anonymousPage=await anonymous.newPage();
  await anonymousPage.goto(base);
  await anonymousPage.getByRole('heading',{name:/Sicher anmelden/}).waitFor();
  assert.equal(await anonymousPage.getByRole('textbox',{name:'Benutzername'}).isVisible(),true);
  assert.equal(await anonymousPage.locator('input[name="password"]').isVisible(),true);
  assert.equal(await anonymousPage.getByRole('button',{name:'Anmelden',exact:true}).isVisible(),true);
  assert.equal(await anonymousPage.getByText('Hotel mit fertigen Testprofilen öffnen').count(),0);
  assert.equal(await anonymousPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,
    'Online Hotel login must not overflow a 390px mobile viewport');
  await anonymous.close();

  const usage={calls:2,reservedMicroUsd:320,actualMicroUsd:72,callLimit:20,budgetMicroUsd:5000};
  let responseMode='success';
  let markDelayedStarted=null;
  await page.route('**/api/hotel/ai/providers',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    local:{state:'NOT_VERIFIED'},openai:{state:'CONFIGURED'},cloudDataScope:'USER_QUESTION_ONLY',hotelRecordsShared:false,
    outboundBridge:{state:'NOT_VERIFIED',configured:true,authenticated:true,last_successful_check:null,error_category:'LIVE_CHECK_REQUIRED'},
    openaiUsage:usage,
  })}));
  await page.route('**/api/hotel/ai/ask',async route=>{
    if(responseMode==='delayed'){
      markDelayedStarted?.();
      await new Promise(resolve=>setTimeout(resolve,1500));
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({answer:'must not render after abort',model:'synthetic',provider:'openai',verifiedHotelData:false,createdReservation:false,dataScope:'USER_QUESTION_ONLY',openaiUsage:usage})});
      return;
    }
    if(responseMode==='error'){
      await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'Provider vorübergehend nicht verfügbar.'})});
      return;
    }
    const request=JSON.parse(route.request().postData()||'{}');
    assert.equal(request.provider,'openai');
    assert.equal(request.question,'Synthetische Übergabe erklären');
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({answer:'Synthetische Antwort ohne Hoteldaten.',model:'gpt-6-luna-test',provider:'openai',verifiedHotelData:false,createdReservation:false,dataScope:'USER_QUESTION_ONLY',openaiUsage:{...usage,calls:3,reservedMicroUsd:480,actualMicroUsd:101}})});
  });

  await page.goto(base);
  const hotelNavigation=page.getByRole('navigation',{name:'Hotelbereiche'});
  await hotelNavigation.getByRole('button',{name:'WerkZ Hotel-KI',exact:true}).click();
  await page.getByRole('heading',{name:'WerkZ Hotel-KI',exact:true}).waitFor();
  const assistant=page.locator('section[aria-label="WerkZ Hotel KI"]');
  await assistant.waitFor();
  const provider=assistant.locator('select').first();
  assert.equal(await provider.inputValue(),'local');
  await provider.selectOption('openai');
  await page.getByText(/Persistenter OpenAI-Zähler: 2\/20 Aufrufe/).waitFor();
  await page.getByText(/Status der ausgehenden Geräte-Bridge: NOT_VERIFIED · Cloud-Freigabe: CONFIGURED/).waitFor();
  await page.getByText(/Bridge-Hinweis: LIVE_CHECK_REQUIRED/).waitFor();

  const question=assistant.locator('textarea').first();
  await question.fill('Synthetische Übergabe erklären');
  await page.getByRole('button',{name:'Frage beantworten',exact:true}).click();
  await page.getByText('Synthetische Antwort ohne Hoteldaten.',{exact:true}).waitFor();
  await page.getByText(/OpenAI API · gpt-6-luna-test/).waitFor();
  await page.getByText(/OpenAI-Testbudget: 3\/20 Aufrufe/).waitFor();
  await page.getByText('Keine Echtzeit-Hoteldaten geprüft. Keine Reservierung ausgelöst.',{exact:true}).waitFor();

  responseMode='error';
  await question.fill('Synthetischen Fehler prüfen');
  await page.getByRole('button',{name:'Frage beantworten',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Provider vorübergehend nicht verfügbar.'}).waitFor();
  assert.equal((await page.getByRole('alert').innerText()).includes('token'),false);

  responseMode='delayed';
  const delayedStarted=new Promise(resolve=>{markDelayedStarted=resolve;});
  await question.fill('Synthetischen Abbruch prüfen');
  await page.getByRole('button',{name:'Frage beantworten',exact:true}).click();
  await Promise.race([delayedStarted,new Promise((_,reject)=>setTimeout(()=>reject(Error('Delayed request did not start')),3000))]);
  await page.getByRole('button',{name:'Anfrage abbrechen',exact:true}).click();
  await page.getByRole('button',{name:'Frage beantworten',exact:true}).waitFor();
  await page.waitForTimeout(1700);
  assert.equal(await page.getByText('must not render after abort',{exact:true}).count(),0);

  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Kein horizontaler Überlauf bei '+width);
    const nav=hotelNavigation.getByRole('button',{name:'WerkZ Hotel-KI',exact:true});
    assert.equal(await nav.isVisible(),true,'Hotel-KI-Navigation sichtbar bei '+width);
    const box=await nav.boundingBox();
    assert.ok(box&&box.height>=32,'Hotel-KI-Navigation bedienbar bei '+width);
  }
  assert.deepEqual(errors,[]);
  console.log('Hotel AI UI PASS: production online login on 390px, provider switch, readiness, persistent cost, redacted failure, abort and responsive layouts.');
}finally{
  await browser?.close();
  server.kill();
}
