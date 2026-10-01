'use strict';

const crypto=require('node:crypto');
const clone=value=>structuredClone(value);
const uid=prefix=>prefix+'_'+crypto.randomUUID();
function required(value,field){const result=String(value||'').trim();if(!result){const error=new Error(field+' is required');error.code='VALIDATION_ERROR';throw error;}return result}
function safeError(error){return {code:error.code||'INTEGRATION_ERROR',message:'Integration operation failed'}}

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
  constructor({clock=()=>new Date(),id=uid}={}){this.clock=clock;this.id=id;this.accounts=new Map();this.events=new Map();this.jobs=new Map();this.cursors=new Map();}
  account(input){
    const value={
      id:input.id||this.id('integration'),organisationId:required(input.organisationId,'organisationId'),
      provider:required(input.provider,'provider'),connectionKey:required(input.connectionKey,'connectionKey'),
      credentialReferenceId:input.credentialReferenceId||null,status:input.status||'active',
      providerConfig:clone(input.providerConfig||{}),createdAt:this.clock().toISOString()
    };
    this.accounts.set(value.id,value);return clone(value);
  }
  resolve(provider,connectionKey){
    const value=[...this.accounts.values()].find(account=>account.provider===provider&&account.connectionKey===connectionKey&&account.status==='active');
    return value?clone(value):null;
  }
  event(account,input){
    const key=account.id+':'+required(input.externalEventId,'externalEventId'),existing=this.events.get(key);
    if(existing)return {event:clone(existing),duplicate:true};
    const value={
      id:this.id('integration-event'),organisationId:account.organisationId,integrationAccountId:account.id,
      provider:account.provider,externalEventId:input.externalEventId,eventType:required(input.eventType,'eventType'),
      receivedAt:this.clock().toISOString(),correlationId:input.correlationId||this.id('correlation'),
      metadata:clone(input.metadata||{}),status:'received'
    };
    this.events.set(key,value);return {event:clone(value),duplicate:false};
  }
  job(event,input={}){
    const value={
      id:this.id('sync-job'),organisationId:event.organisationId,integrationAccountId:event.integrationAccountId,
      integrationEventId:event.id,direction:input.direction||'inbound',status:'queued',attempts:0,lastError:null,
      nextRetryAt:null,idempotencyKey:event.integrationAccountId+':'+event.externalEventId,
      correlationId:event.correlationId,createdAt:this.clock().toISOString()
    };
    this.jobs.set(value.id,value);return clone(value);
  }
  listJobs(organisationId){return [...this.jobs.values()].filter(job=>job.organisationId===organisationId).map(value=>clone(value))}
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
