'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','apps','simple-pilot','index.html'),'utf8');
const sw=fs.readFileSync(path.join(__dirname,'..','apps','simple-pilot','sw.js'),'utf8');

test('Schrotties voice control saves synchronously before syncing to Render',()=>{
  assert.match(html,/id="noteLabel">Auftrag sprechen</);
  assert.match(html,/localOrderPutSync\(local\)/);
  assert.match(html,/queueablePost\('\/notes'/);
  assert.ok(html.indexOf('localOrderPutSync(local)') < html.indexOf("await queueablePost('/notes'"));
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

test('logout stays visible while server sync failures keep the local order',()=>{
  assert.match(html,/class="logoutbtn" href="\/pilot\/logout">Abmelden</);
  assert.match(html,/Auf dem Gerät gespeichert/);
  assert.match(html,/syncLocalVoiceOrders/);
  assert.doesNotMatch(html,/localStorage\.removeItem\(localOrderStorageKey\(\)\)/);
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


test('local-first voice sync is tenant-slug scoped and idempotent',()=>{
  assert.match(html,/function localOrderPutSync\(v\).*tenant:'slug:'\+tenantSlug.*tenantSlug:tenantSlug/s);
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

test('local voice orders use tenant-slug localStorage and fail truthfully',()=>{
  assert.match(html,/werkzPilotLocalOrders::slug:/);
  assert.match(html,/localStorage\.setItem\(localOrderStorageKey\(\),JSON\.stringify\(rows\)\)/);
  assert.match(html,/Lokaler Speicher fehlgeschlagen/);
  assert.match(html,/localOrderPutSync\(local\)/);
});

test('connection indicator reflects server reachability, not sync backlog',()=>{
  assert.match(html,/dot\.classList\.toggle\('online',connected\)/);
  assert.match(html,/WerkZ verbunden · .*lokal offen/s);
  assert.doesNotMatch(html,/Offline · lokal gespeichert/);
});


test('legacy IndexedDB queue cannot block local order startup',()=>{
  assert.match(html,/shortTimeout\(offlineAll\(\),800\)/);
  assert.match(html,/shortTimeout\(offlineCacheGet\('route-plan'\),600\)/);
  assert.match(html,/migrateQueuedVoiceOrders/);
  assert.match(html,/localStorage\.setItem\(localOrderStorageKey\(\),JSON\.stringify\(rows\)\)/);
});


test('inline Schrotties app JavaScript parses successfully',()=>{
  const m=html.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(m&&m[1]);
  assert.doesNotThrow(()=>new Function(m[1]));
});

test('voice order is rendered locally before any network sync',()=>{
  const save=html.indexOf('async function saveVoiceNote');
  const put=html.indexOf('localOrderPutSync(local)',save);
  const render=html.indexOf('renderLocalOrdersNow(localVoiceStopsSync())',save);
  const post=html.indexOf("queueablePost('/notes'",save);
  const firstAwait=html.indexOf('await ',save);
  assert.ok(save>=0&&put>save&&render>put&&post>render&&firstAwait>render);
  assert.match(html,/function renderLocalOrdersNow\(rows\)/);
  assert.match(html,/auf diesem Gerät gespeichert/);
});

test('pilot API requests have a hard timeout',()=>{
  assert.match(html,/setTimeout\(function\(\)\{ctrl\.abort\(\)\},7000\)/);
  assert.match(html,/cache:'no-store'/);
  assert.match(html,/credentials:'same-origin'/);
});

test('PWA update bypasses iOS service worker cache',()=>{
  assert.match(html,/register\('\/pilot\/sw\.js\?v=14'/);
  assert.match(html,/updateViaCache:'none'/);
});


test('local order storage is bound to stable tenant slug before session resolves',()=>{
  assert.match(html,/urlTenant=\(new URLSearchParams\(location\.search\)\)\.get\('tenant'\)/);
  assert.match(html,/tenantScope='slug:'\+tenantSlug/);
  assert.match(html,/localOrderStorageKeyForSlug\(slug\)/);
  assert.match(html,/localOrderPutSync\(local\)/);
  const save=html.indexOf('async function saveVoiceNote');
  const put=html.indexOf('localOrderPutSync(local)',save);
  const render=html.indexOf('renderLocalOrdersNow(localVoiceStopsSync())',save);
  const firstAwait=html.indexOf('await ',save);
  assert.ok(put>save&&render>put&&firstAwait>render);
});

test('pilot UI exposes v14 and passes tenant slug through the service worker URL',()=>{
  assert.match(html,/· v14/);
  assert.match(html,/register\('\/pilot\/sw\.js\?v=14'/);
  assert.match(sw,/werkz-simple-pilot-v14/);
});


test('iPhone speech handler saves collected transcript on recognition end',()=>{
  assert.match(html,/r\.interimResults=true/);
  assert.match(html,/function collect\(e\)/);
  assert.match(html,/function finish\(\)/);
  assert.match(html,/r\.onend=function\(\)\{finish\(\)\}/);
  assert.match(html,/Zuletzt erkannt:/);
  assert.match(html,/id="voiceLast"/);
});
