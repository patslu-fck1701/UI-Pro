'use strict';

const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');

const clone=value=>structuredClone(value);
const uid=prefix=>prefix+'_'+crypto.randomUUID();
function fail(code,message){const error=new Error(message);error.code=code;throw error}
function text(value,max=4000){const result=String(value||'').trim();if(!result)fail('VALIDATION_ERROR','Text is required');return result.slice(0,max)}
function optional(value,max=4000){return String(value||'').trim().slice(0,max)}
function sleep(ms){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms)}
function safePayload(value,pathName='payload',depth=0){
  if(depth>5)fail('VALIDATION_ERROR',pathName+' too deep');
  if(value===null||value===undefined||typeof value==='boolean')return value??null;
  if(typeof value==='number'){if(!Number.isFinite(value))fail('VALIDATION_ERROR',pathName+' invalid');return value}
  if(typeof value==='string')return value.slice(0,8192);
  if(Array.isArray(value))return value.slice(0,256).map((item,index)=>safePayload(item,pathName+'['+index+']',depth+1));
  if(typeof value==='object'){
    const result={};
    for(const [key,item] of Object.entries(value).slice(0,256)){
      if(/authorization|access.?token|refresh.?token|password|secret|private.?key|session/i.test(key))fail('VALIDATION_ERROR',pathName+' contains secret-like field');
      result[key]=safePayload(item,pathName+'.'+key,depth+1);
    }
    return result;
  }
  fail('VALIDATION_ERROR',pathName+' invalid');
}
function dayKey(value){return new Date(value).toISOString().slice(0,10)}
function relevance(input,now=new Date()){
  let score=Number.isFinite(input.relevance)?Math.max(0,Math.min(100,Number(input.relevance))):45;
  if(input.severity==='critical')score=Math.max(score,95);
  if(input.severity==='high')score=Math.max(score,82);
  if(input.severity==='medium')score=Math.max(score,62);
  if(input.requiresDecision)score=Math.max(score,80);
  if(input.dueAt){
    const diff=new Date(input.dueAt).getTime()-now.getTime();
    if(diff<0)score=Math.max(score,92);
    else if(diff<=6*3600000)score=Math.max(score,88);
    else if(diff<=24*3600000)score=Math.max(score,78);
    else if(diff<=72*3600000)score=Math.max(score,66);
  }
  return score;
}
function inferDueAt(value,now=new Date()){
  const input=String(value||'').toLowerCase(),day=new Date(now);
  day.setSeconds(0,0);
  let matched=false;
  if(/\bübermorgen\b/.test(input)){day.setDate(day.getDate()+2);matched=true;}
  else if(/\bmorgen\b/.test(input)){day.setDate(day.getDate()+1);matched=true;}
  else if(/\bheute\b/.test(input)){matched=true;}
  const dateMatch=/(?:^|\s)(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?(?:\s|$)/.exec(input);
  if(dateMatch){
    const year=dateMatch[3]?Number(dateMatch[3].length===2?'20'+dateMatch[3]:dateMatch[3]):day.getFullYear();
    day.setFullYear(year,Number(dateMatch[2])-1,Number(dateMatch[1]));matched=true;
  }
  const timeMatch=/(?:\b|^)([01]?\d|2[0-3])(?::([0-5]\d))?\s*(?:uhr)?\b/.exec(input);
  if(timeMatch){day.setHours(Number(timeMatch[1]),Number(timeMatch[2]||0),0,0);matched=true;}
  else if(matched)day.setHours(9,0,0,0);
  return matched?day.toISOString():null;
}
const CAPTURE_HINTS=Object.freeze({
  idea:Object.freeze({id:'idea',label:'Idee',kind:'idea',relevance:55}),
  invoice:Object.freeze({id:'invoice',label:'Rechnung',kind:'invoice',relevance:78,requiresDecision:true}),
  release:Object.freeze({id:'release',label:'Release',kind:'release-status',relevance:68}),
  'event-test':Object.freeze({id:'event-test',label:'Event-Test',kind:'event-test',relevance:72})
});
function publicCaptureHints(){return Object.values(CAPTURE_HINTS).map(item=>clone(item));}

const DEUTSCHZ_TARGETS=Object.freeze([
  {id:'koth',label:'KOTH',aliases:['koth','king of the hill','king of the hillz']},
  {id:'courierz',label:'CourierZ',aliases:['courierz','courier']},
  {id:'raven',label:'RAVEN',aliases:['raven','airdrop']},
  {id:'aiconvoyz',label:'AIConvoyZ',aliases:['aiconvoyz','aiconvoy','ai convoy','konvoi','convoy']},
  {id:'eventschedulerz',label:'EventSchedulerZ',aliases:['eventschedulerz','event scheduler','scheduler']},
  {id:'toxicz',label:'ToxicZ',aliases:['toxicz','toxic']},
  {id:'battlegroundz',label:'BattlegroundZ',aliases:['battlegroundz','battleground']},
  {id:'operation-deutschz',label:'Operation DeutschZ',aliases:['operation deutschz','operation eclipsez','eclipsez']},
  {id:'atm-raidz',label:'ATM RaidZ',aliases:['atm raidz','atm raid','atmraidez']},
  {id:'propertyz',label:'PropertyZ',aliases:['propertyz','property']}
]);
function inferDeutschzTarget(value){
  const body=String(value||'').toLowerCase();
  for(const target of DEUTSCHZ_TARGETS){
    if(target.aliases.some(alias=>body.includes(alias)))return {id:target.id,label:target.label};
  }
  return null;
}
function createMapperProjection({organisationId,actorId,sourceId,sourceType,captureType,textValue,eventTarget,now,id}){
  return {
    id:id('projection'),organisationId,actorId,target:'deutschz.webmapper',status:'pending_unbound',
    sourceId,sourceType,captureType:captureType||null,eventId:eventTarget?.id||null,eventLabel:eventTarget?.label||null,
    summary:optional(textValue,1200),createdAt:now,updatedAt:now,
    note:'Durable projection; external Webmapper transport is not bound yet.'
  };
}

const DEUTSCHZ_EVENT_SPECS=Object.freeze({
  'event-chain':Object.freeze({
    id:'event-chain',name:'Eventkette KOTH → CourierZ → RAVEN → AIConvoyZ',
    baseline:'DeutschZ Roadmap · 01.10.2026',
    criteria:[
      {id:'start',label:'Events starten sauber',positive:['startet','gestartet','start sauber'],negative:['startet nicht','kein start','start hängt']},
      {id:'finish',label:'Events schließen sauber ab',positive:['beendet','abgeschlossen','fertig','ende sauber'],negative:['endet nicht','beendet nicht','hängt am ende']},
      {id:'handoff',label:'Übergabe zum nächsten Event funktioniert',positive:['übergabe','nächstes event','courierz','raven','aiconvoy'],negative:['übergabe fehlt','nächstes event startet nicht','kette stoppt']},
      {id:'slot',label:'Eventslot wird wieder freigegeben',positive:['slot frei','slot freigegeben','blockiert nicht'],negative:['slot blockiert','blockiert event','eventslot hängt']},
      {id:'repeat',label:'Wiederholung bleibt möglich',positive:['wiederholt','zweiter lauf','nochmal gestartet','erneut gestartet'],negative:['zweiter lauf geht nicht','wiederholung blockiert']}
    ]
  }),
  'koth':Object.freeze({
    id:'koth',name:'KOTH',baseline:'DeutschZ Roadmap · 01.10.2026',
    criteria:[
      {id:'start',label:'KOTH startet sauber',positive:['koth startet','koth gestartet','start sauber'],negative:['koth startet nicht','kein koth start','koth hängt']},
      {id:'finish',label:'KOTH schließt sauber ab',positive:['koth beendet','koth abgeschlossen','koth fertig'],negative:['koth endet nicht','koth beendet nicht']},
      {id:'handoff',label:'CourierZ kann danach übernehmen',positive:['courierz startet','courier startet','übergabe courier'],negative:['courierz startet nicht','courier blockiert']},
      {id:'slot',label:'Eventslot ist danach frei',positive:['slot frei','slot freigegeben','blockiert nicht'],negative:['slot blockiert','eventslot hängt']}
    ]
  }),
  'courierz':Object.freeze({
    id:'courierz',name:'CourierZ',baseline:'DeutschZ Roadmap · 01.10.2026',
    criteria:[
      {id:'start',label:'CourierZ startet sauber',positive:['courierz startet','courier startet','courierz gestartet'],negative:['courierz startet nicht','courier startet nicht']},
      {id:'finish',label:'CourierZ schließt sauber ab',positive:['courierz beendet','courier beendet','courierz abgeschlossen'],negative:['courierz endet nicht','courier hängt']},
      {id:'handoff',label:'RAVEN kann danach übernehmen',positive:['raven startet','übergabe raven'],negative:['raven startet nicht','raven blockiert']},
      {id:'slot',label:'Eventslot ist danach frei',positive:['slot frei','slot freigegeben','blockiert nicht'],negative:['slot blockiert','eventslot hängt']}
    ]
  }),
  'raven':Object.freeze({
    id:'raven',name:'RAVEN',baseline:'DeutschZ Roadmap · 01.10.2026',
    criteria:[
      {id:'start',label:'RAVEN startet sauber',positive:['raven startet','raven gestartet','start sauber'],negative:['raven startet nicht','kein raven start']},
      {id:'finish',label:'RAVEN schließt sauber ab',positive:['raven beendet','raven abgeschlossen','raven fertig'],negative:['raven endet nicht','raven hängt']},
      {id:'handoff',label:'AIConvoyZ kann danach übernehmen',positive:['aiconvoy startet','konvoi startet','übergabe convoy'],negative:['aiconvoy startet nicht','konvoi blockiert']},
      {id:'slot',label:'Eventslot ist danach frei',positive:['slot frei','slot freigegeben','blockiert nicht'],negative:['slot blockiert','eventslot hängt']}
    ]
  }),
  'aiconvoyz':Object.freeze({
    id:'aiconvoyz',name:'AIConvoyZ',baseline:'AI Convoy Event-Roadmap · 03.10.2026',
    criteria:[
      {id:'route',group:'Route',label:'Eine der zwei festen Routen läuft vollständig',expected:'Balota → Rifi oder Northwest Airfield → Pavlovo-Gaszone',positive:['balota nach rifi','balota rifi','northwest airfield pavlovo','nwaf pavlovo','route läuft sauber','route komplett'],negative:['falsche route','route hängt','wegpunkt hängt','konvoi bleibt auf route stehen','fährt falsch']},
      {id:'formation',group:'Konvoi',label:'Humvee – Truck – Humvee fahren als zusammengehöriger Konvoi',expected:'3 Fahrzeuge; 5 Start-AI: 1 / 2 / 2 Insassen',positive:['humvee truck humvee','drei fahrzeuge','3 fahrzeuge','fünf ai','5 ai','abstand passt','konvoi bleibt zusammen'],negative:['fahrzeug fehlt','nur zwei fahrzeuge','4 ai','vier ai','zu großer abstand','konvoi trennt sich']},
      {id:'activation',group:'Aktivierung',label:'Vollaktivierung erfolgt erst bei etwa 1000 m Spielerannäherung',expected:'unauffällige Aktivierung um ca. 1000 m; vorher keine unnötige AI-Last',positive:['1000 meter','tausend meter','erst bei annäherung','spawn nicht bemerkt','aktivierung unauffällig'],negative:['300 meter','500 meter','zu früh gespawnt','dauerhaft aktiv','spawn gesehen','aktiviert zu spät']},
      {id:'loot',group:'Loot',label:'Fahrzeugloot liegt qualitativ auf KOTH-Eventniveau',expected:'hochwertige Waffen, Munition, Attachments, Medizin, Spezial-/Eventgegenstände',positive:['loot ist gut','koth loot','hochwertiger loot','event loot passt','seltene waffen'],negative:['weltloot','loot zu schlecht','kaum loot','loot fehlt','nur standard loot']},
      {id:'attack',group:'Angriff',label:'Spielerangriff stoppt den Konvoi und löst echte Verteidigung aus',expected:'Schaden/Angriff erkannt; AI steigt aus, sucht Deckung und bekämpft Angreifer',positive:['konvoi stoppt','ai steigt aus','ai gehen in deckung','ai schießt zurück','angriff erkannt','kampfmodus'],negative:['fährt einfach weiter','ai bleibt sitzen','ai reagiert nicht','keine gegenwehr','schaden wird nicht erkannt']},
      {id:'reinforcement',group:'Verstärkung',label:'Nach Angriff folgen Meldung, Helisound, Crashsound und Wrack',expected:'„Feindliche Verstärkung ist unterwegs“; inszenierter Absturz statt echtem Verstärkungsheli',positive:['verstärkung ist unterwegs','helikopter sound','heli sound','crash sound','absturz sound','wrack erscheint','heliwrack erscheint'],negative:['keine verstärkung meldung','kein heli sound','kein crash sound','wrack fehlt','echter heli hängt']},
      {id:'blackbox',group:'Blackbox',label:'Blackbox-Hack dauert 90–120 s und liefert den Toxic Dokumenten Decoder',expected:'halten zum Hacken; Abbruch bei definierter Unterbrechung; danach Decoder als Belohnung',positive:['90 sekunden','120 sekunden','hack läuft','taste halten','blackbox gehackt','decoder bekommen','toxic dokumenten decoder'],negative:['sofort offen','hack zu kurz','hack bricht falsch ab','blackbox nicht hackbar','decoder fehlt']},
      {id:'factions',group:'Fraktionen',label:'Russianz und Americanz verhalten sich als Event-Fraktionen korrekt',expected:'anfangs 5 Konvoi-AI; zusätzlicher gegnerischer Trupp 2–3 AI; Rollen können wechseln',positive:['russianz','americanz','zwei ai verstärkung','2 ai verstärkung','drei ai verstärkung','3 ai verstärkung','gegnerischer trupp'],negative:['vier ai verstärkung','4 ai verstärkung','fraktion fehlt','falsche fraktion','friendly fire kaputt']},
      {id:'ignored',group:'Kein Angriff',label:'Ignorierter Konvoi löst vor Routenziel ein Russianz-vs-Americanz-Gefecht aus',expected:'Event verschwindet nicht einfach; gegnerischer Trupp startet AI-vs-AI-Gefecht',positive:['ai gegen ai','russianz gegen americanz','gefecht startet','vor dem ziel kampf','konvoi wird angegriffen von ai'],negative:['verschwindet am ziel','nichts passiert','kein ai kampf','event endet einfach']},
      {id:'sound_aggro',group:'Sound & Aggro',label:'Gefechtssound skaliert mit Entfernung; eintreffende Spieler übernehmen Aggro',expected:'weit hörbar, näher lauter; bei Eingriff stoppen beide Fraktionen ihren gegenseitigen Kampf und fokussieren Spieler',positive:['weit hörbar','wird lauter','sound skaliert','beide greifen spieler an','beide fraktionen auf spieler','ai kampf stoppt bei spieler'],negative:['sound überall gleich laut','nicht hörbar','beide kämpfen weiter gegeneinander','spieler wird ignoriert','aggro wechselt nicht']},
      {id:'toxic_chain',group:'Eventkette',label:'Secret-Dokument und Decoder lassen sich zum ToxicZ-Signalgerät kombinieren',expected:'ToxicZ_Secret_Document + Toxicz_Doc_Decoder → ToxicZ_Signal_Marker; beide Zutaten werden verbraucht',positive:['signalmarker erstellt','signal marker erstellt','signalgerät erstellt','signalgeraet erstellt','beide kombiniert','kombination funktioniert','toxic signal marker'],negative:['kombination geht nicht','dokument wird nicht erkannt','decoder wird nicht erkannt','signalmarker fehlt','signalgerät fehlt','signalgeraet fehlt']},
      {id:'toxic_activation',group:'Eventkette',label:'Aktivierung des ToxicZ-Signalmarkers startet das Toxic Event',expected:'Erst ToxicZ_Signal_Marker aktivieren → ToxicZ startet; nicht bereits beim bloßen Besitz der beiden Ausgangsitems',positive:['signalmarker aktiviert','signal marker aktiviert','signalgerät aktiviert','signalgeraet aktiviert','toxicz startet nach marker','toxic event startet nach marker'],negative:['toxicz startet schon vorher','startet beim besitz','marker aktiviert aber nichts passiert','signalmarker startet toxicz nicht','toxicz startet nicht nach marker']},
      {id:'cleanup',group:'Abschluss',label:'Cleanup räumt AI, Fahrzeuge, Marker/Wrack sauber auf und gibt Scheduler-Slot frei',expected:'keine Reste/Doppelspawns; Scheduler kann das nächste Major-Event starten',positive:['cleanup sauber','alles despawnt','marker weg','slot frei','nächstes event startet','keine reste'],negative:['ai bleiben stehen','fahrzeuge bleiben','marker bleibt','slot blockiert','doppelspawn','nächstes event startet nicht']}
    ]
  }),
  'eventschedulerz':Object.freeze({
    id:'eventschedulerz',name:'EventSchedulerZ',baseline:'DeutschZ Roadmap · 01.10.2026',
    criteria:[
      {id:'sequence',label:'Große Events laufen nacheinander',positive:['nacheinander','reihenfolge stimmt','nächstes event'],negative:['gleichzeitig gestartet','kollision','überschneiden']},
      {id:'finish',label:'Abschluss wird erkannt',positive:['abschluss erkannt','beendet','fertig'],negative:['abschluss nicht erkannt','hängt aktiv']},
      {id:'slot',label:'Slot wird für das nächste Event freigegeben',positive:['slot frei','slot freigegeben'],negative:['slot blockiert','slot bleibt belegt']}
    ]
  }),
  'toxicz':Object.freeze({
    id:'toxicz',name:'ToxicZ',baseline:'DeutschZ Mod-Source + Eventkette · 03.10.2026',
    criteria:[
      {id:'ingredients',group:'Freischaltung',label:'Beide benötigten Eventgegenstände sind vorhanden',expected:'ToxicZ_Secret_Document aus KOTH und Toxicz_Doc_Decoder aus AIConvoyZ',positive:['secret dokument vorhanden','decoder vorhanden','beide gegenstände vorhanden','beide items vorhanden'],negative:['secret dokument fehlt','decoder fehlt','item fehlt']},
      {id:'combine',group:'Freischaltung',label:'Beide Gegenstände werden zum ToxicZ-Signalmarker kombiniert',expected:'Recipe „ToxicZ-Signalgeraet entschluesseln“ verbraucht beide Zutaten und erzeugt ToxicZ_Signal_Marker',positive:['signalmarker erstellt','signalgerät erstellt','signalgeraet erstellt','kombination funktioniert','beide verbraucht'],negative:['kombination geht nicht','signalmarker fehlt','zutat bleibt fälschlich erhalten']},
      {id:'activate',group:'Start',label:'Der ToxicZ-Signalmarker startet das Toxic Event erst bei Aktivierung',expected:'ToxicZ_Signal_Marker aktivieren → ToxicZ startet',positive:['signalmarker aktiviert','toxicz startet','toxic event startet'],negative:['marker aktiviert aber nichts passiert','toxicz startet nicht','startet schon beim besitz']}
    ]
  })
});
function publicEventSpecs(){
  return Object.values(DEUTSCHZ_EVENT_SPECS).map(spec=>({id:spec.id,name:spec.name,baseline:spec.baseline,criteria:spec.criteria.map(item=>({id:item.id,group:item.group||null,label:item.label,expected:item.expected||null}))}));
}
function evaluateEventTest(session){
  const body=session.observations.map(item=>item.text).join(' ').toLowerCase();
  const results=session.spec.criteria.map(criterion=>{
    const negative=criterion.negative.find(term=>body.includes(term));
    if(negative)return {id:criterion.id,group:criterion.group||null,label:criterion.label,expected:criterion.expected||null,status:'issue',evidence:negative};
    const positive=criterion.positive.find(term=>body.includes(term));
    if(positive)return {id:criterion.id,group:criterion.group||null,label:criterion.label,expected:criterion.expected||null,status:'observed',evidence:positive};
    return {id:criterion.id,group:criterion.group||null,label:criterion.label,expected:criterion.expected||null,status:'not_observed',evidence:null};
  });
  return {
    results,
    counts:{
      observed:results.filter(item=>item.status==='observed').length,
      issue:results.filter(item=>item.status==='issue').length,
      notObserved:results.filter(item=>item.status==='not_observed').length
    },
    note:'Automatische Erstbewertung aus gesprochenen Beobachtungen; die Event-Sollwerte können später präziser versioniert werden.'
  };
}
function inferCapture(raw,now=new Date()){
  const body=text(raw.text),lower=body.toLowerCase();
  const hint=CAPTURE_HINTS[raw.captureType]||null;
  let kind=hint?.kind||'note',severity='normal',requiresDecision=Boolean(hint?.requiresDecision);
  if(!hint){
    if(/\b(termin|besprechung|treffen|meeting|kalender)\b/.test(lower))kind='appointment';
    else if(/\b(idee|einfall|vielleicht|könnte|koennte)\b/.test(lower))kind='idea';
    else if(/\b(anrufen|erledigen|machen|prüfen|pruefen|bestellen|bezahlen|schicken|antworten|muss|todo|aufgabe)\b/.test(lower))kind='task';
  }
  if(/\b(dringend|sofort|wichtig|frist|überfällig|ueberfaellig)\b/.test(lower))severity='high';
  else if(/\b(heute|morgen|bald)\b/.test(lower))severity='medium';
  if(/\b(entscheiden|freigabe|freigeben|genehmigen|auswählen|auswaehlen)\b/.test(lower))requiresDecision=true;
  return {
    kind,severity,requiresDecision,
    title:optional(raw.title,180)||body.split(/[.!?\n]/)[0].slice(0,120),
    summary:body,
    dueAt:raw.dueAt||inferDueAt(body,now),
    relevance:Math.max(hint?.relevance||0,relevance({severity,requiresDecision,dueAt:raw.dueAt||inferDueAt(body,now)},now))
  };
}

class FileAssistantState {
  constructor(file,{clock=()=>new Date(),lockTimeoutMs=2000,staleLockMs=10000}={}){
    this.file=path.resolve(file);this.lockFile=this.file+'.lock';this.clock=clock;this.lockTimeoutMs=lockTimeoutMs;this.staleLockMs=staleLockMs;
  }
  empty(){return {schemaVersion:1,revision:0,items:[],documents:[],marketSnapshots:[],simulationMandates:[],eventTests:[],projections:[]}}
  load(){
    if(!fs.existsSync(this.file))return this.empty();
    let value;try{value=JSON.parse(fs.readFileSync(this.file,'utf8'))}catch{fail('ASSISTANT_STATE_INVALID','Assistant state unreadable')}
    if(value.schemaVersion!==1||!Array.isArray(value.items)||!Array.isArray(value.documents)||!Array.isArray(value.marketSnapshots)||!Array.isArray(value.simulationMandates))fail('ASSISTANT_STATE_INVALID','Unsupported assistant state');
    if(!Array.isArray(value.eventTests))value.eventTests=[];
    if(!Array.isArray(value.projections))value.projections=[];
    return value;
  }
  save(value){
    fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});
    const temp=this.file+'.tmp-'+crypto.randomUUID();
    fs.writeFileSync(temp,JSON.stringify(value),{mode:0o600,flag:'wx'});
    fs.renameSync(temp,this.file);
  }
  withLock(fn){
    fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});
    const started=Date.now();let fd=null;
    while(fd===null){
      try{fd=fs.openSync(this.lockFile,'wx',0o600)}
      catch(error){
        if(error.code!=='EEXIST')throw error;
        try{if(Date.now()-fs.statSync(this.lockFile).mtimeMs>this.staleLockMs)fs.unlinkSync(this.lockFile)}catch(cause){if(cause.code!=='ENOENT')throw cause}
        if(Date.now()-started>=this.lockTimeoutMs)fail('ASSISTANT_STATE_LOCK_TIMEOUT','Assistant state lock timeout');
        sleep(10);
      }
    }
    try{return fn()}finally{try{fs.closeSync(fd)}catch{};try{fs.unlinkSync(this.lockFile)}catch(error){if(error.code!=='ENOENT')throw error}}
  }
  update(mutator){
    return this.withLock(()=>{const value=this.load(),result=mutator(value);value.revision++;this.save(value);return clone(result)});
  }
}

class FileAssistantDocumentStore {
  constructor(root){this.root=path.resolve(root);fs.mkdirSync(this.root,{recursive:true,mode:0o700})}
  put({organisationId,id,bytes}){
    const dir=path.join(this.root,encodeURIComponent(organisationId));fs.mkdirSync(dir,{recursive:true,mode:0o700});
    const file=path.join(dir,encodeURIComponent(id)+'.bin'),temp=file+'.tmp-'+crypto.randomUUID();
    fs.writeFileSync(temp,bytes,{mode:0o600,flag:'wx'});fs.renameSync(temp,file);return file;
  }
  get(organisationId,id){
    const file=path.join(this.root,encodeURIComponent(organisationId),encodeURIComponent(id)+'.bin');
    if(!fs.existsSync(file))fail('NOT_FOUND','Document not found');return fs.readFileSync(file);
  }
}

class AssistantService {
  constructor({auth,entitlements,state,documents,clock=()=>new Date(),id=uid,audit=()=>{}}){
    this.auth=auth;this.entitlements=entitlements;this.state=state;this.documents=documents;this.clock=clock;this.id=id;this.audit=audit;
  }
  session(token,capability,moduleId='werkz.assistant'){
    const session=this.auth.resolveSession(token);this.entitlements.require(session.organisationId,moduleId);
    if(!session.capabilities.includes(capability))fail('FORBIDDEN','Missing capability: '+capability);return session;
  }
  own(value,organisationId){return value.filter(item=>item.organisationId===organisationId)}
  capture(token,input){
    const session=this.session(token,'assistant.capture'),derived=inferCapture(input,this.clock()),now=this.clock().toISOString();
    const idempotencyKey=optional(input.idempotencyKey,240);
    return this.state.update(value=>{
      if(idempotencyKey){
        const existing=value.items.find(entry=>entry.organisationId===session.organisationId&&entry.idempotencyKey===idempotencyKey);
        if(existing)return existing;
      }
      const eventTarget=inferDeutschzTarget(input.eventId||input.text);
      const item={id:this.id('asst'),organisationId:session.organisationId,actorId:session.actorId,source:input.source||'manual',
        sourceRef:input.sourceRef||null,idempotencyKey:idempotencyKey||null,status:'open',createdAt:now,updatedAt:now,...derived,
        captureType:input.captureType||null,eventId:eventTarget?.id||null,eventLabel:eventTarget?.label||null,
        payload:safePayload(input.payload||{})};
      value.items.push(item);
      if(eventTarget&&(input.captureType==='event-test'||input.captureType==='release'||item.kind==='event-test'||item.kind==='release-status')){
        value.projections.push(createMapperProjection({
          organisationId:session.organisationId,actorId:session.actorId,sourceId:item.id,sourceType:'assistant-capture',
          captureType:item.captureType,textValue:item.summary,eventTarget,now,id:this.id
        }));
      }
      this.audit({organisationId:session.organisationId,actorId:session.actorId,eventType:'assistant.capture.created',entityType:'assistant-item',entityId:item.id,payload:{kind:item.kind,source:item.source,relevance:item.relevance,eventId:item.eventId}});
      return item;
    });
  }
  ingestSignal(token,input){
    const session=this.session(token,'assistant.manage'),now=this.clock().toISOString(),externalKey=optional(input.externalKey,300);
    return this.state.update(value=>{
      const existing=externalKey&&value.items.find(item=>item.organisationId===session.organisationId&&item.source===input.source&&item.externalKey===externalKey);
      if(existing)return existing;
      const item={id:this.id('signal'),organisationId:session.organisationId,actorId:session.actorId,source:text(input.source,80),
        externalKey:externalKey||null,sourceRef:input.sourceRef||null,kind:input.kind||'signal',title:text(input.title,180),
        summary:optional(input.summary,4000),severity:input.severity||'normal',requiresDecision:Boolean(input.requiresDecision),
        dueAt:input.dueAt||null,status:'open',createdAt:now,updatedAt:now,payload:safePayload(input.payload||{})};
      item.relevance=relevance(input,this.clock());value.items.push(item);return item;
    });
  }
  setStatus(token,id,status){
    const session=this.session(token,'assistant.manage');if(!['open','snoozed','done','dismissed'].includes(status))fail('VALIDATION_ERROR','Invalid status');
    return this.state.update(value=>{const item=value.items.find(entry=>entry.id===id&&entry.organisationId===session.organisationId);if(!item)fail('NOT_FOUND','Assistant item not found');item.status=status;item.updatedAt=this.clock().toISOString();return item});
  }
  list(token){
    const session=this.session(token,'assistant.read');return this.own(this.state.load().items,session.organisationId).sort((a,b)=>b.relevance-a.relevance||String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  addDocument(token,{fileName,mime,bytes,category='document',note='',idempotencyKey='',clientHash=''}) {
    const session=this.session(token,'assistant.capture');if(!Buffer.isBuffer(bytes)||!bytes.length)fail('VALIDATION_ERROR','Document bytes required');
    const idem=optional(idempotencyKey,240),hash='sha256:'+crypto.createHash('sha256').update(bytes).digest('hex'),now=this.clock().toISOString();
    if(clientHash&&String(clientHash)!==hash)fail('HASH_MISMATCH','Document integrity check failed');
    return this.state.update(value=>{
      if(idem){
        const existing=value.documents.find(entry=>entry.organisationId===session.organisationId&&entry.idempotencyKey===idem);
        if(existing)return existing;
      }
      const id=this.id('doc');
      this.documents.put({organisationId:session.organisationId,id,bytes});
      const document={id,organisationId:session.organisationId,actorId:session.actorId,idempotencyKey:idem||null,fileName:optional(fileName,240)||'upload',
        mime:optional(mime,120)||'application/octet-stream',size:bytes.length,hash,category,analysisStatus:'pending',createdAt:now,note:optional(note,2000)};
      value.documents.push(document);value.items.push({
        id:this.id('asst'),organisationId:session.organisationId,actorId:session.actorId,source:'document',sourceRef:id,idempotencyKey:idem?idem+':item':null,
        kind:category==='invoice'?'invoice':'document',title:category==='invoice'?'Rechnung / Beleg prüfen':'Dokument prüfen',summary:document.fileName,
        status:'open',severity:'medium',requiresDecision:true,dueAt:null,relevance:80,createdAt:now,updatedAt:now,payload:{documentId:id,analysisStatus:'pending'}
      });return document;
    });
  }
  getDocument(token,id){
    const session=this.session(token,'assistant.read'),document=this.state.load().documents.find(entry=>entry.id===id&&entry.organisationId===session.organisationId);
    if(!document)fail('NOT_FOUND','Document not found');return {metadata:clone(document),bytes:this.documents.get(session.organisationId,id)};
  }
  addMarketSnapshot(token,input){
    const session=this.session(token,'analytics.view','werkz.analytics'),asset=text(input.asset,24).toUpperCase(),currency=text(input.currency||'EUR',12).toUpperCase();
    const price=Number(input.price);if(!Number.isFinite(price)||price<=0)fail('VALIDATION_ERROR','Invalid market price');
    const observedAt=input.observedAt||this.clock().toISOString(),snapshot={id:this.id('mkt'),organisationId:session.organisationId,asset,currency,price,observedAt,source:input.source||'market',portfolio:safePayload(input.portfolio||{})};
    return this.state.update(value=>{const duplicate=value.marketSnapshots.find(x=>x.organisationId===session.organisationId&&x.asset===asset&&x.currency===currency&&x.observedAt===observedAt);if(duplicate)return duplicate;value.marketSnapshots.push(snapshot);return snapshot});
  }
  marketSummary(token,asset='BTC',currency='EUR'){
    const session=this.session(token,'analytics.view','werkz.analytics'),rows=this.own(this.state.load().marketSnapshots,session.organisationId).filter(x=>x.asset===asset&&x.currency===currency).sort((a,b)=>new Date(a.observedAt)-new Date(b.observedAt));
    if(!rows.length)return {asset,currency,count:0};
    const first=rows[0],last=rows.at(-1);let peak=rows[0].price,maxDrawdown=0;
    for(const row of rows){peak=Math.max(peak,row.price);maxDrawdown=Math.min(maxDrawdown,(row.price-peak)/peak)}
    return {asset,currency,count:rows.length,firstAt:first.observedAt,lastAt:last.observedAt,firstPrice:first.price,lastPrice:last.price,
      changePct:(last.price-first.price)/first.price*100,maxDrawdownPct:maxDrawdown*100,latestPortfolio:last.portfolio||{}};
  }
  createMandate(token,input){
    const session=this.session(token,'simulation.run','werkz.simulation'),strategy=input.strategy||'hold';if(!['hold','periodic_buy'].includes(strategy))fail('VALIDATION_ERROR','Unsupported simulation strategy');
    const mandate={id:this.id('sim'),organisationId:session.organisationId,name:text(input.name,120),asset:text(input.asset||'BTC',24).toUpperCase(),currency:text(input.currency||'EUR',12).toUpperCase(),strategy,
      parameters:safePayload(input.parameters||{}),createdAt:this.clock().toISOString(),status:'active'};
    return this.state.update(value=>{value.simulationMandates.push(mandate);return mandate});
  }
  evaluateMandates(token){
    const session=this.session(token,'simulation.run','werkz.simulation'),value=this.state.load(),mandates=this.own(value.simulationMandates,session.organisationId);
    return mandates.map(mandate=>{
      const rows=this.own(value.marketSnapshots,session.organisationId).filter(x=>x.asset===mandate.asset&&x.currency===mandate.currency).sort((a,b)=>new Date(a.observedAt)-new Date(b.observedAt));
      if(rows.length<2)return {...mandate,metrics:{samples:rows.length,status:'collecting'}};
      const start=rows[0].price,end=rows.at(-1).price;let peak=start,maxDrawdown=0;for(const row of rows){peak=Math.max(peak,row.price);maxDrawdown=Math.min(maxDrawdown,(row.price-peak)/peak)}
      const performancePct=(end-start)/start*100;
      return {...mandate,metrics:{samples:rows.length,status:'evaluated',startAt:rows[0].observedAt,endAt:rows.at(-1).observedAt,performancePct,maxDrawdownPct:maxDrawdown*100,note:mandate.strategy==='periodic_buy'?'Price-history baseline; cash-flow simulation is not yet executed.':'Buy-and-hold price baseline.'}};
    });
  }
  listProjections(token){
    const session=this.session(token,'assistant.read');
    return this.own(this.state.load().projections,session.organisationId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  captureHints(token){this.session(token,'assistant.read');return publicCaptureHints();}
  eventSpecs(token){
    this.session(token,'assistant.read');
    return publicEventSpecs();
  }
  startEventTest(token,input){
    const session=this.session(token,'assistant.capture'),spec=DEUTSCHZ_EVENT_SPECS[input.eventId];
    if(!spec)fail('VALIDATION_ERROR','Unknown DeutschZ event');
    const idem=optional(input.idempotencyKey,240),requestedId=optional(input.id,160),now=this.clock().toISOString();
    return this.state.update(value=>{
      if(idem){
        const existing=value.eventTests.find(entry=>entry.organisationId===session.organisationId&&entry.idempotencyKey===idem);
        if(existing)return existing;
      }
      if(requestedId&&value.eventTests.some(entry=>entry.organisationId===session.organisationId&&entry.id===requestedId))fail('ID_CONFLICT','Event test id already exists');
      const record={
        id:requestedId||this.id('eventtest'),organisationId:session.organisationId,actorId:session.actorId,
        idempotencyKey:idem||null,eventId:spec.id,eventName:spec.name,baseline:spec.baseline,
        spec:clone(spec),status:'running',startedAt:input.startedAt||now,endedAt:null,observations:[],report:null,mapperProjectionId:null
      };
      value.eventTests.push(record);
      const projection=createMapperProjection({
        organisationId:session.organisationId,actorId:session.actorId,sourceId:record.id,sourceType:'event-test',
        captureType:'event-test',textValue:'Test gestartet: '+record.eventName,eventTarget:{id:record.eventId,label:record.eventName},now,id:this.id
      });
      value.projections.push(projection);record.mapperProjectionId=projection.id;
      return record;
    });
  }
  addEventObservation(token,id,input){
    const session=this.session(token,'assistant.capture'),body=text(input.text),idem=optional(input.idempotencyKey,240),now=this.clock().toISOString();
    return this.state.update(value=>{
      const record=value.eventTests.find(entry=>entry.id===id&&entry.organisationId===session.organisationId);
      if(!record)fail('NOT_FOUND','Event test not found');
      if(record.status!=='running')fail('VALIDATION_ERROR','Event test is not running');
      if(idem){
        const existing=record.observations.find(entry=>entry.idempotencyKey===idem);
        if(existing)return existing;
      }
      const observation={id:this.id('obs'),idempotencyKey:idem||null,text:body,source:input.source||'voice',capturedAt:input.capturedAt||now};
      record.observations.push(observation);
      const projection=value.projections.find(entry=>entry.id===record.mapperProjectionId);
      if(projection){
        projection.summary=(projection.summary+'\n'+observation.text).trim().slice(0,1200);
        projection.updatedAt=now;
      }
      return observation;
    });
  }
  finishEventTest(token,id,input={}){
    const session=this.session(token,'assistant.capture'),idem=optional(input.idempotencyKey,240),now=this.clock().toISOString();
    return this.state.update(value=>{
      const record=value.eventTests.find(entry=>entry.id===id&&entry.organisationId===session.organisationId);
      if(!record)fail('NOT_FOUND','Event test not found');
      if(record.status==='finished')return record;
      record.status='finished';record.endedAt=input.endedAt||now;record.finishIdempotencyKey=idem||null;record.report=evaluateEventTest(record);
      const projection=value.projections.find(entry=>entry.id===record.mapperProjectionId);
      if(projection){
        projection.status='pending_unbound';
        projection.summary=(projection.summary+'\nTest beendet · beobachtet '+record.report.counts.observed+' · Auffälligkeiten '+record.report.counts.issue+' · offen '+record.report.counts.notObserved).slice(0,1200);
        projection.updatedAt=now;
      }
      value.items.push({
        id:this.id('asst'),organisationId:session.organisationId,actorId:session.actorId,source:'deutschz-test',sourceRef:record.id,
        kind:'test-report',title:record.eventName+' · Testbericht',summary:record.report.counts.issue
          ?record.report.counts.issue+' Auffälligkeit(en) erkannt'
          :record.report.counts.notObserved+' Punkt(e) noch nicht belegt',
        status:'open',severity:record.report.counts.issue?'high':'normal',requiresDecision:Boolean(record.report.counts.issue),
        dueAt:null,relevance:record.report.counts.issue?88:64,createdAt:now,updatedAt:now,payload:{eventTestId:record.id,counts:record.report.counts}
      });
      return record;
    });
  }
  listEventTests(token){
    const session=this.session(token,'assistant.read');
    return this.own(this.state.load().eventTests,session.organisationId).sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt)));
  }
  briefing(token){
    const session=this.session(token,'assistant.read'),value=this.state.load(),now=this.clock(),today=dayKey(now),open=this.own(value.items,session.organisationId).filter(x=>x.status==='open');
    const selected=open.filter(item=>item.relevance>=70||(item.dueAt&&dayKey(item.dueAt)===today)).sort((a,b)=>b.relevance-a.relevance||String(a.dueAt||'9999').localeCompare(String(b.dueAt||'9999'))).slice(0,7);
    const documents=this.own(value.documents,session.organisationId),pendingDocuments=documents.filter(x=>x.analysisStatus!=='done').length;
    const market=this.marketSummary(token);
    return {generatedAt:now.toISOString(),items:selected,counts:{open:open.length,needsDecision:open.filter(x=>x.requiresDecision).length,pendingDocuments},market};
  }
}

module.exports={FileAssistantState,FileAssistantDocumentStore,AssistantService,inferCapture,inferDueAt,relevance,safePayload,CAPTURE_HINTS,DEUTSCHZ_TARGETS,DEUTSCHZ_EVENT_SPECS,evaluateEventTest,inferDeutschzTarget};
