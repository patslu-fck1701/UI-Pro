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
      severity:null,affectedVersions:[],knownExploitation:null,craAssessment:'not_assessed',owner:null,fixVersion:null,fixReleaseRef:null,
      remediationRef:null,targetFixAt:null,fixedAt:null,reportingDecisionAt:null,reportingDecidedBy:null,reportingReference:null,
      closedAt:null,closedBy:null,resolution:null,disclosureState:'private'};
    this.records.set(id,value);this.audit({eventType:'vulnerability.received',entityType:'vulnerability',entityId:id,payload:{productId}});
    return structuredClone(value);
  }
  require(id){const value=this.records.get(id);if(!value)fail('NOT_FOUND','Vulnerability not found');return value}
  triage(id,{severity,affectedVersions,knownExploitation,craAssessment,owner}){
    const value=this.require(id);
    if(value.status!=='intake')fail('INVALID_STATE','Vulnerability already triaged');
    if(!['low','medium','high','critical'].includes(severity)||!Array.isArray(affectedVersions)||!affectedVersions.length||!owner)fail('VALIDATION_ERROR','Triage incomplete');
    if(!['not_applicable','needs_legal_review','reporting_required','not_reportable'].includes(craAssessment))fail('VALIDATION_ERROR','CRA decision state invalid');
    Object.assign(value,{status:'triaged',severity,affectedVersions:[...affectedVersions],knownExploitation:Boolean(knownExploitation),craAssessment,owner,triagedAt:this.clock().toISOString()});
    this.audit({eventType:'vulnerability.triaged',entityType:'vulnerability',entityId:id,payload:{severity,craAssessment}});
    return structuredClone(value);
  }
  planRemediation(id,{targetFixAt,remediationRef}){
    const value=this.require(id);
    if(!['triaged','remediation'].includes(value.status))fail('INVALID_STATE','Triage required before remediation');
    if(!remediationRef)fail('VALIDATION_ERROR','remediationRef required');
    if(targetFixAt&&time(targetFixAt,'targetFixAt')<=this.clock())fail('VALIDATION_ERROR','targetFixAt must be in the future');
    Object.assign(value,{status:'remediation',targetFixAt:targetFixAt||null,remediationRef,remediationPlannedAt:this.clock().toISOString()});
    this.audit({eventType:'vulnerability.remediation.planned',entityType:'vulnerability',entityId:id,payload:{targetFixAt:value.targetFixAt}});
    return structuredClone(value);
  }
  recordFix(id,{fixVersion,releaseRef}){
    const value=this.require(id);
    if(!['triaged','remediation'].includes(value.status))fail('INVALID_STATE','Triage required before fix');
    if(!fixVersion||!releaseRef)fail('VALIDATION_ERROR','fixVersion and releaseRef required');
    Object.assign(value,{status:'fixed',fixVersion,fixReleaseRef:releaseRef,fixedAt:this.clock().toISOString()});
    this.audit({eventType:'vulnerability.fixed',entityType:'vulnerability',entityId:id,payload:{fixVersion,releaseRef}});
    return structuredClone(value);
  }
  decideReporting(id,{craAssessment,decidedBy,reference}){
    const value=this.require(id);
    if(!['not_applicable','needs_legal_review','reporting_required','not_reportable'].includes(craAssessment)||!decidedBy||!reference)
      fail('VALIDATION_ERROR','Reporting decision incomplete');
    Object.assign(value,{craAssessment,reportingDecisionAt:this.clock().toISOString(),reportingDecidedBy:decidedBy,reportingReference:reference});
    this.audit({eventType:'vulnerability.reporting.assessed',entityType:'vulnerability',entityId:id,payload:{craAssessment,reference}});
    return structuredClone(value);
  }
  close(id,{closedBy,resolution,advisoryRef=null}){
    const value=this.require(id);
    if(value.status!=='fixed')fail('INVALID_STATE','Fixed vulnerability required before closure');
    if(['not_assessed','needs_legal_review'].includes(value.craAssessment)||!value.reportingDecisionAt)fail('INVALID_STATE','Final reporting assessment required before closure');
    if(!closedBy||!resolution)fail('VALIDATION_ERROR','Closure metadata required');
    Object.assign(value,{status:'closed',closedAt:this.clock().toISOString(),closedBy,resolution,disclosureState:advisoryRef?'advisory_published':'private',advisoryRef});
    this.audit({eventType:'vulnerability.closed',entityType:'vulnerability',entityId:id,payload:{resolution,advisoryRef}});
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
