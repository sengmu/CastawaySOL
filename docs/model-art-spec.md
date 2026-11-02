# CastawaySOL 3D 模型美术规范（艺术部分）

日期：2026-11-02。管线：美术规范与设计图提示词，GPT 生成四视图，Blender 脚本建模，渲染四视图回验，进游戏验收。本文只管画面，工程参数（面数、骨骼、导出）由主控补。

**两条总原则**
1. 设计图是“形”的依据，第三部分的数字是“尺寸”的依据。GPT 的多视图比例会漂 6% 到 13%，两者冲突时以数字为准，没有数字的地方以正视图为准。
2. 正视图是主视图。侧视图、背视图、四分之三图只用来读深度和背面造型，不用来量比例。

---

## 一、3D 造型语言

**1. 圆润的判据**（可在渲染图上检查）
- 大体块由球、椭球、胶囊和圆角盒组成，没有大平面直接相交成棱。
- 任何可见凸角的圆弧半径不小于模型高度的 2%；盒状部件（木屋墙体、屋顶板）倒角半径不小于该部件最短边的 25%。
- 允许的“尖”只有四处：猫耳尖、雪松树尖、椰子叶尖、屋脊；它们的尖端圆弧半径不小于模型高度的 1.5%，且夹角不小于 60 度。
- 树冠和灌木一律由球团叠成，球团之间的凹口要浅，凹口处不出现小于 90 度的夹角。

**2. 剪影优先**
- 缩到 64 像素高、只看黑色剪影时，十款模型必须能互相分得开。每款的一句话剪影：苹果树是宽矮的蘑菇球冠；椰子树是一根弯杆顶着放射的下垂叶；雪松是逐层收窄的阶梯塔；杜鹃是贴地宽矮的圆丘；山茶是直立的椭圆团；木屋是带宽檐的坡顶盒加架高门廊；猫是大圆头加粗弯尾；猴子是大圆头加长卷尾；猎犬是长身加下垂大耳；金羊是一团云加小头。
- 细节只能加在剪影之内，不能靠细节来区分模型。

**3. 部件粗细下限**
- 任何独立部件（尾巴、手臂、树枝、叶片、门柱）最薄处不小于模型高度的 3%。
- 猫、猴、犬、羊的四肢粗细不小于各自头宽的 25%；手和脚做成圆球掌，不做手指。
- 树枝不单独建模，用树干和球团表达；叶子不做单片，用叶团或粗叶片。
- 眼睛、鼻子这类小点直径不小于头宽的 7%。

**4. 颜色分块与材质观感**
- 每款模型 3 到 5 个色块，另加最多一个点缀色（果实、花、铃铛）。
- 贴图是纯色平涂，不画木纹、毛发、叶脉，不用法线贴图或粗糙噪点；明暗全部来自光照。
- 材质哑光，不要金属感，不要镜面高光斑；唯一允许的“亮点”是眼睛、果实上的一个小圆奶油色点，它是贴图上的色块，不是镜面反射。
- 背光面偏淡紫（阴影染色 `#8E7AA0`），不是变黑；模型上没有纯黑，最深的颜色是可可棕 `#6B4A32`（鼻子、眼睛），且只占很小面积。
- 不描边，也不做反向外壳描边。

**5. 和图标规范保持同一套**
- 色板：沿用锁定的 33 色，扩展色在第三部分逐款给出，扩展色同样遵守“基础色饱和度不超过 0.55”。这里不用图标的 0.68 例外，原因是 3D 模型会被太阳光再提亮，而且要和草地 `#8CCB5E` 区分开；点缀色最高 0.75。
- 光向：左上，高光奶油色 `#FFF1D0`，和图标一致。
- 视角：游戏镜头约 45 度斜俯视，所以每款模型的顶面（树冠顶、屋顶、猫头顶）要好看，不能只顾正面。
- 形体语言：和图标同一个词：胖、圆、软、不尖、不描边。看一眼就应该是同一个世界的东西。

## 二、GPT 四视图设计图

**英文提示词模板**（把 `{subject}` 换成各款的一句话描述）：

```
A game asset turnaround model sheet in one single image: four views of the same object placed side by side on one plain flat pale warm-grey background (#E9E4DA), in this order from left to right: front view, side view facing right, back view, and three-quarter view seen from slightly above (about 30 degrees). All four views are drawn at exactly the same scale and the same height, standing on one shared invisible ground line, top and bottom aligned, evenly spaced, not overlapping. The front, side and back views are drawn straight-on with no perspective distortion. A thin vertical ruler with ten equal tick marks stands at the far left edge, exactly as tall as the object, to show scale. Style: a clean soft 3D toy look in a gentle Animal Crossing inspired style, plump round shapes, flat matte colour blocks with no textures, no outlines, warm light from the upper left with a soft lavender-tinted shade on the lower right. Candy-pastel colours that stay soft and friendly. Subject: {subject}.
```

**负面词**（接在后面）：

```
Avoid: outlines, black, complex textures, wood grain, fur strands, leaf veins, photorealism, glossy or metallic shine, dramatic perspective, different poses or different proportions between the views, any text or labels, background scenery, cast shadows on the ground, sharp points, thin spindly parts.
```

**如果四个视图比例不一致**（出图后的补救，按这个顺序）：
1. 以正视图为准，把正视图作为参考图，发这一句：`Using the attached front view as the master, redraw the side view, the back view and the three-quarter view at exactly the same height and the same proportions as the front view, same colours, same plain background, same layout.`
2. 仍然漂：只保留正视图，其余视图弃用，建模按第三部分的数字走，背面和侧面由 Blender 脚本按规则补。

**十款的一句话主体描述**（填进 `{subject}`）：

- 猫角色基础模型：`a chubby anthropomorphic cat character about two and a half heads tall, standing in a relaxed A-pose with arms slightly away from the body, big round head with two small rounded ears, tiny rounded nose, two round dot eyes, short plump arms and legs with round ball hands and feet, a thick curved tail, wearing a simple short tunic and shorts`
- 小猴伙伴：`a small chubby monkey companion with a big round head, two round ears, a cream heart-shaped face patch, two round dot eyes, a pear-shaped body, short plump limbs with round ball hands and feet, and a long thick curled tail`
- 苹果树：`a short plump apple tree with a short straight trunk and a wide mushroom-shaped crown made of four overlapping round leaf clumps, with six round red apples sitting on the crown`
- 椰子树：`a tall coconut palm with a gently leaning trunk with soft round ring bumps, a crown of eight fat drooping rounded fronds radiating from the top, and a cluster of three round brown coconuts under the crown`
- 雪松：`a cedar tree shaped like a stepped tower of three stacked rounded cone tiers narrowing towards a softly rounded tip, with a short trunk visible at the bottom`
- 杜鹃灌木：`a low wide azalea shrub shaped like a flat mound of four overlapping round leaf clumps, covered with ten round pink pompom flowers on top`
- 山茶灌木：`an upright oval camellia shrub made of three stacked round leaf clumps, with five large round coral-red rose-like flowers with small yellow centres`
- 海滨木屋：`a small seaside wooden cabin raised on four round stilts, with a wide-eaved gabled coral roof with a rounded ridge, an arched door, one round porthole window, and a small front deck with two round posts`
- 猎犬（以后做）：`a chubby hound dog with a long body, short thick legs, a round snout with a round dark nose, big floppy rounded ears, and a thick upward-curved tail`
- 金羊（以后做）：`a chubby golden sheep whose body is a fluffy cloud of six overlapping round wool clumps, with a small round face, tiny round ears, short stubby legs and a small round yellow bell at the neck`

## 三、每款模型的造型要点

**比例参照：** 下面以猫的身高为 1.0，给出每款的相对高度，只是为了让一套模型大小合理，最终尺寸主控可调：猴 0.55，猎犬 0.6（肩高），金羊 0.55，杜鹃 0.7，山茶 1.0，苹果树 2.6，雪松 4.5，椰子树 4.0；木屋门高约 1.3。

下面所有尺寸写成“占该模型高度的百分比”，高度按模型的最高点算。

### 1. 猫角色基础模型（三人共用，只换配色，网格不变）
- **比例：** 头高占身高 40%（约 2.5 头身）；头宽为身高的 46%，比头高略宽；躯干占 30%；腿露出部分占 30%；手臂长到髋部；尾巴长约 45%，粗不小于 10%，向上弯成一个 S。
- **识别特征：** 大圆头加两只圆尖小耳；耳高占头高 30%；尾巴粗而弯；手脚是圆球掌；眼睛是两个可可棕圆点，鼻子是一个小圆。不画胡须（太细）。
- **三套配色：**

| 部位 | 主角 | 少女 | 学者 |
|---|---|---|---|
| 毛色 | `#F5C48A` | `#F6E7D8` | `#BFC8DA` |
| 口鼻、肚皮、手脚掌 | `#FFF6E3` | `#FFF6E3` | `#FFF6E3` |
| 上衣 | 天蓝 `#6EC1E4` | 花瓣粉 `#F7B6C8` | 草绿 `#8CCB5E` |
| 短裤 | 浅木 `#DDB88A` | 薄荷 `#A8E6C3` | 木棕 `#B98A5A` |
| 耳内、鼻 | `#F7B6C8` | `#F7B6C8` | `#F7B6C8` |
| 眼 | `#6B4A32` | `#6B4A32` | `#6B4A32` |

### 2. 小猴伙伴
- **比例：** 头高占 38%，头宽为身高的 44%；身体梨形，下大上小；手臂和腿短粗；尾巴长约身高的 80%，粗不小于 8%，末端卷一圈。
- **识别特征：** 两只圆耳（直径约头宽的 30%）、奶油心形脸、长卷尾。
- **配色：** 毛 `#C99A68`；脸、肚皮、尾尖 `#F2D9A6`；耳内 `#F7B6C8`；眼鼻 `#6B4A32`。

### 3. 苹果树（全岛 11 株）
- **比例：** 树干占高度 38%，树冠占 62%；树干根部粗约 14%，往上收到 10%；树冠宽为高度的 70%（宽大于高）。
- **树冠：** 四个球团：一个中心大球（直径约高度的 55%）、左下和右下各一个中球（约 40%），顶上一个小球（约 32%）；球团相互重叠三分之一以上。
- **识别特征：** 短树干加蘑菇形圆冠；六个红苹果，直径约高度的 7%，分散在树冠表面，每个带一个奶油色小圆点高光。
- **配色：** 树冠 `#7FCB8B`，顶部球团亮面 `#A8E6C3`，树冠下缘暗面 `#4F9E6B`；树干 `#B98A5A`，根部 `#8A5E3A`；苹果 `#F26B5B`。

### 4. 椰子树（8 株）
- **比例：** 树干占高度 72%，粗约 9% 到 7%（根粗顶细），整体向一侧倾斜，树顶相对根部偏移约 12%；树冠 8 片叶，叶长约高度的 38%，叶宽不小于 8%。
- **识别特征：** 弯杆；树干上 3 到 4 圈柔和的圆环凸起；叶片又粗又短、向下垂、端头圆；叶下三颗椰子（直径约 6%）。
- **配色：** 叶面 `#7FCB8B`，叶背和暗面 `#4F9E6B`；树干 `#D9B27C`，环凸 `#DDB88A`；椰子 `#8A5E3A`。

### 5. 雪松（7 株）
- **比例：** 三层圆锥叠成塔，每层高约 30%，彼此重叠约 10%；下层宽为高度的 55%，中层 42%，上层 28%；树干露出约 12%，粗约 9%。
- **识别特征：** 逐层收窄的阶梯塔剪影；每层下摆圆润微微下垂；树尖是圆的。
- **配色：** 主色 `#4F9E6B`，每层上沿亮面 `#7FCB8B`；树干 `#8A5E3A`。整套里它是最深的绿，用来和苹果树、椰子树分开。

### 6. 杜鹃灌木
- **比例：** 宽为高度的 160%，是贴地的矮丘；由 4 个球团组成，中间大球直径约高度的 90%，周围三个小球约 65%。
- **识别特征：** 宽扁圆丘加满顶的粉色绒球花：10 朵左右，每朵直径约高度的 14%，花团贴着叶面，不单独伸出去。
- **配色：** 叶 `#7FCB8B`，暗面 `#4F9E6B`；花 `#F7B6C8`，花的亮面 `#FBD3DF`。

### 7. 山茶灌木
- **比例：** 宽为高度的 75%，直立椭圆；由 3 个叠起的球团组成，下大上小（直径约 75%、62%、48%）。
- **识别特征：** 直立椭圆剪影；5 朵大花，每朵直径约高度的 16%，是两层圆盘叠成的玫瑰形（外层大盘，内层约一半大的小盘），中心一个黄圆点（约 5%）。
- **配色：** 叶 `#4F9E6B`，亮面 `#7FCB8B`；花 `#F26B5B`，花心 `#FFD25A`。叶子用深绿，和杜鹃的浅绿拉开。

### 8. 海滨木屋
- **比例（以屋身宽为 100）：** 屋身宽 100，进深 80，墙高 45；屋顶高出墙 35（总高约 80 加架高部分）；屋檐每边出挑 12；屋顶板厚不小于屋宽的 8%；架高 8，四根圆柱腿，粗不小于屋宽的 6%；前门廊深 25，两根圆门柱，粗不小于 6%。
- **识别特征：** 宽檐坡顶、圆拱门（宽 22，高 34）、一个圆舷窗（直径 14）、架高的门廊。墙面不做木板纹理，用两条宽圆边的横向饰带代替。
- **配色：** 墙 `#DDB88A`，饰带 `#FFF1D0`；屋顶 `#F28B7D`，屋脊 `#FFF1D0`；门 `#6EC1E4`，窗玻璃 `#BFE6F5`，窗框 `#FFF6E3`；门廊和柱 `#B98A5A`，架高腿 `#8A5E3A`。屋顶用比 `#F26B5B` 淡一点的珊瑚色，保证大面积不超过饱和度 0.55。

### 9. 猎犬（以后做）
- **比例：** 肩高为 100，身长 130；头宽约肩高的 45%；腿短粗，粗不小于 12%；耳朵下垂，长约头高的 35%；尾巴粗不小于 8%，向上弯。
- **识别特征：** 长身、下垂大耳、圆鼻头。
- **配色：** 身 `#E0B07A`，胸腹 `#FFF1D0`，耳 `#B98A5A`，鼻和眼 `#6B4A32`。

### 10. 金羊（以后做）
- **比例：** 肩高为 100，身长 115；身体是 6 个羊毛球团，整体直径约高度的 75%；头小，宽约身体的 30%；腿短粗，粗不小于 10%。
- **识别特征：** 云朵一样的蓬松身体加小脸；颈上一个黄铃铛（直径约 6%）。
- **配色：** 羊毛 `#FFE29A`，亮面 `#FFF1D0`，暗面染淡紫；脸和腿 `#DDB88A`；耳内 `#F7B6C8`；铃铛 `#FFD25A`；眼 `#6B4A32`。

---

## 四、验收判据（只管画面）

拿渲染出的四视图，和设计图的正视图加第三部分的数字比。每条都能勾。

**A. 剪影**
- [ ] 渲染正视图的剪影与设计正视图的剪影叠合，重合度（交并比）不低于 0.90。
- [ ] 缩到 64 像素高的黑色剪影，一眼能认出是第一部分写的那一句话剪影。
- [ ] 10 款的 64 像素剪影彼此能分开，没有两款看起来像同一个东西。
- [ ] 没有设计图里没有的凸出物，也没有缺失的部件（耳朵、尾巴、果实、门廊）。

**B. 比例**
- [ ] 第三部分里写的每一个比例，渲染图上量出来的误差不超过 ±5%。
- [ ] 球团数量和第三部分一致（苹果树 4 个，雪松 3 层，杜鹃 4 个，山茶 3 个，羊毛 6 个）。
- [ ] 计数类特征一致：苹果 6 个、椰子叶 8 片、椰子 3 个、杜鹃花约 10 朵、山茶花 5 朵。
- [ ] 最细部件不小于模型高度的 3%。
- [ ] 猫三套配色用的是同一个网格，轮廓完全一样。

**C. 配色**
- [ ] 每个色块在渲染图受光处取样，与第三部分的十六进制比较：色相差不超过 10 度，饱和度差不超过 0.08，明度差不超过 0.08。
- [ ] 每款模型色块数在 3 到 5 个，加至多一个点缀色。
- [ ] 基础色饱和度不超过 0.55，点缀色不超过 0.75。
- [ ] 模型上没有纯黑，也没有纯白；明度低于 0.2 的像素不超过 2%（只允许眼和鼻）。
- [ ] 背光面偏淡紫，不是灰黑。

**D. 圆润度和质感**
- [ ] 找不到小于 90 度的可见夹角；凸角圆弧半径不小于模型高度的 2%（允许的四处尖端除外，不小于 1.5%）。
- [ ] 没有描边，没有硬棱线。
- [ ] 表面是平色，看不到木纹、毛发、叶脉、噪点。
- [ ] 没有金属感，没有镜面高光斑（眼睛和果实上的小圆点除外）。
- [ ] 光从左上来，亮面是奶油色。

**E. 一套感**
- [ ] 把模型截图和 3 个图标（例如 `health`、`weather_cloudy`、`shop`）并排放，圆润程度、饱和度、光向、无描边是同一种语言。
- [ ] 放在草地 `#8CCB5E` 上，树冠和灌木和草地分得开（叶色偏蓝绿，不和草地同色）。
- [ ] 45 度斜俯视镜头下，顶面（树冠顶、屋顶、猫头顶）好看。

**不通过时的处理：** A 或 B 不过，退回建模；只有 C 不过，只改色；只有 D 不过，只改倒角和球化；设计图本身与第三部分数字冲突，以数字为准，不退回设计图。

全文到此结束，一共 4 条。

---

> **主控注记（2026-11-02 13:33，13:40 修订）**：用户裁定主角换成人类。原稿中猫的条目、猫高 = 1.0 基准、"只换配色无配件"口径全部作废，以紧随其后的《修订篇》为准（冲突时修订篇优先）；小猴与宠物仍为动物。人形骨骼沿用工程篇命名契约，现有程序化动画直接继承；工程篇面数预算不变（人形角色沿用原猫位预算）。

---

# 修订篇：人类角色（2026-11-02，美术指导，优先于原稿冲突处）

先说明一处连带变化：猫一款拆成三款人类后，模型总数从 10 款变成 12 款（现在要做 10 款，以后做猎犬、金羊 2 款），所以原文所有写“十款”的地方都改成“十二款”。

## 修订一：第二部分的英文主体描述

删掉原来的猫那一句，换成下面三句，其余九条不变。三个人类都用 A 字站姿，手臂离开身体一点，方便出设计图和绑骨骼。

- 主角（海难幸存者）：`a young castaway adventurer of ambiguous gender, about three and a half heads tall, standing in a relaxed A-pose with arms slightly away from the body, big round head with short messy rounded chestnut hair and one small round tuft on top, two round dot eyes, small round blush discs on the cheeks, a sky-blue short-sleeved shirt with a coral neckerchief tied in a round knot, sand-coloured shorts, simple brown strap sandals, chubby limbs with round mitten hands, no fingers`
- 艾莉（少女）：`a young girl castaway about three and a half heads tall, standing in a relaxed A-pose with arms slightly away from the body, big round head with golden hair tied in two round buns on the sides, two round dot eyes, small round blush discs on the cheeks, a short blossom-pink dress with a small round mint bow at the waist, short soft coral boots, chubby limbs with round mitten hands, no fingers`
- 雷蒙德（学者）：`an older gentle scholar about three and a half heads tall, standing in a relaxed A-pose with arms slightly away from the body, big round head with soft silver-white hair and one small round tuft on top, chunky round brown-framed glasses, two round dot eyes behind the lenses, a cream shirt under a fresh green vest, short brown trousers and round brown shoes, a round wood-coloured satchel hanging on a strap across the chest, chubby limbs with round mitten hands, no fingers`

## 修订二：第一部分里只适用于猫的表述

1. 「圆润的判据」里“允许的‘尖’只有四处：猫耳尖、雪松树尖、椰子叶尖、屋脊”改为：**“允许的‘尖’只有三处：雪松树尖、椰子叶尖、屋脊；它们的尖端圆弧半径不小于模型高度的 1.5%，且夹角不小于 60 度。”** 人物和动物不再有任何尖端，头发簇、发髻、耳朵都是圆的。
2. 「剪影优先」把“十款”改成“十二款”，并把“猫是大圆头加粗弯尾”换成三句：主角是大圆头顶一撮圆发簇，颈间一个圆领巾结；艾莉是圆头两侧各一个圆发髻，下身是短裙的小钟形；雷蒙德是圆框眼镜加胸前斜挎的大圆包，身体比另两位略宽。
3. 「部件粗细下限」里“猫、猴、犬、羊的四肢”改成“人、猴、犬、羊的四肢”；眼睛直径的要求不变。
4. 「颜色分块」里“每款模型 3 到 5 个色块”后面补一句：“人物可到 5 个色块，眼睛和腮红不计。”
5. 「和图标规范保持同一套」的视角一行，“猫头顶”改成“人物头顶”。

## 修订三：第三部分开头的相对高度表，重新以主角身高为 1.0

下面所有尺寸仍写成“占该模型高度的百分比”，高度按模型最高点算。相对高度只是让一套模型大小合理，最终尺寸主控可调：

| 模型 | 相对高度（主角 = 1.0） |
|---|---|
| 主角 | 1.0 |
| 艾莉 | 0.88 |
| 雷蒙德 | 1.06 |
| 小猴巴布 | 0.50 |
| 猎犬（肩高） | 0.55 |
| 金羊（肩高） | 0.50 |
| 杜鹃灌木 | 0.60 |
| 山茶灌木 | 0.90 |
| 苹果树 | 2.6 |
| 椰子树 | 4.0 |
| 雪松 | 4.5 |
| 海滨木屋 | 门高 1.35，屋身宽约 4.0 |

木屋那一行是反推的：屋内规范里门高占屋身宽的 34%，门要让雷蒙德（1.06）带着头发过得去，所以门高取 1.35，屋身宽就约 4.0 个主角身高。

## 修订四：第三部分的条目 1（猫）换成三条人类条目

**三个人类共用的体型（先定这一条，三条人类条目都按它）**
- **头身比 3.5 头身。** 头高（从下巴到发顶）占身高 29%，头宽占 31%（比头高略宽，是动森那种宽圆脸）；躯干占 34%；腿露出部分占 37%。
- **为什么是 3.5：** 动森村民约 2 到 2.5 头身，直接照搬到成年人身上会像幼儿，也和你已有的 3D 低多边形岛屿风格不搭；4 头身以上就失去“一切皆圆”的矮胖感。3.5 头身在手机横屏、45 度俯视下，脸还够大，眼睛和发型能看清，身体又不像吉祥物。
- **三人用同一个骨架比例，只靠整体缩放区分高矮（艾莉 0.88，雷蒙德 1.06）。** 这样走、跑、跳动画可以直接继承，不需要重新适配；别单独把艾莉做成另一个头身比。
- **四肢与手脚：** 手臂长到髋部，粗约 8%；腿粗约 10%；手是圆球掌，直径约 9%，不做手指；脚是圆润的鞋形团，长约 14%。
- **脸：** 两个可可棕 `#6B4A32` 圆点眼，直径约头宽的 9%，间距约头宽的 36%，位置在脸的偏下 55% 处（显得更可爱）；不画鼻子和嘴，要笑意就用两个腮红小圆片（直径约头宽的 12%，`#F7B6C8`）。
- **头发：** 做成圆润的整块帽状体积，不做发丝，不做尖发梢。
- **短裙注意：** 艾莉的裙摆只比髋宽出 20% 以内，长度到膝盖以上，避免腿部动画时穿模。

### 1a. 主角（海难幸存者）
- **主推形象：** 性别中性的青年，留短而蓬的圆发，不强调性别特征；穿的是漂流后还整齐的清爽衣服，不做破烂细节（细碎的破洞在 20 像素下看不清，也违反圆润判据）。选中性是因为玩家会代入，中性更宽。
- **比例：** 身高 1.0，按上面的共用体型；颈间一个圆领巾结，直径约头宽的 25%。
- **识别特征：** 蓬松圆发顶上一撮圆发簇、天蓝短袖上衣、珊瑚红领巾。
- **剪影：** 大圆头顶一撮圆发簇，颈间一个圆结。
- **配色：** 肤色 `#F2C9A0`；头发 `#A8774F`；上衣 `#6EC1E4`；短裤 `#DDB88A`；凉鞋 `#B98A5A`；点缀：领巾 `#F26B5B`；腮红 `#F7B6C8`；眼 `#6B4A32`。

### 1b. 艾莉（幸存少女）
- **比例：** 身高 0.88，按共用体型，所以不是更矮的头身比，只是整体小一圈；两侧发髻各是一个圆球，直径约头宽的 28%，位置在耳朵高度，不冒出发顶。
- **识别特征：** 两侧圆发髻、粉色短裙、腰间一个薄荷色圆蝴蝶结。
- **剪影：** 圆头两侧各一个圆发髻，身体下半是小钟形短裙。
- **配色：** 肤色 `#F8DCC0`；头发 `#F0CB7E`；裙子 `#F7B6C8`；短靴 `#F28B7D`；点缀：蝴蝶结 `#A8E6C3`；腮红 `#F7B6C8`；眼 `#6B4A32`。

### 1c. 雷蒙德（学者）
- **比例：** 身高 1.06，按共用体型，躯干宽比主角宽约 8%（因为有背心和挎包，显得稳重）。
- **眼镜（新增配件）：** 圆框，两个镜圈各是头宽的 30%，框粗不小于模型高度的 3%（做成粗框，才能在 20 像素下看见），两圈中间一个粗桥；框色可可棕 `#6B4A32`，镜片 `#BFE6F5` 淡蓝，不做反光。
- **挎包（新增配件）：** 一个圆鼓的圆角包，直径约身高的 17%，吊在身体一侧，背带是一条粗度不小于 3% 的胶囊带，斜过胸前。
- **识别特征：** 粗圆眼镜、银白色圆发加一撮发簇、绿背心加奶油衬衫、胸前斜挎圆包。
- **剪影：** 圆头加圆框眼镜，身体一侧有大圆包，整体比另两位更宽。
- **配色：** 肤色 `#E0AE86`；头发 `#D8D3CC`；衬衫 `#FFF6E3`；背心 `#8CCB5E`；短裤和鞋 `#B98A5A`；点缀：挎包 `#DDB88A`；眼镜框 `#6B4A32`；眼 `#6B4A32`。

## 第四部分验收清单里要跟着改的四句

- 「A. 剪影」里“十款”改成“十二款”，“缺失的部件（耳朵、尾巴、果实、门廊）”改成“缺失的部件（人物的发簇、发髻、眼镜、挎包，猴的耳朵和尾巴，果实，门廊）”。
- 「B. 比例」里“猫三套配色用的是同一个网格，轮廓完全一样”整条删掉，换成：“三个人类用同一个骨架比例，只靠整体缩放区分高矮（艾莉 0.88，雷蒙德 1.06）；头身比量出来都是 3.5，误差不超过 ±0.2 头身。”
- 「D. 圆润度和质感」里“允许的四处尖端除外”改成“允许的三处尖端除外”。
- 「E. 一套感」里“猫头顶”改成“人物头顶”。

另有一处要你知道：因为三个人类现在各自独立建模，原来“学者不能有眼镜”的限制已经取消；如果以后还想给主角或艾莉加配件，只要不超出 5 个色块加 1 个点缀色就行，圆润判据和部件粗细下限仍然要满足。

修订稿到此结束，一共 3 条；没写的部分都和原稿一致。


---

# 修订篇二：主角荒岛款（2026-11-02，美术指导，优先于原稿与修订篇一的冲突处）

## 修订一：第二部分，主角的英文主体描述（替换原句）

```
a young castaway adventurer of ambiguous gender, about three and a half heads tall, standing in a relaxed A-pose with arms slightly away from the body, big round head with very messy tousled chestnut hair made of three plump round clumps and one single large round green leaf stuck in it, two round dot eyes, a tiny rounded triangle nose, a small smile and small round blush discs, a faded sky-blue shirt with one sleeve torn off short with a few big round scallops along its edge and one big round mustard-yellow patch on the front, a thick brown rope tied as a belt with one round knot and one dangling round-ended end, tanned sand-brown trousers with one short leg ending above the knee and one longer leg ending below the knee, both hems with big round scallops, bare round feet, chubby limbs with round mitten hands, no fingers, weathered but cheerful
```

出这张图时，负面词后面再加一句：`no small holes, no frayed threads, no fringes, no dirt smudges, no thin details`。

## 修订二：第三部分，条目 1a（主角）整条替换

### 1a. 主角（海难幸存者，荒岛款）
- **主推形象：** 性别中性的青年，流落荒岛有一阵子了：衣服是被截短、缝补过的，头发没人打理，人是晒黑的、赤脚的，但表情是开朗的。你的读法我基本照用，理由是荒岛感必须靠大形状读出来，细碎破洞和毛边在 20 像素下是一团脏点，还违反圆润判据。我在你的方案上做了三处调整：
  1. 头发由“一撮发簇”改成**三个圆团蓬乱**（顶上一个、左侧一个、后脑一个，每个直径约头宽的 28% 到 35%），比一个发簇更乱，也更容易在剪影里认出来；
  2. 小叶子只放**一片**，做成一块圆润的叶板，不画叶脉，作为整个模型唯一的点缀色；
  3. 不对称全部用“长度差”表达，不用毛边：裤腿一长一短，袖子一边断得更短，比任何破洞都读得出来。
- **比例：** 身高 1.0，按共用体型（3.5 头身）。
- **荒岛元素（都是大形状，下限按模型高度算）：**
  - **断袖：** 左袖断在上臂 30% 处，右袖到前臂中间；袖口边缘是 2 到 3 个大圆弧缺口，每个宽不小于 5%、深不小于 2%；断掉的部分直接露出皮肤色的手臂。
  - **大补丁：** 衬衫前面左下角一块大圆角方补丁，边长约 14%，是衣服上唯一一块补丁。
  - **草绳腰带：** 一条粗不小于 3.5% 的绳带绕腰，左髋一个圆绳结（直径约 6%），再垂下一段 12% 长、末端圆头的绳尾。
  - **不对称裤腿：** 左腿裤脚停在小腿 60% 处（膝盖以下），右腿裤脚停在大腿 35% 处（膝盖以上）；两个裤脚边缘同样是 2 到 3 个大圆弧缺口。
  - **赤脚：** 圆润的脚团，用肤色，长约 14%，不画脚趾缝。
  - **头发上的叶子：** 一片，长约头宽的 30%，插在头顶右后侧。
- **识别特征：** 三团乱发加一片叶子、一边断袖、一长一短的裤腿、草绳腰带的绳尾、赤脚。
- **剪影：** 一头三团圆乱发顶着一片叶子，一边袖子明显更短，裤腿一长一短，腰边垂着一段绳尾，脚是赤脚的圆团。
- **配色**（整体比整洁款降了饱和度，做旧一点，全部在 0.55 以内，叶子是唯一点缀）：
  - 肤色（晒黑）`#E8B88C`
  - 头发（日晒褪色）`#B08158`，草绳腰带用同一个色
  - 衬衫（褪色天蓝）`#8DC4DA`
  - 补丁（芥末黄）`#E8C072`
  - 裤子（沙棕）`#C9A57A`
  - 点缀：叶子 `#8CCB5E`
  - 脸部：腮红 `#F7B6C8`，鼻 `#DB9A78`，眼和嘴 `#6B4A32`
  - 色块数：皮肤、头发（含绳带）、衬衫、补丁、裤子，共 5 个，加叶子 1 个点缀，没有超规。
- **建模提示（只是画面层面的，工程由你们定）：** 破旧的衬衫和裤子最好做成独立于身体的一层，裤腿短的那边底下要有完整的腿，这样以后换成整洁套或别的服装，不需要重做身体。

## 修订三：脸的口径，三个人类统一

第三部分“三个人类共用的体型”里原来的“脸”那条（不画鼻子和嘴）整条替换为：

- **脸：** 圆点眼加小三角鼻加小微笑加腮红，和 GPT 设计图一致。
  - **眼：** 两个可可棕 `#6B4A32` 圆点，直径约头宽的 9%，间距约头宽的 36%，眼心在从头顶往下 55% 处。
  - **鼻：** 一个小圆角三角形，宽约头宽的 8%，眼心下方一点，中心在 66% 处，颜色比肤色深一档（主角 `#DB9A78`，艾莉和雷蒙德各取自己肤色深一档），三个角都要磨圆。
  - **嘴：** 一条小而上翘的微笑弧线，宽约头宽的 22%，线粗不小于头宽的 4%，可可棕 `#6B4A32`，中心在 78% 处；它是画在脸上的色块，不单独建模，所以不适用“独立部件不小于模型高度 3%”那一条，这是唯一的例外。
  - **腮红：** 两个圆片，直径约头宽的 12%，`#F7B6C8`，中心在眼睛正下方偏外、70% 处。
  - **读出来的底线：** 缩到 48 像素头像时，眼睛和腮红必须仍然读得出；鼻子和嘴在 48 像素下可以糊掉，不算不合格。
- 艾莉和雷蒙德的脸同样按这一条，除非他们各自的设计图上明确画了不同的脸。雷蒙德的眼睛画在镜片后面，嘴不变。
- 第一部分“眼睛、鼻子这类小点直径不小于头宽的 7%”这一条里，把“鼻子”删掉，改成“眼睛直径不小于头宽的 7%；鼻子和嘴按本条的尺寸”。

## 修订四：存档注记

加在第三部分条目 1a 的最后：

> **服装系统套装 01（整洁套）：** 天蓝短袖衫 `#6EC1E4`、珊瑚红领巾 `#F26B5B`（直径约头宽 25% 的圆结）、沙色短裤 `#DDB88A`、棕色绑带凉鞋 `#B98A5A`，肤色 `#F2C9A0`，头发 `#A8774F`。这套已经出过设计图，不作废，列为“服装系统套装 01”，以后做服装系统时启用。**主角默认出生造型以荒岛款为准。** 服装系统启用时，主角的皮肤保持晒黑的 `#E8B88C` 不随套装变，发色也不变，只换衣服层；整洁套里领巾和凉鞋是荒岛款没有的部件，不要带进荒岛款。

## 修订五：第四部分验收清单里跟着加的几句

「B. 比例」里加：
- [ ] 主角的断袖：左袖断在上臂 30% 附近，右袖到前臂中间，一眼看出两边不一样。
- [ ] 主角的裤腿：左长右短（小腿 60% 与大腿 35% 附近），一眼看出不一样，裤脚都是大圆弧缺口。
- [ ] 主角的头发是三个圆团，叶子只有一片。
- [ ] 主角有一个大补丁、一条草绳腰带带一段绳尾，赤脚。

「C. 配色」里加：
- [ ] 主角各色块与第三部分的十六进制比对，基础色饱和度都不超过 0.55，叶子是唯一点缀。

「D. 圆润度和质感」里加：
- [ ] 主角全身找不到细碎破洞、毛边、线头、污渍点；“破旧”只靠上面的几处大形状读出来。
- [ ] 主角在 20 像素下的剪影能和艾莉（两个发髻）、雷蒙德（圆眼镜加挎包）一眼分开。

## 修订六：第一部分剪影一行

「剪影优先」里主角那一句改为：**主角是一头三团圆乱发顶着一片叶子，一边袖子更短、裤腿一长一短，腰边垂着一段绳尾，脚是赤脚的圆团。**

以上就是全部改动，没写的部分都和你手里的版本一致。

---

# 工程约束篇（主控补）

## 1. 管线与分工
Game Art Director 出艺术规范与设计图提示词 → GPT 按模板出四视图设计图 → Claude 编写 Blender Python（bpy）脚本建模 → 无头渲染四视图回验 → 导出 glb 进游戏 → 引擎内截图验收。设计图以主视图为准（GPT 多视图比例漂移 6%~13% 已知），其余视图只作参考。

## 2. 格式与导出（硬约束）
- 格式：glTF 2.0 二进制 `.glb`（项目已有 GLTFLoader 在用，Kenney 资产同格式）。
- 单位：米；Y 轴向上；原点在模型地面中心（角色为双脚之间地面点）。
- 朝向：与现行对应模型一致，试点第一件与现行模型同屏对照校准后定版写入本节。
- 导出前应用缩放/旋转变换；不带相机、灯光；材质保留自身 PBR 参数，加载层不得覆写粗糙度/金属度。
- 比例基准：以现行主角模型包围盒为 1.0 基准，替换模型包围盒偏差 ≤5%。

## 3. 面数与材质预算（硬约束，按全岛实例数核算）
| 模型 | 实例数 | 单件上限（三角面） | 备注 |
|---|---|---|---|
| 拟人猫角色 | 1 套（3 角色换色） | ≤3,000 | 骨骼 ≤20 根 |
| 小猴伙伴 | 1 | ≤2,500 | 同骨骼规范 |
| 苹果树 | 11 | ≤1,800 | 含树冠+树干 |
| 椰子树 | 8 | ≤1,500 | |
| 雪松 | 7 | ≤1,200 | |
| 灌木（杜鹃/山茶） | 9 | ≤500 | |
| 海滨木屋 | 1 | ≤5,000 | |
| 猎犬 / 金羊（后期） | 各 1 | ≤2,500 | |
- 替换平价原则：全批替换后主岛总三角面不得高于现值（约 127k）。
- 材质：每模型 ≤2 个材质、≤2 个 mesh；优先单张调色板贴图或顶点色，贴图 ≤512×512。

## 4. 骨骼命名（硬契约，来自现行代码）
现行程序化动画（走/跑/跳/挥击）在 PlayerController 与 VillagerManager 中按骨名驱动，已知必备：`Leg_1_L`、`Leg_1_R`、`Leg_2_L`、`Leg_2_R`、`Arm_1_L`、`Arm_1_R`、`Arm_2_L`、`Arm_2_R`、`Head`。新角色模型必须使用同一套骨名，否则动画失效呈 T 姿势。施工第一件角色前，先 grep 两处代码把完整骨名清单定版到本节，不许凭记忆。

## 5. 功能锚点（硬约束）
- 苹果树/椰子树：树冠与分叉处设空节点 `FruitAnchor_01…n`（TreeInteraction 挂果逻辑按锚点定位），数量与位置在试点按现行挂果效果校准。
- 木屋：占地与碰撞盒须与现行 `movementBox` 一致，试点量现行值定版。
- 角色：武器挂点沿用现行约定（试点核对）。

## 6. Blender 生产约定
- 命名：源文件 `scripts/models/<key>.py`（bpy 脚本，可复现重跑），产物 `public/models/<key>.glb`，key 与 AssetRegistry 注册键同名，替换零改代码。
- 标准流程：基本体起形 → 倒角圆润化 → 平色材质/调色板 → 正交四视图渲染回验 → 导出。
- 渲染回验：EEVEE 正交相机，正/侧/背/四分之三，灰底，带包围盒尺寸标注。

## 7. 验收链（每件必走）
1. 渲染四视图对照设计图，按美术规范判据逐条勾选；
2. 自动核查：面数、包围盒偏差、骨名/锚点完整性脚本过；
3. 引擎内截图（出生点、营地两机位）目检；
4. 角色类加验：程序化动画播放（走/跑/跳/挥击）无穿模、无 T 姿势；
5. 角色与木屋加用户 Seeker 真机一眼。

## 8. 红线
只学风格语言，模型全部原创脚本建模；不下载、不临摹任何任天堂模型数据；外部参考只走已定版 CC0 渠道（Kenney/KayKit/Quaternius）看比例与结构，不直接引入其文件冒充原创（引入 CC0 文件走阶段 5 既定替换路线，与本管线分开记账）。


---

# 附录：物件篇（美术指导稿，主控归档 2026-11-02）

收到，我来写「物件篇」10 件，按你给的顺序，格式和角色条目一致。先核对一遍色值的饱和度，然后分几条贴在聊天里。

「物件篇」共 3 条，这是第 1 条：通用规则、高度表、前 4 件。

## 第五部分　物件篇

### 5.0 通用规则（只列物件特有的，造型判据、饱和度上限 0.55、不描边都沿用前文）
- **比例锚点：** 主角身高 = 1.0。下表的高度指模型最高点，宽度是最宽处，都按主角 1.0 计。
- **圆润度：** 所有“金属”或“机械”的部件一律做成胖圆的软形：板件边缘倒角不小于最短边的 25%，圆柱的顶和底必须倒圆，不允许出现直角螺栓、齿轮齿、铆钉排、格栅、刻度线。
- **不画功能小细节：** 太阳能板不画电池格，蓄电池不画接线，神殿不画符文，扫描仪不画刻度。用大形状和颜色来表达用途。
- **深木色：** 前文调色板里的深木 `#8A5E3A` 饱和度是 0.58，超过了 0.55，所以物件篇里的深木一律用 `#9A6E48`（0.53）。
- **点缀：** 每件最多 1 个点缀色，晶石、灯、火、水这类发光或会动的东西就是它的点缀，可以到 0.75。基础色块 3 到 5 个。
- **发光物件：** 只在“点缀色块”上做自发光感，用比点缀色浅的奶油 `#FFF1D0` 在中心画一个圆点高光，不做光晕、不做渐变。
- **看得出是什么，不靠文字：** 物件上不出现任何文字、数字、标志。

### 5.1 高度表（主角 = 1.0）
| 物件 | 高度 | 最宽处 | 备注 |
|---|---|---|---|
| 采矿机 | 1.5 | 1.4（钻探臂伸出时加 0.8） | |
| 渔船 | 2.6（桅杆顶） | 长 3.5、宽 1.6 | 船身高 0.7 |
| 灯塔 | 7.0 | 底径 2.4 | 比雪松 4.5 高出一大截，做地标 |
| 神殿传送门 | 3.0 | 3.6，门洞净宽 1.8 | 晶石直径 0.5，悬在门洞内 1.6 高处 |
| 露营帐篷 | 1.6 | 2.2 | 比海边小屋小一圈 |
| 篝火 | 0.7（火焰顶） | 圆石圈直径 1.0 | |
| 储物箱 | 0.55 | 宽 0.9、深 0.6 | |
| 工作台 | 0.65（桌面高度） | 宽 1.6、深 0.9 | 锤长 0.3，晶石直径 0.2 |
| 净水台 | 1.1 | 0.8（水盆直径） | 陶罐高 0.7 |
| 扫描仪 | 1.8 | 扫描圈外径 1.1 | 底盘直径 0.9 |

---

### 1. 采矿机（第一优先）
- **英文主体描述：** `a plump rounded island mining machine, a chubby rounded-box body with soft pillow-like edges, a thick round-cornered solar panel slab tilted on top, a rounded battery pack bulging out of one side, a big round socket on the front holding a glowing purple crystal, and one thick drilling arm with a bullet-round tip pointing forward, chunky toy-like proportions, no bolts, no gears, no grids`
- **比例：** 高 1.5，最宽 1.4。机身是一个圆角胖方块，占总高的 55%，倒角半径不小于 12%；太阳能板是一块厚圆角板，宽约机身的 90%，厚 6%，向后倾斜约 20°，架在机身顶；侧面蓄电池是一个横躺的胶囊，长约机身高的 60%，直径 18%；正面晶石插槽是一个直径约机身宽的 32% 的圆凹口，外圈一圈厚 5% 的奶油圈；钻探臂是一根粗 12%、长 55% 机身宽的圆柱，从插槽下方伸出，末端是子弹头圆尖（半径不小于 6%）。
- **识别特征：** 顶上的斜板，侧面的胶囊电池，正面发紫光的大圆口，下方伸出一根子弹头钻臂。这四样都是“采矿机”独有的，一眼读出是挖矿的机器。
- **配色：** 机身 `#6EC1E4`；太阳能板 `#5A8FB3`；蓄电池 `#F28B7D`；插槽圈和钻探臂 `#E9DFC9`（同一个色块）；底部一圈圆形垫脚 `#B98A5A`；点缀：晶石 `#A878E8`，中心高光 `#FFF1D0`。
- **一句话剪影：** 一个胖方块顶着一块斜放的圆板，侧面鼓出一个胶囊，正面伸出一根圆头钻臂。

### 2. 渔船/小船（基础形）
- **英文主体描述：** `a chubby round-bellied wooden fishing boat with a soft curved hull and a gently upturned bow, one short thick mast with a rolled-up cream sail tied in a plump bundle, and one big round lantern on the tip of the bow, toy-like proportions, no planks drawn, no ropes`
- **比例：** 长 3.5、宽 1.6、船身高 0.7，桅杆顶 2.6。船身中间最胖，船头船尾收窄上翘，船头上翘高度约船身高的 40%；桅杆粗不小于 3%，高约 1.9，在船身 40% 处；卷起的帆是一根粗 8% 的圆柱，横挂在桅杆上方 70% 处；船头灯是一个直径约船身高 35% 的圆球。**后续升级共用这个剪影，只换配件**：船身、桅杆位置和船头灯的位置不要变。
- **识别特征：** 圆肚船身、上翘的船头、卷起的帆、船头圆灯。
- **配色：** 船身 `#B98A5A`；船舷一圈 `#DDB88A`；桅杆 `#9A6E48`；卷帆 `#FFF6E3`；一条绕船身的珊瑚细条 `#F28B7D`，宽 6%；点缀：船头灯 `#FFD25A`，中心高光 `#FFF1D0`。
- **一句话剪影：** 一个圆肚子船身，船头翘起并挑着一颗圆灯，中间立着一根缠着圆帆卷的短桅杆。

### 3. 灯塔
- **英文主体描述：** `a fat round island lighthouse, a plump slightly tapered cylindrical tower with one wide horizontal color band, a round lamp room on top with a glowing round light, a rounded dome cap, and a wide rounded stone base, toy-like proportions, no windows drawn, no railings`
- **比例：** 高 7.0，底径 2.4，顶部塔身直径是底径的 70%。从下到上：圆石底座占高 12%、塔身 63%、灯室 15%、圆顶 10%。宽色带绕塔身中部，高度占塔身的 25%。灯室直径约塔顶直径的 85%，灯球直径是灯室的 60%。全身没有栏杆、没有窗，倒角半径不小于 2%。
- **识别特征：** 胖圆的塔身，中间一条宽色带，顶上的发光圆球灯。
- **配色：** 塔身 `#FBEBC8`；色带 `#F28B7D`；圆顶 `#6EC1E4`；石底座 `#D9B27C`；灯室外壳 `#E9DFC9`；点缀：灯球 `#FFD25A`，中心高光 `#FFF1D0`。
- **一句话剪影：** 一根又胖又圆的锥柱，顶上戴着圆顶帽，帽下亮着一颗大圆灯，底下是一圈宽圆石座。

### 4. 神殿传送门
- **英文主体描述：** `an ancient but soft and chubby temple gate, two thick round pillars with plump rounded capitals, a thick round-arched lintel on top, a low wide rounded stone base, small round moss caps on the lintel, and one glowing teal crystal floating in the middle of the opening, no runes, no carvings, no sharp edges`
- **比例：** 高 3.0，宽 3.6，门洞净宽 1.8。圆柱直径约 0.6（高度的 20%），柱头是一个直径 130% 的圆饼；门楣是一道厚 18%、中间拱起的圆弧厚板，两端落在柱头上；底座高 8%，向两边各多出 10%。晶石直径 0.5，悬在门洞正中，离地 1.6。苔藓是 2 到 3 个圆团，落在门楣顶，每个直径 8%。
- **识别特征：** 两根胖柱子加一块圆拱门楣，中间悬着发光的晶石，顶上有苔藓。
- **配色：** 圆柱和门楣 `#E3D5BC`；门楣上沿和柱头 `#D9C7A8`；底座 `#C9BFB0`；苔藓 `#A8E6C3`；点缀：晶石 `#5FD4C8`，中心高光 `#FFF1D0`。
- **一句话剪影：** 两根墩实的圆柱撑着一块拱起的圆弧门楣，门洞正中浮着一颗圆晶石。

（第 2 条：第 5 到第 8 件）

### 5. 露营帐篷
- **英文主体描述：** `a chubby round-domed camping tent, a plump hemispherical dome body, a big round door flap in a lighter color, a round-ended door arch, one thick short pole sticking out of the top with a small round ball on its end, a low rounded base ring, soft toy-like shape, no stitching, no ropes`
- **比例：** 高 1.6，宽 2.2（半球直径），帐篷主体是略压扁的半球，高度占 85%，顶杆露出 15%；门帘是一个圆头拱形，宽约帐篷宽的 38%、高 55%，贴在正面，略凸出 3%；顶杆粗不小于 3%，杆端圆球直径约 7%；底部一圈圆环垫边，厚 6%。
- **识别特征：** 半球形帐篷顶，正面圆头拱门，顶上一根带圆球的短杆。
- **配色：** 帐篷顶 `#F28B7D`；门帘 `#FBEBC8`；底部圆环 `#DDB88A`；顶杆 `#9A6E48`；点缀：杆端圆球 `#FFD25A`。
- **一句话剪影：** 一个圆馒头，正面开一个圆头拱门，头顶竖一根带小圆球的短杆。

### 6. 篝火
- **英文主体描述：** `a cozy campfire, a ring of plump rounded stones, three chubby round-ended logs stacked in a small teepee, and a flame made of three rounded petal-like blobs with soft round tips, a smaller lighter inner flame blob, no sharp tips, no sparks`
- **比例：** 石圈直径 1.0，由 7 块圆石组成，每块直径约石圈的 22%；木柴三根，每根粗 10%、两端圆头，斜靠成小帐篷形，总高占 35%；火焰高 0.7（约占总高的 100%，从木柴中心向上长出），三个圆瓣：中间最高，左右各矮 25%，每瓣尖端半径不小于 6%；内焰是中间瓣里的一个小圆瓣，高 55%。
- **识别特征：** 一圈圆石围着、交叉的圆头木柴、三瓣圆润的火焰。
- **配色：** 圆石 `#C9BFB0`；木柴 `#9A6E48`；点缀（火焰，外瓣和内焰同属一个点缀组，是唯一的例外）：外焰 `#FF9F43`，内焰 `#FFD25A`。
- **一句话剪影：** 一圈圆石包着一团三瓣圆润的火，火下交叉着几根圆头木柴。

### 7. 储物箱
- **英文主体描述：** `a chubby wooden storage chest, a big rounded-box body with soft pillow-like edges, a gently arched rounded lid, two thick round-cornered wooden straps wrapping around the body and lid, and one big round lock clasp in the middle of the front, no nails, no wood grain, no hinges drawn`
- **比例：** 高 0.55，宽 0.9，深 0.6。箱身占高的 60%，盖占 40%，盖面是圆弧拱起；两道木带宽 12%，从盖顶绕到箱前；锁扣是一个直径约箱高 22% 的圆，凸出 4%，位置在正面中央偏上，压在盖和箱身的交线上。所有倒角半径不小于 10%。
- **识别特征：** 拱起的圆盖、两道木带、正面中间一个大圆锁扣。
- **配色：** 箱身 `#DDB88A`；箱盖 `#B98A5A`；木带 `#9A6E48`；点缀：锁扣 `#FFD25A`，中心高光 `#FFF1D0`。
- **一句话剪影：** 一个胖胖的大木盒，拱着圆盖，正面正中挂着一颗大圆锁。

### 8. 工作台
- **英文主体描述：** `a chubby crafting workbench, a thick round-cornered wooden tabletop with thick round legs, a low rounded shelf between the legs, a round-handled hammer with a plump rounded head lying on the table, and a small glowing purple crystal sitting next to it, no nails, no wood grain, no tool outlines`
- **比例：** 桌面高度 0.65，宽 1.6，深 0.9。桌面厚 14%（相对桌高），倒角半径不小于 6%；四条桌腿都是粗圆柱，直径 14%、末端倒圆；腿间一块圆角横板，离地 25%，厚 6%。锤：柄长 0.3、粗不小于 3%，锤头是一个圆鼓的圆柱（长 40% 锤长、直径 35% 锤长），搁在桌面左侧；晶石直径 0.2，放在桌面右侧，下面垫一个小圆座。
- **识别特征：** 厚桌面、粗圆腿、桌面上一把圆头锤加一颗晶石。
- **配色：** 桌面 `#DDB88A`；桌腿和横板 `#B98A5A`；锤柄 `#9A6E48`；锤头 `#C9BFB0`；点缀：晶石 `#A878E8`，中心高光 `#FFF1D0`。
- **一句话剪影：** 一张胖墩墩的厚木桌，四条粗圆腿，桌面上躺着一把圆头锤，旁边亮着一颗圆晶石。

（第 3 条，最后一条：第 9、10 件和说明）

### 9. 净水台
- **英文主体描述：** `a cute water purification stand, a big round-bellied terracotta jar on a small round stand, one thick bamboo tube tilted out from the jar with a round-ended spout dripping one round water drop, and a wide round shallow basin below catching the water with a round pool of clear blue water, no filters drawn, no pipes, no thin lines`
- **比例：** 高 1.1，水盆直径 0.8。陶罐高 0.7（占总高 64%），最胖处直径约 0.5，罐口一圈厚 6% 的圆口沿；竹筒粗不小于 3%，长 0.35，从罐肩斜伸出去，末端圆头，朝着水盆；水滴是一个直径约 5% 的圆，悬在竹筒口和水盆之间；水盆是一个宽而浅的圆盘（高 14%），盆里是一个圆形水面，直径约盆径的 70%。
- **识别特征：** 圆肚陶罐、斜出的竹筒、一滴圆水珠、下面承着清水的圆水盆。读法是“罐里的脏水经过竹筒，滴到下面成了清水”。
- **配色：** 陶罐 `#E39A78`；竹筒 `#A5CF7A`；水盆 `#E9DFC9`；底座 `#C9BFB0`；点缀：水（水滴和盆中水面）`#6EC1E4`，中心高光 `#FFF1D0`。
- **一句话剪影：** 一只圆肚陶罐斜伸出一根竹筒，筒口悬着一滴水，下面托着一个宽圆水盆。

### 10. 扫描仪
- **英文主体描述：** `a chubby island scanner, a thick round pole standing on a low round disc base, a plump torus ring floating at the top of the pole like a scanning halo, a small round collar where the ring meets the pole, soft toy-like proportions, no dials, no antennas, no thin lines`
- **比例：** 高 1.8，底盘直径 0.9。底盘是一个厚圆盘，高 8%，倒角半径不小于 4%；立杆粗 9%（直径 0.16），高 1.4，上端略粗；扫描圈是一个胖圆环（甜甜圈形），外径 1.1、管粗 0.18，竖着立在杆顶，圆心和杆顶对齐，圈面朝向前方；杆和圈之间一个直径约 0.22 的圆形连接环。
- **识别特征：** 立杆顶着一个胖圆环，像一个举起来的扫描圈，底下一块圆盘。
- **配色：** 立杆 `#FBEBC8`；底盘 `#B98A5A`；连接环 `#F28B7D`；点缀：扫描圈 `#5FD4C8`，圈上一小段中心高光 `#FFF1D0`（约占圈周的 15%，表示正在扫描）。
- **一句话剪影：** 一根圆杆立在圆盘上，杆顶托着一个胖胖的圆环。

---

### 5.2 物件篇的验收清单（只看画面）
- [ ] 四视图里，正面图的比例按 5.1 高度表和各条的百分比对，侧面图只提供厚度。
- [ ] 找不到直角、细线、格栅、螺栓、文字、符文。
- [ ] 每件的识别特征都在画面里（采矿机有斜板、胶囊电池、紫晶石、钻臂，缺一不可）。
- [ ] 每件基础色块 3 到 5 个，点缀不超过 1 个（篝火的外焰和内焰按一个点缀组算）。
- [ ] 逐色与上面的十六进制比对，基础色饱和度不超过 0.55，点缀不超过 0.75；深木一律是 `#9A6E48`。
- [ ] 缩到 64 像素的剪影里能分清：采矿机、灯塔、帐篷、篝火、扫描仪这五件互相不会混淆。
- [ ] 渔船后续升级，船身和桅杆、船头灯位置不动，只换配件。

### 两点说明
1. 这节里我把深木从 `#8A5E3A` 换成了 `#9A6E48`，是因为 `#8A5E3A` 的饱和度是 0.58，超出了你定的 0.55；不影响别的部分，只是物件篇用。如果你想让整套 3D 都统一用新的深木，说一声，我给你列出前文里所有用到它的条目。
2. 这节只管美术一侧，面数、骨骼、导出这些工程项都留给你补。

---

# 修订篇三：动森对比六点修订（美术指导稿 2026-11-02）

环境六款修订稿，共 4 条，只列修订处。没提到的条款和之前一致。

## 修订一：第一部分造型条款，新增和替换

**1. 替换“叶团由球团叠成”这一条，改为「花边叶簇」：**
- 树冠和灌木丛由**可数的大叶簇**叠成，每个叶簇的外沿是 5 到 7 个大圆瓣（像云朵的花边），不是光滑球。禁止出现整个树冠是一个光滑球或几个光滑球拼贴。
- 圆瓣半径不小于模型高度的 2%；相邻圆瓣之间的凹谷夹角不小于 90°（和原来的“凹角不小于 90°”一致）；凹谷深度为叶簇直径的 8% 到 15%。
- 单个叶簇直径为树冠宽度的 18% 到 28%。
- 正面图上整个树冠的外轮廓必须能数出**不少于 8 个**花边圆瓣，呈不规则的波浪，不对称。
- 叶簇之间要有**层叠**：前排叶簇压在后排叶簇上，遮住后排的 20% 到 35%；正面图至少能看出前后两层。

**2. 新增「上亮下暗双色分层」：**
- 每个叶簇用**两层色块**：上层（顶面）亮黄绿，占叶簇高度的约 60%，下层（底面和裙边）深绿，占约 40%；两层的分界线是波浪形，不是直线。
- 上下两层的亮度对比（WCAG 对比度）不小于 1.7。
- 设计图层面就要画出这两层；建模时用上下两层色块实现，不加贴图和渐变。

**3. 新增「冠干比」：**
- 果树（苹果树）：树冠占总高的 70% 到 78%（取 75%），树干只占下面的 22% 到 30%；树干中段粗度为树冠宽度的 18% 到 22%，基部有 3 到 4 个向外张开的圆根脚，基部总宽是树干中段的 150%，根脚半径不小于模型高度的 2%。
- 椰子树：树干可以长，占总高的 78% 到 82%，但必须**微弯**，顶端相对基部向一侧偏移总高的 8% 到 12%，只往一个方向弯成一个 C 形；基部张开到树干中段的 140%。
- 叶片必须是**羽状分段的裂叶**：一根弯曲的圆叶脉，两侧各 4 到 5 个圆头裂片，不是光滑桨叶。

**4. 新增「果实挂法」：**
- 果实 3 到 6 个，直径为树冠宽度的 8% 到 10%，是大果。
- 挂在树冠下缘的**内侧**：位置在树冠最低 35% 的高度内，离树冠最外沿向内不小于树冠宽度的 8%。
- 带短梗：梗长为果直径的 30%，粗不小于模型高度的 2%（胖短的圆桩，不是细线）。
- 半藏在叶间：正面图里每个果被前排叶簇遮住 30% 到 40%。禁止贴在叶面上像贴纸。

**5. 新增「花叶」：**
- 花少而大：整株 3 到 5 朵，每朵直径为灌木宽度的 22% 到 28%。
- 花瓣分层：外层 5 片圆瓣（每片宽约花径的 30%），内层 3 到 5 片更小更浅的圆瓣；中心是**花蕊簇**：5 个圆粒组成，簇直径约花径的 30%，每粒不小于花径的 8%。整朵花的颜色算一个点缀组。
- 叶子大而可数：整株可见 10 到 14 片，每片是一个大圆头椭圆，最小的一片也不小于灌木宽度的 12%，不允许细碎鳞片，不允许小圆盘当花。叶子同样用上亮下暗两层。

**6. 新增「建筑层理」（只针对木屋）：**
- 屋顶占总高的 45% 到 55%（取 50%）。
- 屋顶是**茅草分层**：3 层草带自上而下依次变厚，每层下沿是波浪形（浪高为屋顶高的 4% 到 6%，圆瓣半径不小于模型高度的 2%）；相邻两层用深浅两种草色交替，对比度不小于 1.5。
- 檐口向墙外挑出，每侧不小于墙宽的 12%，檐口厚不小于模型高度的 6%。
- 底部有一圈**石材基座**，占墙高的 12% 到 15%，由 6 到 8 块大圆石组成；门框和墙角各有 3 到 4 块圆石包边。
- 墙面**微斑**：3 到 4 块大而软的圆斑（每块直径为墙宽的 8% 到 12%），比墙色深或浅 5% 到 8% 的亮度，不做噪点纹理。
- 要有这几样**功能部件**，全是圆润的大形状：门边一盏圆壁灯（直径为总高的 5%），一个圆石烟囱（宽为屋顶宽的 10% 以上，出屋面 18% 总高，顶上圆帽），一扇分格窗（2×2 四格，格条粗不小于窗宽的 3%，圆角）。

**7. 色块数和质感条款跟着改：**
- 原来的“纯色块、无纹理”改成：每个面最多 2 个深浅色块（主色加斑块或亮暗两层），仍然没有贴图和法线。
- 树和灌木的色块数上限仍是 3 到 5 个加 1 个点缀组；**建筑放宽到最多 7 个色块加 1 个点缀**。

---

## 修订二：配色整体往自然色压一档
- 环境模型里的叶绿更深，土色更暖：叶子亮层亮度（HSV 的 V）不超过 0.75，暗层不超过 0.6；最亮的色块（奶油高光除外）亮度不超过 0.85。
- 饱和度上限仍是 0.55，点缀 0.75，不变。
- **提醒一个风险：** 树冠的亮层 `#A5BD5C` 和地面草 `#8CCB5E` 亮度很接近（对比度只有 1.08），主要靠两点分开：亮层更偏黄（色相 75° 对 95°），以及下面那层深绿；所以暗层不能省，也不能让树冠只剩亮层。

（第 2 条：三棵树的条目整条替换，对应第三部分和第二部分的主体描述）

### 苹果树（11 棵）
- **英文主体描述：** `a stout round apple tree, a short thick trunk with four rounded root feet spreading at the base, a huge canopy taking about three quarters of the total height, built from ten to twelve big scalloped leaf clusters layered front over back, every cluster scalloped like a cloud with five to seven round lobes and its own bright yellow-green top and darker green underside, the canopy outline wavy and irregular, four to five big red apples with short stubby stems hanging half hidden inside the lower rim of the canopy, no smooth sphere canopy, no stickers, no outlines`
- **比例：** 总高 2.6，树冠高 1.95（75%），冠宽 2.3；树干可见高 0.65，中段粗 0.41，基部宽 0.62；叶簇 10 到 12 个，每个直径约 0.5 到 0.65，分前后两层；苹果 4 到 5 个，每个直径约 0.21，挂在冠下缘 0.7 的高度内。
- **识别特征：** 又短又粗的树干加外张根脚，一个占四分之三高的大花边树冠，亮绿上层、深绿下层，大红苹果半藏在冠下缘的叶间。
- **配色：** 叶簇上层 `#A5BD5C`；叶簇下层 `#4F8F4E`；树干 `#9A6E48`；根脚和树干暗面 `#85603F`；点缀：苹果 `#DE5B4C`（0.66），梗 `#85603F`，苹果中心高光 `#FFF1D0`。
- **一句话剪影：** 一棵矮胖的树撑着占四分之三的大花边树冠，轮廓是不规则波浪，冠下缘露出几颗大圆果。

### 椰子树（8 棵）
- **英文主体描述：** `a tall gently curved coconut palm, a thick trunk bending slightly in one direction with a flared round base, a crown of eight pinnate fronds, each frond a curved round rib with four to five rounded leaflet lobes along both sides, the fronds drooping down, bright yellow-green on top and darker green underneath, three to four big coconuts nestled under the crown half hidden by the fronds, no smooth paddle leaves, no sharp spikes except the frond tips`
- **比例：** 总高 4.0，树干占 80%（3.2），中段粗 0.24，基部 0.34，顶端相对基部向一侧偏 0.4；树冠直径 2.6、高 0.8；复叶 8 片，每片长约 1.4，叶脉粗不小于 0.1，叶片厚不小于 0.1（2.5% 总高，椰子叶专用，比通用的 3% 放宽半档），两侧各 4 到 5 个圆头裂片，裂片圆瓣半径不小于 0.08；叶片外端下垂，叶尖是三个允许尖点之一，半径不小于 1.5%；椰子 3 到 4 个，直径约 0.23，贴着树干顶部、被叶片遮住 30% 到 40%。
- **识别特征：** 微弯的长树干，羽状分段的裂叶，下垂的叶尖，树冠下面抱着几个大椰子。
- **配色：** 叶片上层 `#A5BD5C`；叶片下层 `#4F8F4E`；树干 `#B98A5A`，树干暗面 `#85603F`；点缀：椰子 `#8D6E45`，椰子中心高光 `#FFF1D0`。
- **一句话剪影：** 一根微微弯曲的长树干，顶上炸开一圈下垂的羽状裂叶，叶下抱着几个圆椰子。

### 雪松（7 棵）
- **英文主体描述：** `a plump layered cedar tree, five stacked tiers of wide scalloped skirts getting smaller toward the top, every skirt edge made of big round lobes like a ruffled cloud, each tier with a light green top and a dark green underside, a short thick trunk barely showing at the bottom, one soft rounded tip at the top, no smooth cone, no needles drawn`
- **比例：** 总高 4.5，最宽的底层宽 2.0（约 45%）；5 层，每层高约 19%，上一层宽度是下一层的 78%，相邻两层叠压 25%；每层裙边正面能数出至少 3 个圆瓣（半径不小于 0.09）；树干可见 0.45（10%），粗 0.35；顶尖半径不小于 1.5% 总高，夹角不小于 60°。
- **识别特征：** 五层越往上越小的花边裙，每层上亮下暗，底下露一小截粗树干。
- **配色：** 裙边上层 `#6FA866`；裙边下层 `#35704A`；树干 `#9A6E48`。无点缀。
- **一句话剪影：** 五层逐级收小的花边裙叠成一座圆胖的塔，顶上一个圆润的小尖，底下一截粗短树干。

（第 3 条：两种灌木和木屋，同样整条替换）

### 杜鹃灌木
- **英文主体描述：** `a low round azalea bush, a mound built from six to eight big scalloped leaf clusters layered front over back, each cluster with a light green top and a dark green underside, five to eight big five-petal pink flowers with light centers scattered on top and the front of the mound, flowers large and few, no tiny dots, no scale-like leaves, no outlines`
- **比例：** 高 0.6，宽 0.8；叶簇 6 到 8 个，每个直径约宽度的 25%；花 5 到 8 朵，每朵直径为灌木宽的 16% 到 18%，5 片圆瓣，中心一个浅色圆点（直径为花径的 25%）；花压在叶簇上面，不超过叶簇外沿。
- **识别特征：** 低矮的花边叶丘，上面开着几朵大的五瓣粉花。
- **配色：** 叶簇上层 `#6FA866`；叶簇下层 `#35704A`；点缀：花 `#E87FA0`，花心 `#FFF1D0`。
- **一句话剪影：** 一个低矮的花边小丘，丘面上顶着几朵大圆花。

### 山茶灌木
- **英文主体描述：** `a rounded camellia bush, a dense mound of ten to fourteen big round oval glossy leaves layered front over back, each leaf countable, with a mid green top and dark green underside, only three to five large layered camellia flowers, each with five round outer petals, three to five smaller lighter inner petals and a cluster of five round yellow stamens in the center, no tiny scale leaves, no small disc dots`
- **比例：** 高 0.9，宽 0.9；叶子 10 到 14 片，每片长约灌木宽的 18% 到 24%（最小不小于 12%），圆头椭圆，不画叶脉；花 3 到 5 朵，每朵直径约 0.22 到 0.25（灌木宽的 22% 到 28%），外层 5 片圆瓣，内层 3 到 5 片，中心 5 粒花蕊，花簇直径是花径的 30%；花压在叶子上，大部分在顶面和前上方。
- **识别特征：** 大而可数的圆叶，少而大的分层花朵，花蕊成簇可读。
- **配色：** 叶子上层 `#5E9A5A`；叶子下层 `#35704A`；点缀（花作为一个点缀组）：外层花瓣 `#E4607E`（0.58），内层花瓣 `#F2A0B4`，花蕊 `#FFD25A`，中心高光 `#FFF1D0`。
- **一句话剪影：** 一丛大圆叶堆起的圆墩，顶上开着几朵大而分层的花。

### 海边小屋
- **英文主体描述：** `a chubby seaside cabin with a big thick layered thatch roof taking half of the total height, three stacked bands of thatch in two alternating tones with wavy scalloped lower edges, a wide overhanging eave, a rounded stone plinth made of six to eight big round stones along the bottom, round stone corner blocks around the door, a soft mottled cream wall with three or four big soft patches, a round wooden door, a small round lantern beside the door, a stout round stone chimney with a round cap, one four-pane window with thick rounded bars, no sharp lines, no planks drawn, no outlines`
- **比例：** 总高 4.0，屋顶 2.0（50%），墙和基座 2.0；墙宽 4.0，门高 1.35；檐口每侧挑出 0.5（墙宽的 12%）、厚 0.25；石基占墙高的 14%；草带三层，从上到下厚度比约 1：1.3：1.6；烟囱宽 0.4、出屋面 0.7、顶帽圆；壁灯直径 0.2；窗 0.7 见方，格条粗 0.05。
- **识别特征：** 占一半高度的分层茅草波浪屋顶，圆石基座和门边圆石包边，微斑的奶油墙面，壁灯、圆烟囱和分格窗。
- **配色（7 个色块加 1 个点缀）：** 茅草亮层 `#CFA860`，茅草暗层 `#A98652`；墙 `#E8D3A8`，墙斑 `#D9C196`；石基和包边 `#B8AD9C`，石材暗面 `#9E9484`；门和窗框 `#8F6A47`；窗玻璃 `#8FCBE0`；点缀：壁灯 `#FFD25A`，高光 `#FFF1D0`。
- **一句话剪影：** 一个大波浪茅草屋顶压着一个矮胖的墙身，屋顶一侧冒出一个圆烟囱，墙脚围着一圈圆石。

---

## 验收清单里跟着改的几条（只看画面）
- 正面图树冠外轮廓能数出至少 8 个圆瓣，不是光滑球。
- 每个叶簇上亮下暗，分界线是波浪形，两层对比度不小于 1.7。
- 苹果树树冠占总高 70% 到 78%，树干粗度和基部外张符合上面的数字。
- 椰子树干有微弯，叶片是带圆头裂片的羽状叶，不是光滑桨叶。
- 苹果 3 到 6 个，在冠下缘内侧，有短梗，被叶簇遮住约三分之一。
- 山茶花 3 到 5 朵、每朵大、分层、花蕊成簇，叶子大而可数。
- 小屋屋顶占 45% 到 55%，有三层波浪草带、石基、墙斑、壁灯、烟囱和分格窗。
- 配色按上面的十六进制比对，基础色饱和度不超过 0.55，点缀不超过 0.75；树冠亮层相对草地的区别靠黄一点的色相和深绿暗层，缺暗层就算不合格。

## 两点说明
1. 这次的新条款（花边叶簇、双色分层、建筑层理）和旧条款里“剪影干净、纯色块”有冲突，我已经把冲突处改成“每个面最多 2 个深浅色块，无贴图和法线”。圆润判据其余部分不动，所以花边的凹谷夹角必须仍不小于 90°，圆瓣半径不小于 2%。
2. 十个物件（采矿机、船等）和三个人类不受这次改动影响。如果你想让物件也往“自然色压一档”靠，说一声，我另出一份物件配色的对照修订。

---

# 附录：动物特有种三条（美术指导定稿 2026-11-02）

三条动物重做好了，比例和骨骼不动，只换设计层。

## 总则（新增）
全岛动物，包括以后的野怪和 Boss，一律按「孤岛特有种」设计：设计前先写一句“它在这座岛上演化出了什么适应”，再谈造型。这个适应必须落在剪影里，也就是 20 像素的剪影也能看出来，不能只靠表面花纹；每只动物只讲一个适应，不堆叠。圆润判据、饱和度上限、不描边照旧；新长出来的部件（花、芽、晶石、螺旋）一律是圆头的软形状，不新增尖点。

---

### 巴布 → 苔背猴
- **适应：** 它和岛上的苔藓共生，像树懒一样不爱动，背上长出了一座小花园。
- **英文主体描述：** `a chubby moss-brown island monkey that lives together with moss, a soft thick moss blanket growing over its back and the top of its head with three small round flowers and one small round mushroom sitting on it, huge round ears with fresh leaf-green insides, round dot eyes with blush, and a long tail whose tip curls into a plump fern-fiddlehead spiral, chunky toy-like proportions, no outlines`
- **识别特征：** 背上和头顶一整片苔藓毯（边缘是花边圆瓣，厚不小于 3% 身高），毯上三朵小圆花和一朵小圆蘑菇；特大的耳朵，直径约头宽的 55%，内耳是嫩叶绿；尾巴尖卷成 1.5 圈的蕨芽螺旋。花每朵直径约身高的 10%，蘑菇帽约 14%。
- **配色：** 毛 `#8A7A4E`；脸和肚皮 `#D9C196`；苔藓毯 `#6FA866`；内耳和蕨芽尾尖 `#A5BD5C`；点缀（小花园作为一个点缀组）：花 `#F2A0B4`，花心 `#FFD25A`，蘑菇帽 `#F28B7D`，蘑菇斑点 `#FFF6E3`。
- **一句话剪影：** 一只圆团猴，背上拱着一片长着小花和蘑菇的苔藓丘，两只大圆耳朵，尾巴尖卷成螺旋。

### 贝拉 → 沙洲犬
- **适应：** 它在海滩上靠刨沙觅食，前爪演化得又宽又圆，像铲子，耳朵像芭蕉叶，用来挡沙。
- **英文主体描述：** `a chubby sand-yellow island dog adapted to digging in beaches, two front paws as wide as round shovels, long banana-leaf-shaped ears with one soft fold in the middle, a white sea-foam stripe with round bubble edges running along its back, and a tail curled into a plump conch-shell spiral, round dot eyes with blush, chunky toy-like proportions, no outlines`
- **识别特征：** 前爪是圆铲，宽度约后爪的 1.6 倍；耳朵长约头长的 60%，中间一道软折，末端圆头；背上一条海浪泡沫边的白纹，宽约身宽的 12%，边缘是 4 到 5 个圆泡；尾巴卷成 2 圈的海螺螺旋，尾尖带一点珊瑚色。
- **配色：** 毛 `#E2BE72`；肚皮和海螺 `#F2D9A6`；前爪和耳朵外侧 `#C9A060`；泡沫白纹 `#FFF6E3`；点缀：海螺尾尖 `#F28B7D`。
- **一句话剪影：** 一只圆团犬，前爪像两把圆铲，两只长芭蕉叶耳朵带着折，尾巴卷成一个海螺。

### 多姆 → 晶芽羊
- **适应：** 它吃晶石草场长大，晶石的成分长进了羊毛里，毛里冒出小晶芽和晶花，连铃铛也是晶石做的。
- **英文主体描述：** `a chubby golden cloud-wool island sheep grown on crystal meadows, seven to nine plump golden wool cloud lumps with five to seven small rounded teal crystal buds and three white crystal flowers growing out of the wool, a small round teal crystal bell hanging from its neck, round dot eyes with blush, chunky toy-like proportions, no outlines`
- **识别特征：** 金色云朵羊毛由 7 到 9 个圆团叠成，毛里冒出 5 到 7 颗青色晶芽（圆头的卵石状宝石，不是尖晶体）和 3 朵白色晶花；脖子上一枚直径约身高 9% 的小晶石铃。
- **配色：** 羊毛 `#F0C86E`，毛团下沿暗层 `#D4AA68`；脸和腿 `#9A6E48`；点缀（晶石生态作为一个点缀组）：晶芽和铃 `#5FD4C8`，晶花 `#FFF6E3`，中心高光 `#FFF1D0`。
- **一句话剪影：** 一朵金色的云朵羊，毛上冒出几颗圆圆的青色晶芽，脖子下挂着一枚小晶铃。

---
色值我按 0.55 的上限核过：苔背猴毛 0.43，沙洲犬毛 0.50，晶芽羊毛 0.54，青色点缀 0.55，都在范围内。