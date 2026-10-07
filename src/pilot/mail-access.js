'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {OAuthAuthorizationFlow}=require('../integrations/oauth-flow');
const {GmailReadProvider,classifyGmailMessage}=require('../integrations/providers/gmail');

function failure(code,message){const e=new Error(message);e.code=code;throw e}
function email(value){const v=String(value||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))failure('VALIDATION_ERROR','email invalid');return v}
function tenant(session,organisationId){if(!session||session.organisationId!==organisationId)failure('FORBIDDEN','mail account unavailable')}
function jsonFile(file,value){fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const tmp=file+'.tmp-'+crypto.randomUUID();fs.writeFileSync(tmp,JSON.stringify(value),{mode:0o600,flag:'wx'});fs.renameSync(tmp,file)}
class EncryptedMailTokenStore{
  constructor({file,key}){this.file=path.resolve(file);this.key=Buffer.from(String(key||''),'base64url');if(this.key.length!==32)failure('MAIL_KEY_INVALID','32-byte mail token key required')}
  readAll(){if(!fs.existsSync(this.file))return {};const raw=JSON.parse(fs.readFileSync(this.file,'utf8'));if(raw.version!==1)failure('MAIL_STORE_INVALID','mail token store invalid');const iv=Buffer.from(raw.iv,'base64url'),tag=Buffer.from(raw.tag,'base64url'),body=Buffer.from(raw.body,'base64url'),cipher=crypto.createDecipheriv('aes-256-gcm',this.key,iv);cipher.setAuthTag(tag);return JSON.parse(Buffer.concat([cipher.update(body),cipher.final()]).toString('utf8'))}
  writeAll(value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',this.key,iv),body=Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value))),cipher.final()]);jsonFile(this.file,{version:1,iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),body:body.toString('base64url')})}
  get(organisationId){return this.readAll()[organisationId]||null}
  set(organisationId,value){const all=this.readAll();all[organisationId]=value;this.writeAll(all)}
  remove(organisationId){const all=this.readAll();delete all[organisationId];this.writeAll(all)}
}
class PostgresEncryptedMailTokenStore{
  constructor({query,key}){if(typeof query!=='function')failure('MAIL_DB_INVALID','query required');this.query=query;this.key=Buffer.from(String(key||''),'base64url');if(this.key.length!==32)failure('MAIL_KEY_INVALID','32-byte mail token key required');this.ready=null}
  async init(){if(!this.ready)this.ready=this.query('CREATE TABLE IF NOT EXISTS werkz_mail_secrets (secret_key text PRIMARY KEY, envelope jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())').catch(error=>{this.ready=null;throw error});await this.ready}
  seal(secretKey,value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',this.key,iv);cipher.setAAD(Buffer.from(secretKey));const body=Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value))),cipher.final()]);return {version:1,iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),body:body.toString('base64url')}}
  open(secretKey,envelope){if(envelope?.version!==1)failure('MAIL_STORE_INVALID','mail token store invalid');const cipher=crypto.createDecipheriv('aes-256-gcm',this.key,Buffer.from(envelope.iv,'base64url'));cipher.setAAD(Buffer.from(secretKey));cipher.setAuthTag(Buffer.from(envelope.tag,'base64url'));return JSON.parse(Buffer.concat([cipher.update(Buffer.from(envelope.body,'base64url')),cipher.final()]).toString('utf8'))}
  async get(secretKey){await this.init();const result=await this.query('SELECT envelope FROM werkz_mail_secrets WHERE secret_key=$1',[secretKey]);return result.rows?.[0]?this.open(secretKey,result.rows[0].envelope):null}
  async set(secretKey,value){await this.init();await this.query('INSERT INTO werkz_mail_secrets(secret_key,envelope) VALUES($1,$2::jsonb) ON CONFLICT(secret_key) DO UPDATE SET envelope=EXCLUDED.envelope,updated_at=now()',[secretKey,JSON.stringify(this.seal(secretKey,value))])}
  async remove(secretKey){await this.init();await this.query('DELETE FROM werkz_mail_secrets WHERE secret_key=$1',[secretKey])}
}
class GmailOAuthReadAccess{
  constructor({organisationId,accountEmail,clientId,clientSecret,redirectUri,tokenStore,http=globalThis.fetch,clock=()=>new Date()}){
    this.organisationId=String(organisationId);this.accountEmail=accountEmail?email(accountEmail):null;this.clientId=String(clientId||'');this.clientSecret=String(clientSecret||'');this.redirectUri=String(redirectUri||'');this.tokens=tokenStore;this.http=http;this.clock=clock;
    if(!this.clientId||!this.clientSecret||!this.tokens||!this.redirectUri)failure('MAIL_CONFIG_MISSING','Gmail OAuth configuration missing');
    this.flow=new OAuthAuthorizationFlow({clock,providerConfigs:{google:{id:'google',authorizationEndpoint:'https://accounts.google.com/o/oauth2/v2/auth',redirectUri:this.redirectUri,clientId:this.clientId}}});
  }
  begin(session){tenant(session,this.organisationId);const result=this.flow.begin({session,provider:'google',connectionKey:this.accountEmail||'gmail',scopes:GmailReadProvider.oauthScopes});const url=new URL(result.authorizationUrl);url.searchParams.set('access_type','offline');url.searchParams.set('prompt','consent');return url.toString()}
  async exchange(fields){const response=await this.http('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields)});const body=await response.json();if(!response.ok)failure('OAUTH_TOKEN_FAILED','Google authorization failed');return body}
  async finish(session,{state,code}){tenant(session,this.organisationId);const pending=this.flow.consume({session,provider:'google',state,code});const tokens=await this.exchange({grant_type:'authorization_code',code:pending.code,redirect_uri:pending.redirectUri,client_id:this.clientId,client_secret:this.clientSecret,code_verifier:pending.codeVerifier});if(!tokens.access_token||!tokens.refresh_token)failure('OAUTH_TOKEN_FAILED','Google refresh authorization missing');const profile=await this.http('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers:{authorization:'Bearer '+tokens.access_token}});if(!profile.ok)failure('OAUTH_PROFILE_FAILED','Google account could not be verified');const identity=await profile.json(),verifiedEmail=email(identity.emailAddress);if(this.accountEmail&&verifiedEmail!==this.accountEmail)failure('OAUTH_ACCOUNT_MISMATCH','Wrong Google account selected');this.accountEmail=verifiedEmail;await this.tokens.set(this.organisationId,{refreshToken:tokens.refresh_token,accessToken:tokens.access_token,expiresAt:this.clock().getTime()+Number(tokens.expires_in||3600)*1000-60000,email:verifiedEmail});return this.status(session)}
  async status(session){tenant(session,this.organisationId);const row=await this.tokens.get(this.organisationId);return {provider:'gmail',email:row?.email||this.accountEmail||null,connected:Boolean(row?.refreshToken),readOnly:true}}
  async disconnect(session){
    tenant(session,this.organisationId);
    const row=await this.tokens.get(this.organisationId);
    let providerRevocation='not-needed';
    const token=row?.refreshToken||row?.accessToken||'';
    if(token){
      try{
        const response=await this.http('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token})});
        providerRevocation=Number(response?.status)===200||response?.ok===true?'revoked':'failed';
      }catch{providerRevocation='failed'}
    }
    await this.tokens.remove(this.organisationId);
    return {...await this.status(session),providerRevocation};
  }
  async accessToken(){let row=await this.tokens.get(this.organisationId);if(!row)failure('MAIL_NOT_CONNECTED','Gmail not connected');if(row.accessToken&&row.expiresAt>this.clock().getTime())return row.accessToken;const result=await this.exchange({grant_type:'refresh_token',refresh_token:row.refreshToken,client_id:this.clientId,client_secret:this.clientSecret});if(!result.access_token)failure('OAUTH_TOKEN_FAILED','Google refresh failed');row={...row,accessToken:result.access_token,expiresAt:this.clock().getTime()+Number(result.expires_in||3600)*1000-60000};await this.tokens.set(this.organisationId,row);return row.accessToken}
  async listRelevant({organisationId}){tenant({organisationId},this.organisationId);const access=await this.accessToken();const provider=new GmailReadProvider({account:{organisationId},resolveAccess:()=>access,http:async request=>{const response=await this.http(request.url,{method:request.method,headers:request.headers});return {status:response.status,body:await response.json()}}});return provider.listRelevant({organisationId})}
}
class ICloudImapReadAccess{
  constructor({organisationId,accountEmail,appPassword,clientFactory=null,clock=()=>new Date()}){this.organisationId=String(organisationId);this.accountEmail=email(accountEmail);this.appPassword=String(appPassword||'');this.clientFactory=clientFactory||(()=>{const {ImapFlow}=require('imapflow');return new ImapFlow({host:'imap.mail.me.com',port:993,secure:true,auth:{user:this.accountEmail,pass:this.appPassword},logger:false})});this.clock=clock}
  status(session){tenant(session,this.organisationId);return {provider:'icloud',email:this.accountEmail,configured:Boolean(this.appPassword),readOnly:true}}
  async listRelevant({organisationId}){tenant({organisationId},this.organisationId);if(!this.appPassword)failure('MAIL_NOT_CONNECTED','iCloud Mail not connected');const client=this.clientFactory();await client.connect();try{await client.mailboxOpen('INBOX',{readOnly:true});const since=new Date(this.clock().getTime()-30*24*60*60*1000),uids=await client.search({since},{uid:true}),chosen=(uids||[]).slice(-25),out=[];if(!chosen.length)return out;for await(const item of client.fetch(chosen.join(','),{envelope:true,flags:true},{uid:true})){const env=item.envelope||{},from=(env.from||[]).map(x=>x.address||'').filter(Boolean).join(', '),subject=String(env.subject||''),date=env.date?new Date(env.date).toISOString():null,classified=classifyGmailMessage({snippet:'',payload:{headers:[{name:'From',value:from},{name:'Subject',value:subject}]}});if(!classified.relevant)continue;out.push({id:String(item.uid),from,subject:subject||'(ohne Betreff)',snippet:'',category:classified.category,relevant:true,receivedAt:date,provider:'icloud',readOnly:true})}return out.sort((a,b)=>String(b.receivedAt||'').localeCompare(String(a.receivedAt||'')))}finally{await client.logout()}}
}
module.exports={EncryptedMailTokenStore,PostgresEncryptedMailTokenStore,GmailOAuthReadAccess,ICloudImapReadAccess};
