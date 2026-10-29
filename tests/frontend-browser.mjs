// Isolated browser acceptance harness. MOCK API ONLY; no production backend or user data.
// Run: node tests/frontend-browser.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const target=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!target.startsWith(root))throw Error();const data=await fs.readFile(target);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf'})[path.extname(target)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end('not found');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const id='b0000000-0000-4000-8000-000000000001';
const receipt='c0000000-0000-4000-8000-000000000001';
const mock={id,name:'MOCK Café <script>',category:'cafe',city:'São Paulo',state:'SP',address:'MOCK business address',neighbourhood:'MOCK neighbourhood',unit:'MOCK unit',lat:-23.55,lng:-46.67,position:'left',review_state:'current',source_url:'https://example.invalid/mock-source',source_type:'direct',source_scope:'MOCK unit only',source_published_at:null,verified_at:'2026-01-01T00:00:00Z',review_due_at:'2099-01-01T00:00:00Z',customer_statement:'MOCK factual statement',revision:1};
let browser;
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 let fail=false,hidden=false,suspended=false,pageMode=false,submissionFailure=true,mapClusters=false;
 const requests=[],posts=[],errors=[];
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==origin){await route.abort();return;}
  if(!url.pathname.startsWith('/api/')){await route.continue();return;}
  requests.push(url);
  const reply=(body,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  if(route.request().method()==='POST'){
   const payload=route.request().postDataJSON();posts.push({path:url.pathname,payload});
   if(submissionFailure){submissionFailure=false;return reply({error:'mock_unavailable'},503);}
   return reply({id:receipt,status:'pending'},201);
  }
  if(fail)return reply({error:'mock_unavailable'},503);
  if(url.pathname==='/api/cities')return reply({items:['São Paulo','MOCK City']});
  if(url.pathname===`/api/establishments/${id}`){if(hidden)return reply({error:'not_found'},404);return reply(suspended?{...mock,position:'unknown',review_state:'suspended',source_url:null,customer_statement:null}:mock);}
  const offset=Number(url.searchParams.get('offset')||0);
  const place=suspended?{...mock,position:'unknown',review_state:'suspended',source_url:null,customer_statement:null}:mock;
  const filtered=hidden||(url.searchParams.get('position')==='right');
  const total=filtered?0:mapClusters?250:pageMode?51:1;
  if(url.pathname==='/api/establishments')return reply({items:filtered?[]:total>1&&!offset?Array.from({length:50},(_,i)=>({...place,id:'b0000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),name:i?'MOCK page row '+i:place.name})):[{...place,name:offset?'MOCK second page':place.name}],total,next_offset:!offset&&total>50?50:null,queried_at:new Date().toISOString()});
  if(url.pathname==='/api/map')return reply({items:filtered?[]:total>1?[{cluster:true,lat:-23.55,lng:-46.67,count:total}]:[place],total,clustered:total>1});
  return reply({error:'not_found'},404);
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
 await page.goto(origin);await page.locator('[data-open]').first().waitFor();
 assert.match(await page.locator('#results').textContent(),/MOCK Café <script>/);
 assert.equal(await page.locator('#results script').count(),0);
 await page.selectOption('#language','en-GB');assert.equal(await page.locator('html').getAttribute('lang'),'en-GB');
 assert.equal(await page.locator('#view-title').textContent(),'Your next place.');
 await page.click('[data-position="right"]');await page.getByRole('heading',{name:'No places found.'}).waitFor();
 assert.ok(requests.some(u=>u.pathname==='/api/map'&&u.searchParams.get('position')==='right'));
 await page.click('[data-position="all"]');await page.locator('[data-open]').first().waitFor();
 const searchResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/establishments'&&new URL(r.url()).searchParams.get('q')==='café');
 await page.fill('#search','café');await page.clock.runFor(300);await searchResponse;assert.ok(requests.some(u=>u.searchParams.get('q')==='café'));
 await page.selectOption('#category','cafe');await page.waitForTimeout(100);
 assert.ok(requests.some(u=>u.pathname==='/api/establishments'&&u.searchParams.get('category')==='cafe'&&u.searchParams.get('q')==='café'));
 await page.click('#search-area');await page.waitForTimeout(100);assert.ok(requests.some(u=>u.searchParams.has('bbox')));
 await page.selectOption('#city','MOCK City');await page.waitForTimeout(100);
 assert.ok(requests.filter(u=>u.pathname==='/api/map').at(-1).searchParams.get('city')==='MOCK City');assert.ok(!requests.filter(u=>u.pathname==='/api/map').at(-1).searchParams.has('bbox'));
 pageMode=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('#load-more:not([hidden])').waitFor();await page.click('#load-more');await page.getByText('MOCK second page',{exact:true}).waitFor();assert.ok(requests.some(u=>u.searchParams.get('offset')==='50'));await page.click('#previous-page');await page.locator('[data-open]').first().waitFor();pageMode=false;
 await page.locator('[data-open]').first().click();await page.locator('#detail .source-box a').waitFor();assert.ok(page.url().includes('?place='+id));assert.match(await page.locator('#detail').textContent(),/Date not provided/);assert.equal(await page.locator('#detail .source-box a').getAttribute('href'),mock.source_url);
 await page.locator('#detail [data-save]').click();
 const saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('bussola-favourites-v1')));assert.deepEqual(Object.keys(saved[0]),['id','name','neighbourhood']);assert.equal(saved[0].id,id);
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k!=='bussola-favourites-v1')return original.call(this,k,v);};});await page.locator('#detail [data-save]').click();assert.equal(await page.locator('#detail [data-save]').getAttribute('aria-pressed'),'true');await page.getByText('Could not read or write saved places. Check browser permissions.',{exact:true}).first().waitFor();
 await page.click('[data-correct]');await page.fill('#correction-form textarea','MOCK correction only');await page.click('#correction-form button[type="submit"]');await page.getByText(/Could not confirm submission/).waitFor();assert.equal(await page.locator('#correction-form textarea').inputValue(),'MOCK correction only');await page.click('#correction-form button[type="submit"]');await page.getByText(new RegExp('Received for review.*'+receipt)).waitFor();assert.equal(posts[0].payload.idempotency_key,posts[1].payload.idempotency_key);assert.equal(posts[0].path,`/api/establishments/${id}/corrections`);
 await page.locator('#correction-dialog [data-close]').click();
 suspended=true;await page.clock.runFor(25010);await page.getByText('Classification suspended',{exact:true}).waitFor();assert.equal(await page.locator('#detail .source-box a').count(),0);assert.ok(!(await page.locator('#detail').textContent()).includes(mock.customer_statement));
 await context.setOffline(true);await page.evaluate(()=>window.dispatchEvent(new Event('offline')));await page.getByRole('heading',{name:'Political information unavailable offline.'}).waitFor();assert.equal(await page.locator('#detail a').count(),0);assert.equal(await page.locator('.map-pin').count(),0);
 await page.locator('#detail [data-close]').click();await page.click('[data-view="saved"]');assert.match(await page.locator('#results').textContent(),/MOCK Café/);assert.equal(await page.locator('#results .position-badge').count(),0);
 await context.setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.locator('#results [data-open]').waitFor();
 hidden=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByText('Place unavailable',{exact:true}).waitFor();assert.equal(await page.locator('#results .position-badge').count(),0);
 hidden=false;fail=true;await page.click('[data-view="explore"]');await page.getByRole('heading',{name:'Could not load the data. Please try again.'}).waitFor();assert.equal(await page.getByRole('heading',{name:'No places found.'}).count(),0);
 fail=false;await page.click('[data-retry]');await page.locator('[data-open]').first().waitFor();
 await page.click('#suggest-button');await page.fill('#suggest-form [name="name"]','MOCK submission');await page.fill('#suggest-form [name="city"]','MOCK city');await page.fill('#suggest-form [name="state"]','SP');await page.fill('#suggest-form [name="address"]','MOCK commercial address');await page.selectOption('#suggest-position','left');await page.fill('#suggest-source','http://example.invalid');await page.check('#suggest-form [type="checkbox"]');const before=posts.length;await page.click('#suggest-form button[type="submit"]');assert.match(await page.locator('#suggest-status').textContent(),/https/);assert.equal(posts.length,before);await page.fill('#suggest-source','https://example.invalid/mock-source');await page.click('#suggest-form button[type="submit"]');await page.locator('#suggest-status').filter({hasText:'Received for review'}).waitFor();assert.equal(posts.at(-1).path,'/api/submissions');assert.equal(posts.at(-1).payload.website,'');await page.locator('#suggest-dialog [data-close]').click();
 mapClusters=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('.cluster-pin').waitFor();assert.ok(await page.locator('.cluster-pin').count()<=200);const prior=requests.length;await page.click('.cluster-pin');await page.waitForTimeout(150);assert.ok(requests.slice(prior).some(u=>u.searchParams.has('bbox')));
 for(const width of [360,390,768,1440]){await page.setViewportSize({width,height:900});await page.waitForTimeout(60);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no page overflow at ${width}`);if(process.env.FRONTEND_SCREENSHOTS){await fs.mkdir(process.env.FRONTEND_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.FRONTEND_SCREENSHOTS,`mock-public-${width}.png`)});}}
 await page.setViewportSize({width:390,height:900});if(await page.locator('.sidebar').isVisible())await page.click('#mobile-toggle');await page.click('#mobile-toggle');assert.ok(await page.locator('.sidebar').isVisible());await page.click('#mobile-toggle');assert.ok(await page.locator('.map-section').isVisible());
 await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/?place='+id);await page.locator('#detail-title').filter({hasText:mock.name}).waitFor();assert.equal(await page.locator('#detail-dialog').evaluate(d=>d.open),true);
 await page.locator('#detail [data-close]').click();await page.click('#install-button');await page.getByText(/In Safari on iPhone/).waitFor();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'install-button');
 assert.deepEqual(errors,[]);
 const denied=await context.newPage();denied.on('pageerror',e=>errors.push(e.message));await denied.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('MOCK storage denied');}}));await denied.goto(origin);await denied.locator('#storage-status:not([hidden])').waitFor();await denied.locator('#results [data-save]').first().click();assert.equal(await denied.locator('#saved-count').textContent(),'0');assert.deepEqual(errors,[]);await denied.close();
 await context.close();
 console.log('PASS MOCK browser: filters, bbox, city reset, pagination, safe details/deep links, sources/dates, verified minimal favourites, correction retry/idempotency, suspension, offline redaction, withdrawn favourites, error recovery, real form payload, clusters, 360/390/768/1440 overflow, mobile switching, install/focus; no JS errors.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
