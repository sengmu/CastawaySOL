# 阶段 5 前置：DAE 模型素材资产替换映射与审计报告

> **审计基准日期**：2026-11-02  
> **审计范围**：代码库全量源码中带有 `Nin_NX_NVN` 前缀的 DAE 模型路径引用  
> **审计原则**：只读审计；不修改任何源码、不下载/接触任何外部未授权素材；严格基于调用上下文与运行时生命周期判定。

---

## 1. 资产引用概况与宏观结论

项目在早期原型阶段引入了包含任天堂动物森友会（ACNH）前缀 `Nin_NX_NVN` 的 DAE 格式模型资产。为满足上线合规性要求，阶段 5 必须将其全部替换为 **CC0 / 原创授权资产**。

通过全代码库内容检索，共精确定位到 **34 处** DAE 模型路径引用：
- **`src/core/AssetRegistry.js`**：**31 处**（NPC 7 处、主角外观 3 处、自然植被 6 处、大型建筑 3 处、自由建造家具 12 处）
- **`src/entities/PlayerController.js`**：**1 处**（主角当前采用的模型）
- **`src/island/TimberIsleScene.js`**：**1 处**（浮木岛遇险学者 NPC）
- **`src/main.js`**：**1 处**（主岛海滨观景木屋地标）

### 宏观审计结论速览
1. **全量引用总数**：34 处（去重后实际涉及 17 款不同的 DAE 模型文件）。
2. **纯死引用数（建议直接删除）**：**20 处**。该 20 处引用在游戏运行时无任何代码逻辑加载，或虽在注册表中声明但完全脱节于 UI 与玩法（如未开放 UI 的家具配方、未在场景布设的樱花树/机场/帐篷、早期废弃的人类素体三件套）。直接剔除后，实际需要替换的模型工作量减少近 60%！
3. **半死引用 / 逻辑激活但 3D 未实例化（建议暂缓或轻量替换）**：**2 处**（猎犬贝拉、金羊多姆，在宠物数值逻辑中存在，但场景未加载 3D 网格）。
4. **实际活跃生效引用（必须施工替换）**：**12 处**（涉及 8 款独立模型：主角猫、小猴巴布、少女艾莉、学者雷蒙德、苹果树、椰子树、雪松树、灌木 2 款、木屋）。
5. **第一批核心建议替换**：**主角与伙伴类（共 5 处引用，涉及 2 款基础网格模型）**，即玩家角色、艾莉、小猴巴布、雷蒙德。

---

## 2. 全量引用清单（34 处逐一明细）

下表列出全代码库 34 处引用的精确位置、资产名称、游戏内身份、所属场景及运行时活跃状态：

| 序号 | 代码位置 (文件:行号) | 资产文件名 / 路径 | 游戏内对应物 | 出现场景 | 运行时状态判断 |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | `src/entities/PlayerController.js:312` | `NpcNmlCat23.dae` | 玩家角色主角 (Player) | 全场景常驻 (主岛/外岛/神殿) | **高频活跃核心**：绑定骨骼驱动走跑跳与武器挥舞动画 |
| 2 | `src/island/TimberIsleScene.js:214` | `NpcNmlCat23.dae` | 遇险学者·雷蒙德 (Raymond) | 浮木岛 (Timber Isle) | **活跃**：在沉船避风侧 (-5.5, 0.5, -2.2) 等待救援 |
| 3 | `src/main.js:262` | `FtrMjkHouse.dae` | 海滨观景木屋 (Cozy House) | 主岛东北高台 (25, 1.8, -19) | **高频活跃**：`initLandmarks()` 硬编码加载，带碰撞体积 |
| 4 | `src/core/AssetRegistry.js:11` | `NpcNmlSqu00.dae` | 荒岛灵猴伙伴·巴布 (Bub) | 主岛营地 / 随行出战 | **高频活跃核心**：`VillagerManager:141` 初始加载，宠物系统默认跟随 |
| 5 | `src/core/AssetRegistry.js:25` | `NpcNmlCat23.dae` | 幸存少女·艾莉 (Ellie) | 主岛营地木屋旁 | **高频活跃核心**：`VillagerManager:142` 加载，具备完整昼夜作息日程 |
| 6 | `src/core/AssetRegistry.js:38` | `NpcSpSza.dae` | 忠诚猎犬·贝拉 (Bella) | 无场景 3D 实例 | **半死引用**：`PetCompanionSystem:34` 有数值/特权，但未生成 3D 实体 |
| 7 | `src/core/AssetRegistry.js:52` | `NpcSpRco.dae` | 后勤总管·诺克 (Nook) | 无 | **纯死引用**：全代码库无任何调用与实例化逻辑，可直接删除 |
| 8 | `src/core/AssetRegistry.js:66` | `NpcNmlCat23.dae` | 探险学者·雷蒙德 (Raymond) | 主岛营地 (救援后入驻) | **活跃**：救助后入驻主岛营地，绑定工匠作息与木工动画 |
| 9 | `src/core/AssetRegistry.js:79` | `NpcNmlSqu00.dae` | 侦察游侠·马歇尔 (Marshal) | 无 | **纯死引用**：全代码库无任何调用与实例化逻辑，可直接删除 |
| 10 | `src/core/AssetRegistry.js:92` | `NpcNmlShp00.dae` | 暖绒金羊·多姆 (Dom) | 无场景 3D 实例 | **半死引用**：`PetCompanionSystem:68` 有驮袋数值，但未生成 3D 实体 |
| 11 | `src/core/AssetRegistry.js:104` | `PlayerBody.dae` | 玩家人类素体 (旧版设定) | 无 | **纯死引用**：主角实际由 `PlayerController` 加载猫咪，此项从未被使用 |
| 12 | `src/core/AssetRegistry.js:105` | `PlayerHair00.dae` | 玩家头发 (旧版设定) | 无 | **纯死引用**：全代码库无任何调用，可直接删除 |
| 13 | `src/core/AssetRegistry.js:106` | `PlayerBottomsPantsNormal.dae` | 玩家裤子 (旧版设定) | 无 | **纯死引用**：全代码库无任何调用，可直接删除 |
| 14 | `src/core/AssetRegistry.js:116` | `PltTreeOak4Sakura.dae` | 盛开的樱花树 | 无 | **纯死引用**：`TreeInteraction:30-102` 未排布樱花树坐标，场景无实例 |
| 15 | `src/core/AssetRegistry.js:125` | `PltTreeOak4.dae` | 苹果阔叶树 (Apple Tree) | 主岛营地、西北果林等 (11株) | **高频活跃核心**：主岛环境骨干，挂接苹果果实、晃动与采摘 |
| 16 | `src/core/AssetRegistry.js:134` | `PltTreePalm4.dae` | 海滩椰子树 (Palm Tree) | 主岛海岸浅滩 (8株) | **高频活跃核心**：主岛沙滩风貌骨干，挂接椰子与摇果互动 |
| 17 | `src/core/AssetRegistry.js:143` | `PltTreeCedar4.dae` | 针叶雪松树 (Cedar Tree) | 主岛东北高台天际线 (7株) | **高频活跃**：悬崖天际线背景骨干，提供掉落枝桠与远景层次 |
| 18 | `src/core/AssetRegistry.js:152` | `PltBushAzalea4.dae` | 杜鹃花灌木 (Azalea Bush) | 主岛步道、花境等 (5处) | **高频活跃**：地表植被中景层点缀 |
| 19 | `src/core/AssetRegistry.js:159` | `PltBushCamellia4.dae` | 山茶花灌木 (Camellia Bush) | 主岛营地生活区等 (4处) | **高频活跃**：地表植被中景层点缀 |
| 20 | `src/core/AssetRegistry.js:169` | `StrcCampsiteTentA00.dae` | 露营地大帐篷 (旧版设定) | 无 | **纯死引用**：营地帐篷实际加载 Kenney `tent-canvas.glb` (`OpeningAssets:36`) |
| 21 | `src/core/AssetRegistry.js:175` | `StrcAirPortA00.dae` | 海岛水上机场 | 无 | **纯死引用**：全代码库无任何机场加载或玩法逻辑，可直接删除 |
| 22 | `src/core/AssetRegistry.js:181` | `FtrMjkHouse.dae` | 山顶观景木屋 (注册表项) | (主岛东北高台) | **注册表死引用**：结构项本身未被读取（`main.js:262` 直接硬编码加载该模型） |
| 23 | `src/core/AssetRegistry.js:193` | `FtrWoodBench.dae` | 坚固储物木箱 (借用长椅) | 无 | **纯死引用**：`BuildSystem` 无 UI 建造入口；开局木箱用 Kenney `crate.glb` |
| 24 | `src/core/AssetRegistry.js:203` | `FtrCampfire.dae` | 耐火锻造熔炉 (借用营火) | 无 | **纯死引用**：`BuildSystem` 无 UI 建造入口，场景无实例 |
| 25 | `src/core/AssetRegistry.js:213` | `FtrDrinkingfountain.dae` | 自然净水滴滤台 (借用喷泉) | 无 | **纯死引用**：主岛原生净水台已用 Three.js 程序化几何体构建 |
| 26 | `src/core/AssetRegistry.js:223` | `FtrWoodBench.dae` | 避风原木单人床 (借用长椅) | 无 | **纯死引用**：`BuildSystem` 无 UI 入口；开局睡袋用 Kenney `bedroll.glb` |
| 27 | `src/core/AssetRegistry.js:233` | `FtrWoodBench.dae` | 原木长椅 | 无 | **纯死引用**：`BuildSystem` 无 UI 建造入口，场景无实例 |
| 28 | `src/core/AssetRegistry.js:242` | `FtrIrongardenBench.dae` | 铁花园长椅 | 无 | **纯死引用**：`BuildSystem` 无 UI 建造入口，场景无实例 |
| 29 | `src/core/AssetRegistry.js:251` | `FtrIronwoodTableL.dae` | 铁木大长桌 | 无 | **纯死引用**：`BuildSystem` 无 UI 建造入口，场景无实例 |
| 30 | `src/core/AssetRegistry.js:260` | `FtrCampfire.dae` | 露天篝火 | 无 | **纯死引用**：主岛营地篝火由 `main.js:245` Three.js 几何体程序化生成 |
| 31 | `src/core/AssetRegistry.js:269` | `FtrStreetlamp.dae` | 欧式复古路灯 | 无 | **纯死引用**：`BuildSystem` 无 UI 建造入口，场景无实例 |
| 32 | `src/core/AssetRegistry.js:278` | `FtrSakuraPicnicset.dae` | 樱花野餐垫组合 | 无 | **纯死引用**：`BuildSystem` 无 UI 建造入口，场景无实例 |
| 33 | `src/core/AssetRegistry.js:287` | `FtrPicnicbasket.dae` | 藤编野餐篮 | 无 | **纯死引用**：`BuildSystem` 无 UI 建造入口，场景无实例 |
| 34 | `src/core/AssetRegistry.js:296` | `FtrDrinkingfountain.dae` | 直饮水喷水台 | 无 | **纯死引用**：`BuildSystem` 无 UI 建造入口，场景无实例 |

---

## 3. 优先级分组与替换批次实施建议

按视觉核心度、玩家交互频次以及系统强依赖性，将 34 处引用划分为 4 个施工批次：

```
[批次 1: P0 主角与核心伙伴] ──> [批次 2: P1 主岛高频植被与地标] ──> [批次 3: P2 低频/扩展伙伴] ──> [批次 4: 死引用直接修剪]
   (5处引用 / 2款模型)              (7处引用 / 6款模型)             (2处引用 / 2款模型)              (20处引用 / 直接删)
```

### 批次 1 (Priority 0)：主角与核心伙伴（最关键、最高频）
- **涵盖引用**：
  1. `src/entities/PlayerController.js:312` (`NpcNmlCat23.dae` - 主角猫咪)
  2. `src/core/AssetRegistry.js:25` (`NpcNmlCat23.dae` - 少女艾莉)
  3. `src/core/AssetRegistry.js:11` (`NpcNmlSqu00.dae` - 小猴巴布)
  4. `src/core/AssetRegistry.js:66` (`NpcNmlCat23.dae` - 学者雷蒙德主岛入驻)
  5. `src/island/TimberIsleScene.js:214` (`NpcNmlCat23.dae` - 学者雷蒙德外岛救援)
- **施工关注点**：
  - **骨骼与动作机制依赖**：`PlayerController.js:321-355` 和 `VillagerManager.js:235-263` 代码中显式依赖了骨骼节点命名（如 `Leg_1_L/R`, `Leg_2_L/R`, `Arm_1_L/R`, `Arm_2_L/R`, `Head`）。
  - **替换策略建议**：
    - 方案 A（低多边形动物拟人风）：选用 Kenney Animal Pack (Cat, Monkey, Chimp)，调整骨骼绑定映射即可无缝继承当前程序化跑跳与攻击动画。
    - 方案 B（低多边形人类幸存者风）：选用 KayKit Adventurers / Survivors (带自带 glTF 动画)，同步将 `PlayerController` 改为播放 glTF 自带 AnimationClip。

### 批次 2 (Priority 1)：主岛高频可见自然植被与核心地标
- **涵盖引用**：
  1. `src/core/AssetRegistry.js:125` (`PltTreeOak4.dae` - 苹果阔叶树，全岛 11 株)
  2. `src/core/AssetRegistry.js:134` (`PltTreePalm4.dae` - 海滩椰子树，全岛 8 株)
  3. `src/core/AssetRegistry.js:143` (`PltTreeCedar4.dae` - 针叶雪松树，高台 7 株)
  4. `src/core/AssetRegistry.js:152` (`PltBushAzalea4.dae` - 杜鹃花灌木，全岛 5 处)
  5. `src/core/AssetRegistry.js:159` (`PltBushCamellia4.dae` - 山茶花灌木，全岛 4 处)
  6. `src/main.js:262` (`FtrMjkHouse.dae` - 山顶观景海滨木屋)
  7. `src/core/AssetRegistry.js:181` (`FtrMjkHouse.dae` - 木屋注册表项同步更新)
- **施工关注点**：
  - 树木模型需兼容 `TreeInteraction.js:138-175` 的挂果逻辑（苹果树在树冠挂载程序化苹果，椰子树在树干分叉挂载椰子）。替换时需要注意树冠与树干尺寸比例，避免果实半空悬空。
  - 木屋需保持 `movementBox` 碰撞体匹配。

### 批次 3 (Priority 2)：低频 / 未激活外岛宠物
- **涵盖引用**：
  1. `src/core/AssetRegistry.js:38` (`NpcSpSza.dae` - 探险猎犬·贝拉)
  2. `src/core/AssetRegistry.js:92` (`NpcNmlShp00.dae` - 暖绒金羊·多姆)
- **施工关注点**：
  - 当前两款宠物仅在 `PetCompanionSystem` 中提供被动数值特权，场景内尚未实际生成其 3D 实体。若在后续版本中激活其随行 3D 实体，可顺道替换为 CC0 狗/羊模型；若保持现状，仅需在注册表中改为 CC0 模型路径或占位。

### 批次 4 (Direct Pruning)：纯死引用直接修剪（零替换成本）
- **涵盖引用（20 处）**：
  - 详见第 5 节。可直接在 `AssetRegistry.js` 中整段剔除，不仅零成本消除版权风险，还能减少无用加载项与内存占用。

---

## 4. CC0 候选来源方向对应表

针对上述所有需要保留并替换的资产类别，整理推荐的知名公开 CC0 资产库（如 **Kenney**、**KayKit**、**Quaternius**），只列出对应包名与素材类别，**严禁下载、严禁引入非授权素材**：

| 游戏资产分类 | 现存 DAE 原型 | 推荐 CC0 资源库 | 对应类别 / Pack 建议 | 特性与契合度说明 |
| :--- | :--- | :--- | :--- | :--- |
| **主角 (Player)** | `NpcNmlCat23.dae` | **KayKit** 或 **Kenney** | • **KayKit - Adventurers Character Pack**<br>• **Kenney - Animated Characters 1 / 2**<br>• **Kenney - Animal Pack** (Cat/Beaver) | 若保持动物拟人，选用 Kenney Animal Pack；若转为海难幸存人类，KayKit Adventurers 具有极为契合的低模荒岛探险质感 |
| **伙伴：艾莉 (Ellie)** | `NpcNmlCat23.dae` | **KayKit** 或 **Kenney** | • **KayKit - Character Pack (Female Adventurer)**<br>• **Kenney - Animated Characters** | 与主角保持同风格统一；若主角为动物则选对应友善动物低模 |
| **伙伴：小猴 (Bub)** | `NpcNmlSqu00.dae` | **Kenney** 或 **Quaternius** | • **Kenney - Animal Pack** (Chimp/Monkey)<br>• **Quaternius - Cute Lowpoly Animals** (Monkey) | 天然契合灵猴设定，替代借用松鼠模型的尴尬 |
| **伙伴：雷蒙德 (Raymond)** | `NpcNmlCat23.dae` | **KayKit** 或 **Kenney** | • **KayKit - Adventurers** (Scholar/Wizard/Engineer)<br>• **Kenney - Animal Pack** (Cat) | 契合外岛学者、工匠身份 |
| **宠物：猎犬贝拉 (Bella)** | `NpcSpSza.dae` | **Kenney** 或 **Quaternius** | • **Kenney - Animal Pack** (Dog)<br>• **Quaternius - Lowpoly Pets** (Dog) | 纯正探险猎犬形象，彻底替代西施惠 |
| **宠物：金羊多姆 (Dom)** | `NpcNmlShp00.dae` | **Kenney** 或 **Quaternius** | • **Kenney - Animal Pack** (Sheep)<br>• **Quaternius - Lowpoly Animals** (Ram/Sheep) | 契合金羊驮载与卷角羊形象，替代茶茶丸 |
| **阔叶苹果树 (Apple Tree)** | `PltTreeOak4.dae` | **Kenney** | • **Kenney - Nature Kit** (`tree_oak.glb` / `tree_forest.glb`)<br>• **KayKit - Forest Pack** | 圆润圆顶树冠，适合 `TreeInteraction` 挂苹果 |
| **海滩椰子树 (Palm Tree)** | `PltTreePalm4.dae` | **Kenney** | • **Kenney - Pirate Kit** (`palm-detailed-bend.glb` / `palm-straight.glb`)<br>• **Kenney - Nature Kit** (`tree_palm.glb`) | 项目已有 Pirate Kit 部分资产，同系列风格极为协调 |
| **针叶雪松树 (Cedar Tree)** | `PltTreeCedar4.dae` | **Kenney** | • **Kenney - Nature Kit** (`tree_pine_tall.glb` / `tree_conifer.glb`) | 挺拔尖顶雪松，非常适宜东北悬崖天际线 |
| **花境灌木 (Bushes)** | `PltBushAzalea4.dae`<br>`PltBushCamellia4.dae` | **Kenney** | • **Kenney - Nature Kit** (`bush.glb`, `plant_bush_flowers.glb`, `hedge.glb`) | 多边形低模灌木簇，支持多彩着色与微风摆荡 |
| **海滨木屋地标 (Cozy House)**| `FtrMjkHouse.dae` | **Kenney** 或 **KayKit** | • **Kenney - Pirate Kit / Medieval Kit** (`building-cabin.glb`, `cottage.glb`)<br>• **Kenney - Survival Kit** (`cabin.glb`, `shack.glb`) | 纯木质海边避风木屋，契合海难避难所调性 |

---

## 5. 死引用清单与直接清理建议（20 处）

下列 20 处引用在游戏运行态中**完全找不到有效对应物或触发入口**，属于早期残留或未连接到 UI 的废弃定义。在阶段 5 施工时，**建议直接从代码中移除，无需寻找或替换任何素材**：

### 5.1 纯死 NPC 与废弃角色部件（5 处）
1. `src/core/AssetRegistry.js:47-60` (`npcs.tom_nook`)：后勤总管诺克，代码库无任何地方引用此 ID。
2. `src/core/AssetRegistry.js:74-86` (`npcs.marshal`)：侦察游侠马歇尔，代码库无任何地方引用此 ID。
3. `src/core/AssetRegistry.js:104` (`player.body`)：人类身体素体模型，主角由 `PlayerController` 实际加载猫咪，从未被调用。
4. `src/core/AssetRegistry.js:105` (`player.hair`)：人类发型，从未被调用。
5. `src/core/AssetRegistry.js:106` (`player.pants`)：人类裤子，从未被调用。

### 5.2 未排布植被与废弃建筑（3 处）
6. `src/core/AssetRegistry.js:112-120` (`plants.cherry_blossom`)：樱花树，`TreeInteraction.js` 中没有该植物位置坐标，全图无实例。
7. `src/core/AssetRegistry.js:166-171` (`structures.campsite_tent`)：露营帐篷，主岛实际营地帐篷早已使用 Kenney `tent-canvas.glb` (`OpeningAssets.js:36`)。
8. `src/core/AssetRegistry.js:172-177` (`structures.airport`)：水上机场，游戏内无此地标与系统。

### 5.3 无 UI 入口的自由建造家具冗余注册项（12 处）
在 `src/core/AssetRegistry.js:187-300` 中定义的 12 款家具（`storage_box`, `furnace`, `water_purifier`, `camp_bed`, `wood_bench`, `irongarden_bench`, `ironwood_table`, `campfire`, `streetlamp`, `sakura_picnic`, `picnic_basket`, `drinking_fountain`）：
- 现状判定：虽然 `src/systems/BuildSystem.js` 内部具备这些字段的数据结构，但 `src/ui/UIManager.js` **没有任何 UI 入口可以调用 `selectFurniture` 触发建造**（在 `docs/G3-RESOURCE-AUDIT.md:118` 中已被定性为断裂点）；
- 原生替代：开局储物箱与睡袋在 `OpeningAssets.js` 中已由 Kenney glb 替代；原生净水台与篝火在 `CampInteractiveEntities.js` 与 `main.js:245` 中已由程序化几何体构建；
- 处置建议：**将这 12 处废弃家具注册项直接从 `AssetRegistry.js` 移除**，若未来需要开放建造功能，直接用 Kenney 的 GLB 配方配置，无需引入任何 DAE 资产。

---

## 6. 施工落地技术考量（Phase 5 预警）

1. **骨骼关节名称对齐（最关键陷阱）**：
   - 现行代码 `PlayerController.js:329-339` 与 `VillagerManager.js:245-259` 严格检测了 `Leg_1_L`, `Leg_1_R`, `Arm_1_L`, `Arm_1_R`, `Head` 等名称。
   - 若阶段 5 引入的 CC0 模型（如 glTF/glb）骨骼命名为通用 Mixamo 格式（`mixamorig:LeftUpLeg`, `mixamorig:LeftArm`）或 Blender 默认格式（`upper_arm.L`），必须在加载适配层做骨骼重命名映射，或改为播放 glTF 官方自带的 AnimationClip，否则角色将失去程序化摆动效果呈 T-Pose。
2. **GLTFLoader 统一替换 ColladaLoader**：
   - 当前项目已在 `OpeningAssets.js` 中成功应用 `GLTFLoader`。替换为 CC0 glb/gltf 后，可彻底移除旧版 DAE / Collada 复杂的材质解析与贴图路径兼容 hack，精简 `ModelLoader.js` 代码。
3. **PBR 材质一致性**：
   - Kenney 和 KayKit 资产均带有内嵌调色板材质，光照受 Three.js 标准 `MeshStandardMaterial` 驱动，需确保加载时不被 `ModelLoader.js` 强制覆写粗糙度与金属度。
