'use strict';

const {ConnectorPort}=require('../foundation');

function fail(code,message){const error=new Error(message);error.code=code;throw error}
function required(value,name){const text=String(value??'').trim();if(!text)fail('VALIDATION_ERROR',name+' required');return text}
function boundedLimit(value,defaultValue=100,max=1000){
  const n=value===undefined?defaultValue:Number(value);
  if(!Number.isSafeInteger(n)||n<1||n>max)fail('VALIDATION_ERROR','limit invalid');
  return n;
}
const MAX_CALENDAR_WINDOW_MS=366*24*60*60*1000;
function boundedCalendarWindow(from,to){
  const startText=required(from,'from'),endText=required(to,'to');
  const start=new Date(startText),end=new Date(endText);
  if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime()))fail('VALIDATION_ERROR','calendar window timestamps invalid');
  if(start>=end)fail('VALIDATION_ERROR','calendar window must end after it starts');
  if(end.getTime()-start.getTime()>MAX_CALENDAR_WINDOW_MS)fail('VALIDATION_ERROR','calendar window exceeds 366 days');
  return {from:startText,to:endText};
}
function opaqueCursor(value,name='cursor',maxLength=8192){
  const text=required(value,name);
  if(text.length>maxLength)fail('VALIDATION_ERROR',name+' too long');
  return text;
}
function ensureHttps(url,name='url'){
  const parsed=new URL(required(url,name));
  if(parsed.protocol!=='https:')fail('VALIDATION_ERROR',name+' must use HTTPS');
  return parsed;
}
function providerFailure(provider,response){
  const status=Number(response?.status||0);
  if(status===401)fail('TOKEN_EXPIRED',provider+' authorization failed');
  if(status===403)fail('PROVIDER_FORBIDDEN',provider+' operation forbidden');
  if(status===404)fail('PROVIDER_NOT_FOUND',provider+' resource not found');
  if(status===409)fail('PROVIDER_CONFLICT',provider+' conflict');
  if(status===429)fail('RATE_LIMITED',provider+' rate limited');
  if(status>=500)fail('PROVIDER_UNAVAILABLE',provider+' unavailable');
  fail('INTEGRATION_ERROR',provider+' request failed');
}
function requireResponse(provider,response,allowed){
  if(!response||!allowed.includes(Number(response.status)))providerFailure(provider,response);
  return response.body||{};
}
function token(resolveAccess,account){
  const value=resolveAccess(account);
  return required(value,'access token');
}
function graphPrincipal(account){
  const configured=String(account?.providerConfig?.principal||'me').trim();
  return configured==='me'?'me':'users/'+encodeURIComponent(configured);
}
function graphCalendarBase(account){
  const principal=graphPrincipal(account),calendarId=String(account?.providerConfig?.calendarId||'').trim();
  return calendarId?'/'+principal+'/calendars/'+encodeURIComponent(calendarId):'/'+principal;
}
function graphTime(value,name){
  if(!value||typeof value!=='object')fail('VALIDATION_ERROR',name+' required');
  return {dateTime:required(value.dateTime,name+'.dateTime'),timeZone:required(value.timeZone,name+'.timeZone')};
}
function normalizeGraphEvent(value){
  return {
    objectType:'CalendarEvent',
    provider:'microsoft-graph',
    externalId:required(value.id,'event.id'),
    title:String(value.subject||''),
    start:value.start?{dateTime:value.start.dateTime,timeZone:value.start.timeZone||null}:null,
    end:value.end?{dateTime:value.end.dateTime,timeZone:value.end.timeZone||null}:null,
    location:value.location?.displayName||null,
    attendees:Array.isArray(value.attendees)?value.attendees.map(item=>({
      email:item.emailAddress?.address||null,name:item.emailAddress?.name||null,status:item.status?.response||null
    })).filter(item=>item.email):[],
    webUrl:value.webLink||null,
    updatedAt:value.lastModifiedDateTime||null,
    status:value.isCancelled?'cancelled':'confirmed',
    providerMetadata:{isAllDay:Boolean(value.isAllDay)}
  };
}
function graphCreateBody(value){
  const body={subject:required(value.title,'event.title'),start:graphTime(value.start,'event.start'),end:graphTime(value.end,'event.end')};
  if(value.description!==undefined)body.body={contentType:'text',content:String(value.description)};
  if(value.location)body.location={displayName:String(value.location)};
  if(Array.isArray(value.attendees)&&value.attendees.length)body.attendees=value.attendees.map(item=>({
    emailAddress:{address:required(item.email,'attendee.email'),name:String(item.name||item.email)},type:item.type||'required'
  }));
  if(value.transactionId)body.transactionId=String(value.transactionId);
  return body;
}

class MicrosoftGraphCalendarConnector extends ConnectorPort {
  constructor({resolveAccess,http,baseUrl='https://graph.microsoft.com/v1.0',audit=()=>{}}={}){
    super();
    if(typeof resolveAccess!=='function'||typeof http!=='function')throw new Error('resolveAccess and http required');
    this.resolveAccess=resolveAccess;this.http=http;this.base=ensureHttps(baseUrl,'baseUrl');this.audit=audit;
  }
  headers(account){
    const headers={authorization:'Bearer '+token(this.resolveAccess,account),accept:'application/json'};
    if(account?.providerConfig?.timeZone)headers.prefer='outlook.timezone="'+String(account.providerConfig.timeZone).replace(/"/g,'')+'"';
    return headers;
  }
  async connect({account}){return this.health({account})}
  async refresh({account}){return this.health({account})}
  async pull({account,from,to,limit=100,cursor=null}){
    const window=boundedCalendarWindow(from,to),top=boundedLimit(limit,100,1000);
    const expectedPath=this.base.pathname.replace(/\/$/,'')+graphCalendarBase(account)+'/calendarView';
    let url;
    if(cursor){
      url=ensureHttps(opaqueCursor(cursor),'cursor');
      if(url.origin!==this.base.origin||url.pathname!==expectedPath)fail('VALIDATION_ERROR','Microsoft cursor target invalid');
    }else{
      url=new URL(this.base.toString());
      url.pathname=expectedPath;
      url.searchParams.set('startDateTime',window.from);url.searchParams.set('endDateTime',window.to);url.searchParams.set('$top',String(top));
    }
    const body=requireResponse('Microsoft Graph',await this.http({method:'GET',url:url.toString(),headers:this.headers(account)}),[200]);
    const items=Array.isArray(body.value)?body.value.map(normalizeGraphEvent):[];
    let nextCursor=null;
    if(body['@odata.nextLink']){
      const next=ensureHttps(opaqueCursor(body['@odata.nextLink'],'Microsoft nextLink'),'Microsoft nextLink');
      if(next.origin!==this.base.origin||next.pathname!==expectedPath)fail('VALIDATION_ERROR','Microsoft nextLink target invalid');
      nextCursor=next.toString();
    }
    this.audit({organisationId:account.organisationId,eventType:'integration.pull',entityType:'integration-account',entityId:account.id,payload:{provider:'microsoft-graph',objectType:'CalendarEvent',count:items.length}});
    return {items,nextCursor};
  }
  async push({account,operation='create',value}){
    if(operation!=='create')fail('UNSUPPORTED_OPERATION','Microsoft calendar operation unsupported');
    const url=new URL(this.base.toString());
    const base=graphCalendarBase(account),calendarId=String(account?.providerConfig?.calendarId||'').trim();
    url.pathname=this.base.pathname.replace(/\/$/,'')+base+(calendarId?'/events':'/events');
    const body=requireResponse('Microsoft Graph',await this.http({
      method:'POST',url:url.toString(),headers:{...this.headers(account),'content-type':'application/json'},body:graphCreateBody(value)
    }),[201]);
    const result=normalizeGraphEvent(body);
    this.audit({organisationId:account.organisationId,eventType:'integration.push',entityType:'integration-account',entityId:account.id,payload:{provider:'microsoft-graph',operation:'create',objectType:'CalendarEvent',externalId:result.externalId}});
    return result;
  }
  async health({account}){
    const url=new URL(this.base.toString());
    url.pathname=this.base.pathname.replace(/\/$/,'')+graphCalendarBase(account)+(account?.providerConfig?.calendarId?'':'/calendar');
    requireResponse('Microsoft Graph',await this.http({method:'GET',url:url.toString(),headers:this.headers(account)}),[200]);
    return {provider:'microsoft-graph',status:'healthy'};
  }
  async verifyWebhook(){return false}
  async handleWebhook(){fail('UNSUPPORTED_OPERATION','Microsoft Graph webhook lifecycle is not enabled in calendar adapter v1')}
  async disconnect(){return {provider:'microsoft-graph',status:'disconnected',providerActionRequired:false}}
}

function googleCalendarId(account){return required(account?.providerConfig?.calendarId||'primary','calendarId')}
function googleTime(value,name){
  if(!value||typeof value!=='object')fail('VALIDATION_ERROR',name+' required');
  if(value.dateTime)return {dateTime:required(value.dateTime,name+'.dateTime'),...(value.timeZone?{timeZone:String(value.timeZone)}:{})};
  if(value.date)return {date:required(value.date,name+'.date')};
  fail('VALIDATION_ERROR',name+' requires dateTime or date');
}
function normalizeGoogleEvent(value){
  return {
    objectType:'CalendarEvent',
    provider:'google-calendar',
    externalId:required(value.id,'event.id'),
    title:String(value.summary||''),
    start:value.start?{...(value.start.dateTime?{dateTime:value.start.dateTime}:{date:value.start.date}),timeZone:value.start.timeZone||null}:null,
    end:value.end?{...(value.end.dateTime?{dateTime:value.end.dateTime}:{date:value.end.date}),timeZone:value.end.timeZone||null}:null,
    location:value.location||null,
    attendees:Array.isArray(value.attendees)?value.attendees.map(item=>({email:item.email||null,name:item.displayName||null,status:item.responseStatus||null})).filter(item=>item.email):[],
    webUrl:value.htmlLink||null,
    updatedAt:value.updated||null,
    status:value.status||'confirmed',
    providerMetadata:{iCalUID:value.iCalUID||null}
  };
}
function googleCreateBody(value){
  const body={summary:required(value.title,'event.title'),start:googleTime(value.start,'event.start'),end:googleTime(value.end,'event.end')};
  if(value.description!==undefined)body.description=String(value.description);
  if(value.location)body.location=String(value.location);
  if(Array.isArray(value.attendees)&&value.attendees.length)body.attendees=value.attendees.map(item=>({email:required(item.email,'attendee.email'),...(item.name?{displayName:String(item.name)}:{})}));
  return body;
}

class GoogleCalendarConnector extends ConnectorPort {
  constructor({resolveAccess,http,baseUrl='https://www.googleapis.com/calendar/v3',audit=()=>{}}={}){
    super();
    if(typeof resolveAccess!=='function'||typeof http!=='function')throw new Error('resolveAccess and http required');
    this.resolveAccess=resolveAccess;this.http=http;this.base=ensureHttps(baseUrl,'baseUrl');this.audit=audit;
  }
  headers(account){return {authorization:'Bearer '+token(this.resolveAccess,account),accept:'application/json'}}
  eventCollectionUrl(account){
    const url=new URL(this.base.toString());
    url.pathname=this.base.pathname.replace(/\/$/,'')+'/calendars/'+encodeURIComponent(googleCalendarId(account))+'/events';
    return url;
  }
  async connect({account}){return this.health({account})}
  async refresh({account}){return this.health({account})}
  async pull({account,from,to,limit=100,cursor=null}){
    const window=boundedCalendarWindow(from,to),max=boundedLimit(limit,100,2500),url=this.eventCollectionUrl(account);
    url.searchParams.set('timeMin',window.from);url.searchParams.set('timeMax',window.to);url.searchParams.set('maxResults',String(max));
    url.searchParams.set('singleEvents','true');url.searchParams.set('orderBy','startTime');
    if(cursor)url.searchParams.set('pageToken',opaqueCursor(cursor));
    const body=requireResponse('Google Calendar',await this.http({method:'GET',url:url.toString(),headers:this.headers(account)}),[200]);
    const items=Array.isArray(body.items)?body.items.map(normalizeGoogleEvent):[];
    const nextCursor=body.nextPageToken?opaqueCursor(body.nextPageToken,'Google nextPageToken'):null;
    this.audit({organisationId:account.organisationId,eventType:'integration.pull',entityType:'integration-account',entityId:account.id,payload:{provider:'google-calendar',objectType:'CalendarEvent',count:items.length}});
    return {items,nextCursor};
  }
  async push({account,operation='create',value}){
    if(operation!=='create')fail('UNSUPPORTED_OPERATION','Google calendar operation unsupported');
    const url=this.eventCollectionUrl(account);
    const body=requireResponse('Google Calendar',await this.http({
      method:'POST',url:url.toString(),headers:{...this.headers(account),'content-type':'application/json'},body:googleCreateBody(value)
    }),[200,201]);
    const result=normalizeGoogleEvent(body);
    this.audit({organisationId:account.organisationId,eventType:'integration.push',entityType:'integration-account',entityId:account.id,payload:{provider:'google-calendar',operation:'create',objectType:'CalendarEvent',externalId:result.externalId}});
    return result;
  }
  async health({account}){
    const url=new URL(this.base.toString());
    url.pathname=this.base.pathname.replace(/\/$/,'')+'/calendars/'+encodeURIComponent(googleCalendarId(account));
    requireResponse('Google Calendar',await this.http({method:'GET',url:url.toString(),headers:this.headers(account)}),[200]);
    return {provider:'google-calendar',status:'healthy'};
  }
  async verifyWebhook(){return false}
  async handleWebhook(){fail('UNSUPPORTED_OPERATION','Google Calendar webhook lifecycle is not enabled in calendar adapter v1')}
  async disconnect(){return {provider:'google-calendar',status:'disconnected',providerActionRequired:false}}
}

module.exports={MicrosoftGraphCalendarConnector,GoogleCalendarConnector,normalizeGraphEvent,normalizeGoogleEvent,...require('./calendar-notifications')};
