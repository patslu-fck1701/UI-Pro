'use strict';

const test=require('node:test'),assert=require('node:assert/strict');
const {ReleaseLifecycle,VulnerabilityRegister,TemporarySupportGrant,aiTransparency}=require('../src');
test('release support and EOL are explicit and time bounded',()=>{
  const lifecycle=new ReleaseLifecycle({clock:()=>new Date('2026-10-02T00:00:00Z')});
  lifecycle.register({productId:'werkz-agent',version:'1.0.0',releasedAt:'2026-10-01T00:00:00Z',supportedUntil:'2031-10-01T00:00:00Z',channel:'pilot'});
  assert.equal(lifecycle.isSupported('werkz-agent','1.0.0'),true);
  assert.equal(lifecycle.isSupported('werkz-agent','1.0.0',new Date('2031-10-02T00:00:00Z')),false);
  assert.throws(()=>lifecycle.register({productId:'x',version:'1',releasedAt:'2026-01-01',supportedUntil:'2025-01-01',channel:'stable'}),error=>error.code==='VALIDATION_ERROR');
});
test('vulnerability lifecycle requires triage, remediation, fix and final reporting decision before closure',()=>{
  let current=new Date('2026-10-02T00:00:00Z'),events=[];
  const register=new VulnerabilityRegister({clock:()=>current,audit:event=>events.push(event)});
  const v=register.intake({productId:'werkz-agent',source:'private report',summary:'test',privateReference:'ticket-1'});
  assert.equal(v.craAssessment,'not_assessed');
  const triaged=register.triage(v.id,{severity:'high',affectedVersions:['1.0.0'],knownExploitation:false,craAssessment:'needs_legal_review',owner:'security-owner'});
  assert.equal(triaged.status,'triaged');assert.equal(triaged.craAssessment,'needs_legal_review');
  assert.throws(()=>register.close(v.id,{closedBy:'security-owner',resolution:'fixed'}),error=>error.code==='INVALID_STATE');
  const planned=register.planRemediation(v.id,{targetFixAt:'2026-10-10T00:00:00Z',remediationRef:'fix-plan-1'});
  assert.equal(planned.status,'remediation');
  current=new Date('2026-10-03T00:00:00Z');
  const fixed=register.recordFix(v.id,{fixVersion:'1.0.1',releaseRef:'release-1.0.1'});
  assert.equal(fixed.status,'fixed');assert.equal(fixed.fixVersion,'1.0.1');
  assert.throws(()=>register.close(v.id,{closedBy:'security-owner',resolution:'fixed'}),error=>error.code==='INVALID_STATE');
  const decision=register.decideReporting(v.id,{craAssessment:'not_reportable',decidedBy:'security-owner',reference:'assessment-1'});
  assert.equal(decision.craAssessment,'not_reportable');
  const closed=register.close(v.id,{closedBy:'security-owner',resolution:'patched',advisoryRef:'ADV-2026-001'});
  assert.equal(closed.status,'closed');assert.equal(closed.disclosureState,'advisory_published');
  assert.equal(events.some(event=>event.eventType==='vulnerability.fixed'),true);
  assert.equal(events.some(event=>event.eventType==='vulnerability.reporting.assessed'),true);
  assert.equal(events.some(event=>event.eventType==='vulnerability.closed'),true);
});
test('support access is scoped by tenant, actor, capability, resource and expiry',()=>{
  let current=new Date('2026-10-01T00:00:00Z'),events=[];
  const grants=new TemporarySupportGrant({clock:()=>current,audit:event=>events.push(event)});
  const grant=grants.create({organisationId:'org-a',approvedBy:'customer-admin',supportActorId:'support-1',ticketId:'ticket-1',
    capabilities:['time.read'],resources:['time-1'],expiresAt:'2026-10-02T00:00:00Z'});
  assert.equal(grants.authorize(grant.id,{organisationId:'org-a',actorId:'support-1',capability:'time.read',resourceId:'time-1'}),true);
  assert.throws(()=>grants.authorize(grant.id,{organisationId:'org-b',actorId:'support-1',capability:'time.read',resourceId:'time-1'}),error=>error.code==='FORBIDDEN');
  assert.throws(()=>grants.authorize(grant.id,{organisationId:'org-a',actorId:'support-1',capability:'time.write',resourceId:'time-1'}),error=>error.code==='FORBIDDEN');
  current=new Date('2026-10-03T00:00:00Z');
  assert.throws(()=>grants.authorize(grant.id,{organisationId:'org-a',actorId:'support-1',capability:'time.read',resourceId:'time-1'}),error=>error.code==='FORBIDDEN');
  assert.equal(events.some(e=>e.eventType==='support.used'),true);
});
test('AI-assisted output preserves transparency and human review state',()=>{
  const result=aiTransparency({aiAssisted:true,provider:'example',modelFamily:'test',generatedAt:'2026-10-01T00:00:00Z',
    contentMarkingState:'marked',humanReviewRequired:true});
  assert.equal(result.aiAssisted,true);assert.equal(result.humanReviewRequired,true);
  assert.throws(()=>aiTransparency({aiAssisted:true}),error=>error.code==='VALIDATION_ERROR');
});
