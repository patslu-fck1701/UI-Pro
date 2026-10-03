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
const hubDir=path.resolve(__dirname,'../demos/demo-hub');
const organisationId=process.env.WERKZ_TEST_ORGANISATION_ID||'org-device-test';
const actorId=process.env.WERKZ_TEST_ACTOR_ID||'manager-device-test';
const actorLabel=process.env.WERKZ_TEST_ACTOR_LABEL||'Manager';
const primarySessionToken=runtimeSecret('WERKZ_TEST_SESSION_TOKEN',48);
const loginCode=runtimeLoginCode();
const allowedOrigins=String(process.env.WERKZ_TEST_ALLOWED_ORIGINS||process.env.WERKZ_TEST_ALLOWED_ORIGIN||'https://project29212.websitepublisher.ai,http://127.0.0.1:8765').split(',').map(value=>value.trim()).filter(Boolean);
const externalFrontendUrl=process.env.WERKZ_TEST_EXTERNAL_FRONTEND_URL||'';
const ephemeralMode=process.env.WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS==='1';
const testProfilesEnabled=ephemeralMode||process.env.WERKZ_ENABLE_TEST_PROFILES==='1';
const profileAccessToken=crypto.randomBytes(32).toString('base64url');
const workerCapabilities=['time.start','time.stop','time.correct','document.upload'];
const managerCapabilities=[...workerCapabilities,'time.read.all'];
const testProfiles=new Map([
  ['manager',{id:'manager',actorId,actorLabel,capabilities:managerCapabilities,token:primarySessionToken,role:'manager'}]
]);
if(testProfilesEnabled){
  testProfiles.set('worker-a',{
    id:'worker-a',actorId:'worker-a',actorLabel:process.env.WERKZ_TEST_WORKER_A_LABEL||'Mitarbeiter A',
    capabilities:workerCapabilities,token:crypto.randomBytes(48).toString('base64url'),role:'worker'
  });
  testProfiles.set('worker-b',{
    id:'worker-b',actorId:'worker-b',actorLabel:process.env.WERKZ_TEST_WORKER_B_LABEL||'Mitarbeiter B',
    capabilities:workerCapabilities,token:crypto.randomBytes(48).toString('base64url'),role:'worker'
  });
}
const authSessions=Object.fromEntries([...testProfiles.values()].map(profile=>[
  profile.token,{organisationId,actorId:profile.actorId,actorLabel:profile.actorLabel,capabilities:profile.capabilities}
]));
const registry=new ModuleRegistry(),entitlements=new EntitlementService({registry});
entitlements.set({organisationId,moduleId:'werkz.time',catalogVersion:'v0.2'});
const auth=new LocalAuthPort(authSessions);
const application=new TimeApplication(new TimeProductionService({
  auth,entitlements,repository:new FileTimeRepository(path.join(dataDir,'time.json')),
  storage:new FilePrivateEvidenceStorage(path.join(dataDir,'evidence')),
  audit:event=>process.stdout.write(JSON.stringify({kind:'audit',...event})+'\n')
}));
const timeHandler=createTimeHttpHandler({application,auth,allowedOrigins});

const staticFiles=new Map([
  ['/','index.html'],['/index.html','index.html'],['/styles.css','styles.css'],['/app.js','app.js'],
  ['/manifest.webmanifest','manifest.webmanifest'],['/icon.svg','icon.svg'],['/logo_ich_black.png','logo_ich_black.png'],['/sw.js','sw.js']
]);
const contentTypes={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};

function safeLocalReturn(value,fallback='/'){
  if(!value)return fallback;
  try{
    const url=new URL(String(value),'http://werkz.invalid');
    if(url.origin!=='http://werkz.invalid'||!url.pathname.startsWith('/')||url.pathname.startsWith('//'))return fallback;
    return url.pathname+url.search;
  }catch{return fallback;}
}

function hubSecurityHeaders(response){
  response.setHeader('content-security-policy',"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader('x-content-type-options','nosniff');
  response.setHeader('referrer-policy','no-referrer');
  response.setHeader('cache-control','no-store');
}

function serveDemoHub(url,response){
  if(url.pathname==='/hub'){
    response.writeHead(308,{location:'/hub/'});response.end();return true;
  }
  if(!url.pathname.startsWith('/hub/'))return false;
  let relative;
  try{relative=decodeURIComponent(url.pathname.slice('/hub/'.length));}
  catch{response.writeHead(400,{'content-type':'text/plain; charset=utf-8'});response.end('Bad request');return true;}
  if(!relative)relative='index.html';
  if(relative==='data/config.json'){
    const config=JSON.parse(fs.readFileSync(path.join(hubDir,'data/config.json'),'utf8'));
    config.time_app_url='/test-profiles?return=/';
    config.time_profile_url='/test-profiles?return=/hub/';
    config.time_api_base='/api';
    hubSecurityHeaders(response);
    response.writeHead(200,{'content-type':'application/json; charset=utf-8'});
    response.end(JSON.stringify(config));return true;
  }
  const candidate=path.resolve(hubDir,relative);
  if(candidate!==hubDir&&!candidate.startsWith(hubDir+path.sep)){
    response.writeHead(403,{'content-type':'text/plain; charset=utf-8'});response.end('Forbidden');return true;
  }
  if(!fs.existsSync(candidate)||!fs.statSync(candidate).isFile())return false;
  hubSecurityHeaders(response);
  response.writeHead(200,{'content-type':contentTypes[path.extname(candidate)]||'application/octet-stream'});
  response.end(fs.readFileSync(candidate));return true;
}

function serveStatic(url,response){
  const file=staticFiles.get(url.pathname);
  if(!file)return false;
  const bytes=fs.readFileSync(path.join(pwaDir,file));
  const type=contentTypes[path.extname(file)]||'application/octet-stream';
  response.writeHead(200,{'content-type':type,'cache-control':file==='sw.js'||file==='index.html'?'no-cache':'public, max-age=300'});
  response.end(bytes);
  return true;
}

function html(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function cookieValue(cookie,name){
  const match=String(cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(name+'='));
  return match?decodeURIComponent(match.slice(name.length+1)):null;
}
function cookieTokenFromHeader(cookie){return cookieValue(cookie,'werkz_session');}
function profileAccessGranted(cookie){
  if(ephemeralMode)return true;
  if(cookieValue(cookie,'werkz_test_access')===profileAccessToken)return true;
  const sessionToken=cookieTokenFromHeader(cookie);
  return Boolean(sessionToken&&testProfiles.size&&[...testProfiles.values()].some(profile=>profile.token===sessionToken));
}
function sessionCookie(name,value,maxAge=28800){
  return name+'='+encodeURIComponent(value)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge;
}
function form(response,message='',returnTo='/'){
  response.writeHead(message?401:200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
  response.end('<!doctype html><html lang="de"><meta name="viewport" content="width=device-width"><title>WerkZ Testanmeldung</title><body><main><h1>WerkZ Zeit Testanmeldung</h1>'+(message?'<p>'+html(message)+'</p>':'')+'<form method="post"><input type="hidden" name="return" value="'+html(returnTo)+'"><label>Temporärer Testcode <input name="code" type="password" required></label><button>Anmelden</button></form></main></body></html>');
}
function selectedProfile(id){
  const profile=testProfiles.get(String(id||'manager'));
  if(!profile){const error=new Error('Unknown test profile');error.code='NOT_FOUND';throw error;}
  return profile;
}
function profilePage(request,response,returnTo){
  if(!testProfilesEnabled){
    response.writeHead(404,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});
    return response.end('Not found');
  }
  if(!profileAccessGranted(request.headers.cookie)){
    const target='/test-login?return='+encodeURIComponent(returnTo);
    response.writeHead(303,{location:target,'cache-control':'no-store'});
    return response.end();
  }
  const links=[...testProfiles.values()].map(profile=>{
    const target='/test-login?profile='+encodeURIComponent(profile.id)+'&return='+encodeURIComponent(returnTo);
    const detail=profile.role==='manager'?'Chefansicht · sieht organisationsweite Testzeiten':'Mitarbeiteransicht · sieht nur eigene Testzeiten';
    return '<li><a href="'+html(target)+'"><strong>'+html(profile.actorLabel)+'</strong></a><br><small>'+html(detail)+'</small></li>';
  }).join('');
  response.writeHead(200,{
    'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'
  });
  response.end('<!doctype html><html lang="de"><meta name="viewport" content="width=device-width"><title>WerkZ Testprofile</title><body><main><h1>WerkZ Testprofile</h1><p>Nur für die nicht-produktive WerkZ-Testinstanz.</p><ul>'+links+'</ul></main></body></html>');
}

const server=http.createServer(async(request,response)=>{
  const url=new URL(request.url,'http://werkz.invalid');
  if(request.method==='GET'&&url.pathname==='/healthz'){
    response.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
    return response.end('{"ok":true}');
  }
  if(url.pathname==='/test-profiles'&&request.method==='GET'){
    const returnTo=externalFrontendUrl||safeLocalReturn(url.searchParams.get('return'),'/');
    return profilePage(request,response,returnTo);
  }
  if(url.pathname==='/test-login'&&request.method==='GET'){
    const returnTo=externalFrontendUrl||safeLocalReturn(url.searchParams.get('return'),'/');
    const profileId=url.searchParams.get('profile');
    if(profileId&&testProfilesEnabled){
      if(!profileAccessGranted(request.headers.cookie)&&!ephemeralMode)return form(response,'Testcode erforderlich.',returnTo);
      let profile;
      try{profile=selectedProfile(profileId);}
      catch{
        response.writeHead(404,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});
        return response.end('Unknown test profile');
      }
      response.writeHead(303,{
        location:returnTo,
        'set-cookie':sessionCookie('werkz_session',profile.token),
        'cache-control':'no-store'
      });
      return response.end();
    }
    if(ephemeralMode){
      const profile=selectedProfile('manager');
      response.writeHead(303,{
        location:returnTo,
        'set-cookie':sessionCookie('werkz_session',profile.token),
        'cache-control':'no-store'
      });
      return response.end();
    }
    return form(response,'',returnTo);
  }
  if(url.pathname==='/test-login'&&request.method==='POST'){
    const chunks=[];for await(const chunk of request)chunks.push(chunk);
    const params=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
    const code=params.get('code');
    const location=externalFrontendUrl||safeLocalReturn(params.get('return'),'/');
    if(code!==loginCode)return form(response,'Code ungültig.',location);
    if(testProfilesEnabled){
      const target='/test-profiles?return='+encodeURIComponent(location);
      response.writeHead(303,{
        location:target,
        'set-cookie':sessionCookie('werkz_test_access',profileAccessToken,3600),
        'cache-control':'no-store'
      });
      return response.end();
    }
    response.writeHead(303,{
      location,
      'set-cookie':sessionCookie('werkz_session',primarySessionToken),
      'cache-control':'no-store'
    });
    return response.end();
  }
  if(request.method==='GET'&&serveDemoHub(url,response))return;
  if(request.method==='GET'&&serveStatic(url,response))return;
  const sessionToken=cookieTokenFromHeader(request.headers.cookie);
  if(ephemeralMode&&request.method==='GET'&&(url.pathname==='/api/session'||url.pathname==='/session')&&(!sessionToken||!authSessions[sessionToken])){
    const manager=selectedProfile('manager');
    const existing=String(request.headers.cookie||'').replace(/(?:^|;\\s*)werkz_session=[^;]*/g,'').replace(/^;\\s*|;\\s*$/g,'');
    request.headers.cookie=(existing?existing+'; ':'')+'werkz_session='+encodeURIComponent(manager.token);
    response.setHeader('set-cookie',sessionCookie('werkz_session',manager.token));
  }
  if(url.pathname.startsWith('/api/'))request.url=request.url.slice(4);
  return timeHandler(request,response);
});

const port=Number(process.env.PORT||8080);
server.listen(port,'0.0.0.0',()=>{const actualPort=server.address().port;process.stdout.write(JSON.stringify({
  kind:'ready',port:actualPort,hub:'/hub/',time:'/',profiles:testProfilesEnabled?'/test-profiles':null,
  profileIds:testProfilesEnabled?[...testProfiles.keys()]:[],allowedOrigins,sameOriginPwa:true,unifiedLocalStack:true,
  ephemeralSecrets:ephemeralMode,testProfilesEnabled
})+'\n')});

module.exports={server,safeLocalReturn,serveDemoHub,testProfiles,profileAccessGranted,sessionCookie};
