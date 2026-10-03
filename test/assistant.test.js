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


test('ToxicZ roadmap keeps signal marker start and post-Rify investigation separate',()=>{
  const fx=fixture();try{
    const specs=fx.service.eventSpecs('a');
    const convoy=specs.find(spec=>spec.id==='aiconvoyz');
    assert.ok(convoy.criteria.some(item=>item.id==='toxic_chain'&&/ToxicZ_Signal_Marker/.test(item.expected)));
    assert.ok(convoy.criteria.some(item=>item.id==='toxic_activation'&&/aktivieren/i.test(item.expected)));

    const toxic=specs.find(spec=>spec.id==='toxicz');
    assert.equal(toxic.baseline,'ToxicZ Event-Roadmap · 03.10.2026');
    assert.equal(toxic.criteria.length,12);
    assert.ok(toxic.criteria.some(item=>item.id==='unlock'&&/ToxicZ_Signal_Marker/.test(item.expected)));
    assert.ok(toxic.criteria.some(item=>item.id==='dynamic_route'&&/Feuerwache/.test(item.expected)));
    assert.ok(toxic.criteria.some(item=>item.id==='final_flare'&&/GasZonen_Leuchtfackel/.test(item.expected)));
    assert.ok(toxic.criteria.some(item=>item.id==='post_rify_handoff'&&/nicht direkt Operation DeutschZ/i.test(item.label)));
    assert.equal(toxic.criteria.some(item=>item.id==='operation_handoff'),false);
  }finally{fx.close()}
});


test('story canon separates technical scheduler from personal Q17 T17 progression',()=>{
  const fx=fixture();try{
    const story=fx.service.storyCanon('a');
    assert.equal(story.id,'q17-t17-main');
    assert.deepEqual(story.technicalScheduler.currentMajorRotation,['koth','courierz','raven','aiconvoyz']);
    assert.deepEqual(story.mainStory.order,['koth','aiconvoyz','toxicz','atm-raidz','propertyz','courierz','raven','battlegroundz','operation-deutschz']);
    assert.equal(story.discarded.includes('Operation EclipseZ'),true);

    const atm=story.mainStory.nodes.find(node=>node.id==='atm-raidz');
    assert.equal(atm.optional,true);assert.equal(atm.blocking,false);
    const property=story.mainStory.nodes.find(node=>node.id==='propertyz');
    assert.match(property.storyRole,/Dead Drop/);
    const raven=story.mainStory.nodes.find(node=>node.id==='raven');
    assert.match(raven.storyRole,/BLACK\/ECHO/);

    for(const id of ['koth','courierz']){
      assert.match(story.mainStory.nodes.find(node=>node.id===id).implementationPolicy,/existing_event_unchanged/);
    }
    assert.match(story.mainStory.nodes.find(node=>node.id==='raven').implementationPolicy,/existing_event_unchanged/);
    assert.equal(inferDeutschzTarget('Operation EclipseZ'),null);
  }finally{fx.close()}
});

test('story canon records verified WelcomeZ RadioMissionZ and BattlegroundZ integration points',()=>{
  const fx=fixture();try{
    const story=fx.service.storyCanon('a');
    assert.match(story.supportSystems.welcomez.role,/Player-Hub/);
    assert.match(story.supportSystems.radiomissionz.role,/89,5 MHz/);
    assert.ok(story.supportSystems.battlegroundz.verified.some(value=>/Operation-DeutschZ-KeyCard/.test(value)));
    assert.ok(story.currentSourceGaps.some(gap=>gap.id==='atm-currently-blocking'));
    assert.ok(story.currentSourceGaps.some(gap=>gap.id==='property-not-wired'));
    assert.ok(story.currentSourceGaps.some(gap=>gap.id==='raven-not-wired'));
    assert.ok(story.currentSourceGaps.some(gap=>gap.id==='battleground-reader-class-collision'));
  }finally{fx.close()}
});

test('BattlegroundZ and Operation DeutschZ are testable without changing KOTH CourierZ or RAVEN specs',()=>{
  const fx=fixture();try{
    const specs=fx.service.eventSpecs('a');
    const koth=specs.find(spec=>spec.id==='koth');
    const courier=specs.find(spec=>spec.id==='courierz');
    const raven=specs.find(spec=>spec.id==='raven');
    assert.deepEqual(koth.criteria.map(x=>x.id),['start','finish','handoff','slot']);
    assert.deepEqual(courier.criteria.map(x=>x.id),['start','finish','handoff','slot']);
    assert.deepEqual(raven.criteria.map(x=>x.id),['radio_preannounce','public_zone','flight_drop','zombies','hack_trigger','recovery_team','exact_marker','story_document','finish']);

    const battleground=specs.find(spec=>spec.id==='battlegroundz');
    assert.ok(battleground.criteria.some(item=>item.id==='operation_key'));
    const operation=specs.find(spec=>spec.id==='operation-deutschz');
    assert.ok(operation.criteria.some(item=>item.id==='authorization'&&/MasterCardReader/.test(item.expected)));
    assert.ok(operation.criteria.some(item=>item.id==='decision'));
  }finally{fx.close()}
});


test('source audit exposes current verified source errors and unresolved suspicions',()=>{
  const fx=fixture();try{
    const audit=fx.service.sourceAudit('a');
    assert.equal(audit.checkedAt,'2026-10-03');
    assert.equal(audit.snapshots.length,3);
    assert.ok(audit.openCount>=5);

    const reader=audit.findings.find(item=>item.id==='battleground-reader-class-collision');
    assert.equal(reader.status,'error');
    assert.equal(reader.severity,'critical');
    assert.match(reader.actual,/CanPutIntoHands\/CanPutInCargo/);
    assert.match(reader.actual,/deutschz_aiconvoyz_cardreader/);

    const visual=audit.findings.find(item=>item.id==='electronic-repair-kit-visual');
    assert.equal(visual.status,'error');
    assert.equal(visual.severity,'critical');
    assert.match(visual.actual,/DZToxicZ_DocumentDecoder/);
    assert.match(visual.actual,/ElectronicRepairKit/);

    const atm=audit.findings.find(item=>item.id==='atm-currently-blocking');
    assert.equal(atm.status,'mismatch');
    const property=audit.findings.find(item=>item.id==='property-story-missing');
    const raven=audit.findings.find(item=>item.id==='raven-story-missing');
    assert.equal(property.status,'missing');
    assert.equal(raven.status,'missing');
  }finally{fx.close()}
});

test('source audit distinguishes verified facts from desired roadmap extensions',()=>{
  const fx=fixture();try{
    const audit=fx.service.sourceAudit('a');
    const toxic=audit.findings.find(item=>item.id==='toxicz-existing-core');
    assert.equal(toxic.status,'partial');
    assert.match(toxic.actual,/Hospital 1/);
    assert.match(toxic.expected,/Feuerwehr-Routen/);

    const bridge=audit.findings.find(item=>item.id==='battleground-operation-bridge');
    assert.equal(bridge.status,'verified');
    assert.match(bridge.actual,/Operation-KeyCard/);

    const eclipse=audit.findings.find(item=>item.id==='eclipse-retired');
    assert.equal(eclipse.status,'verified');
  }finally{fx.close()}
});
