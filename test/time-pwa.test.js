'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');

const root=path.resolve(__dirname,'../apps/time-pwa');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('Time PWA manifest and offline shell are complete and self-contained',()=>{
  const manifest=JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.start_url,'./');
  for(const file of ['index.html','styles.css','app.js','sw.js','icon.svg'])assert.equal(fs.existsSync(path.join(root,file)),true,file);
  const worker=read('sw.js');
  for(const asset of ['./index.html','./styles.css','./app.js','./manifest.webmanifest','./icon.svg'])assert.equal(worker.includes(asset),true,asset);
  assert.equal(worker.includes('/api'),false,'service worker must not cache API/business responses');
});

test('mobile surface exposes required touch workflow without fixed office handoffs',()=>{
  const html=read('index.html');
  for(const id of ['start','stop','note','photo','mileage','correction','history','sync-status','conflicts']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/Kunde oder Einsatz/);
  assert.match(html,/Auftrag/);
  assert.match(html,/Optional/);
  assert.doesNotMatch(html,/Chef muss|Büro muss/);
});

test('PWA client uses server session and command boundaries without embedded credentials',()=>{
  const source=read('app.js').toLowerCase();
  assert.match(source,/\/session/);
  assert.match(source,/\/time\/commands/);
  assert.match(source,/credentials:'include'/);
  assert.match(source,/revision_conflict/);
  assert.match(source,/indexeddb/);
  for(const forbidden of ['admin_token','websitepublisher','project23947','bearer ','gabriel']){
    assert.equal(source.includes(forbidden),false,forbidden);
  }
});

test('offline shell does not claim unsupported binary photo success',()=>{
  const source=read('app.js');
  assert.match(source,/kein Scheinerfolg gespeichert/);
  assert.doesNotMatch(source,/readAsDataURL|base64/);
});
