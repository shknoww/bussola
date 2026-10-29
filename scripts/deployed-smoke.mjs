import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
const origin=process.env.BUSSOLA_ORIGIN||'https://bussola-mira.vercel.app';
assert.equal(new URL(origin).protocol,'https:');
const out='.private/evidence';await fs.mkdir(out,{recursive:true});
for(const [route,status] of [['/',200],['/api/health',200],['/api/establishments',200],['/api/map',200],['/api/cities',200],['/api/admin/queue',401],['/admin',200],['/api/establishments?path=admin/queue',200],['/api/establishments?category=cafe&position=right',200]]){
 const r=await fetch(origin+route);assert.equal(r.status,status,route);if(route.startsWith('/api/')||route==='/admin')assert.equal(r.headers.get('cache-control'),'no-store');
 if(route==='/api/health')assert.deepEqual(await r.json(),{ok:true,database:true});
 if(route.includes('path=admin')) {const v=await r.json();assert.ok(Array.isArray(v.items));assert.equal(v.submissions,undefined);assert.equal(v.corrections,undefined);}
 console.log(`HTTP ${status} ${route}`);
}
const bad=await fetch(origin+'/api/submissions',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'invalid'})});assert.equal(bad.status,400);
const token=execFileSync('/usr/bin/security',['find-generic-password','-s','mira/bussola/admin-token','-w'],{encoding:'utf8'}).trim();
for(const [engine,launcher] of Object.entries({chromium,webkit})){
 const browser=await launcher.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const csp=[];page.on('console',msg=>{if(msg.type()==='error'&&/Content Security Policy|Refused/.test(msg.text()))csp.push(msg.text());});
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 await page.locator('#results-count').filter({hasText:/^\d+/}).waitFor({state:'attached'});
 await page.locator('#language').selectOption('en-GB');assert.equal(await page.locator('html').getAttribute('lang'),'en-GB');
 for(const width of [360,390,768,1440]){
  await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);await page.locator('#results-count').filter({hasText:/^\d+/}).waitFor({state:'attached'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${engine} overflow ${width}`);
  if(width===390){await page.locator('#mobile-toggle').click();await page.screenshot({path:`${out}/production-${engine}-mobile.png`});await page.locator('#mobile-toggle').click();}
 }
 await page.locator('#language').selectOption('pt-BR');await page.locator('#results-count').filter({hasText:/^\d+/}).waitFor({state:'attached'});await page.screenshot({path:`${out}/production-${engine}-desktop.png`});
 await page.click('#suggest-button');await page.locator('#suggest-form [name="name"]').fill('');await page.locator('#suggest-form button[type="submit"]').click();assert.equal(await page.locator('#suggest-form').evaluate(f=>f.checkValidity()),false);await page.locator('#suggest-dialog [data-close]').click();
 await page.click('#install-button');await page.locator('#install-dialog').waitFor();await page.keyboard.press('Escape');
 // Real production service worker; no API/admin/tiles may enter its cache.
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.locator('#offline-banner:not([hidden])').waitFor();
 assert.equal(await page.locator('.position-badge').count(),0);
 const cached=await page.evaluate(async()=>{const urls=[];for(const key of await caches.keys()){for(const req of await(await caches.open(key)).keys())urls.push(req.url);}return urls;});
 assert.ok(cached.length>0);assert.ok(cached.every(u=>new URL(u).origin===origin));
 assert.ok(cached.every(u=>!new URL(u).pathname.startsWith('/api/')&&!new URL(u).pathname.startsWith('/admin')));
 await context.setOffline(false);await page.reload({waitUntil:'domcontentloaded'});await page.locator('#results-count').filter({hasText:/^\d+/}).waitFor({state:'attached'});
 // Actual deployed session; no records are created or moderated.
 const login=await context.request.post(origin+'/api/admin/login',{data:{token},headers:{Origin:origin}});assert.equal(login.status(),200);const csrf=(await login.json()).csrf;
 await page.goto(origin+'/admin');await page.locator('#workspace:not([hidden])').waitFor();
 const queue=await context.request.get(origin+'/api/admin/queue');assert.equal(queue.status(),200);const q=await queue.json();console.log(`${engine}: authenticated queue read (${q.submissions.length} suggestions, ${q.establishments.length} places)`);
 await page.selectOption('#language','en-GB');await page.screenshot({path:`${out}/production-${engine}-admin.png`,fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(csp,[]);
 const logout=await context.request.post(origin+'/api/admin/logout',{data:{},headers:{Origin:origin,'X-CSRF-Token':csrf}});assert.equal(logout.status(),200);
 await context.close();await browser.close();
 console.log(`${engine}: deployed public/admin UI, translations, 4 widths, real auth, CSP and console passed.`);
}
