const CACHE='ghadeer-pin-cache-v1';
const ASSETS=['./','./index.html','./assets/css/theme.css','./assets/js/crypto.js','./assets/js/app.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))})