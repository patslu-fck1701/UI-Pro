'use strict';

function fail(code,message){const error=new Error(message);error.code=code;throw error}
function required(value,name){const text=String(value||'').trim();if(!text)fail('VALIDATION_ERROR',name+' required');return text}
function https(value,name){const url=new URL(required(value,name));if(url.protocol!=='https:')fail('VALIDATION_ERROR',name+' must use HTTPS');return url.toString()}
const FEDERATION=new Set(['oidc','saml']);
const MFA=new Set(['provider','required','webauthn-preferred']);

class EnterpriseIdentityDirectory {
  constructor({audit=()=>{}}={}){this.audit=audit;this.profiles=new Map();}
  configure(input){
    const organisationId=required(input.organisationId,'organisationId');
    const protocol=required(input.federation?.protocol,'federation.protocol').toLowerCase();
    if(!FEDERATION.has(protocol))fail('VALIDATION_ERROR','federation protocol must be oidc or saml');
    const federation={
      protocol,
      issuer:https(input.federation.issuer,'federation.issuer'),
      audience:required(input.federation.audience,'federation.audience'),
      credentialReferenceId:input.federation.credentialReferenceId?required(input.federation.credentialReferenceId,'federation.credentialReferenceId'):null
    };
    let provisioning=null;
    if(input.provisioning){
      if(String(input.provisioning.protocol||'').toLowerCase()!=='scim')fail('VALIDATION_ERROR','provisioning protocol must be scim');
      provisioning={
        protocol:'scim',
        baseUrl:https(input.provisioning.baseUrl,'provisioning.baseUrl'),
        credentialReferenceId:required(input.provisioning.credentialReferenceId,'provisioning.credentialReferenceId')
      };
    }
    const mfaPolicy=input.mfaPolicy||'provider';
    if(!MFA.has(mfaPolicy))fail('VALIDATION_ERROR','mfaPolicy invalid');
    const groupRoleMappings={};
    for(const [group,roles] of Object.entries(input.groupRoleMappings||{})){
      if(!Array.isArray(roles)||roles.some(role=>!String(role||'').trim()))fail('VALIDATION_ERROR','groupRoleMappings invalid');
      groupRoleMappings[required(group,'group')]=[...new Set(roles.map(role=>String(role).trim()))];
    }
    const value={organisationId,status:input.status||'active',federation,provisioning,mfaPolicy,groupRoleMappings};
    this.profiles.set(organisationId,value);
    this.audit({organisationId,eventType:'identity.enterprise.configured',entityType:'identity-profile',entityId:organisationId,
      payload:{federation:protocol,provisioning:provisioning?.protocol||null,mfaPolicy}});
    return structuredClone(value);
  }
  get(organisationId){const value=this.profiles.get(organisationId);return value?structuredClone(value):null}
  mapRoles(organisationId,groups=[]){
    const value=this.profiles.get(organisationId);if(!value||value.status!=='active')fail('IDENTITY_PROFILE_UNAVAILABLE','Identity profile unavailable');
    const roles=new Set();for(const group of groups)for(const role of value.groupRoleMappings[group]||[])roles.add(role);
    return [...roles].sort();
  }
  disable(organisationId,{actorId,reason}={}){
    const value=this.profiles.get(organisationId);if(!value)fail('NOT_FOUND','Identity profile not found');
    value.status='disabled';
    this.audit({organisationId,actorId:actorId||null,eventType:'identity.enterprise.disabled',entityType:'identity-profile',entityId:organisationId,
      payload:{reason:required(reason,'reason')}});
    return structuredClone(value);
  }
}
module.exports={EnterpriseIdentityDirectory};
