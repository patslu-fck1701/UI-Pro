'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {Pool}=require('pg');
const {PostgresBusinessStore}=require('../src/persistence/postgres');
const {createBackup,restoreBackup}=require('../src/persistence/backup');
async function main(){
  const [operation,organisationId,fileName,fileRoot]=process.argv.slice(2);
  if(!['backup','restore'].includes(operation)||!organisationId||!fileName||!fileRoot)throw new Error('Usage: node tools/business-backup.js backup|restore ORGANISATION FILE EMPTY_OR_EXISTING_FILE_ROOT; database URL and backup key through environment only');
  if(!process.env.WERKZ_DATABASE_URL||!process.env.WERKZ_BACKUP_KEY)throw new Error('Database URL and backup key are required through environment');
  const pool=new Pool({connectionString:process.env.WERKZ_DATABASE_URL,max:1});
  try{
    const store=new PostgresBusinessStore(pool);await store.initialize();
    if(operation==='backup'){
      const bytes=await createBackup(store,organisationId,path.resolve(fileRoot),process.env.WERKZ_BACKUP_KEY);
      fs.writeFileSync(path.resolve(fileName),bytes,{flag:'wx',mode:0o600,flush:true});
      console.log(JSON.stringify({operation,ok:true,organisationId,bytes:bytes.length}));
    }else{
      const bytes=fs.readFileSync(path.resolve(fileName));
      const bundle=require('../src/persistence/backup').decryptBundle(bytes,process.env.WERKZ_BACKUP_KEY);
      if(bundle.organisationId!==organisationId)throw new Error('Restore tenant does not match the requested organisation');
      console.log(JSON.stringify(await restoreBackup(store,bytes,path.resolve(fileRoot),process.env.WERKZ_BACKUP_KEY)));
    }
  }finally{await pool.end();}
}
main().catch(()=>{console.error('Business backup/restore failed. Verify arguments, private environment, tenant, file integrity and empty restore destination. No credentials are logged.');process.exitCode=1;});
