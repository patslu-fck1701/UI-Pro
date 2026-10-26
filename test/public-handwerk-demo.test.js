'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {createPublicDemo}=require('../src/handwerk/public-demo');
test('public profiles retain shared workflow within a demo and isolate visitors and external services',async()=>{
  const handler=createPublicDemo();const server=http.createServer(async(req,res)=>{if(!await handler(req,res)){res.writeHead(404);res.end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  const call=(path,{cookie,body,origin=base}={})=>fetch(base+path,{redirect:'manual',headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json',origin}: {})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
  try{
    const a=await call('/handwerk/demo/start',{body:{role:'owner'}});assert.equal(a.status,303);const cookie=a.headers.get('set-cookie').split(';')[0];
    const first=await(await call('/handwerk/api/overview',{cookie})).json();assert.equal(first.orders.length,2);assert.equal(first.finance.approvals.length,1);assert.ok(!first.user.capabilities.includes('user.manage'));
    const cross=await call('/handwerk/demo/start',{cookie,body:{role:'technician'},origin:'https://attacker.invalid'});assert.equal(cross.status,403);
    await call('/handwerk/demo/start',{cookie,body:{role:'technician'}});const worker=await(await call('/handwerk/api/overview',{cookie})).json();assert.equal(worker.user.roles[0],'technician');assert.equal(worker.finance,undefined);assert.ok(worker.orders.length>0);
    const order=worker.orders.find(row=>row.status!=='completed');
    let response=await call('/handwerk/api/commands',{cookie,body:{operation:'time.start',input:{orderId:order.id,idempotencyKey:'synthetic-start'}}});assert.equal(response.status,200);const timer=await response.json();
    response=await call('/handwerk/api/commands',{cookie,body:{operation:'time.stop',input:{timerId:timer.id,idempotencyKey:'synthetic-stop'}}});assert.equal(response.status,200);
    response=await call('/handwerk/api/commands',{cookie,body:{operation:'order.complete',input:{orderId:order.id,idempotencyKey:'synthetic-done'}}});assert.equal(response.status,200);
    response=await call('/handwerk/api/commands',{cookie,body:{operation:'approval.decide',input:{approvalId:first.finance.approvals[0].id,decision:'approved',confirm:true,idempotencyKey:'synthetic-worker-denied'}}});assert.equal(response.status,403);
    await call('/handwerk/demo/start',{cookie,body:{role:'owner'}});
    response=await call('/handwerk/api/commands',{cookie,body:{operation:'approval.decide',input:{approvalId:first.finance.approvals[0].id,decision:'approved',confirm:true,idempotencyKey:'synthetic-approved'}}});assert.equal(response.status,200);
    const b=await call('/handwerk/demo/start',{body:{role:'owner'}});const cookieB=b.headers.get('set-cookie').split(';')[0];const second=await(await call('/handwerk/api/overview',{cookie:cookieB})).json();assert.notEqual(first.user.organisationId,second.user.organisationId);assert.equal(second.finance.approvals[0].state,'pending');
    response=await call('/handwerk/api/commands',{cookie:cookieB,body:{operation:'order.complete',input:{orderId:order.id,idempotencyKey:'foreign'}}});assert.equal(response.status,404);
    assert.equal((await call('/handwerk/api/integrations/sevdesk',{cookie})).status,403);
    assert.equal((await call('/handwerk/api/users',{cookie})).status,403);
    await call('/handwerk/demo/start',{cookie,body:{role:'accounting'}});const pack=await(await call('/handwerk/api/accounting/'+first.orders.find(row=>row.status==='completed').id,{cookie})).json();assert.equal(pack.isInvoice,false);assert.equal(pack.totalMinutes,90);
    const reset=await call('/handwerk/demo/reset',{cookie,body:{role:'owner'}});assert.equal(reset.status,303);assert.equal((await call('/handwerk/api/overview',{cookie})).status,401);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
