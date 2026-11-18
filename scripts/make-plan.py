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
# this is the main page now (the workflow publishes it as the site's index); title and tagline stay as on the engine page

# zones as sections (names, colours come from the layout code)
rep("  {key:'quick', name:'مشتريات سريعة',",
    "  {key:'z_makeup', zone:true, name:'الميك أب', en:'Makeup', url:cat('المكياج-والاكسسوارات',539644644), size:1, eyebrow:'قسم', desc:'المكياج وإكسسواراته: ستاندات العلامات ورفوف الوجه والعيون والشفاه والأظافر.', cta:'تسوق القسم'},\n"
    "  {key:'z_derma', zone:true, name:'الديرما والبريميوم', en:'Derma & Premium', url:cat('العناية-بالبشرة',26418371), size:1, eyebrow:'قسم', desc:'علامات العناية الطبية بالبشرة والعلامات الفاخرة.', cta:'تسوق القسم'},\n"
    "  {key:'z_hair', zone:true, name:'العناية بالشعر والبشرة', en:'Hair & Skin Care', url:cat('العناية-بالشعر',2050932461), size:1, eyebrow:'قسم', desc:'الشامبو والبلسم وعلاجات وصبغات الشعر، والعناية اليومية بالبشرة.', cta:'تسوق القسم'},\n"
    "  {key:'z_care', zone:true, name:'العناية الشخصية', en:'Personal Care', url:cat('العناية-اليومية',527058090), size:1, eyebrow:'قسم', desc:'الاستحمام والجسم، العناية بالفم والأسنان، مزيلات العرق، العناية النسائية وعناية الرجل.', cta:'تسوق القسم'},\n"
    "  {key:'z_dev', zone:true, name:'الأجهزة والمستلزمات الطبية', en:'Medical Devices', url:cat('الأجهزة-والمعدات-الطبية',1237042837), size:1, eyebrow:'قسم', desc:'أجهزة القياس، الدعامات، الإسعافات الأولية والمستلزمات الطبية.', cta:'تسوق القسم'},\n"
    "  {key:'z_vit', zone:true, name:'المكملات الغذائية', en:'Supplements', url:cat('المكملات-الغذائية-والفيتامينات',884496587), size:1, eyebrow:'قسم', desc:'الفيتامينات والمكملات الغذائية.', cta:'تسوق القسم'},\n"
    "  {key:'z_kids', zone:true, name:'الأم والطفل', en:'Mom & Baby', url:cat('العناية-بالأم-والطفل',745675715), size:1, eyebrow:'قسم', desc:'الحفائض، حليب وغذاء الأطفال، الرضّاعات ومستلزمات الأم والطفل.', cta:'تسوق القسم'},\n"
    "  {key:'z_rx', zone:true, name:'الدواء والصيدلية', en:'Pharmacy', url:cat('الأدوية',1199189212), size:1, eyebrow:'قسم', desc:'الأدوية بدون وصفة أمام كاونتر الصيدلي، وأدوية الوصفة خلفه.', cta:'تسوق القسم'},\n"
    "  {key:'quick', name:'مشتريات سريعة',")

# everything the store needs to open (products, merchandising file, settings, planogram, shelf pattern) is asked for
# at once instead of one after another: on a phone network each wait in a row costs a round trip
rep("  try { const r = await fetch('data/products.json?t=' + Date.now(), {cache:'no-store'}); if (r.ok) DATA = normalize(await r.json()); } catch(e){}",
    "  { const J = async (u, o) => { try { const r = await fetch(u, o); return r.ok ? await r.json() : null; } catch(e){ return null; } };\n"
    "    const get = async u => { const c = new AbortController(), tm = setTimeout(() => c.abort(), 6000); try { const r = await fetch(u, {signal:c.signal}); return r.ok ? await r.json() : null; } catch(e){ return null; } finally { clearTimeout(tm); } };\n"
    "    // settings and planogram: the control panel's saved copy when its backend is set and answers, else the files published with the store\n"
    "    const cfgP = J('config.json', {cache:'no-cache'}).then(async c => { if (c) window.__CFG = c; const api = c && c.api; if (!api) return null;\n"
    "      const [c2, p2] = await Promise.all([get(api + '/public/config'), get(api + '/public/pg')]); if (c2) window.__CFG = Object.assign({}, window.__CFG, c2, {api}); return p2 && Array.isArray(p2.f) ? p2 : null; });\n"
    "    const [d, imf, pg, pat] = await Promise.all([J('data/products.json', {cache:'no-cache'}), J('plan/imf.json'), cfgP, J('data/plan.json?t=' + Math.floor(Date.now() / 600000))]);\n"
    "    if (d) DATA = normalize(d); if (imf) window.__IMF = imf; if (pat) window.__PAT = pat;\n"
    "    window.__PG = pg || await J('plan/pg.json'); }")
# open the connections the store will need while the page is still being read
import json as _json
_api = (_json.load(open(os.path.join(root, 'static', 'config.json'), encoding='utf-8')).get('api') or '').rstrip('/')
rep('<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>\n<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>'
    + ('\n<link rel="preconnect" href="' + _api + '" crossorigin>' if _api.startswith('https://') else ''))
rep("  AV = DATA && DATA.build ? '?v=' + DATA.build : '';",
    "  AV = DATA && DATA.build ? '?v=' + DATA.build : '';\n"
    "  if (window.__CFG && 'season' in window.__CFG) SEASON = window.__CFG.season;")

# plan pages have their own photo atlas (ordered like these shelves): products address it instead of their store-category atlas
rep("    const sd = DATA.sections[key], C2 = sd.cols || 16;\n",
    "    const ak = p._ak && p._k === key ? p._ak : key, sd = DATA.sections[ak], C2 = sd.cols || 16, pp = ak !== key ? {pg:p._apg, tile:p._atile, card:p.card, aspect:p.aspect} : p;\n")
rep("    const bk = key + ':' + p.pg + ':' + Math.floor(p.tile / (C2 * 2)) + ':' + ((p.tile % C2) < C2 / 2 ? 0 : 1);",
    "    // + a coarse floor cell, so a repeat of the same product far away (fill facings, end caps) gets its own small mesh\n"
    "    const wp0 = F.at(cx, 0, cz), bk = ak + ':' + pp.pg + ':' + Math.floor(pp.tile / (C2 * 2)) + ':' + ((pp.tile % C2) < C2 / 2 ? 0 : 1) + (ak !== key ? ':' + Math.round(wp0[0] / 8) + '_' + Math.round(wp0[2] / 8) : '');")
rep("    const [u0,u1,vb,vt] = tileUV(sd, p), hw = w/2,", "    const [u0,u1,vb,vt] = tileUV(sd, pp), hw = w/2,")
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
rep("    const w = x1 - x0 - .04, cx = (x0 + x1)/2, hh = .42, a = F.at, n = F.n;", "    const w = x1 - x0 - .04, cx = (x0 + x1)/2, hh = .30, a = F.at, n = F.n;")
# Blender look: the sign above each bay is a frame in the department colour round a white label
rep("    quad(HDR, [a(cx-w/2,y,z), a(cx+w/2,y,z), a(cx+w/2,y+hh,z), a(cx-w/2,y+hh,z)], n(0,0,1), C_WHITE);",
    "    quad(HDR, [a(cx-w/2,y,z), a(cx+w/2,y,z), a(cx+w/2,y+hh,z), a(cx-w/2,y+hh,z)], n(0,0,1), HDR_C);\n"
    "    quad(HDR, [a(cx-w/2+.045,y+.04,z+.003), a(cx+w/2-.045,y+.04,z+.003), a(cx+w/2-.045,y+hh-.035,z+.003), a(cx-w/2+.045,y+hh-.035,z+.003)], n(0,0,1), C_WHITE);")
rep("const tw = Math.min(w - .1, (hh - .12) * 1024/TRH)", "const tw = Math.min(w - .16, (hh - .13) * 1024/TRH)")
# the band above the wall shelving is iBrand plum instead of wood
rep("g.addColorStop(0,'#b7875a'); g.addColorStop(.5,'#c89a6b'); g.addColorStop(1,'#9c7048');", "g.addColorStop(0,'#3b1d36'); g.addColorStop(.5,'#45233f'); g.addColorStop(1,'#35192f');")


# one header board per gondola (1.2 m), not one wide board across a brand's bays
rep("        const same = curH && prev && prev.id === curH.id;", "        const same = false;")

# (brand-name headers are batched into shared sheets in the engine itself)

# layout, counter
region('  // ---------- lay the sections out: back wall (medicines), then aisle after aisle ----------', '  // ---------- Saudi pharmacists (click → customer service) ----------', blocks['R2'])
# quick racks, cross-sell stands (the original brand end caps go with them)
region('  // ---------- quick-grab racks at the counter (tissues, air fresheners, sanitisers…) ----------', '  // ---------- aisle signs: number + sections, and a sign where each section starts ----------', blocks['R3'])
# zone signs instead of aisle signs
region('  // ---------- aisle signs: number + sections, and a sign where each section starts ----------', '  // ---------- entrance & exit doors, security gates ----------', blocks['R4'])

# wire bins: only in the entrance zone (the side walls further in carry wall units)
rep("    [-1, 1].forEach(s => { bin(s*(Wx - .7), zA1 - 1.0, -s*Math.PI/2); bin(s*(Wx - .7), zC + 1.1, -s*Math.PI/2); });\n", "")
rep("    [-1, 1].forEach(s => { for (let z = zF - 2.2; z > zA0 + 1.0; z -= 1.75) bin(s*(Wx - .7), z, -s*Math.PI/2); });\n", "")
# the drawing's entrance is 6 m wide at the centre, with wall units right up to it: doors closer together, trolleys between them
rep("  const DOOR_IN = 3.4, DOOR_OUT = -3.4;", "  const DOOR_IN = 1.9, DOOR_OUT = -1.9;")
rep("    for (let k = 0; k < 6; k++) trolley(frame(DOOR_IN + 2.0 + k*.32, zF - .75, Math.PI/2));\n    OBSTACLES.push({box:{x0:DOOR_IN + 1.4, x1:DOOR_IN + 4.3, z0:zF - 1.3, z1:zF}});",
    "    for (let k = 0; k < 6; k++) trolley(frame(3.56, zF - .6 - k*.32, 0));\n    OBSTACLES.push({box:{x0:3.15, x1:3.98, z0:zF - 2.7, z1:zF}});")
rep("    const bk = frame(DOOR_IN - 1.9, zF - 1.6, 0);", "    const bk = frame(-3.56, zF - .75, 0);")
rep("    OBSTACLES.push({x: DOOR_IN - 1.9, z: zF - 1.6, r:.35});", "    OBSTACLES.push({x: -3.56, z: zF - .75, r:.35});")

# the drone may climb with the higher ceiling
rep("const DRONE_ALT = 3.0;", "const DRONE_ALT = 4.3;")

# the look approved in the Blender model: clean white shelving, plain white back panels, neutral bright light
rep("const C_STEEL = rgb('#aab1b6'), C_SHELF = rgb('#e9ecee'), C_UPRIGHT = rgb('#6d757b'), C_KICK = rgb('#7e868c'),",
    "const C_STEEL = rgb('#e4e6e9'), C_SHELF = rgb('#fcfcfd'), C_UPRIGHT = rgb('#eef0f2'), C_KICK = rgb('#d5d8dc'),")
rep("meshOf(STRUCT, new THREE.MeshStandardMaterial({vertexColors:true, roughness:.38, metalness:.45, envMapIntensity:.8}));",
    "meshOf(STRUCT, new THREE.MeshStandardMaterial({vertexColors:true, roughness:.42, metalness:.06, envMapIntensity:.55}));")
rep("x.fillStyle='#d9dde0'; x.fillRect(0,0,w,h); x.fillStyle='#8f969b';", "x.fillStyle='#f3f4f6'; x.fillRect(0,0,w,h); x.fillStyle='#e3e5e9';")
rep("new THREE.MeshStandardMaterial({map:pegTex, roughness:.5, metalness:.35, envMapIntensity:.6})", "new THREE.MeshStandardMaterial({map:pegTex, roughness:.55, metalness:.04, envMapIntensity:.4})")
rep("new THREE.HemisphereLight('#fff3e4', '#d9c7b8', 0.45)", "new THREE.HemisphereLight('#ffffff', '#e4dcd8', 0.55)")
# --- closer to the Blender render: neutral grey-white tiles, flat ceiling with crisp light panels, deeper soft shade
rep("g.addColorStop(0,'#eee3d6'); g.addColorStop(1,'#e6d9ca');", "g.addColorStop(0,'#e4e2e0'); g.addColorStop(1,'#dcdad8');")
rep("x.strokeStyle='rgba(150,128,110,.6)'; x.lineWidth=4;", "x.strokeStyle='rgba(150,148,150,.55)'; x.lineWidth=3;")
rep("const wallMat = std('#efe6dd',{roughness:.9, envMapIntensity:.4});", "const wallMat = std('#f1efee',{roughness:.9, envMapIntensity:.4});")
rep("x.fillStyle='#f7f5f4'; x.fillRect(0,0,w,h); for (let i=0;i<500;i++){ x.fillStyle=`rgba(120,110,115,${Math.random()*.08})`; x.fillRect(Math.random()*w, Math.random()*h, 2, 2); } x.strokeStyle='#d9d3d6'; x.lineWidth=6; x.strokeRect(0,0,w,h);",
    "x.fillStyle='#e6e5e5'; x.fillRect(0,0,w,h);")
rep("    for (let x=-Wx+1.3; x<=Wx-1.2; x+=1.8) for (let z=zB+1.2; z<=zF-1; z+=1.8){\n      if (Math.hypot(x, z-ZP) < 2.7) continue;\n      ((Math.round(x/1.8) % 3 === 0) && (Math.round(z/1.8) % 3 === 0) ? panels : spots).push([x, z]);\n    }",
    "    for (let x=-Wx+2.2; x<=Wx-1.6; x+=3.6) for (let z=zB+1.6; z<=zF-1; z+=2.6){ if (Math.hypot(x, z-ZP) < 2.7) continue; panels.push([x, z]); }")
rep("const inst = (geo, mat, list, y, s=1, up=false) => { const im", "const inst = (geo, mat, list, y, s=1, up=false) => { if (!list.length) return; const im")
rep("new THREE.DirectionalLight('#ffe8d0', 0.8)", "new THREE.DirectionalLight('#ffffff', 0.72)")
rep("meshOf(AOL, aoMat(aoLin, .28))", "meshOf(AOL, aoMat(aoLin, .34))")
rep("meshOf(AOR, aoMat(aoRad, .36))", "meshOf(AOR, aoMat(aoRad, .46))")
# the hard strip of shade at the foot of each unit gives way to the soft floor shading drawn from the layout
rep("    { const z0 = d/2 + .32, z1 = d/2 - .02; quad(AOL, [F.at(x0-.05, .002, z0), F.at(x0+Wd+.05, .002, z0), F.at(x0+Wd+.05, .002, z1), F.at(x0-.05, .002, z1)], [0,1,0], C_WHITE, null, [0,0, 1,0, 1,1, 0,1]); }", "")




# step counter (HUD pill under the top bar) + its tick in the frame loop
rep('<button class="goCart" id="goCart"',
    '<button class="steps" id="steps" type="button" aria-label="عداد الخطوات والمكافآت"><span class="s-row"><span>👣</span><b id="stN">0</b><small>خطوة</small><i class="s-sep"></i><span>⏱</span><b id="stT">0:00</b><span id="stM"></span></span><span class="s-bar"><i id="stB"></i></span><small id="stL"></small></button>\n'
    '<button class="goCart" id="goCart"')
rep('.aisles{position:fixed;',
    '.steps{position:fixed;z-index:6;top:calc(env(safe-area-inset-top,0px) + 102px);left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:4px;padding:7px 14px 8px;border-radius:16px;border:1px solid var(--line);background:rgba(255,255,255,.93);box-shadow:0 8px 22px rgba(59,29,54,.14);font-family:inherit;color:var(--plum,#3b1d36);cursor:pointer;min-width:190px}\n'
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
    '.loading{background:#241a2b url(plan/loader2.webp) center/cover no-repeat}\n'
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
