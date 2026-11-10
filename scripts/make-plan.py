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
    "  try { const r = await fetch('plan/imf.json'); if (r.ok) window.__IMF = await r.json(); } catch(e){}")

# store dimensions + zone planograms
region('  // ---------- store plan (sized from the real product count) ----------', '  // camera\n', blocks['A'])

# fixtures: zone colours, peg-hook bays, products keep their own photo atlas
rep("C_PINK = rgb('#e873a8');", "C_PINK = rgb('#e873a8');\n  let HDR_C = C_PINK;")
rep("quad(HDR, [a(cx-w/2,y-.001,z+.002), a(cx+w/2,y-.001,z+.002), a(cx+w/2,y+.035,z+.002), a(cx-w/2,y+.035,z+.002)], n(0,0,1), C_PINK);",
    "quad(HDR, [a(cx-w/2,y-.001,z+.002), a(cx+w/2,y-.001,z+.002), a(cx+w/2,y+.035,z+.002), a(cx-w/2,y+.035,z+.002)], n(0,0,1), HDR_C);")
rep("    const G = opts.G || GONDOLA, n = bays.length, Wd = n * BW, d = G.d, x0 = -Wd/2;",
    "    const G = opts.G || GONDOLA, n = bays.length, Wd = n * BW, d = G.d, x0 = -Wd/2; HDR_C = opts.zc ? opts.zc.c : C_PINK;\n"
    "    const hooked = bays.some(b => b && b.kind);\n"
    "    if (opts.zc && opts.headers !== false) boxInto(STRUCT, F, 0, G.h + .5, -d/2 + .05, Wd, .03, .14, opts.zc.c);   // zone-coloured trim along the top")
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

# chips: promotions + zones
rep("...SECTIONS.filter(s => s.main && SD(s.key) && s.focus)];", "...SECTIONS.filter(s => s.zone && s.focus)];")

out = os.path.join(root, 'static', 'plan.html')
open(out, 'w', encoding='utf-8').write(s)
print('plan.html written,', len(s), 'bytes')
