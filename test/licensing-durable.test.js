'use strict';

const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DeviceEnrollmentAuthority,FileDeviceEnrollmentState}=require('../src');
test('enrollment replay and device revocation persist through authority restart',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-enrollment-')),file=path.join(root,'enrollment.json');
  try{
    const stateStore=new FileDeviceEnrollmentState(file),pair=crypto.generateKeyPairSync('ed25519');
    let authority=new DeviceEnrollmentAuthority({stateStore});
    const issued=authority.issue({organisationId:'org-a',requestedBy:'admin-a'});
    const text=fs.readFileSync(file,'utf8');assert.equal(text.includes(issued.token),false);
    authority=new DeviceEnrollmentAuthority({stateStore});
    const device=authority.enroll({token:issued.token,devicePublicKey:pair.publicKey.export({type:'spki',format:'pem'})});
    authority=new DeviceEnrollmentAuthority({stateStore});
    assert.throws(()=>authority.enroll({token:issued.token,devicePublicKey:pair.publicKey.export({type:'spki',format:'pem'})}),error=>error.code==='ENROLLMENT_REPLAY');
    const challenge=authority.challenge(device.id),signature=crypto.sign(null,Buffer.from(challenge.nonce),pair.privateKey).toString('base64url');
    authority=new DeviceEnrollmentAuthority({stateStore});
    assert.equal(authority.authenticate({deviceId:device.id,nonce:challenge.nonce,signature}).organisationId,'org-a');
    authority.revoke({deviceId:device.id,actorId:'admin-a',reason:'retired'});
    authority=new DeviceEnrollmentAuthority({stateStore});
    assert.throws(()=>authority.challenge(device.id),error=>error.code==='DEVICE_DENIED');
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});
