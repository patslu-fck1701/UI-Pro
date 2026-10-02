'use strict';

const http=require('node:http'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const {ModuleRegistry,EntitlementService,LocalAuthPort,FileTimeRepository,FilePrivateEvidenceStorage,TimeProductionService,TimeApplication,createTimeHttpHandler}=require('../src');

function runtimeSecret(name,bytes){
  const configured=process.env[name];
  if(configured)return configured;
  if(process.env.WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS!=='1')throw new Error(name+' is required');
  const value=crypto.randomBytes(bytes).toString('base64url');
  process.stdout.write(JSON.stringify({
    kind:'ephemeral-test-secret',
    name,
    note:'Non-production only; regenerated on process restart'
  })+'\n');
  return value;
}
function runtimeLoginCode(){
  const configured=process.env.WERKZ_TEST_LOGIN_CODE;
  if(configured)return configured;
  if(process.env.WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS!=='1')throw new Error('WERKZ_TEST_LOGIN_CODE is required');
  const renderServiceId=process.env.RENDER_SERVICE_ID;
  const value=renderServiceId
    ? crypto.createHash('sha256').update('werkz-time-device-test:'+renderServiceId).digest('base64url').slice(0,16)
    : crypto.randomBytes(12).toString('base64url');
  process.stdout.write(JSON.stringify({
    kind:'ephemeral-test-login',
    stableForService:Boolean(renderServiceId),
    value,
    note:'Non-production device-test code only'
  })+'\n');
  return value;
}
const dataDir=path.resolve(process.env.WERKZ_TIME_DATA_DIR||'./var/time-test');
const pwaDir=path.resolve(__dirname,'../apps/time-pwa');
const organisationId=process.env.WERKZ_TEST_ORGANISATION_ID||'org-device-test';
const actorId=process.env.WERKZ_TEST_ACTOR_ID||'user-device-test';
const sessionToken=runtimeSecret('WERKZ_TEST_SESSION_TOKEN',48);
const loginCode=runtimeLoginCode();
const allowedOrigin=process.env.WERKZ_TEST_ALLOWED_ORIGIN||'https://project29212.websitepublisher.ai';
const externalFrontendUrl=process.env.WERKZ_TEST_EXTERNAL_FRONTEND_URL||'';
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

const staticFiles=new Map([
  ['/','index.html'],['/index.html','index.html'],['/styles.css','styles.css'],['/app.js','app.js'],
  ['/manifest.webmanifest','manifest.webmanifest'],['/icon.svg','icon.svg'],['/logo_ich_black.png','logo_ich_black.png'],['/sw.js','sw.js']
]);
const contentTypes={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};

function serveStatic(url,response){
  const file=staticFiles.get(url.pathname);
  if(!file)return false;
  const bytes=fs.readFileSync(path.join(pwaDir,file));
  const type=contentTypes[path.extname(file)]||'application/octet-stream';
  response.writeHead(200,{'content-type':type,'cache-control':file==='sw.js'||file==='index.html'?'no-cache':'public, max-age=300'});
  response.end(bytes);
  return true;
}

function form(response,message=''){
  response.writeHead(message?401:200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
  response.end('<!doctype html><html lang="de"><meta name="viewport" content="width=device-width"><title>WerkZ Testanmeldung</title><body><main><h1>WerkZ Zeit Testanmeldung</h1>'+(message?'<p>'+message+'</p>':'')+'<form method="post"><label>Temporärer Testcode <input name="code" type="password" required></label><button>Anmelden</button></form></main></body></html>');
}

const server=http.createServer(async(request,response)=>{
  const url=new URL(request.url,'http://werkz.invalid');
  if(request.method==='GET'&&url.pathname==='/healthz'){
    response.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
    return response.end('{"ok":true}');
  }
  if(url.pathname==='/test-login'&&request.method==='GET'){
    if(process.env.WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS==='1'){
      response.writeHead(303,{
        location:'/',
        'set-cookie':'werkz_session='+encodeURIComponent(sessionToken)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800',
        'cache-control':'no-store'
      });
      return response.end();
    }
    return form(response);
  }
  if(url.pathname==='/test-login'&&request.method==='POST'){
    const chunks=[];for await(const chunk of request)chunks.push(chunk);
    const code=new URLSearchParams(Buffer.concat(chunks).toString('utf8')).get('code');
    if(code!==loginCode)return form(response,'Code ungültig.');
    const sameSite=externalFrontendUrl?'None':'Lax';
    const location=externalFrontendUrl||'/';
    response.writeHead(303,{
      location,
      'set-cookie':'werkz_session='+encodeURIComponent(sessionToken)+'; Path=/; HttpOnly; Secure; SameSite='+sameSite+'; Max-Age=28800',
      'cache-control':'no-store'
    });
    return response.end();
  }
  if(request.method==='GET'&&serveStatic(url,response))return;
  if(process.env.WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS==='1'&&request.method==='GET'&&(url.pathname==='/api/session'||url.pathname==='/session')){
    const existing=String(request.headers.cookie||'').replace(/(?:^|;\\s*)werkz_session=[^;]*/g,'').replace(/^;\\s*|;\\s*$/g,'');
    request.headers.cookie=(existing?existing+'; ':'')+'werkz_session='+encodeURIComponent(sessionToken);
    response.setHeader('set-cookie','werkz_session='+encodeURIComponent(sessionToken)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800');
  }
  if(url.pathname.startsWith('/api/'))request.url=request.url.slice(4);
  return timeHandler(request,response);
});

const port=Number(process.env.PORT||8080);
server.listen(port,'0.0.0.0',()=>process.stdout.write(JSON.stringify({kind:'ready',port,allowedOrigin,sameOriginPwa:true,ephemeralSecrets:process.env.WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS==='1'})+'\n'));
