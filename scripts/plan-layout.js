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
  // …and the central walkway is wider too (7 m → 9.4 m): the offer islands stand down its middle and need room each side
  if (!PGD._wide){ PGD._wide = 1; const AE = .6, CS = 6*AE, CW = 1.2;
    PGD.f.forEach(fx => fx.r.forEach(r => { const v = r[3] > r[2];
      if (!v) r[0] += CS + CW;                                                      // along the front or back wall, the cashier unit: stays with the entrance
      else if (fx.w) r[0] += r[0] > PGD.W/2 ? 2*CS + 2*CW : 0;                        // side walls
      else if (r[0] < PGD.W/2) r[0] += CS - (6 - Math.floor((r[0] - 1.9 + .05) / 2.6)) * AE;
      else r[0] += CS + 2*CW + Math.floor((r[0] - 25.5 + .05) / 2.6) * AE; }));
    PGD.W += 2*CS + 2*CW; }
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
  const GWALL = {h:2.2, d:.5, levels:[.28, .6, .92, 1.24, 1.56, 1.88]};   // wall units around the perimeter
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
  const SEG = [], ENDCAPS = [];
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
  const LOW = ((location.search.match(/[?&]low=([^&]+)/) || [])[1] || '').toUpperCase(), LOWK = 1.45;
  function pgBays(fx, n, G, z, phase, lim){
    const shelves = shelvesOf(G), rows = shelves.map(() => []);
    fx.it.forEach(i => { const p = pid.get(i[1]); if (p && i[0] >= 1 && !(fx._skip && fx._skip.has(p))) rows[Math.min(shelves.length, i[0]) - 1].push({p, fc:i[2], c:i[3], sw:i[4] > 0 ? i[4] / Math.max(1, i[2]) / 100 : 0}); });
    const own = rows.flat();
    const run = (cap, ks, fin) => {
      const bays = []; for (let b = 0; b < n; b++) bays.push({items:[], hdr:null, kind:fx.k || 0, cats:{}});
      let carry = []; const tk = new Set(), fb = fx.b ? normB(fx.b) : '';
      for (let k = 0; k < shelves.length; k++){
        // test (?low=<stand code> or ?low=all): the bottom shelf, far below the shopper's eyes, shows its packs larger
        const big = LOW && (LOW === 'ALL' || String(fx.c).toUpperCase().startsWith(LOW)) && k === shelves.length - 1, MH = big ? shelves[k].maxH + .045 : shelves[k].maxH, KS = big ? ks * LOWK : ks;
        const sh = shelves[k], list = carry.concat(rows[k]); carry = [];
        let x = list.length && list[0].sw ? 0 : .015, full = false;
        // a product the planogram gives a width to takes exactly that much of the shelf (so a shelf holds what the planogram
        // says it holds); its pack is drawn as large as fits inside that slot
        // how a product with a planogram width is drawn on this shelf: its size, whether it stands on end, the room it takes
        const fitOf = o => { const b = szOf(o.p)(o.p, MH, 1); let w0 = b[0], h0 = b[1], turn = false;
          // never drawn smaller than KMIN of its real size (a pack shrunk to fit a too-narrow place reads as a toy): where the
          // planogram's width is tighter than that, the pack takes the room it needs and the shelf holds a little less
          const KMIN = .62; let k = Math.max(Math.min(KMIN, MH / h0), Math.min(1.5, (o.sw - .004) / w0, MH / h0));
          if (big) k = Math.min(Math.max(k, 1) * LOWK, 1.9, MH / h0);   // the test: larger than its slot, the shelf shows fewer facings instead
          // a long carton (toothpaste, a tube in its box) given a narrow place stands on its end there, as it does on the
          // real shelf, instead of lying across its neighbours
          // (only a really long one, more than twice as wide as tall: a jar or a tub is never turned on its side)
          if (w0 > h0 * 2.2 && (o.sw - .004) / w0 < .6){ const k2 = Math.min(1.5, (o.sw - .004) / h0, MH / w0); if (k2 > k * 1.15 || (o.sw - .004) / w0 < KMIN * .8){ k = Math.max(Math.min(KMIN, MH / w0), k2); turn = true; w0 = b[1]; h0 = b[0]; } }
          const w = w0*k, sw = Math.max(o.sw, w + .004);   // never narrower than the pack drawn in it: packs do not overlap
          return {b, k, turn, w, h:h0*k, sw}; };
        const slot = o => { const {b, k, turn, w, h, sw} = o._fit || fitOf(o);
          let bi = Math.floor((x + 1e-6) / BW);
          if (x + sw > (bi + 1)*BW + .003){ bi++; x = bi*BW; }
          if (bi >= n || x + sw > n*BW + .003) return false;
          bays[bi].items.push({p:o.p, x:x - bi*BW + sw/2, s:k0, y:sh.y, w, h, d:b[2]*Math.min(1, k), yaw:(Math.random()-.5)*.05, back:Math.random()*.006, first:o._first, turn});
          if (o.c >= 0) bays[bi].cats[o.c] = (bays[bi].cats[o.c] || 0) + sw; x += sw; return true; };
        const k0 = k;
        const put = (o, first) => { if (o.sw){ o._first = first; return slot(o); } const [w, h, d] = szOf(o.p)(o.p, MH, KS); let bi = Math.floor(x / BW);
          if (x + w > (bi + 1)*BW - .01){ bi++; x = bi*BW + .015; }
          if (bi >= n || x + w > n*BW - .01) return false;
          const b = bays[bi]; b.items.push({p:o.p, x:x - bi*BW + w/2, s:k, y:sh.y, w, h, d, yaw:(Math.random()-.5)*.07, back:Math.random() < .14 ? .015 + Math.random()*.03 : Math.random()*.006, first});
          if (o.c >= 0) b.cats[o.c] = (b.cats[o.c] || 0) + w;
          x += w + .004 + Math.random()*.004; return true; };
        // a shelf too tight for everything the planogram puts on it shows fewer of each (a display, not a stock room): the
        // products with the most facings give one up at a time, down to one each, before anything moves to another shelf
        const fcs = list.map(o => { if (!o.sw) return 0; o._fit = fitOf(o); return o.fc || 1; });
        { const room = n*BW*.97; let need = 0; list.forEach((o, i) => { need += o.sw ? o._fit.sw * fcs[i] : szOf(o.p)(o.p, MH, KS)[0] + .012; });
          while (need > room){ let bi = -1; for (let i = 0; i < list.length; i++) if (fcs[i] > 1 && (bi < 0 || fcs[i] > fcs[bi] || (fcs[i] === fcs[bi] && list[i]._fit.sw > list[bi]._fit.sw))) bi = i; if (bi < 0) break; fcs[bi]--; need -= list[bi]._fit.sw; } }
        for (let i = 0; i < list.length; i++){
          const o = list[i], w0 = szOf(o.p)(o.p, MH, KS)[0], f = o.sw ? fcs[i] : Math.min(cap, Math.max(o.fc || 1, w0 < .075 ? 2 : 1));
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
        // one family to a shelf: spare room on a shelf goes to waiting products of the kind already on it (oral care beside
        // oral care, skin care beside skin care); an empty shelf takes the kind of the first one put on it
        const fam = new Set(); list.forEach(o => { if (o.p._s) fam.add(o.p._s[0]); });
        let strict = true;
        const next = () => {
          if (strict){ for (const p of z.left){ if (tk.has(p)) continue; const cn = CATN[p._s[1]]; if ((cn && cats.has(cn)) || (fb && normB(p.brand) === fb)) return p; } strict = false; }
          if (z.loose) for (const p of z.left){ if (tk.has(p) || (!z.mix && fam.size && !fam.has(p._s[0]))) continue;
            if (z.loose === 4 || (z.loose === 3 && !fx.b) || (!z.home.has(p) && (z.loose === 2 || !fx.b))) return p; }
          return null; };
        while (g++ < 260){
          let o = null, extra = false;
          if (more){ const p = next(); if (p){ o = {p, c:-1}; extra = true; } else more = false; }
          if (!o){ if (rep.length) o = rep[j++ % rep.length]; else break; }
          if (!put(o, extra)){ if (extra || ++miss > 3) break; continue; }   // too wide for what is left: try the next few before giving the shelf up
          if (extra){ tk.add(o.p); if (!fam.size) fam.add(o.p._s[0]); } if (!o.sw) x += .009 + Math.random()*.008;
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
      const F3 = [[4, 1], [2, 1], [1, 1]]; let ok = false; z.mix = false;
      for (const lim of F3){ for (let lv = 0; lv < 3 && !ok; lv++) ok = attempt(lim, lv); if (ok) break; }
      for (let lv = 3; lv < 5 && !ok; lv++) for (const lim of F3){ if ((ok = attempt(lim, lv))) break; }
      // only when the department cannot seat everything that way may a shelf carry more than one family, and only after that are packs made smaller
      if (!ok){ z.mix = true; for (const lim of F3){ if ((ok = attempt(lim, 4))) break; } }
      if (!ok) for (const lim of [[1, .9], [1, .82], [1, .74], [1, .66], [1, .58], [1, .5]]){ if ((ok = attempt(lim, 4))) break; }
    });
    window.__pgStats.byZone = Z.map(z => z.key + ' ' + z.lim.join('/') + (z.mix ? ' mixed' : '') + ' left ' + z.left.length);
    const ALLR = [];
    order.forEach(fx => {
      const zid = zidOf(fx.z), z = Z[zid], G = fx.w ? GWALL : GONDOLA;
      const mods = modsOf(fx), bays = fx._bays; let o = 0;
      fx.r.forEach((r, ri) => {
        const v = r[3] > r[2], cx = r[0] + r[2]/2 - PGD.W/2, cz = r[1] + r[3]/2 - PGD.D;
        const yaw = fx.w ? (v ? (cx < 0 ? Math.PI/2 : -Math.PI/2) : (cz > -PGD.D/2 ? Math.PI : 0)) : (!v ? 0 : fx.f === 'B' ? Math.PI/2 : -Math.PI/2);
        const run = bays.slice(o, o + mods[ri]); o += mods[ri];
        // which end of the plan rectangle lies on the face's right (+x) side: the header band runs on into a neighbour there
        const dp = v ? (-Math.sin(yaw) > 0 ? 1 : 0) : (Math.cos(yaw) > 0 ? 1 : 0);
        gondolaFace(frame(cx, cz, yaw), run, z.key, {G, zc:z.zc, endPanels: !touch(r, 0) && !touch(r, 1), endArt: !!fx.w, join:{L:touch(r, 1 - dp), R:touch(r, dp)}});
        ALLR.push(fx.w ? {w:1, x0:cx - r[2]/2, x1:cx + r[2]/2, zb:cz - r[3]/2, zf:cz + r[3]/2} : (v ? {zid, x0:cx - .25, x1:cx + .25, zb:cz - r[3]/2, zf:cz + r[3]/2, len:r[3]} : {zid, x0:cx - r[2]/2, x1:cx + r[2]/2, zb:cz - .25, zf:cz + .25, len:r[2]}));
        if (!fx.w) z.runs.push(v ? {x0:cx - .25, x1:cx + .25, zf:cz + r[3]/2, zb:cz - r[3]/2} : {x0:cx - r[2]/2, x1:cx + r[2]/2, zf:cz + .25, zb:cz - .25});
      });
    });
    window.__pgStats.unplaced = Z.reduce((a, z) => a + z.left.length, 0);
    // end caps: every free end of a gondola row (both faces back to back count as one) gets a printed board in its
    // department's design, the way a pharmacy dresses the ends of its aisles
    { const gs = ALLR.filter(r => !r.w), par = gs.map((_, i) => i), find = i => par[i] === i ? i : (par[i] = find(par[i]));
      const near = (a, b, e) => Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1) < e && Math.max(a.zb, b.zb) - Math.min(a.zf, b.zf) < e;
      for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < gs.length; j++) if (near(gs[i], gs[j], .06)) par[find(i)] = find(j);
      const cl = {}; gs.forEach((r, i) => { const k = find(i), c = cl[k] || (cl[k] = {x0:1e9, x1:-1e9, zb:1e9, zf:-1e9, zl:{}, rs:[]});
        c.x0 = Math.min(c.x0, r.x0); c.x1 = Math.max(c.x1, r.x1); c.zb = Math.min(c.zb, r.zb); c.zf = Math.max(c.zf, r.zf); c.zl[r.zid] = (c.zl[r.zid] || 0) + r.len; c.rs.push(r); });
      Object.values(cl).forEach(c => {
        const alongX = c.x1 - c.x0 >= c.zf - c.zb, th = alongX ? c.zf - c.zb : c.x1 - c.x0; if (th > 1.3 || th < .4) return;
        const zid = +Object.keys(c.zl).sort((a, b) => c.zl[b] - c.zl[a])[0], z = Z[zid];
        [-1, 1].forEach(sd => {
          const e = alongX ? (sd < 0 ? c.x0 : c.x1) : (sd < 0 ? c.zb : c.zf);
          const zoneAt = alongX ? {x0:sd < 0 ? e - .45 : e + .01, x1:sd < 0 ? e - .01 : e + .45, zb:c.zb + .05, zf:c.zf - .05} : {x0:c.x0 + .05, x1:c.x1 - .05, zb:sd < 0 ? e - .45 : e + .01, zf:sd < 0 ? e - .01 : e + .45};
          if (ALLR.some(q => c.rs.indexOf(q) < 0 && near(q, zoneAt, 0))) return;                      // something stands against this end
          if (alongX ? Math.abs(e) > Wx - .5 : (e > zF - .5 || e < zB + .5)) return;                 // against the room's wall
          const yaw = alongX ? (sd < 0 ? -Math.PI/2 : Math.PI/2) : (sd < 0 ? Math.PI : 0), mid = alongX ? (c.zb + c.zf)/2 : (c.x0 + c.x1)/2;
          ENDCAPS.push({x:alongX ? e + sd*.016 : mid, z:alongX ? mid : e + sd*.016, yaw, w:th, zid, key:z.key, zc:z.zc});
        });
      });
      window.__pgStats.endcaps = ENDCAPS.length;
    }
    // each department's stretches of floor (for its signs, its name on the floor and where its button takes you):
    // units of one department standing side by side, or end to end, make one stretch — wherever the drawing puts them
    Z.forEach(z => { const rs = z.runs, par = rs.map((_, i) => i), find = i => par[i] === i ? i : (par[i] = find(par[i]));
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++){ const a = rs[i], b = rs[j],
        gx = Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1), gz = Math.max(a.zb, b.zb) - Math.min(a.zf, b.zf);   // the gaps between them (below zero: they overlap)
        if ((gz < 1 && gx < 3.2) || (gx < .3 && gz < 1.2)) par[find(i)] = find(j); }
      const g = {}; rs.forEach((r, i) => { const k = find(i), c = g[k]; if (c){ c.x0 = Math.min(c.x0, r.x0); c.x1 = Math.max(c.x1, r.x1); c.zf = Math.max(c.zf, r.zf); c.zb = Math.min(c.zb, r.zb); } else g[k] = {zid:z.id, x0:r.x0, x1:r.x1, zf:r.zf, zb:r.zb}; });
      Object.values(g).sort((p, q) => p.zb - q.zb || p.x0 - q.x0).forEach(c => SEG.push(c)); });
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

  // ---------- end caps: the printed boards on the free ends of the gondola rows ----------
  // Each department has its own board designed in Canva (static/assets/endcaps/<department>.jpg, listed in ENDCAP_ART); until that file loads, or
  // if it is missing, a board is drawn here in the department's colours with the round iBrand logo and its name.
  // departments whose Canva board is in static/assets/endcaps (list.json, written with the boards)
  const ENDCAP_ART = fetch('assets/endcaps/list.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : []).catch(() => []);
  { const capLogo = new Image(); let logoOk = false; const capTex = {}, capMats = {};
    const drawCap = (x, W, Hh, z) => {
      const g = x.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, z.zc.hi); g.addColorStop(1, z.zc.lo); x.fillStyle = g; x.fillRect(0, 0, W, Hh);
      x.fillStyle = 'rgba(255,255,255,.10)'; for (let i = 0; i < 6; i++){ x.beginPath(); x.arc(W * (i % 2 ? .12 : .88), 120 + i * 150, 70 + i * 10, 0, 7); x.fill(); }
      const R = W * .27, cy = Hh * .2; x.fillStyle = '#ffffff'; x.beginPath(); x.arc(W/2, cy, R + 10, 0, 7); x.fill();
      if (logoOk){ x.save(); x.beginPath(); x.arc(W/2, cy, R, 0, 7); x.clip(); x.drawImage(capLogo, W/2 - R*1.08, cy - R*1.08, 2.16*R, 2.16*R); x.restore(); }
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; x.fillStyle = '#ffffff';
      const nm = (SEC[z.key] && SEC[z.key].name) || '', words = nm.split(' '), lines = []; let cur = '';
      words.forEach(w => { const t2 = cur ? cur + ' ' + w : w; x.font = '800 ' + Math.round(W * .125) + 'px "Almarai", Tahoma'; if (x.measureText(t2).width > W - W * .12 && cur){ lines.push(cur); cur = w; } else cur = t2; }); if (cur) lines.push(cur);
      lines.forEach((ln, j) => { fitText(x, ln, W - W * .1, 800, Math.round(W * .136)); x.fillText(ln, W/2, Hh * .52 + j * W * .165 - (lines.length - 1) * W * .082); });
      x.fillStyle = 'rgba(255,255,255,.95)'; x.fillRect(W * .07, Hh - W * .25, W * .86, W * .16); x.fillStyle = z.zc.hex; fitText(x, 'صيدلية اي براند', W * .76, 800, Math.round(W * .08)); x.fillText('صيدلية اي براند', W/2, Hh - W * .17);
    };
    // the designed board fits a row's full end (two faces back to back, ~1 m); a single-face row (~0.5 m) keeps the drawn one
    const capMat = (z, narrow) => {
      const ck = z.key + (narrow ? ':n' : ''); if (capMats[ck]) return capMats[ck];
      const t = narrow ? canvasTex(256, 944, (x, W, Hh) => drawCap(x, W, Hh, z)) : canvasTex(512, 912, (x, W, Hh) => drawCap(x, W, Hh, z)); capTex[ck] = t; t.userData = {z};
      const m = capMats[ck] = new THREE.MeshStandardMaterial({map:t, roughness:.45, envMapIntensity:.5});
      if (!narrow) ENDCAP_ART.then(l => { if (Array.isArray(l) && l.includes(z.key)) texLoader.load('assets/endcaps/' + z.key + '.jpg' + (typeof AV === 'string' ? AV : ''), img => { sRGB(img); m.map = img; m.needsUpdate = true; capTex[ck] = null; }, undefined, () => {}); });
      return m;
    };
    capLogo.onload = () => { logoOk = true; Object.keys(capTex).forEach(k => { const t = capTex[k]; if (!t) return; const z = t.userData.z; drawCap(t.image.getContext('2d'), t.image.width, t.image.height, z); t.needsUpdate = true; }); };
    capLogo.src = 'assets/logo.png';
    const boardMat = new THREE.MeshStandardMaterial({color:'#f3f0f2', roughness:.6});
    ENDCAPS.forEach(c => {
      const z = Z[c.zid], h = GONDOLA.h, gh = h - .1, board = new THREE.Mesh(new THREE.BoxGeometry(c.w, h + .02, .024), boardMat);
      board.position.set(c.x - Math.sin(c.yaw) * .004, (h + .02)/2, c.z - Math.cos(c.yaw) * .004); board.rotation.y = c.yaw; scene.add(board);
      const art = new THREE.Mesh(new THREE.PlaneGeometry(c.w - .03, gh - .02), capMat(z, c.w < .75));
      art.position.set(c.x + Math.sin(c.yaw) * .01, .06 + gh/2, c.z + Math.cos(c.yaw) * .01); art.rotation.y = c.yaw; scene.add(art);
    });
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
  { const css = document.createElement('style'); css.textContent = '.trBtn{position:fixed;z-index:5;right:max(18px, env(safe-area-inset-right,0px));bottom:calc(env(safe-area-inset-bottom,0px) + 136px + var(--lift, 0px));width:46px;height:46px;border-radius:50%;border:1px solid var(--line);background:rgba(255,255,255,.92);color:#b8860b;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 16px rgba(59,29,54,.14)}.trBtn.done{color:#1f9a55}body.sheet .trBtn{display:none}'
        + '.trBox{position:fixed;z-index:40;left:50%;top:50%;transform:translate(-50%,-50%);width:min(380px,calc(100vw - 32px));background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px 20px 18px;box-shadow:0 24px 60px rgba(60,20,50,.35);direction:rtl;font-family:var(--font);text-align:center}.trBox b{display:block;font-size:21px;font-weight:800;color:var(--plum);margin-bottom:6px}.trBox p{white-space:pre-line;margin:0 0 12px;font-size:15px;line-height:1.8;color:var(--muted)}'
        + '.trCode{font:800 24px Arial,sans-serif;letter-spacing:2px;direction:ltr;border:2px dashed #f2c14e;border-radius:12px;padding:10px;margin:0 0 12px;color:var(--plum);user-select:all}.trRow{display:flex;gap:10px;justify-content:center}.trRow button{border:0;border-radius:12px;padding:10px 18px;font:800 15px var(--font);cursor:pointer}.trCopy{background:var(--pink);color:#fff}.trClose{background:#f3eef2;color:var(--plum)}'
    + '.evBtn{position:fixed;z-index:5;right:max(18px, env(safe-area-inset-right,0px));width:46px;height:46px;border-radius:50%;border:1px solid var(--line);background:rgba(255,255,255,.92);color:var(--plum);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 16px rgba(59,29,54,.14);font:800 13px Arial,sans-serif}.evBtn.done{color:#1f9a55}body.sheet .evBtn{display:none}.evBtn i{position:absolute;top:-5px;left:-5px;min-width:20px;height:20px;border-radius:10px;background:var(--pink);color:#fff;font:800 11px/20px Arial,sans-serif;font-style:normal;padding:0 4px;direction:ltr}';
    document.head.appendChild(css); }
  // what every event shares: the day (the store's own, UTC+3), a number drawn from it, and the prize card
  const EVDAY = new Date(Date.now() + 3*3600e3).toISOString().slice(0, 10), evHash = salt => { let h = 7; for (const ch of EVDAY + salt) h = (h*31 + ch.charCodeAt(0)) >>> 0; return h; };
  let evBoxEl = null;
  const evBox = (title, text, code, note) => { if (evBoxEl) evBoxEl.remove(); const box = evBoxEl = document.createElement('div'); box.className = 'trBox'; box.setAttribute('role', 'dialog');
    const t = document.createElement('b'); t.textContent = title; box.appendChild(t);
    if (text){ const p = document.createElement('p'); p.textContent = text; box.appendChild(p); }
    const row = document.createElement('div'); row.className = 'trRow';
    if (code){ const c = document.createElement('div'); c.className = 'trCode'; c.textContent = code; box.appendChild(c);
      if (note){ const n = document.createElement('p'); n.textContent = note; box.appendChild(n); }
      const cp = document.createElement('button'); cp.type = 'button'; cp.className = 'trCopy'; cp.textContent = 'انسخ الكود';
      cp.onclick = () => { const done = () => { cp.textContent = 'تم النسخ'; }; try { navigator.clipboard.writeText(code).then(done, () => { const r = document.createRange(); r.selectNodeContents(c); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); }); } catch(e){} }; row.appendChild(cp); }
    const cl = document.createElement('button'); cl.type = 'button'; cl.className = 'trClose'; cl.textContent = 'إغلاق'; cl.onclick = () => { box.remove(); if (evBoxEl === box) evBoxEl = null; }; row.appendChild(cl);
    box.appendChild(row); document.body.appendChild(box); };
  const evBtn = (bottom, label, svg) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'evBtn'; b.setAttribute('aria-label', label); b.style.bottom = 'calc(env(safe-area-inset-bottom,0px) + ' + bottom + 'px + var(--lift, 0px))'; b.innerHTML = svg; document.body.appendChild(b); return b; };
  const evNote = c => c.note === undefined ? 'استخدم الكود عند إتمام الطلب.' : String(c.note);
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

  // ---------- the missing pieces: a few glowing pieces a day, each in a different department, beside the shelves; collect them all ----------
  const PCFG = CFG().pieces || {};
  if (PCFG.on === true && SEG.length){
    const want = Math.max(3, Math.min(7, Math.round(+PCFG.count || 5))), cand = [];
    SEG.forEach((sg, k) => { const zm = (sg.zf + sg.zb) / 2; [[sg.x1 + 1.1, zm], [sg.x0 - 1.1, zm], [(sg.x0 + sg.x1) / 2, sg.zf + 2.6]].forEach(([x, z], j) => {
      if (Math.abs(x) < Wx - .8 && z > zC + 2 && z < zF - 2.5 && !blockedGround(x, z) && !blockedGround(x + .3, z) && !blockedGround(x - .3, z)) cand.push({zid:sg.zid, x, z, o:evHash('p' + k + ':' + j)}); }); });
    cand.sort((a, b) => a.o - b.o);
    const picks = [], far = c => picks.every(q => Math.hypot(q.x - c.x, q.z - c.z) > 5);
    cand.forEach(c => { if (picks.length < want && far(c) && !picks.some(q => q.zid === c.zid)) picks.push(c); });   // first one to a department…
    cand.forEach(c => { if (picks.length < want && far(c) && !picks.includes(c)) picks.push(c); });                   // …then wherever there is room
    if (picks.length >= 3){
      const KEY = 'ib3d-pieces', saved = String(store.get(KEY, '')).split(':'); let got = saved[0] === EVDAY ? (+saved[1] || 0) : 0;
      const gem = new THREE.MeshStandardMaterial({color:0xe8368f, emissive:0xb01463, emissiveIntensity:.55, roughness:.25, metalness:.2}), halo = new THREE.MeshBasicMaterial({color:0xe8368f, transparent:true, opacity:.5, depthWrite:false, toneMapped:false, side:THREE.DoubleSide});
      const geo = new THREE.OctahedronGeometry(.13), rg = new THREE.RingGeometry(.22, .3, 32);
      const objs = picks.map((c, k) => { const g = new THREE.Group(), m = new THREE.Mesh(geo, gem), r = new THREE.Mesh(rg, halo); m.position.y = .95; m.scale.set(1, 1.35, 1); r.rotation.x = -Math.PI/2; r.position.y = .012; g.add(m); g.add(r);
        g.position.set(c.x, 0, c.z); g.visible = !(got >> k & 1); scene.add(g); return {g, m, r}; });
      const n = picks.length, count = () => { let c = 0; for (let k = 0; k < n; k++) if (got >> k & 1) c++; return c; };
      const btn = evBtn(190, 'القطع المفقودة', '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 3l7 9-7 9-7-9z"/><path d="M5 12h14"/></svg><i></i>');
      const badge = btn.querySelector('i'), win = () => evBox('مبروك! جمعت كل القطع', PCFG.code ? 'هذا كود جائزتك:' : 'جمعت قطع اليوم كلها من أقسام الصيدلية.', String(PCFG.code || ''), evNote(PCFG));
      const upd = () => { const c = count(); badge.textContent = c + '/' + n; btn.classList.toggle('done', c === n); };
      upd();
      btn.addEventListener('click', () => { btn.blur(); if (count() === n) return win();
        const left = [...new Set(picks.filter((c, k) => !(got >> k & 1)).map(c => SEC[Z[c.zid].key].name))];
        toast('جمعت ' + count() + ' من ' + n + ' · الباقي بين ممرات: ' + left.slice(0, 3).join('، ')); });
      let ph = 0;
      setInterval(() => { if (document.hidden || count() === n) return; ph += .3;
        objs.forEach((o, k) => { if (got >> k & 1) return; o.m.rotation.y = ph; o.m.position.y = .95 + Math.sin(ph + k) * .05; const s = 1 + Math.sin(ph + k) * .12; o.r.scale.set(s, s, 1);
          if (Math.hypot(camera.position.x - picks[k].x, camera.position.z - picks[k].z) < 1.25 && camera.position.y < 2.4){ got |= 1 << k; o.g.visible = false; store.set(KEY, EVDAY + ':' + got); upd(); try { sfx.add(); } catch(e){}
            if (count() === n) win(); else toast('قطعة ' + count() + ' من ' + n + ' ✓'); } });
      }, 110);
      window.__pieces = {spots:picks.map(c => ({x:c.x, z:c.z, zone:Z[c.zid].key})), get got(){ return got; }};
    }
  }

  // ---------- riddle of the day: read it, then walk to the department it speaks of and stand on its question mark ----------
  const RCFG = CFG().riddle || {}, RLIST = (Array.isArray(RCFG.list) ? RCFG.list : []).filter(r => r && r.q && Z.some(z => z.key === r.zone));
  if (RCFG.on === true && RLIST.length && SEG.length){
    const rd = RLIST[Math.floor(Date.parse(EVDAY) / 864e5) % RLIST.length], marks = [];
    Z.forEach(z => { const sg = SEG.filter(g => g.zid === z.id).sort((a, b) => b.zf - a.zf)[0]; if (!sg) return;
      const xc = (sg.x0 + sg.x1) / 2, spot = [[xc, sg.zf + 2.3], [sg.x1 + 1.1, sg.zf - 1], [sg.x0 - 1.1, sg.zf - 1]].find(([x, z2]) => Math.abs(x) < Wx - .8 && z2 < zF - 2 && !blockedGround(x, z2));
      if (spot) marks.push({key:z.key, x:spot[0], z:spot[1], t:0}); });
    if (marks.some(m => m.key === rd.zone)){
      const KEY = 'ib3d-riddle'; let solved = store.get(KEY, '') === EVDAY;
      const qTex = canvasTex(128, 128, (x, W, Hh) => { x.clearRect(0, 0, W, Hh); x.fillStyle = '#3b1d36'; x.beginPath(); x.arc(W/2, Hh/2, 56, 0, 7); x.fill(); x.fillStyle = '#ffffff'; x.font = '800 86px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', W/2, Hh/2 + 6); });
      const qMat = new THREE.SpriteMaterial({map:qTex, transparent:true, depthWrite:false, toneMapped:false}), padMat = new THREE.MeshBasicMaterial({color:0x3b1d36, transparent:true, opacity:.4, depthWrite:false, toneMapped:false, side:THREE.DoubleSide}), padGeo = new THREE.RingGeometry(.3, .42, 36);
      const grp = new THREE.Group(); marks.forEach(m => { const sp = new THREE.Sprite(qMat); sp.scale.set(.34, .34, 1); sp.position.set(m.x, 1.05, m.z); grp.add(sp); const pad = new THREE.Mesh(padGeo, padMat); pad.rotation.x = -Math.PI/2; pad.position.set(m.x, .012, m.z); grp.add(pad); });
      grp.visible = !solved; scene.add(grp);
      const btn = evBtn(244, 'لغز اليوم', '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 9a3 3 0 1 1 4.5 2.6c-.9.6-1.5 1.2-1.5 2.4"/><path d="M12 18h.01"/></svg>');
      const win = () => evBox('إجابة صحيحة!', RCFG.code ? 'هذا كود جائزتك:' : 'حلّيت لغز اليوم: ' + SEC[rd.zone].name + '.', String(RCFG.code || ''), evNote(RCFG));
      if (solved) btn.classList.add('done');
      btn.addEventListener('click', () => { btn.blur(); if (solved) return win(); evBox('لغز اليوم', rd.q + '\n\nامشِ للقسم الصحيح وقف على علامة الاستفهام فيه.', '', ''); });
      setInterval(() => { if (document.hidden || solved) return; const now = performance.now();
        marks.forEach(m => { if (Math.hypot(camera.position.x - m.x, camera.position.z - m.z) > 1.1 || camera.position.y > 2.4) return;
          if (m.key === rd.zone){ solved = true; store.set(KEY, EVDAY); grp.visible = false; btn.classList.add('done'); try { sfx.add(); } catch(e){} win(); }
          else if (now - m.t > 6000){ m.t = now; toast('مش هذا القسم… اقرأ اللغز مرة ثانية'); } });
      }, 140);
      window.__riddle = {q:rd.q, zone:rd.zone, marks:marks.map(m => ({key:m.key, x:m.x, z:m.z}))};
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
  // shown or not, and the store's own code for each level, are set in the control panel
  const SCFG = CFG().steps || {}, STEPS_ON = SCFG.on !== false, SCODES = Array.isArray(SCFG.codes) ? SCFG.codes.map(c => String(c || '').trim()) : [];
  if (!STEPS_ON) $('#steps').hidden = true;
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
    if (!STEPS_ON) return;
    const now = performance.now(), dt = Math.min(1, (now - stepClock) / 1000); stepClock = now; if (document.hidden) return;
    const p = camera.position;
    if (stepLast && !droneMode && !flight){ const d = Math.hypot(p.x - stepLast.x, p.z - stepLast.z); if (d < 1.2) stepSt.dist += d; }
    stepLast = {x:p.x, z:p.z}; stepSt.sec += dt;
    const nx = REWARDS[stepSt.got];
    if (nx && stepSt.sec >= nx.min*60){ const code = SCODES[stepSt.got]; stepSt.got++; toast('🎁 ' + nx.icon + ' فتحت ' + nx.name + '!'); if (code){ try { sfx.add(); } catch(e){} evBox(nx.icon + ' ' + nx.name, 'هذا كود جائزتك:', code, evNote(SCFG)); } stepUi = 0; stepSave = 0; }
    if (now > stepUi){ stepUi = now + 500; stepPaint(); }
    if (now > stepSave){ stepSave = now + 5000; try { localStorage.setItem('ib3d-steps', JSON.stringify({day:new Date().toDateString(), dist:Math.round(stepSt.dist), sec:Math.round(stepSt.sec), got:stepSt.got})); } catch(e){} }
  }
  $('#steps').addEventListener('click', () => { const nx = REWARDS[stepSt.got], lastCode = stepSt.got ? SCODES[stepSt.got - 1] : ''; if (lastCode) return evBox(REWARDS[stepSt.got - 1].icon + ' ' + REWARDS[stepSt.got - 1].name, 'هذا كود جائزتك:', lastCode, evNote(SCFG)); toast(nx ? 'تجوّل في الصيدلية: ' + nx.name + ' بعد ' + nx.min + ' دقائق' : 'حصلت على كل مكافآت اليوم 🎉'); });
  stepPaint();
