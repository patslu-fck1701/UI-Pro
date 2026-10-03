'use strict';

function fail(code,message){const error=new Error(message);error.code=code;throw error}
function required(value,name,max=4096){
  const text=String(value??'').trim();
  if(!text||text.length>max)fail('VALIDATION_ERROR',name+' invalid');
  return text;
}
function assertNoSecrets(value,path='binding',depth=0){
  if(depth>5)fail('VALIDATION_ERROR',path+' too deep');
  if(value===null||value===undefined||typeof value==='boolean'||typeof value==='number')return;
  if(typeof value==='string'){if(value.length>8192)fail('VALIDATION_ERROR',path+' too long');return}
  if(Array.isArray(value)){if(value.length>128)fail('VALIDATION_ERROR',path+' too large');value.forEach((item,index)=>assertNoSecrets(item,path+'['+index+']',depth+1));return}
  if(typeof value==='object'){
    for(const [key,item] of Object.entries(value)){
      if(/authorization|access.?token|refresh.?token|channel.?token|client.?state|password|secret|private.?key/i.test(key))fail('VALIDATION_ERROR',path+' contains secret-like field');
      assertNoSecrets(item,path+'.'+key,depth+1);
    }
    return;
  }
  fail('VALIDATION_ERROR',path+' invalid');
}
function expiration(value,name='expiresAt'){
  const text=required(value,name,256);
  const date=/^\d+$/.test(text)?new Date(Number(text)):new Date(text);
  if(Number.isNaN(date.getTime()))fail('VALIDATION_ERROR',name+' invalid');
  return date.toISOString();
}
function safeHttpsUrl(value,name){
  if(value===null||value===undefined||value==='')return null;
  const url=new URL(required(value,name,8192));
  if(url.protocol!=='https:'||url.username||url.password)fail('VALIDATION_ERROR',name+' invalid');
  for(const key of url.searchParams.keys())if(/token|secret|password|key|auth/i.test(key))fail('VALIDATION_ERROR',name+' contains secret-like query');
  return url.toString();
}
function expectedProvider(kind){
  if(kind==='microsoft-subscription')return 'microsoft-graph';
  if(kind==='google-channel')return 'google-calendar';
  fail('VALIDATION_ERROR','binding kind invalid');
}

class ProviderBindingStore {
  constructor({stateStore,integrationStore,clock=()=>new Date(),audit=()=>{}}={}){
    if(!stateStore||typeof stateStore.load!=='function'||typeof stateStore.save!=='function')throw new Error('Provider binding state store required');
    if(!integrationStore||typeof integrationStore.getStoredAccount!=='function'||typeof integrationStore.getAccount!=='function')throw new Error('Integration store required');
    this.stateStore=stateStore;this.integrationStore=integrationStore;this.clock=clock;this.audit=audit;
    this.read();
  }
  read(){
    const state=this.stateStore.load();
    if(!state?.bindings||typeof state.bindings!=='object'||Array.isArray(state.bindings))fail('BINDING_STATE_INVALID','Provider binding state invalid');
    for(const record of Object.values(state.bindings))this.validateRecord(record);
    return state;
  }
  validateRecord(record){
    if(!record||typeof record!=='object'||Array.isArray(record))fail('BINDING_STATE_INVALID','Provider binding record invalid');
    assertNoSecrets(record,'binding');
    required(record.organisationId,'binding.organisationId');
    required(record.integrationAccountId,'binding.integrationAccountId');
    required(record.provider,'binding.provider');
    required(record.kind,'binding.kind');
    required(record.bindingId,'binding.bindingId');
    if(record.provider!==expectedProvider(record.kind))fail('BINDING_STATE_INVALID','Provider binding provider mismatch');
    if(!['active','stopped','expired'].includes(record.status))fail('BINDING_STATE_INVALID','Provider binding status invalid');
    if(!Number.isSafeInteger(record.version)||record.version<1)fail('BINDING_STATE_INVALID','Provider binding version invalid');
    if(record.expiresAt)expiration(record.expiresAt);
    return record;
  }
  key(account,kind,bindingId){return JSON.stringify([account.organisationId,account.id,account.provider,kind,bindingId])}
  transaction(fn){
    if(typeof this.stateStore.update==='function'){
      return this.stateStore.update(state=>{
        if(!state.bindings||typeof state.bindings!=='object'||Array.isArray(state.bindings))fail('BINDING_STATE_INVALID','Provider binding state invalid');
        for(const record of Object.values(state.bindings))this.validateRecord(record);
        return fn(state);
      });
    }
    const state=this.read(),result=fn(state);this.stateStore.save(state);return structuredClone(result);
  }
  activeAccount(organisationId,accountId,provider){
    const account=this.integrationStore.getAccount(required(organisationId,'organisationId'),required(accountId,'accountId'));
    if(!account)fail('NOT_FOUND','Integration account not found');
    if(account.provider!==provider)fail('ACCOUNT_MISMATCH','Integration account provider mismatch');
    return account;
  }
  storedAccount(organisationId,accountId,provider){
    const account=this.integrationStore.getStoredAccount(required(organisationId,'organisationId'),required(accountId,'accountId'));
    if(!account)fail('NOT_FOUND','Integration account not found');
    if(account.provider!==provider)fail('ACCOUNT_MISMATCH','Integration account provider mismatch');
    return account;
  }
  create({organisationId,accountId,kind,binding}){
    assertNoSecrets(binding,'binding input');
    const provider=expectedProvider(kind),account=this.activeAccount(organisationId,accountId,provider),now=this.clock();
    let bindingId,resource=null,resourceId=null,resourceUri=null,expiresAt;
    if(kind==='microsoft-subscription'){
      bindingId=required(binding?.id,'subscription.id',1024);
      resource=binding?.resource?required(binding.resource,'subscription.resource',4096):null;
      expiresAt=expiration(binding?.expirationDateTime,'subscription.expirationDateTime');
    }else{
      bindingId=required(binding?.id,'channel.id',1024);
      resourceId=required(binding?.resourceId,'channel.resourceId',2048);
      resourceUri=safeHttpsUrl(binding?.resourceUri,'channel.resourceUri');
      expiresAt=expiration(binding?.expiration,'channel.expiration');
    }
    if(new Date(expiresAt)<=now)fail('VALIDATION_ERROR','binding expiration must be in the future');
    const key=this.key(account,kind,bindingId);
    return this.transaction(state=>{
      if(state.bindings[key])fail('BINDING_EXISTS','Provider binding already exists');
      const timestamp=this.clock().toISOString(),record={
        organisationId:account.organisationId,integrationAccountId:account.id,provider,kind,bindingId,
        resource,resourceId,resourceUri,expiresAt,status:'active',version:1,
        createdAt:timestamp,updatedAt:timestamp,stoppedAt:null,expiredAt:null
      };
      state.bindings[key]=record;
      this.audit({organisationId:account.organisationId,eventType:'integration.binding.created',entityType:'provider-binding',entityId:bindingId,
        payload:{provider,accountId:account.id,kind,status:'active',version:1,expiresAt}});
      return structuredClone(record);
    });
  }
  get(organisationId,accountId,kind,bindingId){
    const provider=expectedProvider(kind),account=this.storedAccount(organisationId,accountId,provider),state=this.read();
    const value=state.bindings[this.key(account,kind,required(bindingId,'bindingId',1024))];
    return value?structuredClone(value):null;
  }
  list(organisationId,accountId){
    const account=this.integrationStore.getStoredAccount(required(organisationId,'organisationId'),required(accountId,'accountId'));
    if(!account)fail('NOT_FOUND','Integration account not found');
    return Object.values(this.read().bindings)
      .filter(record=>record.organisationId===account.organisationId&&record.integrationAccountId===account.id)
      .sort((a,b)=>a.kind.localeCompare(b.kind)||a.bindingId.localeCompare(b.bindingId))
      .map(record=>structuredClone(record));
  }
  renew({organisationId,accountId,kind,bindingId,expiresAt,expectedVersion}){
    const provider=expectedProvider(kind),account=this.activeAccount(organisationId,accountId,provider);
    if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1)fail('VALIDATION_ERROR','expectedVersion invalid');
    const nextExpiration=expiration(expiresAt);
    if(new Date(nextExpiration)<=this.clock())fail('VALIDATION_ERROR','binding expiration must be in the future');
    const key=this.key(account,kind,required(bindingId,'bindingId',1024));
    return this.transaction(state=>{
      const record=state.bindings[key];
      if(!record)fail('NOT_FOUND','Provider binding not found');
      if(record.version!==expectedVersion)fail('VERSION_CONFLICT','Provider binding version changed');
      if(record.status==='stopped')fail('BINDING_STOPPED','Stopped binding cannot be renewed');
      record.expiresAt=nextExpiration;record.status='active';record.expiredAt=null;record.version++;record.updatedAt=this.clock().toISOString();
      this.audit({organisationId:account.organisationId,eventType:'integration.binding.renewed',entityType:'provider-binding',entityId:record.bindingId,
        payload:{provider,accountId:account.id,kind,status:record.status,version:record.version,expiresAt:record.expiresAt}});
      return structuredClone(record);
    });
  }
  stop({organisationId,accountId,kind,bindingId,expectedVersion}){
    const provider=expectedProvider(kind),account=this.storedAccount(organisationId,accountId,provider);
    if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1)fail('VALIDATION_ERROR','expectedVersion invalid');
    const key=this.key(account,kind,required(bindingId,'bindingId',1024));
    return this.transaction(state=>{
      const record=state.bindings[key];
      if(!record)fail('NOT_FOUND','Provider binding not found');
      if(record.version!==expectedVersion)fail('VERSION_CONFLICT','Provider binding version changed');
      if(record.status==='stopped')return structuredClone(record);
      record.status='stopped';record.version++;record.updatedAt=this.clock().toISOString();record.stoppedAt=record.updatedAt;
      this.audit({organisationId:account.organisationId,eventType:'integration.binding.stopped',entityType:'provider-binding',entityId:record.bindingId,
        payload:{provider,accountId:account.id,kind,status:record.status,version:record.version}});
      return structuredClone(record);
    });
  }
  markExpired({organisationId,accountId,kind,bindingId,expectedVersion}){
    const provider=expectedProvider(kind),account=this.storedAccount(organisationId,accountId,provider);
    if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1)fail('VALIDATION_ERROR','expectedVersion invalid');
    const key=this.key(account,kind,required(bindingId,'bindingId',1024));
    return this.transaction(state=>{
      const record=state.bindings[key];
      if(!record)fail('NOT_FOUND','Provider binding not found');
      if(record.version!==expectedVersion)fail('VERSION_CONFLICT','Provider binding version changed');
      if(record.status==='stopped'||record.status==='expired')return structuredClone(record);
      if(new Date(record.expiresAt)>this.clock())fail('BINDING_NOT_EXPIRED','Provider binding has not expired');
      record.status='expired';record.version++;record.updatedAt=this.clock().toISOString();record.expiredAt=record.updatedAt;
      this.audit({organisationId:account.organisationId,eventType:'integration.binding.expired',entityType:'provider-binding',entityId:record.bindingId,
        payload:{provider,accountId:account.id,kind,status:record.status,version:record.version}});
      return structuredClone(record);
    });
  }
  listRenewalDue({organisationId,accountId,before}){
    const account=this.integrationStore.getStoredAccount(required(organisationId,'organisationId'),required(accountId,'accountId'));
    if(!account)fail('NOT_FOUND','Integration account not found');
    if(account.status!=='active')return [];
    const deadline=new Date(required(before,'before',256));
    if(Number.isNaN(deadline.getTime()))fail('VALIDATION_ERROR','before invalid');
    return this.list(account.organisationId,account.id)
      .filter(record=>record.status==='active'&&new Date(record.expiresAt)<=deadline)
      .sort((a,b)=>new Date(a.expiresAt)-new Date(b.expiresAt)||a.bindingId.localeCompare(b.bindingId));
  }
}

module.exports={ProviderBindingStore};
