'use strict';

const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DeviceEnrollmentAuthority,FileDeviceEnrollmentState}=require('../src');

function usage(){
  process.stderr.write([
    'Usage:',
    '  node tools/device-enrollment.js issue <state-file> <organisation-id> <requested-by> [ttl-minutes]',
    '  node tools/device-enrollment.js enroll <state-file> <token> <public-key-file> [label]',
    '  node tools/device-enrollment.js revoke <state-file> <device-id> <actor-id> <reason...>',
    '  node tools/device-enrollment.js list <state-file> [organisation-id] [status]',
    '  node tools/device-enrollment.js drill <state-file> <organisation-id> <actor-id>'
  ].join('\n')+'\n');
}
function out(value){process.stdout.write(JSON.stringify(value,null,2)+'\n')}
function authority(stateFile){return new DeviceEnrollmentAuthority({stateStore:new FileDeviceEnrollmentState(path.resolve(stateFile))})}

(async()=>{
  const [command,stateFile,...args]=process.argv.slice(2);
  if(!command||!stateFile){usage();process.exitCode=2;return}
  try{
    const service=authority(stateFile);
    if(command==='issue'){
      const [organisationId,requestedBy,ttlMinutes]=args;
      const ttlMs=ttlMinutes===undefined?10*60*1000:Number(ttlMinutes)*60*1000;
      out(service.issue({organisationId,requestedBy,ttlMs}));return;
    }
    if(command==='enroll'){
      const [token,publicKeyFile,...labelParts]=args;
      if(!token||!publicKeyFile)throw new Error('token and public-key-file are required');
      const devicePublicKey=fs.readFileSync(path.resolve(publicKeyFile),'utf8');
      out(service.enroll({token,devicePublicKey,label:labelParts.join(' ')||'WerkZ Agent'}));return;
    }
    if(command==='revoke'){
      const [deviceId,actorId,...reasonParts]=args;
      out(service.revoke({deviceId,actorId,reason:reasonParts.join(' ')}));return;
    }
    if(command==='list'){
      const [organisationId,status]=args;
      out({devices:service.list({organisationId:organisationId||null,status:status||null})});return;
    }
    if(command==='drill'){
      const [organisationId,actorId]=args;
      if(!organisationId||!actorId)throw new Error('organisation-id and actor-id are required');
      const pair=crypto.generateKeyPairSync('ed25519');
      const issued=service.issue({organisationId,requestedBy:actorId,ttlMs:5*60*1000});
      const device=service.enroll({token:issued.token,devicePublicKey:pair.publicKey.export({type:'spki',format:'pem'}),label:'WerkZ Enrollment Drill'});
      const challenge=service.challenge(device.id);
      const signature=crypto.sign(null,Buffer.from(challenge.nonce),pair.privateKey).toString('base64url');
      const authenticated=service.authenticate({deviceId:device.id,nonce:challenge.nonce,signature});
      service.revoke({deviceId:device.id,actorId,reason:'automated enrollment/revocation drill'});
      let revokedDenied=false;
      try{service.challenge(device.id)}catch(error){revokedDenied=error.code==='DEVICE_DENIED'}
      if(!revokedDenied)throw new Error('Revocation drill failed');
      out({drill:'passed',organisationId,deviceId:device.id,authenticatedAt:authenticated.authenticatedAt,revocationVerified:true,privateKeyPersisted:false});return;
    }
    usage();process.exitCode=2;
  }catch(error){
    process.stderr.write('Device enrollment operation failed: '+error.message+'\n');
    process.exitCode=1;
  }
})();
