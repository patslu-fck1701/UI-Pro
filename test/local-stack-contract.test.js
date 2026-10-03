'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');

test('unified local WerkZ stack stays explicitly non-production and same-origin',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
  const server=fs.readFileSync(path.join(ROOT,'tools','time-test-server.js'),'utf8');
  const wrapper=fs.readFileSync(path.join(ROOT,'tools','werkz-local-stack.js'),'utf8');

  assert.equal(pkg.scripts['werkz:test'],'node tools/werkz-local-stack.js');
  assert.equal(pkg.scripts['test:local-stack'],'node tools/local-stack-smoke.js');
  assert.match(wrapper,/NODE_ENV==='production'/);
  assert.match(wrapper,/WERKZ_ALLOW_EPHEMERAL_TEST_SECRETS='1'/);
  assert.match(server,/const assistantFiles=new Map/);
  assert.match(server,/const timeFiles=new Map/);
  assert.match(server,/demoSeed:false/);
  assert.match(server,/apiPath\.startsWith\('\/assistant\/'\)/);
  assert.match(server,/safeLocalReturn/);
  assert.match(server,/connect-src 'self'/);
  assert.match(server,/unifiedLocalStack:true/);
});
