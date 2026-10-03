'use strict';

const {MailProviderPort}=require('../../pilot');

function fail(code,message){const e=new Error(message);e.code=code;throw e}
function required(value,name){const v=String(value??'').trim();if(!v)fail('VALIDATION_ERROR',name+' required');return v}
function header(message,name){const rows=message?.payload?.headers;const hit=Array.isArray(rows)?rows.find(x=>String(x?.name||'').toLowerCase()===String(name).toLowerCase()):null;return hit?String(hit.value||''):''}
function providerFailure(response){
  const status=Number(response?.status||0);
  if(status===401)fail('TOKEN_EXPIRED','Gmail authorization failed');
  if(status===403)fail('PROVIDER_FORBIDDEN','Gmail operation forbidden');
  if(status===429)fail('RATE_LIMITED','Gmail rate limited');
  if(status>=500)fail('PROVIDER_UNAVAILABLE','Gmail unavailable');
  fail('INTEGRATION_ERROR','Gmail request failed');
}
function body(response,allowed=[200]){if(!response||!allowed.includes(Number(response.status)))providerFailure(response);return response.body||{}}
function classify(message){
  const subject=header(message,'Subject');
  const from=header(message,'From');
  const snippet=String(message?.snippet||'');
  const text=(subject+' '+from+' '+snippet).toLowerCase();
  const labels=new Set(Array.isArray(message?.labelIds)?message.labelIds:[]);
  const rules=[
    ['Steuerberater',/(steuerberater|steuerkanzlei|finanzamt|ustva|buchhaltung|belege)/],
    ['Rechnung / Beleg',/(rechnung|invoice|quittung|beleg|gutschrift|zahlung|zahlungsziel)/],
    ['Termin / Frist',/(termin|frist|erinnerung|appointment|deadline)/],
    ['Kundenanfrage',/(abholung|abholen|schrott|metall|container|angebot|anfrage|rückruf|rueckruf)/]
  ];
  const match=rules.find(([,rx])=>rx.test(text));
  const relevant=Boolean(match||labels.has('IMPORTANT')||labels.has('STARRED'));
  return {relevant,category:match?.[0]||(relevant?'Wichtig':'Sonstiges'),subject,from,snippet};
}

class GmailReadProvider extends MailProviderPort{
  constructor({resolveAccess,http,account,maxResults=25,baseUrl='https://gmail.googleapis.com/gmail/v1'}={}){
    super();
    if(typeof resolveAccess!=='function'||typeof http!=='function'||!account)throw new Error('resolveAccess, http and account required');
    this.resolveAccess=resolveAccess;this.http=http;this.account=account;
    const max=Number(maxResults);if(!Number.isSafeInteger(max)||max<1||max>50)throw new Error('maxResults invalid');this.maxResults=max;
    const url=new URL(baseUrl);if(url.protocol!=='https:')throw new Error('baseUrl must use HTTPS');this.base=url;
  }
  auth(){return {authorization:'Bearer '+required(this.resolveAccess(this.account),'access token'),accept:'application/json'}}
  async listRelevant({organisationId}={}){
    if(required(organisationId,'organisationId')!==this.account.organisationId)fail('FORBIDDEN','Gmail account unavailable');
    const list=new URL(this.base.toString());
    list.pathname=this.base.pathname.replace(/\/$/,'')+'/users/me/messages';
    list.searchParams.set('maxResults',String(this.maxResults));
    list.searchParams.set('q','newer_than:30d -category:promotions -category:social -category:forums -label:spam -label:trash');
    const listed=body(await this.http({method:'GET',url:list.toString(),headers:this.auth()}));
    const refs=Array.isArray(listed.messages)?listed.messages:[];
    const out=[];
    for(const ref of refs){
      const id=required(ref?.id,'message.id');
      const url=new URL(this.base.toString());
      url.pathname=this.base.pathname.replace(/\/$/,'')+'/users/me/messages/'+encodeURIComponent(id);
      url.searchParams.set('format','metadata');
      for(const h of ['From','Subject','Date'])url.searchParams.append('metadataHeaders',h);
      const msg=body(await this.http({method:'GET',url:url.toString(),headers:this.auth()}));
      const c=classify(msg);
      if(!c.relevant)continue;
      out.push({id,from:c.from,subject:c.subject||'(ohne Betreff)',snippet:c.snippet,category:c.category,relevant:true,receivedAt:header(msg,'Date')||null,provider:'gmail',readOnly:true});
    }
    return out;
  }
}

GmailReadProvider.oauthScopes=Object.freeze(['https://www.googleapis.com/auth/gmail.readonly']);

module.exports={GmailReadProvider,classifyGmailMessage:classify};
