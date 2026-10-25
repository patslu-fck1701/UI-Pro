'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('the public Handwerk demo retires every former customer-advisor URL',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../tools/time-test-server.js'),'utf8');
  assert.match(source,/url\.pathname\.startsWith\('\/berater'\)/);
  assert.match(source,/response\.writeHead\(410/);
  assert.doesNotMatch(source,/customer-advisor/);
});
