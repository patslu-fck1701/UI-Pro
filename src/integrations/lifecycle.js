'use strict';

const crypto=require('node:crypto');
function error(code,message){const value=new Error(message);value.code=code;return value}
function stableJson(value){
  if(Array.isArray(value))return '['+value.map(stableJson).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stableJson(value[key])).join(',')+'}';
  return JSON.stringify(value);
}
function requiredText(value,name,max=512){
  const text=String(value??'').trim();
  if(!text||text.length>max)throw error('VALIDATION_ERROR',name+' invalid');
  return text;
}
function assertNotificationSafe(value,path='notification'){
  if(value===null||value===undefined||typeof value!=='object')return;
  if(Array.isArray(value)){for(let i=0;i<value.length;i++)assertNotificationSafe(value[i],path+'['+i+']');return;}
  for(const [key,item] of Object.entries(value)){
    if(/authorization|token|secret|clientstate|password|credential/i.test(key))throw error('VALIDATION_ERROR',path+' contains secret-like field');
    assertNotificationSafe(item,path+'.'+key);
  }
}
class VerifiedNotificationDispatcher {
  constructor({store,worker,audit=()=>{}}={}){
    if(!store||typeof store.resolve!=='function'||typeof store.event!=='function')throw new Error('Integration store required');
    if(!worker||typeof worker.enqueue!=='function')throw new Error('Retry job worker required');
    this.store=store;this.worker=worker;this.audit=audit;
  }
  dispatch({provider,connectionKey,deliveryKey,notifications,eventType='calendar.notification'}){
    const providerName=requiredText(provider,'provider',128),connection=requiredText(connectionKey,'connectionKey',512);
    const delivery=requiredText(deliveryKey,'deliveryKey',2048),type=requiredText(eventType,'eventType',128);
    if(!Array.isArray(notifications)||notifications.length<1||notifications.length>100)throw error('VALIDATION_ERROR','notifications batch invalid');
    const account=this.store.resolve(providerName,connection);
    if(!account)throw error('NOT_FOUND','Integration account not found');
    const digest=crypto.createHash('sha256').update(delivery).digest('hex'),jobs=[];
    notifications.forEach((notification,index)=>{
      if(!notification||typeof notification!=='object'||Array.isArray(notification))throw error('VALIDATION_ERROR','notification invalid');
      assertNotificationSafe(notification);
      const externalEventId='delivery:'+digest+':'+index;
      const stored=this.store.event(account,{
        externalEventId,eventType:type,correlationId:'notification:'+account.id+':'+digest,
        metadata:{provider:providerName,notification:structuredClone(notification)}
      });
      const job=this.worker.enqueue({
        organisationId:account.organisationId,
        idempotencyKey:'notification:'+account.id+':'+digest+':'+index,
        kind:'integration.notification',
        payload:{integrationAccountId:account.id,provider:providerName,eventType:type,externalEventId}
      });
      jobs.push({eventId:stored.event.id,jobId:job.id,duplicate:stored.duplicate});
    });
    this.audit({
      organisationId:account.organisationId,eventType:'integration.notification.dispatched',
      entityType:'integration-account',entityId:account.id,
      payload:{provider:providerName,eventType:type,count:jobs.length,duplicates:jobs.filter(item=>item.duplicate).length}
    });
    return {accepted:true,organisationId:account.organisationId,accountId:account.id,jobs};
  }
}
class SyncCheckpointStore {
  constructor({stateStore,clock=()=>new Date()}={}){
    if(!stateStore||typeof stateStore.load!=='function'||typeof stateStore.save!=='function')throw new Error('Sync checkpoint state store required');
    this.stateStore=stateStore;this.clock=clock;
  }
  key(organisationId,accountId){return JSON.stringify([requiredText(organisationId,'organisationId',512),requiredText(accountId,'accountId',512)])}
  transaction(fn){
    if(typeof this.stateStore.update==='function')return this.stateStore.update(fn);
    const value=this.stateStore.load(),result=fn(value);this.stateStore.save(value);return result;
  }
  get(organisationId,accountId){
    const value=this.stateStore.load().checkpoints?.[this.key(organisationId,accountId)];
    return value?structuredClone(value):null;
  }
  begin({organisationId,accountId,runId,window}){
    const key=this.key(organisationId,accountId),run=requiredText(runId,'runId',2048);
    const normalizedWindow={
      from:requiredText(window?.from,'window.from',128),
      to:requiredText(window?.to,'window.to',128),
      limit:window?.limit===undefined?100:Number(window.limit)
    };
    if(!Number.isSafeInteger(normalizedWindow.limit)||normalizedWindow.limit<1||normalizedWindow.limit>1000)throw error('VALIDATION_ERROR','window.limit invalid');
    return this.transaction(state=>{
      state.checkpoints=state.checkpoints||{};
      const existing=state.checkpoints[key];
      if(existing?.runId===run){
        if(stableJson(existing.window)!==stableJson(normalizedWindow))throw error('CHECKPOINT_CONFLICT','Sync window changed for existing run');
        return structuredClone(existing);
      }
      if(existing?.status==='active')throw error('SYNC_IN_PROGRESS','Another sync run is active for this account');
      const now=this.clock().toISOString(),value={
        organisationId:requiredText(organisationId,'organisationId',512),
        integrationAccountId:requiredText(accountId,'accountId',512),
        runId:run,status:'active',cursor:null,pageCount:0,window:normalizedWindow,
        version:(existing?.version||0)+1,startedAt:now,updatedAt:now,completedAt:null
      };
      state.checkpoints[key]=value;return structuredClone(value);
    });
  }
  commitPage({organisationId,accountId,runId,expectedCursor=null,nextCursor=null}){
    const key=this.key(organisationId,accountId),run=requiredText(runId,'runId',2048);
    const expected=expectedCursor===null?null:requiredText(expectedCursor,'expectedCursor',8192);
    const next=nextCursor===null||nextCursor===undefined?null:requiredText(nextCursor,'nextCursor',8192);
    if(next!==null&&next===expected)throw error('PAGINATION_LOOP','Provider cursor did not advance');
    return this.transaction(state=>{
      state.checkpoints=state.checkpoints||{};
      const current=state.checkpoints[key];
      if(!current||current.runId!==run||current.status!=='active')throw error('CHECKPOINT_CONFLICT','Sync checkpoint unavailable');
      if(current.cursor!==expected)throw error('CHECKPOINT_CONFLICT','Sync checkpoint moved');
      const now=this.clock().toISOString();
      current.cursor=next;current.pageCount++;current.version++;current.updatedAt=now;
      if(next===null){current.status='completed';current.completedAt=now}
      return structuredClone(current);
    });
  }
}

class NotificationSyncProcessor {
  constructor({store,registry,checkpointStore,resolveWindow,processPage,maxPages=100,audit=()=>{}}={}){
    if(!store||typeof store.getAccount!=='function')throw new Error('Tenant-scoped integration store required');
    if(!registry||typeof registry.get!=='function')throw new Error('Connector registry required');
    if(!checkpointStore||typeof checkpointStore.begin!=='function'||typeof checkpointStore.commitPage!=='function')throw new Error('Sync checkpoint store required');
    if(typeof resolveWindow!=='function'||typeof processPage!=='function')throw new Error('resolveWindow and processPage required');
    if(!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>1000)throw new Error('maxPages invalid');
    this.store=store;this.registry=registry;this.checkpointStore=checkpointStore;this.resolveWindow=resolveWindow;this.processPage=processPage;this.maxPages=maxPages;this.audit=audit;
  }
  async process(job){
    if(job?.kind!=='integration.notification')throw error('UNSUPPORTED_JOB','Notification sync job required');
    const organisationId=requiredText(job.organisationId,'organisationId',512);
    const accountId=requiredText(job.payload?.integrationAccountId,'integrationAccountId',512);
    const account=this.store.getAccount(organisationId,accountId);
    if(!account)throw error('NOT_FOUND','Integration account not found');
    const provider=requiredText(job.payload?.provider,'provider',128);
    if(provider!==account.provider)throw error('ACCOUNT_MISMATCH','Job provider does not match integration account');
    const connector=this.registry.get(account.provider);
    const requested=await this.resolveWindow({account:structuredClone(account),job:structuredClone(job)});
    const window={
      from:requiredText(requested?.from,'window.from',128),
      to:requiredText(requested?.to,'window.to',128),
      limit:requested?.limit===undefined?100:Number(requested.limit)
    };
    if(!Number.isSafeInteger(window.limit)||window.limit<1||window.limit>1000)throw error('VALIDATION_ERROR','window.limit invalid');
    const runId=requiredText(job.idempotencyKey||job.id,'job run identity',2048);
    let checkpoint=this.checkpointStore.begin({organisationId,accountId,runId,window});
    if(checkpoint.status==='completed')return {status:'completed',replay:true,pages:checkpoint.pageCount,items:0};
    let cursor=checkpoint.cursor,totalItems=0;
    for(let pageIndex=0;pageIndex<this.maxPages;pageIndex++){
      const page=await connector.pull({account,from:window.from,to:window.to,limit:window.limit,cursor});
      if(!page||!Array.isArray(page.items))throw error('INTEGRATION_ERROR','Provider page invalid');
      const nextCursor=page.nextCursor===undefined||page.nextCursor===null?null:requiredText(page.nextCursor,'nextCursor',8192);
      if(nextCursor!==null&&nextCursor===cursor)throw error('PAGINATION_LOOP','Provider cursor did not advance');
      await this.processPage({
        account:structuredClone(account),job:structuredClone(job),items:structuredClone(page.items),
        pageNumber:checkpoint.pageCount+1,cursor,nextCursor
      });
      checkpoint=this.checkpointStore.commitPage({organisationId,accountId,runId,expectedCursor:cursor,nextCursor});
      totalItems+=page.items.length;
      this.audit({
        organisationId,eventType:'integration.sync.page.committed',entityType:'integration-account',entityId:accountId,
        payload:{provider:account.provider,pageNumber:checkpoint.pageCount,itemCount:page.items.length,completed:checkpoint.status==='completed'}
      });
      if(checkpoint.status==='completed')return {status:'completed',replay:false,pages:checkpoint.pageCount,items:totalItems};
      cursor=checkpoint.cursor;
    }
    throw error('PAGINATION_LIMIT','Maximum provider pages reached before completion');
  }
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
          const retryable=cause?.retryable!==false;
          job.status=!retryable||job.attempts>=this.maxAttempts?'dead_letter':'retry';
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
module.exports={OAuthAccountLifecycle,RetryJobWorker,VerifiedNotificationDispatcher,SyncCheckpointStore,NotificationSyncProcessor};
