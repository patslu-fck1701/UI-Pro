'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');

function fail(code,message){const error=new Error(message);error.code=code;throw error}
function org(value){const v=String(value||'').trim();if(!v)fail('VALIDATION_ERROR','organisationId required');return v}
function password(value){
  const v=String(value??'');
  if(v.length<10||v.length>128)fail('PASSWORD_POLICY','Passwort muss 10 bis 128 Zeichen lang sein');
  return v;
}
function atomicWrite(file,value){
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const tmp=file+'.tmp-'+crypto.randomUUID();
  fs.writeFileSync(tmp,JSON.stringify(value),{mode:0o600,flag:'wx'});
  fs.renameSync(tmp,file);
}
class FileTenantCredentialStore{
  constructor({file}){this.file=path.resolve(file)}
  read(){
    if(!fs.existsSync(this.file))return {schemaVersion:1,accounts:{}};
    const value=JSON.parse(fs.readFileSync(this.file,'utf8'));
    if(value?.schemaVersion!==1||!value.accounts||typeof value.accounts!=='object'||Array.isArray(value.accounts))fail('CREDENTIAL_STORE_INVALID','credential store invalid');
    return value;
  }
  write(value){atomicWrite(this.file,{schemaVersion:1,accounts:value.accounts||{}})}
  hasPassword(organisationId){const value=this.read();return Boolean(value.accounts[org(organisationId)]?.password)}
  setPassword(organisationId,value){
    const organisationIdValue=org(organisationId),secret=password(value),state=this.read();
    const salt=crypto.randomBytes(16);
    const hash=crypto.scryptSync(secret,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
    state.accounts[organisationIdValue]={password:{algorithm:'scrypt',salt:salt.toString('base64url'),hash:hash.toString('base64url'),updatedAt:new Date().toISOString()}};
    this.write(state);return {passwordConfigured:true};
  }
  verifyPassword(organisationId,value){
    const state=this.read(),row=state.accounts[org(organisationId)]?.password;
    if(!row)return false;
    if(row.algorithm!=='scrypt')fail('CREDENTIAL_STORE_INVALID','unsupported password algorithm');
    const candidate=String(value??'');
    if(candidate.length>128)return false;
    const actual=crypto.scryptSync(candidate,Buffer.from(row.salt,'base64url'),64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
    const expected=Buffer.from(row.hash,'base64url');
    return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);
  }
}

class PostgresTenantCredentialStore{
  constructor({query}){if(typeof query!=='function')fail('CREDENTIAL_DB_INVALID','query required');this.query=query;this.ready=null}
  async init(){if(!this.ready)this.ready=this.query('CREATE TABLE IF NOT EXISTS werkz_tenant_credentials (organisation_id text PRIMARY KEY, password jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())').catch(error=>{this.ready=null;throw error});await this.ready}
  async row(organisationId){await this.init();const result=await this.query('SELECT password FROM werkz_tenant_credentials WHERE organisation_id=$1',[org(organisationId)]);return result.rows?.[0]?.password||null}
  async hasPassword(organisationId){return Boolean(await this.row(organisationId))}
  async setPassword(organisationId,value){
    const organisationIdValue=org(organisationId),secret=password(value),salt=crypto.randomBytes(16);
    const hash=crypto.scryptSync(secret,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
    const row={algorithm:'scrypt',salt:salt.toString('base64url'),hash:hash.toString('base64url'),updatedAt:new Date().toISOString()};
    await this.init();
    await this.query('INSERT INTO werkz_tenant_credentials(organisation_id,password) VALUES($1,$2::jsonb) ON CONFLICT(organisation_id) DO UPDATE SET password=EXCLUDED.password,updated_at=now()',[organisationIdValue,JSON.stringify(row)]);
    return {passwordConfigured:true};
  }
  async verifyPassword(organisationId,value){
    const row=await this.row(organisationId);if(!row)return false;
    if(row.algorithm!=='scrypt')fail('CREDENTIAL_STORE_INVALID','unsupported password algorithm');
    const candidate=String(value??'');if(candidate.length>128)return false;
    const actual=crypto.scryptSync(candidate,Buffer.from(row.salt,'base64url'),64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
    const expected=Buffer.from(row.hash,'base64url');
    return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);
  }
}
module.exports={FileTenantCredentialStore,PostgresTenantCredentialStore};
