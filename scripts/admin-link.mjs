import { execFileSync } from 'node:child_process';
const origin = process.env.BUSSOLA_ORIGIN || 'https://bussola-mira.vercel.app';
if(new URL(origin).protocol !== 'https:') throw new Error('HTTPS required');
const token = execFileSync('/usr/bin/security',['find-generic-password','-s','mira/bussola/admin-token','-w'],{encoding:'utf8'}).trim();
const url = `${origin}/admin#token=${encodeURIComponent(token)}`;
if(process.argv.includes('--print')) {
  console.log(url);
} else {
  // Token exists only in Keychain, process memory and the URL fragment consumed by admin.js.
  execFileSync('/usr/bin/open',[url]);
  console.log('Painel aberto. A chave fica no Keychain; não partilhe o link.');
}
