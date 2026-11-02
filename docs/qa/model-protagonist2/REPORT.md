# Protagonist visual uplift round REPORT (castaway variant v2 · 2026-11-02 · executed by official Claude)

Comparison baseline: `docs/model-sheets/protagonist.png`. Previous round: `docs/qa/model-protagonist/`.
Rebuild: from the repo root, `blender --background --python scripts/models/protagonist.py`. Blender builds the mesh and bakes AO and normals, then calls the system `python3` on the same file (`--paint`, PIL + numpy) to paint the textures. Afterwards it renders and exports the glb.
Structure self-check: `blender --background --python docs/qa/model-protagonist2/verify_structure.py`. Comparison image: `python3 docs/qa/model-protagonist2/make_compare.py`.

**Read `compare.png` first.** Top: design front view and model front view, scaled to the same height. Bottom: the two faces side by side.

## 1. Hard-constraint check (data in structure.json)

| Item | Result | Verdict |
|---|---|---|
| Bones | 45 bones. Names, parent/child links and order match round 1 one by one, **0 differences** (`bone_diff_vs_round1`). Also matches the pilot | ✅ |
| 13 mapped bones | All present | ✅ |
| Skinning | Rigid 100% single-bone weights, `rigid_single_bone_weights: true`. Same 10 driving bones | ✅ |
| Bone orientation | Bones are only translated (head and tail move together), roll unchanged; same method as round 1 | ✅ |
| Triangles | **7,174** (budget ≤ 8,000) | ✅ |
| Height | **1.4908 m**, −0.002% vs pilot (tolerance ±1%) | ✅ |
| Origin | min z = 0, ground point between the feet | ✅ |
| mesh / materials | 1 mesh, 2 materials (body atlas + face) | ✅ (spec allows ≤ 2) |
| glb size | 1.78 MB (round 1 was a few dozen KB; almost all of it is the two textures) | note |

## 2. Texture list

| File | Size | Covers | How it is painted |
|---|---|---|---|
| `public/models/protagonist_face.png` | 1024² | Skull | **Analytic UV**: u = azimuth (front ±90° gets 80% of the width), v = polar angle (the top of the head, under the hair, is compressed). The painter maps every pixel back to the 3D skull point through the same skull function, then draws in front-projection coordinates (X, Z). Features: dark-brown eye outline → iris that gets warmer and lighter toward the bottom → pupil → large upper-left highlight plus a small lower-right one; small arched brows; nose shadow (lower right); a single continuous smile arc; pink blush disc with a soft edge; slightly lighter forehead and a slight warm flush on the lower face. Then AO and the light gradient are multiplied in |
| `public/models/protagonist_body.png` | 1024² | All other parts (skin, hair, clothes, rope, leaf) | **One rectangle per part** (shelf packing; long strips are laid sideways). Each part's UV uses its own loft parameters (s around, t along). Hair: strand stripes along each lock, darker root, sun-faded lighter tip, darker underside. Shirt: faded-blue blotches, faint weave, dashed side seams, darker neckline band, folds above the belt. Hems: zig-zag teeth (in the geometry) + darker rolled rim + short dark fray strokes + darker inner lip. Patch: darker rolled edge, cross stitches across the edge plus an inner running stitch, faint weave. Trousers: dashed outer side seam, creases, waistband, centre front/back seams. Rope: three-strand twist with darker grooves. Leaf: midrib, darker edge, lighter tip. Feet: toe creases, warm soles. Ears: inner concha shading |
| `public/models/palette_protagonist.png` | Unchanged | — | No longer referenced by the glb. Left in place untouched (the glb embeds its own textures) |

**Volume (point 4):** Cycles bakes AO (distance 0.14 m) and object-space normals into both textures. The painter computes `albedo × (0.58 + 0.42·AO) × (0.90 + 0.14·max(N·L,0) − 0.05·max(−N·L,0))`, with L = upper left of the front view. The shaded side gets a slight lavender tint (matching the design sheet's lighting). The bake produces the darkening under the neck, in the armpits, under the belt, inside the hems and at the roots between hair layers directly; nothing is painted by hand there.

**UV alignment self-check (done before painting the face, point 1):** `uv_face_check.png`. Blue = the skull mesh UV wire exported from Blender. Green + = the 3D landmarks (eyes, brows, nose, mouth, blush) ray-cast onto the real mesh in Blender, then looked up through that triangle's UVs using barycentric coordinates. All 8 crosshairs land on the centres of the painted features. `uv_atlas_check.png` shows the rectangle for each part.

**Conflicts with the spec, flagged here:** spec §3 says "textures ≤ 512², flat colour fill, no texture detail". This round follows the user's instruction instead (painted textures, face ≥ 1024²). If the spec must keep 512², downscaling both images to 512² still holds up visually. The face loses some detail.

## 3. Triangle allocation (7,174 total)

| Group | Triangles | Breakdown |
|---|---|---|
| **Hair** | **3,420** | Crown 7 × 96 = 672, mid row 576, sides/temples 792, nape 360, fringe 6 × 96 = 576, under-cap 252, tuft 96, leaf 96 |
| **Face/head** | **1,150** | Skull 896 (32 columns × 14 rows, dense across the face), ears 200, nose 54. The face is texture only, so eyes, mouth and blush use no geometry |
| Clothes | 1,508 | Shirt 300, sleeves 220, patch 140, trouser seat 84, left trouser leg 180, right trouser leg 132, rope belt 256, knot 100, rope tail 96 |
| Body | 1,096 | Arms 320, hands 200, legs 304, feet 240, neck 32 |

## 4. Proportions (measured from the glb)

| | Round 1 | Round 2 | Design sheet (measured) | Spec |
|---|---|---|---|---|
| Head (chin → hair top) / height | 29.0% | **35.9%** (2.78 heads tall) | ≈ 45% (≈ 2.2 heads tall) | 29% |
| Head width incl. hair / height | 31.8% | **49.9%** | ≈ 53% | 31% |
| Torso | 34.0% | 27.1% | ≈ 33% | 34% |
| Legs | 37.0% | 37.0% (unchanged) | ≈ 22% | 37% |

**This is a deliberate departure from the spec.** The spec's 3.5 heads tall is a big part of why round 1 looked so different from the sheet. This round moved the chin from 1.0585 to 0.955 and made the skull and hair larger, so the head grows into the torso. **Leg joints and leg length were not touched**: walk-cycle stride and ground contact stay the same. If the user wants the original spec proportions back, set `CHIN_Z` and the skull radii back to their round-1 values; that is three constants in the script.

## 5. Point-by-point comparison with the design sheet: what matches, what still differs

**Hair (point 2)**
- What matches: the silhouette has been pushed out. Width incl. hair went from 31.8% to 49.9%, the sides flare outward at temple height, the fringe falls in separate locks over the forehead, and the ears show below the side hair. The back and side views now read as the design's layered "scales" (`back.png` and `right.png` are the closest views to the design). The tuft is a short stem with a round bulb. The leaf **is now on the character's left (+X)**, which is the viewer's right in the front view, matching the design. Round 1 had it on the wrong side.
- Still differs: ① The design's locks are thick, soft, clay-like "big petals". Mine are thinner and more sheet-like, and at close range you can see faceted intersection lines where locks cut into each other (`face_closeup.png`, top of the head). ② The fringe and side locks are fairly uniform in direction. The design's fringe has one large lock sweeping across the forehead, and the right side is noticeably fuller than the left. Mine is close to symmetric. ③ The overall shape is a bit "bowl-cut / mushroom". The design's crown is fuller and rounder. ④ Hair colour: the spec hue `#B08158` painted one value step darker, but under the shared render lighting it still reads light tan. The design is chocolate brown. To match, the spec colour itself would need to go darker (needs user approval).

**Face (point 1)**
- What matches: the face is now painted rather than built from geometric dots. Brown eyes with iris and highlights, small brows, nose shadow, a smooth smile arc, soft-edged blush. Eye spacing and position follow the design (eye spacing 45% of skull half-width units, roughly the design's 50%). Brows are painted but sit just under the fringe, so they may not show.
- Still differs: ① The design's eyes are **plain dark-brown ovals with no highlight**. The user asked for iris and highlights, so mine are more "anime-style". That is a deliberate difference. ② The design's nose is a small orange, fairly sharp triangle. Mine is the spec colour `#DB9A78`, a soft, rounded pink-brown cone. ③ Under the shared render lighting the blush leans lavender/grey. On the design it is warm peach-pink. ④ The design face is peachier (`#F5C8A8`-ish); the spec skin `#E8B88C` renders greyer under this lighting.

**Clothes (point 3)**
- What matches: the shirt hem, sleeve ends and trouser hems are now zig-zag torn edges (10 / 5 / 6 teeth of uneven depth), with a dark rolled rim, fray strokes and a darker inner lip. The patch has cross stitches and a running stitch. The rope has a three-strand twist with grooves. Trousers have side seams and creases. Skin is no longer a flat colour.
- Still differs: ① **The legs are much longer than the design's** (see the proportions table). In the design they are short shorts with stubby legs. This is the biggest remaining gap in the front comparison. ② Trouser asymmetry follows the spec (left below the knee, right above the knee) and reads clearly. The design is actually close to symmetric (both above the knee); spec wins here. ③ The shirt is spec `#8DC4DA`, which renders as light cyan. The design is a dusty slate blue. ④ The patch is larger and higher than in the design (spec 14%). The design's patch is smaller, sits lower and is pressed by the belt knot. ⑤ The design has a torn opening on the character's left shoulder. I didn't add one (the spec bans small holes).
- **Sleeves differ from the spec text:** spec says "left sleeve at 30% of the upper arm, right sleeve to mid-forearm". This round follows the design: left (+X) is torn off near the shoulder (22% of the upper arm), right is a short sleeve (62% of the upper arm). Both are torn zig-zag edges, and the difference between them is still easy to see. To restore the spec, change `L_SLEEVE_T` / `R_SLEEVE_T` and give the right sleeve a forearm segment again (round-1 code).

**Overall volume (point 4)**
- What matches: AO shows clearly under the neck, under the belt, inside the hems, in the armpits and between hair layers. There is a gradient from the lit side to the shade.
- Still differs: the render setup (camera, lights, background, colour management) is **the same as round 1, as required**. It is grey and washes everything out. The design is a warm-toned soft-light render. Roughly half of the "colour looks off" impression in compare.png comes from the render environment and the spec colours, not the model. Arms and hands are still a bit chunky (design arms are slimmer). The feet are smaller and have less toe definition than the design's.

**Things to fix first next round:** ① Ask the user whether legs and torso should follow the design proportions (shorter legs requires moving the leg joints, so animation would need re-checking). ② Ask whether the spec colours for hair, shirt and nose should move toward the design. ③ Thicker hair locks, larger and asymmetric, with fewer intersection lines.

## 6. Renders and other files

- `front / right / back / three_quarter / face_closeup.png`: camera, lights, background and resolution are identical to round 1.
  Note: **the inherited three_quarter camera is pitched 8° down, so the bigger hair is now clipped at the top of the frame.** The image is kept to stay comparable. I also added `three_quarter_full.png` (same angle, aimed at the model centre).
- `compare.png`, `uv_face_check.png`, `uv_atlas_check.png`, `structure.json`, `verify_structure.py` (adds the diff against round 1's bones plus texture info), `make_compare.py`.
- Bake intermediates (AO and normal images, atlas.json) are in `~/.cache/castaway-protag/p2/`, outside the repo. Backups of round 1's script and glb are also there.
- Untouched: everything outside the allowed scope; `palette_protagonist.png` was not modified. No git commit.

## 7. Runtime notes (for the controller when re-checking on the NUC)

- The material changed from a single palette texture to **two materials, two 1024² baseColor textures**, sampler Linear. If the game code replaces the material or reads `palette_protagonist.png` by name, it will lose these textures. Check that the code uses the material that ships inside the glb.
- Lighting and AO are baked into the textures. Combined with the game's own lighting the shade side gets darker; the bake is kept light (AO contributes at most 42%).
- Joints moved: shoulder 0.918 → 0.884, chin/Head bone 1.0585 → 0.955, Spine_2/3 and Neck moved down with them. Leg joints unchanged. Run the walk, run, jump and swing regressions again, and check that the head-top hit box / name tag height still match the new head.
- Rendering environment is the same as last round (EGL libraries unpacked to `~/.cache/castaway-protag/egl`, llvmpipe). Painting needs the system python3 with PIL and numpy; Blender's bundled Python has no PIL.
