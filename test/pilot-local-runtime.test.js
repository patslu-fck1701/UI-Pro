'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const nodeCrypto=require('node:crypto');

const html=fs.readFileSync(path.join(__dirname,'..','apps','simple-pilot','index.html'),'utf8');
const match=html.match(/<script>([\s\S]*)<\/script>/);
if(!match)throw new Error('pilot inline script missing');
const script=match[1];

function makeStorage(seed={}){
  const m=new Map(Object.entries(seed));
  return {
    getItem:k=>m.has(k)?m.get(k):null,
    setItem:(k,v)=>m.set(String(k),String(v)),
    removeItem:k=>m.delete(k),
    clear:()=>m.clear(),
    dump:()=>Object.fromEntries(m)
  };
}
function asyncReq(result){
  const req={result,error:null,onsuccess:null,onerror:null};
  queueMicrotask(()=>{if(req.onsuccess)req.onsuccess()});
  return req;
}
function makeIndexedDb(){
  const store={
    getAll:()=>asyncReq([]),
    get:()=>asyncReq(undefined),
    put:()=>asyncReq(undefined),
    delete:()=>asyncReq(undefined)
  };
  const db={
    objectStoreNames:{contains:()=>true},
    createObjectStore:()=>store,
    transaction:()=>({objectStore:()=>store})
  };
  return {
    open:()=>{
      const req={result:db,error:null,onupgradeneeded:null,onsuccess:null,onerror:null};
      queueMicrotask(()=>{if(req.onsuccess)req.onsuccess()});
      return req;
    }
  };
}
function makeElement(){
  return {
    hidden:false,value:'',textContent:'',innerHTML:'',dataset:{},style:{},
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    setAttribute(){},scrollIntoView(){},querySelectorAll(){return []},
    addEventListener(){},click(){},focus(){}
  };
}
function timer(fn,ms,...args){
  const t=setTimeout(fn,ms,...args);
  if(t&&typeof t.unref==='function')t.unref();
  return t;
}

test('runtime: voice order is stored and rendered with network completely down',async()=>{
  const elements=new Map();
  const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
  const localStorage=makeStorage({
    werkzPilotTenantScope:'slug:tester',
    werkzPilotTenantLabel:'Tester',
    werkzPilotTenantSlug:'tester',
    werkzPilotPage:'jobs'
  });
  const context={
    console,
    localStorage,
    sessionStorage:makeStorage(),
    indexedDB:makeIndexedDb(),
    document:{
      hidden:false,
      querySelector:getEl,
      querySelectorAll:()=>[],
      addEventListener(){}
    },
    navigator:{},
    location:{href:'https://example.invalid/pilot/?tenant=tester',search:'?tenant=tester'},
    history:{},
    URL,
    URLSearchParams,
    AbortController,
    crypto:{randomUUID:()=>nodeCrypto.randomUUID()},
    fetch:async()=>{throw new TypeError('Load failed')},
    alert(){},confirm(){return false},prompt(){return null},
    btoa:v=>Buffer.from(String(v),'binary').toString('base64'),
    atob:v=>Buffer.from(String(v),'base64').toString('binary'),
    FileReader:function(){},
    Blob,
    TextEncoder,
    TextDecoder,
    setTimeout:timer,
    clearTimeout,
    setInterval:()=>0,
    clearInterval(){},
    window:null
  };
  context.window={
    addEventListener(){},
    scrollTo(){},
    SpeechRecognition:null,
    webkitSpeechRecognition:null
  };
  context.window.window=context.window;
  context.window.document=context.document;
  context.window.navigator=context.navigator;

  vm.createContext(context);
  vm.runInContext(script,context,{filename:'simple-pilot-inline.js'});

  await new Promise(resolve=>setTimeout(resolve,10));
  await context.saveVoiceNote('morgen 2500 kilo eisenschrott in alfeld abholen');

  const key='werkzPilotLocalOrders::slug:tester';
  const stored=JSON.parse(localStorage.getItem(key)||'[]');
  assert.equal(stored.length,1);
  assert.equal(stored[0].materialKey,'mixed-scrap');
  assert.equal(stored[0].estimatedWeightKg,2500);
  assert.equal(stored[0].location,'alfeld');

  const route=elements.get('#routePlan');
  const next=elements.get('#nextJob');
  assert.ok(route);
  assert.match(route.innerHTML,/Sprachauftrag/);
  assert.match(route.innerHTML,/Mischschrott/);
  assert.match(route.innerHTML,/2500 kg/);
  assert.match(route.innerHTML,/alfeld/i);
  assert.ok(next);
  assert.match(next.innerHTML,/Mischschrott/);
});


test('runtime: tenant slug from URL wins before delayed session response',async()=>{
  const elements=new Map();
  const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
  const localStorage=makeStorage({
    werkzPilotTenantScope:'slug:dirk',
    werkzPilotTenantLabel:'Alt',
    werkzPilotTenantSlug:'dirk',
    werkzPilotPage:'jobs'
  });
  let sessionResolve;
  const fetch=async url=>{
    if(String(url).includes('/pilot/api/session'))return new Promise(resolve=>{sessionResolve=()=>resolve({ok:true,status:200,json:async()=>({organisationId:'org-schrotties-test-1',organisationLabel:'Tester',publicSlug:'tester',modules:{}})})});
    throw new TypeError('Load failed');
  };
  const context={
    console,localStorage,sessionStorage:makeStorage(),indexedDB:makeIndexedDb(),
    document:{hidden:false,querySelector:getEl,querySelectorAll:()=>[],addEventListener(){}},
    navigator:{},location:{href:'https://example.invalid/pilot/?tenant=tester',search:'?tenant=tester'},history:{},
    URL,URLSearchParams,AbortController,crypto:{randomUUID:()=>nodeCrypto.randomUUID()},fetch,
    alert(){},confirm(){return false},prompt(){return null},
    btoa:v=>Buffer.from(String(v),'binary').toString('base64'),atob:v=>Buffer.from(String(v),'base64').toString('binary'),
    FileReader:function(){},Blob,TextEncoder,TextDecoder,setTimeout:timer,clearTimeout,setInterval:()=>0,clearInterval(){},window:null
  };
  context.window={addEventListener(){},scrollTo(){},SpeechRecognition:null,webkitSpeechRecognition:null};
  context.window.window=context.window;context.window.document=context.document;context.window.navigator=context.navigator;
  vm.createContext(context);
  vm.runInContext(script,context,{filename:'simple-pilot-inline.js'});
  await context.saveVoiceNote('morgen 2500 kilo eisenschrott in alfeld abholen');
  const key='werkzPilotLocalOrders::slug:tester';
  const stored=JSON.parse(localStorage.getItem(key)||'[]');
  assert.equal(stored.length,1);
  assert.equal(stored[0].tenantSlug,'tester');
  assert.match(elements.get('#routePlan').innerHTML,/alfeld/i);
  if(sessionResolve)sessionResolve();
});


test('runtime: SpeechRecognition interim transcript is saved when recognition ends',async()=>{
  const elements=new Map();
  const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
  const localStorage=makeStorage({
    werkzPilotTenantScope:'slug:tester',
    werkzPilotTenantLabel:'Tester',
    werkzPilotTenantSlug:'tester',
    werkzPilotPage:'home'
  });
  let recognitionInstance=null;
  class FakeRecognition{
    constructor(){recognitionInstance=this;this.lang='';this.interimResults=false;this.continuous=false;this.maxAlternatives=1}
    start(){if(this.onstart)this.onstart()}
    stop(){if(this.onend)this.onend()}
  }
  const context={
    console,localStorage,sessionStorage:makeStorage(),indexedDB:makeIndexedDb(),
    document:{hidden:false,querySelector:getEl,querySelectorAll:()=>[],addEventListener(){},getElementById:id=>getEl('#'+id)},
    navigator:{},location:{href:'https://example.invalid/pilot/?tenant=tester',search:'?tenant=tester'},history:{},
    URL,URLSearchParams,AbortController,crypto:{randomUUID:()=>nodeCrypto.randomUUID()},
    fetch:async()=>{throw new TypeError('Load failed')},
    alert(){},confirm(){return false},prompt(){return null},
    btoa:v=>Buffer.from(String(v),'binary').toString('base64'),atob:v=>Buffer.from(String(v),'base64').toString('binary'),
    FileReader:function(){},Blob,TextEncoder,TextDecoder,setTimeout:timer,clearTimeout,setInterval:()=>0,clearInterval(){},window:null
  };
  context.window={addEventListener(){},scrollTo(){},SpeechRecognition:null,webkitSpeechRecognition:FakeRecognition};
  context.window.window=context.window;context.window.document=context.document;context.window.navigator=context.navigator;
  vm.createContext(context);
  vm.runInContext(script,context,{filename:'simple-pilot-inline.js'});
  const btn=elements.get('#noteBtn');
  assert.ok(btn&&typeof btn.onclick==='function');
  btn.onclick();
  assert.ok(recognitionInstance);
  const result=[{transcript:'morgen 2500 kilo eisenschrott in alfeld abholen'}];
  result.isFinal=false;
  recognitionInstance.onresult({resultIndex:0,results:[result]});
  recognitionInstance.onend();
  await new Promise(resolve=>setTimeout(resolve,10));
  const stored=JSON.parse(localStorage.getItem('werkzPilotLocalOrders::slug:tester')||'[]');
  assert.equal(stored.length,1);
  assert.equal(stored[0].location,'alfeld');
  assert.equal(stored[0].estimatedWeightKg,2500);
  assert.match(elements.get('#voiceLast').textContent,/2500 kilo eisenschrott/i);
  assert.match(elements.get('#routePlan').innerHTML,/Sprachauftrag/);
});
