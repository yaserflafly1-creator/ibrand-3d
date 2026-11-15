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
.vg{position:fixed;inset:0;pointer-events:none;z-index:2;background:radial-gradient(ellipse at center, transparent 60%, rgba(42,15,38,.26) 100%)}
.spin{width:34px;height:34px;border-radius:50%;border:4px solid var(--pink-soft);border-top-color:var(--pink);animation:sp 1s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
</style>''')

# 3) vignette div
rep('<div id="stage" aria-label="صيدلية اي براند ثلاثية الأبعاد"></div>',
    '<div id="stage" aria-label="صيدلية اي براند ثلاثية الأبعاد"></div>\n<div class="vg"></div>')

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

  // ---------- loop ----------''')

# 13) head bob + composer render
rep('    camera.position.y = alt;',
    '    camera.position.y = alt + (reduceMotion || droneMode ? 0 : Math.sin(bobT * 2) * .013 * walkAmt);')
rep('''    renderer.render(scene, camera);''',
    '''    if (composer) composer.render(); else renderer.render(scene, camera);''')

if n_fail:
    for c, t in n_fail:
        print(f'FAILED (count={c}): {t}', file=sys.stderr)
    sys.exit(1)

open(DST, 'w', encoding='utf-8').write(s)
print('v2.html written,', len(s), 'bytes')
