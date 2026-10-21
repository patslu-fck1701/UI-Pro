'use strict';
const crypto=require('node:crypto');
const {tenantId}=require('./postgres');
const digest=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
class PostgresBrowserSessions{
  constructor(pool,{clock=()=>new Date()}={}){this.pool=pool;this.clock=clock;}
  async initialize(){await this.pool.query('CREATE TABLE IF NOT EXISTS werkz_browser_sessions (token_hash text PRIMARY KEY, organisation_id text NOT NULL, profile_id text NOT NULL, credential_version text NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz)');}
  async create(profile,credentialVersion){
    const token=crypto.randomBytes(32).toString('base64url'),now=this.clock(),expiresAt=new Date(Math.min(now.getTime()+8*3600000,Date.parse(profile.accessExpiresAt)||Infinity));
    if(expiresAt<=now)throw new Error('Access expired');
    await this.pool.query('INSERT INTO werkz_browser_sessions(token_hash,organisation_id,profile_id,credential_version,expires_at) VALUES($1,$2,$3,$4,$5)',[digest(token),tenantId(profile.organisationId),profile.id,credentialVersion,expiresAt.toISOString()]);
    return token;
  }
  async resolve(token){
    if(!/^[A-Za-z0-9_-]{43}$/.test(String(token||'')))return null;
    const {rows}=await this.pool.query('SELECT organisation_id,profile_id,credential_version,expires_at,revoked_at FROM werkz_browser_sessions WHERE token_hash=$1',[digest(token)]),row=rows[0];
    return row&&!row.revoked_at&&new Date(row.expires_at)>this.clock()?row:null;
  }
  async revoke(token){await this.pool.query('UPDATE werkz_browser_sessions SET revoked_at=clock_timestamp() WHERE token_hash=$1',[digest(token)]);}
  async profile(token,profiles,resolveVersion){
    const row=await this.resolve(token);if(!row)return null;
    const profile=[...profiles].find(p=>p.id===row.profile_id&&p.organisationId===row.organisation_id);
    return profile&&row.credential_version===await resolveVersion(profile)?profile:null;
  }
}
function credentialVersion(profile,password){return digest(JSON.stringify(password||{bootstrapHash:profile.loginCodeHash||null,bootstrapCode:profile.loginCode||null}));}
module.exports={PostgresBrowserSessions,credentialVersion};
