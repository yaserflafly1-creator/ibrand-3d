# Builds the iBrand pharmacy as a Blender scene (real fixture sizes) and renders stills.
# usage: python3 build_store.py <outdir> [samples] [width]
import bpy, bmesh, sys, math, random
from mathutils import Vector

out = sys.argv[1] if len(sys.argv) > 1 else '.'
SAMPLES = int(sys.argv[2]) if len(sys.argv) > 2 else 64
RESX = int(sys.argv[3]) if len(sys.argv) > 3 else 1280
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- store dimensions (metres) ----------
W, D, H = 36.0, 40.0, 6.2            # width (x), depth (y), ceiling
BW = 1.2                             # bay width
GD = 0.6                             # gondola depth (double sided)
GH = 1.8                             # gondola height
LEVELS = [.14, .56, .98, 1.40]       # 4 shelves
HEAD = .30                           # sign above each bay
AISLE = 2.0
WALL_H, WALL_D, WALL_LEVELS = 2.2, .5, [.14, .48, .82, 1.16, 1.50, 1.84]

def hexc(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c] + [1]

PINK, PLUM = '#e873a8', '#3b1d36'
ZONES = {'beauty': '#c53fb4', 'care': '#f28c1e', 'kids': '#2a6fdb', 'well': '#27a84a', 'rx': '#14a3b5'}

mats = {}
def mat(name, col, rough=.5, emit=0, metal=0):
    if name in mats: return mats[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = hexc(col) if isinstance(col, str) else col
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = hexc(col) if isinstance(col, str) else col
        b.inputs['Emission Strength'].default_value = emit
    mats[name] = m
    return m

class Builder:
    def __init__(self, name):
        self.name, self.v, self.f, self.mi, self.ms = name, [], [], [], []
    def midx(self, m):
        if m not in self.ms: self.ms.append(m)
        return self.ms.index(m)
    def box(self, x0, y0, z0, x1, y1, z1, m):
        n = len(self.v)
        self.v += [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        self.f += [(n, n + 3, n + 2, n + 1), (n + 4, n + 5, n + 6, n + 7), (n, n + 1, n + 5, n + 4),
                   (n + 1, n + 2, n + 6, n + 5), (n + 2, n + 3, n + 7, n + 6), (n + 3, n, n + 4, n + 7)]
        self.mi += [self.midx(m)] * 6
    def done(self):
        me = bpy.data.meshes.new(self.name)
        me.from_pydata(self.v, [], self.f)
        for m in self.ms: me.materials.append(m)
        me.polygons.foreach_set('material_index', self.mi)
        me.update()
        ob = bpy.data.objects.new(self.name, me)
        scene.collection.objects.link(ob)
        return ob

M_WHITE = mat('fix_white', '#f4f2f3', .45)
M_SHELF = mat('fix_shelf', '#ffffff', .35)
M_PLUM = mat('plum', PLUM, .45)
M_PINK = mat('pink', PINK, .4)
M_STRIP = mat('price_strip', '#ffffff', .3)
ZM = {k: mat('zone_' + k, v, .4) for k, v in ZONES.items()}

# product palette: packaging-like colours, mostly light with accents
PAL = ['#ffffff', '#f7f3ee', '#fde8ef', '#e6f1fb', '#eaf6ea', '#fff3d6', '#e873a8', '#c53fb4', '#2a6fdb', '#14a3b5',
       '#27a84a', '#f28c1e', '#e23b3b', '#6b3fa0', '#1d2f5e', '#f6c945', '#8fd3e8', '#f4a9c4', '#b9e0a5', '#444a55']
PM = [mat('prod%d' % i, c, .38) for i, c in enumerate(PAL)]

import os
TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
class Signs:
    """textured rectangles (signs, labels, logo), one mesh per image"""
    def __init__(self): self.d = {}
    def plane(self, img, c, fwd, w, h, uv=(0, 0, 1, 1), up=(0, 0, 1)):
        # fwd = the direction the viewer looks when reading the sign
        f, u = Vector(fwd), Vector(up); r = f.cross(u).normalized()
        c = Vector(c); a = c - r * w / 2 - u * h / 2
        q = self.d.setdefault(img, {'v': [], 'f': [], 'uv': []})
        n = len(q['v']); q['v'] += [tuple(a), tuple(a + r * w), tuple(a + r * w + u * h), tuple(a + u * h)]
        q['f'].append((n, n + 1, n + 2, n + 3)); u0, v0, u1, v1 = uv; q['uv'] += [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    def done(self):
        for img, q in self.d.items():
            me = bpy.data.meshes.new('SIGN_' + img); me.from_pydata(q['v'], [], q['f'])
            uvl = me.uv_layers.new(name='uv')
            for i, l in enumerate(me.loops): uvl.data[i].uv = q['uv'][l.vertex_index]
            m = bpy.data.materials.new('sign_' + img); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
            t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(os.path.join(TEX, img + '.png'))
            nt.links.new(t.outputs['Color'], b.inputs['Base Color']); nt.links.new(t.outputs['Color'], b.inputs['Emission Color'])
            b.inputs['Emission Strength'].default_value = .22; b.inputs['Roughness'].default_value = .45
            if img.startswith('floor_'): nt.links.new(t.outputs['Alpha'], b.inputs['Alpha']); b.inputs['Emission Strength'].default_value = 0
            me.materials.append(m); me.update()
            scene.collection.objects.link(bpy.data.objects.new('SIGN_' + img, me))
signs = Signs()
fix = Builder('FIX_gondolas')
prod = Builder('PROD_boxes')

def fill_shelf(x0, x1, yf, yb, z, gap, facing):
    """row of product boxes on a shelf; yf = front edge, yb = back edge (facing = -1 if front is at lower y)"""
    x = x0 + .015
    depth = abs(yb - yf) - .03
    while True:
        w = random.choice([.05, .06, .07, .08, .09, .1, .12, .14])
        h = min(gap - .05, random.uniform(.09, .30))
        n = random.choice([1, 2, 2, 3, 3, 4])           # facings of the same product
        m = random.choice(PM[:6]) if random.random() < .45 else random.choice(PM)
        for _ in range(n):
            if x + w > x1 - .015: return
            ya, yb2 = (yf + .012, yf + .012 + depth) if facing < 0 else (yf - .012 - depth, yf - .012)
            prod.box(x, ya, z, x + w - .006, yb2, z + h, m)
            x += w
        x += random.choice([0, 0, .004])

def gondola_bay(x, y, zone):
    """double-sided bay: x = left edge, y = centre line"""
    zm = ZM[zone]
    hd = GD / 2
    fix.box(x, y - hd, 0, x + BW, y + hd, LEVELS[0] - .02, zm)                  # kick / base
    fix.box(x, y - .015, 0, x + BW, y + .015, GH, M_WHITE)                      # back panel
    fix.box(x + .02, y - .03, GH, x + BW - .02, y + .03, GH + HEAD, zm)         # header sign
    bi = int(round(x / BW)) + int(round(y / PITCH)) * 3
    for s2 in (-1, 1):
        r = (bi + (1 if s2 > 0 else 0)) % 4
        signs.plane('hdr_' + zone, (x + BW / 2, y + s2 * .033, GH + HEAD / 2), (0, -s2, 0), BW - .14, HEAD - .05, (0, 1 - (r + 1) / 4, 1, 1 - r / 4))
    for i, z in enumerate(LEVELS):
        gap = (LEVELS[i + 1] if i + 1 < len(LEVELS) else GH) - z
        for s in (-1, 1):
            fix.box(x, min(y, y + s * hd), z - .02, x + BW, max(y, y + s * hd), z, M_SHELF)
            ye = y + s * hd
            fix.box(x, min(ye, ye - s * .004), z - .045, x + BW, max(ye, ye - s * .004) + (0 if s > 0 else 0), z - .0, M_STRIP)
            fill_shelf(x, x + BW, ye, y + s * .015, z, gap, -1 if s < 0 else 1)

def run(x0, bays, y, zone):
    for b in range(bays): gondola_bay(x0 + b * BW, y, zone)
    for xe in (x0 - .03, x0 + bays * BW):                                        # end panels
        fix.box(xe, y - GD / 2, 0, xe + .03, y + GD / 2, GH, M_WHITE)
        fix.box(xe, y - GD / 2, GH, xe + .03, y + GD / 2, GH + HEAD, ZM[zone])
        fix.box(xe - .002, y - GD / 2, 0, xe + .032, y + GD / 2, LEVELS[0] - .02, ZM[zone])
    for b in range(bays + 1):                                                    # uprights
        fix.box(x0 + b * BW - .012, y - .02, 0, x0 + b * BW + .012, y + .02, GH, M_WHITE)

def wall_bay(a, fixed, axis, sgn, zone):
    """wall unit: a = start along the wall, fixed = wall coordinate, sgn = direction the unit faces"""
    def bx(u0, u1, d0, d1, z0, z1, m, b=fix):
        lo, hi = sorted((fixed + sgn * d0, fixed + sgn * d1))
        if axis == 'x': b.box(u0, lo, z0, u1, hi, z1, m)
        else: b.box(lo, u0, z0, hi, u1, z1, m)
    bx(a, a + BW, 0, .03, 0, WALL_H, M_WHITE)
    bx(a, a + BW, 0, WALL_D, 0, WALL_LEVELS[0] - .02, ZM[zone])
    bx(a + .02, a + BW - .02, 0, .08, WALL_H, WALL_H + HEAD, ZM[zone])
    for i, z in enumerate(WALL_LEVELS):
        gap = (WALL_LEVELS[i + 1] if i + 1 < len(WALL_LEVELS) else WALL_H) - z
        bx(a, a + BW, .03, WALL_D, z - .02, z, M_SHELF)
        u = a + .015
        while True:
            w = random.choice([.05, .06, .07, .08, .1, .12, .14]); h = min(gap - .05, random.uniform(.09, .26))
            m = random.choice(PM[:6]) if random.random() < .45 else random.choice(PM)
            stop = False
            for _ in range(random.choice([1, 2, 3, 3, 4])):
                if u + w > a + BW - .015: stop = True; break
                bx(u, u + w - .006, .05, WALL_D - .02, z, z + h, m, prod)
                u += w
            if stop: break

# ---------- floor gondolas: 2 wings x 2 runs x 12 rows ----------
ROWS, Y0, PITCH, BAYS = 12, 7.0, GD + AISLE, 5
LEFT = ['beauty'] * 4 + ['care'] * 4 + ['kids'] * 4
RIGHT = ['beauty'] * 4 + ['well'] * 4 + ['rx'] * 4
for r in range(ROWS):
    y = Y0 + r * PITCH
    for x0 in (1.0, 1.0 + BAYS * BW + AISLE):
        run(x0, BAYS, y, RIGHT[r])
        run(-x0 - BAYS * BW, BAYS, y, LEFT[r])
YEND = Y0 + (ROWS - 1) * PITCH

# ---------- wall units ----------
def zone_at(y, side): return (LEFT if side < 0 else RIGHT)[max(0, min(ROWS - 1, int((y - Y0 + PITCH / 2) / PITCH)))]
y = 5.0
while y + BW < D - .6:
    wall_bay(y, -W / 2, 'y', 1, zone_at(y, -1)); wall_bay(y, W / 2, 'y', -1, zone_at(y, 1)); y += BW
x = -W / 2 + .6
while x + BW < W / 2 - .6:
    wall_bay(x, D, 'x', -1, 'kids' if x < -1.2 else ('rx' if x > 0 else 'kids')); x += BW

# ---------- shell ----------
shell = Builder('ENV_shell')
M_FLOOR = mat('floor', '#d8d5d2', .14)
_nt = M_FLOOR.node_tree; _b = _nt.nodes['Principled BSDF']
_g = _nt.nodes.new('ShaderNodeNewGeometry'); _br = _nt.nodes.new('ShaderNodeTexBrick')
_br.offset = 0; _br.inputs['Scale'].default_value = 1; _br.inputs['Brick Width'].default_value = .6; _br.inputs['Row Height'].default_value = .6
_br.inputs['Mortar Size'].default_value = .004
_br.inputs['Color1'].default_value = hexc('#dedbd8'); _br.inputs['Color2'].default_value = hexc('#d6d3d0'); _br.inputs['Mortar'].default_value = hexc('#bdb9b6')
_nt.links.new(_g.outputs['Position'], _br.inputs['Vector']); _nt.links.new(_br.outputs['Color'], _b.inputs['Base Color'])
M_WALL = mat('wall', '#f6f1f3', .7)
M_CEIL = mat('ceiling', '#fbfbfb', .8)
M_LIGHT = mat('light_panel', '#fff7f0', .5, emit=9)
shell.box(-W / 2, 0, -.1, W / 2, D, 0, M_FLOOR)
shell.box(-W / 2, 0, H, W / 2, D, H + .1, M_CEIL)
shell.box(-W / 2 - .1, 0, 0, -W / 2, D, H, M_WALL); shell.box(W / 2, 0, 0, W / 2 + .1, D, H, M_WALL)
shell.box(-W / 2, D, 0, W / 2, D + .1, H, M_WALL); shell.box(-W / 2, -.1, 0, W / 2, 0, H, M_WALL)
# brand band round the top of the walls
for (a, b, c, d) in ((-W / 2, D - .02, W / 2, D), (-W / 2, 0, -W / 2 + .02, D), (W / 2 - .02, 0, W / 2, D)):
    shell.box(a, b, 3.0, c, d, 4.6, M_PLUM); shell.box(a - (.005 if a > 0 else -.005) * 0, b, 2.9, c, d, 3.0, M_PINK)
# zone-coloured floor band down each aisle side of the central walkway
for r in range(ROWS):
    yy = Y0 + r * PITCH
    for side, zs in ((-1, LEFT), (1, RIGHT)):
        xa, xb = (1.0, W / 2 - WALL_D - AISLE) if side > 0 else (-W / 2 + WALL_D + AISLE, -1.0)
        shell.box(xa, yy - GD / 2 - .05, 0, xb, yy + GD / 2 + .05, .002, ZM[zs[r]])
# ceiling light panels
yy = 2.0
while yy < D - 1:
    xx = -W / 2 + 2.4
    while xx < W / 2 - 2:
        shell.box(xx, yy, H - .03, xx + 1.2, yy + .6, H - .001, M_LIGHT); xx += 3.6
    yy += 2.6
# cashier counter near the entrance
shell.box(6.0, 2.2, 0, 11.0, 2.9, 1.0, M_PLUM); shell.box(5.95, 2.15, 1.0, 11.05, 2.95, 1.05, M_PINK)
shell.box(-11.0, 2.2, 0, -6.0, 2.9, 1.0, M_PLUM); shell.box(-11.05, 2.15, 1.0, -5.95, 2.95, 1.05, M_PINK)

# ---------- signs: hanging zone banners, wall boards, logo, cashier, floor names ----------
M_WIRE = mat('wire', '#9aa0a6', .4, metal=.8)
def first_row(zs, z): return zs.index(z)
for side, zs in ((-1, LEFT), (1, RIGHT)):
    for z in dict.fromkeys(zs):
        r0 = first_row(zs, z); n = zs.count(z)
        yy = Y0 + r0 * PITCH - PITCH / 2 - (.9 if r0 == 0 else 0)
        for xc in (side * 4.0, side * 12.0):
            signs.plane('zone_' + z, (xc, yy, 3.25), (0, 1, 0), 3.2, 1.2)
            signs.plane('zone_' + z, (xc, yy + .03, 3.25), (0, -1, 0), 3.2, 1.2)
            shell.box(xc - 1.6, yy, 2.63, xc + 1.6, yy + .03, 3.87, M_SHELF)
            for wx in (xc - 1.4, xc + 1.4): shell.box(wx - .006, yy + .009, 3.85, wx + .006, yy + .021, H, M_WIRE)
        # zone name printed on the floor of the cross aisle
        signs.plane('floor_' + z, (side * (1.0 + BAYS * BW + AISLE / 2), Y0 + (r0 + n / 2 - .5) * PITCH + PITCH / 2, .004), (0, 0, -1), 1.7, .42, up=(0, 1, 0))
for i, bx in enumerate((-10.5, 0, 10.5)):
    signs.plane('board_%d' % (i + 1), (bx, D - .03, 3.8), (0, 1, 0), 2.9, 1.45)
for lx in (-5.25, 5.25): signs.plane('logo', (lx, D - .03, 3.8), (0, 1, 0), 1.3, 1.3)
for sx, wall in ((-1, -W / 2 + .03), (1, W / 2 - .03)):
    for ly in (10.0, 20.0, 30.0): signs.plane('logo', (wall, ly, 3.8), (sx, 0, 0), 1.3, 1.3)
for cx in (8.5, -8.5):
    signs.plane('cashier', (cx, 2.19, .55), (0, 1, 0), 2.4, .6); signs.plane('cashier', (cx, 2.91, .55), (0, -1, 0), 2.4, .6)
    signs.plane('logo', (cx, .06, 3.8), (0, -1, 0), 1.3, 1.3)
# logo on the end panel of every run facing the main walkway
for r in range(ROWS):
    for sx in (-1, 1): signs.plane('logo', (sx * (1.0 - .034), Y0 + r * PITCH, 1.3), (sx, 0, 0), .42, .42)
for b in (fix, prod, shell): b.done()
signs.done()

# ---------- brand lettering on the back wall ----------
def text(body, loc, size, m, rot=(math.pi / 2, 0, 0)):
    cu = bpy.data.curves.new(body, 'FONT'); cu.body = body; cu.size = size; cu.extrude = .03
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    ob = bpy.data.objects.new('TXT_' + body, cu); ob.location = loc; ob.rotation_euler = rot
    ob.data.materials.append(m); scene.collection.objects.link(ob); return ob

# ---------- world + cameras ----------
world = bpy.data.worlds.new('W'); world.use_nodes = True; scene.world = world
world.node_tree.nodes['Background'].inputs[0].default_value = (1, .97, .96, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = .35

def cam(name, loc, look, lens):
    c = bpy.data.cameras.new(name); c.lens = lens; c.sensor_width = 36
    ob = bpy.data.objects.new(name, c); ob.location = loc
    ob.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(ob); return ob
CAMS = [cam('CAM_entrance', (0, .45, 1.7), (0, 30, 2.0), 18),
        cam('CAM_overview', (-15.5, 1.5, 5.3), (4, 24, .2), 17),
        cam('CAM_aisle', (4.2, Y0 + 4 * PITCH + PITCH / 2, 1.55), (16, Y0 + 4 * PITCH + PITCH / 2 + .1, 1.2), 20)]

scene.render.engine = 'CYCLES'
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 5
scene.render.resolution_x, scene.render.resolution_y = RESX, int(RESX * 9 / 16)
scene.view_settings.view_transform = 'AgX'
try: scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception as e: print('look', e)
scene.view_settings.exposure = float(sys.argv[4]) if len(sys.argv) > 4 else 0
scene.render.image_settings.file_format = 'JPEG'; scene.render.image_settings.quality = 90

only = sys.argv[5].split(',') if len(sys.argv) > 5 else None
for c in CAMS:
    if only and c.name not in only: continue
    scene.camera = c
    scene.render.filepath = '%s/%s.jpg' % (out, c.name)
    bpy.ops.render.render(write_still=True)
print('boxes', len(prod.v) // 8, 'fixture boxes', len(fix.v) // 8)
if len(sys.argv) > 6: bpy.ops.wm.save_as_mainfile(filepath=sys.argv[6])
