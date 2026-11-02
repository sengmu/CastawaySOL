"""Structure self-check for public/models/protagonist.glb (run from repo root):
  blender --background --python docs/qa/model-protagonist2/verify_structure.py
Re-imports the exported GLB, compares against the pilot baseline, writes structure.json."""
import bpy, json, os

GLB = "public/models/protagonist.glb"
QA = "docs/qa/model-protagonist2"
PREV = "docs/qa/model-protagonist"
MAPPED = ["Leg_1_L", "Leg_1_R", "Leg_2_L", "Leg_2_R", "Arm_1_L", "Arm_1_R", "Head",
          "S_Tail_1", "S_Tail_2", "S_Tail_3", "Spine_1", "Arm_2_L", "Arm_2_R"]
pilot = json.load(open(os.path.join(PREV, "pilot_baseline.json")))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
bones = [[b.name, b.parent.name if b.parent else None] for b in arm.data.bones]
pilot_bones = [b[:2] for b in pilot["bones"]]

dg = bpy.context.evaluated_depsgraph_get()
meshes, tris, allv = {}, 0, []
groups = {}
for o in bpy.data.objects:
    if o.type != 'MESH' or o.name.startswith('Icosphere'):  # Icosphere = importer bone-display shape
        continue
    me = o.evaluated_get(dg).to_mesh()
    t = sum(len(p.vertices) - 2 for p in me.polygons)
    meshes[o.name] = {"triangles": t, "vertices": len(me.vertices),
                      "materials": [m.name for m in o.data.materials]}
    tris += t
    names = {g.index: g.name for g in o.vertex_groups}
    rigid = True
    for v in me.vertices:
        w = (o.matrix_world @ v.co)
        allv.append(w)
        ws = [(names[g.group], g.weight) for g in o.data.vertices[v.index].groups if g.weight > 1e-4]
        if len(ws) != 1 or abs(ws[0][1] - 1.0) > 1e-3:
            rigid = False
        for gname, _ in ws:
            groups.setdefault(gname, []).append(w)
    meshes[o.name]["rigid_single_bone_weights"] = rigid

def bbox(pts):
    mn = [min(p[i] for p in pts) for i in range(3)]
    mx = [max(p[i] for p in pts) for i in range(3)]
    return mn, mx

mn, mx = bbox(allv)
size = [mx[i] - mn[i] for i in range(3)]
H = size[2]
hmn, hmx = bbox(groups["Head"])
head_h, head_w = hmx[2] - hmn[2], hmx[0] - hmn[0]
chin = hmn[2]
# crotch = lowest point of torso-driven geometry between the legs (trouser seat)
seat = [p for p in groups["Spine_1"] if abs(p[0]) < 0.03]
crotch = min(p[2] for p in seat)

res = {
    "glb": GLB,
    "bones": {
        "count": len(bones),
        "names_and_parents_identical_to_pilot": bones == pilot_bones,
        "mapped_13": {b: (b in [x[0] for x in bones]) for b in MAPPED},
        "mapped_13_all_present": all(b in [x[0] for x in bones] for b in MAPPED),
        "hierarchy": bones,
    },
    "triangles_total": tris,
    "triangle_budget": 8000,
    "within_budget": tris <= 8000,
    "meshes": meshes,
    "weighted_bones": sorted(groups),
    "bbox": {"min": mn, "max": mx, "size_xyz_m": size},
    "pilot_bbox_size_xyz_m": pilot["size"],
    "height_vs_pilot_pct": round((H / pilot["size"][2] - 1) * 100, 3),
    "height_within_1pct": abs(H / pilot["size"][2] - 1) <= 0.01,
    "origin_ground_center": {"min_z": mn[2], "center_x": (mn[0] + mx[0]) / 2},
    "proportions": {
        "head_height_chin_to_hair_top_m": head_h,
        "head_ratio_pct": round(head_h / H * 100, 2),
        "heads_tall": round(H / head_h, 3),
        "head_width_incl_hair_m": head_w,
        "head_width_ratio_pct": round(head_w / H * 100, 2),
        "torso_crotch_to_chin_pct": round((chin - crotch) / H * 100, 2),
        "legs_ground_to_crotch_pct": round((crotch - mn[2]) / H * 100, 2),
        "spec_targets_pct": {"head": 29, "head_width": 31, "torso": 34, "legs": 37},
    },
}
json.dump(res, open(os.path.join(QA, "structure.json"), "w"), indent=2, ensure_ascii=False)
print("STRUCTURE", json.dumps({k: res[k] for k in ("triangles_total", "within_budget", "height_vs_pilot_pct")}),
      "bones", len(bones), "identical", res["bones"]["names_and_parents_identical_to_pilot"],
      "mapped13", res["bones"]["mapped_13_all_present"], "props", json.dumps(res["proportions"]))

# Round-2 additions: bone-by-bone diff against round 1, textures, image sizes
prev = json.load(open(os.path.join(PREV, "structure.json")))
prev_h = [tuple(b) for b in prev["bones"]["hierarchy"]]
cur_h = [tuple(b) for b in bones]
diff = {"only_in_round1": [b for b in prev_h if b not in cur_h],
        "only_in_round2": [b for b in cur_h if b not in prev_h],
        "order_identical": prev_h == cur_h}
imgs = {i.name: list(i.size) for i in bpy.data.images}
res["bone_diff_vs_round1"] = diff
res["bone_diff_count"] = len(diff["only_in_round1"]) + len(diff["only_in_round2"])
res["textures"] = imgs
res["materials"] = sorted({m for o in meshes.values() for m in o["materials"]})
res["glb_bytes"] = os.path.getsize(GLB)
bd = os.path.expanduser("~/.cache/castaway-protag/p2/tri_breakdown.json")
if os.path.exists(bd):
    res["triangles_by_part"] = json.load(open(bd))
json.dump(res, open(os.path.join(QA, "structure.json"), "w"), indent=2, ensure_ascii=False)
print("ROUND2", json.dumps({"bone_diff_count": res["bone_diff_count"], "order_identical": diff["order_identical"],
                            "textures": imgs, "glb_bytes": res["glb_bytes"]}))
