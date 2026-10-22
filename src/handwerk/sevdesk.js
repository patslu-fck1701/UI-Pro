'use strict';
function failure(code,message){throw Object.assign(Error(message),{code});}
function token(value){const result=String(value||'').trim();return /^[a-f0-9]{32}$/i.test(result)?result:null;}
function endpoint(value){const url=new URL(String(value||'https://my.sevdesk.de/api/v1/'));if(url.protocol!=='https:'||url.hostname!=='my.sevdesk.de'||url.pathname!=='/api/v1/')failure('SEVDESK_CONFIGURATION','sevdesk-Endpunkt ist ungültig.');return url;}
class SevdeskReadOnlyProbe{
  constructor({apiToken='',baseUrl='https://my.sevdesk.de/api/v1/',fetchImpl=fetch}={}){this.apiToken=token(apiToken);this.baseUrl=endpoint(baseUrl);this.fetchImpl=fetchImpl;}
  configured(){return Boolean(this.apiToken);}
  async status(){if(!this.configured())return {provider:'sevdesk',configured:false,connected:false,readOnly:true,writeEnabled:false,message:'API-Token fehlt.'};let response;try{response=await this.fetchImpl(new URL('Contact?limit=1',this.baseUrl),{method:'GET',headers:{authorization:this.apiToken,accept:'application/json'},redirect:'error'});}catch{failure('SEVDESK_UNAVAILABLE','sevdesk ist derzeit nicht erreichbar.');}if(response.status===401||response.status===403)return {provider:'sevdesk',configured:true,connected:false,readOnly:true,writeEnabled:false,message:'API-Zugang wurde abgewiesen.'};if(!response.ok)failure('SEVDESK_UNAVAILABLE','sevdesk-Verbindung konnte nicht geprüft werden.');return {provider:'sevdesk',configured:true,connected:true,readOnly:true,writeEnabled:false,message:'Lesende Verbindung geprüft. Rechnungen, Versand und Zahlungen bleiben deaktiviert.'};}
}
module.exports={SevdeskReadOnlyProbe};
