'use strict';

const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {DeviceAuthorizationFlow,DeviceEnrollmentAuthority}=require('../src');

test('headless device authorization requires browser approval and returns one-time organisation-bound enrollment material',()=>{
  let now=new Date('2026-10-02T00:00:00Z'),events=[];
  const enrollment=new DeviceEnrollmentAuthority({clock:()=>now});
  const flow=new DeviceAuthorizationFlow({
    enrollmentAuthority:enrollment,verificationUri:'https://app.werkz.test/device',
    clock:()=>now,pollIntervalMs:5000,audit:event=>events.push(event)
  });
  const started=flow.start({deviceLabel:'WerkZ Agent A',requestedScopes:['orders.read','time.push']});
  assert.match(started.verificationUriComplete,/user_code=/);
  assert.equal(flow.poll({deviceCode:started.deviceCode}).status,'authorization_pending');
  assert.throws(()=>flow.poll({deviceCode:started.deviceCode}),error=>error.code==='SLOW_DOWN');
  flow.approve({session:{organisationId:'org-a',actorId:'admin-a'},userCode:started.userCode});
  now=new Date('2026-10-02T00:00:05Z');
  const approved=flow.poll({deviceCode:started.deviceCode});
  assert.equal(approved.status,'approved');assert.equal(approved.organisationId,'org-a');assert.ok(approved.enrollmentToken);
  assert.throws(()=>flow.poll({deviceCode:started.deviceCode}),error=>error.code==='DEVICE_CODE_USED');
  const pair=crypto.generateKeyPairSync('ed25519');
  const device=enrollment.enroll({token:approved.enrollmentToken,devicePublicKey:pair.publicKey.export({type:'spki',format:'pem'}),label:'Agent A'});
  assert.equal(device.organisationId,'org-a');
  assert.equal(JSON.stringify(events).includes(approved.enrollmentToken),false);
});

test('device approval codes expire and repeated guessing is rate limited',()=>{
  let now=new Date('2026-10-02T00:00:00Z');
  const enrollment=new DeviceEnrollmentAuthority({clock:()=>now});
  const flow=new DeviceAuthorizationFlow({enrollmentAuthority:enrollment,verificationUri:'https://app.werkz.test/device',clock:()=>now,maxApprovalAttempts:2});
  flow.start({ttlMs:60000});
  const session={organisationId:'org-a',actorId:'admin-a'};
  assert.throws(()=>flow.approve({session,userCode:'WRONG001'}),error=>error.code==='DEVICE_CODE_DENIED');
  assert.throws(()=>flow.approve({session,userCode:'WRONG002'}),error=>error.code==='DEVICE_CODE_DENIED');
  assert.throws(()=>flow.approve({session,userCode:'WRONG003'}),error=>error.code==='RATE_LIMITED');
  now=new Date('2026-10-02T00:02:00Z');
  const next=flow.start({ttlMs:60000});
  now=new Date('2026-10-02T00:03:01Z');
  assert.throws(()=>flow.approve({session:{organisationId:'org-b',actorId:'admin-b'},userCode:next.userCode}),error=>error.code==='DEVICE_CODE_DENIED');
});
