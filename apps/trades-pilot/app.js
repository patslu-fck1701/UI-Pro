'use strict';
const $=selector=>document.querySelector(selector);
async function api(path,body){
  const response=await fetch('/pilot/api'+path,{credentials:'same-origin',headers:{'content-type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
  if(response.status===401){location.assign('/pilot/login?return='+encodeURIComponent('/pilot/handwerk/'));throw new Error('Bitte anmelden.');}
  const value=await response.json();if(!response.ok)throw new Error(value.message||value.error||'Speichern fehlgeschlagen.');return value;
}
function item(list,title,detail,action){const li=document.createElement('li'),strong=document.createElement('strong'),p=document.createElement('div');strong.textContent=title;p.textContent=detail;li.append(strong,p);if(action){const button=document.createElement('button');button.textContent=action.label;button.addEventListener('click',()=>run(button,action.run));li.append(button);}list.append(li);}
async function refresh(){
  const [customers,calls,documents]=await Promise.all([api('/customers'),api('/calls'),api('/documents')]);
  for(const id of ['customer','inquiry','document'])$('#'+id+'-list').replaceChildren();
  for(const x of customers)item($('#customer-list'),x.name,[x.phone,x.location].filter(Boolean).join(' · '));
  for(const x of calls)item($('#inquiry-list'),x.name||'Anfrage',[x.topic,x.phone,x.status].filter(Boolean).join(' · '),x.status==='erledigt'?null:{label:'Rückruf erledigt',run:()=>api('/calls/'+encodeURIComponent(x.id)+'/complete',{clientMutationId:crypto.randomUUID(),boughtScrap:false,addToLoad:false})});
  for(const x of documents)item($('#document-list'),x.storage?.fileName||'Beleg',[x.receiptCategory,x.expenseClass,'Betrag bitte prüfen'].filter(Boolean).join(' · '));
  for(const id of ['customer','inquiry','document'])if(!$('#'+id+'-list').children.length)item($('#'+id+'-list'),'Noch keine Einträge','Hier erscheinen die gespeicherten Daten.');
}
async function run(button,action){button.disabled=true;$('#status').textContent='Wird gespeichert …';try{await action();await refresh();$('#status').textContent='Gespeichert.';}catch(error){$('#status').textContent=error.message;}finally{button.disabled=false;}}
function form(id,action){$(id).addEventListener('submit',event=>{event.preventDefault();const target=event.currentTarget;run(target.querySelector('button'),async()=>{await action(new FormData(target));target.reset();});});}
form('#customer-form',data=>api('/customers',Object.fromEntries(data)));
form('#inquiry-form',data=>api('/calls',{...Object.fromEntries(data),clientMutationId:crypto.randomUUID()}));
form('#document-form',async data=>{const file=data.get('file');if(file.size>12*1024*1024)throw new Error('Maximal 12 MB pro Beleg.');const dataBase64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Datei konnte nicht gelesen werden.'));reader.readAsDataURL(file);});await api('/documents',{fileName:file.name,mime:file.type||'application/octet-stream',dataBase64,receiptCategory:data.get('receiptCategory'),clientMutationId:crypto.randomUUID()});});
form('#export-form',async data=>{const x=await api('/export/prepare',{month:data.get('month')});$('#export-result').textContent=x.count+' Belege vorbereitet; '+x.reviewCount+' Zuordnungen prüfen. Es wurde nichts versendet.';});
$('#export-form input').value=new Date().toISOString().slice(0,7);
api('/session').then(session=>{$('#business').textContent=session.organisationLabel||'WerkZ Beispieldaten';return refresh();}).then(()=>{$('#status').textContent='Verbunden.';}).catch(error=>{$('#status').textContent=error.message;});
