//@@A
  // ---------- store plan: zones from the branch floor plan + the merchandising file (IMF) ----------
  // Zones (like the branch drawing): entrance at the front centre, a central walkway with the cross-sell stands,
  // beauty at the front of both wings, personal care then kids down the left, wellness then pharmacy down the right,
  // the pharmacist counter at the far end of the walkway, wall units all around.
  const EYE = 1.6, H = 4.6;
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
  const GWALL = {h:2.2, d:.45, levels:[.12, .45, .78, 1.11, 1.44, 1.77]};   // wall units around the perimeter
  const sizers = {}, szOf = p => sizers[p._k] || (sizers[p._k] = sizer(p._k));
  const brandOf = p => p.brandId || p.brand || '';
  const facingsOf = (p, w) => Math.min(4, Math.max(p.fc || 1, w < .075 ? 2 : 1));
  // Order a list the way the file says: category, then brand. A brand flagged "stand" with enough stock to fill most of a bay
  // owns its bays under its logo ("stand per category": one per category); smaller brands share their category's bays,
  // brand by brand. Hook items are kept together so they get peg bays.
  function prep(list, G){
    const cap = shelvesOf(G).length * (BW - .03) * .5;
    const uid = p => { const b = brandOf(p); if (!b || p._ds === 2) return null; return p._ds === 0 ? 'b|' + b + '|' + p._fx : 'b|' + b + '|' + p._s[0] + ':' + p._s[1] + '|' + p._fx; };
    const need = {}, home = {};
    list.forEach(p => { const u = uid(p); if (!u) return; const w = szOf(p)(p, .3)[0]; need[u] = (need[u] || 0) + (w + .012) * facingsOf(p, w);
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
      const sh = shelves[k], [w, h, d] = szOf(p)(p, sh.maxH, 1);
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
          if (prev._big || p._big || k / shelves.length >= .3 || (p._fx || 0) !== bay.kind){
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
    return bays;
  }
  const ZCOL = ZINFO.map(z => { const c = new THREE.Color(z.hex); return {hex:z.hex, c:[c.r, c.g, c.b], hi:'#' + c.clone().lerp(new THREE.Color('#ffffff'), .3).getHexString(), lo:'#' + c.clone().lerp(new THREE.Color('#000000'), .25).getHexString()}; });
  const Z = ZINFO.map((zi, id) => { const all = zoneProducts[id], fl0 = all.filter(p => !p._un), wl = all.filter(p => p._un);
    return {id, key:zi.key, zc:ZCOL[id], all, floorList:fl0, wallList:wl, floor:mplan(fl0, GONDOLA), wall:mplan(wl, GWALL), fo:0, wo:0}; });
  const SP = 4.2, NBX = 8, CA = 2.0, AISLE_W = 2.4, ROW_T = 2*GONDOLA.d + .04, PITCH = ROW_T + AISLE_W, WALL_D = GWALL.d, NBACK = 8;
  const zF = 0, zR0 = zF - 9.5, ZP = zF - 6.8;
  const LEFT = [4, 3, 0], RIGHT = [4, 2, 1];   // front → back
  let rxTaken = false;
  function solve(){
    const fb = Z.map(z => z.floor.length); if (!rxTaken) fb[1] = Math.max(0, fb[1] - NBACK);
    const left = fb[3] + fb[0], right = fb[2] + fb[1], T = left + right + fb[4];
    const bl = Math.max(0, Math.min(fb[4], Math.round(T/2 - left))), br = fb[4] - bl;
    let best = null;
    for (let C = 2; C <= 5; C++){
      const per = C*NBX*2, lines = Math.max(4, Math.ceil(Math.max(left + bl, right + br, 1) / per));
      const wx = SP + C*NBX*BW + (C-1)*CA + 2.2 + GWALL.d + .02, D = -zR0 + lines*PITCH - AISLE_W + 2.3 + GWALL.d + .02;
      const sc = Math.abs(2*wx/D - 1.25); if (!best || sc < best.sc) best = {sc, C, lines, Wx:wx};
    }
    const {C, lines} = best, nf = lines*C*2;
    const wing = (order, counts) => {
      const parts = order.map((zid, i) => ({zid, bays:counts[i], faces:Math.ceil(counts[i] / NBX)})).filter(p => p.bays > 0);
      let spare = nf - parts.reduce((a, p) => a + p.faces, 0);
      while (spare > 0 && parts.length){ let b = parts[0]; parts.forEach(p => { if (p.bays/p.faces > b.bays/b.faces) b = p; }); b.faces++; spare--; }
      let f0 = 0; parts.forEach(p => { p.f0 = f0; f0 += p.faces; p.l0 = Math.floor(p.f0 / (2*C)); p.l1 = Math.ceil((p.f0 + p.faces) / (2*C)); });
      return parts;
    };
    const Lp = wing(LEFT, [bl, fb[3], fb[0]]), Rp = wing(RIGHT, [br, fb[2], fb[1]]);
    const zLast = zR0 - ROW_T/2 - (lines-1)*PITCH, zb = zLast - ROW_T/2 - 2.3 - GWALL.d - .02;
    const zW0 = zR0 + 1.0, nSide = Math.max(0, Math.floor((zW0 - (zb + .6)) / BW));
    const zoneAt = (parts, z) => { const l = Math.max(0, Math.min(lines - 1, Math.round((zR0 - ROW_T/2 - z) / PITCH))); const p = parts.find(q => l >= q.l0 && l < q.l1) || parts[parts.length - 1]; return p ? p.zid : 4; };
    const side = parts => { const a = []; for (let i = 0; i < nSide; i++) a.push(zoneAt(parts, zW0 - (i + .5)*BW)); return a; };
    const sideL = side(Lp), sideR = side(Rp);
    const nBackSide = Math.max(0, Math.floor((best.Wx - GWALL.d - .1 - (SP + .3)) / BW));
    const backL = Lp.length ? Lp[Lp.length-1].zid : 0, backR = Rp.length ? Rp[Rp.length-1].zid : 1;
    const slots = [0,0,0,0,0]; sideL.forEach(z => slots[z]++); sideR.forEach(z => slots[z]++); slots[backL] += nBackSide; slots[backR] += nBackSide;
    return {C, lines, Wx:best.Wx, L:Lp, R:Rp, bl, br, zLast, zB:zb, zW0, nSide, sideL, sideR, nBackSide, backL, backR, slots};
  }
  let PLAN = solve();
  // wall-unit products that do not fit on the walls of their zone move to its floor gondolas (nothing is left out)
  for (let t = 0; t < 3; t++){
    let moved = false;
    Z.forEach(z => { const s = PLAN.slots[z.id]; if (z.wall.length <= s) return;
      const kept = new Set(); z.wall.slice(0, s).forEach(b => b.items.forEach(it => kept.add(it.p)));
      const add = new Set(); z.wall.slice(s).forEach(b => b.items.forEach(it => { if (!kept.has(it.p)) add.add(it.p); }));
      z.wall.length = s; if (!add.size) return;
      z.floorList = z.floorList.concat([...add]); z.floor = mplan(z.floorList, GONDOLA); moved = true; });
    if (!moved) break; PLAN = solve();
  }
  const rxBack = Z[1].floor.splice(0, NBACK); rxTaken = true; PLAN = solve();
  const NC = PLAN.C, NL = PLAN.lines, Wx = PLAN.Wx, zB = PLAN.zB, zC = zB + 2.7, zA0 = zR0, zA1 = PLAN.zLast - ROW_T/2;
  const nA = NL, nb = NBX, L = zA0 - zA1, innerW = 2*Wx, plans = {}, totalBays = Z.reduce((a, z) => a + z.floor.length + z.wall.length, 0) + rxBack.length;
  const ROOM = {x:Wx, zBack:zB, zFront:zF, h:H};
  const fw = 2*Wx, fl = zF - zB, zMid = (zF + zB)/2;

//@@R2
  // ---------- lay the zones out like the branch plan ----------
  const SEG = [];
  const lineZ = l => zR0 - ROW_T/2 - l*PITCH, colX0 = c => SP + c*(NBX*BW + CA);
  const rot = (a, n) => a.length ? a.slice(n % a.length).concat(a.slice(0, n % a.length)) : a;
  // extra facings for slots a zone does not need: keeps every gondola full with that zone's own products
  function fill(z, n, G, wall){
    if (n <= 0) return [];
    const src = wall && z.wallList.length ? z.wallList : (z.floorList.length ? z.floorList : z.all); if (!src.length) return [];
    const ck = (wall && z.wallList.length ? 'w' : 'f') + G.h; if (!z['s' + ck]) z['s' + ck] = prep(src, G);
    z.fo += 61; return mplan(rot(z['s' + ck], z.fo), G, {cycle:true, maxBays:n, sorted:true});
  }
  [[-1, PLAN.L], [1, PLAN.R]].forEach(([w, parts]) => parts.forEach(part => {
    const z = Z[part.zid];
    let bays = part.zid === 4 ? (w < 0 ? z.floor.slice(0, PLAN.bl) : z.floor.slice(PLAN.bl)) : z.floor.slice();
    const need = part.faces*NBX - bays.length; if (need > 0) bays = bays.concat(fill(z, need, GONDOLA, false));
    for (let j = 0; j < part.faces; j++){
      const fi = part.f0 + j, l = Math.floor(fi / (2*NC)), c = Math.floor((fi % (2*NC)) / 2), f = fi % 2;
      const xc = w*(colX0(c) + NBX*BW/2), run = bays.slice(j*NBX, (j+1)*NBX); if (!run.length) continue;
      gondolaFace(f === 0 ? frame(xc, lineZ(l) + GONDOLA.d/2 + .02, 0) : frame(xc, lineZ(l) - GONDOLA.d/2 - .02, Math.PI), run, z.key, {zc:z.zc});
    }
    SEG.push({zid:part.zid, w, l0:part.l0, l1:part.l1});
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
    for (const w of [-1, 1]) for (let l = 0; l < NL; l++){
      const part = (w < 0 ? PLAN.L : PLAN.R).find(q => l >= q.l0 && l < q.l1); if (!part) continue;
      const z = Z[part.zid]; if (!z.caps){ z.caps = topBrands(z); z.capI = 0; } if (!z.caps.length) continue;
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
    [-3.0, 3.0].forEach(x => { boxInto(T, frame(x, zC - .6, 0), 0, 1.17, 0, .06, .25, .06, C_UPRIGHT); boxInto(T, frame(x, zC - .62, 0), 0, 1.38, 0, .42, .28, .03, '#1b1b1f'); });
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
    const qp = planogram('quick', SD('quick').products, QG, {cycle:true, maxBays:4, noBrands:true});
    [-1,1].forEach((s, i) => { const bays = qp.slice(i*2, i*2+2); gondolaFace(frame(s*(SP - 1.35), zC + 1.3, 0), bays.length ? bays : [null], 'quick', {G:QG, titleKey:'quick'}); });
    SEC.quick.focus = {pos:new THREE.Vector3(SP - 1.35, EYE, zC + 3.4), target:new THREE.Vector3(SP - 1.35, 1.0, zC + 1.3)};
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
    const keys = ['offers', 'excl', 'trend', 'import'].filter(k => SD(k)), z0 = zR0 - 3.2, z1 = zC + 6.5;
    const step = keys.length > 1 ? Math.max(5.5, Math.min(11, (z0 - z1) / (keys.length - 1))) : 0;
    keys.forEach((k, i) => { const z = z0 - i*step; if (i === 0 || z >= z1) promoIsland(k, 0, z); });
  }
  // milk bundle table and the best-seller tower
  if (SD('milk')){
    const x = 0, z = zF - 3.0, Fm = frame(x, z, 0), Fb = frame(x, z, Math.PI);
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
  SEG.forEach(sg => {
    const z = Z[sg.zid], sec = SEC[z.key];
    const z0 = lineZ(sg.l0) + ROW_T/2 + AISLE_W/2, z1 = sg.l1 >= NL ? zB : lineZ(sg.l1 - 1) - ROW_T/2 - AISLE_W/2;
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
  });
  SEC.z_rx.focus = {pos:new THREE.Vector3(0, EYE, zC + 3.2), target:new THREE.Vector3(0, 1.5, zB)};

