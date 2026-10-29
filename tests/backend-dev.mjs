import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';

test('local dev server serves only public files and the actual API',{timeout:10000},async()=>{
 const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const child=spawn(process.execPath,[fileURLToPath(new URL('../server/dev.mjs',import.meta.url))],{env:{PATH:process.env.PATH,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
 const exit=once(child,'exit');
 let diagnostic='';child.stderr.on('data',b=>{diagnostic+=b;});
 try{
  let ready=false;
  for(let i=0;i<40;i++){
   try{const r=await fetch(`http://127.0.0.1:${port}/`);if(r.status===200){assert.match(r.headers.get('content-type'),/text\/html/);ready=true;break;}}catch{}
   if(child.exitCode!==null)throw new Error(`Dev server exited: ${diagnostic}`);
   await delay(50);
  }
  assert.equal(ready,true,'server startup');
  const base=`http://127.0.0.1:${port}`;
  for(const path of ['/server/app.mjs','/supabase/001_bussola.sql','/.env','/%2eenv','/api/not-found'])assert.equal((await fetch(base+path)).status,404,path);
  const health=await fetch(base+'/api/health');assert.equal(health.status,503);assert.deepEqual(await health.json(),{error:'unavailable'});
  const admin=await fetch(base+'/api/admin/session');assert.equal(admin.status,503,'missing required secrets fail closed');
  assert.equal((await fetch(base+'/api/health')).headers.get('cache-control'),'no-store');
 }finally{child.kill('SIGTERM');await exit;}
});
