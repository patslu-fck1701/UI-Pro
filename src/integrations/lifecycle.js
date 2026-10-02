'use strict';

const crypto=require('node:crypto');
function error(code,message){const value=new Error(message);value.code=code;return value}
function stableJson(value){
  if(Array.isArray(value))return '['+value.map(stableJson).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stableJson(value[key])).join(',')+'}';
  return JSON.stringify(value);
}
class OAuthAccountLifecycle {
  constructor({secretStore,clock=()=>new Date(),audit=()=>{}}){this.secretStore=secretStore;this.clock=clock;this.audit=audit;this.accounts=new Map();}
  connect({organisationId,provider,connectionKey,accessToken,refreshToken=null,expiresAt=null,scopes=[]}){
    if(!organisationId||!provider||!connectionKey||!accessToken)throw error('VALIDATION_ERROR','OAuth account incomplete');
    const id=organisationId+':'+provider+':'+connectionKey;
    if(this.accounts.has(id)&&this.accounts.get(id).status==='active')throw error('ACCOUNT_EXISTS','OAuth account already connected');
    const access=this.secretStore.put({organisationId,purpose:'oauth-access:'+provider,value:accessToken});
    const refresh=refreshToken?this.secretStore.put({organisationId,purpose:'oauth-refresh:'+provider,value:refreshToken}):null;
    const record={id,organisationId,provider,connectionKey,accessReferenceId:access.id,refreshReferenceId:refresh?.id||null,
      expiresAt,scopes:[...new Set(scopes)],status:'active',connectedAt:this.clock().toISOString(),disconnectedAt:null};
    this.accounts.set(id,record);this.audit({organisationId,eventType:'oauth.connected',entityType:'integration-account',entityId:id,payload:{provider,scopes:record.scopes}});
    return structuredClone(record);
  }
  get(organisationId,provider,connectionKey){
    const value=this.accounts.get(organisationId+':'+provider+':'+connectionKey);
    if(!value||value.status!=='active')throw error('ACCOUNT_UNAVAILABLE','OAuth account unavailable');
    return structuredClone(value);
  }
  resolveAccess(organisationId,provider,connectionKey){
    const account=this.get(organisationId,provider,connectionKey);
    if(account.expiresAt&&new Date(account.expiresAt)<=this.clock())throw error('TOKEN_EXPIRED','OAuth access expired');
    return this.secretStore.resolve(organisationId,account.accessReferenceId);
  }
  rotate({organisationId,provider,connectionKey,accessToken,refreshToken,expiresAt}){
    const account=this.get(organisationId,provider,connectionKey),stored=this.accounts.get(account.id);
    this.secretStore.rotate(organisationId,account.accessReferenceId,accessToken);
    if(refreshToken){
      if(account.refreshReferenceId)this.secretStore.rotate(organisationId,account.refreshReferenceId,refreshToken);
      else stored.refreshReferenceId=this.secretStore.put({organisationId,purpose:'oauth-refresh:'+provider,value:refreshToken}).id;
    }
    stored.expiresAt=expiresAt||null;
    this.audit({organisationId,eventType:'oauth.rotated',entityType:'integration-account',entityId:account.id,payload:{provider}});
    return structuredClone(stored);
  }
  disconnect({organisationId,provider,connectionKey}){
    const account=this.get(organisationId,provider,connectionKey),stored=this.accounts.get(account.id);
    this.secretStore.revoke(organisationId,account.accessReferenceId);
    if(account.refreshReferenceId)this.secretStore.revoke(organisationId,account.refreshReferenceId);
    stored.status='revoked';stored.disconnectedAt=this.clock().toISOString();
    this.audit({organisationId,eventType:'oauth.disconnected',entityType:'integration-account',entityId:account.id,payload:{provider}});
    return structuredClone(stored);
  }
}
class RetryJobWorker {
  constructor({clock=()=>new Date(),maxAttempts=5,baseDelayMs=1000,audit=()=>{},stateStore=null,leaseCoordinator=null,workerId=null,leaseMs=30000}={}){
    this.clock=clock;this.maxAttempts=maxAttempts;this.baseDelayMs=baseDelayMs;this.audit=audit;this.stateStore=stateStore;
    this.leaseCoordinator=leaseCoordinator;this.workerId=workerId||'worker_'+crypto.randomUUID();this.leaseMs=leaseMs;
    this.jobs=new Map();this.keys=new Map();this.reload(true);
  }
  reload(recoverRunning=false){
    if(!this.stateStore)return;
    const saved=this.stateStore.load()?.jobs||[];this.jobs=new Map(saved.map(job=>[job.id,job]));
    this.keys=new Map(saved.map(job=>[job.organisationId+':'+job.idempotencyKey,job.id]));
    let changed=false;
    if(recoverRunning){
      for(const job of this.jobs.values()){
        if(job.status==='running'&&!(this.leaseCoordinator?.isActive(job.id))){
          job.status='retry';job.nextRetryAt=this.clock().toISOString();changed=true;
        }
      }
    }
    if(changed)this.persist();
  }
  persist(){if(this.stateStore)this.stateStore.save({jobs:[...this.jobs.values()]})}
  enqueue({organisationId,idempotencyKey,kind,payload}){
    if(!organisationId||!idempotencyKey||!kind)throw error('VALIDATION_ERROR','Job incomplete');
    if(this.stateStore)this.reload(false);
    const key=organisationId+':'+idempotencyKey;
    if(this.keys.has(key)){
      const existing=this.jobs.get(this.keys.get(key));
      if(existing.kind!==kind||stableJson(existing.payload)!==stableJson(payload||{}))throw error('IDEMPOTENCY_CONFLICT','Idempotency key already belongs to another job');
      return structuredClone(existing);
    }
    const id='job_'+crypto.randomUUID(),value={id,organisationId,idempotencyKey,kind,payload:structuredClone(payload||{}),
      status:'queued',attempts:0,nextRetryAt:this.clock().toISOString(),lastError:null,result:null};
    this.jobs.set(id,value);this.keys.set(key,id);this.persist();return structuredClone(value);
  }
  due(job){return ['queued','retry'].includes(job.status)&&new Date(job.nextRetryAt)<=this.clock()}
  async runDue(processor){
    if(this.stateStore)this.reload(true);
    const ids=[...this.jobs.values()].filter(job=>this.due(job)).map(job=>job.id),results=[];
    for(const id of ids){
      let claimed=false,heartbeat=null;
      if(this.leaseCoordinator){
        claimed=this.leaseCoordinator.claim({jobId:id,workerId:this.workerId,ttlMs:this.leaseMs});
        if(!claimed)continue;
        heartbeat=setInterval(()=>{try{this.leaseCoordinator.renew({jobId:id,workerId:this.workerId,ttlMs:this.leaseMs})}catch{}},Math.max(500,Math.floor(this.leaseMs/3)));
        heartbeat.unref?.();
      }
      try{
        if(this.stateStore)this.reload(true);
        const job=this.jobs.get(id);if(!job||!this.due(job))continue;
        job.status='running';job.attempts++;this.persist();
        try{
          job.result=structuredClone(await processor(structuredClone(job)));job.status='completed';job.nextRetryAt=null;job.lastError=null;
          this.audit({organisationId:job.organisationId,eventType:'integration.job.completed',entityType:'sync-job',entityId:job.id,payload:{kind:job.kind,attempts:job.attempts}});
        }catch(cause){
          job.lastError={code:cause.code||'INTEGRATION_ERROR',message:'Integration operation failed'};
          job.status=job.attempts>=this.maxAttempts?'dead_letter':'retry';
          job.nextRetryAt=job.status==='retry'?new Date(this.clock().getTime()+this.baseDelayMs*2**(job.attempts-1)).toISOString():null;
          this.audit({organisationId:job.organisationId,eventType:'integration.job.failed',entityType:'sync-job',entityId:job.id,payload:{kind:job.kind,attempts:job.attempts,status:job.status}});
        }
        this.persist();results.push(structuredClone(job));
      }finally{
        if(heartbeat)clearInterval(heartbeat);
        if(claimed)try{this.leaseCoordinator.release({jobId:id,workerId:this.workerId})}catch{}
      }
    }
    return results;
  }
  get(id){if(this.stateStore)this.reload(false);const value=this.jobs.get(id);return value?structuredClone(value):null}
  health(organisationId){if(this.stateStore)this.reload(false);const jobs=[...this.jobs.values()].filter(value=>value.organisationId===organisationId);
    return {queued:jobs.filter(v=>v.status==='queued').length,retry:jobs.filter(v=>v.status==='retry').length,
      running:jobs.filter(v=>v.status==='running').length,deadLetter:jobs.filter(v=>v.status==='dead_letter').length,completed:jobs.filter(v=>v.status==='completed').length}}
}
module.exports={OAuthAccountLifecycle,RetryJobWorker};
