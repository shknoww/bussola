import pt from './i18n/public-pt-BR.js';
import en from './i18n/public-en-GB.js';
import {UUID, REFRESH_MS, categories, escapeHTML as esc, httpsURL, publicPlace, queryParams, readFavourites, writeFavourites, clearFavourites, api, validateResults, distanceKm, submissionAttempt} from './lib/public-core.js';

// All dynamic HTML text is escaped; IDs/enums/coordinates pass public-core validation.
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
let lang='pt-BR';
try { if(localStorage.getItem('bussola-language')==='en-GB') lang='en-GB'; } catch {}
const t = key => (lang==='en-GB'?en:pt)[key] || key;
const state={query:'',city:'São Paulo',category:'',position:'all',area:null,view:'explore',saved:[],items:[],points:[],total:0,next:null,offset:0,selected:null,detail:null,coords:null,sort:'name',loading:false,error:null};
let map, layers, tiles, userMarker, installPrompt, toastTimer, searchTimer, queryController, queryVersion=0, detailVersion=0, detailController, savedVersion=0, unavailable=[], mapFailure=false, autoFit=true;
const markers=new Map(), dialogOpeners=new WeakMap(), attempts=new WeakMap();
let correctionTarget=null;
const glyphs={cafe:'☕',restaurant:'♧',bookshop:'▤',bar:'♧',shop:'◇',other:'⌂'};
function notify(message){ $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,6000); }
function storageFailure(){ $('#storage-status').hidden=false; notify(t('storageError')); }
try {
  // Retire the prototype's local suggestion drafts; never migrate fictitious IDs.
  for(const key of ['bussola-suggestions','bussola-saved']){if(localStorage.getItem(key)!==null){localStorage.removeItem(key);if(localStorage.getItem(key)!==null)throw new Error('storage');}}
  state.saved=readFavourites(localStorage);
} catch { queueMicrotask(storageFailure); }
function translate(){
  document.documentElement.lang=lang; document.title=t('title'); $('#language').value=lang;
  $$('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
  $$('[data-aria]').forEach(el=>el.setAttribute('aria-label',t(el.dataset.aria)));
  $$('[data-placeholder]').forEach(el=>el.placeholder=t(el.dataset.placeholder));
  $$('[data-categories]').forEach(el=>{const value=el.value; el.innerHTML=categories.map(c=>`<option value="${c}">${esc(t(c))}</option>`).join(''); if(categories.includes(value))el.value=value;});
  render(); if($('#detail-dialog').open) renderDetail();
}
function openDialog(dialog,trigger=document.activeElement){trigger?.focus?.({preventScroll:true}); dialogOpeners.set(dialog,trigger); if(!dialog.open) dialog.showModal();}
$$('dialog').forEach(dialog=>dialog.addEventListener('cancel',event=>{if(dialog.querySelector('form[data-busy]')){event.preventDefault();notify(t('sending'));}}));
$$('dialog').forEach(dialog=>dialog.addEventListener('close',()=>{const opener=dialogOpeners.get(dialog); if(opener?.isConnected)opener.focus({preventScroll:true}); if(dialog.id==='detail-dialog') clearDetailURL();}));
function badge(p){return `<span class="position-badge ${p.position}"><i class="dot"></i>${esc(t(p.position))}</span>`;}
function artwork(p){return `<span class="place-art art-${p.category}" aria-hidden="true">${glyphs[p.category]}</span>`;}
function saveButton(p){const saved=state.saved.some(x=>x.id===p.id); return `<button class="save-button ${saved?'saved':''}" data-save="${p.id}" aria-label="${esc(t(saved?'remove':'save'))}: ${esc(p.name)}" aria-pressed="${saved}">${saved?'◆':'◇'}</button>`;}
function emptyBlock(title,help,action='reset'){return `<div class="empty"><h2>${esc(t(title))}</h2><p>${esc(t(help))}</p><button data-${action}>${esc(t(action==='retry'?'retry':'reset'))}</button>${action==='reset'?`<button data-broader>${esc(t('broader'))}</button>`:''}</div>`;}
function minimalCard(p, status='offline'){return `<article class="place-card minimal-card"><h2 class="place-name">${esc(p.name)}</h2><p>${esc(p.neighbourhood)}</p><p>${esc(t(status))}</p>${status==='savedCheckError'?`<button data-open="${p.id}">${esc(t('retryDetail'))}</button>`:''}${saveButton(p)}</article>`;}
function keepFocus(root,draw){
  const active=document.activeElement;
  const attribute=root.contains(active)?['data-open','data-save','data-close','data-correct','data-share','data-retry-detail','data-retry','data-reset','data-broader'].find(a=>active.hasAttribute(a)):null;
  const value=attribute?active.getAttribute(attribute):null;
  draw();
  if(attribute&&!active.isConnected){const next=[...root.querySelectorAll('['+attribute+']')].find(el=>el.getAttribute(attribute)===value);(next||root.querySelector('[data-close]')||root).focus({preventScroll:true});}
}
function render(){keepFocus($('#results'),renderContent);}
function renderContent(){
  $('#saved-count').textContent=state.saved.length;
  $('#view-title').textContent=t(state.view==='saved'?'savedTitle':'nextPlace');
  $('#city-label').textContent=state.city||t('allCities'); $('#map-city').textContent=state.city||t('allCities');
  $('#clear-area').hidden=!state.area; $('#saved-tools').hidden=state.view!=='saved'; $('#sort-note').hidden=state.sort!=='distance';
  $('#mobile-toggle').textContent=t(document.body.classList.contains('mobile-list')?'mapView':'listView');
  $('#offline-banner').hidden=navigator.onLine;
  $$('.filter-chip').forEach(b=>{const selected=b.dataset.position===state.position; b.classList.toggle('selected',selected); b.setAttribute('aria-pressed',selected);});
  $$('.nav-item').forEach(b=>{const selected=b.dataset.view===state.view; b.classList.toggle('active',selected); if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  $('#results').setAttribute('aria-busy',state.loading);
  $('#load-more').hidden=!navigator.onLine||!!state.error||state.next===null; $('#load-more').disabled=state.loading;
  $('#previous-page').hidden=!navigator.onLine||state.offset===0; $('#previous-page').disabled=state.loading;
  if(!navigator.onLine){
    $('#results-count').textContent=t('offline'); $('#map-total').textContent='';
    $('#results').innerHTML=`<div class="empty"><p>${esc(t('offlineHelp'))}</p></div>`+(state.view==='saved'?state.saved.map(p=>minimalCard(p)).join(''):`<button class="primary full" data-view="saved">${esc(t('saved'))}</button>`);
  }else if(state.error){$('#results-count').textContent=t('requestError'); $('#map-total').textContent=''; $('#results').innerHTML=emptyBlock('requestError',state.error==='invalid_response'?'invalidResponse':'refreshError','retry');}
  else if(state.loading&&!state.items.length){$('#results-count').textContent=t('loading'); $('#map-total').textContent=''; $('#results').innerHTML=`<div class="empty"><p>${esc(t('loading'))}</p></div>`;}
  else {
    $('#results-count').textContent=`${state.total} ${t(state.total===1?'place':'places')} · ${state.items.length?state.offset+1:0}–${state.offset+state.items.length} ${t('shown')}`;
    $('#map-total').textContent=`${state.total} ${t(state.total===1?'place':'places')}`;
    const items=state.sort==='distance'&&state.coords?[...state.items].sort((a,b)=>distanceKm(state.coords,a)-distanceKm(state.coords,b)):state.items;
    $('#results').innerHTML=items.length?items.map(p=>`<article class="place-card ${p.id===state.selected?'active':''}"><button class="place-main" data-open="${p.id}" aria-label="${esc(t('details'))}: ${esc(p.name)}">${artwork(p)}<span class="place-content"><span class="place-name">${esc(p.name)}</span><span class="place-category">${esc(t(p.category))}</span><span class="place-neighborhood">${esc([p.neighbourhood,p.city,p.unit].filter(Boolean).join(' · '))}</span>${state.coords?`<span class="distance">${distanceKm(state.coords,p).toLocaleString(lang,{maximumFractionDigits:1})} ${esc(t('straightLine'))}</span>`:''}${badge(p)}</span></button>${saveButton(p)}</article>`).join(''):emptyBlock(state.view==='saved'&&!state.saved.length?'noSaved':'empty','emptyHelp');
    if(state.view==='saved') $('#results').insertAdjacentHTML('beforeend',unavailable.map(p=>minimalCard(p,p.status)).join(''));
  }
  renderMap();
}
function renderMapStatus(){
  const box=$('#map-status');
  if(!navigator.onLine){box.textContent=t('offlineHelp');box.hidden=false;return;}
  if(state.error){box.innerHTML=`${esc(t('requestError'))} <button data-retry>${esc(t('retry'))}</button>`;box.hidden=false;return;}
  if(mapFailure){box.textContent=t(map?'mapTilesError':'mapError');box.hidden=false;return;}
  if(!state.loading&&state.total===0){box.innerHTML=`${esc(t('empty'))} <button data-reset>${esc(t('reset'))}</button> <button data-broader>${esc(t('broader'))}</button>`;box.hidden=false;return;}
  box.hidden=true;
}
function renderMap(){
  renderMapStatus();
  if(!map)return;
  layers.clearLayers(); markers.clear();
  $('#cluster-note').hidden=!navigator.onLine||!state.points.some(p=>p.cluster);
  if(!navigator.onLine||state.error)return;
  state.points.forEach(p=>{
    const title=p.cluster?`${p.count} ${t('cluster')}`:`${p.name} — ${t(p.position)}`;
    const marker=L.marker([p.lat,p.lng],{icon:L.divIcon({className:p.cluster?'cluster-pin':`map-pin ${p.position} ${p.id===state.selected?'selected':''}`,html:p.cluster?`<span>${p.count}</span>`:`<span class="marker-bubble" aria-hidden="true">${glyphs[p.category]}</span>`,iconSize:[38,42],iconAnchor:[19,21]}),title,alt:title,keyboard:true,zIndexOffset:p.id===state.selected?1000:0}).addTo(layers);
    marker.on('click',()=>{if(p.cluster){map.setView([p.lat,p.lng],Math.min(map.getZoom()+2,19)); searchArea();}else openDetail(p.id,marker.getElement());});
    if(!p.cluster)markers.set(p.id,marker);
  });
}
function fitResults(){if(map&&state.points.length)map.fitBounds(state.points.map(p=>[p.lat,p.lng]),{padding:[60,80],maxZoom:14,animate:false});}
function showMapFailure(){mapFailure=true;renderMapStatus();}
function initMap(){try {
  if(!window.L)throw new Error('map');
  map=L.map('map',{zoomControl:false,minZoom:3,maxZoom:19,maxBounds:[[-85,-180],[85,180]],maxBoundsViscosity:1}).setView([-23.558,-46.679],13);
  tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'});
  if(navigator.onLine) tiles.addTo(map);
  tiles.on('tileerror',()=>showMapFailure('mapTilesError'));
  tiles.on('load',renderMapStatus);
  layers=L.layerGroup().addTo(map);
  new ResizeObserver(()=>map.invalidateSize()).observe($('#map'));
}catch{showMapFailure('mapError'); $$('.map-controls button,#search-area').forEach(b=>b.disabled=true);}}
async function loadResults({reset=false,fit=false}={}){
  if(reset){state.offset=0; state.items=[];state.points=[];state.next=null;}
  if(fit)autoFit=true;
  queryController?.abort(); const version=++queryVersion; queryController=new AbortController();
  state.error=null;
  if(!navigator.onLine){state.items=[];state.points=[];state.loading=false;render();return;}
  if(state.view==='saved'&&!state.saved.length){state.items=[];state.points=[];state.total=0;state.next=null;state.loading=false;unavailable=[];render();return;}
  state.loading=true;render();
  try{
    const params=queryParams(state,state.offset), options={signal:queryController.signal};
    const [list,mapData]=await Promise.all([api('/establishments?'+params,options),api('/map?'+params,options)]);
    if(version!==queryVersion||!navigator.onLine)return;
    const result=validateResults(list,mapData,state.offset);
    state.items=result.items;state.points=result.points;state.total=list.total;state.next=list.next_offset;
    if(state.offset>=state.total&&state.offset>0){state.offset=0;return loadResults();}
    state.loading=false;render();if(autoFit){fitResults();autoFit=false;}
  }catch(error){if(version!==queryVersion)return;state.loading=false;state.error=error.message;state.items=[];state.points=[];state.next=null;render();}
}
async function loadCities(){
  try{const data=await api('/cities');if(!Array.isArray(data.items)||data.items.some(c=>typeof c!=='string'))throw new Error('invalid_response');const cities=[...new Set(['São Paulo',state.city,...data.items].filter(Boolean))].sort((a,b)=>a.localeCompare(b,lang)); $('#city').innerHTML=`<option value="">${esc(t('allCities'))}</option>`+cities.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');$('#city').value=state.city;$('#cities-status').hidden=true;$('#cities-retry').hidden=true;}
  catch{ $('#cities-status').textContent=t('cityError');$('#cities-status').hidden=false;$('#cities-retry').hidden=false;}
}
async function checkSaved(){
  const version=++savedVersion;unavailable=[];
  if(state.view!=='saved'||!navigator.onLine)return;
  const pending=[...state.saved], failures=[];
  await Promise.all(Array.from({length:Math.min(6,pending.length)},async()=>{while(pending.length&&version===savedVersion&&navigator.onLine){const p=pending.shift();try{publicPlace(await api('/establishments/'+p.id));}catch(e){failures.push({...p,status:e.status===404?'unavailable':'savedCheckError'});}}}));
  if(version===savedVersion&&state.view==='saved'&&navigator.onLine){unavailable=failures;render();}
}
function date(value){return value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleDateString(lang):t('noDate');}
let detailError=null, detailLoading=false;
function renderDetail(){keepFocus($('#detail'),renderDetailContent);}
function renderDetailContent(){
  const close=`<div class="dialog-header"><span class="dialog-kicker">Bússola</span><button class="icon-button" data-close data-aria="close" aria-label="${esc(t('close'))}">×</button></div>`;
  if(!navigator.onLine){$('#detail').innerHTML=close+`<h2 id="detail-title">${esc(t('offline'))}</h2><p>${esc(t('offlineHelp'))}</p>`;return;}
  if(detailLoading&&!state.detail){$('#detail').innerHTML=close+`<h2 id="detail-title">${esc(t('loading'))}</h2>`;return;}
  if(detailError||!state.detail){$('#detail').innerHTML=close+`<h2 id="detail-title">${esc(t(detailError===404?'unavailable':'requestError'))}</h2><p>${esc(t(detailError===404?'unavailableHelp':'refreshError'))}</p><button class="primary" data-retry-detail>${esc(t('retry'))}</button>`;return;}
  const p=publicPlace(state.detail);state.detail=p;
  const saved=state.saved.some(x=>x.id===p.id);
  $('#detail').innerHTML=close+`${artwork(p)}<h2 id="detail-title">${esc(p.name)}</h2><p class="detail-meta">${esc(t(p.category))} · ${esc([p.unit,p.neighbourhood,p.city,p.state].filter(Boolean).join(' · '))}</p><p>${esc(p.address)}</p>${badge(p)}<p class="review-state">${esc(t('review_'+p.review_state))}</p>${p.position==='unknown'?`<p>${esc(t('unknownHelp'))}</p>`:''}<section class="source-box"><h3>${esc(t('source'))}</h3>${p.source_url?`<a href="${esc(p.source_url)}" target="_blank" rel="noopener noreferrer">${esc(t('source'))} ↗</a><dl><dt>${esc(t('sourceType'))}</dt><dd>${esc(t(p.source_type||'noSourceType'))}</dd><dt>${esc(t('scope'))}</dt><dd>${esc(p.source_scope||'—')}</dd><dt>${esc(t('published'))}</dt><dd>${esc(date(p.source_published_at))}</dd></dl>`:`<p>${esc(t('noSource'))}</p>`}<dl><dt>${esc(t('verified'))}</dt><dd>${esc(date(p.verified_at))}</dd><dt>${esc(t('due'))}</dt><dd>${esc(date(p.review_due_at))}</dd></dl></section>${p.customer_statement?`<section class="source-box"><h3>${esc(t('statement'))}</h3><p>${esc(p.customer_statement)}</p></section>`:''}<div class="detail-actions"><a class="primary" data-route href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" target="_blank" rel="noopener noreferrer">${esc(t('route'))} ↗</a><button data-save="${p.id}" aria-pressed="${saved}" aria-label="${esc(t(saved?'remove':'save'))}">${saved?'◆':'◇'}</button></div><div class="detail-links"><button class="text-button" data-correct>${esc(t('correct'))}</button><button class="text-button" data-share>${esc(t('share'))}</button></div>`;
}
async function fetchDetail(){
  const id=state.selected;if(!id)return;
  detailController?.abort();detailController=new AbortController();const version=++detailVersion;
  if(!navigator.onLine){state.detail=null;renderDetail();return;}
  detailLoading=true;detailError=null;renderDetail();
  try{if(!UUID.test(id)) {const e=new Error('not_found');e.status=404;throw e;}const p=publicPlace(await api('/establishments/'+id,{signal:detailController.signal}));if(version!==detailVersion||id!==state.selected||!navigator.onLine)return;if(p.id!==id)throw new Error('invalid_response');state.detail=p;detailLoading=false;renderDetail();}
  catch(e){if(version!==detailVersion)return;state.detail=null;detailError=e.status||e.message;detailLoading=false;renderDetail();}
}
function openDetail(id,trigger){state.selected=id;state.detail=null;detailError=null;detailLoading=true;const url=new URL(location.href);url.searchParams.set('place',id);history.pushState({place:id},'',url);renderDetail();openDialog($('#detail-dialog'),trigger);renderMap();fetchDetail();}
function clearDetailURL(){detailController?.abort();++detailVersion;state.selected=null;state.detail=null;const url=new URL(location.href);url.searchParams.delete('place');history.replaceState(null,'',url);renderMap();}
function routeFromURL(){const id=new URL(location.href).searchParams.get('place');if(id){state.selected=id;state.detail=null;detailLoading=true;renderDetail();openDialog($('#detail-dialog'));fetchDetail();}else if($('#detail-dialog').open)$('#detail-dialog').close();}
function toggleSave(id){
  try{const stored=readFavourites(localStorage);const exists=stored.some(p=>p.id===id);const p=state.detail?.id===id?state.detail:state.items.find(x=>x.id===id)||state.points.find(x=>x.id===id);if(!exists&&!p)return;const next=exists?stored.filter(p=>p.id!==id):[...stored,p];state.saved=writeFavourites(localStorage,next);$('#storage-status').hidden=true;notify(t(exists?'removedOk':'savedOk'));render();if(state.detail)renderDetail();if(state.view==='saved'){loadResults({reset:true});checkSaved();}}
  catch(e){if(e.message==='favourite_limit')notify(t('favouriteLimit'));else storageFailure();}
}
function resetFilters(allCities=false){state.query='';state.category='';state.position='all';state.area=null;if(allCities)state.city='';$('#search').value='';$('#category').value='';$('#city').value=state.city;loadResults({reset:true,fit:true});}
function searchArea(){if(!map)return;const b=map.getBounds();state.area=[Math.max(-180,b.getWest()),Math.max(-90,b.getSouth()),Math.min(180,b.getEast()),Math.min(90,b.getNorth())];loadResults({reset:true});}
function changeView(view){state.view=view;state.area=null;state.offset=0;if(view==='saved'){state.query='';state.city='';state.category='';state.position='all';$('#search').value='';$('#city').value='';$('#category').value='';document.body.classList.add('mobile-list');}loadResults({reset:true,fit:true});checkSaved();}
async function locate(){
  if(!navigator.onLine){notify(t('onlineRequired'));return false;}
  $('#locate').disabled=true;
  try{if(!navigator.geolocation)throw new Error();const p=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:10000,maximumAge:60000}));state.coords=[p.coords.latitude,p.coords.longitude];if(map){userMarker?.remove();userMarker=L.marker(state.coords,{icon:L.divIcon({className:'user-location',iconSize:[18,18]}),title:t('locate')}).addTo(map);map.setView(state.coords,14);}render();notify(t('locationOk'));return true;}catch{notify(t('locationError'));return false;}finally{$('#locate').disabled=false;}
}
async function submitForm(event,kind){
  event.preventDefault();const form=event.currentTarget,status=$(`#${kind}-status`);
  if(form.dataset.busy)return;
  if(!navigator.onLine){status.textContent=t('onlineRequired');return;}
  const payload=Object.fromEntries([...new FormData(form)].map(([k,v])=>[k,String(v).trim()]));
  if(kind==='suggest'&&(!payload.name||!payload.city||!payload.state||!payload.address||payload.position!=='unknown'&&!httpsURL(payload.source_url)||payload.source_url&&!httpsURL(payload.source_url))||kind==='correction'&&!payload.notes){status.textContent=t('validationError');return;}
  const attempt=submissionAttempt(attempts.get(form),kind==='correction'?{...payload,target:correctionTarget}:payload);attempts.set(form,attempt);
  const endpoint=kind==='suggest'?'/submissions':`/establishments/${correctionTarget}/corrections`;
  form.dataset.busy='true';const controls=[...form.elements];const disabled=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);status.textContent=t('sending');
  try{const result=await api(endpoint,{body:{...payload,idempotency_key:attempt.key}});if(!UUID.test(result.id)||result.status!=='pending')throw new Error('invalid_response');status.textContent=`${t('sent')} ${result.id}`;form.reset();attempts.delete(form);if(kind==='suggest')$('#suggest-source').required=false;status.focus();}
  catch(e){status.textContent=t(e.status===429?'rateLimit':e.status===400?'validationError':'sendError');status.focus();}
  finally{controls.forEach((c,i)=>c.disabled=disabled[i]);delete form.dataset.busy;}
}
function connectivity(){
  if(!navigator.onLine){queryController?.abort();detailController?.abort();++queryVersion;++detailVersion;++savedVersion;state.items=[];state.points=[];state.detail=null;state.loading=false;unavailable=[];if(map&&tiles&&map.hasLayer(tiles))map.removeLayer(tiles);$('#map-status').textContent=t('offlineHelp');$('#map-status').hidden=false;render();if($('#detail-dialog').open)renderDetail();}
  else{mapFailure=false;if(map&&tiles&&!map.hasLayer(tiles))tiles.addTo(map);$('#map-status').hidden=!!map;loadResults();fetchDetail();loadCities();checkSaved();}
}
function refresh(){if(document.visibilityState!=='visible'||!navigator.onLine)return;loadResults();if(state.selected)fetchDetail();if(state.view==='saved')checkSaved();}

// Explicit previous/next page navigation keeps every result reachable during refresh.
const previous=document.createElement('button');previous.id='previous-page';previous.className='text-button';previous.hidden=true;previous.textContent='←';previous.dataset.aria='previousPage';previous.setAttribute('aria-label',t('previousPage'));$('#load-more').before(previous);
$('#previous-page').addEventListener('click',()=>{state.offset=Math.max(0,state.offset-50);state.items=[];loadResults();$('#results').scrollTop=0;});
$('#load-more').addEventListener('click',()=>{if(state.next===null)return;state.offset=state.next;state.items=[];loadResults();$('#results').scrollTop=0;});
$('#search').addEventListener('input',e=>{state.query=e.target.value;clearTimeout(searchTimer);queryController?.abort();++queryVersion;state.items=[];state.points=[];state.loading=true;render();searchTimer=setTimeout(()=>loadResults({reset:true,fit:true}),300);});
$('#city').addEventListener('change',e=>{state.city=e.target.value;state.area=null;loadResults({reset:true,fit:true});});
$('#category').addEventListener('change',e=>{state.category=e.target.value;loadResults({reset:true,fit:true});});
$('#sort').addEventListener('change',async e=>{if(e.target.value==='distance'&&!state.coords&&!await locate()){e.target.value=state.sort;return;}state.sort=e.target.value;render();});
$('#language').addEventListener('change',e=>{lang=e.target.value;try{localStorage.setItem('bussola-language',lang);}catch{}translate();$('#previous-page').setAttribute('aria-label',t('previousPage'));loadCities();});
$('#suggest-position').addEventListener('change',e=>$('#suggest-source').required=e.target.value!=='unknown');
$('#suggest-form').addEventListener('submit',e=>submitForm(e,'suggest'));$('#correction-form').addEventListener('submit',e=>submitForm(e,'correction'));
$('#suggest-button').addEventListener('click',e=>openDialog($('#suggest-dialog'),e.currentTarget));
$('#search-area').addEventListener('click',searchArea);$('#clear-area').addEventListener('click',()=>{state.area=null;loadResults({reset:true,fit:true});});
$('#zoom-in').addEventListener('click',()=>map?.zoomIn());$('#zoom-out').addEventListener('click',()=>map?.zoomOut());$('#fit-map').addEventListener('click',fitResults);$('#locate').addEventListener('click',locate);
$('#mobile-toggle').addEventListener('click',()=>{document.body.classList.toggle('mobile-list');render();requestAnimationFrame(()=>map?.invalidateSize());});
$('.skip-link').addEventListener('click',()=>{document.body.classList.add('mobile-list');render();});
$('#cities-retry').addEventListener('click',loadCities);
$('#clear-saved').addEventListener('click',()=>{if(!confirm(t('clearConfirm')))return;try{state.saved=clearFavourites(localStorage);$('#storage-status').hidden=true;notify(t('clearedOk'));loadResults({reset:true});checkSaved();if(state.detail)renderDetail();}catch{storageFailure();}});
document.addEventListener('click',e=>{
  const button=e.target.closest('button');if(button){
    if(button.hasAttribute('data-close')){const dialog=button.closest('dialog');if(dialog.querySelector('form[data-busy]')){notify(t('sending'));return;}dialog.close();return;}
    if(button.dataset.view){changeView(button.dataset.view);return;}
    if(button.dataset.position){state.position=button.dataset.position;loadResults({reset:true,fit:true});return;}
    if(button.dataset.save){toggleSave(button.dataset.save);return;}
    if(button.dataset.open){openDetail(button.dataset.open,button);return;}
    if(button.hasAttribute('data-reset'))resetFilters();
    if(button.hasAttribute('data-broader'))resetFilters(true);
    if(button.hasAttribute('data-retry')){loadResults();checkSaved();}
    if(button.hasAttribute('data-retry-detail'))fetchDetail();
    if(button.classList.contains('about-trigger'))openDialog($('#about-dialog'),button);
    if(button.hasAttribute('data-correct')&&state.detail){if(correctionTarget!==state.detail.id){$('#correction-form').reset();attempts.delete($('#correction-form'));$('#correction-status').textContent='';}correctionTarget=state.detail.id;$('#correction-place').textContent=state.detail.name;openDialog($('#correction-dialog'),button);}
    if(button.hasAttribute('data-share'))copy(location.origin+'/?place='+state.selected);
  }
  if(e.target.closest('[data-route]')&&!navigator.onLine){e.preventDefault();notify(t('onlineRequired'));}
});
async function copy(text){try{await navigator.clipboard.writeText(text);notify(t('copied'));}catch{notify(t('copyError'));}}
$('#copy-link').addEventListener('click',()=>copy(location.origin+'/'));
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
$('#install-button').addEventListener('click',async e=>{if(installPrompt){try{await installPrompt.prompt();await installPrompt.userChoice;}catch{openDialog($('#install-dialog'),e.currentTarget);}installPrompt=null;}else openDialog($('#install-dialog'),e.currentTarget);});
window.addEventListener('appinstalled',()=>{installPrompt=null;notify(t('installed'));});
window.addEventListener('online',connectivity);window.addEventListener('offline',connectivity);window.addEventListener('popstate',routeFromURL);
window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
window.addEventListener('storage',e=>{if(e.key==='bussola-favourites-v1'||e.key===null){try{state.saved=readFavourites(localStorage);render();if(state.detail)renderDetail();if(state.view==='saved'){loadResults({reset:true});checkSaved();}}catch{storageFailure();}}});
setInterval(refresh,REFRESH_MS);
translate();initMap();loadResults();loadCities();routeFromURL();if(!navigator.onLine)connectivity();
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>notify(t('swError')));
