'use strict';

const ADVISOR_MODULES=Object.freeze({
 'werkz.time':{stage:'ready',technical:'PWA + TimeApplication + durable repository/offline queue',title:'Zeit & Einsätze',question:'Soll Arbeitszeit direkt unterwegs erfasst werden?',benefit:'Start, Stopp, Einsatzdaten und Verlauf direkt mobil.',needs:['Mitarbeiter/Rollen','Arbeitszeit-Regeln'],access:[]},
 'werkz.customers':{stage:'planned',technical:'Module contract/API entitlement present; customer domain UI follows scoped project',title:'Kunden',question:'Sollen Kundendaten zentral verfügbar sein?',benefit:'Kundeninformationen stehen den passenden Abläufen zur Verfügung.',needs:['vorhandene Kundendaten','führendes Kundensystem'],access:[]},
 'werkz.orders':{stage:'planned',technical:'Module contract with hard customer dependency; order domain UI follows scoped project',title:'Aufträge',question:'Sollen Aufträge mobil angelegt, zugeordnet und abgeschlossen werden?',benefit:'Kunde, Auftrag und Einsatz bleiben verbunden.',needs:['heutiger Auftragsablauf','Auftragsnummern/Status'],access:[]},
 'werkz.materials':{stage:'planned',technical:'Module entitlement/API boundary registered',title:'Material',question:'Soll Material unterwegs erfasst oder einem Auftrag zugeordnet werden?',benefit:'Materialverbrauch wird direkt am Vorgang festgehalten.',needs:['Materialliste oder heutige Erfassungsart'],access:[]},
 'werkz.documents':{stage:'foundation',technical:'Private evidence storage exists in Time/Assistant; generic documents API is a module boundary',title:'Dokumente & Fotos',question:'Sollen Fotos, Belege oder Dokumente direkt zum Vorgang?',benefit:'Nachweise landen am richtigen Kunden/Auftrag statt lose auf dem Handy.',needs:['Dokumentarten','Aufbewahrungs-/Löschregeln'],access:[]},
 'werkz.billing-prep':{stage:'planned',technical:'Entitlement/API boundary; no automatic invoice sending',title:'Abrechnung vorbereiten',question:'Sollen erledigte Arbeiten für die Abrechnung vorbereitet werden?',benefit:'Zeiten, Material und Nachweise können für die Abrechnung zusammengeführt werden.',needs:['heutiger Rechnungsablauf','benötigte Abrechnungsdaten'],access:[]},
 'werkz.assistant':{stage:'ready',technical:'AssistantService + HTTP + offline-capable PWA test runtime',title:'Mobiler Assistent',question:'Soll WerkZ Wichtiges sammeln und nur zeigen, was gerade Aufmerksamkeit braucht?',benefit:'Aufgaben, Belege, Termine und Signale werden an einer Stelle priorisiert.',needs:['gewünschte Signalquellen'],access:['Zugänge erst bei aktivierter externer Quelle sicher verbinden']},
 'werkz.analytics':{stage:'foundation',technical:'Analytics entitlement and assistant market snapshots available',title:'Analyse',question:'Soll WerkZ Entwicklungen, Aufwand oder Kennzahlen sichtbar machen?',benefit:'Verläufe und Auffälligkeiten werden aus vorhandenen Daten verständlich.',needs:['gewünschte Kennzahlen','Datenquellen'],access:[]},
 'werkz.simulation':{stage:'foundation',technical:'Simulation capability separated from production mutations',title:'Simulation',question:'Sollen Varianten durchgespielt werden, ohne echte Daten/Aktionen zu verändern?',benefit:'Was-wäre-wenn bleibt strikt von Produktion getrennt.',needs:['Szenario und Annahmen'],access:[]},
 'werkz.management':{stage:'foundation',technical:'Management projection/capability boundary available',title:'Chef-Übersicht',question:'Braucht der Chef eine kompakte Team-/Betriebsübersicht?',benefit:'Relevante Betriebsinformationen ohne unnötige Detailflut.',needs:['Rollen und Sichtrechte'],access:[]},
 'werkz.approvals':{stage:'foundation',technical:'ApprovalChannel contract with explicit human decision boundary',title:'Freigaben',question:'Müssen bestimmte Aktionen erst von einem Menschen bestätigt werden?',benefit:'Kritische Schritte laufen kontrolliert statt automatisch.',needs:['wer darf was freigeben'],access:[]},
 'werkz.channel.whatsapp':{stage:'planned',technical:'Requires approvals; provider integration/credentials only during customer setup',title:'WhatsApp-Freigaben',question:'Sollen Freigabeanfragen später über WhatsApp erreichbar sein?',benefit:'Freigaben können einen bekannten Kanal nutzen.',needs:['freigegebene Telefonnummer/Kanal','Freigaberegeln'],access:['WhatsApp-/Provider-Zugang erst bei Einrichtung']}
});

const BUNDLES=Object.freeze([
 {id:'mobile-job',title:'Mobiler Einsatz',modules:['werkz.time','werkz.customers','werkz.orders','werkz.documents'],why:'Zeit, Kunde, Auftrag und Fotos/Nachweise greifen direkt ineinander.'},
 {id:'job-to-billing',title:'Vom Auftrag zur Abrechnung',modules:['werkz.customers','werkz.orders','werkz.materials','werkz.documents','werkz.billing-prep'],why:'Auftragsdaten, Material und Nachweise werden ohne Medienbruch vorbereitet.'},
 {id:'boss',title:'Chef im Blick',modules:['werkz.assistant','werkz.time','werkz.orders','werkz.documents','werkz.analytics','werkz.management'],why:'Der Assistent bündelt vorhandene Betriebsdaten und zeigt Relevantes.'},
 {id:'controlled',title:'Kontrollierte Freigaben',modules:['werkz.approvals','werkz.channel.whatsapp'],why:'Kritische Aktionen bleiben menschlich bestätigt.'}
]);

function advise(registry,selected=[]){
 const chosen=new Set(selected), required=new Set(), optional=new Set();
 const visit=id=>{const m=registry.get(id);for(const d of m.hardDependencies||[]){if(!chosen.has(d)){required.add(d);visit(d)}}};
 for(const id of chosen)visit(id);
 for(const id of chosen){const m=registry.get(id);for(const d of m.optionalIntegrations||[])if(!chosen.has(d)&&!required.has(d))optional.add(d)}
 const all=new Set([...chosen,...required]);
 const needs=[],access=[];
 for(const id of all){const meta=ADVISOR_MODULES[id];if(!meta)continue;for(const x of meta.needs||[])needs.push({moduleId:id,text:x});for(const x of meta.access||[])access.push({moduleId:id,text:x})}
 const bundles=BUNDLES.map(b=>({...b,selected:b.modules.filter(x=>all.has(x)).length,total:b.modules.length})).filter(b=>b.selected>0).sort((a,b)=>b.selected-a.selected);
 return {selected:[...chosen],required:[...required],optional:[...optional],needs,access,bundles};
}

const SCOPE_PRESETS=Object.freeze([
 {id:'solo',title:'WerkZ Solo',setupFromCents:49000,typicalRangeCents:[79000,149000],managedFromCents:7900,fit:'Scharf abgegrenzter Ablauf, meist Einzelperson/kleiner Umfang.'},
 {id:'team',title:'WerkZ Team',setupFromCents:149000,typicalRangeCents:[199000,399000],managedFromCents:17900,fit:'Mehrere Rollen/Mitarbeiter und verbundene Arbeitsabläufe.'},
 {id:'business',title:'WerkZ Business',setupFromCents:249000,typicalRangeCents:[349000,750000],managedFromCents:34900,fit:'Mehrere Abläufe, Integrationen oder höhere Betriebsanforderungen.'},
 {id:'enterprise',title:'Enterprise',setupFromCents:null,typicalRangeCents:null,managedFromCents:null,fit:'Individuelles Angebot/SLA.'}
]);
const DEPLOYMENTS=Object.freeze([
 {id:'managed_cloud',title:'Managed Cloud',setupFromCents:0,opsFromCents:0,note:'Für viele Solo/Team-Szenarien; Shared Hosting im vereinbarten Managed-Rahmen enthalten.',asks:['Sind lokale Systeme zwingend anzubinden?']},
 {id:'dedicated_cloud',title:'Dedicated Cloud',setupFromCents:49000,opsFromCents:9900,note:'Isolierte Kundeninstanz; Providerkosten zusätzlich.',asks:['Ist eine isolierte Instanz erforderlich?']},
 {id:'hybrid_connector',title:'Hybrid + Connector',setupFromCents:69000,opsFromCents:4900,note:'Hosted WerkZ plus outbound-only Connector zu freigegebenen lokalen Systemen.',asks:['Welche lokalen Systeme/APIs müssen verbunden werden?','Wer verwaltet Netzwerk und Freigaben?']},
 {id:'existing_hardware',title:'Vorhandene Hardware',setupFromCents:null,opsFromCents:null,note:'Geeigneten Server/NAS/Mini-PC/Mac zuerst prüfen und möglichst weiterverwenden.',asks:['OS/Patchstand','CPU/RAM/Speicher','Verschlüsselung','Backup/Restore','24/7-Eignung/USV','Remote-Administration']},
 {id:'werkz_box',title:'WerkZ Box',setupFromCents:99000,opsFromCents:9900,note:'Vorbereitetes lokales Gerät; Hardware separat zum aktuellen Preis.',asks:['Ist vorhandene Hardware ungeeignet?','Wer übernimmt Standort/Strom/Netz?']},
 {id:'on_prem',title:'Dedicated / On-Premise',setupFromCents:249000,opsFromCents:24900,note:'Kundeneigene Server-/Virtualisierungsumgebung; höherer Betriebsaufwand.',asks:['Technischer Betreiber','Backup/Restore','Patchen','Monitoring','Netzwerk/Identity']}
]);
const INTAKE=Object.freeze([
 {id:'company',title:'Betrieb',prompt:'Was macht der Betrieb und wer arbeitet im betroffenen Ablauf?'},
 {id:'workflow',title:'Heutiger Ablauf',prompt:'Wie läuft es heute Schritt für Schritt?'},
 {id:'friction',title:'Zeit & Fehler',prompt:'Wo entstehen Aufwand, Wartezeit, Doppelerfassung oder Fehler?'},
 {id:'systems',title:'Systeme',prompt:'Welche Software, Geräte, Server/NAS/Cloud und Dienstleister gibt es bereits?'},
 {id:'authority',title:'Datenhoheit',prompt:'Welches System ist für Kunden, Aufträge, Zeiten, Dokumente und Abrechnung führend?'},
 {id:'access',title:'Rollen & Rechte',prompt:'Wer darf was sehen, ändern oder freigeben?'},
 {id:'success',title:'Erfolg',prompt:'Woran merken wir später messbar, dass sich der Ablauf verbessert hat?'}
]);
function recommendScope(selected=[]){
 const n=new Set(selected).size;
 if(n<=2)return 'solo';
 if(n<=6)return 'team';
 return 'business';
}
function precheck(registry,selected=[],answers={}){
 const base=advise(registry,selected),scopeId=answers.scopeId||recommendScope(selected);
 const scope=SCOPE_PRESETS.find(x=>x.id===scopeId);
 const deployment=DEPLOYMENTS.find(x=>x.id===(answers.deploymentId||'managed_cloud'));
 return {...base,scope,deployment,intake:INTAKE};
}
module.exports={ADVISOR_MODULES,BUNDLES,SCOPE_PRESETS,DEPLOYMENTS,INTAKE,advise,recommendScope,precheck};
