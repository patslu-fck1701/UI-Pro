'use strict';

const clone=value=>structuredClone(value);
const entityIdOf=command=>command.entityId||command.payload?.id||command.payload?.timeRecordId||null;
const order=(a,b)=>(a.sequence??Number.MAX_SAFE_INTEGER)-(b.sequence??Number.MAX_SAFE_INTEGER)
  ||String(a.createdAtLocal).localeCompare(String(b.createdAtLocal))||String(a.id).localeCompare(String(b.id));

class OfflineQueuePort {
  enqueue(_) { throw new Error('OfflineQueuePort.enqueue must be implemented'); }
  sync(_) { throw new Error('OfflineQueuePort.sync must be implemented'); }
  list() { throw new Error('OfflineQueuePort.list must be implemented'); }
}
class OfflineQueueDriverPort {
  get(_) { throw new Error('OfflineQueueDriverPort.get must be implemented'); }
  put(_) { throw new Error('OfflineQueueDriverPort.put must be implemented'); }
  list() { throw new Error('OfflineQueueDriverPort.list must be implemented'); }
}
class MemoryOfflineQueueDriver extends OfflineQueueDriverPort {
  constructor(seed=[]){super();this.records=new Map(seed.map(value=>[value.id,clone(value)]));}
  async get(id){const value=this.records.get(id);return value?clone(value):null}
  async put(value){this.records.set(value.id,clone(value));return clone(value)}
  async list(){return [...this.records.values()].map(value=>clone(value))}
}
class IndexedDbOfflineQueueDriver extends OfflineQueueDriverPort {
  constructor({indexedDB,databaseName='werkz-time',storeName='offline-commands',version=1}={}){
    super();if(!indexedDB)throw new Error('indexedDB implementation required');
    this.indexedDB=indexedDB;this.databaseName=databaseName;this.storeName=storeName;this.version=version;this.openPromise=null;
  }
  open(){
    if(this.openPromise)return this.openPromise;
    this.openPromise=new Promise((resolve,reject)=>{
      const request=this.indexedDB.open(this.databaseName,this.version);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(this.storeName))request.result.createObjectStore(this.storeName,{keyPath:'id'});};
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('IndexedDB open failed'));
    });return this.openPromise;
  }
  async request(mode,operation){
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(this.storeName,mode),store=tx.objectStore(this.storeName),request=operation(store);
      request.onsuccess=()=>resolve(request.result===undefined?null:clone(request.result));
      request.onerror=()=>reject(request.error||new Error('IndexedDB request failed'));
      tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));
    });
  }
  get(id){return this.request('readonly',store=>store.get(id))}
  put(value){return this.request('readwrite',store=>store.put(clone(value))).then(()=>clone(value))}
  list(){return this.request('readonly',store=>store.getAll()).then(values=>values||[])}
}
function validation(field){
  const error=new Error(field+' is required');error.code='VALIDATION_ERROR';throw error;
}
function validate(command){
  for(const field of ['id','idempotencyKey','organisationId','actorId','createdAtLocal','type']){
    if(!String(command[field]||'').trim())validation(field);
  }
}
function failure(error){
  return {code:error.code||'ERROR',message:error.code==='REVISION_CONFLICT'?'Revision conflict':'Synchronization failed',
    expectedRevision:error.expected,actualRevision:error.actual};
}
function responseRevision(value){
  const result=value?.data??value;
  return Number.isInteger(result?.revision)?result.revision:null;
}
class PersistentOfflineQueue extends OfflineQueuePort {
  constructor(driver){super();this.driver=driver;}
  async enqueue(command){
    validate(command);
    const all=await this.driver.list();
    const duplicate=all.find(value=>value.idempotencyKey===command.idempotencyKey&&value.organisationId===command.organisationId);
    if(duplicate)return duplicate;
    const entityId=entityIdOf(command);if(!entityId)validation('entityId');
    const related=all.filter(value=>entityIdOf(value)===entityId).sort(order);
    const sequence=command.sequence??Math.max(0,...all.map(value=>value.sequence||0))+1;
    if(!Number.isSafeInteger(sequence)||sequence<1)validation('sequence');
    const entry={...clone(command),entityId,sequence,causationId:command.causationId??related.at(-1)?.id??null,
      payload:clone(command.payload||{}),status:'queued',attempts:0,lastError:null,result:null};
    return this.driver.put(entry);
  }
  async list(){return (await this.driver.list()).sort(order)}
  async retry(id){
    const entry=await this.driver.get(id);
    if(!entry){const error=new Error('Offline command not found');error.code='NOT_FOUND';throw error;}
    if(entry.status==='synced')return entry;
    entry.status='queued';entry.lastError=null;return this.driver.put(entry);
  }
  async sync(processor){
    const entries=await this.list(),byId=new Map(entries.map(value=>[value.id,value])),revisions=new Map();
    for(const entry of entries){
      const found=responseRevision(entry.result);
      if(entry.status==='synced'&&found!==null)revisions.set(entry.entityId,found);
    }
    for(const entry of entries.filter(value=>['queued','failed','syncing'].includes(value.status))){
      const cause=entry.causationId?byId.get(entry.causationId):null;
      if(entry.causationId&&(!cause||cause.status!=='synced')){
        if(cause?.status==='conflict'){
          entry.status='conflict';entry.lastError={code:'CAUSATION_CONFLICT',message:'A preceding offline command conflicted'};
          await this.driver.put(entry);byId.set(entry.id,entry);
        }
        continue;
      }
      const effective=clone(entry),latest=revisions.get(entry.entityId);
      if(entry.causationId&&latest!==undefined){effective.expectedRevision=latest;entry.expectedRevision=latest;}
      entry.status='syncing';entry.attempts+=1;await this.driver.put(entry);
      try{
        const response=await processor(effective);
        if(response&&response.ok===false){
          const error=new Error(response.error?.message||'Synchronization failed');
          Object.assign(error,{code:response.error?.code,expected:response.error?.details?.expectedRevision,actual:response.error?.details?.actualRevision});throw error;
        }
        entry.status='synced';entry.result=clone(response?.data??response);entry.lastError=null;
        const found=responseRevision(response);if(found!==null)revisions.set(entry.entityId,found);
      }catch(error){
        entry.status=error.code==='REVISION_CONFLICT'?'conflict':'failed';entry.lastError=failure(error);
      }
      await this.driver.put(entry);byId.set(entry.id,entry);
    }
    return this.list();
  }
}
module.exports={OfflineQueuePort,OfflineQueueDriverPort,MemoryOfflineQueueDriver,IndexedDbOfflineQueueDriver,PersistentOfflineQueue};
