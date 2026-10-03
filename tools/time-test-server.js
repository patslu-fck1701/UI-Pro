'use strict';

const http=require('node:http'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const {
  ModuleRegistry,EntitlementService,LocalAuthPort,FileTimeRepository,FilePrivateEvidenceStorage,
  TimeProductionService,TimeApplication,createTimeHttpHandler,
  FileAssistantState,FileAssistantDocumentStore,AssistantService,createAssistantHttpHandler,
  createPilotRuntime,createPilotHttpHandler
}=require('../src');

function runtimeSecret(name,bytes){
  const configured=process.env[name];
  if(configured)return configured;
  if(process.env.WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS!=='1')throw new Error(name+' is required');
  const value=crypto.randomBytes(bytes).toString('base64url');
  process.stdout.write(JSON.stringify({kind:'ephemeral-test-secret',name,note:'Non-production only; regenerated on process restart'})+'\n');
  return value;
}
function runtimeLoginCode(){
  const configured=process.env.WERKZ_TEST_LOGIN_CODE;
  if(configured)return configured;
  if(process.env.WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS!=='1')throw new Error('WERKZ_TEST_LOGIN_CODE is required');
  const renderServiceId=process.env.RENDER_SERVICE_ID;
  const value=renderServiceId
    ? crypto.createHash('sha256').update('werkz-assistant-device-test:'+renderServiceId).digest('base64url').slice(0,16)
    : crypto.randomBytes(12).toString('base64url');
  process.stdout.write(JSON.stringify({kind:'ephemeral-test-login',stableForService:Boolean(renderServiceId),value,note:'Non-production device-test code only'})+'\n');
  return value;
}

const dataDir=path.resolve(process.env.WERKZ_TIME_DATA_DIR||process.env.WERKZ_TEST_DATA_DIR||'./var/werkz-test');
const assistantDir=path.resolve(process.env.WERKZ_ASSISTANT_DATA_DIR||path.join(dataDir,'assistant'));
const timeDir=path.resolve(process.env.WERKZ_TIME_DATA_DIR||path.join(dataDir,'time'));
const assistantPwaDir=path.resolve(__dirname,'../apps/assistant-pwa');
const timePwaDir=path.resolve(__dirname,'../apps/time-pwa');
const advisorPwaDir=path.resolve(__dirname,'../apps/advisor-pwa');
const pilotPwaDir=path.resolve(__dirname,'../apps/simple-pilot');
const pilotSiteDir=path.resolve(__dirname,'../apps/simple-site');

const organisationId=process.env.WERKZ_TEST_ORGANISATION_ID||'org-device-test';
const actorId=process.env.WERKZ_TEST_ACTOR_ID||'manager-device-test';
const actorLabel=process.env.WERKZ_TEST_ACTOR_LABEL||'Chef';
const primarySessionToken=runtimeSecret('WERKZ_TEST_SESSION_TOKEN',48);
const loginCode=runtimeLoginCode();
const allowedOrigins=String(process.env.WERKZ_TEST_ALLOWED_ORIGINS||process.env.WERKZ_TEST_ALLOWED_ORIGIN||'http://127.0.0.1:8765')
  .split(',').map(value=>value.trim()).filter(Boolean);
const externalFrontendUrl=process.env.WERKZ_TEST_EXTERNAL_FRONTEND_URL||'';
const ephemeralMode=process.env.WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS==='1';
const testProfilesEnabled=ephemeralMode||process.env.WERKZ_ENABLE_TEST_PROFILES==='1';
const profileAccessToken=crypto.randomBytes(32).toString('base64url');

const workerCapabilities=['time.start','time.stop','time.correct','document.upload'];
const managerCapabilities=[
  ...workerCapabilities,'time.read.all',
  'assistant.read','assistant.capture','assistant.manage',
  'analytics.view','simulation.run','management.view',
  'pilot.read','pilot.write','market.read'
];
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
for(const moduleId of ['werkz.time','werkz.assistant','werkz.analytics','werkz.simulation','werkz.management','werkz.simple','werkz.documents','werkz.billing-prep','werkz.channel.voice','werkz.channel.gmail','werkz.crypto-monitor']){
  entitlements.set({organisationId,moduleId,catalogVersion:'v0.2'});
}
const auth=new LocalAuthPort(authSessions);
const audit=event=>process.stdout.write(JSON.stringify({kind:'audit',...event})+'\n');

const timeApplication=new TimeApplication(new TimeProductionService({
  auth,entitlements,
  repository:new FileTimeRepository(path.join(timeDir,'time.json')),
  storage:new FilePrivateEvidenceStorage(path.join(timeDir,'evidence')),
  audit
}));
const timeHandler=createTimeHttpHandler({application:timeApplication,auth,allowedOrigins});

const assistantService=new AssistantService({
  auth,entitlements,
  state:new FileAssistantState(path.join(assistantDir,'state.json')),
  documents:new FileAssistantDocumentStore(path.join(assistantDir,'documents')),
  audit
});
const assistantHandler=createAssistantHttpHandler({service:assistantService,allowedOrigins});

const pilotService=createPilotRuntime({
  auth,entitlements,dataDir:path.join(dataDir,'simple-pilot'),audit
});
const pilotHandler=createPilotHttpHandler({
  service:pilotService,
  defaultTaxRecipient:process.env.WERKZ_TAX_ADVISER_EMAIL||'steuerberater@example.invalid',
  publicOrganisationId:organisationId
});

const contentTypes={
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png'
};
const assistantFiles=new Map([
  ['/','index.html'],['/index.html','index.html'],['/assistant/','index.html'],['/assistant/index.html','index.html'],
  ['/assistant/styles.css','styles.css'],['/assistant/app.js','app.js'],['/assistant/manifest.webmanifest','manifest.webmanifest'],['/assistant/sw.js','sw.js'],['/assistant/apple-touch-icon.png','apple-touch-icon.png']
]);
const advisorFiles=new Map([
  ['/advisor/','index.html'],['/advisor/index.html','index.html'],['/advisor/styles.css','styles.css'],['/advisor/app.js','app.js']
]);
const timeFiles=new Map([
  ['/time/','index.html'],['/time/index.html','index.html'],['/time/styles.css','styles.css'],['/time/app.js','app.js'],
  ['/time/manifest.webmanifest','manifest.webmanifest'],['/time/icon.svg','icon.svg'],['/time/logo_ich_black.png','logo_ich_black.png'],['/time/sw.js','sw.js']
]);

function safeLocalReturn(value,fallback='/'){
  if(!value)return fallback;
  try{
    const url=new URL(String(value),'http://werkz.invalid');
    if(url.origin!=='http://werkz.invalid'||!url.pathname.startsWith('/')||url.pathname.startsWith('//'))return fallback;
    return url.pathname+url.search;
  }catch{return fallback}
}
function staticHeaders(response,file){
  response.setHeader('content-security-policy',"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader('x-content-type-options','nosniff');
  response.setHeader('referrer-policy','no-referrer');
  response.setHeader('cache-control',file==='sw.js'||file==='index.html'?'no-cache':'public, max-age=300');
}
function serveMapped(url,response,map,root){
  const file=map.get(url.pathname);
  if(!file)return false;
  const candidate=path.join(root,file);
  if(!fs.existsSync(candidate)||!fs.statSync(candidate).isFile())return false;
  staticHeaders(response,file);
  response.writeHead(200,{'content-type':contentTypes[path.extname(file)]||'application/octet-stream'});
  response.end(fs.readFileSync(candidate));return true;
}
function servePilotReference(url,response){
  const targets={
    '/pilot/crypto-lab':'https://project23947.websitepublisher.ai/crypto-lab.html',
    '/pilot/crypto-simulation':'https://project23947.websitepublisher.ai/werkz-analyse-simulation.html'
  };
  const target=targets[url.pathname];
  if(!target)return false;
  response.writeHead(302,{location:target,'cache-control':'no-store'});response.end();return true;
}

function servePilotHtml(url,response){
  if(url.pathname==='/pilot'){response.writeHead(308,{location:'/pilot/'});response.end();return true}
  if(url.pathname==='/pilot/site'){response.writeHead(308,{location:'/pilot/site/'});response.end();return true}
  let file=null,cache='no-store';
  if(url.pathname==='/pilot/'||url.pathname==='/pilot/index.html')file=path.join(pilotPwaDir,'index.html');
  if(url.pathname==='/pilot/sw.js'){file=path.join(pilotPwaDir,'sw.js');cache='no-cache'}
  if(url.pathname==='/pilot/manifest.webmanifest'){file=path.join(pilotPwaDir,'manifest.webmanifest');cache='public, max-age=300'}
  if(url.pathname==='/pilot/icon.svg'){file=path.join(pilotPwaDir,'icon.svg');cache='public, max-age=300'}
  if(url.pathname==='/pilot/site/'||url.pathname==='/pilot/site/index.html')file=path.join(pilotSiteDir,'index.html');
  if(!file)return false;
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())return false;
  response.setHeader('content-security-policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader('x-content-type-options','nosniff');
  response.setHeader('referrer-policy','no-referrer');
  response.setHeader('cache-control',cache);
  response.writeHead(200,{'content-type':contentTypes[path.extname(file)]||'application/octet-stream'});
  response.end(fs.readFileSync(file));return true;
}
function html(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function cookieValue(cookie,name){
  const match=String(cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(name+'='));
  return match?decodeURIComponent(match.slice(name.length+1)):null;
}
function cookieTokenFromHeader(cookie){return cookieValue(cookie,'werkz_session')}
function profileAccessGranted(cookie){
  if(ephemeralMode)return true;
  if(cookieValue(cookie,'werkz_test_access')===profileAccessToken)return true;
  const sessionToken=cookieTokenFromHeader(cookie);
  return Boolean(sessionToken&&[...testProfiles.values()].some(profile=>profile.token===sessionToken));
}
function sessionCookie(name,value,maxAge=28800){
  return name+'='+encodeURIComponent(value)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge;
}
function form(response,message='',returnTo='/'){
  response.writeHead(message?401:200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
  response.end('<!doctype html><html lang="de"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WerkZ Testanmeldung</title><body style="font-family:system-ui;background:#0b0e0f;color:#f6f8f4;margin:0;padding:24px"><main style="max-width:480px;margin:auto"><h1 style="font-size:1.4rem">WerkZ Testanmeldung</h1>'+(message?'<p>'+html(message)+'</p>':'')+'<form method="post" style="display:grid;gap:12px"><input type="hidden" name="return" value="'+html(returnTo)+'"><label>Testcode<input style="display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:14px" name="code" type="password" required></label><button style="min-height:48px;background:#d3ff2d;border:0;font-weight:800">Anmelden</button></form></main></body></html>');
}
function selectedProfile(id){
  const profile=testProfiles.get(String(id||'manager'));
  if(!profile){const error=new Error('Unknown test profile');error.code='NOT_FOUND';throw error}
  return profile;
}
function profilePage(request,response,returnTo){
  if(!testProfilesEnabled){
    response.writeHead(404,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});return response.end('Not found');
  }
  if(!profileAccessGranted(request.headers.cookie)){
    response.writeHead(303,{location:'/test-login?return='+encodeURIComponent(returnTo),'cache-control':'no-store'});return response.end();
  }
  const links=[...testProfiles.values()].map(profile=>{
    const target='/test-login?profile='+encodeURIComponent(profile.id)+'&return='+encodeURIComponent(returnTo);
    const detail=profile.role==='manager'?'Chefansicht':'Mitarbeiteransicht · nur WerkZ Zeit';
    return '<li><a href="'+html(target)+'"><strong>'+html(profile.actorLabel)+'</strong></a><br><small>'+html(detail)+'</small></li>';
  }).join('');
  response.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});
  response.end('<!doctype html><html lang="de"><meta name="viewport" content="width=device-width"><title>WerkZ Testprofile</title><body><main><h1>WerkZ Testprofile</h1><p>Nicht-produktive Testinstanz.</p><ul>'+links+'</ul></main></body></html>');
}
function ensureEphemeralSession(request,response,url){
  if(!ephemeralMode||(!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/pilot/api/')))return;
  const sessionToken=cookieTokenFromHeader(request.headers.cookie);
  if(sessionToken&&authSessions[sessionToken])return;
  const manager=selectedProfile('manager');
  const existing=String(request.headers.cookie||'').replace(/(?:^|;\s*)werkz_session=[^;]*/g,'').replace(/^;\s*|;\s*$/g,'');
  request.headers.cookie=(existing?existing+'; ':'')+'werkz_session='+encodeURIComponent(manager.token);
  response.setHeader('set-cookie',sessionCookie('werkz_session',manager.token));
}

const server=http.createServer(async(request,response)=>{
  const url=new URL(request.url,'http://werkz.invalid');

  if(request.method==='GET'&&url.pathname==='/healthz'){
    response.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
    return response.end(JSON.stringify({ok:true,app:'werkz-test-stack',demoSeed:false}));
  }
  if(url.pathname==='/assistant'){
    response.writeHead(308,{location:'/assistant/'});return response.end();
  }
  if(url.pathname==='/advisor'){
    response.writeHead(308,{location:'/advisor/'});return response.end();
  }
  if(url.pathname==='/time'){
    response.writeHead(308,{location:'/time/'});return response.end();
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
      try{profile=selectedProfile(profileId)}catch{
        response.writeHead(404,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});return response.end('Unknown test profile');
      }
      response.writeHead(303,{location:returnTo,'set-cookie':sessionCookie('werkz_session',profile.token),'cache-control':'no-store'});
      return response.end();
    }
    if(ephemeralMode){
      const profile=selectedProfile('manager');
      response.writeHead(303,{location:returnTo,'set-cookie':sessionCookie('werkz_session',profile.token),'cache-control':'no-store'});
      return response.end();
    }
    return form(response,'',returnTo);
  }
  if(url.pathname==='/test-login'&&request.method==='POST'){
    const chunks=[];for await(const chunk of request)chunks.push(chunk);
    const params=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
    const location=externalFrontendUrl||safeLocalReturn(params.get('return'),'/');
    if(params.get('code')!==loginCode)return form(response,'Code ungültig.',location);
    if(testProfilesEnabled){
      response.writeHead(303,{location:'/test-profiles?return='+encodeURIComponent(location),'set-cookie':sessionCookie('werkz_test_access',profileAccessToken,3600),'cache-control':'no-store'});
      return response.end();
    }
    response.writeHead(303,{location,'set-cookie':sessionCookie('werkz_session',primarySessionToken),'cache-control':'no-store'});
    return response.end();
  }

  if(request.method==='GET'&&servePilotHtml(url,response))return;
  if(request.method==='GET'&&serveMapped(url,response,assistantFiles,assistantPwaDir))return;
  if(request.method==='GET'&&serveMapped(url,response,timeFiles,timePwaDir))return;
  if(request.method==='GET'&&serveMapped(url,response,advisorFiles,advisorPwaDir))return;

  ensureEphemeralSession(request,response,url);

  if(url.pathname.startsWith('/pilot/api/')||url.pathname.startsWith('/pilot/public/')){
    const handled=await pilotHandler(request,response);
    if(handled)return;
  }

  if(url.pathname.startsWith('/api/')){
    const apiPath=url.pathname.slice(4);
    request.url=apiPath+url.search;
    if(apiPath==='/session'||apiPath.startsWith('/time/'))return timeHandler(request,response);
    if(apiPath.startsWith('/assistant/')||apiPath.startsWith('/analytics/')||apiPath.startsWith('/simulation/'))return assistantHandler(request,response);
  }

  response.writeHead(404,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  response.end(JSON.stringify({ok:false,error:{code:'NOT_FOUND',message:'Resource not found'}}));
});

const port=Number(process.env.PORT||8080);
server.listen(port,'0.0.0.0',()=>{
  process.stdout.write(JSON.stringify({
    kind:'ready',port:server.address().port,assistant:'/',time:'/time/',advisor:'/advisor/',pilot:'/pilot/',pilotSite:'/pilot/site/',profiles:testProfilesEnabled?'/test-profiles':null,
    profileIds:testProfilesEnabled?[...testProfiles.keys()]:[],allowedOrigins,sameOriginPwa:true,unifiedLocalStack:true,
    demoSeed:false,ephemeralSecrets:ephemeralMode,testProfilesEnabled
  })+'\n');
});

module.exports={server,safeLocalReturn,testProfiles,profileAccessGranted,sessionCookie,assistantService,pilotService,servePilotHtml};
