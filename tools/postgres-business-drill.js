'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Pool}=require('pg');
const {PostgresBusinessStore}=require('../src/persistence/postgres');
const {repositories}=require('../src/persistence/repositories');
const {createBackup,restoreBackup,decryptBundle}=require('../src/persistence/backup');
const {ModuleRegistry,EntitlementService,LocalAuthPort,TimeProductionService}=require('../src');
const {createPilotRuntime}=require('../src/pilot');
const {PostgresBrowserSessions,credentialVersion}=require('../src/persistence/browser-sessions');
const {PostgresTenantCredentialStore}=require('../src/pilot/tenant-credentials');
async function runDrill({connectionString,root,key}){
  const suffix=crypto.randomBytes(8).toString('hex'),sourceSchema='werkz_drill_'+suffix,restoreSchema='werkz_restore_'+suffix;
  const admin=new Pool({connectionString,max:1}),pools=[];const checks=[];
  const base=path.join(root,'storage-drill',suffix),sourceRoot=path.join(base,'source'),restoreRoot=path.join(base,'restore');
  fs.mkdirSync(sourceRoot,{recursive:true,mode:0o700});
  try{
    async function make(schema){await admin.query('CREATE SCHEMA '+schema);const pool=new Pool({connectionString,max:3,options:'-c search_path='+schema});pools.push(pool);const store=new PostgresBusinessStore(pool);await store.initialize();return store;}
    const source=await make(sourceSchema),restored=await make(restoreSchema),repos=repositories(source,sourceRoot);
    const credentials=new PostgresTenantCredentialStore({query:(sql,args)=>source.pool.query(sql,args)}),browser=new PostgresBrowserSessions(source.pool);
    const browserProfile={id:'synthetic-drill-owner',organisationId:'drill-org-a'},version=async()=>credentialVersion(browserProfile,await credentials.row('drill-org-a'));
    await credentials.setPassword('drill-org-a','LOCAL-DRILL-PASSWORD-ONE');
    const browserFirst=await browser.create(browserProfile,await version()),browserSecond=await browser.create(browserProfile,await version());
    assert.notEqual(browserFirst,browserSecond);assert.equal((await browser.profile(browserFirst,[browserProfile],version)).organisationId,'drill-org-a');
    await browser.revoke(browserFirst);assert.equal(await browser.resolve(browserFirst),null);
    await credentials.setPassword('drill-org-a','LOCAL-DRILL-PASSWORD-TWO');assert.equal(await browser.profile(browserSecond,[browserProfile],version),null);
    checks.push('postgres_random_sessions_logout_and_password_change_revocation');
    const registry=new ModuleRegistry(),entitlements=new EntitlementService({registry}),sessions={};
    for(const org of ['drill-org-a','drill-org-b']){sessions[org]={organisationId:org,actorId:'synthetic-owner',capabilities:['pilot.read','pilot.write','time.start','time.stop','time.read.all','document.upload']};for(const moduleId of ['werkz.simple','werkz.documents','werkz.billing-prep','werkz.time'])entitlements.set({organisationId:org,moduleId,catalogVersion:'drill'});}
    const auth=new LocalAuthPort(sessions),pilot=createPilotRuntime({auth,entitlements,dataDir:sourceRoot,repository:repos.pilot,storage:repos.documents,audit:event=>source.audit(event)});
    const time=new TimeProductionService({auth,entitlements,repository:repos.time,storage:repos.evidence,audit:event=>source.audit(event)});
    let call,document,record;
    await source.withTenant('drill-org-a',async()=>{
      pilot.saveCustomer('drill-org-a',{name:'SYNTHETIC restore customer'});
      call=await pilot.recordCall('drill-org-a',{name:'SYNTHETIC callback',topic:'SYNTHETIC repair',clientMutationId:'call-one'});
      pilot.completeCall('drill-org-a',call.id,{clientMutationId:'complete-one'});
      document=await pilot.addDocument('drill-org-a',{fileName:'synthetic.txt',mime:'text/plain',dataBase64:Buffer.from('SYNTHETIC receipt bytes').toString('base64'),clientMutationId:'doc-one'});
      record=time.start('drill-org-a',{idempotencyKey:'start-one',customerLabel:'SYNTHETIC restore customer'});
      time.stop('drill-org-a',{id:record.id,expectedRevision:record.revision,idempotencyKey:'stop-one'});
    });checks.push('customers_calls_callbacks_times_documents_committed');
    const restarted=new PostgresBusinessStore(source.pool),again=repositories(restarted,sourceRoot);
    await restarted.withTenant('drill-org-a',()=>{assert.equal(again.pilot.list('drill-org-a','calls')[0].status,'erledigt');assert.equal(again.time.list('drill-org-a')[0].status,'finished');assert.equal(again.documents.read({organisationId:'drill-org-a',id:document.id,fileName:'synthetic.txt'}).toString(),'SYNTHETIC receipt bytes');});checks.push('fresh_repository_reads_postgres_and_files');
    await source.withTenant('drill-org-b',()=>{assert.equal(repos.pilot.list('drill-org-b','customers').length,0);assert.equal(repos.time.list('drill-org-b').length,0);assert.throws(()=>repos.pilot.list('drill-org-a','customers'),/Cross-tenant/);assert.throws(()=>repos.documents.read({organisationId:'../drill-org-a',id:document.id,fileName:'synthetic.txt'}));});checks.push('application_tenant_isolation');
    const db=await source.pool.connect();try{await db.query('BEGIN');await db.query("SELECT set_config('werkz.organisation_id','drill-org-b',true)");assert.equal((await db.query('SELECT * FROM werkz_business_state WHERE organisation_id=$1',['drill-org-a'])).rowCount,0);await db.query('ROLLBACK');}finally{db.release();}checks.push('postgres_forced_row_security');
    await Promise.all(Array.from({length:6},(_,i)=>source.withTenant('drill-org-a',()=>pilot.saveCustomer('drill-org-a',{name:'SYNTHETIC concurrent '+i}))));
    await source.withTenant('drill-org-a',()=>assert.equal(repos.pilot.list('drill-org-a','customers').length,8));checks.push('concurrent_updates_not_lost');
    const bytes=await createBackup(source,'drill-org-a',sourceRoot,key);assert.equal(bytes.includes('SYNTHETIC'),false);fs.writeFileSync(path.join(base,'recovery.wzbackup'),bytes,{mode:0o600});
    assert.throws(()=>decryptBundle(bytes,crypto.randomBytes(32).toString('base64')));const corrupted=Buffer.from(bytes);corrupted[corrupted.length-20]^=1;assert.throws(()=>decryptBundle(corrupted,key));checks.push('encrypted_backup_wrong_key_and_tamper_rejected');
    await restoreBackup(restored,bytes,restoreRoot,key);
    const recoveredCredentials=new PostgresTenantCredentialStore({query:(sql,args)=>restored.pool.query(sql,args)});
    assert.equal(await recoveredCredentials.verifyPassword('drill-org-a','LOCAL-DRILL-PASSWORD-TWO'),true);
    assert.equal(await recoveredCredentials.verifyPassword('drill-org-a','LOCAL-DRILL-PASSWORD-ONE'),false);checks.push('encrypted_password_credentials_restored_without_active_sessions');
    const before=await source.withTenant('drill-org-a',state=>structuredClone(state),{write:false}),after=await restored.withTenant('drill-org-a',state=>structuredClone(state),{write:false});assert.deepEqual(after,before);
    assert.equal(fs.readFileSync(path.join(restoreRoot,'simple-pilot/documents',document.storage.objectKey)).toString(),'SYNTHETIC receipt bytes');checks.push('restore_to_empty_postgres_schema_and_new_file_root');
    await assert.rejects(restoreBackup(restored,bytes,restoreRoot,key),/empty/);checks.push('restore_refuses_existing_destination');
    const report={ok:true,checkedAt:new Date().toISOString(),postgresVersion:(await admin.query('SHOW server_version')).rows[0].server_version,checks};fs.writeFileSync(path.join(root,'storage-drill-latest.json'),JSON.stringify(report,null,2),{mode:0o600});return report;
  }finally{for(const pool of pools)await pool.end();for(const schema of [sourceSchema,restoreSchema])await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
}
if(require.main===module)runDrill({connectionString:process.env.WERKZ_DATABASE_URL,root:process.env.WERKZ_TIME_DATA_DIR,key:process.env.WERKZ_BACKUP_KEY}).then(report=>process.stdout.write(JSON.stringify(report)+'\n')).catch(error=>{process.stderr.write(JSON.stringify({kind:'storage-drill-failed',message:String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]')})+'\n');process.exitCode=1;});
module.exports={runDrill};
