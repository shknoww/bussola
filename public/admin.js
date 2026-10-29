/* SPDX-License-Identifier: Apache-2.0 */
(() => {
  'use strict';
  // Run in <head>, before any other resource. Never persist the access key.
  let fragmentToken = '';
  let fragmentFailed = false;
  if (location.hash) {
    const fragment = new URLSearchParams(location.hash.slice(1));
    fragmentToken = fragment.get('token') || '';
    try { history.replaceState(null, '', location.pathname + location.search); }
    catch { fragmentToken = ''; fragmentFailed = true; }
  }
  document.addEventListener('DOMContentLoaded', initialise, { once: true });

  function initialise() {
    const $ = (id) => document.getElementById(id);
    const form = $('decision-form');
    const state = { language: 'pt-BR', csrf: '', tab: 'submissions', queue: null, audit: [], selected: null, dirty: false, busy: false, stale: false, message: null };
    const kinds = { submissions: 'submission', corrections: 'correction', establishments: 'establishment' };
    const actions = {
      submission: ['publish', 'reject', 'needs_info'],
      correction: ['maintain', 'publish', 'suspend', 'archive', 'reject', 'needs_info'],
      establishment: ['publish', 'suspend', 'archive', 'maintain']
    };
    const field = (name) => form.elements.namedItem(name);
    const t = (key) => window.BUSSOLA_ADMIN_I18N[state.language][key] || key;
    const node = (tag, text, className) => {
      const el = document.createElement(tag);
      if (text !== undefined) el.textContent = text;
      if (className) el.className = className;
      return el;
    };
    const dateText = (value) => value && Number.isFinite(new Date(value).getTime()) ? new Intl.DateTimeFormat(state.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : t('noDate');
    function localDate(value) {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) return '';
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
    function message(key, error = false) {
      state.message = { key, error };
      $('message').textContent = t(key);
      $('message').classList.toggle('error', error);
      $('message').hidden = false;
      $('message').setAttribute('role', error ? 'alert' : 'status');
    }
    function clearMessage() { state.message = null; $('message').hidden = true; }
    function errorKey(error) { return error.key || (error.status ? (window.BUSSOLA_ADMIN_I18N[state.language][`error${error.status}`] ? `error${error.status}` : 'errorGeneric') : 'errorNetwork'); }
    function authView(authenticated) {
      $('login-panel').hidden = authenticated;
      $('workspace').hidden = !authenticated;
      $('logout').hidden = !authenticated;
      if (!authenticated) {
        state.csrf = ''; state.queue = null; state.audit = []; state.selected = null; state.dirty = false;
        $('queue').replaceChildren(); $('audit-list').replaceChildren(); $('record-context').replaceChildren();
        $('open-source').removeAttribute('href'); $('open-source').hidden = true;
        $('record-id').textContent = ''; $('revision').textContent = ''; $('queue-count').textContent = '';
        $('token').value = ''; fragmentToken = '';
        form.reset(); form.hidden = true; $('choose-hint').hidden = false;
      }
    }
    function fail(error) {
      if (error.status === 401 || error.status === 403) authView(false);
      message(errorKey(error), true);
    }
    async function api(path, body) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      try {
        const headers = { Accept: 'application/json' };
        if (body !== undefined) {
          headers['Content-Type'] = 'application/json';
          if (path !== 'login') headers['X-CSRF-Token'] = state.csrf;
        }
        const response = await fetch(`/api/admin/${path}`, {
          method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
          redirect: 'error', referrerPolicy: 'no-referrer', headers,
          body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal
        });
        let data;
        try { data = await response.json(); } catch { throw { status: response.status === 200 ? undefined : response.status, key: 'invalidResponse' }; }
        if (!response.ok) throw { status: response.status };
        if (!data || typeof data !== 'object') throw { key: 'invalidResponse' };
        return data;
      } finally { clearTimeout(timer); }
    }
    async function busy(work) {
      if (state.busy) return;
      state.busy = true;
      const controls = [...document.querySelectorAll('button,input,select,textarea')].map((el) => [el, el.disabled]);
      controls.forEach(([el]) => { el.disabled = true; });
      $('main').setAttribute('aria-busy', 'true');
      try { await work(); } finally {
        controls.forEach(([el, disabled]) => { el.disabled = disabled; });
        state.busy = false; $('main').removeAttribute('aria-busy'); updateAction();
      }
    }
    function discard() { return !state.dirty || window.confirm(t('discard')); }
    function payload(item) { return { ...item, ...(item.payload || {}), ...(item.place || {}) }; }
    function statusOf(item) { return item.status || item.publication_status || 'pending'; }
    function renderQueue() {
      $('queue-title').textContent = t(state.tab);
      const items = [...(state.queue?.[state.tab] || [])].sort((a, b) => (new Date(a.created_at).getTime() || 0) - (new Date(b.created_at).getTime() || 0) || String(a.id).localeCompare(String(b.id)));
      const filter = $('status-filter'); const previous = filter.value;
      filter.replaceChildren(new Option(t('allStatuses'), ''));
      [...new Set(items.map(statusOf))].sort().forEach((status) => filter.add(new Option(t(status), status)));
      filter.value = [...filter.options].some((option) => option.value === previous) ? previous : '';
      const visible = items.filter((item) => !filter.value || statusOf(item) === filter.value);
      $('queue-count').textContent = String(visible.length);
      $('queue').replaceChildren();
      if (!visible.length) $('queue').append(node('p', t('emptyQueue'), 'empty'));
      for (const item of visible) {
        const data = payload(item);
        const place = state.queue.establishments.find((entry) => entry.id === data.establishment_id);
        const button = node('button', undefined, 'queue-item'); button.type = 'button';
        button.setAttribute('aria-pressed', String(state.selected?.item.id === item.id && state.selected?.kind === kinds[state.tab]));
        button.append(node('strong', data.name || (place && payload(place).name) || t('noName')),
          node('small', `${t(statusOf(item))} · ${t('revision')} ${item.revision}`),
          node('small', dateText(item.created_at)));
        button.addEventListener('click', () => { if (!state.busy && discard()) selectRecord(item, kinds[state.tab]); });
        $('queue').append(button);
      }
    }
    function renderContext() {
      if (!state.selected) return;
      const { item, kind } = state.selected; const data = payload(item);
      $('revision').textContent = `${t('revision')} ${item.revision}`;
      $('record-id').textContent = item.id;
      const context = $('record-context'); context.replaceChildren();
      const line = (key, value) => { if (value) context.append(node('p', `${t(key)}: ${value}`)); };
      line('status', t(statusOf(item))); line('created', dateText(item.created_at));
      if (kind === 'correction') { line('requestReason', t(data.reason || 'other')); line('establishmentId', data.establishment_id); }
      line('notes', data.notes);
      if (kind === 'establishment') {
        let reviewState = data.review_state;
        if (!reviewState) {
          if (data.assertion_status === 'suspended') reviewState = 'suspended';
          else if (data.position === 'unknown' && !data.customer_statement) reviewState = 'none';
          else if (!data.review_due_at || new Date(data.review_due_at) <= new Date()) reviewState = 'expired';
          else reviewState = 'current';
        }
        line('reviewState', t(reviewState));
        line('lastVerified', dateText(data.verified_at));
        line('previousDue', dateText(data.review_due_at));
      }
      if (Array.isArray(item.possible_duplicates) && item.possible_duplicates.length) line('possibleDuplicates', item.possible_duplicates.join(', '));
    }
    function selectRecord(item, kind) {
      state.selected = { item, kind }; state.dirty = false; form.reset();
      let data = payload(item);
      if (kind === 'correction') {
        const linked = state.queue.establishments.find((entry) => entry.id === data.establishment_id);
        data = { ...(linked ? payload(linked) : {}), ...(item.place || {}) };
      }
      for (const name of ['name', 'category', 'city', 'state', 'address', 'neighbourhood', 'unit', 'lat', 'lng', 'position', 'source_url', 'source_type', 'source_scope', 'customer_statement']) {
        if (data[name] !== null && data[name] !== undefined) field(name).value = data[name];
      }
      if (!field('category').value) field('category').value = 'other';
      if (!field('position').value) field('position').value = 'unknown';
      if (!field('source_type').value) field('source_type').value = 'direct';
      field('source_published_at').value = data.source_published_at ? localDate(data.source_published_at) : '';
      const due = new Date(); due.setDate(due.getDate() + 180);
      field('review_due_at').value = localDate(due);
      // A stored verification is not a fresh human confirmation.
      field('source_verified').checked = false;
      $('action').replaceChildren(...actions[kind].map((action) => new Option(t(action), action)));
      form.hidden = false; $('choose-hint').hidden = true;
      renderContext(); updateAction(); updateSource(); renderQueue();
    }
    function updateAction() {
      const publish = $('action').value === 'publish';
      $('place-fields').hidden = !publish; $('place-fields').disabled = !publish;
      const finalRecord = state.selected && state.selected.kind !== 'establishment' && !['pending', 'needs_info'].includes(statusOf(state.selected.item));
      $('action-help').textContent = t(finalRecord ? 'finalRecord' : `help_${$('action').value || 'publish'}`);
      form.querySelector('[type=submit]').disabled = state.busy || state.stale || Boolean(finalRecord);
    }
    function updateSource() {
      let url;
      try { url = new URL(field('source_url').value); } catch { /* Keep invalid links inert. */ }
      const valid = url?.protocol === 'https:' && !url.username && !url.password;
      $('open-source').hidden = !valid;
      if (valid) $('open-source').href = url.href; else $('open-source').removeAttribute('href');
    }
    function renderAudit() {
      $('audit-list').replaceChildren();
      if (!state.audit.length) $('audit-list').append(node('p', t('emptyAudit'), 'empty'));
      for (const event of state.audit) {
        const details = node('details', undefined, 'audit-event');
        details.append(node('summary', `${dateText(event.created_at)} · ${t(event.action || 'details')} · ${event.entity_id || event.target_id || event.id || ''}`), node('pre', JSON.stringify(event, null, 2)));
        $('audit-list').append(details);
      }
    }
    function translate() {
      document.documentElement.lang = state.language; document.title = t('title');
      document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
      document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
      [...$('action').options].forEach((option) => { option.textContent = t(option.value); });
      if (state.queue) renderQueue(); renderContext(); renderAudit(); updateAction();
      if (state.message) message(state.message.key, state.message.error);
    }
    async function refresh() {
      const [queue, audit] = await Promise.all([api('queue'), api('audit')]);
      if (!['submissions', 'corrections', 'establishments'].every((key) => Array.isArray(queue[key])) || !Array.isArray(audit.items)) throw { key: 'invalidResponse' };
      state.queue = queue; state.audit = audit.items; state.selected = null; state.dirty = false; state.stale = false;
      form.reset(); form.hidden = true; $('choose-hint').hidden = false;
      renderQueue(); renderAudit();
    }
    async function login(token) {
      message('loggingIn');
      try {
        const request = api('login', { token }); token = '';
        const result = await request;
        if (result.ok !== true || typeof result.csrf !== 'string' || !result.csrf) throw { key: 'invalidResponse' };
        state.csrf = result.csrf; authView(true); message('loading');
        await refresh(); message('loaded');
      } catch (error) { fail(error); } finally { token = ''; $('token').value = ''; }
    }
    function buildDecision() {
      const { item, kind } = state.selected;
      if (!Number.isInteger(item.revision) || item.revision < 1) throw { key: 'readOnlyRevision' };
      const reason = field('reason').value.trim(); if (!reason) throw { key: 'reasonRequired' };
      const body = { kind, id: item.id, expected_revision: item.revision, action: $('action').value, reason };
      if (body.action !== 'publish') return body;
      const place = {};
      for (const name of ['name', 'category', 'city', 'state', 'address', 'neighbourhood', 'unit', 'position', 'source_url', 'source_type', 'source_scope']) place[name] = field(name).value.trim();
      place.lat = Number(field('lat').value); place.lng = Number(field('lng').value);
      place.customer_statement = field('customer_statement').value.trim() || null;
      place.source_verified = field('source_verified').checked;
      if (place.source_url) {
        let url; try { url = new URL(place.source_url); } catch { throw { key: 'httpsRequired' }; }
        if (url.protocol !== 'https:' || url.username || url.password) throw { key: 'httpsRequired' };
      }
      if ((place.position !== 'unknown' || place.customer_statement) && (!place.source_url || place.source_type !== 'direct' || !place.source_scope || !place.source_verified)) throw { key: 'sourceRequired' };
      const due = new Date(field('review_due_at').value);
      if (!Number.isFinite(due.getTime()) || due <= new Date()) throw { key: 'futureRequired' };
      place.review_due_at = due.toISOString();
      place.source_published_at = field('source_published_at').value ? new Date(field('source_published_at').value).toISOString() : null;
      if (place.source_published_at && new Date(place.source_published_at) > new Date()) throw { key: 'sourceFuture' };
      body.place = place; return body;
    }
    $('login-form').addEventListener('submit', (event) => {
      event.preventDefault(); if (state.busy) return;
      let token = $('token').value.trim(); $('token').value = '';
      busy(() => { const promise = login(token); token = ''; return promise; });
    });
    $('logout').addEventListener('click', () => {
      if (!discard()) return;
      busy(async () => {
        try {
          const result = await api('logout', {}); if (result.ok !== true) throw { key: 'invalidResponse' };
          let ended = false;
          try { await api('session'); } catch (error) { if (error.status === 401) ended = true; else throw error; }
          if (!ended) throw { key: 'invalidResponse' };
          authView(false); message('signedOut');
        }
        catch (error) { fail(error); }
      });
    });
    $('refresh').addEventListener('click', () => { if (discard()) busy(async () => { message('loading'); try { await refresh(); message('loaded'); } catch (error) { state.stale = true; fail(error); } }); });
    $('language').addEventListener('change', () => { state.language = $('language').value; translate(); });
    document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
      if (state.busy || !discard()) return;
      state.tab = button.dataset.tab; state.selected = null; state.dirty = false;
      form.hidden = true; $('choose-hint').hidden = false; $('status-filter').value = '';
      document.querySelectorAll('[data-tab]').forEach((tab) => tab.setAttribute('aria-pressed', String(tab === button)));
      $('review-layout').hidden = state.tab === 'audit'; $('audit-panel').hidden = state.tab !== 'audit';
      if (state.tab !== 'audit' && state.queue) renderQueue();
    }));
    $('status-filter').addEventListener('change', renderQueue);
    form.addEventListener('input', () => { state.dirty = true; updateSource(); });
    form.addEventListener('change', () => { state.dirty = true; updateAction(); });
    form.addEventListener('submit', (event) => {
      event.preventDefault(); if (state.busy || state.stale || !state.selected || !form.reportValidity()) return;
      let body; try { body = buildDecision(); } catch (error) { fail(error); return; }
      busy(async () => {
        message('saving'); let accepted = false;
        try {
          const result = await api('decision', body);
          if (result.ok !== true || typeof result.id !== 'string' || !Number.isInteger(result.revision)) throw { key: 'invalidResponse' };
          accepted = true; state.dirty = false;
          await refresh();
          const section = Object.keys(kinds).find((key) => kinds[key] === body.kind);
          const updated = state.queue[section].find((item) => item.id === body.id);
          const audited = state.audit.some((event) => event.entity_id === body.id && event.kind === body.kind && event.action === body.action && event.reason === body.reason && event.after_data?.[body.kind === 'establishment' ? 'establishment' : 'contribution']?.revision === result.revision);
          if (!updated || updated.revision < result.revision || !audited) throw { key: 'verifyFailed' };
          message('saved');
        } catch (error) {
          state.stale = accepted || error.status === 409 || !error.status || error.status >= 500;
          if (accepted) { if (error.status === 401 || error.status === 403) authView(false); message(error.key === 'verifyFailed' ? 'verifyFailed' : 'saveUnconfirmed', true); }
          else if (!error.status || error.status >= 500) message('outcomeUnknown', true);
          else fail(error);
        }
      });
    });
    window.addEventListener('beforeunload', (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });
    // Do not retain the private queue in a back/forward-cache snapshot.
    window.addEventListener('pagehide', () => { authView(false); fragmentToken = ''; });
    window.addEventListener('pageshow', (event) => { if (event.persisted) location.reload(); });
    translate();
    if (fragmentFailed) { message('fragmentError', true); return; }
    busy(async () => {
      if (fragmentToken) { const promise = login(fragmentToken); fragmentToken = ''; await promise; return; }
      message('loading');
      try {
        const session = await api('session');
        if (session.ok !== true || session.role !== 'admin' || typeof session.csrf !== 'string' || !session.csrf) throw { key: 'invalidResponse' };
        state.csrf = session.csrf; authView(true); await refresh(); message('loaded');
      } catch (error) { if (error.status === 401) { authView(false); clearMessage(); } else fail(error); }
    });
  }
})();
