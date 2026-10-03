'use strict';

const crypto=require('node:crypto');

function fail(code,message,{retryable=false}={}){
  const error=new Error(message);error.code=code;error.retryable=retryable;throw error;
}
function required(value,name,max=4096){
  const text=String(value??'').trim();
  if(!text||text.length>max)fail('VALIDATION_ERROR',name+' invalid');
  return text;
}
function permanent(error){
  if(error&&['VALIDATION_ERROR','VERSION_CONFLICT','NOT_FOUND','ACCOUNT_MISMATCH','BINDING_INACTIVE','BINDING_STOPPED','PROVIDER_ID_MISMATCH','UNSUPPORTED_JOB','STATE_RECONCILIATION_REQUIRED','BINDING_STATE_INVALID'].includes(error.code))error.retryable=false;
  return error;
}
function replacementId(job){
  return 'werkz-'+crypto.createHash('sha256').update(required(job.idempotencyKey,'idempotencyKey',2048)).digest('hex').slice(0,32);
}

class ProviderMaintenanceJobProcessor {
  constructor({integrationStore,bindingStore,reconciler,policy,audit=()=>{}}={}){
    if(!integrationStore||typeof integrationStore.getStoredAccount!=='function')throw new Error('IntegrationStore required');
    if(!bindingStore||typeof bindingStore.get!=='function')throw new Error('ProviderBindingStore required');
    if(!reconciler||typeof reconciler.renewMicrosoft!=='function'||typeof reconciler.replaceGoogle!=='function')throw new Error('ProviderBindingReconciler required');
    if(!policy||typeof policy!=='object')throw new Error('Provider maintenance policy required');
    this.integrationStore=integrationStore;this.bindingStore=bindingStore;this.reconciler=reconciler;this.policy=policy;this.audit=audit;
  }
  async process(job){
    try{return await this._process(job)}catch(error){throw permanent(error)}
  }
  async _process(job){
    if(job?.kind!=='integration.binding.renew')fail('UNSUPPORTED_JOB','Binding renewal job required');
    const organisationId=required(job.organisationId,'organisationId',512);
    const accountId=required(job.payload?.integrationAccountId,'integrationAccountId',512);
    const provider=required(job.payload?.provider,'provider',128);
    const kind=required(job.payload?.bindingKind,'bindingKind',128);
    const bindingId=required(job.payload?.bindingId,'bindingId',1024);
    const expected=Number(job.payload?.expectedVersion);
    if(!Number.isSafeInteger(expected)||expected<1)fail('VALIDATION_ERROR','expectedVersion invalid');

    const storedAccount=this.integrationStore.getStoredAccount(organisationId,accountId);
    if(!storedAccount)fail('NOT_FOUND','Integration account not found');
    if(storedAccount.provider!==provider)fail('ACCOUNT_MISMATCH','Job provider does not match integration account');
    if(storedAccount.status!=='active'){
      return {status:'skipped_inactive',provider,kind,bindingId,accountId};
    }

    const binding=this.bindingStore.get(organisationId,accountId,kind,bindingId);
    if(!binding)fail('NOT_FOUND','Provider binding not found');
    if(binding.provider!==provider)fail('ACCOUNT_MISMATCH','Binding provider does not match job');
    if(binding.status!=='active'){
      if(binding.version===expected+1&&binding.status==='stopped')return {status:'already_completed',provider,kind,bindingId,accountId,version:binding.version};
      fail('BINDING_INACTIVE','Provider binding is not active');
    }

    if(kind==='microsoft-subscription'){
      if(provider!=='microsoft-graph')fail('ACCOUNT_MISMATCH','Microsoft renewal job provider mismatch');
      if(typeof this.policy.microsoft!=='function')fail('VALIDATION_ERROR','Microsoft renewal policy missing');
      const plan=await this.policy.microsoft({account:structuredClone(storedAccount),binding:structuredClone(binding),job:structuredClone(job)});
      const expirationDateTime=required(plan?.expirationDateTime,'expirationDateTime',256);
      const normalizedTarget=new Date(expirationDateTime);
      if(Number.isNaN(normalizedTarget.getTime()))fail('VALIDATION_ERROR','expirationDateTime invalid');

      if(binding.version===expected+1&&new Date(binding.expiresAt).getTime()===normalizedTarget.getTime()){
        return {status:'already_completed',provider,kind,bindingId,accountId,version:binding.version};
      }
      if(binding.version!==expected)fail('VERSION_CONFLICT','Provider binding version changed');

      const result=await this.reconciler.renewMicrosoft({
        organisationId,accountId,bindingId,expectedVersion:expected,expirationDateTime
      });
      const output={status:'renewed',provider,kind,bindingId,accountId,version:result.binding.version,expiresAt:result.binding.expiresAt};
      this.audit({organisationId,eventType:'integration.binding.maintenance.completed',entityType:'provider-binding',entityId:bindingId,
        payload:{provider,accountId,kind,status:output.status,version:output.version}});
      return output;
    }

    if(kind==='google-channel'){
      if(provider!=='google-calendar')fail('ACCOUNT_MISMATCH','Google renewal job provider mismatch');
      if(typeof this.policy.google!=='function')fail('VALIDATION_ERROR','Google renewal policy missing');
      const plan=await this.policy.google({account:structuredClone(storedAccount),binding:structuredClone(binding),job:structuredClone(job)});
      const channelId=plan?.channelId?required(plan.channelId,'channelId',1024):replacementId(job);
      const replacement=this.bindingStore.get(organisationId,accountId,'google-channel',channelId);

      if(binding.version===expected+1&&binding.status==='stopped'&&replacement?.status==='active'){
        return {status:'already_completed',provider,kind,bindingId,accountId,version:binding.version,replacementBindingId:replacement.bindingId};
      }
      if(binding.version!==expected)fail('VERSION_CONFLICT','Provider binding version changed');

      const result=await this.reconciler.replaceGoogle({
        organisationId,accountId,bindingId,expectedVersion:expected,
        address:required(plan?.address,'address',8192),
        expiration:plan?.expiration??null,
        channelId
      });
      if(result.status==='replacement_active_old_stop_failed'){
        fail('PROVIDER_RECONCILIATION_PARTIAL','Replacement active but old channel stop must be retried',{retryable:true});
      }
      const output={status:'replaced',provider,kind,bindingId,accountId,version:result.replaced.version,replacementBindingId:result.binding.bindingId};
      this.audit({organisationId,eventType:'integration.binding.maintenance.completed',entityType:'provider-binding',entityId:bindingId,
        payload:{provider,accountId,kind,status:output.status,version:output.version,replacementBindingId:output.replacementBindingId}});
      return output;
    }

    fail('VALIDATION_ERROR','Unsupported binding kind');
  }
}

module.exports={ProviderMaintenanceJobProcessor};
