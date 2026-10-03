const modules=[
['werkz.time','Zeit & Einsätze','Arbeitszeit direkt unterwegs erfassen.'],
['werkz.customers','Kunden','Kundendaten zentral verfügbar machen.'],
['werkz.orders','Aufträge','Aufträge mobil anlegen, zuordnen und abschließen.'],
['werkz.materials','Material','Material direkt am Vorgang erfassen.'],
['werkz.documents','Dokumente & Fotos','Fotos, Belege und Nachweise richtig zuordnen.'],
['werkz.billing-prep','Abrechnung vorbereiten','Erledigte Arbeit für die Abrechnung zusammenführen.'],
['werkz.assistant','Mobiler Assistent','Nur zeigen, was gerade Aufmerksamkeit braucht.'],
['werkz.analytics','Analyse','Aufwand, Entwicklung und Kennzahlen sichtbar machen.'],
['werkz.simulation','Simulation','Varianten testen, ohne echte Daten zu verändern.'],
['werkz.management','Chef-Übersicht','Kompakte Sicht auf Betrieb und Team.'],
['werkz.approvals','Freigaben','Kritische Schritte menschlich bestätigen.'],
['werkz.channel.whatsapp','WhatsApp-Freigaben','Freigaben über einen bekannten Kanal erreichbar machen.']];
const deps={'werkz.orders':['werkz.customers']};const optional={'werkz.assistant':['werkz.time','werkz.orders','werkz.documents','werkz.analytics','werkz.simulation'],'werkz.channel.whatsapp':['werkz.approvals']};
const needs={'werkz.time':['Mitarbeiter/Rollen','Arbeitszeit-Regeln'],'werkz.customers':['vorhandene Kundendaten','führendes Kundensystem'],'werkz.orders':['heutiger Auftragsablauf','Auftragsstatus/-nummern'],'werkz.materials':['Materialliste oder heutige Erfassung'],'werkz.documents':['Dokumentarten','Aufbewahrung/Löschung'],'werkz.billing-prep':['heutiger Rechnungsablauf','benötigte Abrechnungsdaten'],'werkz.assistant':['gewünschte Signalquellen'],'werkz.analytics':['gewünschte Kennzahlen','Datenquellen'],'werkz.management':['Rollen und Sichtrechte'],'werkz.approvals':['wer darf was freigeben'],'werkz.channel.whatsapp':['freigegebener Kanal/Telefonnummer','Freigaberegeln']};
const access={'werkz.assistant':['Externe Konten erst bei aktivierter Quelle sicher verbinden'],'werkz.channel.whatsapp':['WhatsApp-/Provider-Zugang erst bei Einrichtung']};
const bundles=[['Mobiler Einsatz',['werkz.time','werkz.customers','werkz.orders','werkz.documents']],['Vom Auftrag zur Abrechnung',['werkz.customers','werkz.orders','werkz.materials','werkz.documents','werkz.billing-prep']],['Chef im Blick',['werkz.assistant','werkz.time','werkz.orders','werkz.documents','werkz.analytics','werkz.management']],['Kontrollierte Freigaben',['werkz.approvals','werkz.channel.whatsapp']]];
let selected=new Set(JSON.parse(localStorage.getItem('wz-advisor')||'[]'));
const $=id=>document.getElementById(id), label=id=>modules.find(x=>x[0]===id)?.[1]||id;
function render(){ $('modules').innerHTML=modules.map(([id,t,d])=>`<label class="card ${selected.has(id)?'on':''}"><input type="checkbox" data-id="${id}" ${selected.has(id)?'checked':''}><strong>${t}</strong><p>${d}</p></label>`).join('');
 const required=new Set();const visit=id=>(deps[id]||[]).forEach(d=>{if(!selected.has(d)){required.add(d);visit(d)}});selected.forEach(visit);
 const all=new Set([...selected,...required]);const opt=new Set();all.forEach(id=>(optional[id]||[]).forEach(x=>{if(!all.has(x))opt.add(x)}));
 $('required').innerHTML=[...required].map(x=>`<div class="pill"><b>Benötigt:</b> ${label(x)}</div>`).join('')+[...opt].map(x=>`<div class="pill"><b>Passt optional:</b> ${label(x)}</div>`).join('')||'<div class="empty">Keine zusätzlichen Bausteine nötig.</div>';
 $('bundles').innerHTML=bundles.map(([n,ids])=>[n,ids.filter(x=>all.has(x)).length,ids.length]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]).map(x=>`<div class="line"><b>${x[0]}</b> · ${x[1]}/${x[2]} Bausteine passen schon</div>`).join('')||'<div class="empty">Wähle oben einen Bedarf aus.</div>';
 const rows=(map)=>[...all].flatMap(id=>(map[id]||[]).map(v=>`<div class="line"><b>${label(id)}:</b> ${v}</div>`)).join('')||'<div class="empty">Aktuell nichts zusätzlich.</div>';
 $('needs').innerHTML=rows(needs);$('access').innerHTML=rows(access);localStorage.setItem('wz-advisor',JSON.stringify([...selected]));
 document.querySelectorAll('input[data-id]').forEach(x=>x.onchange=()=>{x.checked?selected.add(x.dataset.id):selected.delete(x.dataset.id);render()});
}
$('reset').onclick=()=>{selected.clear();render()};render();