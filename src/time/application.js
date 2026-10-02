'use strict';

const PUBLIC_MESSAGES=Object.freeze({
  UNAUTHENTICATED:'Authentication required',
  FORBIDDEN:'Operation not permitted',
  ENTITLEMENT_DENIED:'Module entitlement required',
  NOT_FOUND:'Resource not found',
  REVISION_CONFLICT:'The record changed on another device',
  VALIDATION_ERROR:'Invalid request',
  HASH_MISMATCH:'Evidence integrity check failed',
  INTEGRITY_ERROR:'Stored data integrity check failed',
  ID_CONFLICT:'Record identifier already exists'
});

function validation(message,field){
  const error=new Error(message);error.code='VALIDATION_ERROR';error.field=field;throw error;
}
function object(value,field){
  if(!value||typeof value!=='object'||Array.isArray(value))validation(field+' must be an object',field);
  return value;
}
function required(value,field){
  if(typeof value!=='string'||!value.trim())validation(field+' is required',field);
  return value.trim();
}
function revision(value){
  if(!Number.isInteger(value)||value<1)validation('expectedRevision must be a positive integer','expectedRevision');
  return value;
}
function errorResult(error){
  const code=PUBLIC_MESSAGES[error.code]?error.code:'INTERNAL_ERROR';
  const details={};
  if(code==='REVISION_CONFLICT'){
    details.entityId=error.entityId;details.expectedRevision=error.expected;details.actualRevision=error.actual;
  }
  if(code==='VALIDATION_ERROR'&&error.field)details.field=error.field;
  return {ok:false,error:{code,message:PUBLIC_MESSAGES[code]||'Unexpected server error',details}};
}

class TimeApplication {
  constructor(service){this.service=service;}
  execute(token,request){
    try{return {ok:true,data:this.dispatch(token,object(request,'request'))};}
    catch(error){return errorResult(error);}
  }
  dispatch(token,request){
    const input=object(request.input||{},'input');
    switch(required(request.operation,'operation')){
      case 'time.start':
        required(input.idempotencyKey,'idempotencyKey');
        return this.service.start(token,input);
      case 'time.stop':
        required(input.id,'id');required(input.idempotencyKey,'idempotencyKey');revision(input.expectedRevision);
        return this.service.stop(token,input);
      case 'time.correct':
        required(input.id,'id');required(input.idempotencyKey,'idempotencyKey');required(input.reason,'reason');
        revision(input.expectedRevision);object(input.changes,'changes');
        return this.service.correct(token,input);
      case 'time.evidence.add':
        required(input.timeRecordId,'timeRecordId');required(input.idempotencyKey,'idempotencyKey');required(input.mime,'mime');
        if(input.bytes===undefined)validation('bytes is required','bytes');
        return this.service.addPhoto(token,input);
      case 'time.get':
        return this.service.get(token,required(input.id,'id'));
      case 'time.list':
        return this.service.list(token);
      case 'time.gallery':
        return this.service.gallery(token,required(input.timeRecordId,'timeRecordId'));
      default:
        validation('Unsupported operation','operation');
    }
  }
  executeOffline(token,command){
    const request=object(command,'command');
    required(request.id,'id');required(request.idempotencyKey,'idempotencyKey');
    required(request.createdAtLocal,'createdAtLocal');
    const input={...object(request.payload||{},'payload'),idempotencyKey:request.idempotencyKey};
    if(request.expectedRevision!==undefined)input.expectedRevision=request.expectedRevision;
    return this.execute(token,{operation:request.type,input});
  }
  uploadEvidence(token,upload){
    try{
      const request=object(upload,'upload'),fields=object(request.fields,'fields'),file=object(request.file,'file');
      required(fields.timeRecordId,'timeRecordId');required(fields.idempotencyKey,'idempotencyKey');
      const mime=required(file.mime||fields.mime,'mime'),bytes=file.bytes;
      if(!Buffer.isBuffer(bytes)&&!(bytes instanceof Uint8Array))validation('file bytes are required','file');
      const size=Number(fields.size??file.size??bytes.length);
      if(!Number.isSafeInteger(size)||size<1||size!==bytes.length)validation('file size mismatch','size');
      return this.execute(token,{operation:'time.evidence.add',input:{
        timeRecordId:fields.timeRecordId,idempotencyKey:fields.idempotencyKey,mime,size,
        hash:required(fields.hash,'hash'),bytes:Buffer.from(bytes)
      }});
    }catch(error){return errorResult(error);}
  }
}

module.exports={TimeApplication,errorResult};
