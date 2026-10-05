'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  WerkZSimplePilotService,
  MemoryPilotRepository,
  FilePilotRepository,
  parseOperationalNote,
  FakeVoiceProvider,
  FakeMailProvider,
  FakeExtractor,
  DraftMailProvider,
  StaticMarketProvider,
  StaticPortfolioProvider,
  StaticScrapPriceProvider,
  LiveScrapPriceProvider
}=require('../src/pilot');

class Auth{
  resolveSession(token){
    if(token==='a')return {organisationId:'org-a',actorId:'a',role:'owner',capabilities:['pilot.read','pilot.write']};
    if(token==='b')return {organisationId:'org-b',actorId:'b',role:'owner',capabilities:['pilot.read','pilot.write']};
    throw Object.assign(new Error('bad'),{code:'UNAUTHENTICATED'});
  }
}
class Ent{
  isActive(){return false;}
  require(org,moduleId){
    if(!['werkz.simple','werkz.documents','werkz.billing-prep','werkz.channel.gmail','werkz.crypto-monitor'].includes(moduleId)){
      throw Object.assign(new Error('denied'),{code:'ENTITLEMENT_DENIED'});
    }
    return {organisationId:org,moduleId};
  }
}
function svc({repository=new MemoryPilotRepository(),voiceDiagnosticOrganisationIds=[]}={}){
  return new WerkZSimplePilotService({
    auth:new Auth(),
    entitlements:new Ent(),
    repository,voiceDiagnosticOrganisationIds,
    storage:{put:x=>({fileName:x.fileName,mime:x.mime,size:x.bytes.length})},
    voice:new FakeVoiceProvider(),
    mail:new FakeMailProvider(),
    extractor:new FakeExtractor(),
    outbound:new DraftMailProvider(),
    market:new StaticMarketProvider({source:'demo',live:false}),
    portfolio:new StaticPortfolioProvider({source:'demo',live:false}),
    scrapPrices:new StaticScrapPriceProvider({source:'demo',asOf:'2026-10-04T08:00:00Z',items:[]}),
    clock:()=>new Date('2026-10-04T08:00:00Z')
  });
}

test('live scrap provider rejects HTTP-success pages with no parsable prices instead of caching zeroes',async()=>{
  const fallback={source:'WerkZ fallback',live:false,asOf:'2026-10-04T10:40:00Z',items:[{key:'mixed-scrap',label:'Mischschrott',unit:'EUR/t',priceMin:180,priceMax:210},{key:'copper',label:'Kupfer',unit:'EUR/kg',priceMin:9.8,priceMax:10.6}]};
  const fetchFn=async()=>({ok:true,status:200,text:async()=>'<html><body>temporär keine Preisdaten</body></html>'});
  const p=new LiveScrapPriceProvider({fetchFn,fallback,ttlMs:900000});const x=await p.snapshot({force:true});assert.equal(x.live,false);assert.equal(x.stale,true);assert.equal(x.items.find(v=>v.key==='mixed-scrap').priceMin,180);assert.equal(x.items.find(v=>v.key==='copper').priceMax,10.6);assert.equal(x.items.some(v=>v.price===0||v.priceMin===0||v.priceMax===0),false);
});

test('every voice capture creates an open pickup order',()=>{
  const s=svc();
  const note=s.addNote('a','Müller Hauptstraße 12 Kupfer 200 kg morgen','voice-1');
  assert.ok(note.call);
  assert.equal(note.call.category,'Abholung');
  assert.equal(note.call.status,'neu');
  assert.equal(note.call.source,'voice-note');
  const plan=s.routePlan('a');
  assert.equal(plan.stops.length,1);
  assert.equal(plan.stops[0].source,'voice-note');
  assert.match(plan.stops[0].originalText,/Müller/);
});

test('voice order remains tenant isolated',()=>{
  const s=svc();
  s.addNote('a','Kupfer 200 kg morgen','voice-2');
  assert.equal(s.routePlan('a').stops.length,1);
  assert.equal(s.routePlan('b').stops.length,0);
});

test('voice mutation id prevents duplicate orders on replay',()=>{
  const s=svc();
  s.addNote('a','Kupfer 200 kg morgen','voice-3');
  const replay=s.addNote('a','Kupfer 200 kg morgen','voice-3');
  assert.equal(replay.replayed,true);
  assert.equal(s.listCalls('a').length,1);
});


test('missing pilot session is unauthenticated, not validation error',()=>{
  const s=svc();
  assert.throws(()=>s.summary(null),err=>{
    assert.equal(err.code,'UNAUTHENTICATED');
    assert.match(String(err.message),/session required/i);
    return true;
  });
});


test('spoken Eisenschrott and lowercase town are parsed into the order',()=>{
  const s=svc();
  const note=s.addNote('a','morgen 2500 kilo eisenschrott in alfeld abholen','voice-place-1');
  assert.equal(note.call.materialKey,'mixed-scrap');
  assert.equal(note.call.material,'Mischschrott');
  assert.equal(note.call.estimatedWeightKg,2500);
  assert.equal(note.call.location,'alfeld');
  assert.equal(note.call.scheduledFor,'2026-10-05');
  const plan=s.routePlan('a');
  assert.equal(plan.stops[0].material,'Mischschrott');
  assert.equal(plan.stops[0].location,'alfeld');
  assert.equal(plan.stops[0].estimatedWeightKg,2500);
});

test('spoken address formats keep street and postal town',()=>{
  const s=svc();
  const first=s.addNote('a','Kupfer 80 kg Hauptstraße 12 31061 Alfeld morgen','voice-place-2');
  assert.match(first.call.location,/Hauptstraße 12/i);
  const second=s.addNote('a','Messing 50 kg Ort Delligsen heute','voice-place-3');
  assert.equal(second.call.location,'Delligsen');
});

test('specific materials win over generic scrap words',()=>{
  const s=svc();
  assert.equal(s.addNote('a','Kupfer Schrott 100 kg in alfeld','voice-material-1').call.materialKey,'copper');
  assert.equal(s.addNote('a','Kupferkabel 100 kg in alfeld','voice-material-2').call.materialKey,'cable');
  assert.equal(s.addNote('a','Schwerschrott 100 kg in alfeld','voice-material-3').call.materialKey,'grade-3');
});


test('reconcile reparses existing voice orders with missing material and location',()=>{
  const s=svc();
  const note=s.addNote('a','morgen 2500 kilo eisenschrott in alfeld abholen','voice-old-1');
  s.repository.update('org-a','calls',note.call.id,{materialKey:'',material:'',location:''});
  const result=s.reconcileContacts('a');
  const call=s.listCalls('a').find(x=>x.id===note.call.id);
  assert.ok(result.reparsedCalls>=1);
  assert.equal(call.materialKey,'mixed-scrap');
  assert.equal(call.material,'Mischschrott');
  assert.equal(call.location,'alfeld');
  assert.equal(result.createdCustomers,0);
});


test('iPhone misrecognition "Schritte" still yields Alfeld, scrap and tonnes',()=>{
  const s=svc();
  const note=s.addNote('a','Morgen in Alfeld 2,15 Schritte','voice-ios-steps-1');
  assert.equal(note.call.location,'Alfeld');
  assert.equal(note.call.materialKey,'mixed-scrap');
  assert.equal(note.call.material,'Mischschrott');
  assert.equal(note.call.estimatedWeightKg,2150);
  assert.equal(note.call.scheduledFor,'2026-10-05');
});


test('Android-style spoken full address keeps street house number postcode and town',()=>{
  const s=svc();
  const note=s.addNote('a','Morgen Teststraße, Hausnummer 12, Postleitzahl 31061, Ort Alfeld, 2 Tonnen Schrott abholen','voice-android-address-1');
  assert.equal(note.call.location,'Teststraße 12, 31061 Alfeld');
  assert.equal(note.call.materialKey,'mixed-scrap');
  assert.equal(note.call.estimatedWeightKg,2000);
  assert.equal(note.call.scheduledFor,'2026-10-05');
});

test('plain Android full address without spoken labels is preserved',()=>{
  const s=svc();
  const note=s.addNote('a','Morgen Teststraße 12 31061 Alfeld 2 Tonnen Schrott abholen','voice-android-address-2');
  assert.equal(note.call.location,'Teststraße 12, 31061 Alfeld');
});


test('route plan repairs old Android voice call from stored raw topic even when parsed fields are blank',()=>{
  const s=svc();
  const note=s.addNote('a','Morgen Teststraße 12 31061 Alfeld 2 Tonnen Schrott abholen','voice-old-android-raw');
  s.repository.update('org-a','calls',note.call.id,{
    location:'',material:'',materialKey:'',quantity:'',estimatedWeightKg:null,scheduledFor:null
  });
  const stop=s.routePlan('a').stops.find(x=>x.id===note.call.id);
  assert.ok(stop);
  assert.equal(stop.location,'Teststraße 12, 31061 Alfeld');
  assert.equal(stop.material,'Mischschrott');
  assert.equal(stop.materialKey,'mixed-scrap');
  assert.equal(stop.estimatedWeightKg,2000);
  assert.equal(stop.quantity,'2000 kg');
  assert.equal(stop.scheduledFor,'2026-10-05');
});


test('deleteCall removes the order and its source voice note only in the current tenant',()=>{
  const s=svc();
  const a=s.addNote('a','morgen in Alfeld 500 kg Schrott','delete-a');
  const b=s.addNote('b','morgen in Hameln 600 kg Schrott','delete-b');
  assert.equal(s.listCalls('a').length,1);
  assert.equal(s.listCalls('b').length,1);

  const result=s.deleteCall('a',a.call.id,{clientMutationId:'delete:'+a.call.id});
  assert.equal(result.deleted,true);
  assert.equal(result.sourceNoteRemoved,true);
  assert.equal(s.listCalls('a').length,0);
  assert.equal(s.routePlan('a').stops.length,0);
  assert.equal(s.listCalls('b').length,1);
  assert.equal(s.routePlan('b').stops[0].id,b.call.id);
  assert.equal(s.repository.list('org-a','notes').some(x=>x.id===a.id),false);
  assert.equal(s.repository.list('org-b','notes').some(x=>x.id===b.id),true);
});

test('deleteCall is idempotent when an offline retry reaches an already deleted order',()=>{
  const s=svc();
  const a=s.addNote('a','morgen in Alfeld 500 kg Schrott','delete-idempotent');
  assert.equal(s.deleteCall('a',a.call.id).deleted,true);
  const replay=s.deleteCall('a',a.call.id);
  assert.equal(replay.deleted,false);
  assert.equal(replay.missing,true);
  assert.equal(replay.id,a.call.id);
});


test('spoken Sorte drei is grade 3 even without weight or location',()=>{
  const s=svc();
  for(const [id,text] of [
    ['voice-grade3-1','Sorte 3 abholen'],
    ['voice-grade3-2','Sorte drei abholen'],
    ['voice-grade3-3','Sorte Nummer drei abholen']
  ]){
    const note=s.addNote('a',text,id);
    assert.equal(note.call.materialKey,'grade-3');
    assert.equal(note.call.material,'Sorte 3');
    assert.equal(note.call.status,'neu');
  }
});

test('completed pickup replay with another mutation id cannot duplicate load cash or receipt',async()=>{const s=svc();const call=await s.recordCall('a',{name:'Müller',topic:'Metall abholen',estimatedWeightKg:420});const first=s.completeCall('a',call.id,{boughtScrap:true,customerPayoutEur:75,receiptPresent:false,addToLoad:true,weightKg:420,materialKey:'mixed-scrap',materialLabel:'Mischschrott',clientMutationId:'complete-first'});const second=s.completeCall('a',call.id,{boughtScrap:false,customerPayoutEur:0,receiptPresent:true,addToLoad:true,weightKg:900,clientMutationId:'complete-second'});assert.equal(second.replayed,true);assert.equal(second.call.id,first.call.id);assert.equal(second.call.customerPayoutEur,75);assert.equal(second.call.actualWeightKg,420);assert.equal(s.listCashEntries('a').length,1);assert.equal(s.listMissingDocuments('a').length,1);assert.equal((await s.vehicleLoadSummary('a')).totalWeightKg,420);assert.equal(s.listCalls('b').length,0)});

test('pilot session exposes configured account emails only for its tenant',()=>{const s=svc(),resolve=s.auth.resolveSession.bind(s.auth);s.auth.resolveSession=token=>({...resolve(token),...(token==='a'?{accountEmails:['owner@example.invalid','backup@example.invalid']}:{})});assert.deepEqual(s.sessionInfo('a').accountEmails,['owner@example.invalid','backup@example.invalid']);assert.equal(s.sessionInfo('b').accountEmails,undefined)});

test('free spoken material and kilometres are persisted in the order',()=>{const s=svc(),n=s.addNote('a','Kaputte Panzer abholen, 18 Kilometer','voice-free-18');assert.equal(n.call.material,'Kaputte Panzer');assert.equal(n.call.materialKey,'');assert.equal(n.call.distanceKm,18);const stored=s.listCalls('a').find(x=>x.id===n.call.id);assert.equal(stored.material,'Kaputte Panzer');assert.equal(stored.distanceKm,18);const stop=s.routePlan('a').stops.find(x=>x.id===n.call.id);assert.equal(stop.material,'Kaputte Panzer');assert.equal(stop.distanceKm,18)});
test('grade 3 word and numeral preserve spoken distance',()=>{const s=svc();for(const [id,text,km] of [['grade-word-km','Sorte drei, 7 Kilometer',7],['grade-digit-km','Sorte 3 abholen, 12 km',12]]){const n=s.addNote('a',text,id);assert.equal(n.call.material,'Sorte 3');assert.equal(n.call.distanceKm,km);assert.equal(s.listCalls('a').find(x=>x.id===n.call.id).distanceKm,km)}});
test('missing distance stays null, including legacy voice orders',()=>{const s=svc(),n=s.addNote('a','Sorte drei abholen','grade-no-km');assert.equal(n.call.distanceKm,null);assert.equal(s.routePlan('a').stops[0].distanceKm,null);s.repository.update('org-a','calls',n.call.id,{material:'',distanceKm:null});const repaired=s.routePlan('a').stops[0];assert.equal(repaired.material,'Sorte 3');assert.equal(repaired.distanceKm,null)});
test('existing voice order can be reparsed and completed or deleted without losing material/km',()=>{const s=svc(),n=s.addNote('a','Kaputte Panzer abholen, 18 Kilometer','existing-voice-18');s.repository.update('org-a','calls',n.call.id,{material:'',distanceKm:null});s.reconcileContacts('a');const saved=s.listCalls('a').find(x=>x.id===n.call.id);assert.equal(saved.material,'Kaputte Panzer');assert.equal(saved.distanceKm,18);const completed=s.completeCall('a',n.call.id,{clientMutationId:'done-existing'});assert.equal(completed.call.material,'Kaputte Panzer');assert.equal(completed.call.distanceKm,18);assert.equal(s.deleteCall('a',n.call.id).deleted,true)});

test('spoken tour destination, material and km enter the same open order',()=>{const s=svc(),n=s.addNote('a','Ukraine, kaputte Panzer abholen, 1400 Kilometer','tour-ukraine');assert.equal(n.call.location,'Ukraine');assert.equal(n.call.material,'Kaputte Panzer');assert.equal(n.call.distanceKm,1400);const stop=s.routePlan('a').stops.find(x=>x.id===n.call.id);assert.equal(stop.location,'Ukraine');assert.equal(stop.material,'Kaputte Panzer');assert.equal(stop.distanceKm,1400)});
test('driver order overrides distance and completion promotes next open stop',()=>{const s=svc(),a=s.addNote('a','EZB Frankfurt, Sorte drei abholen, 280 Kilometer','tour-frankfurt'),b=s.addNote('a','Ukraine, kaputte Panzer abholen, 1400 Kilometer','tour-ukraine-2');assert.deepEqual(s.saveRouteOrder('a',{ids:[b.call.id,a.call.id]}).ids,[b.call.id,a.call.id]);assert.deepEqual(s.routePlan('a').stops.map(x=>x.id),[b.call.id,a.call.id]);assert.equal(s.routePlan('b').stops.length,0);s.completeCall('a',b.call.id,{clientMutationId:'done-tour'});assert.deepEqual(s.routePlan('a').stops.map(x=>x.id),[a.call.id]);assert.equal(s.routePlan('a').stops[0].material,'Sorte 3');assert.throws(()=>s.saveRouteOrder('b',{ids:[a.call.id]}),e=>e.code==='VALIDATION_ERROR')});

test('monthly economics separates receipts, stated km and incomplete costs by tenant',()=>{const s=svc(),n=s.addNote('a','Sorte 3 abholen, 18 Kilometer','econ-18');s.completeCall('a',n.call.id,{clientMutationId:'econ-done',boughtScrap:true,customerPayoutEur:40});s.recordSettlement('a',{dealer:'Händler Eins',materialKey:'grade-3',materialLabel:'Sorte 3',weightKg:1000,totalEur:300,date:'2026-10-04'});s.repository.add('documents',{id:'fuel-1',organisationId:'org-a',receiptCategory:'tanken',expenseClass:'betrieblich',date:'2026-10-04',amount:50});s.repository.add('documents',{id:'fuel-unknown',organisationId:'org-a',receiptCategory:'tanken',expenseClass:'pruefen',date:'2026-10-04',amount:null});s.repository.add('documents',{id:'fuel-other',organisationId:'org-b',receiptCategory:'tanken',expenseClass:'betrieblich',date:'2026-10-04',amount:999});s.saveOperatingProfile('a',{baseLocation:'Alfeld',vehicleCostPerKm:0.5});const x=s.monthlyEconomics('a','2026-10');assert.equal(x.baseLocation,'Alfeld');assert.equal(x.statedDistanceKm,18);assert.equal(x.fuelReceipts,2);assert.equal(x.fuelReceiptsWithAmount,1);assert.equal(x.fuelExpenseEur,50);assert.equal(x.weighSlipRevenueEur,300);assert.equal(x.pickupPayoutEur,40);assert.equal(x.knownContributionEur,210);assert.equal(x.estimatedVehicleCostEur,9);assert.equal(x.estimatedCostIsAlternativeToFuel,true);assert.equal(x.missing.fuelAmounts,1);assert.equal(s.monthlyEconomics('b','2026-10').fuelExpenseEur,999);assert.equal(s.monthlyEconomics('b','2026-10').weighSlipRevenueEur,0)});

test('operating profile persists across repository reload and stays tenant-scoped',()=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-operating-profile-'));
  try{const file=path.join(dir,'pilot.json'),a=svc({repository:new FilePilotRepository(file)});a.saveOperatingProfile('a',{baseLocation:'Alfeld',vehicleCostPerKm:null});assert.equal(a.operatingProfile('a').baseLocation,'Alfeld');assert.equal(a.operatingProfile('b').baseLocation,'');const b=svc({repository:new FilePilotRepository(file)});assert.equal(b.operatingProfile('a').baseLocation,'Alfeld');assert.equal(b.operatingProfile('a').vehicleCostPerKm,null);assert.equal(b.operatingProfile('b').baseLocation,'')}
  finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('fuel upload without extracted amount stays unknown in monthly view',async()=>{const s=svc();s.extractor={extract:async()=>({type:'Kassenbon',company:'Tankstelle',amount:null})};const doc=await s.addDocument('a',{fileName:'tank.jpg',mime:'image/jpeg',dataBase64:Buffer.from('test-image').toString('base64'),receiptCategory:'tanken'});assert.equal(doc.amount,null);const month=s.monthlyEconomics('a','2026-10');assert.equal(month.fuelReceipts,1);assert.equal(month.fuelReceiptsWithAmount,0);assert.equal(month.missing.fuelAmounts,1);assert.equal(month.fuelExpenseEur,0)});

test('voice relation uses sourceNoteId and deletion removes only the linked planned work item',()=>{
  const s=svc(),n=s.addNote('a','Ich will zum Nordpol fahren und Schnee holen.','ghost-1');
  assert.equal(n.call.sourceNoteId,n.id);assert.equal(n.workItem.sourceNoteId,n.id);assert.equal(n.workItem.sourceCallId,undefined);
  const other=s.addNote('b','Ich will zum Nordpol fahren und Schnee holen.','other-tenant');
  const result=s.deleteCall('a',n.call.id,{clientMutationId:'delete:'+n.call.id});
  assert.deepEqual(result.removedWorkItemIds,[n.workItem.id]);assert.equal(result.removedNoteId,n.id);
  assert.equal(s.routePlan('a').stops.length,0);assert.equal(s.routePlan('b').stops.length,1);
  assert.ok(s.repository.find('org-b','workItems',other.workItem.id));
  assert.equal(s.deleteCall('a',n.call.id).missing,true);
});
test('legacy orphaned voice work item is not resurrected by route plan',()=>{
  const s=svc(),n=s.addNote('a','Ich will zum Nordpol fahren und Schnee holen.','legacy-orphan');
  s.repository.remove('org-a','calls',n.call.id);s.repository.remove('org-a','notes',n.id);
  assert.ok(s.repository.find('org-a','workItems',n.workItem.id));
  assert.equal(s.routePlan('a').stops.length,0);
});
test('voice deletion remains gone after file repository reload',()=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-voice-delete-'));
  try{const file=path.join(dir,'pilot.json'),s=svc({repository:new FilePilotRepository(file)}),n=s.addNote('a','Ich will zum Nordpol fahren und Schnee holen.','persist-ghost');
    s.deleteCall('a',n.call.id);const again=svc({repository:new FilePilotRepository(file)});
    assert.equal(again.routePlan('a').stops.length,0);assert.equal(again.repository.find('org-a','workItems',n.workItem.id),null)
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('natural zu zum zur targets and existing street address parse consistently',()=>{
  for(const [raw,want] of [['Ich will zum Nordpol fahren und Schnee holen.','Nordpol'],['Ich möchte zum Nordpol.','Nordpol'],['Zum Nordpol fahren und Schnee holen.','Nordpol'],['Zum Weihnachtsmann an den Nordpol fahren.','Nordpol'],['Ich muss zur Firma Müller.','Firma Müller'],['Ich fahre zu Meyer und hole Schrott.','Meyer'],['Gallusanlage 7, 60329','Gallusanlage 7, 60329']])assert.equal(parseOperationalNote(raw).location,want,raw);
  assert.equal(parseOperationalNote('Ich will zum Nordpol fahren und Schnee holen.').materialLabel,'Schnee');
  assert.notEqual(parseOperationalNote('Ich fahre zu Meyer und hole Schrott.').materialLabel,'Meyer');
});
test('voice diagnostics are opt-in, owner-only, tenant-scoped and redact secrets',()=>{
  const s=svc({voiceDiagnosticOrganisationIds:['org-a']});
  assert.throws(()=>s.listVoiceDiagnostics('b'),e=>e.code==='FORBIDDEN');
  const n=s.addNote('a','Ich will zum Nordpol fahren und Schnee holen. Passwort ist geheim','diagnostic-1');
  let rows=s.listVoiceDiagnostics('a');assert.equal(rows.length,1);assert.equal(rows[0].noteId,n.id);assert.equal(rows[0].callId,n.call.id);assert.equal(rows[0].workItemId,n.workItem.id);assert.doesNotMatch(rows[0].recognizedText,/geheim/);
  const result=s.deleteCall('a',n.call.id);rows=s.listVoiceDiagnostics('a');assert.equal(rows[0].syncStatus,'deleted');assert.deepEqual(rows[0].removedIds,[n.call.id,n.id,n.workItem.id]);assert.deepEqual(result.removedWorkItemIds,[n.workItem.id]);assert.equal(s.listVoiceDiagnostics('a').length,1);
  const off=svc();assert.throws(()=>off.listVoiceDiagnostics('a'),e=>e.code==='FORBIDDEN');
});

test('opt-in diagnostics inventories older orphaned voice work without deleting it',()=>{
  const s=svc(),n=s.addNote('a','Ich will zum Nordpol fahren und Schnee holen.','pre-diagnostic');
  s.repository.remove('org-a','calls',n.call.id);s.repository.remove('org-a','notes',n.id);
  s.voiceDiagnosticOrganisationIds.add('org-a');
  const rows=s.listVoiceDiagnostics('a');
  assert.equal(rows.length,1);assert.equal(rows[0].syncStatus,'legacy-orphan');assert.equal(rows[0].workItemId,n.workItem.id);
  assert.ok(s.repository.find('org-a','workItems',n.workItem.id));
  assert.equal(s.routePlan('a').stops.length,0);
});

test('calculator transfer creates one normal tenant-scoped call with planned payout only',async()=>{
  const s=svc(),estimate={id:'pickup-calc-1',organisationId:'org-a',createdAt:'2026-10-04T08:00:00Z'};
  s.repository.add('pickupEstimates',estimate);
  const payload={clientMutationId:'calc-one',source:'pickup-calculator',sourcePickupEstimateId:estimate.id,category:'Abholung',name:'Kunde Eins',phone:'01234',location:'Gallusanlage 7, 60329',materialKey:'grade-3',material:'Sorte 3',estimatedWeightKg:500,quantity:'500 kg',distanceKm:18,scheduledFor:'2026-10-05',plannedCustomerPayoutEur:40};
  const row=await s.recordCall('a',payload),replayed=await s.recordCall('a',payload);
  assert.equal(replayed.id,row.id);assert.equal(replayed.replayed,true);assert.equal(s.listCalls('a').length,1);
  assert.equal(row.plannedCustomerPayoutEur,40);assert.equal(row.distanceKm,18);assert.equal(row.estimatedWeightKg,500);
  assert.equal(row.sourcePickupEstimateId,estimate.id);assert.equal(s.routePlan('a').stops[0].id,row.id);
  assert.equal(s.monthlyEconomics('a','2026-10').pickupPayoutEur,0);assert.equal(s.listCashEntries('a').length,0);
  assert.equal(s.listCalls('b').length,0);
  const other=await s.recordCall('b',{...payload,name:'Tenant B'});assert.notEqual(other.id,row.id);assert.equal(other.organisationId,'org-b');assert.equal(other.sourcePickupEstimateId,null);assert.equal(s.listCalls('b').length,1);
  s.deleteCall('a',row.id);assert.equal(s.routePlan('a').stops.length,0);
  await assert.rejects(s.recordCall('a',payload),e=>e.code==='CONFLICT');
});
test('calculator retry dedupes from persisted call even if mutation marker is missing',async()=>{
  const s=svc(),payload={clientMutationId:'calc-marker-gap',source:'pickup-calculator',category:'Abholung',name:'Kunde',location:'Alfeld',materialKey:'grade-3',material:'Sorte 3',estimatedWeightKg:250,distanceKm:9,plannedCustomerPayoutEur:20};
  const first=await s.recordCall('a',payload);s.repository.remove('org-a','callMutations',payload.clientMutationId);assert.equal(s.repository.list('org-a','callMutations').length,0);
  const replay=await s.recordCall('a',payload);assert.equal(replay.id,first.id);assert.equal(replay.replayed,true);assert.equal(s.listCalls('a').length,1);assert.equal(s.repository.list('org-a','callMutations').length,1);
});
test('calculator order keeps optional estimate reference only when it belongs to the current tenant',async()=>{
  const s=svc(),base={source:'pickup-calculator',category:'Abholung',name:'Kunde',location:'Alfeld',materialKey:'grade-3',material:'Sorte 3',estimatedWeightKg:100,distanceKm:7};
  const stale=await s.recordCall('a',{...base,clientMutationId:'calc-stale-estimate',sourcePickupEstimateId:'pickup-missing'});assert.equal(stale.sourcePickupEstimateId,null);
  const estimate={id:'pickup-owned',organisationId:'org-a',createdAt:'2026-10-04T08:00:00Z'};s.repository.add('pickupEstimates',estimate);
  const linked=await s.recordCall('a',{...base,clientMutationId:'calc-owned-estimate',sourcePickupEstimateId:estimate.id});assert.equal(linked.sourcePickupEstimateId,estimate.id);
});

test('calculator order completes through the normal call path and keeps planned payout separate from actual cash',async()=>{
  const s=svc(),payload={clientMutationId:'calc-complete',source:'pickup-calculator',category:'Abholung',name:'Kunde',location:'Alfeld',materialKey:'grade-3',material:'Sorte 3',estimatedWeightKg:500,distanceKm:18,plannedCustomerPayoutEur:40};
  const row=await s.recordCall('a',payload);assert.equal(s.listCashEntries('a').length,0);assert.equal(s.monthlyEconomics('a','2026-10').pickupPayoutEur,0);
  const done=s.completeCall('a',row.id,{clientMutationId:'calc-complete-done',boughtScrap:true,customerPayoutEur:30,receiptPresent:true,addToLoad:false,weightKg:500,materialKey:'grade-3',materialLabel:'Sorte 3'});
  assert.equal(done.call.status,'erledigt');assert.equal(done.call.plannedCustomerPayoutEur,40);assert.equal(done.call.customerPayoutEur,30);assert.equal(s.routePlan('a').stops.length,0);
  const cash=s.listCashEntries('a');assert.equal(cash.length,1);assert.equal(cash[0].amount,30);assert.equal(s.monthlyEconomics('a','2026-10').pickupPayoutEur,30);
});

test('calculator transfer requires a usable destination before creating any call',async()=>{
  const s=svc(),base={clientMutationId:'calc-no-target',source:'pickup-calculator',category:'Abholung',materialKey:'grade-3',material:'Sorte 3',estimatedWeightKg:100,distanceKm:7};
  await assert.rejects(s.recordCall('a',base),e=>e.code==='VALIDATION_ERROR');
  assert.equal(s.listCalls('a').length,0);assert.equal(s.repository.list('org-a','callMutations').length,0);
});
test('calculator transfer persists idempotency and planned payout after repository restart',async()=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-calc-call-'));
  try{const file=path.join(dir,'pilot.json'),a=svc({repository:new FilePilotRepository(file)}),payload={clientMutationId:'calc-persist',source:'pickup-calculator',category:'Abholung',name:'Kunde',location:'Nordpol',materialKey:'grade-3',material:'Sorte 3',estimatedWeightKg:200,distanceKm:12,plannedCustomerPayoutEur:25};
    const first=await a.recordCall('a',payload),b=svc({repository:new FilePilotRepository(file)}),again=await b.recordCall('a',payload);
    assert.equal(again.id,first.id);assert.equal(again.replayed,true);assert.equal(again.plannedCustomerPayoutEur,25);assert.equal(b.routePlan('a').stops.length,1)
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
