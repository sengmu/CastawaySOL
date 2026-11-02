# M3 前置：final_escape 转绿缺口定位与架构分析报告

> **报告属性**：只读静态分析 + 真实黄金路径运行验证报告  
> **验证环境**：Node.js `v22.23.4` (`~/.nvm/versions/node/v22.23.4/bin/node`) + Chromium Headless  
> **对应基线**：Commit `9d3bc1b` 及其工作树现状  
> **报告目标**：精准定位 `tools/verify-golden-path.mjs` 中唯一已知红灯 `final_escape` 的根因、盘点结局与雷蒙德线现状，并给出 M3 施工清单与并行文件隔离建议。

---

## 1. 精确失败点：黄金路径实测复现与 report.json 证据

### 1.1 黄金路径执行结果
使用指定的 Node 二进制运行测试：
```bash
~/.nvm/versions/node/v22.23.4/bin/node tools/verify-golden-path.mjs
```
实际运行控制台输出：
```text
[golden] 0/collect_driftwood
[golden] 0/find_food_water
[golden] 0/find_campsite
[golden] 1/craft_kindling
[golden] 1/cook_hot_food
[golden] 1/craft_axe
[golden] 2/chase_monkey
[golden] 2/befriend_monkey
[golden] 3/fix_radio
[golden] 3/radio_contact
[golden] 4/build_raft
[golden] 4/rescue_partner
[golden] 5/care_partner
[golden] 5/collect_gems
[golden] 6/final_escape
[golden] passed_except_known_red
```
脚本执行耗时约 75 秒，退出码为 `0`（因为 `final_escape` 被配置在 `knownRed` 列表中并执行了提前 `break`）。

### 1.2 `report.json` 与 `chapter-5.json` 现场证据
在 `docs/qa/golden-path/report.json` 中：
- `started`: `"2026-11-02T00:30:53.989Z"`
- `status`: `"passed_except_known_red"`
- `knownRed`: `["final_escape"]`
- `checkpoints`: `[0, 1, 2, 3, 4, 5]`
- 步骤记录的最后一步（第 13 步，行 216-233）：
```json
{
  "chapter": 5,
  "step": "collect_gems",
  "inventory": {
    "apple": 0,
    "stone_chunk": 1,
    "broken_radio": 0,
    "battery": 0,
    "nail": 1,
    "coconut": 11,
    "baked_apple": 0,
    "stone_axe": 1,
    "workradio": 1
  },
  "action": "visited gem pickup locations",
  "next": "final_escape"
}
```

在保存第 5 章通过、进入第 6 章的存档快照 `docs/qa/golden-path/chapter-5.json`（行 194-218）中，当时的 `StorySystem` 状态为：
```json
"story": {
  "currentChapterId": 6,
  "currentStepIndex": 0,
  "hasGatheredBranch": true,
  "hasConsumedFoodOrWater": true,
  "hasReachedCampsite": true,
  "hasCraftedKindling": true,
  "hasCookedFood": true,
  "hasCraftedAxe": true,
  "monkeyBefriended": true,
  "secondKidFound": false,
  "secondKidAwake": true,
  "secondKidAffection": 105,
  "sosBuilt": true,
  "radioBroadcasted": true,
  "raftBuilt": true,
  "gemsCollected": [
    "star_gem",
    "diamond_gem",
    "moon_gem"
  ],
  "endedEndingId": null,
  "onboardingStep": 4,
  "onboardingDismissed": false
}
```

### 1.3 `final_escape` 受阻机制深度拆解
若移除 `tools/verify-golden-path.mjs:87` 的白名单跳出逻辑：
`if (before.step === 'final_escape') { report.status = 'passed_except_known_red'; break; }`
脚本将立即在第 6 轮抛出异常中断：
`Error: No progress: no verified gameplay route for final_escape`。

深入代码执行流发现，`final_escape` 存在 **4 处环环相扣的致命阻塞**：

1. **测试脚本缺失行动分支**（`tools/verify-golden-path.mjs:164`）：
   `evaluate` 函数内部对步骤 ID 进行了穷举分支（`collect_driftwood` 至 `collect_gems`），但对 `final_escape` 没有定义任何游戏内操作，直接落入行 164：
   `return 'no verified gameplay route for ' + id;`。
2. **场景交互缺失结局触发入口**（`src/main.js:1055-1125` 与 `src/main.js:1001-1052`）：
   - 玩家靠近大木筏（`dockShipEntity`）：只能打开船坞改装弹窗（`shipUpgradeSystem.openShipyardModal()`）或打开海图（`nauticalChart.openChartModal()`），**没有任何触发远航逃生结局（如 ED6/ED8/ED2）的交互逻辑或按钮**。
   - 玩家靠近 SOS 地标（`ISLAND_LAYOUT.sos`）：在无线电修好后，再次交互只会弹出已联系浮木岛的提示对话框，**没有任何呼叫搜救直升机（ED1）的结算入口**。
3. **`StorySystem.update` 存在逻辑死锁悖论**（`src/systems/StorySystem.js:188` vs `256`）：
   - 第六章步骤定义（`src/systems/StorySystem.js:188`）：
     `checkState: () => this.endedEndingId !== null`
   - 然而在帧循环 `update()` 顶部（`src/systems/StorySystem.js:256`）：
     `if (this.endedEndingId || this.isAdvancing) return;`
   - **死锁悖论**：如果 `endedEndingId === null`，`checkState()` 返回 `false`，步骤不推进；如果通过某种方式将 `endedEndingId` 设为 `'ED1'` 等有效结局代码，`update()` 在第 256 行直接 `return`，`checkState()` **永远无法被执行**！
4. **`#advanceStep` 缺乏末章结束保护**（`src/systems/StorySystem.js:350-370`）：
   即使绕过第 256 行，在第 6 章第 0 步（全剧最后一步）调用私有 `#advanceStep()` 时：
   - `this.currentStepIndex < chapter.steps.length - 1` 为 `0 < 0`（false）。
   - `this.currentChapterId < this.chapters.length - 1` 为 `6 < 6`（false，全剧共 7 章：0~6）。
   - `#advanceStep()` 内部没有任何处理最后一章通关的逻辑，既不派发通关事件，也不标记全通状态，`getCurrentStep().id` 依然停留在 `final_escape`，导致测试判定为 `after.step === before.step`（No progress）。

---

## 2. 结局现状盘点

### 2.1 现有实现定位
| 函数/功能入口 | 文件及行号 | 现状说明 |
| :--- | :--- | :--- |
| `StorySystem.triggerEnding(endingId)` | `src/systems/StorySystem.js:420-431` | 仅记录 `this.endedEndingId = endingId` 并调用 UI 层 `triggerEndingScreen`。**未调用 `#advanceStep()`，未设置通关状态**。游戏中任何非测试代码均未调用此方法。 |
| `UIManager.triggerEndingScreen(endingId, data)` | `src/ui/UIManager.js:3230-3358` | 结局展示弹窗。内嵌 `ED1`, `ED2`, `ED6`, `ED8` 的文案/评级/颜色，调用 `solanaBridge.mintEscapeCertificate` 生成本地证书编号。提供三个按钮：复制证书、重新启航（reload）、留岛漫游。 |
| `UIManager.triggerSolanaEscapeEnding(craftId)` | `src/ui/UIManager.js:3360-3369` | **孤儿残留代码**。根据 `craftId` 简单映射为 `ED6` 或 `ED1`，但直接调用 `this.triggerEndingScreen`，完全绕过了 `StorySystem`（不会设置 `story.endedEndingId`）。在当前工程除定义处外**无任何调用点**（原合成 workradio/raft 时的跳关通关后门已在 M1 移除）。 |

### 2.2 远航与呼救两个结局的门槛条件分析
目前代码库中仅在 `tools/verify_story_full_pipeline.mjs:228-264` 中有一套用于单测 mock 的判定预期，在正式业务代码中**门槛判定逻辑完全缺失**（`src/` 生产代码中找不到任何一处根据玩家物资/好感度计算派发结局的地方）：

| 结局分支 | 叙事设计预期（来自 UI 文案与测试） | 生产代码齐备性（`src/`） |
| :--- | :--- | :--- |
| **呼救结局 (ED1)**<br>搜救直升机救援 | • 建造沙滩巨石 SOS（`story.sosBuilt`）<br>• 合成并持有工作收音机（`inventory.workradio` 或 `story.radioBroadcasted`）<br>• 在第 6 章发起直升机联络呼叫 | ❌ **不齐备**。<br>`main.js:1001-1052` 仅有第 3 章的剧情对话，无任何检核上述条件并触发 `story.triggerEnding('ED1')` 的代码。 |
| **远航结局 (ED6/ED8/ED2)**<br>大木筏扬帆出海 | • 建造求生大木筏（`story.raftBuilt`）<br>• **ED8 (SSS真爱)**: 艾莉苏醒且好感度高（≥150）、小猴入队、全收集神石<br>• **ED6 (SS双人)**: 艾莉苏醒且好感普通（≥100）、木筏完好<br>• **ED2 (B悲壮)**: 艾莉未苏醒或物资不足独自起航 | ❌ **不齐备**。<br>`main.js:1055-1125` 靠近木筏只有打开船坞（`shipUpgradeSystem`）或打开海图（`nauticalChart`），完全没有分支裁决器，更没有触发 `story.triggerEnding('ED6'/'ED8'/'ED2')`。 |

### 2.3 结局后 `story.update` 的行为
当 `story.endedEndingId` 被赋值（例如设为 `'ED1'`）后：
1. `src/systems/StorySystem.js:256`：
   `if (this.endedEndingId || this.isAdvancing) return;`
   每帧调用的 `story.update(playerPos, inventory, survival)` 在第 256 行静默阻断，后续所有位置判定与状态更新完全冻结。
2. 顶栏任务指示牌（Objective Banner）持续显示：
   `🚩 [第六章：远古遗迹与终极生还] 乘上坚固大木筏扬帆远航，逃出孤岛！`
   由于没有完成或隐藏机制，目标栏永久卡在逃脱任务。

### 2.4 "继续经营 / 留岛漫游" 是否可行？
在 `src/ui/UIManager.js:3349-3355` 中：
```javascript
const stayBtn = document.getElementById('btn-cert-stay');
if (stayBtn) {
  stayBtn.addEventListener('click', () => {
    this.modalBackdrop.style.display = 'none';
    this.showToast('继续留岛漫游，享受无拘无束的海岛慢生活吧！', 'medium');
  });
}
```
**现状评估**：
- **基础游玩层面：可行**。点击后弹窗关闭，玩家仍可在岛屿上移动、采集、烹饪、钓鱼、操作矿机、参与共振等，生存数值（饥饿、口渴、体温）与物理循环正常运转。
- **系统状态层面：存在严重悬空缺陷**：
  1. `StorySystem` 陷入冻结状态，无法接收后续任何剧情推进；
  2. 任务 HUD 依然悬挂第六章逃生提示，没有切换为「自由漫游 / 终局经营」无任务态；
  3. 存档系统（`SaveSystem.js:115`）会将 `endedEndingId` 落盘；重新读取存档后，游戏依然维持在 `endedEndingId` 冻结态，且再次靠近木筏或 SOS 没有「重新观看证书」或「再次结局」的幂等处理。

---

## 3. 雷蒙德线盘点：M1 骨架设计 vs 现状实现差距

### 3.1 M1 骨架原始规划
在根目录设计纲领 `PROJECT-BRIEF.md` 第 28 行明确记录：
> `4. **M1 主线重排（骨架）**：章节顺序重写：海难 → 营地 → 修通讯 → 收到求救 → 出航救雷蒙德 → …（完整骨架在主控规划 plan-v2 阶段 2，本轮先落骨架与章节衔接）。`

按原设计，第 3 章无线电呼救与第 4 章造筏出海，本应紧密围绕「跨海前往漂流浮木岛（Timber Isle）营救学者雷蒙德（Raymond）」展开。

### 3.2 现有 Chapter 4 的实际实现
但在实际落地的 `src/systems/StorySystem.js:138-157` 中，第四章被写成：
```javascript
{
  id: 4,
  title: '第四章：筹备远航与出海营救',
  subtitle: '乘风破浪 · 搜救同伴与浮木岛开拓',
  steps: [
    {
      id: 'build_raft',
      type: 'state',
      desc: '在西南浅滩造好【求生大木筏】，准备扬帆出海展开营救！',
      checkState: () => this.raftBuilt,
      hint: '准备4根木材+2铁钉+2藤蔓在浅滩建造大木筏'
    },
    {
      id: 'rescue_partner',
      type: 'state',
      desc: '在东北悬崖高台木屋旁巡查，发现昏迷的第二幸存者，点按互动按钮紧急救援！',
      checkState: () => this.secondKidAwake,
      hint: '前往东北侧山顶别墅高台 (25, 1.8, -19) 救治昏迷同伴'
    }
  ]
}
```

### 3.3 现状实现与设计的严重撕裂
1. **角色偷换与叙事断层**：
   - 第 3 章收尾无线电台词（`src/main.js:1046`）明确呼叫：“这里是东北方漂流浮木岛……我们的双桅帆船触礁搁浅了……受困在沉船沙洲……”。
   - 第 4 章标题声称“乘风破浪·浮木岛开拓”，步骤 1 也造了大木筏。
   - 但步骤 2 `rescue_partner` 却要求玩家走到**主岛东北悬崖高台**（坐标 `[25, 1.8, -19]`）去救**主岛上的昏迷伙伴艾莉（`second_kid`）**！
   - 玩家**一步海都没出**，就在主岛后山完成了“出海营救”！
2. **雷蒙德全套系统的孤立与浪费**：
   实际上工程里已经完整实现了雷蒙德的全部闭环资产，却完全被排除在主线之外：
   - 场景与交互：`src/island/TimberIsleScene.js:309-353` 包含完整的雷蒙德受困模型、救助对话与喂食救治（`rescueSurvivor()`）。
   - 登岛与入住：`src/main.js:576` 实现了乘木筏自浮木岛返航时触发 `this.raymondSettled = true`。
   - 营地村民刷新：`src/entities/VillagerManager.js:314` 当 `raymondSettled` 为 true 时，雷蒙德实体入住营地。
   - 营地设施加成：`src/systems/CampFacilitiesSystem.js:78, 309` 雷蒙德可担任精炼工坊的“工坊技师”，加速自动化生产。
   - 存档支持：`src/systems/SaveSystem.js:125, 496` 包含 `raymondSettled` 的完整持久化。
3. **黄金路径的避重就轻**：
   在 `tools/verify-golden-path.mjs:152-159` 中：
   测试脚本通过 `g.villagers.villagers.find(v => v.id === 'second_kid')` 直接与主岛上的艾莉交互，**从未切岛前往 Timber Isle，从未触发雷蒙德逻辑**。

---

## 4. M3 施工清单建议与并行重叠分析

### 4.1 M3 施工清单建议（按文件）

| 目标文件 | 拟修改内容 | 修改目的 | 风险点 & 防御对策 |
| :--- | :--- | :--- | :--- |
| **`src/systems/StorySystem.js`** | 1. 改造 `final_escape` 判定机制或提供事件响应入口 `onEscape(endingId)`；<br>2. 调整 `update()` 顶部的 `endedEndingId` 阻断逻辑，允许通关状态被消费；<br>3. 在 `#advanceStep()` 中增加主线通关态处理（如标记 `this.isCompleted = true`，更新目标栏为漫游态）；<br>4. 新增 `resolveEnding(type)` 方法用于结局条件裁决。 | 解决死锁悖论与末章无法推进问题，让 `final_escape` 成为可达成、可落盘的完成态。 | **高风险**：M2 已将 advanceStep 私有化。<br>对策：严禁暴露 advanceStep，所有推进必须通过显式事件（如 `onEscape`）由内部守卫调用。必须保持 `tests/verify-m1-story-skeleton.mjs` 与 `tests/verify-m2-story-events.mjs` 绿灯。 |
| **`src/main.js`** | 1. 在木筏互动区域（行 1055~1125）增加“远航逃生”交互选项（若处于第 6 章且满足条件）；<br>2. 在 SOS 互动区域（行 1001~1052）增加“呼叫搜救直升机”交互选项（若处于第 6 章且持有工作收音机）；<br>3. 实现结局裁决调度，调用 `story.triggerEnding(id)`。 | 将 3D 世界内的实体交互真正连通到结局结算，告别纯单测 mock 驱动。 | **中风险**：行 1000~1130 是造船、建 SOS、开船坞的核心碰撞交互区。<br>对策：增加明确的对话分支选项或在第 6 章激活特殊交互提示，不破坏日常造船和出海导航。 |
| **`src/ui/UIManager.js`** | 1. 在 `triggerEndingScreen` 的“留岛漫游”按钮事件中，通知 `StorySystem` 进入后日谈自由漫游态，清理或替换目标栏文案；<br>2. 梳理或下线无效的 `triggerSolanaEscapeEnding`。 | 提供顺畅的终局转自由沙盒体验，消除永久卡在逃脱任务的问题。 | **⚠️ 高风险（并行冲突点）**：详见 4.2 节。必须做严格的代码区间隔离。 |
| **`src/systems/SaveSystem.js`** | 1. 确保 `story` 序列化包含 `isCompleted` 或通关状态标记；<br>2. 保证存档往返测试时字段深度一致。 | 确保通关后留岛经营存档安全，刷新页面能正确复原自由漫游态。 | **⚠️ 中风险（并行冲突点）**：详见 4.2 节。只需在 `story` 区块增加 1 个布尔字段，严禁改动 miningRig 区块。 |
| **`tools/verify-golden-path.mjs`** | 1. 在 `action` 逻辑中补充 `id === 'final_escape'` 的执行动作（如传送至木筏或 SOS 触发逃脱）；<br>2. 从 `knownRed` 数组中移除 `'final_escape'`；<br>3. 移除第 87 行的提前 `break`；<br>4. 增加终章存档快照校验（`checkpoint(6)`），最终状态断言为 `'passed'`。 | 达成黄金路径验证 100% 全绿（由 `passed_except_known_red` 转为 `passed`）。 | **低风险**：测试脚本本身变更，关键是 CDP 操作需要等待弹窗或状态完成，避免时间漂移。 |

### 4.2 与共振修补轮（Resonance R7-R9）文件重叠预警与隔离规约
当前工作树中，共振工程轮正在并行修改 `src/systems/MiningRigSystem.js`、`src/ui/UIManager.js`、`src/systems/SaveSystem.js` 等核心文件。

**重叠热点 1：`src/ui/UIManager.js`**
- **共振施工区间**：
  - 行 11~15：ResonanceEngine 依赖导入
  - 行 4350~4700：`_renderOddsTabHtml`、`_renderMotherlodeTabHtml`、`_renderResonanceTabHtml`
  - 行 4970~5010：矿机弹窗中的升级按钮与共振页签切换
  - 行 3075~3185：Seeker 钱包打卡与算力代币展示
- **M3 结局施工区间**：
  - 行 3230~3358：`triggerEndingScreen`
  - 行 3360~3370：`triggerSolanaEscapeEnding`
- **隔离规约**：
  M3 施工严禁改动 4000 行以后的共振页签渲染及 3000~3200 行的钱包/导航逻辑；所有结局相关 UI 逻辑严格封闭在行 3230~3370 范围内。

**重叠热点 2：`src/systems/SaveSystem.js`**
- **共振施工区间**：
  - `saveSeed`, `checkinClaimDays`（行 10~30, 70~75, 430~435）
  - `mergeRigState`, `rigStateKeys`, `miningRig` 迁移（行 180~250）
- **M3 结局施工区间**：
  - 仅涉及 `story` 对象的保存与加载（行 115 及行 450 左右）
- **隔离规约**：
  M3 绝不碰触 `SaveSystem` 中的 `miningRig` 或根级 `resonance` 校验逻辑，仅在 `story` 子字段中补充通关持久化。

### 4.3 黄金路径转绿最小实施路线建议
建议 M3 采取**外科手术式最小化方案**，避免扩大施工面：
1. **暂不对雷蒙德线进行大手术**：
   保持 Chapter 4 救助主岛艾莉的现状（避免修改跨岛航行引起现有 M1/M2 几十个用例级联震荡），将雷蒙德作为支线/前哨前置要素，留待后续版本重构；
2. **打通 Chapter 6 的结局闭环**：
   - 在 `StorySystem.js` 中新增 `triggerEscapeEnding(endingId)`，在触发 `triggerEnding` 的同时安全推进/终结 `final_escape` 步骤；
   - 在 `main.js` 的木筏交互处挂载呼叫/扬帆结算，满足条件时调用；
   - 在 `tools/verify-golden-path.mjs` 中定义 `final_escape` 动作：传送至木筏触发交互，移除白名单，让测试自然走完并产出 `checkpoint(6)`。

---

## 5. 核心结论简报

1. **第一失败点**：
   在 `tools/verify-golden-path.mjs:87` 中因处于 `knownRed: ['final_escape']` 被提前 `break` 截断。若解除截断，脚本会在第 164 行直接抛出 `Error: No progress: no verified gameplay route for final_escape`，因为测试脚本根本未编写该步骤的交互动作。
2. **最关键的一个架构缺口**：
   **`StorySystem` 内部存在状态死锁且场景中完全缺失结局触发交互**：
   步骤目标要求 `checkState: () => this.endedEndingId !== null`，但 `update()` 帧循环在 `this.endedEndingId` 为真时直接 `return` 阻断执行；同时主岛木筏与 SOS 地标在生产代码（`src/main.js`）中根本没有接入触发 `story.triggerEnding()` 的业务逻辑，导致游戏世界与结局系统彻底脱节。
