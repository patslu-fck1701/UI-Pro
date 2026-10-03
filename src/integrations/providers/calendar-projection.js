'use strict';

const crypto=require('node:crypto');

function fail(code,message){const value=new Error(message);value.code=code;throw value}
function requiredText(value,name,max=2048){
  const text=String(value??'').trim();
  if(!text||text.length>max)fail('VALIDATION_ERROR',name+' invalid');
  return text;
}
function optionalText(value,name,max=4096){
  if(value===null||value===undefined||value==='')return null;
  const text=String(value);
  if(text.length>max)fail('VALIDATION_ERROR',name+' too long');
  return text;
}
function stableJson(value){
  if(Array.isArray(value))return '['+value.map(stableJson).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stableJson(value[key])).join(',')+'}';
  return JSON.stringify(value);
}
function digest(value){return crypto.createHash('sha256').update(stableJson(value)).digest('hex')}
function providerTime(value){
  if(value===null||value===undefined||value==='')return null;
  const text=requiredText(value,'updatedAt',128),date=new Date(text);
  if(Number.isNaN(date.getTime()))fail('VALIDATION_ERROR','updatedAt invalid');
  return {text,ms:date.getTime()};
}
function when(value,name){
  if(!value||typeof value!=='object'||Array.isArray(value))fail('VALIDATION_ERROR',name+' invalid');
  const dateTime=optionalText(value.dateTime,name+'.dateTime',128),date=optionalText(value.date,name+'.date',32);
  if(Boolean(dateTime)===Boolean(date))fail('VALIDATION_ERROR',name+' requires exactly one of dateTime or date');
  if(dateTime&&Number.isNaN(new Date(dateTime).getTime()))fail('VALIDATION_ERROR',name+'.dateTime invalid');
  if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))fail('VALIDATION_ERROR',name+'.date invalid');
  const result=dateTime?{dateTime}:{date};
  const timeZone=optionalText(value.timeZone,name+'.timeZone',128);
  if(timeZone)result.timeZone=timeZone;
  return result;
}
function attendee(value,index){
  if(!value||typeof value!=='object'||Array.isArray(value))fail('VALIDATION_ERROR','attendee invalid');
  return {
    email:optionalText(value.email,'attendees['+index+'].email',512),
    name:optionalText(value.name,'attendees['+index+'].name',1024),
    status:optionalText(value.status,'attendees['+index+'].status',128)
  };
}
function safeMetadata(value,depth=0){
  if(depth>3)fail('VALIDATION_ERROR','providerMetadata too deep');
  if(value===null||value===undefined||typeof value==='boolean')return value??null;
  if(typeof value==='number'){if(!Number.isFinite(value))fail('VALIDATION_ERROR','providerMetadata number invalid');return value}
  if(typeof value==='string'){if(value.length>2048)fail('VALIDATION_ERROR','providerMetadata string too long');return value}
  if(Array.isArray(value)){
    if(value.length>32)fail('VALIDATION_ERROR','providerMetadata array too large');
    return value.map(item=>safeMetadata(item,depth+1));
  }
  if(typeof value==='object'){
    const entries=Object.entries(value);
    if(entries.length>32)fail('VALIDATION_ERROR','providerMetadata object too large');
    const result={};
    for(const [key,item] of entries){
      const safeKey=requiredText(key,'providerMetadata key',128);
      if(/authorization|token|secret|clientstate|password|credential/i.test(safeKey))fail('VALIDATION_ERROR','providerMetadata contains secret-like field');
      result[safeKey]=safeMetadata(item,depth+1);
    }
    return result;
  }
  fail('VALIDATION_ERROR','providerMetadata value invalid');
}
function normalizeEvent(event,provider){
  if(!event||typeof event!=='object'||Array.isArray(event))fail('VALIDATION_ERROR','CalendarEvent invalid');
  if(event.objectType!=='CalendarEvent')fail('VALIDATION_ERROR','objectType must be CalendarEvent');
  const eventProvider=requiredText(event.provider,'provider',128);
  if(eventProvider!==provider)fail('ACCOUNT_MISMATCH','CalendarEvent provider does not match integration account');
  const attendees=event.attendees===undefined?[]:event.attendees;
  if(!Array.isArray(attendees)||attendees.length>1000)fail('VALIDATION_ERROR','attendees invalid');
  const status=optionalText(event.status,'status',128)||'confirmed';
  const updated=providerTime(event.updatedAt);
  return {
    objectType:'CalendarEvent',
    provider:eventProvider,
    externalId:requiredText(event.externalId,'externalId',1024),
    title:optionalText(event.title,'title',4096)||'',
    start:when(event.start,'start'),
    end:when(event.end,'end'),
    location:optionalText(event.location,'location',4096),
    attendees:attendees.map(attendee),
    webUrl:optionalText(event.webUrl,'webUrl',8192),
    updatedAt:updated?.text||null,
    status,
    providerMetadata:safeMetadata(event.providerMetadata||{})
  };
}

class CalendarProjectionStore {
  constructor({stateStore,integrationStore,clock=()=>new Date(),audit=()=>{}}={}){
    if(!stateStore||typeof stateStore.load!=='function'||typeof stateStore.save!=='function')throw new Error('Calendar projection state store required');
    if(!integrationStore||typeof integrationStore.getAccount!=='function')throw new Error('Tenant-scoped integration store required');
    this.stateStore=stateStore;this.integrationStore=integrationStore;this.clock=clock;this.audit=audit;
  }
  account(organisationId,accountId){
    const org=requiredText(organisationId,'organisationId',512),id=requiredText(accountId,'accountId',512);
    const account=this.integrationStore.getAccount(org,id);
    if(!account)fail('NOT_FOUND','Integration account not found');
    return account;
  }
  key(account,externalId){return JSON.stringify([account.organisationId,account.id,account.provider,externalId])}
  transaction(fn){
    if(typeof this.stateStore.update==='function')return this.stateStore.update(fn);
    const state=this.stateStore.load(),result=fn(state);this.stateStore.save(state);return result;
  }
  applyBatch({organisationId,accountId,events}){
    const account=this.account(organisationId,accountId);
    if(!Array.isArray(events)||events.length<1||events.length>1000)fail('VALIDATION_ERROR','CalendarEvent batch invalid');
    const normalized=events.map(event=>normalizeEvent(event,account.provider)),now=this.clock().toISOString();
    const results=this.transaction(state=>{
      state.events=state.events||{};
      const changes=[];
      for(const value of normalized){
        const key=this.key(account,value.externalId),existing=state.events[key]||null;
        const content={...value};delete content.updatedAt;
        const contentFingerprint=digest(content),incomingTime=providerTime(value.updatedAt);
        if(!existing){
          const record={
            organisationId:account.organisationId,integrationAccountId:account.id,provider:account.provider,externalId:value.externalId,
            revision:1,status:value.status,providerUpdatedAt:value.updatedAt,contentFingerprint,value,
            createdAt:now,updatedAt:now,cancelledAt:value.status==='cancelled'?now:null
          };
          state.events[key]=record;changes.push({action:value.status==='cancelled'?'cancelled':'created',record:structuredClone(record)});continue;
        }
        const existingTime=providerTime(existing.providerUpdatedAt);
        if(existingTime&&incomingTime&&incomingTime.ms<existingTime.ms){
          changes.push({action:'stale',record:structuredClone(existing)});continue;
        }
        if(existing.contentFingerprint===contentFingerprint){
          if(incomingTime&&(!existingTime||incomingTime.ms>existingTime.ms)){
            existing.providerUpdatedAt=value.updatedAt;existing.value.updatedAt=value.updatedAt;existing.updatedAt=now;
          }
          changes.push({action:'unchanged',record:structuredClone(existing)});continue;
        }
        if(existingTime&&!incomingTime)fail('PROVIDER_VERSION_REQUIRED','Versioned projection cannot be overwritten by unversioned event');
        if(existingTime&&incomingTime&&incomingTime.ms===existingTime.ms)fail('PROVIDER_VERSION_CONFLICT','Same provider version contains different CalendarEvent content');
        existing.revision++;existing.status=value.status;existing.providerUpdatedAt=value.updatedAt;existing.contentFingerprint=contentFingerprint;
        existing.value=value;existing.updatedAt=now;if(value.status==='cancelled'&&!existing.cancelledAt)existing.cancelledAt=now;
        if(value.status!=='cancelled')existing.cancelledAt=null;
        changes.push({action:value.status==='cancelled'?'cancelled':'updated',record:structuredClone(existing)});
      }
      return changes;
    });
    for(const change of results){
      this.audit({
        organisationId:account.organisationId,eventType:'integration.calendar.projection.'+change.action,
        entityType:'calendar-event',entityId:change.record.externalId,
        payload:{provider:account.provider,accountId:account.id,action:change.action,revision:change.record.revision,status:change.record.status}
      });
    }
    return results.map(change=>({action:change.action,record:structuredClone(change.record)}));
  }
  get(organisationId,accountId,externalId){
    const account=this.account(organisationId,accountId),id=requiredText(externalId,'externalId',1024);
    const value=this.stateStore.load().events?.[this.key(account,id)];
    return value?structuredClone(value):null;
  }
  list(organisationId,accountId){
    const account=this.account(organisationId,accountId);
    return Object.values(this.stateStore.load().events||{})
      .filter(value=>value.organisationId===account.organisationId&&value.integrationAccountId===account.id&&value.provider===account.provider)
      .map(value=>structuredClone(value));
  }
}

module.exports={CalendarProjectionStore};
