'use strict';

const crypto=require('node:crypto');

function fail(code,message){const error=new Error(message);error.code=code;throw error}
function required(value,name,max=1024){
  const text=String(value??'').trim();
  if(!text||text.length>max)fail('VALIDATION_ERROR',name+' invalid');
  return text;
}
function safeFailure(error){return {code:error?.code||'INTEGRATION_ERROR',message:'Renewal planning failed'}}

class ProviderRenewalScheduler {
  constructor({
    integrationStore,reconciler,worker,leaseCoordinator,
    workerId='renewal-scheduler-'+crypto.randomUUID(),
    leaseMs=60000,maxAccounts=100,maxJobsPerAccount=100,audit=()=>{}
  }={}){
    if(!integrationStore||typeof integrationStore.listAccountRefs!=='function'||typeof integrationStore.getControlCursor!=='function'||typeof integrationStore.setControlCursor!=='function')throw new Error('Durable IntegrationStore required');
    if(!reconciler||typeof reconciler.planRenewals!=='function')throw new Error('ProviderBindingReconciler required');
    if(!worker||typeof worker.enqueue!=='function')throw new Error('RetryJobWorker required');
    if(!leaseCoordinator||typeof leaseCoordinator.claim!=='function'||typeof leaseCoordinator.release!=='function')throw new Error('Scheduler lease coordinator required');
    if(!Number.isSafeInteger(leaseMs)||leaseMs<1000||leaseMs>10*60*1000)throw new Error('leaseMs invalid');
    if(!Number.isSafeInteger(maxAccounts)||maxAccounts<1||maxAccounts>1000)throw new Error('maxAccounts invalid');
    if(!Number.isSafeInteger(maxJobsPerAccount)||maxJobsPerAccount<1||maxJobsPerAccount>1000)throw new Error('maxJobsPerAccount invalid');
    this.integrationStore=integrationStore;this.reconciler=reconciler;this.worker=worker;this.leaseCoordinator=leaseCoordinator;
    this.workerId=workerId;this.leaseMs=leaseMs;this.maxAccounts=maxAccounts;this.maxJobsPerAccount=maxJobsPerAccount;this.audit=audit;
    this.cursorName='provider-renewal-scheduler-v1';
    this.leaseKey='provider-renewal-scheduler-v1';
  }
  async sweep({before,accountLimit=this.maxAccounts,jobsPerAccount=this.maxJobsPerAccount}={}){
    const deadline=new Date(required(before,'before',256));
    if(Number.isNaN(deadline.getTime()))fail('VALIDATION_ERROR','before invalid');
    if(!Number.isSafeInteger(accountLimit)||accountLimit<1||accountLimit>this.maxAccounts)fail('VALIDATION_ERROR','accountLimit invalid');
    if(!Number.isSafeInteger(jobsPerAccount)||jobsPerAccount<1||jobsPerAccount>this.maxJobsPerAccount)fail('VALIDATION_ERROR','jobsPerAccount invalid');

    const claimed=this.leaseCoordinator.claim({jobId:this.leaseKey,workerId:this.workerId,ttlMs:this.leaseMs});
    if(!claimed)return {status:'skipped_lease',accountsScanned:0,bindingsDue:0,jobsPlanned:0,skippedInactive:0,errors:[],nextCursor:this.integrationStore.getControlCursor(this.cursorName)};

    try{
      const after=this.integrationStore.getControlCursor(this.cursorName);
      const refs=this.integrationStore.listAccountRefs({status:null,limit:accountLimit,after});
      let bindingsDue=0,jobsPlanned=0,skippedInactive=0;
      const errors=[];
      for(const ref of refs){
        const current=this.integrationStore.getStoredAccount(ref.organisationId,ref.id);
        if(!current||current.status!=='active'){skippedInactive++;continue}
        try{
          const jobs=this.reconciler.planRenewals({
            organisationId:ref.organisationId,accountId:ref.id,before:deadline.toISOString(),
            worker:this.worker,limit:jobsPerAccount
          });
          bindingsDue+=jobs.length;jobsPlanned+=jobs.length;
        }catch(error){
          errors.push({organisationId:ref.organisationId,accountId:ref.id,provider:ref.provider,error:safeFailure(error)});
        }
      }
      const nextCursor=refs.length===accountLimit
        ?refs[refs.length-1].organisationId+'\u0000'+refs[refs.length-1].id
        :null;
      this.integrationStore.setControlCursor(this.cursorName,nextCursor);
      const result={
        status:errors.length?'degraded':'ok',
        accountsScanned:refs.length,bindingsDue,jobsPlanned,skippedInactive,errors,nextCursor
      };
      this.audit({
        organisationId:null,eventType:'integration.binding.renewal_sweep',entityType:'integration-scheduler',entityId:this.leaseKey,
        payload:{status:result.status,accountsScanned:result.accountsScanned,bindingsDue,jobsPlanned,skippedInactive,errorCount:errors.length}
      });
      return result;
    }finally{
      try{this.leaseCoordinator.release({jobId:this.leaseKey,workerId:this.workerId})}catch{}
    }
  }
}

module.exports={ProviderRenewalScheduler};
