'use strict';

const crypto=require('node:crypto');
const {ReleaseVerifier}=require('./licensing');

function fail(code,message){const error=new Error(message);error.code=code;throw error}
function required(value,name){const text=String(value||'').trim();if(!text)fail('VALIDATION_ERROR',name+' required');return text}
function instant(value,name){
  const date=value instanceof Date?value:new Date(required(value,name));
  if(Number.isNaN(date.getTime()))fail('VALIDATION_ERROR',name+' invalid');
  return date;
}
function fingerprint(publicKey){
  const der=publicKey.export({type:'spki',format:'der'});
  return 'sha256:'+crypto.createHash('sha256').update(der).digest('hex');
}
function normalizePublicKey(value){
  if(value?.type==='private')fail('VALIDATION_ERROR','Private key material is not allowed in the public release keyring');
  if(typeof value==='string'||Buffer.isBuffer(value)){
    const text=Buffer.isBuffer(value)?value.toString('utf8'):value;
    if(/-----BEGIN [^-]*PRIVATE KEY-----/.test(text))fail('VALIDATION_ERROR','Private key material is not allowed in the public release keyring');
  }
  let key;
  try{key=value?.type==='public'?value:crypto.createPublicKey(value)}
  catch{fail('VALIDATION_ERROR','Valid public verification key required')}
  if(key.type!=='public'||key.asymmetricKeyType!=='ed25519')fail('VALIDATION_ERROR','Ed25519 public key required');
  return key;
}

class ReleaseKeyRing {
  constructor({clock=()=>new Date(),keys=[]}={}){
    this.clock=clock;this.keys=new Map();
    for(const value of keys)this.add(value);
  }
  add({keyId,publicKey,activatedAt}){
    keyId=required(keyId,'keyId');
    if(this.keys.has(keyId))fail('KEY_EXISTS','Release key already exists');
    const key=normalizePublicKey(publicKey),active=instant(activatedAt||this.clock(),'activatedAt').toISOString();
    const record={keyId,publicKey:key,status:'active',activatedAt:active,retiredAt:null,revokedAt:null,replacementKeyId:null,reason:null,fingerprint:fingerprint(key)};
    this.keys.set(keyId,record);return this.describe(keyId);
  }
  require(keyId){const value=this.keys.get(required(keyId,'keyId'));if(!value)fail('SIGNATURE_INVALID','Unknown signing key');return value}
  describe(keyId){
    const value=this.require(keyId);
    return {keyId:value.keyId,status:value.status,activatedAt:value.activatedAt,retiredAt:value.retiredAt,revokedAt:value.revokedAt,
      replacementKeyId:value.replacementKeyId,reason:value.reason,fingerprint:value.fingerprint,
      publicKey:value.publicKey.export({type:'spki',format:'pem'})};
  }
  list(){return [...this.keys.keys()].sort().map(keyId=>this.describe(keyId))}
  retire({keyId,replacementKeyId,retiredAt}){
    const value=this.require(keyId),replacement=this.require(replacementKeyId);
    if(value.status!=='active')fail('INVALID_STATE','Only an active key can be retired');
    if(replacement.status!=='active'||replacement.keyId===value.keyId)fail('INVALID_STATE','Active replacement key required');
    const at=instant(retiredAt||this.clock(),'retiredAt');
    if(at<=new Date(value.activatedAt))fail('VALIDATION_ERROR','retiredAt must be after activation');
    value.status='retired';value.retiredAt=at.toISOString();value.replacementKeyId=replacement.keyId;
    return this.describe(value.keyId);
  }
  revoke({keyId,reason,replacementKeyId=null,revokedAt}){
    const value=this.require(keyId);
    if(value.status==='revoked')fail('INVALID_STATE','Key already revoked');
    if(replacementKeyId){
      const replacement=this.require(replacementKeyId);
      if(replacement.status!=='active'||replacement.keyId===value.keyId)fail('INVALID_STATE','Active replacement key required');
      value.replacementKeyId=replacement.keyId;
    }
    const at=instant(revokedAt||this.clock(),'revokedAt');
    value.status='revoked';value.revokedAt=at.toISOString();value.reason=required(reason,'reason');
    return this.describe(value.keyId);
  }
  toJSON(){return {schemaVersion:1,keys:this.list()}}
  static fromJSON(value,{clock=()=>new Date()}={}){
    if(value?.schemaVersion!==1||!Array.isArray(value.keys))fail('VALIDATION_ERROR','Unsupported keyring format');
    const ring=new ReleaseKeyRing({clock});
    for(const item of value.keys){
      const added=ring.add({keyId:item.keyId,publicKey:item.publicKey,activatedAt:item.activatedAt});
      const record=ring.keys.get(added.keyId);
      if(item.fingerprint&&item.fingerprint!==record.fingerprint)fail('VALIDATION_ERROR','Release key fingerprint mismatch');
      if(item.status==='retired'){
        const retiredAt=instant(item.retiredAt,'retiredAt');
        if(retiredAt<=new Date(record.activatedAt))fail('VALIDATION_ERROR','retiredAt must be after activation');
        record.status='retired';record.retiredAt=retiredAt.toISOString();record.replacementKeyId=required(item.replacementKeyId,'replacementKeyId');
      }else if(item.status==='revoked'){
        const revokedAt=instant(item.revokedAt,'revokedAt');
        if(revokedAt<new Date(record.activatedAt))fail('VALIDATION_ERROR','revokedAt must not predate activation');
        record.status='revoked';record.revokedAt=revokedAt.toISOString();record.replacementKeyId=item.replacementKeyId||null;record.reason=required(item.reason,'reason');
      }else if(item.status!=='active')fail('VALIDATION_ERROR','Unknown key status');
    }
    for(const record of ring.keys.values()){
      if(!record.replacementKeyId)continue;
      const replacement=ring.keys.get(record.replacementKeyId);
      if(!replacement||replacement.keyId===record.keyId)fail('VALIDATION_ERROR','Replacement key reference invalid');
      if(record.status==='retired'&&new Date(replacement.activatedAt)>new Date(record.retiredAt))
        fail('VALIDATION_ERROR','Replacement key must be active before retirement');
    }
    return ring;
  }
}

class RotatingReleaseVerifier {
  constructor({keyRing,clock=()=>new Date()}={}){
    if(!(keyRing instanceof ReleaseKeyRing))throw new Error('keyRing required');
    this.keyRing=keyRing;this.clock=clock;
  }
  verifyRelease(manifest,artifacts){
    const record=this.keyRing.require(manifest?.keyId);
    if(record.status==='revoked')fail('SIGNING_KEY_REVOKED','Signing key revoked');
    const payload=new ReleaseVerifier({publicKeys:{[record.keyId]:record.publicKey},clock:this.clock}).verifyRelease(manifest,artifacts);
    const releasedAt=instant(payload.releasedAt,'payload.releasedAt');
    if(releasedAt<new Date(record.activatedAt))fail('SIGNING_KEY_NOT_ACTIVE','Release predates signing-key activation');
    if(record.status==='retired'&&record.retiredAt&&releasedAt>=new Date(record.retiredAt))
      fail('SIGNING_KEY_RETIRED','Retired signing key cannot authorize newer releases');
    return payload;
  }
}

module.exports={ReleaseKeyRing,RotatingReleaseVerifier};
