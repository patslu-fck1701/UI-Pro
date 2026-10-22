'use strict';
const {requirePermission}=require('../security/handwerk-policy');
function accountingHandover(state,user,orderId,clock=()=>new Date()){
  requirePermission(user,'finance.read',{organisationId:user.organisationId});
  const order=(state.pilot.orders||[]).find(x=>x.id===orderId&&x.organisationId===user.organisationId);
  if(!order)throw Object.assign(Error('Auftrag nicht gefunden.'),{code:'NOT_FOUND'});
  const customer=(state.pilot.customers||[]).find(x=>x.id===order.customerId&&x.organisationId===user.organisationId);
  const times=Object.values(state.time.records).filter(x=>x.orderId===order.id&&x.organisationId===user.organisationId).map(x=>({id:x.id,actorId:x.actorId,startedAt:x.startedAt,endedAt:x.endedAt||null,minutes:x.endedAt?Math.max(0,Math.round((new Date(x.endedAt)-new Date(x.startedAt))/60000)):null}));
  const reports=(state.pilot.workEvidence||[]).filter(x=>x.orderId===order.id&&x.organisationId===user.organisationId).map(x=>({id:x.id,kind:x.kind,text:x.content?.text||''}));
  const checks=[{id:'customer',label:'Kunde zugeordnet',ok:Boolean(customer)},{id:'completed',label:'Auftrag abgeschlossen',ok:order.status==='completed'},{id:'approval',label:'Intern zur Abrechnung freigegeben',ok:order.billingState==='ready'},{id:'timers',label:'Alle Arbeitszeiten beendet',ok:times.every(x=>x.endedAt)},{id:'billing_address',label:'Rechnungsanschrift fachlich prüfen',ok:false},{id:'line_items',label:'Rechnungspositionen, Preise und Steuer festlegen',ok:false},{id:'provider',label:'sevdesk-Konto verbinden und Übertragung testen',ok:false}];
  return {schema:'werkz.accounting-handover.v1',createdAt:clock().toISOString(),organisationId:user.organisationId,kind:'preparation_only',provider:'sevdesk',providerConnected:false,transferEnabled:false,isInvoice:false,notice:'Arbeitsunterlage zur manuellen Prüfung. Keine Rechnung und keine sevdesk-Importdatei. Es wurde nichts übertragen.',order:{id:order.id,title:order.title,status:order.status,billingState:order.billingState,revision:order.revision},customer:customer?{id:customer.id,name:customer.name,contact:customer.contact||''}:null,times,totalMinutes:times.reduce((n,x)=>n+(x.minutes||0),0),reports,checks,missing:checks.filter(x=>!x.ok).map(x=>x.label)};
}
module.exports={accountingHandover};
