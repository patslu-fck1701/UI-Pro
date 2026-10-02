'use strict';

const CACHE='werkz-time-shell-v3';
const SHELL=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icon.svg'];
const STATIC_URLS=new Set(SHELL.map(path=>new URL(path,self.registration.scope).href));

function staticShellRequest(request){
  if(request.method!=='GET'||request.headers.has('authorization'))return false;
  const url=new URL(request.url);url.search='';url.hash='';
  return STATIC_URLS.has(url.href);
}

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
  if(!staticShellRequest(event.request))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok&&response.type!=='opaque'&&!/\b(private|no-store)\b/i.test(response.headers.get('cache-control')||'')&&!response.headers.has('set-cookie')){
      const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    }
    return response;
  }).catch(()=>caches.match(event.request)));
});
