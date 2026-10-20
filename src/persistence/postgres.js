'use strict';
const {AsyncLocalStorage}=require('node:async_hooks');
const fs=require('node:fs');
const path=require('node:path');
const context=new AsyncLocalStorage();
function tenantId(value){if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(value))throw new Error('Invalid tenant identifier');return value;}
function emptyState(){return {schemaVersion:1,pilot:{},time:{records:{},idempotency:{}},evidence:{schemaVersion:1,objects:{},idempotency:{}},audit:[]};}
function validateState(org,state){
  tenantId(org);
  if(!state||state.schemaVersion!==1||!state.pilot||!state.time||!state.evidence||!Array.isArray(state.audit))throw new Error('Invalid business state');
  const rows=[...Object.values(state.pilot).flat(),...Object.values(state.time.records||{}),...Object.values(state.time.idempotency||{}),...Object.values(state.evidence.objects||{}),...Object.values(state.evidence.idempotency||{}),...state.audit];
  if(rows.some(row=>!row||row.organisationId!==org))throw new Error('Cross-tenant state rejected');
  return state;
}
class PostgresBusinessStore{
  constructor(pool){this.pool=pool;}
  async initialize(){
    await this.pool.query(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));
    const {rows}=await this.pool.query('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user');
    if(rows[0]?.rolsuper||rows[0]?.rolbypassrls)throw new Error('Business database role must enforce row security');
  }
  current(){const value=context.getStore();if(!value||value.owner!==this)throw new Error('Business operation outside tenant transaction');return value;}
  audit(event){this.current().state.audit.push({...event,recordedAt:new Date().toISOString()});}
  async withTenant(org,work,{write=true}={}){
    tenantId(org);if(context.getStore())throw new Error('Nested tenant transaction rejected');
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      await client.query("SELECT set_config('werkz.organisation_id',$1,true)",[org]);
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['werkz-business:'+org]);
      const {rows}=await client.query('SELECT state FROM werkz_business_state WHERE organisation_id=$1 FOR UPDATE',[org]);
      const state=validateState(org,rows[0]?.state||emptyState());
      const scope={owner:this,org,state,afterCommit:[],repositories:{}};
      const value=await context.run(scope,()=>work(state));
      validateState(org,state);
      if(write)await client.query('INSERT INTO werkz_business_state(organisation_id,state) VALUES($1,$2::jsonb) ON CONFLICT(organisation_id) DO UPDATE SET state=EXCLUDED.state,revision=werkz_business_state.revision+1,updated_at=clock_timestamp()',[org,JSON.stringify(state)]);
      await client.query('COMMIT');
      for(const finish of scope.afterCommit){try{finish();}catch{process.stderr.write('Deferred private file cleanup failed\n');}}
      return value;
    }catch(error){try{await client.query('ROLLBACK');}catch{process.stderr.write('Business transaction rollback failed\n');}throw error;}
    finally{client.release();}
  }
}
module.exports={PostgresBusinessStore,emptyState,validateState,tenantId};
