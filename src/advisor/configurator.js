'use strict';
const crypto=require('node:crypto');
const {ModuleRegistry}=require('../modules/module-registry');
const {FEATURES,PLANNED,PACKAGES,CATEGORIES,catalog}=require('./catalog');
const RULES_VERSION='handwerk-configurator-2026-10-21-v2';
function invalid(message){throw Object.assign(new Error(message),{code:'VALIDATION_ERROR'});}
function text(input,key,max,required=false){const value=String(input[key]||'').trim();if(value.length>max||required&&!value)invalid('Bitte '+key+' prüfen.');return value;}
function buildConfiguration(input,{organisationId='org-werkz-intake',id='configuration_'+crypto.randomUUID(),clock=()=>new Date()}={}){
  if(!input||typeof input!=='object'||Array.isArray(input))invalid('Betriebsangaben fehlen.');
  const businessName=text(input,'businessName',160,true),industry=text(input,'industry',120,true),problems=text(input,'problems',2000,true),software=text(input,'software',500),specialRequirements=text(input,'specialRequirements',1000);
  if(input.synthetic!==true||!businessName.startsWith('SYNTHETISCH'))invalid('Diese Vorführung akzeptiert nur als SYNTHETISCH bezeichnete Beispieldaten.');
  const employees=Number(input.employees);if(!Number.isInteger(employees)||employees<1||employees>500)invalid('Mitarbeiterzahl fehlt oder ist ungültig.');
  const devices=Array.isArray(input.devices)?[...new Set(input.devices)]:[];if(!devices.length||devices.some(x=>!['smartphone','tablet','pc'].includes(x)))invalid('Bitte Geräte auswählen.');
  const workflows=Array.isArray(input.workflows)?input.workflows.map(String):[];if(workflows.length>8||workflows.some(x=>x.length>160))invalid('Arbeitsabläufe prüfen.');
  function keys(field){if(input[field]!==undefined&&!Array.isArray(input[field]))invalid('Bausteinauswahl prüfen.');const values=[...new Set(input[field]||[])];if(values.length>FEATURES.length||values.some(x=>!FEATURES.some(f=>f.key===x)))invalid('Unbekannter Baustein.');return values;}
  const needs=keys('needs'),selected=input.selectedModules===undefined?null:keys('selectedModules');
  const preferredPackage=input.preferredPackage||'';if(preferredPackage&&!PACKAGES.some(x=>x.id===preferredPackage))invalid('Unbekanntes Paket.');
  const chosen=FEATURES.filter(f=>selected?selected.includes(f.key)||needs.includes(f.key)&&!f.route:needs.includes(f.key)||f.matches.test(problems)||f.key==='customers').map(({matches,...feature})=>({...feature,reason:selected?.includes(feature.key)||needs.includes(feature.key)?'Von dir gewählt.':'Passend zu deinen beschriebenen Abläufen.'}));
  const modules=chosen.filter(x=>x.status==='demo_verified'),requestedExtensions=chosen.filter(x=>x.status!=='demo_verified');
  const registry=new ModuleRegistry();for(const feature of modules)registry.get(feature.moduleId);
  const minimumRank=Math.max(employees>25?2:employees>10?1:0,...chosen.map(f=>PACKAGES.find(p=>p.id===f.minimumPackage).rank));
  const recommended=PACKAGES[minimumRank],preferred=PACKAGES.find(x=>x.id===preferredPackage),selectedPackage=PACKAGES[Math.max(minimumRank,preferred?.rank||0)];
  const manualReasons=[];
  if(!/handwerk|dach|elektro|sanitär|sanitaer|heizung|maler|tischler/i.test(industry))manualReasons.push('Branche außerhalb des geprüften Handwerk-Profils');
  if(employees>10)manualReasons.push('Betriebsgröße und gemeinsamer Arbeitsablauf separat prüfen');
  const deployment=['cloud','hybrid','on-premise'].includes(input.deployment)?input.deployment:'open';if(deployment!=='cloud')manualReasons.push('Betriebsart oder Infrastruktur separat klären');
  if(specialRequirements)manualReasons.push('Sonderanforderungen manuell klären');
  if(!modules.length)manualReasons.push('Noch kein in der Demo verfügbarer Baustein ausgewählt');
  if(input.connectPrograms===true)manualReasons.push('Schnittstelle zu vorhandenen Programmen prüfen');
  if(selectedPackage.id!=='solo')manualReasons.push('Paketumfang '+selectedPackage.name+' muss individuell freigegeben werden');
  for(const extension of requestedExtensions)manualReasons.push(extension.label+' ist ein Planungswunsch und noch nicht in der Handwerker-Demo abgenommen');
  const deploymentSkus={cloud:['WZ-DEPLOY-CLOUD'],hybrid:['WZ-CONNECTOR-SETUP','WZ-CONNECTOR-OPS'],'on-premise':['WZ-ONPREM-SETUP','WZ-ONPREM-OPS'],open:[]}[deployment];
  const createdAt=clock().toISOString(),suffix=selectedPackage.id.toUpperCase();
  const draft=catalog.composeOffer({id:id+'-price',organisationId,setupSku:'WZ-SETUP-'+suffix,managedOperationSku:'WZ-OPS-'+suffix,deploymentSkus,createdAt});
  const total=billing=>draft.items.filter(x=>x.billing.startsWith(billing)).reduce((sum,x)=>sum+x.amountCents,0);
  const priceRuleEligible=manualReasons.length===0;
  const packageOptions=PACKAGES.map(p=>({...p,recommended:p.id===recommended.id,selected:p.id===selectedPackage.id,coversSelectedScope:p.rank>=minimumRank,reviewRequired:p.id!=='solo'||requestedExtensions.length>0}));
  const groups=CATEGORIES.map(category=>({...category,featureKeys:chosen.filter(x=>x.category===category.key).map(x=>x.key)})).filter(x=>x.featureKeys.length);
  return {schemaVersion:2,id,organisationId,createdAt,rulesVersion:RULES_VERSION,synthetic:true,status:priceRuleEligible?'draft':'manual_review_required',answers:{businessName,industry,employees,problems,devices,workflows,software,deployment,specialRequirements,needs,selectedModules:chosen.map(x=>x.key),preferredPackage,connectPrograms:input.connectPrograms===true},selectedFeatures:chosen,groups,modules,requestedExtensions,manualReasons,
    commercial:{status:'orientation_only',currency:'EUR',priceRuleEligible,setupCents:priceRuleEligible?total('one_time'):null,monthlyCents:priceRuleEligible?total('monthly'):null,pilotReference:{setupCents:PACKAGES[0].setupCents,monthlyCents:PACKAGES[0].monthlyCents},selectedPackage,recommendedPackageId:recommended.id,packages:packageOptions,recommendationReason:minimumRank===2?'Mehrere Standorte, umfassende Steuerung oder größere Betriebsstruktur sprechen für Business.':minimumRank===1?'Gemeinsame Planung, persönliche Zugänge oder verbundene Abläufe sprechen für Team.':'Die gewählten Startbausteine passen zum abgegrenzten Solo-/Pilotumfang mit einem Betriebszugang.',minimumKnownCost:{setupCents:total('one_time'),monthlyCents:total('monthly'),priceKind:'from',includesUnpricedWork:false},costLines:draft.items,unpricedWork:requestedExtensions.length>0||Boolean(specialRequirements)||input.connectPrograms===true||deployment==='open',draft,scope:'Gewählte Bausteine werden zu einem abgestimmten Paket gebündelt. Keine Einzelgebühr je Häkchen. Geplante Funktionen, Schnittstellen, Migration, Hardware und Sonderentwicklung sind im Basispreis nicht zugesagt.',taxNote:'Unverbindliche Preisorientierung. Steuerliche Preisangaben und endgültigen Leistungsumfang vor Angebotsfreigabe prüfen.'},
    approval:{required:true,approved:false,canProvision:false},deploymentPlan:{profile:'handwerk',mode:deployment,moduleIds:[...new Set(modules.map(x=>x.moduleId))],publishCustomerCode:false,automaticDeployment:false}};
}
module.exports={FEATURES,PLANNED,RULES_VERSION,buildConfiguration};
