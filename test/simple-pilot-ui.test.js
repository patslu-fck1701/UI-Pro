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
  assert.match(html,/!r\.serverCallId\|\|!serverRouteLoaded&&\!serverIds\.has\(r\.serverCallId\)/);
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


test('missing scrap prices never render as zero',()=>{
  assert.match(html,/hasMin=r\.priceMin!=null&&r\.priceMin!==''/);
  assert.match(html,/hasSingle=r\.price!=null&&r\.price!==''/);
  assert.doesNotMatch(html,/min=Number\(r\.priceMin\),max=Number\(r\.priceMax\),single=Number\(r\.price\)/);
});

test('live scrap prices expose source, manual refresh, age and timed refresh',()=>{
  assert.match(html,/id="priceMeta"/);
  assert.match(html,/id="priceRefresh"/);
  assert.match(html,/\?refresh=1/);
  assert.match(html,/15\*60\*1000/);
  assert.match(html,/Preisstand/);
  assert.match(html,/geprüft/);
  assert.match(html,/automatisch alle 15 Min\./);
  assert.match(html,/Live \(teilweise\)/);
  assert.match(html,/addEventListener\('online'.*scrap\(false\)/s);
  assert.match(html,/visibilitychange.*scrap\(false\)/s);
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
  assert.match(html,/async function applyVoiceCreateResult\(localId,res\)/);
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
  assert.match(html,/register\('\/pilot\/sw\.js\?v=31'/);
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

test('pilot UI exposes v31 and passes tenant slug through the service worker URL',()=>{
  assert.match(html,/· v31/);
  assert.match(html,/register\('\/pilot\/sw\.js\?v=31'/);
  assert.match(sw,/werkz-simple-pilot-v31/);
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


test('operating base save has a real mobile click handler and visible status',()=>{
  assert.match(html,/id="operatingBaseSave" type="button">Standort speichern<\/button>/);
  assert.match(html,/id="operatingBaseStatus" class="note" aria-live="polite"/);
  assert.match(html,/operatingBaseSave\.addEventListener\('click'/);
  assert.match(html,/✓ Standort gespeichert/);
  assert.match(html,/Bitte zuerst einen Betriebsstandort eingeben\./);
  assert.match(html,/Speichern fehlgeschlagen\. Bitte Verbindung prüfen und erneut versuchen\./);
});

test('completed-order action uses red background and stays distinct from delete',()=>{
  assert.match(html,/\.taskdone\{[^}]*border:2px solid #743035;[^}]*background:#a9474d;[^}]*color:#fffdf9/);
  assert.match(html,/\.taskdelete\{[^}]*background:#f6e8e8;[^}]*color:#7b353b/);
  assert.match(html,/✓ AUFTRAG ERLEDIGT/);
  assert.match(html,/🗑 AUFTRAG LÖSCHEN/);
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


test('Maps button has raw-text fallback when parsed location is empty',()=>{
  assert.match(html,/function mapsDestination\(destination,rawText\)/);
  assert.match(html,/return offlineLocation\(raw\)\|\|raw/);
  assert.match(html,/mapsAction\(r\.location,'ZU DIESEM STOPP NAVIGIEREN',r\.originalText\)/);
  assert.match(html,/mapsAction\(first\.location,'GOOGLE MAPS STARTEN',first\.originalText\)/);
});

test('narrow Android search layout cannot push the search button off screen',()=>{
  assert.match(html,/grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(html,/\.searchbar input\{min-width:0;width:100%/);
  assert.match(html,/\.searchbar button\{max-width:38vw;white-space:nowrap\}/);
});


test('Auftragsübersicht and connected-route action are permanent core UI',()=>{
  assert.match(html,/Auftragsübersicht/);
  assert.match(html,/id="joinRouteBtn"/);
  assert.match(html,/ROUTEN VERBINDEN/);
  assert.match(html,/function combinedMapsUrl\(destinations\)/);
  assert.match(html,/function openCombinedRoute\(\)/);
  assert.match(html,/waypoints=/);
});

test('Auftrag erledigt is rendered on Start, overview and local-first orders',()=>{
  assert.match(html,/function completionButton\(o\)/);
  assert.match(html,/AUFTRAG ERLEDIGT/);
  assert.match(html,/data-complete-local=/);
  assert.match(html,/bindOrderActionButtons\(q\('#nextJob'\)\)/);
  assert.match(html,/bindOrderActionButtons\(q\('#routePlan'\)\)/);
  assert.match(html,/localOrderPatch\(localOrderId,\{status:'completed'/);
});


test('Auftrag löschen is a permanent cross-platform core action',()=>{
  assert.match(html,/AUFTRAG LÖSCHEN/);
  assert.match(html,/function deleteOrderButton\(o\)/);
  assert.match(html,/function deleteOrder\(callId,localOrderId\)/);
  assert.match(html,/queueablePost\('\/calls\/'\+encodeURIComponent\(callId\)\+'\/delete'/);
  assert.match(html,/status:'deleted'/);
  assert.match(html,/x\.status!==\'completed\'&&x\.status!==\'deleted\'/);
  assert.match(html,/deletedCallStorageKey\(\)/);
  assert.match(html,/data-delete-call=/);
  assert.match(html,/data-delete-local=/);
});


test('Android voice capture clears input focus before recognition',()=>{
  const click=html.indexOf("q('#noteBtn').onclick=async function()");
  const blur=html.indexOf("document.activeElement",click);
  const speech=html.indexOf("window.SpeechRecognition||window.webkitSpeechRecognition",click);
  assert.ok(click>=0&&blur>click&&speech>blur);
  assert.match(html,/search&&typeof search\.blur==='function'/);
  assert.match(html,/sorte\\s\*\(\?:\(\?:nummer\|nr/);
});

test('mobile offline voice parser shows free material and spoken kilometres',()=>{const vm=require('node:vm');const start=html.indexOf('function offlineMaterialInfo('),end=html.indexOf('function localVoiceOrderFromText(',start);assert.ok(start>=0&&end>start);const parse=vm.runInNewContext(html.slice(start,end)+';({offlineMaterialInfo,offlineDistanceKm,offlineFreeMaterial})');assert.equal(parse.offlineFreeMaterial('Kaputte Panzer abholen, 18 Kilometer'),'Kaputte Panzer');assert.equal(parse.offlineDistanceKm('Kaputte Panzer abholen, 18 Kilometer'),18);assert.equal(parse.offlineMaterialInfo('Sorte drei, 7 Kilometer').label,'Sorte 3');assert.equal(parse.offlineMaterialInfo('Sorte 3, 7 km').label,'Sorte 3');assert.equal(parse.offlineDistanceKm('Sorte drei, 7 Kilometer'),7);assert.equal(parse.offlineDistanceKm('Sorte drei abholen'),null);assert.match(html,/r\.distanceKm==null\?'km offen'/);assert.match(html,/GOOGLE MAPS STARTEN/);assert.match(html,/AUFTRAG ERLEDIGT/);assert.match(html,/AUFTRAG LÖSCHEN/)});

test('mobile local order stores material and km before server sync',()=>{const vm=require('node:vm');const start=html.indexOf('function offlineMaterialInfo('),end=html.indexOf('async function migrateQueuedVoiceOrders(',start);assert.ok(start>=0&&end>start);const create=vm.runInNewContext(html.slice(start,end)+';localVoiceOrderFromText');const free=create('Kaputte Panzer abholen, 18 Kilometer','local-18','2026-10-04T10:00:00Z');assert.equal(free.material,'Kaputte Panzer');assert.equal(free.distanceKm,18);const grade=create('Sorte drei, 7 Kilometer','local-7','2026-10-04T10:00:00Z');assert.equal(grade.material,'Sorte 3');assert.equal(grade.distanceKm,7);const noKm=create('Sorte 3 abholen','local-open','2026-10-04T10:00:00Z');assert.equal(noKm.distanceKm,null)});

test('home tour keeps driver-selected order with accessible move controls',()=>{assert.match(html,/id="tourCard" data-page="home"/);assert.match(html,/Meine Tour \/ Offene Abholungen/);assert.match(html,/id="tourList"/);assert.match(html,/data-tour-step="-1"/);assert.match(html,/data-tour-step="1"/);assert.match(html,/aria-label="Stopp hoch"/);assert.match(html,/aria-label="Stopp runter"/);assert.match(html,/werkz-tour-order:/);assert.match(html,/api\('\/route-order'/);assert.match(html,/renderTourList\(rows\)/);assert.match(html,/id="tourStart"[^>]*>[^<]*ROUTE STARTEN/);assert.match(html,/updateRouteJoin\(rows\)/);assert.match(html,/waypoints=/)});
test('monthly economics UI labels stated km and partial contribution honestly',()=>{assert.match(html,/id="economicsCard"/);assert.match(html,/Angegebene Auftragskilometer/);assert.match(html,/Kein Gewinn/);assert.match(html,/Alternative zur Tankkostenbetrachtung/);assert.match(html,/id="operatingBase"/);assert.match(html,/id="economicsMonth"/)});

test('selected tour order becomes Google Maps waypoint order',()=>{const vm=require('node:vm'),start=html.indexOf('function combinedMapsUrl('),end=html.indexOf('function openCombinedRoute(',start);assert.ok(start>=0&&end>start);const build=vm.runInNewContext(html.slice(start,end)+';combinedMapsUrl',{mapsUrl:x=>'single:'+x,URL,Set,encodeURIComponent});const url=new URL(build(['EZB Frankfurt','Ukraine']));assert.equal(url.searchParams.get('waypoints'),'EZB Frankfurt');assert.equal(url.searchParams.get('destination'),'Ukraine')});

test('P0 tour starts from visible address without app geolocation, material or km',()=>{
  const vm=require('node:vm'),start=html.indexOf('function tourDestination('),end=html.indexOf('function completionButton(',start);
  assert.ok(start>=0&&end>start);
  function harness(ua){const nodes={tourList:{innerHTML:'',querySelectorAll:()=>[]},tourCount:{textContent:''},tourStart:{disabled:true},tourFeedback:{textContent:''},joinRouteBtn:{disabled:true,textContent:''}};
    const ctx={q:id=>nodes[id.slice(1)],offlineLocation:()=>'',mapsUrl:x=>'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(x),esc:x=>String(x),encodeURIComponent,Set,Map,Number,String,Array,localStorage:{getItem:()=>null,setItem:()=>{}},tenantSlug:'pilot',window:{},navigator:{userAgent:ua,geolocation:{getCurrentPosition:()=>{throw Error('geolocation must not gate routes')}}},location:{href:''},api:async()=>({})};
    vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);return {ctx,nodes}};
  for(const ua of ['Android Chrome','iPhone Safari']){const {ctx,nodes}=harness(ua);ctx.renderTourList([{id:'local-1',name:'EZB',address:'Gallusanlage 7, 60329',material:'',distanceKm:null}]);assert.equal(nodes.tourStart.disabled,false);assert.match(nodes.tourList.innerHTML,/Gallusanlage 7, 60329/);assert.match(nodes.tourList.innerHTML,/Material offen/);assert.match(nodes.tourList.innerHTML,/km offen/);assert.match(ctx.openCombinedRoute(),/destination=Gallusanlage%207%2C%2060329/);assert.match(nodes.tourFeedback.textContent,/Google Maps/)}
});
test('P0 tour blocks all stops when one lacks a target and preserves moved order',()=>{
  const vm=require('node:vm'),start=html.indexOf('function tourDestination('),end=html.indexOf('function completionButton(',start),nodes={tourList:{innerHTML:'',querySelectorAll:()=>[]},tourCount:{textContent:''},tourStart:{disabled:false},tourFeedback:{textContent:''},joinRouteBtn:{disabled:false,textContent:''}};
  const ctx={q:id=>nodes[id.slice(1)],offlineLocation:()=>'',mapsUrl:x=>'single:'+x,esc:x=>String(x),encodeURIComponent,Set,Map,Number,String,Array,localStorage:{getItem:()=>null,setItem:()=>{}},tenantSlug:'pilot',window:{},location:{href:''},api:async()=>({})};vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
  ctx.renderTourList([{id:'a',location:'Frankfurt'},{id:'b',name:'Ziel unbekannt'}]);assert.match(nodes.tourList.innerHTML,/data-missing-destination="true"/);assert.equal(nodes.tourStart.disabled,true);assert.match(nodes.tourFeedback.textContent,/Route gesperrt: Stopp 2/);assert.equal(ctx.openCombinedRoute(),false);assert.equal(ctx.location.href,'');assert.match(nodes.tourFeedback.textContent,/Stopp 2/);
  ctx.renderTourList([{id:'b',location:'Berlin'},{id:'a',location:'Frankfurt'},{id:'c',location:'Berlin'}]);const url=new URL(ctx.openCombinedRoute());assert.equal(url.searchParams.get('waypoints'),'Berlin|Frankfurt');assert.equal(url.searchParams.get('destination'),'Berlin');
});

test('offline and backend target parsers agree for natural zu zum zur and address',()=>{
  const vm=require('node:vm'),backend=require('../src/pilot'),start=html.indexOf('function offlineFreeMaterial('),end=html.indexOf('function localVoiceOrderFromText(',start);
  const parse=vm.runInNewContext(html.slice(start,end)+';({offlineLocation,offlineFreeMaterial})');
  const cases=['Ich will zum Nordpol fahren und Schnee holen.','Ich möchte zum Nordpol.','Zum Nordpol fahren und Schnee holen.','Zum Weihnachtsmann an den Nordpol fahren.','Ich muss zur Firma Müller.','Ich fahre zu Meyer und hole Schrott.','Gallusanlage 7, 60329'];
  for(const raw of cases)assert.equal(parse.offlineLocation(raw),backend.parseOperationalNote(raw).location,raw);
  assert.equal(parse.offlineFreeMaterial(cases[0]),'Schnee');
  assert.match(html,/row.status==='deleted'\|\|row.status==='completed'&&\!row.manualPayload/);
  assert.match(html,/await dropQueuedOrderCreate\(localOrderId\)/);
  assert.match(html,/markDeletedCall\(callId\)/);
});
test('voice diagnostics are hidden unless session enables them and stay tenant-local',()=>{
  assert.match(html,/id="voiceDiagnosticCard"[^>]*style="display:none"/);
  assert.match(html,/s.voiceDiagnostics===true\?'block':'none'/);
  assert.match(html,/api\('\/voice-diagnostics'\)/);
  assert.match(html,/localOrderAllSync\(\)/);
  assert.match(html,/safeDiagnosticText\(raw\)/);
});

test('calculator transfer stays explicit and uses normal local order and call sync',()=>{
  assert.match(html,/id="pickupTakeoverBtn"[^>]*hidden/);
  assert.match(html,/lastPickupEstimate=x;q\('#pickupTakeoverBtn'\).hidden=false/);
  assert.match(html,/function openPickupOrderTakeover\(\)/);
  assert.match(html,/async function savePickupOrder\(\)/);
  assert.match(html,/Bitte Adresse oder Ort eingeben/);
  assert.match(html,/source:'pickup-calculator'/);
  assert.match(html,/plannedCustomerPayoutEur:pay/);
  assert.match(html,/Angegebene Kilometer/);
  assert.match(html,/localOrderPutSync\(local\)/);
  assert.match(html,/await api\('\/calls'/);
  assert.match(html,/row.manualPayload\?await api\('\/calls'/);
  assert.match(html,/pickupOrderSaving\|\|pickupOrderSavedId/);assert.match(html,/saveButton\.disabled=false/);assert.match(html,/pickupOrderLocation','pickupOrderName','pickupOrderPhone','pickupOrderDate/);
});

test('successful server tour response cannot resurrect synced local call absent on server',()=>{
  assert.match(html,/serverRouteLoaded=true/);
  assert.match(html,/!r.serverCallId\|\|!serverRouteLoaded&&\!serverIds.has\(r.serverCallId\)/);
});
