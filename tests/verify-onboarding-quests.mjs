// CastawaySOL - 新手任务（步骤 1–6）事实凭据层专项测试
// 设计依据：docs/ONBOARDING-QUESTS.md（经评审修正版）第一批
// 验证：累计移动（含传送过滤）、事实先行自动满足、吃喝独立凭据、开包不跳步、旧档迁移、跳过提示只关展示
import assert from 'node:assert/strict';
import { StorySystem } from '../src/systems/StorySystem.js';
import { ISLAND_LAYOUT } from '../src/core/IslandLayout.js';

console.log('🧭 开始执行新手任务事实凭据层专项测试...\n');

const mockGame = {
  ui: { updateObjective: () => {}, updateTutorial: () => {}, showToast: () => {}, showDialog: () => {} },
  saveSystem: { saveGame: () => {} }
};
const walk = (s, x0, x1, step = 1) => { for (let x = x0; x <= x1; x += step) s.update({ x, z: 0 }, {}, {}); };

// [1] 正常顺序：六步依次完成
{
  const s = new StorySystem(mockGame);
  assert.equal(s.getOnboardingHint().id, 'move');
  s.update({ x: 0, z: 0 }, {}, {});
  s.update({ x: 1, z: 0 }, {}, {});
  assert.equal(s.getOnboardingHint().id, 'move', '累计不足 3 不完成移动步');
  walk(s, 2, 3);
  assert.equal(s.getOnboardingHint().id, 'gather', '累计移动 3 后进入拾取步');
  s.onGatherResource('tree_branch');
  assert.equal(s.getOnboardingHint().id, 'inventory');
  s.onInventoryOpened();
  assert.equal(s.getOnboardingHint().id, 'eat');
  s.onConsumeFood('apple');
  assert.equal(s.getOnboardingHint().id, 'drink', '只吃不喝不能过饮水步');
  assert.equal(s.hasEatenFood, true);
  assert.equal(s.hasDrunkWater, false);
  s.onDrinkWater();
  assert.equal(s.getOnboardingHint().id, 'campsite');
  s.update({ x: ISLAND_LAYOUT.tent[0], z: ISLAND_LAYOUT.tent[2] }, {}, {});
  assert.equal(s.getOnboardingHint(), null, '抵达营地后六步全部完成');
  assert.equal(s.hasReachedCampsite, true);
  console.log('  ✅ [1] 正常顺序六步完成，吃喝独立计数');
}

// [2] 传送过滤：单帧大跳变不计移动距离
{
  const s = new StorySystem(mockGame);
  s.update({ x: 0, z: 0 }, {}, {});
  s.update({ x: 50, z: 50 }, {}, {});
  assert.equal(s.actionFacts.movedMeters, 0, '传送跳变不计入移动距离');
  assert.equal(s.getOnboardingHint().id, 'move');
  console.log('  ✅ [2] 传送/坐标恢复不刷移动步');
}

// [3] 事实先行：先吃先喝先到营地，展示到达时自动满足；开包不连带跳步
{
  const s = new StorySystem(mockGame);
  s.onConsumeFood('apple');
  s.onDrinkWater();
  s.onInventoryOpened();
  assert.equal(s.getOnboardingHint().id, 'move', '先行事实不跳过未做的移动步');
  assert.equal(s.actionFacts.ateFood, true);
  walk(s, 0, 3);
  assert.equal(s.getOnboardingHint().id, 'gather');
  s.onGatherResource('driftwood');
  assert.equal(s.getOnboardingHint().id, 'campsite', '背包/吃/喝三步凭事实自动满足');
  console.log('  ✅ [3] 事实先行自动满足，未做步骤不被连带跳过');
}

// [4] 跳过提示：只关展示，事实继续记录；存档往返保留
{
  const s = new StorySystem(mockGame);
  s.dismissOnboarding();
  assert.equal(s.getOnboardingHint(), null);
  s.onGatherResource('tree_branch');
  assert.equal(s.actionFacts.gatheredMaterial, true, '跳过后真实行为仍被记录');
  const restored = new StorySystem(mockGame);
  restored.deserialize(s.serialize());
  assert.equal(restored.getOnboardingHint(), null, '跳过状态重载保留');
  assert.equal(restored.actionFacts.gatheredMaterial, true, '事实凭据重载保留');
  console.log('  ✅ [4] 跳过提示只关展示，凭据照常保存恢复');
}

// [5] 旧档迁移 A：合并吃喝标记 → 两步豁免，不虚构单项事实
{
  const s = new StorySystem(mockGame);
  s.deserialize({ currentChapterId: 0, currentStepIndex: 2, hasGatheredBranch: true, hasConsumedFoodOrWater: true, hasReachedCampsite: false, onboardingStep: 4, onboardingDismissed: true });
  assert.equal(s.hasEatenFood, false, '不虚构进食事实');
  assert.equal(s.hasDrunkWater, false, '不虚构饮水事实');
  assert.ok(s.onboardingWaived.includes('eat') && s.onboardingWaived.includes('drink'), '旧合并标记映射为两步豁免');
  console.log('  ✅ [5] 旧档合并标记 → 豁免迁移，无虚构事实');
}

// [6] 旧档迁移 B：中后期旧档（章节已推进）不再被拉回新手教学
{
  const s = new StorySystem(mockGame);
  s.deserialize({ currentChapterId: 2, currentStepIndex: 0, hasGatheredBranch: true, hasConsumedFoodOrWater: true, hasReachedCampsite: true });
  assert.equal(s.getOnboardingHint(), null, '已推进章节的旧档视为教学完成');
  assert.equal(s.actionFacts.reachedCampsite, true);
  console.log('  ✅ [6] 中后期旧档不回炉教学');
}

// [7] 新档往返：actionFacts 完整序列化
{
  const s = new StorySystem(mockGame);
  walk(s, 0, 3);
  s.onGatherResource('tree_branch');
  const r = new StorySystem(mockGame);
  r.deserialize(s.serialize());
  assert.equal(r.actionFacts.movedMeters, 3);
  assert.equal(r.actionFacts.gatheredMaterial, true);
  assert.equal(r.getOnboardingHint().id, 'inventory');
  console.log('  ✅ [7] 新档凭据序列化往返一致');
}

console.log('\n🎉 [ALL ONBOARDING QUEST TESTS PASSED] 新手任务事实凭据层全部通过');
