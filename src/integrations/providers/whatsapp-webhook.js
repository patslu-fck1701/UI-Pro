'use strict';
const crypto=require('node:crypto');
const PATH='/api/integrations/whatsapp/webhook';
function safeMatch(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length>0&&x.length===y.length&&crypto.timingSafeEqual(x,y)}
function reply(response,status,message,type='application/json'){
  response.writeHead(status,{'content-type':type+'; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
  response.end(type==='application/json'?JSON.stringify({error:message}):message);
}
async function readRaw(request,limit=262144){const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>limit){const err=new Error('payload too large');err.status=413;throw err;}chunks.push(chunk);}return Buffer.concat(chunks)}
function createWhatsAppWebhook({verifyToken=process.env.WERKZ_WHATSAPP_VERIFY_TOKEN,appSecret=process.env.WERKZ_WHATSAPP_APP_SECRET,onEvent=async()=>{}}={}){
  const enabled=Boolean(verifyToken&&appSecret);
  return async function handle(request,response,url){
    if(url.pathname!==PATH)return false;
    if(!enabled){reply(response,503,'WHATSAPP_NOT_CONFIGURED');return true;}
    if(request.method==='GET'){
      if(url.searchParams.get('hub.mode')==='subscribe'&&safeMatch(url.searchParams.get('hub.verify_token'),verifyToken)&&url.searchParams.has('hub.challenge')){
        const challenge=url.searchParams.get('hub.challenge');
        if(challenge.length>2048){reply(response,400,'INVALID_CHALLENGE');return true;}
        reply(response,200,challenge,'text/plain');return true;
      }
      reply(response,403,'VERIFICATION_FAILED');return true;
    }
    if(request.method!=='POST'){response.setHeader('allow','GET, POST');reply(response,405,'METHOD_NOT_ALLOWED');return true;}
    try{
      const raw=await readRaw(request);
      const header=String(request.headers['x-hub-signature-256']||'');
      const expected='sha256='+crypto.createHmac('sha256',appSecret).update(raw).digest('hex');
      if(!safeMatch(header,expected)){reply(response,403,'INVALID_SIGNATURE');return true;}
      let payload;try{payload=JSON.parse(raw.toString('utf8'))}catch{reply(response,400,'INVALID_JSON');return true;}
      if(!payload||payload.object!=='whatsapp_business_account'||!Array.isArray(payload.entry)){reply(response,400,'INVALID_PAYLOAD');return true;}
      await onEvent(payload);
      response.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify({received:true}));return true;
    }catch(e){reply(response,e.status===413?413:503,e.status===413?'PAYLOAD_TOO_LARGE':'WEBHOOK_UNAVAILABLE');return true;}
  };
}
module.exports={PATH,createWhatsAppWebhook};
