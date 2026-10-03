'use strict';

const ADVISOR_MODULES=Object.freeze({
 'werkz.time':{title:'Zeit & Einsätze',question:'Soll Arbeitszeit direkt unterwegs erfasst werden?',benefit:'Start, Stopp, Einsatzdaten und Verlauf direkt mobil.',needs:['Mitarbeiter/Rollen','Arbeitszeit-Regeln'],access:[]},
 'werkz.customers':{title:'Kunden',question:'Sollen Kundendaten zentral verfügbar sein?',benefit:'Kundeninformationen stehen den passenden Abläufen zur Verfügung.',needs:['vorhandene Kundendaten','führendes Kundensystem'],access:[]},
 'werkz.orders':{title:'Aufträge',question:'Sollen Aufträge mobil angelegt, zugeordnet und abgeschlossen werden?',benefit:'Kunde, Auftrag und Einsatz bleiben verbunden.',needs:['heutiger Auftragsablauf','Auftragsnummern/Status'],access:[]},
 'werkz.materials':{title:'Material',question:'Soll Material unterwegs erfasst oder einem Auftrag zugeordnet werden?',benefit:'Materialverbrauch wird direkt am Vorgang festgehalten.',needs:['Materialliste oder heutige Erfassungsart'],access:[]},
 'werkz.documents':{title:'Dokumente & Fotos',question:'Sollen Fotos, Belege oder Dokumente direkt zum Vorgang?',benefit:'Nachweise landen am richtigen Kunden/Auftrag statt lose auf dem Handy.',needs:['Dokumentarten','Aufbewahrungs-/Löschregeln'],access:[]},
 'werkz.billing-prep':{title:'Abrechnung vorbereiten',question:'Sollen erledigte Arbeiten für die Abrechnung vorbereitet werden?',benefit:'Zeiten, Material und Nachweise können für die Abrechnung zusammengeführt werden.',needs:['heutiger Rechnungsablauf','benötigte Abrechnungsdaten'],access:[]},
 'werkz.assistant':{title:'Mobiler Assistent',question:'Soll WerkZ Wichtiges sammeln und nur zeigen, was gerade Aufmerksamkeit braucht?',benefit:'Aufgaben, Belege, Termine und Signale werden an einer Stelle priorisiert.',needs:['gewünschte Signalquellen'],access:['Zugänge erst bei aktivierter externer Quelle sicher verbinden']},
 'werkz.analytics':{title:'Analyse',question:'Soll WerkZ Entwicklungen, Aufwand oder Kennzahlen sichtbar machen?',benefit:'Verläufe und Auffälligkeiten werden aus vorhandenen Daten verständlich.',needs:['gewünschte Kennzahlen','Datenquellen'],access:[]},
 'werkz.simulation':{title:'Simulation',question:'Sollen Varianten durchgespielt werden, ohne echte Daten/Aktionen zu verändern?',benefit:'Was-wäre-wenn bleibt strikt von Produktion getrennt.',needs:['Szenario und Annahmen'],access:[]},
 'werkz.management':{title:'Chef-Übersicht',question:'Braucht der Chef eine kompakte Team-/Betriebsübersicht?',benefit:'Relevante Betriebsinformationen ohne unnötige Detailflut.',needs:['Rollen und Sichtrechte'],access:[]},
 'werkz.approvals':{title:'Freigaben',question:'Müssen bestimmte Aktionen erst von einem Menschen bestätigt werden?',benefit:'Kritische Schritte laufen kontrolliert statt automatisch.',needs:['wer darf was freigeben'],access:[]},
 'werkz.channel.whatsapp':{title:'WhatsApp-Freigaben',question:'Sollen Freigabeanfragen später über WhatsApp erreichbar sein?',benefit:'Freigaben können einen bekannten Kanal nutzen.',needs:['freigegebene Telefonnummer/Kanal','Freigaberegeln'],access:['WhatsApp-/Provider-Zugang erst bei Einrichtung']}
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
module.exports={ADVISOR_MODULES,BUNDLES,advise};
