"""Round-3 QA images and colour samples. Run from repo root with system python3 (PIL + numpy):
  python3 docs/qa/model-protagonist3/make_qa_images.py
Writes compare.png, tiny64.png (+ tiny64_x8.png enlarged for reading, tiny64_fullframe.png) and
samples.json (texture values read from the PNGs embedded in the GLB + render values + face metrics)."""
import json, os, struct, io, colorsys, hashlib
import numpy as np
from PIL import Image, ImageDraw

QA = "docs/qa/model-protagonist3"
GLB = "public/models/protagonist.glb"
WORK = os.path.expanduser("~/.cache/castaway-protag/p3")
sheet = Image.open("docs/model-sheets/protagonist.png").convert("RGB")
front = Image.open(f"{QA}/front.png").convert("RGB")


def bbox_fg(im, bg_tol=18):
    a = np.asarray(im).astype(int)
    m = np.abs(a - a[2, 2]).sum(-1) > bg_tol
    ys, xs = np.where(m)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def hx(p):
    return "#%02X%02X%02X" % tuple(int(round(c)) for c in p)


def hsv(p):
    h, s, v = colorsys.rgb_to_hsv(*(c / 255 for c in p))
    return {"S": round(s, 3), "V": round(v, 3)}


# ---------------------------------------------------------------- compare.png
d = sheet.crop((90, 0, sheet.width // 4 + 60, sheet.height))
d = d.crop(bbox_fg(d))
m = front.crop(bbox_fg(front))
HT = 800
d = d.resize((int(d.width * HT / d.height), HT), Image.LANCZOS)
m = m.resize((int(m.width * HT / m.height), HT), Image.LANCZOS)
out = Image.new("RGB", (40 + d.width + 60 + m.width + 40, 50 + HT + 30), (233, 228, 218))
dr = ImageDraw.Draw(out)
out.paste(d, (40, 40))
out.paste(m, (40 + d.width + 60, 40))
dr.text((40, 15), "DESIGN SHEET front (docs/model-sheets/protagonist.png)", fill=(0, 0, 0))
dr.text((40 + d.width + 60, 15), "MODEL round 3 front.png (same height)", fill=(0, 0, 0))
out.save(f"{QA}/compare.png")

# ---------------------------------------------------------------- tiny64
x0, y0, x1, y1 = bbox_fg(front)
side = max(x1 - x0, y1 - y0) + 4
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
sq = front.crop((cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side))
tiny = sq.resize((64, 64), Image.NEAREST)
tiny.save(f"{QA}/tiny64.png")
tiny.resize((512, 512), Image.NEAREST).save(f"{QA}/tiny64_x8.png")
front.resize((64, 64), Image.NEAREST).resize((512, 512), Image.NEAREST).save(f"{QA}/tiny64_fullframe_x8.png")

# ---------------------------------------------------------------- texture samples (from the GLB itself)
raw = open(GLB, "rb").read()
jlen = struct.unpack("<I", raw[12:16])[0]
gj = json.loads(raw[20:20 + jlen])
bin0 = 20 + jlen + 8
glb_imgs = {}
for im in gj["images"]:
    bv = gj["bufferViews"][im["bufferView"]]
    data = raw[bin0 + bv.get("byteOffset", 0): bin0 + bv.get("byteOffset", 0) + bv["byteLength"]]
    glb_imgs[im["name"]] = Image.open(io.BytesIO(data)).convert("RGB")
body = face = None
for nm, im in glb_imgs.items():
    if "face" in nm.lower():
        face = np.asarray(im).astype(int)
    else:
        body = np.asarray(im).astype(int)
meta = json.load(open(os.path.join(WORK, "atlas.json")))
N = body.shape[0]
tex = {}
for part in meta["parts"]:
    px, py, w, h = part["px"]
    blk = body[N - (py + h) + 1:N - py - 1, px + 1:px + w - 1].reshape(-1, 3)
    vals, cnt = np.unique(blk, axis=0, return_counts=True)
    key = part["kind"]
    tex.setdefault(key, {"unique_values": set(), "pixels": 0})
    for v in vals:
        tex[key]["unique_values"].add(hx(v))
    tex[key]["pixels"] += int(len(blk))
tex = {k: {"unique_values": sorted(v["unique_values"]), "pixels": v["pixels"]} for k, v in tex.items()}
fvals, fcnt = np.unique(face.reshape(-1, 3), axis=0, return_counts=True)
order = np.argsort(-fcnt)[:4]
face_top = [{"value": hx(fvals[i]), "share_pct": round(fcnt[i] / fcnt.sum() * 100, 2)} for i in order]

# ---------------------------------------------------------------- render samples (front.png, 512 px, ortho 2.1 m)
a = np.asarray(front).astype(int)
MPP = 2.1 / 512


def px_of(x, z):
    return int(round(256 + x / MPP)), int(round(256 - (z - 0.7284) / MPP))


def med(x, z, r=2):
    c, rr = px_of(x, z)
    return np.median(a[rr - r:rr + r + 1, c - r:c + r + 1].reshape(-1, 3), 0)


arr = a.astype(float)
hsv_img = np.array([colorsys.rgb_to_hsv(*(p / 255)) for p in arr.reshape(-1, 3)]).reshape(a.shape)
green = (hsv_img[..., 0] > 0.20) & (hsv_img[..., 0] < 0.36) & (hsv_img[..., 1] > 0.35)
render = {
    "hair_top_tuft": med(0.0, 1.455), "shirt_chest_right": med(-0.11, 0.84), "patch_centre": med(0.058, 0.772),
    "skin_forehead": med(0.0, 1.285), "skin_left_upper_arm": med(0.245, 0.78), "trousers_left_shin": med(0.098, 0.25),
    "leaf_median_of_green_pixels": np.median(a[green], 0) if green.any() else np.zeros(3),
}
render = {k: {"value": hx(v), **hsv(v)} for k, v in render.items()}

# ---------------------------------------------------------------- face metrics from face_closeup.png
fc = np.asarray(Image.open(f"{QA}/face_closeup.png").convert("RGB")).astype(int)
FMPP = 0.62 / 1024        # ortho 0.62 m over 1024 px, centred at x=0, z=1.25


def blobs(mask):
    from collections import deque
    seen = np.zeros_like(mask, bool)
    out = []
    for y, x in zip(*np.where(mask)):
        if seen[y, x]:
            continue
        q, pts = deque([(y, x)]), []
        seen[y, x] = True
        while q:
            cy_, cx_ = q.popleft()
            pts.append((cy_, cx_))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = cy_ + dy, cx_ + dx
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        if len(pts) > 200:
            p = np.array(pts)
            out.append({"w_m": (p[:, 1].ptp() + 1) * FMPP, "h_m": (p[:, 0].ptp() + 1) * FMPP,
                        "cx_m": (p[:, 1].mean() - 512) * FMPP, "cz_m": 1.25 - (p[:, 0].mean() - 512) * FMPP,
                        "n": len(pts)})
    return out


dark = np.abs(fc - np.array([113, 81, 60])).sum(-1) < 60
pink = (fc[..., 0] > 180) & (fc[..., 2] > fc[..., 1] + 5)
eyes = sorted([b for b in blobs(dark) if 0.02 < b["w_m"] < 0.07 and b["h_m"] > b["w_m"]], key=lambda b: b["cx_m"])
blush = sorted([b for b in blobs(pink) if b["w_m"] > 0.02], key=lambda b: b["cx_m"])
st = json.load(open(f"{QA}/structure.json"))
HW = st["proportions_measured_from_glb"]["head_width_incl_hair_ears_m"]
chin = st["proportions_measured_from_glb"]["chin_z_m"]
top = st["bbox"]["max"][2]
fm = {"head_width_used_m": HW, "eyes": eyes, "blush": blush}
if len(eyes) == 2:
    fm["eye_diameter_pct_head_w"] = round(np.mean([e["w_m"] for e in eyes]) / HW * 100, 2)
    fm["eye_height_pct_head_w"] = round(np.mean([e["h_m"] for e in eyes]) / HW * 100, 2)
    fm["eye_spacing_pct_head_w"] = round((eyes[1]["cx_m"] - eyes[0]["cx_m"]) / HW * 100, 2)
    fm["eye_centre_pct_down_from_top"] = round((top - np.mean([e["cz_m"] for e in eyes])) / (top - chin) * 100, 2)
if len(blush) == 2:
    fm["blush_diameter_pct_head_w"] = round(np.mean([b["w_m"] for b in blush]) / HW * 100, 2)

json.dump({"texture_values_in_glb": tex, "face_texture_top_values": face_top, "render_front_png": render,
           "face_metrics_from_render": fm,
           "glb_embedded_png_md5": {k: hashlib.md5(v.tobytes()).hexdigest() for k, v in glb_imgs.items()}},
          open(f"{QA}/samples.json", "w"), indent=1, default=float)
print(json.dumps({"tex": {k: v["unique_values"] for k, v in tex.items()}, "face": face_top, "render": render},
                 indent=0))
print(json.dumps({k: v for k, v in fm.items() if k not in ("eyes", "blush")}))
