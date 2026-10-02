'use strict';

const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),child=require('node:child_process');
const cli=path.resolve(__dirname,'../tools/device-enrollment.js');
const run=args=>child.spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});

test('device enrollment CLI supports issue, enroll, list and revoke without storing private keys',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-device-cli-'));
  try{
    const state=path.join(root,'enrollment.json'),pair=crypto.generateKeyPairSync('ed25519'),pub=path.join(root,'public.pem');
    fs.writeFileSync(pub,pair.publicKey.export({type:'spki',format:'pem'}));
    let result=run(['issue',state,'org-a','admin-a']);
    assert.equal(result.status,0);const issued=JSON.parse(result.stdout);assert.ok(issued.token);
    result=run(['enroll',state,issued.token,pub,'WerkZ','Agent','A']);
    assert.equal(result.status,0);const device=JSON.parse(result.stdout);assert.equal(device.organisationId,'org-a');
    result=run(['list',state,'org-a','active']);
    assert.equal(result.status,0);assert.equal(JSON.parse(result.stdout).devices.length,1);
    result=run(['revoke',state,device.id,'admin-a','retired','device']);
    assert.equal(result.status,0);assert.equal(JSON.parse(result.stdout).status,'revoked');
    const persisted=fs.readFileSync(state,'utf8');
    assert.equal(persisted.includes('PRIVATE KEY'),false);
    assert.equal(persisted.includes(issued.token),false);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('device enrollment CLI drill authenticates then proves revocation',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-device-drill-'));
  try{
    const result=run(['drill',path.join(root,'enrollment.json'),'org-drill','admin-drill']);
    assert.equal(result.status,0,result.stderr);
    const payload=JSON.parse(result.stdout);
    assert.equal(payload.drill,'passed');
    assert.equal(payload.revocationVerified,true);
    assert.equal(payload.privateKeyPersisted,false);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});
