'use strict';

const http=require('node:http'),path=require('node:path');
const {ModuleRegistry,EntitlementService,LocalAuthPort,FileTimeRepository,FilePrivateEvidenceStorage,TimeProductionService,TimeApplication,createTimeHttpHandler}=require('../src');

function required(name){const value=process.env[name];if(!value)throw new Error(name+' is required');return value}
const dataDir=path.resolve(process.env.WERKZ_TIME_DATA_DIR||'./var/time-test');
const organisationId=process.env.WERKZ_TEST_ORGANISATION_ID||'org-device-test';
const actorId=process.env.WERKZ_TEST_ACTOR_ID||'user-device-test';
const sessionToken=required('WERKZ_TEST_SESSION_TOKEN');
const loginCode=required('WERKZ_TEST_LOGIN_CODE');
const allowedOrigin=process.env.WERKZ_TEST_ALLOWED_ORIGIN||'https://project29212.websitepublisher.ai';
const capabilities=['time.start','time.stop','time.correct','document.upload'];
const registry=new ModuleRegistry(),entitlements=new EntitlementService({registry});
entitlements.set({organisationId,moduleId:'werkz.time',catalogVersion:'v0.2'});
const auth=new LocalAuthPort({[sessionToken]:{organisationId,actorId,capabilities}});
const application=new TimeApplication(new TimeProductionService({
  auth,entitlements,repository:new FileTimeRepository(path.join(dataDir,'time.json')),
  storage:new FilePrivateEvidenceStorage(path.join(dataDir,'evidence')),
  audit:event=>process.stdout.write(JSON.stringify({kind:'audit',...event})+'\n')
}));
const timeHandler=createTimeHttpHandler({application,auth,allowedOrigins:[allowedOrigin]});
function form(response,message=''){
  response.writeHead(message?401:200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
  response.end('<!doctype html><html lang="de"><meta name="viewport" content="width=device-width"><title>WerkZ Testanmeldung</title><body><main><h1>WerkZ Zeit Testanmeldung</h1>'+(message?'<p>'+message+'</p>':'')+'<form method="post"><label>Einmaliger Testcode <input name="code" type="password" required></label><button>Anmelden</button></form></main></body></html>');
}
const server=http.createServer(async(request,response)=>{
  const url=new URL(request.url,'http://werkz.invalid');
  if(request.method==='GET'&&url.pathname==='/healthz'){
    response.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return response.end('{"ok":true}');
  }
  if(url.pathname==='/test-login'&&request.method==='GET')return form(response);
  if(url.pathname==='/test-login'&&request.method==='POST'){
    const chunks=[];for await(const chunk of request)chunks.push(chunk);
    const code=new URLSearchParams(Buffer.concat(chunks).toString('utf8')).get('code');
    if(code!==loginCode)return form(response,'Code ungültig.');
    response.writeHead(303,{location:allowedOrigin+'/werkz-time-test.html','set-cookie':'werkz_session='+encodeURIComponent(sessionToken)+'; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=28800','cache-control':'no-store'});
    return response.end();
  }
  return timeHandler(request,response);
});
const port=Number(process.env.PORT||8080);
server.listen(port,'0.0.0.0',()=>process.stdout.write(JSON.stringify({kind:'ready',port,allowedOrigin})+'\n'));
