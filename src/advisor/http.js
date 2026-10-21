'use strict';
const crypto=require('node:crypto');
const {FEATURES,PLANNED,RULES_VERSION,buildConfiguration}=require('./configurator');
const {CATEGORIES,PACKAGES}=require('./catalog');
function send(response,status,value){response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});response.end(JSON.stringify(value));}
async function body(request){let size=0;const chunks=[];for await(const chunk of request){size+=chunk.length;if(size>16384)throw Object.assign(new Error('Anfrage zu groß.'),{code:'VALIDATION_ERROR'});chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('Ungültige Angaben.'),{code:'VALIDATION_ERROR'});}}
function publicConfiguration(row){const copy=structuredClone(row);delete copy.accessTokenHash;return copy;}
function createAdvisorHandler({store,isAdmin=()=>false,intakeOrganisationId='org-werkz-intake'}){
  const limits=new Map();
  return async(request,response)=>{
    const pathname=new URL(request.url,'http://werkz.invalid').pathname;
    if(!pathname.startsWith('/berater/api/')&&pathname!=='/pilot/api/advisor/requests')return false;
    try{
      if(pathname==='/pilot/api/advisor/requests'){
        if(request.method!=='GET'||!isAdmin(request)){send(response,403,{error:'FORBIDDEN'});return true;}
        if(!store){send(response,503,{error:'POSTGRES_REQUIRED'});return true;}
        const values=await store.withTenant(intakeOrganisationId,state=>(state.pilot.configurations||[]).map(publicConfiguration),{write:false});send(response,200,values);return true;
      }
      if(request.method==='GET'&&pathname==='/berater/api/catalog'){send(response,200,{rulesVersion:RULES_VERSION,features:FEATURES.map(({matches,...feature})=>feature),categories:CATEGORIES,packages:PACKAGES,planned:PLANNED,syntheticOnly:true});return true;}
      if(request.method!=='POST'){send(response,404,{error:'NOT_FOUND'});return true;}
      const origin=request.headers.origin,local=/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(request.headers.host||'');
      if(origin!==(local?'http://':'https://')+request.headers.host){send(response,403,{error:'FORBIDDEN'});return true;}
      const ip=String(request.headers['x-forwarded-for']||request.socket?.remoteAddress||'unknown').split(',')[0],recommend=pathname==='/berater/api/recommend',limitKey=(recommend?'preview:':'write:')+ip,now=Date.now(),bucket=limits.get(limitKey)||{since:now,count:0};
      if(now-bucket.since>900000){bucket.since=now;bucket.count=0;}if(++bucket.count>(recommend?240:60)){send(response,429,{error:'RATE_LIMITED'});return true;}limits.set(limitKey,bucket);if(limits.size>1000)limits.delete(limits.keys().next().value);
      const input=await body(request);
      if(pathname==='/berater/api/recommend'){send(response,200,buildConfiguration(input));return true;}
      if(!store){send(response,503,{error:'POSTGRES_REQUIRED',message:'Dauerhafte Konfigurationsspeicherung ist noch nicht verbunden.'});return true;}
      if(pathname==='/berater/api/configurations'){
        const configuration=buildConfiguration(input,{organisationId:intakeOrganisationId}),accessToken=crypto.randomBytes(32).toString('base64url');
        configuration.accessTokenHash=crypto.createHash('sha256').update(accessToken).digest('hex');
        await store.withTenant(intakeOrganisationId,state=>{state.pilot.configurations||=[];if(state.pilot.configurations.length>=500)throw Object.assign(new Error('Demo-Kapazität erreicht.'),{code:'RATE_LIMITED'});state.pilot.configurations.push(configuration);});
        send(response,201,{configuration:publicConfiguration(configuration),accessToken});return true;
      }
      const match=pathname.match(/^\/berater\/api\/configurations\/(configuration_[a-f0-9-]{36})\/request-offer$/);
      if(match){
        const result=await store.withTenant(intakeOrganisationId,state=>{
          const row=(state.pilot.configurations||[]).find(x=>x.id===match[1]);const hash=crypto.createHash('sha256').update(String(input.accessToken||'')).digest('hex');
          if(!row||!crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(row.accessTokenHash)))throw Object.assign(new Error('Konfiguration nicht gefunden.'),{code:'NOT_FOUND'});
          if(input.confirmNonbinding!==true)throw Object.assign(new Error('Bitte unverbindliche Prüfung bestätigen.'),{code:'VALIDATION_ERROR'});
          row.status='offer_requested';row.offerRequestedAt||=new Date().toISOString();row.approval={required:true,approved:false,canProvision:false};return publicConfiguration(row);
        });send(response,200,{configuration:result,message:'Zur manuellen Angebotsprüfung gespeichert. Kein Auftrag und keine automatische Einrichtung.'});return true;
      }
      send(response,404,{error:'NOT_FOUND'});return true;
    }catch(error){const status={VALIDATION_ERROR:400,NOT_FOUND:404,RATE_LIMITED:429}[error.code]||503;send(response,status,{error:error.code||'SERVICE_UNAVAILABLE',message:status===400?error.message:'Anfrage konnte nicht verarbeitet werden.'});return true;}
  };
}
module.exports={createAdvisorHandler};
