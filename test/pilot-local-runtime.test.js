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
  assert.match(next.innerHTML,/AUFTRAG ERLEDIGT/);
  assert.match(next.innerHTML,/data-complete-local=/);
  assert.match(route.innerHTML,/AUFTRAG ERLEDIGT/);
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
  await btn.onclick();
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


test('runtime: exact screenshot transcript repairs place material and weight locally',async()=>{
  const elements=new Map();
  const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
  const localStorage=makeStorage({
    werkzPilotTenantScope:'slug:tester',
    werkzPilotTenantLabel:'Tester',
    werkzPilotTenantSlug:'tester',
    werkzPilotPage:'home'
  });
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
  context.window={addEventListener(){},scrollTo(){},SpeechRecognition:null,webkitSpeechRecognition:null};
  context.window.window=context.window;context.window.document=context.document;context.window.navigator=context.navigator;
  vm.createContext(context);
  vm.runInContext(script,context,{filename:'simple-pilot-inline.js'});
  await context.saveVoiceNote('Morgen in Alfeld 2,15 Schritte');
  const stored=JSON.parse(localStorage.getItem('werkzPilotLocalOrders::slug:tester')||'[]');
  assert.equal(stored.length,1);
  assert.equal(stored[0].location,'Alfeld');
  assert.equal(stored[0].materialKey,'mixed-scrap');
  assert.equal(stored[0].estimatedWeightKg,2150);
  assert.match(elements.get('#routePlan').innerHTML,/Alfeld/);
  assert.match(elements.get('#routePlan').innerHTML,/Mischschrott/);
  assert.match(elements.get('#routePlan').innerHTML,/2150 kg/);
});


test('runtime: Android-capable browser requests microphone permission before starting recognition',async()=>{
  const elements=new Map();
  const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
  const localStorage=makeStorage({
    werkzPilotTenantScope:'slug:tester',
    werkzPilotTenantLabel:'Tester',
    werkzPilotTenantSlug:'tester',
    werkzPilotPage:'home'
  });
  let getUserMediaCalls=0,trackStops=0,recognitionStarts=0,recognitionInstance=null;
  class FakeRecognition{
    constructor(){recognitionInstance=this}
    start(){recognitionStarts++;if(this.onstart)this.onstart()}
    stop(){if(this.onend)this.onend()}
  }
  const context={
    console,localStorage,sessionStorage:makeStorage(),indexedDB:makeIndexedDb(),
    document:{hidden:false,querySelector:getEl,querySelectorAll:()=>[],addEventListener(){},getElementById:id=>getEl('#'+id)},
    navigator:{mediaDevices:{getUserMedia:async opts=>{getUserMediaCalls++;assert.equal(opts&&opts.audio,true);return {getTracks:()=>[{stop(){trackStops++}}]}}}},
    location:{href:'https://example.invalid/pilot/?tenant=tester',search:'?tenant=tester'},history:{},
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
  await btn.onclick();

  assert.equal(getUserMediaCalls,1);
  assert.equal(recognitionStarts,1);
  assert.ok(recognitionInstance);
  assert.match(elements.get('#noteHint').textContent,/^Jetzt sprechen/);
});

test('runtime: microphone denial prevents recognition and shows a clear error',async()=>{
  const elements=new Map();
  const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
  const localStorage=makeStorage({
    werkzPilotTenantScope:'slug:tester',
    werkzPilotTenantLabel:'Tester',
    werkzPilotTenantSlug:'tester'
  });
  let recognitionStarts=0;
  class FakeRecognition{start(){recognitionStarts++}}
  const context={
    console,localStorage,sessionStorage:makeStorage(),indexedDB:makeIndexedDb(),
    document:{hidden:false,querySelector:getEl,querySelectorAll:()=>[],addEventListener(){},getElementById:id=>getEl('#'+id)},
    navigator:{mediaDevices:{getUserMedia:async()=>{throw new Error('denied')}}},
    location:{href:'https://example.invalid/pilot/?tenant=tester',search:'?tenant=tester'},history:{},
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

  await elements.get('#noteBtn').onclick();

  assert.equal(recognitionStarts,0);
  assert.equal(elements.get('#noteLabel').textContent,'Nicht verstanden');
  assert.equal(elements.get('#noteHint').textContent,'Mikrofon nicht erlaubt');
});

test('runtime: unsupported Android speech API explains fallback and accepts typed order',async()=>{
  const elements=new Map();
  const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
  const localStorage=makeStorage({
    werkzPilotTenantScope:'slug:tester',
    werkzPilotTenantLabel:'Tester',
    werkzPilotTenantSlug:'tester'
  });
  let promptText='';
  const context={
    console,localStorage,sessionStorage:makeStorage(),indexedDB:makeIndexedDb(),
    document:{hidden:false,querySelector:getEl,querySelectorAll:()=>[],addEventListener(){},getElementById:id=>getEl('#'+id)},
    navigator:{mediaDevices:{getUserMedia:async()=>{throw new Error('should not be called')}}},
    location:{href:'https://example.invalid/pilot/?tenant=tester',search:'?tenant=tester'},history:{},
    URL,URLSearchParams,AbortController,crypto:{randomUUID:()=>nodeCrypto.randomUUID()},
    fetch:async()=>{throw new TypeError('Load failed')},
    alert(){},confirm(){return false},prompt(msg){promptText=String(msg);return 'morgen in alfeld 2 tonnen schrott'},
    btoa:v=>Buffer.from(String(v),'binary').toString('base64'),atob:v=>Buffer.from(String(v),'base64').toString('binary'),
    FileReader:function(){},Blob,TextEncoder,TextDecoder,setTimeout:timer,clearTimeout,setInterval:()=>0,clearInterval(){},window:null
  };
  context.window={addEventListener(){},scrollTo(){},SpeechRecognition:null,webkitSpeechRecognition:null};
  context.window.window=context.window;context.window.document=context.document;context.window.navigator=context.navigator;
  vm.createContext(context);
  vm.runInContext(script,context,{filename:'simple-pilot-inline.js'});

  await elements.get('#noteBtn').onclick();
  await new Promise(resolve=>setTimeout(resolve,10));

  assert.match(promptText,/Spracherkennung nicht verfügbar/);
  assert.match(elements.get('#voiceLast').textContent,/morgen in alfeld 2 tonnen schrott/i);
  const stored=JSON.parse(localStorage.getItem('werkzPilotLocalOrders::slug:tester')||'[]');
  assert.equal(stored.length,1);
  assert.equal(stored[0].location,'alfeld');
  assert.equal(stored[0].estimatedWeightKg,2000);
});


test('runtime: Google Maps URL is generated for a local order and remains clickable in PWA',async()=>{
  const elements=new Map();
  const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
  const localStorage=makeStorage({
    werkzPilotTenantScope:'slug:tester',
    werkzPilotTenantLabel:'Tester',
    werkzPilotTenantSlug:'tester',
    werkzPilotPage:'home'
  });
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
  context.window={addEventListener(){},scrollTo(){},SpeechRecognition:null,webkitSpeechRecognition:null};
  context.window.window=context.window;context.window.document=context.document;context.window.navigator=context.navigator;
  vm.createContext(context);
  vm.runInContext(script,context,{filename:'simple-pilot-inline.js'});

  assert.equal(context.mapsUrl('Alfeld'),
    'https://www.google.com/maps/dir/?api=1&destination=Alfeld&travelmode=driving');
  assert.equal(context.mapsUrl('Bahnhofstraße 12, 31061 Alfeld'),
    'https://www.google.com/maps/dir/?api=1&destination=Bahnhofstra%C3%9Fe%2012%2C%2031061%20Alfeld&travelmode=driving');

  await context.saveVoiceNote('morgen in Alfeld 2 tonnen schrott');

  const routeHtml=elements.get('#routePlan').innerHTML;
  const nextHtml=elements.get('#nextJob').innerHTML;
  assert.match(routeHtml,/class="mapsgo"/);
  assert.match(routeHtml,/data-maps-destination="Alfeld"/);
  assert.doesNotMatch(routeHtml,/target="_blank"/);
  assert.match(nextHtml,/GOOGLE MAPS STARTEN/);

  const opened=context.openMapsDestination('Alfeld');
  assert.equal(opened,'https://www.google.com/maps/dir/?api=1&destination=Alfeld&travelmode=driving');
  assert.equal(context.location.href,opened);
});

test('runtime: Maps action is a button and tap handler can navigate without anchor behavior',()=>{
  assert.match(script,/function openMapsDestination\(destination\)/);
  assert.match(script,/data-maps-destination/);
  assert.match(script,/closest\('\.mapsgo\[data-maps-destination\]'\)/);
  assert.match(script,/location\.href=url/);
});


test('runtime: Android speech keeps full address and renders active Maps button for Christian',async()=>{
  const elements=new Map();
  const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
  const localStorage=makeStorage({
    werkzPilotTenantScope:'slug:christian',
    werkzPilotTenantLabel:'Christian',
    werkzPilotTenantSlug:'christian',
    werkzPilotPage:'home'
  });
  let recognitionInstance=null;
  class FakeRecognition{
    constructor(){recognitionInstance=this}
    start(){if(this.onstart)this.onstart()}
    stop(){if(this.onend)this.onend()}
  }
  const context={
    console,localStorage,sessionStorage:makeStorage(),indexedDB:makeIndexedDb(),
    document:{hidden:false,querySelector:getEl,querySelectorAll:()=>[],addEventListener(){},getElementById:id=>getEl('#'+id)},
    navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}},
    location:{href:'https://example.invalid/pilot/?tenant=christian',search:'?tenant=christian'},history:{},
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

  await elements.get('#noteBtn').onclick();
  const result=[{transcript:'Morgen Teststraße, Hausnummer 12, Postleitzahl 31061, Ort Alfeld, 2 Tonnen Schrott abholen'}];
  result.isFinal=true;
  recognitionInstance.onresult({resultIndex:0,results:[result]});
  recognitionInstance.onend();
  await new Promise(resolve=>setTimeout(resolve,10));

  const stored=JSON.parse(localStorage.getItem('werkzPilotLocalOrders::slug:christian')||'[]');
  assert.equal(stored.length,1);
  assert.equal(stored[0].location,'Teststraße 12, 31061 Alfeld');
  assert.match(elements.get('#routePlan').innerHTML,/data-maps-destination="Teststraße 12, 31061 Alfeld"/);
  assert.match(elements.get('#nextJob').innerHTML,/GOOGLE MAPS STARTEN/);
});

test('runtime: blank server location cannot erase richer local Christian address after sync',async()=>{
  const elements=new Map();
  const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
  const localStorage=makeStorage({
    werkzPilotTenantScope:'slug:christian',
    werkzPilotTenantLabel:'Christian',
    werkzPilotTenantSlug:'christian',
    werkzPilotPage:'home'
  });
  localStorage.setItem('werkzPilotLocalOrders::slug:christian',JSON.stringify([{
    id:'local-1',clientMutationId:'local-1',tenant:'slug:christian',tenantSlug:'christian',
    serverCallId:'call-1',status:'open',name:'Sprachauftrag',
    originalText:'Teststraße 12 31061 Alfeld 2 Tonnen Schrott',
    text:'Teststraße 12 31061 Alfeld 2 Tonnen Schrott',
    location:'Teststraße 12, 31061 Alfeld',materialKey:'mixed-scrap',material:'Mischschrott',
    quantity:'2000 kg',estimatedWeightKg:2000,scheduledFor:null,source:'voice-note-local',syncState:'synced'
  }]));
  const context={
    console,localStorage,sessionStorage:makeStorage(),indexedDB:makeIndexedDb(),
    document:{hidden:false,querySelector:getEl,querySelectorAll:()=>[],addEventListener(){},getElementById:id=>getEl('#'+id)},
    navigator:{},location:{href:'https://example.invalid/pilot/?tenant=christian',search:'?tenant=christian'},history:{},
    URL,URLSearchParams,AbortController,crypto:{randomUUID:()=>nodeCrypto.randomUUID()},
    fetch:async url=>{
      if(String(url).includes('/pilot/api/route-plan'))return {ok:true,status:200,json:async()=>({stops:[{
        id:'call-1',entityType:'call',name:'Sprachauftrag',location:'',materialKey:'',material:'',quantity:'',
        estimatedWeightKg:null,scheduledFor:null,source:'voice-note',originalText:'',orders:[]
      }]})};
      throw new TypeError('offline');
    },
    alert(){},confirm(){return false},prompt(){return null},
    btoa:v=>Buffer.from(String(v),'binary').toString('base64'),atob:v=>Buffer.from(String(v),'base64').toString('binary'),
    FileReader:function(){},Blob,TextEncoder,TextDecoder,setTimeout:timer,clearTimeout,setInterval:()=>0,clearInterval(){},window:null
  };
  context.window={addEventListener(){},scrollTo(){},SpeechRecognition:null,webkitSpeechRecognition:null};
  context.window.window=context.window;context.window.document=context.document;context.window.navigator=context.navigator;
  vm.createContext(context);
  vm.runInContext(script,context,{filename:'simple-pilot-inline.js'});
  await new Promise(resolve=>setTimeout(resolve,10));
  await context.routePlan();
  assert.match(elements.get('#routePlan').innerHTML,/Teststraße 12, 31061 Alfeld/);
  assert.match(elements.get('#routePlan').innerHTML,/data-maps-destination="Teststraße 12, 31061 Alfeld"/);
});


test('runtime: old Android server row reparses raw voice text and shows the same Maps button as iPhone',async()=>{
  const elements=new Map();
  const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
  const localStorage=makeStorage({
    werkzPilotTenantScope:'slug:christian',
    werkzPilotTenantLabel:'Christian',
    werkzPilotTenantSlug:'christian',
    werkzPilotPage:'home'
  });
  const context={
    console,localStorage,sessionStorage:makeStorage(),indexedDB:makeIndexedDb(),
    document:{hidden:false,querySelector:getEl,querySelectorAll:()=>[],addEventListener(){},getElementById:id=>getEl('#'+id)},
    navigator:{userAgent:'Mozilla/5.0 (Linux; Android 14)'},location:{href:'https://example.invalid/pilot/?tenant=christian',search:'?tenant=christian'},history:{},
    URL,URLSearchParams,AbortController,crypto:{randomUUID:()=>nodeCrypto.randomUUID()},
    fetch:async url=>{
      if(String(url).includes('/pilot/api/route-plan'))return {ok:true,status:200,json:async()=>({stops:[{
        id:'call-old',entityType:'call',name:'Sprachauftrag',location:'',material:'',materialKey:'',quantity:'',
        estimatedWeightKg:null,distanceKm:0,scheduledFor:null,source:'voice-note',
        originalText:'Abholung: Morgen Teststraße 12 31061 Alfeld 2 Tonnen Schrott abholen',orders:[]
      }]})};
      throw new TypeError('offline');
    },
    alert(){},confirm(){return false},prompt(){return null},
    btoa:v=>Buffer.from(String(v),'binary').toString('base64'),atob:v=>Buffer.from(String(v),'base64').toString('binary'),
    FileReader:function(){},Blob,TextEncoder,TextDecoder,setTimeout:timer,clearTimeout,setInterval:()=>0,clearInterval(){},window:null
  };
  context.window={addEventListener(){},scrollTo(){},SpeechRecognition:null,webkitSpeechRecognition:null};
  context.window.window=context.window;context.window.document=context.document;context.window.navigator=context.navigator;
  vm.createContext(context);
  vm.runInContext(script,context,{filename:'simple-pilot-inline.js'});
  await new Promise(resolve=>setTimeout(resolve,10));
  await context.routePlan();

  const next=elements.get('#nextJob').innerHTML;
  assert.match(next,/Teststraße 12, 31061 Alfeld/);
  assert.match(next,/Mischschrott/);
  assert.match(next,/2000 kg/);
  assert.match(next,/data-maps-destination="Teststraße 12, 31061 Alfeld"/);
  assert.match(next,/GOOGLE MAPS STARTEN/);
});

test('runtime: Android and iPhone produce identical next-job markup for the same parsed order',async()=>{
  async function render(ua){
    const elements=new Map();
    const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
    const localStorage=makeStorage({werkzPilotTenantScope:'slug:tester',werkzPilotTenantLabel:'Tester',werkzPilotTenantSlug:'tester',werkzPilotPage:'home'});
    const context={
      console,localStorage,sessionStorage:makeStorage(),indexedDB:makeIndexedDb(),
      document:{hidden:false,querySelector:getEl,querySelectorAll:()=>[],addEventListener(){},getElementById:id=>getEl('#'+id)},
      navigator:{userAgent:ua},location:{href:'https://example.invalid/pilot/?tenant=tester',search:'?tenant=tester'},history:{},
      URL,URLSearchParams,AbortController,crypto:{randomUUID:()=>nodeCrypto.randomUUID()},
      fetch:async()=>{throw new TypeError('offline')},alert(){},confirm(){return false},prompt(){return null},
      btoa:v=>Buffer.from(String(v),'binary').toString('base64'),atob:v=>Buffer.from(String(v),'base64').toString('binary'),
      FileReader:function(){},Blob,TextEncoder,TextDecoder,setTimeout:timer,clearTimeout,setInterval:()=>0,clearInterval(){},window:null
    };
    context.window={addEventListener(){},scrollTo(){},SpeechRecognition:null,webkitSpeechRecognition:null};
    context.window.window=context.window;context.window.document=context.document;context.window.navigator=context.navigator;
    vm.createContext(context);vm.runInContext(script,context,{filename:'simple-pilot-inline.js'});
    await context.saveVoiceNote('morgen in Alfeld 2 tonnen Schrott');
    return elements.get('#nextJob').innerHTML;
  }
  const android=await render('Mozilla/5.0 (Linux; Android 14)');
  const iphone=await render('Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X)');
  const normalize=x=>x.replace(/data-complete-local="[^"]+"/g,'data-complete-local="<id>"').replace(/data-delete-local="[^"]+"/g,'data-delete-local="<id>"');
  assert.equal(normalize(android),normalize(iphone));
  assert.match(android,/AUFTRAG LÖSCHEN/);
  assert.match(iphone,/AUFTRAG LÖSCHEN/);
});


test('runtime: Android voice row still shows Maps button when server location parsing failed',async()=>{
  const elements=new Map();
  const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
  const localStorage=makeStorage({
    werkzPilotTenantScope:'slug:christian',
    werkzPilotTenantLabel:'Christian',
    werkzPilotTenantSlug:'christian',
    werkzPilotPage:'home'
  });
  const context={
    console,localStorage,sessionStorage:makeStorage(),indexedDB:makeIndexedDb(),
    document:{hidden:false,querySelector:getEl,querySelectorAll:()=>[],addEventListener(){},getElementById:id=>getEl('#'+id)},
    navigator:{userAgent:'Mozilla/5.0 (Linux; Android 14)'},location:{href:'https://example.invalid/pilot/?tenant=christian',search:'?tenant=christian'},history:{},
    URL,URLSearchParams,AbortController,crypto:{randomUUID:()=>nodeCrypto.randomUUID()},
    fetch:async url=>{
      if(String(url).includes('/pilot/api/route-plan'))return {ok:true,status:200,json:async()=>({stops:[{
        id:'call-android-unparsed',entityType:'call',name:'Sprachauftrag',location:'',material:'',materialKey:'',quantity:'',
        estimatedWeightKg:null,distanceKm:0,scheduledFor:null,source:'voice-note',
        originalText:'Christian Schimmeck 17 31061 Alfeld Schrott abholen',orders:[]
      }]})};
      throw new TypeError('offline');
    },
    alert(){},confirm(){return false},prompt(){return null},
    btoa:v=>Buffer.from(String(v),'binary').toString('base64'),atob:v=>Buffer.from(String(v),'base64').toString('binary'),
    FileReader:function(){},Blob,TextEncoder,TextDecoder,setTimeout:timer,clearTimeout,setInterval:()=>0,clearInterval(){},window:null
  };
  context.window={addEventListener(){},scrollTo(){},SpeechRecognition:null,webkitSpeechRecognition:null};
  context.window.window=context.window;context.window.document=context.document;context.window.navigator=context.navigator;
  vm.createContext(context);vm.runInContext(script,context,{filename:'simple-pilot-inline.js'});
  await new Promise(resolve=>setTimeout(resolve,10));
  await context.routePlan();

  const next=elements.get('#nextJob').innerHTML;
  assert.match(next,/GOOGLE MAPS STARTEN/);
  assert.match(next,/data-maps-destination="Christian Schimmeck 17 31061 Alfeld Schrott abholen"/);
});

test('runtime: raw-text Maps fallback still performs real navigation',()=>{
  const elements=new Map();
  const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
  const context={
    console,localStorage:makeStorage(),sessionStorage:makeStorage(),indexedDB:makeIndexedDb(),
    document:{hidden:false,querySelector:getEl,querySelectorAll:()=>[],addEventListener(){},getElementById:id=>getEl('#'+id)},
    navigator:{},location:{href:'https://example.invalid/pilot/',search:''},history:{},
    URL,URLSearchParams,AbortController,crypto:{randomUUID:()=>nodeCrypto.randomUUID()},
    fetch:async()=>{throw new TypeError('offline')},alert(){},confirm(){return false},prompt(){return null},
    btoa:v=>Buffer.from(String(v),'binary').toString('base64'),atob:v=>Buffer.from(String(v),'base64').toString('binary'),
    FileReader:function(){},Blob,TextEncoder,TextDecoder,setTimeout:timer,clearTimeout,setInterval:()=>0,clearInterval(){},window:null
  };
  context.window={addEventListener(){},scrollTo(){},SpeechRecognition:null,webkitSpeechRecognition:null};
  context.window.window=context.window;context.window.document=context.document;context.window.navigator=context.navigator;
  vm.createContext(context);vm.runInContext(script,context,{filename:'simple-pilot-inline.js'});
  const d=context.mapsDestination('', 'Christian Schimmeck 17 31061 Alfeld Schrott abholen');
  assert.equal(d,'Christian Schimmeck 17 31061 Alfeld Schrott abholen');
  const opened=context.openMapsDestination(d);
  assert.equal(context.location.href,opened);
  assert.match(opened,/google\.com\/maps\/dir/);
});


test('runtime: local-only order can be completed without waiting for Render sync',async()=>{
  const elements=new Map();
  const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
  const localStorage=makeStorage({
    werkzPilotTenantScope:'slug:tester',
    werkzPilotTenantLabel:'Tester',
    werkzPilotTenantSlug:'tester',
    werkzPilotPage:'home'
  });
  const context={
    console,localStorage,sessionStorage:makeStorage(),indexedDB:makeIndexedDb(),
    document:{hidden:false,querySelector:getEl,querySelectorAll:()=>[],addEventListener(){},getElementById:id=>getEl('#'+id)},
    navigator:{},location:{href:'https://example.invalid/pilot/?tenant=tester',search:'?tenant=tester'},history:{},
    URL,URLSearchParams,AbortController,crypto:{randomUUID:()=>nodeCrypto.randomUUID()},
    fetch:async()=>{throw new TypeError('Load failed')},
    alert(){},confirm(){return false},prompt(){return '2000'},
    btoa:v=>Buffer.from(String(v),'binary').toString('base64'),atob:v=>Buffer.from(String(v),'base64').toString('binary'),
    FileReader:function(){},Blob,TextEncoder,TextDecoder,setTimeout:timer,clearTimeout,setInterval:()=>0,clearInterval(){},window:null
  };
  context.window={addEventListener(){},scrollTo(){},SpeechRecognition:null,webkitSpeechRecognition:null};
  context.window.window=context.window;context.window.document=context.document;context.window.navigator=context.navigator;
  vm.createContext(context);vm.runInContext(script,context,{filename:'simple-pilot-inline.js'});
  await context.saveVoiceNote('morgen in Alfeld 2 tonnen Schrott');
  const key='werkzPilotLocalOrders::slug:tester';
  let rows=JSON.parse(localStorage.getItem(key)||'[]');
  assert.equal(rows.length,1);
  assert.equal(rows[0].status,'open');
  assert.match(elements.get('#nextJob').innerHTML,/AUFTRAG ERLEDIGT/);

  await context.completeJob('',rows[0].material,rows[0].materialKey,rows[0].estimatedWeightKg,rows[0].id);
  rows=JSON.parse(localStorage.getItem(key)||'[]');
  assert.equal(rows[0].status,'completed');
});

test('runtime: server next job also renders Auftrag erledigt on Start',async()=>{
  const elements=new Map();
  const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
  const localStorage=makeStorage({
    werkzPilotTenantScope:'slug:tester',
    werkzPilotTenantLabel:'Tester',
    werkzPilotTenantSlug:'tester',
    werkzPilotPage:'home'
  });
  const context={
    console,localStorage,sessionStorage:makeStorage(),indexedDB:makeIndexedDb(),
    document:{hidden:false,querySelector:getEl,querySelectorAll:()=>[],addEventListener(){},getElementById:id=>getEl('#'+id)},
    navigator:{},location:{href:'https://example.invalid/pilot/?tenant=tester',search:'?tenant=tester'},history:{},
    URL,URLSearchParams,AbortController,crypto:{randomUUID:()=>nodeCrypto.randomUUID()},
    fetch:async url=>{
      if(String(url).includes('/pilot/api/route-plan'))return {ok:true,status:200,json:async()=>({stops:[{
        id:'call-1',entityType:'call',name:'Kunde A',location:'Alfeld',material:'Mischschrott',materialKey:'mixed-scrap',
        quantity:'1000 kg',estimatedWeightKg:1000,distanceKm:5,scheduledFor:'2026-10-05',source:'call',originalText:'',orders:[]
      }]})};
      throw new TypeError('offline');
    },
    alert(){},confirm(){return false},prompt(){return null},
    btoa:v=>Buffer.from(String(v),'binary').toString('base64'),atob:v=>Buffer.from(String(v),'base64').toString('binary'),
    FileReader:function(){},Blob,TextEncoder,TextDecoder,setTimeout:timer,clearTimeout,setInterval:()=>0,clearInterval(){},window:null
  };
  context.window={addEventListener(){},scrollTo(){},SpeechRecognition:null,webkitSpeechRecognition:null};
  context.window.window=context.window;context.window.document=context.document;context.window.navigator=context.navigator;
  vm.createContext(context);vm.runInContext(script,context,{filename:'simple-pilot-inline.js'});
  await new Promise(resolve=>setTimeout(resolve,10));
  await context.routePlan();
  assert.match(elements.get('#nextJob').innerHTML,/AUFTRAG ERLEDIGT/);
  assert.match(elements.get('#nextJob').innerHTML,/data-complete-call="call-1"/);
  assert.match(elements.get('#routePlan').innerHTML,/AUFTRAG ERLEDIGT/);
});

test('runtime: connected route opens one Google Maps route with multiple stops',()=>{
  const elements=new Map();
  const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
  const context={
    console,localStorage:makeStorage({werkzPilotTenantSlug:'tester'}),sessionStorage:makeStorage(),indexedDB:makeIndexedDb(),
    document:{hidden:false,querySelector:getEl,querySelectorAll:()=>[],addEventListener(){},getElementById:id=>getEl('#'+id)},
    navigator:{},location:{href:'https://example.invalid/pilot/?tenant=tester',search:'?tenant=tester'},history:{},
    URL,URLSearchParams,AbortController,crypto:{randomUUID:()=>nodeCrypto.randomUUID()},
    fetch:async()=>{throw new TypeError('offline')},alert(){},confirm(){return false},prompt(){return null},
    btoa:v=>Buffer.from(String(v),'binary').toString('base64'),atob:v=>Buffer.from(String(v),'base64').toString('binary'),
    FileReader:function(){},Blob,TextEncoder,TextDecoder,setTimeout:timer,clearTimeout,setInterval:()=>0,clearInterval(){},window:null
  };
  context.window={addEventListener(){},scrollTo(){},SpeechRecognition:null,webkitSpeechRecognition:null};
  context.window.window=context.window;context.window.document=context.document;context.window.navigator=context.navigator;
  vm.createContext(context);vm.runInContext(script,context,{filename:'simple-pilot-inline.js'});

  const url=context.combinedMapsUrl(['Alfeld','Hildesheim','Hameln']);
  assert.match(url,/destination=Hameln/);
  assert.match(url,/waypoints=Alfeld%7CHildesheim/);
  context.routeDestinations=['Alfeld','Hildesheim','Hameln'];
  const opened=context.openCombinedRoute();
  assert.equal(context.location.href,opened);
  assert.equal(opened,url);
});


test('runtime: deleting a local-only order hides it immediately and prevents later resync',async()=>{
  const elements=new Map();
  const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
  const localStorage=makeStorage({
    werkzPilotTenantScope:'slug:tester',
    werkzPilotTenantLabel:'Tester',
    werkzPilotTenantSlug:'tester',
    werkzPilotPage:'home'
  });
  let noteAttempts=0;
  const context={
    console,localStorage,sessionStorage:makeStorage(),indexedDB:makeIndexedDb(),
    document:{hidden:false,querySelector:getEl,querySelectorAll:()=>[],addEventListener(){},getElementById:id=>getEl('#'+id)},
    navigator:{},location:{href:'https://example.invalid/pilot/?tenant=tester',search:'?tenant=tester'},history:{},
    URL,URLSearchParams,AbortController,crypto:{randomUUID:()=>nodeCrypto.randomUUID()},
    fetch:async url=>{if(String(url).includes('/pilot/api/notes'))noteAttempts++;throw new TypeError('offline')},
    alert(){},confirm(){return true},prompt(){return null},
    btoa:v=>Buffer.from(String(v),'binary').toString('base64'),atob:v=>Buffer.from(String(v),'base64').toString('binary'),
    FileReader:function(){},Blob,TextEncoder,TextDecoder,setTimeout:timer,clearTimeout,setInterval:()=>0,clearInterval(){},window:null
  };
  context.window={addEventListener(){},scrollTo(){},SpeechRecognition:null,webkitSpeechRecognition:null};
  context.window.window=context.window;context.window.document=context.document;context.window.navigator=context.navigator;
  vm.createContext(context);vm.runInContext(script,context,{filename:'simple-pilot-inline.js'});

  await context.saveVoiceNote('morgen in Alfeld 2 tonnen Schrott');
  let rows=JSON.parse(localStorage.getItem('werkzPilotLocalOrders::slug:tester')||'[]');
  assert.equal(rows.length,1);
  assert.match(elements.get('#nextJob').innerHTML,/AUFTRAG LÖSCHEN/);
  const id=rows[0].id;

  await context.deleteOrder('',id);
  rows=JSON.parse(localStorage.getItem('werkzPilotLocalOrders::slug:tester')||'[]');
  assert.equal(rows[0].status,'deleted');
  assert.match(elements.get('#nextJob').innerHTML,/Keine offenen Aufträge/);

  noteAttempts=0;
  const sent=await context.syncLocalVoiceOrders();
  assert.equal(sent,0);
  assert.equal(noteAttempts,0);
});

test('runtime: deleting a server order posts delete endpoint and removes it from Start and overview',async()=>{
  const elements=new Map();
  const getEl=sel=>{if(!elements.has(sel))elements.set(sel,makeElement());return elements.get(sel)};
  const localStorage=makeStorage({
    werkzPilotTenantScope:'slug:tester',
    werkzPilotTenantLabel:'Tester',
    werkzPilotTenantSlug:'tester',
    werkzPilotPage:'home'
  });
  let deleted=false,deletePosts=0;
  const context={
    console,localStorage,sessionStorage:makeStorage(),indexedDB:makeIndexedDb(),
    document:{hidden:false,querySelector:getEl,querySelectorAll:()=>[],addEventListener(){},getElementById:id=>getEl('#'+id)},
    navigator:{},location:{href:'https://example.invalid/pilot/?tenant=tester',search:'?tenant=tester'},history:{},
    URL,URLSearchParams,AbortController,crypto:{randomUUID:()=>nodeCrypto.randomUUID()},
    fetch:async (url,opts)=>{
      const u=String(url);
      if(u.includes('/pilot/api/calls/call-delete/delete')){deletePosts++;deleted=true;return {ok:true,status:200,json:async()=>({deleted:true,id:'call-delete'})}}
      if(u.includes('/pilot/api/route-plan'))return {ok:true,status:200,json:async()=>({stops:deleted?[]:[{
        id:'call-delete',entityType:'call',name:'Kunde',location:'Alfeld',material:'Mischschrott',materialKey:'mixed-scrap',
        quantity:'1000 kg',estimatedWeightKg:1000,distanceKm:5,scheduledFor:'2026-10-05',source:'call',originalText:'',orders:[]
      }]})};
      if(u.includes('/healthz'))return {ok:true,status:200,json:async()=>({ok:true})};
      if(u.includes('/pilot/api/summary'))return {ok:true,status:200,json:async()=>({open:0,callbacks:0,missingDocuments:0})};
      if(u.includes('/pilot/api/calls'))return {ok:true,status:200,json:async()=>[]};
      if(u.includes('/pilot/api/documents'))return {ok:true,status:200,json:async()=>[]};
      if(u.includes('/pilot/api/daily-summary'))return {ok:true,status:200,json:async()=>({date:'2026-10-04',completedJobs:0,documents:0,missingDocuments:0,dealerRevenueEur:0,incomeNotesEur:0,expensesEur:0,privateEur:0,knownResultEur:0})};
      throw new TypeError('offline');
    },
    alert(){},confirm(){return true},prompt(){return null},
    btoa:v=>Buffer.from(String(v),'binary').toString('base64'),atob:v=>Buffer.from(String(v),'base64').toString('binary'),
    FileReader:function(){},Blob,TextEncoder,TextDecoder,setTimeout:timer,clearTimeout,setInterval:()=>0,clearInterval(){},window:null
  };
  context.window={addEventListener(){},scrollTo(){},SpeechRecognition:null,webkitSpeechRecognition:null};
  context.window.window=context.window;context.window.document=context.document;context.window.navigator=context.navigator;
  vm.createContext(context);vm.runInContext(script,context,{filename:'simple-pilot-inline.js'});

  await new Promise(resolve=>setTimeout(resolve,10));
  await context.routePlan();
  assert.match(elements.get('#nextJob').innerHTML,/AUFTRAG LÖSCHEN/);

  await context.deleteOrder('call-delete','');
  assert.equal(deletePosts,1);
  assert.match(elements.get('#nextJob').innerHTML,/Keine offenen Aufträge/);
  assert.equal(elements.get('#routePlan').innerHTML,'Keine offenen Aufträge.');
});
