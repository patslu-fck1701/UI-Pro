'use strict';

const {errorResult}=require('./application');

const MAX_JSON_BYTES=1024*1024;
const MAX_EVIDENCE_BYTES=20*1024*1024;
function cookieToken(request,name){
  const cookie=String(request.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(name+'='));
  return cookie?decodeURIComponent(cookie.slice(name.length+1)):null;
}
function sameOrigin(request,origin){
  if(!origin)return false;
  try{return new URL(origin).host===String(request.headers.host||'')}
  catch{return false}
}
function send(response,status,payload,origin,allowed){
  if(origin&&allowed.includes(origin)){
    response.setHeader('access-control-allow-origin',origin);
    response.setHeader('access-control-allow-credentials','true');
    response.setHeader('vary','Origin');
  }
  response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  response.end(JSON.stringify(payload));
}
function statusOf(result){
  if(result.ok!==false)return 200;
  return ({UNAUTHENTICATED:401,FORBIDDEN:403,ENTITLEMENT_DENIED:403,NOT_FOUND:404,REVISION_CONFLICT:409,ID_CONFLICT:409,VALIDATION_ERROR:400,HASH_MISMATCH:422}[result.error?.code]||500);
}
function readBody(request,limit){
  return new Promise((resolve,reject)=>{
    const chunks=[];let size=0;
    request.on('data',chunk=>{
      size+=chunk.length;
      if(size>limit){const error=new Error('Request body too large');error.code='VALIDATION_ERROR';request.destroy(error);return;}
      chunks.push(chunk);
    });
    request.on('end',()=>resolve(Buffer.concat(chunks)));
    request.on('error',reject);
  });
}
function boundaryOf(contentType){
  const match=/boundary=(?:"([^"]+)"|([^;]+))/i.exec(String(contentType||''));
  return match?.[1]||match?.[2]?.trim()||null;
}
function multipart(body,boundary){
  if(!boundary){const error=new Error('Multipart boundary required');error.code='VALIDATION_ERROR';throw error;}
  const fields={},delimiter='--'+boundary;
  let file=null;
  for(let part of body.toString('latin1').split(delimiter).slice(1,-1)){
    if(part.startsWith('\r\n'))part=part.slice(2);
    if(part.endsWith('\r\n'))part=part.slice(0,-2);
    const split=part.indexOf('\r\n\r\n');if(split<0)continue;
    const headers=part.slice(0,split),value=part.slice(split+4);
    const disposition=/content-disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i.exec(headers);
    if(!disposition)continue;
    const name=disposition[1],fileName=disposition[2];
    if(fileName!==undefined){
      if(file){const error=new Error('Exactly one file required');error.code='VALIDATION_ERROR';throw error;}
      const mime=/content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim()||'application/octet-stream';
      file={fileName,mime,bytes:Buffer.from(value,'latin1')};
    }else fields[name]=Buffer.from(value,'latin1').toString('utf8');
  }
  if(!file){const error=new Error('Evidence file required');error.code='VALIDATION_ERROR';throw error;}
  if(file.bytes.length>MAX_EVIDENCE_BYTES){const error=new Error('Evidence exceeds 20 MB');error.code='VALIDATION_ERROR';throw error;}
  return {fields,file};
}
function requestError(error){
  if(!error.code)error.code='VALIDATION_ERROR';
  return errorResult(error);
}
function createTimeHttpHandler({application,auth,allowedOrigins=[],sessionCookie='werkz_session'}){
  if(!application||!auth)throw new Error('application and auth are required');
  return async function handler(request,response){
    const origin=request.headers.origin,originAllowed=!origin||allowedOrigins.includes(origin)||sameOrigin(request,origin);
    if(!originAllowed)return send(response,403,{ok:false,error:{code:'FORBIDDEN',message:'Origin not permitted',details:{}}},null,allowedOrigins);
    if(request.method==='OPTIONS'){
      if(origin&&allowedOrigins.includes(origin)){response.setHeader('access-control-allow-origin',origin);response.setHeader('access-control-allow-credentials','true');response.setHeader('vary','Origin');}
      response.writeHead(204,{'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type, accept'});return response.end();
    }
    const url=new URL(request.url,'http://werkz.invalid'),token=cookieToken(request,sessionCookie);
    try{
      if(request.method==='GET'&&url.pathname==='/session'){
        const session=auth.resolveSession(token);
        return send(response,200,{organisationId:session.organisationId,actorId:session.actorId,capabilities:[...session.capabilities]},origin,allowedOrigins);
      }
      if(request.method==='POST'&&url.pathname==='/time/commands'){
        const body=await readBody(request,MAX_JSON_BYTES);
        let command;try{command=JSON.parse(body.toString('utf8'))}catch{const error=new Error('Invalid JSON');error.code='VALIDATION_ERROR';throw error;}
        const result=application.execute(token,command);
        return send(response,statusOf(result),result,origin,allowedOrigins);
      }
      if(request.method==='POST'&&url.pathname==='/time/evidence'){
        const body=await readBody(request,MAX_EVIDENCE_BYTES+64*1024);
        const upload=multipart(body,boundaryOf(request.headers['content-type']));
        const result=application.uploadEvidence(token,upload);
        return send(response,statusOf(result),result,origin,allowedOrigins);
      }
      return send(response,404,{ok:false,error:{code:'NOT_FOUND',message:'Resource not found',details:{}}},origin,allowedOrigins);
    }catch(error){
      const result=requestError(error);return send(response,statusOf(result),result,origin,allowedOrigins);
    }
  };
}
module.exports={createTimeHttpHandler,multipart,cookieToken,MAX_EVIDENCE_BYTES};
