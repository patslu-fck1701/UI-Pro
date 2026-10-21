'use strict';
const crypto=require('node:crypto');
const {ModuleRegistry}=require('../modules/module-registry');
const {CommercialCatalog}=require('../commercial/catalog');
const RULES_VERSION='handwerk-pilot-2026-10-20';
const FEATURES=Object.freeze([
  {key:'customers',moduleId:'werkz.customers',label:'Kunden',benefit:'Kontakte und Einsatzadressen an einem Ort.',route:'/pilot/handwerk/#customers',matches:/kunde|kontakt/i},
  {key:'inquiries',moduleId:'werkz.simple',label:'Anfragen und Rückrufe',benefit:'Anliegen erfassen und erledigte Rückrufe nachvollziehen.',route:'/pilot/handwerk/#inquiries',matches:/anfrag|rückruf|rueckruf|telefon|zettel/i},
  {key:'time',moduleId:'werkz.time',label:'Arbeitszeiten',benefit:'Zeit je Kunde oder Einsatz starten und stoppen.',route:'/',matches:/zeit|stund|einsatz/i},
  {key:'documents',moduleId:'werkz.documents',label:'Belegablage',benefit:'Dateien ablegen und die Zuordnung manuell prüfen.',route:'/pilot/handwerk/#documents',matches:/beleg|foto|datei|dokument/i},
  {key:'export',moduleId:'werkz.billing-prep',label:'Monatsvorbereitung',benefit:'Belege für eine manuelle Monatsprüfung zusammenstellen.',route:'/pilot/handwerk/#documents',matches:/monat|steuer|abrechn/i}
]);
const PLANNED=Object.freeze({orders:'Auftragsplanung',integrations:'Programmschnittstellen',analytics:'Analyse',simulation:'Simulation',approvals:'Freigabeabläufe',roles:'Individuelle Mitarbeiterzugänge',offline:'Offline-Betrieb außerhalb der Zeitfunktion',voice:'Telefon-KI',recognition:'Automatische Belegerkennung'});
function invalid(message){throw Object.assign(new Error(message),{code:'VALIDATION_ERROR'});}
function text(input,key,max,required=false){const value=String(input[key]||'').trim();if(value.length>max||required&&!value)invalid('Bitte '+key+' prüfen.');return value;}
function buildConfiguration(input,{organisationId='org-werkz-intake',id='configuration_'+crypto.randomUUID(),clock=()=>new Date()}={}){
  if(!input||typeof input!=='object'||Array.isArray(input))invalid('Betriebsangaben fehlen.');
  const businessName=text(input,'businessName',160,true),industry=text(input,'industry',120,true),problems=text(input,'problems',2000,true),software=text(input,'software',500),specialRequirements=text(input,'specialRequirements',1000);
  if(input.synthetic!==true||!businessName.startsWith('SYNTHETISCH'))invalid('Diese Vorführung akzeptiert nur als SYNTHETISCH bezeichnete Beispieldaten.');
  const employees=Number(input.employees);if(!Number.isInteger(employees)||employees<1||employees>500)invalid('Mitarbeiterzahl fehlt oder ist ungültig.');
  const devices=Array.isArray(input.devices)?[...new Set(input.devices)]:[];if(!devices.length||devices.some(x=>!['smartphone','tablet','pc'].includes(x)))invalid('Bitte Geräte auswählen.');
  const workflows=Array.isArray(input.workflows)?input.workflows.map(String):[];if(workflows.length>8||workflows.some(x=>x.length>160))invalid('Arbeitsabläufe prüfen.');
  const needs=Array.isArray(input.needs)?[...new Set(input.needs)]:[];if(needs.some(x=>!FEATURES.some(f=>f.key===x)&&!Object.hasOwn(PLANNED,x)))invalid('Unbekannter Baustein.');
  const selected=Array.isArray(input.selectedModules)?[...new Set(input.selectedModules)]:null;
  if(selected&&selected.some(x=>!FEATURES.some(f=>f.key===x)))invalid('Nicht verfügbarer Vorschau-Baustein.');
  const modules=FEATURES.filter(f=>selected?selected.includes(f.key):(needs.includes(f.key)||f.matches.test(problems)||f.key==='customers')).map(({matches,...feature})=>({...feature,status:'demo_verified',reason:needs.includes(feature.key)?'Von dir gewünscht.':'Passend zum beschriebenen Arbeitsablauf.'}));
  const registry=new ModuleRegistry();for(const feature of modules)registry.get(feature.moduleId);
  const requestedExtensions=needs.filter(x=>Object.hasOwn(PLANNED,x)).map(key=>({key,label:PLANNED[key],status:'manual_review_required'}));
  const manualReasons=[];if(!/handwerk|dach|elektro|sanitär|sanitaer|heizung|maler|tischler/i.test(industry))manualReasons.push('Branche außerhalb des geprüften Handwerk-Profils');
  if(employees>10)manualReasons.push('Mehr als zehn Mitarbeitende');
  const deployment=['cloud','hybrid','on-premise'].includes(input.deployment)?input.deployment:'open';if(deployment!=='cloud')manualReasons.push('Betriebsart oder Infrastruktur separat klären');
  if(specialRequirements)manualReasons.push('Sonderanforderungen manuell klären');
  if(!modules.length)manualReasons.push('Noch kein verfügbarer Baustein ausgewählt');
  if(input.connectPrograms===true)manualReasons.push('Schnittstelle zu vorhandenen Programmen prüfen');
  for(const extension of requestedExtensions)manualReasons.push(extension.label+' ist nicht Bestandteil der geprüften Startkonfiguration');
  const priceRuleEligible=manualReasons.length===0;
  const catalog=new CommercialCatalog({version:RULES_VERSION,currency:'EUR',items:[{sku:'PILOT-SETUP',name:'Abgegrenzte Piloteinrichtung',billing:'one_time',amountCents:49000},{sku:'PILOT-OPERATION',name:'Vereinbarter Pilotbetrieb',billing:'monthly',amountCents:7900}]});
  const draft=catalog.quote({id:id+'-price',organisationId,skus:['PILOT-SETUP','PILOT-OPERATION']});
  return {schemaVersion:1,id,organisationId,createdAt:clock().toISOString(),rulesVersion:RULES_VERSION,synthetic:true,status:priceRuleEligible?'draft':'manual_review_required',answers:{businessName,industry,employees,problems,devices,workflows,software,deployment,specialRequirements,needs,connectPrograms:input.connectPrograms===true},modules,requestedExtensions,manualReasons,commercial:{status:'orientation_only',currency:'EUR',priceRuleEligible,setupCents:priceRuleEligible?49000:null,monthlyCents:priceRuleEligible?7900:null,pilotReference:{setupCents:49000,monthlyCents:7900},draft,scope:'Ein abgegrenzter Handwerksablauf, ein Betriebszugang; gewählte vorhandene Bausteine. Keine Schnittstellen, Migration oder Sonderentwicklung.',taxNote:'Steuerliche Preisangaben und endgültigen Leistungsumfang vor Angebotsfreigabe prüfen.'},approval:{required:true,approved:false,canProvision:false},deploymentPlan:{profile:'handwerk',mode:deployment,moduleIds:[...new Set(modules.map(x=>x.moduleId))],publishCustomerCode:false,automaticDeployment:false}};
}
module.exports={FEATURES,PLANNED,RULES_VERSION,buildConfiguration};
