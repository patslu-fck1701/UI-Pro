'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {Readable}=require('node:stream');
const {twilioFormSignature,validateTwilioFormRequest,createTwilioVoiceWebhookHandler}=require('../src/pilot/twilio-voice');

function responseMock(){
  return {status:null,headers:null,body:'',writeHead(status,headers){this.status=status;this.headers=headers},end(body=''){this.body=String(body)}};
}
function requestMock(pathName,params,signature){
  const body=new URLSearchParams(params).toString();
  const request=Readable.from([Buffer.from(body)]);
  request.method='POST';request.url=pathName;request.headers={'content-type':'application/x-www-form-urlencoded','x-twilio-signature':signature};
  return request;
}

test('Twilio signature implementation matches the published form example',()=>{
  const url='https://example.com/myapp.php?foo=1&bar=2';
  const params={CallSid:'CA1234567890ABCDE',Caller:'+14158675310',Digits:'1234',From:'+14158675310',To:'+18005551212'};
  const signature=twilioFormSignature({authToken:'12345',url,params});
  assert.equal(signature,'L/OH5YylLD5NRKLltdqwSvS0BnU=');
  assert.equal(validateTwilioFormRequest({authToken:'12345',signature,url,params}),true);
  assert.equal(validateTwilioFormRequest({authToken:'wrong',signature,url,params}),false);
});

test('Twilio handler rejects invalid signatures before resolving a tenant',async()=>{
  let resolved=false,recorded=false;
  const handler=createTwilioVoiceWebhookHandler({
    authToken:'secret',publicBaseUrl:'https://voice.example',
    resolveTenantByCalledNumber:()=>{resolved=true;return {id:'primary'}},
    recordSpeech:async()=>{recorded=true}
  });
  const response=responseMock();
  await handler(requestMock('/pilot/provider/twilio/speech',{To:'+495151123456',SpeechResult:'Kupfer abholen',CallSid:'CA1'},'invalid'),response);
  assert.equal(response.status,403);assert.equal(resolved,false);assert.equal(recorded,false);
});

test('Twilio speech callback records a signed transcript and returns TwiML',async()=>{
  const params={To:'+495151123456',From:'+491701234567',SpeechResult:'Morgen in Hameln 200 Kilo Kupfer abholen',Confidence:'0.91',CallSid:'CAvoice1'};
  const pathName='/pilot/provider/twilio/speech',url='https://voice.example'+pathName;
  const signature=twilioFormSignature({authToken:'secret',url,params});
  let captured=null;
  const handler=createTwilioVoiceWebhookHandler({
    authToken:'secret',publicBaseUrl:'https://voice.example',
    resolveTenantByCalledNumber:number=>number==='+495151123456'?{id:'primary'}:null,
    recordSpeech:async value=>{captured=value}
  });
  const response=responseMock();
  await handler(requestMock(pathName,params,signature),response);
  assert.equal(response.status,200);assert.match(response.headers['content-type'],/text\/xml/);assert.match(response.body,/Auftrag wurde aufgenommen/);
  assert.equal(captured.text,params.SpeechResult);assert.equal(captured.callSid,'CAvoice1');assert.equal(captured.from,'+491701234567');assert.equal(captured.confidence,0.91);
});

function startServer(){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-twilio-voice-'));
  const child=spawn(process.execPath,[path.join(__dirname,'..','tools','time-test-server.js')],{
    cwd:path.join(__dirname,'..'),
    env:{
      ...process.env,PORT:'0',WERKZ_TIME_DATA_DIR:path.join(temp,'data'),
      WERKZ_TEST_SESSION_TOKEN:'time-manager-session',WERKZ_TEST_LOGIN_CODE:'test-login-code',
      WERKZ_ENABLE_TEST_PROFILES:'1',WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS:'',
      WERKZ_PILOT_SESSION_TOKEN:'twilio-primary-session',WERKZ_PILOT_LOGIN_CODE:'primary-login',
      WERKZ_TWILIO_AUTH_TOKEN:'twilio-test-token',WERKZ_PILOT_TWILIO_BASE_URL:'https://voice.example',
      WERKZ_PILOT_TWILIO_NUMBERS_JSON:JSON.stringify({'+495151123456':'primary'})
    },stdio:['ignore','pipe','pipe']
  });
  return {child,temp};
}
async function waitReady(child){
  let buffer='',stderr='';child.stderr.on('data',chunk=>{stderr+=chunk.toString('utf8')});
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('server ready timeout '+stderr)),12000);
    child.stdout.on('data',chunk=>{
      buffer+=chunk.toString('utf8');const lines=buffer.split('\n');buffer=lines.pop();
      for(const line of lines){if(!line.trim())continue;try{const x=JSON.parse(line);if(x.kind==='ready'){clearTimeout(timer);resolve(x);return}}catch{}}
    });
    child.once('exit',code=>{clearTimeout(timer);reject(new Error('server exited '+code+' '+stderr))});
  });
}
async function stopServer(child,temp){
  if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,2000))]);if(child.exitCode===null)child.kill('SIGKILL')}
  fs.rmSync(temp,{recursive:true,force:true});
}
async function twilioPost(localBase,pathName,params){
  const publicUrl='https://voice.example'+pathName,signature=twilioFormSignature({authToken:'twilio-test-token',url:publicUrl,params});
  return fetch(localBase+pathName,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':signature},body:new URLSearchParams(params)});
}

test('server maps signed Twilio speech to the normal tenant voice-order path idempotently',async()=>{
  const {child,temp}=startServer();
  try{
    const ready=await waitReady(child),base='http://127.0.0.1:'+ready.port;
    const voice=await twilioPost(base,'/pilot/provider/twilio/voice',{To:'+495151123456',From:'+491701234567',CallSid:'CAtest'});
    assert.equal(voice.status,200);assert.match(await voice.text(),/<Gather[^>]+input="speech"/);

    const speechParams={To:'+495151123456',From:'+491701234567',CallSid:'CAtest',SpeechResult:'Morgen in Hameln 200 Kilo Kupfer abholen',Confidence:'0.9'};
    const first=await twilioPost(base,'/pilot/provider/twilio/speech',speechParams);assert.equal(first.status,200);
    const replay=await twilioPost(base,'/pilot/provider/twilio/speech',speechParams);assert.equal(replay.status,200);

    const calls=await fetch(base+'/pilot/api/calls',{headers:{cookie:'werkz_session=twilio-primary-session'}}).then(r=>r.json());
    assert.equal(calls.length,1);assert.equal(calls[0].source,'voice-note');assert.equal(calls[0].materialKey,'copper');assert.match(calls[0].location,/Hameln/i);assert.equal(calls[0].estimatedWeightKg,200);assert.equal(calls[0].phone,'+491701234567');
  }finally{await stopServer(child,temp)}
});
