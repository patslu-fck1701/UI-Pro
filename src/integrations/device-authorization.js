'use strict';

const crypto=require('node:crypto');
const b64=value=>Buffer.from(value).toString('base64url');
const digest=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
function fail(code,message){const error=new Error(message);error.code=code;throw error}
function required(value,name){const text=String(value||'').trim();if(!text)fail('VALIDATION_ERROR',name+' required');return text}

class DeviceAuthorizationFlow {
  constructor({enrollmentAuthority,verificationUri,clock=()=>new Date(),random=crypto.randomBytes,audit=()=>{},pollIntervalMs=5000,maxApprovalAttempts=5,approvalWindowMs=60000}={}){
    if(!enrollmentAuthority)throw new Error('enrollmentAuthority required');
    const uri=new URL(required(verificationUri,'verificationUri'));if(uri.protocol!=='https:')fail('VALIDATION_ERROR','verificationUri must use HTTPS');
    this.enrollmentAuthority=enrollmentAuthority;this.verificationUri=uri.toString();this.clock=clock;this.random=random;this.audit=audit;
    this.pollIntervalMs=pollIntervalMs;this.maxApprovalAttempts=maxApprovalAttempts;this.approvalWindowMs=approvalWindowMs;
    this.pending=new Map();this.userCodes=new Map();this.attempts=new Map();
  }
  start({deviceLabel='WerkZ Agent',requestedScopes=[],ttlMs=10*60*1000}={}){
    if(!Array.isArray(requestedScopes)||requestedScopes.some(scope=>!String(scope||'').trim()))fail('VALIDATION_ERROR','requestedScopes invalid');
    if(!Number.isSafeInteger(ttlMs)||ttlMs<60*1000||ttlMs>15*60*1000)fail('VALIDATION_ERROR','ttlMs invalid');
    const deviceCode=b64(this.random(32)),userCode=b64(this.random(6)).slice(0,8).toUpperCase();
    const expiresAt=new Date(this.clock().getTime()+ttlMs).toISOString(),key=digest(deviceCode),userKey=digest(userCode);
    const value={deviceCodeHash:key,userCodeHash:userKey,deviceLabel:required(deviceLabel,'deviceLabel'),requestedScopes:[...new Set(requestedScopes)],
      expiresAt,status:'pending',approvedBy:null,organisationId:null,enrollment:null,lastPollAt:null,consumedAt:null};
    this.pending.set(key,value);this.userCodes.set(userKey,key);
    this.audit({eventType:'device.authorization.started',entityType:'device-authorization',entityId:key,payload:{deviceLabel:value.deviceLabel,expiresAt}});
    const complete=new URL(this.verificationUri);complete.searchParams.set('user_code',userCode);
    return {deviceCode,userCode,verificationUri:this.verificationUri,verificationUriComplete:complete.toString(),expiresAt,intervalSeconds:Math.ceil(this.pollIntervalMs/1000)};
  }
  limitApproval(session){
    const key=required(session?.organisationId,'organisationId')+':'+required(session?.actorId,'actorId'),now=this.clock().getTime(),current=this.attempts.get(key);
    if(!current||now-current.windowStartedAt>=this.approvalWindowMs){this.attempts.set(key,{windowStartedAt:now,count:1});return}
    current.count++;if(current.count>this.maxApprovalAttempts)fail('RATE_LIMITED','Too many device approval attempts');
  }
  approve({session,userCode}){
    this.limitApproval(session);
    const key=this.userCodes.get(digest(required(userCode,'userCode'))),value=key?this.pending.get(key):null;
    if(!value||value.status!=='pending'||new Date(value.expiresAt)<=this.clock())fail('DEVICE_CODE_DENIED','Device authorization unavailable');
    const organisationId=required(session.organisationId,'organisationId'),actorId=required(session.actorId,'actorId');
    const remaining=Math.max(60000,new Date(value.expiresAt).getTime()-this.clock().getTime());
    value.enrollment=this.enrollmentAuthority.issue({organisationId,requestedBy:actorId,ttlMs:Math.min(remaining,10*60*1000)});
    value.status='approved';value.approvedBy=actorId;value.organisationId=organisationId;this.userCodes.delete(value.userCodeHash);
    this.audit({organisationId,actorId,eventType:'device.authorization.approved',entityType:'device-authorization',entityId:key,payload:{deviceLabel:value.deviceLabel}});
    return {status:'approved',organisationId,deviceLabel:value.deviceLabel,expiresAt:value.expiresAt};
  }
  poll({deviceCode}){
    const key=digest(required(deviceCode,'deviceCode')),value=this.pending.get(key);
    if(!value||new Date(value.expiresAt)<=this.clock())fail('DEVICE_CODE_DENIED','Device authorization unavailable');
    if(value.consumedAt)fail('DEVICE_CODE_USED','Device authorization already consumed');
    const now=this.clock();
    if(value.lastPollAt&&now.getTime()-new Date(value.lastPollAt).getTime()<this.pollIntervalMs)fail('SLOW_DOWN','Polling too quickly');
    value.lastPollAt=now.toISOString();
    if(value.status!=='approved')return {status:'authorization_pending',intervalSeconds:Math.ceil(this.pollIntervalMs/1000),expiresAt:value.expiresAt};
    value.consumedAt=now.toISOString();value.status='consumed';
    const result={status:'approved',organisationId:value.organisationId,deviceLabel:value.deviceLabel,requestedScopes:[...value.requestedScopes],
      enrollmentToken:value.enrollment.token,enrollmentExpiresAt:value.enrollment.expiresAt};
    value.enrollment={id:value.enrollment.id,expiresAt:value.enrollment.expiresAt};
    this.audit({organisationId:value.organisationId,actorId:value.approvedBy,eventType:'device.authorization.consumed',
      entityType:'device-authorization',entityId:key,payload:{deviceLabel:value.deviceLabel}});
    return result;
  }
}
module.exports={DeviceAuthorizationFlow};
