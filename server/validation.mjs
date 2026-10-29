export class ApiError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
export const invalid = () => { throw new ApiError(400, 'invalid_request'); };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const categories = ['cafe', 'restaurant', 'bookshop', 'bar', 'shop', 'other'];
export function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) invalid();
  return value;
}
export function text(value, max, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) invalid();
  value = value.trim();
  if (required && !value) invalid();
  return value;
}
export function choice(value, options) { if (!options.includes(value)) invalid(); return value; }
export function uuid(value) { if (typeof value !== 'string' || !UUID.test(value)) invalid(); return value.toLowerCase(); }
export function httpsURL(value, required = false) {
  value = text(value, 2048, required);
  if (!value) return null;
  try { const u = new URL(value); if (u.protocol !== 'https:' || !u.hostname || u.username || u.password || /\s/.test(value)) invalid(); } catch { invalid(); }
  return value;
}
function iso(value, required = false) {
  if (value == null || value === '') { if (required) invalid(); return null; }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) invalid();
  return new Date(value).toISOString();
}
const baseKeys = ['name', 'category', 'city', 'state', 'address', 'neighbourhood', 'unit', 'position', 'source_url'];
function base(value) {
  return {name: text(value.name, 160, true), category: choice(value.category, categories), city: text(value.city, 120, true), state: text(value.state, 80, true), address: text(value.address, 300, true), neighbourhood: text(value.neighbourhood, 120), unit: text(value.unit, 120), position: choice(value.position, ['left', 'right', 'unknown']), source_url: httpsURL(value.source_url, value.position !== 'unknown')};
}
export function submission(value) {
  object(value, [...baseKeys, 'idempotency_key', 'notes', 'website']);
  if (value.website !== '' && value.website != null) invalid();
  return {...base(value), idempotency_key: uuid(value.idempotency_key), notes: text(value.notes, 4000), website: ''};
}
export function correction(value) {
  object(value, ['idempotency_key', 'reason', 'notes', 'website']);
  if (value.website !== '' && value.website != null) invalid();
  return {idempotency_key: uuid(value.idempotency_key), reason: choice(value.reason, ['address', 'unit', 'source', 'outdated', 'association', 'other']), notes: text(value.notes, 4000, true), website: ''};
}
export function place(value, now = Date.now()) {
  object(value, [...baseKeys, 'lat', 'lng', 'source_type', 'source_scope', 'source_published_at', 'source_verified', 'review_due_at', 'customer_statement']);
  const p = {...base(value), lat: value.lat, lng: value.lng, source_type: value.source_type == null || value.source_type === '' ? null : choice(value.source_type, ['direct', 'third_party']), source_scope: text(value.source_scope, 500), source_published_at: iso(value.source_published_at), source_verified: value.source_verified ?? false, review_due_at: iso(value.review_due_at), customer_statement: text(value.customer_statement, 1000) || null};
  if (typeof p.lat !== 'number' || !Number.isFinite(p.lat) || p.lat < -90 || p.lat > 90 || typeof p.lng !== 'number' || !Number.isFinite(p.lng) || p.lng < -180 || p.lng > 180 || typeof p.source_verified !== 'boolean') invalid();
  if (p.source_published_at && Date.parse(p.source_published_at) > now) invalid();
  if (p.position !== 'unknown' || p.customer_statement) {
    if (!p.source_url || p.source_type !== 'direct' || !p.source_verified || !p.source_scope || !p.review_due_at || Date.parse(p.review_due_at) <= now) invalid();
  }
  return p;
}
export function decision(value, now) {
  object(value, ['kind', 'id', 'expected_revision', 'action', 'reason', 'place']);
  const d = {kind: choice(value.kind, ['submission', 'correction', 'establishment']), id: uuid(value.id), expected_revision: value.expected_revision, action: choice(value.action, ['publish', 'reject', 'needs_info', 'suspend', 'archive', 'maintain']), reason: text(value.reason, 2000, true)};
  if (!Number.isSafeInteger(d.expected_revision) || d.expected_revision < 1 || d.expected_revision > 2147483646) invalid();
  const permitted = {submission: ['publish','reject','needs_info'], correction: ['publish','reject','needs_info','suspend','archive','maintain'], establishment: ['publish','suspend','archive','maintain']};
  if (!permitted[d.kind].includes(d.action)) invalid();
  if (d.action === 'publish') d.place = place(value.place, now);
  else if (value.place !== undefined) invalid();
  return d;
}
export function filters(params) {
  const allowed = ['q','city','category','position','bbox','offset','ids'];
  for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length !== 1) invalid();
  const p = {q: text(params.get('q'), 160), city: text(params.get('city'), 120), category: params.get('category') || '', position: params.get('position') || 'all', offset: 0};
  if (p.category) choice(p.category, categories);
  choice(p.position, ['all','left','right','unknown']);
  if (params.has('offset')) { if (!/^\d{1,9}$/.test(params.get('offset'))) invalid(); p.offset = Number(params.get('offset')); }
  if (params.has('bbox')) {
    const raw = params.get('bbox').split(',');
    if (raw.length !== 4 || raw.some(v => !/^-?\d+(?:\.\d+)?$/.test(v))) invalid();
    p.bbox = raw.map(Number);
    const [w,s,e,n] = p.bbox;
    if (![w,s,e,n].every(Number.isFinite) || w < -180 || e > 180 || w > e || s < -90 || n > 90 || s > n) invalid();
  }
  if (params.has('ids')) { const ids = params.get('ids').split(','); if (ids.length > 200) invalid(); p.ids = [...new Set(ids.map(uuid))]; }
  return p;
}
