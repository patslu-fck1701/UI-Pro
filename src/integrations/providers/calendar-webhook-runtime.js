'use strict';

function fail(code,message){const value=new Error(message);value.code=code;throw value}
function requiredText(value,name,max=2048){
  const text=String(value??'').trim();
  if(!text||text.length>max)fail('VALIDATION_ERROR',name+' invalid');
  return text;
}
function boundedHeaders(headers,maxHeaders=64,maxValueLength=8192){
  if(!headers||typeof headers!=='object'||Array.isArray(headers))fail('VALIDATION_ERROR','headers invalid');
  const entries=Object.entries(headers);
  if(entries.length>maxHeaders)fail('VALIDATION_ERROR','too many headers');
  const result={};
  for(const [name,value] of entries){
    const key=requiredText(name,'header name',256);
    if(Array.isArray(value)){
      if(value.length>16)fail('VALIDATION_ERROR','header value invalid');
      const joined=value.map(item=>String(item)).join(',');
      if(joined.length>maxValueLength)fail('VALIDATION_ERROR','header value too long');
      result[key]=joined;
    }else{
      const text=String(value??'');
      if(text.length>maxValueLength)fail('VALIDATION_ERROR','header value too long');
      result[key]=text;
    }
  }
  return result;
}
function boundedJsonBody(body,maxBodyBytes){
  if(!body||typeof body!=='object'||Array.isArray(body))fail('VALIDATION_ERROR','notification body invalid');
  let encoded;
  try{encoded=JSON.stringify(body)}catch{fail('VALIDATION_ERROR','notification body invalid')}
  if(Buffer.byteLength(encoded,'utf8')>maxBodyBytes)fail('VALIDATION_ERROR','notification body too large');
  return body;
}

class CalendarWebhookRuntime {
  constructor({store,microsoft,google,dispatcher,maxBodyBytes=256*1024,maxHeaders=64,audit=()=>{}}={}){
    if(!store||typeof store.resolve!=='function')throw new Error('Integration store required');
    if(!microsoft||typeof microsoft.validateEndpoint!=='function'||typeof microsoft.verifyNotifications!=='function')throw new Error('Microsoft notification manager required');
    if(!google||typeof google.verifyNotification!=='function')throw new Error('Google notification manager required');
    if(!dispatcher||typeof dispatcher.dispatch!=='function')throw new Error('Verified notification dispatcher required');
    if(!Number.isSafeInteger(maxBodyBytes)||maxBodyBytes<1024||maxBodyBytes>1024*1024)throw new Error('maxBodyBytes invalid');
    if(!Number.isSafeInteger(maxHeaders)||maxHeaders<1||maxHeaders>256)throw new Error('maxHeaders invalid');
    this.store=store;this.microsoft=microsoft;this.google=google;this.dispatcher=dispatcher;
    this.maxBodyBytes=maxBodyBytes;this.maxHeaders=maxHeaders;this.audit=audit;
  }
  account(provider,connectionKey){
    const key=requiredText(connectionKey,'connectionKey',512),account=this.store.resolve(provider,key);
    if(!account)fail('NOT_FOUND','Integration account not found');
    return {key,account};
  }
  microsoftRequest({connectionKey,query={},headers={},body=null,deliveryKey=null}={}){
    const {key,account}=this.account('microsoft-graph',connectionKey);
    boundedHeaders(headers,this.maxHeaders);
    if(query&&query.validationToken!==undefined&&query.validationToken!==null){
      const token=requiredText(query.validationToken,'validationToken',8192);
      const response=this.microsoft.validateEndpoint(token);
      this.audit({organisationId:account.organisationId,eventType:'integration.webhook.validation',entityType:'integration-account',entityId:account.id,payload:{provider:'microsoft-graph'}});
      return response;
    }
    const verified=this.microsoft.verifyNotifications({account,body:boundedJsonBody(body,this.maxBodyBytes)});
    const dispatched=this.dispatcher.dispatch({
      provider:'microsoft-graph',connectionKey:key,deliveryKey:requiredText(deliveryKey,'deliveryKey',2048),
      notifications:verified,eventType:'calendar.notification'
    });
    this.audit({organisationId:account.organisationId,eventType:'integration.webhook.accepted',entityType:'integration-account',entityId:account.id,
      payload:{provider:'microsoft-graph',count:verified.length}});
    return {status:202,contentType:'application/json',body:{accepted:true,count:verified.length,jobIds:dispatched.jobs.map(item=>item.jobId)}};
  }
  googleRequest({connectionKey,headers={},deliveryKey=null}={}){
    const {key,account}=this.account('google-calendar',connectionKey);
    const safeHeaders=boundedHeaders(headers,this.maxHeaders);
    const verified=this.google.verifyNotification({account,headers:safeHeaders});
    const delivery=deliveryKey===null||deliveryKey===undefined
      ?'google:'+requiredText(verified.channelId,'channelId',512)+':'+requiredText(verified.messageNumber,'messageNumber',128)
      :requiredText(deliveryKey,'deliveryKey',2048);
    const dispatched=this.dispatcher.dispatch({
      provider:'google-calendar',connectionKey:key,deliveryKey:delivery,
      notifications:[verified],eventType:'calendar.notification'
    });
    this.audit({organisationId:account.organisationId,eventType:'integration.webhook.accepted',entityType:'integration-account',entityId:account.id,
      payload:{provider:'google-calendar',count:1}});
    return {status:204,contentType:null,body:null,accepted:true,jobIds:dispatched.jobs.map(item=>item.jobId)};
  }
}

module.exports={CalendarWebhookRuntime};
