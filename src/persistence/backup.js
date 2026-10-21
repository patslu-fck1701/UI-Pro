'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {validateState,tenantId}=require('./postgres');
const MAX_BACKUP_BYTES=32*1024*1024;
function keyBytes(key){const bytes=Buffer.from(String(key||''),'base64');if(bytes.length!==32)throw new Error('Backup key must contain 32 random bytes');return bytes;}
function safePath(root,relative){
  if(typeof relative!=='string'||relative.includes('\\')||relative.split('/').some(x=>!x||x==='.'||x==='..')||path.isAbsolute(relative))throw new Error('Unsafe backup path');
  const target=path.resolve(root,relative);if(!target.startsWith(path.resolve(root)+path.sep))throw new Error('Unsafe backup path');
  let current=path.resolve(root);for(const part of relative.split('/')){current=path.join(current,part);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw new Error('Backup symlink rejected');}
  return target;
}
function digest(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function referencedFiles(org,state,root){
  validateState(org,state);const entries=new Map();let total=0;
  function add(relative,expectedHash=null){const target=safePath(root,relative),bytes=fs.readFileSync(target);total+=bytes.length;if(total>MAX_BACKUP_BYTES)throw new Error('Backup exceeds supported 32 MB payload');const hash=digest(bytes);if(expectedHash&&hash!==expectedHash.replace(/^sha256:/,''))throw new Error('Backup file integrity failure');entries.set(relative,{path:relative,sha256:hash,data:bytes.toString('base64')});}
  for(const doc of state.pilot.documents||[]){const objectKey=doc.storage?.objectKey;if(!objectKey?.startsWith(org+'/'))throw new Error('Cross-tenant document path');add('simple-pilot/documents/'+objectKey,doc.storage.sha256);}
  for(const object of Object.values(state.evidence.objects)){if(!/^objects\/[a-zA-Z0-9_.-]+$/.test(object.objectKey))throw new Error('Invalid evidence path');add('evidence/'+object.objectKey,object.hash);}
  function walk(relative){for(const entry of fs.readdirSync(safePath(root,relative),{withFileTypes:true})){const child=relative+'/'+entry.name;if(entry.isSymbolicLink())throw new Error('Backup symlink rejected');if(entry.isDirectory())walk(child);else add(child);}}
  for(const archive of state.pilot.archives||[]){const key=archive.objectKey||archive.storage?.objectKey;if(!key?.startsWith('_exports/'+org+'/'))throw new Error('Cross-tenant archive path');walk('simple-pilot/documents/'+key);}
  return [...entries.values()];
}
function validateBundle(bundle){
  if(bundle?.format!=='werkz-business-backup-v1'||!Array.isArray(bundle.files))throw new Error('Invalid backup format');
  const org=tenantId(bundle.organisationId);validateState(org,bundle.state);const paths=new Set(),required=new Map();
  if(bundle.credentials!=null&&(bundle.credentials.algorithm!=='scrypt'||typeof bundle.credentials.hash!=='string'||typeof bundle.credentials.salt!=='string'))throw new Error('Invalid backup credentials');
  for(const doc of bundle.state.pilot.documents||[]){if(!doc.storage?.objectKey?.startsWith(org+'/'))throw new Error('Cross-tenant document path');required.set('simple-pilot/documents/'+doc.storage.objectKey,doc.storage.sha256);}
  for(const object of Object.values(bundle.state.evidence.objects)){if(!/^objects\/[a-zA-Z0-9_.-]+$/.test(object.objectKey))throw new Error('Invalid evidence path');required.set('evidence/'+object.objectKey,object.hash.replace(/^sha256:/,''));}
  const archives=(bundle.state.pilot.archives||[]).map(x=>'simple-pilot/documents/_exports/'+org+'/'+x.id+'/');
  for(const file of bundle.files){safePath(path.resolve('.'),file.path);if(!required.has(file.path)&&!archives.some(prefix=>file.path.startsWith(prefix)))throw new Error('Unreferenced backup file');if(paths.has(file.path))throw new Error('Duplicate backup file');paths.add(file.path);const bytes=Buffer.from(file.data,'base64');if(digest(bytes)!==file.sha256||required.has(file.path)&&required.get(file.path)!==file.sha256)throw new Error('Backup file hash mismatch');}
  for(const relative of required.keys())if(!paths.has(relative))throw new Error('Missing backup file');
  return bundle;
}
function encryptBundle(bundle,key){
  validateBundle(bundle);const raw=Buffer.from(JSON.stringify(bundle));if(raw.length>MAX_BACKUP_BYTES*1.5)throw new Error('Backup too large');
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',keyBytes(key),iv);cipher.setAAD(Buffer.from('werkz-business-backup-v1'));
  const ciphertext=Buffer.concat([cipher.update(raw),cipher.final()]);
  return Buffer.from(JSON.stringify({format:'werkz-encrypted-backup-v1',iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')}));
}
function decryptBundle(bytes,key){
  if(bytes.length>MAX_BACKUP_BYTES*2)throw new Error('Backup too large');const envelope=JSON.parse(bytes.toString('utf8'));if(envelope.format!=='werkz-encrypted-backup-v1')throw new Error('Invalid encrypted backup');
  const decipher=crypto.createDecipheriv('aes-256-gcm',keyBytes(key),Buffer.from(envelope.iv,'base64'));decipher.setAAD(Buffer.from('werkz-business-backup-v1'));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
  return validateBundle(JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()]).toString('utf8')));
}
async function createBackup(store,org,root,key){return store.withTenant(org,async state=>{
  const {rows}=await store.current().client.query('SELECT password FROM werkz_tenant_credentials WHERE organisation_id=$1',[org]);
  return encryptBundle({format:'werkz-business-backup-v1',organisationId:org,createdAt:new Date().toISOString(),credentials:rows[0]?.password||null,state,files:referencedFiles(org,state,root)},key);
},{write:false});}
async function restoreBackup(store,bytes,root,key){
  const bundle=decryptBundle(bytes,key);if(fs.existsSync(root)&&fs.readdirSync(root).length)throw new Error('Restore requires an empty file destination');
  return store.withTenant(bundle.organisationId,async state=>{
    if(JSON.stringify(state)!==JSON.stringify(require('./postgres').emptyState()))throw new Error('Restore requires an empty tenant database');
    const client=store.current().client;
    if((await client.query('SELECT organisation_id FROM werkz_tenant_credentials WHERE organisation_id=$1',[bundle.organisationId])).rows.length)throw new Error('Restore requires an empty tenant credential destination');
    for(const file of bundle.files){const target=safePath(root,file.path);fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});fs.writeFileSync(target,Buffer.from(file.data,'base64'),{flag:'wx',mode:0o600});}
    if(bundle.credentials)await client.query('INSERT INTO werkz_tenant_credentials(organisation_id,password) VALUES($1,$2::jsonb)',[bundle.organisationId,JSON.stringify(bundle.credentials)]);
    await client.query('UPDATE werkz_browser_sessions SET revoked_at=clock_timestamp() WHERE organisation_id=$1',[bundle.organisationId]);
    Object.assign(state,bundle.state);return {restored:true,organisationId:bundle.organisationId,files:bundle.files.length,credentialsRestored:Boolean(bundle.credentials),sessionsRevoked:true};
  });
}
module.exports={encryptBundle,decryptBundle,createBackup,restoreBackup,referencedFiles,safePath};
