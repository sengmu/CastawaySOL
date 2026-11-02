"""
Protagonist 3D Model Generator (Island Survivor Variant / 荒岛款) — completion pass
Complies with docs/model-art-spec.md (修订篇二 + 三个人类共用的体型 + 工程约束篇)

Changes vs. pilot (docs/qa/model-pilot):
- Every body part is a lofted ellipse / tapered capsule / ellipsoid (no boxes, no straight cylinders).
- Smile is one continuous swept tube along an up-curved arc on the face (was 5 dots).
- Proportions: head (chin -> hair top) = 29% H, torso 34%, exposed legs 37%; chubbier widths.
- Total height anchored to the pilot bounding box (1.4908 m), origin at ground between the feet.

Skeleton contract: identical 45-bone armature (names + hierarchy) extracted from NpcNmlCat23.dae,
bones are only TRANSLATED onto the new joints (head & tail shifted equally -> orientations/rolls
unchanged), rigid 100% weights to the same 10 driving bones as the pilot.

Run from repo root:
  blender --background --python scripts/models/protagonist.py
"""

import math
import os
import bpy
import bmesh
from mathutils import Vector, Matrix

# ==============================================================================
# 0. PARAMETERS
# ==============================================================================
H = 1.4908                  # Pilot bbox height (measured from pilot glb) -> keep identical
HEAD_H = H * 0.29           # chin -> hair top
HEAD_W = H * 0.31           # head width incl. hair cap
TORSO_H = H * 0.34          # crotch -> chin
LEGS_H = H * 0.37           # ground -> crotch (exposed legs)
CHIN_Z = H - HEAD_H         # 1.0585
CROTCH_Z = CHIN_Z - TORSO_H # ~0.5516

OUTPUT_GLB = "public/models/protagonist.glb"
PALETTE_PNG = "public/models/palette_protagonist.png"
QA_DIR = "docs/qa/model-protagonist"
os.makedirs(QA_DIR, exist_ok=True)


def hex_to_srgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return tuple(int(hex_str[i:i + 2], 16) / 255.0 for i in (0, 2, 4)) + (1.0,)


# Colors matching docs/model-art-spec.md 修订篇二 exactly
COLORS = {
    'skin': hex_to_srgb('E8B88C'),
    'hair_rope': hex_to_srgb('B08158'),
    'shirt': hex_to_srgb('8DC4DA'),
    'patch': hex_to_srgb('E8C072'),
    'trousers': hex_to_srgb('C9A57A'),
    'leaf': hex_to_srgb('8CCB5E'),
    'dark': hex_to_srgb('6B4A32'),
    'nose': hex_to_srgb('DB9A78'),
    'blush': hex_to_srgb('F7B6C8'),
}
COLOR_ORDER = [
    ['skin', 'hair_rope', 'shirt'],
    ['patch', 'trousers', 'leaf'],
    ['dark', 'nose', 'blush'],
]
PALETTE_GRID = {COLOR_ORDER[r][c]: ((2 * c + 1) / 6, (2 * r + 1) / 6) for r in range(3) for c in range(3)}

# ---- Head landmarks (Z-up, front = -Y, +X = character's left) ----
SK_RX, SK_RY, SK_RZ = 0.218, 0.198, 0.190     # skull ellipsoid
SK_ZC = CHIN_Z + SK_RZ                         # 1.2485
SK_C = Vector((0.0, 0.0, SK_ZC))
EYE_Z = H - HEAD_H * 0.55
NOSE_Z = H - HEAD_H * 0.66
BLUSH_Z = H - HEAD_H * 0.70
MOUTH_Z = H - HEAD_H * 0.78

# ---- Torso / pelvis ----
SHIRT_HEM_Z = 0.600
BELT_Z = 0.672
SEAT_BOTTOM_Z = CROTCH_Z

# ---- Joints (L side, mirrored with sign) ----
SHOULDER = Vector((0.172, 0.000, 0.918))
ELBOW = Vector((0.234, 0.000, 0.760))
WRIST = Vector((0.280, -0.005, 0.628))
HIP = Vector((0.096, 0.000, 0.580))
KNEE = Vector((0.098, -0.005, 0.300))
ANKLE = Vector((0.098, 0.000, 0.085))

ARM_R_UP, ARM_R_ELB, ARM_R_WRIST = 0.066, 0.058, 0.051  # arm Ø ≈ 8–9% H (chubby)
HAND_R = H * 0.096 / 2.0                                 # hand Ø ≈ 9.6% H
THIGH_R, KNEE_R, ANKLE_R = 0.084, 0.073, 0.062           # leg Ø ≈ 10–11% H (chubby)
FOOT_L = H * 0.14                                        # foot length 14% H
CLOTH = 0.015                                            # garment shell offset

# Asymmetric hems (spec 修订篇二): notch line at the stated %, round lobes hang lower
L_SLEEVE_T = 0.30   # left sleeve ends at 30% of upper arm (shoulder -> elbow)
R_SLEEVE_T = 0.50   # right sleeve ends at mid forearm (elbow -> wrist)
L_PANT_T = 0.60     # left pant leg ends 60% down the shin (below knee)
R_PANT_T = 0.35     # right pant leg ends 35% down the thigh (above knee)
HEM_DEPTH = 0.032   # >= 2% H
HEM_LOBES = 3       # 3 lobes around a limb -> each ~0.15 m wide (>= 5% H)


def mirror(v, sign):
    return Vector((v.x * sign, v.y, v.z))


# ==============================================================================
# 1. SKELETON EXTRACTION & ADAPTATION (same source + transform as pilot)
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

# Absolute joint targets. Bones are moved by translating head+tail together (pilot method),
# so every bone keeps its rest orientation and roll -> procedural animation axes unchanged.
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
HAND_REL = Vector((0.0, -0.0466, -0.0800))   # pilot Hand offset from Wrist
TOE_REL = Vector((0.0, -0.0730, -0.0427))    # pilot Toe offset from Ankle
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


def shift_bone(b, d):
    b.head += d
    b.tail += d


# Walk parents-first: targeted bones go to their target; untargeted bones (Ear, Feel, Tail,
# Z_* helpers) follow their parent's translation so their relative offsets are preserved.
deltas = {}
def visit(b):
    if b.name in targets:
        d = targets[b.name] - b.head
    else:
        d = deltas.get(b.parent.name, Vector()) if b.parent else Vector()
    deltas[b.name] = d.copy()
    shift_bone(b, d)
    for c in b.children:
        visit(c)

for root in [b for b in ebones if b.parent is None]:
    visit(root)

bpy.ops.object.mode_set(mode='OBJECT')
print(f"[Protagonist] Step 1 complete. {len(armature.data.bones)} bones, translated only.")

# ==============================================================================
# 2. PALETTE TEXTURE & MATERIAL
# ==============================================================================
print("[Protagonist] Step 2: Palette texture & material...")
w = h = 256
palette_img = bpy.data.images.new("PaletteProtagonist", width=w, height=h)
pixels = [0.0] * (w * h * 4)
for py in range(h):
    row = min(py * 3 // h, 2)
    for px in range(w):
        col = min(px * 3 // w, 2)
        i = (py * w + px) * 4
        pixels[i:i + 4] = COLORS[COLOR_ORDER[row][col]]
palette_img.pixels = pixels
palette_img.file_format = 'PNG'
palette_img.filepath_raw = PALETTE_PNG
palette_img.save()

mat = bpy.data.materials.new(name="Mat_Protagonist")
mat.use_nodes = True
nodes, links = mat.node_tree.nodes, mat.node_tree.links
nodes.clear()
node_output = nodes.new(type='ShaderNodeOutputMaterial')
node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
node_bsdf.inputs['Roughness'].default_value = 0.85
node_bsdf.inputs['Metallic'].default_value = 0.0
node_tex = nodes.new(type='ShaderNodeTexImage')
node_tex.image = palette_img
node_tex.interpolation = 'Closest'
links.new(node_tex.outputs['Color'], node_bsdf.inputs['Base Color'])
links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])

# ==============================================================================
# 3. PROCEDURAL MESH (BMesh) — rounded primitives
# ==============================================================================
print("[Protagonist] Step 3: Generating rounded character geometry...")
mesh_data = bpy.data.meshes.new("ProtagonistMesh")
mesh_obj = bpy.data.objects.new("ProtagonistMesh", mesh_data)
bpy.context.scene.collection.objects.link(mesh_obj)
mesh_obj.data.materials.append(mat)

bm = bmesh.new()
uv_layer = bm.loops.layers.uv.verify()
DRIVING_BONES = ['Head', 'Spine_1', 'Arm_1_L', 'Arm_2_L', 'Arm_1_R', 'Arm_2_R',
                 'Leg_1_L', 'Leg_2_L', 'Leg_1_R', 'Leg_2_R']
vertex_group_assignments = {b: [] for b in DRIVING_BONES}
part_tris = {}


def finish_part(name, verts, faces, bone):
    """Color each face by its palette swatch, register verts to the bone, count tris."""
    for f, col in faces:
        uv = PALETTE_GRID[col]
        for loop in f.loops:
            loop[uv_layer].uv = uv
    vertex_group_assignments[bone].extend(verts)
    part_tris[name] = part_tris.get(name, 0) + sum(len(f.verts) - 2 for f, _ in faces)


def orient(f, ctr, inward=False):
    f.normal_update()
    d = f.normal.dot(f.calc_center_median() - ctr)
    if (d < 0) != inward:
        f.normal_flip()


def perp_frame(t, ref):
    u = ref - t * ref.dot(t)
    if u.length < 1e-5:
        alt = Vector((0, 1, 0)) if abs(t.y) < 0.9 else Vector((1, 0, 0))
        u = alt - t * alt.dot(t)
    u.normalize()
    return u, t.cross(u)


def loft(name, rings, seg, bone, color, start_pole=None, end_pole=None,
         closed_path=False, ref=Vector((1, 0, 0)), phase=0.0):
    """Sweep elliptical rings along a path.
    ring keys: c (center), rx, ry, optional: ref, off (theta->shift along tangent),
    col (color of the band starting at this ring), inward (band faces point inward)."""
    n = len(rings)
    vr, verts, faces = [], [], []
    for i, r in enumerate(rings):
        c = r['c']
        if closed_path:
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
            th = phase + 2 * math.pi * k / seg
            p = c + u * (r['rx'] * math.cos(th)) + v * (r['ry'] * math.sin(th))
            if r.get('off'):
                p = p + t * r['off'](th)
            ring.append(bm.verts.new(p))
        vr.append(ring)
        verts.extend(ring)
    for i in (range(n) if closed_path else range(n - 1)):
        j = (i + 1) % n
        ctr = (rings[i]['c'] + rings[j]['c']) / 2
        col = rings[i].get('col', color)
        for k in range(seg):
            k2 = (k + 1) % seg
            f = bm.faces.new([vr[i][k], vr[i][k2], vr[j][k2], vr[j][k]])
            orient(f, ctr, rings[i].get('inward', False))
            faces.append((f, col))
    for pole, idx in ((start_pole, 0), (end_pole, n - 1)):
        if pole is None:
            continue
        pv = bm.verts.new(pole)
        verts.append(pv)
        col = rings[idx].get('col', color)
        for k in range(seg):
            f = bm.faces.new([pv, vr[idx][k], vr[idx][(k + 1) % seg]])
            orient(f, rings[idx]['c'])
            faces.append((f, col))
    finish_part(name, verts, faces, bone)


def capsule_rings(A, B, rA, rB, cap_rings=2, mid=()):
    """Rings + poles of a tapered capsule A->B with hemispherical ends (radius rA / rB)."""
    d = (B - A).normalized()
    rings = []
    for j in range(1, cap_rings + 1):
        phi = math.radians(90.0 * j / cap_rings)
        rings.append({'c': A - d * (rA * math.cos(phi)), 'rx': rA * math.sin(phi), 'ry': rA * math.sin(phi)})
    for tm, rm in mid:
        p = A + (B - A) * tm
        rings.append({'c': p, 'rx': rm, 'ry': rm})
    for j in range(cap_rings, 0, -1):
        phi = math.radians(90.0 * j / cap_rings)
        rings.append({'c': B + d * (rB * math.cos(phi)), 'rx': rB * math.sin(phi), 'ry': rB * math.sin(phi)})
    return rings, A - d * rA, B + d * rB


def capsule(name, A, B, rA, rB, seg, bone, color, cap_rings=2, mid=()):
    rings, p0, p1 = capsule_rings(A, B, rA, rB, cap_rings, mid)
    loft(name, rings, seg, bone, color, start_pole=p0, end_pole=p1, ref=Vector((0, 1, 0)))


def ellipsoid(name, center, radii, bone, color, u=10, v=6, basis=None, pre=None, post=None):
    """UV ellipsoid. basis: 3x3 matrix whose columns are the local X/Y/Z axes.
    pre(p_unit) reshapes the unit sphere point; post(p_world) deforms after placement."""
    ret = bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=1.0)
    M = basis if basis is not None else Matrix.Identity(3)
    for vt in ret['verts']:
        p = vt.co.copy()
        if pre:
            p = pre(p)
        p = Vector((p.x * radii[0], p.y * radii[1], p.z * radii[2]))
        p = M @ p + center
        if post:
            p = post(p)
        vt.co = p
    faces = list({f for vt in ret['verts'] for f in vt.link_faces})
    for f in faces:
        orient(f, center)
    finish_part(name, list(ret['verts']), [(f, color) for f in faces], bone)


def surface_basis(n):
    """Columns: horizontal tangent, up tangent, normal (for decals lying on a surface)."""
    n = n.normalized()
    hx = Vector((0, 0, 1)).cross(n)
    if hx.length < 1e-5:
        hx = Vector((1, 0, 0))
    hx.normalize()
    hy = n.cross(hx)
    if hy.z < 0:
        hx, hy = -hx, -hy
    return Matrix((hx, hy, n)).transposed()


def skull_point(x, z, out=0.0):
    """Point on the front of the skull ellipsoid at (x, z) and its outward normal."""
    dz = (z - SK_ZC) / SK_RZ
    s = max(1.0 - (x / SK_RX) ** 2 - dz ** 2, 0.0)
    p = Vector((x, -SK_RY * math.sqrt(s), z))
    n = Vector((x / SK_RX ** 2, p.y / SK_RY ** 2, (z - SK_ZC) / SK_RZ ** 2)).normalized()
    return p + n * out, n


def skull_point_angle(a_deg, z, out=0.0):
    """Point on skull at azimuth a (0 = front, +90 = character's left) and height z."""
    dz = (z - SK_ZC) / SK_RZ
    s = math.sqrt(max(1 - dz * dz, 0))
    a = math.radians(a_deg)
    p = Vector((SK_RX * s * math.sin(a), -SK_RY * s * math.cos(a), z))
    n = Vector((p.x / SK_RX ** 2, p.y / SK_RY ** 2, (z - SK_ZC) / SK_RZ ** 2)).normalized()
    return p + n * out, n


def smoothstep(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def lerp_table(table, x):
    for (x0, y0), (x1, y1) in zip(table, table[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return table[-1][1]


def scallop(depth, lobes, sign=1.0, phase=0.0):
    """Hem offset: smooth round lobes hanging past the notch line (no points, no fringes)."""
    return lambda th: sign * depth * (0.5 - 0.5 * math.cos(lobes * (th - phase)))


# --- A. HEAD -------------------------------------------------------------------
ellipsoid('head_skull', SK_C, (SK_RX, SK_RY, SK_RZ), 'Head', 'skin', u=18, v=10)

for sign in (1, -1):  # round ears (design sheet), mostly tucked under hair
    ellipsoid('ears', Vector((sign * 0.212, 0.018, 1.228)), (0.028, 0.040, 0.050), 'Head', 'skin', u=6, v=4)

# Hair cap: custom-built shell whose lower edge follows a smooth hairline curve (columns are
# denser across the forehead). The last row is pulled inside the skull, so the cap ends in a
# thick rounded lip — no z-fighting, no open edge. Three round fringe lobes are part of the
# hairline itself (they are the cap's edge, not extra clumps).
HAIR_SCALE = Vector((1.075, 1.08, 1.07))
HAIR_C = SK_C + Vector((0, 0.012, 0.012))
HAIR_R = Vector((SK_RX * HAIR_SCALE.x, SK_RY * HAIR_SCALE.y, SK_RZ * HAIR_SCALE.z))
HAIRLINE = [(0, 1.0), (58, 1.0), (78, 1.305), (100, 1.292), (135, 1.165), (180, 1.128)]
FRINGE_TIP, FRINGE_NOTCH, FRINGE_PERIOD, FRINGE_PHASE = 1.335, 1.382, 40.0, 4.0


def hairline_z(a):
    side = lerp_table(HAIRLINE, abs(a))
    lobe = 0.5 + 0.5 * math.cos(2 * math.pi * (a - FRINGE_PHASE) / FRINGE_PERIOD)
    front = FRINGE_NOTCH - (FRINGE_NOTCH - FRINGE_TIP) * lobe
    w = 1.0 - smoothstep(50.0, 70.0, abs(a))
    return front * w + side * (1 - w) if abs(a) < 70 else side


def hair_cap(rows=6):
    cols = [a * 7.5 for a in range(-8, 9)] + [75, 92, 112, 135, 158, 180, -158, -135, -112, -92, -75]
    cols = sorted(cols)
    top = bm.verts.new(HAIR_C + Vector((0, 0, HAIR_R.z)))
    grid = []
    for a in cols:
        ar = math.radians(a)
        zc = hairline_z(a)
        th_cut = math.acos(max(min((zc - HAIR_C.z) / HAIR_R.z, 1.0), -1.0))
        col = []
        for j in range(1, rows + 1):
            if j < rows:
                th = (th_cut - 0.07) * (j / (rows - 1)) ** 0.85
                k = 1.0
            else:
                th, k = th_cut + 0.02, 0.90   # tucked inside the skull
            d = Vector((math.sin(th) * math.sin(ar), -math.sin(th) * math.cos(ar), math.cos(th)))
            p = HAIR_C + Vector((d.x * HAIR_R.x, d.y * HAIR_R.y, d.z * HAIR_R.z)) * k
            col.append(bm.verts.new(p))
        grid.append(col)
    faces = []
    n = len(cols)
    for i in range(n):
        i2 = (i + 1) % n
        f = bm.faces.new([top, grid[i][0], grid[i2][0]])
        orient(f, HAIR_C)
        faces.append((f, 'hair_rope'))
        for j in range(rows - 1):
            f = bm.faces.new([grid[i][j], grid[i2][j], grid[i2][j + 1], grid[i][j + 1]])
            orient(f, HAIR_C)
            faces.append((f, 'hair_rope'))
    finish_part('hair_cap', [top] + [v for c in grid for v in c], faces, 'Head')


hair_cap()

# Three plump round clumps (Ø 28–35% of head width): top, left temple, back of head
TOP_CLUMP_R = (0.092, 0.084, 0.066)
ellipsoid('hair_clumps', Vector((0.018, -0.022, H - TOP_CLUMP_R[2])), TOP_CLUMP_R, 'Head', 'hair_rope', u=8, v=6)
ellipsoid('hair_clumps', Vector((0.150, -0.030, 1.392)), (0.094, 0.086, 0.068), 'Head', 'hair_rope', u=8, v=6,
          basis=Matrix.Rotation(math.radians(-28), 3, 'Y'))
ellipsoid('hair_clumps', Vector((-0.030, 0.190, 1.300)), (0.082, 0.062, 0.076), 'Head', 'hair_rope', u=8, v=5)

# Single leaf plate, stuck in the right-back top of the hair (character's right = -X)
leaf_len = HEAD_W * 0.30
L_ax = Vector((-0.55, 0.30, 0.78)).normalized()
W_ax = L_ax.cross(Vector((0, -1, 0))).normalized()
T_ax = L_ax.cross(W_ax).normalized()
leaf_basis = Matrix((W_ax, T_ax, L_ax)).transposed()


def leaf_shape(p):  # ovate: wide base, rounded narrower tip
    k = 1.0 - 0.12 * max(p.z, 0.0)
    return Vector((p.x * k, p.y, p.z))


ellipsoid('leaf', Vector((-0.128, 0.060, 1.400)), (leaf_len * 0.30, H * 0.015, leaf_len / 2),
          'Head', 'leaf', u=10, v=5, basis=leaf_basis, pre=leaf_shape)

# --- B. FACE (spec 修订三) ------------------------------------------------------
eye_r = HEAD_W * 0.09 / 2.0
eye_x = HEAD_W * 0.36 / 2.0
for sign in (1, -1):
    p, n = skull_point(sign * eye_x, EYE_Z, out=0.0)
    ellipsoid('face_eyes', p, (eye_r, eye_r * 1.08, 0.0055), 'Head', 'dark', u=10, v=3, basis=surface_basis(n))

blush_r = HEAD_W * 0.12 / 2.0
for sign in (1, -1):
    p, n = skull_point(sign * eye_x * 1.50, BLUSH_Z, out=-0.0005)
    ellipsoid('face_blush', p, (blush_r, blush_r * 0.9, 0.0045), 'Head', 'blush', u=8, v=3, basis=surface_basis(n))


def rounded_triangle(p):  # corners at -90° (down), 30°, 150°; all corners stay round
    phi = math.atan2(p.y, p.x)
    k = 1.0 + 0.22 * math.cos(3 * (phi + math.pi / 2))
    return Vector((p.x * k, p.y * k, p.z))


nose_w = HEAD_W * 0.08
p, n = skull_point(0.0, NOSE_Z, out=0.002)
ellipsoid('face_nose', p, (nose_w * 0.46, nose_w * 0.46, 0.011), 'Head', 'nose', u=9, v=3,
          basis=surface_basis(n), pre=rounded_triangle)

# Smile: ONE continuous tube swept along an upturned arc lying on the face, rounded ends.
smile_w = HEAD_W * 0.22
smile_thick = HEAD_W * 0.044   # >= 4% of head width
smile_lift = 0.017             # how much the ends curl up
SMILE_PTS = 7
mouth_rings = []
pts = []
for i in range(SMILE_PTS):
    t = -1.0 + 2.0 * i / (SMILE_PTS - 1)
    pts.append(skull_point(t * smile_w / 2.0, MOUTH_Z + smile_lift * t * t, out=0.0015))
for i, (p, n) in enumerate(pts):
    mouth_rings.append({'c': p, 'rx': 0.0042, 'ry': smile_thick / 2.0, 'ref': n})
# rounded caps: shrink rings beyond both ends along the arc tangent
for end, nb, ins in ((0, 1, 0), (SMILE_PTS - 1, SMILE_PTS - 2, None)):
    p, n = pts[end]
    tdir = (p - pts[nb][0]).normalized()
    cap = {'c': p + tdir * (smile_thick * 0.30), 'rx': 0.0036, 'ry': smile_thick * 0.36, 'ref': n}
    if ins == 0:
        mouth_rings.insert(0, cap)
    else:
        mouth_rings.append(cap)
p0, n0 = pts[0]
p1, n1 = pts[-1]
t0 = (p0 - pts[1][0]).normalized()
t1 = (p1 - pts[-2][0]).normalized()
loft('face_mouth', mouth_rings, 6, 'Head', 'dark',
     start_pole=p0 + t0 * (smile_thick * 0.5), end_pole=p1 + t1 * (smile_thick * 0.5))

# --- C. TORSO: shirt (elliptical loft, round shoulders, scalloped hem) + neck -----------
SHIRT_PROFILE = [  # z, rx, ry, y-offset
    (SHIRT_HEM_Z, 0.192, 0.152, -0.004),
    (0.650, 0.197, 0.158, -0.006),
    (0.780, 0.190, 0.150, -0.004),
    (0.890, 0.176, 0.139, 0.000),
    (0.960, 0.160, 0.124, 0.004),
    (1.012, 0.108, 0.090, 0.004),
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


SHIRT_SEG = 16
hem_off = scallop(HEM_DEPTH * 0.85, 4, sign=-1.0, phase=math.pi / 4)
shirt_rings = [{'c': Vector((0, -0.004, SHIRT_HEM_Z + 0.014)), 'rx': 0.178, 'ry': 0.139,
                'off': hem_off, 'inward': True}]
for i, (z, rx, ry, yo) in enumerate(SHIRT_PROFILE):
    r = {'c': Vector((0, yo, z)), 'rx': rx, 'ry': ry}
    if i == 0:
        r['off'] = hem_off
    shirt_rings.append(r)
shirt_rings += [
    {'c': Vector((0, 0.004, 1.042)), 'rx': 0.070, 'ry': 0.066, 'col': 'skin'},  # collar line
    {'c': Vector((0, 0.008, 1.110)), 'rx': 0.058, 'ry': 0.056, 'col': 'skin'},  # neck
]
loft('torso_shirt', shirt_rings, SHIRT_SEG, 'Spine_1', 'shirt', end_pole=Vector((0, 0.008, 1.12)))

# Patch: big rounded square pillow on the lower front (character's left), edges sunk into shirt
PATCH_C = (0.055, 0.795)
PATCH_HALF = H * 0.135 / 2.0
PATCH_CORNER = PATCH_HALF * 0.38


def shirt_surface(x, z, out):
    rx, ry, yo = shirt_at(z)
    s = max(1 - (x / rx) ** 2, 0.0)
    y = yo - ry * math.sqrt(s)
    n = Vector((x / rx ** 2, (y - yo) / ry ** 2, 0)).normalized()
    return Vector((x, y, z)) + n * out


outline = []
inner = PATCH_HALF - PATCH_CORNER
for cx, cz, a0 in ((inner, inner, 0), (-inner, inner, 90), (-inner, -inner, 180), (inner, -inner, 270)):
    for j in range(4):
        a = math.radians(a0 + 90 * j / 3)
        outline.append((cx + PATCH_CORNER * math.cos(a), cz + PATCH_CORNER * math.sin(a)))
pv_out = [bm.verts.new(shirt_surface(PATCH_C[0] + dx, PATCH_C[1] + dz, -0.0045)) for dx, dz in outline]
pv_mid = [bm.verts.new(shirt_surface(PATCH_C[0] + dx * 0.62, PATCH_C[1] + dz * 0.62, 0.0065)) for dx, dz in outline]
pv_ctr = bm.verts.new(shirt_surface(PATCH_C[0], PATCH_C[1], 0.0075))
patch_faces = []
patch_ref = Vector((0, 0.05, PATCH_C[1]))  # point behind the patch (inside torso)
for k in range(len(outline)):
    k2 = (k + 1) % len(outline)
    for vs in ([pv_out[k], pv_out[k2], pv_mid[k2], pv_mid[k]], [pv_ctr, pv_mid[k], pv_mid[k2]]):
        f = bm.faces.new(vs)
        orient(f, patch_ref)
        patch_faces.append((f, 'patch'))
finish_part('patch', pv_out + pv_mid + [pv_ctr], patch_faces, 'Spine_1')

# Trousers seat (hips), closed rounded volume under the shirt hem
seat_rings = [
    {'c': Vector((0, 0.000, SEAT_BOTTOM_Z + 0.014)), 'rx': 0.130, 'ry': 0.096},
    {'c': Vector((0, -0.002, 0.600)), 'rx': 0.180, 'ry': 0.138},
    {'c': Vector((0, -0.004, 0.725)), 'rx': 0.172, 'ry': 0.133},
]
loft('trousers_seat', seat_rings, 12, 'Spine_1', 'trousers',
     start_pole=Vector((0, 0, SEAT_BOTTOM_Z)), end_pole=Vector((0, -0.004, 0.745)))

# Rope belt: closed tube following the shirt's elliptical cross-section
b_rx, b_ry, b_yo = shirt_at(BELT_Z)
BELT_TUBE_R = H * 0.036 / 2.0
belt_rings = []
BELT_PATH = 12
for i in range(BELT_PATH):
    a = 2 * math.pi * i / BELT_PATH
    c = Vector(((b_rx + 0.008) * math.cos(a), b_yo + (b_ry + 0.008) * math.sin(a), BELT_Z))
    belt_rings.append({'c': c, 'rx': BELT_TUBE_R, 'ry': BELT_TUBE_R, 'ref': Vector((0, 0, 1))})
loft('rope_belt', belt_rings, 6, 'Spine_1', 'hair_rope', closed_path=True)

# Knot on the left hip (front-left), Ø ≈ 6% H, and a dangling round-ended rope tail (12% H)
ka = math.radians(-58)
knot_c = Vector(((b_rx + 0.030) * math.cos(ka), b_yo + (b_ry + 0.030) * math.sin(ka), BELT_Z - 0.004))
ellipsoid('rope_knot', knot_c, (H * 0.03, H * 0.026, H * 0.028), 'Spine_1', 'hair_rope', u=8, v=5)
tail_a = knot_c + Vector((0.010, -0.010, -0.030))
tail_b = knot_c + Vector((0.020, -0.022, -H * 0.12 + 0.012))
capsule('rope_tail', tail_a, tail_b, 0.022, 0.021, 6, 'Spine_1', 'hair_rope', cap_rings=1)
ellipsoid('rope_tail', tail_b + Vector((0, 0, -0.004)), (0.030, 0.030, 0.028), 'Spine_1', 'hair_rope', u=6, v=4)


# --- D. ARMS: tapered capsules + sleeve shells --------------------------------------
def sleeve(name, A, B, r0, r1, bone, t_end, dome=True, start_t=0.0, hem=True):
    """Garment shell along A->B from start_t to t_end (fractions), scalloped open hem."""
    d = (B - A).normalized()
    L = (B - A).length
    rings, pole = [], None
    if dome:
        for phi in (55.0,):
            pr = math.radians(phi)
            rings.append({'c': A - d * (r0 * math.cos(pr)), 'rx': r0 * math.sin(pr), 'ry': r0 * math.sin(pr)})
        pole = A - d * r0
    else:
        rings.append({'c': A + d * (L * start_t), 'rx': r0 * 0.90, 'ry': r0 * 0.90})
    rings.append({'c': A + d * (L * max(start_t, 0.0) + 0.0001), 'rx': r0, 'ry': r0})
    end_c = A + d * (L * t_end)
    r_end = r0 + (r1 - r0) * t_end + (0.006 if hem else 0.0)
    if hem:
        rings.append({'c': end_c, 'rx': r_end, 'ry': r_end, 'off': scallop(HEM_DEPTH, HEM_LOBES)})
    else:
        rings.append({'c': end_c, 'rx': r_end, 'ry': r_end})
    loft(name, rings, 12, bone, 'shirt' if 'sleeve' in name else 'trousers',
         start_pole=pole, ref=Vector((0, 1, 0)))


for side, sign in (('L', 1), ('R', -1)):
    s, e, w = mirror(SHOULDER, sign), mirror(ELBOW, sign), mirror(WRIST, sign)
    if side == 'L':
        # bare upper arm below a short torn cap sleeve
        capsule('arm_upper', s, e, ARM_R_UP, ARM_R_ELB, 8, f'Arm_1_{side}', 'skin')
        sleeve('sleeve_L', s, e, ARM_R_UP + CLOTH + 0.002, ARM_R_ELB + CLOTH, f'Arm_1_{side}', L_SLEEVE_T)
    else:
        # long sleeve: upper part hides the upper arm entirely (no hidden skin geometry needed)
        sleeve('sleeve_R', s, e, ARM_R_UP + CLOTH + 0.002, ARM_R_ELB + CLOTH, f'Arm_1_{side}', 1.10, hem=False)
        sleeve('sleeve_R', e, w, ARM_R_ELB + CLOTH - 0.004, ARM_R_WRIST + CLOTH, f'Arm_2_{side}',
               R_SLEEVE_T, dome=False, start_t=-0.12)
    capsule('arm_fore', e, w, ARM_R_ELB - 0.002, ARM_R_WRIST, 8, f'Arm_2_{side}', 'skin')
    hand_c = w + (w - e).normalized() * (HAND_R * 0.62)
    ellipsoid('hands', hand_c, (HAND_R, HAND_R * 0.94, HAND_R), f'Arm_2_{side}', 'skin', u=8, v=5)

# --- E. LEGS: tapered capsules, asymmetric pant shells, bare round feet ------------------
for side, sign in (('L', 1), ('R', -1)):
    hp, kn, an = mirror(HIP, sign), mirror(KNEE, sign), mirror(ANKLE, sign)
    if side == 'L':
        # long pant leg: thigh shell (Leg_1) + shin shell (Leg_2) ending 60% down the shin
        sleeve('pants_L', hp, kn, THIGH_R + CLOTH + 0.003, KNEE_R + CLOTH + 0.002, f'Leg_1_{side}', 1.08, hem=False)
        sleeve('pants_L', kn, an, KNEE_R + CLOTH - 0.002, ANKLE_R + CLOTH, f'Leg_2_{side}',
               L_PANT_T, dome=False, start_t=-0.14)
    else:
        capsule('leg_thigh', hp, kn, THIGH_R, KNEE_R, 10, f'Leg_1_{side}', 'skin')
        sleeve('pants_R', hp, kn, THIGH_R + CLOTH + 0.003, KNEE_R + CLOTH, f'Leg_1_{side}', R_PANT_T)
    capsule('leg_shin', kn, an, KNEE_R - 0.001, ANKLE_R, 10, f'Leg_2_{side}', 'skin')
    foot_rz = 0.046
    foot_c = Vector((an.x + sign * 0.004, -0.040, foot_rz))
    ellipsoid('feet', foot_c, (0.064, FOOT_L / 2.0, foot_rz), f'Leg_2_{side}', 'skin', u=8, v=5)

# ------------------------------------------------------------------------------
bm.verts.index_update()
vg_indices = {g: [v.index for v in vl] for g, vl in vertex_group_assignments.items()}
bm.to_mesh(mesh_data)
bm.free()
for p in mesh_data.polygons:
    p.use_smooth = True

# ==============================================================================
# 4. RIGGING (rigid 100% weights, pilot scheme)
# ==============================================================================
print("[Protagonist] Step 4: Binding vertex groups and armature modifier...")
for bone in armature.data.bones:
    mesh_obj.vertex_groups.new(name=bone.name)
for group_name, v_indices in vg_indices.items():
    mesh_obj.vertex_groups[group_name].add(v_indices, 1.0, 'REPLACE')
arm_mod = mesh_obj.modifiers.new(name="Armature", type='ARMATURE')
arm_mod.object = armature
mesh_obj.parent = armature
mesh_obj.matrix_parent_inverse.identity()

tri_count = sum(len(p.vertices) - 2 for p in mesh_data.polygons)
zs = [v.co.z for v in mesh_data.vertices]
xs = [v.co.x for v in mesh_data.vertices]
ys = [v.co.y for v in mesh_data.vertices]
print(f"[Protagonist] Mesh: {len(mesh_data.vertices)} verts, {tri_count} tris")
print(f"[Protagonist] BBox: x {max(xs) - min(xs):.4f}  y {max(ys) - min(ys):.4f}  z {min(zs):.4f}..{max(zs):.4f}")
for k in sorted(part_tris):
    print(f"    {k:16s} {part_tris[k]}")

# ==============================================================================
# 5. HEADLESS RENDERS (same camera/light/world as docs/qa/model-pilot) + face close-up
# ==============================================================================
print("[Protagonist] Step 5: Rendering QA views...")
scene = bpy.context.scene
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

world = bpy.data.worlds.new("StudioWorld")
scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes['Background']
bg_node.inputs['Color'].default_value = (0.914, 0.894, 0.855, 1.0)
bg_node.inputs['Strength'].default_value = 0.9

scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.eevee.taa_render_samples = 16

cam_target_z = 0.7284  # identical framing to the pilot renders
views = [
    ("front", (0, -3.5, cam_target_z), (math.radians(90), 0, 0), 2.1, 512),
    ("right", (-3.5, 0, cam_target_z), (math.radians(90), 0, math.radians(-90)), 2.1, 512),
    ("back", (0, 3.5, cam_target_z), (math.radians(90), 0, math.radians(180)), 2.1, 512),
    ("three_quarter", (-2.5, -2.5, cam_target_z + 0.15), (math.radians(82), 0, math.radians(-45)), 2.1, 512),
    ("face_closeup", (0, -3.5, 1.25), (math.radians(90), 0, 0), 0.62, 1024),
]
for vname, pos, rot, oscale, res in views:
    cam_obj.location = pos
    cam_obj.rotation_euler = rot
    cam_data.ortho_scale = oscale
    scene.render.resolution_x = scene.render.resolution_y = res
    out_path = os.path.join(QA_DIR, f"{vname}.png")
    scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)
    print(f"  - Rendered {vname} to {out_path}")

# ==============================================================================
# 6. GLTF 2.0 BINARY EXPORT (same options as pilot)
# ==============================================================================
print("[Protagonist] Step 6: Exporting glTF 2.0 binary...")
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
print(f"[Protagonist] Exported {OUTPUT_GLB}: {tri_count} tris (budget <= 3,000), "
      f"{len(armature.data.bones)} bones.")
