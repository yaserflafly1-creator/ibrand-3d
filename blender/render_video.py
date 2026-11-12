# Renders a walk-through of the saved store model, frame by frame (resumable: frames already on disk are skipped).
# usage: python3 render_video.py store.blend outdir [width] [height] [samples] [fps] [first] [last]
import bpy, sys, os, math
from mathutils import Vector
blend, out = sys.argv[1], sys.argv[2]
RW = int(sys.argv[3]) if len(sys.argv) > 3 else 960
RH = int(sys.argv[4]) if len(sys.argv) > 4 else 540
SPP = int(sys.argv[5]) if len(sys.argv) > 5 else 16
FPS = int(sys.argv[6]) if len(sys.argv) > 6 else 24
bpy.ops.wm.open_mainfile(filepath=blend)
sc = bpy.context.scene
os.makedirs(out, exist_ok=True)

# camera path: (time s, position, look-at). In from the door, up the main walkway, through a beauty aisle,
# along the cross aisle, back through a wellness aisle, and up to the brand wall at the far end.
KEYS = [
    (0.0,  (0.0, 0.6, 1.65),   (0.0, 14.0, 1.9)),
    (4.0,  (0.0, 5.6, 1.65),   (0.3, 20.0, 1.75)),
    (7.0,  (0.2, 8.2, 1.62),   (6.0, 8.5, 1.35)),
    (11.0, (4.6, 8.3, 1.58),   (10.0, 8.5, 1.25)),
    (14.0, (7.9, 8.6, 1.6),    (8.1, 16.0, 1.5)),
    (18.0, (8.0, 16.6, 1.62),  (8.1, 26.0, 1.55)),
    (21.0, (7.8, 21.1, 1.6),   (2.0, 21.4, 1.3)),
    (25.0, (3.0, 21.3, 1.58),  (-4.0, 21.6, 1.4)),
    (28.0, (0.2, 21.9, 1.62),  (0.0, 32.0, 1.9)),
    (33.0, (0.0, 30.5, 1.65),  (0.0, 39.5, 2.9)),
    (36.0, (0.0, 34.0, 1.7),   (0.0, 40.0, 3.6)),
]
def cr(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
def at(t):
    n = len(KEYS)
    for i in range(n - 1):
        if t <= KEYS[i + 1][0] or i == n - 2:
            k = max(0, min(1, (t - KEYS[i][0]) / (KEYS[i + 1][0] - KEYS[i][0])))
            a, b, c, d = KEYS[max(0, i - 1)], KEYS[i], KEYS[i + 1], KEYS[min(n - 1, i + 2)]
            return cr(Vector(a[1]), Vector(b[1]), Vector(c[1]), Vector(d[1]), k), cr(Vector(a[2]), Vector(b[2]), Vector(c[2]), Vector(d[2]), k)

cam_d = bpy.data.cameras.new('CAM_walk'); cam_d.lens = 20; cam_d.sensor_width = 36
cam = bpy.data.objects.new('CAM_walk', cam_d); sc.collection.objects.link(cam); sc.camera = cam
if RH > RW: cam_d.sensor_fit = 'VERTICAL'; cam_d.lens = 24
sc.render.resolution_x, sc.render.resolution_y = RW, RH
sc.cycles.samples = SPP; sc.cycles.use_denoising = True
sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 92
N = int(KEYS[-1][0] * FPS)
first = int(sys.argv[7]) if len(sys.argv) > 7 else 0
last = int(sys.argv[8]) if len(sys.argv) > 8 else N
for f in range(first, last):
    fp = os.path.join(out, 'f%04d.jpg' % f)
    if os.path.exists(fp): continue
    p, l = at(f / FPS)
    cam.location = p; cam.rotation_euler = (l - p).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = fp
    bpy.ops.render.render(write_still=True)
    print('frame', f, flush=True)
print('DONE', flush=True)
