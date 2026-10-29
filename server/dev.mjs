import https from 'node:https';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from './app.mjs';

const root = fileURLToPath(new URL('../public/',import.meta.url));
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.json':'application/json','.ttf':'font/ttf','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const tls = process.env.TLS_CERT_FILE && process.env.TLS_KEY_FILE ? {cert:readFileSync(process.env.TLS_CERT_FILE),key:readFileSync(process.env.TLS_KEY_FILE)} : null;
const server = tls ? https.createServer(tls) : http.createServer();
server.on('request',async (req,res) => {
  const url = new URL(req.url,'http://localhost');
  if (url.pathname.startsWith('/api/')) return handler(req,res);
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Cache-Control','no-cache');
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405); return res.end();}
  try {
    const decoded = decodeURIComponent(url.pathname);
    if (decoded.split('/').some(x=>x.startsWith('.') || x.includes('\\'))) throw new Error();
    const admin = /^\/admin(?:\.html|\/)?$/.test(decoded);
    if (admin) res.setHeader('Cache-Control','no-store');
    let file = path.join(root,admin ? 'admin.html' : decoded === '/' ? 'index.html' : decoded);
    try { if (!(await stat(file)).isFile()) throw new Error(); }
    catch { if (/^\/(admin|place(?:\/[0-9a-f-]+)?)\/?$/i.test(decoded)) file=path.join(root,'index.html'); else throw new Error(); }
    const canonical = await realpath(file);
    if (!canonical.startsWith(`${await realpath(root)}${path.sep}`)) throw new Error();
    const data = await readFile(canonical);
    res.setHeader('Content-Type',mime[path.extname(canonical)] || 'application/octet-stream');
    res.writeHead(200);res.end(req.method==='HEAD' ? undefined : data);
  } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');}
});
const port=Number(process.env.PORT || 3000);
if (!Number.isSafeInteger(port) || port<1 || port>65535) throw new Error('Invalid PORT');
server.listen(port,process.env.HOST || '127.0.0.1',()=>console.log(`Bússola listening on ${tls ? 'https' : 'http'}://${process.env.HOST || '127.0.0.1'}:${port}`));
server.requestTimeout=15000;
server.headersTimeout=10000;
