// Public, testable helpers. No seed data and no persistent political information.
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SAVED_KEY = 'bussola-favourites-v1';
export const REFRESH_MS = 25000;
export const categories = ['cafe','restaurant','bookshop','bar','shop','other'];
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function httpsURL(value) { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !/\s/.test(value) ? u.href : null; } catch { return null; } }
export function publicPlace(p, now = Date.now()) {
  if (!p || !UUID.test(p.id) || typeof p.name !== 'string' || !categories.includes(p.category) || !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat)>90 || Math.abs(p.lng)>180) throw new Error('invalid_response');
  const current = p.review_state === 'current' && Date.parse(p.review_due_at) > now && Number.isFinite(Date.parse(p.verified_at));
  const eligible=current && httpsURL(p.source_url) && p.source_type==='direct' && typeof p.source_scope==='string' && p.source_scope.trim();
  return {...p, position: eligible && ['left','right'].includes(p.position) ? p.position : 'unknown', review_state: p.review_state === 'current' && !current ? 'expired' : p.review_state, source_url: current ? httpsURL(p.source_url) : null, source_type: current ? p.source_type : null, source_scope: current ? p.source_scope : null, source_published_at: current ? p.source_published_at : null, customer_statement: eligible ? p.customer_statement : null};
}
export function queryParams(state, offset = 0) {
  const q = new URLSearchParams({q: state.query.trim(), city: state.city, category: state.category, position: state.position, offset: String(offset)});
  if (state.area) q.set('bbox', state.area.join(','));
  if (state.view === 'saved') q.set('ids', state.saved.map(p => p.id).join(','));
  return q;
}
export function minimalFavourite(p) { if (!UUID.test(p?.id) || typeof p.name !== 'string') throw new Error('storage'); return {id:p.id, name:p.name.slice(0,160), neighbourhood:String(p.neighbourhood || '').slice(0,160)}; }
export function readFavourites(storage) {
  const raw = storage.getItem(SAVED_KEY);
  if (raw === null) return [];
  const items = JSON.parse(raw);
  if (!Array.isArray(items) || items.length > 200) throw new Error('storage');
  const result = items.map(minimalFavourite);
  if (new Set(result.map(p=>p.id)).size !== result.length) throw new Error('storage');
  return result;
}
export function writeFavourites(storage, items) {
  if (items.length > 200) throw new Error('favourite_limit');
  const clean = items.map(minimalFavourite), encoded = JSON.stringify(clean);
  storage.setItem(SAVED_KEY, encoded);
  if (storage.getItem(SAVED_KEY) !== encoded) throw new Error('storage');
  return clean;
}
export function clearFavourites(storage) {
  storage.removeItem(SAVED_KEY);
  if (storage.getItem(SAVED_KEY) !== null) throw new Error('storage');
  return [];
}
export async function api(path, {body, signal, fetcher = fetch} = {}) {
  const timeout = AbortSignal.timeout(12000);
  const response = await fetcher('/api' + path, {method:body ? 'POST' : 'GET', credentials:'same-origin', cache:'no-store', redirect:'error', headers:{Accept:'application/json', ...(body ? {'Content-Type':'application/json'} : {})}, ...(body ? {body:JSON.stringify(body)} : {}), signal:signal ? AbortSignal.any([signal, timeout]) : timeout});
  let result;
  try { result = await response.json(); } catch { throw new Error('invalid_response'); }
  if (!response.ok) { const e = new Error(typeof result?.error === 'string' ? result.error : 'request_failed'); e.status = response.status; throw e; }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('invalid_response');
  return result;
}
export function validateResults(list, map, offset=0) {
  if (!Array.isArray(list.items) || list.items.length>50 || !Number.isInteger(list.total) || list.total<0 || !Number.isFinite(Date.parse(list.queried_at)) || !(list.next_offset === null || Number.isInteger(list.next_offset) && list.next_offset>offset) || !Array.isArray(map.items) || map.items.length>200 || !Number.isInteger(map.total) || map.total<0 || typeof map.clustered !== 'boolean') throw new Error('invalid_response');
  if(list.total!==map.total) throw new Error('invalid_response');
  const expectedLength=Math.min(50,Math.max(0,list.total-offset));
  if(list.items.length!==expectedLength || list.next_offset!==(offset+expectedLength<list.total?offset+expectedLength:null)) throw new Error('invalid_response');
  const items = list.items.map(p=>publicPlace(p));
  const points = map.items.map(p=> { if (!p.cluster) return publicPlace(p); if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat)>90 || Math.abs(p.lng)>180 || !Number.isInteger(p.count) || p.count<1) throw new Error('invalid_response'); return {cluster:true,lat:p.lat,lng:p.lng,count:p.count}; });
  if (new Set(items.map(p=>p.id)).size !== items.length || (map.clustered === false && map.total !== points.length) || (map.clustered && points.reduce((n,p)=>n+(p.cluster?p.count:1),0)!==map.total) || items.length>list.total || (list.next_offset !== null && (!items.length || list.next_offset>=list.total))) throw new Error('invalid_response');
  return {items, points};
}
export function distanceKm(coords,p) { const rad=x=>x*Math.PI/180; const [lat,lng]=coords; const a=Math.sin(rad(p.lat-lat)/2)**2+Math.cos(rad(lat))*Math.cos(rad(p.lat))*Math.sin(rad(p.lng-lng)/2)**2; return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a))); }
// A retry of an unchanged draft reuses its key. Never persists drafts or sources.
export function submissionAttempt(previous, payload, makeId = () => crypto.randomUUID()) {
  const fingerprint=JSON.stringify(payload);
  return previous?.fingerprint === fingerprint ? previous : {fingerprint, key:makeId()};
}
