const CACHE='ghadeer-auth-cache-v3';
const ASSETS=[
  './',
  './index.html',
  './assets/css/theme.css',
  './assets/js/Crypto.js',
  './assets/js/app.js'
];
const LEGACY_CACHES=['ghadeer-auth-cache-v1','ghadeer-auth-cache-v2','ghadeer-pin-cache-v1'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate',event=>{
  const allowList=new Set([CACHE]);
  const legacySet=new Set(LEGACY_CACHES);

  event.waitUntil(
    caches
      .keys()
      .then(keys=>
        Promise.all(
          keys
            .filter(key=>legacySet.has(key)&&!allowList.has(key))
            .map(key=>caches.delete(key))
        )
      )
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  event.respondWith(
    caches.match(event.request).then(response=>response||fetch(event.request))
  );
});
