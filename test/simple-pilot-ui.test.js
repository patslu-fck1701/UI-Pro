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
  assert.match(html,/register\('\/pilot\/sw\.js\?v=21'/);
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

test('pilot UI exposes v15 and passes tenant slug through the service worker URL',()=>{
  assert.match(html,/· v21/);
  assert.match(html,/register\('\/pilot\/sw\.js\?v=21'/);
  assert.match(sw,/werkz-simple-pilot-v21/);
});


test('iPhone speech handler saves collected transcript on recognition end',()=>{
  assert.match(html,/r\.interimResults=true/);
  assert.match(html,/function collect\(e\)/);
  assert.match(html,/function finish\(\)/);
  assert.match(html,/r\.onend=function\(\)\{finish\(\)\}/);
  assert.match(html,/Zuletzt erkannt:/);
  assert.match(html,/id="voiceLast"/);
});


test('local parser repairs iPhone "2,15 Schritte" transcript',()=>{
  assert.match(html,/schritt\(\?:e\|en\)\?/);
  assert.match(html,/x<50\?Math\.round\(x\*1000\)/);
  assert.match(html,/localVoiceStopsSync\(\).*offlineMaterialInfo\(raw\).*offlineLocation\(raw\)/s);
});


test('Android voice path requests microphone permission before recognition',()=>{
  assert.match(html,/async function ensureMicrophonePermission\(\)/);
  assert.match(html,/navigator\.mediaDevices\.getUserMedia\(\{audio:true\}\)/);
  assert.match(html,/if\(!\(await ensureMicrophonePermission\(\)\)\)return/);
});

test('unsupported Android browser explains fallback instead of silently opening text input',()=>{
  assert.match(html,/Spracherkennung in diesem Browser nicht verfügbar/);
  assert.match(html,/Android: Bitte Chrome verwenden oder Auftrag eintippen\./);
  assert.match(html,/Spracherkennung nicht verfügbar\. Auftrag stattdessen eintippen:/);
});


test('Google Maps navigation is a permanent mobile smoke-test invariant',()=>{
  assert.match(html,/function mapsUrl\(destination\)/);
  assert.match(html,/https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/);
  assert.match(html,/class="mapsgo"/);
  assert.match(html,/data-maps-destination/);
  assert.match(html,/function openMapsDestination\(destination\)/);
  assert.match(html,/location\.href=url/);
  assert.match(html,/GOOGLE MAPS STARTEN/);
  assert.match(html,/ZU DIESEM STOPP NAVIGIEREN/);
  assert.doesNotMatch(html,/class="mapsgo"[^>]*target="_blank"/);
});


test('Direkt los stays removed because Google Maps is the only navigation action',()=>{
  assert.doesNotMatch(html,/Direkt los/i);
  assert.match(html,/GOOGLE MAPS STARTEN/);
  assert.match(html,/ZU DIESEM STOPP NAVIGIEREN/);
});

test('route merge keeps richer local address when server copy is blank',()=>{
  assert.match(html,/function enrichServerRow\(r\)/);
  assert.match(html,/copy\.location=copy\.location\|\|best\.location/);
});


test('mobile controls use shared cross-platform typography and button appearance',()=>{
  assert.match(html,/button,input,textarea\{font-family:inherit;font-size:inherit;line-height:inherit\}/);
  assert.match(html,/button\{-webkit-appearance:none;appearance:none\}/);
});

test('old server voice rows are reparsed before Maps rendering',()=>{
  assert.match(html,/function repairRouteFields\(row\)/);
  assert.match(html,/offlineLocation\(raw\)/);
  assert.match(html,/serverRows=\(x\.stops\|\|\[\]\)\.map\(enrichServerRow\)/);
});
