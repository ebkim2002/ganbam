const RELEASE='7ad8060f21346897c75c';
const PREFIX='ganbam-host-shell-'+encodeURIComponent(self.registration.scope)+'-';
const CACHE=PREFIX+RELEASE;
const SHELL=['./','./index.html','./style.css','./app.mjs','./model.mjs','./original-compute.mjs','./export.mjs','./manifest.webmanifest','./icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png'];
const ALLOWED=new Set(SHELL.map(p=>new URL(p,self.registration.scope).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(p=>new Request(new URL(p,self.registration.scope).href,{cache:'reload',credentials:'omit'}))))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 // Cache only known, static, same-scope assets. Never requests with params,
 // API endpoints, POSTs, generated images, accounts, drafts or result data.
 if(event.request.method!=='GET'||!ALLOWED.has(event.request.url))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{const saved=await cache.match(event.request);if(saved)return saved;const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response;}));
});
