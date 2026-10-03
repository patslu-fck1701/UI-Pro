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
  {id:'operation-deutschz',label:'Operation DeutschZ',aliases:['operation deutschz','operationdeutschz']},
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

const DEUTSCHZ_STORY_CANON=Object.freeze({
  id:'q17-t17-main',
  version:'2026-10-03',
  title:'DeutschZ Hauptstory · Q-17 / T-17',
  premise:{
    q17:'Q-17 umfasst konzentrierte Proben, Versuchsdaten, Stabilisatoren und mögliche Gegenmittel.',
    t17:'Das T-17-Protokoll trennt Proben, Dokumente, Freigaben, Decoder, Schutzmaterial, Geld, Identifikationsschlüssel und Transportdaten, damit niemand allein die vollständige Kontrolle besitzt.'
  },
  people:[
    {id:'morozov',name:'Dr. Viktor Morozov',state:'dead',role:'wissenschaftlicher Leiter von Q-17; sabotiert T-17 später von innen',facts:['14 Tage vor Transport Sieben getötet','Dead-Channel-Kette vor seinem Tod vorbereitet','digitale Zertifikate nach seinem Tod weiterverwendet']},
    {id:'voronin',name:'Oberst Alexei Voronin',state:'active',role:'will Q-17 erhalten und als kontrollierbares Druckmittel bzw. mögliche Waffe nutzen',facts:['ließ Morozov töten','besitzt Kopien von Morozovs Zertifikaten','verwendet Morozovs Kennung nach dessen Tod weiter']}
  ],
  raven:{
    black:'Voronin-treu; Bergung, Recovery, Beweisvernichtung und Gegenmaßnahmen.',
    echo:'Morozov-Manipulationen und abweichende Crews; Hilfe, Falle, Köder, Quarantäne oder Recovery sind möglich.',
    ravenHeat:'Persönlicher Reaktionswert für aggressivere BLACK-Gegenmaßnahmen.'
  },
  technicalScheduler:{
    independentFromStory:true,
    currentMajorRotation:['koth','courierz','raven','aiconvoyz'],
    note:'Die technische Eventrotation bleibt von der persönlichen Hauptstory getrennt.'
  },
  supportSystems:{
    welcomez:{
      role:'Persönlicher Player-Hub für Storyfortschritt, nächsten Schritt und Weltrotation.',
      verified:['trennt Weltevent-Rotation und Storystatus','liest Completion-Dateien pro Spieler','enthält Morozov-89,5-MHz-Audio als Welcome-Asset']
    },
    radiomissionz:{
      role:'Story-Director und Funkkanal 89,5 MHz.',
      verified:['Storykapitel für KOTH, Transport Sieben, Decoder und Signalaktivierung','persistente story_heard- und event_completions-Struktur','ToxicZ-/ATM-/Courier-/Battleground-/Operation-Storyführung vorhanden']
    },
    battlegroundz:{
      role:'Eigenständiges Event und Autorisierungsknoten vor Operation DeutschZ.',
      verified:['benötigt Battleground-Papiere und Convoy-CardReader','erzeugt registrierten BattlegroundZ-CardReader','gibt nach Erfolg Operation-DeutschZ-KeyCard aus','schreibt persönliche Battleground-Completion']
    },
    operationDeutschz:{
      role:'Aktuelles finales Operationsmodul.',
      verified:['erzeugt MasterCardReader aus registriertem BattlegroundZ-Reader + Operation-KeyCard','Operation-Abschluss wird persönlich persistiert','Eclipse ist nicht Teil des aktuellen Kanons']
    }
  },
  mainStory:{
    order:['koth','aiconvoyz','toxicz','atm-raidz','propertyz','courierz','raven','battlegroundz','operation-deutschz'],
    nodes:[
      {id:'koth',label:'KotHZ',required:true,implementationPolicy:'existing_event_unchanged',storyRole:'Einstieg; seltenes T-17 / Toxic Secret Document verweist auf Transport Sieben',artifacts:['ToxicZ_Secret_Document']},
      {id:'aiconvoyz',label:'AIConvoyZ',required:true,implementationPolicy:'roadmap_active',storyRole:'Blackbox liefert ToxicZ Dokumenten Decoder',artifacts:['Toxicz_Doc_Decoder'],handoff:'Secret Document + Decoder → ToxicZ_Signal_Marker'},
      {id:'toxicz',label:'ToxicZ',required:true,implementationPolicy:'roadmap_active',storyRole:'Rify / Transport Sieben; Morozovs Todesdatum und nach seinem Tod signierte Befehle',artifacts:['ToxicZ_Signal_Marker','Rify-Manifeste','Morozov-Todesdatum','Postmortem-Befehle'],handoff:'Finale Rify-Flare beendet ToxicZ und öffnet die Nach-Rify-Ermittlungsphase; Operation DeutschZ startet hier noch nicht.'},
      {id:'atm-raidz',label:'ATM RaidZ',required:false,optional:true,blocking:false,implementationPolicy:'story_overlay_to_adjust',storyRole:'Optionale Geldspur mit Transaktionsfragmenten; verpasstes Event darf die Hauptstory nicht blockieren',artifacts:['Transaktionsfragmente']},
      {id:'propertyz',label:'PropertyZ',required:true,implementationPolicy:'story_overlay_planned',storyRole:'Persönlicher Ermittlungsort; weiterhin raidbar; nur kleiner geschützter Story-/Archivfortschritt und später Dead Drop',artifacts:['Dead Drop','persönliches Archiv']},
      {id:'courierz',label:'CourierZ',required:true,implementationPolicy:'existing_event_unchanged',storyRole:'Spätere Storyzuordnung: Continuity Ledger belegt weiterverwendete Identitäten einschließlich Morozov; Eventablauf selbst bleibt unverändert',artifacts:['Continuity Ledger']},
      {id:'raven',label:'RAVEN',required:true,implementationPolicy:'existing_event_unchanged_story_overlay_planned',storyRole:'Recovery-Netz BLACK/ECHO, Emergency Beacon und RavenHeat; Eventablauf selbst bleibt unverändert',artifacts:['Emergency Beacon','RavenHeat','RAVEN-Fragmente']},
      {id:'battlegroundz',label:'BattlegroundZ',required:true,implementationPolicy:'existing_event_keep',storyRole:'Eigenständiger roter-Sektor-Event; registriert Convoy-CardReader und liefert Operation-DeutschZ-KeyCard',artifacts:['DeutschZ_BattlegroundZ_RegisteredCardReader','DeutschZ_BattlegroundZ_OperationKeyCard']},
      {id:'operation-deutschz',label:'Operation DeutschZ',required:true,implementationPolicy:'current_finale_expand_story',storyRole:'T-17-Archiv, RAVEN-BLACK-Angriff, Tisy-Relais, Voronin und Endentscheidung',artifacts:['DeutschZ_OperationDeutschZ_MasterCardReader'],finalChoices:['Q-17 vernichten','alles veröffentlichen','Teile sichern']}
    ]
  },
  currentSourceGaps:[
    {id:'atm-currently-blocking',severity:'story-mismatch',message:'WelcomeZ und RadioMissionZ behandeln ATM RaidZ aktuell als Pflichtstufe; Kanon verlangt optional/nicht blockierend.'},
    {id:'property-not-wired',severity:'missing-link',message:'PropertyZ ist im aktuellen WelcomeZ/RadioMissionZ-Storypfad noch nicht eingebunden.'},
    {id:'raven-not-wired',severity:'missing-link',message:'RAVEN ist im aktuellen persönlichen WelcomeZ/RadioMissionZ-Storypfad noch nicht eingebunden.'},
    {id:'battleground-reader-class-collision',severity:'source-error',message:'BattlegroundZ verwendet DZBGZ_CardReader gleichzeitig als stationären Reader und erwartetes Inventaritem; AIConvoyZ besitzt eine separate CardReader-Klasse.'}
  ],
  discarded:['Operation EclipseZ']
});
function publicStoryCanon(){return clone(DEUTSCHZ_STORY_CANON)}

const DEUTSCHZ_SOURCE_AUDIT=Object.freeze({
  generatedFrom:'DeutschZ-ModZ source comparison',
  checkedAt:'2026-10-03',
  snapshots:[
    {id:'current-scheduler',ref:'codex/scheduler-points-rbm-20261003',commit:'cc1fe80579971c5a1319bf1895bd86605af38c29',role:'aktueller geprüfter Event-/Story-Stand'},
    {id:'legacy-september',ref:'archive/legacy-before-modz-rebuild-2026-09-28',commit:'4c442b30e6043a226d6f404e3dd2a4e948309eed',role:'älterer Vollsource-Vergleich'},
    {id:'sync-july',ref:'codex/sync-modz-20260711',commit:'59f3c655c9eeb2622e571370e480d5957c4298c1',role:'älterer Sync-/Migrationsvergleich'}
  ],
  findings:[
    {id:'welcome-story-separation',status:'verified',severity:'info',area:'WelcomeZ',eventId:'story',eventLabel:'Hauptstory',source:'deutschz_welcomez',action:'Beibehalten; Story und Scheduler weiter getrennt modellieren.',title:'Weltrotation und persönliche Story sind bereits getrennt',
      actual:'WelcomeZ zeigt WELTEVENTS (ROTATION) separat vom persönlichen Storyfortschritt und liest Completion-Dateien pro Spieler.',
      expected:'Technische Scheduler-Reihenfolge darf die Q-17/T-17-Hauptstory nicht definieren.',
      modules:['deutschz_welcomez','deutschz_eventschedulerz']},
    {id:'radio-story-director',status:'verified',severity:'info',area:'RadioMissionZ',eventId:'story',eventLabel:'Hauptstory',source:'deutschz_radiomissionz',action:'Bestehenden 89,5-MHz-Director erweitern statt duplizieren.',title:'89,5 MHz ist bereits der persönliche Story-Director',
      actual:'RadioMissionZ kennt KOTH, Transport Sieben, Decoder, Signalaktivierung, ToxicZ, ATM, Courier, Battleground und Operation und persistiert gehörte Kapitel.',
      expected:'Diesen Director erweitern statt eine zweite parallele Storyengine aufzubauen.',
      modules:['deutschz_radiomissionz']},
    {id:'toxicz-existing-core',status:'partial',severity:'medium',area:'ToxicZ',eventId:'toxicz',eventLabel:'ToxicZ',source:'deutschz_toxicz + welcomez + radiomissionz',action:'Bestehenden Kern schrittweise auf die neue 12-Phasen-Roadmap erweitern.',title:'ToxicZ besitzt schon einen 8-stufigen Kern, neue Roadmap geht deutlich weiter',
      actual:'WelcomeZ kennt Signalquelle, Hospital 1, Hospital 2, NBC-Vorbereitung, Riffy-Kampf, Transport-Sieben-Blackbox, Decoderstation und letzte T-17-Übertragung.',
      expected:'Bestehenden Kern erweitern um dynamische Klinik/Feuerwehr-Routen, zufälliges komplettes ABC-Set, ca. 3 Filter, Mehrspieler-Konvergenz, tieferen Rify-Trigger, Stimmen, Horde, Storybereich und finale Flare.',
      modules:['deutschz_welcomez','deutschz_toxicz','deutschz_radiomissionz']},
    {id:'atm-currently-blocking',status:'mismatch',severity:'high',area:'Hauptstory',eventId:'atm-raidz',eventLabel:'ATM RaidZ',source:'deutschz_welcomez + deutschz_radiomissionz',action:'ATM auf optional/nicht blockierend umstellen.',title:'ATM RaidZ ist im Source noch Pflicht, im neuen Kanon optional',
      actual:'WelcomeZ und RadioMissionZ gehen nach ToxicZ zwingend über eine ATM-Completion weiter.',
      expected:'ATM RaidZ darf zusätzliche Transaktionsfragmente liefern, aber ein verpasstes ATM-Event darf den Hauptpfad nicht blockieren.',
      modules:['deutschz_welcomez','deutschz_radiomissionz','deutschz_atmraidez']},
    {id:'property-story-missing',status:'missing',severity:'high',area:'Hauptstory',eventId:'propertyz',eventLabel:'PropertyZ',source:'deutschz_welcomez + deutschz_radiomissionz',action:'PropertyZ als persönlichen Archiv-/Dead-Drop-Knoten einbinden.',title:'PropertyZ fehlt im aktuellen persönlichen Storypfad',
      actual:'PropertyZ wird in WelcomeZ nur als Nebenaktivität genannt und hat keinen Hauptstory-Completion-Knoten.',
      expected:'Nach der Geldspur persönlicher Ermittlungsort mit kleinem geschütztem Archivfortschritt und späterem Dead Drop; Property selbst bleibt raidbar.',
      modules:['deutschz_propertyz','deutschz_welcomez','deutschz_radiomissionz']},
    {id:'raven-story-missing',status:'missing',severity:'high',area:'Hauptstory',eventId:'raven',eventLabel:'RAVEN',source:'deutschz_welcomez + deutschz_radiomissionz',action:'Nur Story-Overlay ergänzen; RAVEN-Event selbst unverändert lassen.',title:'RAVEN fehlt im aktuellen persönlichen Storypfad',
      actual:'RadioMissionZ/WelcomeZ springen von CourierZ direkt zu BattlegroundZ.',
      expected:'RAVEN als Storyknoten mit BLACK/ECHO, Emergency Beacon und RavenHeat zwischen CourierZ und BattlegroundZ ergänzen, ohne das bestehende RAVEN-Event jetzt funktional umzubauen.',
      modules:['deutschz_airdropz','deutschz_welcomez','deutschz_radiomissionz']},
    {id:'battleground-operation-bridge',status:'verified',severity:'info',area:'BattlegroundZ',eventId:'battlegroundz',eventLabel:'BattlegroundZ',source:'deutschz_battlegroundz + deutschz_operation_deutschz',action:'Bridge beibehalten; Finale hinter dem MasterCardReader verfeinern.',title:'BattlegroundZ → Operation DeutschZ ist bereits technisch verbunden',
      actual:'BattlegroundZ erzeugt registrierten CardReader und Operation-KeyCard; Operation DeutschZ kombiniert beide zum MasterCardReader und persistiert Completion.',
      expected:'Diese Bridge beibehalten; MasterCardReader ist Autorisierung, nicht das Storyfinale selbst.',
      modules:['deutschz_battlegroundz','deutschz_operation_deutschz']},
    {id:'battleground-reader-class-collision',status:'error',severity:'critical',area:'CardReader',eventId:'battlegroundz',eventLabel:'BattlegroundZ',source:'deutschz_battlegroundz + deutschz_aiconvoyz',action:'Stationären Reader und transportierbares Convoy-Reader-Item auf getrennte Klassen bringen.',title:'BattlegroundZ verlangt dieselbe Reader-Klasse als Inventaritem und stationären Reader',
      actual:'DZBGZ_CONVOY_READER_CLASSNAME ist DZBGZ_CardReader. DZBGZ_CardReader ist gleichzeitig der stationäre Kartenleser und verbietet CanPutIntoHands/CanPutInCargo. AIConvoyZ besitzt zusätzlich die separate Klasse deutschz_aiconvoyz_cardreader.',
      expected:'Stationären Reader und transportierbaren Convoy-Reader eindeutig trennen und einen einzigen kanonischen Item-Klassennamen für die Übergabe an BattlegroundZ verwenden.',
      modules:['deutschz_battlegroundz','deutschz_aiconvoyz']},
    {id:'cardreader-history-drift',status:'suspect',severity:'medium',area:'CardReader',eventId:'battlegroundz',eventLabel:'BattlegroundZ',source:'Juli- vs. Oktober-Source',action:'Live-PBO und Spawnklassen gegen aktuellen GPSReceiver-Vertrag prüfen.',title:'Reader-Basisklasse hat sich zwischen Source-Ständen stark geändert',
      actual:'Im Juli-Bugfix-Stand erbte DZBGZ_CardReader von HouseNoDestruct; im aktuellen Stand von GPSReceiver. Das erhöht das Risiko alter Aliase/PBO-Reste oder falsch dargestellter Klassen.',
      expected:'Live-PBO/Klassenauflösung und Spawn-/Reward-Klassen gegen den aktuellen GPSReceiver-Vertrag prüfen.',
      modules:['deutschz_battlegroundz']},
    {id:'electronic-repair-kit-visual',status:'error',severity:'critical',area:'ToxicZ',eventId:'toxicz',eventLabel:'ToxicZ',title:'Document Decoder erbt fälschlich vom Elektronikreparaturset',
      actual:'deutschz_toxicz/config.cpp definiert DZToxicZ_DocumentDecoder : ElectronicRepairKit. Dadurch kann der Decoder als Elektronikreparaturset dargestellt werden.',
      expected:'Decoder/CardReader-Darstellung auf den GPSReceiver-Vertrag vereinheitlichen und den echten verwendeten Klassennamen zwischen AIConvoyZ, ToxicZ und Folgeevents konsistent halten.',
      source:'deutschz_toxicz/config.cpp',action:'DZToxicZ_DocumentDecoder auf GPSReceiver-/kanonische Decoder-Basis umstellen und ingame prüfen.',
      modules:['deutschz_toxicz','deutschz_aiconvoyz']},
    {id:'eclipse-retired',status:'verified',severity:'info',area:'Story',eventId:'operation-deutschz',eventLabel:'Operation DeutschZ',source:'aktueller Mod-Source',action:'Eclipse nirgends mehr als aktuellen Alias/Ziel verwenden.',title:'Eclipse ist Legacy und nicht mehr Teil des aktuellen Kanons',
      actual:'Aktueller Source enthält deutschz_operation_deutschz; Eclipse existiert nur in älteren Entwicklungsständen.',
      expected:'WerkZ, WelcomeZ und Storyplanung ausschließlich auf Operation DeutschZ ausrichten.',
      modules:['deutschz_operation_deutschz']}
  ]
});
function publicSourceAudit(){
  const result=clone(DEUTSCHZ_SOURCE_AUDIT);
  result.counts=result.findings.reduce((counts,item)=>{counts[item.status]=(counts[item.status]||0)+1;return counts},{});
  result.openCount=result.findings.filter(item=>['error','mismatch','missing','suspect','partial','gap','needs-test'].includes(item.status)).length;
  result.sourceBranch=result.snapshots[0]?.ref||'';
  result.snapshotCommit=result.snapshots[0]?.commit||'';
  result.summary={
    open:result.openCount,
    critical:result.findings.filter(item=>item.severity==='critical'&&!['verified','fixed'].includes(item.status)).length,
    high:result.findings.filter(item=>item.severity==='high'&&!['verified','fixed'].includes(item.status)).length,
    fixed:result.findings.filter(item=>['verified','fixed'].includes(item.status)).length
  };
  return result;
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
    id:'raven',name:'RAVEN Airdrop',baseline:'RAVEN Airdrop Sollablauf · 03.10.2026',
    criteria:[
      {id:'radio_preannounce',group:'Vorankündigung',label:'Funkdurchsage kommt vor jeder sichtbaren Eventmeldung',expected:'Zuerst ausschließlich Audio/Funkspruch; noch keine normale Notification. Sounddatei real im Source/Assetbestand prüfen.',positive:['funk kommt zuerst','funkspruch zuerst','nur audio','keine notification vor funk'],negative:['notification kommt zuerst','kein funkspruch','funk fehlt','meldung vor funk']},
      {id:'public_zone',group:'Ankündigung',label:'Danach öffentliche Meldung und große rote Suchzone',expected:'„RAVEN Airdrop ist unterwegs.“; großer absichtlicher Suchradius, exakte Position noch unbekannt.',positive:['airdrop ist unterwegs','große rote zone','suchradius groß','position noch ungenau'],negative:['keine rote zone','position sofort exakt','zone zu klein','meldung fehlt']},
      {id:'flight_drop',group:'Flugzeug',label:'Bestehender schneller Flugzeug-/Drop-Ablauf bleibt erhalten',expected:'Flugzeug kommt schnell herein und wirft zügig ab; funktionierenden Pfad nicht unnötig umbauen.',positive:['flugzeug schnell','drop zügig','abwurf funktioniert','airdrop landet'],negative:['flugzeug hängt','abwurf hängt','drop kommt nicht','flugzeug zu langsam']},
      {id:'zombies',group:'Landung',label:'Stärkere Event-Zombies sichern den gelandeten Airdrop',expected:'Anzahl leicht erhöht; HP ungefähr ×3; triviales Überfahren mit Fahrzeugen nach Möglichkeit verhindert/erschwert.',positive:['mehr zombies','dreifache hp','3x hp','zombies halten viel aus','nicht überfahrbar'],negative:['zu wenig zombies','normale hp','zombies sofort tot','einfach überfahren']},
      {id:'hack_trigger',group:'Hack',label:'Beginn der vorhandenen Hackaktion ist der Phasen-Trigger',expected:'Nicht Landung oder Fund, sondern Start des ersten Hacks aktiviert Bergungstrupp und exakten öffentlichen 3D-Marker.',positive:['hack startet phase','beim hack','hackaktion gestartet','bergungstrupp beim hack','3d marker beim hack'],negative:['phase vor hack','ai kommt vor hack','marker exakt vor hack','hack triggert nichts']},
      {id:'hack_result',group:'Hack',label:'Erster vollständiger Hack entscheidet erst am Ende mit 75/25',expected:'Erster kompletter Versuch: 75 % Erfolg / 25 % Fehlschlag. Fehlschlag wird erst nach vollständiger Hackzeit sichtbar; Drop bleibt zu und vollständiger Wiederholungshack ist nötig. Folgeversuch-Würfelregel bleibt bis Source-/Designentscheidung offen.',positive:['75 prozent','25 prozent','hack fehlgeschlagen nach abschluss','komplett neu hacken','wiederholungshack'],negative:['fehlschlag sofort','drop öffnet trotz fehlschlag','kein neuer hack nötig','chance vor hack sichtbar']},
      {id:'recovery_team',group:'RAVEN',label:'Hackbeginn aktiviert bewaffneten RAVEN-Bergungstrupp',expected:'Airdrop zurückholen, Hacker angreifen, Bereich sichern. BLACK/ECHO-Kanon und Source entscheiden Fraktion; Russianz/Americanz nicht raten.',positive:['bergungstrupp kommt','ai kommt beim hack','hacker angegriffen','bereich gesichert'],negative:['keine ai beim hack','bergungstrupp fehlt','falsche fraktion']},
      {id:'exact_marker',group:'PvP',label:'Erst ab Hackbeginn ist die exakte 3D-Position für alle sichtbar',expected:'Vor Hack nur Suchzone; ab Hack exakter öffentlicher 3D-Marker.',positive:['3d marker beim hack','exakte position beim hack','marker wird exakt'],negative:['exakter marker vor hack','kein 3d marker','position bleibt ungenau nach hack']},
      {id:'loot_pool',group:'Loot',label:'RAVEN nutzt KOTH-basierte thematische Eventloot-Pools',expected:'IST-Basis Server_Stand_02.10.2026_20_00_Uhr.zip: SPECIAL + HYBRID + sinnvoller MAP/CE-Füllloot; nominal=0 allein ist kein Eventloot-Schalter. RECON priorisiert TTC-DMR/Sniper, ASSAULT TTC-High-End-Assault/Battle-Rifle, NBC ABC/Medizin/Survival mit normaler TTC-Sekundärwaffe. FOG passend zur Rolle; Anzio extrem seltenes Endgame-Special.',positive:['koth balance','recon loot passt','assault loot passt','nbc loot passt','ttc waffe','fog gear','magazine passen','munition passt'],negative:['nur nominal null','nur vanilla','falsches magazin','unpassende munition','anzio häufig','nbc super sniper']},
      {id:'story_document',group:'Story',label:'Geöffneter Drop enthält das vorgesehene RAVEN-Story-Dokument',expected:'Dokumentfunktion prüfen. Eigene Textur/hiddenSelectionsTextures/Materialpfade verifizieren; fehlt Grafik tatsächlich, Status „Textur noch erstellen“ statt Codefehler.',positive:['story dokument im drop','dokument vorhanden','eigene textur','textur korrekt'],negative:['dokument fehlt','vanilla papier','falsche textur','texturpfad falsch']},
      {id:'finish',group:'Abschluss',label:'Hack öffnet Drop sauber und RAVEN schließt ohne Scheduler-Blockade ab',expected:'Loot + Story-Dokument zugänglich; Cleanup/Release; AIConvoyZ kann später übernehmen.',positive:['hack erfolgreich','drop geöffnet','raven beendet','cleanup release','slot frei','aiconvoy startet'],negative:['drop bleibt zu','raven hängt','slot blockiert','cleanup fehlt','aiconvoy blockiert']}
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
  'battlegroundz':Object.freeze({
    id:'battlegroundz',name:'BattlegroundZ',baseline:'DeutschZ Mod-Source · 03.10.2026',
    criteria:[
      {id:'auth',group:'Autorisierung',label:'Battleground-Papiere und Convoy-CardReader authentifizieren den Einsatz',expected:'Beide Items werden benötigt; daraus entsteht der registrierte BattlegroundZ-CardReader',positive:['papiere erkannt','convoy cardreader erkannt','reader registriert','registrierter cardreader'],negative:['papiere fehlen','cardreader fehlt','authentifizierung geht nicht']},
      {id:'red_sector',group:'Roter Sektor',label:'Signalfolge, Reader und roter Sektor werden sauber freigeschaltet',expected:'Glitch-/Signalschritte führen zum Kartenleser und anschließend zum BattlegroundZ-Marker',positive:['roter sektor','reader marker','ping freigeschaltet','signal wiederholt sich'],negative:['marker fehlt','reader nicht sichtbar','signalfolge hängt']},
      {id:'battle',group:'Kampf',label:'BattlegroundZ startet als eigenständiges Gefecht mit RussianZ und AmericanZ',expected:'Event initialisiert Kampfeinheiten und kann vollständig abgeschlossen werden',positive:['russianz','americanz','battleground startet','kampf läuft'],negative:['keine ai','kampf startet nicht','event hängt']},
      {id:'operation_key',group:'Abschluss',label:'Erfolg gibt die Operation-DeutschZ-KeyCard aus und persistiert die Completion',expected:'Operation-KeyCard nur nach echtem Battleground-Abschluss; persönliche completion/battleground wird geschrieben',positive:['operation keycard bekommen','keycard erhalten','battleground abgeschlossen'],negative:['keycard fehlt','completion fehlt','keycard zu früh']}
    ]
  }),
  'operation-deutschz':Object.freeze({
    id:'operation-deutschz',name:'Operation DeutschZ',baseline:'DeutschZ Mod-Source + Hauptstory · 03.10.2026',
    criteria:[
      {id:'authorization',group:'Autorisierung',label:'Registrierter BattlegroundZ-CardReader + Operation-KeyCard erzeugen den MasterCardReader',expected:'DeutschZ_BattlegroundZ_RegisteredCardReader + DeutschZ_BattlegroundZ_OperationKeyCard → DeutschZ_OperationDeutschZ_MasterCardReader',positive:['mastercardreader erstellt','master cardreader erstellt','operation autorisiert'],negative:['mastercardreader fehlt','reader nicht erkannt','keycard nicht erkannt']},
      {id:'archive',group:'Finale Story',label:'Operation öffnet das T-17-Archiv und führt durch den eigentlichen Storyabschluss',expected:'Archiv/Beweise, RAVEN-BLACK-Gegenwehr, Tisy-Relais und Voronin bilden das geplante Finale; MasterCardReader ist nur Autorisierung',positive:['t-17 archiv','archiv geöffnet','raven black','tisy relais','voronin'],negative:['reader ist schon finale','archiv fehlt','story endet am reader']},
      {id:'decision',group:'Endentscheidung',label:'Das Finale erlaubt mehrere gültige persönliche Entscheidungen',expected:'Q-17 vernichten, alles veröffentlichen oder Teile sichern; keine einzige erzwungene richtige Lösung',positive:['vernichten','veröffentlichen','teile sichern','entscheidung gespeichert'],negative:['nur eine entscheidung','keine auswahl','entscheidung nicht gespeichert']},
      {id:'completion',group:'Persistenz',label:'Operation-Abschluss wird persönlich gespeichert, ohne Serverreset',expected:'persönlicher Storyabschluss und spätere Nachwirkungen; neue Spieler können die Story weiterhin vollständig erleben',positive:['operation abgeschlossen','completion gespeichert','persönlicher fortschritt'],negative:['server reset','completion fehlt','fortschritt verloren']}
    ]
  }),
  'toxicz':Object.freeze({
    id:'toxicz',name:'ToxicZ',baseline:'ToxicZ Event-Roadmap · 03.10.2026',
    criteria:[
      {id:'source_audit',group:'1 · Bestand prüfen',label:'Vorhandene ToxicZ-/Rify-/Story-/Marker-Systeme werden wiederverwendet statt neu erfunden',expected:'ToxicZ-Source, Markerlogik, Plankarten, Storytrigger, Rify-Objekte und vorhandenen ABC-Anzug zuerst identifizieren; belegter Altbestand u. a. GasZonen_Leuchtfackel / DZBBC_GasZoneFlare',positive:['source geprüft','bestand geprüft','storytrigger gefunden','rify objekte gefunden','vorhandene systeme übernommen','gaszonen leuchtfackel gefunden'],negative:['neu gebaut obwohl vorhanden','bestand nicht geprüft','story neu erfunden']},
      {id:'unlock',group:'2 · Freischaltung',label:'Secret-Dokument und Decoder erzeugen den persönlichen ToxicZ-Signalmarker',expected:'ToxicZ_Secret_Document + Toxicz_Doc_Decoder → ToxicZ_Signal_Marker; beide Zutaten werden verbraucht; erst Markeraktivierung startet ToxicZ',positive:['signalmarker erstellt','signalgerät erstellt','beide kombiniert','beide verbraucht','signalmarker aktiviert','toxicz gestartet'],negative:['kombination geht nicht','signalmarker fehlt','startet schon beim besitz','marker aktiviert aber nichts passiert']},
      {id:'dynamic_route',group:'3 · Dynamische Route',label:'Aus der aktuellen Spielerposition werden mindestens zwei passende Zwischenstationen vor Rify gewählt',expected:'Krankenhaus/medizinische Einrichtung/Feuerwache dynamisch auswählen; unterschiedliche Läufe sollen nicht immer dieselben Stationen haben; Ziel bleibt Rify',positive:['zwei stationen','2 stationen','krankenhaus ausgewählt','feuerwache ausgewählt','route ist anders','dynamische route','danach rify'],negative:['nur eine station','immer dieselbe route','direkt nach rify','falsche station']},
      {id:'abc_loot',group:'4 · ABC-Loot',label:'Ein vollständiger spezieller ABC-Schutzanzug plus ungefähr drei Filter wird über die Zwischenstationen verteilt',expected:'Oberteil, Hose, Handschuhe, Schuhe/Stiefel, Kapuze/Kopfschutz, Atemschutzmaske und ca. 3 Filter; Verteilung pro Lauf zufällig und kontrolliert',positive:['abc komplett','anzug komplett','drei filter','3 filter','maske gefunden','jacke gefunden','hose gefunden','loot verteilt','verteilung anders'],negative:['teil fehlt','filter fehlen','nur zwei filter','alles an einer stelle','immer gleiche verteilung']},
      {id:'abc_texture',group:'5 · ABC-Textur',label:'Der DeutschZ-ABC-Anzug nutzt seine richtige eigene Textur statt weiß dargestellt zu werden',expected:'echten Klassenname aus Source übernehmen; hiddenSelectionsTextures/Materials sowie Material-/Texture-Pfade und Backslashes prüfen; keine erfundene Klasse verwenden',positive:['textur passt','deutschland textur','deutschz textur','nicht mehr weiß','pfad korrigiert','hidden selections geprüft'],negative:['anzug ist weiß','weiße textur','textur fehlt','material fehlt','pfad falsch','backslash fehler']},
      {id:'multiplayer',group:'6 · Mehrspieler',label:'Parallele ToxicZ-Instanzen starten getrennt und führen Spieler später verdeckt wieder zusammen',expected:'unterschiedliche erste Ziele pro Spieler; spätere Stationen/benachbarte Ziele Richtung Rify konvergieren; kein Hinweis auf andere Teilnehmer',positive:['unterschiedliche route','spieler getrennt','später zusammengeführt','gleiche spätere station','benachbarte ziele','kein pvp hinweis'],negative:['identische route von anfang an','anderer spieler wird angekündigt','pvp marker angezeigt','keine zusammenführung']},
      {id:'rify_entry',group:'7 · Rify-Trigger',label:'Die Storyphase startet erst deutlich innerhalb der Rify-Zone',expected:'Eintritt erkennen, Fortschritt verfolgen und Trigger tiefer in Rify setzen; nicht direkt am Eingang auslösen',positive:['tief in rify','story startet später','mittlerer bereich','trigger weit drin','nicht am eingang'],negative:['story startet am eingang','horde direkt am eingang','trigger zu früh']},
      {id:'voices',group:'8 · Stimmen',label:'Vorhandene Voice-/Storyführung leitet den Spieler glaubwürdig zu einer gesicherten Stellung',expected:'Stimmen geben Richtungen/Hinweise/Anweisungen und führen tiefer in die Zone; vorhandene Voice-/Story-Dateien bevorzugen',positive:['stimmen starten','voice startet','richtungsangabe','stimmen führen','gesicherte stellung','festung erreicht'],negative:['keine stimmen','falsche richtung','voice fehlt','storyführung bricht ab']},
      {id:'horde',group:'9 · Zombie-Horde',label:'Die Horde entsteht erst nach ausreichendem Fortschritt hinter dem Spieler und schneidet den Rückweg ab',expected:'keine offensichtlichen Spawns vor dem Spieler; Rückweg gefährlich machen und Weitergehen erzwingen',positive:['horde hinter mir','horde hinter spieler','rückweg abgeschnitten','horde startet später','zombies von hinten'],negative:['horde vor mir gespawnt','horde zu früh','keine horde','rückweg frei','spawn direkt sichtbar']},
      {id:'rify_story',group:'10 · Rify-Story',label:'Vorhandene Storyelemente, Dokumente, Funkmeldungen, Objekte und Trigger bilden einen durchgängigen Pfad ohne Sackgasse',expected:'bestehenden Storybereich/Festung/Plankarten wiederverwenden und fehlende Verknüpfungen ergänzen',positive:['story läuft weiter','dokument gefunden','funkmeldung','storytrigger funktioniert','keine sackgasse','festung funktioniert'],negative:['sackgasse','story hängt','trigger fehlt','dokument fehlt','ziel unklar']},
      {id:'final_flare',group:'11 · Finale Flare',label:'Am Bug des Rify-Schiffes muss die vorgesehene Signalflare korrekt aktiviert/entzündet werden',expected:'Bug als finales Ziel; finale Flare-Klasse aus ToxicZ-Source bestätigen. Belegter Altbestand: GasZonen_Leuchtfackel erbt von DZBBC_GasZoneFlare und besitzt DeutschZ-Roadflare-Textur',positive:['flare am bug','leuchtfackel am bug','signalflare gezündet','gaszonen leuchtfackel gezündet','flare aktiviert'],negative:['flare fehlt','falsche flare','flare startet nicht','trigger am falschen ort','nicht am bug']},
      {id:'post_rify_handoff',group:'12 · Nach Rify',label:'Die finale Flare schließt ToxicZ ab und öffnet die nächste Ermittlungsphase – nicht direkt Operation DeutschZ',expected:'ToxicZ-Abschluss persistent speichern; danach Geldspur/Property/Courier/RAVEN/Battleground-Story fortsetzen. Operation DeutschZ bleibt das spätere Finale.',positive:['toxicz abgeschlossen','nächste ermittlung','geldspur freigeschaltet','story geht weiter','nach rify weiter'],negative:['operation deutschz startet sofort','operation startet direkt','abschluss nicht gespeichert','story endet nach toxicz']}
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
  storyCanon(token){this.session(token,'assistant.read');return publicStoryCanon();}
  sourceAudit(token){this.session(token,'assistant.read');return publicSourceAudit();}
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

module.exports={FileAssistantState,FileAssistantDocumentStore,AssistantService,inferCapture,inferDueAt,relevance,safePayload,CAPTURE_HINTS,DEUTSCHZ_TARGETS,DEUTSCHZ_STORY_CANON,DEUTSCHZ_SOURCE_AUDIT,DEUTSCHZ_EVENT_SPECS,evaluateEventTest,inferDeutschzTarget};
