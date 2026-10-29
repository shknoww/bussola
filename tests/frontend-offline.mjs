// MOCK-only loopback server; real Chromium Service Worker and Cache Storage.
// No production API, database, credentials or real establishments.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(url.pathname==='/api/cities'?{items:[]}:url.pathname==='/api/map'?{items:[],total:0,clustered:false}:{items:[],total:0,next_offset:null,queried_at:new Date().toISOString()}));return;}const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:900}});
 await context.route('https://**/*',r=>r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller);
 await page.locator('#mobile-toggle').click();await page.getByRole('heading',{name:'Nenhum lugar por aqui.'}).waitFor();
 await page.evaluate(()=>localStorage.setItem('bussola-favourites-v1',JSON.stringify([{id:'b0000000-0000-4000-8000-000000000001',name:'MOCK offline name',neighbourhood:'MOCK district'}])));
 const cache=await page.evaluate(async()=>{const names=await caches.keys();const result=[];for(const name of names){for(const r of await (await caches.open(name)).keys())result.push(r.url);}return result;});
 assert.ok(cache.some(u=>u.endsWith('/lib/public-core.js')));assert.ok(cache.some(u=>u.endsWith('/i18n/public-en-GB.js')));assert.ok(cache.every(u=>!u.includes('/api/')&&!u.includes('/admin')&&!u.includes('tile.openstreetmap')));
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.locator('#offline-banner:not([hidden])').waitFor();
 await page.locator('.navigation [data-view="saved"]').click();await page.getByRole('heading',{name:'MOCK offline name'}).waitFor();assert.equal(await page.locator('#results .position-badge').count(),0);assert.equal(await page.locator('.map-pin').count(),0);
 await page.selectOption('#language','en-GB');assert.match(await page.locator('#results').textContent(),/Political information unavailable offline/);
 await page.goto(origin+'/?place=b0000000-0000-4000-8000-000000000001',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Political information unavailable offline.'}).waitFor();assert.equal(await page.locator('#detail a').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS MOCK offline: actual service-worker installation, shell/cache allowlist, offline reload and deep link, bilingual cached modules, minimal favourite identification, no cached API/admin/tiles or political claims.');await context.close();
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
