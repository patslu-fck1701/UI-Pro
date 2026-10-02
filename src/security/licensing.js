'use strict';

const crypto=require('node:crypto');
const clone=value=>structuredClone(value);
const required=(value,field)=>{const result=String(value||'').trim();if(!result){const error=new Error(field+' is required');error.code='VALIDATION_ERROR';throw error}return result};
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const b64=value=>Buffer.from(value).toString('base64url');
const unb64=value=>Buffer.from(value,'base64url');
function canonical(value){
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  return JSON.stringify(value);
}
function securityError(code,message){const error=new Error(message);error.code=code;return error}

class ProtectedCredentialStorePort {
  put(_) { throw new Error('ProtectedCredentialStorePort.put must be implemented'); }
  resolve(_) { throw new Error('ProtectedCredentialStorePort.resolve must be implemented'); }
  revoke(_) { throw new Error('ProtectedCredentialStorePort.revoke must be implemented'); }
}
class MemoryProtectedCredentialStore extends ProtectedCredentialStorePort {
  constructor(){super();this.values=new Map();}
  put({id,value}){this.values.set(required(id,'id'),value);return {id,status:'stored'}}
  resolve(id){if(!this.values.has(id))throw securityError('CREDENTIAL_UNAVAILABLE','Credential unavailable');return this.values.get(id)}
  revoke(id){this.values.delete(id);return {id,status:'revoked'}}
}

class EntitlementAuthority {
  constructor({entitlements,audit=()=>{}}){this.entitlements=entitlements;this.audit=audit;}
  authorize({session,moduleId,clientOrganisationId=null}){
    if(!session?.organisationId)throw securityError('UNAUTHENTICATED','Authentication required');
    const entitlement=this.entitlements.require(session.organisationId,moduleId);
    this.audit({organisationId:session.organisationId,actorId:session.actorId||null,eventType:'licence.authorized',entityType:'entitlement',
      entityId:session.organisationId+':'+moduleId,payload:{moduleId,clientOrganisationMismatch:Boolean(clientOrganisationId&&clientOrganisationId!==session.organisationId)}});
    return entitlement;
  }
}

class DeviceEnrollmentAuthority {
  constructor({clock=()=>new Date(),random=crypto.randomBytes,audit=()=>{},stateStore=null}={}){
    this.clock=clock;this.random=random;this.audit=audit;this.stateStore=stateStore;
    const state=stateStore?.load()||{tokens:[],devices:[],challenges:[]};
    this.tokens=new Map(state.tokens);this.devices=new Map(state.devices);this.challenges=new Map(state.challenges);
  }
  persist(){if(this.stateStore)this.stateStore.save({tokens:[...this.tokens],devices:[...this.devices],challenges:[...this.challenges]})}
  issue({organisationId,requestedBy,ttlMs=10*60*1000}){
    required(organisationId,'organisationId');required(requestedBy,'requestedBy');
    if(!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>60*60*1000)throw securityError('VALIDATION_ERROR','Invalid enrollment lifetime');
    const token=b64(this.random(32)),id='enroll_'+b64(this.random(12));
    this.tokens.set(digest(token),{id,organisationId,requestedBy,expiresAt:new Date(this.clock().getTime()+ttlMs).toISOString(),usedAt:null});
    this.persist();this.audit({organisationId,actorId:requestedBy,eventType:'device.enrollment.issued',entityType:'device-enrollment',entityId:id,payload:{expiresAt:this.tokens.get(digest(token)).expiresAt}});
    return {id,token,expiresAt:this.tokens.get(digest(token)).expiresAt};
  }
  enroll({token,devicePublicKey,label='WerkZ Agent'}){
    const key=digest(required(token,'token')),request=this.tokens.get(key);
    if(!request)throw securityError('ENROLLMENT_INVALID','Enrollment material invalid');
    if(request.usedAt)throw securityError('ENROLLMENT_REPLAY','Enrollment material already used');
    if(new Date(request.expiresAt)<=this.clock())throw securityError('ENROLLMENT_EXPIRED','Enrollment material expired');
    const publicKey=crypto.createPublicKey(required(devicePublicKey,'devicePublicKey'));
    if(publicKey.asymmetricKeyType!=='ed25519')throw securityError('VALIDATION_ERROR','Ed25519 device key required');
    request.usedAt=this.clock().toISOString();
    const device={id:'device_'+b64(this.random(12)),organisationId:request.organisationId,label,status:'active',
      publicKey:publicKey.export({type:'spki',format:'pem'}),enrolledAt:request.usedAt,revokedAt:null,enrollmentId:request.id};
    this.devices.set(device.id,device);this.persist();
    this.audit({organisationId:device.organisationId,actorId:request.requestedBy,eventType:'device.enrolled',entityType:'device',entityId:device.id,payload:{label}});
    return clone(device);
  }
  challenge(deviceId,ttlMs=2*60*1000){
    const device=this.devices.get(required(deviceId,'deviceId'));
    if(!device||device.status!=='active')throw securityError('DEVICE_DENIED','Device unavailable');
    const nonce=b64(this.random(32)),value={deviceId,nonceHash:digest(nonce),expiresAt:new Date(this.clock().getTime()+ttlMs).toISOString(),used:false};
    this.challenges.set(deviceId+':'+value.nonceHash,value);this.persist();return {deviceId,nonce,expiresAt:value.expiresAt};
  }
  authenticate({deviceId,nonce,signature}){
    const device=this.devices.get(required(deviceId,'deviceId'));
    if(!device||device.status!=='active')throw securityError('DEVICE_DENIED','Device unavailable');
    const challenge=this.challenges.get(deviceId+':'+digest(required(nonce,'nonce')));
    if(!challenge||challenge.used||new Date(challenge.expiresAt)<=this.clock())throw securityError('CHALLENGE_DENIED','Device challenge invalid');
    if(!crypto.verify(null,Buffer.from(nonce),device.publicKey,unb64(required(signature,'signature'))))throw securityError('DEVICE_DENIED','Device proof invalid');
    challenge.used=true;this.persist();
    return {deviceId:device.id,organisationId:device.organisationId,authenticatedAt:this.clock().toISOString()};
  }
  revoke({deviceId,actorId,reason}){
    const device=this.devices.get(required(deviceId,'deviceId'));if(!device)throw securityError('NOT_FOUND','Device not found');
    device.status='revoked';device.revokedAt=this.clock().toISOString();this.persist();
    this.audit({organisationId:device.organisationId,actorId,eventType:'device.revoked',entityType:'device',entityId:device.id,payload:{reason:required(reason,'reason')}});
    return clone(device);
  }
  get(deviceId){const value=this.devices.get(deviceId);return value?clone(value):null}
  list({organisationId=null,status=null}={}){
    return [...this.devices.values()]
      .filter(value=>(!organisationId||value.organisationId===organisationId)&&(!status||value.status===status))
      .sort((a,b)=>a.enrolledAt.localeCompare(b.enrolledAt)||a.id.localeCompare(b.id))
      .map(clone);
  }
}

class SignedDocumentVerifier {
  constructor({publicKeys,clock=()=>new Date(),revokedSerials=[]}){this.publicKeys=new Map(Object.entries(publicKeys));this.clock=clock;this.revoked=new Set(revokedSerials);}
  verify(document){
    const key=this.publicKeys.get(document?.keyId);if(!key)throw securityError('SIGNATURE_INVALID','Unknown signing key');
    const payload=canonical(document.payload);
    if(document.algorithm!=='Ed25519'||!crypto.verify(null,Buffer.from(payload),key,unb64(document.signature||'')))throw securityError('SIGNATURE_INVALID','Signature invalid');
    if(document.payload.serial&&this.revoked.has(document.payload.serial))throw securityError('LICENCE_REVOKED','Licence revoked');
    if(document.payload.notBefore&&new Date(document.payload.notBefore)>this.clock())throw securityError('LICENCE_NOT_YET_VALID','Licence not yet valid');
    if(document.payload.expiresAt&&new Date(document.payload.expiresAt)<=this.clock())throw securityError('LICENCE_EXPIRED','Licence expired');
    return clone(document.payload);
  }
}
class OfflineLicenceSigner {
  constructor({privateKey,keyId}){this.privateKey=privateKey;this.keyId=required(keyId,'keyId');}
  sign(payload){
    const value=clone(payload);required(value.serial,'payload.serial');required(value.organisationId,'payload.organisationId');required(value.deploymentId,'payload.deploymentId');
    if(!Array.isArray(value.modules))throw securityError('VALIDATION_ERROR','payload.modules must be an array');
    return {schemaVersion:1,algorithm:'Ed25519',keyId:this.keyId,payload:value,signature:b64(crypto.sign(null,Buffer.from(canonical(value)),this.privateKey))};
  }
}
class ReleaseManifestSigner {
  constructor({privateKey,keyId}){this.privateKey=privateKey;this.keyId=required(keyId,'keyId');}
  sign(payload){
    const value=clone(payload);required(value.productId,'productId');required(value.version,'version');required(value.channel,'channel');
    if(!Array.isArray(value.artifacts)||!value.artifacts.length)throw securityError('VALIDATION_ERROR','artifacts required');
    return {schemaVersion:1,algorithm:'Ed25519',keyId:this.keyId,payload:value,signature:b64(crypto.sign(null,Buffer.from(canonical(value)),this.privateKey))};
  }
}
class ReleaseVerifier extends SignedDocumentVerifier {
  verifyRelease(manifest,artifacts){
    const payload=this.verify(manifest);
    for(const artifact of payload.artifacts){
      const bytes=artifacts[artifact.name];if(bytes===undefined)throw securityError('ARTIFACT_MISSING','Artifact missing');
      if('sha256:'+digest(bytes)!==artifact.sha256)throw securityError('DIGEST_MISMATCH','Artifact digest mismatch');
    }
    return payload;
  }
}
module.exports={ProtectedCredentialStorePort,MemoryProtectedCredentialStore,EntitlementAuthority,DeviceEnrollmentAuthority,
  SignedDocumentVerifier,OfflineLicenceSigner,ReleaseManifestSigner,ReleaseVerifier,canonical};
