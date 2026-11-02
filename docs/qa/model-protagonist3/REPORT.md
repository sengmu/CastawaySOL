# Protagonist round 3 REPORT (director P0/P1 fix pass · 2026-11-02 · executed by official Claude)

Basis: `protagonist-director-review.md` + `round-protagonist-fix3.txt` (proportions follow the user's ruling: back to the spec's 3.5 heads tall). Where the design sheet conflicts with the spec or the director, the spec or director wins.
Rebuild: from the repo root, `blender --background --python scripts/models/protagonist.py` (Blender builds the model and calls the system python3 to paint the textures). Self-checks: `blender --background --python docs/qa/model-protagonist3/verify_structure.py`, then `python3 docs/qa/model-protagonist3/make_qa_images.py`.

## 0. Conclusions first

- **Colour root cause found (this matters most):** the round-2 render pipeline used Blender's default **AgX** view transform. I used AgX for `front_agx_legacy.png` in this round. With textures exactly on spec, it renders hair as **#C19D82** and the shirt as **#ACC0C7**. These are almost exactly the director's measurements (#C09D81 and #ABBFC6). So the "greyish, light, washed-out" colours the director measured were mostly **produced by the render pipeline**, not by texture values. Round 2's textures also had an extra layer of baked light and dark with a lavender tint (skin albedo #EAB78D → texture #CDA17F), which made it worse.
- This round: ① textures go back to flat spec colours with no baked shading. Every region of the glb's embedded textures contains **exactly one value, and it is the spec hex**. ② QA renders keep the camera, both sun lamps, the world colour and the resolution unchanged. Only the colour management changes: AgX → **Standard, −0.75 EV** (calibrated so the brightest lit area of the face ≈ albedo). **This is the one change to the render setup vs rounds 1/2, and I'm stating it plainly.** If you require exactly the same setup as before, compare against `front_agx_legacy.png` / `face_closeup_agx_legacy.png`.
- Proportions measured from the glb: **head 29.00% / torso 34.00% / legs 37.00% (3.448 heads tall)**. Bone diff 0. 7,182 triangles. Height 1.4908 m.
- **Not met / borderline (not hidden):** ① In the 64×64 image the three hair tufts are **only borderline countable** (details in §4). ② The patch and the shirt differ clearly in hue but **very little in brightness** (luminance 0.57 vs 0.51; the palette fixes this). ③ The hair cap still looks a bit like a knitted beanie.

## 1. Hard constraints (structure.json, measured from the re-imported glb)

| Item | Result |
|---|---|
| Bones | 45 bones. Names and hierarchy identical to the pilot and to rounds 1 and 2: `bone_diff_count: 0`, order identical. All 13 mapped bones present |
| Skin weights | Rigid single-bone 100% weights (`rigid_single_bone_weights: true`). Same 10 driving bones. Bones only translated (back to round-1 joint positions) |
| Height / origin | 1.4908 m (−0.002% vs pilot). min z = 0, centre x = 0 |
| Triangles | **7,182** ≤ 8,000 (hair 1,256 / face and head 1,150 / clothes 3,392 / body 1,384) |
| Three-part split (glb measured) | Chin z 1.0585, crotch z 0.5516 → **head 29.0% / torso 34.0% / legs 37.0%**. Head width (incl. hair and ears) 0.4735 m = **31.8%** (spec ~31%; the side tuft that sticks out to the side adds 0.8 pp) |
| Materials / textures | 1 mesh, 2 materials. `protagonist_body.png` 512² (flat colour blocks, spec ≤ 512²); `protagonist_face.png` 1024² (needs the face features; same as round 2, exceeds the spec's 512²). glb 334 KB (round 2 was 1.78 MB) |
| Files touched | Only the five allowed files plus this directory. `palette_protagonist.png` md5 unchanged (still unused by the glb). No git commit |

## 2. Director P0 / P1 item by item

All face and hair percentages use **head width = 0.474 m** (measured from the glb incl. hair) as the base.

| # | Director target | Implementation | Measured / actual value | Verdict |
|---|---|---|---|---|
| P0-1 hair: three tufts | Top / left side / back, each Ø 28–35% of head width; overlap 15–25%; asymmetric silhouette | Smooth round cap (thin on top, thick at the hairline) + 3 spheres. Top tuft is offset 5 cm toward the viewer's left, its top exactly at the height H. The side tuft sticks out at upper left; the back tuft shows at upper right behind the top tuft | Ø top 34.0% / side 33.0% / back 33.0%. Overlap top–side 16%, top–back 17% (side and back don't touch). Left/right silhouette clearly asymmetric | ✅ (geometry) |
| P0-1 hairline | Big arc; more than 2 consecutive small points fails | Cap's lower edge is one continuous arc table (forehead centre polar 53° → temples 84° → back of head 137°), smooth rounded rim tucked into the skull | 0 fringe teeth (see `face_closeup.png`) | ✅ |
| P0-1 hair colour | #B08158, S ≤ 0.55, nothing lighter than #C09D81 | Flat spec colour | **Texture sample #B08158 (S 0.50)**, the only value in hair, cap and rope regions. Render (Standard): lit area of top tuft #B7865E, shaded side #A67A57 | ✅ |
| P0-1 64px | Three tufts countable | — | See §4: **borderline** | ⚠️ |
| P0-2 leaf | Long axis 0.30 × head width, width 0.18, thickness ≥ 2% H, upper back right, sticks out of the hair, #8CCB5E, no veins | Rounded egg-shaped thick plate on the back tuft, sticking out to the upper right; automatically lowered so it never exceeds H | Long 0.142 m (30%), width 0.085 m (18%), **thickness 0.031 m = 2.1% H**. Texture #8CCB5E only value; render #8FC660 | ✅ |
| P0-3 torn edges | 2–3 large arc notches per opening; width ≥ 5% H (0.0745), depth ≥ 2% H (0.0298), corner radius ≥ 2% H; remove all zig-zag | Raised-cosine notches (smooth everywhere; minimum radius of curvature = w²/(2π²d)). Shirt hem 3, left sleeve 2, right sleeve 2, left trouser leg 2, right trouser leg 3. **All zig-zag and frayed-edge geometry and texture removed** | Width 0.16–0.18 m (10.7–12.1% H), depth 0.038–0.045 m (2.5–3.0% H), **minimum radius 0.034–0.039 m (2.3–2.6% H)**. Each notch spans 8–11 vertices | ✅ (build parameters; vertex spacing in structure.json `hems`) |
| P0-3 sleeves | Left at 30% of upper arm, right to mid forearm | Left sleeve ends at t = 0.30 of shoulder → elbow. Right sleeve covers the whole upper arm plus a forearm section to t = 0.50 (rigid-bound to Arm_2_R) | Readable in the front view and at 64px | ✅ |
| P0-3 trousers | Left at 60% of the shin, right at 35% of the thigh, large arc notches | Same as the left column | Long/short legs clearly readable at 64px | ✅ |
| P0-4 shirt | #8DC4DA, S ≥ 0.25 | Flat colour | **Texture #8DC4DA (S 0.353)**. Render #8FBECE (S 0.31) | ✅ |
| P0-4 patch | #E8C072 mustard yellow, rounded square, side ≈ 14% H, front lower left, only patch, obviously different brightness from the shirt | Rounded square pad (corner 38%), side 0.2087 m = 14.0% H, centre (x +0.058, z 0.772), stitches removed | **Texture #E8C072**. Render #E0B66E. Hue contrast is strong (yellow vs blue); **relative luminance 0.568 vs 0.510 (CIE L\* ≈ 80 vs 77), small brightness difference** | ⚠️ separates by hue; brightness gap depends on the palette |
| P0-4 skin | Paint spec values; explain round 2's greyish-white | Flat #E8B88C, blush #F7B6C8, nose #DB9A78 | **Texture #E8B88C (95.4% of face texture pixels)**. Render forehead #EEBA8D, upper arm #D7A87F. Cause: see §0 (round 2 = baked shading in the texture + AgX); AgX legacy render of this round's skin is #D3BCAA, reproducing round 2's grey-white | ✅ |
| P1-1 eyes | Plain dark ovals Ø = head width × 0.09, #6B4A32, spacing ≈ 0.36, centre 55% down from the top; no iris or highlight. Blush Ø 0.12 | Flat ellipses (width 9%, height 1.18× width), #6B4A32, no iris or highlight | Texture: 9.0% / spacing 36.0% / 55.0%. **Render measurement: width 8.8%, height 10.4%, spacing 35.9%, centre 54.95%**; blush 11.6% (render edge anti-aliasing loses about 1 px) | ✅ |
| P1-1 nose/mouth (spec rev. 3) | Nose 8% at 66%; smile width 22%, line ≥ 4% at 78% | Nose: rounded 3D cone. Mouth: painted arc | Built to these values | ✅ |
| P1-2 rope | Thickness ≥ 3.5% H; knot Ø ≈ 6% on the left hip; one tail ≈ 12% with a round end; #B08158 | Belt tube, knot sphere, tail capsule + round end ball | Belt Ø 0.0537 (3.6%), knot Ø 0.0894 (6.0%), tail 0.179 (12.0%, from knot underside to bottom of the end ball), tail Ø 3.6%, end ball Ø 4.4%. Texture #B08158 | ✅ |
| P1-3 limbs | Arm 8%, leg 10%, hand 9%, foot 14%; no waist taper | Arm Ø 8.3→8.0→7.5%, leg 10.8→9.9→9.2% (thigh→ankle), hand Ø 9.0%, foot length 14.0%. Shirt section rx 0.194–0.197 (hem → chest), no waist | Build parameters (design_values in structure.json) | ✅ |
| Proportions | 29 / 34 / 37 | Round-1 joint positions, chin 1.0585 | **glb measured 29.0 / 34.0 / 37.0** | ✅ |

## 3. Colour samples (summary; full data in `samples.json`)

| Item | Spec | Texture in the glb (only value) | front.png render (Standard −0.75 EV) | Same model, AgX legacy setup |
|---|---|---|---|---|
| Hair / rope | #B08158 | #B08158 | #B7865E (lit) / #A67A57 (shade) | #C19D82 |
| Shirt | #8DC4DA | #8DC4DA | #8FBECE | #ACC0C7 |
| Patch | #E8C072 | #E8C072 | #E0B66E | #CFB998 |
| Skin | #E8B88C | #E8B88C | #EEBA8D (forehead) / #D7A87F (arm) | #D3BCAA |
| Leaf | #8CCB5E | #8CCB5E | #8FC660 | — |
| Trousers | #C9A57A | #C9A57A | #C59F76 | — |

The texture values were decoded from the PNGs embedded in the glb (not from the loose files) and read per part rectangle using atlas.json.

## 4. tiny64 item by item (`tiny64.png` = front.png cropped tight to the figure into a square, then 64×64 nearest-neighbour; `tiny64_x8.png` is the same image ×8 for viewing)

| Item | Countable? |
|---|---|
| Three hair tufts | **Borderline.** The top of the head shows a stepped silhouette: upper-left bump (side tuft), top bump (top tuft) and upper-right bump (back tuft). The concave dips between tufts are only about 1–2 px, and all three are the same hair colour, so it relies on lighting steps to separate them. Count it carefully and you get three; at a glance it can read as "a messy round top". The close-up and front 512 view clearly show three tufts. **I don't claim this one passes; the director decides.** If it needs to be more obvious, the spec limits leave two options: overlap down to 15% (now 16–17%), or a bit more side protrusion (head width goes to ~32–33%) |
| One leaf | ✅ A green blob at the upper right, clearly visible |
| One short sleeve | ✅ Viewer's right (character's left) sleeve covers only the shoulder; viewer's left (character's right) reaches the forearm |
| Long and short trouser legs | ✅ Very clear |
| Rope tail at the waist | ✅ A brown vertical bar hanging down at the viewer's right hip |

Also `tiny64_fullframe_x8.png` (the full 512 frame shrunk straight to 64; the figure is only ~45 px tall): leaf, sleeves, trouser legs and rope tail are still readable. **The three tufts cannot be counted at this size.**

## 5. Renders and files

- `front.png` (grey background), `face_closeup.png`, `three_quarter.png`, plus `right.png` / `back.png`. Camera, both lights, world and resolution are identical to rounds 1 and 2. Colour management: Standard −0.75 EV (see §0). `*_agx_legacy.png` are the old colour pipeline, kept for side-by-side checking.
- **`three_quarter.png` uses the inherited camera, which tilts down 8°, so the top of the head and the leaf are slightly cut off at the top of the frame.** Kept that way so it matches previous rounds.
- `compare.png`: left = design front view, right = model front view, same height.
- `structure.json`: bones, triangle count, bounding box, three-part split (all measured from the glb), plus build parameters (`build_parameters_not_measurements`, clearly labelled as script values).
- Intermediates (atlas.json, face UV check image, round-2 backup) are in `~/.cache/castaway-protag/p3/`, outside the repo.

## 6. Remaining gaps vs the design sheet (not in this round's scope, recorded honestly)

- 3.5 heads tall vs the design's ~2.2: the body and legs look much longer than the design. That follows the user's ruling.
- The design sheet's hair is soft, layered, slightly messy locks. This round follows the spec's "round cap volume + three round tufts", so the style deliberately departs from the design sheet. The cap edge still looks a bit like a hat.
- The spec skin #E8B88C is browner and darker than the design sheet's peachy pink. The shirt #8DC4DA is lighter than the design sheet's grey-blue. Both follow the spec.

## 7. Runtime notes (for the controller when re-checking on the NUC)

- Joints are back to round-1 positions (shoulder 0.918, Head bone 1.0435, Neck 0.990). The walk-cycle regression should match round 1. Round 2's joint moves are no longer relevant.
- Textures no longer bake in light and dark. In game, shading comes entirely from the scene lighting (matches spec "明暗全部来自光照"). If the game uses a filmic or AgX-style tone mapping, it will also desaturate the colours. Check the renderer's output colour space / toneMapping setting.
- Still 2 materials using the textures embedded in the glb. Do not swap in `palette_protagonist.png` by name.
