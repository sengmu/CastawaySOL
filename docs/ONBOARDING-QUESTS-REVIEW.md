# 新手任务设计评审与定版修正（2026-11-04）

评审对象：`docs/ONBOARDING-QUESTS.md`（GPT 设计 v1，2026-11-03）。评审方式：设计逐条与仓库代码（f45c225）对照核查。结论：**骨架可用，问题诊断属实；3 个红项修正后定版，第一批已按修正版实施。**

## 核实无误（与代码逐行对过）

- 现有四步 onboarding 与章节双状态并行、`_completeOnboardingThrough` 连带跳步、移动判定为单帧位移 ≥0.75、吃喝共用 `hasConsumedFoodOrWater`、「右上角行囊」文案已过期（现入口在底部）——全部属实。
- 序章原石门槛、第一章「首次出块＋累计 6 枚算力代币」门槛与代码原文一致。
- 系统清单与 `src/` 文件基本一一对应；kindling（木棍＋树皮）、stone_axe、tree_branch、driftwood、tree_bark 等配方与 ID 真实存在。
- 红线口径正确：不赠货币、奖励走账本、幂等、旧档不虚构证据、首次出航不得依赖待救居民。

## 红项（实施前必须修正，已定版）

1. **精炼受 B 裁定门控**：精炼 UI 隐藏、系统休眠，开放须过实现审计＋游戏设计确认＋用户定时机（2026-11-03 裁定）。设计稿阶段 C/G 不得把精炼列为随解锁出现的普通教学项；且代码中无独立精炼系统（散在 Crafting/CampFacilities）。→ 精炼从 C/G 常规清单摘出，单列门控条目，裁定解除前不向玩家展示。
2. **阶段 D 居民岗位未证实**：`VillagerManager` 无任何岗位/分配实现，D 主线「分配岗位→工作→领产物」无落点。→ D 主线先降为「救援＋安置」；岗位生产经核实存在或单独立项后才并入主线，此前不得以 D 为前置阻塞 E。
3. **与现有章节目标卡合并**：游戏已有章节目标卡（UIManager.updateObjective）。新任务层不得再造第二个追踪 UI。→ 定版规矩：屏幕上一次只呈现一个当前目标；任务面板施工时复用/接管现有目标卡通道，本规矩先行写入，面板批次执行。

## 黄项（已记录，实施时执行）

- 挖矿露面时机：推荐链第 10 步才碰矿机偏晚；第二批将「检视矿机」提前为到营地（步骤 6）后的显式目标，制作线并行。
- 回调盘点：设计点名的回调并非全部接在 main.js（如 onConsumeFood 在 StorySystem 内部、onInventoryOpened 由 UIManager 调用）；每批实施前先盘点真实回调再接线。
- 第 4 步吃食保留背包内食用（含开局苹果），不强制野外找果，避免出生区资源保障未落地先行卡人。
- 阶段 H/I 仅作远景规划，不进当前版本路线图；I 的结算措辞锁定为游戏内结算，永不与算力代币/SOL 挂钩。
- 共振首次教学须显式带 A1 口径原文：「算力代币是游戏内道具，不能兑换 SOL 或 SKR，不承诺任何收益。」

## 第一批实施记录（2026-11-04）

范围：步骤 1–6＋统一状态层＋独立吃喝凭据＋旧档迁移（StorySystem 内 additive 改造，章节系统语义不变）。

- 六步稳定 ID：move / gather / inventory / eat / drink / campsite，各步绑定事实凭据（actionFacts）。
- 移动步改为累计有效移动 ≥3（单帧跳变 >3 视为传送/坐标恢复，不计入），替代单帧 0.75 判定。
- 事实先行自动满足：先吃/先喝/先开包只记凭据，不连带跳过未做步骤；`_completeOnboardingThrough` 已删除。
- 吃喝独立：新增 hasEatenFood / hasDrunkWater 与 ateFood / drankWater 凭据；章节口径 `hasConsumedFoodOrWater` 保持不变（任一即可过章）。
- 跳过提示只关展示（onboardingDismissed），事实继续记录。
- 存档新增 onboardingVersion / actionFacts / onboardingWaived / hasEatenFood / hasDrunkWater；旧档迁移只按可信证据：旧合并吃喝标记映射为 eat+drink 两步豁免（不虚构单项事实），旧步数计数器按级映射，中后期旧档不回炉教学。
- 提示文案修正：背包入口改为底部；main.js 教程总步数改读 StorySystem.onboardingTotal，不再写死 4。
- 测试：新增 tests/verify-onboarding-quests.mjs（七组）；verify-m1 中编码旧跳步行为的断言已按新口径更新。
