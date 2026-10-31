'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {OutboundAI,identityFromKey,signedRequest,validJob}=require('../scripts/outbound-ai.js');
const ORIGIN='https://project--9081192e-6239-40a6-8f20-02296cff5c91-dev.lovable.app';

test('signed WERKZ request binds route, timestamp, nonce and exact body',()=>{
  const identity=identityFromKey(crypto.generateKeyPairSync('ed25519').privateKey);
  const request=signedRequest(identity,'/api/public/local-ai/ask',{question:'synthetic'},1700000000000);
  const signed=['WERKZ-BRIDGE-1','POST','/api/public/local-ai/ask','1700000000',request.headers['x-werkz-nonce'],crypto.createHash('sha256').update(request.body).digest('hex')].join('\n');
  assert.equal(crypto.verify(null,Buffer.from(signed),identity.privateKey?crypto.createPublicKey(identity.privateKey):null,Buffer.from(request.headers['x-werkz-signature'],'base64')),true);
  assert.equal(request.headers['x-werkz-device'],identity.device_id);
});

test('synthetic worker handles ready leased job and signed completion',async()=>{
  const identity=identityFromKey(crypto.generateKeyPairSync('ed25519').privateKey),calls=[];
  const expires=new Date(Date.now()+60000).toISOString();
  const transport=async(url,request)=>{
    calls.push({url,request});
    if(url.endsWith('/ask'))return {ok:true,status:200,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify({state:'ready',job:{request_id:'0e35f114-7325-48ea-88d8-79bb5dbb5928',lease_id:'0e35f114-7325-48ea-88d8-79bb5dbb5929',tenant:'synthetic-hotel',prompt:'synthetic question',expires_at:expires}})};
    return {ok:true,status:200,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify({state:'succeeded'})};
  };
  const worker=new OutboundAI({identity,transport,analyze:async()=>({answer:'synthetic answer',model:'Qwen-test.gguf'}),origin:ORIGIN,tenant:'synthetic-hotel'});
  const result=await worker.serveOnce();
  assert.equal(result.state,'succeeded');
  assert.equal(calls.length,2);
  assert.match(calls[1].request.body,/synthetic answer/);
  for(const {url,request} of calls){
    const route=new URL(url).pathname,ts=request.headers['x-werkz-timestamp'],nonce=request.headers['x-werkz-nonce'];
    const signed=['WERKZ-BRIDGE-1','POST',route,ts,nonce,crypto.createHash('sha256').update(request.body).digest('hex')].join('\n');
    assert.equal(crypto.verify(null,Buffer.from(signed),crypto.createPublicKey(identity.privateKey),Buffer.from(request.headers['x-werkz-signature'],'base64')),true);
  }
});

test('worker rejects expired, repeated and malformed jobs before inference',async()=>{
  assert.equal(validJob({request_id:'0e35f114-7325-48ea-88d8-79bb5dbb5928',lease_id:'0e35f114-7325-48ea-88d8-79bb5dbb5929',prompt:'x',expires_at:new Date(Date.now()-1000).toISOString()}),false);
  assert.throws(()=>signedRequest(identityFromKey(crypto.generateKeyPairSync('ed25519').privateKey),'/arbitrary',{x:1}),/ROUTE_DENIED/);
});
