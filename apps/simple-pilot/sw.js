'use strict';
const CACHE='werkz-simple-pilot-v14';
const SHELL=['/pilot/','/pilot/index.html','/pilot/manifest.webmanifest','/pilot/icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('werkz-simple-pilot-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/pilot/api/')||url.pathname.startsWith('/pilot/public/')||url.pathname.startsWith('/pilot/site/'))return;
  if(!SHELL.includes(url.pathname))return;
  event.respondWith(fetch(request).then(response=>{
    if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}
    return response;
  }).catch(()=>caches.match(request).then(hit=>hit||caches.match('/pilot/'))));
});
