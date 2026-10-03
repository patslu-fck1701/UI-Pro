'use strict';

const byId=id=>document.getElementById(id);
const api='/api';
const fallbackSpecs=[
  {id:'event-chain',name:'Eventkette KOTH → CourierZ → RAVEN → AIConvoyZ',criteria:[
    {id:'start',label:'Events starten sauber'},{id:'finish',label:'Events schließen sauber ab'},
    {id:'handoff',label:'Übergabe zum nächsten Event funktioniert'},{id:'slot',label:'Eventslot wird wieder freigegeben'},
    {id:'repeat',label:'Wiederholung bleibt möglich'}]},
  {id:'koth',name:'KOTH',criteria:[{id:'start',label:'KOTH startet sauber'},{id:'finish',label:'KOTH schließt sauber ab'},{id:'handoff',label:'CourierZ kann danach übernehmen'},{id:'slot',label:'Eventslot ist danach frei'}]},
  {id:'courierz',name:'CourierZ',criteria:[{id:'start',label:'Kofferphase startet'},{id:'route',label:'Koffer, Schlüssel und Zwischenstopps laufen weiter'},{id:'finish',label:'Finale Übergabe funktioniert'},{id:'slot',label:'Cleanup und Eventslot funktionieren'}]},
  {id:'raven',name:'RAVEN',criteria:[{id:'start',label:'Intercept und Zielzone starten'},{id:'drop',label:'Flug und Drop starten'},{id:'secure',label:'Landung, Öffnung und Sicherung funktionieren'},{id:'slot',label:'Cleanup und Eventslot funktionieren'}]},
  {id:'aiconvoyz',name:'AIConvoyZ',baseline:'AI Convoy Event-Roadmap · 03.10.2026',criteria:[
    {id:'route',group:'Route',label:'Eine der zwei festen Routen läuft vollständig',expected:'Balota → Rifi oder Northwest Airfield → Pavlovo-Gaszone'},
    {id:'formation',group:'Konvoi',label:'Humvee – Truck – Humvee fahren als zusammengehöriger Konvoi',expected:'3 Fahrzeuge; 5 Start-AI: 1 / 2 / 2 Insassen'},
    {id:'activation',group:'Aktivierung',label:'Vollaktivierung erfolgt erst bei etwa 1000 m Spielerannäherung',expected:'unauffällige Aktivierung um ca. 1000 m'},
    {id:'loot',group:'Loot',label:'Fahrzeugloot liegt qualitativ auf KOTH-Eventniveau',expected:'hochwertiger Event-Loot statt Weltloot'},
    {id:'attack',group:'Angriff',label:'Spielerangriff stoppt den Konvoi und löst echte Verteidigung aus',expected:'AI steigt aus, sucht Deckung und bekämpft Angreifer'},
    {id:'reinforcement',group:'Verstärkung',label:'Nach Angriff folgen Meldung, Helisound, Crashsound und Wrack',expected:'inszenierter Absturz statt echtem Verstärkungsheli'},
    {id:'blackbox',group:'Blackbox',label:'Blackbox-Hack dauert 90–120 s und liefert den Toxic Dokumenten Decoder',expected:'halten zum Hacken; definierter Abbruch bei Unterbrechung'},
    {id:'factions',group:'Fraktionen',label:'Russianz und Americanz verhalten sich als Event-Fraktionen korrekt',expected:'zusätzlicher gegnerischer Trupp mit 2–3 AI'},
    {id:'ignored',group:'Kein Angriff',label:'Ignorierter Konvoi löst vor Routenziel ein Russianz-vs-Americanz-Gefecht aus',expected:'Event verschwindet nicht einfach'},
    {id:'sound_aggro',group:'Sound & Aggro',label:'Gefechtssound skaliert mit Entfernung; eintreffende Spieler übernehmen Aggro',expected:'weit hörbar, näher lauter; beide Fraktionen fokussieren Spieler'},
    {id:'toxic_chain',group:'Eventkette',label:'Secret-Dokument und Decoder lassen sich zum ToxicZ-Signalgerät kombinieren',expected:'ToxicZ_Secret_Document + Toxicz_Doc_Decoder → ToxicZ_Signal_Marker'},
    {id:'toxic_activation',group:'Eventkette',label:'Aktivierung des ToxicZ-Signalmarkers startet das Toxic Event',expected:'Erst Signalmarker aktivieren → ToxicZ startet'},
    {id:'cleanup',group:'Abschluss',label:'Cleanup räumt sauber auf und gibt Scheduler-Slot frei',expected:'keine Reste/Doppelspawns; nächstes Major-Event kann starten'}
  ]},
  {id:'eventschedulerz',name:'EventSchedulerZ',criteria:[{id:'sequence',label:'KOTH → COURIER → RAVEN → CONVOY läuft geordnet'},{id:'phase',label:'Start, Active, Complete und Cleanup wechseln sauber'},{id:'slot',label:'Slot wird freigegeben und nächstes Event geplant'}]},
  {id:'toxicz',name:'ToxicZ',baseline:'DeutschZ Mod-Source + Eventkette · 03.10.2026',criteria:[
    {id:'ingredients',group:'Freischaltung',label:'Secret-Dokument und Decoder sind vorhanden',expected:'KOTH liefert das Secret-Dokument, AIConvoyZ den Decoder'},
    {id:'combine',group:'Freischaltung',label:'Beide Gegenstände ergeben den ToxicZ-Signalmarker',expected:'beide Zutaten werden verbraucht und der Signalmarker entsteht'},
    {id:'activate',group:'Start',label:'Erst die Aktivierung des Signalmarkers startet ToxicZ',expected:'Signalmarker aktivieren → Toxic Event startet'}
  ]}
];
const state={
  items:[],briefing:null,eventSpecs:fallbackSpecs,eventTests:[],captureType:null,activeEvent:null,pendingEventText:null,
  recognition:null,listening:false,voiceWanted:false,voiceMode:null,voiceText:[],voiceStopping:false,syncing:false
};
const uuid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();

function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function fmtMoney(value,currency){if(!Number.isFinite(value))return '–';return new Intl.NumberFormat('de-DE',{style:'currency',currency:currency||'EUR',maximumFractionDigits:0}).format(value);}
function sourceLabel(source){return ({voice:'Sprache',manual:'Notiz',document:'Beleg',gmail:'E-Mail',calendar:'Termin',revolut:'Bitcoin',market:'Markt','deutschz-test':'Event-Test'})[source]||source||'WerkZ';}
function attentionLabel(item){
  if(item.dueAt)return new Date(item.dueAt).toLocaleString('de-DE',{weekday:'short',hour:'2-digit',minute:'2-digit'});
  if(item.requiresDecision)return 'Entscheidung';
  if(item.severity==='high'||item.severity==='critical')return 'Wichtig';
  return 'Neu';
}
async function request(path,options={}){
  const headers={accept:'application/json'};
  if(!(options.body instanceof FormData))headers['content-type']='application/json';
  Object.assign(headers,options.headers||{});
  const response=await fetch(api+path,{credentials:'include',...options,headers});
  const payload=await response.json().catch(()=>({ok:false,error:{message:'Serverantwort nicht lesbar'}}));
  if(!response.ok||payload.ok===false){
    const error=new Error(payload.error?.message||'Anfrage fehlgeschlagen');
    error.code=payload.error?.code||'HTTP_ERROR';
    throw error;
  }
  return payload.data;
}

const dbPromise=new Promise((resolve,reject)=>{
  const open=indexedDB.open('werkz-assistant-pwa',1);
  open.onupgradeneeded=()=>{
    const db=open.result;
    if(!db.objectStoreNames.contains('queue'))db.createObjectStore('queue',{keyPath:'id'});
    if(!db.objectStoreNames.contains('state'))db.createObjectStore('state',{keyPath:'key'});
  };
  open.onsuccess=()=>resolve(open.result);
  open.onerror=()=>reject(open.error);
});
async function dbStore(name,mode,operation){
  const db=await dbPromise;
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(name,mode),store=tx.objectStore(name),req=operation(store);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
    tx.onabort=()=>reject(tx.error);
  });
}
const queueAll=()=>dbStore('queue','readonly',store=>store.getAll());
const queuePut=value=>dbStore('queue','readwrite',store=>store.put(value));
const queueDelete=id=>dbStore('queue','readwrite',store=>store.delete(id));
const localGet=async key=>(await dbStore('state','readonly',store=>store.get(key)))?.value;
const localSet=(key,value)=>dbStore('state','readwrite',store=>store.put({key,value}));
async function nextSequence(){const value=Number(await localGet('sequence')||0)+1;await localSet('sequence',value);return value;}
async function sha256(blob){
  const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
  return 'sha256:'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function updateSyncStatus(){
  const entries=await queueAll();
  const pending=entries.filter(entry=>entry.status!=='synced');
  const failed=pending.filter(entry=>entry.status==='failed');
  const pill=byId('sync-status');
  if(!navigator.onLine){pill.dataset.state='offline';pill.textContent='Offline'+(pending.length?' · '+pending.length:'');return;}
  if(state.syncing){pill.dataset.state='pending';pill.textContent='Sync'+(pending.length?' · '+pending.length:'');return;}
  if(failed.length){pill.dataset.state='error';pill.textContent=failed.length+' Sync-Fehler';return;}
  if(pending.length){pill.dataset.state='pending';pill.textContent=pending.length+' vorgemerkt';return;}
  pill.dataset.state='';pill.textContent='Synchronisiert';
}
async function enqueue(type,payload){
  const entry={id:'q_'+uuid(),idempotencyKey:'idem_'+uuid(),type,payload,sequence:await nextSequence(),createdAtLocal:now(),status:'queued',attempts:0,lastError:null};
  await queuePut(entry);await updateSyncStatus();
  if(navigator.onLine)syncQueue();
  return entry;
}
async function sendQueued(entry){
  if(entry.type==='capture'){
    return request('/assistant/capture',{method:'POST',body:JSON.stringify({...entry.payload,idempotencyKey:entry.idempotencyKey})});
  }
  if(entry.type==='document'){
    const form=new FormData(),p=entry.payload;
    form.append('file',p.blob,p.fileName||'upload');
    form.append('category',p.category||'document');form.append('note',p.note||'');
    form.append('idempotencyKey',entry.idempotencyKey);form.append('hash',p.hash);
    return request('/assistant/documents',{method:'POST',body:form});
  }
  if(entry.type==='status'){
    return request('/assistant/items/'+encodeURIComponent(entry.payload.id)+'/status',{method:'POST',body:JSON.stringify({status:entry.payload.status})});
  }
  if(entry.type==='event.start'){
    return request('/assistant/event-tests',{method:'POST',body:JSON.stringify({...entry.payload,idempotencyKey:entry.idempotencyKey})});
  }
  if(entry.type==='event.observe'){
    return request('/assistant/event-tests/'+encodeURIComponent(entry.payload.eventTestId)+'/observations',{method:'POST',body:JSON.stringify({text:entry.payload.text,source:entry.payload.source,capturedAt:entry.payload.capturedAt,idempotencyKey:entry.idempotencyKey})});
  }
  if(entry.type==='event.finish'){
    return request('/assistant/event-tests/'+encodeURIComponent(entry.payload.eventTestId)+'/finish',{method:'POST',body:JSON.stringify({endedAt:entry.payload.endedAt,idempotencyKey:entry.idempotencyKey})});
  }
  throw new Error('Unbekannte Offline-Aktion');
}
async function syncQueue(){
  if(state.syncing||!navigator.onLine)return;
  state.syncing=true;await updateSyncStatus();
  try{
    const entries=(await queueAll()).filter(entry=>entry.status!=='synced').sort((a,b)=>a.sequence-b.sequence);
    for(const entry of entries){
      entry.status='syncing';entry.attempts++;await queuePut(entry);
      try{
        await sendQueued(entry);
        await queueDelete(entry.id);
      }catch(error){
        entry.status='failed';entry.lastError={message:error.message,code:error.code||'ERROR'};await queuePut(entry);
        if(error instanceof TypeError||!navigator.onLine)break;
        if(['UNAUTHENTICATED','FORBIDDEN','ENTITLEMENT_DENIED'].includes(error.code))break;
      }
    }
  }finally{
    state.syncing=false;await updateSyncStatus();
  }
  if(navigator.onLine)await loadRemote();
}

function card(item){
  const high=item.severity==='high'||item.severity==='critical'?' high':'';
  const report=item.kind==='test-report'?'<button data-report="'+esc(item.payload?.eventTestId||item.sourceRef||'')+'">Bericht</button>':'';
  return '<article class="attention-card'+high+'">'+
    '<div class="meta"><span>'+esc(sourceLabel(item.source))+' · '+esc(item.eventLabel||item.kind)+'</span><span>'+esc(attentionLabel(item))+'</span></div>'+
    '<h3>'+esc(item.title)+'</h3><p>'+esc(item.summary||'')+'</p>'+
    '<div class="actions">'+report+'<button class="done" data-done="'+esc(item.id)+'">Erledigt</button><button data-later="'+esc(item.id)+'">Später</button></div>'+
  '</article>';
}
function bindActions(root){
  (root||document).querySelectorAll('[data-done]').forEach(button=>button.onclick=()=>setStatus(button.dataset.done,'done'));
  (root||document).querySelectorAll('[data-later]').forEach(button=>button.onclick=()=>setStatus(button.dataset.later,'snoozed'));
  (root||document).querySelectorAll('[data-report]').forEach(button=>button.onclick=()=>openEventReport(button.dataset.report));
}
async function setStatus(id,statusValue){
  const item=state.items.find(entry=>entry.id===id);if(item)item.status=statusValue;
  render();
  await enqueue('status',{id,status:statusValue});
  await localSet('cache-items',state.items);
}
function render(){
  const briefing=state.briefing||{items:[],counts:{},market:{}};
  byId('open-count').textContent=briefing.counts.open||0;
  byId('decision-count').textContent=briefing.counts.needsDecision||0;
  byId('doc-count').textContent=briefing.counts.pendingDocuments||0;
  const visible=(briefing.items||[]).filter(item=>item.status!=='done'&&item.status!=='dismissed');
  byId('attention').innerHTML=visible.length?visible.map(card).join(''):'<div class="empty glass">Gerade nichts Dringendes. Neue Dinge kannst du oben sofort reinsprechen.</div>';
  bindActions(byId('attention'));
  const market=briefing.market||{};
  byId('btc-price').textContent=market.count?fmtMoney(market.lastPrice,market.currency):'–';
  byId('btc-change').textContent=market.count>1?
    (market.changePct>=0?'+':'')+market.changePct.toFixed(1)+' % seit erstem Snapshot · größter Rückgang '+Math.abs(market.maxDrawdownPct).toFixed(1)+' %':
    'Langzeitspur sammelt Daten';
  const mailOpen=state.items.filter(item=>item.status==='open'&&item.source==='gmail').length;
  byId('mail-state').textContent=mailOpen?String(mailOpen)+' wichtig':'ruhig';
  renderHints();renderActiveEvent();
}
function renderHints(){
  document.querySelectorAll('[data-capture-type]').forEach(button=>button.classList.toggle('selected',button.dataset.captureType===state.captureType));
}
function renderActiveEvent(){
  const box=byId('event-test-active');
  if(!state.activeEvent){box.hidden=true;return;}
  box.hidden=false;byId('event-test-name').textContent=state.activeEvent.eventName;
  byId('event-test-note').textContent=navigator.onLine?'Sprache und Text landen direkt in diesem Test.':'Offline · Beobachtungen werden lokal vorgemerkt.';
}
async function loadRemote(){
  if(!navigator.onLine)return loadCached();
  try{
    const values=await Promise.all([
      request('/assistant/briefing'),request('/assistant/items'),request('/assistant/event-tests/specs'),request('/assistant/event-tests')
    ]);
    state.briefing=values[0];state.items=values[1];state.eventSpecs=values[2]?.length?values[2]:fallbackSpecs;state.eventTests=values[3]||[];
    await Promise.all([
      localSet('cache-briefing',state.briefing),localSet('cache-items',state.items),localSet('cache-event-specs',state.eventSpecs),localSet('cache-event-tests',state.eventTests)
    ]);
    if(!state.activeEvent){
      const running=state.eventTests.find(test=>test.status==='running');
      if(running){state.activeEvent={id:running.id,eventId:running.eventId,eventName:running.eventName,criteria:running.spec?.criteria||[]};await localSet('active-event',state.activeEvent);}
    }
    render();
  }catch(error){
    byId('summary').textContent='Core gerade nicht erreichbar · Eingaben bleiben lokal gespeichert.';
    await loadCached();await updateSyncStatus();
  }
}
async function loadCached(){
  state.briefing=await localGet('cache-briefing')||state.briefing||{items:[],counts:{open:0,needsDecision:0,pendingDocuments:0},market:{}};
  state.items=await localGet('cache-items')||state.items||[];
  state.eventSpecs=await localGet('cache-event-specs')||fallbackSpecs;
  state.eventTests=await localGet('cache-event-tests')||state.eventTests||[];
  state.activeEvent=await localGet('active-event')||state.activeEvent;
  render();
}
async function load(){
  state.activeEvent=await localGet('active-event')||null;
  await loadRemote();await updateSyncStatus();
}

function selectCapture(type){
  if(type==='event-test'){
    state.captureType='event-test';renderHints();openEventPicker();return;
  }
  state.captureType=state.captureType===type?null:type;renderHints();
}
document.querySelectorAll('[data-capture-type]').forEach(button=>button.addEventListener('click',()=>selectCapture(button.dataset.captureType)));

function fillEventPicker(){
  const select=byId('event-select'),current=select.value;
  select.innerHTML=state.eventSpecs.map(spec=>'<option value="'+esc(spec.id)+'">'+esc(spec.name)+'</option>').join('');
  if(current&&state.eventSpecs.some(spec=>spec.id===current))select.value=current;
  renderEventCriteria();
}
function renderEventCriteria(){
  const spec=state.eventSpecs.find(item=>item.id===byId('event-select').value)||state.eventSpecs[0];
  byId('event-criteria').innerHTML=spec?.criteria?.map(item=>'<div class="criterion"><strong>'+esc((item.group?item.group+' · ':'')+item.label)+'</strong><small>'+esc(item.expected||'Wird beim Abschluss gegen deine Beobachtungen geprüft.')+'</small></div>').join('')||'';
}
function openEventPicker(){fillEventPicker();byId('event-dialog').showModal();}
byId('event-select').addEventListener('change',renderEventCriteria);
byId('event-form').addEventListener('submit',async event=>{
  if(event.submitter?.value==='cancel'){state.pendingEventText=null;state.captureType=null;renderHints();return;}
  event.preventDefault();
  const spec=state.eventSpecs.find(item=>item.id===byId('event-select').value)||state.eventSpecs[0];
  if(!spec)return;
  const active={id:'eventtest_'+uuid(),eventId:spec.id,eventName:spec.name,criteria:spec.criteria||[],startedAt:now()};
  state.activeEvent=active;state.captureType='event-test';await localSet('active-event',active);
  await enqueue('event.start',{id:active.id,eventId:active.eventId,startedAt:active.startedAt});
  byId('event-dialog').close();render();
  if(state.pendingEventText){
    const pending=state.pendingEventText;state.pendingEventText=null;
    await enqueue('event.observe',{eventTestId:active.id,text:pending.text,source:pending.source,capturedAt:now()});
    byId('voice-state').textContent='Test gestartet · erste Beobachtung gespeichert.';
  }else byId('voice-state').textContent='Event-Test läuft · einfach weiter reinsprechen.';
});
byId('event-test-finish').addEventListener('click',async()=>{
  if(!state.activeEvent)return;
  const finishedId=state.activeEvent.id;
  await enqueue('event.finish',{eventTestId:finishedId,endedAt:now()});
  state.activeEvent=null;state.captureType=null;await localSet('active-event',null);render();
  byId('voice-state').textContent=navigator.onLine?'Test beendet · Bericht wird erstellt.':'Test beendet · Bericht folgt nach Synchronisierung.';
  if(navigator.onLine){await syncQueue();const test=state.eventTests.find(item=>item.id===finishedId);if(test?.report)openEventReport(finishedId);}
});
function openEventReport(id){
  const test=state.eventTests.find(item=>item.id===id);
  if(!test){byId('voice-state').textContent='Bericht ist nach der nächsten Synchronisierung verfügbar.';return;}
  byId('event-report-title').textContent=test.eventName||'Event-Test';
  const report=test.report;
  if(!report){
    byId('event-report-body').innerHTML='<div class="criterion">Test läuft oder Bericht wird noch synchronisiert.</div>';
  }else{
    const summary='<div class="criterion"><strong>'+report.counts.observed+' bestätigt · '+report.counts.issue+' auffällig · '+report.counts.notObserved+' noch offen</strong><small>Automatische Erstbewertung. Die Sollwerte werden später pro Event weiter verfeinert.</small></div>';
    byId('event-report-body').innerHTML=summary+report.results.map(result=>'<div class="criterion '+esc(result.status)+'"><strong>'+esc((result.group?result.group+' · ':'')+result.label)+'</strong><small>'+esc(result.status==='observed'?'Beobachtet':result.status==='issue'?'Auffällig':'Noch nicht belegt')+(result.evidence?' · '+esc(result.evidence):'')+(result.expected?' · Soll: '+esc(result.expected):'')+'</small></div>').join('');
  }
  byId('event-report-dialog').showModal();
}
byId('event-report-close').onclick=()=>byId('event-report-dialog').close();

async function saveText(value,source){
  const textValue=String(value||'').trim();if(!textValue)return;
  if(state.activeEvent){
    await enqueue('event.observe',{eventTestId:state.activeEvent.id,text:textValue,source:source||'manual',capturedAt:now()});
    byId('voice-state').textContent=navigator.onLine?'Beobachtung gespeichert.':'Offline gespeichert · wird später synchronisiert.';
    return;
  }
  if(state.captureType==='event-test'){
    state.pendingEventText={text:textValue,source:source||'manual'};openEventPicker();return;
  }
  await enqueue('capture',{text:textValue,source:source||'manual',captureType:state.captureType||null});
  byId('voice-state').textContent=navigator.onLine?'Gespeichert und einsortiert.':'Offline gespeichert · wird später synchronisiert.';
}

function setupVoice(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const button=byId('voice'),status=byId('voice-state');
  const HOLD_MS=360;
  let pressStartedAt=0,holdTimer=null,holdGesture=false,stopTap=false,restartTimer=null;
  function setVoiceUi(textValue){status.textContent=textValue;button.setAttribute('aria-pressed',state.voiceWanted?'true':'false');button.classList.toggle('listening',state.voiceWanted);}
  function clearRestart(){if(restartTimer){clearTimeout(restartTimer);restartTimer=null;}}
  async function flushVoice(){
    const transcript=state.voiceText.join(' ').replace(/\s+/g,' ').trim();state.voiceText=[];
    if(!transcript){setVoiceUi('Nichts erkannt. Tippen: an/aus · Halten: sprechen');return;}
    setVoiceUi('Wird gespeichert …');
    try{await saveText(transcript,'voice');if(!state.pendingEventText)setVoiceUi(state.activeEvent?'Beobachtung gespeichert.':'Gespeichert und einsortiert.');}
    catch(error){setVoiceUi(error.message);}
  }
  function startRecognition(mode){
    if(state.listening)return;
    state.voiceWanted=true;state.voiceMode=mode||state.voiceMode||'tap';state.voiceStopping=false;
    setVoiceUi(state.voiceMode==='hold'?'Gedrückt halten – ich höre zu …':'Aufnahme läuft · zum Stoppen erneut tippen');
    try{state.recognition.start();}catch(error){if(error.name!=='InvalidStateError'){state.voiceWanted=false;setVoiceUi('Sprachaufnahme konnte nicht starten.');}}
  }
  function stopRecognition(){
    clearRestart();state.voiceWanted=false;state.voiceStopping=true;setVoiceUi('Aufnahme wird beendet …');
    try{state.recognition.stop();}catch{state.listening=false;state.voiceStopping=false;flushVoice();}
  }
  if(!SpeechRecognition){
    status.textContent='Spracherkennung ist hier nicht verfügbar – Tippen funktioniert immer.';
    button.onclick=()=>byId('text-dialog').showModal();return;
  }
  const recognition=new SpeechRecognition();state.recognition=recognition;recognition.lang='de-DE';recognition.interimResults=false;recognition.continuous=true;
  recognition.onstart=()=>{state.listening=true;setVoiceUi(state.voiceMode==='hold'?'Gedrückt halten – ich höre zu …':'Aufnahme läuft · zum Stoppen erneut tippen');};
  recognition.onresult=event=>{
    for(let index=event.resultIndex;index<event.results.length;index++){const result=event.results[index];if(result.isFinal){const part=String(result[0]?.transcript||'').trim();if(part)state.voiceText.push(part);}}
    const preview=state.voiceText.join(' ').trim();if(preview)setVoiceUi((state.voiceMode==='hold'?'Halte weiter … ':'Läuft … ')+preview.slice(-90));
  };
  recognition.onerror=event=>{
    if(event.error==='aborted')return;
    if(event.error==='no-speech'&&state.voiceWanted)return;
    state.voiceWanted=false;state.voiceStopping=true;
    setVoiceUi(!navigator.onLine?'Spracherkennung braucht auf diesem Gerät gerade Netz. Text und Fotos bleiben offline nutzbar.':'Sprache nicht übernommen: '+event.error);
  };
  recognition.onend=()=>{
    state.listening=false;
    if(state.voiceWanted&&!state.voiceStopping){clearRestart();restartTimer=setTimeout(()=>startRecognition(state.voiceMode),160);return;}
    state.voiceStopping=false;state.voiceMode=null;flushVoice();
  };
  button.addEventListener('pointerdown',event=>{
    event.preventDefault();try{button.setPointerCapture(event.pointerId);}catch{}
    pressStartedAt=performance.now();holdGesture=false;clearTimeout(holdTimer);
    if(state.voiceWanted&&state.voiceMode==='tap'){stopTap=true;setVoiceUi('Loslassen zum Stoppen');return;}
    stopTap=false;state.voiceText=[];startRecognition('tap');
    holdTimer=setTimeout(()=>{holdGesture=true;state.voiceMode='hold';setVoiceUi('Gedrückt halten – loslassen stoppt');},HOLD_MS);
  });
  button.addEventListener('pointerup',event=>{
    event.preventDefault();clearTimeout(holdTimer);const duration=performance.now()-pressStartedAt;
    if(stopTap){stopTap=false;stopRecognition();return;}
    if(holdGesture||duration>=HOLD_MS){state.voiceMode='hold';stopRecognition();return;}
    state.voiceMode='tap';state.voiceWanted=true;setVoiceUi('Aufnahme läuft · zum Stoppen erneut tippen');
  });
  button.addEventListener('pointercancel',()=>{clearTimeout(holdTimer);if(state.voiceWanted)stopRecognition();});
  button.addEventListener('contextmenu',event=>event.preventDefault());
  setVoiceUi('Tippen: an/aus · Halten: sprechen');
}

byId('photo').addEventListener('change',async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  byId('voice-state').textContent='Beleg wird lokal gesichert …';
  try{
    const hash=await sha256(file);
    await enqueue('document',{blob:file,fileName:file.name,mime:file.type||'application/octet-stream',hash,category:state.captureType==='invoice'?'invoice':'document',note:state.activeEvent?'Event-Test '+state.activeEvent.eventName:''});
    byId('voice-state').textContent=navigator.onLine?'Beleg gespeichert · Prüfung offen.':'Offline gespeichert · Upload folgt automatisch.';
  }catch(error){byId('voice-state').textContent=error.message;}
});
byId('text-open').onclick=()=>{byId('text-dialog').showModal();setTimeout(()=>byId('text-input').focus(),50);};
byId('nav-capture').onclick=()=>byId('text-dialog').showModal();
byId('text-form').addEventListener('submit',async event=>{
  if(event.submitter?.value==='cancel')return;
  event.preventDefault();const value=byId('text-input').value.trim();if(!value)return;
  try{await saveText(value,'manual');byId('text-input').value='';if(!state.pendingEventText)byId('text-dialog').close();}catch(error){byId('voice-state').textContent=error.message;}
});
byId('all-open').onclick=()=>{
  const open=state.items.filter(item=>item.status==='open');
  byId('all-items').innerHTML=open.length?open.map(card).join(''):'<div class="empty">Nichts offen.</div>';
  bindActions(byId('all-items'));byId('all-dialog').showModal();
};
byId('all-close').onclick=()=>byId('all-dialog').close();
byId('refresh').onclick=async()=>{await syncQueue();await loadRemote();};
byId('nav-radar').onclick=()=>byId('radar').scrollIntoView({behavior:'smooth',block:'center'});
byId('nav-business').onclick=()=>location.href='/time/';
window.addEventListener('online',async()=>{await updateSyncStatus();await syncQueue();});
window.addEventListener('offline',updateSyncStatus);

setupVoice();load().then(()=>syncQueue());
if('serviceWorker'in navigator)navigator.serviceWorker.register('/assistant/sw.js').catch(()=>{});
