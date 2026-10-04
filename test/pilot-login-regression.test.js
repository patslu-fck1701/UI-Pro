'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');

const christianCode='CHR-SFKPM99YT';
const christianHash='c033999e0e51482313a8f207b5012322f94ff698419a9e5d8ea1dc1ddb605d10';
assert.equal(crypto.createHash('sha256').update(christianCode).digest('hex'),christianHash);

process.env.PORT='0';
process.env.WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS='1';
process.env.WERKZ_ENABLE_TEST_PROFILES='1';
process.env.WERKZ_TIME_DATA_DIR=path.join(os.tmpdir(),'werkz-login-test-'+process.pid);
process.env.WERKZ_TEST_ORGANISATION_ID='org-dirk-schrotties';
process.env.WERKZ_PILOT_BUSINESS_NAME='Dirk';
process.env.WERKZ_PILOT_SLUG='dirk';
process.env.WERKZ_PILOT_LOGIN_CODE_SHA256='838ae4b182e770b8ee20ff3756b95209abe9400c2bb94a89f2bd84a25d214b2a';
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
    loginCodeHash:'6e48eb352b40ec412af3f189fe282a66b011771bdf8a8ec72020e0895d829d91',
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
    code:' chr-sfkpm99yt ',
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
    code:' chr-sfkpm99yt ',
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
    const code=tenant==='christian'?'CHR-SFKPM99YT':'TST-QYJ453EVH';
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
