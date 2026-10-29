import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const runFile=promisify(execFile); // Argument-array execution; no shell interpolation.
const enabled=process.env.BUSSOLA_RUN_DB_CONCURRENCY==='1';
const quote=s=>`'${String(s).replaceAll("'","''")}'`;
const guard="DO $$ BEGIN IF current_database() !~ '^bussola_(qa|test)(_|$)' THEN RAISE EXCEPTION 'QA database required'; END IF; END $$;";
async function sql(query){
 const {stdout}=await runFile(process.env.PSQL_BINARY || 'psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',`${guard}\n${query}`],{env:process.env,timeout:30000,maxBuffer:1024*1024});
 return stdout.trim();
}
async function rpc(op,payload){return JSON.parse(await sql(`SELECT public.bussola_gateway(${quote(op)},${quote(JSON.stringify(payload))}::jsonb);`));}

test('real PostgreSQL concurrent idempotency and moderation are atomic',{skip:!enabled},async()=>{
 // Opt-in only. Standard libpq PG* environment; never print credentials or mutate production.
 assert.match(process.env.PGDATABASE || '',/^bussola_(qa|test)(_|$)/,'PGDATABASE must explicitly name isolated QA/test DB');
 const key=randomUUID(),secondKey=randomUUID();
 const p={idempotency_key:key,name:`QA concurrent ${key}`,category:'cafe',city:'QA City',state:'QA',address:'QA address',neighbourhood:'',unit:'',position:'unknown',source_url:null,notes:'isolated concurrency fixture',website:''};
 try{
  const results=await Promise.all([rpc('submit',p),rpc('submit',p)]);
  assert.equal(results[0].status,'pending');assert.deepEqual(results[0],results[1]);
  const conflict=await Promise.all([rpc('submit',{...p,idempotency_key:secondKey,name:'QA A'}),rpc('submit',{...p,idempotency_key:secondKey,name:'QA B'})]);
  assert.equal(conflict.filter(x=>x.status==='pending').length,1);assert.equal(conflict.filter(x=>x.error==='idempotency_conflict').length,1);
  const place={...p,lat:0,lng:0,source_type:null,source_scope:'',source_verified:false,source_published_at:null,review_due_at:null,customer_statement:null};
  for(const k of ['idempotency_key','notes','website'])delete place[k];
  const d={kind:'submission',id:results[0].id,expected_revision:1,action:'publish',reason:'QA concurrent review',place};
  const decisions=await Promise.all([rpc('decision',d),rpc('decision',d)]);
  assert.equal(decisions.filter(x=>x.ok===true).length,1);assert.equal(decisions.filter(x=>x.error==='revision_conflict').length,1);
  const counts=JSON.parse(await sql(`SELECT json_build_object('contributions',(SELECT count(*) FROM bussola.contributions WHERE idempotency_key=${quote(key)}::uuid),'audits',(SELECT count(*) FROM bussola.moderation_events WHERE entity_id=${quote(d.id)}::uuid),'places',(SELECT count(*) FROM bussola.establishments WHERE data->>'name'=${quote(p.name)}));`));
  assert.deepEqual(counts,{contributions:1,audits:1,places:1});
 }finally{
  // Remove exactly this test's rows, never a whole schema/database or unrelated QA work.
  await sql(`BEGIN; CREATE TEMP TABLE qa_cleanup_ids AS SELECT id,establishment_id FROM bussola.contributions WHERE idempotency_key IN (${quote(key)}::uuid,${quote(secondKey)}::uuid); DELETE FROM bussola.moderation_events WHERE entity_id IN (SELECT id FROM qa_cleanup_ids); DELETE FROM bussola.contributions WHERE id IN (SELECT id FROM qa_cleanup_ids); DELETE FROM bussola.establishments WHERE id IN (SELECT establishment_id FROM qa_cleanup_ids); COMMIT;`);
 }
});
