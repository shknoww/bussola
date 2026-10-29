import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {createServer} from 'node:http';
import {createHash,randomUUID} from 'node:crypto';
import {createHandler} from '../server/app.mjs';
import {ApiError} from '../server/validation.mjs';

// Optional local PostgreSQL-WASM test runner. No production import or dependency.
// Point to an independently installed @electric-sql/pglite module, not any remote DB.
const modulePath=process.env.BUSSOLA_TEST_PGLITE_MODULE;
test('isolated PostgreSQL executes migration, SQL invariants and real local HTTP workflow',{skip:!modulePath},async()=>{
 const {PGlite}=await import(modulePath);
 const db=new PGlite();
 let server;
 try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE authenticator;');
  await db.exec(await readFile(new URL('../supabase/001_bussola.sql',import.meta.url),'utf8'));
  let suite=await readFile(new URL('./backend.sql',import.meta.url),'utf8');
  // PGlite has one built-in database. This replacement is restricted to this fresh
  // in-memory instance; the psql script retains its mandatory production guard.
  suite=suite.split('\n').filter(line=>!line.startsWith('\\')).join('\n').replace('IF current_database() !~',"IF 'bussola_test_wasm' !~");
  const segments=suite.split('SELECT pg_sleep(1.2);');
  assert.equal(segments.length,2);
  await db.exec(segments[0]);await delay(1250);await db.exec(segments[1]);
  const remaining=await db.query('SELECT count(*)::integer AS n FROM bussola.establishments');
  assert.equal(remaining.rows[0].n,0,'SQL fixtures rolled back');
  const token='test-only-ephemeral-owner-token-'+randomUUID();
  const env={NODE_ENV:'test',ADMIN_TOKEN_HASH:createHash('sha256').update(token).digest('hex'),SESSION_SECRET:randomUUID(),RATE_LIMIT_SALT:randomUUID()};
  const gateway=async(op,payload={})=>{
   const query=await db.query('SELECT public.bussola_gateway($1,$2::jsonb) AS result',[op,JSON.stringify(payload)]);
   const value=query.rows[0].result;
   if(value.error)throw new ApiError(({invalid_request:400,not_found:404,revision_conflict:409,idempotency_conflict:409})[value.error] || 503,value.error);
   return value;
  };
  server=createServer(createHandler({env,gateway}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const request=async(path,body,headers={})=>{
   const r=await fetch(`${origin}${path}`,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'content-type':'application/json',origin}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
   return {status:r.status,headers:r.headers,body:await r.json()};
  };
  assert.equal((await request('/api/health')).body.database,true);
  const suggestion={idempotency_key:randomUUID(),name:'QA HTTP Café',category:'cafe',city:'QA City',state:'QA',address:'QA address',neighbourhood:'',unit:'',position:'unknown',source_url:null,notes:'Private QA note',website:''};
  const submitted=await request('/api/submissions',suggestion);assert.equal(submitted.status,201);
  assert.deepEqual((await request('/api/submissions',suggestion)).body,submitted.body);
  assert.equal((await request('/api/establishments')).body.total,0);
  assert.equal((await request('/api/admin/queue')).status,401);
  const auth=await request('/api/admin/login',{token});assert.equal(auth.status,200);
  const cookie=auth.headers.get('set-cookie').split(';')[0];
  const queue=await request('/api/admin/queue',undefined,{cookie});
  assert.equal(queue.body.submissions[0].id,submitted.body.id);
  const place={...suggestion,lat:-23.5,lng:-46.6,source_type:null,source_scope:'',source_verified:false,source_published_at:null,review_due_at:null,customer_statement:null};
  for(const k of ['idempotency_key','notes','website'])delete place[k];
  const decision={kind:'submission',id:submitted.body.id,expected_revision:1,action:'publish',reason:'QA HTTP verified',place};
  const admin={cookie,'x-csrf-token':auth.body.csrf};
  const publish=await request('/api/admin/decision',decision,admin);assert.equal(publish.status,200);
  assert.equal((await request('/api/admin/decision',decision,admin)).status,409);
  const detail=await request(`/api/establishments/${publish.body.id}`);assert.equal(detail.body.name,'QA HTTP Café');assert.equal('notes' in detail.body,false);
  assert.equal((await request('/api/map?q=cafe')).body.total,1);
  assert.equal((await request('/api/index?path=establishments&city=QA%20City')).body.total,1);
  const correction=await request(`/api/establishments/${publish.body.id}/corrections`,{idempotency_key:randomUUID(),reason:'address',notes:'QA correction',website:''});assert.equal(correction.status,201);
  const archive=await request('/api/admin/decision',{kind:'establishment',id:publish.body.id,expected_revision:1,action:'archive',reason:'QA archive'},admin);assert.equal(archive.status,200);
  assert.equal((await request(`/api/establishments/${publish.body.id}`)).status,404);
  assert.equal((await request('/api/establishments')).body.total,0);
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  await db.close();
 }
});
