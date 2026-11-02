# 主线围绕挖矿推进 — 研究结论与重排方案（2026-11-02）

用户命题：主线要围绕挖矿逐步推进。外部研究全文：~/workspace/research_notes/mining-mainline-progression-20261102-0958/report.md（8 组游戏：Motherload、SteamWorld Dig 1/2、Terraria、Core Keeper、Dome Keeper、Forager、Dave the Diver、Deep Town）。

## 研究给出的硬规律（有出处）
1. **章节门用「挖矿交付物」过，不用钱包余额、不用单纯打怪**：Terraria/Core Keeper 的通用循环就是 探索→升级工具→过门→新区域；门 consume 的是上一梯的加工产物（第一根精炼锭交付 = 过章凭据）。
2. **三梯互锁**：矿石梯 N 需要工具梯 N-1，工具梯 N 用矿石梯 N 造，中间隔一道加工梯（熔炼/精炼/工作台链本身即是门，Core Keeper 最典型）。
3. **每章一个新动词，不是新数字**：Dig 的钻头（引水挖）、Terraria 的钩爪/翅膀、Core Keeper Scarlet 的传送带产线、Dave 的活捉网→养殖场。纯数字梯是反面教材（Super Motherload 被 IGN 评「单调、一个把戏」，价格 ×5/梯而玩法不变）。
4. **解锁节奏**：前期每 10–20 分钟一个有意义的解锁，中期每 45–75 分钟一个新系统，单次出征 ≤15–20 分钟。Dig 1/Dave 被夸的都是这个密度；Dave 中段潜水拉长到 30–60 分钟后餐厅循环塌方（loop-frequency collapse）。
5. **双货币不可兑换**：现金只买数字，挣来的代币买动词（新玩法）；绝不让有限货币同时花在消耗品上（Dig 1 的 orb 坑：传送器和顶级升级共用有限 orb，能锁死完成度）。
6. **后期配方继续吃早期矿石**：否则旧区旧料全部作废（Terraria/Forager 的解法）；自动化只接管「已精通的梯」，且收决策成本不只收资源（Core Keeper 巨石矿 AFK 4–17 小时产 1800 锭「够用到通关」是自玩反例）。
7. **经济崩坏点要先模拟**：Forager 约 10 小时市场卖价过高→什么都能买→探索动机蒸发。我们有 G3 门和 sim-economy，正好拿来压测每章的卖价与门价。
8. **终局汇要第一章就埋、第六章才揭**：可见的大工程（灯塔/母晶工程）从早期就立在岛上当背景目标；第二据点（Dave 分店模式）是被验证的经营汇；Dome Keeper Prestige 把囤积的修理料变计分资源，是「存量变汇」的巧解。
9. **每章结尾让下一章「看得见、过不去」**：邻岛的灯、雾里的矿脉光、锁着的神殿门——可见的门比任务列表更拉人。

---

## 现状盘点与现状映射（代码实查 2026-11-02）

### 1. 现有章节 Steps 与完成条件实查

| 章节 | Step ID | 当前类型 | 当前触发 / 完成条件 | 现状缺陷 / 与方案对差 |
|---|---|---|---|---|
| **序章 (0)** | `collect_driftwood` | action | `onGatherResource('tree_branch' \| 'driftwood')` | 仅捡树枝，未突出第一块晶石 |
| | `find_food_water` | action | `onConsumeFood` 或 `onDrinkWater` | 纯生存行为，与矿机无联系 |
| | `find_campsite` | position | `distanceXZ(playerPos, ISLAND_LAYOUT.tent) < 5.0` | 仅到达帐篷，未锚定矿机雏形点火 |
| **第一章 (1)** | `craft_kindling` | action | `onCraftItem('kindling')` | 纯木工工具 |
| | `cook_hot_food` | action | `onCookFood()` | 纯篝火烹饪 |
| | `craft_axe` | action | `onCraftItem('stone_axe')` | 石斧作为过章门，未考核挖矿产出；灯塔无场景实体 |
| **第二章 (2)** | `chase_monkey` | position | 到达坐标 `(10, -10)` 6米内 | 追逐小猴 |
| | `befriend_monkey` | state | `this.monkeyBefriended === true` | 喂食收服即过章；未考核共振与扫描仪；小猴可无限制钻缝挖晶石（自动化自玩漏洞） |
| **第三章 (3)** | `fix_radio` | action | `onCraftItem('workradio')`（电池+破收音机） | 收音机使用电池合成，跳过精炼；精炼炉与纯晶入口此前按 D4 隐藏 |
| | `radio_contact` | state | `this.radioBroadcasted === true` | 南岸 SOS 发报即过章；未考核矿机升级 L2，未考核纯晶交付 |
| **第四章 (4)** | `build_raft` | state | `this.raftBuilt === true` (木材+钉子+藤蔓) | 造船未强制要求精炼材料；造船台未设章节锁 |
| | `rescue_partner` | state | `this.secondKidAwake === true` | 救醒艾莉即过章；矿机 L3 虽需 80 代币但无图纸章节门，邻岛无限定晶种 |
| **第五章 (5)** | `care_partner` | state | `this.secondKidAffection >= 100` | 好感度数值刷取，脱离挖矿主线 |
| | `collect_gems` | state | `this.gemsCollected.size >= 3` | 神殿 3 宝石收集；无灯塔终局汇大工程，无多梯资源汇聚消纳 |
| **第六章 (6)** | `mainline_complete`| state | `this.currentChapterId === 6` | 无尽漫游经营，缺乏中长线矿石消化与每日订单合同板 |

### 2. 涉及的关键系统开关与现状对差

1. **精炼厂开关 (`CampFacilitiesSystem.refineryLevel`)**：
   - 现状：代码中有 `buildRefinery()`，夜间结算支持 2原石+1树脂→1高纯度纯晶（`sol_crystal_pure`）。但在 R10b 阶段隐藏了 UI 入口，全流程游离于主线之外。
   - 目标：第三章正式解锁精炼 UI 与建造升级，第一块纯晶交付作为章节门。
2. **扫描仪合成开关 (`CraftingBlueprints.js: geo_scanner_mk1/2/3`)**：
   - 现状：蓝图库中定义了 Mk1 (孔雀铜+电池)，但无章节锁，开局若有材料可随意合成，导致主线节奏跳跃。
   - 目标：第二章解锁 Mk1 合成；第二章以前禁止合成；Mk1 造出并完成首次共振作为章节门。
3. **矿机等级图纸章节锁 (`MiningRigSystem.upgradeRig`)**：
   - 现状：仅依据代币余额购买（L2 30、L3 80、L4 200 代币），无任何主线进度或图纸解锁前置约束。
   - 目标：L2 锁定至第三章；L3 锁定至第四章救回雷蒙德解锁图纸；L4 锁定至第五章灯塔一期。
4. **出海船体材料与章节锁 (`ShipUpgradeSystem`)**：
   - 现状：造船台与随船升级在浅滩常驻，无章节锁。
   - 目标：第四章前锁定高阶船体改装；第四章造船与航行要求精炼材料（或已有价格表加章节锁）。
5. **灯塔实体与大工程状态 (`LighthouseEntity`)**：
   - 现状：场景中仅有北崖地形，无灯塔实体与交互工程台。
   - 目标：第一章起在北崖高台可见灯塔遗迹基座与未点亮塔身；第五章开放一期工程交付台，交付后视觉切换为点亮运转。
6. **小猴 Bub 帮工行为集 (`MonkeyHelperSystem`)**：
   - 现状：小猴入队后可直接执行 `commandExploreCrevice` 钻缝挖矿（概率掉落原石 `sol_crystal`、铁矿），存在初期自动化自玩漏洞。
   - 目标：对小猴动作施加章节鉴权：第二章收服初期仅允许果树攀爬采摘，深石缝开采在勘探系统精通后解锁。

---

## 主线重排方案：六章章节门与步级细化

### 核心设计原则
1. **叙事皮不变**：保留章节标题、副标题与既有剧情步叙事框架，老玩家与叙事体验无缝过渡。
2. **章节门 = 挖矿交付物事件**：章节跃升必须验证挖矿生产与提纯交付物，一律读只读系统状态或 `EconomyLedger`，绝不基于钱包余额或杀怪计数。
3. **节奏密度**：每章内埋入 2–3 个小解锁，前期控制在 10–20 分钟一个里程碑。

| 章节 | 叙事皮 | 章节门（过章凭据） | 本章新动词 | 本章小解锁（10-20分钟节奏） | 系统互锁 |
|---|---|---|---|---|---|
| **序章：海难漂流** | 南岸沙滩余生 | 拾得第一块晶石 + 拼出矿机雏形并点火检视 | 采集拾取 / 矿机交互 | 1. 随身引火点火<br>2. 营地矿机雏形基座 | 初始硅晶喂入矿机雏形（`initial_silo`） |
| **第一章：钻木取火与工匠雏形** | 建立荒岛大本营 | 矿机首次出块（`totalBlocksMined >= 1`） + 累计挖矿产出达标（`totalSolMined >= 6`） | 算力运算 / 出块收取 | 1. 锋利石斧蓝图（伐木）<br>2. 矿机通电出块<br>3. 北崖灯塔遗迹远景可见 | 算力代币产出，代币买基础生存升级件 |
| **第二章：丛林猴影 (Bub)** | 失而复得的同伴 | 扫描仪 Mk1 造出 + 首次共振勘探结算（残晶凝聚计入） | 地脉行波扫描 / 押频共振 | 1. Bub 树冠采摘（高枝鸟蛋/果实）<br>2. 地质扫描仪 Mk1 研制<br>3. 矿机共振勘探面板 | 扫描仪吃代币+孔雀铜矿；Bub 动作加章节锁防自玩 |
| **第三章：无线通讯与邻岛求救** | 收音机求救 · 浮木岛的呼号 | 第一块高纯度纯晶经精炼产出并交付 + 矿机升至 L2 | 高温提纯精炼（原石→纯晶） | 1. 古法纯晶精炼炉建造与投料<br>2. 矿机 L2 升级许可<br>3. 精炼纯晶改装工作收音机 | 精炼厂入口解封；收音机核心配方改为精炼纯晶件 |
| **第四章：筹备远航与出海营救** | 乘风破浪 · 搜救同伴与浮木岛开拓 | 出航到达浮木岛救回雷蒙德 → 解锁矿机 L3 图纸 + 深层矿脉新晶种探明 | 出海远航 / 海外第二据点开拓 | 1. T2龙骨风帆艇适航许可<br>2. 探险学者雷蒙德入队<br>3. 深层矿脉（深海新晶种）开采 | 船体建造需精炼件；L3 图纸需救人后解锁；邻岛产出限定新晶种 |
| **第五章：扩大生产与海岛家园** | 营地扩建与群岛前哨 | 灯塔大工程一期点亮（多梯汇交付：原石+纯晶+新晶种） + 矿机升至 L4 | 终局大工程调度 / 多梯资源汇聚 | 1. 灯塔工程台交互<br>2. 灯塔旋转探照光束点亮<br>3. 矿机 L4 终极算力图纸解锁 | 灯塔工程消耗全部三梯晶石，走账本 `lighthouse` 汇聚 |
| **第六章：自由经营** | 主线完成，建设海岛家园 | 自由漫游无尽经营 | 每日订单合同履约 | 1. 营地每日订单板（3个日常交付合同）<br>2. 无尽群岛探索经营 | 存量晶石与材料在订单板重新定价，走账本 `order_deliver` |

---

## 数值推导与经济压测

### 1. 第一章累计挖矿产出阈值推导（基于 tools/sim-economy.mjs）
- `sim-economy.mjs` 中标准中性玩家（Neutral Player）的数据：
  - **Day 1 实际产出**：
    - `sol_crystal inflow/initial_silo`: 1
    - `sol_crystal inflow/vein_mine`: 12
    - `sol_crystal outflow/decrypt_consume`: 4（解密 4 块原石出块）
    - `sol_token inflow/decrypt`: 10 代币（单次出块期望 2.35 枚，暴击 + 超频）
    - `sol_token transfers/claim_payout`: 10 代币
  - **Day 2 实际产出**：
    - 累计解密原石：8 块
    - 累计解密代币：19 代币
- **主线门槛推导结论**：
  - 第一章门槛要求玩家完成矿机完整闭环：装填原石 → 算力解密出块 → 收取代币。
  - 首次出块门槛：`totalBlocksMined >= 1`（验证玩家掌握出块）。
  - 累计挖矿产出达标：设定为 `totalSolMined >= 6`（或出块数 `>= 2`）。
  - **推导依据**：Day 1 解密 4 块得 10 代币，6 代币对应约 2–3 次出块，约耗时 8–15 分钟游戏时间，恰好落入前期 10–20 分钟过门节奏区间，无卡点且杜绝未开采即跳章。

### 2. 第五章灯塔一期交付清单设计
- 目标：终局汇必须同时消耗早期原石、中期精炼纯晶与远航新晶种，打通三梯互锁。
- 交付清单：
  - `sol_crystal`（原石）：10 块
  - `sol_crystal_pure`（纯晶）：3 块（消耗 6 原石 + 3 树脂）
  - `sol_crystal_deep`（深层新晶种）：2 块（浮木岛探索获取）
- 账本流向：原石消耗走 `economyLedger.debit('sol_crystal', 10, 'lighthouse')`，纯晶与新晶种扣减行囊。
- G3 门核算：Day 7 钱包代币 44（门 [42, 52]）、Day 30 钱包代币 283（门 [260, 320]），灯塔交付不直接消耗代币，不破坏既有代币存量平衡。

### 3. 第六章订单板（Order Board）数值与账本设计
- 每日生成 3 张交付合同，合同池取自既有非代币资源：
  - 合同 A（初级采集）：如 `apple x3` 或 `stone_chunk x4` → 奖励 `sol_token x2`
  - 合同 B（加工构件）：如 `wood_plank x2` 或 `iron_ingot x1` → 奖励 `sol_token x3` + `ancient_coin x1`
  - 合同 C（高阶矿产）：如 `sol_crystal x2` 或 `sol_crystal_pure x1` → 奖励 `sol_token x4`
- 账本记录：代币奖励调用 `economyLedger.credit('sol_token', n, 'order_deliver')`。
- 翻译与测试：`LEDGER_LABELS.order_deliver = '订单交付'`，A1 总账测试与 G3 门全面兼容。

---

## 存档兼容性契约 (S1 兼容)
- 保持 `StorySystem.serialize()` 结构向后兼容，保留原有布尔标志位与章/步索引（`currentChapterId`, `currentStepIndex`）。
- 既有存档读取时，按 `currentChapterId` 对齐，若老存档已有对应章节进度，平滑载入，不丢档。
- 新增字段（如 `lighthouseLit`、`deepVeinDiscovered` 等）均赋予幂等安全的默认初始值。
