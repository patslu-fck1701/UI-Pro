const state={orders:[],activities:[],assets:[],tasks:[],documents:[],systems:[],maintenance:null,automationRan:false};
const $=selector=>document.querySelector(selector);
const escapeHtml=value=>String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
async function fetchJson(path){const response=await fetch(path);if(!response.ok)throw new Error(`HTTP ${response.status}: ${path}`);return response.json()}
async function loadDemo(){const [config,seed]=await Promise.all([fetchJson('data/config.json'),fetchJson('data/seed.json')]);Object.assign(state,structuredClone(seed),{automationRan:false,timeAppUrl:config.time_app_url||'http://127.0.0.1:8080/test-profiles?return=/',timeProfileUrl:config.time_profile_url||'http://127.0.0.1:8080/test-profiles?return=/hub/',timeApiBase:config.time_api_base||'http://127.0.0.1:8080/api',timeRecords:[],timeSession:null});document.documentElement.style.setProperty('--primary',config.primary_color);document.documentElement.style.setProperty('--accent',config.secondary_color);$('#brand-name').textContent=config.company_name;$('#demo-label').textContent=config.demo_label;const timeOpen=$('#time-open');if(timeOpen)timeOpen.href=state.timeAppUrl;const timeProfileOpen=$('#time-profile-open');if(timeProfileOpen)timeProfileOpen.href=state.timeProfileUrl;renderAll();await loadTimeOverview();clearInterval(state.timeRefreshTimer);state.timeRefreshTimer=setInterval(loadTimeOverview,15000)}
function renderAll(){renderNavigation();renderMetrics();fillFilters();renderOrders();renderActivities();renderAssets();renderTasks();renderDocuments();renderReporting();renderAutomation();renderSystems()}
function renderNavigation(){const items=[['Dashboard','content'],['WerkZ Zeit','time-section'],['Aufträge','orders-section'],['Anlagen','assets-section'],['Wartung','automation-section'],['Aufgaben','tasks-section'],['Dokumente','documents-section'],['Reporting','reporting-section'],['Automation','automation-section'],['Systemstatus','status-section']];$('#navigation').innerHTML=items.map(([item,target],i)=>`<button type="button" data-target="${target}" ${i===0?'aria-current="page"':''}>${escapeHtml(item)}</button>`).join('')}
function renderMetrics(){const open=state.orders.filter(o=>o.status!=='Abgeschlossen').length;const high=state.orders.filter(o=>o.priority==='Hoch').length;const metrics=[['Offene Aufgaben',open],['Aktive Aufträge',state.orders.length],['Wartungen fällig',state.maintenance.overdue_days,'warning'],['Systemstatus','Gesund']];$('#metrics').innerHTML=metrics.map(([label,value,css])=>`<article class="metric ${css||''}"><span>${label}</span><strong>${value}</strong><small>${label==='Wartungen fällig'?high+' Vorgänge mit hoher Priorität':'Synthetischer Demo-Stand'}</small></article>`).join('')}
function fillFilters(){for(const [id,key] of [['#status-filter','status'],['#priority-filter','priority']]){const select=$(id);if(select.options.length>1)continue;[...new Set(state.orders.map(o=>o[key]))].sort().forEach(value=>select.add(new Option(value,value)))}}
function filteredOrders(){const query=$('#search').value.trim().toLowerCase(),status=$('#status-filter').value,priority=$('#priority-filter').value;return state.orders.filter(o=>(!query||Object.values(o).some(v=>String(v).toLowerCase().includes(query)))&&(!status||o.status===status)&&(!priority||o.priority===priority))}
function priorityClass(priority){return {Hoch:'high',Mittel:'medium',Niedrig:'low'}[priority]||'medium'}
function renderOrders(){const orders=filteredOrders();$('#orders').innerHTML=orders.map(o=>`<tr><td>${escapeHtml(o.id)}</td><td>${escapeHtml(o.title)}</td><td>${escapeHtml(o.asset)}</td><td><span class="status">${escapeHtml(o.status)}</span></td><td class="priority-${priorityClass(o.priority)}">${escapeHtml(o.priority)}</td><td>${escapeHtml(o.due)}</td></tr>`).join('');$('#empty-state').hidden=orders.length>0}
function renderActivities(){$('#activities').innerHTML=state.activities.map(a=>`<li>${escapeHtml(a.text)}<time>${escapeHtml(a.time)}</time></li>`).join('')}
function renderAssets(){$('#assets').innerHTML=state.assets.map(a=>`<div class="data-card"><strong>${escapeHtml(a.name)}</strong><span>${escapeHtml(a.serial)} · ${escapeHtml(a.location)}</span><small>${escapeHtml(a.status)} · Service: ${escapeHtml(a.next_service)}</small></div>`).join('')}
function renderTasks(){$('#tasks').innerHTML=state.tasks.map(t=>`<div class="data-card"><strong>${escapeHtml(t.title)}</strong><span>${escapeHtml(t.owner)}</span><small class="priority-${priorityClass(t.priority)}">${escapeHtml(t.priority)} · ${escapeHtml(t.due)}</small></div>`).join('')}
function renderDocuments(){$('#documents').innerHTML=state.documents.map(d=>`<div class="data-card"><strong>${escapeHtml(d.name)}</strong><span>${escapeHtml(d.kind)}</span><small>Aktualisiert: ${escapeHtml(d.updated)}</small></div>`).join('')}
function renderReporting(){const done=state.orders.filter(o=>o.status==='Abgeschlossen').length;const inProgress=state.orders.filter(o=>o.status==='In Arbeit').length;const values=[['Abgeschlossen',done],['In Arbeit',inProgress],['Offen',state.orders.length-done-inProgress]];$('#reporting').innerHTML=values.map(([label,value])=>`<div><span>${escapeHtml(label)}</span><progress value="${value}" max="${state.orders.length}">${value}</progress><strong>${value}</strong></div>`).join('')}
function renderAutomation(){const m=state.maintenance;const steps=[[m.asset,`${m.description} · ${m.overdue_days} Tage überfällig`],['Regel ausgelöst','overdue-maintenance'],['Aufgabe erstellt',state.automationRan?'TASK-DEMO-001':'wartet auf Ausführung'],['Zugewiesen','Team Wartung'],['Fällig','heute 17:00']];$('#automation-flow').innerHTML=steps.map((s,i)=>`<div class="flow-step ${state.automationRan||i===0?'active':''}"><strong>${escapeHtml(s[0])}</strong><span>${escapeHtml(s[1])}</span></div>`).join('')}
function renderSystems(){$('#systems').innerHTML=state.systems.map(s=>`<li>${escapeHtml(s)} normal</li>`).join('')}
function runAutomation(){if(state.automationRan)return;state.automationRan=true;state.activities.unshift({text:`Aufgabe TASK-DEMO-001 für ${state.maintenance.asset} erstellt`,time:'Gerade eben'});renderActivities();renderAutomation();renderMetrics()}
function csvCell(value){let text=String(value);if(/^[=+@-]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`}
function exportCsv(){const rows=[['Auftrag','Titel','Anlage','Status','Priorität','Fällig'],...filteredOrders().map(o=>[o.id,o.title,o.asset,o.status,o.priority,o.due])];const csv=rows.map(row=>row.map(csvCell).join(';')).join('\n');const link=document.createElement('a');link.href=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}));link.download='werkz-demo-auftraege.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0)}

let timeClockTimer=null;
function timeDuration(record){
  const start=new Date(record.startedAt).getTime(),end=record.endedAt?new Date(record.endedAt).getTime():Date.now();
  const seconds=Math.max(0,Math.floor((end-start)/1000));
  const hours=String(Math.floor(seconds/3600)).padStart(2,'0');
  const minutes=String(Math.floor(seconds%3600/60)).padStart(2,'0');
  return hours+':'+minutes+':'+String(seconds%60).padStart(2,'0');
}
function localDayBounds(now=new Date()){
  const start=new Date(now);start.setHours(0,0,0,0);
  const end=new Date(start);end.setDate(end.getDate()+1);
  return {start:start.getTime(),end:end.getTime()};
}
function overlapsToday(record,now=new Date()){
  const {start,end}=localDayBounds(now),recordStart=new Date(record.startedAt).getTime();
  const recordEnd=record.endedAt?new Date(record.endedAt).getTime():now.getTime();
  return recordStart<end&&recordEnd>=start;
}
function todaySeconds(record,now=new Date()){
  const {start,end}=localDayBounds(now),recordStart=new Date(record.startedAt).getTime();
  const recordEnd=record.endedAt?new Date(record.endedAt).getTime():now.getTime();
  return Math.max(0,Math.floor((Math.min(recordEnd,end)-Math.max(recordStart,start))/1000));
}
function formatHoursMinutes(seconds){
  const minutes=Math.floor(Math.max(0,seconds)/60);
  return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
}
function renderTimeSummary(){
  const records=state.timeRecords||[],now=new Date(),today=records.filter(record=>overlapsToday(record,now));
  const active=today.filter(record=>record.status==='running'||!record.endedAt);
  const activeActors=new Set(active.map(record=>record.actorId).filter(Boolean));
  const actors=new Set(today.map(record=>record.actorId).filter(Boolean));
  const finished=today.filter(record=>record.endedAt&&new Date(record.endedAt).getTime()>=localDayBounds(now).start&&new Date(record.endedAt).getTime()<localDayBounds(now).end);
  $('#time-kpi-active').textContent=String(activeActors.size);
  $('#time-kpi-today').textContent=formatHoursMinutes(today.reduce((sum,record)=>sum+todaySeconds(record,now),0));
  $('#time-kpi-finished').textContent=String(finished.length);
  $('#time-kpi-actors').textContent=String(actors.size);
}
function renderTimeActorSummary(){
  const now=new Date(),today=(state.timeRecords||[]).filter(record=>overlapsToday(record,now));
  const groups=new Map();
  for(const record of today){
    const actor=record.actorId||'unbekannt';
    if(!groups.has(actor))groups.set(actor,[]);
    groups.get(actor).push(record);
  }
  const rows=[...groups.entries()].map(([actor,records])=>{
    const sorted=[...records].sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt)));
    const running=records.some(record=>record.status==='running'||!record.endedAt);
    const seconds=records.reduce((sum,record)=>sum+todaySeconds(record,now),0);
    const last=sorted[0],label=actorDisplay(last);
    return {actor,label,records,sorted,running,seconds,last};
  }).sort((a,b)=>Number(b.running)-Number(a.running)||b.seconds-a.seconds||a.label.localeCompare(b.label));
  $('#time-actor-summary-count').textContent=rows.length+' Mitarbeiter/Akteure';
  $('#time-actor-summary').innerHTML=rows.length?rows.map(row=>
    '<button type="button" class="time-actor-card'+(row.running?' running':'')+'" data-time-actor="'+escapeHtml(row.actor)+'">'+
      '<span class="time-actor-card-top"><strong>'+escapeHtml(row.label)+'</strong><span class="time-record-status">'+(row.running?'läuft':'heute')+'</span></span>'+
      '<span class="time-actor-total">'+escapeHtml(formatHoursMinutes(row.seconds))+'</span>'+
      '<span class="time-record-meta">'+row.records.length+' Einträge · '+escapeHtml(timeLabel(row.last))+'</span>'+
    '</button>'
  ).join(''):'<p class="time-empty">Heute noch keine Mitarbeiter-Zeitdaten.</p>';
}
function exportTimeCsv(){
  const records=[...filteredTimeRecords()].sort((a,b)=>String(a.startedAt).localeCompare(String(b.startedAt)));
  const rows=[['Mitarbeiter','Akteur-ID','Kunde/Einsatz','Auftrag','Status','Start','Ende','Dauer Sekunden','Kilometer Start','Kilometer Ende','Notiz','Revision'],
    ...records.map(record=>[
      actorDisplay(record),record.actorId||'',record.customerLabel||'',record.orderId||'',record.status||'',
      record.startedAt||'',record.endedAt||'',Math.max(0,Math.floor((new Date(record.endedAt||Date.now()).getTime()-new Date(record.startedAt).getTime())/1000)),
      record.mileageStart??'',record.mileageEnd??'',record.note||'',record.revision??''
    ])
  ];
  const csv=rows.map(row=>row.map(csvCell).join(';')).join('\n');
  const link=document.createElement('a');
  link.href=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}));
  const day=new Date().toISOString().slice(0,10);
  link.download='werkz-zeit-'+day+'.csv';link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),0);
}
function fillTimeActorFilter(){
  const select=$('#time-actor-filter');if(!select)return;
  const current=select.value,actors=new Map();
  for(const record of state.timeRecords||[])if(record.actorId)actors.set(record.actorId,actorDisplay(record));
  const entries=[...actors.entries()].sort((a,b)=>a[1].localeCompare(b[1])||a[0].localeCompare(b[0]));
  select.replaceChildren(new Option('Alle',''));
  entries.forEach(([id,label])=>select.add(new Option(label===id?label:label+' · '+id,id)));
  if(actors.has(current))select.value=current;
}
function filteredTimeRecords(){
  const query=($('#time-search')?.value||'').trim().toLowerCase();
  const actor=$('#time-actor-filter')?.value||'';
  const period=$('#time-period-filter')?.value||'today';
  return (state.timeRecords||[]).filter(record=>{
    const haystack=[record.actorLabel,record.actorId,record.customerLabel,record.orderId,record.note].map(value=>String(value||'').toLowerCase()).join(' ');
    return (!query||haystack.includes(query))&&(!actor||record.actorId===actor)&&(period!=='today'||overlapsToday(record));
  });
}
function actorDisplay(record){return record.actorLabel||record.actorId||'unbekannter Akteur'}
function timeLabel(record){return record.customerLabel||record.orderId||'Arbeitszeit'}
async function timeCommand(operation,input={}){
  const response=await fetch(state.timeApiBase+'/time/commands',{
    method:'POST',credentials:'include',headers:{'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify({operation,input})
  });
  const result=await response.json().catch(()=>null);
  if(!response.ok||result?.ok===false){const error=new Error(result?.error?.message||'Zeitabfrage fehlgeschlagen');error.status=response.status;throw error}
  return result.data;
}
function timeRecordButton(record){
  const status=record.status==='running'?'läuft':'beendet';
  const when=new Date(record.startedAt).toLocaleString('de-DE');
  return '<button type="button" class="time-record-button'+(record.status==='running'?' running':'')+'" data-time-id="'+escapeHtml(record.id)+'">'+
    '<span class="time-record-top"><strong>'+escapeHtml(timeLabel(record))+'</strong><span class="time-record-status">'+escapeHtml(status)+'</span></span>'+
    '<span class="time-record-meta">'+escapeHtml(actorDisplay(record))+' · '+escapeHtml(when)+'</span>'+
    '<span class="time-record-bottom"><span>'+escapeHtml(record.orderId||'ohne Auftrag')+'</span><strong class="time-live" data-start="'+escapeHtml(record.startedAt)+'" data-end="'+escapeHtml(record.endedAt||'')+'">'+escapeHtml(timeDuration(record))+'</strong></span>'+
  '</button>';
}
function updateTimeClocks(){
  document.querySelectorAll('.time-live').forEach(node=>{
    const start=node.dataset.start,end=node.dataset.end;
    node.textContent=timeDuration({startedAt:start,endedAt:end||null});
  });
  renderTimeSummary();
}
function renderTimeLists(){
  fillTimeActorFilter();
  renderTimeSummary();
  renderTimeActorSummary();
  const records=[...filteredTimeRecords()].sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt)));
  const active=records.filter(record=>record.status==='running'||!record.endedAt);
  const recent=records.slice(0,12);
  $('#time-active-count').textContent=active.length+' aktiv';
  $('#time-recent-count').textContent=records.length+' Treffer';
  $('#time-active-list').innerHTML=active.length?active.map(timeRecordButton).join(''):'<p class="time-empty">Keine aktive Zeitmessung für diesen Filter.</p>';
  $('#time-recent-list').innerHTML=recent.length?recent.map(timeRecordButton).join(''):'<p class="time-empty">Keine Zeitmessungen für diesen Filter.</p>';
  clearInterval(timeClockTimer);updateTimeClocks();timeClockTimer=setInterval(updateTimeClocks,1000);
}
async function renderTimeDetail(record){
  if(!record)return;state.selectedTimeId=record.id;
  let gallery=[];
  try{gallery=await timeCommand('time.gallery',{timeRecordId:record.id})}catch{}
  const corrections=Array.isArray(record.corrections)?record.corrections:[];
  const rows=[
    ['Status',record.status==='running'?'Läuft':'Beendet'],
    ['Mitarbeiter',actorDisplay(record)],
    ['Akteur-ID',record.actorId||'–'],
    ['Kunde / Einsatz',record.customerLabel||'–'],
    ['Auftrag',record.orderId||'–'],
    ['Start',new Date(record.startedAt).toLocaleString('de-DE')],
    ['Ende',record.endedAt?new Date(record.endedAt).toLocaleString('de-DE'):'läuft'],
    ['Dauer',timeDuration(record)],
    ['Kilometer Start',record.mileageStart??'–'],
    ['Kilometer Ende',record.mileageEnd??'–'],
    ['Revision',record.revision??'–'],
    ['Korrekturen',corrections.length],
    ['Fotos / Nachweise',gallery.length]
  ];
  const note=String(record.note||'').trim();
  const correctionHtml=corrections.length?'<details><summary>Korrekturverlauf ('+corrections.length+')</summary><div class="time-corrections">'+corrections.map(item=>{
    const fields=Object.keys(item.changes||{}).join(', ')||'keine Felder';
    return '<div><div><strong>'+escapeHtml(item.reason||'Korrektur')+'</strong><small>'+escapeHtml(fields)+'</small></div><span>'+escapeHtml(item.at?new Date(item.at).toLocaleString('de-DE'):'')+'</span></div>';
  }).join('')+'</div></details>':'';
  const evidenceHtml='<section class="time-evidence"><div class="time-list-heading"><h4>Fotos & Nachweise</h4><span>'+gallery.length+' vorhanden</span></div>'+
    (gallery.length?'<div class="time-evidence-list">'+gallery.map(item=>{
      const sizeKb=Math.max(1,Math.ceil(Number(item.size||0)/1024));
      const href=state.timeApiBase+'/time/evidence/'+encodeURIComponent(item.id);
      return '<a class="time-evidence-item" href="'+escapeHtml(href)+'" target="_blank" rel="noopener"><div><strong>Nachweis öffnen</strong><span>'+escapeHtml(item.mime||'Datei')+' · '+sizeKb+' KB</span></div><small>'+escapeHtml(item.id)+'</small></a>';
    }).join('')+'</div>':'<p class="time-empty">Keine Fotos oder Nachweise hinterlegt.</p>')+'</section>';
  $('#time-detail').innerHTML=
    '<div class="time-detail-head"><div><p class="eyebrow">Zeitmessung</p><h3>'+escapeHtml(timeLabel(record))+'</h3></div><span class="time-record-status">'+escapeHtml(record.status==='running'?'läuft':'beendet')+'</span></div>'+
    '<div class="time-detail-grid">'+rows.map(([label,value])=>'<div><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value)+'</strong></div>').join('')+'</div>'+
    '<div class="time-note"><span>Notiz</span><p>'+escapeHtml(note||'Keine Notiz hinterlegt.')+'</p></div>'+
    correctionHtml+evidenceHtml;
}
async function loadTimeOverview(){
  const connection=$('#time-connection'),hint=$('#time-login-hint');
  connection.textContent='Verbindung wird geprüft';connection.className='time-connection';
  hint.hidden=true;
  try{
    const sessionResponse=await fetch(state.timeApiBase+'/session',{credentials:'include',headers:{accept:'application/json'}});
    if(!sessionResponse.ok){const error=new Error('Anmeldung erforderlich');error.status=sessionResponse.status;throw error}
    state.timeSession=await sessionResponse.json();
    state.timeRecords=await timeCommand('time.list');
    connection.textContent='Verbunden · '+(state.timeSession.actorLabel||state.timeSession.actorId);connection.className='time-connection connected';
    renderTimeLists();
    const first=state.timeRecords.find(record=>record.id===state.selectedTimeId)||state.timeRecords.find(record=>record.status==='running'||!record.endedAt)||state.timeRecords[0];
    if(first)await renderTimeDetail(first);
    else $('#time-detail').innerHTML='<div class="time-detail-empty"><strong>Noch keine Zeitmessung</strong><span>Starte eine Messung in WerkZ Zeit. Danach erscheint sie hier automatisch.</span></div>';
  }catch(error){
    state.timeRecords=[];renderTimeLists();
    const loginNeeded=error.status===401||error.status===403;
    connection.textContent=loginNeeded?'Anmeldung nötig':'Zeitserver nicht erreichbar';
    connection.className='time-connection error';
    hint.hidden=!loginNeeded;
    $('#time-detail').innerHTML='<div class="time-detail-empty"><strong>'+(loginNeeded?'Noch nicht verbunden':'Zeitserver offline')+'</strong><span>'+(loginNeeded?'Öffne WerkZ Zeit einmal über die Testanmeldung.':'Starte den Time-Testserver auf Port 8080 und aktualisiere danach diese Ansicht.')+'</span></div>';
  }
}
document.addEventListener('click',event=>{
  const item=event.target.closest('[data-time-id]');
  if(item){const record=(state.timeRecords||[]).find(entry=>entry.id===item.dataset.timeId);if(record)renderTimeDetail(record)}
  const actor=event.target.closest('[data-time-actor]');
  if(actor){
    const select=$('#time-actor-filter');
    if(select){select.value=actor.dataset.timeActor;renderTimeLists();$('#time-recent-list')?.scrollIntoView({behavior:'smooth',block:'nearest'})}
  }
});
$('#time-refresh').addEventListener('click',loadTimeOverview);
$('#time-export').addEventListener('click',exportTimeCsv);
for(const selector of ['#time-search','#time-actor-filter','#time-period-filter']){
  document.addEventListener('input',event=>{if(event.target.matches(selector))renderTimeLists()});
  document.addEventListener('change',event=>{if(event.target.matches(selector))renderTimeLists()});
}

for(const id of ['#search','#status-filter','#priority-filter'])document.addEventListener('input',event=>{if(event.target.matches(id))renderOrders()});document.addEventListener('click',event=>{const button=event.target.closest('[data-target]');if(!button)return;document.querySelectorAll('#navigation button').forEach(item=>item.removeAttribute('aria-current'));button.setAttribute('aria-current','page');document.getElementById(button.dataset.target)?.scrollIntoView({behavior:'smooth',block:'start'})});$('#run-automation').addEventListener('click',runAutomation);$('#export-csv').addEventListener('click',exportCsv);$('#reset-demo').addEventListener('click',loadDemo);loadDemo().catch(()=>{$('#content').innerHTML='<h1>Demo konnte nicht geladen werden</h1><p>Bitte über den lokalen Server starten.</p>'});
