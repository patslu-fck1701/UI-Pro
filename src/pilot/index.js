'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const clone=value=>structuredClone(value);
const uid=prefix=>prefix+'_'+crypto.randomUUID();
function req(value,name){const v=String(value??'').trim();if(!v){const e=new Error(name+' required');e.code='VALIDATION_ERROR';throw e}return v}
function month(value){const v=req(value,'month');if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(v)){const e=new Error('month invalid');e.code='VALIDATION_ERROR';throw e}return v}
function money(v){const n=Number(v);return Number.isFinite(n)?Math.round(n*100)/100:null}
function classifyInquiry(value={}){const text=[value.topic,value.anliegen,value.reason,value.material].filter(Boolean).join(' ').toLowerCase();if(/abhol|abholung|abholen|container/.test(text))return 'Abholung';if(/angebot|preis|ankauf|verkauf|schrott|metall|kupfer|stahl|alu/.test(text))return 'Ankauf / Material';if(/termin/.test(text))return 'Termin';return 'Rückruf'}

class VoiceProviderPort{async accept(){throw new Error('VoiceProviderPort.accept must be implemented')}}
class MailProviderPort{async listRelevant(){throw new Error('MailProviderPort.listRelevant must be implemented')}}
class DocumentExtractionPort{async extract(){throw new Error('DocumentExtractionPort.extract must be implemented')}}
class OutboundMailPort{async send(){throw new Error('OutboundMailPort.send must be implemented')}}
class MarketDataPort{async snapshot(){throw new Error('MarketDataPort.snapshot must be implemented')}}
class PortfolioReadPort{async portfolio(){throw new Error('PortfolioReadPort.portfolio must be implemented')}}

class FilePilotRepository{
  constructor(file){this.file=path.resolve(file);this.state={calls:[],documents:[],notes:[],exports:[]};this.load()}
  load(){if(fs.existsSync(this.file)){const x=JSON.parse(fs.readFileSync(this.file,'utf8'));for(const k of Object.keys(this.state))if(!Array.isArray(x[k]))throw Object.assign(new Error('Pilot state invalid'),{code:'STATE_INVALID'});this.state=x}return this}
  save(){fs.mkdirSync(path.dirname(this.file),{recursive:true});const t=this.file+'.tmp';fs.writeFileSync(t,JSON.stringify(this.state,null,2));fs.renameSync(t,this.file)}
  list(org,key){this.load();return clone(this.state[key].filter(x=>x.organisationId===org))}
  add(key,row){this.load();this.state[key].push(clone(row));this.save();return clone(row)}
  find(org,key,id){this.load();const x=this.state[key].find(v=>v.organisationId===org&&v.id===id);return x?clone(x):null}
}
class MemoryPilotRepository{
  constructor(){this.state={calls:[],documents:[],notes:[],exports:[]}}
  list(org,key){return clone(this.state[key].filter(x=>x.organisationId===org))}
  add(key,row){this.state[key].push(clone(row));return clone(row)}
  find(org,key,id){const x=this.state[key].find(v=>v.organisationId===org&&v.id===id);return x?clone(x):null}
}
class PilotDocumentStorage{
  constructor(root){this.root=path.resolve(root)}
  put({organisationId,id,fileName,mime,bytes}){const safe=String(fileName||'beleg').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120);const body=Buffer.from(bytes);if(body.length>12*1024*1024)throw Object.assign(new Error('too large'),{code:'PAYLOAD_TOO_LARGE'});const dir=path.join(this.root,organisationId,id);fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,safe);fs.writeFileSync(file,body);return {fileName:safe,mime,size:body.length,sha256:crypto.createHash('sha256').update(body).digest('hex'),objectKey:path.relative(this.root,file).split(path.sep).join('/')}}
}

class FakeVoiceProvider extends VoiceProviderPort{
  async accept({payload={}}){return {name:payload.name||'Beispielkunde',phone:payload.phone||'',topic:payload.topic||'Rückruf wegen Metallabholung',location:payload.location||'Alfeld',material:payload.material||'Mischschrott',quantity:payload.quantity||'ca. 1 t',source:'voice-demo'}}
}
class FakeMailProvider extends MailProviderPort{
  async listRelevant(){const now=new Date().toISOString();return [
    {id:'mail-1',from:'kunde@example.de',subject:'Metall abholen',snippet:'Bitte um Rückruf wegen einer Abholung.',category:'Kundenanfrage',relevant:true,receivedAt:now},
    {id:'mail-2',from:'steuerberater@example.de',subject:'Unterlagen',snippet:'Bitte Monatsbelege bereitstellen.',category:'Steuerberater',relevant:true,receivedAt:now}
  ]}
}
class FakeExtractor extends DocumentExtractionPort{
  async extract({fileName}){return {type:String(fileName).toLowerCase().includes('wieg')?'Wiegeschein':'Rechnung',company:'',date:new Date().toISOString().slice(0,10),amount:null,weight:null,description:'Pilot: automatische Extraktion vorbereitet'}}
}
class DraftMailProvider extends OutboundMailPort{
  async send({to,subject,documents}){return {mode:'draft',accepted:false,to,subject,attachmentCount:documents.length,note:'Demo: vorbereitet, nicht extern versendet'}}
}
class StaticMarketProvider extends MarketDataPort{constructor(value=null){super();this.value=value}async snapshot(){return this.value||{source:'demo',live:false,symbol:'BTC/EUR',price:null,change24h:null,change30d:null,note:'Read-only Live-Verbindung ist vorbereitet.'}}}
class StaticPortfolioProvider extends PortfolioReadPort{constructor(value=null){super();this.value=value}async portfolio(){return this.value||{source:'demo',live:false,asset:'BTC',quantity:null,marketValueEur:null,costBasisEur:null,pnlEur:null,note:'Demo-Portfolio noch nicht serverseitig verbunden.'}}}

class WerkZSimplePilotService{
  constructor({auth,entitlements,repository,storage,voice,mail,extractor,outbound,market,portfolio,clock=()=>new Date(),audit=()=>{}}){Object.assign(this,{auth,entitlements,repository,storage,voice,mail,extractor,outbound,market,portfolio,clock,audit})}
  session(token,cap='pilot.read'){const s=this.auth.resolveSession(req(token,'session'));this.entitlements.require(s.organisationId,'werkz.simple');if(!s.capabilities.includes(cap)&&!s.capabilities.includes('pilot.admin'))throw Object.assign(new Error('forbidden'),{code:'FORBIDDEN'});return s}
  event(s,type,id,payload={}){this.audit({organisationId:s.organisationId,actorId:s.actorId,eventType:type,entityType:'pilot',entityId:id,source:'werkz.simple',payload})}
  summary(token){const s=this.session(token),calls=this.repository.list(s.organisationId,'calls'),docs=this.repository.list(s.organisationId,'documents');const m=this.clock().toISOString().slice(0,7);return {open:calls.filter(x=>x.status!=='erledigt').length,callbacks:calls.filter(x=>x.status==='neu'||x.status==='Rückruf').length,documentsThisMonth:docs.filter(x=>x.receivedAt.slice(0,7)===m).length}}
  async recordCall(token,input={}){const s=this.session(token,'pilot.write');const x=input.providerPayload?await this.voice.accept({payload:input.providerPayload}):input;const row=this.createInquiryRow(s.organisationId,x);this.repository.add('calls',row);this.event(s,'pilot.call.created',row.id,{source:row.source});return row}
  createInquiryRow(organisationId,x={}){return {id:uid('call'),organisationId:req(organisationId,'organisationId'),createdAt:this.clock().toISOString(),status:'neu',name:String(x.name||'Unbekannt').trim().slice(0,160),phone:String(x.phone||'').trim().slice(0,80),topic:String(x.topic||x.anliegen||'Rückruf').trim().slice(0,500),location:String(x.location||x.address||'').trim().slice(0,240),material:String(x.material||'').trim().slice(0,160),quantity:String(x.quantity||'').trim().slice(0,120),category:classifyInquiry(x),priority:'normal',source:x.source||'manual'}}
  publicInquiry(organisationId,input={}){if(input.company)throw Object.assign(new Error('spam denied'),{code:'SPAM_DENIED'});if(input.consent!==true)throw Object.assign(new Error('consent required'),{code:'VALIDATION_ERROR'});const clean={name:req(input.name,'name'),phone:req(input.phone,'phone'),topic:req(input.topic||input.reason,'topic'),location:String(input.location||input.address||'').trim(),material:String(input.material||'').trim(),quantity:String(input.quantity||'').trim(),source:'website-contact'};const row=this.createInquiryRow(organisationId,clean);this.repository.add('calls',row);this.audit({organisationId:row.organisationId,actorId:'public-website',eventType:'pilot.public-inquiry.created',entityType:'pilot',entityId:row.id,source:'werkz.simple',payload:{source:row.source}});return {id:row.id,status:row.status,received:true}}
  listCalls(token){const s=this.session(token);return this.repository.list(s.organisationId,'calls').sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
  addNote(token,text){const s=this.session(token,'pilot.write'),row={id:uid('note'),organisationId:s.organisationId,createdAt:this.clock().toISOString(),text:req(text,'text').slice(0,4000)};return this.repository.add('notes',row)}
  async addDocument(token,input){const s=this.session(token,'pilot.write');this.entitlements.require(s.organisationId,'werkz.documents');const bytes=Buffer.from(req(input.dataBase64,'dataBase64'),'base64'),id=uid('doc'),stored=this.storage.put({organisationId:s.organisationId,id,fileName:req(input.fileName,'fileName'),mime:req(input.mime,'mime'),bytes}),ex=await this.extractor.extract({fileName:input.fileName,mime:input.mime,bytes}),row={id,organisationId:s.organisationId,receivedAt:this.clock().toISOString(),type:ex.type||'Sonstiges',company:ex.company||'',date:ex.date||null,amount:money(ex.amount),weight:ex.weight??null,description:ex.description||'',storage:stored};this.repository.add('documents',row);this.event(s,'pilot.document.created',id,{type:row.type});return row}
  listDocuments(token,m=null){const s=this.session(token),selected=m?month(m):null;return this.repository.list(s.organisationId,'documents').filter(x=>!selected||x.receivedAt.slice(0,7)===selected).sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt))}
  async relevantMail(token){const s=this.session(token);this.entitlements.require(s.organisationId,'werkz.channel.gmail');return (await this.mail.listRelevant({organisationId:s.organisationId})).filter(x=>x.relevant!==false).map(x=>({...x,mutatesMailbox:false}))}
  prepareExport(token,m){const s=this.session(token,'pilot.write');this.entitlements.require(s.organisationId,'werkz.billing-prep');const selected=month(m),docs=this.repository.list(s.organisationId,'documents').filter(x=>x.receivedAt.slice(0,7)===selected),row={id:uid('export'),organisationId:s.organisationId,month:selected,createdAt:this.clock().toISOString(),status:'prepared',documentIds:docs.map(x=>x.id),count:docs.length,totalAmount:Math.round(docs.reduce((n,x)=>n+(Number(x.amount)||0),0)*100)/100};return this.repository.add('exports',row)}
  async sendExport(token,{exportId,confirm,to}){const s=this.session(token,'pilot.write');if(confirm!==true)throw Object.assign(new Error('confirmation required'),{code:'CONFIRMATION_REQUIRED'});const row=this.repository.find(s.organisationId,'exports',req(exportId,'exportId'));if(!row)throw Object.assign(new Error('not found'),{code:'NOT_FOUND'});const docs=this.repository.list(s.organisationId,'documents').filter(x=>row.documentIds.includes(x.id));const delivery=await this.outbound.send({organisationId:s.organisationId,to:req(to,'to'),subject:'Unterlagen '+row.month,text:'WerkZ Monatsübergabe',documents:docs});return {...row,delivery}}
  async marketSnapshot(token){const s=this.session(token);this.entitlements.require(s.organisationId,'werkz.crypto-monitor');const [market,portfolio]=await Promise.all([this.market.snapshot({organisationId:s.organisationId}),this.portfolio.portfolio({organisationId:s.organisationId})]);return {label:'Demo-Portfolio',readOnly:true,market,portfolio,generatedAt:this.clock().toISOString()}}
}

function cookieValue(cookie,name){const x=String(cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='));return x?decodeURIComponent(x.slice(name.length+1)):null}
function sendJson(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data))}
async function readBody(reqr,limit=14*1024*1024){const chunks=[];let size=0;for await(const c of reqr){size+=c.length;if(size>limit)throw Object.assign(new Error('too large'),{code:'PAYLOAD_TOO_LARGE'});chunks.push(c)}const raw=Buffer.concat(chunks).toString('utf8');return raw?JSON.parse(raw):{}}
function status(error){return {UNAUTHENTICATED:401,FORBIDDEN:403,ENTITLEMENT_DENIED:403,NOT_FOUND:404,CONFIRMATION_REQUIRED:409,PAYLOAD_TOO_LARGE:413,VALIDATION_ERROR:400,SPAM_DENIED:400,RATE_LIMITED:429}[error.code]||500}
function createPilotHttpHandler({service,defaultTaxRecipient='steuerberater@example.invalid',publicOrganisationId='org-device-test'}){
  const recentPublic=new Map();
  function allowPublic(request){const ip=String(request.headers['x-forwarded-for']||request.socket?.remoteAddress||'unknown').split(',')[0].trim();const now=Date.now(),windowMs=10*60*1000,limit=8;const values=(recentPublic.get(ip)||[]).filter(x=>now-x<windowMs);if(values.length>=limit)throw Object.assign(new Error('rate limited'),{code:'RATE_LIMITED'});values.push(now);recentPublic.set(ip,values)}
  return async function(reqr,res){const url=new URL(reqr.url,'http://werkz.invalid');if(!url.pathname.startsWith('/pilot/api/')&&!url.pathname.startsWith('/pilot/public/'))return false;const token=cookieValue(reqr.headers.cookie,'werkz_session');try{
    if(reqr.method==='POST'&&url.pathname==='/pilot/public/contact'){allowPublic(reqr);const body=await readBody(reqr,64*1024);sendJson(res,201,service.publicInquiry(publicOrganisationId,body));return true;}
    if(reqr.method==='GET'&&url.pathname==='/pilot/api/summary')sendJson(res,200,service.summary(token));
    else if(reqr.method==='GET'&&url.pathname==='/pilot/api/calls')sendJson(res,200,service.listCalls(token));
    else if(reqr.method==='POST'&&url.pathname==='/pilot/api/calls')sendJson(res,201,await service.recordCall(token,await readBody(reqr)));
    else if(reqr.method==='POST'&&url.pathname==='/pilot/api/notes'){const b=await readBody(reqr);sendJson(res,201,service.addNote(token,b.text))}
    else if(reqr.method==='POST'&&url.pathname==='/pilot/api/documents')sendJson(res,201,await service.addDocument(token,await readBody(reqr)));
    else if(reqr.method==='GET'&&url.pathname==='/pilot/api/documents')sendJson(res,200,service.listDocuments(token,url.searchParams.get('month')||null));
    else if(reqr.method==='GET'&&url.pathname==='/pilot/api/mail')sendJson(res,200,await service.relevantMail(token));
    else if(reqr.method==='POST'&&url.pathname==='/pilot/api/export/prepare'){const b=await readBody(reqr);sendJson(res,201,service.prepareExport(token,b.month))}
    else if(reqr.method==='POST'&&url.pathname==='/pilot/api/export/send'){const b=await readBody(reqr);sendJson(res,200,await service.sendExport(token,{...b,to:b.to||defaultTaxRecipient}))}
    else if(reqr.method==='GET'&&url.pathname==='/pilot/api/market')sendJson(res,200,await service.marketSnapshot(token));
    else sendJson(res,404,{error:'NOT_FOUND'});
    return true
  }catch(e){sendJson(res,status(e),{error:e.code||'ERROR',message:e.code==='VALIDATION_ERROR'?e.message:'Request failed'});return true}}
}

function parseSnapshot(value){if(!value)return {};try{const x=JSON.parse(value);return x&&typeof x==='object'?x:{}}catch{return {}}}
function createPilotRuntime({auth,entitlements,dataDir,audit=()=>{}}){const snap=parseSnapshot(process.env.WERKZ_DEMO_CRYPTO_SNAPSHOT);return new WerkZSimplePilotService({auth,entitlements,repository:new FilePilotRepository(path.join(dataDir,'pilot.json')),storage:new PilotDocumentStorage(path.join(dataDir,'documents')),voice:new FakeVoiceProvider(),mail:new FakeMailProvider(),extractor:new FakeExtractor(),outbound:new DraftMailProvider(),market:new StaticMarketProvider(snap.market||null),portfolio:new StaticPortfolioProvider(snap.portfolio||null),audit})}

module.exports={VoiceProviderPort,MailProviderPort,DocumentExtractionPort,OutboundMailPort,MarketDataPort,PortfolioReadPort,FilePilotRepository,MemoryPilotRepository,PilotDocumentStorage,FakeVoiceProvider,FakeMailProvider,FakeExtractor,DraftMailProvider,StaticMarketProvider,StaticPortfolioProvider,WerkZSimplePilotService,createPilotHttpHandler,createPilotRuntime,parseSnapshot,classifyInquiry};
