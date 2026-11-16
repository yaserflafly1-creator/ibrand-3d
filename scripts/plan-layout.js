//@@A
  // ---------- store plan: the branch planogram (static/plan/pg.json) ----------
  // Every gondola, stand and wall unit stands where the planogram draws it (44 x 46 m: entrance at the front centre, the
  // cashier beside it, a wide central walkway to the pharmacist counter at the back) and carries, shelf by shelf, the
  // products the planogram lists for it. Products the store sells that the planogram does not list fill spare shelf room
  // in their own department, so nothing is left out.
  const EYE = 1.6, H = 6.2;   // high ceiling, as asked for the branch
  const IMF = (window.__IMF && window.__IMF.p) || {}, CATN = (window.__IMF && window.__IMF.c) || {};
  const PGD = window.__PG && window.__PG.f ? window.__PG : {W:44, D:46.1, names:[], f:[]};
  // one brand, one place: where the drawing gives a brand two units on the same line with other units between them,
  // the second moves up beside the first and the ones between shift along (nothing else changes place)
  if (!PGD._joined){ PGD._joined = 1; const seen = {}, moved = [], own = new Map(); PGD.f.forEach(g => g.r.forEach(q => own.set(q, g)));
    PGD.f.forEach(fx => { if (!fx.b) return; const k = fx.z + '|' + fx.b, f0 = seen[k]; if (!f0){ seen[k] = fx; return; }
      for (const r1 of f0.r) for (const r2 of fx.r){
        const v = r1[3] > r1[2]; if (v !== (r2[3] > r2[2])) continue;
        const fc = v ? 0 : 1, al = v ? 1 : 0, ln = v ? 3 : 2; if (Math.abs(r1[fc] - r2[fc]) > .05) continue;
        const a = r1[al] < r2[al] ? r1 : r2, b = a === r1 ? r2 : r1, line = [];
        PGD.f.forEach(g => g.r.forEach(q => { if ((q[3] > q[2]) === v && Math.abs(q[fc] - a[fc]) < .05 && q[al] >= a[al] - .01 && q[al] <= b[al] + .01) line.push(q); }));
        line.sort((p, q) => p[al] - q[al]);
        if (line.slice(1, -1).every(q => own.get(q).b === fx.b && own.get(q).z === fx.z)) continue;   // already one run of the brand
        if (line.length < 3 || line.some((q, i) => i && Math.abs(q[al] - (line[i-1][al] + line[i-1][ln])) > .05)) continue;
        const order = [a, b].concat(line.slice(1, -1)); let at = a[al]; order.forEach(q => { q[al] = at; at += q[ln]; }); moved.push(fx.c); return;
      } });
    window.__pgJoined = moved; }
  // wider aisles than the drawing (1.6 m → 2.2 m): every block of gondolas moves outwards from the central walkway by the
  // extra width of the aisles between it and the walkway; the walls and what stands on them move with the room
  if (!PGD._wide){ PGD._wide = 1; const AE = .6, CS = 6*AE;
    PGD.f.forEach(fx => fx.r.forEach(r => { const v = r[3] > r[2];
      if (!v) r[0] += CS;                                                      // along the front or back wall, the cashier unit: stays with the entrance
      else if (fx.w) r[0] += r[0] > PGD.W/2 ? 2*CS : 0;                        // side walls
      else if (r[0] < PGD.W/2) r[0] += CS - (6 - Math.floor((r[0] - 1.9 + .05) / 2.6)) * AE;
      else r[0] += CS + Math.floor((r[0] - 25.5 + .05) / 2.6) * AE; }));
    PGD.W += 2*CS; }
  const mainKeys = SECTIONS.filter(s=>s.main).map(s=>s.key).filter(k=>SD(k));
  // departments of the planogram (its letters), each with its colour
  const ZINFO = [{key:'z_makeup', L:'B', hex:'#e0447f', old:4}, {key:'z_derma', L:'CA', hex:'#9c27b0', old:4}, {key:'z_hair', L:'D', hex:'#3f51b5', old:4}, {key:'z_care', L:'E', hex:'#0097a7', old:3},
    {key:'z_dev', L:'F', hex:'#689f38', old:2}, {key:'z_vit', L:'G', hex:'#e0a11a', old:2}, {key:'z_kids', L:'H', hex:'#ef6c00', old:0}, {key:'z_rx', L:'IJ', hex:'#c62828', old:1}];
  ZINFO.forEach(z => { const c = PGD.zones && PGD.zones[z.L[0]]; if (/^#[0-9a-f]{6}$/i.test(c || '')) z.hex = c; });   // the planogram editor's own department colours
  const SECZ = {baby:0, meds:1, vit:2, devices:2, pets:2, daily:3, other:3, skin:4, hair:4, makeup:4};
  const zoneProducts = [[], [], [], [], []];
  { // merchandising attributes per product: zone, category path, facings, display (stand / shared shelf), fixture (shelf / hook), unit (floor / wall)
    const subIdx = new Map(); let matched = 0, total = 0;
    // the plan's own photo atlas (ordered like these shelves): each zone is a set of pages, products point into it
    const PAT = window.__PAT && window.__PAT.zones && window.__PAT.at ? window.__PAT : null;
    if (PAT){ Object.keys(PAT.zones).forEach(zk => { DATA.sections[zk] = Object.assign({products: []}, PAT.zones[zk]); }); window.__skipAtlas = new Set(mainKeys); }
    ZINFO.forEach((zi, i) => { SEC['pz' + i] = SEC[zi.key]; });
    mainKeys.forEach((k, ki) => SD(k).products.forEach((p, i) => {
      const m = IMF[p.id]; p._k = k; p._o = i; total++;
      const at = PAT && PAT.at[p.id]; if (at && DATA.sections['pz' + at[0]]){ p._ak = 'pz' + at[0]; p._apg = at[1]; p._atile = at[2]; }
      if (m){ matched++; p._z = m[0]; p._s = [m[1], m[2], m[3]]; p.fc = m[4]; p._ds = m[5]; p._fx = m[6]; p._un = m[7]; }
      else { const sk = k + '|' + (p.sub || ''); let si = subIdx.get(sk); if (si === undefined){ si = subIdx.size; subIdx.set(sk, si); }
        p._z = SECZ[k] === undefined ? 3 : SECZ[k]; p._s = [900 + ki, 9000 + si, 0]; p.fc = 1; p._ds = 2; p._fx = 0; p._un = 0; }
      zoneProducts[p._z].push(p);
    }));
    window.__imfStats = {matched, total};
  }
  const GWALL = {h:2.2, d:.5, levels:[.12, .45, .78, 1.11, 1.44, 1.77]};   // wall units around the perimeter
  const sizers = {}, szOf = p => sizers[p._k] || (sizers[p._k] = sizer(p._k));
  const brandOf = p => p.brandId || p.brand || '';
  const ZCOL = ZINFO.map(z => { const c = new THREE.Color(z.hex); const cl = c.clone().convertSRGBToLinear(); return {hex:z.hex, c:[cl.r, cl.g, cl.b], hi:'#' + c.clone().lerp(new THREE.Color('#ffffff'), .3).getHexString(), lo:'#' + c.clone().lerp(new THREE.Color('#000000'), .25).getHexString()}; });
  const Z = ZINFO.map((zi, id) => ({id, key:zi.key, zc:ZCOL[id], old:zi.old}));
  const zidOf = L => { const i = ZINFO.findIndex(z => z.L.includes(L)); return i < 0 ? 3 : i; };
  // the room, from the drawing (metres; x across, z from the glass front back to the wall behind the counter)
  const SP = 3.4, AISLE_W = 1.6, ROW_T = 2*GONDOLA.d, WALL_D = GWALL.d;
  const Wx = PGD.W/2 + .02, zF = 0, zB = -PGD.D - .02, zC = zB + 2.7, zR0 = zF - 6.2, ZP = zF - 8.6;
  const zA0 = zR0, zA1 = zC + 5.4, nA = 14, nb = 6, L = zA0 - zA1, innerW = 2*Wx, plans = {}, PLAN = {}, NL = 4, NC = 14, NBX = 6;
  const totalBays = PGD.f.reduce((a, f) => a + f.r.reduce((c, r) => c + Math.round(Math.max(r[2], r[3])), 0), 0);
  const ROOM = {x:Wx, zBack:zB, zFront:zF, h:H};
  const fw = 2*Wx, fl = zF - zB, zMid = (zF + zB)/2;

//@@R2
  // ---------- stand every fixture where the planogram puts it ----------
  const SEG = [];
  const pid = new Map(); mainKeys.forEach(k => SD(k).products.forEach(p => { const id = String(p.id); if (!pid.has(id)) pid.set(id, p); }));
  { const listed = new Set(); PGD.f.forEach(f => f.it.forEach(i => listed.add(i[1])));
    // sold in the store but not in the planogram: kept by department (category order), to fill spare shelf room
    const KZ = {makeup:0, skin:1, hair:2, daily:3, other:3, devices:4, pets:4, vit:5, baby:6, meds:7};
    Z.forEach(z => { z.left = []; z.runs = []; });
    pid.forEach((p, id) => { if (!listed.has(id)) Z[KZ[p._k] === undefined ? 3 : KZ[p._k]].left.push(p); });
    Z.forEach(z => z.left.sort((a, b) => (a._s[0] - b._s[0]) || (a._s[1] - b._s[1]) || (a._s[2] - b._s[2]) || (brandOf(a) < brandOf(b) ? -1 : brandOf(a) > brandOf(b) ? 1 : 0)));
    window.__pgStats = {fixtures:PGD.f.length, listed:listed.size, extra:Z.reduce((a, z) => a + z.left.length, 0), dropped:0}; }
  // One fixture: n modules of 1 m, shelves top to bottom as in the planogram. Each shelf starts with its own products in
  // the planogram's order and with its facings; what does not fit runs on to the shelf below; a shelf with room to spare
  // takes extra products of the department, then more facings of its own. Fewer facings, then slightly smaller packs,
  // are tried until nothing of the fixture is left over.
  const normB = s => String(s || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g, '');
  function pgBays(fx, n, G, z, phase, lim){
    const shelves = shelvesOf(G), rows = shelves.map(() => []);
    fx.it.forEach(i => { const p = pid.get(i[1]); if (p && i[0] >= 1 && !(fx._skip && fx._skip.has(p))) rows[Math.min(shelves.length, i[0]) - 1].push({p, fc:i[2], c:i[3], sw:i[4] > 0 ? i[4] / Math.max(1, i[2]) / 100 : 0}); });
    const own = rows.flat();
    const run = (cap, ks, fin) => {
      const bays = []; for (let b = 0; b < n; b++) bays.push({items:[], hdr:null, kind:fx.k || 0, cats:{}});
      let carry = []; const tk = new Set(), fb = fx.b ? normB(fx.b) : '';
      for (let k = 0; k < shelves.length; k++){
        const sh = shelves[k], list = carry.concat(rows[k]); carry = [];
        let x = list.length && list[0].sw ? 0 : .015, full = false;
        // a product the planogram gives a width to takes exactly that much of the shelf (so a shelf holds what the planogram
        // says it holds); its pack is drawn as large as fits inside that slot
        const slot = o => { const b = szOf(o.p)(o.p, sh.maxH, 1), k = Math.max(.3, Math.min(1.5, (o.sw - .004) / b[0], sh.maxH / b[1])); let bi = Math.floor((x + 1e-6) / BW);
          if (x + o.sw > (bi + 1)*BW + .003){ bi++; x = bi*BW; }
          if (bi >= n || x + o.sw > n*BW + .003) return false;
          bays[bi].items.push({p:o.p, x:x - bi*BW + o.sw/2, s:k0, y:sh.y, w:b[0]*k, h:b[1]*k, d:b[2]*Math.min(1, k), yaw:(Math.random()-.5)*.05, back:Math.random()*.006, first:o._first});
          if (o.c >= 0) bays[bi].cats[o.c] = (bays[bi].cats[o.c] || 0) + o.sw; x += o.sw; return true; };
        const k0 = k;
        const put = (o, first) => { if (o.sw){ o._first = first; return slot(o); } const [w, h, d] = szOf(o.p)(o.p, sh.maxH, ks); let bi = Math.floor(x / BW);
          if (x + w > (bi + 1)*BW - .01){ bi++; x = bi*BW + .015; }
          if (bi >= n || x + w > n*BW - .01) return false;
          const b = bays[bi]; b.items.push({p:o.p, x:x - bi*BW + w/2, s:k, y:sh.y, w, h, d, yaw:(Math.random()-.5)*.07, back:Math.random() < .14 ? .015 + Math.random()*.03 : Math.random()*.006, first});
          if (o.c >= 0) b.cats[o.c] = (b.cats[o.c] || 0) + w;
          x += w + .004 + Math.random()*.004; return true; };
        for (let i = 0; i < list.length; i++){
          const o = list[i], w0 = szOf(o.p)(o.p, sh.maxH, ks)[0], f = o.sw ? (o.fc || 1) : Math.min(cap, Math.max(o.fc || 1, w0 < .075 ? 2 : 1));
          let placed = 0; for (let j = 0; j < f; j++){ if (!put(o, j === 0)){ full = true; break; } placed++; }
          if (full){ carry = list.slice(placed ? i + 1 : i); break; }
          if (!o.sw) x += .009 + Math.random()*.008;
        }
        if (full) continue;
        // room to spare: products of the department the planogram does not list (each once), then more of this shelf
        // (an extra product only joins a shelf of its own category or its own brand's stand; one with no such shelf anywhere in
        //  the department may take spare room on a shared shelf)
        // a fixture with none of its own range in the online store (the prescription wall, a brand not sold online) shows the department's range
        const rep = list.length ? list : own.length ? own : (z.pool || []); let g = 0, j = own.length || !z.pool ? 0 : (fx._po + k*17) % Math.max(1, z.pool.length), more = fin, miss = 0;
        const cats = new Set(); list.forEach(o => { if (o.c >= 0) cats.add(PGD.names[o.c]); });
        let strict = true;
        const next = () => {
          if (strict){ for (const p of z.left){ if (tk.has(p)) continue; const cn = CATN[p._s[1]]; if ((cn && cats.has(cn)) || (fb && normB(p.brand) === fb)) return p; } strict = false; }
          if (z.loose) for (const p of z.left){ if (tk.has(p)) continue;
            if (z.loose === 4 || (z.loose === 3 && !fx.b) || (!z.home.has(p) && (z.loose === 2 || !fx.b))) return p; }
          return null; };
        while (g++ < 260){
          let o = null, extra = false;
          if (more){ const p = next(); if (p){ o = {p, c:-1}; extra = true; } else more = false; }
          if (!o){ if (rep.length) o = rep[j++ % rep.length]; else break; }
          if (!put(o, extra)){ if (extra || ++miss > 3) break; continue; }   // too wide for what is left: try the next few before giving the shelf up
          if (extra) tk.add(o.p); if (!o.sw) x += .009 + Math.random()*.008;
        }
      }
      return {bays, dropped:carry.length, tk, carry};
    };
    if (!phase){   // first pass: how tightly this fixture has to be packed; what it still cannot hold moves to the department's spare range
      let res = null, mode = null;
      for (mode of [[4, 1], [2, 1], [1, 1], [1, .9], [1, .82], [1, .74], [1, .66], [1, .58], [1, .5]].filter(m => m[0] <= lim[0] && m[1] <= lim[1])){ res = run(mode[0], mode[1], false); if (!res.dropped) break; }
      fx._mode = mode; if (res.dropped){ fx._skip = new Set(res.carry.map(o => o.p)); fx._skip.forEach(p => z.left.push(p)); }
      return null;
    }
    const res = run(fx._mode[0], fx._mode[1], true);
    if (res.dropped) res.carry.forEach(o => z.left.push(o.p));
    if (res.tk.size) z.left = z.left.filter(p => !res.tk.has(p));
    const lead = own[0] && own[0].p, bid = lead ? (lead.brandId || lead.brand) : undefined;
    res.bays.forEach((b, bi) => {
      if (fx.b && own.length) b.hdr = {id:'pg:' + fx.c, brandId:bid, name:fx.b, big:true};
      else { let top = -1, tw = 0; Object.keys(b.cats).forEach(c => { if (b.cats[c] > tw){ tw = b.cats[c]; top = +c; } });
        b.hdr = {id:'pg:' + fx.c + ':' + bi, label:(top >= 0 ? PGD.names[top] : PGD.names[fx.l]) || SEC[z.key].name, big:false}; }
    });
    return res.bays;
  }
  {
    const rects = []; PGD.f.forEach(fx => fx.r.forEach(r => rects.push(r)));
    const touch = (r, end) => { const v = r[3] >= r[2]; return rects.some(q => q !== r && (v ? Math.abs(q[0] - r[0]) < .05 && Math.abs(q[2] - r[2]) < .05 && Math.abs(end ? q[1] - (r[1] + r[3]) : q[1] + q[3] - r[1]) < .05
      : Math.abs(q[1] - r[1]) < .05 && Math.abs(q[3] - r[3]) < .05 && Math.abs(end ? q[0] - (r[0] + r[2]) : q[0] + q[2] - r[0]) < .05)); };
    // the back wall first: it has nothing of its own in the online store, so it takes the department's extra range
    const order = PGD.f.slice().sort((a, b) => (b.f === 'WB') - (a.f === 'WB')), modsOf = fx => fx.r.map(r => Math.max(1, Math.round(Math.max(r[2], r[3]))));
    const cmp = (a, b) => (a._s[0] - b._s[0]) || (a._s[1] - b._s[1]) || (a._s[2] - b._s[2]) || (brandOf(a) < brandOf(b) ? -1 : brandOf(a) > brandOf(b) ? 1 : 0);
    // department by department: with the planogram's facings first; if that leaves products of the department without a
    // place, again with fewer facings, then with slightly smaller packs, until everything it sells is on a shelf
    Z.forEach(z => {
      const fxs = order.filter(fx => zidOf(fx.z) === z.id), base = z.left.slice(), nOf = fx => modsOf(fx).reduce((a, c) => a + c, 0), GOf = fx => fx.w ? GWALL : GONDOLA;
      // extras that have a shelf of their own category, or their brand's stand, somewhere in the department wait for it
      const zc = new Set(), zb = new Set(); fxs.forEach(fx => { if (fx.b) zb.add(normB(fx.b)); fx.it.forEach(i => { if (i[3] >= 0) zc.add(PGD.names[i[3]]); }); });
      const homed = p => { const cn = CATN[p._s[1]]; return (cn && zc.has(cn)) || zb.has(normB(p.brand)); };
      z.pool = []; fxs.forEach((fx, fi) => { fx._po = fi*53; fx.it.forEach(i => { const p = pid.get(i[1]); if (p) z.pool.push({p, c:i[3]}); }); });
      const attempt = (lim, loose) => { z.loose = loose; z.left = base.slice(); fxs.forEach(fx => { fx._skip = null; pgBays(fx, nOf(fx), GOf(fx), z, 0, lim); }); z.left.sort(cmp);
        z.home = new Set(z.left.filter(homed)); fxs.forEach(fx => { fx._bays = pgBays(fx, nOf(fx), GOf(fx), z, 1); }); z.lim = lim.concat(loose); return !z.left.length; };
      // 0: only its own category's shelf or its brand's stand · 1: one with no such shelf may use a shared shelf · 2: or any stand
      // 3: shared shelves take whatever of the department is still waiting · 4: so does every stand. Facings are cut before packs are made smaller.
      const F3 = [[4, 1], [2, 1], [1, 1]]; let ok = false;
      for (const lim of F3){ for (let lv = 0; lv < 3 && !ok; lv++) ok = attempt(lim, lv); if (ok) break; }
      for (let lv = 3; lv < 5 && !ok; lv++) for (const lim of F3){ if ((ok = attempt(lim, lv))) break; }
      if (!ok) for (const lim of [[1, .9], [1, .82], [1, .74], [1, .66], [1, .58], [1, .5]]){ if ((ok = attempt(lim, 4))) break; }
    });
    window.__pgStats.byZone = Z.map(z => z.key + ' ' + z.lim.join('/') + ' left ' + z.left.length);
    order.forEach(fx => {
      const zid = zidOf(fx.z), z = Z[zid], G = fx.w ? GWALL : GONDOLA;
      const mods = modsOf(fx), bays = fx._bays; let o = 0;
      fx.r.forEach((r, ri) => {
        const v = r[3] > r[2], cx = r[0] + r[2]/2 - PGD.W/2, cz = r[1] + r[3]/2 - PGD.D;
        const yaw = fx.w ? (v ? (cx < 0 ? Math.PI/2 : -Math.PI/2) : (cz > -PGD.D/2 ? Math.PI : 0)) : (!v ? 0 : fx.f === 'B' ? Math.PI/2 : -Math.PI/2);
        const run = bays.slice(o, o + mods[ri]); o += mods[ri];
        gondolaFace(frame(cx, cz, yaw), run, z.key, {G, zc:z.zc, endPanels: !touch(r, 0) && !touch(r, 1)});
        if (!fx.w && v) z.runs.push({x0:cx - .25, x1:cx + .25, zf:cz + r[3]/2, zb:cz - r[3]/2, row:Math.round((-cz - 9.2) / 8.4)});
      });
    });
    window.__pgStats.unplaced = Z.reduce((a, z) => a + z.left.length, 0);
    // each department's stretches of floor, row by row (for its signs and where its button takes you)
    Z.forEach(z => { const by = {}; z.runs.forEach(r => (by[r.row] || (by[r.row] = [])).push(r));
      Object.keys(by).forEach(row => { const a = by[row].sort((p, q) => p.x0 - q.x0); let cur = null;
        a.forEach(r => { if (cur && r.x0 - cur.x1 < 3.2){ cur.x1 = Math.max(cur.x1, r.x1); cur.zf = Math.max(cur.zf, r.zf); cur.zb = Math.min(cur.zb, r.zb); } else { cur = {zid:z.id, x0:r.x0, x1:r.x1, zf:r.zf, zb:r.zb}; SEG.push(cur); } }); }); });
  }

  // ---------- pharmacist counter (far end of the central walkway; the prescription shelves stand behind it) ----------
  const deskW = 17.4;
  {
    const F = frame(0, zC - .45, 0), T = STRUCT, C_TEAL = rgb('#14a3b5');
    boxInto(T, F, 0, .5, 0, deskW, 1.0, .9, '#ffffff');
    boxInto(T, F, 0, .45, .452, deskW + .02, .5, .01, C_TEAL);
    boxInto(T, F, 0, 1.025, 0, deskW + .2, .05, 1.05, '#efe9ec');
    OBSTACLES.push({box:{x0:-deskW/2 - .5, x1:deskW/2 + .5, z0:zB - 1, z1:zC + .35}});
    [-deskW/2 + .5, -2.4, 2.4, deskW/2 - .5].forEach(x => { boxInto(T, frame(x, zC - .6, 0), 0, 1.17, 0, .06, .25, .06, C_UPRIGHT); boxInto(T, frame(x, zC - .62, 0), 0, 1.38, 0, .42, .28, .03, '#1b1b1f'); });
    const disc = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, .08), std('#ffffff',{roughness:.3})); disc.position.set(-1.2, 3.55, zB + .06); scene.add(disc);
    const logo = logoPlane(1.04, 1.04); logo.position.set(-1.2, 3.55, zB + .11); scene.add(logo);
    const crossMat = new THREE.MeshBasicMaterial({color:TEAL, toneMapped:false});
    [[.22,.68],[.68,.22]].forEach(([w,h])=>{ const c = new THREE.Mesh(new THREE.BoxGeometry(w,h,.06), crossMat); c.position.set(1.2, 3.55, zB + .1); scene.add(c); });
    scene.userData.cross = crossMat;
    const sign = lightbox('استشر الصيدلي', 3, {bg:TEAL, fg:'#ffffff', bar:'#ffffff'}); hang(sign, 0, 3.2, zC - .2, 1.2);
    sign.userData.svc = true; svcTargets.push(sign);
    spotAt(-deskW/4, zC - 1.2, 1, .8); spotAt(deskW/4, zC - 1.2, 1, .8);
  }
  // ---------- the cashier, beside the entrance as in the drawing ----------
  {
    const F = frame(6.9, zF - 3.4, 0);
    boxInto(STRUCT, F, 0, .5, 0, 2.2, 1.0, 1.0, '#ffffff'); boxInto(STRUCT, F, 0, .45, .502, 2.22, .5, .01, C_PINK); boxInto(STRUCT, F, 0, 1.025, 0, 2.36, .05, 1.12, '#efe9ec');
    boxInto(STRUCT, frame(6.4, zF - 3.5, 0), 0, 1.2, 0, .42, .28, .03, '#1b1b1f'); boxInto(STRUCT, frame(6.4, zF - 3.5, 0), 0, 1.09, 0, .06, .1, .06, C_UPRIGHT);
    OBSTACLES.push({box:{x0:5.5, x1:8.3, z0:zF - 4.2, z1:zF - 2.6}});
    const s = lightbox('الكاشير', 1.7, {bg:PLUM, fg:'#ffffff'}); hang(s, 6.9, 3.0, zF - 3.4, .8);
  }

//@@R3
  // ---------- quick-grab racks beside the counter ----------
  const QG = {h:1.45, d:.42, levels:[.12, .45, .78, 1.11]};
  if (SD('quick')){
    const qp = planogram('quick', SD('quick').products, QG, {cycle:true, maxBays:2, noBrands:true});
    [-1,1].forEach((s, i) => { const bays = qp.slice(i, i+1); gondolaFace(frame(s*(SP - .75), zC + 1.3, 0), bays.length ? bays : [null], 'quick', {G:QG, titleKey:'quick'}); });
    SEC.quick.focus = {pos:new THREE.Vector3(SP - .75, EYE, zC + 3.4), target:new THREE.Vector3(SP - .75, 1.0, zC + 1.3)};
  }

  // ---------- cross-sell stands down the central walkway ----------
  const PG = {h:1.6, d:.45, levels:[.12, .5, .88, 1.26]};
  const PROMO_BAYS = 3;
  function promoIsland(key, x, z){
    if (!SD(key)) return;
    const bays = planogram(key, SD(key).products, PG, {cycle:true, maxBays:PROMO_BAYS*2, noBrands:true});
    const half = PG.d/2 + .02;
    gondolaFace(frame(x + half, z, Math.PI/2), bays.slice(0, PROMO_BAYS), key, {G:PG, titleKey:key});
    gondolaFace(frame(x - half, z, -Math.PI/2), bays.slice(PROMO_BAYS).length ? bays.slice(PROMO_BAYS) : bays.slice(0, PROMO_BAYS), key, {G:PG, titleKey:key});
    const ttl = SEASON && key === 'offers' ? SEASON.line : SEC[key].name;
    const s1 = lightbox(ttl, 2.2, {bg:PINK, fg:'#ffffff'}); hang(s1, x, 3.1, z + PROMO_BAYS*BW/2 + .1, .9);
    s1.userData.nav = key; navTargets.push(s1);
    const s2 = lightbox(ttl, 2.2, {bg:PINK, fg:'#ffffff'}); hang(s2, x, 3.1, z + PROMO_BAYS*BW/2 + .08, .9, Math.PI);
    s2.userData.nav = key; navTargets.push(s2);
    SEC[key].focus = {pos:new THREE.Vector3(x + 2.3, EYE, z + 2.6), target:new THREE.Vector3(x + .5, 1.0, z)};
    spotAt(x, z, .6, .7, .5);
  }
  {
    // down the middle of the central walkway (7 m wide in the drawing); which islands, and in what order, is set in the control panel
    ((CFG().promo && Array.isArray(CFG().promo.order)) ? CFG().promo.order : ['offers', 'excl', 'trend', 'import']).filter(k => ['offers', 'excl', 'trend', 'import'].includes(k) && SD(k)).slice(0, 4).forEach((k, i) => promoIsland(k, 0, zF - 12.7 - i*5.6));
  }
  // milk bundle table and the best-seller tower
  if (SD('milk') && !(CFG().promo && CFG().promo.milk === false)){
    const x = 0, z = zF - 3.6, Fm = frame(x, z, 0), Fb = frame(x, z, Math.PI);
    boxInto(STRUCT, Fm, 0, .36, 0, 2.6, .72, 1.3, C_PINK); boxInto(STRUCT, Fm, 0, .74, 0, 2.7, .04, 1.4, '#ffffff');
    boxInto(STRUCT, Fm, 0, .9, 0, 1.8, .3, .62, '#ffffff'); boxInto(STRUCT, Fm, 0, 1.2, 0, 1.0, .3, .4, '#ffffff');
    const size = sizer('milk'), P = SD('milk').products; let i = 0;
    [[-1.25, 1.25, .76, .52, .36], [-.85, .85, 1.05, .2, .3], [-.45, .45, 1.35, .12, .28]].forEach(([x0, x1, y, zz, mh]) => {
      [Fm, Fb].forEach(F => { let xx = x0; while (true){ const p = P[i % P.length], [w,h,d0] = size(p, mh, 1.05), d = Math.min(d0, zz - .03); if (xx + w > x1) break; putProduct('milk', F, xx + w/2, y, zz, w, h, Math.max(.02, d), p, 1); xx += w + .01; i++; } });
    });
    OBSTACLES.push({box:{x0:x-1.7, x1:x+1.7, z0:z-1.1, z1:z+1.1}});
    const s = lightbox(SEC.milk.name, 2.4, {bg:PINK, fg:'#ffffff'}); hang(s, x, 3.1, z, 1);
    s.userData.nav = 'milk'; navTargets.push(s);
    SEC.milk.focus = {pos:new THREE.Vector3(x + .3, EYE, z + 3), target:new THREE.Vector3(x, 1, z)};
  }
  if (SD('best') && !(CFG().promo && CFG().promo.best === false)){
    const x = 0, z = ZP, g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    [[1.35,.4],[1.0,.8],[.62,1.18]].forEach(([r,y],i)=>{
      const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .4, 48), i===0 ? pinkMat : std('#ffffff',{roughness:.35})); t.position.y = y-.2; t.castShadow = t.receiveShadow = true; g.add(t);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r, .012, 6, 64), steelMat); rim.rotation.x = Math.PI/2; rim.position.y = y; g.add(rim);
    });
    const size = sizer('best'), P = SD('best').products; let i = 0;
    [[1.2,.4,28,.36],[.86,.8,20,.34],[.48,1.18,11,.32]].forEach(([r,y,n,mh])=>{
      for (let k=0;k<n;k++){ const ang = k/n*Math.PI*2, p = P[i++ % P.length], [w,h,d] = size(p, mh), yaw = Math.atan2(Math.cos(ang), Math.sin(ang));
        const F = frame(x + Math.cos(ang)*r, z + Math.sin(ang)*r, yaw); putProduct('best', F, 0, y, 0, w, h, d, p, 1); }
    });
    const sign = lightbox('الأكثر طلباً ★', 2.4, {bg:PLUM, fg:'#ffffff'}); sign.position.set(0, 2.2, 0); g.add(sign);
    sign.userData.nav = 'best'; navTargets.push(sign);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.85,10), steelMat); pole.position.set(0,1.7,0); g.add(pole);
    scene.userData.spin = sign;
    OBSTACLES.push({x, z, r:1.4});
    SEC.best.focus = {pos:new THREE.Vector3(x + 2.5, EYE, z + 3.5), target:new THREE.Vector3(x, 1.0, z)};
  }

//@@R4
  // ---------- department identity: a sign over every stretch of a department, its name on the floor in front ----------
  SEG.forEach(sg => {
    const z = Z[sg.zid], sec = SEC[z.key], xc = (sg.x0 + sg.x1)/2, wd = Math.min(3.0, Math.max(1.9, sg.x1 - sg.x0 + 1.4));
    if (!z.signTex) z.signTex = canvasTex(1024, 300, (x, W, Hh) => {
      const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, z.zc.lo); g.addColorStop(.5, z.zc.hex); g.addColorStop(1, z.zc.lo); x.fillStyle = g; x.fillRect(0, 0, W, Hh);
      x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(0, Hh-12, W, 12);
      x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; fitText(x, sec.name, W - 110, 800, 124); x.fillText(sec.name, W/2, 116);
      x.direction = 'ltr'; x.font = '700 56px Arial, sans-serif'; x.globalAlpha = .92; x.fillText(sec.en || '', W/2, 232); x.globalAlpha = 1;
    });
    if (!z.signMat){ const face = new THREE.MeshBasicMaterial({map:z.signTex, toneMapped:false}), side = std(z.zc.hex); z.signMat = [side,side,side,side,face,face]; }
    const box = new THREE.Mesh(new THREE.BoxGeometry(wd, wd*300/1024, .1), z.signMat);
    hang(box, xc, 3.35, sg.zf + .75, .9);
    box.userData.nav = z.key; navTargets.push(box);
    // its button takes you to the stretch nearest the entrance
    if (!sec.focus || sg.zf > sec.focusZ){ sec.focusZ = sg.zf; sec.focus = {pos:new THREE.Vector3(xc, EYE, sg.zf + 2.1), target:new THREE.Vector3(xc, 1.25, sg.zf - 2.5)}; }
    if (!z.floorTex) z.floorTex = canvasTex(1024, 256, (x, W, Hh) => { x.clearRect(0, 0, W, Hh); x.fillStyle = z.zc.lo; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; fitText(x, sec.name, W - 60, 800, 150); x.fillText(sec.name, W/2, 104);
      x.direction = 'ltr'; x.font = '700 50px Arial, sans-serif'; x.globalAlpha = .8; x.fillText((sec.en || '').toUpperCase(), W/2, 210); x.globalAlpha = 1; });
    if (!z.floorMat) z.floorMat = new THREE.MeshBasicMaterial({map:z.floorTex, transparent:true, depthWrite:false, toneMapped:false, opacity:.85});
    const tw = Math.min(4.4, Math.max(2.2, sg.x1 - sg.x0 + .8)), fm = new THREE.Mesh(new THREE.PlaneGeometry(tw, tw/4), z.floorMat);
    fm.rotation.x = -Math.PI/2; fm.position.set(xc, .009, sg.zf + 1.25); fm.renderOrder = 1; scene.add(fm);
  });
  SEC.z_rx.focus = {pos:new THREE.Vector3(0, EYE, zC + 3.2), target:new THREE.Vector3(0, 1.5, zB)};

  // ---------- the lost treasure: one chest a day, hidden at the far end of an aisle; finding it shows the prize ----------
  // The prize code is the store's own coupon (made in the store's dashboard); with no code set, the find is only congratulated.
  const TCFG = CFG().treasure || {}, TREASURE = {code:String(TCFG.code || ''), note:TCFG.note === undefined ? 'استخدم الكود عند إتمام الطلب.' : String(TCFG.note)};
  if (SEG.length && TCFG.on !== false){
    const day = new Date(Date.now() + 3*3600e3).toISOString().slice(0, 10); let hsh = 7; for (const ch of day) hsh = (hsh*31 + ch.charCodeAt(0)) >>> 0;
    const spots = SEG.map(sg => ({zid:sg.zid, x:sg.x0 + .25, z:sg.zb - .6})).filter(s => !blockedGround(s.x, s.z) && s.z > zC + 2);
    const spot = spots[hsh % Math.max(1, spots.length)];
    if (spot){
      const g = new THREE.Group(), wood = std('#6b3f17', {roughness:.7}), gold = std('#e0a400', {roughness:.35, metalness:.3});
      const body = new THREE.Mesh(new THREE.BoxGeometry(.44, .24, .3), wood); body.position.y = .12; g.add(body);
      const lid = new THREE.Group(), lidM = new THREE.Mesh(new THREE.BoxGeometry(.46, .1, .32), wood); lidM.position.set(0, .05, .16); lid.add(lidM); lid.position.set(0, .24, -.16); g.add(lid);
      [-.15, .15].forEach(x => { const b = new THREE.Mesh(new THREE.BoxGeometry(.04, .25, .31), gold); b.position.set(x, .12, 0); g.add(b); const t = new THREE.Mesh(new THREE.BoxGeometry(.04, .11, .33), gold); t.position.set(x, .05, .16); lid.add(t); });
      const lock = new THREE.Mesh(new THREE.BoxGeometry(.07, .08, .02), gold); lock.position.set(0, .2, .16); g.add(lock);
      const ring = new THREE.Mesh(new THREE.RingGeometry(.34, .46, 40), new THREE.MeshBasicMaterial({color:0xf2c14e, transparent:true, opacity:.55, depthWrite:false, toneMapped:false, side:THREE.DoubleSide})); ring.rotation.x = -Math.PI/2; ring.position.y = .012; g.add(ring);
      g.position.set(spot.x, 0, spot.z); g.rotation.y = Math.PI; scene.add(g);
      const css = document.createElement('style'); css.textContent = '.trBtn{position:fixed;z-index:5;right:max(18px, env(safe-area-inset-right,0px));bottom:calc(env(safe-area-inset-bottom,0px) + 136px);width:46px;height:46px;border-radius:50%;border:1px solid var(--line);background:rgba(255,255,255,.92);color:#b8860b;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 16px rgba(59,29,54,.14)}.trBtn.done{color:#1f9a55}body.sheet .trBtn{display:none}'
        + '.trBox{position:fixed;z-index:40;left:50%;top:50%;transform:translate(-50%,-50%);width:min(380px,calc(100vw - 32px));background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px 20px 18px;box-shadow:0 24px 60px rgba(60,20,50,.35);direction:rtl;font-family:var(--font);text-align:center}.trBox b{display:block;font-size:21px;font-weight:800;color:var(--plum);margin-bottom:6px}.trBox p{margin:0 0 12px;font-size:15px;line-height:1.8;color:var(--muted)}'
        + '.trCode{font:800 24px Arial,sans-serif;letter-spacing:2px;direction:ltr;border:2px dashed #f2c14e;border-radius:12px;padding:10px;margin:0 0 12px;color:var(--plum);user-select:all}.trRow{display:flex;gap:10px;justify-content:center}.trRow button{border:0;border-radius:12px;padding:10px 18px;font:800 15px var(--font);cursor:pointer}.trCopy{background:var(--pink);color:#fff}.trClose{background:#f3eef2;color:var(--plum)}';
      document.head.appendChild(css);
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'trBtn'; btn.setAttribute('aria-label', 'الكنز المفقود');
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M3 11V8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v3"/><rect x="3" y="11" width="18" height="9" rx="1.5"/><path d="M12 11v4M10.5 15h3"/></svg>';
      document.body.appendChild(btn);
      let found = store.get('ib3d-treasure', '') === day, box = null;
      const open = () => { lid.rotation.x = -1.15; ring.visible = false; btn.classList.add('done'); };
      const show = () => { if (box) box.remove(); box = document.createElement('div'); box.className = 'trBox'; box.setAttribute('role', 'dialog');
        const t = document.createElement('b'); t.textContent = 'مبروك! لقيت كنز اليوم'; box.appendChild(t);
        const p = document.createElement('p'); p.textContent = TREASURE.code ? 'هذا كود جائزتك:' : 'وصلت للكنز المخفي في الصيدلية.'; box.appendChild(p);
        const row = document.createElement('div'); row.className = 'trRow';
        if (TREASURE.code){ const c = document.createElement('div'); c.className = 'trCode'; c.textContent = TREASURE.code; box.appendChild(c);
          if (TREASURE.note){ const n = document.createElement('p'); n.textContent = TREASURE.note; box.appendChild(n); }
          const cp = document.createElement('button'); cp.type = 'button'; cp.className = 'trCopy'; cp.textContent = 'انسخ الكود';
          cp.onclick = () => { const done = () => { cp.textContent = 'تم النسخ'; }; try { navigator.clipboard.writeText(TREASURE.code).then(done, () => { const r = document.createRange(); r.selectNodeContents(c); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }); } catch(e){} }; row.appendChild(cp); }
        const cl = document.createElement('button'); cl.type = 'button'; cl.className = 'trClose'; cl.textContent = 'إغلاق'; cl.onclick = () => { box.remove(); box = null; }; row.appendChild(cl);
        box.appendChild(row); document.body.appendChild(box); };
      if (found) open();
      btn.addEventListener('click', () => { btn.blur(); if (found) show(); else toast('كنز اليوم مخفي في قسم «' + SEC[Z[spot.zid].key].name + '»… دوّر عند نهاية الممرات'); });
      let ph = 0;
      setInterval(() => { if (document.hidden) return;
        if (!found){ ph += .35; const s = 1 + Math.sin(ph)*.12; ring.scale.set(s, s, 1); ring.material.opacity = .4 + Math.sin(ph)*.18;
          if (Math.hypot(camera.position.x - spot.x, camera.position.z - spot.z) < 1.5 && camera.position.y < 2.4){ found = true; store.set('ib3d-treasure', day); open(); try { sfx.add(); } catch(e){} show(); } }
      }, 120);
      window.__treasure = {x:spot.x, z:spot.z, zone:Z[spot.zid].key, spots:spots.length};
    }
  }

  // ---------- soft shading on the floor, worked out from where the shelving really stands ----------
  // (the look of the Blender render: every unit sits in a soft pool of shade, the open floor stays bright; one small texture, no per-frame cost)
  {
    const TW = 1024, TH = 1024, x0f = -fw/2, z0f = zMid - fl/2, kx = TW/fw, kz = TH/fl;
    const shade = canvasTex(TW, TH, (x, W, Hh) => {
      x.clearRect(0, 0, W, Hh);
      // blur = draw the footprints small, then stretch them back up (works on every phone browser)
      const cast = (div, alpha, grow) => { const c2 = document.createElement('canvas'); c2.width = Math.round(W / div); c2.height = Math.round(Hh / div);
        const y = c2.getContext('2d'), sx = c2.width / fw, sz = c2.height / fl; y.fillStyle = 'rgba(24,14,22,' + alpha + ')';
        OBSTACLES.forEach(o => { if (!o.fh) return; const b = o.box, ax = b.x0 + .35 - grow, bx = b.x1 - .35 + grow, az = b.z0 + .35 - grow, bz = b.z1 - .35 + grow;
          y.fillRect((ax - x0f) * sx, (az - z0f) * sz, (bx - ax) * sx, (bz - az) * sz); });
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(c2, 0, 0, W, Hh); };
      cast(14, .13, .3);                                             // wide, faint: the unit blocks light from the ceiling
      cast(6, .3, .08);                                               // tight, darker: contact shade at its foot
      // the walls shade the edge of the floor
      const edge = (gx0, gy0, gx1, gy1, rx, ry, rw, rh) => { const g = x.createLinearGradient(gx0, gy0, gx1, gy1); g.addColorStop(0, 'rgba(24,14,22,.2)'); g.addColorStop(1, 'rgba(24,14,22,0)'); x.fillStyle = g; x.fillRect(rx, ry, rw, rh); };
      const ex = 1.6 * kx, ez = 1.6 * kz, wx0 = (-Wx - x0f) * kx, wx1 = (Wx - x0f) * kx, wz0 = (zB - z0f) * kz;
      edge(wx0, 0, wx0 + ex, 0, wx0, 0, ex, Hh); edge(wx1, 0, wx1 - ex, 0, wx1 - ex, 0, ex, Hh); edge(0, wz0, 0, wz0 + ez, 0, wz0, W, ez);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(fw, fl), new THREE.MeshBasicMaterial({map:shade, transparent:true, depthWrite:false, toneMapped:false, polygonOffset:true, polygonOffsetFactor:-1}));
    m.rotation.x = -Math.PI/2; m.position.set(0, .0035, zMid); m.renderOrder = 0; scene.add(m);
  }

  // ---------- iBrand boards high on the walls ----------
  {
    const dots = (x, W, Hh, col) => { x.fillStyle = col; [[.08,.2,90],[.9,.78,130],[.82,.14,46],[.16,.86,60],[.5,1.05,170]].forEach(([u, v, r]) => { x.beginPath(); x.arc(u*W, v*Hh, r, 0, Math.PI*2); x.fill(); }); };
    // boards in the style of the real iBrand branches: white wall, a watercolour splash with a short line, or plain lettering
    const splash = (x, cx, cy, rx, ry, cols, seed) => { let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 70; i++){ const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()), px = cx + Math.cos(a) * d * rx, py = cy + Math.sin(a) * d * ry, r = (.28 + rnd() * .5) * ry * (1.15 - d * .55);
        const g = x.createRadialGradient(px, py, 0, px, py, r), c = cols[(rnd() * cols.length) | 0]; g.addColorStop(0, c + 'aa'); g.addColorStop(.7, c + '66'); g.addColorStop(1, c + '00');
        x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill(); } };
    const base = (x, W, Hh) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, Hh); x.textAlign = 'center'; x.textBaseline = 'middle'; };
    // the line sits inside the splash, in white
    const splashB = (big, cols, seed) => canvasTex(1024, 448, (x, W, Hh) => { base(x, W, Hh); splash(x, W/2, Hh/2, 300, 150, cols, seed);
      x.direction = 'rtl'; x.fillStyle = '#ffffff'; fitText(x, big, 480, 800, 150); x.fillText(big, W/2, Hh/2 + 4); });
    // a splash above, the line under it in two languages
    const underB = (ar, en, cols, cEn, seed) => canvasTex(1024, 448, (x, W, Hh) => { base(x, W, Hh); splash(x, W/2, 140, 210, 95, cols, seed);
      x.direction = 'rtl'; x.fillStyle = '#1d1d1f'; fitText(x, ar, W - 200, 800, 84); x.fillText(ar, W/2, 295);
      x.direction = 'ltr'; x.fillStyle = cEn; x.font = '700 60px Arial, sans-serif'; x.fillText(en, W/2, 385); });
    // plain lettering on the white wall
    const plainB = (ar, en, cAr, cEn) => canvasTex(1024, 448, (x, W, Hh) => { base(x, W, Hh);
      x.direction = 'rtl'; x.fillStyle = cAr; fitText(x, ar, W - 200, 800, 170); x.fillText(ar, W/2, 165);
      x.direction = 'ltr'; x.fillStyle = cEn; x.font = '800 96px Arial, sans-serif'; x.fillText(en, W/2, 335); });
    // each wall carries lines that belong to the department it stands over (zone ids: 0 kids, 1 pharmacy, 2 wellness, 3 personal care, 4 beauty)
    const LINES = {
      4: [() => splashB('لجمالك', ['#d98bb0', '#8e4a8f', '#c0669e', '#6f3a78'], 11), () => underB('جمالك في روحك', 'Lovely Inside Out', ['#7c2a34', '#5e1f29', '#96404a'], '#3a3a3c', 37), () => plainB('العناية بالبشرة', 'Skin Care', '#8a8a8a', '#b04a86')],
      3: [() => underB('احتياجاتك اليومية', 'Daily Essentials', ['#e9b9a2', '#d99a80', '#f0cdb8'], '#c46a4e', 23), () => plainB('العناية بالرجل', 'MAN CARE', '#1d1d1f', '#1d1d1f'), () => splashB('لعنايتك', ['#f0b27a', '#e58e4a', '#f6caa0'], 53)],
      0: [() => splashB('لطفلك', ['#8fc1ee', '#5a93d6', '#b9dbf5'], 71), () => plainB('الأم والطفل', 'Mom & Baby', '#8a8a8a', '#2a6fdb'), () => underB('لأجمل بداية', 'A Lovely Start', ['#bcdcf6', '#9cc6ee', '#d7eafb'], '#2a6fdb', 83)],
      2: [() => plainB('صحتك', 'Health', '#8a8a8a', '#1f6b45'), () => splashB('لنشاطك', ['#8fcf9b', '#4fa866', '#b9e3bf'], 97), () => underB('صحتك تبدأ من هنا', 'Health Starts Here', ['#b9e3bf', '#93d09f', '#d6efd9'], '#1f6b45', 101)],
      1: [() => splashB('لصحتك', ['#7fd0d6', '#2fa9b5', '#aee3e6'], 113), () => plainB('استشر الصيدلي', 'Ask the Pharmacist', '#1d1d1f', '#14a3b5'), () => underB('نهتم بصحتك', 'We Care', ['#aee3e6', '#86d3d9', '#cdeef0'], '#14a3b5', 127)]
    };
    const lineMat = {}, lineN = {};
    // the department standing nearest to the board decides its lines
    const boardFor = (x, z) => { const sg = SEG.slice().sort((a, b) => Math.hypot((a.x0 + a.x1)/2 - x, (a.zf + a.zb)/2 - z) - Math.hypot((b.x0 + b.x1)/2 - x, (b.zf + b.zb)/2 - z))[0];
      const zid = sg ? Z[sg.zid].old : 4, i = (lineN[zid] = (lineN[zid] || 0) + 1) - 1, k = zid + ':' + (i % LINES[zid].length);
      return lineMat[k] || (lineMat[k] = new THREE.MeshBasicMaterial({map:LINES[zid][i % LINES[zid].length](), toneMapped:false})); };
    const PWd = 4.6, PHt = PWd*448/1024, rim = std('#ffffff', {roughness:.4});
    const board = (x, y, z, yaw) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw;
      const fr = new THREE.Mesh(new THREE.BoxGeometry(PWd + .14, PHt + .14, .05), rim); fr.position.z = .025; g.add(fr);
      const fc = new THREE.Mesh(new THREE.PlaneGeometry(PWd, PHt), boardFor(x, z)); fc.position.z = .056; g.add(fc); scene.add(g); };
    const yB = Math.min(H - .55 - PHt/2, 4.65);
    if (yB - PHt/2 > 3.5){
      [-1, 1].forEach(sd => { for (let z = zA0 - 6.5; z > zB + 3.2; z -= 9) board(sd*(Wx - .02), yB, z, sd < 0 ? Math.PI/2 : -Math.PI/2); });
      [-1, 1].forEach(sd => board(sd*Math.max(5.2, fw*.17), Math.min(yB + .15, H - .6 - PHt/2), zB + .02, 0));
    }
  }

  // ---------- step counter: steps walked and time in the store; rewards unlock with time ----------
  const REWARDS = [{min:2, icon:'🥉', name:'المكافأة البرونزية'}, {min:5, icon:'🥈', name:'المكافأة الفضية'}, {min:10, icon:'🥇', name:'المكافأة الذهبية'}];
  const stepSt = {dist:0, sec:0, got:0};
  try { const sv = JSON.parse(localStorage.getItem('ib3d-steps') || 'null'); if (sv && sv.day === new Date().toDateString()){ stepSt.dist = +sv.dist || 0; stepSt.sec = +sv.sec || 0; stepSt.got = +sv.got || 0; } } catch(e){}
  let stepLast = null, stepClock = performance.now(), stepUi = 0, stepSave = 0;
  const mmss = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  function stepPaint(){
    const nx = REWARDS[stepSt.got], pv = stepSt.got ? REWARDS[stepSt.got - 1] : null, a = pv ? pv.min*60 : 0;
    $('#stN').textContent = Math.floor(stepSt.dist / .7).toLocaleString('en-US'); $('#stT').textContent = mmss(stepSt.sec);
    $('#stM').textContent = pv ? pv.icon : '';
    $('#stB').style.width = (nx ? Math.max(0, Math.min(100, (stepSt.sec - a) / (nx.min*60 - a) * 100)) : 100) + '%';
    $('#stL').textContent = nx ? 'باقي ' + mmss(Math.max(0, nx.min*60 - stepSt.sec)) + ' على ' + nx.name : 'حصلت على كل مكافآت اليوم 🎉';
  }
  function stepTick(){
    const now = performance.now(), dt = Math.min(1, (now - stepClock) / 1000); stepClock = now; if (document.hidden) return;
    const p = camera.position;
    if (stepLast && !droneMode && !flight){ const d = Math.hypot(p.x - stepLast.x, p.z - stepLast.z); if (d < 1.2) stepSt.dist += d; }
    stepLast = {x:p.x, z:p.z}; stepSt.sec += dt;
    const nx = REWARDS[stepSt.got];
    if (nx && stepSt.sec >= nx.min*60){ stepSt.got++; toast('🎁 ' + nx.icon + ' فتحت ' + nx.name + '!'); stepUi = 0; stepSave = 0; }
    if (now > stepUi){ stepUi = now + 500; stepPaint(); }
    if (now > stepSave){ stepSave = now + 5000; try { localStorage.setItem('ib3d-steps', JSON.stringify({day:new Date().toDateString(), dist:Math.round(stepSt.dist), sec:Math.round(stepSt.sec), got:stepSt.got})); } catch(e){} }
  }
  $('#steps').addEventListener('click', () => { const nx = REWARDS[stepSt.got]; toast(nx ? 'تجوّل في الصيدلية: ' + nx.name + ' بعد ' + nx.min + ' دقائق' : 'حصلت على كل مكافآت اليوم 🎉'); });
  stepPaint();
