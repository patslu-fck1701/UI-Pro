'use strict';

function error(code,message){const value=new Error(message);value.code=code;return value}
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
  constructor({clock=()=>new Date(),maxAttempts=5,baseDelayMs=1000,audit=()=>{}}={}){
    this.clock=clock;this.maxAttempts=maxAttempts;this.baseDelayMs=baseDelayMs;this.audit=audit;this.jobs=new Map();this.keys=new Map();
  }
  enqueue({organisationId,idempotencyKey,kind,payload}){
    if(!organisationId||!idempotencyKey||!kind)throw error('VALIDATION_ERROR','Job incomplete');
    const key=organisationId+':'+idempotencyKey;
    if(this.keys.has(key)){
      const existing=this.jobs.get(this.keys.get(key));
      if(existing.kind!==kind||JSON.stringify(existing.payload)!==JSON.stringify(payload||{}))throw error('IDEMPOTENCY_CONFLICT','Idempotency key already belongs to another job');
      return structuredClone(existing);
    }
    const id='job_'+(this.jobs.size+1),value={id,organisationId,idempotencyKey,kind,payload:structuredClone(payload||{}),
      status:'queued',attempts:0,nextRetryAt:this.clock().toISOString(),lastError:null,result:null};
    this.jobs.set(id,value);this.keys.set(key,id);return structuredClone(value);
  }
  async runDue(processor){
    const results=[];
    for(const job of this.jobs.values()){
      if(!['queued','retry'].includes(job.status)||new Date(job.nextRetryAt)>this.clock())continue;
      job.status='running';job.attempts++;
      try{job.result=structuredClone(await processor(structuredClone(job)));job.status='completed';job.nextRetryAt=null;job.lastError=null;
        this.audit({organisationId:job.organisationId,eventType:'integration.job.completed',entityType:'sync-job',entityId:job.id,payload:{kind:job.kind,attempts:job.attempts}});
      }catch(cause){
        job.lastError={code:cause.code||'INTEGRATION_ERROR',message:'Integration operation failed'};
        job.status=job.attempts>=this.maxAttempts?'dead_letter':'retry';
        job.nextRetryAt=job.status==='retry'?new Date(this.clock().getTime()+this.baseDelayMs*2**(job.attempts-1)).toISOString():null;
        this.audit({organisationId:job.organisationId,eventType:'integration.job.failed',entityType:'sync-job',entityId:job.id,payload:{kind:job.kind,attempts:job.attempts,status:job.status}});
      }
      results.push(structuredClone(job));
    }
    return results;
  }
  get(id){const value=this.jobs.get(id);return value?structuredClone(value):null}
  health(organisationId){const jobs=[...this.jobs.values()].filter(value=>value.organisationId===organisationId);
    return {queued:jobs.filter(v=>v.status==='queued').length,retry:jobs.filter(v=>v.status==='retry').length,
      deadLetter:jobs.filter(v=>v.status==='dead_letter').length,completed:jobs.filter(v=>v.status==='completed').length}}
}
module.exports={OAuthAccountLifecycle,RetryJobWorker};
