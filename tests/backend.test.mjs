import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {createHandler,createGateway} from '../server/app.mjs';
import {submission,place,decision,filters} from '../server/validation.mjs';

const id='10000000-0000-4000-8000-000000000001';
const token='unit-test-owner-key-not-production-00000000000000';
const env={NODE_ENV:'production',ADMIN_TOKEN_HASH:createHash('sha256').update(token).digest('hex'),SESSION_SECRET:'unit-test-session-secret-'.repeat(3),RATE_LIMIT_SALT:'unit-test-rate-limit-salt-'.repeat(3)};
const valid={idempotency_key:id,name:'Café Teste',category:'cafe',city:'São Paulo',state:'SP',address:'Rua Teste, 1',neighbourhood:'Centro',unit:'Unidade um',position:'unknown',source_url:null,notes:'Somente teste',website:''};
const published={...valid,lat:-23,lng:-46,source_type:null,source_scope:'',source_published_at:null,source_verified:false,review_due_at:null,customer_statement:null};
for(const k of ['idempotency_key','notes','website']) delete published[k];
const run=async(handler,url,method='GET',payload,headers={})=>{
 const req=Readable.from(payload===undefined?[]:[JSON.stringify(payload)]);
 Object.assign(req,{url,method,headers:{host:'bussola.example',...(payload===undefined?{}:{'content-type':'application/json'}),...headers},socket:{remoteAddress:'127.0.0.1'}});
 const response={headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(raw){this.body=JSON.parse(raw);}};
 await handler(req,response);return response;
};
function setup(gateway){const calls=[];const h=createHandler({env,gateway:gateway || (async(op,payload)=>{calls.push({op,payload});return op==='rate_limit'?{allowed:true}:op==='health'?{ok:true,database:true}:{op,payload};})});return {h,calls};}
async function login(h){const r=await run(h,'/api/admin/login','POST',{token},{origin:'https://bussola.example'});assert.equal(r.statusCode,200);return {cookie:r.headers['set-cookie'].split(';')[0],csrf:r.body.csrf,response:r};}

test('submission validates, rejects unknown/contact fields and directional source absence',()=>{
 assert.equal(submission(valid).name,'Café Teste');
 for(const p of [{...valid,email:'private@example.com'},{...valid,website:'spam'},{...valid,position:'left'},{...valid,source_url:'javascript:alert(1)'},{...valid,idempotency_key:'abc'},{...valid,notes:'x'.repeat(4001)}])assert.throws(()=>submission(p));
});
test('publication requires direct confirmed unit-scoped future source; unknown needs none',()=>{
 assert.equal(place(published).position,'unknown');
 const p={...published,position:'left',source_url:'https://example.com/source',source_type:'direct',source_scope:'Esta unidade',source_verified:true,review_due_at:'2099-01-01T00:00:00Z'};
 assert.equal(place(p).position,'left');
 for(const v of [{...p,source_type:'third_party'},{...p,source_verified:false},{...p,source_scope:''},{...p,review_due_at:'2000-01-01T00:00:00Z'},{...p,lat:91},{...p,lng:NaN},{...p,source_url:'https://user:secret@example.com/'}])assert.throws(()=>place(v));
 assert.throws(()=>place({...published,customer_statement:'Declaração sem prova'}));
});
test('decision rejects bad transitions, stale-format revision and unexpected place data',()=>{
 const d={kind:'establishment',id,expected_revision:1,action:'publish',reason:'Reviewed',place:published};
 assert.equal(decision(d).place.name,published.name);
 for(const x of [{...d,expected_revision:0},{...d,action:'reject'},{...d,reason:''},{...d,action:'suspend'},{...d,kind:'submission',action:'archive'}])assert.throws(()=>decision(x));
});
test('filter validation keeps intersections, zero offsets, exact ids and bbox',()=>{
 const f=filters(new URLSearchParams(`q=cafe&city=São Paulo&category=cafe&position=left&bbox=-50,-25,-40,-20&offset=50&ids=${id}`));
 assert.equal(f.offset,50);assert.deepEqual(f.bbox,[-50,-25,-40,-20]);assert.deepEqual(f.ids,[id]);
 for(const s of ['position=centrist','q=a&q=b','bbox=1,2,0,3','bbox=,2,3,4','offset=-1','offset=1.1','email=x','ids=oops'])assert.throws(()=>filters(new URLSearchParams(s)));
});
test('public routes map to exact gateway operations and preserve rewritten queries',async()=>{
 const {h,calls}=setup();
 for(const url of ['/api/establishments?position=unknown','/api/index?path=map&city=São%20Paulo','/api/index.js?path=establishments&q=cafe',`/api/establishments/${id}`,'/api/cities','/api/health'])assert.equal((await run(h,url)).statusCode,200);
 assert.deepEqual(calls.map(c=>c.op),['list','map','list','detail','cities','health']);
 assert.equal(calls[1].payload.city,'São Paulo');assert.equal(calls[2].payload.q,'cafe');
 assert.equal((await run(h,'/api/index?path=map&path=admin/queue')).statusCode,400);
  assert.equal((await run(h,'/api/establishments?path=admin/queue')).statusCode,400);
  assert.equal((await run(h,'/api/establishments?path=establishments&position=left')).statusCode,200);
  assert.equal(calls.at(-1).op,'list'); assert.equal(calls.at(-1).payload.position,'left');
  assert.equal((await run(h,'/api/admin/queue?path=admin/queue')).statusCode,401);
});
test('valid public writes are rate-limited with salted hashes, not raw addresses or filters',async()=>{
 const {h,calls}=setup();
 const r=await run(h,'/api/submissions','POST',valid,{origin:'https://bussola.example'});
 assert.equal(r.statusCode,201);assert.equal(calls[0].op,'rate_limit');assert.match(calls[0].payload.key,/^[a-f0-9]{64}$/);assert.equal(calls[1].op,'submit');
 assert.equal(JSON.stringify(calls[0]).includes('127.0.0.1'),false);
 assert.equal((await run(h,`/api/establishments/${id}/corrections`,'POST',{idempotency_key:id,reason:'source',notes:'Review this source',website:''})).statusCode,201);
});
test('same-origin policy rejects browser cross-origin and null origin but permits originless nonbrowser',async()=>{
 const {h,calls}=setup();
 for(const headers of [{origin:'https://evil.example'},{origin:'null'},{origin:'https://bussola.example','sec-fetch-site':'cross-site'},{'sec-fetch-site':'same-origin'}])assert.equal((await run(h,'/api/submissions','POST',valid,headers)).statusCode,403);
 assert.equal(calls.length,0);
 assert.equal((await run(h,'/api/submissions','POST',valid)).statusCode,201);
});
test('oversize, malformed and wrong-content-type writes never hit database',async()=>{
 const {h,calls}=setup();
 assert.equal((await run(h,'/api/submissions','POST',{...valid,notes:'x'.repeat(25000)})).statusCode,400);
 assert.equal((await run(h,'/api/submissions','POST',valid,{'content-type':'text/plain'})).statusCode,400);
 assert.equal((await run(h,'/api/submissions','POST',null)).statusCode,400);
 assert.equal(calls.length,0);
});
test('rate-limit failure is fail-closed and emits retry-after',async()=>{
 const {h}=setup(async()=>({allowed:false}));
 const r=await run(h,'/api/submissions','POST',valid);
 assert.equal(r.statusCode,429);assert.deepEqual(r.body,{error:'rate_limited'});assert.equal(r.headers['retry-after'],'3600');
});
test('unauthenticated admin operations are blocked',async()=>{
 const {h,calls}=setup();
 for(const url of ['/api/admin/session','/api/admin/queue','/api/admin/audit'])assert.equal((await run(h,url)).statusCode,401);
 assert.equal((await run(h,'/api/admin/decision','POST',{}, {origin:'https://bussola.example'})).statusCode,401);
 assert.equal(calls.length,0);
});
test('login requires origin and correct high-entropy key; cookie is secured and session csrf stable',async()=>{
 const {h}=setup();
 assert.equal((await run(h,'/api/admin/login','POST',{token})).statusCode,403);
 assert.equal((await run(h,'/api/admin/login?token=x','POST',{token},{origin:'https://bussola.example'})).statusCode,400);
 assert.equal((await run(h,'/api/admin/login','POST',{token:'incorrect'.repeat(8)},{origin:'https://bussola.example'})).statusCode,401);
 const {cookie,csrf,response}=await login(h);
 assert.match(response.headers['set-cookie'],/HttpOnly; Secure; SameSite=Strict/);
 assert.match(cookie,/^__Host-bussola_admin=/);
 const session=await run(h,'/api/admin/session','GET',undefined,{cookie});
 assert.deepEqual(session.body,{ok:true,csrf,role:'admin'});
 assert.equal((await run(h,'/api/admin/session','GET',undefined,{cookie:cookie+'x'})).statusCode,401);
});
test('admin decisions enforce signed session, mandatory origin and synchronizer CSRF token',async()=>{
 const {h,calls}=setup();const {cookie,csrf}=await login(h);
 const d={kind:'establishment',id,expected_revision:1,action:'publish',reason:'Reviewed source',place:published};
 for(const headers of [{cookie},{cookie,origin:'https://bussola.example'},{cookie,origin:'https://bussola.example','x-csrf-token':'wrong'},{cookie,'x-csrf-token':csrf}])assert.equal((await run(h,'/api/admin/decision','POST',d,headers)).statusCode,403);
 assert.equal((await run(h,'/api/admin/decision','POST',d,{cookie,origin:'https://bussola.example','x-csrf-token':csrf})).statusCode,200);
 assert.equal(calls.filter(x=>x.op==='decision').length,1);
 const out=await run(h,'/api/admin/logout','POST',{}, {cookie,origin:'https://bussola.example','x-csrf-token':csrf});
 assert.match(out.headers['set-cookie'],/Max-Age=0/);
});
test('session expiry and secret/token rotation invalidate previous signed sessions',async()=>{
 const t=Date.now();const gateway=async()=>({allowed:true});
 const h=createHandler({env,gateway,now:()=>t});const {cookie}=await login(h);
 for(const options of [{env,now:()=>t+8*3600000},{env:{...env,SESSION_SECRET:'rotated-secret'.repeat(5)}},{env:{...env,ADMIN_TOKEN_HASH:'0'.repeat(64)}}]){
  const expired=createHandler({gateway,...options});assert.equal((await run(expired,'/api/admin/session','GET',undefined,{cookie})).statusCode,401);
 }
});
test('gateway uses only scoped bearer token and HTTPS, accepts configured API key',async()=>{
 let captured;const gateway=createGateway({SUPABASE_URL:'https://db.example',BUSSOLA_DB_JWT:'scoped-token',SUPABASE_API_KEY:'optional-key'},async(url,init)=>{captured={url,init};return {ok:true,json:async()=>({ok:true,database:true})};});
 assert.deepEqual(await gateway('health'),{ok:true,database:true});
 assert.equal(captured.url,'https://db.example/rest/v1/rpc/bussola_gateway');
 assert.equal(captured.init.headers.Authorization,'Bearer scoped-token');assert.equal(captured.init.headers.apikey,'optional-key');assert.equal(captured.init.redirect,'error');
 await assert.rejects(createGateway({SUPABASE_URL:'http://db.example',BUSSOLA_DB_JWT:'x'})('health'),e=>e.status===503);
});
test('database domain failures map to HTTP codes; upstream secrets are never returned',async()=>{
 for(const [error,status] of [['revision_conflict',409],['idempotency_conflict',409],['not_found',404],['invalid_request',400]]){
  const g=createGateway({SUPABASE_URL:'https://db.example',BUSSOLA_DB_JWT:'x'},async()=>({ok:true,json:async()=>({error})}));
  await assert.rejects(g('detail',{}),e=>e.status===status && e.code===error);
 }
 const {h}=setup(async()=>{throw new Error('private token and DB details');});const r=await run(h,'/api/health');assert.equal(r.statusCode,503);assert.deepEqual(r.body,{error:'unavailable'});
 assert.equal(r.headers['cache-control'],'no-store');assert.equal(r.headers['x-content-type-options'],'nosniff');
});
