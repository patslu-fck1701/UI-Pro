'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FileTenantCredentialStore}=require('../src/pilot/tenant-credentials');

function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),'werkz-tenant-credentials-'))}

test('tenant password store hashes passwords and isolates organisations',()=>{
  const dir=temp();
  try{
    const file=path.join(dir,'credentials.json'),store=new FileTenantCredentialStore({file});
    store.setPassword('org-a','Correct Horse Battery 42');
    assert.equal(store.hasPassword('org-a'),true);
    assert.equal(store.hasPassword('org-b'),false);
    assert.equal(store.verifyPassword('org-a','Correct Horse Battery 42'),true);
    assert.equal(store.verifyPassword('org-a','correct horse battery 42'),false);
    assert.equal(store.verifyPassword('org-b','Correct Horse Battery 42'),false);
    const raw=fs.readFileSync(file,'utf8');
    assert.doesNotMatch(raw,/Correct Horse Battery 42/);
    assert.match(raw,/"algorithm":"scrypt"/);
    assert.equal(fs.statSync(file).mode&0o777,0o600);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('tenant password policy rejects short values and password can be replaced',()=>{
  const dir=temp();
  try{
    const store=new FileTenantCredentialStore({file:path.join(dir,'credentials.json')});
    assert.throws(()=>store.setPassword('org-a','short'),error=>error.code==='PASSWORD_POLICY');
    store.setPassword('org-a','First password 123');
    store.setPassword('org-a','Second password 456');
    assert.equal(store.verifyPassword('org-a','First password 123'),false);
    assert.equal(store.verifyPassword('org-a','Second password 456'),true);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});


test('postgres tenant credential store survives a new store instance',async()=>{
  const rows=new Map(),queries=[];
  const query=async(sql,args=[])=>{
    queries.push(sql);
    if(sql.startsWith('SELECT'))return {rows:rows.has(args[0])?[{password:rows.get(args[0])}]:[]};
    if(sql.startsWith('INSERT'))rows.set(args[0],JSON.parse(args[1]));
    return {rows:[]};
  };
  const {PostgresTenantCredentialStore}=require('../src/pilot/tenant-credentials');
  const first=new PostgresTenantCredentialStore({query});
  assert.equal(await first.hasPassword('org-a'),false);
  await first.setPassword('org-a','Persistent Customer 42!');
  assert.equal(await first.verifyPassword('org-a','Persistent Customer 42!'),true);
  const second=new PostgresTenantCredentialStore({query});
  assert.equal(await second.hasPassword('org-a'),true);
  assert.equal(await second.verifyPassword('org-a','Persistent Customer 42!'),true);
  assert.equal(await second.verifyPassword('org-b','Persistent Customer 42!'),false);
  assert.doesNotMatch(JSON.stringify([...rows]),/Persistent Customer 42!/);
  assert.ok(queries.some(sql=>sql.includes('CREATE TABLE IF NOT EXISTS werkz_tenant_credentials')));
});
