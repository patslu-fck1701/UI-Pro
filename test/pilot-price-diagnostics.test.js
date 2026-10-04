'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  WerkZSimplePilotService,
  MemoryPilotRepository,
  FakeVoiceProvider,
  FakeMailProvider,
  DraftMailProvider,
  StaticMarketProvider,
  StaticPortfolioProvider,
  StaticScrapPriceProvider,
  LiveScrapPriceProvider
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
function makeService({extractor,scrapPrices}={}){
  return new WerkZSimplePilotService({
    auth:new Auth(),
    entitlements:new Ent(),
    repository:new MemoryPilotRepository(),
    storage:{put:x=>({fileName:x.fileName,mime:x.mime,size:x.bytes.length})},
    voice:new FakeVoiceProvider(),
    mail:new FakeMailProvider(),
    extractor:extractor||{extract:async()=>({type:'Rechnung',company:'',date:'2026-10-04'})},
    outbound:new DraftMailProvider(),
    market:new StaticMarketProvider({source:'demo',live:false}),
    portfolio:new StaticPortfolioProvider({source:'demo',live:false}),
    scrapPrices:scrapPrices||new StaticScrapPriceProvider({
      source:'test-market',
      asOf:'2026-10-04T08:00:00Z',
      items:[{key:'copper',label:'Kupfer',unit:'EUR/kg',price:8}]
    }),
    clock:()=>new Date('2026-10-04T08:00:00Z')
  });
}

function htmlFor(url){
  if(new URL(url).pathname==='/'){
    return '<h2>Stahl-Mischschrott / Scherenschrott (Sorte 3)</h2><p>€ 0,20 - € 0,30 / kg</p>'+
      '<h2>Kupfer Schwer (Neu / E-Kupfer)</h2><p>€ 7,50 - € 8,00 / kg</p>'+
      '<h2>Kupferkabel Datenkabel / Kabelbaum (&lt;40% Cu)</h2><p>€ 1,00 - € 2,00 / kg</p>'+
      '<h2>Kupferkabel Haushaltskabel (40-70% Cu)</h2><p>€ 2,50 - € 4,00 / kg</p>';
  }
  if(url.includes('aluminiumhaendler'))return '<h2>Aluminium Mischschrott (Sorte 2)</h2><p>€ 1,10 - € 1,30 / kg</p>';
  if(url.includes('bleischrotthaendler'))return '<h2>Weichblei (Sorte 1 / Sauber)</h2><p>€ 1,40 - € 1,60 / kg</p><h2>Batterien Pb</h2><p>€ 0,50 - € 0,70 / kg</p>';
  if(url.includes('edelstahlhaendler'))return '<h2>Edelstahl V2A Neu / Sauber</h2><p>€ 1,20 - € 1,40 / kg</p><h2>Edelstahl V4A (Chrom-Nickel-Molybdän)</h2><p>€ 1,80 - € 2,20 / kg</p>';
  if(url.includes('messingschrotthaendler'))return '<h2>Messing Schwer</h2><p>€ 4,20 - € 4,60 / kg</p>';
  if(url.includes('zinkschrotthaendler'))return '<h2>Altzink (Sorte 1 / Zinkblech)</h2><p>€ 1,50 - € 1,70 / kg</p>';
  if(url.includes('elektromotoren-haendler'))return '<h2>Elektromotoren (Sauber / Standard)</h2><p>€ 0,80 - € 1,00 / kg</p>';
  return '';
}
const mockFetch=async url=>({ok:true,status:200,text:async()=>htmlFor(String(url))});

test('live price provider parses German market values and unit conversion',async()=>{
  const p=new LiveScrapPriceProvider({fetchFn:mockFetch,ttlMs:900000});
  const snap=await p.snapshot({force:true});
  assert.equal(snap.live,true);
  assert.equal(snap.source,'LokaleSchrottplatz.de');
  const copper=snap.items.find(x=>x.key==='copper');
  const mixed=snap.items.find(x=>x.key==='mixed-scrap');
  const motors=snap.items.find(x=>x.key==='motors');
  assert.equal(copper.priceMin,7.5);
  assert.equal(copper.priceMax,8);
  assert.equal(mixed.unit,'EUR/t');
  assert.equal(mixed.priceMin,200);
  assert.equal(mixed.priceMax,300);
  assert.equal(motors.priceMin,800);
  assert.equal(motors.priceMax,1000);
});

test('live price provider falls back cleanly when source is unavailable',async()=>{
  const fallback={source:'snapshot-fallback',items:[{key:'copper',label:'Kupfer',unit:'EUR/kg',price:6.5}]};
  const p=new LiveScrapPriceProvider({fallback,fetchFn:async()=>{throw new Error('network down')}});
  const snap=await p.snapshot({force:true});
  assert.equal(snap.live,false);
  assert.equal(snap.stale,true);
  assert.equal(snap.source,'snapshot-fallback');
  assert.equal(snap.items[0].price,6.5);
  assert.match(snap.note,/Live-Aktualisierung/);
});

test('recognized weigh slip creates dealer settlement automatically',async()=>{
  const s=makeService({
    extractor:{extract:async()=>({
      type:'Wiegeschein',
      company:'Händler Nord',
      dealer:'Händler Nord',
      date:'2026-10-04',
      amount:950,
      weight:100,
      materialKey:'copper',
      material:'Kupfer',
      unit:'EUR/kg',
      unitPrice:9.5,
      description:'Test-Wiegeschein'
    })}
  });
  const doc=await s.addDocument('a',{
    fileName:'wiegeschein.jpg',
    mime:'image/jpeg',
    dataBase64:Buffer.from('fake').toString('base64'),
    receiptCategory:'wiegeschein'
  });
  assert.equal(doc.type,'Wiegeschein');
  assert.ok(doc.settlement);
  assert.equal(doc.settlement.dealer,'Händler Nord');
  assert.equal(doc.settlement.materialKey,'copper');
  assert.equal(doc.settlement.unitPrice,9.5);
  assert.equal(s.listSettlements('a').length,1);
});

test('latest learned dealer price overrides market price for pickup calculation',async()=>{
  const s=makeService();
  s.recordSettlement('a',{
    dealer:'Händler Nord',
    materialKey:'copper',
    materialLabel:'Kupfer',
    weightKg:100,
    totalEur:1000,
    unit:'EUR/kg',
    date:'2026-10-04'
  });
  const estimate=await s.pickupEstimate('a',{materialKey:'copper',weightKg:100,distanceKm:0});
  assert.equal(estimate.price,10);
  assert.equal(estimate.gross,1000);
  assert.equal(estimate.priceSourceType,'dealer-actual');
  assert.match(estimate.priceSource,/Händler Nord/);
});

test('learned dealer price recalculates vehicle load but stays tenant isolated',async()=>{
  const s=makeService();
  s.recordSettlement('a',{
    dealer:'Händler Nord',
    materialKey:'copper',
    materialLabel:'Kupfer',
    weightKg:100,
    totalEur:1000,
    unit:'EUR/kg',
    date:'2026-10-04'
  });
  s.addVehicleLoad('a',{materialKey:'copper',materialLabel:'Kupfer',weightKg:50});
  s.addVehicleLoad('b',{materialKey:'copper',materialLabel:'Kupfer',weightKg:50});
  const a=await s.vehicleLoadSummary('a');
  const b=await s.vehicleLoadSummary('b');
  assert.equal(a.items[0].price,10);
  assert.equal(a.items[0].estimatedValueEur,500);
  assert.equal(a.items[0].priceSourceType,'dealer-actual');
  assert.equal(b.items[0].price,8);
  assert.equal(b.items[0].estimatedValueEur,400);
  assert.equal(b.items[0].priceSourceType,'market');
});
