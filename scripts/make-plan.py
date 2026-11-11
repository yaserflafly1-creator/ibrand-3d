#!/usr/bin/env python3
# builds static/plan.html from index.html: the same engine with the store laid out like the branch floor plan,
# shelves dressed from the merchandising file (static/plan/imf.json). Layout code lives in scripts/plan-layout.js.
import os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
blocks = {}
cur = None
for line in open(os.path.join(root, 'scripts', 'plan-layout.js'), encoding='utf-8').read().split('\n'):
    m = re.match(r'^//@@(\w+)\s*$', line)
    if m: cur = m.group(1); blocks[cur] = []
    elif cur: blocks[cur].append(line)
blocks = {k: '\n'.join(v).rstrip('\n') + '\n' for k, v in blocks.items()}

def rep(old, new, n=1):
    global s
    assert s.count(old) == n, ('ANCHOR MISS:', old[:80], s.count(old))
    s = s.replace(old, new)

def region(start, end, new):
    global s
    assert s.count(start) == 1 and s.count(end) == 1, ('REGION MISS:', start[:60], s.count(start), end[:60], s.count(end))
    a, b = s.index(start), s.index(end)
    assert a < b
    s = s[:a] + new + '\n' + s[b:]

# page identity
rep('<title>صيدلية اي براند 3D</title>', '<title>صيدلية اي براند 3D — مخطط الفرع (تجريبي)</title>')
rep('جملة الصيدليات • جولة ثلاثية الأبعاد', 'مخطط الفرع الجديد • نسخة تجريبية')

# zones as sections (names, colours come from the layout code)
rep("  {key:'quick', name:'مشتريات سريعة',",
    "  {key:'z_kids', zone:true, name:'قسم الأطفال', en:'Kids Care', url:cat('العناية-بالأم-والطفل',745675715), size:1, eyebrow:'منطقة', desc:'مستلزمات الأم والطفل: الحفاضات، حليب وغذاء الأطفال، العناية والإكسسوارات.'},\n"
    "  {key:'z_rx', zone:true, name:'الدواء والصيدلية', en:'Pharmacy', url:cat('الأدوية',1199189212), size:1, eyebrow:'منطقة', desc:'الأدوية بدون وصفة خلف كاونتر الصيدلي وبجانبه. الأدوية التي تحتاج وصفة تطلبها من الصيدلي.'},\n"
    "  {key:'z_well', zone:true, name:'العناية بالصحة', en:'Wellness', url:cat('المكملات-الغذائية-والفيتامينات',884496587), size:1, eyebrow:'منطقة', desc:'الفيتامينات والمكملات، الأجهزة الطبية ومستلزمات الصحة المنزلية.'},\n"
    "  {key:'z_care', zone:true, name:'العناية الشخصية', en:'Personal Care', url:cat('العناية-اليومية',527058090), size:1, eyebrow:'منطقة', desc:'العناية بالفم والأسنان، مزيلات العرق، الحلاقة والعناية اليومية.'},\n"
    "  {key:'z_beauty', zone:true, name:'الجمال والعناية', en:'Beauty Care', url:cat('العناية-بالبشرة',26418371), size:1, eyebrow:'منطقة', desc:'العناية بالبشرة والشعر، المكياج والعطور وستاندات الماركات.'},\n"
    "  {key:'quick', name:'مشتريات سريعة',")

# merchandising file, loaded with the product data
rep("  AV = DATA && DATA.build ? '?v=' + DATA.build : '';",
    "  AV = DATA && DATA.build ? '?v=' + DATA.build : '';\n"
    "  try { const r = await fetch('plan/imf.json'); if (r.ok) window.__IMF = await r.json(); } catch(e){}\n"
    "  try { const r = await fetch('data/plan.json?t=' + Math.floor(Date.now() / 600000)); if (r.ok) window.__PAT = await r.json(); } catch(e){}")

# plan pages have their own photo atlas (ordered like these shelves): products address it instead of their store-category atlas
rep("    const sd = DATA.sections[key], C2 = sd.cols || 16;\n",
    "    const ak = p._ak && p._k === key ? p._ak : key, sd = DATA.sections[ak], C2 = sd.cols || 16, pp = ak !== key ? {pg:p._apg, tile:p._atile, card:p.card, aspect:p.aspect} : p;\n")
rep("    const bk = key + ':' + p.pg + ':' + Math.floor(p.tile / (C2 * 2)) + ':' + ((p.tile % C2) < C2 / 2 ? 0 : 1);",
    "    // + a coarse floor cell, so a repeat of the same product far away (fill facings, end caps) gets its own small mesh\n"
    "    const wp0 = F.at(cx, 0, cz), bk = ak + ':' + pp.pg + ':' + Math.floor(pp.tile / (C2 * 2)) + ':' + ((pp.tile % C2) < C2 / 2 ? 0 : 1) + (ak !== key ? ':' + Math.round(wp0[0] / 8) + '_' + Math.round(wp0[2] / 8) : '');")
rep("    const [u0,u1,vb,vt] = tileUV(sd, p), hw = w/2,", "    const [u0,u1,vb,vt] = tileUV(sd, pp), hw = w/2,")
rep("    Object.values(DATA.sections).forEach(sd => {\n      (sd.pagesM || []).forEach(s => urls.push(s));",
    "    Object.keys(DATA.sections).filter(k => !(window.__skipAtlas && window.__skipAtlas.has(k))).map(k => DATA.sections[k]).forEach(sd => {\n      (sd.pagesM || []).forEach(s => urls.push(s));")
rep("    Object.keys(DATA.sections).forEach(key => (DATA.sections[key].pagesS || []).forEach((src, pg) => list.push({k: key + ':' + pg, src})));",
    "    Object.keys(DATA.sections).filter(k => !(window.__skipAtlas && window.__skipAtlas.has(k))).forEach(key => (DATA.sections[key].pagesS || []).forEach((src, pg) => list.push({k: key + ':' + pg, src})));")

# store dimensions + zone planograms
region('  // ---------- store plan (sized from the real product count) ----------', '  // camera\n', blocks['A'])

# fixtures: zone colours, peg-hook bays, products keep their own photo atlas
rep("C_PINK = rgb('#e873a8');", "C_PINK = rgb('#e873a8');\n  let HDR_C = C_PINK;")
rep("quad(HDR, [a(cx-w/2,y-.001,z+.002), a(cx+w/2,y-.001,z+.002), a(cx+w/2,y+.035,z+.002), a(cx-w/2,y+.035,z+.002)], n(0,0,1), C_PINK);",
    "quad(HDR, [a(cx-w/2,y-.001,z+.002), a(cx+w/2,y-.001,z+.002), a(cx+w/2,y+.035,z+.002), a(cx-w/2,y+.035,z+.002)], n(0,0,1), HDR_C);")
rep("    const G = opts.G || GONDOLA, n = bays.length, Wd = n * BW, d = G.d, x0 = -Wd/2;",
    "    const G = opts.G || GONDOLA, n = bays.length, Wd = n * BW, d = G.d, x0 = -Wd/2; HDR_C = opts.zc ? opts.zc.c : C_PINK;\n"
    "    const hooked = bays.some(b => b && b.kind);\n"
    "    if (opts.zc && opts.headers !== false) boxInto(STRUCT, F, 0, G.h + .38, -d/2 + .05, Wd, .03, .14, opts.zc.c);   // zone-coloured trim along the top")
rep("    boxInto(STRUCT, F, 0, .06, d/2 - .02, Wd, .12, .04, C_KICK);",
    "    boxInto(STRUCT, F, 0, .06, d/2 - .02, Wd, .12, .04, opts.zc ? opts.zc.c : C_KICK);")
rep("    G.levels.forEach(y => {\n"
    "      boxInto(STRUCT, F, 0, y, .01, Wd - .04, .022, d - .08, C_SHELF);                       // shelf deck\n"
    "      boxInto(STRUCT, F, 0, y - .022, d/2 - .045, Wd - .04, .05, .012, [0.97,0.97,0.97]);       // price strip\n",
    "    G.levels.forEach((y, li) => {\n"
    "      if (!hooked){\n"
    "      boxInto(STRUCT, F, 0, y, .01, Wd - .04, .022, d - .08, C_SHELF);                       // shelf deck\n"
    "      boxInto(STRUCT, F, 0, y - .022, d/2 - .045, Wd - .04, .05, .012, [0.97,0.97,0.97]);       // price strip\n"
    "      } else bays.forEach((b, bi) => {   // peg-hook bays: a rail with prongs instead of a shelf deck\n"
    "        const bx = x0 + bi*BW + BW/2, hk = b && li > 0 && (b.kind === 1 || (b.kind === 2 && li >= 2));\n"
    "        if (hk){ boxInto(STRUCT, F, bx, y + .012, -d/2 + .075, BW - .08, .016, .022, C_UPRIGHT); for (let hx = -BW/2 + .1; hx < BW/2 - .06; hx += .11) boxInto(STRUCT, F, bx + hx, y + .012, -d/2 + .18, .008, .008, .2, C_STEEL); }\n"
    "        else { boxInto(STRUCT, F, bx, y, .01, BW - .04, .022, d - .08, C_SHELF); boxInto(STRUCT, F, bx, y - .022, d/2 - .045, BW - .04, .05, .012, [0.97,0.97,0.97]); }\n"
    "      });\n")
rep("  function endMat(nm){\n    if (endCache[nm]) return endCache[nm];",
    "  function endMat(nm, zc){\n    const ck = nm + (zc ? zc.hex : ''); if (endCache[ck]) return endCache[ck];")
rep("    const t = canvasTex(256, 864, (x, W, Hh) => {\n      const g = x.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, '#f08bbb'); g.addColorStop(1, '#c9518b');",
    "    const t = canvasTex(256, 864, (x, W, Hh) => {\n      const g = x.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, zc ? zc.hi : '#f08bbb'); g.addColorStop(1, zc ? zc.lo : '#c9518b');")
rep("    return endCache[nm] = new THREE.MeshStandardMaterial({map:t, roughness:.45, envMapIntensity:.5});",
    "    return endCache[ck] = new THREE.MeshStandardMaterial({map:t, roughness:.45, envMapIntensity:.5});")
rep("m = new THREE.Mesh(endGeoFor(G), endMat(nm));", "m = new THREE.Mesh(endGeoFor(G), endMat(nm, opts.zc));")
rep("        putProduct(key, F, bx + it.x, it.y, d/2 - .1 - (it.back || 0),", "        putProduct(it.p._k || key, F, bx + it.x, it.y, d/2 - .1 - (it.back || 0),")

# real branch fixtures: 1.2 m bays, 60 cm deep, 4 shelves, 30 cm header boards
rep("  const BW = 1.0;", "  const BW = 1.2;")
rep("  const GONDOLA = {h:1.8, d:.5, levels:[.12, .45, .78, 1.11, 1.44]};", "  const GONDOLA = {h:1.8, d:.6, levels:[.14, .56, .98, 1.40]};")
rep("    const w = x1 - x0 - .04, cx = (x0 + x1)/2, hh = .42, a = F.at, n = F.n;", "    const w = x1 - x0 - .04, cx = (x0 + x1)/2, hh = .30, a = F.at, n = F.n;")

# one header board per gondola (1.2 m), not one wide board across a brand's bays
rep("        const same = curH && prev && prev.id === curH.id;", "        const same = false;")

# brand-name headers (brands without a logo): one shared texture per brand instead of one per bay
rep("  const nameHdrs = [];", "  const nameHdrs = [], nameTex = {};")
rep("    const t = canvasTex(512, 96, (x,W,Hh)=>{ x.fillStyle='#fff'; x.fillRect(0,0,W,Hh); x.fillStyle = PLUM;",
    "    const t = nameTex[name] || (nameTex[name] = canvasTex(512, 96, (x,W,Hh)=>{ x.fillStyle='#fff'; x.fillRect(0,0,W,Hh); x.fillStyle = PLUM;")
rep("fitText(x, name, W-30, 800, 54); x.fillText(name, W/2, Hh/2+2); });", "fitText(x, name, W-30, 800, 54); x.fillText(name, W/2, Hh/2+2); }));")

# layout, counter
region('  // ---------- lay the sections out: back wall (medicines), then aisle after aisle ----------', '  // ---------- Saudi pharmacists (click → customer service) ----------', blocks['R2'])
# quick racks, cross-sell stands (the original brand end caps go with them)
region('  // ---------- quick-grab racks at the counter (tissues, air fresheners, sanitisers…) ----------', '  // ---------- top-selling brand stands along the glass front ----------', blocks['R3'])
# zone signs instead of aisle signs
region('  // ---------- aisle signs: number + sections, and a sign where each section starts ----------', '  // ---------- entrance & exit doors, security gates ----------', blocks['R4'])

# wire bins: only in the entrance zone (the side walls further in carry wall units)
rep("    [-1, 1].forEach(s => { bin(s*(Wx - .7), zA1 - 1.0, -s*Math.PI/2); bin(s*(Wx - .7), zC + 1.1, -s*Math.PI/2); });\n", "")

# the drone may climb with the higher ceiling
rep("alt = Math.max(.55, Math.min(4.35, alt + altV * dt));", "alt = Math.max(.55, Math.min(H - .4, alt + altV * dt));")

# step counter (HUD pill under the top bar) + its tick in the frame loop
rep('<button class="goCart" id="goCart"',
    '<button class="steps" id="steps" type="button" aria-label="عداد الخطوات والمكافآت"><span class="s-row"><span>👣</span><b id="stN">0</b><small>خطوة</small><i class="s-sep"></i><span>⏱</span><b id="stT">0:00</b><span id="stM"></span></span><span class="s-bar"><i id="stB"></i></span><small id="stL"></small></button>\n'
    '<button class="goCart" id="goCart"')
rep('.aisles{position:fixed;',
    '.steps{position:fixed;z-index:6;top:calc(env(safe-area-inset-top,0px) + 66px);left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:4px;padding:7px 14px 8px;border-radius:16px;border:1px solid var(--line);background:rgba(255,255,255,.93);box-shadow:0 8px 22px rgba(59,29,54,.14);font-family:inherit;color:var(--plum,#3b1d36);cursor:pointer;min-width:190px}\n'
    '.steps .s-row{display:flex;align-items:center;gap:6px;font-size:14px;direction:rtl}\n'
    '.steps b{font-weight:800;font-variant-numeric:tabular-nums}\n'
    '.steps small{font-size:11.5px;color:var(--muted)}\n'
    '.steps .s-sep{width:1px;height:14px;background:var(--line);margin:0 4px}\n'
    '.steps .s-bar{width:100%;height:5px;border-radius:5px;background:#f6e3ec;overflow:hidden}\n'
    '.steps .s-bar i{display:block;height:100%;width:0;background:var(--pink);border-radius:5px;transition:width .5s}\n'
    'body.sheet .steps{display:none}\n'
    '.aisles{position:fixed;')
rep("    walk(dt);\n", "    walk(dt); stepTick();\n")

# loading screen: the branch drawing behind the "arranging the shelves" card
rep('<div class="loading" id="loading"><div>جاري تجهيز الصيدلية…<small id="loadingSub">نرتب المنتجات على الرفوف</small></div></div>',
    '<div class="loading" id="loading"><div>جاري ترتيب الرفوف…<small id="loadingSub">نجهّز لك الفرع ونرتب المنتجات على الرفوف</small><i class="ld-bar"></i></div></div>')
rep('.loading small{display:block;',
    '.loading{background:#241a2b url(plan/loader.webp) center/cover no-repeat}\n'
    '.loading > div{background:rgba(255,255,255,.94);padding:18px 30px 20px;border-radius:20px;box-shadow:0 18px 50px rgba(0,0,0,.35);max-width:86vw}\n'
    '.loading .ld-bar{display:block;height:5px;border-radius:5px;margin-top:10px;background:linear-gradient(90deg,#f6e3ec 0%,var(--pink) 50%,#f6e3ec 100%);background-size:200% 100%;animation:ldbar 1.3s linear infinite}\n'
    '@keyframes ldbar{from{background-position:200% 0}to{background-position:0 0}}\n'
    '@media (prefers-reduced-motion:reduce){.loading .ld-bar{animation:none}}\n'
    '.loading small{display:block;')

# chips: promotions + zones
rep("...SECTIONS.filter(s => s.main && SD(s.key) && s.focus)];", "...SECTIONS.filter(s => s.zone && s.focus)];")

out = os.path.join(root, 'static', 'plan.html')
open(out, 'w', encoding='utf-8').write(s)
print('plan.html written,', len(s), 'bytes')
