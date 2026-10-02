'use strict';

const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');

function sleep(ms){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms)}
class FileRetryJobState {
  constructor(file){this.file=path.resolve(file)}
  load(){
    if(!fs.existsSync(this.file))return {jobs:[]};
    const value=JSON.parse(fs.readFileSync(this.file,'utf8'));
    if(value.schemaVersion!==1||!Array.isArray(value.jobs))throw new Error('Unsupported retry job state');
    return {jobs:value.jobs};
  }
  save(value){
    fs.mkdirSync(path.dirname(this.file),{recursive:true});
    const temp=this.file+'.tmp-'+crypto.randomUUID();
    fs.writeFileSync(temp,JSON.stringify({schemaVersion:1,jobs:value.jobs}),{mode:0o600,flag:'wx'});
    fs.renameSync(temp,this.file);
  }
}
class FileJobLeaseCoordinator {
  constructor(file,{clock=()=>new Date(),lockTimeoutMs=2000,staleLockMs=10000}={}){
    this.file=path.resolve(file);this.lockFile=this.file+'.lock';this.clock=clock;this.lockTimeoutMs=lockTimeoutMs;this.staleLockMs=staleLockMs;
  }
  load(){
    if(!fs.existsSync(this.file))return {leases:{}};
    const value=JSON.parse(fs.readFileSync(this.file,'utf8'));
    if(value.schemaVersion!==1||!value.leases||typeof value.leases!=='object'||Array.isArray(value.leases))throw new Error('Unsupported retry lease state');
    return {leases:value.leases};
  }
  save(value){
    fs.mkdirSync(path.dirname(this.file),{recursive:true});
    const temp=this.file+'.tmp-'+crypto.randomUUID();
    fs.writeFileSync(temp,JSON.stringify({schemaVersion:1,leases:value.leases}),{mode:0o600,flag:'wx'});
    fs.renameSync(temp,this.file);
  }
  withLock(fn){
    fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});
    const started=Date.now();let fd=null;
    while(fd===null){
      try{fd=fs.openSync(this.lockFile,'wx',0o600);fs.writeFileSync(fd,JSON.stringify({pid:process.pid,createdAt:new Date().toISOString()}))}
      catch(error){
        if(error.code!=='EEXIST')throw error;
        try{if(Date.now()-fs.statSync(this.lockFile).mtimeMs>this.staleLockMs)fs.unlinkSync(this.lockFile)}catch(cause){if(cause.code!=='ENOENT')throw cause}
        if(Date.now()-started>=this.lockTimeoutMs)throw Object.assign(new Error('Retry lease lock timeout'),{code:'LEASE_LOCK_TIMEOUT'});
        sleep(10);
      }
    }
    try{return fn()}finally{
      try{fs.closeSync(fd)}catch{}
      try{fs.unlinkSync(this.lockFile)}catch(error){if(error.code!=='ENOENT')throw error}
    }
  }
  purgeExpired(value,now=this.clock()){
    for(const [jobId,lease] of Object.entries(value.leases))if(new Date(lease.expiresAt)<=now)delete value.leases[jobId];
  }
  claim({jobId,workerId,ttlMs=30000}){
    if(!jobId||!workerId||!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>10*60*1000)throw new Error('Invalid retry lease claim');
    return this.withLock(()=>{
      const value=this.load(),now=this.clock();this.purgeExpired(value,now);
      const existing=value.leases[jobId];
      if(existing&&existing.workerId!==workerId)return false;
      value.leases[jobId]={workerId,claimedAt:existing?.claimedAt||now.toISOString(),expiresAt:new Date(now.getTime()+ttlMs).toISOString()};
      this.save(value);return true;
    });
  }
  renew({jobId,workerId,ttlMs=30000}){
    return this.withLock(()=>{
      const value=this.load(),now=this.clock();this.purgeExpired(value,now);
      const existing=value.leases[jobId];if(!existing||existing.workerId!==workerId)return false;
      existing.expiresAt=new Date(now.getTime()+ttlMs).toISOString();this.save(value);return true;
    });
  }
  release({jobId,workerId}){
    return this.withLock(()=>{
      const value=this.load(),existing=value.leases[jobId];
      if(!existing||existing.workerId!==workerId)return false;
      delete value.leases[jobId];this.save(value);return true;
    });
  }
  isActive(jobId){
    const value=this.load(),lease=value.leases[jobId];
    return Boolean(lease&&new Date(lease.expiresAt)>this.clock());
  }
}
class FileOAuthFlowState {
  constructor(file){this.file=path.resolve(file)}
  load(){
    if(!fs.existsSync(this.file))return {pending:[]};
    const value=JSON.parse(fs.readFileSync(this.file,'utf8'));
    if(value.schemaVersion!==1||!Array.isArray(value.pending))throw new Error('Unsupported OAuth flow state');
    return {pending:value.pending};
  }
  save(value){
    fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});
    const temp=this.file+'.tmp-'+crypto.randomUUID();
    fs.writeFileSync(temp,JSON.stringify({schemaVersion:1,pending:value.pending}),{mode:0o600,flag:'wx'});
    fs.renameSync(temp,this.file);
  }
}
module.exports={FileRetryJobState,FileJobLeaseCoordinator,FileOAuthFlowState};
