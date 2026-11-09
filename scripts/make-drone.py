#!/usr/bin/env python3
# builds static/drone.html from index.html: the same page, booting with drone mode already on.
# (drone mode itself now lives in index.html as a toggle; this page keeps the old /drone.html link alive)
import os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(root, 'index.html'), encoding='utf-8').read()

def rep(old, new, n=1):
    global s
    assert s.count(old) == n, ('ANCHOR MISS:', old[:70], s.count(old))
    s = s.replace(old, new)

rep('<title>صيدلية اي براند 3D</title>', '<title>صيدلية اي براند 3D — درون 🚁</title>')
rep('جملة الصيدليات • جولة ثلاثية الأبعاد', 'وضع الدرون التجريبي 🚁')

# start in drone mode
rep("  droneBtn.addEventListener('click', () => { droneBtn.blur(); setDrone(!droneMode); });",
    "  droneBtn.addEventListener('click', () => { droneBtn.blur(); setDrone(!droneMode); });\n"
    "  setDrone(true);")

out = os.path.join(root, 'static', 'drone.html')
open(out, 'w', encoding='utf-8').write(s)
print('drone.html written,', len(s), 'bytes')
