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

# camera path: (time s, position, look-at). In from the door, up the main walkway, a turn into the wellness aisle.
KEYS = [
    (0.0,  (0.0, 0.6, 1.65),   (0.0, 14.0, 1.9)),
    (3.0,  (0.0, 7.5, 1.65),   (0.6, 20.0, 1.6)),
    (5.5,  (0.0, 14.0, 1.62),  (5.0, 22.0, 1.45)),
    (7.5,  (0.6, 18.3, 1.6),   (8.0, 19.0, 1.3)),
    (10.0, (5.2, 18.6, 1.55),  (12.0, 18.9, 1.25)),
    (12.0, (7.6, 18.6, 1.55),  (14.0, 20.2, 1.2)),
]
def smooth(t): return t * t * (3 - 2 * t)
def at(t):
    for i in range(len(KEYS) - 1):
        t0, p0, l0 = KEYS[i]; t1, p1, l1 = KEYS[i + 1]
        if t <= t1:
            k = smooth(max(0, min(1, (t - t0) / (t1 - t0))))
            return Vector(p0).lerp(Vector(p1), k), Vector(l0).lerp(Vector(l1), k)
    return Vector(KEYS[-1][1]), Vector(KEYS[-1][2])

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
