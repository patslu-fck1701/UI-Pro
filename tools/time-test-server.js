'use strict';

const http=require('node:http'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const {EncryptedMailTokenStore,GmailOAuthReadAccess,ICloudImapReadAccess}=require('../src/pilot/mail-access');
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
  const value=crypto.randomBytes(24).toString('base64url');
  process.stdout.write(JSON.stringify({
    kind:'ephemeral-test-login',
    stableForService:false,
    note:'Non-production code regenerated on restart; value withheld from logs'
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
const primaryPilotSessionSeed=String(process.env.WERKZ_PILOT_LOGIN_CODE_SHA256||process.env.WERKZ_PILOT_LOGIN_CODE||'').trim();
const primaryPilotSessionToken=String(process.env.WERKZ_PILOT_SESSION_TOKEN||'').trim()||(primaryPilotSessionSeed?crypto.createHmac('sha256',primaryPilotSessionSeed).update('werkz-pilot-primary-session').digest('base64url'):crypto.createHmac('sha256',primarySessionToken).update('werkz-pilot-primary').digest('base64url'));
function parseExtraPilotTenants(){
  const raw=process.env.WERKZ_PILOT_TENANTS_JSON;
  if(!raw)return [];
  let list;try{list=JSON.parse(raw)}catch{throw new Error('WERKZ_PILOT_TENANTS_JSON must be valid JSON')}
  if(!Array.isArray(list))throw new Error('WERKZ_PILOT_TENANTS_JSON must be an array');
  const seen=new Set([organisationId]);
  return list.map((item,index)=>{
    if(!item||typeof item!=='object')throw new Error('pilot tenant '+index+' must be an object');
    const id=String(item.id||item.slug||'tenant-'+(index+1)).trim().replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,64);
    const aliasOfPrimary=item.aliasOfPrimary===true;
    const org=String(aliasOfPrimary?organisationId:(item.organisationId||'org-'+id)).trim().slice(0,120);
    if(!id||!org||(!aliasOfPrimary&&seen.has(org))||(aliasOfPrimary&&org!==organisationId))throw new Error('pilot tenant id/organisationId invalid or duplicate');
    if(!aliasOfPrimary)seen.add(org);
    const tenantLoginCode=String(item.loginCode||'').trim();
    const tenantLoginCodeHash=String(item.loginCodeHash||'').trim().toLowerCase();
    const explicitToken=String(item.sessionToken||'').trim();
    const stableToken=explicitToken||((tenantLoginCode||tenantLoginCodeHash)?crypto.createHmac('sha256',primaryPilotSessionToken).update('werkz-pilot-tenant:'+org+':'+(tenantLoginCode||tenantLoginCodeHash)).digest('base64url'):crypto.randomBytes(48).toString('base64url'));
    return {
      id:'tenant-'+id,organisationId:org,organisationLabel:String(item.name||item.organisationLabel||id).slice(0,160),
      actorId:String(item.actorId||'owner-'+id).slice(0,120),actorLabel:String(item.actorLabel||item.owner||item.name||id).slice(0,160),
      taxRecipient:String(item.taxRecipient||'').trim()||null,publicSlug:String(item.publicSlug||id).trim().toLowerCase().replace(/[^a-z0-9_-]/g,'-').slice(0,64),
      loginCode:tenantLoginCode||null,loginCodeHash:tenantLoginCodeHash||null,accountEmails:Array.isArray(item.accountEmails)?item.accountEmails.map(value=>String(value).trim().toLowerCase()).filter(value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)).slice(0,5):[],accessExpiresAt:String(item.accessExpiresAt||'').trim()||null,token:stableToken,role:'owner',cryptoEnabled:item.cryptoEnabled===true,ownerDemoEnabled:item.ownerDemoEnabled===true
    };
  });
}
const testAccountName=String(process.env.WERKZ_PILOT_TEST_ACCOUNT_NAME||'').trim().slice(0,160);
const testAccountEmails=String(process.env.WERKZ_PILOT_TEST_ACCOUNT_EMAILS||'').split(',').map(value=>value.trim().toLowerCase()).filter(value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)).slice(0,5);
const extraPilotTenants=parseExtraPilotTenants().map(profile=>profile.publicSlug==='tester'?{...profile,organisationLabel:testAccountName||profile.organisationLabel,actorLabel:testAccountName||profile.actorLabel,accountEmails:testAccountEmails.length?testAccountEmails:profile.accountEmails}:profile);
const loginCode=runtimeLoginCode();
const allowedOrigins=String(process.env.WERKZ_TEST_ALLOWED_ORIGINS||process.env.WERKZ_TEST_ALLOWED_ORIGIN||'https://project29212.websitepublisher.ai,http://127.0.0.1:8765').split(',').map(value=>value.trim()).filter(Boolean);
const externalFrontendUrl=process.env.WERKZ_TEST_EXTERNAL_FRONTEND_URL||'';
const ephemeralMode=process.env.WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS==='1';
const testProfilesEnabled=ephemeralMode||process.env.WERKZ_ENABLE_TEST_PROFILES==='1';
const profileAccessToken=crypto.randomBytes(32).toString('base64url');
const workerCapabilities=['time.start','time.stop','time.correct','document.upload'];
const managerCapabilities=[...workerCapabilities,'time.read.all'];
const pilotCapabilities=['pilot.read','pilot.write','market.read'];
const testProfiles=new Map([
  ['manager',{id:'manager',organisationId,organisationLabel,actorId,actorLabel,capabilities:managerCapabilities,token:primarySessionToken,role:'manager',kind:'time-manager'}]
]);
const primaryPilotProfile={id:'pilot-primary',organisationId,organisationLabel,actorId:'pilot-'+actorId,actorLabel,capabilities:pilotCapabilities,token:primaryPilotSessionToken,role:'owner',kind:'tenant',taxRecipient:process.env.WERKZ_TAX_ADVISER_EMAIL||null,publicSlug:String(process.env.WERKZ_PILOT_SLUG||'primary').toLowerCase().replace(/[^a-z0-9_-]/g,'-'),loginCode:String(process.env.WERKZ_PILOT_LOGIN_CODE||'').trim()||null,loginCodeHash:String(process.env.WERKZ_PILOT_LOGIN_CODE_SHA256||'').trim().toLowerCase()||null,accessExpiresAt:String(process.env.WERKZ_PILOT_ACCESS_EXPIRES_AT||'').trim()||null,cryptoEnabled:process.env.WERKZ_PILOT_CRYPTO_ENABLED==='1',ownerDemoEnabled:process.env.WERKZ_PILOT_OWNER_DEMO_ENABLED==='1'};
const pilotProfiles=new Map([['primary',primaryPilotProfile]]);
for(const tenant of extraPilotTenants)pilotProfiles.set(tenant.id,{...tenant,capabilities:pilotCapabilities,kind:'tenant'});
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
const authSessions=Object.fromEntries([...testProfiles.values(),...pilotProfiles.values()].map(profile=>[
  profile.token,{organisationId:profile.organisationId||organisationId,organisationLabel:profile.organisationLabel||organisationLabel,publicSlug:profile.publicSlug||null,actorId:profile.actorId,actorLabel:profile.actorLabel,accountEmails:profile.accountEmails||[],role:profile.role||'owner',capabilities:profile.capabilities}
]));
const registry=new ModuleRegistry(),entitlements=new EntitlementService({registry});
entitlements.set({organisationId,moduleId:'werkz.time',catalogVersion:'v0.2'});
const pilotOrganisationIds=[...new Set([...pilotProfiles.values()].map(p=>p.organisationId||organisationId))];
for(const org of pilotOrganisationIds)for(const moduleId of ['werkz.simple','werkz.documents','werkz.billing-prep','werkz.channel.voice','werkz.channel.gmail']){
  entitlements.set({organisationId:org,moduleId,catalogVersion:'v0.2'});
}
for(const profile of pilotProfiles.values())if(profile.cryptoEnabled===true){
  entitlements.set({organisationId:profile.organisationId,moduleId:'werkz.crypto-monitor',catalogVersion:'v0.2'});
}
const pilotTenantByOrg=new Map([...pilotProfiles.values()].map(p=>[p.organisationId||organisationId,p]));
const pilotTenantBySlug=new Map([...pilotProfiles.values()].map(p=>[p.publicSlug||p.id,p]));
function profileExpired(profile){if(!profile||!profile.accessExpiresAt)return false;const expires=Date.parse(profile.accessExpiresAt);return Number.isFinite(expires)&&Date.now()>expires}
function pilotProfileByToken(token){return token?[...pilotProfiles.values()].find(profile=>profile.token===token)||null:null}
const auth=new LocalAuthPort(authSessions);
const application=new TimeApplication(new TimeProductionService({
  auth,entitlements,repository:new FileTimeRepository(path.join(dataDir,'time.json')),
  storage:new FilePrivateEvidenceStorage(path.join(dataDir,'evidence')),
  audit:event=>process.stdout.write(JSON.stringify({kind:'audit',...event})+'\n')
}));
const timeHandler=createTimeHttpHandler({application,auth,allowedOrigins});
const pilotService=createPilotRuntime({
  auth,entitlements,dataDir:path.join(dataDir,'simple-pilot'),
  ownerDemoOrganisationIds:[...pilotProfiles.values()].filter(p=>p.cryptoEnabled===true&&p.ownerDemoEnabled===true).map(p=>p.organisationId),
  audit:event=>process.stdout.write(JSON.stringify({kind:'audit',...event})+'\\n')
});
const mailTokenKey=process.env.WERKZ_PILOT_MAIL_TOKEN_KEY||'';
const mailTokenStore=mailTokenKey?new EncryptedMailTokenStore({file:path.join(dataDir,'mail-tokens.enc.json'),key:mailTokenKey}):null;
const googleClientReady=Boolean(mailTokenStore&&process.env.GOOGLE_OAUTH_CLIENT_ID&&process.env.GOOGLE_OAUTH_CLIENT_SECRET&&process.env.WERKZ_PILOT_GMAIL_REDIRECT_URI);
const gmailPending=new Map();
function mailEmail(value,domain){const email=String(value||'').trim().toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&(!domain||email.endsWith(domain))?email:null}
function gmailFor(profile,email){if(!googleClientReady||!email)return null;return new GmailOAuthReadAccess({organisationId:profile.organisationId,accountEmail:email,clientId:process.env.GOOGLE_OAUTH_CLIENT_ID,clientSecret:process.env.GOOGLE_OAUTH_CLIENT_SECRET,redirectUri:process.env.WERKZ_PILOT_GMAIL_REDIRECT_URI,tokenStore:mailTokenStore})}
function icloudFor(profile){const row=mailTokenStore?.get(profile.organisationId+':icloud');return row?.email&&row?.appPassword?new ICloudImapReadAccess({organisationId:profile.organisationId,accountEmail:row.email,appPassword:row.appPassword}):null}
const exampleMailProvider=pilotService.mail;
pilotService.mail={async listRelevant({organisationId}){
  const profile=pilotTenantByOrg.get(organisationId);
  if(!profile)return [];
  const gmailRow=mailTokenStore?.get(organisationId);
  const gmail=gmailFor(profile,gmailRow?.email),icloud=icloudFor(profile),results=[];
  if(gmail&&gmail.status({organisationId}).connected)results.push(...await gmail.listRelevant({organisationId}));
  if(icloud)results.push(...await icloud.listRelevant({organisationId}));
  if(!gmail&&!icloud&&!profile.accountEmails?.length)return exampleMailProvider.listRelevant({organisationId});
  return results.sort((a,b)=>String(b.receivedAt||'').localeCompare(String(a.receivedAt||'')));
}};
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
function pilotReturnWithTenant(value,tenant){
  const safe=safeLocalReturn(value,'/pilot/');
  try{
    const u=new URL(safe,'http://werkz.invalid');
    if(u.pathname.startsWith('/pilot'))u.searchParams.set('tenant',String(tenant||'').trim().toLowerCase());
    return u.pathname+u.search;
  }catch{return safe;}
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
const PILOT_SESSION_MAX_AGE=60*60*24*180;
const PILOT_FACE_URL='https://cdn.websitepublisher.ai/custom/wid23947/images/werkz/founder-point.jpg';
const PILOT_LOGO_URL='https://cdn.websitepublisher.ai/custom/wid23947/images/werkz/logo-wide.jpg';
function sessionCookie(name,value,maxAge=28800){
  return name+'='+encodeURIComponent(value)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge;
}
function sameSecret(a,b){
  const left=crypto.createHash('sha256').update(String(a||'')).digest();
  const right=crypto.createHash('sha256').update(String(b||'')).digest();
  return crypto.timingSafeEqual(left,right);
}
function normalisePilotAccessCode(value){
  return String(value||'').trim().replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,'').toUpperCase();
}

function pilotLoginForm(response,{message='',returnTo='/pilot/',tenant='' }={}){
  response.writeHead(message?401:200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});
  response.end('<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#25292a"><link rel="icon" href="'+PILOT_FACE_URL+'"><link rel="apple-touch-icon" href="'+PILOT_FACE_URL+'"><title>WERKZ – SCHROTTIES</title><style>*{box-sizing:border-box}body{margin:0;background:#e9e6de;color:#222;font-family:Arial,Helvetica,sans-serif;min-height:100vh;padding:22px 14px}.shell{max-width:560px;margin:12px auto}.hero{position:relative;min-height:210px;margin-bottom:-46px;z-index:2}.wordmark{display:block;width:min(72%,390px);max-height:132px;object-fit:contain;object-position:left center;filter:drop-shadow(0 6px 12px rgba(0,0,0,.12))}.face{position:absolute;right:-8px;top:0;width:190px;height:190px;object-fit:cover;border-radius:30px;border:5px solid #f8f6f1;box-shadow:0 14px 32px rgba(0,0,0,.25);transform:rotate(2deg)}.card{position:relative;background:#f8f6f1;border:1px solid #d8d4ca;border-radius:28px;padding:70px 28px 28px;box-shadow:0 12px 36px rgba(28,28,28,.10)}h1{font-size:clamp(38px,10vw,58px);line-height:.98;margin:0 0 26px;letter-spacing:-.035em}.sub{font-size:25px;font-weight:800;margin:0 0 22px}.error{color:#915f5f;font-size:22px;font-weight:900;margin:0 0 18px}label{display:block;font-size:22px;font-weight:800;margin:16px 0 0}input{display:block;width:100%;margin-top:7px;border:1px solid #d0cec8;border-radius:13px;background:#fff;padding:15px 16px;font-size:22px;min-height:62px;outline:none}input:focus{border-color:#4b7259;box-shadow:0 0 0 3px rgba(63,116,80,.14)}.code-row{position:relative}.code-row input{padding-right:138px}.show-code{position:absolute;right:8px;top:14px;width:auto;min-height:46px;margin:0;padding:0 13px;border:1px solid #b9b5ad;border-radius:10px;background:#ece8df;color:#303638;font-size:14px;font-weight:900;letter-spacing:0}.submit{width:100%;margin-top:24px;min-height:68px;border:0;border-radius:14px;background:#303638;color:#fff;font-size:24px;font-weight:1000;letter-spacing:.025em}.remember{margin:15px 2px 0;color:#625f59;font-size:15px;font-weight:700}.footer{text-align:center;color:#6f6b64;font-size:13px;font-weight:700;margin:18px 0}@media(max-width:480px){body{padding:12px}.hero{min-height:172px;margin-bottom:-37px}.wordmark{width:70%;max-height:105px}.face{width:152px;height:152px;border-radius:25px}.card{padding:59px 20px 23px;border-radius:24px}h1{font-size:41px}.sub{font-size:22px}}</style></head><body><main class="shell"><div class="hero"><img class="wordmark" src="'+PILOT_LOGO_URL+'" alt="WerkZ – Digitale Lösungen für Betriebe"><img class="face" src="'+PILOT_FACE_URL+'" alt="WerkZ Ansprechpartner"></div><section class="card"><h1>WERKZ –<br>SCHROTTIES</h1><p class="sub">Dein Betriebszugang</p>'+(message?'<p class="error">'+html(message)+'</p>':'')+'<form method="post" action="/pilot/login"><input type="hidden" name="return" value="'+html(returnTo)+'"><label>Betrieb<input name="tenant" value="'+html(tenant)+'" autocomplete="username" required autocapitalize="none"></label><label for="pilotCode">Zugangscode</label><div class="code-row"><input id="pilotCode" name="code" type="password" autocomplete="current-password" required autocapitalize="characters" spellcheck="false"><button id="togglePilotCode" class="show-code" type="button" aria-pressed="false">Anzeigen</button></div><button class="submit" type="submit">ANMELDEN</button></form><p class="remember">Einmal anmelden – dieses Gerät bleibt anschließend angemeldet.</p><script>(function(){var i=document.getElementById("pilotCode"),b=document.getElementById("togglePilotCode");if(!i||!b)return;b.addEventListener("click",function(){var show=i.type==="password";i.type=show?"text":"password";b.textContent=show?"Verbergen":"Anzeigen";b.setAttribute("aria-pressed",show?"true":"false")})})();</script></section><p class="footer">WerkZ · Digitale Lösungen für Betriebe</p></main></body></html>');
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
    const requestedTenant=String(url.searchParams.get('tenant')||'').trim().toLowerCase();
    const activeToken=cookieTokenFromHeader(request.headers.cookie),activeProfile=pilotProfileByToken(activeToken);
    const activeSlug=String(activeProfile?.publicSlug||'').trim().toLowerCase();
    if(activeProfile&&!profileExpired(activeProfile)&&(!requestedTenant||requestedTenant===activeSlug)){
      response.writeHead(303,{location:pilotReturnWithTenant(returnTo,activeSlug||requestedTenant),'cache-control':'no-store'});
      return response.end();
    }
    if(activeProfile&&requestedTenant&&requestedTenant!==activeSlug){
      response.setHeader('set-cookie',sessionCookie('werkz_session','',0));
    }
    const tenant=requestedTenant||activeSlug||'';
    return pilotLoginForm(response,{returnTo,tenant});
  }
  if(url.pathname==='/pilot/login'&&request.method==='POST'){
    const chunks=[];for await(const chunk of request)chunks.push(chunk);
    const params=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
    const returnTo=safeLocalReturn(params.get('return'),'/pilot/');
    const tenant=String(params.get('tenant')||'').trim().toLowerCase();
    const code=normalisePilotAccessCode(params.get('code'));
    const profile=pilotTenantBySlug.get(tenant);
    const expectedHash=profile?.loginCodeHash||null;
    const expectedRaw=profile?.loginCode||(profile?.id==='pilot-primary'&&!expectedHash&&testProfilesEnabled?loginCode:null);
    const expected=normalisePilotAccessCode(expectedRaw);
    const expired=profileExpired(profile);
    const submittedHash=crypto.createHash('sha256').update(code).digest('hex');
    const valid=Boolean(profile&&!expired&&(expectedHash?sameSecret(submittedHash,expectedHash):(expected&&sameSecret(code,expected))));
    process.stdout.write(JSON.stringify({kind:'pilot-login',tenant,profileFound:Boolean(profile),expired,success:valid})+'\\n');
    if(!valid){
      const message=!profile?'Betrieb nicht gefunden.':expired?'Testzugang ist abgelaufen.':'Zugangscode falsch.';
      return pilotLoginForm(response,{message,returnTo,tenant});
    }
    response.writeHead(303,{location:pilotReturnWithTenant(returnTo,tenant),'set-cookie':sessionCookie('werkz_session',profile.token,PILOT_SESSION_MAX_AGE),'cache-control':'no-store'});
    return response.end();
  }
  if(url.pathname==='/pilot/logout'&&request.method==='GET'){
    const activeProfile=pilotProfileByToken(cookieTokenFromHeader(request.headers.cookie));
    const activeSlug=String(activeProfile?.publicSlug||'').trim().toLowerCase();
    const location=activeSlug?'/pilot/login?tenant='+encodeURIComponent(activeSlug):'/pilot/login';
    response.writeHead(303,{location,'set-cookie':sessionCookie('werkz_session','',0),'cache-control':'no-store'});
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
  if(url.pathname.startsWith('/pilot/api/')){
    const profile=pilotProfileByToken(cookieTokenFromHeader(request.headers.cookie));
    if(profile&&profileExpired(profile)){
      response.writeHead(401,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','set-cookie':sessionCookie('werkz_session','',0)});
      return response.end(JSON.stringify({error:'ACCESS_EXPIRED',message:'Testzugang ist abgelaufen.'}));
    }
  }
  if(url.pathname==='/pilot/api/mail/status'||url.pathname==='/pilot/mail/google/connect'||url.pathname==='/pilot/mail/google/callback'||url.pathname==='/pilot/api/mail/google/disconnect'||url.pathname==='/pilot/api/mail/icloud/connect'||url.pathname==='/pilot/api/mail/icloud/disconnect'){
    const token=cookieTokenFromHeader(request.headers.cookie);
    const profile=[...pilotProfiles.values()].find(p=>p.token===token);
    const session=token&&authSessions[token];
    if(!profile||!session||profileExpired(profile)){
      response.writeHead(401,{'content-type':'application/json','cache-control':'no-store'});
      return response.end(JSON.stringify({error:'Anmeldung erforderlich'}));
    }
    const json=(status,value)=>{response.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify(value))};
    const safePost=()=>{if(request.headers.origin!==('https://'+request.headers.host))throw Object.assign(new Error('Origin denied'),{code:'FORBIDDEN'})};
    const readPost=async()=>{const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>4096)throw Object.assign(new Error('Too large'),{code:'VALIDATION_ERROR'});chunks.push(chunk)}return JSON.parse(Buffer.concat(chunks).toString('utf8'))};
    try{
      const org=profile.organisationId,storedGmail=mailTokenStore?.get(org),storedIcloud=mailTokenStore?.get(org+':icloud');
      if(url.pathname==='/pilot/api/mail/status'&&request.method==='GET')return json(200,{gmail:{email:storedGmail?.email||profile.accountEmails?.find(x=>x.endsWith('@gmail.com'))||null,configured:googleClientReady,connected:Boolean(storedGmail?.refreshToken)},icloud:{email:storedIcloud?.email||profile.accountEmails?.find(x=>x.endsWith('@icloud.com'))||null,configured:Boolean(mailTokenStore),connected:Boolean(storedIcloud?.appPassword)},readOnly:true});
      if(url.pathname==='/pilot/mail/google/connect'&&request.method==='GET'){
        if(!googleClientReady)return json(503,{error:'Google OAuth ist noch nicht konfiguriert'});
        const address=mailEmail(url.searchParams.get('email')||storedGmail?.email||profile.accountEmails?.find(x=>x.endsWith('@gmail.com')));
        if(!address)return json(400,{error:'Gültige Gmail-Adresse erforderlich'});
        const access=gmailFor(profile,address);gmailPending.set(org,access);
        response.writeHead(303,{location:access.begin(session),'cache-control':'no-store'});return response.end();
      }
      if(url.pathname==='/pilot/mail/google/callback'&&request.method==='GET'){
        if(url.searchParams.has('error'))return json(400,{error:'Google-Anmeldung abgebrochen'});
        const access=gmailPending.get(org);if(!access)return json(400,{error:'Anmeldung abgelaufen; bitte erneut starten'});
        try{await access.finish(session,{state:url.searchParams.get('state'),code:url.searchParams.get('code')})}finally{gmailPending.delete(org)}
        response.writeHead(303,{location:'/pilot/?mail=connected','cache-control':'no-store'});return response.end();
      }
      if(url.pathname==='/pilot/api/mail/google/disconnect'&&request.method==='POST'){
        safePost();mailTokenStore?.remove(org);gmailPending.delete(org);return json(200,{connected:false});
      }
      if(url.pathname==='/pilot/api/mail/icloud/connect'&&request.method==='POST'){
        safePost();if(!mailTokenStore)return json(503,{error:'Verschlüsselter Speicher nicht konfiguriert'});
        const body=await readPost(),address=mailEmail(body.email,'@icloud.com'),password=String(body.appPassword||'').trim();
        if(!address||password.length<10||password.length>128)return json(400,{error:'iCloud-Adresse und Apple-App-Passwort erforderlich'});
        const access=new ICloudImapReadAccess({organisationId:org,accountEmail:address,appPassword:password});
        await access.listRelevant({organisationId:org});
        mailTokenStore.set(org+':icloud',{email:address,appPassword:password});
        return json(200,{connected:true,email:address,readOnly:true});
      }
      if(url.pathname==='/pilot/api/mail/icloud/disconnect'&&request.method==='POST'){
        safePost();mailTokenStore?.remove(org+':icloud');return json(200,{connected:false});
      }
    }catch(error){process.stderr.write(JSON.stringify({kind:'mail-access-error',code:error.code||'MAIL_ERROR'})+'\\n');return json(400,{error:'Postfach-Verbindung fehlgeschlagen',code:error.code||'MAIL_ERROR'})}
    return json(405,{error:'Methode nicht erlaubt'});
  }
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
  profileIds:testProfilesEnabled?[...testProfiles.keys()]:[],pilotTenantSlugs:[...pilotTenantBySlug.keys()],allowedOrigins,sameOriginPwa:true,unifiedLocalStack:true,
  ephemeralSecrets:ephemeralMode,testProfilesEnabled
})+'\n')});

module.exports={server,safeLocalReturn,serveDemoHub,servePilot,servePilotSite,testProfiles,profileAccessGranted,sessionCookie};
