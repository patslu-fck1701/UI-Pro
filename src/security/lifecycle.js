'use strict';

const crypto=require('node:crypto');
const uid=()=>crypto.randomUUID();
function fail(code,message){const error=new Error(message);error.code=code;throw error}
function time(value,field){const date=new Date(value);if(Number.isNaN(date.getTime()))fail('VALIDATION_ERROR',field+' invalid');return date}
const CHANNELS=new Set(['canary','pilot','stable','lts']);
class ReleaseLifecycle {
  constructor({clock=()=>new Date(),audit=()=>{}}={}){this.clock=clock;this.audit=audit;this.releases=new Map();}
  register(input){
    for(const field of ['productId','version','releasedAt','supportedUntil','channel'])if(!input[field])fail('VALIDATION_ERROR',field+' required');
    if(!CHANNELS.has(input.channel))fail('VALIDATION_ERROR','release channel invalid');
    if(time(input.supportedUntil,'supportedUntil')<=time(input.releasedAt,'releasedAt'))fail('VALIDATION_ERROR','support end must follow release');
    const key=input.productId+':'+input.version;if(this.releases.has(key))fail('DUPLICATE_RELEASE','Release already registered');
    const value={productId:input.productId,version:input.version,releasedAt:input.releasedAt,supportStartedAt:input.supportStartedAt||input.releasedAt,
      supportedUntil:input.supportedUntil,securityStatus:input.securityStatus||'supported',minimumSupportedVersion:input.minimumSupportedVersion||null,
      supersededBy:input.supersededBy||null,channel:input.channel,eolNoticeAt:input.eolNoticeAt||null,eolEffectiveAt:input.eolEffectiveAt||null,
      supportContact:input.supportContact||null,securityAdvisoryRefs:[...(input.securityAdvisoryRefs||[])],compatibility:structuredClone(input.compatibility||{}),
      migration:structuredClone(input.migration||{}),rollback:structuredClone(input.rollback||{}),sbomRef:input.sbomRef||null};
    this.releases.set(key,value);this.audit({eventType:'release.registered',entityType:'release',entityId:key,payload:{channel:value.channel,supportedUntil:value.supportedUntil}});
    return structuredClone(value);
  }
  get(productId,version){const value=this.releases.get(productId+':'+version);return value?structuredClone(value):null}
  isSupported(productId,version,at=this.clock()){const value=this.get(productId,version);return Boolean(value&&value.securityStatus==='supported'&&time(value.supportedUntil,'supportedUntil')>at)}
}
class VulnerabilityRegister {
  constructor({clock=()=>new Date(),audit=()=>{}}={}){this.clock=clock;this.audit=audit;this.records=new Map();}
  intake({productId,source,summary,privateReference}){
    if(!productId||!source||!summary||!privateReference)fail('VALIDATION_ERROR','Private intake metadata required');
    const id='vuln_'+uid(),value={id,productId,source,summary,privateReference,status:'intake',receivedAt:this.clock().toISOString(),
      severity:null,affectedVersions:[],knownExploitation:null,craAssessment:'not_assessed',owner:null,fixVersion:null,disclosureState:'private'};
    this.records.set(id,value);this.audit({eventType:'vulnerability.received',entityType:'vulnerability',entityId:id,payload:{productId}});
    return structuredClone(value);
  }
  triage(id,{severity,affectedVersions,knownExploitation,craAssessment,owner}){
    const value=this.records.get(id);if(!value)fail('NOT_FOUND','Vulnerability not found');
    if(!['low','medium','high','critical'].includes(severity)||!Array.isArray(affectedVersions)||!owner)fail('VALIDATION_ERROR','Triage incomplete');
    if(!['not_applicable','needs_legal_review','reporting_required','not_reportable'].includes(craAssessment))fail('VALIDATION_ERROR','CRA decision state invalid');
    Object.assign(value,{status:'triaged',severity,affectedVersions:[...affectedVersions],knownExploitation:Boolean(knownExploitation),craAssessment,owner,triagedAt:this.clock().toISOString()});
    this.audit({eventType:'vulnerability.triaged',entityType:'vulnerability',entityId:id,payload:{severity,craAssessment}});
    return structuredClone(value);
  }
  get(id){const value=this.records.get(id);return value?structuredClone(value):null}
}
class TemporarySupportGrant {
  constructor({clock=()=>new Date(),audit=()=>{}}={}){this.clock=clock;this.audit=audit;this.grants=new Map();}
  create({organisationId,approvedBy,supportActorId,ticketId,capabilities,resources=[],expiresAt}){
    if(!organisationId||!approvedBy||!supportActorId||!ticketId||!Array.isArray(capabilities)||!capabilities.length)fail('VALIDATION_ERROR','Support grant incomplete');
    if(time(expiresAt,'expiresAt')<=this.clock())fail('VALIDATION_ERROR','Support grant already expired');
    const value={id:'support_'+uid(),organisationId,approvedBy,supportActorId,ticketId,capabilities:[...new Set(capabilities)],resources:[...new Set(resources)],
      createdAt:this.clock().toISOString(),expiresAt,revokedAt:null};
    this.grants.set(value.id,value);this.audit({organisationId,actorId:approvedBy,eventType:'support.granted',entityType:'support-grant',entityId:value.id,payload:{ticketId,expiresAt}});
    return structuredClone(value);
  }
  authorize(id,{organisationId,actorId,capability,resourceId}){
    const value=this.grants.get(id);
    if(!value||value.revokedAt||time(value.expiresAt,'expiresAt')<=this.clock()||value.organisationId!==organisationId||value.supportActorId!==actorId
      ||!value.capabilities.includes(capability)||(value.resources.length&& !value.resources.includes(resourceId)))fail('FORBIDDEN','Support access denied');
    this.audit({organisationId,actorId,eventType:'support.used',entityType:'support-grant',entityId:id,payload:{capability,resourceId:resourceId||null}});
    return true;
  }
  revoke(id,{actorId}){const value=this.grants.get(id);if(!value)fail('NOT_FOUND','Support grant not found');value.revokedAt=this.clock().toISOString();
    this.audit({organisationId:value.organisationId,actorId,eventType:'support.revoked',entityType:'support-grant',entityId:id,payload:{}});return structuredClone(value)}
}
function aiTransparency(input){
  if(typeof input.aiAssisted!=='boolean')fail('VALIDATION_ERROR','aiAssisted required');
  if(!input.aiAssisted)return {aiAssisted:false};
  for(const field of ['provider','modelFamily','generatedAt','contentMarkingState'])if(!input[field])fail('VALIDATION_ERROR',field+' required');
  time(input.generatedAt,'generatedAt');
  return {aiAssisted:true,provider:input.provider,modelFamily:input.modelFamily,modelVersionOrReference:input.modelVersionOrReference||null,
    generatedAt:input.generatedAt,humanReviewRequired:Boolean(input.humanReviewRequired),humanReviewedAt:input.humanReviewedAt||null,
    humanApprovedBy:input.humanApprovedBy||null,sourceContextRefs:[...(input.sourceContextRefs||[])],contentMarkingState:input.contentMarkingState};
}
module.exports={ReleaseLifecycle,VulnerabilityRegister,TemporarySupportGrant,aiTransparency};
