// Regression probes use actual UI code and explicitly synthetic, isolated APIs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');const f=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(root))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf'})[path.extname(f)]||'application/octet-stream');res.end(await fs.readFile(f));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const id='b0000000-0000-4000-8000-000000000001';
const base={id,name:'Synthetic QA place',category:'cafe',city:'São Paulo',state:'SP',address:'QA address',neighbourhood:'QA',unit:'QA',lat:-23.55,lng:-46.63,position:'left',review_state:'current',source_url:'https://example.invalid/private-unpublished-evidence',source_type:'direct',source_scope:'QA only',source_published_at:null,verified_at:'2026-01-01T00:00:00Z',customer_statement:'Synthetic expiring statement',revision:1};
try{
 await test('logout and pagehide erase private derived DOM attributes',async()=>{
  const context=await browser.newContext({serviceWorkers:'block'});let signed=true;
  await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==origin)return route.abort();if(!u.pathname.startsWith('/api/'))return route.continue();
   let value,status=200;const p=u.pathname;
   if(p.endsWith('/session')){value=signed?{ok:true,csrf:'synthetic-csrf',role:'admin'}:{error:'unauthorized'};status=signed?200:401;}
   else if(p.endsWith('/queue'))value={submissions:[{id,revision:1,status:'pending',created_at:new Date().toISOString(),payload:base}],corrections:[],establishments:[]};
   else if(p.endsWith('/audit'))value={items:[]};else if(p.endsWith('/logout')){signed=false;value={ok:true};}else {value={error:'not_found'};status=404;}
   return route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
  });
  const page=await context.newPage();await page.goto(origin+'/admin.html');await page.locator('.queue-item').click();assert.equal(await page.locator('#open-source').getAttribute('href'),base.source_url);
  await page.click('#logout');await page.locator('#login-panel:not([hidden])').waitFor();
  async function assertClean(){assert.equal(await page.locator('#open-source').getAttribute('href'),null);assert.equal(await page.locator('#record-id').textContent(),'');assert.equal(await page.locator('#revision').textContent(),'');assert.equal(await page.locator('#record-context').textContent(),'');assert.equal(await page.locator('#decision-form [name="source_url"]').inputValue(),'');}
  await assertClean();signed=true;await page.reload();await page.locator('.queue-item').click();await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await assertClean();await context.close();
 });
 await test('real-clock expiry immediately scrubs list, map, detail and source without a network response',async()=>{
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});let due;
  await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==origin)return route.abort();if(!u.pathname.startsWith('/api/'))return route.continue();
   due ||= Date.now()+2500;
   // No successful response after expiry: removal cannot depend on polling.
   if(Date.now()>=due)return route.abort('failed');
   const p={...base,review_due_at:new Date(due).toISOString()};
   const value=u.pathname==='/api/cities'?{items:['São Paulo']}:u.pathname==='/api/map'?{items:[p],total:1,clustered:false}:u.pathname===`/api/establishments/${id}`?p:{items:[p],total:1,next_offset:null,queried_at:new Date().toISOString()};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
  });
  const page=await context.newPage();await page.goto(origin);await page.locator('[data-open]').click();await page.locator('#detail .source-box a').waitFor();assert.equal(await page.locator('#results .left').count(),1);
  await new Promise(r=>setTimeout(r,Math.max(0,due-Date.now())+350));
  assert.equal(await page.locator('#results .left').count(),0);assert.equal(await page.locator('.map-pin.left').count(),0);assert.equal(await page.locator('#detail .position-badge.left').count(),0);assert.equal(await page.locator('#detail .source-box a').count(),0);assert.ok(!(await page.locator('#detail').textContent()).includes(base.customer_statement));
  await context.close();
 });
}finally{await browser.close();await new Promise(r=>server.close(r));}
