'use strict';
const {InMemoryRepository,MODULES}=require('../core/werkz-core');
const {capabilities}=require('../security/handwerk-policy');
function map(rows){return Object.fromEntries((rows||[]).map(x=>[x.id,x]));}
function repositoryFor(state,org){
  const repo=new InMemoryRepository({schemaVersion:1,revision:0,organisations:{[org]:{id:org,name:'SYNTHETISCH WerkZ Handwerk',enabledModules:Object.values(MODULES),approvalRequired:true}},users:map((state.pilot.users||[]).map(({password,...u})=>({...u,capabilities:capabilities(u)}))),customers:map(state.pilot.customers),orders:map(state.pilot.orders),resources:{},timers:state.time.records,evidence:map(state.pilot.workEvidence),approvals:map(state.pilot.approvals),audit:state.audit,idempotency:Object.fromEntries((state.pilot.handwerkIdempotency||[]).map(x=>[x.id,x]))});
  return {repo,save(){const value=repo.read();state.pilot.customers=Object.values(value.customers);state.pilot.orders=Object.values(value.orders);state.pilot.workEvidence=Object.values(value.evidence);state.pilot.approvals=Object.values(value.approvals);state.pilot.handwerkIdempotency=Object.entries(value.idempotency).map(([id,row])=>({id,organisationId:org,...row}));state.audit=value.audit;state.time.records=Object.fromEntries(Object.entries(value.timers).map(([id,row])=>[id,{...row,revision:row.revision||1,status:row.endedAt?'finished':'running'}]));}};
}
module.exports={repositoryFor};
