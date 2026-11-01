'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {compileGrant,authorizeRead,authorizeCreate,auditMetadata}=require('../src/assistant/chati-cloud-policy');

const future=()=>new Date(Date.now()+60_000).toISOString();
const grant=(changes={})=>compileGrant({grantId:'synthetic-grant',identity:'chati',provider:'google-drive',workspaceId:'synthetic-workspace',readPrefixes:['approved-input/'],outputPrefix:'CHATI-generated/',expiresAt:future(),...changes});
const request=(changes={})=>({identity:'chati',provider:'google-drive',workspaceId:'synthetic-workspace',requestId:'synthetic-request',durationMs:1000,toolCalls:1,estimatedCostCents:1,...changes});

test('default deny and distinct identity/workspace/provider are enforced',()=>{
  assert.throws(()=>authorizeRead(null,request({objectKey:'approved-input/a.txt',bytes:1})),/NO_GRANT/);
  for(const changes of [{identity:'gini'},{workspaceId:'other'},{provider:'onedrive'}]) assert.throws(()=>authorizeRead(grant(),request({objectKey:'approved-input/a.txt',bytes:1,...changes})),/SCOPE_DENIED/);
});
test('read is limited to approved cloud prefixes and rejects traversal/local paths',()=>{
  assert.equal(authorizeRead(grant(),request({objectKey:'approved-input/a.txt',bytes:20})).operation,'read');
  for(const objectKey of ['private/a.txt','../a.txt','C:\\secret.txt','approved-input/../secret.txt']) assert.throws(()=>authorizeRead(grant(),request({objectKey,bytes:20})),/DENIED/);
});
test('size, duration, tool, cost, monthly and concurrency limits deny',()=>{
  const g=grant({maxInputBytes:10,maxDurationMs:20,maxToolCalls:2,maxJobCostCents:3,maxMonthlyCostCents:5,maxConcurrentJobs:1});
  const base={objectKey:'approved-input/a.txt',bytes:1,durationMs:10};
  assert.throws(()=>authorizeRead(g,request({...base,bytes:11})),/INPUT_SIZE_LIMIT/);
  assert.throws(()=>authorizeRead(g,request({...base,durationMs:21})),/TIME_LIMIT/);
  assert.throws(()=>authorizeRead(g,request({...base,toolCalls:3})),/TOOL_LIMIT/);
  assert.throws(()=>authorizeRead(g,request({...base,estimatedCostCents:4})),/JOB_COST_LIMIT/);
  assert.throws(()=>authorizeRead(g,request({...base,estimatedCostCents:2}),{monthlyCostCents:4}),/MONTHLY_COST_LIMIT/);
  assert.throws(()=>authorizeRead(g,request(base),{activeJobs:1}),/CONCURRENCY_LIMIT/);
});
test('write is separately granted, create-only and collision-safe inside output prefix',()=>{
  const r=request({operation:'create',fileName:'report.pdf',bytes:20});
  assert.throws(()=>authorizeCreate(grant(),r),/WRITE_NOT_GRANTED/);
  const first=authorizeCreate(grant({allowWrite:true}),r);
  assert.deepEqual({key:first.objectKey,overwrite:first.overwrite,ifAbsent:first.ifAbsent},{key:'CHATI-generated/report.pdf',overwrite:false,ifAbsent:true});
  const collision=authorizeCreate(grant({allowWrite:true}),r,{},key=>key==='CHATI-generated/report.pdf');
  assert.match(collision.objectKey,/^CHATI-generated\/report-[a-f0-9]{10}-\d+\.pdf$/);
  assert.equal(collision.overwrite,false);
});
test('grant rejects overlapping source/output and audit excludes content or credentials',()=>{
  assert.throws(()=>grant({readPrefixes:['CHATI-generated/']}),/SCOPE_OVERLAP/);
  const audit=auditMetadata(grant(),request({operation:'read',content:'secret',token:'secret'}),'denied');
  assert.equal(audit.decision,'denied');
  assert(!JSON.stringify(audit).includes('secret'));
});
