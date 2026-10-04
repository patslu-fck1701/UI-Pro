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
