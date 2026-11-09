#!/usr/bin/env python3
# builds static/drone.html from index.html: free-flight drone camera instead of the pushed cart
import os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(root, 'index.html'), encoding='utf-8').read()

def rep(old, new, n=1):
    global s
    assert s.count(old) == n, ('ANCHOR MISS:', old[:70], s.count(old))
    s = s.replace(old, new)

rep('<title>صيدلية اي براند 3D</title>', '<title>صيدلية اي براند 3D — درون 🚁</title>')
rep('جملة الصيدليات • جولة ثلاثية الأبعاد', 'وضع الدرون التجريبي 🚁')

# altitude keys + on-screen buttons binding
rep("const keys = {f:0, b:0, sl:0, sr:0, tl:0, tr:0}, joy = {x:0, y:0};",
    "const keys = {f:0, b:0, sl:0, sr:0, tl:0, tr:0, up:0, down:0}, joy = {x:0, y:0};\n"
    "  [['#altUp','up'],['#altDn','down']].forEach(([sel, k]) => { const b = document.querySelector(sel); if (!b) return;\n"
    "    b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = 1; });\n"
    "    ['pointerup','pointercancel','pointerleave'].forEach(ev => b.addEventListener(ev, () => { keys[k] = 0; })); });")
rep("const KEYS = {ArrowUp:'f', KeyW:'f', ArrowDown:'b', KeyS:'b', ArrowLeft:'sl', KeyA:'sl', ArrowRight:'sr', KeyD:'sr', KeyQ:'tl', KeyE:'tr'};",
    "const KEYS = {ArrowUp:'f', KeyW:'f', ArrowDown:'b', KeyS:'b', ArrowLeft:'sl', KeyA:'sl', ArrowRight:'sr', KeyD:'sr', KeyQ:'tl', KeyE:'tr', Space:'up', KeyR:'up', ShiftLeft:'down', KeyF:'down'};")

# fly over the shelves when high enough
rep("function blocked(x, z){ return OBSTACLES.some(",
    "function blocked(x, z){ if (alt > 2.6) return false; return OBSTACLES.some(")

# altitude state + integration inside walk()
rep("const vel = {x:0, z:0}; let walkAmt = 0, bobT = 0;",
    "const vel = {x:0, z:0}; let walkAmt = 0, bobT = 0, alt = EYE, altV = 0;")
rep("    bobT += dt * (5 + 4 * walkAmt);\n  }",
    "    bobT += dt * (5 + 4 * walkAmt);\n"
    "    const tu = (keys.up - keys.down) * 2.1;\n"
    "    altV += (tu - altV) * Math.min(1, dt * 6);\n"
    "    alt = Math.max(.55, Math.min(4.35, alt + altV * dt));\n  }")
rep("camera.position.y = EYE;",
    "camera.position.y = alt + (reduceMotion ? 0 : Math.sin(bobT * 1.3) * .02);")

# drone is quicker than walking
rep("const sp = len < .08 ? 0 : (2.2 + (len > .92 ? .9 : 0));",
    "const sp = len < .08 ? 0 : (3.1 + (len > .92 ? 1.2 : 0));")

# no pushed cart in drone mode (shopping still works)
rep("scene.add(pushCart);", "scene.add(pushCart); pushCart.visible = false;")

# on-screen altitude buttons
rep('<button class="goCart" id="goCart"',
    '<div class="altBtns"><button id="altUp" type="button" aria-label="ارتفع">▲</button><button id="altDn" type="button" aria-label="انخفض">▼</button></div>\n'
    '<button class="goCart" id="goCart"')
rep('.goCart{position:fixed;',
    '.altBtns{position:fixed;z-index:6;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 150px);display:flex;flex-direction:column;gap:10px}\n'
    '.altBtns button{width:56px;height:56px;border-radius:18px;border:1px solid #f0d8e4;background:rgba(255,255,255,.95);font-weight:800;font-size:20px;color:#c9518b;box-shadow:0 10px 24px rgba(59,29,54,.2);touch-action:none}\n'
    '.goCart{position:fixed;')

out = os.path.join(root, 'static', 'drone.html')
open(out, 'w', encoding='utf-8').write(s)
print('drone.html written,', len(s), 'bytes')
