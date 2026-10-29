// Strict shell allowlist: never store API responses, admin, sources or tiles.
const CACHE='bussola-shell-public-v6';
const FILES=['/index.html','/app.js','/style.css','/lib/public-core.js','/i18n/public-pt-BR.js','/i18n/public-en-GB.js','/manifest.webmanifest','/icons/icon.svg','/icons/icon-192.png','/icons/icon-512.png','/icons/maskable-512.png','/vendor/leaflet.js','/vendor/leaflet.css','/vendor/fonts.css','/vendor/dm-sans-400.ttf','/vendor/dm-sans-500.ttf','/vendor/dm-sans-600.ttf','/vendor/dm-sans-700.ttf'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('bussola-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/admin'))return;
  const navigation=event.request.mode==='navigate'&&(url.pathname==='/'||url.pathname==='/index.html');
  const key=navigation?'/index.html':url.pathname;
  if(!FILES.includes(key))return;
  // Never cache query-specific navigation, tokens or arbitrary query strings.
  if(!navigation&&url.search)return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok&&!response.redirected&&(!navigation||response.headers.get('content-type')?.includes('text/html'))){
      const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(key,copy)));
    }
    return response;
  }).catch(async()=>{const cached=await caches.match(key);return cached||Response.error();}));
});
