'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {ModuleRegistry,EntitlementService,EntitlementAuthority,DeviceEnrollmentAuthority,OfflineLicenceSigner,SignedDocumentVerifier,ReleaseManifestSigner,ReleaseVerifier}=require('../src');

const keys=()=>crypto.generateKeyPairSync('ed25519');
test('server entitlement authority ignores a client-selected organisation',()=>{
  const entitlements=new EntitlementService({registry:new ModuleRegistry()});entitlements.set({organisationId:'org-a',moduleId:'werkz.time',catalogVersion:'v0.2'});
  const authority=new EntitlementAuthority({entitlements});
  assert.equal(authority.authorize({session:{organisationId:'org-a',actorId:'user-a'},moduleId:'werkz.time',clientOrganisationId:'org-b'}).organisationId,'org-a');
  assert.throws(()=>authority.authorize({session:{organisationId:'org-b'},moduleId:'werkz.time',clientOrganisationId:'org-a'}),error=>error.code==='ENTITLEMENT_DENIED');
});

test('one-time enrollment binds an Ed25519 device identity and rejects replay',()=>{
  const authority=new DeviceEnrollmentAuthority(),pair=keys(),other=keys();
  const enrollment=authority.issue({organisationId:'org-a',requestedBy:'admin-a'});
  const device=authority.enroll({token:enrollment.token,devicePublicKey:pair.publicKey.export({type:'spki',format:'pem'})});
  assert.equal(device.organisationId,'org-a');assert.throws(()=>authority.enroll({token:enrollment.token,devicePublicKey:other.publicKey.export({type:'spki',format:'pem'})}),error=>error.code==='ENROLLMENT_REPLAY');
  const challenge=authority.challenge(device.id),signature=crypto.sign(null,Buffer.from(challenge.nonce),pair.privateKey).toString('base64url');
  assert.equal(authority.authenticate({deviceId:device.id,nonce:challenge.nonce,signature}).organisationId,'org-a');
  assert.throws(()=>authority.authenticate({deviceId:device.id,nonce:challenge.nonce,signature}),error=>error.code==='CHALLENGE_DENIED');
});

test('copied agent metadata without the enrolled private key cannot authenticate and revoked device is denied',()=>{
  const authority=new DeviceEnrollmentAuthority(),pair=keys(),copiedMachine=keys();
  const enrollment=authority.issue({organisationId:'org-a',requestedBy:'admin-a'});
  const device=authority.enroll({token:enrollment.token,devicePublicKey:pair.publicKey.export({type:'spki',format:'pem'})});
  let challenge=authority.challenge(device.id);
  const wrong=crypto.sign(null,Buffer.from(challenge.nonce),copiedMachine.privateKey).toString('base64url');
  assert.throws(()=>authority.authenticate({deviceId:device.id,nonce:challenge.nonce,signature:wrong}),error=>error.code==='DEVICE_DENIED');
  authority.revoke({deviceId:device.id,actorId:'admin-a',reason:'lost device'});
  assert.throws(()=>authority.challenge(device.id),error=>error.code==='DEVICE_DENIED');
});

test('signed offline licence verifies while tampering, wrong key, expiry and revocation fail',()=>{
  const pair=keys(),wrong=keys(),payload={serial:'lic-1',organisationId:'org-a',deploymentId:'dep-a',modules:['werkz.time'],issuedAt:'2026-10-01T00:00:00Z',expiresAt:'2026-11-01T00:00:00Z'};
  const document=new OfflineLicenceSigner({privateKey:pair.privateKey,keyId:'key-1'}).sign(payload);
  const verifier=new SignedDocumentVerifier({publicKeys:{'key-1':pair.publicKey},clock:()=>new Date('2026-10-02T00:00:00Z')});
  assert.deepEqual(verifier.verify(document).modules,['werkz.time']);
  assert.throws(()=>verifier.verify({...document,payload:{...document.payload,modules:['werkz.time','werkz.orders']}}),error=>error.code==='SIGNATURE_INVALID');
  assert.throws(()=>new SignedDocumentVerifier({publicKeys:{'key-1':wrong.publicKey}}).verify(document),error=>error.code==='SIGNATURE_INVALID');
  assert.throws(()=>new SignedDocumentVerifier({publicKeys:{'key-1':pair.publicKey},clock:()=>new Date('2026-12-01T00:00:00Z')}).verify(document),error=>error.code==='LICENCE_EXPIRED');
  assert.throws(()=>new SignedDocumentVerifier({publicKeys:{'key-1':pair.publicKey},revokedSerials:['lic-1']}).verify(document),error=>error.code==='LICENCE_REVOKED');
  assert.equal(JSON.stringify(document).includes('PRIVATE KEY'),false);
});

test('signed release manifest rejects modified packages and carries release evidence',()=>{
  const pair=keys(),bytes=Buffer.from('werkz-agent-package'),hash='sha256:'+crypto.createHash('sha256').update(bytes).digest('hex');
  const manifest=new ReleaseManifestSigner({privateKey:pair.privateKey,keyId:'release-1'}).sign({
    productId:'werkz-agent',version:'0.1.0',channel:'pilot',releasedAt:'2026-10-01T00:00:00Z',supportedUntil:'2031-10-01T00:00:00Z',
    compatibility:{core:'>=0.3.0'},rollback:{supported:true},sbom:'sbom.cdx.json',thirdPartyNotices:'THIRD_PARTY_NOTICES.md',
    artifacts:[{name:'werkz-agent.bin',sha256:hash}]
  });
  const verifier=new ReleaseVerifier({publicKeys:{'release-1':pair.publicKey}});
  assert.equal(verifier.verifyRelease(manifest,{'werkz-agent.bin':bytes}).version,'0.1.0');
  assert.throws(()=>verifier.verifyRelease(manifest,{'werkz-agent.bin':Buffer.from('tampered')}),error=>error.code==='DIGEST_MISMATCH');
});
