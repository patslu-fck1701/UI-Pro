'use strict';

const crypto=require('node:crypto');
const {emptyState,validateState}=require('../persistence/postgres');
const {HandwerkAccounts}=require('../security/handwerk-accounts');
const {hashPassword}=require('../security/passwords');
const {HandwerkService}=require('./service');
const {createHandwerkHandler}=require('./http');

const PROFILES=[['owner','Chef / Inhaber','Betrieb überblicken, Aufträge verteilen und Freigaben prüfen.'],['office','Büro','Kunden pflegen und Aufträge vorbereiten.'],['dispatch','Disposition','Einsätze planen und Mitarbeitende einteilen.'],['technician','Monteur','Zugewiesene Einsätze, Arbeitszeiten, Material und Berichte.'],['accounting','Buchhaltung','Abgeschlossene Arbeiten und Abrechnungsunterlagen prüfen.']];
const TTL=2*60*60*1000;
function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(part=>part.trim().split('=')).filter(pair=>pair.length===2));}
function send(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(value));}
function demoCookie(req,value,age=7200){const local=/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host||'');return 'werkz_demo='+value+'; Path=/; HttpOnly; SameSite=Strict;'+(local?'':' Secure;')+' Max-Age='+age;}
async function read(req){let size=0;const parts=[];for await(const part of req){size+=part.length;if(size>16384)throw Error('Anfrage zu groß');parts.push(part);}const raw=Buffer.concat(parts).toString('utf8');return String(req.headers['content-type']||'').startsWith('application/json')?JSON.parse(raw):Object.fromEntries(new URLSearchParams(raw));}

class DemoStore{
  constructor(org){this.org=org;this.state=emptyState();this.queue=Promise.resolve();}
  async withTenant(org,work,{write=true}={}){
    if(org!==this.org)throw Error('Demo tenant mismatch');
    const task=this.queue.then(async()=>{const next=structuredClone(this.state);const result=await work(next);validateState(org,next);if(write){if(JSON.stringify(next).length>1000000)throw Object.assign(Error('Demo voll. Bitte neu starten.'),{code:'VALIDATION_ERROR'});this.state=next;}return result;});
    this.queue=task.catch(()=>{});return task;
  }
}

async function createWorkspace(clock=()=>new Date()){
  const org='org-werkz-synthetic-demo-'+crypto.randomUUID(),store=new DemoStore(org),sessions=new Map();
  const password=crypto.randomBytes(24).toString('hex'),passwordRecord=hashPassword(password);
  const sessionStore={async create(profile,version){const id=crypto.randomBytes(32).toString('hex');sessions.set(id,{organisation_id:org,profile_id:profile.id,credential_version:version});return id;},async resolve(id){return sessions.get(id)||null;},async revoke(id){sessions.delete(id);}};
  const accounts=new HandwerkAccounts({store,sessions:sessionStore,clock});
  const users=await accounts.seedTestUsers(org,PROFILES.map(([role,label])=>({username:'demo-'+role,name:'SYNTHETISCH · '+label,roles:[role],password:passwordRecord,expiresAt:new Date(clock().getTime()+TTL).toISOString()})));
  await store.withTenant(org,state=>{for(const user of state.pilot.users)user.deniedCapabilities=['user.manage','role.manage','integration.manage','invoice.send','automation.manage'];});
  const service=new HandwerkService({store,clock});
  const owner=users.find(user=>user.roles.includes('owner')),worker=users.find(user=>user.roles.includes('technician'));
  let serial=0;const command=(actor,operation,input)=>service.command(actor,operation,{...input,idempotencyKey:'seed-'+(++serial)});
  const customer=await command(owner,'customer.create',{name:'SYNTHETISCH · Musterbetrieb',contact:'Demoanschrift · keine echten Kontaktdaten'});
  const today=new Date(clock());today.setHours(10,0,0,0);
  const order=await command(owner,'order.create',{customerId:customer.id,title:'SYNTHETISCH · Wartung Heizungsanlage',location:'Demo-Baustelle A',description:'Anlage prüfen, Material dokumentieren und Einsatzbericht erstellen.',appointmentAt:today.toISOString()});
  await command(owner,'order.assign',{orderId:order.id,userId:worker.id,expectedRevision:order.revision});
  const done=await command(owner,'order.create',{customerId:customer.id,title:'SYNTHETISCH · Armatur erneuert',location:'Demo-Baustelle B',description:'Abgeschlossener Beispielauftrag für die Abrechnung.'});
  await command(owner,'order.assign',{orderId:done.id,userId:worker.id,expectedRevision:done.revision});
  const timer=await command(worker,'time.start',{orderId:done.id});await command(worker,'time.stop',{timerId:timer.id});
  await command(worker,'order.report',{orderId:done.id,kind:'material',text:'SYNTHETISCH · 1 Armatur und 2 Dichtungen verwendet.'});
  await command(worker,'order.report',{orderId:done.id,kind:'note',text:'SYNTHETISCH · Montage und Funktionsprüfung abgeschlossen.'});
  await command(worker,'order.complete',{orderId:done.id});
  await command(owner,'billing.prepare',{orderId:done.id});
  await store.withTenant(org,state=>{const time=state.time.records[timer.id];time.startedAt=new Date(clock().getTime()-90*60000).toISOString();time.endedAt=clock().toISOString();});
  const handler=createHandwerkHandler({accounts,service,organisationId:org,slug:'demo'});
  return {org,store,accounts,service,handler,password,expires:clock().getTime()+TTL,role:'owner',tokens:new Map()};
}

function createPublicDemo({clock=()=>new Date(),capacity=40}={}){
  const workspaces=new Map();let creating=0;
  return async(req,res)=>{
    const pathname=new URL(req.url,'http://demo.invalid').pathname;
    const id=cookies(req).werkz_demo;let workspace=workspaces.get(id);
    for(const [key,value] of workspaces)if(value.expires<=clock().getTime())workspaces.delete(key);
    if(workspace?.expires<=clock().getTime())workspace=null;
    const action=pathname==='/handwerk/demo/start'||pathname==='/handwerk/demo/reset';
    if(!action&&!id)return false;
    if(!action&&!pathname.startsWith('/handwerk/api/')&&pathname!=='/handwerk/logout')return false;
    try{
      if(req.method==='POST'){
        const local=/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host||'');
        if(req.headers.origin!==(local?'http://':'https://')+req.headers.host){send(res,403,{error:'FORBIDDEN'});return true;}
      }
      if(action){
        if(req.method!=='POST'){send(res,405,{error:'METHOD_NOT_ALLOWED'});return true;}
        const input=await read(req),role=String(input.role||'owner');
        if(!PROFILES.some(([value])=>value===role)){send(res,400,{error:'INVALID_PROFILE'});return true;}
        let nextId=id;
        if(pathname.endsWith('/reset')||!workspace){
          if(workspaces.size+creating>=capacity){send(res,503,{error:'DEMO_BUSY',message:'Die Vorführung ist gerade ausgelastet. Bitte später erneut versuchen.'});return true;}
          creating++;try{workspace=await createWorkspace(clock);}finally{creating--;}
          if(id)workspaces.delete(id);nextId=crypto.randomBytes(32).toString('hex');workspaces.set(nextId,workspace);
        }
        workspace.role=role;
        if(!workspace.tokens.has(role)){const login=await workspace.accounts.login(workspace.org,'demo-'+role,workspace.password);workspace.tokens.set(role,login.token);}
        res.writeHead(303,{location:'/pilot/handwerk/rollen/','cache-control':'no-store','set-cookie':demoCookie(req,nextId)});res.end();return true;
      }
      if(!workspace){send(res,401,{error:'DEMO_EXPIRED'});return true;}
      if(pathname==='/handwerk/api/demo'&&req.method==='GET'){send(res,200,{demo:true,role:workspace.role,profiles:PROFILES.map(([role,name,description])=>({role,name,description})),expiresAt:new Date(workspace.expires).toISOString()});return true;}
      if(pathname==='/handwerk/api/overview'&&req.method==='GET'){
        const actor=await workspace.accounts.resolve(workspace.tokens.get(workspace.role));
        send(res,200,{...await workspace.service.overview(actor),demo:{role:workspace.role,profiles:PROFILES.map(([role,name])=>({role,name})),expiresAt:new Date(workspace.expires).toISOString()}});return true;
      }
      if(pathname==='/handwerk/logout'&&req.method==='POST'){workspaces.delete(id);res.writeHead(303,{location:'/demo/','set-cookie':demoCookie(req,'',0),'cache-control':'no-store'});res.end();return true;}
      if(pathname.includes('/users')||pathname.endsWith('/roles')||pathname.includes('/integrations/')){send(res,403,{error:'DEMO_BOUNDARY',message:'Externe Verbindungen und Zugangsdaten sind in der öffentlichen Demo gesperrt.'});return true;}
      if(pathname==='/handwerk/api/commands'&&req.method==='POST'){
        const input=await read(req);
        if(input.operation==='approval.decide')input.input={...input.input,password:workspace.password};
        const actor=await workspace.accounts.resolve(workspace.tokens.get(workspace.role));
        const result=await workspace.service.command(actor,input.operation,input.input);send(res,200,result);return true;
      }
      req.headers.cookie='werkz_handwerk_session='+workspace.tokens.get(workspace.role);
      return workspace.handler(req,res);
    }catch(error){const status={FORBIDDEN:403,UNAUTHENTICATED:401,NOT_FOUND:404,VALIDATION_ERROR:400,REVISION_CONFLICT:409,ACTIVE_TIMER_EXISTS:409}[error.code]||400;send(res,status,{error:error.code||'INVALID_DEMO_REQUEST',message:'Demoaktion nicht möglich. Auswahl prüfen oder die Demo neu starten.'});return true;}
  };
}
module.exports={createPublicDemo,createWorkspace,PROFILES};
