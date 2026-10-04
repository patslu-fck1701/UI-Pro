'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');

const christianCode='LOCAL-CHRISTIAN-TEST-ONLY';
const christianHash=crypto.createHash('sha256').update(christianCode).digest('hex');
const testerCode='LOCAL-TESTER-TEST-ONLY';
const testerHash=crypto.createHash('sha256').update(testerCode).digest('hex');
const dirkHash=crypto.createHash('sha256').update('LOCAL-DIRK-TEST-ONLY').digest('hex');

process.env.PORT='0';
process.env.WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS='1';
process.env.WERKZ_ENABLE_TEST_PROFILES='1';
process.env.WERKZ_TIME_DATA_DIR=path.join(os.tmpdir(),'werkz-login-test-'+process.pid);
process.env.WERKZ_TEST_ORGANISATION_ID='org-dirk-schrotties';
process.env.WERKZ_PILOT_BUSINESS_NAME='Dirk';
process.env.WERKZ_PILOT_SLUG='dirk';
process.env.WERKZ_PILOT_TEST_ACCOUNT_NAME='Local Test Owner';
process.env.WERKZ_PILOT_TEST_ACCOUNT_EMAILS='owner@example.invalid,backup@example.invalid';
process.env.WERKZ_PILOT_LOGIN_CODE_SHA256=dirkHash;
process.env.WERKZ_PILOT_ACCESS_EXPIRES_AT='2026-11-17T23:59:59+01:00';
process.env.WERKZ_PILOT_TENANTS_JSON=JSON.stringify([
  {
    id:'christian',
    publicSlug:'christian',
    name:'Christian',
    organisationId:'org-christian-schrotties',
    actorId:'owner-christian',
    loginCodeHash:christianHash,
    accessExpiresAt:'2026-11-17T23:59:59+01:00'
  },
  {
    id:'tester',
    publicSlug:'tester',
    name:'Tester',
    organisationId:'org-schrotties-test-1',
    actorId:'tester-1',
    loginCodeHash:testerHash,
    accessExpiresAt:'2026-11-17T23:59:59+01:00'
  }
]);

const {server}=require('../tools/time-test-server.js');

function request({method='GET',path='/',body=''}) {
  return new Promise((resolve,reject)=>{
    const addr=server.address();
    const req=http.request({
      host:'127.0.0.1',
      port:addr.port,
      method,
      path,
      headers: body ? {
        'content-type':'application/x-www-form-urlencoded',
        'content-length':Buffer.byteLength(body)
      } : {}
    },res=>{
      const chunks=[];
      res.on('data',c=>chunks.push(c));
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error',reject);
    if(body)req.write(body);
    req.end();
  });
}

test.after(()=>new Promise(resolve=>server.close(resolve)));

test('Christian login form normalizes tenant name and has password visibility toggle',async()=>{
  const r=await request({path:'/pilot/login?tenant=Christian'});
  assert.equal(r.status,200);
  assert.match(r.body,/name="tenant" value="christian"/);
  assert.match(r.body,/id="pilotCode"[^>]*type="password"/);
  assert.match(r.body,/id="togglePilotCode"/);
  assert.match(r.body,/>Anzeigen<\/button>/);
  assert.match(r.body,/i\.type=show\?"text":"password"/);
});

test('Christian can login with lowercase or spaced version of the uppercase access code',async()=>{
  const body=new URLSearchParams({
    tenant:'Christian',
    code:' local-christian-test-only ',
    return:'/pilot/'
  }).toString();
  const r=await request({method:'POST',path:'/pilot/login',body});
  assert.equal(r.status,303);
  assert.match(String(r.headers.location||''),/^\/pilot\/\?tenant=christian$/);
  assert.match(String(r.headers['set-cookie']||''),/werkz_session=/);
});

test('wrong Christian code gets a precise error',async()=>{
  const body=new URLSearchParams({
    tenant:'Christian',
    code:'not-the-code',
    return:'/pilot/'
  }).toString();
  const r=await request({method:'POST',path:'/pilot/login',body});
  assert.equal(r.status,401);
  assert.match(r.body,/Zugangscode falsch\./);
});


test('login page without a tenant stays empty instead of defaulting to Dirk',async()=>{
  const r=await request({path:'/pilot/login'});
  assert.equal(r.status,200);
  assert.match(r.body,/name="tenant" value=""/);
  assert.doesNotMatch(r.body,/name="tenant" value="dirk"/);
});

test('logout from Christian returns to Christian login instead of Dirk',async()=>{
  const loginBody=new URLSearchParams({
    tenant:'Christian',
    code:' local-christian-test-only ',
    return:'/pilot/'
  }).toString();
  const login=await request({method:'POST',path:'/pilot/login',body:loginBody});
  assert.equal(login.status,303);
  const cookie=String(login.headers['set-cookie']||'').split(';')[0];
  assert.match(cookie,/werkz_session=/);

  const logout=await new Promise((resolve,reject)=>{
    const addr=server.address();
    const req=http.request({
      host:'127.0.0.1',
      port:addr.port,
      method:'GET',
      path:'/pilot/logout',
      headers:{cookie}
    },res=>{
      const chunks=[];
      res.on('data',c=>chunks.push(c));
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error',reject);
    req.end();
  });
  assert.equal(logout.status,303);
  assert.equal(logout.headers.location,'/pilot/login?tenant=christian');

  const form=await request({path:logout.headers.location});
  assert.equal(form.status,200);
  assert.match(form.body,/name="tenant" value="christian"/);
  assert.doesNotMatch(form.body,/name="tenant" value="dirk"/);
});

test('logout redirect preserves whichever tenant was actually signed in',async()=>{
  for(const tenant of ['christian','tester']){
    const code=tenant==='christian'?christianCode:testerCode;
    const body=new URLSearchParams({tenant,code,return:'/pilot/'}).toString();
    const login=await request({method:'POST',path:'/pilot/login',body});
    assert.equal(login.status,303);
    const cookie=String(login.headers['set-cookie']||'').split(';')[0];

    const logout=await new Promise((resolve,reject)=>{
      const addr=server.address();
      const req=http.request({host:'127.0.0.1',port:addr.port,method:'GET',path:'/pilot/logout',headers:{cookie}},res=>{
        const chunks=[];
        res.on('data',c=>chunks.push(c));
        res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString('utf8')}));
      });
      req.on('error',reject);
      req.end();
    });
    assert.equal(logout.headers.location,'/pilot/login?tenant='+tenant);
  }
});

test('configured test-account mail is not replaced with fake inbox messages',async()=>{const login=await request({method:'POST',path:'/pilot/login',body:new URLSearchParams({tenant:'tester',code:testerCode,return:'/pilot/'}).toString()});assert.equal(login.status,303);const cookie=String(login.headers['set-cookie']||'').split(';')[0];const addr=server.address();async function get(path){return new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:addr.port,path,headers:{cookie}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}))});req.on('error',reject);req.end()})}const session=await get('/pilot/api/session');assert.equal(session.status,200);assert.equal(JSON.parse(session.body).organisationLabel,'Local Test Owner');assert.deepEqual(JSON.parse(session.body).accountEmails,['owner@example.invalid','backup@example.invalid']);const mail=await get('/pilot/api/mail');assert.equal(mail.status,200);assert.deepEqual(JSON.parse(mail.body),[])});

test('mail status is scoped to each tenant session',async()=>{async function signed(tenant,code){const login=await request({method:'POST',path:'/pilot/login',body:new URLSearchParams({tenant,code,return:'/pilot/'}).toString()});const cookie=String(login.headers['set-cookie']||'').split(';')[0];return new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:server.address().port,path:'/pilot/api/mail/status',headers:{cookie}},res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks).toString('utf8'))}))});req.on('error',reject);req.end()})}const owner=await signed('tester',testerCode),other=await signed('christian',christianCode);assert.equal(owner.status,200);assert.equal(other.status,200);assert.equal(owner.body.gmail.email,'owner@example.invalid');assert.equal(other.body.gmail.email,null);assert.equal(other.body.icloud.email,null);assert.equal((await request({path:'/pilot/api/mail/status'})).status,401)});
