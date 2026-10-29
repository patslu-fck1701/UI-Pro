/* Encrypted per-account offline vault. API responses never enter the service-worker cache. */
export type Identity={id:string;tenant:string;username:string;role:string;modules:Record<string,boolean|string>};
type Pending={id:string;url:string;method:string;body:Record<string,unknown>;state:'pending'|'conflict';error?:string};
type Bundle={user:Identity;prepared:number;cache:Record<string,unknown>;queue:Pending[];drafts:Record<string,Record<string,string|boolean>>};
type Stored={tag:string;salt:number[];iv:number[];cipher:number[]};
type Vault={tag:string;salt:Uint8Array;key:CryptoKey;bundle:Bundle};
const nativeFetch=window.fetch.bind(window);let vault:Vault|null=null,syncing=false,formKey='',captureReady=false,unlockGeneration=0,boundIdentity='';
const listeners=new Set<()=>void>();let status='Offline-Tresor gesperrt';const emit=()=>listeners.forEach(fn=>fn());
export function offlineState(){return {unlocked:!!vault,status,pending:vault?.bundle.queue||[],prepared:vault?.bundle.prepared||0};}
export function subscribeOffline(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
const bytes=(buffer:ArrayBuffer)=>Array.from(new Uint8Array(buffer));
function db(){return new Promise<IDBDatabase>((resolve,reject)=>{const open=indexedDB.open('werkz-encrypted-vault',1);open.onupgradeneeded=()=>open.result.createObjectStore('vaults',{keyPath:'tag'});open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(Error('Browser-Speicher konnte nicht geöffnet werden.'));});}
async function storage(tag:string,value?:Stored,remove=false){const database=await db();return new Promise<Stored|undefined>((resolve,reject)=>{const transaction=database.transaction('vaults',value||remove?'readwrite':'readonly'),store=transaction.objectStore('vaults');const query=remove?store.delete(tag):value?store.put(value):store.get(tag);let result:Stored|undefined;query.onsuccess=()=>{result=query.result as Stored|undefined;};transaction.oncomplete=()=>{database.close();resolve(result);};transaction.onerror=()=>{database.close();reject(Error('Browser-Speicher ist voll oder nicht verfügbar. Änderungen wurden nicht als gespeichert bestätigt.'));};});}
async function accountTag(username:string){return bytes(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(location.origin+'|'+username.toLowerCase()))).map(x=>x.toString(16).padStart(2,'0')).join('');}
async function derive(password:string,salt:Uint8Array){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt as BufferSource,iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function decrypt(record:Stored,key:CryptoKey){const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(record.iv),additionalData:new TextEncoder().encode(record.tag)},key,new Uint8Array(record.cipher));return JSON.parse(new TextDecoder().decode(raw)) as Bundle;}
async function save(current:Vault){const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(current.tag)},current.key,new TextEncoder().encode(JSON.stringify(current.bundle)));await storage(current.tag,{tag:current.tag,salt:Array.from(current.salt),iv:Array.from(iv),cipher:bytes(cipher)});}
async function mutate(change:(bundle:Bundle)=>void){const active=vault;if(!active)throw Error('Offline-Tresor ist gesperrt.');if(!navigator.locks)throw Error('Sichere Offline-Schreibsperren werden von diesem Browser nicht unterstützt.');await navigator.locks.request('werkz-vault-'+active.tag,async()=>{const stored=await storage(active.tag);if(stored)active.bundle=await decrypt(stored,active.key);change(active.bundle);await save(active);});emit();}
export async function unlockOffline(username:string,password:string,user?:Identity){
 const generation=++unlockGeneration;
 if(password.length<12)throw Error('Für Offline-Daten ist eine eigene Passphrase mit mindestens 12 Zeichen erforderlich. Die lokale Anmelde-PIN bleibt unverändert.');
 const tag=await accountTag(username),stored=await storage(tag),salt=stored?new Uint8Array(stored.salt):crypto.getRandomValues(new Uint8Array(16)),key=await derive(password,salt);let bundle:Bundle;
 if(stored){try{bundle=await decrypt(stored,key);}catch{throw Error('Offline-Passphrase falsch oder Tresor beschädigt.');}if(user&&(bundle.user.id!==user.id||bundle.user.tenant!==user.tenant||bundle.user.role!==user.role))throw Error('Dieser Tresor gehört zu einer anderen Identität oder Rolle. Keine Datenübernahme.');if(!user&&Date.now()-bundle.prepared>24*3600000)throw Error('Offline-Freigabe abgelaufen. Zuerst wieder online anmelden.');}
 else{if(!user)throw Error('Für dieses Konto wurde noch kein Offline-Tresor vorbereitet.');bundle={user,prepared:Date.now(),cache:{'/api/me':user},queue:[],drafts:{}};}
 if(user){bundle.user=user;bundle.prepared=Date.now();}
 if(generation!==unlockGeneration)throw Error('Kontowechsel: Offline-Entsperrung verworfen.');
 const unlocked={tag,salt,key,bundle};await save(unlocked);
 if(generation!==unlockGeneration)throw Error('Kontowechsel: Offline-Entsperrung verworfen.');
 vault=unlocked;status='Offline-Daten verschlüsselt und an Konto sowie Mandant gebunden';emit();setupDrafts();window.dispatchEvent(new Event('werkz-vault-ready'));void synchronize();return bundle.user;
}
export function lockOffline(message='Offline-Tresor gesperrt; verschlüsselte Entwürfe bleiben erhalten'){unlockGeneration++;vault=null;formKey='';status=message;emit();}
export function bindOfflineIdentity(user:Identity|null){const identity=user?JSON.stringify([user.id,user.tenant,user.role,user.modules]):'';if(identity!==boundIdentity){boundIdentity=identity;unlockGeneration++;}if(vault&&(!user||vault.bundle.user.id!==user.id||vault.bundle.user.tenant!==user.tenant||vault.bundle.user.role!==user.role||JSON.stringify(vault.bundle.user.modules)!==JSON.stringify(user.modules)))lockOffline();}
export async function discardPending(id:string){if(!confirm('Diesen ausstehenden Vorgang verwerfen? Er wird nicht an den Server übertragen. Abhängige Konflikte müssen ebenfalls geprüft werden.'))return;await mutate(b=>{b.queue=b.queue.filter(q=>q.id!==id);});}
function optimistic(bundle:Bundle,pending:Pending){
 const body=pending.body,operation=String(body.operation||''),target=String(body.target||'');
 for(const [path,raw] of Object.entries(bundle.cache)){
  if(!raw||typeof raw!=='object')continue;const snapshot=raw as Record<string,unknown>;
  if(path.startsWith('/api/hotel/snapshot')&&pending.url==='/api/hotel/commands'){
   const tasks=snapshot.tasks as Record<string,unknown>[]|undefined,task=tasks?.find(t=>t.id===target);
   if(task&&['task.start','task.checklist','task.finish'].includes(operation)){
    if(operation==='task.start')task.state='in_progress';if(operation==='task.finish')task.state='review';if(operation==='task.checklist')task.checklist=JSON.stringify({...JSON.parse(String(task.checklist)),...(body.checks as object)});task.revision=Number(task.revision)+1;task.pending=true;
   }
  }
  if(path.startsWith('/api/work/snapshot')&&pending.url==='/api/work/commands'){
   const orders=snapshot.orders as Record<string,unknown>[]|undefined,order=orders?.find(o=>o.id===target);
   if(order&&['order.start','order.evidence','order.material'].includes(operation)){
    if(operation==='order.start')order.state='in_progress';if(operation==='order.evidence')order.report=body.text;order.revision=Number(order.revision)+1;order.pending=true;
   }
  }
  if(path.startsWith('/api/time/entries')&&pending.url==='/api/time/clock'){
   const entries=snapshot.entries as Record<string,unknown>[]|undefined;if(!entries)continue;const active=entries.find(e=>!e.ended),instant=String(body.occurred_at||new Date().toISOString());
   if(active&&['stop','break','resume'].includes(String(body.action))){active.ended=instant;active.effective_end=instant;active.seconds=Math.max(0,(Date.parse(instant)-Date.parse(String(active.started)))/1000);active.pending=true;}
   if(['start','break','resume'].includes(String(body.action)))entries.unshift({id:'offline-'+pending.id,user_id:bundle.user.id,target:body.target||active?.target||'',activity:body.action==='break'?'break':body.activity||'work',started:instant,ended:'',effective_start:instant,effective_end:'',seconds:null,pending:true});
  }
 }
}
const cacheable=(path:string)=>['/api/hotel/snapshot','/api/hotel/guest-orders','/api/work/snapshot','/api/time/entries','/api/business/snapshot','/api/documents?','/api/chats?','/api/prompts'].some(prefix=>path.startsWith(prefix));
const queueable=(path:string)=>['/api/hotel/commands','/api/work/commands','/api/time/clock'].includes(path);
function response(value:unknown){return new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json','X-WerkZ-Offline':'1'}});}
export async function synchronize(){
 if(!vault||syncing)return;syncing=true;const syncingVault=vault;
 try{
  const identity=await nativeFetch('/api/me');if(!identity.ok){status='Synchronisierung benötigt eine erneute Online-Anmeldung';return;}const user=await identity.json() as Identity;
  if(vault!==syncingVault)return;
  if(user.id!==vault.bundle.user.id||user.tenant!==vault.bundle.user.tenant||user.role!==vault.bundle.user.role){lockOffline();return;}
  const previousModules=syncingVault.bundle.user.modules||{},currentModules=user.modules||{};
  const moduleKeys=[...new Set([...Object.keys(previousModules),...Object.keys(currentModules)])].sort();
  if(moduleKeys.some(key=>previousModules[key]!==currentModules[key])){
   await mutate(bundle=>{
    bundle.user=user;
    bundle.cache={'/api/me':user};
    bundle.drafts={};
    for(const pending of bundle.queue){pending.state='conflict';pending.error='Modulfreigabe geändert. Vorgang vor einer Synchronisierung prüfen.';}
   });
   lockOffline('Modulfreigabe geändert · Offline-Cache und Entwürfe verworfen; verschlüsselte Vorgänge brauchen eine Prüfung.');
   window.dispatchEvent(new Event('werkz-identity-changed'));
   return;
  }
  for(const pending of [...vault.bundle.queue]){
   if(vault!==syncingVault)return;
   if(pending.state==='conflict'){status='Konflikt prüfen; keine stillschweigende Überschreibung';break;}
   const result=await nativeFetch(pending.url,{method:pending.method,headers:{'Content-Type':'application/json','X-WerkZ-Actor':syncingVault.bundle.user.id,'X-WerkZ-Tenant':syncingVault.bundle.user.tenant},body:JSON.stringify(pending.body)});
   if(vault!==syncingVault)return;
   if(!result.ok){let detail='Server hat den Vorgang abgelehnt.';try{detail=(await result.json()).detail||detail;}catch{}await mutate(b=>{const q=b.queue.find(q=>q.id===pending.id);if(q){q.state='conflict';q.error=String(detail);}});status='Synchronisierung angehalten: Konflikt oder Berechtigung prüfen';break;}
   await mutate(b=>{b.queue=b.queue.filter(q=>q.id!==pending.id);});
  }
  if(vault&&!vault.bundle.queue.length){
   for(const path of Object.keys(vault.bundle.cache).filter(cacheable)){const result=await nativeFetch(path);if(vault!==syncingVault)return;if(result.ok){const value=await result.json();if(vault!==syncingVault)return;await mutate(b=>{b.cache[path]=value;});}}
   status='Mit Backend verbunden · alle Vorgänge bestätigt';window.dispatchEvent(new Event('werkz-synchronized'));
  }
 }catch{status='Backend nicht erreichbar · unterstützte Änderungen bleiben verschlüsselt ausstehend';}
 finally{syncing=false;emit();}
}
window.fetch=async(input:RequestInfo|URL,options?:RequestInit)=>{
 const requestVault=vault,requestFormKey=formKey;
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href),path=url.pathname+url.search,method=(options?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 if(url.origin!==location.origin||!vault||!path.startsWith('/api/')||path.startsWith('/api/guest/'))return nativeFetch(input,options);
 if(path.endsWith('/demo/reset')&&vault.bundle.queue.length)throw Error('Vor Demo-Reset ausstehende Offline-Vorgänge synchronisieren oder bewusst verwerfen.');
 let opts=options;
 if(queueable(path)&&method==='POST'&&typeof options?.body==='string'){
  const body=JSON.parse(options.body);body.idempotency_key=body.idempotency_key||crypto.randomUUID();if(path==='/api/time/clock'){body.occurred_at=body.occurred_at||new Date().toISOString();}const headers=new Headers(options.headers);headers.set('X-WerkZ-Actor',vault.bundle.user.id);headers.set('X-WerkZ-Tenant',vault.bundle.user.tenant);opts={...options,headers,body:JSON.stringify(body)};
 }
 try{
  const result=await nativeFetch(input,opts);
  if(vault!==requestVault)throw Error('Konto wurde gewechselt. Antwort verworfen.');
  if(result.ok&&method==='GET'&&cacheable(path)){const value=await result.clone().json();await mutate(b=>{b.cache[path]=value;});}
  if(result.ok&&method!=='GET'&&requestFormKey){await mutate(b=>{delete b.drafts[requestFormKey];});if(formKey===requestFormKey)formKey='';}
  return result;
 }catch(error){
  if(!(error instanceof TypeError))throw error;
  if(vault!==requestVault)throw Error('Konto wurde gewechselt. Vorgang nicht übernommen.');
  status='Offline · Serverbestätigung steht aus';emit();
  if(method==='GET'&&vault.bundle.cache[path]!==undefined)return response(vault.bundle.cache[path]);
  if(method==='POST'&&queueable(path)&&typeof opts?.body==='string'){
   const pending:Pending={id:crypto.randomUUID(),url:path,method,body:JSON.parse(opts.body),state:'pending'};
   await mutate(b=>{b.queue.push(pending);optimistic(b,pending);if(formKey)delete b.drafts[formKey];});formKey='';return response({saved:false,pending:true,offline:true,record:null});
  }
  throw Error('Diese Funktion benötigt eine Backend-Verbindung. Gesicherte Formularentwürfe bleiben erhalten.');
 }
};
function formId(form:HTMLFormElement){const owner=form.closest('[data-record-id],[data-order],[data-task-room]');const scope=owner?.getAttribute('data-record-id')||owner?.getAttribute('data-order')||owner?.getAttribute('data-task-room')||'';return location.pathname+'|'+scope+'|'+(form.querySelector('h2,h3,legend')?.textContent||'')+'|'+Array.from(form.elements).map(e=>{const input=e as HTMLInputElement;return input.name?input.name+':'+(input.defaultValue||''):'';}).filter(Boolean).join(',');}
function eligible(form:HTMLFormElement){return !form.querySelector('input[type=password],input[name=code]')&&!new URLSearchParams(location.search).has('guestPortal');}
function setupDrafts(){
 if(captureReady)return;captureReady=true;let restoring=false;const restored=new WeakSet<HTMLFormElement>();
 const restore=()=>{if(!vault)return;document.querySelectorAll('form').forEach(form=>{if(restored.has(form)||!eligible(form))return;restored.add(form);const draft=vault?.bundle.drafts[formId(form)];if(!draft)return;restoring=true;for(const [name,value] of Object.entries(draft)){const input=form.elements.namedItem(name) as HTMLInputElement|null;if(!input)continue;if(input.type==='checkbox')input.checked=Boolean(value);else{const prototype=input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value')?.set?.call(input,String(value));}input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}restoring=false;});};
 const observer=new MutationObserver(restore);observer.observe(document.body,{subtree:true,childList:true});restore();
 let timer:ReturnType<typeof setTimeout>;
 document.addEventListener('input',event=>{if(restoring||!vault)return;const input=event.target as HTMLInputElement,form=input.form;if(!form||!eligible(form))return;clearTimeout(timer);const draftVault=vault;timer=setTimeout(()=>{if(vault!==draftVault)return;const values:Record<string,string|boolean>={};Array.from(form.elements).forEach(element=>{const e=element as HTMLInputElement;if(e.name&&e.type!=='file'&&e.type!=='password')values[e.name]=e.type==='checkbox'?e.checked:e.value;});void mutate(b=>{b.drafts[formId(form)]=values;}).catch(()=>{status='Entwurf konnte nicht lokal gesichert werden';emit();});},200);},true);
 document.addEventListener('submit',event=>{const form=event.target as HTMLFormElement;if(form instanceof HTMLFormElement&&eligible(form))formKey=formId(form);},true);
}
window.addEventListener('online',()=>void synchronize());setInterval(()=>void synchronize(),15000);
if('serviceWorker' in navigator&&location.protocol!=='file:')window.addEventListener('load',()=>void navigator.serviceWorker.register('/sw.js').catch(()=>{}));
