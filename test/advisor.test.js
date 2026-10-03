'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ModuleRegistry}=require('../src/modules/module-registry');
const {ADVISOR_MODULES,BUNDLES,advise}=require('../src/advisor/catalog');
test('advisor metadata covers every registered module',()=>{const r=new ModuleRegistry();for(const m of r.list())assert.ok(ADVISOR_MODULES[m.id],m.id)});
test('orders resolve customers as hard dependency',()=>{const x=advise(new ModuleRegistry(),['werkz.orders']);assert.deepEqual(x.required,['werkz.customers'])});
test('assistant exposes useful optional integrations without forcing them',()=>{const x=advise(new ModuleRegistry(),['werkz.assistant']);assert.equal(x.required.length,0);assert.ok(x.optional.includes('werkz.time'));assert.ok(x.optional.includes('werkz.documents'))});
test('whatsapp requires approvals and reports later provider access',()=>{const x=advise(new ModuleRegistry(),['werkz.channel.whatsapp']);assert.deepEqual(x.required,['werkz.approvals']);assert.ok(x.access.some(v=>/Provider/.test(v.text)))});
test('bundles are composed only of known modules',()=>{const r=new ModuleRegistry();for(const b of BUNDLES)for(const id of b.modules)assert.doesNotThrow(()=>r.get(id))});
