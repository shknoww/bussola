import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { ApiError, invalid, object, uuid, submission, correction, decision, filters } from './validation.mjs';

const COOKIE = '__Host-bussola_admin';
const MAX_BODY = 24576;
const errors = {invalid_request:400, unauthorized:401, forbidden:403, not_found:404, revision_conflict:409, idempotency_conflict:409, rate_limited:429};
const safeEqual = (a,b) => { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x,y); };
function required(env, key, min = 1) { const v = env[key]; if (typeof v !== 'string' || v.length < min) throw new ApiError(503,'unavailable'); return v; }
export function createGateway(env = process.env, fetcher = fetch) {
  return async (op,payload = {}) => {
    const base = required(env,'SUPABASE_URL');
    let url;
    try { url = new URL(base); if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error(); } catch { throw new ApiError(503,'unavailable'); }
    const jwt = required(env,'BUSSOLA_DB_JWT');
    const headers = {'Content-Type':'application/json', Authorization:`Bearer ${jwt}`};
    if (env.SUPABASE_API_KEY) headers.apikey = env.SUPABASE_API_KEY;
    let result;
    try {
      const response = await fetcher(`${base.replace(/\/$/,'')}/rest/v1/rpc/bussola_gateway`, {method:'POST', headers, body:JSON.stringify({op,payload}), signal:AbortSignal.timeout(12000), redirect:'error'});
      if (!response.ok) throw new Error();
      result = await response.json();
    } catch { throw new ApiError(503,'unavailable'); }
    if (!result || typeof result !== 'object') throw new ApiError(503,'unavailable');
    if (result.error) throw new ApiError(errors[result.error] || 503, errors[result.error] ? result.error : 'unavailable');
    return result;
  };
}
function originGuard(req, env, mandatory = false) {
  const host = req.headers.host;
  if (typeof host !== 'string' || !/^[a-z0-9.\-\[\]:]+$/i.test(host)) throw new ApiError(403,'forbidden');
  const local = env.NODE_ENV !== 'production' && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);
  const expected = `${local && !req.socket?.encrypted ? 'http' : 'https'}://${host}`;
  const origin = req.headers.origin;
  if ((mandatory && !origin) || (origin && origin !== expected) || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin' && req.headers['sec-fetch-site'] !== 'none')) throw new ApiError(403,'forbidden');
  // Browser fetches always supply Origin or Fetch Metadata. Missing both is supported for non-browser clients.
  if (!origin && req.headers['sec-fetch-site']) throw new ApiError(403,'forbidden');
}
async function body(req) {
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) invalid();
  const length = Number(req.headers['content-length']);
  if (Number.isFinite(length) && length > MAX_BODY) invalid();
  if (req.body !== undefined) {
    try {
      const raw = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body);
      if (Buffer.byteLength(raw) > MAX_BODY) invalid();
      return JSON.parse(raw);
    } catch { invalid(); }
  }
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > MAX_BODY) invalid(); chunks.push(Buffer.from(chunk)); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { invalid(); }
}
function sign(value, secret) { return createHmac('sha256',secret).update(value).digest('base64url'); }
function session(req,env,now) {
  const secret = required(env,'SESSION_SECRET',32);
  const pairs = (req.headers.cookie || '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${COOKIE}=`));
  if (pairs.length !== 1) throw new ApiError(401,'unauthorized');
  const raw = pairs[0].slice(COOKIE.length + 1);
  if (raw.length > 1024) throw new ApiError(401,'unauthorized');
  const [encoded,signature,...extra] = raw.split('.');
  if (!signature || extra.length || !safeEqual(signature,sign(encoded,secret))) throw new ApiError(401,'unauthorized');
  let s;
  try { s = JSON.parse(Buffer.from(encoded,'base64url')); } catch { throw new ApiError(401,'unauthorized'); }
  // Rotating either the owner token hash or session secret invalidates every session.
  if (s.role !== 'admin' || !Number.isSafeInteger(s.exp) || s.exp <= now || s.exp > now + 8*3600000 || typeof s.csrf !== 'string' || !/^[a-zA-Z0-9_-]{43}$/.test(s.csrf) || s.version !== createHash('sha256').update(required(env,'ADMIN_TOKEN_HASH')).digest('hex')) throw new ApiError(401,'unauthorized');
  return s;
}
function cookie(value, age) { return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`; }
function route(req) {
  const u = new URL(req.url, 'http://api.invalid');
  let path = u.pathname;
  if (path === '/api/index' || path === '/api/index.js') {
    if (u.searchParams.getAll('path').length !== 1) invalid();
    const internal = u.searchParams.get('path');
    if (!/^[a-zA-Z0-9\-/]+$/.test(internal)) invalid();
    path = `/api/${internal.replace(/^\/+/, '')}`;
    u.searchParams.delete('path');
  } else if (u.searchParams.getAll('path').length === 1 && u.searchParams.get('path') === path.replace(/^\/api\//,'')) {
    // Vercel may preserve the original pathname while merging the rewrite query.
    // Consume only its exact redundant value; it never selects a different route.
    u.searchParams.delete('path');
  }
  return {path,params:u.searchParams};
}
function clientHash(req,env,now) {
  // Only Vercel's overwritten header is trusted on Vercel. Never trust generic X-Forwarded-For.
  const candidate = env.VERCEL === '1' ? req.headers['x-vercel-forwarded-for'] : req.socket?.remoteAddress;
  const ip = typeof candidate === 'string' && isIP(candidate.trim()) ? candidate.trim() : 'unresolved';
  return createHmac('sha256',required(env,'RATE_LIMIT_SALT',32)).update(`${new Date(now).toISOString().slice(0,10)}:${ip}`).digest('hex');
}
/** Dependency injection is an in-process unit-test seam only; no HTTP/env bypass exists. */
export function createHandler({env = process.env, gateway = createGateway(env), now = Date.now} = {}) {
  return async (req,res) => {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    const send = (status,value) => { res.statusCode = status; res.end(JSON.stringify(value)); };
    try {
      const {path,params} = route(req);
      const method = req.method;
      if (!['GET','POST'].includes(method)) throw new ApiError(404,'not_found');
      if (method === 'POST') originGuard(req,env);
      const rate = async purpose => {
        const result = await gateway('rate_limit',{purpose,key:clientHash(req,env,now())});
        if (result.allowed !== true) { const error = new ApiError(429,'rate_limited'); error.retryAfter = purpose === 'login' ? '900' : '3600'; throw error; }
      };
      if (method === 'GET' && path === '/api/health') return send(200,await gateway('health'));
      if (method === 'GET' && ['/api/establishments','/api/map'].includes(path)) return send(200,await gateway(path.endsWith('/map') ? 'map' : 'list',filters(params)));
      if (method === 'GET' && path === '/api/cities') { if (params.size) invalid(); return send(200,await gateway('cities')); }
      const detail = /^\/api\/establishments\/([^/]+)$/.exec(path);
      if (method === 'GET' && detail) { if (params.size) invalid(); return send(200,await gateway('detail',{id:uuid(detail[1])})); }
      if (method === 'POST' && path === '/api/submissions') {
        if (params.size) invalid();
        const p = submission(await body(req)); await rate('submission');
        return send(201,await gateway('submit',p));
      }
      const correctionRoute = /^\/api\/establishments\/([^/]+)\/corrections$/.exec(path);
      if (method === 'POST' && correctionRoute) {
        if (params.size) invalid();
        const p = {...correction(await body(req)), establishment_id:uuid(correctionRoute[1])}; await rate('correction');
        return send(201,await gateway('correct',p));
      }
      if (path.startsWith('/api/admin/')) {
        if (params.size) invalid();
        if (method === 'POST' && path === '/api/admin/login') {
          originGuard(req,env,true);
          const p = object(await body(req),['token']);
          await rate('login');
          const hash = required(env,'ADMIN_TOKEN_HASH');
          if (!/^[a-f0-9]{64}$/i.test(hash)) throw new ApiError(503,'unavailable');
          if (typeof p.token !== 'string' || p.token.length < 32 || p.token.length > 512 || !safeEqual(createHash('sha256').update(p.token).digest('hex'),hash.toLowerCase())) throw new ApiError(401,'unauthorized');
          const s = {role:'admin', exp:now()+8*3600000, csrf:randomBytes(32).toString('base64url'), version:createHash('sha256').update(hash).digest('hex')};
          const encoded = Buffer.from(JSON.stringify(s)).toString('base64url');
          res.setHeader('Set-Cookie',cookie(`${encoded}.${sign(encoded,required(env,'SESSION_SECRET',32))}`,8*3600));
          return send(200,{ok:true,csrf:s.csrf});
        }
        const s = session(req,env,now());
        if (method === 'POST') {
          originGuard(req,env,true);
          if (typeof req.headers['x-csrf-token'] !== 'string' || !safeEqual(req.headers['x-csrf-token'],s.csrf)) throw new ApiError(403,'forbidden');
        }
        if (method === 'GET' && path === '/api/admin/session') return send(200,{ok:true,csrf:s.csrf,role:'admin'});
        if (method === 'POST' && path === '/api/admin/logout') { res.setHeader('Set-Cookie',cookie('',0)); return send(200,{ok:true}); }
        if (method === 'GET' && path === '/api/admin/queue') return send(200,await gateway('queue'));
        if (method === 'GET' && path === '/api/admin/audit') return send(200,await gateway('audit'));
        if (method === 'POST' && path === '/api/admin/decision') return send(200,await gateway('decision',decision(await body(req),now())));
      }
      throw new ApiError(404,'not_found');
    } catch (error) {
      if (error instanceof ApiError) { if (error.status === 429) res.setHeader('Retry-After',error.retryAfter || '3600'); return send(error.status,{error:error.code}); }
      // Never serialize upstream errors, request values, database text or credentials.
      return send(503,{error:'unavailable'});
    }
  };
}
export default createHandler();
