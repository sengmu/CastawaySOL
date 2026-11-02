# CastawaySOL UI 图标美术规范（动森风，定版）

日期：2026-11-02。本批 37 个界面图标：重做 11、新增 26。128×128 透明 PNG，20 px 小尺寸一眼可辨。

---

## 一、统一美术规范（动森风）

- **造型：** 一切皆圆。形状胖、饱满、有弹性，所有转角都是大圆角，没有尖角和尖刺；闪电、水滴尖、光线端头都要磨圆。
- **质感与光影：** 表面干净光滑，带柔和的渐变明暗；左上一小块奶油高光 `#FFF1D0`，右下一圈淡薰衣草色阴影 `#8E7AA0`；不描边，不画落地阴影。
- **颜色：** 糖果色但保持柔和，平均饱和度 0.45 到 0.68，明度 0.80 到 1.00，饱和度超过 0.75 的像素不超过 20%。主色从锁定调色板里选：珊瑚红、阳光黄、天蓝、花瓣粉、薄荷、火橙。
- **对风格指南 v1 的例外：** v1 把基础饱和度上限定在 0.55，这批界面图标上限提到 0.68；调色板和 0.75 的硬上限不动，指南其余部分照旧。
- **视角与留白：** 30 到 45 度斜上方看，符号类正面朝前；主体占 108 像素（84%），居中，128×128 透明底。
- **20 像素要求：** 主要形状最多 3 个，轮廓占包围盒 60% 以上，部件在 128 像素下不细于 8 像素，同组图标各用不同主色，不画脸（猴子、螃蟹这类角色用两个圆点眼睛除外）。

**英文正面模板**（把 `{subject}` 换成各图标的主体描述）：

```
A single cute game UI icon in a soft Animal Crossing inspired style: every shape is round, plump and bouncy with generous rounded corners, a clean smooth matte surface with gentle soft shading, no hard outline. Bright candy colours that stay soft and friendly, pastel-leaning, such as #F26B5B, #FFD25A, #6EC1E4, #A8E6C3, #F7B6C8, #FF9F43. One small soft warm cream highlight (#FFF1D0) on the upper left and a gentle lavender-tinted shade (#8E7AA0) on the lower right. Seen from about 30 to 45 degrees above, centred, filling 84% of a square canvas on a transparent background. Simple bold silhouette, three shapes at most, readable at 20 pixels. Subject: {subject}.
```

**英文负面词**（GPT 没有单独的负面框，接在正面模板后面）：

```
Avoid: hard outlines, black, sharp corners, pointed spikes, thin lines, tiny details, baked drop shadow or ground shadow, background scene, text or letters, watermark, glossy chrome or metal shine, photorealism, airbrushed gradients, perspective distortion, neon or harsh oversaturated colours.
```

---

## 二、第一组出图方向（状态 4 + 天气 4）

| 图标 | 形状构图 | 主色 | 识别点 |
|---|---|---|---|
| health 生命 | 胖嘟嘟的心，微微右倾 | 珊瑚红 `#F26B5B` | 圆润心形，左上一小块高光 |
| food 饱食 | 一根胖烤鸡腿，骨头朝右下 | 火橙 `#FF9F43` | 肉块加圆头短骨，两个形状 |
| water 饮水 | 圆胖水滴，尖端磨圆朝上 | 天蓝 `#6EC1E4` | 水滴轮廓加一点泡沫白高光 |
| energy 疲劳 | 三折粗闪电，所有折角磨圆 | 阳光黄 `#FFD25A` | 圆角闪电，右下火橙阴影 |
| weather_clear 晴 | 圆太阳，8 根胶囊形短光线 | 阳光黄加火橙 | 光线像圆头小胶囊，不画脸 |
| weather_cloudy 多云 | 奶油白云，左上后露出半个太阳 | 奶油白 `#FFF6E3` | 云加半个太阳，两个形状 |
| weather_rain 雨 | 淡蓝云，下面三滴胖雨点 | 云 `#BFE6F5`，雨点 `#6EC1E4` | 云加三滴 |
| weather_typhoon 台风 | 胖螺旋一圈半，中间一个奶油圆点 | 天蓝配 `#4FB3C8` | 唯一没有云的天气图标 |

一句话英文提示词（填进模板的 `{subject}`）：

- health：`a plump coral-red heart tilted slightly to the right with one small cream highlight on the upper left`
- food：`one chubby roasted drumstick in warm orange with a short round-ended bone pointing to the lower right`
- water：`one round plump sky-blue water drop with a softly rounded tip pointing up and a small white foam highlight`
- energy：`one thick sun-yellow lightning bolt with three bends, every corner rounded, with a soft orange shade on the lower right`
- weather_clear：`a round puffy sun-yellow disc with eight short fat capsule-shaped rays, no face`
- weather_cloudy：`a plump cream-white cloud with a small sun-yellow half disc peeking out behind its upper left`
- weather_rain：`a plump pale blue cloud with three fat round-ended sky-blue raindrops below it`
- weather_typhoon：`a thick round-ended sky-blue spiral of one and a half turns with a small cream dot in the centre, no cloud`

提醒：`food` 的烤鸡腿和已有的 `meat_cooked` 有点像，所以画得更简单更大；`energy` 的黄闪电和 `weather_clear` 的黄太阳颜色相近，靠形状区分。

---

## 三、和现有 72 个图标怎么衔接

按新颜色规则（平均饱和度不超过 0.68，饱和度超 0.75 的像素不超过 20%）量过 72 个现有图标：

- **保留，先不动（60 个）：** 颜色都在新范围内。注意只量了颜色，形状圆不圆还没逐个看。
- **以后要跟着往动森靠（12 个，颜色偏艳）：** `apple`、`baked_apple`、`crab`、`crab_meat_cooked`、`crab_shell`、`crab_shield`、`energy_drink`、`fish_grilled`、`golden_coconut`、`resin`、`rocket`、`smoked_fish`。螃蟹一家 5 个最明显，其中 `crab` 要和 `prompt_crab` 对上，建议同一次一起重画。
- **本批重做的 11 个界面图标：** 现有这 11 个几乎全是棕色单色的黏土质感，保持原来的主体，按本规范换成糖果色重画，画好后替换。
- **以后新增的物品图：** 全部用这套模板。
- 之前那 11 个降过饱和度的副本是按旧的 0.62 上限做的，新规则下不一定需要，不拿去替换。

---

## 四、其余 29 个出图方向

每条给：构图、主色、识别点、一句话英文提示词（填进第一部分的正面模板）。

### 4.1 重做 11 个（保持现有主体，换成动森糖果色）

**mining_rig 矿机**
- 构图：一台胖圆角方墩机器，顶上立一个层层叠起的圆锥钻头，机身前面一个小圆灯。三个形状：机身、钻头、灯。
- 主色：薄荷 `#A8E6C3` 机身，钻头 `#DCD3C0`，灯 `#FFD25A`。
- 识别点：叠起的圆锥钻头轮廓。现有图里的小镐子去掉，20 像素下看不清。
- 提示词：`a chubby rounded-box machine in soft mint with a stacked round cone drill on top and one small round sun-yellow light on its front`

**backpack 背包**
- 构图：圆鼓鼓的背包，前面一个圆角口袋盖，顶上横放一卷圆筒铺盖。三个形状：包身、口袋、铺盖卷。
- 主色：火橙 `#FF9F43` 包身，口袋和铺盖卷奶油 `#FFF6E3`。
- 识别点：顶上横着的圆筒卷，一眼和别的包区分开。
- 提示词：`a plump round backpack in warm orange with a rounded cream front pocket flap and a fat cream bedroll tube lying across the top`

**menu 菜单**
- 构图：三条上下叠放的粗胶囊横杠，等宽，间距不小于 10 像素。
- 主色：天蓝 `#6EC1E4`。
- 识别点：三条等宽粗杠。现有图的棕色要换掉，不然看着像木头。
- 提示词：`three fat horizontal capsule bars of equal width stacked with wide gaps, in soft sky blue`

**interact 主互动**
- 构图：一只胖圆的连指手套，手掌朝前，手指短粗，袖口一圈。保持现有手套主体。
- 主色：花瓣粉 `#F7B6C8` 手套，袖口奶油。
- 识别点：圆鼓的手套轮廓。
- 提示词：`a chubby round mitten glove with short fat fingers and a rounded cuff, in soft blossom pink with a cream cuff, palm facing forward`

**attack 攻击**
- 构图：两把胖短剑交叉成 X，剑身宽而圆头，剑柄圆润。
- 主色：剑身 `#DCD3C0` 偏奶油灰，剑柄珊瑚红 `#F26B5B`。
- 识别点：X 形轮廓；剑身不画金属反光。
- 提示词：`two chubby short swords crossed in an X, with wide round-tipped cream-grey blades and plump coral-red handles`

**sprint 疾跑**
- 构图：一只胖靴子，脚跟处长一片圆润小翅膀。两个形状：靴子、翅膀。
- 主色：天蓝 `#6EC1E4` 靴子，翅膀奶油。
- 识别点：脚跟的小翅膀。
- 提示词：`one chubby round boot in sky blue with a single plump cream wing at the heel`

**jump 跳跃**
- 构图：一根胖上箭头，箭头占宽度 70% 以上。单一形状。
- 主色：薄荷 `#A8E6C3` 偏嫩绿 `#8CCB5E`。
- 识别点：圆头粗箭头。现有图是棕色，会和 menu、sprint 糊在一起，所以换成绿色。
- 提示词：`one fat upward arrow with a rounded head and a rounded stem, in soft fresh green`

**crafting_table 合成**
- 构图：一张胖矮木桌，桌面上放一把圆头木槌。两个形状：桌、槌。
- 主色：桌 `#DDB88A`，槌头珊瑚红 `#F26B5B`。
- 识别点：桌面上的圆头槌。现有图里的凿子去掉。
- 提示词：`a chubby short wooden table in light wood tones with a round-headed coral-red mallet resting on top`

**camp 营地**
- 构图：一个圆顶小帐篷，门口前面一小堆圆焰篝火。两个形状：帐篷、火。
- 主色：帐篷奶油 `#FFF6E3` 配花瓣粉门帘，火火橙 `#FF9F43`。
- 识别点：圆顶加火。
- 提示词：`a small round-domed cream tent with a blossom-pink door flap and a tiny plump orange campfire in front of it`

**shop 商店**
- 构图：一个小摊位，顶上圆弧波浪边的条纹遮阳篷，下面一个矮柜台。条纹最多 3 条（现有是 4 条，20 像素下会糊）。
- 主色：珊瑚红 `#F26B5B` 和奶油相间的篷，柜台 `#DDB88A`。
- 识别点：条纹遮阳篷。
- 提示词：`a tiny market stall with a scalloped awning of three fat coral-red and cream stripes over a short round-cornered wooden counter`

**manual 手册**
- 构图：一本合着的胖书，圆角，右侧露奶油色书页，一根圆头书签带垂下来。
- 主色：薄荷绿 `#8CCB5E` 偏柔和封面，书页奶油。
- 识别点：书签带加书页侧面。
- 提示词：`a chubby closed book with rounded corners, a soft green cover, cream pages visible on the right side and a short round-ended ribbon bookmark hanging down`

### 4.2 共振 3 个

**motherlode 母晶池**
- 构图：一圈圆石环，中间升起一簇大晶石，晶石周围一圈柔光。三个形状：石环、晶簇、光晕。
- 主色：晶石 `#5FD4C8`，石环 `#DCD3C0`。
- 识别点：晶簇从石环中长出来；这是整套里最大的晶体图标。
- 提示词：`a round pebble-stone ring with a cluster of three plump teal glowing crystals rising from its centre and a soft glow around them`

**shard 残晶**
- 构图：单独一块胖晶体，歪着放，面都是圆倒角，没有石环。
- 主色：`#5FD4C8`，高光薄荷 `#A8E6C3`。
- 识别点：只有一块、不对称；比 motherlode 小，没有石环。
- 提示词：`one single plump teal crystal shard tilted to one side with softly rounded facets and a small mint highlight`

**score_rs 算力评分**
- 构图：一枚圆胖奖牌，中间嵌一小块青色晶体，下面垂一小段圆头绶带。三个形状：圆盘、晶体、绶带。
- 主色：阳光黄 `#FFD25A` 圆盘，晶体 `#5FD4C8`，绶带珊瑚红。
- 识别点：黄圆盘加青晶体。
- 提示词：`a plump round sun-yellow medal with a small teal crystal set in its centre and a short round-ended coral ribbon hanging below`

### 4.3 世界交互浮标 8 个

这 8 个出裸图标，不带气泡底；如果游戏里要加圆形气泡底，由游戏代码画。

**prompt_crystal 晶石矿点**
- 构图：一块圆灰石，上面长出两颗胖青晶。
- 主色：石 `#DCD3C0`，晶 `#5FD4C8`。
- 识别点：石头上长晶体，用来和 `shard`（单块晶体）区分。
- 提示词：`a round pale-grey rock with two plump teal crystals growing out of its top`

**prompt_monkey 猴子伙伴**
- 构图：一个圆圆的猴子头像，两只圆耳朵，奶油色圆口鼻，两个圆点眼睛。
- 主色：棕 `#B98A5A`，脸部奶油。
- 识别点：两只圆耳加奶油口鼻。
- 提示词：`a round monkey head with two big round ears, a cream round muzzle and two simple round dot eyes, in warm brown`

**prompt_heart 伙伴照护**
- 构图：一只张开的胖手掌心托着一颗小粉心。两个形状：手、心。
- 主色：心花瓣粉 `#F7B6C8`，手奶油。
- 识别点：手托着心。因为粉色和 `health` 的珊瑚红在 20 像素下接近，所以靠“手托着”这个形状区分。
- 提示词：`a plump cream open palm holding up one small blossom-pink heart`

**prompt_crab 螃蟹**
- 构图：一只圆胖螃蟹，两只大圆钳高举，两个圆点眼。
- 主色：珊瑚红 `#F26B5B`。
- 识别点：两只高举的圆钳。要和现有 `crab` 图标一起重画。
- 提示词：`a round chubby coral-red crab with two big round claws raised high and two dot eyes`

**prompt_fire 篝火**
- 构图：两根圆头横木交叉，上面一团圆润火焰，里面再套一团小黄焰。
- 主色：火焰火橙 `#FF9F43`，内焰 `#FFD25A`，木头 `#B98A5A`。
- 识别点：圆尖的水滴形火焰加内焰。
- 提示词：`two plump crossed round-ended logs under a rounded teardrop orange flame with a smaller sun-yellow flame inside`

**prompt_tracks 兽迹**
- 构图：两个斜着排开的胖爪印，每个一个大圆掌垫加三个圆趾（只画 3 个趾，20 像素下 4 个会糊）。
- 主色：`#B98A5A`。
- 识别点：两个爪印斜排。
- 提示词：`two plump paw prints placed diagonally, each with one big round pad and three round toes, in warm brown`

**prompt_boss 首领**
- 构图：一顶胖王冠，顶上三个圆球尖，冠面一颗红圆宝石，两侧各一只小圆角。
- 主色：阳光黄 `#FFD25A`，宝石 `#E2574C`。
- 识别点：王冠加红宝石。首领具体长什么样我不知道，如果首领是某种生物，建议改成那个生物的头像；你告诉我是什么，我再改这一条。
- 提示词：`a plump sun-yellow crown with three round ball tips, one round red gem in front and two small rounded horns on the sides`

**prompt_generic 通用互动**
- 构图：一个圆圆的对话气泡，里面三个圆点，下面一个圆润小尾巴。
- 主色：奶油 `#FFF6E3` 气泡，圆点天蓝 `#6EC1E4`。
- 识别点：三个点的气泡。
- 提示词：`a round cream speech bubble with a small rounded tail and three fat sky-blue dots inside`

### 4.4 通用 7 个

**quest 任务卷轴**
- 构图：一卷胖卷轴，上下两个圆卷头，中间系一条花瓣粉丝带。
- 主色：奶油 `#FFF1D0`，丝带 `#F7B6C8`。
- 识别点：圆卷头加丝带。
- 提示词：`a plump rolled parchment scroll with two round rolled ends in cream, tied in the middle with a blossom-pink ribbon`

**quest_flag 目标旗**
- 构图：一根短杆顶着圆球，杆上飘一面圆角波浪旗。
- 主色：旗珊瑚红 `#F26B5B`，杆 `#DDB88A`。
- 识别点：圆球杆头加波浪旗。
- 提示词：`a short wooden pole topped with a round ball, carrying one plump wavy coral-red flag with rounded corners`

**solana 链上入口（抽象方案，不描摹官方标志）**
- 构图：一个胖圆拱门，门框奶油色，门内是青色柔光，门里漂着一颗小圆晶体。三个形状：拱门、光、晶体。它是“入口”，不是币，所以和物品图 `sol_token` 的圆币区分开。
- 主色：门内 `#5FD4C8`，门框 `#FFF6E3`，晶体 `#A8E6C3`。
- 识别点：拱门轮廓。
- **禁止：** 不要出现三条平行斜杠，不要紫绿渐变，不要任何接近 Solana 官方标志的形状或配色；本方案只借“入口”和“青色光”的概念。
- 提示词：`a plump round-topped archway doorway with a cream frame, soft teal glow filling the opening and one small mint round crystal floating inside, no logo, no stripes`

**close 关闭**
- 构图：一个胖 X，两根交叉的粗胶囊条，每条粗不小于 12 像素。
- 主色：珊瑚红 `#F26B5B`。
- 识别点：圆头 X。
- 提示词：`a plump X made of two crossing fat capsule bars with rounded ends, in soft coral red`

**check 完成**
- 构图：一个胖对勾，短边和长边都是圆头粗条。
- 主色：草绿 `#8CCB5E`。
- 识别点：圆头对勾。
- 提示词：`a plump check mark made of two fat capsule strokes with rounded ends, in fresh soft green`

**warn 警告**
- 构图：一个大圆角三角形，里面一个圆头感叹号（竖条加圆点）。
- 主色：阳光黄 `#FFD25A`，感叹号可可棕 `#6B4A32`。
- 识别点：圆角三角加感叹号。
- 提示词：`a plump sun-yellow triangle with very rounded corners and a fat cocoa-brown exclamation mark with a round dot inside`

**lock 锁定**
- 构图：一把胖挂锁，圆角锁身，粗圆弧锁梁，锁身中间一个圆点锁孔。
- 主色：锁身天蓝 `#6EC1E4`，锁梁 `#DCD3C0`，锁孔可可棕。
- 识别点：圆弧锁梁加圆锁身。
- 提示词：`a chubby padlock with a rounded sky-blue body, a thick round pale-grey shackle and a round cocoa-brown keyhole dot`

---

## 五、出图和验收做法

1. 每个图标单独出，一次一张，要求透明底；GPT 给不了透明底时，要求纯奶油色 `#FFF6E3` 背景，我再去掉。
2. 第一张满意的图当参考图，后面每张都附上它，保持一套。
3. 把出好的图发给我：我会缩到 20 像素看能不能一眼认出，并量颜色、留白、居中，再一一回你结果。
