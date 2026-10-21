'use strict';
const path=require('node:path');
const fs=require('node:fs');
const {MemoryPilotRepository,PilotDocumentStorage}=require('../pilot');
const {InMemoryTenantTimeRepository}=require('../time/production');
const {FilePrivateEvidenceStorage}=require('../time/durable');
function repositories(store,root){
  function current(kind){
    const scope=store.current();
    if(!scope.repositories[kind]){
      if(kind==='pilot'){
        const repository=new MemoryPilotRepository();Object.assign(repository.state,scope.state.pilot);scope.state.pilot=repository.state;scope.repositories.pilot=repository;
      }else if(kind==='time'){
        const repository=new InMemoryTenantTimeRepository();
        repository.records=new Map(Object.entries(scope.state.time.records));repository.idempotency=new Map(Object.entries(scope.state.time.idempotency));scope.repositories.time=repository;
      }else{
        const storage=new FilePrivateEvidenceStorage(path.join(root,'evidence'));storage.state=scope.state.evidence;storage.persist=()=>{};scope.repositories.evidence=storage;
      }
    }
    return scope.repositories[kind];
  }
  function proxy(kind){return new Proxy({}, {get(_,name){const target=current(kind),value=target[name];if(typeof value!=='function')return value;return (...args)=>{
    const org=kind==='pilot'&&name==='add'?args[1]?.organisationId:(['create','putPrivate'].includes(name)?args[0]?.organisationId:args[0]);
    if(org!==store.current().org)throw new Error('Cross-tenant repository operation');
    const result=value.apply(target,args);
    if(kind==='time')store.current().state.time={records:Object.fromEntries(target.records),idempotency:Object.fromEntries(target.idempotency)};
    return result;
  };}});}
  class PersistentDocuments extends PilotDocumentStorage{
    put(input){
      let previous;try{previous=super.read(input);}catch(error){if(error.code!=='NOT_FOUND')throw error;}
      if(previous&&!previous.equals(Buffer.from(input.bytes)))throw Object.assign(new Error('Document bytes are immutable'),{code:'STATE_INVALID'});
      const result=super.put(input),file=path.join(this.root,result.objectKey),descriptor=fs.openSync(file,'r');
      try{fs.fsyncSync(descriptor);}finally{fs.closeSync(descriptor);}return result;
    }
    remove(input){if(input.organisationId!==store.current().org)throw new Error('Cross-tenant document operation');store.current().afterCommit.push(()=>super.remove(input));return true;}
  }
  const documents=new Proxy(new PersistentDocuments(path.join(root,'simple-pilot','documents')), {get(target,name){const value=target[name];if(typeof value!=='function')return value;return input=>{if(input?.organisationId!==store.current().org)throw new Error('Cross-tenant document operation');return value.call(target,input);};}});
  return {pilot:proxy('pilot'),time:proxy('time'),evidence:proxy('evidence'),documents};
}
class BufferedResponse{
  constructor(){this.statusCode=200;this.headers={};this.chunks=[];this.ended=false;}
  setHeader(key,value){this.headers[key.toLowerCase()]=value;return this;}
  getHeader(key){return this.headers[key.toLowerCase()];}
  writeHead(status,headers={}){this.statusCode=status;for(const [key,value] of Object.entries(headers))this.setHeader(key,value);return this;}
  end(bytes){if(bytes!==undefined)this.chunks.push(Buffer.from(bytes));this.ended=true;}
  flush(response){if(!this.ended)throw new Error('Incomplete business response');response.writeHead(this.statusCode,this.headers);response.end(Buffer.concat(this.chunks));}
}
async function transactionalHttp(store,org,response,handler){
  const buffered=new BufferedResponse();
  try{
    await store.withTenant(org,async()=>{await handler(buffered);if(buffered.statusCode>=400)throw Object.assign(new Error('Request rejected'),{requestRejected:true});});
    buffered.flush(response);
  }catch(error){
    if(error.requestRejected)return buffered.flush(response);
    process.stderr.write(JSON.stringify({kind:'business-storage-error',code:error.code||'STORAGE_UNAVAILABLE'})+'\n');
    response.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify({error:'STORAGE_UNAVAILABLE',message:'Speichern derzeit nicht möglich. Bitte erneut versuchen.'}));
  }
}
module.exports={repositories,BufferedResponse,transactionalHttp};
