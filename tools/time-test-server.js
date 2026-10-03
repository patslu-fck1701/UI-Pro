'use strict';

const http=require('node:http'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const {ModuleRegistry,EntitlementService,LocalAuthPort,FileTimeRepository,FilePrivateEvidenceStorage,TimeProductionService,TimeApplication,createTimeHttpHandler,createPilotRuntime,createPilotHttpHandler}=require('../src');

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
const pilotDir=path.resolve(__dirname,'../apps/simple-pilot');
const pilotSiteDir=path.resolve(__dirname,'../apps/simple-site');
const organisationId=process.env.WERKZ_TEST_ORGANISATION_ID||'org-device-test';
const organisationLabel=process.env.WERKZ_PILOT_BUSINESS_NAME||process.env.WERKZ_TEST_ORGANISATION_LABEL||'Pilotbetrieb';
const actorId=process.env.WERKZ_TEST_ACTOR_ID||'manager-device-test';
const actorLabel=process.env.WERKZ_TEST_ACTOR_LABEL||'Manager';
const primarySessionToken=runtimeSecret('WERKZ_TEST_SESSION_TOKEN',48);
function parseExtraPilotTenants(){
  const raw=process.env.WERKZ_PILOT_TENANTS_JSON;
  if(!raw)return [];
  let list;try{list=JSON.parse(raw)}catch{throw new Error('WERKZ_PILOT_TENANTS_JSON must be valid JSON')}
  if(!Array.isArray(list))throw new Error('WERKZ_PILOT_TENANTS_JSON must be an array');
  const seen=new Set([organisationId]);
  return list.map((item,index)=>{
    if(!item||typeof item!=='object')throw new Error('pilot tenant '+index+' must be an object');
    const id=String(item.id||item.slug||'tenant-'+(index+1)).trim().replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,64);
    const org=String(item.organisationId||'org-'+id).trim().slice(0,120);
    if(!id||!org||seen.has(org))throw new Error('pilot tenant id/organisationId invalid or duplicate');
    seen.add(org);
    const tenantLoginCode=String(item.loginCode||'').trim();
    const explicitToken=String(item.sessionToken||'').trim();
    const stableToken=explicitToken||(tenantLoginCode?crypto.createHmac('sha256',primarySessionToken).update('werkz-pilot-tenant:'+org+':'+tenantLoginCode).digest('base64url'):crypto.randomBytes(48).toString('base64url'));
    return {id:'tenant-'+id,organisationId:org,organisationLabel:String(item.name||item.organisationLabel||id).slice(0,160),
      actorId:String(item.actorId||'owner-'+id).slice(0,120),actorLabel:String(item.actorLabel||item.owner||item.name||id).slice(0,160),
      taxRecipient:String(item.taxRecipient||'').trim()||null,publicSlug:String(item.publicSlug||id).trim().toLowerCase().replace(/[^a-z0-9_-]/g,'-').slice(0,64),
      loginCode:tenantLoginCode||null,token:stableToken,role:'owner'};
  });
}
const extraPilotTenants=parseExtraPilotTenants();
const loginCode=runtimeLoginCode();
const allowedOrigins=String(process.env.WERKZ_TEST_ALLOWED_ORIGINS||process.env.WERKZ_TEST_ALLOWED_ORIGIN||'https://project29212.websitepublisher.ai,http://127.0.0.1:8765').split(',').map(value=>value.trim()).filter(Boolean);
const externalFrontendUrl=process.env.WERKZ_TEST_EXTERNAL_FRONTEND_URL||'';
const ephemeralMode=process.env.WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS==='1';
const testProfilesEnabled=ephemeralMode||process.env.WERKZ_ENABLE_TEST_PROFILES==='1';
const profileAccessToken=crypto.randomBytes(32).toString('base64url');
const workerCapabilities=['time.start','time.stop','time.correct','document.upload'];
const managerCapabilities=[...workerCapabilities,'time.read.all','pilot.read','pilot.write','market.read'];
const testProfiles=new Map([
  ['manager',{id:'manager',organisationId,organisationLabel,actorId,actorLabel,capabilities:managerCapabilities,token:primarySessionToken,role:'owner',kind:'tenant',taxRecipient:process.env.WERKZ_TAX_ADVISER_EMAIL||null,publicSlug:String(process.env.WERKZ_PILOT_SLUG||'primary').toLowerCase().replace(/[^a-z0-9_-]/g,'-'),loginCode:String(process.env.WERKZ_PILOT_LOGIN_CODE||'').trim()||null}]
]);
for(const tenant of extraPilotTenants)testProfiles.set(tenant.id,{...tenant,capabilities:['pilot.read','pilot.write','market.read'],kind:'tenant'});
if(testProfilesEnabled){
  testProfiles.set('worker-a',{
    id:'worker-a',organisationId,organisationLabel,actorId:'worker-a',actorLabel:process.env.WERKZ_TEST_WORKER_A_LABEL||'Mitarbeiter A',
    capabilities:workerCapabilities,token:crypto.randomBytes(48).toString('base64url'),role:'worker',kind:'time-worker'
  });
  testProfiles.set('worker-b',{
    id:'worker-b',organisationId,organisationLabel,actorId:'worker-b',actorLabel:process.env.WERKZ_TEST_WORKER_B_LABEL||'Mitarbeiter B',
    capabilities:workerCapabilities,token:crypto.randomBytes(48).toString('base64url'),role:'worker',kind:'time-worker'
  });
}
const authSessions=Object.fromEntries([...testProfiles.values()].map(profile=>[
  profile.token,{organisationId:profile.organisationId||organisationId,organisationLabel:profile.organisationLabel||organisationLabel,actorId:profile.actorId,actorLabel:profile.actorLabel,role:profile.role||'owner',capabilities:profile.capabilities}
]));
const registry=new ModuleRegistry(),entitlements=new EntitlementService({registry});
entitlements.set({organisationId,moduleId:'werkz.time',catalogVersion:'v0.2'});
const pilotOrganisationIds=[...new Set([...testProfiles.values()].filter(p=>p.kind==='tenant').map(p=>p.organisationId||organisationId))];
for(const org of pilotOrganisationIds)for(const moduleId of ['werkz.simple','werkz.documents','werkz.billing-prep','werkz.channel.voice','werkz.channel.gmail','werkz.crypto-monitor']){
  entitlements.set({organisationId:org,moduleId,catalogVersion:'v0.2'});
}
const pilotTenantByOrg=new Map([...testProfiles.values()].filter(p=>p.kind==='tenant').map(p=>[p.organisationId||organisationId,p]));
const pilotTenantBySlug=new Map([...testProfiles.values()].filter(p=>p.kind==='tenant').map(p=>[p.publicSlug||p.id,p]));
const auth=new LocalAuthPort(authSessions);
const application=new TimeApplication(new TimeProductionService({
  auth,entitlements,repository:new FileTimeRepository(path.join(dataDir,'time.json')),
  storage:new FilePrivateEvidenceStorage(path.join(dataDir,'evidence')),
  audit:event=>process.stdout.write(JSON.stringify({kind:'audit',...event})+'\n')
}));
const timeHandler=createTimeHttpHandler({application,auth,allowedOrigins});
const pilotService=createPilotRuntime({
  auth,entitlements,dataDir:path.join(dataDir,'simple-pilot'),
  audit:event=>process.stdout.write(JSON.stringify({kind:'audit',...event})+'\\n')
});
const pilotHandler=createPilotHttpHandler({
  service:pilotService,
  defaultTaxRecipient:process.env.WERKZ_TAX_ADVISER_EMAIL||'steuerberater@example.invalid',
  taxRecipientResolver:org=>pilotTenantByOrg.get(org)?.taxRecipient||process.env.WERKZ_TAX_ADVISER_EMAIL||'steuerberater@example.invalid',
  publicOrganisationId:organisationId,
  publicOrganisationResolver:({url})=>{const slug=url.searchParams.get('tenant');if(!slug)return organisationId;return pilotTenantBySlug.get(String(slug).toLowerCase())?.organisationId||null}
});

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

function servePilotReference(url,response){
  const targets={
    '/pilot/crypto-lab':'https://project23947.websitepublisher.ai/crypto-lab.html',
    '/pilot/crypto-simulation':'https://project23947.websitepublisher.ai/werkz-analyse-simulation.html'
  };
  const target=targets[url.pathname];
  if(!target)return false;
  response.writeHead(302,{location:target,'cache-control':'no-store'});response.end();return true;
}

function servePilotSite(url,response){
  if(url.pathname==='/pilot/site'){
    response.writeHead(308,{location:'/pilot/site/'});response.end();return true;
  }
  if(url.pathname!=='/pilot/site/'&&url.pathname!=='/pilot/site/index.html')return false;
  const candidate=path.join(pilotSiteDir,'index.html');
  if(!fs.existsSync(candidate))return false;
  response.setHeader('x-content-type-options','nosniff');
  response.setHeader('referrer-policy','no-referrer');
  response.setHeader('cache-control','no-store');
  response.writeHead(200,{'content-type':'text/html; charset=utf-8'});
  response.end(fs.readFileSync(candidate));return true;
}

function servePilot(url,response){
  if(url.pathname==='/pilot'){
    response.writeHead(308,{location:'/pilot/'});response.end();return true;
  }
  const files={
    '/pilot/':'index.html',
    '/pilot/index.html':'index.html',
    '/pilot/sw.js':'sw.js',
    '/pilot/manifest.webmanifest':'manifest.webmanifest',
    '/pilot/icon.svg':'icon.svg'
  };
  const file=files[url.pathname];
  if(!file)return false;
  const candidate=path.join(pilotDir,file);
  if(!fs.existsSync(candidate))return false;
  response.setHeader('x-content-type-options','nosniff');
  response.setHeader('referrer-policy','no-referrer');
  response.setHeader('cache-control',file==='sw.js'?'no-cache':file==='index.html'?'no-store':'public, max-age=300');
  response.writeHead(200,{'content-type':contentTypes[path.extname(file)]||'application/octet-stream'});
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
function sameSecret(a,b){
  const left=crypto.createHash('sha256').update(String(a||'')).digest();
  const right=crypto.createHash('sha256').update(String(b||'')).digest();
  return crypto.timingSafeEqual(left,right);
}
function pilotLoginForm(response,{message='',returnTo='/pilot/',tenant='' }={}){
  response.writeHead(message?401:200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});
  response.end('<!doctype html><html lang="de"><meta name="viewport" content="width=device-width"><title>WERKZ – SCHROTTIES</title><body style="font-family:system-ui;background:#e9e6de;color:#232323"><main style="max-width:440px;margin:40px auto;padding:22px;background:#f8f6f1;border-radius:16px"><h1>WERKZ – SCHROTTIES</h1><p>Dein Betriebszugang</p>'+(message?'<p style="color:#8b5558;font-weight:800">'+html(message)+'</p>':'')+'<form method="post" action="/pilot/login"><input type="hidden" name="return" value="'+html(returnTo)+'"><label style="display:block;margin:12px 0">Betrieb<input name="tenant" value="'+html(tenant)+'" autocomplete="username" required style="box-sizing:border-box;width:100%;font-size:20px;padding:12px;margin-top:5px"></label><label style="display:block;margin:12px 0">Zugangscode<input name="code" type="password" autocomplete="current-password" required style="box-sizing:border-box;width:100%;font-size:20px;padding:12px;margin-top:5px"></label><button style="width:100%;font-size:20px;font-weight:800;padding:13px">ANMELDEN</button></form></main></body></html>');
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
    const detail=profile.kind==='tenant'?((profile.organisationLabel||profile.organisationId)+' · eigener Betrieb · vollständig getrennte Daten'):(profile.role==='manager'?'Chefansicht · sieht organisationsweite Testzeiten':'Mitarbeiteransicht · sieht nur eigene Testzeiten');
    return '<li><a href="'+html(target)+'"><strong>'+html(profile.actorLabel)+'</strong></a><br><small>'+html(detail)+'</small></li>';
  }).join('');
  response.writeHead(200,{
    'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'
  });
  response.end('<!doctype html><html lang="de"><meta name="viewport" content="width=device-width"><title>WerkZ Testprofile</title><body><main><h1>WerkZ Testprofile</h1><p>Nur für die nicht-produktive WerkZ-Testinstanz.</p><ul>'+links+'</ul></main></body></html>');
}

const server=http.createServer(async(request,response)=>{
  const url=new URL(request.url,'http://werkz.invalid');
  if(request.method==='GET'&&url.pathname==='/pilot/crypto-lab'){
    response.writeHead(302,{location:'https://project23947.websitepublisher.ai/crypto-lab.html','cache-control':'no-store'});
    return response.end();
  }
  if(request.method==='GET'&&url.pathname==='/pilot/crypto-simulation'){
    response.writeHead(302,{location:'https://project23947.websitepublisher.ai/werkz-analyse-simulation.html','cache-control':'no-store'});
    return response.end();
  }
  if(request.method==='GET'&&url.pathname==='/healthz'){
    let writable=true,error=null;
    try{fs.mkdirSync(dataDir,{recursive:true});fs.accessSync(dataDir,fs.constants.W_OK)}
    catch(e){writable=false;error='storage-unavailable'}
    response.writeHead(writable?200:503,{'content-type':'application/json','cache-control':'no-store'});
    return response.end(JSON.stringify({ok:writable,storageWritable:writable,error}));
  }
  if(url.pathname==='/pilot/login'&&request.method==='GET'){
    const returnTo=safeLocalReturn(url.searchParams.get('return'),'/pilot/');
    const tenant=String(url.searchParams.get('tenant')||'').trim().toLowerCase();
    return pilotLoginForm(response,{returnTo,tenant});
  }
  if(url.pathname==='/pilot/login'&&request.method==='POST'){
    const chunks=[];for await(const chunk of request)chunks.push(chunk);
    const params=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
    const returnTo=safeLocalReturn(params.get('return'),'/pilot/');
    const tenant=String(params.get('tenant')||'').trim().toLowerCase();
    const code=String(params.get('code')||'');
    const profile=pilotTenantBySlug.get(tenant);
    const expected=profile?.loginCode||(profile?.id==='manager'&&testProfilesEnabled?loginCode:null);
    if(!profile||!expected||!sameSecret(code,expected))return pilotLoginForm(response,{message:'Anmeldung nicht möglich.',returnTo,tenant});
    response.writeHead(303,{location:returnTo,'set-cookie':sessionCookie('werkz_session',profile.token,60*60*24*60),'cache-control':'no-store'});
    return response.end();
  }
  if(url.pathname==='/pilot/logout'&&request.method==='GET'){
    response.writeHead(303,{location:'/pilot/login','set-cookie':sessionCookie('werkz_session','',0),'cache-control':'no-store'});
    return response.end();
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
  if(request.method==='GET'&&servePilotReference(url,response))return;
  if(request.method==='GET'&&servePilotSite(url,response))return;
  if(request.method==='GET'&&servePilot(url,response))return;
  if(request.method==='GET'&&serveDemoHub(url,response))return;
  if(request.method==='GET'&&serveStatic(url,response))return;
  if(url.pathname.startsWith('/pilot/api/')||url.pathname.startsWith('/pilot/public/')){
    const handled=await pilotHandler(request,response);
    if(handled)return;
  }
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
  kind:'ready',port:actualPort,hub:'/hub/',time:'/',pilot:'/pilot/',pilotSite:'/pilot/site/',profiles:testProfilesEnabled?'/test-profiles':null,
  profileIds:testProfilesEnabled?[...testProfiles.keys()]:[],allowedOrigins,sameOriginPwa:true,unifiedLocalStack:true,
  ephemeralSecrets:ephemeralMode,testProfilesEnabled
})+'\n')});

module.exports={server,safeLocalReturn,serveDemoHub,servePilot,servePilotSite,testProfiles,profileAccessGranted,sessionCookie};
