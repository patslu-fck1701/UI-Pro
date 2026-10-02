'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {ModuleRegistry,EntitlementService,LocalAuthPort,FileTimeRepository,FilePrivateEvidenceStorage,TimeProductionService,TimeApplication,createTimeHttpHandler}=require('../src');

async function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-http-'));
  const registry=new ModuleRegistry(),entitlements=new EntitlementService({registry});
  entitlements.set({organisationId:'org-a',moduleId:'werkz.time',catalogVersion:'v0.2'});
  entitlements.set({organisationId:'org-b',moduleId:'werkz.time',catalogVersion:'v0.2'});
  const capabilities=['time.start','time.stop','time.correct','document.upload'];
  const auth=new LocalAuthPort({a:{organisationId:'org-a',actorId:'user-a',capabilities},b:{organisationId:'org-b',actorId:'user-b',capabilities}});
  const application=new TimeApplication(new TimeProductionService({auth,entitlements,
    repository:new FileTimeRepository(path.join(root,'time.json')),storage:new FilePrivateEvidenceStorage(path.join(root,'evidence'))}));
  const server=http.createServer(createTimeHttpHandler({application,auth,allowedOrigins:['https://project29212.websitepublisher.ai']}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  return {root,base,close:async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true})}};
}
const request=(base,url,token,options={})=>fetch(base+url,{...options,headers:{cookie:'werkz_session='+token,...options.headers}});
const command=(base,token,operation,input)=>request(base,'/time/commands',token,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operation,input})});

test('HTTP session derives tenant, actor and capabilities from server session',async()=>{
  const fx=await fixture();try{
    const response=await request(fx.base,'/session','a');
    assert.equal(response.status,200);assert.deepEqual(await response.json(),{organisationId:'org-a',actorId:'user-a',capabilities:['time.start','time.stop','time.correct','document.upload']});
    assert.equal((await request(fx.base,'/session','invalid')).status,401);
  }finally{await fx.close()}
});

test('HTTP Time commands and multipart evidence use durable application boundary',async()=>{
  const fx=await fixture();try{
    const start=await (await command(fx.base,'a','time.start',{id:'time-http-1',idempotencyKey:'start'})).json();
    assert.equal(start.ok,true);assert.equal(start.data.organisationId,'org-a');
    const corrected=await (await command(fx.base,'a','time.correct',{id:start.data.id,expectedRevision:1,idempotencyKey:'note',reason:'offline note',changes:{note:'done'}})).json();
    assert.equal(corrected.data.revision,2);
    const bytes=Buffer.from('binary-photo'),hash='sha256:'+crypto.createHash('sha256').update(bytes).digest('hex');
    const form=new FormData();form.append('timeRecordId',start.data.id);form.append('idempotencyKey','photo');form.append('mime','image/jpeg');form.append('size',String(bytes.length));form.append('hash',hash);form.append('file',new Blob([bytes],{type:'image/jpeg'}),'photo.jpg');
    const uploaded=await request(fx.base,'/time/evidence','a',{method:'POST',body:form});
    assert.equal(uploaded.status,200);assert.equal((await uploaded.json()).data.hash,hash);
    const stop=await (await command(fx.base,'a','time.stop',{id:start.data.id,expectedRevision:2,idempotencyKey:'stop'})).json();
    assert.equal(stop.data.revision,3);
    const replay=await (await command(fx.base,'a','time.stop',{id:start.data.id,expectedRevision:2,idempotencyKey:'stop'})).json();
    assert.equal(replay.data.revision,3);
    const hidden=await command(fx.base,'b','time.get',{id:start.data.id});assert.equal(hidden.status,404);
  }finally{await fx.close()}
});

test('HTTP CORS allowlist rejects unknown origins, permits same-origin requests and does not trust client tenant fields',async()=>{
  const fx=await fixture();try{
    const denied=await fetch(fx.base+'/session',{headers:{origin:'https://evil.example',cookie:'werkz_session=a'}});assert.equal(denied.status,403);
    const sameOriginResponse=await fetch(fx.base+'/session',{headers:{origin:fx.base,cookie:'werkz_session=a'}});assert.equal(sameOriginResponse.status,200);
    const response=await command(fx.base,'a','time.start',{organisationId:'org-b',actorId:'user-b',idempotencyKey:'tenant-spoof'});
    const result=await response.json();assert.equal(result.data.organisationId,'org-a');assert.equal(result.data.actorId,'user-a');
  }finally{await fx.close()}
});
