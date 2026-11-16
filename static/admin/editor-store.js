// Storage adapter that connects the planogram editor to the 3D pharmacy's control-panel backend.
// Every save writes the editor's full state to the backend (private: signed-in team only) and publishes the
// store planogram derived from it (where units stand, which product on which shelf, facings, widths — never
// sales rates or piece counts). Pictures uploaded in the editor are kept by the backend.
(function(){
  'use strict';
  var API = '', TOKEN = '', BASE = 0, mapP = null, AUTO = {};
  var ls = function(k){ try { return localStorage.getItem(k); } catch(e){ return null; } };
  var toLogin = function(){ location.replace('./?next=editor'); };
  var ready = fetch('../config.json', {cache:'no-cache'}).then(function(r){ return r.ok ? r.json() : {}; }).catch(function(){ return {}; }).then(function(c){
    API = String(c.api || ls('ib3d-admin-api') || '').replace(/\/+$/, ''); TOKEN = ls('ib3d-admin-token') || ''; if (!API || !TOKEN){ toLogin(); throw new Error('سجّل الدخول أولاً'); } });
  var call = function(path, opt){ opt = opt || {}; opt.headers = Object.assign({authorization:'Bearer ' + TOKEN}, opt.headers || {}); return fetch(API + path, opt); };
  var fail = function(r, d){ var e = new Error((d && d.error) || ('خطأ ' + r.status)); if (r.status === 409) e.code = 'conflict'; else if (r.status === 401 || r.status === 403) e.code = 'not_writer'; return e; };
  // editor state → the store's planogram (same rules as the control panel's import)
  function toStore(ED, map){
    var names = [], nidx = {}, used = new Set();
    var nm = function(s){ if (!(s in nidx)){ nidx[s] = names.length; names.push(s); } return nidx[s]; };
    var f = Object.keys(ED.fx).map(function(k){ return ED.fx[k]; }).sort(function(a, b){ return a.code < b.code ? -1 : 1; }).map(function(x){
      var its = [];
      (x.it || []).forEach(function(it){
        var pick = it[8] ? String(it[8]) : null;                                  // a product number set in the editor wins
        if (!pick){ var c = map.ids[String(it[1]).trim().slice(0, 48)]; if (!c) return; var b = String(it[2] || '').toLowerCase();
          pick = (c.find(function(q){ return !used.has(q[0]) && q[1] === b; }) || c.find(function(q){ return !used.has(q[0]); }) || [])[0]; }
        if (!pick) return; used.add(pick); var ca = map.cat[it[6]];
        its.push([it[0], pick, Math.max(1, Math.round(+it[3] || 1)), ca ? nm(ca) : -1, Math.round((+it[7] || 0) * 10) / 10]); });
      var dep = String(x.dept || '').split('+').map(function(s){ return map.dept[s.trim()]; }).filter(Boolean)[0] || map.zname[x.zone];
      var kind = String(x.kind || ''), wall = x.pos === 'حائط' ? 1 : 0, m = /وجه (\w)/.exec(x.loc || '');
      return {c:x.code, z:x.zone, b:!x.brand || x.brand === 'Mixed' ? '' : x.brand, l:dep ? nm(dep) : -1, w:wall, s:x.shelves || 5, k:kind.indexOf('هوك أعلى') >= 0 ? 2 : kind.indexOf('هوك') >= 0 ? 1 : 0,
        r:(x.parts || []).map(function(q){ return [q.x, q.y, q.w, q.h].map(function(v){ return Math.round(v / 24 * 1000) / 1000; }); }), f:wall ? 'W' : (x.face || (m ? m[1] : '')), it:its}; }).filter(function(x){ return x.r.length; });
    var zones = {}; Object.keys(ED.zones || {}).forEach(function(k){ if (ED.zones[k].color) zones[k] = ED.zones[k].color; });
    return {v:2, W:Math.round(ED.room.w / 24 * 1000) / 1000, D:Math.round(ED.room.h / 24 * 1000) / 1000, names:names, zones:zones, f:f};
  }
  // Every product the store sells gets its store picture in the editor's photo view, unless the team gave it one of
  // their own. These automatic pictures are not saved with the editor's state: they are looked up again on each load.
  var getMap = function(){ if (!mapP) mapP = fetch('../plan/pgmap.json').then(function(x){ return x.json(); }); return mapP; };
  async function storePictures(d){
    try { var map = await getMap(), pr = await fetch('../data/products.json', {cache:'no-cache'}).then(function(r){ return r.json(); }), by = {};
      Object.keys(pr.sections || {}).forEach(function(k){ (pr.sections[k].products || []).forEach(function(q){ if (q.img && !by[q.id]) by[String(q.id)] = q; }); });
      d.img = d.img || {}; AUTO = {};
      Object.keys(d.fx || {}).forEach(function(k){ (d.fx[k].it || []).forEach(function(it){ var n = it[1]; if (d.img[n]) return;
        var ids = it[8] ? [[String(it[8])]] : (map.ids[String(n).trim().slice(0, 48)] || []), q = null; for (var i = 0; i < ids.length && !q; i++) q = by[ids[i][0]];
        if (!q) return; var a = +q.aspect || 1; d.img[n] = {ref:q.img, z:1, x:0, y:0, fit:'cover', wb:true, hs:1, ar:Math.max(.6, Math.min(2.4, 1 / a))}; AUTO[n] = JSON.stringify(d.img[n]); }); });
    } catch(e){ console.warn('store pictures not loaded', e); }
    return d;
  }
  var withoutAuto = function(data){ if (!data.img) return data; var out = Object.assign({}, data, {img:{}});
    Object.keys(data.img).forEach(function(n){ if (!(AUTO[n] && JSON.stringify(data.img[n]) === AUTO[n])) out.img[n] = data.img[n]; }); return out; };
  window.PG_STORE = {
    name:'ibrand-3d', online:true,
    init:function(){ return ready.then(function(){ return true; }); },
    load:async function(){
      await ready; var r = await call('/editor');
      if (r.status === 401){ toLogin(); throw new Error('انتهت الجلسة'); }
      if (r.status === 404){ BASE = 0; var e = await fetch('empty-state.json', {cache:'no-cache'}); return e.json(); }   // nothing saved yet: the empty room; import the backup from the "ملف" menu
      if (!r.ok) throw fail(r, await r.json().catch(function(){ return null; }));
      var d = await r.json(); BASE = +d.savedAt || 0; return storePictures(d);
    },
    save:async function(data){
      await ready;
      var r = await call('/editor?base=' + BASE, {method:'PUT', headers:{'content-type':'application/json'}, body:JSON.stringify(withoutAuto(data))});
      if (!r.ok) throw fail(r, await r.json().catch(function(){ return null; }));
      BASE = +data.savedAt || Date.now();
      // publish to the store
      var map; try { map = await getMap(); } catch(e){ mapP = null; throw new Error('اتحفظ في المحرر، لكن تعذّر تجهيز النشر للصيدلية'); }
      var p = await call('/pg?auto=1', {method:'PUT', headers:{'content-type':'application/json'}, body:JSON.stringify(toStore(data, map))});
      if (!p.ok) throw new Error('اتحفظ في المحرر، لكن النشر للصيدلية فشل: ' + (((await p.json().catch(function(){ return null; })) || {}).error || p.status));
    },
    saveImage:async function(name, blob){
      await ready; var r = await call('/img', {method:'POST', headers:{'content-type':blob.type || 'image/webp'}, body:blob});
      var d = await r.json().catch(function(){ return null; }); if (!r.ok || !d || !d.ref) throw fail(r, d); return d.ref;
    },
    imageUrl:function(ref){ return !ref ? '' : /^(data:|blob:|https?:)/.test(ref) ? ref : ref.indexOf('/public/img/') === 0 ? API + ref : ''; }
  };
})();
