'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {OAuthAuthorizationFlow,FileOAuthFlowState}=require('../src');
const config={id:'example',authorizationEndpoint:'https://auth.example.test/authorize',redirectUri:'https://api.werkz.test/oauth/callback',clientId:'public-client'};
const alice={organisationId:'org-a',actorId:'alice'},bob={organisationId:'org-b',actorId:'bob'};
test('OAuth state and PKCE are tenant-bound, one-time and keep verifier server-side',()=>{
  const events=[],flow=new OAuthAuthorizationFlow({audit:event=>events.push(event),providerConfigs:{example:config}});
  const start=flow.begin({session:alice,provider:'example',connectionKey:'primary',scopes:['calendar.read']});
  const url=new URL(start.authorizationUrl),state=url.searchParams.get('state');
  assert.equal(url.searchParams.get('response_type'),'code');
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.ok(state&&url.searchParams.get('code_challenge'));
  assert.equal(start.authorizationUrl.includes('code_verifier'),false);
  const consumed=flow.consume({session:alice,provider:'example',state,code:'temporary-code'});
  assert.equal(consumed.organisationId,'org-a');assert.equal(consumed.connectionKey,'primary');
  assert.equal(url.searchParams.get('code_challenge'),crypto.createHash('sha256').update(consumed.codeVerifier).digest('base64url'));
  assert.throws(()=>flow.consume({session:alice,provider:'example',state,code:'replay'}),error=>error.code==='OAUTH_STATE_DENIED');
  assert.equal(JSON.stringify(events).includes('temporary-code'),false);
  assert.equal(JSON.stringify(events).includes(consumed.codeVerifier),false);
});
test('OAuth callback rejects wrong tenant, actor and expired state',()=>{
  let now=new Date('2026-10-01T00:00:00Z');
  const flow=new OAuthAuthorizationFlow({clock:()=>now,providerConfigs:{example:config}});
  const start=flow.begin({session:alice,provider:'example',connectionKey:'primary',ttlMs:60000});
  const state=new URL(start.authorizationUrl).searchParams.get('state');
  assert.throws(()=>flow.consume({session:bob,provider:'example',state,code:'code'}),error=>error.code==='OAUTH_STATE_DENIED');
  const next=flow.begin({session:alice,provider:'example',connectionKey:'primary',ttlMs:60000});
  now=new Date('2026-10-01T00:01:00Z');
  assert.throws(()=>flow.consume({session:alice,provider:'example',state:new URL(next.authorizationUrl).searchParams.get('state'),code:'code'}),error=>error.code==='OAUTH_STATE_DENIED');
  assert.throws(()=>flow.begin({session:alice,provider:'unknown',connectionKey:'primary'}),error=>error.code==='PROVIDER_UNAVAILABLE');
  const unsafe=new OAuthAuthorizationFlow({providerConfigs:{example:{...config,authorizationEndpoint:'http://insecure.test/authorize'}}});
  assert.throws(()=>unsafe.begin({session:alice,provider:'example',connectionKey:'primary'}),error=>error.code==='VALIDATION_ERROR');
});

test('OAuth authorization survives restart and consumed state stays consumed',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-oauth-'));
  try{
    const file=path.join(root,'pending.json'),stateStore=new FileOAuthFlowState(file);
    const first=new OAuthAuthorizationFlow({stateStore,providerConfigs:{example:config}});
    const started=first.begin({session:alice,provider:'example',connectionKey:'primary'});
    const state=new URL(started.authorizationUrl).searchParams.get('state');
    assert.equal(fs.readFileSync(file,'utf8').includes(state),false);
    const second=new OAuthAuthorizationFlow({stateStore,providerConfigs:{example:config}});
    assert.equal(second.consume({session:alice,provider:'example',state,code:'code'}).connectionKey,'primary');
    assert.throws(()=>new OAuthAuthorizationFlow({stateStore,providerConfigs:{example:config}}).consume({session:alice,provider:'example',state,code:'replay'}),error=>error.code==='OAUTH_STATE_DENIED');
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});
