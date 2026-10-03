'use strict';

const crypto=require('node:crypto');

function fail(code,message){const error=new Error(message);error.code=code;throw error}
function required(value,name){const text=String(value??'').trim();if(!text)fail('VALIDATION_ERROR',name+' required');return text}
function https(value,name){
  const url=new URL(required(value,name));
  if(url.protocol!=='https:')fail('VALIDATION_ERROR',name+' must use HTTPS');
  return url.toString();
}
function future(value,name,clock){
  const date=new Date(required(value,name));
  if(Number.isNaN(date.getTime())||date<=clock())fail('VALIDATION_ERROR',name+' must be in the future');
  return date;
}
function bearer(resolveAccess,account){return 'Bearer '+required(resolveAccess(account),'access token')}
function safeProviderError(provider,response){
  const status=Number(response?.status||0);
  if(status===401)fail('TOKEN_EXPIRED',provider+' authorization failed');
  if(status===403)fail('PROVIDER_FORBIDDEN',provider+' operation forbidden');
  if(status===404)fail('PROVIDER_NOT_FOUND',provider+' resource not found');
  if(status===409)fail('PROVIDER_CONFLICT',provider+' conflict');
  if(status===429)fail('RATE_LIMITED',provider+' rate limited');
  if(status>=500)fail('PROVIDER_UNAVAILABLE',provider+' unavailable');
  fail('INTEGRATION_ERROR',provider+' request failed');
}
function expect(provider,response,allowed){
  if(!response||!allowed.includes(Number(response.status)))safeProviderError(provider,response);
  return response.body||{};
}
function constantEqual(a,b){
  const left=Buffer.from(String(a??'')),right=Buffer.from(String(b??''));
  return left.length===right.length&&crypto.timingSafeEqual(left,right);
}

class MicrosoftGraphCalendarSubscriptions {
  constructor({resolveAccess,resolveClientState,http,baseUrl='https://graph.microsoft.com/v1.0',clock=()=>new Date(),audit=()=>{}}={}){
    if(typeof resolveAccess!=='function'||typeof resolveClientState!=='function'||typeof http!=='function')throw new Error('resolveAccess, resolveClientState and http required');
    this.resolveAccess=resolveAccess;this.resolveClientState=resolveClientState;this.http=http;this.clock=clock;this.audit=audit;
    const base=new URL(baseUrl);if(base.protocol!=='https:')throw new Error('HTTPS baseUrl required');this.base=base;
  }
  headers(account){return {authorization:bearer(this.resolveAccess,account),accept:'application/json','content-type':'application/json'}}
  resource(account){
    const principal=String(account?.providerConfig?.principal||'me').trim();
    const subject=principal==='me'?'me':'users/'+encodeURIComponent(principal);
    const calendarId=String(account?.providerConfig?.calendarId||'').trim();
    return calendarId?'/'+subject+'/calendars/'+encodeURIComponent(calendarId)+'/events':'/'+subject+'/events';
  }
  subscriptionsUrl(){
    const url=new URL(this.base.toString());url.pathname=this.base.pathname.replace(/\/$/,'')+'/subscriptions';return url;
  }
  async create({account,notificationUrl,lifecycleNotificationUrl=null,expirationDateTime,changeType='created,updated,deleted'}){
    const expires=future(expirationDateTime,'expirationDateTime',this.clock),body={
      changeType:required(changeType,'changeType'),
      notificationUrl:https(notificationUrl,'notificationUrl'),
      resource:this.resource(account),
      expirationDateTime:expires.toISOString(),
      clientState:required(this.resolveClientState(account),'client state')
    };
    if(lifecycleNotificationUrl)body.lifecycleNotificationUrl=https(lifecycleNotificationUrl,'lifecycleNotificationUrl');
    const response=expect('Microsoft Graph',await this.http({method:'POST',url:this.subscriptionsUrl().toString(),headers:this.headers(account),body}),[201]);
    const result={id:required(response.id,'subscription.id'),resource:response.resource||body.resource,expirationDateTime:response.expirationDateTime||body.expirationDateTime,
      lifecycleNotificationUrl:response.lifecycleNotificationUrl||body.lifecycleNotificationUrl||null,status:'active'};
    this.audit({organisationId:account.organisationId,eventType:'integration.subscription.created',entityType:'integration-subscription',entityId:result.id,
      payload:{provider:'microsoft-graph',resource:result.resource,expirationDateTime:result.expirationDateTime}});
    return result;
  }
  async renew({account,subscriptionId,expirationDateTime}){
    const expires=future(expirationDateTime,'expirationDateTime',this.clock),url=this.subscriptionsUrl();
    url.pathname+='/'+encodeURIComponent(required(subscriptionId,'subscriptionId'));
    const response=expect('Microsoft Graph',await this.http({method:'PATCH',url:url.toString(),headers:this.headers(account),body:{expirationDateTime:expires.toISOString()}}),[200]);
    const result={id:required(response.id||subscriptionId,'subscription.id'),expirationDateTime:response.expirationDateTime||expires.toISOString(),status:'active'};
    this.audit({organisationId:account.organisationId,eventType:'integration.subscription.renewed',entityType:'integration-subscription',entityId:result.id,
      payload:{provider:'microsoft-graph',expirationDateTime:result.expirationDateTime}});
    return result;
  }
  async stop({account,subscriptionId}){
    const id=required(subscriptionId,'subscriptionId'),url=this.subscriptionsUrl();url.pathname+='/'+encodeURIComponent(id);
    expect('Microsoft Graph',await this.http({method:'DELETE',url:url.toString(),headers:this.headers(account)}),[204]);
    this.audit({organisationId:account.organisationId,eventType:'integration.subscription.stopped',entityType:'integration-subscription',entityId:id,payload:{provider:'microsoft-graph'}});
    return {id,status:'stopped'};
  }
  validateEndpoint(validationToken){
    return {status:200,contentType:'text/plain',body:required(validationToken,'validationToken')};
  }
  verifyNotifications({account,body}){
    const expected=required(this.resolveClientState(account),'client state'),items=Array.isArray(body?.value)?body.value:[];
    if(!items.length)fail('WEBHOOK_UNVERIFIED','Microsoft notification batch empty');
    for(const item of items){
      if(!constantEqual(item.clientState,expected))fail('WEBHOOK_UNVERIFIED','Microsoft client state invalid');
      required(item.subscriptionId,'subscriptionId');
    }
    return items.map(item=>({
      subscriptionId:item.subscriptionId,
      changeType:item.changeType||null,
      resource:item.resource||null,
      lifecycleEvent:item.lifecycleEvent||null,
      subscriptionExpirationDateTime:item.subscriptionExpirationDateTime||null
    }));
  }
}

class GoogleCalendarChannels {
  constructor({resolveAccess,resolveChannelToken,http,baseUrl='https://www.googleapis.com/calendar/v3',clock=()=>new Date(),random=crypto.randomUUID,audit=()=>{}}={}){
    if(typeof resolveAccess!=='function'||typeof resolveChannelToken!=='function'||typeof http!=='function')throw new Error('resolveAccess, resolveChannelToken and http required');
    this.resolveAccess=resolveAccess;this.resolveChannelToken=resolveChannelToken;this.http=http;this.clock=clock;this.random=random;this.audit=audit;
    const base=new URL(baseUrl);if(base.protocol!=='https:')throw new Error('HTTPS baseUrl required');this.base=base;
  }
  headers(account){return {authorization:bearer(this.resolveAccess,account),accept:'application/json','content-type':'application/json'}}
  calendarId(account){return required(account?.providerConfig?.calendarId||'primary','calendarId')}
  watchUrl(account){
    const url=new URL(this.base.toString());
    url.pathname=this.base.pathname.replace(/\/$/,'')+'/calendars/'+encodeURIComponent(this.calendarId(account))+'/events/watch';
    return url;
  }
  stopUrl(){const url=new URL(this.base.toString());url.pathname=this.base.pathname.replace(/\/$/,'')+'/channels/stop';return url}
  async watch({account,address,expiration=null,channelId=null}){
    const id=channelId||this.random(),body={id:required(id,'channelId'),type:'web_hook',address:https(address,'address'),
      token:required(this.resolveChannelToken(account),'channel token')};
    if(expiration!==null){
      const date=future(expiration,'expiration',this.clock);body.expiration=String(date.getTime());
    }
    const response=expect('Google Calendar',await this.http({method:'POST',url:this.watchUrl(account).toString(),headers:this.headers(account),body}),[200]);
    const result={id:required(response.id||body.id,'channel.id'),resourceId:required(response.resourceId,'resourceId'),resourceUri:response.resourceUri||null,
      expiration:response.expiration||body.expiration||null,status:'active'};
    this.audit({organisationId:account.organisationId,eventType:'integration.subscription.created',entityType:'integration-subscription',entityId:result.id,
      payload:{provider:'google-calendar',resourceId:result.resourceId,expiration:result.expiration}});
    return result;
  }
  async stop({account,channelId,resourceId}){
    const id=required(channelId,'channelId'),resource=required(resourceId,'resourceId');
    expect('Google Calendar',await this.http({method:'POST',url:this.stopUrl().toString(),headers:this.headers(account),body:{id,resourceId:resource}}),[200,204]);
    this.audit({organisationId:account.organisationId,eventType:'integration.subscription.stopped',entityType:'integration-subscription',entityId:id,payload:{provider:'google-calendar',resourceId:resource}});
    return {id,resourceId:resource,status:'stopped'};
  }
  verifyNotification({account,headers}){
    const lower={};for(const [key,value] of Object.entries(headers||{}))lower[String(key).toLowerCase()]=value;
    const channelId=required(lower['x-goog-channel-id'],'x-goog-channel-id');
    const resourceId=required(lower['x-goog-resource-id'],'x-goog-resource-id');
    const resourceState=required(lower['x-goog-resource-state'],'x-goog-resource-state');
    const messageNumber=required(lower['x-goog-message-number'],'x-goog-message-number');
    if(!constantEqual(lower['x-goog-channel-token'],required(this.resolveChannelToken(account),'channel token')))fail('WEBHOOK_UNVERIFIED','Google channel token invalid');
    const configuredChannel=String(account?.providerConfig?.notificationChannelId||'').trim();
    if(configuredChannel&&!constantEqual(channelId,configuredChannel))fail('WEBHOOK_UNVERIFIED','Google channel id invalid');
    return {channelId,resourceId,resourceState,messageNumber,resourceUri:lower['x-goog-resource-uri']||null,expiration:lower['x-goog-channel-expiration']||null};
  }
}

module.exports={MicrosoftGraphCalendarSubscriptions,GoogleCalendarChannels};
