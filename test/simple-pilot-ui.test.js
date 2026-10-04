'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','apps','simple-pilot','index.html'),'utf8');
const sw=fs.readFileSync(path.join(__dirname,'..','apps','simple-pilot','sw.js'),'utf8');

test('Schrotties voice control is explicitly an order action',()=>{
  assert.match(html,/id="noteLabel">Auftrag sprechen</);
  assert.match(html,/queueablePost\('\/notes'/);
  assert.match(html,/Als offenen Auftrag hinzugefügt|Als offener Auftrag hinzugefügt/);
});

test('queued voice notes are shown as orders without pickup keywords',()=>{
  assert.match(html,/async function offlineVoiceStops\(\)/);
  assert.match(html,/x\.path==='\/notes'.*String\(x\.payload\.text\|\|''\)\.trim\(\)/s);
  assert.doesNotMatch(html,/offlineVoiceStops\(\).*abholen\|holen\|einsammeln\|mitnehmen/s);
});

test('logout and actionable voice errors are visible',()=>{
  assert.match(html,/class="logoutbtn" href="\/pilot\/logout">Abmelden</);
  assert.match(html,/Speichern: /);
});

test('service worker update can reload for every new controller',()=>{
  assert.match(html,/var swReloading=false/);
  assert.match(html,/controllerchange/);
  assert.doesNotMatch(html,/werkz-sw-reload/);
  assert.match(sw,/werkz-simple-pilot-v\d+/);
  assert.match(sw,/skipWaiting\(\)/);
  assert.match(sw,/clients\.claim\(\)/);
});


test('live scrap prices expose source, manual refresh and timed refresh',()=>{
  assert.match(html,/id="priceMeta"/);
  assert.match(html,/id="priceRefresh"/);
  assert.match(html,/\?refresh=1/);
  assert.match(html,/15\*60\*1000/);
  assert.match(html,/Live.*Preisquelle|x\.live\?'Live':'Fallback'/s);
});

test('weigh-slip upload learns dealer prices and refreshes dependent calculations',()=>{
  assert.match(html,/async function learnWeighSlip\(doc\)/);
  assert.match(html,/sourceDocumentId:doc&&doc\.id/);
  assert.match(html,/async function refreshAfterWeighSlip\(\)/);
  assert.match(html,/dealerPrices\(\),vehicleLoad\(\),showDealerOptions\(\),dailyClose\(\)/);
  assert.match(html,/Händlerpreis gelernt/);
});
