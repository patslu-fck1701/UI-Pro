'use strict';

function fail(code,message){const error=new Error(message);error.code=code;throw error}
function required(value,name,max=4096){
  const text=String(value??'').trim();
  if(!text||text.length>max)fail('VALIDATION_ERROR',name+' invalid');
  return text;
}
function assertNoSecrets(value,path='provider result',depth=0){
  if(depth>5)fail('VALIDATION_ERROR',path+' too deep');
  if(value===null||value===undefined||typeof value==='boolean'||typeof value==='number')return;
  if(typeof value==='string'){if(value.length>8192)fail('VALIDATION_ERROR',path+' too long');return}
  if(Array.isArray(value)){value.forEach((item,index)=>assertNoSecrets(item,path+'['+index+']',depth+1));return}
  if(typeof value==='object'){
    for(const [key,item] of Object.entries(value)){
      if(/authorization|access.?token|refresh.?token|channel.?token|client.?state|password|secret|private.?key/i.test(key))fail('VALIDATION_ERROR',path+' contains secret-like field');
      assertNoSecrets(item,path+'.'+key,depth+1);
    }
    return;
  }
  fail('VALIDATION_ERROR',path+' invalid');
}

class ProviderBindingReconciler {
  constructor({bindingStore,integrationStore,microsoft,google,audit=()=>{}}={}){
    if(!bindingStore||typeof bindingStore.get!=='function'||typeof bindingStore.renew!=='function'||typeof bindingStore.stop!=='function')throw new Error('ProviderBindingStore required');
    if(!integrationStore||typeof integrationStore.getAccount!=='function')throw new Error('IntegrationStore required');
    if(!microsoft||typeof microsoft.renew!=='function'||typeof microsoft.stop!=='function')throw new Error('Microsoft subscription manager required');
    if(!google||typeof google.watch!=='function'||typeof google.stop!=='function')throw new Error('Google channel manager required');
    this.bindingStore=bindingStore;this.integrationStore=integrationStore;this.microsoft=microsoft;this.google=google;this.audit=audit;
  }
  activeAccount(organisationId,accountId){
    const account=this.integrationStore.getAccount(required(organisationId,'organisationId'),required(accountId,'accountId'));
    if(!account)fail('NOT_FOUND','Integration account not found');
    return account;
  }
  storedAccount(organisationId,accountId){
    const account=this.integrationStore.getStoredAccount(required(organisationId,'organisationId'),required(accountId,'accountId'));
    if(!account)fail('NOT_FOUND','Integration account not found');
    return account;
  }
  binding(organisationId,accountId,kind,bindingId,expectedVersion){
    if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1)fail('VALIDATION_ERROR','expectedVersion invalid');
    const value=this.bindingStore.get(organisationId,accountId,kind,required(bindingId,'bindingId',1024));
    if(!value)fail('NOT_FOUND','Provider binding not found');
    if(value.version!==expectedVersion)fail('VERSION_CONFLICT','Provider binding version changed');
    if(value.status!=='active')fail('BINDING_INACTIVE','Provider binding is not active');
    return value;
  }
  async renewMicrosoft({organisationId,accountId,bindingId,expectedVersion,expirationDateTime}){
    const account=this.activeAccount(organisationId,accountId);
    if(account.provider!=='microsoft-graph')fail('ACCOUNT_MISMATCH','Microsoft account required');
    const binding=this.binding(organisationId,accountId,'microsoft-subscription',bindingId,expectedVersion);
    const result=await this.microsoft.renew({account,subscriptionId:binding.bindingId,expirationDateTime});
    assertNoSecrets(result);
    const providerId=required(result.id||binding.bindingId,'provider subscription id',1024);
    if(providerId!==binding.bindingId)fail('PROVIDER_ID_MISMATCH','Provider subscription id changed');
    let committed;
    try{
      committed=this.bindingStore.renew({
        organisationId,accountId,kind:'microsoft-subscription',bindingId:binding.bindingId,
        expiresAt:result.expirationDateTime||expirationDateTime,expectedVersion
      });
    }catch(error){
      if(error.code==='VERSION_CONFLICT')fail('STATE_RECONCILIATION_REQUIRED','Provider renewed but durable binding version changed');
      throw error;
    }
    this.audit({organisationId,eventType:'integration.binding.reconciled',entityType:'provider-binding',entityId:binding.bindingId,
      payload:{provider:'microsoft-graph',accountId,action:'renew',version:committed.version,status:committed.status}});
    return {binding:committed,provider:{id:providerId,expirationDateTime:result.expirationDateTime||expirationDateTime}};
  }
  async stop({organisationId,accountId,kind,bindingId,expectedVersion}){
    const account=this.storedAccount(organisationId,accountId),binding=this.bindingStore.get(organisationId,accountId,kind,required(bindingId,'bindingId',1024));
    if(!binding)fail('NOT_FOUND','Provider binding not found');
    if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1)fail('VALIDATION_ERROR','expectedVersion invalid');
    if(binding.version!==expectedVersion)fail('VERSION_CONFLICT','Provider binding version changed');
    if(binding.status!=='active')return {binding};
    if(kind==='microsoft-subscription'){
      if(account.provider!=='microsoft-graph')fail('ACCOUNT_MISMATCH','Microsoft account required');
      const result=await this.microsoft.stop({account,subscriptionId:binding.bindingId});assertNoSecrets(result);
    }else if(kind==='google-channel'){
      if(account.provider!=='google-calendar')fail('ACCOUNT_MISMATCH','Google account required');
      const result=await this.google.stop({account,channelId:binding.bindingId,resourceId:binding.resourceId});assertNoSecrets(result);
    }else fail('VALIDATION_ERROR','binding kind invalid');
    let committed;
    try{
      committed=this.bindingStore.stop({organisationId,accountId,kind,bindingId:binding.bindingId,expectedVersion});
    }catch(error){
      if(error.code==='VERSION_CONFLICT')fail('STATE_RECONCILIATION_REQUIRED','Provider stopped but durable binding version changed');
      throw error;
    }
    this.audit({organisationId,eventType:'integration.binding.reconciled',entityType:'provider-binding',entityId:binding.bindingId,
      payload:{provider:binding.provider,accountId,action:'stop',version:committed.version,status:committed.status}});
    return {binding:committed};
  }
  async replaceGoogle({organisationId,accountId,bindingId,expectedVersion,address,expiration,channelId}){
    const account=this.activeAccount(organisationId,accountId);
    if(account.provider!=='google-calendar')fail('ACCOUNT_MISMATCH','Google account required');
    const oldBinding=this.binding(organisationId,accountId,'google-channel',bindingId,expectedVersion);
    const replacementId=required(channelId,'channelId',1024);
    if(replacementId===oldBinding.bindingId)fail('VALIDATION_ERROR','Replacement channel must differ from current channel');
    let replacement=this.bindingStore.get(organisationId,accountId,'google-channel',replacementId),providerWatch=false;
    if(replacement&&replacement.status!=='active')fail('BINDING_INACTIVE','Existing replacement binding is not active');
    if(!replacement){
      const providerResult=await this.google.watch({account,address,expiration,channelId:replacementId});
      assertNoSecrets(providerResult);
      if(required(providerResult.id,'provider channel id',1024)!==replacementId)fail('PROVIDER_ID_MISMATCH','Provider channel id changed');
      replacement=this.bindingStore.create({
        organisationId,accountId,kind:'google-channel',
        binding:{id:providerResult.id,resourceId:providerResult.resourceId,resourceUri:providerResult.resourceUri,expiration:providerResult.expiration}
      });
      providerWatch=true;
    }
    let stoppedProvider;
    try{
      stoppedProvider=await this.google.stop({account,channelId:oldBinding.bindingId,resourceId:oldBinding.resourceId});
      assertNoSecrets(stoppedProvider);
    }catch(error){
      this.audit({organisationId,eventType:'integration.binding.reconcile_partial',entityType:'provider-binding',entityId:oldBinding.bindingId,
        payload:{provider:'google-calendar',accountId,action:'replace',replacementBindingId:replacement.bindingId,status:'old_stop_failed'}});
      return {status:'replacement_active_old_stop_failed',binding:replacement,replaced:oldBinding,providerWatch,error:{code:error.code||'INTEGRATION_ERROR',message:'Provider binding reconciliation failed'}};
    }
    let stoppedOld;
    try{
      stoppedOld=this.bindingStore.stop({
        organisationId,accountId,kind:'google-channel',bindingId:oldBinding.bindingId,expectedVersion
      });
    }catch(error){
      if(error.code==='VERSION_CONFLICT')fail('STATE_RECONCILIATION_REQUIRED','Provider old channel stopped but durable binding version changed');
      throw error;
    }
    this.audit({organisationId,eventType:'integration.binding.reconciled',entityType:'provider-binding',entityId:oldBinding.bindingId,
      payload:{provider:'google-calendar',accountId,action:'replace',version:stoppedOld.version,status:stoppedOld.status,replacementBindingId:replacement.bindingId}});
    return {status:'replaced',binding:replacement,replaced:stoppedOld,providerWatch};
  }
  planRenewals({organisationId,accountId,before,worker,limit=100}){
    if(!worker||typeof worker.enqueue!=='function')throw new Error('RetryJobWorker required');
    if(!Number.isSafeInteger(limit)||limit<1||limit>1000)fail('VALIDATION_ERROR','renewal plan limit invalid');
    const due=this.bindingStore.listRenewalDue({organisationId,accountId,before}).slice(0,limit);
    return due.map(binding=>worker.enqueue({
      organisationId:binding.organisationId,
      idempotencyKey:'binding-renew:'+binding.integrationAccountId+':'+binding.kind+':'+binding.bindingId+':v'+binding.version,
      kind:'integration.binding.renew',
      payload:{
        integrationAccountId:binding.integrationAccountId,
        provider:binding.provider,
        bindingKind:binding.kind,
        bindingId:binding.bindingId,
        expectedVersion:binding.version,
        expiresAt:binding.expiresAt
      }
    }));
  }
}

module.exports={ProviderBindingReconciler};
