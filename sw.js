const CACHE_NAME = "comm-interne-shell-v4";
const SHELL = ["./index.html","./reception.html","./personnel.html","./disponibilite.html","./historique.html","./admin.html","./css/style.css","./config.js","./js/supabase.js","./js/common.js","./js/mitappinventor-bridge.js","./js/login.js","./js/reception.js","./js/personnel.js","./js/chat.js","./js/disponibilite.js","./js/historique.js","./js/admin.js","./manifest.json","./assets/logo-ujadi.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html"))));
});