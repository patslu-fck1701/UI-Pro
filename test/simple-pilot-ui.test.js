'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','apps','simple-pilot','index.html'),'utf8');
const sw=fs.readFileSync(path.join(__dirname,'..','apps','simple-pilot','sw.js'),'utf8');

test('Schrotties voice control saves locally before syncing to Render',()=>{
  assert.match(html,/id="noteLabel">Auftrag sprechen</);
  assert.match(html,/localOrderPut\(local\)/);
  assert.match(html,/queueablePost\('\/notes'/);
  assert.ok(html.indexOf('await localOrderPut(local)') < html.indexOf("await queueablePost('/notes'"));
  assert.match(html,/Auf dem Gerät gespeichert/);
});

test('local voice orders survive server loss and are merged into the route plan',()=>{
  assert.match(html,/indexedDB\.open\('werkz-simple-pilot',3\)/);
  assert.match(html,/createObjectStore\('localOrders'/);
  assert.match(html,/async function localVoiceStops\(\)/);
  assert.match(html,/serverRows\.concat\(local\)/);
  assert.match(html,/!r\.serverCallId\|\|!serverIds\.has\(r\.serverCallId\)/);
  assert.match(html,/auf diesem Gerät gespeichert/);
});

test('logout stays visible while server sync failures do not delete local orders',()=>{
  assert.match(html,/class="logoutbtn" href="\/pilot\/logout">Abmelden</);
  assert.match(html,/Server-Sync später/);
  assert.match(html,/syncLocalVoiceOrders/);
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


test('stale session responses redirect to the correct tenant login',()=>{
  assert.match(html,/d\.error==='UNAUTHENTICATED'/);
  assert.match(html,/VALIDATION_ERROR.*session required/s);
  assert.match(html,/\/pilot\/login\?tenant=/);
  assert.match(html,/tenantSlug/);
});


test('local-first voice sync is tenant scoped and idempotent',()=>{
  assert.match(html,/function localOrderPut\(v\).*tenant:tenantScope/s);
  assert.match(html,/clientMutationId:id/);
  assert.match(html,/clientMutationId:row\.clientMutationId\|\|row\.id/);
  assert.match(html,/serverCallId:res&&res\.call&&res\.call\.id/);
  assert.match(html,/migrateQueuedVoiceOrders/);
});

test('local orders are retried on app start, reconnect and foreground',()=>{
  assert.match(html,/await syncLocalVoiceOrders\(\)\.catch/);
  assert.match(html,/addEventListener\('online'.*syncLocalVoiceOrders/s);
  assert.match(html,/visibilitychange.*syncLocalVoiceOrders/s);
});


test('iOS navigator.onLine never blocks WerkZ network attempts',()=>{
  assert.doesNotMatch(html,/serverReachable\(\)\{if\(!navigator\.onLine\)/);
  assert.doesNotMatch(html,/queueablePost\([^]*?if\(!navigator\.onLine\)/);
  assert.doesNotMatch(html,/syncLocalVoiceOrders\(\)\{if\(!navigator\.onLine\)/);
  assert.doesNotMatch(html,/syncOfflineQueue\(\)\{if\([^}]*!navigator\.onLine/);
  assert.match(html,/fetch\('\/healthz\?ts='/);
});

test('local voice orders use tenant-scoped localStorage and fail truthfully',()=>{
  assert.match(html,/werkzPilotLocalOrders::/);
  assert.match(html,/localStorage\.setItem\(localOrderStorageKey\(\),JSON\.stringify\(rows\)\)/);
  assert.match(html,/Lokaler Speicher fehlgeschlagen/);
  assert.match(html,/await localOrderPut\(local\)/);
});

test('connection indicator reflects server reachability, not sync backlog',()=>{
  assert.match(html,/dot\.classList\.toggle\('online',connected\)/);
  assert.match(html,/WerkZ verbunden · .*lokal offen/s);
  assert.doesNotMatch(html,/Offline · lokal gespeichert/);
});
