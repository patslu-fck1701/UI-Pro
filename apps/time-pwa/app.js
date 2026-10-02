'use strict';

(()=>{
  const apiBase=document.querySelector('meta[name="werkz-api-base"]').content.replace(/\/$/,'');
  const $=id=>document.getElementById(id);
  const ui={
    sync:$('sync-status'),elapsed:$('elapsed'),start:$('start'),stop:$('stop'),customer:$('customer'),
    order:$('order'),mileageStart:$('mileage-start'),history:$('history'),conflictsCard:$('conflicts-card'),
    conflicts:$('conflicts'),dialog:$('entry-dialog'),dialogTitle:$('dialog-title'),entryValue:$('entry-value')
  };
  let session=null,running=null,timer=null,dialogAction=null,syncPromise=null,syncAgain=false;

  const uuid=()=>crypto.randomUUID();
  const now=()=>new Date().toISOString();
  const dbPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open('werkz-time-pwa',1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('commands'))db.createObjectStore('commands',{keyPath:'id'});
      if(!db.objectStoreNames.contains('state'))db.createObjectStore('state',{keyPath:'key'});
    };
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  async function store(name,mode,action){
    const db=await dbPromise;
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(name,mode),request=action(tx.objectStore(name));
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
  }
  const allCommands=()=>store('commands','readonly',value=>value.getAll());
  async function nextSequence(){
    const db=await dbPromise;
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('state','readwrite'),object=tx.objectStore('state'),request=object.get('command-sequence');
      let sequence;
      request.onsuccess=()=>{sequence=(request.result?.value||0)+1;object.put({key:'command-sequence',value:sequence})};
      request.onerror=()=>reject(request.error);tx.oncomplete=()=>resolve(sequence);tx.onabort=()=>reject(tx.error);
    });
  }
  const putCommand=value=>store('commands','readwrite',object=>object.put(value));
  async function getState(key){return store('state','readonly',object=>object.get(key))}
  async function setState(key,value){return store('state','readwrite',object=>object.put({key,value}))}

  function setConnection(text,kind=''){ui.sync.textContent=text;ui.sync.dataset.kind=kind}
  function publicError(error){return error?.message||'Aktion konnte nicht gespeichert werden.'}
  async function loadSession(){
    try{
      const response=await fetch(apiBase+'/session',{credentials:'include',headers:{accept:'application/json'}});
      if(!response.ok)throw new Error('Anmeldung erforderlich');
      session=await response.json();await setState('session-context',{organisationId:session.organisationId,actorId:session.actorId});
      setConnection(navigator.onLine?'Online':'Offline');
    }catch(error){
      const cached=await getState('session-context');session=cached?.value||null;
      setConnection(session?'Offline – Änderungen werden vorgemerkt':'Nicht angemeldet','error');
    }
  }
  async function parseResponse(response){
    const result=await response.json().catch(()=>({ok:false,error:{code:'HTTP_ERROR',message:'Serverantwort nicht lesbar'}}));
    if(!response.ok||result.ok===false){
      const error=new Error(result.error?.message||'Server rejected command');
      error.code=result.error?.code||'HTTP_ERROR';error.details=result.error?.details;throw error;
    }
    return result.data;
  }
  async function sendEvidence(entry){
    const form=new FormData(),payload=entry.payload;
    form.append('timeRecordId',payload.timeRecordId);
    form.append('idempotencyKey',entry.idempotencyKey);
    form.append('mime',payload.mime);
    form.append('size',String(payload.size));
    form.append('hash',payload.hash);
    form.append('file',payload.blob,payload.fileName);
    const response=await fetch(apiBase+'/time/evidence',{method:'POST',credentials:'include',headers:{accept:'application/json'},body:form});
    return parseResponse(response);
  }
  async function send(entry){
    if(entry.type==='time.evidence.add')return sendEvidence(entry);
    const response=await fetch(apiBase+'/time/commands',{
      method:'POST',credentials:'include',headers:{'content-type':'application/json',accept:'application/json'},
      body:JSON.stringify({operation:entry.type,input:{...entry.payload,idempotencyKey:entry.idempotencyKey,expectedRevision:entry.expectedRevision}})
    });
    return parseResponse(response);
  }
  async function sha256(blob){
    const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
    return 'sha256:'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  const entityIdOf=entry=>entry.entityId||entry.payload?.id||entry.payload?.timeRecordId;
  const commandOrder=(a,b)=>(a.sequence??Number.MAX_SAFE_INTEGER)-(b.sequence??Number.MAX_SAFE_INTEGER)
    ||String(a.createdAtLocal).localeCompare(String(b.createdAtLocal))||String(a.id).localeCompare(String(b.id));
  async function enqueue(type,payload,expectedRevision){
    if(!session)throw new Error('Bitte zuerst anmelden.');
    const all=(await allCommands()).sort(commandOrder),entityId=payload.id||payload.timeRecordId;
    const related=all.filter(value=>entityIdOf(value)===entityId),sequence=await nextSequence();
    const entry={
      id:'cmd_'+uuid(),idempotencyKey:'idem_'+uuid(),organisationId:session.organisationId,actorId:session.actorId,
      createdAtLocal:new Date().toISOString(),sequence,entityId,causationId:related.at(-1)?.id||null,
      type,payload,expectedRevision,status:'queued',attempts:0,lastError:null
    };
    await putCommand(entry);await sync();return entry;
  }
  async function sync(){
    if(syncPromise){syncAgain=true;return syncPromise}
    syncPromise=(async()=>{do{syncAgain=false;await syncOnce()}while(syncAgain)})().finally(()=>{syncPromise=null});
    return syncPromise;
  }
  async function syncOnce(){
    const all=(await allCommands()).sort(commandOrder);
    const entries=all.filter(entry=>entry.status==='queued'||entry.status==='failed'||entry.status==='syncing');
    const byId=new Map(all.map(entry=>[entry.id,entry])),revisions=new Map();
    for(const entry of all){
      if(entry.status==='synced'&&Number.isInteger(entry.result?.revision))revisions.set(entityIdOf(entry),entry.result.revision);
    }
    if(!navigator.onLine){setConnection(entries.length+' offline vorgemerkt');await renderConflicts();return}
    for(const entry of entries){
      const cause=entry.causationId?byId.get(entry.causationId):null;
      if(entry.causationId&&(!cause||cause.status!=='synced')){
        if(cause?.status==='conflict'){
          entry.status='conflict';entry.lastError={code:'CAUSATION_CONFLICT',message:'Vorheriger Offline-Befehl hat einen Konflikt.',details:null};
          await putCommand(entry);byId.set(entry.id,entry);
        }
        continue;
      }
      const latest=revisions.get(entityIdOf(entry));
      if(entry.causationId&&latest!==undefined)entry.expectedRevision=latest;
      entry.status='syncing';entry.attempts++;await putCommand(entry);
      try{
        entry.result=await send(entry);entry.status='synced';entry.lastError=null;
        if(Number.isInteger(entry.result?.revision))revisions.set(entityIdOf(entry),entry.result.revision);
        if(entry.type==='time.evidence.add'){
          const {timeRecordId,mime,size,hash,fileName}=entry.payload;
          entry.payload={timeRecordId,mime,size,hash,fileName};
        }
      }
      catch(error){
        entry.status=error.code==='REVISION_CONFLICT'?'conflict':'failed';
        entry.lastError={code:error.code||'ERROR',message:publicError(error),details:error.details||null};
      }
      await putCommand(entry);byId.set(entry.id,entry);
    }
    const pending=(await allCommands()).filter(entry=>entry.status!=='synced').length;
    setConnection(pending?pending+' offen':'Synchronisiert',pending?'warning':'');
    await renderConflicts();await refresh();
  }
  function clock(){
    clearInterval(timer);
    if(!running){ui.elapsed.textContent='00:00:00';return}
    const update=()=>{
      const seconds=Math.max(0,Math.floor((Date.now()-new Date(running.startedAt).getTime())/1000));
      const hours=String(Math.floor(seconds/3600)).padStart(2,'0');
      const minutes=String(Math.floor(seconds%3600/60)).padStart(2,'0');
      ui.elapsed.textContent=hours+':'+minutes+':'+String(seconds%60).padStart(2,'0');
    };
    update();timer=setInterval(update,1000);
  }
  function setRunning(record){
    running=record||null;ui.start.hidden=Boolean(running);ui.stop.hidden=!running;
    ui.customer.disabled=Boolean(running);ui.order.disabled=Boolean(running);ui.mileageStart.disabled=Boolean(running);
    ui.elapsed.classList.toggle('running',Boolean(running));clock();
  }
  function historyItem(record){
    const item=document.createElement('li'),title=document.createElement('strong'),details=document.createElement('div');
    title.textContent=record.customerLabel||record.orderId||'Arbeitszeit';
    details.textContent=new Date(record.startedAt).toLocaleString('de-DE')+(record.endedAt?' – '+new Date(record.endedAt).toLocaleTimeString('de-DE'):' – läuft');
    item.append(title,details);item.dataset.id=record.id;return item;
  }
  async function executeQuery(operation,input={}){
    const response=await fetch(apiBase+'/time/commands',{
      method:'POST',credentials:'include',headers:{'content-type':'application/json',accept:'application/json'},
      body:JSON.stringify({operation,input})
    });
    if(!response.ok)throw new Error('Abfrage fehlgeschlagen');
    const result=await response.json();if(result.ok===false)throw new Error(result.error?.message);return result.data;
  }
  async function refresh(){
    if(!navigator.onLine||!session)return;
    try{
      const records=await executeQuery('time.list');ui.history.replaceChildren();
      if(!records.length){const empty=document.createElement('li');empty.className='empty';empty.textContent='Heute noch keine Einträge.';ui.history.append(empty);}
      records.sort((a,b)=>b.startedAt.localeCompare(a.startedAt)).forEach(record=>ui.history.append(historyItem(record)));
      setRunning(records.find(record=>record.status==='running'&&record.actorId===session.actorId)||null);
    }catch(error){setConnection('Daten konnten nicht geladen werden','error')}
  }
  async function renderConflicts(){
    const entries=(await allCommands()).filter(entry=>entry.status==='conflict');
    ui.conflictsCard.hidden=!entries.length;ui.conflicts.replaceChildren();
    for(const entry of entries){
      const item=document.createElement('li');
      item.textContent=entry.type+' · '+new Date(entry.createdAtLocal).toLocaleString('de-DE')+' – manuelle Prüfung nötig';
      ui.conflicts.append(item);
    }
  }
  function openDialog(title,value,action){
    dialogAction=action;ui.dialogTitle.textContent=title;ui.entryValue.value=value||'';ui.dialog.showModal();ui.entryValue.focus();
  }

  ui.start.addEventListener('click',async()=>{
    ui.start.disabled=true;
    try{
      const startedAt=now(),id='time_'+uuid(),customerLabel=ui.customer.value.trim()||null,orderId=ui.order.value.trim()||null;
      const mileageStart=ui.mileageStart.value===''?null:Number(ui.mileageStart.value);
      await enqueue('time.start',{id,customerLabel,orderId,mileageStart,startedAt});
      setRunning({
        id,organisationId:session.organisationId,actorId:session.actorId,customerLabel,orderId,
        mileageStart,startedAt,endedAt:null,note:'',status:'running',revision:1
      });
    }catch(error){alert(publicError(error));}
    finally{ui.start.disabled=false}
  });
  ui.stop.addEventListener('click',async()=>{
    if(!running)return;
    const value=prompt('Endkilometer (optional)','');
    try{
      await enqueue('time.stop',{id:running.id,endedAt:now(),mileageEnd:value===''||value===null?null:Number(value)},running.revision);
      setRunning(null);
    }catch(error){alert(publicError(error));}
  });
  $('note').addEventListener('click',()=>{
    if(!running)return alert('Bitte zuerst Arbeitszeit starten.');
    openDialog('Notiz ergänzen',running.note,async value=>enqueue('time.correct',{
      id:running.id,reason:'Mobile Notizkorrektur',changes:{note:value}
    },running.revision));
  });
  $('mileage').addEventListener('click',()=>{
    if(!running)return alert('Bitte zuerst Arbeitszeit starten.');
    openDialog('Kilometerstand korrigieren',String(running.mileageStart??''),async value=>enqueue('time.correct',{
      id:running.id,reason:'Mobile Kilometerkorrektur',changes:{mileageStart:Number(value)}
    },running.revision));
  });
  $('correction').addEventListener('click',()=>{
    if(!running)return alert('Bitte einen laufenden Eintrag auswählen.');
    openDialog('Zeitkorrektur begründen','',async value=>enqueue('time.correct',{
      id:running.id,reason:value,changes:{}
    },running.revision));
  });
  $('photo').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';
    if(!file)return;
    if(!running)return alert('Bitte zuerst Arbeitszeit starten.');
    if(!file.type.startsWith('image/'))return alert('Bitte eine Bilddatei wählen.');
    if(file.size>20*1024*1024)return alert('Das Foto darf höchstens 20 MB groß sein.');
    try{
      const hash=await sha256(file);
      await enqueue('time.evidence.add',{
        timeRecordId:running.id,mime:file.type,size:file.size,hash,fileName:file.name||'foto.jpg',blob:file
      });
      alert(navigator.onLine?'Foto sicher übertragen.':'Foto offline vorgemerkt. Es wird bei Verbindung übertragen.');
    }catch(error){alert(publicError(error));}
  });
  $('dialog-save').addEventListener('click',async event=>{
    event.preventDefault();
    try{await dialogAction(ui.entryValue.value);ui.dialog.close();}
    catch(error){alert(publicError(error));}
  });
  $('refresh').addEventListener('click',refresh);
  addEventListener('online',sync);addEventListener('offline',()=>setConnection('Offline'));
  if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>setConnection('Offline-Shell nicht verfügbar','error'));

  loadSession().then(()=>Promise.all([renderConflicts(),sync(),refresh()]));
})();
