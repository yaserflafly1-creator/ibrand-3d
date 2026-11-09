#!/usr/bin/env python3
# Regenerate static/v2.html from index.html (v2 = bloom + floor reflection + smooth walk + head bob + minimap,
# plus v2-specific perf: lower initial dpr, mirror/composer stages in the adaptive-quality governor).
import sys

SRC = '/home/claude/ibrand-3d-git/index.html'
DST = '/home/claude/ibrand-3d-git/static/v2.html'

s = open(SRC, encoding='utf-8').read()
n_fail = []

def rep(old, new, cnt=1):
    global s
    if s.count(old) != cnt:
        n_fail.append((s.count(old), old[:80]))
        return
    s = s.replace(old, new)

# 1) title + badge
rep('<title>صيدلية اي براند 3D</title>', '<title>صيدلية اي براند 3D (v2)</title>')
rep('<small>جملة الصيدليات • جولة ثلاثية الأبعاد</small>',
    '<small>جولة ثلاثية الأبعاد • نسخة مطوّرة v2</small>')

# 2) CSS: minimap + vignette + spinner
rep('''  .pimg{height:140px}
}
</style>''', '''  .pimg{height:140px}
}
#minimap{position:fixed;z-index:5;top:calc(env(safe-area-inset-top,0px) + 78px);right:max(16px, env(safe-area-inset-right,0px));border:1px solid var(--line);border-radius:14px;box-shadow:0 10px 26px rgba(59,29,54,.18);background:rgba(255,255,255,.92);cursor:pointer}
.vg{position:fixed;inset:0;pointer-events:none;z-index:2;background:radial-gradient(ellipse at center, transparent 60%, rgba(42,15,38,.26) 100%)}
.spin{width:34px;height:34px;border-radius:50%;border:4px solid var(--pink-soft);border-top-color:var(--pink);animation:sp 1s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
@media (max-width:640px){
  #minimap{top:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 82px);right:max(12px, env(safe-area-inset-right,0px))}
  body.sheet #minimap{display:none}
}
</style>''')

# 3) vignette div
rep('<div id="stage" aria-label="صيدلية اي براند ثلاثية الأبعاد"></div>',
    '<div id="stage" aria-label="صيدلية اي براند ثلاثية الأبعاد"></div>\n<div class="vg"></div>')

# 4) minimap button in the toolbar
rep('    <button class="tbtn primary" id="cartBtn"',
    '''    <button class="tbtn" id="mmBtn" type="button" aria-pressed="false" aria-label="الخريطة"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg><span class="lbl">الخريطة</span></button>
    <button class="tbtn primary" id="cartBtn"''')

# 5) minimap canvas
rep('<nav class="aisles" aria-label="أقسام الصيدلية"><div class="row" id="chips"></div></nav>',
    '''<canvas id="minimap" hidden aria-label="خريطة الصيدلية: اضغط على مكان للانتقال إليه"></canvas>
<nav class="aisles" aria-label="أقسام الصيدلية"><div class="row" id="chips"></div></nav>''')

# 6) loading screen with logo + spinner
rep('<div class="loading" id="loading"><div>جاري تجهيز الصيدلية…<small id="loadingSub">نرتب المنتجات على الرفوف</small></div></div>',
    '<div class="loading" id="loading"><div style="display:flex;flex-direction:column;align-items:center;gap:14px"><img src="assets/logo.png" alt="" style="height:76px" onerror="this.remove()"><div class="spin"></div><div>جاري تجهيز الصيدلية…<small id="loadingSub">نرتب المنتجات على الرفوف</small></div></div></div>')

# 7) post-processing + reflector scripts
rep('<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/environments/RoomEnvironment.js"></script>',
    '''<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/environments/RoomEnvironment.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/objects/Reflector.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/CopyShader.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/LuminosityHighPassShader.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/FXAAShader.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/EffectComposer.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/MaskPass.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/RenderPass.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/ShaderPass.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/UnrealBloomPass.js"></script>''')

# 8) lower initial dpr on desktop (composer + mirror cost)
rep('renderer.setPixelRatio(Math.min(devicePixelRatio, isSmall ? 1.5 : (weakGPU ? 1.5 : 2)));',
    'renderer.setPixelRatio(Math.min(devicePixelRatio, isSmall ? 1.5 : (weakGPU ? 1.4 : 1.75)));')

# 9) floor mirror (named, so the governor can turn it off)
rep("  const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fl), new THREE.MeshStandardMaterial({map:tileTex, roughness:.16, metalness:.02, envMapIntensity:.75}));",
    '''  const useMirror = !isSmall && !weakGPU && !!THREE.Reflector;
  let floorMirror = null;
  if (useMirror){
    floorMirror = new THREE.Reflector(new THREE.PlaneGeometry(fw, fl), {textureWidth: Math.min(1280, innerWidth), textureHeight: Math.min(720, innerHeight), color: 0x9a9a9a, clipBias: 0.003});
    floorMirror.rotation.x = -Math.PI/2; floorMirror.position.set(0, -0.002, zMid); scene.add(floorMirror);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fl), new THREE.MeshStandardMaterial({map:tileTex, roughness:.16, metalness:.02, envMapIntensity:.75, transparent:useMirror, opacity:useMirror ? .88 : 1}));''')

# 10) smooth walk now lives in index.html itself; v2 only adds the head bob


# 11) governor: v2 desktop dpr steps + mirror/composer degrade stages + composer resize hook
rep('const DPRS = isSmall ? [1.5, 1.25, 1.0, .85] : (weakGPU ? [1.5, 1.25, 1.05, .9] : [2, 1.6, 1.35, 1.1]);',
    'const DPRS = isSmall ? [1.5, 1.25, 1.0, .85] : (weakGPU ? [1.4, 1.2, 1.0, .9] : [1.75, 1.45, 1.2, 1]);')
rep('    /*V2_PP_RESIZE*/', '    if (ppResize) ppResize();')
rep('    /*V2_EXTRA_DEGRADE*/',
    '''    if (floorMirror && floorMirror.visible){ floorMirror.visible = false; floor.material.transparent = false; floor.material.opacity = 1; floor.material.needsUpdate = true; return; }
    if (composer){ composer = null; return; }''')

# 12) composer + minimap block, inserted just before the render loop
rep('  // ---------- loop ----------',
    '''  // ---------- v2: cinematic bloom + FXAA on desktop ----------
  let composer = null, ppResize = null;
  if (!isSmall && THREE.EffectComposer && THREE.UnrealBloomPass){
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(stage.clientWidth, stage.clientHeight), .25, .5, .88));
    let fx = null;
    if (THREE.FXAAShader && THREE.ShaderPass){ fx = new THREE.ShaderPass(THREE.FXAAShader); composer.addPass(fx); }
    const sizePP = () => { if (!composer) return; composer.setSize(stage.clientWidth, stage.clientHeight); if (fx) fx.material.uniforms.resolution.value.set(1/(stage.clientWidth*renderer.getPixelRatio()), 1/(stage.clientHeight*renderer.getPixelRatio())); };
    ppResize = sizePP; sizePP(); addEventListener('resize', sizePP);
  }

  // ---------- v2: minimap (tap a spot to walk there) ----------
  const mm = $('#minimap'), mmBtn = $('#mmBtn');
  let mmOn = false;
  const MMW = isSmall ? 124 : 172, MMH = Math.max(90, Math.round(MMW * (zF - zB) / (2*Wx)));
  mm.width = MMW*2; mm.height = MMH*2; mm.style.width = MMW+'px'; mm.style.height = MMH+'px';
  const mmX = x => (x + Wx) / (2*Wx) * mm.width, mmZ = z => (z - zB) / (zF - zB) * mm.height;
  function mmDraw(){
    const x = mm.getContext('2d'); x.clearRect(0, 0, mm.width, mm.height);
    x.fillStyle = 'rgba(255,255,255,.95)'; x.fillRect(0, 0, mm.width, mm.height);
    x.fillStyle = '#f0c6da';
    OBSTACLES.forEach(o => {
      if (o.box){ const x0 = Math.max(-Wx, o.box.x0 + .3), x1 = Math.min(Wx, o.box.x1 - .3), z0 = Math.max(zB, o.box.z0 + .3), z1 = Math.min(zF, o.box.z1 - .3);
        if (x1 > x0 && z1 > z0) x.fillRect(mmX(x0), mmZ(z0), mmX(x1) - mmX(x0), mmZ(z1) - mmZ(z0)); }
      else { x.beginPath(); x.arc(mmX(o.x), mmZ(o.z), Math.max(2, (o.r - .2) / (2*Wx) * mm.width), 0, 7); x.fill(); }
    });
    x.fillStyle = '#1f9a55'; x.fillRect(mmX(DOOR_IN - 1.2), mm.height - 6, mmX(DOOR_IN + 1.2) - mmX(DOOR_IN - 1.2), 6);
    x.fillStyle = '#d92b3a'; x.fillRect(mmX(DOOR_OUT - 1.2), mm.height - 6, mmX(DOOR_OUT + 1.2) - mmX(DOOR_OUT - 1.2), 6);
    const px = mmX(camera.position.x), pz = mmZ(camera.position.z), ang = Math.atan2(-Math.cos(view.yaw), -Math.sin(view.yaw));
    x.strokeStyle = '#c9518b'; x.lineWidth = 3; x.beginPath(); x.moveTo(px, pz); x.lineTo(px + Math.cos(ang)*15, pz + Math.sin(ang)*15); x.stroke();
    x.fillStyle = '#c9518b'; x.beginPath(); x.arc(px, pz, 6, 0, 7); x.fill();
    x.strokeStyle = '#e3b7cd'; x.lineWidth = 2; x.strokeRect(1, 1, mm.width - 2, mm.height - 2);
  }
  function mmSet(on){ mmOn = on; mm.hidden = !on; mmBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); store.set('ib3d-mm', on); if (on) mmDraw(); }
  mmBtn.addEventListener('click', () => mmSet(!mmOn));
  mmSet(store.get('ib3d-mm', !isSmall));
  setInterval(() => { if (mmOn) mmDraw(); }, 150);
  mm.addEventListener('pointerdown', e => {
    const r = mm.getBoundingClientRect();
    const wx2 = (e.clientX - r.left) / r.width * 2*Wx - Wx, wz = zB + (e.clientY - r.top) / r.height * (zF - zB);
    if (!blocked(wx2, wz)){ camera.position.x = wx2; camera.position.z = wz; flight = null; hideHint(); setPano(false); }
  });

  // ---------- loop ----------''')

# 13) head bob + composer render
rep('    camera.position.y = alt + (droneMode && !reduceMotion ? Math.sin(bobT * 1.3) * .02 : 0);',
    '    camera.position.y = alt + (reduceMotion ? 0 : (droneMode ? Math.sin(bobT * 1.3) * .02 : Math.sin(bobT * 2) * .013 * walkAmt));')
rep('''    renderer.render(scene, camera);''',
    '''    if (composer) composer.render(); else renderer.render(scene, camera);''')

if n_fail:
    for c, t in n_fail:
        print(f'FAILED (count={c}): {t}', file=sys.stderr)
    sys.exit(1)

open(DST, 'w', encoding='utf-8').write(s)
print('v2.html written,', len(s), 'bytes')
