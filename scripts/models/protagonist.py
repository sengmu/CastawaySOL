"""
Protagonist 3D Model Generator (Island Survivor Variant / 荒岛款) — round 3 (director P0/P1 fix pass)
Target: docs/model-art-spec.md 修订篇二 1a + protagonist-director-review.md. QA: docs/qa/model-protagonist3/.

What changed vs. round 2 (docs/qa/model-protagonist2):
- Proportions back to the spec 3.5 heads: head 29% / torso 34% / legs 37% (chin 1.0585, round-1 joints).
- Hair rebuilt as the spec's round cap + THREE separate round tufts (top / side / back), each
  28-35% of the head width, neighbouring tufts overlapping 15-25%; hairline is one big arc, no fringe.
- One chunky leaf plate (30% x 18% of head width, >= 2% H thick), upper back of the head.
- Torn edges = 2-3 big raised-cosine notches per opening (width >= 5% H, depth >= 2% H, min corner
  radius >= 2% H); no zig-zag. Sleeves per the director: left ends at 30% of the upper arm,
  right reaches mid-forearm. Trousers: left 60% down the shin, right 35% down the thigh.
- Textures are flat spec colours (spec: "纯色平涂, 明暗全部来自光照"); nothing baked into the albedo.
  Face: plain dark-brown oval eyes, blush discs, smile arc (spec 修订三 sizes, measured in metres).
- Renders keep the round-1/2 camera, lights and world; colour management is set to Standard
  (round 1/2 used Blender's default AgX, which desaturates and lifts every colour; see REPORT.md).

Skeleton contract: identical 45-bone armature (names + hierarchy) from NpcNmlCat23.dae, bones only
TRANSLATED (orientation/roll unchanged), rigid 100% weights to the same 10 driving bones.

Run from repo root:
  blender --background --python scripts/models/protagonist.py
(Blender builds the mesh, then calls the system python3 on this same file with --paint, which
 needs PIL + numpy; Blender's bundled python has no PIL.)
"""

import math
import os
import sys
import json
import subprocess

try:
    import bpy
    import bmesh
    from mathutils import Vector, Matrix
    from mathutils.bvhtree import BVHTree
    from mathutils.geometry import barycentric_transform
    IN_BLENDER = True
except ImportError:
    IN_BLENDER = False

# ==============================================================================
# 0. SHARED PARAMETERS (used by both the Blender builder and the PIL painter)
# ==============================================================================
H = 1.4908                     # pilot bbox height -> keep identical
OUTPUT_GLB = "public/models/protagonist.glb"
BODY_PNG = "public/models/protagonist_body.png"
FACE_PNG = "public/models/protagonist_face.png"
QA_DIR = "docs/qa/model-protagonist3"
WORK = os.path.expanduser("~/.cache/castaway-protag/p3")   # intermediates (outside repo)
ATLAS_N = 512                  # flat colours only -> spec size
FACE_N = 1024                  # painted face features need the resolution

HEX = {
    'skin': 'E8B88C', 'hair': 'B08158', 'shirt': '8DC4DA', 'patch': 'E8C072',
    'trousers': 'C9A57A', 'leaf': '8CCB5E', 'dark': '6B4A32', 'nose': 'DB9A78', 'blush': 'F7B6C8',
}

# ---- Spec proportions (修订篇一: 3.5 heads) ----
HEAD_H = H * 0.29              # chin -> top of the hair
TORSO_H = H * 0.34
CHIN_Z = H - HEAD_H            # 1.0585
HEAD_W = H * 0.318             # head width incl. hair (= glb-measured 0.474 m; spec ~31%): unit for face/hair sizes

# ---- Skull (Z-up, front = -Y, +X = character's left) ----
SK_RX, SK_RY, SK_RZ = 0.196, 0.182, 0.168
CHIN_FLAT = 0.94               # lower half of the skull is slightly squashed (round chin)
BULGE = 0.06                   # lower half widened (chubby cheeks)
SK_ZC = CHIN_Z + SK_RZ * CHIN_FLAT

# ---- Face (spec 修订三 + director P1), metres in the front view; z measured from the hair top ----
EYE_W = HEAD_W * 0.09          # eye diameter (width); plain oval, a little taller than wide
EYE_H = EYE_W * 1.18
EYE_DX = HEAD_W * 0.36 / 2     # half the eye spacing (centre to centre)
EYE_ZC = H - HEAD_H * 0.55     # eye centre 55% down from the top of the head
NOSE_ZC = H - HEAD_H * 0.66
NOSE_W = HEAD_W * 0.08
BLUSH_D = HEAD_W * 0.12
BLUSH_DX = EYE_DX + 0.022      # under the eye, a little outward
BLUSH_ZC = H - HEAD_H * 0.70
MOUTH_ZC = H - HEAD_H * 0.78
MOUTH_HALF = HEAD_W * 0.22 / 2
MOUTH_THICK = HEAD_W * 0.04
MOUTH_LIFT = 0.016             # corners above the centre


def skull_pt(a_deg, p_deg):
    """Point on the skull at azimuth a (0 = front, +90 = char left) and polar p (0 = top)."""
    a, p = math.radians(a_deg), math.radians(p_deg)
    zn = math.cos(p)
    k = 1.0 + BULGE * max(0.0, -zn)
    zf = CHIN_FLAT if zn < 0 else 1.0
    return (SK_RX * k * math.sin(p) * math.sin(a), -SK_RY * k * math.sin(p) * math.cos(a),
            SK_ZC + SK_RZ * zn * zf)


def face_u(a):
    m = abs(a)
    d = 0.4 * m / 90.0 if m <= 90 else 0.4 + 0.1 * (m - 90) / 90.0
    return 0.5 + math.copysign(d, a)


def face_v(p):
    return 1.0 - 0.08 * p / 50.0 if p <= 50 else 0.92 * (1.0 - (p - 50) / 130.0)


# ==============================================================================
# PAINTER (system python3 + PIL + numpy):  python3 protagonist.py --paint
# ==============================================================================
FLAT = {  # atlas part kind -> palette key (flat fill; spec: no strands, seams, stitches or shading)
    'skin': 'skin', 'ear': 'skin', 'foot': 'skin', 'neck': 'skin', 'nose': 'nose',
    'hair': 'hair', 'hair_cap': 'hair', 'rope': 'hair', 'leaf': 'leaf',
    'shirt': 'shirt', 'sleeve': 'shirt', 'patch': 'patch',
    'pants': 'trousers', 'pants_seat': 'trousers',
}


def run_painter():
    import numpy as np
    from PIL import Image, ImageDraw

    meta = json.load(open(os.path.join(WORK, "atlas.json")))

    def rgb(key_or_hex):
        h = HEX.get(key_or_hex, key_or_hex)
        return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)])

    def sstep(e0, e1, x):
        t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
        return t * t * (3 - 2 * t)

    def mix(a, b, w):
        w = w[..., None] if np.ndim(w) == 2 else w
        return a * (1 - w) + b * w

    # ---------------------------------------------------------------- body atlas: flat blocks
    N = ATLAS_N
    canvas = np.zeros((N, N, 3))
    canvas[:] = rgb('skin')
    PAD = meta['pad']
    owner = np.full((N, N), -1, dtype=np.int32)
    for i, part in enumerate(meta['parts']):
        x0, y0, w, h = part['px']                       # y from the bottom (Blender UV)
        xa, xb = max(x0 - PAD, 0), min(x0 + w + PAD, N)
        ya, yb = max(y0 - PAD, 0), min(y0 + h + PAD, N)
        rows = slice(N - yb, N - ya)
        cols = slice(xa, xb)
        core = np.zeros((yb - ya, xb - xa), dtype=bool)
        core[(N - (y0 + h)) - (N - yb):(N - y0) - (N - yb), x0 - xa:x0 + w - xa] = True
        own = owner[rows, cols]
        write = core | (own < 0)
        canvas[rows, cols][write] = rgb(FLAT[part['kind']])
        own[core] = i
    Image.fromarray((canvas * 255 + 0.5).astype(np.uint8)).save(BODY_PNG, optimize=True)

    # ---------------------------------------------------------------- face texture
    F = FACE_N
    us = (np.arange(F) + 0.5) / F
    vs = 1.0 - (np.arange(F) + 0.5) / F               # image row 0 = top = v 1
    U, V = np.meshgrid(us, vs)
    d = np.abs(U - 0.5)
    A = np.where(d <= 0.4, d / 0.4 * 90.0, 90.0 + (d - 0.4) / 0.1 * 90.0) * np.sign(U - 0.5)
    P = np.where(V >= 0.92, (1 - V) / 0.08 * 50.0, 50.0 + (1 - V / 0.92) * 130.0)
    ar, pr = np.radians(A), np.radians(P)
    zn = np.cos(pr)
    k = 1.0 + BULGE * np.maximum(0, -zn)
    X3 = SK_RX * k * np.sin(pr) * np.sin(ar)
    Y3 = -SK_RY * k * np.sin(pr) * np.cos(ar)
    Z3 = SK_ZC + SK_RZ * zn * np.where(zn < 0, CHIN_FLAT, 1.0)
    front = (Y3 < 0).astype(np.float64)
    aa = 0.0012                                         # anti-alias half-width, metres

    face = np.ones((F, F, 3)) * rgb('skin')
    for sx in (-1, 1):
        db = np.sqrt((X3 - sx * BLUSH_DX) ** 2 + (Z3 - BLUSH_ZC) ** 2)
        face = mix(face, rgb('blush'), front * (1 - sstep(BLUSH_D / 2 - aa, BLUSH_D / 2 + aa, db)))
        de = np.sqrt(((X3 - sx * EYE_DX) / (EYE_W / 2)) ** 2 + ((Z3 - EYE_ZC) / (EYE_H / 2)) ** 2)
        face = mix(face, rgb('dark'), front * (1 - sstep(1 - aa / (EYE_W / 2), 1 + aa / (EYE_W / 2), de)))
    mxs = np.linspace(-MOUTH_HALF + MOUTH_THICK / 2, MOUTH_HALF - MOUTH_THICK / 2, 48)
    mzs = MOUTH_ZC - MOUTH_LIFT / 3 + MOUTH_LIFT * (mxs / (MOUTH_HALF - MOUTH_THICK / 2)) ** 2
    dmin = np.full(X3.shape, 9.0)
    for px_, pz_ in zip(mxs, mzs):
        dmin = np.minimum(dmin, np.sqrt((X3 - px_) ** 2 + (Z3 - pz_) ** 2))
    face = mix(face, rgb('dark'), front * (1 - sstep(MOUTH_THICK / 2 - aa, MOUTH_THICK / 2 + aa, dmin)))
    Image.fromarray((face * 255 + 0.5).astype(np.uint8)).save(FACE_PNG, optimize=True)

    # ---------------------------------------------------------------- UV self-check (outside repo)
    chk = Image.fromarray((face * 255 + 0.5).astype(np.uint8)).convert('RGB')
    dr = ImageDraw.Draw(chk)
    for (u0, v0, u1, v1) in meta['face_uv_edges']:
        dr.line([(u0 * F, (1 - v0) * F), (u1 * F, (1 - v1) * F)], fill=(40, 90, 200), width=1)
    for lm in meta['face_landmarks']:
        cx, cy = lm['uv'][0] * F, (1 - lm['uv'][1]) * F
        dr.line([(cx - 14, cy), (cx + 14, cy)], fill=(0, 200, 60), width=2)
        dr.line([(cx, cy - 14), (cx, cy + 14)], fill=(0, 200, 60), width=2)
    chk.save(os.path.join(WORK, "uv_face_check.png"))
    print("[painter] wrote", BODY_PNG, FACE_PNG)


if not IN_BLENDER:
    if "--paint" in sys.argv:
        run_painter()
    sys.exit(0)

# ==============================================================================
# BLENDER BUILD
# ==============================================================================
os.makedirs(QA_DIR, exist_ok=True)
os.makedirs(WORK, exist_ok=True)

# ---- Torso / pelvis ----
CROTCH_Z = CHIN_Z - TORSO_H    # ~0.5516
SHIRT_HEM_Z = 0.600
BELT_Z = 0.672

# ---- Joints (L side, mirrored with sign) — round-1 values (3.5 heads) ----
SHOULDER = Vector((0.172, 0.000, 0.918))
ELBOW = Vector((0.234, 0.000, 0.760))
WRIST = Vector((0.280, -0.005, 0.628))
HIP = Vector((0.096, 0.000, 0.580))
KNEE = Vector((0.098, -0.005, 0.300))
ANKLE = Vector((0.098, 0.000, 0.085))

# Spec limb sizes: arm Ø 8% H, leg Ø 10% H, hand ball Ø 9% H, foot length 14% H
ARM_R_UP, ARM_R_ELB, ARM_R_WRIST = H * 0.08 / 2 + 0.002, H * 0.08 / 2, H * 0.08 / 2 - 0.004
HAND_R = H * 0.09 / 2.0
THIGH_R, KNEE_R, ANKLE_R = H * 0.10 / 2 + 0.006, H * 0.10 / 2 - 0.001, H * 0.10 / 2 - 0.006
FOOT_L = H * 0.14
CLOTH = 0.014

# Director / spec: left sleeve ends at 30% of the upper arm, right sleeve at mid forearm
L_SLEEVE_T = 0.30
R_SLEEVE_T = 0.50
# Trousers: left 60% down the shin (below the knee), right 35% down the thigh (above the knee)
L_PANT_T = 0.60
R_PANT_T = 0.35

# Torn openings: (s centre around the ring, width m, depth m). s=0.5 faces front on limbs.
# Raised-cosine notch: min radius of curvature = w^2 / (2 pi^2 d)  (spec: >= 2% H = 0.0298 m)
NOTCH_MIN_W, NOTCH_MIN_D, NOTCH_MIN_R = H * 0.05, H * 0.02, H * 0.02
NOTCHES = {
    'shirt': [(0.69, 0.180, 0.045), (0.86, 0.170, 0.042), (0.30, 0.180, 0.042)],   # s=0.75 = front
    'sleeve_L': [(0.50, 0.170, 0.042), (0.06, 0.160, 0.038)],
    'sleeve_R': [(0.44, 0.170, 0.042), (0.90, 0.160, 0.038)],
    'pants_L': [(0.52, 0.175, 0.044), (0.10, 0.165, 0.040)],
    'pants_R': [(0.47, 0.175, 0.044), (0.86, 0.165, 0.040), (0.18, 0.160, 0.038)],
}
HEM_STATS = {}


def mirror(v, sign):
    return Vector((v.x * sign, v.y, v.z))


# ==============================================================================
# 1. SKELETON (same source + transform as pilot; translate only)
# ==============================================================================
print("[Protagonist] Step 1: Loading baseline Collada skeleton...")
bpy.ops.wm.read_factory_settings(use_empty=True)
dae_path = "public/models/npcs/Model/NpcNmlCat23.Nin_NX_NVN/NpcNmlCat23.dae"
bpy.ops.wm.collada_import(filepath=dae_path)

armature = None
for obj in list(bpy.data.objects):
    if obj.type == 'MESH':
        bpy.data.objects.remove(obj, do_unlink=True)
    elif obj.type == 'ARMATURE':
        armature = obj
if not armature:
    raise RuntimeError("Failed to extract Armature from " + dae_path)

armature.scale = (0.1, 0.1, 0.1)
bpy.ops.object.select_all(action='DESELECT')
armature.select_set(True)
bpy.context.view_layer.objects.active = armature
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

bpy.ops.object.mode_set(mode='EDIT')
ebones = armature.data.edit_bones
targets = {
    'Skl_Root': Vector((0, 0, HIP.z - 0.02)),
    'Waist': Vector((0, 0, HIP.z - 0.02)),
    'TailRoot': Vector((0, 0, HIP.z - 0.02)),
    'Spine_1': Vector((0, 0, HIP.z)),
    'Spine_2': Vector((0, 0, 0.730)),
    'Spine_3': Vector((0, 0, 0.870)),
    'Neck': Vector((0, 0, 0.990)),
    'Head': Vector((0, 0, CHIN_Z - 0.015)),
}
HAND_REL = Vector((0.0, -0.0466, -0.0800))
TOE_REL = Vector((0.0, -0.0730, -0.0427))
for side, sign in (('L', 1), ('R', -1)):
    s, e, w = mirror(SHOULDER, sign), mirror(ELBOW, sign), mirror(WRIST, sign)
    hp, kn, an = mirror(HIP, sign), mirror(KNEE, sign), mirror(ANKLE, sign)
    targets.update({
        f'Clavicle_{side}': Vector((sign * 0.100, 0, SHOULDER.z + 0.005)),
        f'Arm_1_{side}': s,
        f'Arm_1_{side}_Sub': (s + e) / 2,
        f'Arm_2_{side}': e,
        f'Wrist_{side}': w,
        f'Wrist_{side}_Sub': w,
        f'Hand_{side}': w + HAND_REL,
        f'Leg_1_{side}': hp,
        f'Leg_1_{side}_Sub': (hp + kn) / 2,
        f'Leg_2_{side}': kn,
        f'Leg_2_{side}_Sub': (kn + an) / 2,
        f'Ankle_{side}': an,
        f'Toe_{side}': an + TOE_REL,
    })

deltas = {}


def visit(b):
    if b.name in targets:
        d = targets[b.name] - b.head
    else:
        d = deltas.get(b.parent.name, Vector()) if b.parent else Vector()
    deltas[b.name] = d.copy()
    b.head += d
    b.tail += d
    for c in b.children:
        visit(c)


for root in [b for b in ebones if b.parent is None]:
    visit(root)
bpy.ops.object.mode_set(mode='OBJECT')
print(f"[Protagonist] Step 1 complete. {len(armature.data.bones)} bones, translated only.")

# ==============================================================================
# 2. GEOMETRY — every part is a ring grid with its own (s, t) parameterisation
# ==============================================================================
print("[Protagonist] Step 2: Generating geometry...")
mesh_data = bpy.data.meshes.new("ProtagonistMesh")
mesh_obj = bpy.data.objects.new("ProtagonistMesh", mesh_data)
bpy.context.scene.collection.objects.link(mesh_obj)

bm = bmesh.new()
uv_layer = bm.loops.layers.uv.verify()
DRIVING_BONES = ['Head', 'Spine_1', 'Arm_1_L', 'Arm_2_L', 'Arm_1_R', 'Arm_2_R',
                 'Leg_1_L', 'Leg_2_L', 'Leg_1_R', 'Leg_2_R']
vertex_group_assignments = {b: [] for b in DRIVING_BONES}
PARTS = []
GROUP_TRIS = {}


def group_of(name):
    if name.startswith(('hair', 'tuft', 'leaf')):
        return 'hair'
    if name.startswith(('skull', 'nose', 'ears')):
        return 'face/head'
    if name.startswith(('shirt', 'sleeve', 'patch', 'pants', 'rope')):
        return 'clothes'
    return 'body'


def register(name, kind, bone, verts, faces, dims, extra=None, mat=0, density=1.0):
    """faces: list of (BMFace, {BMVert: (s, t)})."""
    vertex_group_assignments[bone].extend(verts)
    tris = sum(len(f.verts) - 2 for f, _ in faces)
    GROUP_TRIS[group_of(name)] = GROUP_TRIS.get(group_of(name), 0) + tris
    for f, _ in faces:
        f.material_index = mat
    PARTS.append({'name': name, 'kind': kind, 'faces': faces, 'dims': dims, 'extra': extra or {},
                  'mat': mat, 'density': density, 'tris': tris})


def orient(f, ref, inward=False):
    f.normal_update()
    d = f.normal.dot(f.calc_center_median() - ref)
    if (d < 0) != inward:
        f.normal_flip()


def perp_frame(t, ref):
    u = ref - t * ref.dot(t)
    if u.length < 1e-5:
        alt = Vector((0, 1, 0)) if abs(t.y) < 0.9 else Vector((1, 0, 0))
        u = alt - t * alt.dot(t)
    u.normalize()
    return u, t.cross(u)


def grid(name, kind, bone, ring_pts, ring_ctrs, start_pole=None, end_pole=None, closed_path=False,
         ring_flags=None, extra=None, mat=0, density=1.0, t_override=None, s_override=None):
    """Quad grid between consecutive rings (+ triangle fans to poles). Each ring is a closed loop
    of `seg` points. UV param: s = k/seg around (seam duplicated in UV only), t = arc length."""
    n, seg = len(ring_pts), len(ring_pts[0])
    flags = ring_flags or [{}] * n
    vr = [[bm.verts.new(p) for p in ring] for ring in ring_pts]
    verts = [v for r in vr for v in r]
    # t parameter: cumulative centre distance including poles
    chain = ([start_pole] if start_pole is not None else []) + list(ring_ctrs) + \
            ([end_pole] if end_pole is not None else [])
    acc = [0.0]
    for a, b in zip(chain, chain[1:]):
        acc.append(acc[-1] + (b - a).length)
    if closed_path:
        acc.append(acc[-1] + (ring_ctrs[0] - ring_ctrs[-1]).length)
    total = acc[-1] if acc[-1] > 0 else 1.0
    tv = [a / total for a in acc]
    off = 1 if start_pole is not None else 0
    t_ring = t_override or [tv[i + off] for i in range(n)]
    s_of = s_override or (lambda k: k / seg)
    faces = []
    for i in (range(n) if closed_path else range(n - 1)):
        j = (i + 1) % n
        ti, tj = t_ring[i], (t_ring[j] if not (closed_path and j == 0) else 1.0)
        fl = flags[i]
        ref = fl.get('ref_pt', (ring_ctrs[i] + ring_ctrs[j]) / 2)
        for k in range(seg):
            k2 = (k + 1) % seg
            f = bm.faces.new([vr[i][k], vr[i][k2], vr[j][k2], vr[j][k]])
            orient(f, ref, fl.get('inward', False))
            faces.append((f, {vr[i][k]: (s_of(k), ti), vr[i][k2]: (s_of(k + 1), ti),
                              vr[j][k2]: (s_of(k + 1), tj), vr[j][k]: (s_of(k), tj)}))
    for pole, idx, tp in ((start_pole, 0, 0.0), (end_pole, n - 1, 1.0)):
        if pole is None:
            continue
        pv = bm.verts.new(pole)
        verts.append(pv)
        for k in range(seg):
            k2 = (k + 1) % seg
            f = bm.faces.new([pv, vr[idx][k], vr[idx][k2]])
            orient(f, ring_ctrs[idx])
            faces.append((f, {pv: ((s_of(k) + s_of(k + 1)) / 2, tp), vr[idx][k]: (s_of(k), t_ring[idx]),
                              vr[idx][k2]: (s_of(k + 1), t_ring[idx])}))
    perim = max(sum((r[(k + 1) % seg] - r[k]).length for k in range(seg)) for r in ring_pts)
    register(name, kind, bone, verts, faces, (perim, max(total, 0.01)), extra, mat, density)
    return t_ring


def loft(name, kind, rings, seg, bone, start_pole=None, end_pole=None, closed_path=False,
         ref=Vector((1, 0, 0)), extra=None, density=1.0):
    """Sweep elliptical rings. ring keys: c, rx, ry, optional ref, off(theta) shift along tangent,
    inward (band faces point inward), rim (band faces point away from up-path), tan (fixed tangent:
    keeps the ring frame from flipping where the path doubles back for a hem's inner lip)."""
    n = len(rings)
    pts, ctrs, flags = [], [], []
    for i, r in enumerate(rings):
        c = r['c']
        if r.get('tan') is not None:
            t = Vector(r['tan'])
        elif closed_path:
            t = rings[(i + 1) % n]['c'] - rings[(i - 1) % n]['c']
        elif i == 0:
            t = rings[1]['c'] - c
        elif i == n - 1:
            t = c - rings[i - 1]['c']
        else:
            t = rings[i + 1]['c'] - rings[i - 1]['c']
        t.normalize()
        u, v = perp_frame(t, r.get('ref', ref))
        ring = []
        for k in range(seg):
            th = 2 * math.pi * k / seg
            p = c + u * (r['rx'] * math.cos(th)) + v * (r['ry'] * math.sin(th))
            if r.get('off'):
                p = p + t * r['off'](k)
            ring.append(p)
        pts.append(ring)
        ctrs.append(c)
        fl = {}
        if r.get('inward'):
            fl['inward'] = True
        if r.get('rim'):
            fl['ref_pt'] = c - t * 0.3 * r['rim']
        flags.append(fl)
    return grid(name, kind, bone, pts, ctrs, start_pole, end_pole, closed_path, flags, extra,
                density=density)


def ellipsoid(name, kind, center, radii, bone, nu=10, nv=6, basis=None, pre=None, extra=None,
              density=1.0, mat=0):
    """Lat-long ellipsoid along local Z (t = 0 bottom -> 1 top), s = 0 at local +X."""
    M = basis if basis is not None else Matrix.Identity(3)

    def place(p):
        if pre:
            p = pre(p)
        return M @ Vector((p.x * radii[0], p.y * radii[1], p.z * radii[2])) + center

    rings, ctrs = [], []
    for j in range(1, nv):
        th = math.pi * j / nv
        ring = [place(Vector((math.sin(th) * math.cos(2 * math.pi * k / nu),
                              math.sin(th) * math.sin(2 * math.pi * k / nu), -math.cos(th))))
                for k in range(nu)]
        rings.append(ring)
        ctrs.append(center)
    t_ring = [j / nv for j in range(1, nv)]
    grid(name, kind, bone, rings, ctrs, place(Vector((0, 0, -1))), place(Vector((0, 0, 1))),
         extra=extra, mat=mat, density=density, t_override=t_ring)


def capsule_rings(A, B, rA, rB, cap_rings=2):
    d = (B - A).normalized()
    rings = []
    for j in range(1, cap_rings + 1):
        phi = math.radians(90.0 * j / cap_rings)
        rings.append({'c': A - d * (rA * math.cos(phi)), 'rx': rA * math.sin(phi), 'ry': rA * math.sin(phi)})
    for j in range(cap_rings, 0, -1):
        phi = math.radians(90.0 * j / cap_rings)
        rings.append({'c': B + d * (rB * math.cos(phi)), 'rx': rB * math.sin(phi), 'ry': rB * math.sin(phi)})
    return rings, A - d * rA, B + d * rB


def capsule(name, kind, A, B, rA, rB, seg, bone, cap_rings=2, density=1.0):
    rings, p0, p1 = capsule_rings(A, B, rA, rB, cap_rings)
    loft(name, kind, rings, seg, bone, start_pole=p0, end_pole=p1, ref=Vector((0, 1, 0)), density=density)


def surface_basis(n):
    n = n.normalized()
    hx = Vector((0, 0, 1)).cross(n)
    if hx.length < 1e-5:
        hx = Vector((1, 0, 0))
    hx.normalize()
    hy = n.cross(hx)
    if hy.z < 0:
        hx, hy = -hx, -hy
    return Matrix((hx, hy, n)).transposed()


def sk(a, p):
    return Vector(skull_pt(a, p))


def sk_normal(a, p):
    e = 0.5
    pa = sk(a + e, p) - sk(a - e, p)
    pp = sk(a, p + e) - sk(a, p - e)
    n = pa.cross(pp)
    if n.length < 1e-9:
        n = sk(a, p) - Vector((0, 0, SK_ZC))
    n.normalize()
    if n.dot(sk(a, p) - Vector((0, 0, SK_ZC))) < 0:
        n = -n
    return n


def surf(a, p, off):
    return sk(a, p) + sk_normal(a, p) * off


def front_point(X, Z, out=0.0):
    """3D skull point whose front projection is (X, Z) in face units."""
    zn = Z if Z >= 0 else Z / CHIN_FLAT
    p = math.degrees(math.acos(max(min(zn, 1.0), -1.0)))
    k = 1.0 + BULGE * max(0.0, -zn)
    sa = X * SK_RX / (SK_RX * k * math.sin(math.radians(p)))
    a = math.degrees(math.asin(max(min(sa, 1.0), -1.0)))
    return surf(a, p, out), sk_normal(a, p), a, p


def lerp_table(table, x):
    for (x0, y0), (x1, y1) in zip(table, table[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return table[-1][1]



def notch_fn(spec, seg, circ, sign):
    """Torn opening = a few big raised-cosine notches cut into the cloth edge.
    spec: [(s_centre, width_m, depth_m)]; returns k -> offset along the path tangent.
    sign = direction (along the tangent) in which the cloth edge retreats."""
    def off(k):
        s = k / seg
        o = 0.0
        for sc, w, dd in spec:
            dm = (((s - sc) + 0.5) % 1.0 - 0.5) * circ
            if abs(dm) < w / 2:
                o = max(o, dd * math.cos(math.pi * dm / w) ** 2)
        return sign * o
    return off


def note_hem(name, spec, seg, circ):
    HEM_STATS[name] = {
        'circumference_m': round(circ, 4), 'ring_segments': seg, 'vertex_spacing_m': round(circ / seg, 4),
        'notches': [{'width_m': w, 'depth_m': dd, 'min_corner_radius_m': round(w * w / (2 * math.pi ** 2 * dd), 4),
                     'vertices_across': int(w / (circ / seg))} for _, w, dd in spec]}


# --- A. SKULL (face material, analytic UV) ------------------------------------------
SK_COLS = 32
SK_ROWS = [25, 50, 60, 70, 78, 86, 94, 102, 110, 118, 126, 136, 148, 162]
sk_cols = [-180.0 + 360.0 * i / SK_COLS for i in range(SK_COLS)]
sk_rings = [[sk(a, p) for a in sk_cols] for p in SK_ROWS]
sk_ctr = Vector((0, 0, SK_ZC))
vr = [[bm.verts.new(q) for q in ring] for ring in sk_rings]
top_v = bm.verts.new(sk(0, 0))
bot_v = bm.verts.new(sk(0, 180))
sk_faces = []


def fuv(i, p):
    a = -180.0 + 360.0 * i / SK_COLS
    return (face_u(a), face_v(p))


for r in range(len(SK_ROWS) - 1):
    for i in range(SK_COLS):
        i2 = (i + 1) % SK_COLS
        f = bm.faces.new([vr[r][i], vr[r][i2], vr[r + 1][i2], vr[r + 1][i]])
        orient(f, sk_ctr)
        sk_faces.append((f, {vr[r][i]: fuv(i, SK_ROWS[r]), vr[r][i2]: fuv(i + 1, SK_ROWS[r]),
                             vr[r + 1][i2]: fuv(i + 1, SK_ROWS[r + 1]), vr[r + 1][i]: fuv(i, SK_ROWS[r + 1])}))
for i in range(SK_COLS):
    i2 = (i + 1) % SK_COLS
    for pv, r, pp in ((top_v, 0, 0.0), (bot_v, len(SK_ROWS) - 1, 180.0)):
        f = bm.faces.new([pv, vr[r][i], vr[r][i2]])
        orient(f, sk_ctr)
        um = (fuv(i, pp)[0] + fuv(i + 1, pp)[0]) / 2
        sk_faces.append((f, {pv: (um, face_v(pp)), vr[r][i]: fuv(i, SK_ROWS[r]),
                             vr[r][i2]: fuv(i + 1, SK_ROWS[r])}))
register('skull', 'skull', 'Head', [v for r in vr for v in r] + [top_v, bot_v], sk_faces, (0, 0),
         mat=1)

# Ears: round C-shapes a little below eye height, sticking out under the cap
for sign in (1, -1):
    ec = sk(sign * 92, 104) + Vector((sign * 0.010, 0.012, 0))
    outward = Vector((sign, 0.10, 0)).normalized()
    up = Vector((0, 0, 1))
    side = up.cross(outward)
    basis = Matrix((outward, side, up)).transposed()
    ellipsoid('ears', 'ear', ec, (0.026, 0.044, 0.056), 'Head', nu=10, nv=6, basis=basis)


# Nose: small rounded-triangle cone, centre 66% down the head, width 8% of the head width
def nose_shape(p):
    phi = math.atan2(p.y, p.x)
    k = 1.0 + 0.20 * math.cos(3 * (phi - math.pi / 2))
    taper = 1.0 - 0.55 * max(p.z, 0.0)
    return Vector((p.x * k * taper, p.y * k * taper, p.z))


np_, nn_, _, _ = front_point(0.0, (NOSE_ZC - SK_ZC) / SK_RZ, out=0.003)
ellipsoid('nose', 'nose', np_, (NOSE_W / 2, NOSE_W / 2 * 0.92, 0.016), 'Head', nu=9, nv=4,
          basis=surface_basis(nn_), pre=nose_shape)

# --- B. HAIR: round cap + three round tufts + one leaf plate ----------------------------
# Cap = skull offset outward; its lower edge (hairline) is one smooth big arc across the forehead
# and tucks back inside the skull so the rim reads as a thick rounded edge.
HAIRLINE = [(0, 53), (20, 54.5), (40, 59), (60, 69), (80, 84), (95, 92), (120, 116), (150, 133), (180, 137)]
CAP_OFF = 0.030                      # at the hairline (side volume)
CAP_OFF_TOP = 0.012                  # thin on the crown so the three tufts stand proud of the cap
cap_cols = [-180.0 + 360.0 * i / 40 for i in range(40)]
cap_rows = 6
cap_rings, cap_ctrs = [], []


def hairline(a):
    return lerp_table(HAIRLINE, abs(a))


for j in range(1, cap_rows + 1):
    ring = []
    for a in cap_cols:
        hl = hairline(a)
        if j < cap_rows - 1:
            p = (hl - 6) * (j / (cap_rows - 2)) ** 0.85
            ring.append(surf(a, p, CAP_OFF_TOP + (CAP_OFF - CAP_OFF_TOP) * min(p / 60.0, 1.0) ** 1.5))
        elif j == cap_rows - 1:
            ring.append(surf(a, hl - 1.5, CAP_OFF * 0.55))       # rounded rim shoulder
        else:
            ring.append(surf(a, hl + 1.5, -0.008))                # tucks inside the skull
    cap_rings.append(ring)
    cap_ctrs.append(sk_ctr)
grid('hair_cap', 'hair_cap', 'Head', cap_rings, cap_ctrs, start_pole=surf(0, 0, CAP_OFF_TOP), density=0.5)

# Three tufts. Sizes are fractions of the head width (spec 28-35%); neighbours overlap 15-25%
# (overlap = (r1 + r2 - centre distance) / smaller diameter). Top tuft touches the height H.
# Side tuft sits on the viewer's left (character's right, -X); the back tuft peeks out on the
# viewer's right behind the crown, so the front silhouette shows three separate round bumps.
TUFT_D = {'top': HEAD_W * 0.34, 'side': HEAD_W * 0.33, 'back': HEAD_W * 0.33}
SIDE_SIGN = -1                       # flip to +1 to put the side tuft on the character's left


def unit(v):
    return Vector(v).normalized()


tuft_top_c = Vector((SIDE_SIGN * 0.050, -0.006, H - TUFT_D['top'] / 2))   # off-centre: asymmetric crown
TUFT_OVERLAP = {'top-side': 0.16, 'top-back': 0.17}


def tuft_centre(dirn, d_self, d_other, overlap, other_c):
    dist = d_self / 2 + d_other / 2 - overlap * min(d_self, d_other)
    return other_c + unit(dirn) * dist


tuft_side_c = tuft_centre((SIDE_SIGN * 0.88, -0.06, -0.47), TUFT_D['side'], TUFT_D['top'],
                          TUFT_OVERLAP['top-side'], tuft_top_c)
tuft_back_c = tuft_centre((-SIDE_SIGN * 0.80, 0.42, -0.30), TUFT_D['back'], TUFT_D['top'],
                          TUFT_OVERLAP['top-back'], tuft_top_c)
TUFTS = {'top': tuft_top_c, 'side': tuft_side_c, 'back': tuft_back_c}
for nm, c in TUFTS.items():
    r = TUFT_D[nm] / 2
    ellipsoid(f'hair_tuft_{nm}', 'hair', c, (r, r, r), 'Head', nu=14, nv=9, density=0.6)

# Leaf: one chunky rounded plate, upper back on the viewer's right, sticking out of the hair
LEAF_LEN, LEAF_WID, LEAF_THICK = HEAD_W * 0.30, HEAD_W * 0.18, max(H * 0.021, 0.0)
leaf_axis = unit((-SIDE_SIGN * 0.78, 0.30, 0.55))
leaf_root = tuft_back_c + unit((-SIDE_SIGN * 0.55, 0.15, 0.82)) * (TUFT_D['back'] / 2 - 0.018)
leaf_c = leaf_root + leaf_axis * (LEAF_LEN / 2)
n0 = Vector((0, -1, 0.25))
leaf_n = (n0 - leaf_axis * n0.dot(leaf_axis)).normalized()
leaf_w = leaf_n.cross(leaf_axis).normalized()
leaf_basis = Matrix((leaf_w, leaf_n, leaf_axis)).transposed()   # local X = width, Y = thickness, Z = length


def leaf_shape(p):
    """Rounded egg: a little fuller near the root, softly rounded tip (no sharp point)."""
    k = 1.0 - 0.22 * max(p.z, 0.0) ** 2 + 0.06 * max(-p.z, 0.0)
    return Vector((p.x * k, p.y * (0.85 + 0.15 * (1 - abs(p.x))), p.z))


ellipsoid('leaf', 'leaf', leaf_c, (LEAF_WID / 2, LEAF_THICK / 2, LEAF_LEN / 2), 'Head', nu=12, nv=7,
          basis=leaf_basis, pre=leaf_shape, density=1.0)
_leaf_verts = {v for f, _ in PARTS[-1]['faces'] for v in f.verts}
_leaf_drop = max(v.co.z for v in _leaf_verts) - (H - 0.004)      # never above the top tuft (bbox = H)
if _leaf_drop > 0:
    for v in _leaf_verts:
        v.co.z -= _leaf_drop

# --- C. TORSO: shirt (no waist taper) + neck -----------------------------------------
SHIRT_PROFILE = [  # z, rx, ry, y-offset  (round-1 shape)
    (SHIRT_HEM_Z, 0.194, 0.153, -0.004),
    (0.650, 0.197, 0.158, -0.006),
    (0.780, 0.192, 0.152, -0.004),
    (0.890, 0.178, 0.140, 0.000),
    (0.960, 0.160, 0.124, 0.004),
    (1.012, 0.112, 0.094, 0.004),
    (1.042, 0.078, 0.070, 0.006),     # collar hugs the neck: almost no neck shows (design)
]


def shirt_at(z):
    prof = SHIRT_PROFILE
    if z <= prof[0][0]:
        return prof[0][1:]
    for a, b in zip(prof, prof[1:]):
        if z <= b[0]:
            t = (z - a[0]) / (b[0] - a[0])
            return tuple(a[i] + (b[i] - a[i]) * t for i in (1, 2, 3))
    return prof[-1][1:]


def ellipse_circ(a, b):
    return math.pi * (3 * (a + b) - math.sqrt((3 * a + b) * (a + 3 * b)))


SHIRT_SEG = 64
_hx, _hy = SHIRT_PROFILE[0][1], SHIRT_PROFILE[0][2]
shirt_circ = ellipse_circ(_hx, _hy)
hem_off = notch_fn(NOTCHES['shirt'], SHIRT_SEG, shirt_circ, sign=+1.0)   # shirt path runs upward
note_hem('shirt_hem', NOTCHES['shirt'], SHIRT_SEG, shirt_circ)
shirt_rings = [
    {'c': Vector((0, -0.004, SHIRT_HEM_Z + 0.070)), 'rx': _hx - 0.016, 'ry': _hy - 0.016, 'inward': True,
     'tan': (0, 0, 1)},
    {'c': Vector((0, -0.004, SHIRT_HEM_Z + 0.004)), 'rx': _hx - 0.010, 'ry': _hy - 0.010, 'off': hem_off,
     'rim': -1, 'tan': (0, 0, 1)},
]
for i, (z, rx, ry, yo) in enumerate(SHIRT_PROFILE):
    r = {'c': Vector((0, yo, z)), 'rx': rx, 'ry': ry}
    if i == 0:
        r['off'] = hem_off
        r['tan'] = (0, 0, 1)
    shirt_rings.append(r)
loft('shirt', 'shirt', shirt_rings, SHIRT_SEG, 'Spine_1', end_pole=Vector((0, 0.006, 1.052)), density=1.0)
capsule('neck', 'neck', Vector((0, 0.006, 0.985)), Vector((0, 0.008, 1.100)), 0.058, 0.060, 10, 'Spine_1',
        cap_rings=1, density=0.3)

# Patch: big rounded square, front lower-left of the shirt (character's left), side = 14% H
PATCH_C = (0.058, 0.772)
PATCH_HALF = H * 0.14 / 2.0
PATCH_CORNER = 0.38


def shirt_surface(x, z, out):
    rx, ry, yo = shirt_at(z)
    s = max(1 - (x / rx) ** 2, 0.0)
    y = yo - ry * math.sqrt(s)
    n = Vector((x / rx ** 2, (y - yo) / ry ** 2, 0)).normalized()
    return Vector((x, y, z)) + n * out


outline = []
rc = PATCH_HALF * PATCH_CORNER
inner = PATCH_HALF - rc
for cx, cz, a0 in ((inner, inner, 0), (-inner, inner, 90), (-inner, -inner, 180), (inner, -inner, 270)):
    for j in range(5):
        a = math.radians(a0 + 90 * j / 4)
        outline.append((cx + rc * math.cos(a), cz + rc * math.sin(a)))
levels = [(1.0, 0.0005), (0.94, 0.0070), (0.62, 0.0105), (0.28, 0.0115)]
p_rings = [[bm.verts.new(shirt_surface(PATCH_C[0] + dx * sc, PATCH_C[1] + dz * sc, o)) for dx, dz in outline]
           for sc, o in levels]
pc_v = bm.verts.new(shirt_surface(PATCH_C[0], PATCH_C[1], 0.0117))
patch_ref = Vector((0, 0.05, PATCH_C[1]))


def pst(dx, dz, sc):
    return (0.5 + dx * sc / (2 * PATCH_HALF), 0.5 + dz * sc / (2 * PATCH_HALF))


patch_faces = []
no = len(outline)
for li in range(len(levels) - 1):
    for k in range(no):
        k2 = (k + 1) % no
        vs = [p_rings[li][k], p_rings[li][k2], p_rings[li + 1][k2], p_rings[li + 1][k]]
        f = bm.faces.new(vs)
        orient(f, patch_ref)
        sts = [pst(*outline[k], levels[li][0]), pst(*outline[k2], levels[li][0]),
               pst(*outline[k2], levels[li + 1][0]), pst(*outline[k], levels[li + 1][0])]
        patch_faces.append((f, dict(zip(vs, sts))))
for k in range(no):
    k2 = (k + 1) % no
    vs = [pc_v, p_rings[-1][k], p_rings[-1][k2]]
    f = bm.faces.new(vs)
    orient(f, patch_ref)
    patch_faces.append((f, dict(zip(vs, [(0.5, 0.5), pst(*outline[k], levels[-1][0]),
                                         pst(*outline[k2], levels[-1][0])]))))
register('patch', 'patch', 'Spine_1', [v for r in p_rings for v in r] + [pc_v], patch_faces,
         (2 * PATCH_HALF, 2 * PATCH_HALF), {'corner': PATCH_CORNER}, density=1.0)

# Trousers seat (hips), closed rounded volume under the shirt hem
seat_rings = [
    {'c': Vector((0, 0.000, CROTCH_Z + 0.014)), 'rx': 0.130, 'ry': 0.096},
    {'c': Vector((0, -0.002, 0.600)), 'rx': 0.182, 'ry': 0.140},
    {'c': Vector((0, -0.004, 0.725)), 'rx': 0.172, 'ry': 0.133},
]
loft('pants_seat', 'pants_seat', seat_rings, 16, 'Spine_1', start_pole=Vector((0, 0, CROTCH_Z)),
     end_pole=Vector((0, -0.004, 0.745)), density=0.8)

# Rope belt: tube Ø >= 3.5% H around the waist; knot Ø 6% H on the left hip; one tail 12% H long
b_rx, b_ry, b_yo = shirt_at(BELT_Z)
BELT_TUBE_R = H * 0.036 / 2.0
belt_rings = []
BELT_PATH = 18
for i in range(BELT_PATH):
    a = 2 * math.pi * i / BELT_PATH
    c = Vector(((b_rx + 0.010) * math.cos(a), b_yo + (b_ry + 0.010) * math.sin(a), BELT_Z))
    belt_rings.append({'c': c, 'rx': BELT_TUBE_R, 'ry': BELT_TUBE_R, 'ref': Vector((0, 0, 1))})
loft('rope_belt', 'rope', belt_rings, 8, 'Spine_1', closed_path=True, density=1.0)

KNOT_R = H * 0.06 / 2
ka = math.radians(-50)
knot_c = Vector(((b_rx + 0.030) * math.cos(ka), b_yo + (b_ry + 0.030) * math.sin(ka), BELT_Z - 0.004))
ellipsoid('rope_knot', 'rope', knot_c, (KNOT_R, KNOT_R * 0.90, KNOT_R), 'Spine_1', nu=12, nv=7)
TAIL_LEN = H * 0.12                        # knot's lower surface -> bottom of the round end
TAIL_R, TAIL_END_R = H * 0.036 / 2, H * 0.044 / 2
tail_a = knot_c + Vector((0.004, -0.006, -KNOT_R * 0.5))
tail_bottom_z = knot_c.z - KNOT_R - TAIL_LEN
tail_end_c = Vector((knot_c.x + 0.018, knot_c.y - 0.012, tail_bottom_z + TAIL_END_R))
capsule('rope_tail', 'rope', tail_a, tail_end_c, TAIL_R, TAIL_R, 8, 'Spine_1', cap_rings=1, density=1.0)
ellipsoid('rope_tail_end', 'rope', tail_end_c, (TAIL_END_R, TAIL_END_R, TAIL_END_R), 'Spine_1', nu=10, nv=6)


# --- D/E. LIMB SHELLS -------------------------------------------------------------------------
def shell(name, kind, A, B, r0, r1, bone, t_end, dome=True, start_t=0.0, notches=None, seg=32):
    """Garment tube along A->B from start_t to t_end (fractions). With `notches`, the open end is
    a hem with a few big round notches, a rolled rim and an inner lip (reads as cloth thickness)."""
    d = (B - A).normalized()
    L = (B - A).length
    rings, pole = [], None
    if dome:
        pr = math.radians(55.0)
        rings.append({'c': A - d * (r0 * math.cos(pr)), 'rx': r0 * math.sin(pr), 'ry': r0 * math.sin(pr)})
        pole = A - d * r0
    else:
        rings.append({'c': A + d * (L * start_t), 'rx': r0 * 0.90, 'ry': r0 * 0.90})
    rings.append({'c': A + d * (L * max(start_t, 0.0) + 0.0001), 'rx': r0, 'ry': r0})
    end_c = A + d * (L * t_end)
    r_end = r0 + (r1 - r0) * t_end + (0.006 if notches else 0.0)
    if notches:
        circ = 2 * math.pi * r_end
        zz = notch_fn(notches, seg, circ, sign=-1.0)
        note_hem(name, notches, seg, circ)
        rings.append({'c': end_c - d * 0.065, 'rx': r_end - 0.002, 'ry': r_end - 0.002, 'tan': d})
        rings.append({'c': end_c, 'rx': r_end, 'ry': r_end, 'off': zz, 'rim': True, 'tan': d})
        rings.append({'c': end_c - d * 0.004, 'rx': r_end - 0.010, 'ry': r_end - 0.010,
                      'off': zz, 'inward': True, 'tan': d})
        rings.append({'c': end_c - d * 0.070, 'rx': r_end - 0.012, 'ry': r_end - 0.012, 'tan': d})
    else:
        rings.append({'c': end_c, 'rx': r_end, 'ry': r_end})
    loft(name, kind, rings, seg, bone, start_pole=pole, ref=Vector((0, 1, 0)), density=1.0)


for side, sign in (('L', 1), ('R', -1)):
    s_, e_, w_ = mirror(SHOULDER, sign), mirror(ELBOW, sign), mirror(WRIST, sign)
    capsule(f'arm_upper_{side}', 'skin', s_, e_, ARM_R_UP, ARM_R_ELB, 12, f'Arm_1_{side}')
    capsule(f'arm_fore_{side}', 'skin', e_, w_, ARM_R_ELB - 0.001, ARM_R_WRIST, 12, f'Arm_2_{side}')
    if side == 'L':      # short: ends 30% down the upper arm
        shell('sleeve_L', 'sleeve', s_, e_, ARM_R_UP + CLOTH + 0.003, ARM_R_ELB + CLOTH, 'Arm_1_L',
              L_SLEEVE_T, notches=NOTCHES['sleeve_L'])
    else:                # long: whole upper arm, then the forearm part ends at mid forearm
        shell('sleeve_R_upper', 'sleeve', s_, e_, ARM_R_UP + CLOTH + 0.003, ARM_R_ELB + CLOTH + 0.002,
              'Arm_1_R', 1.06, seg=16)
        shell('sleeve_R', 'sleeve', e_, w_, ARM_R_ELB + CLOTH - 0.001, ARM_R_WRIST + CLOTH, 'Arm_2_R',
              R_SLEEVE_T, dome=False, start_t=-0.12, notches=NOTCHES['sleeve_R'])
    hand_c = w_ + (w_ - e_).normalized() * (HAND_R * 0.62)
    ellipsoid(f'hand_{side}', 'skin', hand_c, (HAND_R, HAND_R * 0.94, HAND_R), f'Arm_2_{side}', nu=12, nv=7)

for side, sign in (('L', 1), ('R', -1)):
    hp, kn, an = mirror(HIP, sign), mirror(KNEE, sign), mirror(ANKLE, sign)
    if side == 'L':      # long: whole thigh, then the shin part ends 60% down the shin
        shell('pants_L_thigh', 'pants', hp, kn, THIGH_R + CLOTH + 0.003, KNEE_R + CLOTH + 0.002,
              'Leg_1_L', 1.08, seg=16)
        shell('pants_L', 'pants', kn, an, KNEE_R + CLOTH - 0.002, ANKLE_R + CLOTH, 'Leg_2_L',
              L_PANT_T, dome=False, start_t=-0.14, notches=NOTCHES['pants_L'])
    else:                # short: ends 35% down the thigh
        shell('pants_R', 'pants', hp, kn, THIGH_R + CLOTH + 0.003, KNEE_R + CLOTH, 'Leg_1_R',
              R_PANT_T, notches=NOTCHES['pants_R'])
    capsule(f'thigh_{side}', 'skin', hp, kn, THIGH_R, KNEE_R, 12, f'Leg_1_{side}')
    capsule(f'shin_{side}', 'skin', kn, an, KNEE_R - 0.001, ANKLE_R, 12, f'Leg_2_{side}')
    foot_rz = 0.046
    foot_c = Vector((an.x + sign * 0.004, -0.040, foot_rz))
    ellipsoid(f'foot_{side}', 'foot', foot_c, (0.066, FOOT_L / 2.0, foot_rz), f'Leg_2_{side}', nu=12, nv=7)


# ==============================================================================
# 3. ATLAS PACKING + UV ASSIGNMENT
# ==============================================================================
print("[Protagonist] Step 3: Packing atlas...")
PAD = 5
atlas_parts = [p for p in PARTS if p['mat'] == 0]


def try_pack(D):
    items = []
    for i, p in enumerate(atlas_parts):
        w = max(12, int(round(p['dims'][0] * D * p['density'])))
        h = max(12, int(round(p['dims'][1] * D * p['density'])))
        p['rot'] = h > 1.6 * w          # long strips (rope belt) are laid sideways
        if p['rot']:
            w, h = h, w
        items.append((h, w, i))
    items.sort(reverse=True)
    x = y = shelf_h = 0
    out = {}
    for h, w, i in items:
        if w + 2 * PAD > ATLAS_N:
            return None
        if x + w + 2 * PAD > ATLAS_N:
            x, y = 0, y + shelf_h
            shelf_h = 0
        out[i] = (x + PAD, y + PAD, w, h)
        x += w + 2 * PAD
        shelf_h = max(shelf_h, h + 2 * PAD)
    if y + shelf_h > ATLAS_N:
        return None
    return out


D = 900.0
while True:
    packed = try_pack(D)
    if packed:
        break
    D *= 0.97
print(f"  atlas density {D:.0f} px/m (x part density)")
for i, p in enumerate(atlas_parts):
    p['px'] = packed[i]
for p in PARTS:
    if p['mat'] == 0:
        x0, y0, w, h = p['px']
        for f, st in p['faces']:
            for loop in f.loops:
                s, t = st[loop.vert]
                if p['rot']:
                    s, t = t, s
                loop[uv_layer].uv = ((x0 + s * w) / ATLAS_N, (y0 + t * h) / ATLAS_N)
    else:
        for f, st in p['faces']:
            for loop in f.loops:
                loop[uv_layer].uv = st[loop.vert]

# face UV wire + landmark points (looked up later through the real mesh UVs)
face_uv_edges = []
for f, st in PARTS[0]['faces']:
    vs = list(f.verts)
    for a, b in zip(vs, vs[1:] + vs[:1]):
        (u0, v0), (u1, v1) = st[a], st[b]
        if abs(u0 - u1) < 0.5:
            face_uv_edges.append((u0, v0, u1, v1))

bm.verts.index_update()
vg_indices = {g: [v.index for v in vl] for g, vl in vertex_group_assignments.items()}
bm.to_mesh(mesh_data)
bm.free()
for poly in mesh_data.polygons:
    poly.use_smooth = True

# ==============================================================================
# 4. MATERIALS (body atlas + face) -> painter
# ==============================================================================
print("[Protagonist] Step 4: Materials, landmarks, painter...")


def make_mat(name):
    m = bpy.data.materials.new(name=name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.85
    bsdf.inputs['Metallic'].default_value = 0.0
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.interpolation = 'Linear'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return m, tex


mat_body, tex_body = make_mat("Mat_Protagonist")
mat_face, tex_face = make_mat("Mat_Protagonist_Face")
mesh_obj.data.materials.append(mat_body)
mesh_obj.data.materials.append(mat_face)

for g in mesh_obj.vertex_groups[:]:
    mesh_obj.vertex_groups.remove(g)
for bone in armature.data.bones:
    mesh_obj.vertex_groups.new(name=bone.name)
for group_name, v_indices in vg_indices.items():
    mesh_obj.vertex_groups[group_name].add(v_indices, 1.0, 'REPLACE')
arm_mod = mesh_obj.modifiers.new(name="Armature", type='ARMATURE')
arm_mod.object = armature
mesh_obj.parent = armature
mesh_obj.matrix_parent_inverse.identity()

# landmarks: 3D feature anchors -> ray cast onto the skull -> barycentric UV (UV self-check)
me = mesh_data
me.calc_loop_triangles()
uvd = me.uv_layers.active.data
bvh = BVHTree.FromPolygons([v.co for v in me.vertices], [lt.vertices for lt in me.loop_triangles])
landmarks = []
for nm, x, z in [('eye_L', EYE_DX, EYE_ZC), ('eye_R', -EYE_DX, EYE_ZC), ('mouth', 0.0, MOUTH_ZC),
                 ('blush_L', BLUSH_DX, BLUSH_ZC), ('blush_R', -BLUSH_DX, BLUSH_ZC), ('nose', 0.0, NOSE_ZC)]:
    origin = Vector((x, -0.6, z))
    dirn = Vector((0, 1, 0))
    hit = None
    for _ in range(8):
        loc, nrm, idx, dist = bvh.ray_cast(origin, dirn)
        if loc is None:
            break
        lt = me.loop_triangles[idx]
        if me.polygons[lt.polygon_index].material_index == 1:
            hit = (loc, lt)
            break
        origin = loc + dirn * 1e-4
    if hit is None:
        continue
    loc, lt = hit
    vco = [me.vertices[v].co for v in lt.vertices]
    uvs = [Vector((uvd[l].uv[0], uvd[l].uv[1], 0.0)) for l in lt.loops]
    uv = barycentric_transform(loc, vco[0], vco[1], vco[2], uvs[0], uvs[1], uvs[2])
    landmarks.append({'name': nm, 'uv': [uv.x, uv.y], 'world': list(loc)})

meta = {'pad': PAD, 'density_px_per_m': D,
        'parts': [{'name': p['name'], 'kind': p['kind'], 'px': list(p['px'])}
                  for p in PARTS if p['mat'] == 0],
        'face_uv_edges': face_uv_edges, 'face_landmarks': landmarks}
json.dump(meta, open(os.path.join(WORK, "atlas.json"), "w"))

print("[Protagonist] Step 5: Painting textures (system python3 + PIL)...")
r = subprocess.run(["python3", os.path.abspath(__file__), "--paint"], cwd=os.getcwd())
if r.returncode != 0:
    raise RuntimeError("painter failed")

img_body = bpy.data.images.load(os.path.abspath(BODY_PNG))
img_face = bpy.data.images.load(os.path.abspath(FACE_PNG))
for tex, img, m in ((tex_body, img_body, mat_body), (tex_face, img_face, mat_face)):
    img.colorspace_settings.name = 'sRGB'
    tex.image = img
    m.node_tree.nodes.active = tex

tri_count = sum(len(p.vertices) - 2 for p in mesh_data.polygons)
zs = [v.co.z for v in mesh_data.vertices]
xs = [v.co.x for v in mesh_data.vertices]
ys = [v.co.y for v in mesh_data.vertices]
print(f"[Protagonist] Mesh: {len(mesh_data.vertices)} verts, {tri_count} tris")
print(f"[Protagonist] BBox: x {max(xs) - min(xs):.4f}  y {max(ys) - min(ys):.4f}  z {min(zs):.4f}..{max(zs):.4f}")
by_name = {}
for p in PARTS:
    key = p['name'].rstrip('_LR') if p['name'][-2:] in ('_L', '_R') else p['name']
    by_name[key] = by_name.get(key, 0) + p['tris']
for k in sorted(by_name):
    print(f"    {k:16s} {by_name[k]}")
print("  groups:", json.dumps(GROUP_TRIS))


def pair_overlap(a, b):
    ca, cb = TUFTS[a], TUFTS[b]
    da, db = TUFT_D[a], TUFT_D[b]
    return round((da / 2 + db / 2 - (ca - cb).length) / min(da, db), 3)


design = {
    'triangles': {'parts': by_name, 'groups': GROUP_TRIS, 'total': tri_count},
    'head_w_unit_m': HEAD_W,
    'tufts': {nm: {'centre': [round(c, 4) for c in TUFTS[nm]], 'diameter_m': round(TUFT_D[nm], 4),
                   'diameter_pct_head_w': round(TUFT_D[nm] / HEAD_W * 100, 1)} for nm in TUFTS},
    'tuft_overlap': {'top-side': pair_overlap('top', 'side'), 'top-back': pair_overlap('top', 'back'),
                     'side-back': pair_overlap('side', 'back')},
    'leaf': {'len_m': LEAF_LEN, 'width_m': LEAF_WID, 'thick_m': LEAF_THICK},
    'hems': HEM_STATS,
    'face': {'eye_w': EYE_W, 'eye_h': EYE_H, 'eye_spacing': 2 * EYE_DX, 'eye_zc': EYE_ZC,
             'blush_d': BLUSH_D, 'mouth_w': 2 * MOUTH_HALF, 'mouth_thick': MOUTH_THICK, 'nose_w': NOSE_W},
    'rope': {'tube_d': 2 * BELT_TUBE_R, 'knot_d': 2 * KNOT_R, 'tail_len': TAIL_LEN, 'tail_d': 2 * TAIL_R,
             'tail_end_d': 2 * TAIL_END_R},
    'limbs': {'arm_d_up_elb_wrist': [2 * ARM_R_UP, 2 * ARM_R_ELB, 2 * ARM_R_WRIST],
              'leg_d_thigh_knee_ankle': [2 * THIGH_R, 2 * KNEE_R, 2 * ANKLE_R],
              'hand_d': 2 * HAND_R, 'foot_len': FOOT_L},
}
json.dump(design, open(os.path.join(WORK, "design_values.json"), "w"), indent=1)

# ==============================================================================
# 5. HEADLESS RENDERS (same camera / lights / world as rounds 1-2) + face close-up
# ==============================================================================
print("[Protagonist] Step 6: Rendering QA views...")
scene = bpy.context.scene
world = bpy.data.worlds.new("StudioWorld")
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.914, 0.894, 0.855, 1.0)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9

cam_data = bpy.data.cameras.new("OrthoCam")
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 2.1
cam_obj = bpy.data.objects.new("OrthoCam", cam_data)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj

key_light_data = bpy.data.lights.new(name="KeyLight", type='SUN')
key_light_data.energy = 2.5
key_light_data.color = (1.0, 0.945, 0.816)
key_light = bpy.data.objects.new("KeyLight", key_light_data)
scene.collection.objects.link(key_light)
key_light.rotation_euler = (math.radians(45), math.radians(20), math.radians(-35))

fill_light_data = bpy.data.lights.new(name="FillLight", type='SUN')
fill_light_data.energy = 1.2
fill_light_data.color = (0.557, 0.478, 0.627)
fill_light = bpy.data.objects.new("FillLight", fill_light_data)
scene.collection.objects.link(fill_light)
fill_light.rotation_euler = (math.radians(-30), math.radians(-40), math.radians(135))

scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.eevee.taa_render_samples = 16

# Colour management. Rounds 1-2 rendered with Blender's default AgX view transform, which
# compresses saturation and lifts values (spec skin #E8B88C came out ~#CBB2A0). The game shows
# sRGB textures without a filmic curve, so QA renders use Standard; same lights, camera, world.
VIEW_TRANSFORM = os.environ.get("PROTAG_VIEW", "Standard")
EXPOSURE = float(os.environ.get("PROTAG_EXPOSURE", "-0.75"))

cam_target_z = 0.7284  # identical framing to the pilot / round-1 renders
views = [
    ("front", (0, -3.5, cam_target_z), (math.radians(90), 0, 0), 2.1, 512),
    ("right", (-3.5, 0, cam_target_z), (math.radians(90), 0, math.radians(-90)), 2.1, 512),
    ("back", (0, 3.5, cam_target_z), (math.radians(90), 0, math.radians(180)), 2.1, 512),
    ("three_quarter", (-2.5, -2.5, cam_target_z + 0.15), (math.radians(82), 0, math.radians(-45)), 2.1, 512),
    ("face_closeup", (0, -3.5, 1.25), (math.radians(90), 0, 0), 0.62, 1024),
]


def render_views(view_transform, exposure, suffix="", only=None):
    scene.view_settings.view_transform = view_transform
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = exposure
    for vname, pos, rot, oscale, res in views:
        if only and vname not in only:
            continue
        cam_obj.location = pos
        cam_obj.rotation_euler = rot
        cam_data.ortho_scale = oscale
        scene.render.resolution_x = scene.render.resolution_y = res
        out_path = os.path.join(QA_DIR, f"{vname}{suffix}.png")
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        print(f"  - Rendered {vname}{suffix} ({view_transform}, {exposure:+.2f} EV) to {out_path}")


if "--no-render" not in sys.argv:
    render_views(VIEW_TRANSFORM, EXPOSURE)
    # legacy colour pipeline (AgX, 0 EV) for a like-for-like look against rounds 1-2
    render_views('AgX', 0.0, suffix="_agx_legacy", only=("front", "face_closeup"))

# ==============================================================================
# 6. GLTF 2.0 BINARY EXPORT (same options as pilot)
# ==============================================================================
print("[Protagonist] Step 7: Exporting glTF 2.0 binary...")
bpy.ops.object.select_all(action='DESELECT')
armature.select_set(True)
mesh_obj.select_set(True)
bpy.context.view_layer.objects.active = armature
bpy.ops.export_scene.gltf(
    filepath=OUTPUT_GLB,
    export_format='GLB',
    use_selection=True,
    export_apply=False,
    export_yup=True,
)
print(f"[Protagonist] Exported {OUTPUT_GLB}: {tri_count} tris (budget <= 8,000), "
      f"{len(armature.data.bones)} bones.")
