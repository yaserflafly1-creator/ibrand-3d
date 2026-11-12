//@@A
  // ---------- store plan: zones from the branch floor plan + the merchandising file (IMF) ----------
  // Zones (like the branch drawing): entrance at the front centre, a central walkway with the cross-sell stands,
  // beauty at the front of both wings, personal care then kids down the left, wellness then pharmacy down the right,
  // the pharmacist counter at the far end of the walkway, wall units all around.
  const EYE = 1.6, H = 6.2;   // high ceiling, as asked for the branch
  const IMF = (window.__IMF && window.__IMF.p) || {};
  const mainKeys = SECTIONS.filter(s=>s.main).map(s=>s.key).filter(k=>SD(k));
  const ZINFO = [{key:'z_kids', hex:'#2a6fdb'}, {key:'z_rx', hex:'#14a3b5'}, {key:'z_well', hex:'#27a84a'}, {key:'z_care', hex:'#f28c1e'}, {key:'z_beauty', hex:'#c53fb4'}];
  const SECZ = {baby:0, meds:1, vit:2, devices:2, pets:2, daily:3, other:3, skin:4, hair:4, makeup:4};
  const zoneProducts = ZINFO.map(() => []);
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
  // FCAP / KS: how hard the shelves are packed (max facings per product, pack scale) — set by the fit-to-area search below
  let FCAP = 4, KS = 1, TIGHT = false;
  const refFacings = (p, w) => Math.min(4, Math.max(p.fc || 1, w < .075 ? 2 : 1));   // for the own-stand rule: same as the build
  const facingsOf = (p, w) => Math.min(FCAP, Math.max(p.fc || 1, w < .075 ? 2 : 1));
  // Order a list the way the file says: category, then brand. A brand flagged "stand" with enough stock to fill most of a bay
  // owns its bays under its logo ("stand per category": one per category); smaller brands share their category's bays,
  // brand by brand. Hook items are kept together so they get peg bays.
  function prep(list, G){
    const cap = shelvesOf(G).length * (BW - .03) * .5;
    const uid = p => { const b = brandOf(p); if (!b || p._ds === 2) return null; return p._ds === 0 ? 'b|' + b + '|' + p._fx : 'b|' + b + '|' + p._s[0] + ':' + p._s[1] + '|' + p._fx; };
    const need = {}, home = {};
    list.forEach(p => { const u = uid(p); if (!u) return; const w = szOf(p)(p, .3)[0]; need[u] = (need[u] || 0) + (w + .012) * refFacings(p, w);
      if (p._ds === 0){ const h = home[u] || (home[u] = {}), k = p._s[0] + ':' + p._s[1]; h[k] = (h[k] || 0) + 1; } });
    const homeOf = {}; Object.keys(home).forEach(u => { const k = Object.entries(home[u]).sort((a, c) => c[1] - a[1])[0][0].split(':'); homeOf[u] = [+k[0], +k[1]]; });
    list.forEach(p => { const u = uid(p), big = !!u && need[u] >= cap, hm = big && homeOf[u];
      p._u = big ? u : 'c|' + p._s[0] + ':' + p._s[1] + '|' + p._fx; p._big = big;
      p._key = [hm ? hm[0] : p._s[0], hm ? hm[1] : p._s[1], p._fx, big ? 0 : 1, big ? brandOf(p) : '', big ? 0 : p._s[2], brandOf(p)]; });
    return list.slice().sort((a, b) => { for (let i = 0; i < 7; i++){ const x = a._key[i], y = b._key[i]; if (x !== y) return x < y ? -1 : 1; } return a._k === b._k ? a._o - b._o : (a._k < b._k ? -1 : 1); });
  }
  // Fill bays shelf by shelf with the facings from the file; every unit (brand stand / category) starts on its own bay,
  // and a bay that ends part-way is topped up with more facings of the same unit so shelves never look empty.
  function mplan(src, G, opts={}){
    const list = opts.sorted ? src : prep(src, G), N = list.length, bays = []; if (!N) return bays;
    const shelves = shelvesOf(G), maxBays = opts.maxBays || Infinity;
    let bay = null, k = 0, x = 0;
    const hdrOf = p => p._big ? {id:p._u, brandId:p.brandId || p.brand, name:p.brand, big:true} : {id:p._u, label:p.sub || SEC[p._k].name, big:false};
    const newBay = () => { if (bays.length >= maxBays) return false; bay = {items:[], hdr:null, kind:0}; bays.push(bay); k = 0; x = .015; return true; };
    function tryPlace(p){
      const sh = shelves[k], [w, h, d] = szOf(p)(p, sh.maxH, KS);
      if (x + w > BW - .01){ k++; x = .015; if (k >= shelves.length) return newBay() ? 'bay' : 'end'; return 'shelf'; }
      if (!bay.items.length){ bay.hdr = hdrOf(p); bay.kind = p._fx || 0; }
      const f = facingsOf(p, w);
      for (let i = 0; i < f && x + w <= BW - .01; i++){
        bay.items.push({p, x:x + w/2, s:k, y:sh.y, w, h, d, yaw:(Math.random()-.5)*.07, back:Math.random() < .14 ? .015 + Math.random()*.03 : Math.random()*.006, first:i === 0});
        x += w + .004 + Math.random()*.004;
      }
      x += .009 + Math.random()*.008; return 'ok';
    }
    const topUp = (from, to) => { const n = to - from; if (n <= 0) return 'ok'; let j = 0, g = 0, r = 'ok'; while (g++ < 400 && (r = tryPlace(list[(from + (j % n)) % N])) !== 'bay' && r !== 'end'){ if (r === 'ok') j++; } return r; };
    if (!newBay()) return bays;
    let i = 0, guard = 0, unit = null, start = 0; const limit = opts.cycle ? Infinity : N;
    while (i < limit && guard++ < 600000){
      const p = list[i % N];
      if (p._u !== unit){
        if (unit !== null && bay.items.length){
          const prev = list[(i - 1 + N) % N];
          // tight packing: units simply follow each other along the shelves (no part-empty bays to top up)
          if (!TIGHT && (prev._big || p._big || k / shelves.length >= .3 || (p._fx || 0) !== bay.kind)){
            const r = topUp(start, i); if (r === 'end') break;
            if (bay.items.length && !newBay()) break;
          }
        }
        unit = p._u; start = i;
      }
      const r = tryPlace(p);
      if (r === 'end') break;
      if (r === 'ok') i++;
    }
    if (!opts.cycle && bay && bay.items.length && i >= N) topUp(start, N);
    if (bays.length && !bays[bays.length-1].items.length) bays.pop();
    if (TIGHT) bays.forEach(b => {   // a bay shared by several units: board and fixture follow whichever fills most of it
      const cnt = {}, rep = {}; let top = null; b.items.forEach(it => { const u = it.p._u; cnt[u] = (cnt[u] || 0) + it.w; rep[u] = rep[u] || it.p; if (top === null || cnt[u] > cnt[top]) top = u; });
      if (top !== null){ b.hdr = hdrOf(rep[top]); b.kind = rep[top]._fx || 0; } });
    return bays;
  }
  const ZCOL = ZINFO.map(z => { const c = new THREE.Color(z.hex); return {hex:z.hex, c:[c.r, c.g, c.b], hi:'#' + c.clone().lerp(new THREE.Color('#ffffff'), .3).getHexString(), lo:'#' + c.clone().lerp(new THREE.Color('#000000'), .25).getHexString()}; });
  // real branch fixtures: 1.2 m bays, 60 cm deep, 4 shelves, 2 m aisles (BW / GONDOLA are set for this page)
  const SP = 3.4, CA = 2.0, AISLE_W = 2.0, SIDE_A = 2.0, BACK_A = 2.0, ROW_T = 2*GONDOLA.d + .04, PITCH = ROW_T + AISLE_W, WALL_D = GWALL.d;
  const NBACK = Math.floor((2*SP - .4) / BW), AMAX = 1500;   // floor area target (m²)
  const zF = 0, zR0 = zF - 8.0, ZP = zF - 5.9;
  const LEFT = [4, 3, 0], RIGHT = [4, 2, 1];   // front → back
  const SORTED = ZINFO.map((zi, id) => { const all = zoneProducts[id], fl0 = all.filter(p => !p._un), wl = all.filter(p => p._un); return {all, fl0, wl, fs:prep(fl0, GONDOLA), ws:prep(wl, GWALL)}; });
  // Mixed layout, like the branch drawing: free-standing brand stands (2-bay islands) on the first lines of both
  // wings, a grid of long gondola rows behind them, and a block of short gondolas turned the other way in the kids
  // corner. Every stretch of shelving is a "run" (where it stands + how many bays); zones take runs front to back.
  const PB = 4, ISL = 2, SLINES = 1;
  function wingRuns(w, C, nbx, g, band){
    const runs = [], Win = C*nbx*BW + (C-1)*CA, colX0 = c => SP + c*(nbx*BW + CA), m = Math.floor((nbx + 1) / 3), S = m >= 2 ? SLINES : 0;
    const lz = i => zR0 - ROW_T/2 - i*PITCH, off = GONDOLA.d/2 + .02;
    for (let i = 0; i < S + g; i++){
      const zc = lz(i), base = {line:i, zc, f:zc + ROW_T/2, b:zc - ROW_T/2};
      for (let c = 0; c < C; c++){
        if (i < S){ const gap = m > 1 ? (nbx*BW - m*ISL*BW) / (m - 1) : 0;
          for (let k = 0; k < m; k++){ const xc = w*(colX0(c) + ISL*BW/2 + k*(ISL*BW + gap));
            runs.push(Object.assign({x:xc, z:zc + off, yaw:0, n:ISL, type:'stand'}, base)); runs.push(Object.assign({x:xc, z:zc - off, yaw:Math.PI, n:ISL, type:'stand'}, base)); } }
        else { const xc = w*(colX0(c) + nbx*BW/2);
          runs.push(Object.assign({x:xc, z:zc + off, yaw:0, n:nbx, type:'row'}, base)); runs.push(Object.assign({x:xc, z:zc - off, yaw:Math.PI, n:nbx, type:'row'}, base)); }
      }
    }
    let zEnd = lz(S + g - 1) - ROW_T/2;
    if (band){ const q = Math.floor((Win + AISLE_W) / (ROW_T + AISLE_W)), z0 = zEnd - AISLE_W, zc = z0 - PB*BW/2;
      for (let j = 0; j < q; j++){ const X = w*(SP + ROW_T/2 + (q > 1 ? j*(Win - ROW_T)/(q - 1) : (Win - ROW_T)/2)), base = {line:S + g, zc, f:z0, b:z0 - PB*BW, type:'band', n:PB};
        runs.push(Object.assign({x:X + off, z:zc, yaw:Math.PI/2}, base)); runs.push(Object.assign({x:X - off, z:zc, yaw:-Math.PI/2}, base)); }
      zEnd = z0 - PB*BW; }
    return {runs, zEnd, S, lines:S + g, depth:zR0 - zEnd};
  }
  const allot = (runs, order, counts) => {
    const parts = order.map((zid, i) => ({zid, bays:counts[i], runs:[], cap:0})).filter(p => p.bays > 0); let ri = 0;
    parts.forEach(p => { while (ri < runs.length && p.cap < p.bays){ p.runs.push(runs[ri]); p.cap += runs[ri].n; ri++; } });
    if (parts.length) while (ri < runs.length){ const p = parts[parts.length - 1]; p.runs.push(runs[ri]); p.cap += runs[ri].n; ri++; }
    parts.forEach(p => p.runs.forEach(r => { r.zid = p.zid; }));
    return parts;
  };
  function solve(Z, rxTaken){
    const fb = Z.map(z => z.floor.length); if (!rxTaken) fb[1] = Math.max(0, fb[1] - NBACK);
    const left = fb[3] + fb[0], right = fb[2] + fb[1], T = left + right + fb[4];
    const bl = Math.max(0, Math.min(fb[4], Math.round(T/2 - left))), br = fb[4] - bl;
    const cL = [bl, fb[3], fb[0]], cR = [br, fb[2], fb[1]];
    const fits = parts => parts.every(p => p.cap >= p.bays);
    // smallest floor area that holds the bays, keeping the store roughly square
    let best = null;
    for (let C = 1; C <= 3; C++) for (let nbx = 5; nbx <= 14; nbx++){
      const Win = C*nbx*BW + (C-1)*CA, band = Math.floor((Win + AISLE_W) / (ROW_T + AISLE_W)) >= 2;
      let gL = 1, gR = 1, WL, WR, PL, PR;
      for (; gL < 60; gL++){ WL = wingRuns(-1, C, nbx, gL, band); PL = allot(WL.runs, LEFT, cL); if (fits(PL)) break; }
      for (; gR < 60; gR++){ WR = wingRuns(1, C, nbx, gR, false); PR = allot(WR.runs, RIGHT, cR); if (fits(PR)) break; }
      // the shallower wing takes as many more rows as the deeper one leaves room for (kept full with that zone's range)
      const deep = Math.max(WL.depth, WR.depth);
      while (wingRuns(-1, C, nbx, gL + 1, band).depth <= deep + .01){ gL++; } 
      while (wingRuns(1, C, nbx, gR + 1, false).depth <= deep + .01){ gR++; }
      const wx = SP + Win + SIDE_A + GWALL.d + .02, D = -zR0 + deep + BACK_A + GWALL.d + .02;
      const asp = 2*wx/D, area = 2*wx*D, sc = area * (asp < .8 ? 1 + (.8 - asp)*3 : asp > 1.45 ? 1 + (asp - 1.45)*3 : 1);
      if (!best || sc < best.sc) best = {sc, C, nbx, gL, gR, band, Wx:wx, area, D, deep};
    }
    const {C, nbx} = best, WL = wingRuns(-1, C, nbx, best.gL, best.band), WR = wingRuns(1, C, nbx, best.gR, false);
    const Lp = allot(WL.runs, LEFT, cL), Rp = allot(WR.runs, RIGHT, cR);
    const zEnd = zR0 - best.deep, zb = zEnd - BACK_A - GWALL.d - .02;
    const zW0 = zR0 + 1.0, nSide = Math.max(0, Math.floor((zW0 - (zb + .65)) / BW));
    const zoneAt = (runs, z) => { let b = null, bd = 1e9; runs.forEach(r => { const d = Math.abs(r.zc - z); if (d < bd){ bd = d; b = r; } }); return b ? b.zid : 4; };
    const side = runs => { const a = []; for (let i = 0; i < nSide; i++) a.push(zoneAt(runs, zW0 - (i + .5)*BW)); return a; };
    const sideL = side(WL.runs), sideR = side(WR.runs);
    const nBackSide = Math.max(0, Math.floor((best.Wx - GWALL.d - .1 - (SP + .3)) / BW));
    const backL = Lp.length ? Lp[Lp.length-1].zid : 0, backR = Rp.length ? Rp[Rp.length-1].zid : 1;
    const slots = [0,0,0,0,0]; sideL.forEach(z => slots[z]++); sideR.forEach(z => slots[z]++); slots[backL] += nBackSide; slots[backR] += nBackSide;
    return {C, nbx, lines:Math.max(WL.lines, WR.lines), linesL:WL.lines, linesR:WR.lines, runsL:WL.runs, runsR:WR.runs, area:best.area, D:best.D, Wx:best.Wx, L:Lp, R:Rp, bl, br, zEnd, zB:zb, zW0, nSide, sideL, sideR, nBackSide, backL, backR, slots};
  }
  // one complete layout for a packing mode
  function layoutFor(mode){
    FCAP = mode.cap; KS = mode.k; TIGHT = !!mode.tight;
    const Z = ZINFO.map((zi, id) => { const S = SORTED[id];
      return {id, key:zi.key, zc:ZCOL[id], all:S.all, floorList:S.fl0, wallList:S.wl, floor:mplan(S.fs, GONDOLA, {sorted:true}), wall:mplan(S.ws, GWALL, {sorted:true}), fo:0, wo:0}; });
    let PLAN = solve(Z, false);
    // Balance walls and floor until it settles:
    //  - wall-unit products that do not fit on the walls of their zone move to its floor gondolas (nothing is left out)
    //  - wall bays a zone has to spare take the tail of its floor range (wall units hold more: six shelves)
    const overflow = () => { let ch = false;
      Z.forEach(z => { const sl = PLAN.slots[z.id]; if (z.wall.length <= sl) return;
        const kept = new Set(); z.wall.slice(0, sl).forEach(b => b.items.forEach(it => kept.add(it.p)));
        const add = new Set(); z.wall.slice(sl).forEach(b => b.items.forEach(it => { if (!kept.has(it.p)) add.add(it.p); }));
        z.wall.length = sl; z.wallList = z.wallList.filter(p => kept.has(p)); z.wsCur = null; ch = true; if (!add.size) return;
        z.floorList = z.floorList.concat([...add]); z.floor = mplan(z.floorList, GONDOLA); z.fsCur = null; });
      return ch; };
    const spare = () => { let ch = false;
      Z.forEach(z => { const sl = PLAN.slots[z.id]; if (z.wall.length >= sl || !z.floorList.length) return;
        const fs = z.fsCur || (z.fsCur = prep(z.floorList, GONDOLA)), ws0 = z.wsCur || (z.wsCur = prep(z.wallList, GWALL));
        let lo = 1, hi = fs.length, bestN = 0, bestW = null;
        while (lo <= hi){ const mid = (lo + hi) >> 1, cand = mplan(ws0.concat(fs.slice(fs.length - mid)), GWALL, {sorted:true}); if (cand.length <= sl){ bestN = mid; bestW = cand; lo = mid + 1; } else hi = mid - 1; }
        if (!bestN) return;
        z.wsCur = ws0.concat(fs.slice(fs.length - bestN)); z.wallList = z.wsCur; z.fsCur = fs.slice(0, fs.length - bestN); z.floorList = z.fsCur;
        z.wall = bestW; z.floor = mplan(z.fsCur, GONDOLA, {sorted:true}); ch = true; });
      return ch; };
    for (let t = 0; t < 12; t++){
      if (overflow()){ PLAN = solve(Z, false); continue; }
      if (t < 3 && spare()){ PLAN = solve(Z, false); continue; }
      break;
    }
    const rxBack = Z[1].floor.splice(0, NBACK); PLAN = solve(Z, true);
    return {Z, PLAN, rxBack, mode};
  }
  // fit everything into the target floor area: first with the facings from the file, then fewer facings, then slightly
  // smaller packs — the first packing that fits wins; if none does, the tightest one is used and the store grows
  const MODES = [{cap:4, k:1}, {cap:2, k:1}, {cap:2, k:1, tight:1}, {cap:1, k:1, tight:1}, {cap:1, k:.95, tight:1}, {cap:1, k:.9, tight:1}, {cap:1, k:.86, tight:1}, {cap:1, k:.82, tight:1}, {cap:1, k:.78, tight:1}, {cap:1, k:.74, tight:1}, {cap:1, k:.7, tight:1}];
  let FIT = null;
  for (const m of MODES){ FIT = layoutFor(m); if (FIT.PLAN.area <= AMAX) break; }
  const Z = FIT.Z, PLAN = FIT.PLAN, rxBack = FIT.rxBack, NBX = PLAN.nbx;
  window.__planFit = {cap:FIT.mode.cap, k:FIT.mode.k, tight:!!FIT.mode.tight, area:Math.round(PLAN.area), w:+(2*PLAN.Wx).toFixed(1), d:+PLAN.D.toFixed(1)};
  const NC = PLAN.C, NL = PLAN.lines, Wx = PLAN.Wx, zB = PLAN.zB, zC = zB + 2.7, zA0 = zR0, zA1 = PLAN.zEnd;
  const nA = NL, nb = NBX, L = zA0 - zA1, innerW = 2*Wx, plans = {}, totalBays = Z.reduce((a, z) => a + z.floor.length + z.wall.length, 0) + rxBack.length;
  const ROOM = {x:Wx, zBack:zB, zFront:zF, h:H};
  const fw = 2*Wx, fl = zF - zB, zMid = (zF + zB)/2;

//@@R2
  // ---------- lay the zones out like the branch plan ----------
  const SEG = [];
  const lineZ = l => zR0 - ROW_T/2 - l*PITCH;
  const rot = (a, n) => a.length ? a.slice(n % a.length).concat(a.slice(0, n % a.length)) : a;
  // extra facings for slots a zone does not need: keeps every gondola full with that zone's own products
  function fill(z, n, G, wall){
    if (n <= 0) return [];
    const src = wall && z.wallList.length ? z.wallList : (z.floorList.length ? z.floorList : z.all); if (!src.length) return [];
    const ck = (wall && z.wallList.length ? 'w' : 'f') + G.h; if (!z['s' + ck]) z['s' + ck] = prep(src, G);
    z.fo += 61; return mplan(rot(z['s' + ck], z.fo), G, {cycle:true, maxBays:n, sorted:true});
  }
  [[-1, PLAN.L], [1, PLAN.R]].forEach(([w, parts]) => parts.forEach((part, pi) => {
    const z = Z[part.zid];
    let bays = part.zid === 4 ? (w < 0 ? z.floor.slice(0, PLAN.bl) : z.floor.slice(PLAN.bl)) : z.floor.slice();
    const need = part.cap - bays.length; if (need > 0) bays = bays.concat(fill(z, need, GONDOLA, false));
    let o = 0;
    part.runs.forEach(r => { const run = bays.slice(o, o + r.n); o += r.n; if (run.length) gondolaFace(frame(r.x, r.z, r.yaw), run, z.key, {zc:z.zc}); });
    const aisles = [...new Set(part.runs.map(r => +(r.f + AISLE_W/2).toFixed(2)))];
    SEG.push({zid:part.zid, w, z0:Math.max(...part.runs.map(r => r.f)) + AISLE_W/2, z1:pi === parts.length - 1 ? zB : Math.min(...part.runs.map(r => r.b)) - AISLE_W/2, aisles});
  }));
  // wall units: both side walls and the back wall, each stretch dressed by the zone in front of it
  const wallQ = Z.map(z => z.wall.slice());
  const takeWall = (zid, n) => { let out = wallQ[zid].splice(0, n); if (out.length < n) out = out.concat(fill(Z[zid], n - out.length, GWALL, true)); return out; };
  const sideWall = (w, zones) => { let i0 = 0;
    for (let i = 1; i <= zones.length; i++){
      if (i < zones.length && zones[i] === zones[i0]) continue;
      const n = i - i0, zid = zones[i0]; let bays = takeWall(zid, n); if (w > 0) bays = bays.slice().reverse();
      if (bays.length) gondolaFace(frame(w*(Wx - GWALL.d/2 - .02), PLAN.zW0 - (i0 + n/2)*BW, w < 0 ? Math.PI/2 : -Math.PI/2), bays, Z[zid].key, {G:GWALL, zc:Z[zid].zc});
      i0 = i;
    } };
  sideWall(-1, PLAN.sideL); sideWall(1, PLAN.sideR);
  { const n = PLAN.nBackSide, xb = SP + .3 + n*BW/2;
    [[-1, PLAN.backL], [1, PLAN.backR]].forEach(([w, zid]) => { const bays = takeWall(zid, n); if (bays.length) gondolaFace(frame(w*xb, zB + GWALL.d/2 + .02, 0), bays, Z[zid].key, {G:GWALL, zc:Z[zid].zc}); }); }
  window.__planLeft = wallQ.reduce((a, q) => a + q.length, 0);
  // behind the pharmacist counter: medicines
  { let bays = rxBack.slice(); if (bays.length < NBACK) bays = bays.concat(fill(Z[1], NBACK - bays.length, GONDOLA, false));
    if (bays.length) gondolaFace(frame(0, zB + GONDOLA.d/2 + .02, 0), bays, 'z_rx', {zc:Z[1].zc}); }
  // end caps facing the central walkway: each zone's best-selling brands
  {
    const topBrands = z => { const agg = {}; z.all.forEach(p => { const b = brandOf(p); if (!b || !p.brand) return; const a = agg[b] || (agg[b] = {id:b, name:p.brand, sold:0, list:[]}); a.sold += p.sold || 0; a.list.push(p); });
      return Object.values(agg).filter(a => a.list.length >= 4).sort((a, b) => (b.sold - a.sold) || (b.list.length - a.list.length)).slice(0, 14); };
    for (const w of [-1, 1]) for (let l = 0; l < (w < 0 ? PLAN.linesL : PLAN.linesR); l++){
      const r0 = (w < 0 ? PLAN.runsL : PLAN.runsR).find(r => r.line === l && r.type !== 'band'); if (!r0) continue;
      const z = Z[r0.zid]; if (!z.caps){ z.caps = topBrands(z); z.capI = 0; } if (!z.caps.length) continue;
      const br = z.caps[z.capI++ % z.caps.length], bay = mplan(br.list.slice().sort((a, b) => (b.sold || 0) - (a.sold || 0)), GONDOLA, {cycle:true, maxBays:1}); if (!bay[0]) continue;
      bay[0].hdr = {id:'e:' + br.id, brandId:br.list[0].brandId || br.list[0].brand, name:br.name, big:true}; bay[0].kind = 0;
      gondolaFace(frame(w*(SP - GONDOLA.d/2 - .03), lineZ(l), w > 0 ? -Math.PI/2 : Math.PI/2), bay, z.key, {zc:z.zc, endPanels:false});
    }
  }

  // ---------- pharmacist counter (far end of the central walkway) ----------
  const deskW = 2*SP - .6;
  {
    const F = frame(0, zC - .45, 0), T = STRUCT, C_TEAL = rgb('#14a3b5');
    boxInto(T, F, 0, .5, 0, deskW, 1.0, .9, '#ffffff');
    boxInto(T, F, 0, .45, .452, deskW + .02, .5, .01, C_TEAL);
    boxInto(T, F, 0, 1.025, 0, deskW + .2, .05, 1.05, '#efe9ec');
    OBSTACLES.push({box:{x0:-SP - .2, x1:SP + .2, z0:zB - 1, z1:zC + .35}});
    [-deskW/2 + .5, deskW/2 - .5].forEach(x => { boxInto(T, frame(x, zC - .6, 0), 0, 1.17, 0, .06, .25, .06, C_UPRIGHT); boxInto(T, frame(x, zC - .62, 0), 0, 1.38, 0, .42, .28, .03, '#1b1b1f'); });
    const disc = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, .08), std('#ffffff',{roughness:.3})); disc.position.set(-1.2, 3.55, zB + .06); scene.add(disc);
    const logo = logoPlane(1.04, 1.04); logo.position.set(-1.2, 3.55, zB + .11); scene.add(logo);
    const crossMat = new THREE.MeshBasicMaterial({color:TEAL, toneMapped:false});
    [[.22,.68],[.68,.22]].forEach(([w,h])=>{ const c = new THREE.Mesh(new THREE.BoxGeometry(w,h,.06), crossMat); c.position.set(1.2, 3.55, zB + .1); scene.add(c); });
    scene.userData.cross = crossMat;
    const sign = lightbox('استشر الصيدلي', 3, {bg:TEAL, fg:'#ffffff', bar:'#ffffff'}); hang(sign, 0, 3.2, zC - .2, 1.2);
    sign.userData.svc = true; svcTargets.push(sign);
    spotAt(-deskW/4, zC - 1.2, 1, .8); spotAt(deskW/4, zC - 1.2, 1, .8);
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
    const s1 = lightbox(SEC[key].name, 2.2, {bg:PINK, fg:'#ffffff'}); hang(s1, x, 3.1, z + PROMO_BAYS*BW/2 + .1, .9);
    s1.userData.nav = key; navTargets.push(s1);
    const s2 = lightbox(SEC[key].name, 2.2, {bg:PINK, fg:'#ffffff'}); hang(s2, x, 3.1, z + PROMO_BAYS*BW/2 + .08, .9, Math.PI);
    s2.userData.nav = key; navTargets.push(s2);
    SEC[key].focus = {pos:new THREE.Vector3(x + 2.3, EYE, z + 2.6), target:new THREE.Vector3(x + .5, 1.0, z)};
    spotAt(x, z, .6, .7, .5);
  }
  {
    const keys = ['offers', 'excl', 'trend', 'import'].filter(k => SD(k)), z0 = zR0 - 3.4, z1 = zC + 6.8;
    const step = keys.length > 1 ? Math.max(6.2, Math.min(11, (z0 - z1) / (keys.length - 1))) : 0;
    keys.forEach((k, i) => { const z = z0 - i*step; if (i === 0 || z >= z1) promoIsland(k, 0, z); });
  }
  // milk bundle table and the best-seller tower
  if (SD('milk')){
    const x = 0, z = zF - 2.6, Fm = frame(x, z, 0), Fb = frame(x, z, Math.PI);
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
  if (SD('best')){
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
  // ---------- zone identity: tinted floors, a portal sign where each zone starts ----------
  const namedAisles = new Set();
  SEG.forEach(sg => {
    const z = Z[sg.zid], sec = SEC[z.key];
    const z0 = sg.z0, z1 = sg.z1;
    const tint = new THREE.Mesh(new THREE.PlaneGeometry(Wx - SP + .5, z0 - z1), new THREE.MeshBasicMaterial({color:z.zc.hex, transparent:true, opacity:.2, depthWrite:false, toneMapped:false}));
    tint.rotation.x = -Math.PI/2; tint.position.set(sg.w*(SP - .5 + Wx)/2, .006, (z0 + z1)/2); scene.add(tint);
    const t = canvasTex(1024, 300, (x, W, Hh) => {
      const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, z.zc.lo); g.addColorStop(.5, z.zc.hex); g.addColorStop(1, z.zc.lo); x.fillStyle = g; x.fillRect(0, 0, W, Hh);
      x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(0, Hh-12, W, 12);
      x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; fitText(x, sec.name, W - 110, 800, 124); x.fillText(sec.name, W/2, 116);
      x.direction = 'ltr'; x.font = '700 56px Arial, sans-serif'; x.globalAlpha = .92; x.fillText(sec.en || '', W/2, 232); x.globalAlpha = 1;
    });
    const face = new THREE.MeshBasicMaterial({map:t, toneMapped:false}), side = std(z.zc.hex);
    const box = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.0*300/1024, .1), [side,side,side,side,face,face]);
    hang(box, sg.w*2.35, 3.35, z0 - .25, .9);
    box.userData.nav = z.key; navTargets.push(box);
    if (!sec.focus) sec.focus = {pos:new THREE.Vector3(sg.w*1.7, EYE, z0 + 2.4), target:new THREE.Vector3(sg.w*(SP + 5), 1.3, z0 - 3)};
    // the section's name written on the floor of each of its aisles
    if (!z.floorTex) z.floorTex = canvasTex(1024, 256, (x, W, Hh) => { x.clearRect(0, 0, W, Hh); x.fillStyle = z.zc.lo; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; fitText(x, sec.name, W - 60, 800, 150); x.fillText(sec.name, W/2, 104);
      x.direction = 'ltr'; x.font = '700 50px Arial, sans-serif'; x.globalAlpha = .8; x.fillText((sec.en || '').toUpperCase(), W/2, 210); x.globalAlpha = 1; });
    const wingW = Wx - GWALL.d - SIDE_A - SP, tw = Math.min(5.6, wingW - 3.4), fmat = new THREE.MeshBasicMaterial({map:z.floorTex, transparent:true, depthWrite:false, toneMapped:false, opacity:.85});
    sg.aisles.forEach(za => { const ak = sg.w + ':' + za; if (namedAisles.has(ak)) return; namedAisles.add(ak);   // an aisle shared by two zones is named once
      const fm = new THREE.Mesh(new THREE.PlaneGeometry(tw, tw/4), fmat); fm.rotation.x = -Math.PI/2; fm.position.set(sg.w*(SP + wingW/2), .009, za); fm.renderOrder = 1; scene.add(fm);
      // and once more at the mouth of the aisle, turned to be read from the central walkway
      const fe = new THREE.Mesh(new THREE.PlaneGeometry(AISLE_W - .3, (AISLE_W - .3)/4), fmat); fe.rotation.order = 'YXZ'; fe.rotation.y = -sg.w*Math.PI/2; fe.rotation.x = -Math.PI/2;
      fe.position.set(sg.w*(SP + .75), .009, za); fe.renderOrder = 1; scene.add(fe); });
  });
  SEC.z_rx.focus = {pos:new THREE.Vector3(0, EYE, zC + 3.2), target:new THREE.Vector3(0, 1.5, zB)};

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
    const boardFor = (x, z) => { const w = x < 0 ? -1 : 1; let sg = SEG.find(g => g.w === w && z <= g.z0 + 2 && z >= g.z1 - 2) || SEG.filter(g => g.w === w).sort((a, b) => Math.abs((a.z0 + a.z1)/2 - z) - Math.abs((b.z0 + b.z1)/2 - z))[0];
      const zid = sg && LINES[sg.zid] ? sg.zid : 4, i = (lineN[zid] = (lineN[zid] || 0) + 1) - 1, k = zid + ':' + (i % LINES[zid].length);
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

