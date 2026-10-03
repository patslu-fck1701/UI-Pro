'use strict';

const crypto=require('node:crypto');
const clone=value=>structuredClone(value);
const uid=prefix=>prefix+'_'+crypto.randomUUID();
function required(value,field){const result=String(value||'').trim();if(!result){const error=new Error(field+' is required');error.code='VALIDATION_ERROR';throw error;}return result}
function safeError(error){return {code:error.code||'INTEGRATION_ERROR',message:'Integration operation failed'}}
function safeControlData(value,path='control',depth=0){
  if(depth>5){const error=new Error(path+' too deep');error.code='VALIDATION_ERROR';throw error;}
  if(value===null||value===undefined||typeof value==='boolean')return value??null;
  if(typeof value==='number'){
    if(!Number.isFinite(value)){const error=new Error(path+' number invalid');error.code='VALIDATION_ERROR';throw error;}
    return value;
  }
  if(typeof value==='string'){
    if(value.length>8192){const error=new Error(path+' string too long');error.code='VALIDATION_ERROR';throw error;}
    return value;
  }
  if(Array.isArray(value)){
    if(value.length>256){const error=new Error(path+' array too large');error.code='VALIDATION_ERROR';throw error;}
    return value.map((item,index)=>safeControlData(item,path+'['+index+']',depth+1));
  }
  if(typeof value==='object'){
    const entries=Object.entries(value);
    if(entries.length>256){const error=new Error(path+' object too large');error.code='VALIDATION_ERROR';throw error;}
    const result={};
    for(const [key,item] of entries){
      const name=String(key);
      if(!name||name.length>256){const error=new Error(path+' key invalid');error.code='VALIDATION_ERROR';throw error;}
      if(/authorization|access.?token|refresh.?token|channel.?token|client.?state|password|secret|private.?key/i.test(name)){
        const error=new Error(path+' contains secret-like field');error.code='VALIDATION_ERROR';throw error;
      }
      result[name]=safeControlData(item,path+'.'+name,depth+1);
    }
    return result;
  }
  const error=new Error(path+' value invalid');error.code='VALIDATION_ERROR';throw error;
}

class SecretStorePort {
  put(_) { throw new Error('SecretStorePort.put must be implemented'); }
  resolve(_,__) { throw new Error('SecretStorePort.resolve must be implemented'); }
  rotate(_,__) { throw new Error('SecretStorePort.rotate must be implemented'); }
  revoke(_,__) { throw new Error('SecretStorePort.revoke must be implemented'); }
}
class ConnectorPort {
  connect(_) { throw new Error('ConnectorPort.connect must be implemented'); }
  refresh(_) { throw new Error('ConnectorPort.refresh must be implemented'); }
  pull(_) { throw new Error('ConnectorPort.pull must be implemented'); }
  push(_) { throw new Error('ConnectorPort.push must be implemented'); }
  verifyWebhook(_) { throw new Error('ConnectorPort.verifyWebhook must be implemented'); }
  handleWebhook(_) { throw new Error('ConnectorPort.handleWebhook must be implemented'); }
  health(_) { throw new Error('ConnectorPort.health must be implemented'); }
  disconnect(_) { throw new Error('ConnectorPort.disconnect must be implemented'); }
}

class InMemorySecretStore extends SecretStorePort {
  constructor({clock=()=>new Date(),id=uid,audit=()=>{}}={}){super();this.clock=clock;this.id=id;this.audit=audit;this.secrets=new Map();this.metadata=new Map();}
  put({organisationId,scope='organisation',purpose,value}){
    required(organisationId,'organisationId');required(purpose,'purpose');if(value===undefined||value===null)required('','value');
    const id=this.id('secret'),reference={id,organisationId,scope,purpose,version:1,status:'active',createdAt:this.clock().toISOString(),rotatedAt:null,revokedAt:null};
    this.secrets.set(id,value);this.metadata.set(id,reference);
    this.audit({organisationId,eventType:'credential.created',entityType:'credential-reference',entityId:id,payload:{scope,purpose}});
    return clone(reference);
  }
  resolve(organisationId,id){
    const metadata=this.metadata.get(id);
    if(!metadata||metadata.organisationId!==organisationId||metadata.status!=='active'){const error=new Error('Credential unavailable');error.code='CREDENTIAL_UNAVAILABLE';throw error;}
    return this.secrets.get(id);
  }
  rotate(organisationId,id,value){
    const metadata=this.metadata.get(id);
    if(!metadata||metadata.organisationId!==organisationId){const error=new Error('Credential unavailable');error.code='CREDENTIAL_UNAVAILABLE';throw error;}
    metadata.version++;metadata.status='active';metadata.rotatedAt=this.clock().toISOString();metadata.revokedAt=null;this.secrets.set(id,value);
    this.audit({organisationId,eventType:'credential.rotated',entityType:'credential-reference',entityId:id,payload:{version:metadata.version}});
    return clone(metadata);
  }
  revoke(organisationId,id){
    const metadata=this.metadata.get(id);
    if(!metadata||metadata.organisationId!==organisationId){const error=new Error('Credential unavailable');error.code='CREDENTIAL_UNAVAILABLE';throw error;}
    metadata.status='revoked';metadata.revokedAt=this.clock().toISOString();this.secrets.delete(id);
    this.audit({organisationId,eventType:'credential.revoked',entityType:'credential-reference',entityId:id,payload:{}});
    return clone(metadata);
  }
}

class ConnectorRegistry {
  constructor(){this.connectors=new Map();}
  register(provider,connector){required(provider,'provider');if(!(connector instanceof ConnectorPort))throw new Error('Connector must implement ConnectorPort');this.connectors.set(provider,connector);return this}
  get(provider){const value=this.connectors.get(provider);if(!value){const error=new Error('Connector unavailable');error.code='CONNECTOR_UNAVAILABLE';throw error;}return value}
}

class IntegrationStore {
  constructor({clock=()=>new Date(),id=uid,stateStore=null,audit=()=>{}}={}){
    this.clock=clock;this.id=id;this.stateStore=stateStore;this.audit=audit;
    this.accounts=new Map();this.events=new Map();this.jobs=new Map();this.cursors=new Map();
    this.reload();
  }
  snapshot(){
    return {
      accounts:[...this.accounts.values()].map(clone),
      events:[...this.events.values()].map(clone),
      jobs:[...this.jobs.values()].map(clone),
      cursors:Object.fromEntries([...this.cursors.entries()].map(([key,value])=>[key,clone(value)]))
    };
  }
  hydrate(state){
    const value=state||{accounts:[],events:[],jobs:[],cursors:{}};
    if(!Array.isArray(value.accounts)||!Array.isArray(value.events)||!Array.isArray(value.jobs)||
      !value.cursors||typeof value.cursors!=='object'||Array.isArray(value.cursors)){
      const error=new Error('Unsupported integration control state');error.code='CONTROL_STATE_INVALID';throw error;
    }
    this.accounts=new Map();
    for(const account of value.accounts){
      if(!account||typeof account!=='object')throw Object.assign(new Error('Unsupported integration account state'),{code:'CONTROL_STATE_INVALID'});
      const safe={
        ...clone(account),
        id:required(account.id,'account.id'),
        organisationId:required(account.organisationId,'account.organisationId'),
        provider:required(account.provider,'account.provider'),
        connectionKey:required(account.connectionKey,'account.connectionKey'),
        providerConfig:safeControlData(account.providerConfig||{},'providerConfig'),
        status:['active','suspended','revoked'].includes(account.status)?account.status:'active',
        version:Number.isSafeInteger(account.version)&&account.version>=1?account.version:1,
        updatedAt:account.updatedAt||account.createdAt||null
      };
      this.accounts.set(safe.id,safe);
    }
    this.events=new Map();
    for(const event of value.events){
      if(!event||typeof event!=='object')throw Object.assign(new Error('Unsupported integration event state'),{code:'CONTROL_STATE_INVALID'});
      const safe={
        ...clone(event),
        id:required(event.id,'event.id'),
        organisationId:required(event.organisationId,'event.organisationId'),
        integrationAccountId:required(event.integrationAccountId,'event.integrationAccountId'),
        provider:required(event.provider,'event.provider'),
        externalEventId:required(event.externalEventId,'event.externalEventId'),
        eventType:required(event.eventType,'event.eventType'),
        metadata:safeControlData(event.metadata||{},'event.metadata')
      };
      this.events.set(safe.integrationAccountId+':'+safe.externalEventId,safe);
    }
    this.jobs=new Map(value.jobs.map(job=>[required(job.id,'job.id'),clone(job)]));
    this.cursors=new Map(Object.entries(value.cursors).map(([key,item])=>[key,clone(item)]));
    return this;
  }
  reload(){if(this.stateStore)this.hydrate(this.stateStore.load());return this}
  persist(){if(this.stateStore)this.stateStore.save(this.snapshot())}
  mutate(fn){
    if(this.stateStore&&typeof this.stateStore.update==='function'){
      return this.stateStore.update(state=>{
        this.hydrate(state);
        const result=fn();
        const snapshot=this.snapshot();
        state.accounts=snapshot.accounts;state.events=snapshot.events;state.jobs=snapshot.jobs;state.cursors=snapshot.cursors;
        return clone(result);
      });
    }
    if(this.stateStore)this.reload();
    const result=fn();
    this.persist();
    return clone(result);
  }
  account(input){
    return this.mutate(()=>{
      const value={
        id:input.id||this.id('integration'),organisationId:required(input.organisationId,'organisationId'),
        provider:required(input.provider,'provider'),connectionKey:required(input.connectionKey,'connectionKey'),
        credentialReferenceId:input.credentialReferenceId||null,
        status:['active','suspended','revoked'].includes(input.status)?input.status:'active',
        providerConfig:safeControlData(input.providerConfig||{},'providerConfig')
      };
      value.createdAt=this.clock().toISOString();value.updatedAt=value.createdAt;value.version=1;
      const conflict=[...this.accounts.values()].find(account=>
        account.id!==value.id&&account.status==='active'&&account.provider===value.provider&&account.connectionKey===value.connectionKey
      );
      if(conflict){const error=new Error('Connection key already active');error.code='CONNECTION_KEY_CONFLICT';throw error;}
      this.accounts.set(value.id,value);return value;
    });
  }
  resolve(provider,connectionKey){
    this.reload();
    const value=[...this.accounts.values()].find(account=>account.provider===provider&&account.connectionKey===connectionKey&&account.status==='active');
    return value?clone(value):null;
  }
  getStoredAccount(organisationId,accountId){
    this.reload();
    const org=required(organisationId,'organisationId'),id=required(accountId,'accountId'),value=this.accounts.get(id);
    if(!value||value.organisationId!==org)return null;
    return clone(value);
  }
  getAccount(organisationId,accountId){
    const value=this.getStoredAccount(organisationId,accountId);
    return value&&value.status==='active'?value:null;
  }
  listAccountRefs({status=null,limit=100,after=null}={}){
    this.reload();
    if(status!==null&&!['active','suspended','revoked'].includes(status)){const error=new Error('status invalid');error.code='VALIDATION_ERROR';throw error;}
    const count=Number(limit);
    if(!Number.isSafeInteger(count)||count<1||count>1000){const error=new Error('limit invalid');error.code='VALIDATION_ERROR';throw error;}
    const cursor=after===null||after===undefined?null:String(after);
    const values=[...this.accounts.values()]
      .filter(account=>status===null||account.status===status)
      .sort((a,b)=>(a.organisationId+'\u0000'+a.id).localeCompare(b.organisationId+'\u0000'+b.id));
    const start=cursor===null?0:Math.max(0,values.findIndex(account=>account.organisationId+'\u0000'+account.id===cursor)+1);
    return values.slice(start,start+count).map(account=>({
      organisationId:account.organisationId,id:account.id,provider:account.provider,status:account.status,version:account.version
    }));
  }
  getControlCursor(name){
    this.reload();
    const key=required(name,'cursor.name'),value=this.cursors.get(key);
    return value===undefined?null:clone(value);
  }
  setControlCursor(name,value){
    const key=required(name,'cursor.name');
    return this.mutate(()=>{
      if(value===null||value===undefined)this.cursors.delete(key);
      else this.cursors.set(key,safeControlData(value,'cursor.value'));
      return value===null||value===undefined?null:clone(value);
    });
  }
  rotateRoute({organisationId,accountId,newConnectionKey,expectedVersion}){
    const org=required(organisationId,'organisationId'),id=required(accountId,'accountId'),next=required(newConnectionKey,'newConnectionKey');
    if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1){const error=new Error('expectedVersion invalid');error.code='VALIDATION_ERROR';throw error;}
    return this.mutate(()=>{
      const account=this.accounts.get(id);
      if(!account||account.organisationId!==org){const error=new Error('Integration account not found');error.code='NOT_FOUND';throw error;}
      if(account.version!==expectedVersion){const error=new Error('Integration account version changed');error.code='VERSION_CONFLICT';throw error;}
      const conflict=[...this.accounts.values()].find(other=>
        other.id!==account.id&&other.status==='active'&&other.provider===account.provider&&other.connectionKey===next
      );
      if(conflict){const error=new Error('Connection key already active');error.code='CONNECTION_KEY_CONFLICT';throw error;}
      account.connectionKey=next;account.version++;account.updatedAt=this.clock().toISOString();
      this.audit({organisationId:org,eventType:'integration.account.route_rotated',entityType:'integration-account',entityId:id,
        payload:{provider:account.provider,version:account.version,status:account.status}});
      return account;
    });
  }
  setAccountStatus({organisationId,accountId,status,expectedVersion}){
    const org=required(organisationId,'organisationId'),id=required(accountId,'accountId');
    if(!['active','suspended','revoked'].includes(status)){const error=new Error('status invalid');error.code='VALIDATION_ERROR';throw error;}
    if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1){const error=new Error('expectedVersion invalid');error.code='VALIDATION_ERROR';throw error;}
    return this.mutate(()=>{
      const account=this.accounts.get(id);
      if(!account||account.organisationId!==org){const error=new Error('Integration account not found');error.code='NOT_FOUND';throw error;}
      if(account.version!==expectedVersion){const error=new Error('Integration account version changed');error.code='VERSION_CONFLICT';throw error;}
      if(status==='active'){
        const conflict=[...this.accounts.values()].find(other=>
          other.id!==account.id&&other.status==='active'&&other.provider===account.provider&&other.connectionKey===account.connectionKey
        );
        if(conflict){const error=new Error('Connection key already active');error.code='CONNECTION_KEY_CONFLICT';throw error;}
      }
      if(account.status===status)return account;
      account.status=status;account.version++;account.updatedAt=this.clock().toISOString();
      this.audit({organisationId:org,eventType:'integration.account.status_changed',entityType:'integration-account',entityId:id,
        payload:{provider:account.provider,version:account.version,status}});
      return account;
    });
  }
  event(account,input){
    return this.mutate(()=>{
      const accountId=required(account?.id,'account.id'),authoritative=this.accounts.get(accountId);
      if(!authoritative||authoritative.status!=='active'){const error=new Error('Integration account not found');error.code='NOT_FOUND';throw error;}
      if(authoritative.organisationId!==account.organisationId||authoritative.provider!==account.provider){
        const error=new Error('Integration account mismatch');error.code='ACCOUNT_MISMATCH';throw error;
      }
      const externalEventId=required(input.externalEventId,'externalEventId'),key=authoritative.id+':'+externalEventId,existing=this.events.get(key);
      if(existing)return {event:clone(existing),duplicate:true};
      const value={
        id:this.id('integration-event'),organisationId:authoritative.organisationId,integrationAccountId:authoritative.id,
        provider:authoritative.provider,externalEventId,eventType:required(input.eventType,'eventType'),
        receivedAt:this.clock().toISOString(),correlationId:input.correlationId||this.id('correlation'),
        metadata:safeControlData(input.metadata||{},'event.metadata'),status:'received'
      };
      this.events.set(key,value);return {event:value,duplicate:false};
    });
  }
  getEvent(organisationId,accountId,externalEventId){
    const account=this.getStoredAccount(organisationId,accountId);
    if(!account)return null;
    this.reload();
    const value=this.events.get(account.id+':'+required(externalEventId,'externalEventId'));
    return value?clone(value):null;
  }
  job(event,input={}){
    return this.mutate(()=>{
      const stored=[...this.events.values()].find(value=>value.id===event?.id);
      if(!stored||stored.organisationId!==event.organisationId||stored.integrationAccountId!==event.integrationAccountId){
        const error=new Error('Integration event not found');error.code='NOT_FOUND';throw error;
      }
      const value={
        id:this.id('sync-job'),organisationId:stored.organisationId,integrationAccountId:stored.integrationAccountId,
        integrationEventId:stored.id,direction:input.direction||'inbound',status:'queued',attempts:0,lastError:null,
        nextRetryAt:null,idempotencyKey:stored.integrationAccountId+':'+stored.externalEventId,
        correlationId:stored.correlationId,createdAt:this.clock().toISOString()
      };
      this.jobs.set(value.id,value);return value;
    });
  }
  listJobs(organisationId){
    this.reload();
    return [...this.jobs.values()].filter(job=>job.organisationId===organisationId).map(value=>clone(value));
  }
}
class WebhookGateway {
  constructor({registry,store,audit=()=>{}}){this.registry=registry;this.store=store;this.audit=audit;}
  async receive({provider,connectionKey,headers={},rawBody}){
    const account=this.store.resolve(required(provider,'provider'),required(connectionKey,'connectionKey'));
    if(!account){const error=new Error('Integration account not found');error.code='NOT_FOUND';throw error;}
    const connector=this.registry.get(provider);
    const verified=await connector.verifyWebhook({account,headers,rawBody});
    if(!verified){const error=new Error('Invalid webhook signature');error.code='WEBHOOK_UNVERIFIED';throw error;}
    const normalized=await connector.handleWebhook({account,headers,rawBody});
    const stored=this.store.event(account,normalized);
    if(stored.duplicate)return {accepted:true,duplicate:true,eventId:stored.event.id,jobId:null};
    const job=this.store.job(stored.event);
    this.audit({
      organisationId:account.organisationId,eventType:'integration.webhook.accepted',entityType:'integration-event',
      entityId:stored.event.id,correlationId:stored.event.correlationId,
      payload:{provider,accountId:account.id,eventType:stored.event.eventType,jobId:job.id}
    });
    return {accepted:true,duplicate:false,eventId:stored.event.id,jobId:job.id};
  }
}

class MappingEngine {
  apply(profile,external){
    required(profile.id,'profile.id');required(profile.version,'profile.version');
    const result={};
    for(const [target,source] of Object.entries(profile.fields||{})){
      const value=String(source).split('.').reduce((current,key)=>current?.[key],external);
      if(value!==undefined)result[target]=clone(value);
    }
    return {profileId:profile.id,profileVersion:profile.version,objectType:required(profile.objectType,'profile.objectType'),value:result};
  }
}

module.exports={
  SecretStorePort,ConnectorPort,InMemorySecretStore,ConnectorRegistry,IntegrationStore,WebhookGateway,MappingEngine,safeError
};
