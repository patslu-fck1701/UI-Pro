'use strict';

/**
 * CHATI cloud-object authorization core.
 *
 * This module deliberately has no filesystem, network or credential access.
 * A server-side connector must call it before every provider operation.  No
 * grant means deny; write grants are separate from read grants.
 */
const crypto = require('node:crypto');

const DENY = (code) => Object.assign(new Error(code), {code});
const PROVIDERS = new Set(['google-drive', 'onedrive', 'dropbox', 's3']);
const DEFAULTS = Object.freeze({maxInputBytes:10*1024*1024,maxOutputBytes:5*1024*1024,maxDurationMs:60_000,maxToolCalls:10,maxJobCostCents:25,maxMonthlyCostCents:500,maxConcurrentJobs:1});

function cleanPrefix(value, field) {
  if (typeof value !== 'string' || !value || value.startsWith('/') || value.includes('\\') || value.includes('\0')) throw DENY('SCOPE_INVALID');
  const parts=value.split('/').filter(Boolean);
  if (!parts.length || parts.some(p=>p==='.'||p==='..')) throw DENY('SCOPE_INVALID');
  return parts.join('/')+'/';
}
function cleanObject(value) {
  if (typeof value !== 'string' || !value || value.startsWith('/') || value.endsWith('/') || value.includes('\\') || value.includes('\0')) throw DENY('OBJECT_DENIED');
  const parts=value.split('/');
  if (parts.some(p=>!p||p==='.'||p==='..')) throw DENY('OBJECT_DENIED');
  return parts.join('/');
}
function positive(value, fallback) { return Number.isSafeInteger(value)&&value>0?value:fallback; }

function compileGrant(input) {
  if (!input || input.identity !== 'chati' || !PROVIDERS.has(input.provider) || typeof input.workspaceId !== 'string' || !input.workspaceId) throw DENY('GRANT_INVALID');
  const readPrefixes=Array.isArray(input.readPrefixes)?[...new Set(input.readPrefixes.map(v=>cleanPrefix(v,'readPrefixes')))]:[];
  const outputPrefix=cleanPrefix(input.outputPrefix||'CHATI-generated/','outputPrefix');
  if (readPrefixes.includes(outputPrefix)) throw DENY('SCOPE_OVERLAP');
  const expiresAt=Date.parse(input.expiresAt||'');
  if (!Number.isFinite(expiresAt)) throw DENY('GRANT_INVALID');
  return Object.freeze({
    grantId:String(input.grantId||''),identity:'chati',provider:input.provider,workspaceId:input.workspaceId,
    readPrefixes:Object.freeze(readPrefixes),outputPrefix,allowWrite:input.allowWrite===true,expiresAt,
    maxInputBytes:positive(input.maxInputBytes,DEFAULTS.maxInputBytes),maxOutputBytes:positive(input.maxOutputBytes,DEFAULTS.maxOutputBytes),
    maxDurationMs:positive(input.maxDurationMs,DEFAULTS.maxDurationMs),maxToolCalls:positive(input.maxToolCalls,DEFAULTS.maxToolCalls),
    maxJobCostCents:positive(input.maxJobCostCents,DEFAULTS.maxJobCostCents),maxMonthlyCostCents:positive(input.maxMonthlyCostCents,DEFAULTS.maxMonthlyCostCents),
    maxConcurrentJobs:positive(input.maxConcurrentJobs,DEFAULTS.maxConcurrentJobs),
  });
}
function baseCheck(grant, request, usage, now) {
  if (!grant || grant.identity!=='chati') throw DENY('NO_GRANT');
  if (now>=grant.expiresAt) throw DENY('GRANT_EXPIRED');
  if (!request || request.identity!=='chati'||request.provider!==grant.provider||request.workspaceId!==grant.workspaceId) throw DENY('SCOPE_DENIED');
  if (positive(request.durationMs,grant.maxDurationMs+1)>grant.maxDurationMs) throw DENY('TIME_LIMIT');
  if (positive(request.toolCalls,grant.maxToolCalls+1)>grant.maxToolCalls) throw DENY('TOOL_LIMIT');
  if (positive(request.estimatedCostCents,grant.maxJobCostCents+1)>grant.maxJobCostCents) throw DENY('JOB_COST_LIMIT');
  if ((usage?.monthlyCostCents||0)+request.estimatedCostCents>grant.maxMonthlyCostCents) throw DENY('MONTHLY_COST_LIMIT');
  if ((usage?.activeJobs||0)>=grant.maxConcurrentJobs) throw DENY('CONCURRENCY_LIMIT');
}
function authorizeRead(grant, request, usage={}, now=Date.now()) {
  baseCheck(grant,request,usage,now);
  const key=cleanObject(request.objectKey);
  if (!grant.readPrefixes.some(prefix=>key.startsWith(prefix))) throw DENY('READ_SCOPE_DENIED');
  if (!Number.isSafeInteger(request.bytes)||request.bytes<0||request.bytes>grant.maxInputBytes) throw DENY('INPUT_SIZE_LIMIT');
  return {operation:'read',provider:grant.provider,workspaceId:grant.workspaceId,objectKey:key,deadlineAt:new Date(now+request.durationMs).toISOString()};
}
function uniqueOutputKey(prefix, requestedName, requestId, exists) {
  const name=cleanObject(requestedName);
  if (name.includes('/')) throw DENY('OUTPUT_NAME_DENIED');
  let key=prefix+name;
  if (!exists(key)) return key;
  const dot=name.lastIndexOf('.'),stem=dot>0?name.slice(0,dot):name,ext=dot>0?name.slice(dot):'';
  const suffix=crypto.createHash('sha256').update(String(requestId)).digest('hex').slice(0,10);
  for(let n=1;n<=100;n++) { key=`${prefix}${stem}-${suffix}-${n}${ext}`; if(!exists(key))return key; }
  throw DENY('OUTPUT_COLLISION_LIMIT');
}
function authorizeCreate(grant, request, usage={}, exists=()=>false, now=Date.now()) {
  baseCheck(grant,request,usage,now);
  if (!grant.allowWrite) throw DENY('WRITE_NOT_GRANTED');
  if (!Number.isSafeInteger(request.bytes)||request.bytes<0||request.bytes>grant.maxOutputBytes) throw DENY('OUTPUT_SIZE_LIMIT');
  if (typeof request.requestId!=='string'||!request.requestId) throw DENY('REQUEST_ID_REQUIRED');
  const objectKey=uniqueOutputKey(grant.outputPrefix,request.fileName,request.requestId,exists);
  return {operation:'create',overwrite:false,ifAbsent:true,provider:grant.provider,workspaceId:grant.workspaceId,objectKey,deadlineAt:new Date(now+request.durationMs).toISOString()};
}
function auditMetadata(grant, request, decision, now=Date.now()) {
  return {event:'chati.cloud.authorization',at:new Date(now).toISOString(),identity:'chati',grantId:grant?.grantId||null,requestId:request?.requestId||null,provider:request?.provider||null,workspaceId:request?.workspaceId||null,operation:request?.operation||null,decision};
}

module.exports={DEFAULTS,compileGrant,authorizeRead,authorizeCreate,auditMetadata};
