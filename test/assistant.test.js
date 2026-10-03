'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {
  ModuleRegistry,EntitlementService,LocalAuthPort,
  FileAssistantState,FileAssistantDocumentStore,AssistantService,
  inferCapture,inferDeutschzTarget
}=require('../src');

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-assistant-'));
  const registry=new ModuleRegistry(),entitlements=new EntitlementService({registry});
  for(const moduleId of ['werkz.assistant','werkz.analytics','werkz.simulation'])entitlements.set({organisationId:'org-a',moduleId,catalogVersion:'v0.2'});
  const capabilities=['assistant.read','assistant.capture','assistant.manage','analytics.view','simulation.run'];
  const auth=new LocalAuthPort({
    a:{organisationId:'org-a',actorId:'chef',actorLabel:'Chef',capabilities},
    b:{organisationId:'org-b',actorId:'other',actorLabel:'Other',capabilities}
  });
  let n=0;
  const service=new AssistantService({
    auth,entitlements,state:new FileAssistantState(path.join(root,'state.json')),
    documents:new FileAssistantDocumentStore(path.join(root,'documents')),
    clock:()=>new Date('2026-10-03T10:00:00Z'),id:prefix=>prefix+'_'+(++n)
  });
  return {root,service,close:()=>fs.rmSync(root,{recursive:true,force:true})};
}

test('assistant starts empty and optional capture hint overrides automatic mapping',()=>{
  const fx=fixture();try{
    assert.equal(fx.service.briefing('a').counts.open,0);
    const idea=fx.service.capture('a',{text:'Morgen 9 Uhr KOTH Marker prüfen',captureType:'idea',idempotencyKey:'one'});
    assert.equal(idea.kind,'idea');
    assert.equal(idea.eventId,'koth');
    assert.equal(idea.dueAt,'2026-10-04T09:00:00.000Z');
    assert.equal(fx.service.capture('a',{text:'changed',captureType:'release',idempotencyKey:'one'}).id,idea.id);
  }finally{fx.close()}
});

test('DeutschZ target inference recognizes current event vocabulary',()=>{
  assert.deepEqual(inferDeutschzTarget('AI Convoy bleibt an der Route stehen'),{id:'aiconvoyz',label:'AIConvoyZ'});
  assert.deepEqual(inferDeutschzTarget('RAVEN Airdrop gelandet'),{id:'raven',label:'RAVEN'});
  assert.deepEqual(inferDeutschzTarget('ATM RaidZ Marker'),{id:'atm-raidz',label:'ATM RaidZ'});
});

test('event test narration produces report and durable webmapper projection',()=>{
  const fx=fixture();try{
    const started=fx.service.startEventTest('a',{id:'eventtest-1',eventId:'koth',idempotencyKey:'start'});
    assert.equal(started.status,'running');
    fx.service.addEventObservation('a',started.id,{text:'KOTH startet sauber. KOTH beendet. Slot frei.',source:'voice',idempotencyKey:'obs'});
    const finished=fx.service.finishEventTest('a',started.id,{idempotencyKey:'finish'});
    assert.equal(finished.status,'finished');
    assert.ok(finished.report.counts.observed>=2);
    const projections=fx.service.listProjections('a');
    assert.equal(projections.length,1);
    assert.equal(projections[0].target,'deutschz.webmapper');
    assert.equal(projections[0].eventId,'koth');
    assert.match(projections[0].summary,/Test beendet/);
  }finally{fx.close()}
});

test('release status capture projects to matching DeutschZ event without requiring a category',()=>{
  const fx=fixture();try{
    const capture=fx.service.capture('a',{text:'RAVEN Release ist jetzt im Test',captureType:'release',idempotencyKey:'release'});
    assert.equal(capture.kind,'release-status');
    const projection=fx.service.listProjections('a')[0];
    assert.equal(projection.eventId,'raven');
    assert.equal(projection.sourceId,capture.id);
  }finally{fx.close()}
});

test('private assistant document verifies hash and remains tenant scoped',()=>{
  const fx=fixture();try{
    const bytes=Buffer.from('invoice-bytes'),hash='sha256:'+crypto.createHash('sha256').update(bytes).digest('hex');
    const document=fx.service.addDocument('a',{fileName:'rechnung.jpg',mime:'image/jpeg',bytes,category:'invoice',clientHash:hash,idempotencyKey:'doc'});
    assert.equal(document.hash,hash);
    assert.deepEqual(fx.service.getDocument('a',document.id).bytes,bytes);
    assert.throws(()=>fx.service.getDocument('b',document.id),error=>error.code==='ENTITLEMENT_DENIED'||error.code==='NOT_FOUND');
    assert.throws(()=>fx.service.addDocument('a',{fileName:'bad.jpg',mime:'image/jpeg',bytes,category:'invoice',clientHash:'sha256:bad'}),error=>error.code==='HASH_MISMATCH');
  }finally{fx.close()}
});

test('market snapshots retain long-term change and drawdown without mutating simulation data',()=>{
  const fx=fixture();try{
    fx.service.addMarketSnapshot('a',{asset:'BTC',currency:'EUR',price:100,observedAt:'2026-10-01T00:00:00Z',source:'test'});
    fx.service.addMarketSnapshot('a',{asset:'BTC',currency:'EUR',price:80,observedAt:'2026-10-02T00:00:00Z',source:'test'});
    fx.service.addMarketSnapshot('a',{asset:'BTC',currency:'EUR',price:120,observedAt:'2026-10-03T00:00:00Z',source:'test'});
    const summary=fx.service.marketSummary('a');
    assert.equal(summary.changePct,20);
    assert.equal(summary.maxDrawdownPct,-20);
    const mandate=fx.service.createMandate('a',{name:'BTC beobachten',asset:'BTC',currency:'EUR',strategy:'hold'});
    const evaluated=fx.service.evaluateMandates('a').find(x=>x.id===mandate.id);
    assert.equal(evaluated.metrics.performancePct,20);
  }finally{fx.close()}
});


test('AIConvoyZ roadmap detects spoken deviations from the desired event design',()=>{
  const fx=fixture();try{
    const specs=fx.service.eventSpecs('a');
    const convoy=specs.find(spec=>spec.id==='aiconvoyz');
    assert.equal(convoy.baseline,'AI Convoy Event-Roadmap · 03.10.2026');
    assert.ok(convoy.criteria.some(item=>item.id==='activation'&&/1000 m/.test(item.expected)));
    assert.ok(convoy.criteria.some(item=>item.id==='formation'&&/5 Start-AI/.test(item.expected)));

    const started=fx.service.startEventTest('a',{id:'eventtest-convoy',eventId:'aiconvoyz',idempotencyKey:'convoy-start'});
    fx.service.addEventObservation('a',started.id,{
      text:'Der Konvoi startet, aber ich sehe vier AI und er wird schon bei 300 Meter aktiviert. Das ist zu früh gespawnt.',
      source:'voice',idempotencyKey:'convoy-obs'
    });
    const finished=fx.service.finishEventTest('a',started.id,{idempotencyKey:'convoy-finish'});
    const issues=new Set(finished.report.results.filter(item=>item.status==='issue').map(item=>item.id));
    assert.equal(issues.has('formation'),true);
    assert.equal(issues.has('activation'),true);
  }finally{fx.close()}
});


test('ToxicZ signal marker chain stays explicit in the assistant baseline',()=>{
  const fx=fixture();try{
    const specs=fx.service.eventSpecs('a');
    const convoy=specs.find(spec=>spec.id==='aiconvoyz');
    assert.ok(convoy.criteria.some(item=>item.id==='toxic_chain'&&/ToxicZ_Signal_Marker/.test(item.expected)));
    assert.ok(convoy.criteria.some(item=>item.id==='toxic_activation'&&/aktivieren/i.test(item.expected)));

    const toxic=specs.find(spec=>spec.id==='toxicz');
    assert.ok(toxic);
    assert.ok(toxic.criteria.some(item=>item.id==='combine'&&/Signalmarker/.test(item.label)));
    assert.ok(toxic.criteria.some(item=>item.id==='activate'&&/ToxicZ_Signal_Marker aktivieren/.test(item.expected)));
  }finally{fx.close()}
});
