'use strict';
const CACHE='werkz-assistant-v5';
const STATIC=['/assistant/','/assistant/styles.css','/assistant/app.js','/assistant/manifest.webmanifest','/assistant/apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.pathname.startsWith('/api/'))return;
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));
});
