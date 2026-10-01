'use strict';

const crypto=require('node:crypto');
const b64=bytes=>Buffer.from(bytes).toString('base64url');
const hash=value=>crypto.createHash('sha256').update(value).digest();
function deny(code,message){const error=new Error(message);error.code=code;throw error}
function nonempty(value,name){if(typeof value!=='string'||!value.trim())deny('VALIDATION_ERROR',name+' required');return value.trim()}
class OAuthAuthorizationFlow {
  constructor({clock=()=>new Date(),random=crypto.randomBytes,audit=()=>{},stateStore=null}={}){
    this.clock=clock;this.random=random;this.audit=audit;this.stateStore=stateStore;
    this.pending=new Map(stateStore?.load()?.pending||[]);
  }
  persist(){if(this.stateStore)this.stateStore.save({pending:[...this.pending]})}
  begin({session,providerConfig,connectionKey,scopes=[],ttlMs=10*60*1000}){
    const organisationId=nonempty(session?.organisationId,'organisationId');
    const actorId=nonempty(session?.actorId,'actorId');
    const provider=nonempty(providerConfig?.id,'provider');
    nonempty(connectionKey,'connectionKey');
    if(!Array.isArray(scopes)||scopes.some(scope=>typeof scope!=='string'||!scope.trim()))deny('VALIDATION_ERROR','Invalid scopes');
    if(!Number.isSafeInteger(ttlMs)||ttlMs<60*1000||ttlMs>15*60*1000)deny('VALIDATION_ERROR','Invalid OAuth lifetime');
    const endpoint=new URL(nonempty(providerConfig.authorizationEndpoint,'authorizationEndpoint'));
    const redirect=new URL(nonempty(providerConfig.redirectUri,'redirectUri'));
    if(endpoint.protocol!=='https:'||redirect.protocol!=='https:')deny('VALIDATION_ERROR','HTTPS OAuth endpoints required');
    const clientId=nonempty(providerConfig.clientId,'clientId');
    const state=b64(this.random(32)),verifier=b64(this.random(32)),challenge=b64(hash(verifier));
    const expiresAt=new Date(this.clock().getTime()+ttlMs).toISOString();
    this.pending.set(b64(hash(state)),{organisationId,actorId,provider,connectionKey,redirectUri:redirect.toString(),verifier,expiresAt});this.persist();
    endpoint.searchParams.set('response_type','code');endpoint.searchParams.set('client_id',clientId);
    endpoint.searchParams.set('redirect_uri',redirect.toString());endpoint.searchParams.set('scope',scopes.join(' '));
    endpoint.searchParams.set('state',state);endpoint.searchParams.set('code_challenge',challenge);
    endpoint.searchParams.set('code_challenge_method','S256');
    this.audit({organisationId,actorId,eventType:'oauth.authorization.started',entityType:'integration-account',entityId:provider+':'+connectionKey,payload:{provider,expiresAt}});
    return {authorizationUrl:endpoint.toString(),expiresAt};
  }
  consume({session,provider,state,code}){
    const key=b64(hash(nonempty(state,'state'))),pending=this.pending.get(key);
    if(!pending)deny('OAUTH_STATE_DENIED','OAuth state unavailable');
    this.pending.delete(key);this.persist();
    if(new Date(pending.expiresAt)<=this.clock()||pending.organisationId!==session?.organisationId||pending.actorId!==session?.actorId||pending.provider!==provider)deny('OAUTH_STATE_DENIED','OAuth state unavailable');
    nonempty(code,'code');
    this.audit({organisationId:pending.organisationId,actorId:pending.actorId,eventType:'oauth.authorization.consumed',entityType:'integration-account',entityId:provider+':'+pending.connectionKey,payload:{provider}});
    return {organisationId:pending.organisationId,provider,connectionKey:pending.connectionKey,redirectUri:pending.redirectUri,code,codeVerifier:pending.verifier};
  }
}
module.exports={OAuthAuthorizationFlow};
