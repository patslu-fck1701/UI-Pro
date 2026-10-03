'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const COLLECTIONS=new Set(['products','reportingCases','aiFeatures']);
const clone=value=>structuredClone(value);
function fail(code,message,details){const error=new Error(message);error.code=code;if(details)error.details=details;throw error}
function collection(name){if(!COLLECTIONS.has(name))fail('VALIDATION_ERROR','Unknown compliance collection');return name}
function record(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||!Number.isInteger(value.revision)||value.revision<1)
    fail('COMPLIANCE_STATE_INVALID','Invalid compliance evidence record');
  return value;
}
function validateState(value){
  if(!value||value.schemaVersion!==1)fail('COMPLIANCE_STATE_INVALID','Unsupported compliance evidence state');
  for(const name of COLLECTIONS){
    const entries=value[name];
    if(!entries||typeof entries!=='object'||Array.isArray(entries))fail('COMPLIANCE_STATE_INVALID','Invalid compliance collection: '+name);
    for(const item of Object.values(entries))record(item);
  }
  return {products:value.products,reportingCases:value.reportingCases,aiFeatures:value.aiFeatures};
}
function empty(){return {products:{},reportingCases:{},aiFeatures:{}}}
function sleep(ms){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms)}

class InMemoryComplianceDecisionRepository {
  constructor(seed){
    this.state=seed?validateState({schemaVersion:1,...clone(seed)}):empty();
  }
  get(name,key){collection(name);const value=this.state[name][key];return value?clone(value):null}
  list(name){collection(name);return Object.values(this.state[name]).map(clone)}
  create(name,key,value){
    collection(name);record(value);
    if(this.state[name][key])fail('DUPLICATE_RECORD','Compliance evidence record already exists');
    if(value.revision!==1)fail('COMPLIANCE_STATE_INVALID','New compliance evidence must start at revision 1');
    this.state[name][key]=clone(value);return clone(value);
  }
  replace(name,key,expectedRevision,value){
    collection(name);record(value);
    const current=this.state[name][key];if(!current)fail('NOT_FOUND','Compliance evidence record not found');
    if(current.revision!==expectedRevision)fail('REVISION_CONFLICT','Compliance evidence revision conflict',{expected:expectedRevision,actual:current.revision});
    if(value.revision!==current.revision+1)fail('COMPLIANCE_STATE_INVALID','Compliance evidence revision must increment by one');
    this.state[name][key]=clone(value);return clone(value);
  }
  snapshot(){return clone(this.state)}
}

class FileComplianceDecisionRepository {
  constructor(file,{lockTimeoutMs=2000,staleLockMs=10000}={}){
    this.file=path.resolve(file);this.lockFile=this.file+'.lock';this.lockTimeoutMs=lockTimeoutMs;this.staleLockMs=staleLockMs;
    if(fs.existsSync(this.file))this.load();
  }
  load(){
    if(!fs.existsSync(this.file))return empty();
    let parsed;
    try{parsed=JSON.parse(fs.readFileSync(this.file,'utf8'))}
    catch(cause){const error=new Error('Compliance evidence state unreadable');error.code='COMPLIANCE_STATE_INVALID';error.cause=cause;throw error}
    return clone(validateState(parsed));
  }
  save(value){
    const checked=validateState({schemaVersion:1,...clone(value)});
    fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});
    const temp=this.file+'.tmp-'+process.pid+'-'+crypto.randomUUID();
    fs.writeFileSync(temp,JSON.stringify({schemaVersion:1,...checked},null,2),{encoding:'utf8',mode:0o600,flag:'wx'});
    fs.renameSync(temp,this.file);
  }
  withLock(fn){
    fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});
    const started=Date.now();let fd=null;
    while(fd===null){
      try{fd=fs.openSync(this.lockFile,'wx',0o600);fs.writeFileSync(fd,JSON.stringify({pid:process.pid,createdAt:new Date().toISOString()}))}
      catch(error){
        if(error.code!=='EEXIST')throw error;
        try{if(Date.now()-fs.statSync(this.lockFile).mtimeMs>this.staleLockMs)fs.unlinkSync(this.lockFile)}
        catch(cause){if(cause.code!=='ENOENT')throw cause}
        if(Date.now()-started>=this.lockTimeoutMs)fail('COMPLIANCE_STATE_LOCK_TIMEOUT','Compliance evidence lock timeout');
        sleep(10);
      }
    }
    try{return fn()}finally{
      try{fs.closeSync(fd)}catch{}
      try{fs.unlinkSync(this.lockFile)}catch(error){if(error.code!=='ENOENT')throw error}
    }
  }
  get(name,key){collection(name);const value=this.load()[name][key];return value?clone(value):null}
  list(name){collection(name);return Object.values(this.load()[name]).map(clone)}
  create(name,key,value){
    collection(name);record(value);
    return this.withLock(()=>{
      const state=this.load();
      if(state[name][key])fail('DUPLICATE_RECORD','Compliance evidence record already exists');
      if(value.revision!==1)fail('COMPLIANCE_STATE_INVALID','New compliance evidence must start at revision 1');
      state[name][key]=clone(value);this.save(state);return clone(value);
    });
  }
  replace(name,key,expectedRevision,value){
    collection(name);record(value);
    return this.withLock(()=>{
      const state=this.load(),current=state[name][key];
      if(!current)fail('NOT_FOUND','Compliance evidence record not found');
      if(current.revision!==expectedRevision)fail('REVISION_CONFLICT','Compliance evidence revision conflict',{expected:expectedRevision,actual:current.revision});
      if(value.revision!==current.revision+1)fail('COMPLIANCE_STATE_INVALID','Compliance evidence revision must increment by one');
      state[name][key]=clone(value);this.save(state);return clone(value);
    });
  }
  snapshot(){return this.load()}
  integrity(){this.load();return true}
}

module.exports={InMemoryComplianceDecisionRepository,FileComplianceDecisionRepository};
