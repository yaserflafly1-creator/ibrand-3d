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
  var prodP = null, getProducts = function(){ if (!prodP) prodP = fetch('../data/products.json', {cache:'no-cache'}).then(function(r){ return r.json(); }).then(function(pr){ var by = {};
    Object.keys(pr.sections || {}).forEach(function(k){ (pr.sections[k].products || []).forEach(function(q){ if (q.img && !by[q.id]) by[String(q.id)] = q; }); }); return by; }); return prodP; };
  // which Salla product an editor item is: its own product number if it has one, else by its name (and brand when several share the name)
  async function productOf(it){ var map = await getMap(), by = await getProducts();
    if (it[8]) return by[String(it[8])] || {id:String(it[8]), name:''};
    var c = map.ids[String(it[1]).trim().slice(0, 48)] || [], b = String(it[2] || '').toLowerCase();
    var live = c.filter(function(q){ return by[q[0]]; }), pick = live.find(function(q){ return q[1] === b; }) || (live.length === 1 ? live[0] : null);
    return pick ? by[pick[0]] : (live.length > 1 ? {many:live.length} : null); }
  // a large copy of the picture being edited, kept only while the page is open: this is what goes to Salla
  var HI = {}, HIREF = {};
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
        say('✅ اتنشرت في سلة — هتظهر في الصيدلية خلال ساعة');
      } catch(e){ say('تعذّر النشر في سلة: ' + (e && e.message || e)); }
    },
    imageUrl:function(ref){ return !ref ? '' : /^(data:|blob:|https?:)/.test(ref) ? ref : ref.indexOf('/public/img/') === 0 ? API + ref : ''; }
  };
})();
