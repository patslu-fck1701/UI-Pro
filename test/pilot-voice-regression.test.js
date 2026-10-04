'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  WerkZSimplePilotService,
  MemoryPilotRepository,
  FakeVoiceProvider,
  FakeMailProvider,
  FakeExtractor,
  DraftMailProvider,
  StaticMarketProvider,
  StaticPortfolioProvider,
  StaticScrapPriceProvider
}=require('../src/pilot');

class Auth{
  resolveSession(token){
    if(token==='a')return {organisationId:'org-a',actorId:'a',capabilities:['pilot.read','pilot.write']};
    if(token==='b')return {organisationId:'org-b',actorId:'b',capabilities:['pilot.read','pilot.write']};
    throw Object.assign(new Error('bad'),{code:'UNAUTHENTICATED'});
  }
}
class Ent{
  require(org,moduleId){
    if(!['werkz.simple','werkz.documents','werkz.billing-prep','werkz.channel.gmail','werkz.crypto-monitor'].includes(moduleId)){
      throw Object.assign(new Error('denied'),{code:'ENTITLEMENT_DENIED'});
    }
    return {organisationId:org,moduleId};
  }
}
function svc(){
  return new WerkZSimplePilotService({
    auth:new Auth(),
    entitlements:new Ent(),
    repository:new MemoryPilotRepository(),
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
