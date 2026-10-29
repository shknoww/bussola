import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const roots = ['api','server','scripts','public','tests'];
let count = 0;
async function check(dir) {
  let entries;
  try { entries = await readdir(dir,{withFileTypes:true}); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
  for(const e of entries) {
    if(e.name === 'vendor') continue;
    const path = join(dir,e.name);
    if(e.isDirectory()) await check(path);
    else if(/\.(js|mjs)$/.test(path)) { execFileSync(process.execPath,['--check',path],{stdio:'pipe'}); count++; }
    else if(/\.(json|webmanifest)$/.test(path)) JSON.parse(await readFile(path,'utf8'));
  }
}
for(const root of roots) await check(root);
for(const file of ['package.json','vercel.json']) JSON.parse(await readFile(file,'utf8'));
console.log(`Syntax checked: ${count} JavaScript files; JSON valid.`);
