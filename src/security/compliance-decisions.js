'use strict';

const crypto=require('node:crypto');
const {InMemoryComplianceDecisionRepository}=require('./compliance-durable');

const CRA_SCOPE_STATES=new Set(['likely_in_scope','excluded','needs_legal_review']);
const CRA_OPERATOR_ROLES=new Set(['manufacturer','importer','distributor','open_source_steward','provider_only','other']);
const CRA_REPORTING_STATES=new Set(['not_assessed','reporting_required','not_reportable','not_applicable','needs_legal_review']);
const CRA_CASE_TYPES=new Set(['actively_exploited_vulnerability','severe_security_incident','security_event','other']);
const REPORTING_STAGES=new Set(['early_warning','main_notification','final_report']);
const AI_ROLES=new Set(['provider','deployer','provider_and_deployer','downstream_provider','other']);
const AI_ARTICLE50_STATES=new Set(['applies','not_applicable','needs_legal_review']);
const AI_ANALYSIS_STATES=new Set(['not_applicable','unlikely','potential','needs_legal_review']);

const COMPLIANCE_SOURCE_BASELINE=Object.freeze({
  snapshotDate:'2026-10-02',
  cra:Object.freeze({
    reportingAppliesFrom:'2026-09-11',
    generalAppliesFrom:'2027-12-11',
    earlyWarningHours:24,
    mainNotificationHours:72,
    sources:Object.freeze([
      'https://eur-lex.europa.eu/eli/reg/2024/2847/oj',
      'https://digital-strategy.ec.europa.eu/en/policies/cra-reporting'
    ])
  }),
  aiAct:Object.freeze({
    article4AppliesFrom:'2025-02-02',
    article50AppliesFrom:'2026-08-02',
    sources:Object.freeze([
      'https://eur-lex.europa.eu/eli/reg/2024/1689',
      'https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-transparency-obligations'
    ])
  })
});

function fail(code,message,details){
  const error=new Error(message);error.code=code;if(details)error.details=details;throw error;
}
function required(value,field){const text=String(value??'').trim();if(!text)fail('VALIDATION_ERROR',field+' required');return text}
function date(value,field){const parsed=new Date(value);if(Number.isNaN(parsed.getTime()))fail('VALIDATION_ERROR',field+' invalid');return parsed}
function bool(value,field){if(typeof value!=='boolean')fail('VALIDATION_ERROR',field+' must be boolean');return value}
function list(value,field,{nonEmpty=false}={}){
  if(!Array.isArray(value)||(nonEmpty&&!value.length))fail('VALIDATION_ERROR',field+' invalid');
  return [...new Set(value.map(item=>required(item,field+' item')))];
}
function enumValue(value,set,field){if(!set.has(value))fail('VALIDATION_ERROR',field+' invalid');return value}
function addHours(iso,hours){const value=date(iso,'awarenessAt');return new Date(value.getTime()+hours*60*60*1000).toISOString()}
class ProductComplianceRegistry {
  constructor({clock=()=>new Date(),audit=()=>{},repository=new InMemoryComplianceDecisionRepository()}={}){this.clock=clock;this.audit=audit;this.repository=repository;}
  key(productId,deploymentProfile){return productId+':'+deploymentProfile}
  classify(input){
    const productId=required(input.productId,'productId'),deploymentProfile=required(input.deploymentProfile,'deploymentProfile');
    const key=this.key(productId,deploymentProfile);if(this.repository.get('products',key))fail('DUPLICATE_RECORD','Product classification already exists');
    const value={
      productId,deploymentProfile,
      euMarketAvailability:bool(input.euMarketAvailability,'euMarketAvailability'),
      economicOperatorRole:enumValue(input.economicOperatorRole,CRA_OPERATOR_ROLES,'economicOperatorRole'),
      craScope:enumValue(input.craScope,CRA_SCOPE_STATES,'craScope'),
      scopeRationale:required(input.scopeRationale,'scopeRationale'),
      supportOwner:required(input.supportOwner,'supportOwner'),
      supportPeriodRationale:required(input.supportPeriodRationale,'supportPeriodRationale'),
      reportingDecisionOwner:required(input.reportingDecisionOwner,'reportingDecisionOwner'),
      technicalDocumentationRef:required(input.technicalDocumentationRef,'technicalDocumentationRef'),
      supportedVersions:list(input.supportedVersions,'supportedVersions',{nonEmpty:true}),
      evidenceRefs:list(input.evidenceRefs||[],'evidenceRefs'),
      reviewedAt:(input.reviewedAt?date(input.reviewedAt,'reviewedAt'):this.clock()).toISOString(),
      reviewedBy:required(input.reviewedBy,'reviewedBy'),
      revision:1
    };
    this.repository.create('products',key,value);
    this.audit({eventType:'compliance.product.classified',entityType:'product-compliance',entityId:key,payload:{craScope:value.craScope,economicOperatorRole:value.economicOperatorRole,revision:1}});
    return structuredClone(value);
  }
  review(productId,deploymentProfile,input){
    const key=this.key(productId,deploymentProfile),current=this.repository.get('products',key);if(!current)fail('NOT_FOUND','Product classification not found');
    const next={...current};
    if(input.economicOperatorRole!==undefined)next.economicOperatorRole=enumValue(input.economicOperatorRole,CRA_OPERATOR_ROLES,'economicOperatorRole');
    if(input.craScope!==undefined)next.craScope=enumValue(input.craScope,CRA_SCOPE_STATES,'craScope');
    if(input.euMarketAvailability!==undefined)next.euMarketAvailability=bool(input.euMarketAvailability,'euMarketAvailability');
    for(const field of ['scopeRationale','supportOwner','supportPeriodRationale','reportingDecisionOwner','technicalDocumentationRef'])if(input[field]!==undefined)next[field]=required(input[field],field);
    if(input.supportedVersions!==undefined)next.supportedVersions=list(input.supportedVersions,'supportedVersions',{nonEmpty:true});
    if(input.evidenceRefs!==undefined)next.evidenceRefs=list(input.evidenceRefs,'evidenceRefs');
    next.reviewedAt=(input.reviewedAt?date(input.reviewedAt,'reviewedAt'):this.clock()).toISOString();
    next.reviewedBy=required(input.reviewedBy,'reviewedBy');next.revision=current.revision+1;
    this.repository.replace('products',key,input.expectedRevision,next);
    this.audit({eventType:'compliance.product.reviewed',entityType:'product-compliance',entityId:key,payload:{craScope:next.craScope,revision:next.revision}});
    return structuredClone(next);
  }
  get(productId,deploymentProfile){return this.repository.get('products',this.key(productId,deploymentProfile))}
  readiness(productId,deploymentProfile){
    const value=this.get(productId,deploymentProfile);if(!value)fail('NOT_FOUND','Product classification not found');
    const blockers=[];
    if(value.craScope==='needs_legal_review')blockers.push('cra_scope_needs_legal_review');
    if(!value.evidenceRefs.length)blockers.push('evidence_refs_missing');
    return {ready:blockers.length===0,blockers,legalComplianceClaim:false,classificationRevision:value.revision};
  }
}

class SecurityReportingCaseRegister {
  constructor({clock=()=>new Date(),audit=()=>{},repository=new InMemoryComplianceDecisionRepository()}={}){this.clock=clock;this.audit=audit;this.repository=repository;}
  intake(input){
    const id='security_case_'+crypto.randomUUID(),awarenessAt=date(input.awarenessAt,'awarenessAt').toISOString();
    const value={
      id,productId:required(input.productId,'productId'),caseType:enumValue(input.caseType,CRA_CASE_TYPES,'caseType'),
      awarenessAt,summary:required(input.summary,'summary'),privateReference:required(input.privateReference,'privateReference'),
      craReportingState:'not_assessed',decisionRationale:null,decidedAt:null,decidedBy:null,decisionReference:null,
      activeExploitation:null,severeIncident:null,operationalDeadlines:null,submissions:{},closedAt:null,closedBy:null,revision:1
    };
    this.repository.create('reportingCases',id,value);
    this.audit({eventType:'security.reporting.intake',entityType:'security-reporting-case',entityId:id,payload:{productId:value.productId,caseType:value.caseType,revision:1}});
    return structuredClone(value);
  }
  require(id){const value=this.repository.get('reportingCases',id);if(!value)fail('NOT_FOUND','Security reporting case not found');return value}
  assess(id,input){
    const value=this.require(id);
    const state=enumValue(input.craReportingState,CRA_REPORTING_STATES,'craReportingState');
    if(state==='not_assessed')fail('VALIDATION_ERROR','Final assessment state required');
    value.craReportingState=state;value.decisionRationale=required(input.decisionRationale,'decisionRationale');
    value.decidedBy=required(input.decidedBy,'decidedBy');value.decisionReference=required(input.decisionReference,'decisionReference');
    value.decidedAt=this.clock().toISOString();
    value.activeExploitation=input.activeExploitation===null||input.activeExploitation===undefined?null:bool(input.activeExploitation,'activeExploitation');
    value.severeIncident=input.severeIncident===null||input.severeIncident===undefined?null:bool(input.severeIncident,'severeIncident');
    value.operationalDeadlines=state==='reporting_required'?{
      earlyWarningDueAt:addHours(value.awarenessAt,COMPLIANCE_SOURCE_BASELINE.cra.earlyWarningHours),
      mainNotificationDueAt:addHours(value.awarenessAt,COMPLIANCE_SOURCE_BASELINE.cra.mainNotificationHours),
      sourceSnapshotDate:COMPLIANCE_SOURCE_BASELINE.snapshotDate,
      legalApplicabilityExternallyAssessed:true
    }:null;
    value.revision++;
    this.repository.replace('reportingCases',id,input.expectedRevision,value);
    this.audit({eventType:'security.reporting.assessed',entityType:'security-reporting-case',entityId:id,payload:{craReportingState:state,decisionReference:value.decisionReference,revision:value.revision}});
    return structuredClone(value);
  }
  recordSubmission(id,input){
    const value=this.require(id);
    if(value.craReportingState!=='reporting_required')fail('INVALID_STATE','Reporting-required assessment is required');
    const stage=enumValue(input.stage,REPORTING_STAGES,'stage');
    const submittedAt=date(input.submittedAt,'submittedAt').toISOString(),reference=required(input.reference,'reference');
    let dueAt=null;if(stage==='early_warning')dueAt=value.operationalDeadlines.earlyWarningDueAt;if(stage==='main_notification')dueAt=value.operationalDeadlines.mainNotificationDueAt;
    value.submissions[stage]={submittedAt,reference,timeliness:dueAt?(new Date(submittedAt)<=new Date(dueAt)?'on_time':'late'):'recorded',dueAt};
    value.revision++;
    this.repository.replace('reportingCases',id,input.expectedRevision,value);
    this.audit({eventType:'security.reporting.submission.recorded',entityType:'security-reporting-case',entityId:id,payload:{stage,timeliness:value.submissions[stage].timeliness,revision:value.revision}});
    return structuredClone(value);
  }
  close(id,input){
    const value=this.require(id);
    if(['not_assessed','needs_legal_review'].includes(value.craReportingState))fail('INVALID_STATE','Final reporting assessment required');
    if(value.craReportingState==='reporting_required'){
      for(const stage of REPORTING_STAGES)if(!value.submissions[stage])fail('INVALID_STATE','Required reporting evidence missing: '+stage);
    }
    const closedBy=required(input.closedBy,'closedBy');
    value.closedAt=this.clock().toISOString();value.closedBy=closedBy;value.revision++;
    this.repository.replace('reportingCases',id,input.expectedRevision,value);
    this.audit({eventType:'security.reporting.closed',entityType:'security-reporting-case',entityId:id,payload:{craReportingState:value.craReportingState,revision:value.revision}});
    return structuredClone(value);
  }
  get(id){return this.repository.get('reportingCases',id)}
}

class AiFeatureClassificationRegistry {
  constructor({clock=()=>new Date(),audit=()=>{},repository=new InMemoryComplianceDecisionRepository()}={}){this.clock=clock;this.audit=audit;this.repository=repository;}
  normalize(input,current=null){
    const value=current?{...current}:{
      featureId:required(input.featureId,'featureId'),
      role:null,intendedPurpose:null,userPopulation:null,article50Assessment:null,transparencyControlRef:null,
      highRiskAssessment:null,prohibitedPracticeAssessment:null,humanOversightPolicyRef:null,retentionPolicyRef:null,
      aiLiteracyControlRef:null,evidenceRefs:[],reviewedAt:null,reviewedBy:null,revision:0
    };
    if(input.role!==undefined)value.role=enumValue(input.role,AI_ROLES,'role');
    if(input.intendedPurpose!==undefined)value.intendedPurpose=required(input.intendedPurpose,'intendedPurpose');
    if(input.userPopulation!==undefined)value.userPopulation=required(input.userPopulation,'userPopulation');
    if(input.article50Assessment!==undefined)value.article50Assessment=enumValue(input.article50Assessment,AI_ARTICLE50_STATES,'article50Assessment');
    if(input.transparencyControlRef!==undefined)value.transparencyControlRef=input.transparencyControlRef?required(input.transparencyControlRef,'transparencyControlRef'):null;
    if(input.highRiskAssessment!==undefined)value.highRiskAssessment=enumValue(input.highRiskAssessment,AI_ANALYSIS_STATES,'highRiskAssessment');
    if(input.prohibitedPracticeAssessment!==undefined)value.prohibitedPracticeAssessment=enumValue(input.prohibitedPracticeAssessment,AI_ANALYSIS_STATES,'prohibitedPracticeAssessment');
    if(input.humanOversightPolicyRef!==undefined)value.humanOversightPolicyRef=required(input.humanOversightPolicyRef,'humanOversightPolicyRef');
    if(input.retentionPolicyRef!==undefined)value.retentionPolicyRef=required(input.retentionPolicyRef,'retentionPolicyRef');
    if(input.aiLiteracyControlRef!==undefined)value.aiLiteracyControlRef=input.aiLiteracyControlRef?required(input.aiLiteracyControlRef,'aiLiteracyControlRef'):null;
    if(input.evidenceRefs!==undefined)value.evidenceRefs=list(input.evidenceRefs,'evidenceRefs');
    for(const field of ['role','intendedPurpose','userPopulation','article50Assessment','highRiskAssessment','prohibitedPracticeAssessment','humanOversightPolicyRef','retentionPolicyRef'])if(!value[field])fail('VALIDATION_ERROR',field+' required');
    if(value.article50Assessment==='applies'&&!value.transparencyControlRef)fail('VALIDATION_ERROR','transparencyControlRef required when Article 50 assessment applies');
    value.reviewedAt=(input.reviewedAt?date(input.reviewedAt,'reviewedAt'):this.clock()).toISOString();
    value.reviewedBy=required(input.reviewedBy,'reviewedBy');
    return value;
  }
  classify(input){
    const featureId=required(input.featureId,'featureId');if(this.repository.get('aiFeatures',featureId))fail('DUPLICATE_RECORD','AI feature classification already exists');
    const value=this.normalize({...input,featureId});value.revision=1;this.repository.create('aiFeatures',featureId,value);
    this.audit({eventType:'compliance.ai_feature.classified',entityType:'ai-feature-compliance',entityId:featureId,payload:{article50Assessment:value.article50Assessment,revision:1}});
    return structuredClone(value);
  }
  review(featureId,input){
    const current=this.repository.get('aiFeatures',featureId);if(!current)fail('NOT_FOUND','AI feature classification not found');
    const next=this.normalize(input,current);next.revision=current.revision+1;this.repository.replace('aiFeatures',featureId,input.expectedRevision,next);
    this.audit({eventType:'compliance.ai_feature.reviewed',entityType:'ai-feature-compliance',entityId:featureId,payload:{article50Assessment:next.article50Assessment,revision:next.revision}});
    return structuredClone(next);
  }
  get(featureId){return this.repository.get('aiFeatures',featureId)}
  releaseReadiness(featureId){
    const value=this.get(featureId);if(!value)fail('NOT_FOUND','AI feature classification not found');
    const blockers=[];
    if(value.article50Assessment==='needs_legal_review')blockers.push('article50_needs_legal_review');
    if(['potential','needs_legal_review'].includes(value.highRiskAssessment))blockers.push('high_risk_analysis_open');
    if(['potential','needs_legal_review'].includes(value.prohibitedPracticeAssessment))blockers.push('prohibited_practice_analysis_open');
    if(['provider','deployer','provider_and_deployer'].includes(value.role)&&!value.aiLiteracyControlRef)blockers.push('ai_literacy_control_missing');
    if(!value.evidenceRefs.length)blockers.push('evidence_refs_missing');
    return {ready:blockers.length===0,blockers,legalComplianceClaim:false,classificationRevision:value.revision};
  }
}

module.exports={
  COMPLIANCE_SOURCE_BASELINE,
  ProductComplianceRegistry,
  SecurityReportingCaseRegister,
  AiFeatureClassificationRegistry
};
