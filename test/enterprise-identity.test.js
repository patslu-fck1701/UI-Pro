'use strict';

const test=require('node:test'),assert=require('node:assert/strict');
const {EnterpriseIdentityDirectory}=require('../src');

test('enterprise identity profile supports OIDC or SAML with optional SCIM and role mapping',()=>{
  const events=[],directory=new EnterpriseIdentityDirectory({audit:event=>events.push(event)});
  const profile=directory.configure({
    organisationId:'org-a',
    federation:{protocol:'oidc',issuer:'https://login.example.test/',audience:'werkz',credentialReferenceId:'secret-ref-oidc'},
    provisioning:{protocol:'scim',baseUrl:'https://scim.example.test/v2/',credentialReferenceId:'secret-ref-scim'},
    mfaPolicy:'required',
    groupRoleMappings:{'grp-admin':['admin','time.approve'],'grp-time':['time.read','time.approve']}
  });
  assert.equal(profile.federation.protocol,'oidc');
  assert.equal(profile.provisioning.protocol,'scim');
  assert.deepEqual(directory.mapRoles('org-a',['grp-time','grp-admin']),['admin','time.approve','time.read']);
  assert.equal(JSON.stringify(profile).includes('token'),false);
  assert.equal(events.some(event=>event.eventType==='identity.enterprise.configured'),true);
});

test('enterprise identity rejects insecure endpoints and disabled profiles cannot map roles',()=>{
  const directory=new EnterpriseIdentityDirectory();
  assert.throws(()=>directory.configure({organisationId:'org-a',federation:{protocol:'oidc',issuer:'http://unsafe.test',audience:'werkz'}}),error=>error.code==='VALIDATION_ERROR');
  assert.throws(()=>directory.configure({organisationId:'org-a',federation:{protocol:'ldap',issuer:'https://id.test',audience:'werkz'}}),error=>error.code==='VALIDATION_ERROR');
  directory.configure({organisationId:'org-a',federation:{protocol:'saml',issuer:'https://idp.example.test/metadata',audience:'werkz-sp'}});
  directory.disable('org-a',{actorId:'admin-a',reason:'customer offboarding'});
  assert.throws(()=>directory.mapRoles('org-a',[]),error=>error.code==='IDENTITY_PROFILE_UNAVAILABLE');
});
