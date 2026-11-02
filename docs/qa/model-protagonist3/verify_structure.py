"""Structure self-check for public/models/protagonist.glb (run from repo root):
  blender --background --python docs/qa/model-protagonist3/verify_structure.py
Re-imports the exported GLB (nothing is read from the build script), diffs the skeleton against
rounds 1 and 2 and the pilot, measures height / origin / head-torso-leg split from the mesh, and
writes structure.json."""
import bpy, json, os

GLB = "public/models/protagonist.glb"
QA = "docs/qa/model-protagonist3"
R1 = "docs/qa/model-protagonist"
R2 = "docs/qa/model-protagonist2"
MAPPED = ["Leg_1_L", "Leg_1_R", "Leg_2_L", "Leg_2_R", "Arm_1_L", "Arm_1_R", "Head",
          "S_Tail_1", "S_Tail_2", "S_Tail_3", "Spine_1", "Arm_2_L", "Arm_2_R"]
pilot = json.load(open(os.path.join(R1, "pilot_baseline.json")))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
bones = [[b.name, b.parent.name if b.parent else None] for b in arm.data.bones]
pilot_bones = [b[:2] for b in pilot["bones"]]

dg = bpy.context.evaluated_depsgraph_get()
meshes, tris, allv, groups = {}, 0, [], {}
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
    return [min(p[i] for p in pts) for i in range(3)], [max(p[i] for p in pts) for i in range(3)]


mn, mx = bbox(allv)
size = [mx[i] - mn[i] for i in range(3)]
H = size[2]
hmn, hmx = bbox(groups["Head"])
head_h, head_w = hmx[2] - hmn[2], hmx[0] - hmn[0]
chin = hmn[2]
# crotch = lowest point of torso-driven geometry between the legs (trouser seat)
crotch = min(p[2] for p in groups["Spine_1"] if abs(p[0]) < 0.03)


def hier_diff(prev_path):
    prev = json.load(open(os.path.join(prev_path, "structure.json")))
    ph = [tuple(b) for b in prev["bones"]["hierarchy"]]
    ch = [tuple(b) for b in bones]
    return {"only_in_previous": [b for b in ph if b not in ch], "only_in_round3": [b for b in ch if b not in ph],
            "order_identical": ph == ch}


d1, d2 = hier_diff(R1), hier_diff(R2)
res = {
    "glb": GLB,
    "bones": {
        "count": len(bones),
        "names_and_parents_identical_to_pilot": bones == pilot_bones,
        "mapped_13": {b: (b in [x[0] for x in bones]) for b in MAPPED},
        "mapped_13_all_present": all(b in [x[0] for x in bones] for b in MAPPED),
        "hierarchy": bones,
    },
    "bone_diff_vs_round1": d1,
    "bone_diff_vs_round2": d2,
    "bone_diff_count": len(d1["only_in_previous"]) + len(d1["only_in_round3"]) +
                       len(d2["only_in_previous"]) + len(d2["only_in_round3"]),
    "triangles_total": tris,
    "triangle_budget": 8000,
    "within_budget": tris <= 8000,
    "meshes": meshes,
    "weighted_bones": sorted(groups),
    "bbox": {"min": list(mn), "max": list(mx), "size_xyz_m": size},
    "pilot_bbox_size_xyz_m": pilot["size"],
    "height_m": H,
    "height_vs_pilot_pct": round((H / pilot["size"][2] - 1) * 100, 3),
    "height_within_1pct": abs(H / pilot["size"][2] - 1) <= 0.01,
    "origin_ground_center": {"min_z": mn[2], "center_x": (mn[0] + mx[0]) / 2, "center_y": (mn[1] + mx[1]) / 2},
    "proportions_measured_from_glb": {
        "method": "Head = bbox of vertices weighted to the Head bone (chin -> top tuft); "
                  "torso = chin -> lowest Spine_1 vertex with |x| < 3 cm (trouser crotch); legs = ground -> crotch",
        "chin_z_m": chin, "crotch_z_m": crotch,
        "head_height_m": head_h,
        "head_pct": round(head_h / H * 100, 2),
        "torso_pct": round((chin - crotch) / H * 100, 2),
        "legs_pct": round((crotch - mn[2]) / H * 100, 2),
        "heads_tall": round(H / head_h, 3),
        "head_width_incl_hair_ears_m": head_w,
        "head_width_pct": round(head_w / H * 100, 2),
        "spec_targets_pct": {"head": 29, "torso": 34, "legs": 37, "head_width": 31},
    },
    "textures": {i.name: list(i.size) for i in bpy.data.images},
    "materials": sorted({m for o in meshes.values() for m in o["materials"]}),
    "glb_bytes": os.path.getsize(GLB),
}
dv = os.path.expanduser("~/.cache/castaway-protag/p3/design_values.json")
if os.path.exists(dv):
    d = json.load(open(dv))
    res["triangles_by_part"] = d["triangles"]
    res["build_parameters_not_measurements"] = {k: d[k] for k in d if k != "triangles"}
json.dump(res, open(os.path.join(QA, "structure.json"), "w"), indent=2, ensure_ascii=False)
print("STRUCTURE", json.dumps({k: res[k] for k in ("triangles_total", "height_m", "height_vs_pilot_pct",
                                                    "bone_diff_count", "origin_ground_center")}),
      json.dumps(res["proportions_measured_from_glb"]), "pilot_identical",
      res["bones"]["names_and_parents_identical_to_pilot"], "mapped13", res["bones"]["mapped_13_all_present"],
      "rigid", all(m["rigid_single_bone_weights"] for m in meshes.values()))
