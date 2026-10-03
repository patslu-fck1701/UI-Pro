'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const PURPOSES=new Set(['security_intake','customer_support','incident_escalation','regulatory_reporting','status_page']);
const ENVIRONMENTS=new Set(['test','staging','production']);
const STATES=new Set(['unverified','verified','failed','disabled']);
const KINDS=new Set(['email','https','phone','ticketing','regulatory_portal','internal','other']);
const REQUIRED_PRODUCTION_PURPOSES=Object.freeze(['security_intake','customer_support','incident_escalation']);

function fail(code,message,details){const error=new Error(message);error.code=code;if(details)error.details=details;throw error}
function required(value,field,max=2048){const text=String(value??'').trim();if(!text||text.length>max)fail('VALIDATION_ERROR',field+' invalid');return text}
function bool(value,field){if(typeof value!=='boolean')fail('VALIDATION_ERROR',field+' must be boolean');return value}
function enumValue(value,set,field){if(!set.has(value))fail('VALIDATION_ERROR',field+' invalid');return value}
function date(value,field){const parsed=new Date(value);if(Number.isNaN(parsed.getTime()))fail('VALIDATION_ERROR',field+' invalid');return parsed}
function clone(value){return structuredClone(value)}
function secretGuard(value,field){
  const text=required(value,field,4096);
  const lowered=text.toLowerCase();
  if(/-----begin [a-z ]*private key-----/.test(lowered)||/bearer\s+[a-z0-9._~-]+/i.test(text)||/[?&](token|access_token|api[_-]?key|secret|password|client_secret)=/i.test(text))
    fail('SECRET_MATERIAL_REJECTED',field+' must not contain credentials');
  if(/^https?:\/\//i.test(text)){
    let url;try{url=new URL(text)}catch{fail('VALIDATION_ERROR',field+' invalid URL')}
    if(url.username||url.password)fail('SECRET_MATERIAL_REJECTED',field+' URL must not contain userinfo');
  }
  return text;
}
function validateContact(kind,contactRef){
  const value=secretGuard(contactRef,'contactRef');
  if(kind==='email'&&!/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value))fail('VALIDATION_ERROR','email contactRef must be mailto: address');
  if((kind==='https'||kind==='ticketing'||kind==='regulatory_portal')&&!/^https:\/\//i.test(value))fail('VALIDATION_ERROR',kind+' contactRef must use https');
  if(kind==='phone'&&!/^tel:\+?[0-9][0-9 .()-]{4,30}$/.test(value))fail('VALIDATION_ERROR','phone contactRef must be tel: URI');
  return value;
}
function emptyState(){return {channels:{}}}
function validateRecord(value){
  if(!value||typeof value!=='object'||Array.isArray(value))fail('OPERATIONAL_STATE_INVALID','Operational channel record invalid');
  for(const field of ['channelId','purpose','environment','kind','contactRef','verificationState','revision'])if(value[field]===undefined)fail('OPERATIONAL_STATE_INVALID','Operational channel field missing: '+field);
  enumValue(value.purpose,PURPOSES,'purpose');enumValue(value.environment,ENVIRONMENTS,'environment');enumValue(value.kind,KINDS,'kind');enumValue(value.verificationState,STATES,'verificationState');
  validateContact(value.kind,value.contactRef);
  if(!Number.isInteger(value.revision)||value.revision<1)fail('OPERATIONAL_STATE_INVALID','Operational channel revision invalid');
  if(value.verificationState==='verified'){
    for(const field of ['verifiedAt','verifiedBy','verificationRef'])required(value[field],field);
    date(value.verifiedAt,'verifiedAt');secretGuard(value.verificationRef,'verificationRef');
  }
  return value;
}
function validateState(value){
  if(!value||value.schemaVersion!==1||!value.channels||typeof value.channels!=='object'||Array.isArray(value.channels))
    fail('OPERATIONAL_STATE_INVALID','Unsupported operational readiness state');
  for(const item of Object.values(value.channels))validateRecord(item);
  return {channels:value.channels};
}
function sleep(ms){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms)}

class InMemoryOperationalReadinessRepository {
  constructor(seed){this.state=seed?clone(seed):emptyState()}
  get(id){const value=this.state.channels[id];return value?clone(value):null}
  list(){return Object.values(this.state.channels).map(clone)}
  create(value){
    validateRecord(value);if(this.state.channels[value.channelId])fail('DUPLICATE_RECORD','Operational channel already exists');
    if(value.revision!==1)fail('OPERATIONAL_STATE_INVALID','New operational channel must start at revision 1');
    this.state.channels[value.channelId]=clone(value);return clone(value);
  }
  replace(id,expectedRevision,value){
    validateRecord(value);const current=this.state.channels[id];if(!current)fail('NOT_FOUND','Operational channel not found');
    if(current.revision!==expectedRevision)fail('REVISION_CONFLICT','Operational channel revision conflict',{expected:expectedRevision,actual:current.revision});
    if(value.revision!==current.revision+1)fail('OPERATIONAL_STATE_INVALID','Operational channel revision must increment by one');
    this.state.channels[id]=clone(value);return clone(value);
  }
  snapshot(){return clone(this.state)}
}

class FileOperationalReadinessRepository {
  constructor(file,{lockTimeoutMs=2000,staleLockMs=10000}={}){
    this.file=path.resolve(file);this.lockFile=this.file+'.lock';this.lockTimeoutMs=lockTimeoutMs;this.staleLockMs=staleLockMs;
    if(fs.existsSync(this.file))this.load();
  }
  load(){
    if(!fs.existsSync(this.file))return emptyState();
    let parsed;try{parsed=JSON.parse(fs.readFileSync(this.file,'utf8'))}
    catch(cause){const error=new Error('Operational readiness state unreadable');error.code='OPERATIONAL_STATE_INVALID';error.cause=cause;throw error}
    return clone(validateState(parsed));
  }
  save(value){
    const checked=validateState({schemaVersion:1,...clone(value)});
    fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});
    const temp=this.file+'.tmp-'+process.pid+'-'+crypto.randomUUID();
    fs.writeFileSync(temp,JSON.stringify({schemaVersion:1,...checked},null,2),{encoding:'utf8',mode:0o600,flag:'wx'});
    fs.renameSync(temp,this.file);
  }
  withLock(fn){
    fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});
    const started=Date.now();let fd=null;
    while(fd===null){
      try{fd=fs.openSync(this.lockFile,'wx',0o600);fs.writeFileSync(fd,JSON.stringify({pid:process.pid,createdAt:new Date().toISOString()}))}
      catch(error){
        if(error.code!=='EEXIST')throw error;
        try{if(Date.now()-fs.statSync(this.lockFile).mtimeMs>this.staleLockMs)fs.unlinkSync(this.lockFile)}
        catch(cause){if(cause.code!=='ENOENT')throw cause}
        if(Date.now()-started>=this.lockTimeoutMs)fail('OPERATIONAL_STATE_LOCK_TIMEOUT','Operational readiness lock timeout');
        sleep(10);
      }
    }
    try{return fn()}finally{
      try{fs.closeSync(fd)}catch{}
      try{fs.unlinkSync(this.lockFile)}catch(error){if(error.code!=='ENOENT')throw error}
    }
  }
  get(id){const value=this.load().channels[id];return value?clone(value):null}
  list(){return Object.values(this.load().channels).map(clone)}
  create(value){
    validateRecord(value);
    return this.withLock(()=>{const state=this.load();if(state.channels[value.channelId])fail('DUPLICATE_RECORD','Operational channel already exists');
      if(value.revision!==1)fail('OPERATIONAL_STATE_INVALID','New operational channel must start at revision 1');
      state.channels[value.channelId]=clone(value);this.save(state);return clone(value)});
  }
  replace(id,expectedRevision,value){
    validateRecord(value);
    return this.withLock(()=>{const state=this.load(),current=state.channels[id];if(!current)fail('NOT_FOUND','Operational channel not found');
      if(current.revision!==expectedRevision)fail('REVISION_CONFLICT','Operational channel revision conflict',{expected:expectedRevision,actual:current.revision});
      if(value.revision!==current.revision+1)fail('OPERATIONAL_STATE_INVALID','Operational channel revision must increment by one');
      state.channels[id]=clone(value);this.save(state);return clone(value)});
  }
  snapshot(){return this.load()}
  integrity(){this.load();return true}
}

class OperationalChannelRegistry {
  constructor({clock=()=>new Date(),audit=()=>{},repository=new InMemoryOperationalReadinessRepository()}={}){this.clock=clock;this.audit=audit;this.repository=repository}
  configure(input){
    const channelId=required(input.channelId,'channelId',128),kind=enumValue(input.kind,KINDS,'kind');
    const value={
      channelId,purpose:enumValue(input.purpose,PURPOSES,'purpose'),environment:enumValue(input.environment,ENVIRONMENTS,'environment'),
      kind,contactRef:validateContact(kind,input.contactRef),
      publiclyDisclosable:bool(input.publiclyDisclosable,'publiclyDisclosable'),
      sensitiveReportCapable:bool(input.sensitiveReportCapable,'sensitiveReportCapable'),
      verificationState:'unverified',configuredAt:this.clock().toISOString(),configuredBy:required(input.configuredBy,'configuredBy'),
      verifiedAt:null,verifiedBy:null,verificationRef:null,disabledAt:null,disabledBy:null,revision:1
    };
    this.repository.create(value);
    this.audit({eventType:'operational.channel.configured',entityType:'operational-channel',entityId:channelId,payload:{purpose:value.purpose,environment:value.environment,kind:value.kind,revision:1}});
    return clone(value);
  }
  verify(channelId,input){
    const current=this.get(channelId);if(!current)fail('NOT_FOUND','Operational channel not found');
    const next={...current,verificationState:'verified',verifiedAt:(input.verifiedAt?date(input.verifiedAt,'verifiedAt'):this.clock()).toISOString(),
      verifiedBy:required(input.verifiedBy,'verifiedBy'),verificationRef:secretGuard(input.verificationRef,'verificationRef'),
      disabledAt:null,disabledBy:null,revision:current.revision+1};
    this.repository.replace(channelId,input.expectedRevision,next);
    this.audit({eventType:'operational.channel.verified',entityType:'operational-channel',entityId:channelId,payload:{purpose:next.purpose,environment:next.environment,verificationRef:next.verificationRef,revision:next.revision}});
    return clone(next);
  }
  markFailed(channelId,input){
    const current=this.get(channelId);if(!current)fail('NOT_FOUND','Operational channel not found');
    const next={...current,verificationState:'failed',verifiedAt:null,verifiedBy:null,verificationRef:secretGuard(input.failureRef,'failureRef'),revision:current.revision+1};
    this.repository.replace(channelId,input.expectedRevision,next);
    this.audit({eventType:'operational.channel.failed',entityType:'operational-channel',entityId:channelId,payload:{purpose:next.purpose,environment:next.environment,failureRef:next.verificationRef,revision:next.revision}});
    return clone(next);
  }
  disable(channelId,input){
    const current=this.get(channelId);if(!current)fail('NOT_FOUND','Operational channel not found');
    const next={...current,verificationState:'disabled',disabledAt:this.clock().toISOString(),disabledBy:required(input.disabledBy,'disabledBy'),revision:current.revision+1};
    this.repository.replace(channelId,input.expectedRevision,next);
    this.audit({eventType:'operational.channel.disabled',entityType:'operational-channel',entityId:channelId,payload:{purpose:next.purpose,environment:next.environment,revision:next.revision}});
    return clone(next);
  }
  get(channelId){return this.repository.get(channelId)}
  list(){return this.repository.list()}
  verifiedProduction(purpose){return this.list().filter(item=>item.environment==='production'&&item.purpose===purpose&&item.verificationState==='verified')}
  productionReadiness({regulatoryReportingRequired=false}={}){
    const purposes=[...REQUIRED_PRODUCTION_PURPOSES];if(regulatoryReportingRequired)purposes.push('regulatory_reporting');
    const blockers=[],evidence={};
    for(const purpose of purposes){
      const matches=this.verifiedProduction(purpose);
      if(!matches.length){blockers.push('missing_verified_'+purpose);continue}
      if(purpose==='security_intake'&&!matches.some(item=>item.sensitiveReportCapable))blockers.push('security_intake_not_sensitive_report_capable');
      evidence[purpose]=matches.map(item=>({channelId:item.channelId,verificationRef:item.verificationRef,verifiedAt:item.verifiedAt}));
    }
    return {ready:blockers.length===0,blockers,evidence,productionReadinessClaim:false};
  }
}

function buildSecurityTxt({registry,expiresAt,canonicalUrl,policyUrl=null}){
  const expires=date(expiresAt,'expiresAt');if(expires<=new Date())fail('VALIDATION_ERROR','expiresAt must be in the future');
  const channels=registry.verifiedProduction('security_intake').filter(item=>item.publiclyDisclosable&&item.sensitiveReportCapable&&['email','https'].includes(item.kind));
  if(!channels.length)fail('OPERATIONAL_NOT_READY','Verified public production security intake channel required');
  const canonical=secretGuard(canonicalUrl,'canonicalUrl');if(!/^https:\/\//i.test(canonical))fail('VALIDATION_ERROR','canonicalUrl must use https');
  const lines=[];
  for(const channel of channels)lines.push('Contact: '+channel.contactRef);
  lines.push('Expires: '+expires.toISOString());
  lines.push('Canonical: '+canonical);
  if(policyUrl){const policy=secretGuard(policyUrl,'policyUrl');if(!/^https:\/\//i.test(policy))fail('VALIDATION_ERROR','policyUrl must use https');lines.push('Policy: '+policy)}
  return lines.join('\n')+'\n';
}

module.exports={
  REQUIRED_PRODUCTION_PURPOSES,
  InMemoryOperationalReadinessRepository,
  FileOperationalReadinessRepository,
  OperationalChannelRegistry,
  buildSecurityTxt
};
