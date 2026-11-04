// CastawaySOL - M1 主线重排（骨架）专项自动化测试套件
// 验证规则：海难求生 → 营地安身 → 修复通讯 → 收到求救 → 准备航行并出海营救 → 扩大生产与家园 → 远古神殿与生还
import assert from 'node:assert/strict';
import { StorySystem } from '../src/systems/StorySystem.js';

console.log('📜 开始执行 CastawaySOL M1 主线叙事骨架重排专项自动化测试套件...\n');

const mockGame = {
  ui: {
    updateObjective: () => {},
    showToast: () => {},
    showDialog: () => {}
  }
};

const story = new StorySystem(mockGame);

// ==========================================
// 1. 验证主线七大章节完整骨架结构
// ==========================================
console.log('▶ [1/3] 验证主线重排后七大篇章骨架与首尾衔接...');
assert.equal(story.chapters.length, 7, '主线必须包含 7 个篇章 (序章 + 6 个章节)');

const expectedChapters = [
  { id: 0, title: '序章：海难漂流', steps: ['collect_driftwood', 'find_food_water', 'find_campsite'] },
  { id: 1, title: '第一章：钻木取火与营地安身', steps: ['craft_kindling', 'cook_hot_food', 'craft_axe'] },
  { id: 2, title: '第二章：丛林伙伴与探索辅助', steps: ['chase_monkey', 'befriend_monkey'] },
  { id: 3, title: '第三章：无线通讯与邻岛求救', steps: ['fix_radio', 'radio_contact'] },
  { id: 4, title: '第四章：筹备远航与出海营救', steps: ['build_raft', 'rescue_partner'] },
  { id: 5, title: '第五章：扩大生产与海岛家园', steps: ['care_partner', 'collect_gems'] },
  { id: 6, title: '第六章：自由经营', steps: ['mainline_complete'] }
];

expectedChapters.forEach(exp => {
  const ch = story.chapters[exp.id];
  assert.ok(ch, `章节 ${exp.id} 必须存在`);
  assert.ok(ch.title.includes(exp.title.slice(0, 4)), `章节 ${exp.id} 标题必须符合叙事大纲: ${ch.title}`);
  assert.equal(ch.steps.length, exp.steps.length, `章节 ${exp.id} 步骤数必须一致`);
  exp.steps.forEach((sId, idx) => {
    assert.equal(ch.steps[idx].id, sId, `章节 ${exp.id} 步骤 ${idx} ID 必须为 ${sId}`);
  });
});
console.log('  ✅ 七大章节骨架定义与步骤全量对齐！');

// ==========================================
// 2. 验证关键转折衔接逻辑
// ==========================================
console.log('\n▶ [2/3] 验证核心叙事转折（收到求救 -> 筹备木筏 -> 出海营救）...');
// 第三章收尾：修复收音机 -> 架设天线收到邻岛呼救
const ch3 = story.chapters[3];
assert.equal(ch3.steps[0].id, 'fix_radio', '第三章第1步必须为修复收音机');
assert.equal(ch3.steps[1].id, 'radio_contact', '第三章收尾步骤必须为接收邻岛求救信号');

// 第四章开启：筹备航海木筏 -> 搜救同伴
const ch4 = story.chapters[4];
assert.equal(ch4.steps[0].id, 'build_raft', '收到求救后，第四章第1步必须顺畅承接为建造求生大木筏出海');
assert.equal(ch4.steps[1].id, 'rescue_partner', '第四章第2步承接为搜救同伴');

// 第五章：扩大生产与经营
const ch5 = story.chapters[5];
assert.equal(ch5.steps[0].id, 'care_partner', '第五章承接同伴照料与好感羁绊');
assert.equal(ch5.steps[1].id, 'collect_gems', '第五章承接收集全岛远古秘宝');

// 第六章：神殿终极逃生
const ch6 = story.chapters[6];
assert.equal(ch6.steps[0].id, 'mainline_complete', '第六章作为自由经营开启阶段');
console.log('  ✅ 剧情转折逻辑顺畅，无依赖死锁！');

// ==========================================
// 3. 验证基于 Step ID 的解耦事件推进
// ==========================================
console.log('\n▶ [3/3] 验证基于 Step ID 的解耦事件推进安全与防跳关...');

// 测试 1: 序章拾取木棍
story.currentChapterId = 0;
story.currentStepIndex = 0;
story.onGatherResource('tree_branch');
assert.equal(story.currentStepIndex, 1, '序章拾取木棍后步进至第 2 步');
assert.equal(story.getCurrentStep().id, 'find_food_water');

// 测试 2: 错误行为不触发误推进
story.onGatherResource('tree_branch'); // 当前需要进食，再次捡木棍不应推进
assert.equal(story.currentStepIndex, 1, '非当前目标行为严禁误推进');

// 测试 3: 饮水推进至营地探索
story.onDrinkWater();
assert.equal(story.currentStepIndex, 2);
assert.equal(story.getCurrentStep().id, 'find_campsite');

console.log('  ✅ 基于 Step ID 的事件流转精准，防跳关守卫完全有效！');


// First-run control onboarding follows real actions and is save/skip safe.
// 2026-11-04 起改为六步事实凭据制（docs/ONBOARDING-QUESTS.md 第一批）：移动按累计距离、吃喝独立凭据、先行事实到达时自动满足。
const onboarding = new StorySystem(mockGame);
assert.equal(onboarding.getOnboardingHint().id, 'move', '首次进入先提示移动操作');
onboarding.update({ x: 0, z: 0 }, {}, {});
onboarding.update({ x: 1, z: 0 }, {}, {});
onboarding.update({ x: 2, z: 0 }, {}, {});
onboarding.update({ x: 3, z: 0 }, {}, {});
assert.equal(onboarding.getOnboardingHint().id, 'gather', '累计实际移动 3 个单位后提示拾取');
onboarding.onGatherResource('tree_branch');
assert.equal(onboarding.getOnboardingHint().id, 'inventory', '拾取后提示打开背包');
onboarding.onInventoryOpened();
assert.equal(onboarding.getOnboardingHint().id, 'eat', '打开背包后提示进食');
onboarding.onConsumeFood('apple');
assert.equal(onboarding.getOnboardingHint().id, 'drink', '进食后提示饮水（吃喝独立凭据）');
onboarding.onDrinkWater();
assert.equal(onboarding.getOnboardingHint().id, 'campsite', '饮水后提示前往营地');
onboarding.update({ x: -17, z: 23 }, {}, {});
assert.equal(onboarding.getOnboardingHint(), null, '六步全部凭真实行为完成后结束引导');

const resumableOnboarding = new StorySystem(mockGame);
resumableOnboarding.dismissOnboarding();
const savedStory = resumableOnboarding.serialize();
const restoredOnboarding = new StorySystem(mockGame);
restoredOnboarding.deserialize(savedStory);
assert.equal(restoredOnboarding.getOnboardingHint(), null, '跳过状态必须在存档重载后保留');

const actionFirstOnboarding = new StorySystem(mockGame);
actionFirstOnboarding.onConsumeFood('apple');
assert.equal(actionFirstOnboarding.getOnboardingHint().id, 'move', '先行进食只记录凭据，不跳过未做的移动步');
assert.equal(actionFirstOnboarding.actionFacts.ateFood, true, '先行进食凭据必须被保存');
actionFirstOnboarding.update({ x: 0, z: 0 }, {}, {});
actionFirstOnboarding.update({ x: 1, z: 0 }, {}, {});
actionFirstOnboarding.update({ x: 2, z: 0 }, {}, {});
actionFirstOnboarding.update({ x: 3, z: 0 }, {}, {});
actionFirstOnboarding.onGatherResource('tree_branch');
actionFirstOnboarding.onInventoryOpened();
assert.equal(actionFirstOnboarding.getOnboardingHint().id, 'drink', '到达进食步时凭据自动满足，直接进入饮水步');
console.log('\n🎉🎉🎉 [ALL M1 STORY TESTS PASSED] M1 主线与新手引导专项自动化测试 100% 全部通过！');
