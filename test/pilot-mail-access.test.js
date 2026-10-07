'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EncryptedMailTokenStore,PostgresEncryptedMailTokenStore,GmailOAuthReadAccess,ICloudImapReadAccess}=require('../src/pilot/mail-access');
const session={organisationId:'org-a',actorId:'owner-a'};
function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),'werkz-mail-'))}
test('mail token store encrypts secrets and isolates tenants',()=>{const dir=temp();try{const file=path.join(dir,'tokens.json'),store=new EncryptedMailTokenStore({file,key:Buffer.alloc(32,7).toString('base64url')});store.set('org-a',{refreshToken:'private-test-token'});assert.equal(store.get('org-a').refreshToken,'private-test-token');assert.equal(store.get('org-b'),null);assert.doesNotMatch(fs.readFileSync(file,'utf8'),/private-test-token/);store.remove('org-a');assert.equal(store.get('org-a'),null);assert.equal(fs.statSync(file).mode&0o777,0o600)}finally{fs.rmSync(dir,{recursive:true,force:true})}});
test('Gmail OAuth requires exact mailbox, keeps read-only scope and never mutates messages',async()=>{const dir=temp(),calls=[];try{const store=new EncryptedMailTokenStore({file:path.join(dir,'tokens.json'),key:Buffer.alloc(32,8).toString('base64url')}),http=async(url,options={})=>{calls.push({url,method:options.method||'GET'});if(url.includes('/token'))return {ok:true,status:200,json:async()=>({access_token:'access-test',refresh_token:'refresh-test',expires_in:3600})};if(url.includes('/revoke'))return {ok:true,status:200,json:async()=>({})};if(url.endsWith('/profile'))return {ok:true,status:200,json:async()=>({emailAddress:'owner@example.invalid'})};if(url.includes('/messages/m1'))return {ok:true,status:200,json:async()=>({id:'m1',snippet:'Metall abholen',labelIds:['INBOX'],payload:{headers:[{name:'From',value:'kunde@example.invalid'},{name:'Subject',value:'Metall abholen'}]}})};if(url.includes('/messages'))return {ok:true,status:200,json:async()=>({messages:[{id:'m1'}]})};throw Error('unexpected URL')};const access=new GmailOAuthReadAccess({organisationId:'org-a',accountEmail:'owner@example.invalid',clientId:'client-test',clientSecret:'secret-test',redirectUri:'https://example.invalid/pilot/mail/google/callback',tokenStore:store,http});assert.throws(()=>access.begin({organisationId:'org-b',actorId:'owner-b'}),e=>e.code==='FORBIDDEN');const url=new URL(access.begin(session));assert.equal(url.searchParams.get('scope'),'https://www.googleapis.com/auth/gmail.readonly');assert.equal(url.searchParams.get('access_type'),'offline');assert.equal((await access.status(session)).connected,false);await access.finish(session,{state:url.searchParams.get('state'),code:'grant-test'});assert.equal((await access.status(session)).connected,true);const rows=await access.listRelevant({organisationId:'org-a'});assert.equal(rows.length,1);assert.equal(rows[0].readOnly,true);assert.equal(calls.filter(x=>x.url.includes('gmail.googleapis.com')).every(x=>x.method==='GET'),true);await assert.rejects(()=>access.listRelevant({organisationId:'org-b'}),e=>e.code==='FORBIDDEN');const disconnected=await access.disconnect(session);assert.equal(disconnected.connected,false);assert.equal(disconnected.providerRevocation,'revoked');assert.equal(calls.some(x=>x.url.includes('/revoke')&&x.method==='POST'),true);assert.equal((await access.status(session)).connected,false)}finally{fs.rmSync(dir,{recursive:true,force:true})}});
test('iCloud IMAP opens inbox read-only and never changes messages',async()=>{const actions=[],client={connect:async()=>actions.push('connect'),mailboxOpen:async(name,opts)=>actions.push(['open',name,opts.readOnly]),search:async()=>[101,102],fetch:async function*(){yield {uid:101,envelope:{from:[{address:'kunde@example.invalid'}],subject:'Schrott abholen',date:new Date('2026-10-04T10:00:00Z')}};yield {uid:102,envelope:{from:[{address:'news@example.invalid'}],subject:'Newsletter',date:new Date('2026-10-04T09:00:00Z')}}},logout:async()=>actions.push('logout')};const provider=new ICloudImapReadAccess({organisationId:'org-a',accountEmail:'owner@icloud.com',appPassword:'test-app-password',clientFactory:()=>client});const rows=await provider.listRelevant({organisationId:'org-a'});assert.equal(rows.length,1);assert.equal(rows[0].provider,'icloud');assert.equal(rows[0].readOnly,true);assert.deepEqual(actions[1],['open','INBOX',true]);assert.equal(actions.at(-1),'logout');await assert.rejects(()=>provider.listRelevant({organisationId:'org-b'}),e=>e.code==='FORBIDDEN')});

test('Postgres token store survives new instance and binds ciphertext to key',async()=>{const rows=new Map(),queries=[];const query=async(sql,args=[])=>{queries.push(sql);if(sql.startsWith('SELECT'))return {rows:rows.has(args[0])?[{envelope:rows.get(args[0])}]:[]};if(sql.startsWith('INSERT'))rows.set(args[0],JSON.parse(args[1]));if(sql.startsWith('DELETE'))rows.delete(args[0]);return {rows:[]}};const key=Buffer.alloc(32,9).toString('base64url'),a=new PostgresEncryptedMailTokenStore({query,key});await a.set('org-a:icloud',{appPassword:'test-private-password'});assert.doesNotMatch(JSON.stringify([...rows]),/test-private-password/);const b=new PostgresEncryptedMailTokenStore({query,key});assert.equal((await b.get('org-a:icloud')).appPassword,'test-private-password');assert.equal(await b.get('org-b:icloud'),null);rows.set('org-b:icloud',rows.get('org-a:icloud'));await assert.rejects(()=>b.get('org-b:icloud'));await b.remove('org-a:icloud');assert.equal(await b.get('org-a:icloud'),null);assert.ok(queries.some(sql=>sql.includes('CREATE TABLE IF NOT EXISTS')))});


test('Gmail disconnect removes local refresh token even when provider revocation fails',async()=>{
  const dir=temp();
  try{
    const store=new EncryptedMailTokenStore({file:path.join(dir,'tokens.json'),key:Buffer.alloc(32,10).toString('base64url')});
    store.set('org-a',{refreshToken:'refresh-secret',accessToken:'access-secret',expiresAt:Date.now()+60000,email:'owner@example.invalid'});
    const calls=[];
    const access=new GmailOAuthReadAccess({
      organisationId:'org-a',
      accountEmail:'owner@example.invalid',
      clientId:'client-test',
      clientSecret:'secret-test',
      redirectUri:'https://example.invalid/pilot/mail/google/callback',
      tokenStore:store,
      http:async(url,options={})=>{calls.push({url,method:options.method||'GET'});return {ok:false,status:503,json:async()=>({})}}
    });
    const result=await access.disconnect(session);
    assert.equal(result.connected,false);
    assert.equal(result.providerRevocation,'failed');
    assert.equal(store.get('org-a'),null);
    assert.equal(calls.length,1);
    assert.equal(calls[0].url,'https://oauth2.googleapis.com/revoke');
    assert.equal(calls[0].method,'POST');
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});


test('Gmail OAuth can discover the customer mailbox without a preconfigured address',async()=>{
  const dir=temp(),calls=[];
  try{
    const store=new EncryptedMailTokenStore({file:path.join(dir,'tokens.json'),key:Buffer.alloc(32,11).toString('base64url')});
    const http=async(url,options={})=>{
      calls.push({url,method:options.method||'GET'});
      if(url.includes('/token'))return {ok:true,status:200,json:async()=>({access_token:'access-self',refresh_token:'refresh-self',expires_in:3600})};
      if(url.endsWith('/profile'))return {ok:true,status:200,json:async()=>({emailAddress:'customer@gmail.com'})};
      throw Error('unexpected '+url);
    };
    const access=new GmailOAuthReadAccess({organisationId:'org-a',clientId:'client-test',clientSecret:'secret-test',redirectUri:'https://example.invalid/pilot/mail/google/callback',tokenStore:store,http});
    const start=new URL(access.begin(session));
    assert.equal(start.searchParams.get('scope'),'https://www.googleapis.com/auth/gmail.readonly');
    const result=await access.finish(session,{state:start.searchParams.get('state'),code:'grant-self'});
    assert.equal(result.connected,true);
    assert.equal(result.email,'customer@gmail.com');
    assert.equal(store.get('org-a').email,'customer@gmail.com');
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
