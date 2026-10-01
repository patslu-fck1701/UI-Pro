'use strict';

const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),child=require('node:child_process');
const cli=path.resolve(__dirname,'../tools/release-manifest.js');
test('release CLI signs actual artifact bytes and rejects tampering',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-release-'));
  try{
    const pair=crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(path.join(root,'private.pem'),pair.privateKey.export({type:'pkcs8',format:'pem'}));
    fs.writeFileSync(path.join(root,'public.pem'),pair.publicKey.export({type:'spki',format:'pem'}));
    fs.writeFileSync(path.join(root,'package.bin'),'release bytes');
    fs.writeFileSync(path.join(root,'payload.json'),JSON.stringify({productId:'werkz-agent',version:'0.1.0',channel:'pilot',
      releasedAt:'2026-10-01T00:00:00Z',supportedUntil:'2031-10-01T00:00:00Z',artifacts:[{name:'package.bin'}]}));
    const run=args=>child.spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
    assert.equal(run(['sign',path.join(root,'payload.json'),root,path.join(root,'private.pem'),'key-1',path.join(root,'release.json')]).status,0);
    assert.equal(run(['verify',path.join(root,'release.json'),path.join(root,'public.pem'),root]).status,0);
    fs.writeFileSync(path.join(root,'package.bin'),'tampered');
    assert.equal(run(['verify',path.join(root,'release.json'),path.join(root,'public.pem'),root]).status,1);
    assert.equal(fs.readFileSync(path.join(root,'release.json'),'utf8').includes('PRIVATE KEY'),false);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});
