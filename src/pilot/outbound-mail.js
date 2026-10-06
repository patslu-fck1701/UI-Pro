'use strict';

const crypto=require('node:crypto');

function invalid(message,code='VALIDATION_ERROR'){
  const error=new Error(message);error.code=code;return error;
}
function email(value,name='email'){
  const clean=String(value||'').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean))throw invalid(name+' invalid');
  return clean;
}
function cleanIdempotencyKey(value){
  const clean=String(value||'').trim();
  if(!clean)return null;
  if(clean.length>256)throw invalid('idempotency key too long');
  return clean;
}

class ResendOutboundMailProvider{
  constructor({apiKey,from,storage,fetchFn=globalThis.fetch,endpoint='https://api.resend.com/emails',maxRawAttachmentBytes=28*1024*1024}={}){
    this.apiKey=String(apiKey||'').trim();
    this.from=String(from||'').trim();
    this.storage=storage;
    this.fetchFn=fetchFn;
    this.endpoint=endpoint;
    this.maxRawAttachmentBytes=maxRawAttachmentBytes;
    if(!this.apiKey)throw invalid('Resend API key required','CONFIGURATION_ERROR');
    if(!this.from)throw invalid('outbound from address required','CONFIGURATION_ERROR');
    if(!this.storage||typeof this.storage.read!=='function')throw invalid('document storage required','CONFIGURATION_ERROR');
    if(typeof this.fetchFn!=='function')throw invalid('fetch implementation required','CONFIGURATION_ERROR');
  }
  attachment(organisationId,document){
    const stored=document&&document.storage||{};
    const fileName=String(stored.fileName||'').trim();
    if(!document||!document.id||!fileName)throw invalid('document attachment metadata incomplete','STATE_INVALID');
    const bytes=this.storage.read({organisationId,id:document.id,fileName});
    const expected=String(stored.sha256||'').trim().toLowerCase();
    const actual=crypto.createHash('sha256').update(bytes).digest('hex');
    if(expected&&expected!==actual)throw invalid('document attachment checksum mismatch','STATE_INVALID');
    return {
      content:Buffer.from(bytes).toString('base64'),
      filename:fileName,
      content_type:String(stored.mime||'application/octet-stream'),
      rawBytes:bytes.length
    };
  }
  async send({organisationId,to,subject,text,documents=[],idempotencyKey}={}){
    const recipient=email(to,'recipient');
    const cleanSubject=String(subject||'').trim();
    if(!cleanSubject)throw invalid('subject required');
    if(!organisationId)throw invalid('organisationId required');
    const attachments=(Array.isArray(documents)?documents:[]).map(document=>this.attachment(organisationId,document));
    const totalRawBytes=attachments.reduce((n,item)=>n+item.rawBytes,0);
    if(totalRawBytes>this.maxRawAttachmentBytes)throw invalid('attachments too large','PAYLOAD_TOO_LARGE');
    const payload={
      from:this.from,
      to:[recipient],
      subject:cleanSubject,
      text:String(text||''),
      attachments:attachments.map(({rawBytes,...item})=>item)
    };
    const headers={
      authorization:'Bearer '+this.apiKey,
      'content-type':'application/json'
    };
    const key=cleanIdempotencyKey(idempotencyKey);
    if(key)headers['idempotency-key']=key;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),15000);
    let response;
    try{
      response=await this.fetchFn(this.endpoint,{method:'POST',headers,body:JSON.stringify(payload),signal:controller.signal});
    }catch(error){
      throw invalid('outbound mail provider unavailable','PROVIDER_UNAVAILABLE');
    }finally{
      clearTimeout(timer);
    }
    const raw=await response.text().catch(()=> '');
    let body={};try{body=raw?JSON.parse(raw):{}}catch{}
    if(!response.ok)throw invalid('outbound mail provider rejected request','PROVIDER_UNAVAILABLE');
    const providerMessageId=String(body&&body.id||'').trim();
    if(!providerMessageId)throw invalid('outbound mail provider response invalid','PROVIDER_UNAVAILABLE');
    return {
      mode:'resend',
      accepted:true,
      to:recipient,
      subject:cleanSubject,
      attachmentCount:attachments.length,
      providerMessageId
    };
  }
}

module.exports={ResendOutboundMailProvider};
