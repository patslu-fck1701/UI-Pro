'use strict';

self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('werkz-time-shell-')).map(key=>caches.delete(key)))),
  self.registration.unregister(),
  self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>Promise.all(clients.map(client=>client.navigate('/pilot/'))))
])));
