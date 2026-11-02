"""Side-by-side: design sheet front vs model front (same height), plus face close-ups.
Run from repo root with system python3 (PIL + numpy):  python3 docs/qa/model-protagonist2/make_compare.py"""
import numpy as np
from PIL import Image, ImageDraw

QA = "docs/qa/model-protagonist2"
sheet = Image.open("docs/model-sheets/protagonist.png").convert("RGB")
model = Image.open(f"{QA}/front.png").convert("RGB")
face = Image.open(f"{QA}/face_closeup.png").convert("RGB")


def bbox_fg(im, bg_tol=18):
    a = np.asarray(im).astype(int)
    bg = a[2, 2]
    m = np.abs(a - bg).sum(-1) > bg_tol
    ys, xs = np.where(m)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


# design front view = left quarter of the sheet, skipping the ruler
d = sheet.crop((90, 0, sheet.width // 4 + 60, sheet.height))
dx0, dy0, dx1, dy1 = bbox_fg(d)
d = d.crop((dx0, dy0, dx1, dy1))
mx0, my0, mx1, my1 = bbox_fg(model)
m = model.crop((mx0, my0, mx1, my1))
HT = 800
d = d.resize((int(d.width * HT / d.height), HT), Image.LANCZOS)
m = m.resize((int(m.width * HT / m.height), HT), Image.LANCZOS)

# face: design head region vs close-up (scaled to the same face width)
dh = sheet.crop((100, 60, 500, 420))
fh = face.crop((0, 60, 1024, 1024))
fh = fh.resize((int(fh.width * 360 / fh.height), 360), Image.LANCZOS)
dh = dh.resize((int(dh.width * 360 / dh.height), 360), Image.LANCZOS)

W = 40 + d.width + 40 + m.width + 40
W = max(W, 40 + dh.width + 40 + fh.width + 40)
out = Image.new("RGB", (W, 60 + HT + 70 + 360 + 40), (233, 228, 218))
dr = ImageDraw.Draw(out)
out.paste(d, (40, 50))
out.paste(m, (40 + d.width + 40, 50))
dr.text((40, 20), "DESIGN SHEET (front)", fill=(0, 0, 0))
dr.text((40 + d.width + 40, 20), "MODEL round 2 (front.png, same height)", fill=(0, 0, 0))
y2 = 50 + HT + 50
out.paste(dh, (40, y2))
out.paste(fh, (40 + dh.width + 40, y2))
dr.text((40, y2 - 22), "DESIGN face", fill=(0, 0, 0))
dr.text((40 + dh.width + 40, y2 - 22), "MODEL face_closeup.png", fill=(0, 0, 0))
out.save(f"{QA}/compare.png")
print("compare", out.size)
