'use strict';

const crypto=require('node:crypto');

function normalizeTwilioNumber(value){
  let text=String(value||'').trim().replace(/[\s().-]/g,'');
  if(text.startsWith('00'))text='+'+text.slice(2);
  return /^\+[1-9][0-9]{5,15}$/.test(text)?text:'';
}

function twilioParamEntries(params){
  if(params instanceof URLSearchParams)return [...params.entries()].sort((a,b)=>a[0]===b[0]?(String(a[1])<String(b[1])?-1:String(a[1])>String(b[1])?1:0):(a[0]<b[0]?-1:a[0]>b[0]?1:0));
  const rows=[];
  for(const [key,value] of Object.entries(params||{})){
    if(Array.isArray(value))for(const item of value)rows.push([key,String(item??'')]);
    else rows.push([key,String(value??'')]);
  }
  return rows.sort((a,b)=>a[0]===b[0]?(a[1]<b[1]?-1:a[1]>b[1]?1:0):(a[0]<b[0]?-1:a[0]>b[0]?1:0));
}

function twilioFormSignature({authToken,url,params}){
  const secret=String(authToken||'');
  if(!secret)throw new Error('Twilio auth token required');
  let value=String(url||'');
  for(const [key,item] of twilioParamEntries(params))value+=key+item;
  return crypto.createHmac('sha1',secret).update(value,'utf8').digest('base64');
}

function safeEqual(a,b){
  const left=Buffer.from(String(a||''),'utf8'),right=Buffer.from(String(b||''),'utf8');
  return left.length===right.length&&crypto.timingSafeEqual(left,right);
}

function validateTwilioFormRequest({authToken,signature,url,params}){
  if(!signature||!authToken||!url)return false;
  return safeEqual(signature,twilioFormSignature({authToken,url,params}));
}

function xml(value){return String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}

function gatherTwiml({action,prompt='WerkZ. Bitte nennen Sie Name, Ort, Material und Menge für die Abholung.'}={}){
  return '<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="speech" language="de-DE" speechTimeout="auto" method="POST" action="'+xml(action)+'"><Say language="de-DE">'+xml(prompt)+'</Say></Gather><Say language="de-DE">Ich habe keine Angabe verstanden. Bitte rufen Sie erneut an.</Say></Response>';
}
function resultTwiml(message='Danke. Der Auftrag wurde aufgenommen.'){
  return '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="de-DE">'+xml(message)+'</Say><Hangup/></Response>';
}

async function readForm(request,limit=64*1024){
  const chunks=[];let size=0;
  for await(const chunk of request){
    size+=chunk.length;
    if(size>limit)throw Object.assign(new Error('Twilio body too large'),{code:'PAYLOAD_TOO_LARGE'});
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function sendXml(response,status,body){
  response.writeHead(status,{'content-type':'text/xml; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
  response.end(body);
}
function sendText(response,status,body){
  response.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
  response.end(body);
}

function createTwilioVoiceWebhookHandler({authToken,publicBaseUrl,resolveTenantByCalledNumber,recordSpeech}={}){
  const secret=String(authToken||'').trim(),base=new URL(String(publicBaseUrl||''));
  if(base.protocol!=='https:')throw new Error('Twilio public base URL must use HTTPS');
  if(typeof resolveTenantByCalledNumber!=='function'||typeof recordSpeech!=='function')throw new Error('Twilio tenant resolver and recorder required');
  const origin=base.origin;
  return async function handleTwilioVoice(request,response){
    const requestUrl=String(request.url||'');
    const path=new URL(requestUrl,'http://werkz.invalid').pathname;
    if(path!=='/pilot/provider/twilio/voice'&&path!=='/pilot/provider/twilio/speech')return false;
    if(request.method!=='POST'){sendText(response,405,'Method not allowed');return true}
    if(!/^application\/x-www-form-urlencoded(?:;|$)/i.test(String(request.headers['content-type']||''))){sendText(response,415,'Unsupported media type');return true}
    let params;
    try{params=await readForm(request)}
    catch(error){sendText(response,error.code==='PAYLOAD_TOO_LARGE'?413:400,'Bad request');return true}
    const signature=request.headers['x-twilio-signature'];
    const exactUrl=origin+requestUrl;
    if(!validateTwilioFormRequest({authToken:secret,signature,url:exactUrl,params})){sendText(response,403,'Forbidden');return true}
    const called=normalizeTwilioNumber(params.get('To')),tenant=called&&resolveTenantByCalledNumber(called);
    if(!tenant){sendText(response,404,'Not found');return true}
    if(path.endsWith('/voice')){
      sendXml(response,200,gatherTwiml({action:'/pilot/provider/twilio/speech'}));
      return true;
    }
    const text=String(params.get('SpeechResult')||'').trim(),callSid=String(params.get('CallSid')||'').trim().slice(0,80);
    if(!text){
      sendXml(response,200,resultTwiml('Ich habe keine Angabe verstanden. Bitte rufen Sie erneut an.'));
      return true;
    }
    await recordSpeech({
      tenant,
      text:text.slice(0,4000),
      callSid,
      from:normalizeTwilioNumber(params.get('From')),
      to:called,
      confidence:Number.isFinite(Number(params.get('Confidence')))?Number(params.get('Confidence')):null
    });
    sendXml(response,200,resultTwiml());
    return true;
  };
}

module.exports={normalizeTwilioNumber,twilioFormSignature,validateTwilioFormRequest,gatherTwiml,resultTwiml,createTwilioVoiceWebhookHandler};
