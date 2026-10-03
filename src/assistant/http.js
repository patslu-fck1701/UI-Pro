'use strict';

const {multipart,cookieToken,MAX_EVIDENCE_BYTES}=require('../time/http');

const MAX_JSON_BYTES=1024*1024;
function sameOrigin(request,origin){if(!origin)return false;try{return new URL(origin).host===String(request.headers.host||'')}catch{return false}}
function cors(response,origin,allowed){
  if(origin&&allowed.includes(origin)){response.setHeader('access-control-allow-origin',origin);response.setHeader('access-control-allow-credentials','true');response.setHeader('vary','Origin')}
}
function send(response,status,payload,origin,allowed){
  cors(response,origin,allowed);response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});response.end(JSON.stringify(payload));
}
function statusOf(error){return ({UNAUTHENTICATED:401,FORBIDDEN:403,ENTITLEMENT_DENIED:403,NOT_FOUND:404,VALIDATION_ERROR:400,ID_CONFLICT:409,HASH_MISMATCH:422,ASSISTANT_STATE_INVALID:500,ASSISTANT_STATE_LOCK_TIMEOUT:503}[error.code]||500)}
function readBody(request,limit){
  return new Promise((resolve,reject)=>{const chunks=[];let size=0;request.on('data',chunk=>{size+=chunk.length;if(size>limit){const error=new Error('Request body too large');error.code='VALIDATION_ERROR';request.destroy(error);return}chunks.push(chunk)});request.on('end',()=>resolve(Buffer.concat(chunks)));request.on('error',reject)})
}
function jsonBody(bytes){try{return JSON.parse(bytes.toString('utf8'))}catch{const error=new Error('Invalid JSON');error.code='VALIDATION_ERROR';throw error}}
function boundaryOf(contentType){const match=/boundary=(?:"([^"]+)"|([^;]+))/i.exec(String(contentType||''));return match?.[1]||match?.[2]?.trim()||null}
function errorPayload(error){return {ok:false,error:{code:error.code||'INTERNAL_ERROR',message:error.code?'Request failed':'Internal error'}}}
function createAssistantHttpHandler({service,allowedOrigins=[],sessionCookie='werkz_session'}){
  if(!service)throw new Error('service is required');
  return async function handler(request,response){
    const origin=request.headers.origin,originAllowed=!origin||allowedOrigins.includes(origin)||sameOrigin(request,origin);
    if(!originAllowed)return send(response,403,{ok:false,error:{code:'FORBIDDEN',message:'Origin not permitted'}},null,allowedOrigins);
    if(request.method==='OPTIONS'){
      cors(response,origin,allowedOrigins);response.writeHead(204,{'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type, accept'});return response.end();
    }
    const url=new URL(request.url,'http://werkz.invalid'),token=cookieToken(request,sessionCookie);
    try{
      if(request.method==='GET'&&url.pathname==='/assistant/briefing')return send(response,200,{ok:true,data:service.briefing(token)},origin,allowedOrigins);
      if(request.method==='GET'&&url.pathname==='/assistant/items')return send(response,200,{ok:true,data:service.list(token)},origin,allowedOrigins);
      if(request.method==='GET'&&url.pathname==='/assistant/capture-hints')return send(response,200,{ok:true,data:service.captureHints(token)},origin,allowedOrigins);
      if(request.method==='GET'&&url.pathname==='/assistant/story')return send(response,200,{ok:true,data:service.storyCanon(token)},origin,allowedOrigins);
      if(request.method==='GET'&&url.pathname==='/assistant/source-audit')return send(response,200,{ok:true,data:service.sourceAudit(token)},origin,allowedOrigins);
      if(request.method==='GET'&&url.pathname==='/assistant/event-tests/specs')return send(response,200,{ok:true,data:service.eventSpecs(token)},origin,allowedOrigins);
      if(request.method==='GET'&&url.pathname==='/assistant/event-tests')return send(response,200,{ok:true,data:service.listEventTests(token)},origin,allowedOrigins);
      if(request.method==='GET'&&url.pathname==='/assistant/projections')return send(response,200,{ok:true,data:service.listProjections(token)},origin,allowedOrigins);
      if(request.method==='POST'&&url.pathname==='/assistant/capture'){
        const input=jsonBody(await readBody(request,MAX_JSON_BYTES));return send(response,200,{ok:true,data:service.capture(token,input)},origin,allowedOrigins);
      }
      if(request.method==='POST'&&url.pathname==='/assistant/event-tests'){
        const input=jsonBody(await readBody(request,MAX_JSON_BYTES));
        return send(response,200,{ok:true,data:service.startEventTest(token,input)},origin,allowedOrigins);
      }
      const observationMatch=/^\/assistant\/event-tests\/([^/]+)\/observations$/.exec(url.pathname);
      if(request.method==='POST'&&observationMatch){
        const input=jsonBody(await readBody(request,MAX_JSON_BYTES));
        return send(response,200,{ok:true,data:service.addEventObservation(token,decodeURIComponent(observationMatch[1]),input)},origin,allowedOrigins);
      }
      const finishEventMatch=/^\/assistant\/event-tests\/([^/]+)\/finish$/.exec(url.pathname);
      if(request.method==='POST'&&finishEventMatch){
        const input=jsonBody(await readBody(request,MAX_JSON_BYTES));
        return send(response,200,{ok:true,data:service.finishEventTest(token,decodeURIComponent(finishEventMatch[1]),input)},origin,allowedOrigins);
      }
      if(request.method==='POST'&&url.pathname==='/assistant/signals'){
        const input=jsonBody(await readBody(request,MAX_JSON_BYTES));return send(response,200,{ok:true,data:service.ingestSignal(token,input)},origin,allowedOrigins);
      }
      const statusMatch=/^\/assistant\/items\/([^/]+)\/status$/.exec(url.pathname);
      if(request.method==='POST'&&statusMatch){
        const input=jsonBody(await readBody(request,MAX_JSON_BYTES));return send(response,200,{ok:true,data:service.setStatus(token,decodeURIComponent(statusMatch[1]),input.status)},origin,allowedOrigins);
      }
      if(request.method==='POST'&&url.pathname==='/assistant/documents'){
        const body=await readBody(request,MAX_EVIDENCE_BYTES+64*1024),upload=multipart(body,boundaryOf(request.headers['content-type']));
        const result=service.addDocument(token,{fileName:upload.file.fileName,mime:upload.file.mime,bytes:upload.file.bytes,category:upload.fields.category||'document',note:upload.fields.note||'',idempotencyKey:upload.fields.idempotencyKey||'',clientHash:upload.fields.hash||''});
        return send(response,200,{ok:true,data:result},origin,allowedOrigins);
      }
      const documentMatch=/^\/assistant\/documents\/([^/]+)$/.exec(url.pathname);
      if(request.method==='GET'&&documentMatch){
        const result=service.getDocument(token,decodeURIComponent(documentMatch[1])),inline=/^image\//.test(result.metadata.mime);
        cors(response,origin,allowedOrigins);response.writeHead(200,{'content-type':result.metadata.mime||'application/octet-stream','content-length':String(result.bytes.length),
          'content-disposition':(inline?'inline':'attachment')+'; filename="werkz-assistant-'+result.metadata.id+'"','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"});
        response.end(result.bytes);return;
      }
      if(request.method==='GET'&&url.pathname==='/analytics/market'){
        return send(response,200,{ok:true,data:service.marketSummary(token,url.searchParams.get('asset')||'BTC',url.searchParams.get('currency')||'EUR')},origin,allowedOrigins);
      }
      if(request.method==='POST'&&url.pathname==='/analytics/market'){
        const input=jsonBody(await readBody(request,MAX_JSON_BYTES));return send(response,200,{ok:true,data:service.addMarketSnapshot(token,input)},origin,allowedOrigins);
      }
      if(request.method==='POST'&&url.pathname==='/simulation/mandates'){
        const input=jsonBody(await readBody(request,MAX_JSON_BYTES));return send(response,200,{ok:true,data:service.createMandate(token,input)},origin,allowedOrigins);
      }
      if(request.method==='GET'&&url.pathname==='/simulation/mandates'){
        return send(response,200,{ok:true,data:service.evaluateMandates(token)},origin,allowedOrigins);
      }
      return send(response,404,{ok:false,error:{code:'NOT_FOUND',message:'Resource not found'}},origin,allowedOrigins);
    }catch(error){return send(response,statusOf(error),errorPayload(error),origin,allowedOrigins)}
  };
}
module.exports={createAssistantHttpHandler};
