const modules=[
['werkz.time','Zeit & Einsätze','Arbeitszeit direkt unterwegs erfassen.','Bereit','PWA, Offline-Queue, persistente Zeitdaten und mobile Bedienung'],
['werkz.customers','Kunden','Kundendaten zentral verfügbar machen.','Planbar','Technischer Modulvertrag vorhanden; Kundendatenmodell wird passend zum Betrieb konkretisiert'],
['werkz.orders','Aufträge','Aufträge mobil anlegen, zuordnen und abschließen.','Planbar','Benötigt Kunden-Baustein; API-/Rechtevertrag ist registriert'],
['werkz.materials','Material','Material direkt am Vorgang erfassen.','Planbar','Modul-/Rechtegrenze vorhanden; konkrete Materiallogik wird je Betrieb festgelegt'],
['werkz.documents','Dokumente & Fotos','Fotos, Belege und Nachweise richtig zuordnen.','Basis da','Private Dateiablage ist in Zeit/Assistent vorhanden; generische Dokumentlogik wird ausgebaut'],
['werkz.billing-prep','Abrechnung vorbereiten','Erledigte Arbeit für die Abrechnung zusammenführen.','Planbar','Abrechnungs-Vorbereitung als Modulgrenze; kein ungeprüfter Rechnungsversand'],
['werkz.assistant','Mobiler Assistent','Nur zeigen, was gerade Aufmerksamkeit braucht.','Bereit','Assistant-Service, API, PWA, Offline-Erfassung, Dokumente und Event-Test'],
['werkz.analytics','Analyse','Aufwand, Entwicklung und Kennzahlen sichtbar machen.','Basis da','Analyse-Recht und Assistenten-Snapshots vorhanden; Kennzahlen werden je Zweck ergänzt'],
['werkz.simulation','Simulation','Varianten testen, ohne echte Daten zu verändern.','Basis da','Simulation bleibt technisch von Produktionsänderungen getrennt'],
['werkz.management','Chef-Übersicht','Kompakte Sicht auf Betrieb und Team.','Basis da','Management-Projektion und Rollen-/Rechtebasis vorhanden'],
['werkz.approvals','Freigaben','Kritische Schritte menschlich bestätigen.','Basis da','Expliziter Approval-Kanal; kritische Aktionen bleiben prüfpflichtig'],
['werkz.channel.whatsapp','WhatsApp-Freigaben','Freigaben über einen bekannten Kanal erreichbar machen.','Planbar','Benötigt Freigaben plus später sicheren Provider-Zugang; keine Zugangsdaten im Browser/Repo']];
const deps={'werkz.orders':['werkz.customers']};const optional={'werkz.assistant':['werkz.time','werkz.orders','werkz.documents','werkz.analytics','werkz.simulation'],'werkz.channel.whatsapp':['werkz.approvals']};
const needs={'werkz.time':['Mitarbeiter/Rollen','Arbeitszeit-Regeln'],'werkz.customers':['vorhandene Kundendaten','führendes Kundensystem'],'werkz.orders':['heutiger Auftragsablauf','Auftragsstatus/-nummern'],'werkz.materials':['Materialliste oder heutige Erfassung'],'werkz.documents':['Dokumentarten','Aufbewahrung/Löschung'],'werkz.billing-prep':['heutiger Rechnungsablauf','benötigte Abrechnungsdaten'],'werkz.assistant':['gewünschte Signalquellen'],'werkz.analytics':['gewünschte Kennzahlen','Datenquellen'],'werkz.management':['Rollen und Sichtrechte'],'werkz.approvals':['wer darf was freigeben'],'werkz.channel.whatsapp':['freigegebener Kanal/Telefonnummer','Freigaberegeln']};
const access={'werkz.assistant':['Externe Konten erst bei aktivierter Quelle sicher verbinden'],'werkz.channel.whatsapp':['WhatsApp-/Provider-Zugang erst bei Einrichtung']};
const bundles=[['Mobiler Einsatz',['werkz.time','werkz.customers','werkz.orders','werkz.documents']],['Vom Auftrag zur Abrechnung',['werkz.customers','werkz.orders','werkz.materials','werkz.documents','werkz.billing-prep']],['Chef im Blick',['werkz.assistant','werkz.time','werkz.orders','werkz.documents','werkz.analytics','werkz.management']],['Kontrollierte Freigaben',['werkz.approvals','werkz.channel.whatsapp']]];
let selected=new Set(JSON.parse(localStorage.getItem('wz-advisor')||'[]'));

const scopeRows=[['solo','WerkZ Solo','ab 490 €','Managed ab 79 €/Monat'],['team','WerkZ Team','ab 1.490 €','Managed ab 179 €/Monat'],['business','WerkZ Business','ab 2.490 €','Managed ab 349 €/Monat'],['enterprise','Enterprise','Angebot','Angebot / SLA']];
const deployRows=[['managed_cloud','Managed Cloud','Shared Hosting im Managed-Rahmen'],['dedicated_cloud','Dedicated Cloud','isolierte Instanz · Setup ab 490 € · Infrastruktur ab 99 €/Monat'],['hybrid_connector','Hybrid + Connector','lokale Systeme anbinden · Setup ab 690 € · Monitoring ab 49 €/Monat'],['existing_hardware','Vorhandene Hardware','zuerst Server/NAS/Mini-PC/Mac auf Eignung prüfen'],['werkz_box','WerkZ Box','Provisioning ab 990 € plus Hardware · Management ab 99 €/Monat'],['on_prem','Dedicated / On-Premise','Setup ab 2.490 € · Wartung ab 249 €/Monat']];
const intakeRows=[['company','Betrieb','Was macht der Betrieb und wer arbeitet im betroffenen Ablauf?'],['workflow','Heutiger Ablauf','Wie läuft es heute Schritt für Schritt?'],['friction','Zeit & Fehler','Wo entstehen Aufwand, Wartezeit, Doppelerfassung oder Fehler?'],['systems','Systeme','Welche Software, Geräte, Server/NAS/Cloud und Dienstleister gibt es?'],['authority','Datenhoheit','Welches System ist für Kunden, Aufträge, Zeiten, Dokumente und Abrechnung führend?'],['access','Rollen & Rechte','Wer darf was sehen, ändern oder freigeben?'],['success','Erfolg','Woran merken wir später, dass sich der Ablauf verbessert hat?']];
let advisorState=JSON.parse(localStorage.getItem('wz-advisor-state')||'{}');advisorState.answers=advisorState.answers||{};
function autoScope(){return selected.size<=2?'solo':selected.size<=6?'team':'business'}
function renderPrecheck(){
 if(!advisorState.scopeId)advisorState.scopeId=autoScope();if(!advisorState.deploymentId)advisorState.deploymentId='managed_cloud';
 $('intake').innerHTML=intakeRows.map(([id,t,q])=>`<label class="question"><b>${t}</b><span>${q}</span><textarea data-answer="${id}" placeholder="Kurz notieren …">${advisorState.answers[id]||''}</textarea></label>`).join('');
 $('scopes').innerHTML=scopeRows.map(([id,t,a,m])=>`<button class="selectcard ${advisorState.scopeId===id?'on':''}" data-scope="${id}"><b>${t}</b><span>${a}</span><small>${m}</small></button>`).join('');
 $('deployments').innerHTML=deployRows.map(([id,t,d])=>`<button class="selectcard ${advisorState.deploymentId===id?'on':''}" data-deploy="${id}"><b>${t}</b><span>${d}</span></button>`).join('');
 document.querySelectorAll('[data-answer]').forEach(x=>x.oninput=()=>{advisorState.answers[x.dataset.answer]=x.value;saveAdvisor()});
 document.querySelectorAll('[data-scope]').forEach(x=>x.onclick=()=>{advisorState.scopeId=x.dataset.scope;saveAdvisor();renderPrecheck()});
 document.querySelectorAll('[data-deploy]').forEach(x=>x.onclick=()=>{advisorState.deploymentId=x.dataset.deploy;saveAdvisor();renderPrecheck()});
}
function saveAdvisor(){localStorage.setItem('wz-advisor-state',JSON.stringify(advisorState))}
function renderCommercial(){
 const s=scopeRows.find(x=>x[0]===advisorState.scopeId)||scopeRows[0],d=deployRows.find(x=>x[0]===advisorState.deploymentId)||deployRows[0];
 let el=document.getElementById('commercial');if(el)el.innerHTML=`<div class="commercial"><small>PREISRAHMEN · NICHT VERBINDLICHES ANGEBOT</small><h2>${s[1]}</h2><p><b>${s[2]}</b> Einrichtung · ${s[3]}</p><p><b>${d[1]}</b> — ${d[2]}</p><p>Integrationen, Migration, Hardware, Sonderentwicklung, Providerverbrauch und besonderer Support werden nach Discovery separat eingegrenzt.</p></div>`;
 let a=document.getElementById('answerSummary');if(a)a.innerHTML=intakeRows.filter(([id])=>(advisorState.answers[id]||'').trim()).map(([id,t])=>`<div class="line"><b>${t}:</b> ${advisorState.answers[id].replace(/[<>]/g,'')}</div>`).join('')||'<div class="empty">Noch keine Gesprächsnotizen.</div>';
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-page]').forEach(p=>p.hidden=p.dataset.page!==b.dataset.view);document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));renderPrecheck();renderCommercial();window.scrollTo({top:0,behavior:'smooth'})});

const $=id=>document.getElementById(id), label=id=>modules.find(x=>x[0]===id)?.[1]||id;
function render(){ $('modules').innerHTML=modules.map(([id,t,d,s,tech])=>`<article class="card ${selected.has(id)?'on':''}"><label><input type="checkbox" data-id="${id}" ${selected.has(id)?'checked':''}><strong>${t}</strong><span class="status">${s}</span><p>${d}</p></label><details><summary>Mehr & Technik</summary><p>${tech}</p><small>Baustein: ${id}</small></details></article>`).join('');
 const required=new Set();const visit=id=>(deps[id]||[]).forEach(d=>{if(!selected.has(d)){required.add(d);visit(d)}});selected.forEach(visit);
 const all=new Set([...selected,...required]);const opt=new Set();all.forEach(id=>(optional[id]||[]).forEach(x=>{if(!all.has(x))opt.add(x)}));
 $('required').innerHTML=[...required].map(x=>`<div class="pill"><b>Benötigt:</b> ${label(x)}</div>`).join('')+[...opt].map(x=>`<div class="pill"><b>Passt optional:</b> ${label(x)}</div>`).join('')||'<div class="empty">Keine zusätzlichen Bausteine nötig.</div>';
 $('bundles').innerHTML=bundles.map(([n,ids])=>[n,ids.filter(x=>all.has(x)).length,ids.length]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]).map(x=>`<div class="line"><b>${x[0]}</b> · ${x[1]}/${x[2]} Bausteine passen schon</div>`).join('')||'<div class="empty">Wähle oben einen Bedarf aus.</div>';
 const rows=(map)=>[...all].flatMap(id=>(map[id]||[]).map(v=>`<div class="line"><b>${label(id)}:</b> ${v}</div>`)).join('')||'<div class="empty">Aktuell nichts zusätzlich.</div>';
 $('needs').innerHTML=rows(needs);$('access').innerHTML=rows(access);localStorage.setItem('wz-advisor',JSON.stringify([...selected]));
 document.querySelectorAll('input[data-id]').forEach(x=>x.onchange=()=>{x.checked?selected.add(x.dataset.id):selected.delete(x.dataset.id);render()});
}
$('reset').onclick=()=>{selected.clear();advisorState={answers:{}};localStorage.removeItem('wz-advisor-state');render();renderPrecheck();renderCommercial()};render();renderPrecheck();renderCommercial();