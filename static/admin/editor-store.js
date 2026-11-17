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
  var prodP = null, getProducts = function(){ if (!prodP) prodP = fetch('../data/products.json', {cache:'no-cache'}).then(function(r){ return r.json(); }).then(function(pr){ var by = {}, base = pr.imgBase || '';   // the daily build writes picture addresses without their common start
    Object.keys(pr.sections || {}).forEach(function(k){ (pr.sections[k].products || []).forEach(function(q){ if (q.img && !by[q.id]){ if (!/^https?:/.test(q.img)) q.img = base + q.img; by[String(q.id)] = q; } }); }); return by; }); return prodP; };
  // which Salla product an editor item is: its own product number if it has one, else by its name (and brand when several share the name)
  async function productOf(it){ var map = await getMap(), by = await getProducts();
    if (it[8]) return by[String(it[8])] || {id:String(it[8]), name:''};
    var c = map.ids[String(it[1]).trim().slice(0, 48)] || [], b = String(it[2] || '').toLowerCase();
    var live = c.filter(function(q){ return by[q[0]]; }), pick = live.find(function(q){ return q[1] === b; }) || (live.length === 1 ? live[0] : null);
    return pick ? by[pick[0]] : (live.length > 1 ? {many:live.length} : null); }
  // a large copy of the picture being edited, kept only while the page is open: this is what goes to Salla
  var HI = {}, HIREF = {};
  var skuP = null;
  async function bigCanvas(src){ var isFile = src instanceof Blob, url = isFile ? URL.createObjectURL(src) : src, im = new Image(); im.crossOrigin = 'anonymous';
    try { await new Promise(function(ok, err){ im.onload = ok; im.onerror = err; im.src = url; }); } finally { if (isFile) setTimeout(function(){ URL.revokeObjectURL(url); }, 0); }
    var W = im.naturalWidth, H = im.naturalHeight, k = Math.min(1, 1600 / Math.max(W, H)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(W * k)); c.height = Math.max(1, Math.round(H * k));
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c; }
  function turn(c, op){ if (op !== 'rot' && op !== 'flip') return c; var o = document.createElement('canvas'), x = o.getContext('2d');
    if (op === 'rot'){ o.width = c.height; o.height = c.width; x.translate(c.height, 0); x.rotate(Math.PI / 2); } else { o.width = c.width; o.height = c.height; x.translate(c.width, 0); x.scale(-1, 1); }
    x.drawImage(c, 0, 0); return o; }
  // the product alone on a white square with a little air around it
  function squared(c){ var W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data, x1 = W, y1 = H, x2 = -1, y2 = -1;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++){ var p = (y * W + x) * 4; if (d[p + 3] > 20 && (d[p] < 238 || d[p + 1] < 238 || d[p + 2] < 238)){ if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; } }
    if (x2 <= x1 || y2 <= y1){ x1 = 0; y1 = 0; x2 = W - 1; y2 = H - 1; }
    var w = x2 - x1 + 1, h = y2 - y1 + 1, side = Math.round(Math.max(w, h) * 1.1), o = document.createElement('canvas'); o.width = o.height = side; var g = o.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, side, side); g.drawImage(c, x1, y1, w, h, Math.round((side - w) / 2), Math.round((side - h) / 2), w, h); return o; }
  // The editor shows only what the store sells right now. Items whose product is not on sale (hidden, out of stock,
  // not in the store at all) are set aside on load and put back untouched on every save, so nothing is lost and an
  // item returns by itself the day its product is back on sale.
  var HID = {};
  async function onlyOnSale(d){
    var map, by; try { map = await getMap(); by = await getProducts(); if (Object.keys(by).length < 500) return d; } catch(e){ console.warn('store products not loaded: showing every item', e); return d; }
    HID = {};
    Object.keys(d.fx || {}).forEach(function(k){ var f = d.fx[k], keep = [], hid = [];
      (f.it || []).forEach(function(it){ var on = it[8] ? !!by[String(it[8])] : (map.ids[String(it[1]).trim().slice(0, 48)] || []).some(function(q){ return by[q[0]]; }); (on ? keep : hid).push(it); });
      if (hid.length){ HID[k] = hid; f.it = keep; } });
    return d;
  }
  var withHidden = function(data){ var out = Object.assign({}, data, {fx:{}});
    Object.keys(data.fx || {}).forEach(function(k){ var f = data.fx[k], h = HID[k]; if (!h){ out.fx[k] = f; return; }
      var have = new Set((f.it || []).map(function(it){ return it[1]; })), extra = h.filter(function(it){ return !have.has(it[1]); });
      out.fx[k] = extra.length ? Object.assign({}, f, {it:(f.it || []).concat(extra)}) : f; });
    return out; };
  async function storePictures(d){
    try { var map = await getMap(), by = await getProducts();
      d.img = d.img || {}; AUTO = {};
      Object.keys(d.fx || {}).forEach(function(k){ (d.fx[k].it || []).forEach(function(it){ var n = it[1]; if (d.img[n]) return;
        var ids = it[8] ? [[String(it[8])]] : (map.ids[String(n).trim().slice(0, 48)] || []), q = null; for (var i = 0; i < ids.length && !q; i++) q = by[ids[i][0]];
        if (!q) return; var a = +q.aspect || 1; d.img[n] = {ref:q.img, z:1, x:0, y:0, fit:'cover', wb:true, hs:1, ar:Math.max(.6, Math.min(2.4, 1 / a))}; AUTO[n] = JSON.stringify(d.img[n]); }); });
    } catch(e){ console.warn('store pictures not loaded', e); }
    return d;
  }
  var withoutAuto = function(data){ if (!data.img) return data; var out = Object.assign({}, data, {img:{}});
    Object.keys(data.img).forEach(function(n){ if (!(AUTO[n] && JSON.stringify(data.img[n]) === AUTO[n])) out.img[n] = data.img[n]; }); return out; };
  // a small sign in the corner: is the link with Salla working (asks the backend, which asks the token vault; nothing is sent to Salla)
  function sallaSign(){ var b = document.createElement('button'); b.type = 'button'; b.id = 'sallaSign'; b.textContent = '🛒 سلة: جاري الفحص…';
    b.style.cssText = 'position:fixed;left:176px;bottom:12px;z-index:50;font:600 12px/1 Tahoma,Arial,sans-serif;padding:8px 12px;border-radius:999px;border:1px solid #b0bec5;background:#eceff1;color:#37474f;cursor:pointer';
    var why = '', check = function(){ b.textContent = '🛒 سلة: جاري الفحص…'; call('/salla/status').then(function(r){ return r.json().then(function(d){ if (r.status === 404) d = {linked:false, why:'الخادم لسه على الكود القديم'}; return d; }); }).then(function(d){
        why = d.linked ? 'الربط مع سلة شغال: الخادم وصل للخزنة وأخذ مفتاحاً صالحاً.' : (d.why || d.error || 'غير معروف');
        b.textContent = d.linked ? '🛒 سلة: مربوطة ✓' : '🛒 سلة: غير مربوطة ✕'; b.style.background = d.linked ? '#e8f5e9' : '#ffebee'; b.style.color = d.linked ? '#1b5e20' : '#b71c1c'; b.style.borderColor = d.linked ? '#81c784' : '#e57373'; b.title = why;
      }).catch(function(){ why = 'تعذّر الوصول للخادم'; b.textContent = '🛒 سلة: تعذّر الفحص'; b.title = why; }); };
    b.onclick = function(){ alert(why || 'جاري الفحص…'); check(); }; document.body.appendChild(b); check(); }
  ready.then(function(){ if (document.body) sallaSign(); else addEventListener('DOMContentLoaded', sallaSign); }).catch(function(){});
  // ---- pictures worth replacing: the hourly build looks at every store photo; this lists its findings ----
  var FLAG = {s:'المنتج صغير في الصورة', b:'المنتج مالي الصورة للحافة', l:'صورة صغيرة (مغبّشة)', g:'الخلفية مش بيضاء', w:'شعار أو علامة في الصورة'};
  var FIXED = {}; try { FIXED = JSON.parse(localStorage.getItem('ib3d-photo-fixed') || '{}'); } catch(e){}
  var markFixed = function(id){ FIXED[id] = 1; try { localStorage.setItem('ib3d-photo-fixed', JSON.stringify(FIXED)); } catch(e){} };
  var esc = function(x){ return String(x == null ? '' : x).replace(/[&<>"']/g, function(c){ return '&#' + c.charCodeAt(0) + ';'; }); };
  async function photoList(){
    var au = await fetch('../data/photo-audit.json', {cache:'no-cache'}).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
    if (!au) return null;
    var map = await getMap(), by = await getProducts(), where = {};
    ((window.PG_HOOK && window.PG_HOOK.items()) || []).forEach(function(e){ var it = e[2], id = it[8] ? String(it[8]) : null;
      if (!id){ var c = (map.ids[String(it[1]).trim().slice(0, 48)] || []).filter(function(q){ return by[q[0]]; }), b = String(it[2] || '').toLowerCase(), pk = c.find(function(q){ return q[1] === b; }) || (c.length === 1 ? c[0] : null); id = pk ? pk[0] : null; }
      if (id && !where[id]) where[id] = [e[0], e[1]]; });
    var rows = []; Object.keys(au.bad || {}).forEach(function(id){ var q = by[id], v = au.bad[id]; if (!q || FIXED[id] || q.img.slice(-24) !== v[1]) return; rows.push({id:id, name:q.name || '', img:q.img, f:v[0], at:where[id] || null}); });
    rows.sort(function(a, b){ return (b.at ? 1 : 0) - (a.at ? 1 : 0) || b.f.length - a.f.length || a.name.localeCompare(b.name, 'ar'); });
    return {rows:rows, total:au.total, checked:au.checked};
  }
  function photoPanel(){
    var old = document.getElementById('phPanel'); if (old){ old.remove(); return; }
    var box = document.createElement('div'); box.id = 'phPanel'; box.dir = 'rtl';
    box.style.cssText = 'position:fixed;inset:0;z-index:60;background:rgba(20,30,40,.45);display:flex;justify-content:center;align-items:flex-start;padding:24px 12px;font:13px/1.5 Tahoma,Arial,sans-serif';
    box.innerHTML = '<div style="background:#fff;border-radius:14px;width:min(760px,100%);max-height:calc(100vh - 48px);display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.3)">' +
      '<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #e0e6ea"><b style="font-size:15px">🖼 صور تحتاج تعديل</b><span id="phN" style="color:#607d8b"></span><button id="phX" type="button" style="margin-inline-start:auto;border:1px solid #cfd8dc;background:#fff;border-radius:8px;padding:4px 10px;cursor:pointer">إغلاق</button></div>' +
      '<div id="phF" style="display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px;border-bottom:1px solid #eef2f4"></div><div id="phL" style="overflow:auto;padding:6px 10px 12px">⏳ جاري التحميل…</div></div>';
    document.body.appendChild(box);
    box.addEventListener('click', function(e){ if (e.target === box) box.remove(); }); box.querySelector('#phX').onclick = function(){ box.remove(); };
    var L = box.querySelector('#phL'), F = box.querySelector('#phF'), on = {}, shown = 150, data = null;
    var draw = function(){ var act = Object.keys(on).filter(function(k){ return on[k]; }), rows = data.rows.filter(function(r){ return !act.length || act.some(function(k){ return r.f.indexOf(k) >= 0; }); });
      box.querySelector('#phN').textContent = rows.length + ' صورة' + (data.checked < data.total ? ' · اتفحص ' + data.checked + ' من ' + data.total + ' لحد دلوقتي' : '');
      F.innerHTML = Object.keys(FLAG).map(function(k){ var n = data.rows.filter(function(r){ return r.f.indexOf(k) >= 0; }).length; return '<button type="button" data-k="' + k + '" style="border:1px solid ' + (on[k] ? '#1565c0' : '#cfd8dc') + ';background:' + (on[k] ? '#e3f2fd' : '#fff') + ';color:#263238;border-radius:999px;padding:5px 11px;cursor:pointer;font:inherit">' + FLAG[k] + ' · ' + n + '</button>'; }).join('');
      L.innerHTML = rows.length ? rows.slice(0, shown).map(function(r){ return '<div style="display:flex;gap:10px;align-items:center;padding:7px 6px;border-bottom:1px solid #f0f3f5">' +
        '<img src="' + esc(r.img) + '" loading="lazy" width="56" height="56" style="flex:none;object-fit:contain;border:1px solid #e0e6ea;border-radius:8px;background:#fff">' +
        '<div style="min-width:0;flex:1"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(r.name) + '</div><div style="color:#b26a00;font-size:12px">' + r.f.split('').map(function(k){ return FLAG[k]; }).join(' · ') + '</div></div>' +
        (r.at ? '<button type="button" data-open="' + r.id + '" style="flex:none;border:0;background:#1565c0;color:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;font:inherit">تعديل الصورة</button>'
              : '<a href="https://s.salla.sa/products/' + r.id + '" target="_blank" rel="noopener" style="flex:none;color:#1565c0;font-size:12px">مش على رف · افتحه في سلة</a>') + '</div>'; }).join('') +
        (rows.length > shown ? '<div style="text-align:center;padding:12px"><button type="button" id="phMore" style="border:1px solid #cfd8dc;background:#fff;border-radius:8px;padding:6px 16px;cursor:pointer;font:inherit">عرض المزيد (' + (rows.length - shown) + ')</button></div>' : '')
        : '<div style="padding:24px;text-align:center;color:#607d8b">مفيش صور في القائمة دي.</div>';
      var more = L.querySelector('#phMore'); if (more) more.onclick = function(){ shown += 300; draw(); }; };
    F.onclick = function(e){ var b = e.target.closest('[data-k]'); if (b && data){ on[b.dataset.k] = !on[b.dataset.k]; shown = 150; draw(); } };
    L.onclick = function(e){ var b = e.target.closest('[data-open]'); if (!b || !data) return; var r = data.rows.find(function(x){ return x.id === b.dataset.open; }); if (r && r.at && window.PG_HOOK){ box.remove(); window.PG_HOOK.openImg(r.at[0], r.at[1]); } };
    photoList().then(function(d){ if (!d){ L.innerHTML = '<div style="padding:24px;text-align:center;color:#607d8b">الفحص لسه ما اشتغلش. بيتعمل تلقائي مع تحديث المتجر كل ساعة، جرّب بعد شوية.</div>'; return; } data = d; draw(); })
      .catch(function(){ L.innerHTML = '<div style="padding:24px;text-align:center;color:#b71c1c">تعذّر تحميل القائمة.</div>'; });
  }
  function photoButton(){ var b = document.createElement('button'); b.type = 'button'; b.textContent = '🖼 صور تحتاج تعديل';
    b.style.cssText = 'position:fixed;left:326px;bottom:12px;z-index:50;font:600 12px/1 Tahoma,Arial,sans-serif;padding:8px 12px;border-radius:999px;border:1px solid #ffb74d;background:#fff8e1;color:#e65100;cursor:pointer';
    b.onclick = photoPanel; document.body.appendChild(b); }
  ready.then(function(){ if (document.body) photoButton(); else addEventListener('DOMContentLoaded', photoButton); }).catch(function(){});

  window.PG_STORE = {
    name:'ibrand-3d', online:true,
    init:function(){ return ready.then(function(){ return true; }); },
    load:async function(){
      await ready; var r = await call('/editor');
      if (r.status === 401){ toLogin(); throw new Error('انتهت الجلسة'); }
      if (r.status === 404){ BASE = 0; var e = await fetch('empty-state.json', {cache:'no-cache'}); return e.json(); }   // nothing saved yet: the empty room; import the backup from the "ملف" menu
      if (!r.ok) throw fail(r, await r.json().catch(function(){ return null; }));
      var d = await r.json(); BASE = +d.savedAt || 0; return storePictures(await onlyOnSale(d));
    },
    save:async function(data){
      await ready;
      var r = await call('/editor?base=' + BASE, {method:'PUT', headers:{'content-type':'application/json'}, body:JSON.stringify(withoutAuto(withHidden(data)))});
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
    // under the item's name in the picture dialog: its barcode (to search for a better photo) and quick links
    info:async function(it, el){ if (!el) return; el.textContent = '';
      try { var p = await productOf(it); if (!p || p.many){ el.textContent = p && p.many ? 'في أكتر من منتج في سلة بنفس الاسم' : 'الصنف ده مش مربوط بمنتج في سلة'; return; }
        if (!skuP) skuP = fetch('../data/sku.json', {cache:'no-cache'}).then(function(r){ return r.ok ? r.json() : {}; }).catch(function(){ return {}; });
        var bc = (await skuP)[p.id] || '', q = bc || p.name || it[1], mk = function(t, h){ var a = document.createElement('a'); a.textContent = t; a.href = h; a.target = '_blank'; a.rel = 'noopener'; a.style.cssText = 'color:#1565c0;text-decoration:none;white-space:nowrap'; return a; };
        el.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;font-size:12px;margin:2px 0 8px;color:#455a64';
        if (bc){ var s1 = document.createElement('span'); s1.innerHTML = 'الباركود: <b dir="ltr" style="user-select:all;font-family:ui-monospace,Consolas,monospace;font-size:13px;color:#263238">' + esc(bc) + '</b>'; el.appendChild(s1);
          var cp = document.createElement('button'); cp.type = 'button'; cp.textContent = 'نسخ'; cp.style.cssText = 'border:1px solid #cfd8dc;background:#fff;border-radius:6px;padding:1px 8px;cursor:pointer;font:inherit';
          cp.onclick = function(){ try { navigator.clipboard.writeText(bc).then(function(){ cp.textContent = 'اتنسخ ✓'; }); } catch(e){} }; el.appendChild(cp); }
        else { var s2 = document.createElement('span'); s2.textContent = 'الباركود مش متوفر للمنتج ده'; el.appendChild(s2); }
        el.appendChild(mk('🔎 صور قوقل' + (bc ? ' بالباركود' : ' بالاسم'), 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(q)));
        if (bc && p.name) el.appendChild(mk('🔎 بالاسم', 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(p.name + ' white background')));
        el.appendChild(mk('↗ المنتج في سلة', 'https://s.salla.sa/products/' + p.id));
      } catch(e){ el.textContent = ''; } },
    // The picture dialog asks: how good is this picture for the store and the 3D pharmacy, and what will be sent?
    check:async function(name, t, el){ if (!el) return; var my = el._n = (el._n || 0) + 1;
      if (!t || !t.ref){ el.innerHTML = ''; return; }
      el.innerHTML = '<div style="font-size:12px;color:#78909c;padding:6px 0">⏳ جاري فحص الصورة…</div>';
      try {
        var c = HIREF[name] === t.ref ? await HI[name] : null, own = !!c; if (!c) c = await bigCanvas(this.imageUrl(t.ref));
        var W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data, x1 = W, y1 = H, x2 = -1, y2 = -1, ring = Math.max(2, Math.round(Math.min(W, H) * .02)), rb = 0, rn = 0;
        for (var y = 0; y < H; y++) for (var x = 0; x < W; x++){ var q = (y * W + x) * 4, white = d[q + 3] <= 20 || (d[q] >= 238 && d[q + 1] >= 238 && d[q + 2] >= 238);
          if (!white){ if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
          if (x < ring || y < ring || x >= W - ring || y >= H - ring){ rn++; if (white) rb++; } }
        if (my !== el._n) return;
        var bw = Math.max(1, x2 - x1 + 1), bh = Math.max(1, y2 - y1 + 1), big = Math.max(bw, bh), bg = rb / rn, fill = Math.max(bw / W, bh / H), edge = bg > .9 && (x1 <= 1 || y1 <= 1 || x2 >= W - 2 || y2 >= H - 2);
        var bad = [], warn = [], ok = [];
        if (bg < .75) bad.push('الخلفية مش بيضاء: اختار صورة بخلفية بيضاء صافية'); else if (bg < .95) warn.push('الخلفية مش بيضاء بالكامل (ظل أو إطار على الأطراف)'); else ok.push('خلفية بيضاء');
        if (big < 400) bad.push('المنتج صغير جداً (' + big + ' بكسل): هيبان مغبّش، دوّر على صورة أكبر'); else if (big < 800) warn.push('المنتج متوسط الوضوح (' + big + ' بكسل)، الأفضل 1000 وأكتر'); else ok.push('وضوح عالي (' + big + ' بكسل)');
        if (edge) warn.push('المنتج لازق في حافة الصورة: اتأكد إنه مش مقصوص');
        if (bg >= .75 && fill < .45) ok.push('فراغ كبير حوالين المنتج: هيتقص تلقائي عند النشر');
        if (!own) warn.push('دي صورة محفوظة بمقاس المحرر: ارفعها من جهازك عشان تتبعت لسلة بمقاسها الكامل');
        var col = bad.length ? '#c62828' : warn.length ? '#ef6c00' : '#2e7d32', word = bad.length ? 'ضعيفة' : warn.length ? 'مقبولة' : 'ممتازة', sq = squared(c), pv = document.createElement('canvas'); pv.width = pv.height = 96;
        var g = pv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 96, 96); g.drawImage(sq, 0, 0, 96, 96);
        var li = function(a, m){ return a.map(function(x){ return '<div>' + m + ' ' + x + '</div>'; }).join(''); };
        el.innerHTML = '<div style="display:flex;gap:10px;align-items:flex-start;margin-top:8px;padding:8px;border:1px solid ' + col + '55;border-radius:10px;background:' + col + '0d">' +
          '<div style="flex:none;text-align:center"><img src="' + pv.toDataURL('image/jpeg', .85) + '" width="96" height="96" style="display:block;border:1px solid #cfd8dc;border-radius:6px;background:#fff"><div style="font-size:10px;color:#607d8b;margin-top:3px">كده هتتنشر</div></div>' +
          '<div style="min-width:0;font-size:12px;line-height:1.7"><div style="font-weight:700;color:' + col + '">جودة الصورة للمتجر والصيدلية 3D: ' + word + '</div>' + li(bad, '✕') + li(warn, '⚠') + li(ok, '✓') + '</div></div>';
      } catch(e){ if (my === el._n) el.innerHTML = '<div style="font-size:12px;color:#78909c;padding:6px 0">فحص الجودة متاح للصور اللي بترفعها من جهازك.</div>'; }
    },
    // called by the picture dialog each time the picture changes (a new file, a turn, a flip)
    hiRes:function(name, src, op, ref){ var prev = HIREF[name] ? HI[name] : null, fresh = src instanceof Blob; HIREF[name] = ref || '';
      HI[name] = (fresh ? bigCanvas(src) : (prev || Promise.reject()).catch(function(){ return bigCanvas(src); }).then(function(c){ return turn(c, op); })).catch(function(){ return null; }); },
    publishToSalla:async function(it, name, t, say){
      say = say || function(m){ alert(m); };
      try { await ready;
        var p = await productOf(it);
        if (!p){ say('الصنف ده مش مربوط بمنتج في سلة'); return; }
        if (p.many){ say('في ' + p.many + ' منتجات في سلة بنفس الاسم — حط رقم المنتج في بيانات الصنف الأول'); return; }
        var c = t && t.ref && HIREF[name] === t.ref ? await HI[name] : null;   // the large copy counts only if it is of the picture now shown if (!c && t && t.ref) c = await bigCanvas(this.imageUrl(t.ref)).catch(function(){ return null; });
        if (!c){ say('اختار صورة من جهازك الأول'); return; }
        var sq = squared(c), small = sq.width < 500;
        if (!confirm('نشر الصورة في سلة؟\n\nالمنتج: ' + (p.name || name) + '\nرقم المنتج: ' + p.id + '\nمقاس الصورة: ' + sq.width + '×' + sq.height + (small ? '  ⚠ صغيرة، هتبان مش واضحة في المتجر' : '') +
          '\n\nهتبقى الصورة الرئيسية للمنتج وتظهر للعملاء على طول في الموقع والتطبيق. صور المنتج القديمة هتفضل موجودة كصور إضافية.')) return;
        say('⏳ جاري الرفع لسلة…');
        var blob = await new Promise(function(r){ sq.toBlob(r, 'image/jpeg', .92); });
        var r = await call('/salla/image/' + p.id, {method:'POST', headers:{'content-type':'image/jpeg'}, body:blob}), d = await r.json().catch(function(){ return null; });
        if (!r.ok || !d || !d.ok) throw fail(r, d);
        markFixed(String(p.id));
        say('✅ اتنشرت في سلة — هتظهر في الصيدلية خلال ساعة');
      } catch(e){ say('تعذّر النشر في سلة: ' + (e && e.message || e)); }
    },
    imageUrl:function(ref){ return !ref ? '' : /^(data:|blob:|https?:)/.test(ref) ? ref : ref.indexOf('/public/img/') === 0 ? API + ref : ''; }
  };
})();
