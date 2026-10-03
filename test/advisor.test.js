'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ModuleRegistry}=require('../src/modules/module-registry');
const {ADVISOR_MODULES,BUNDLES,SCOPE_PRESETS,DEPLOYMENTS,INTAKE,advise,recommendScope,precheck}=require('../src/advisor/catalog');
test('advisor metadata covers every registered module',()=>{const r=new ModuleRegistry();for(const m of r.list())assert.ok(ADVISOR_MODULES[m.id],m.id)});
test('orders resolve customers as hard dependency',()=>{const x=advise(new ModuleRegistry(),['werkz.orders']);assert.deepEqual(x.required,['werkz.customers'])});
test('assistant exposes useful optional integrations without forcing them',()=>{const x=advise(new ModuleRegistry(),['werkz.assistant']);assert.equal(x.required.length,0);assert.ok(x.optional.includes('werkz.time'));assert.ok(x.optional.includes('werkz.documents'))});
test('whatsapp requires approvals and reports later provider access',()=>{const x=advise(new ModuleRegistry(),['werkz.channel.whatsapp']);assert.deepEqual(x.required,['werkz.approvals']);assert.ok(x.access.some(v=>/Provider/.test(v.text)))});
test('bundles are composed only of known modules',()=>{const r=new ModuleRegistry();for(const b of BUNDLES)for(const id of b.modules)assert.doesNotThrow(()=>r.get(id))});

test('advisor commercial presets match canonical v2 public entry points',()=>{
 const by=Object.fromEntries(SCOPE_PRESETS.map(x=>[x.id,x]));
 assert.equal(by.solo.setupFromCents,49000);assert.equal(by.solo.managedFromCents,7900);
 assert.equal(by.team.setupFromCents,149000);assert.equal(by.team.managedFromCents,17900);
 assert.equal(by.business.setupFromCents,249000);assert.equal(by.business.managedFromCents,34900);
});
test('advisor exposes canonical deployment starting points without inventing module prices',()=>{
 const by=Object.fromEntries(DEPLOYMENTS.map(x=>[x.id,x]));
 assert.equal(by.dedicated_cloud.setupFromCents,49000);assert.equal(by.dedicated_cloud.opsFromCents,9900);
 assert.equal(by.hybrid_connector.setupFromCents,69000);assert.equal(by.hybrid_connector.opsFromCents,4900);
 assert.equal(by.werkz_box.setupFromCents,99000);assert.equal(by.on_prem.setupFromCents,249000);
});
test('precheck combines dependencies scope deployment and discovery without credentials',()=>{
 const x=precheck(new ModuleRegistry(),['werkz.orders'],{deploymentId:'hybrid_connector'});
 assert.ok(x.required.includes('werkz.customers'));assert.equal(x.scope.id,'solo');assert.equal(x.deployment.id,'hybrid_connector');
 assert.ok(INTAKE.some(v=>v.id==='systems'));assert.equal(JSON.stringify(INTAKE).toLowerCase().includes('passwort'),false);
});
test('scope recommendation remains advisory and deterministic',()=>{assert.equal(recommendScope(['werkz.time']),'solo');assert.equal(recommendScope(['a','b','c']),'team');assert.equal(recommendScope(['a','b','c','d','e','f','g']),'business')});
