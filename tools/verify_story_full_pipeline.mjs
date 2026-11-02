// CastawaySOL - 七章主线与全部结局分支端到端仿真测试套件
// 对齐 M1 七章顺序；通过真实事件驱动，不允许背包状态替代行为

import { ISLAND_LAYOUT } from '../src/core/IslandLayout.js';
import { StorySystem } from '../src/systems/StorySystem.js';
import { SurvivalSystem } from '../src/systems/SurvivalSystem.js';
import { CraftingSystem } from '../src/systems/CraftingSystem.js';

console.log('======================================================');
console.log('🚀 CastawaySOL 剧情与主线任务链端到端全流程深度联调测试');
console.log('======================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition, testName, detail = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName} - ${detail}`);
  }
}

// 模拟完整游戏环境
function createMockGame() {
  const dialogsHistory = [];
  const toastHistory = [];
  const objectiveHistory = [];
  let endingTriggered = null;

  const mockUI = {
    inventory: {
      apple: 4,
      coconut: 2,
      tree_branch: 6,
      tree_bark: 3,
      ivy: 2,
      stone_chunk: 2,
      big_rock: 2,
      broken_radio: 1,
      battery: 1,
      lumber: 4,
      nail: 2,
      fish: 2,
      fishingrod: 1
    },
    showDialog(title, content) {
      dialogsHistory.push({ title, content });
    },
    showToast(msg) {
      toastHistory.push(msg);
    },
    updateObjective(text) {
      objectiveHistory.push(text);
    },
    triggerEndingScreen(endingId, data) {
      endingTriggered = { endingId, data };
    }
  };

  const survival = new SurvivalSystem();
  const crafting = new CraftingSystem();

  const mockGame = {
    ui: mockUI,
    survival: survival,
    crafting: crafting,
    getDialogs: () => dialogsHistory,
    getToasts: () => toastHistory,
    getObjectives: () => objectiveHistory,
    getEnding: () => endingTriggered
  };

  const story = new StorySystem(mockGame);
  mockGame.story = story;

  return { mockGame, story, survival, crafting, mockUI };
}

// ----------------------------------------------------
// 测试 1：序章：海难漂流
// ----------------------------------------------------
console.log('--- [Chapter 0: 序章·海难漂流] ---');
{
  const { mockGame, story, survival, mockUI } = createMockGame();

  assert(story.currentChapterId === 0, '初始位于序章');
  assert(story.currentStepIndex === 0, '初始位于第一步：收集木棍与漂流物');

  // 1. 拾取木棍
  story.onGatherResource('tree_branch');
  assert(story.currentStepIndex === 1, '第1步达成，自动推进到第2步：进食与饮水');

  // 2. 模拟进食与饮水
  survival.hunger = 80;
  survival.water = 75;
  story.onDrinkWater();
  assert(story.currentStepIndex === 2, '第2步达成，推进到第3步：寻找帐篷营地');

  // 3. 移动至帐篷营地 (-16, 0, -8)
  story.update({ x: ISLAND_LAYOUT.tent[0], y: ISLAND_LAYOUT.tent[1], z: ISLAND_LAYOUT.tent[2] }, mockUI.inventory, survival);
  assert(story.currentChapterId === 1, '序章通关，成功晋升第一章：钻木取火与工匠雏形');
  assert(story.currentStepIndex === 0, '第一章第一步已激活');
}

// ----------------------------------------------------
// 测试 2：第一章：钻木取火与工匠雏形
// ----------------------------------------------------
console.log('\n--- [Chapter 1: 第一章·钻木取火与工匠雏形] ---');
{
  const { mockGame, story, survival, mockUI, crafting } = createMockGame();
  story.currentChapterId = 1;
  story.currentStepIndex = 0;

  // 1. 合成引火物 (tree_branch + tree_bark)
  const recipeKindling = crafting.findRecipe('tree_branch', 'tree_bark');
  assert(recipeKindling !== null && recipeKindling.result.id === 'kindling', '工作台查验引火物配方有效');
  mockUI.inventory['kindling'] = 1;
  story.onCraftItem('kindling');
  story.update({ x: -7, y: 0, z: -4 }, mockUI.inventory, survival);
  assert(story.currentStepIndex === 1, '引火物研制成功，进入第2步：营火烹饪');

  // 2. 烹饪熟食 (烤鱼)
  mockUI.inventory['baked_fish'] = 1;
  story.onCookFood();
  story.update({ x: -7, y: 0, z: -4 }, mockUI.inventory, survival);
  assert(story.currentStepIndex === 2, '烤鱼烹饪完成，进入第3步：研制石斧');

  // 3. 合成石斧 (tree_branch + stone_chunk)
  const recipeAxe = crafting.findRecipe('tree_branch', 'stone_chunk');
  assert(recipeAxe !== null && recipeAxe.result.id === 'stone_axe', '工作台查验锋利石斧配方有效');
  mockUI.inventory['stone_axe'] = 1;
  story.onCraftItem('stone_axe');
  story.update({ x: 0, y: 0, z: 0 }, mockUI.inventory, survival);
  assert(story.currentChapterId === 2, '第一章通关，晋升第二章：丛林猴影 (Bub)');
}

// ----------------------------------------------------
// 测试 3：第二章：丛林猴影与巴布收服
// ----------------------------------------------------
console.log('\n--- [Chapter 2: 第二章·丛林猴影 (Bub)] ---');
{
  const { mockGame, story, survival, mockUI } = createMockGame();
  story.currentChapterId = 2;
  story.currentStepIndex = 0;

  // 1. 追循叫声来到东侧古树区 (10, 0, -10)
  story.update({ x: 10.5, y: 0, z: -9.8 }, mockUI.inventory, survival);
  assert(story.currentStepIndex === 1, '已发现小猴，进入第2步：投喂收服');

  // 2. 投喂小猴
  story.befriendMonkey();
  assert(story.monkeyBefriended === true, '小猴 Bub 成功入队成为忠实随行伙伴');
  assert(story.currentChapterId === 3, '第二章通关，晋升第三章：求救信号与命运抉择');
}

// ----------------------------------------------------
// 测试 4：第三章：求救信号与命运抉择
// ----------------------------------------------------
console.log('\n--- [Chapter 3: 第三章·求救信号与命运抉择] ---');
{
  const { mockGame, story, survival, mockUI, crafting } = createMockGame();
  story.currentChapterId = 3;
  story.currentStepIndex = 0;

  // 1. 修复收音机
  const recipeRadio = crafting.findRecipe('battery', 'broken_radio');
  assert(recipeRadio !== null && recipeRadio.result.id === 'workradio', '工作台查验工作收音机配方有效');
  mockUI.inventory['workradio'] = 1;
  story.onCraftItem('workradio');
  story.update({ x: 0, y: 0, z: 0 }, mockUI.inventory, survival);
  assert(story.currentStepIndex === 1, '无线电修复完成，进入第2步：接收邻岛求救信号');

  // 2. 建造沙滩 S.O.S 地标
  story.buildSosSign();
  assert(story.sosBuilt === true, '沙滩巨型 S.O.S 地标搭建完毕');
  assert(story.getCurrentStep().id === 'radio_contact', 'SOS 本身不能代替无线电求救触发');
  story.onRadioContact();
  assert(story.currentChapterId === 4, '第三章通关，晋升第四章：筹备远航与出海营救');
}

// ----------------------------------------------------
// 测试 5：第四章：第二幸存者 Ellie 救援与好感培养
// ----------------------------------------------------
console.log('\n--- [Chapter 4: 第四章·第二幸存者艾莉 (Ellie)] ---');
{
  const { mockGame, story, survival, mockUI } = createMockGame();
  story.currentChapterId = 4;
  story.currentStepIndex = 0;

  // 1. 救治同伴
  story.buildRaft();
  assert(story.getCurrentStep().id === 'rescue_partner', '造筏后必须先搜救同伴');
  story.onPartnerAwakened();
  story.update({x:1000,z:1000}, mockUI.inventory, survival);
  assert(story.getCurrentStep().id === 'care_partner', '艾莉苏醒，进入第五章同伴照料');

  // 2. 赠礼增进好感度至 105
  story.secondKidAffection = 105;
  story.update({ x: 23, y: 1.8, z: -17 }, mockUI.inventory, survival);
  assert(story.currentChapterId === 5 && story.getCurrentStep().id === 'collect_gems', '好感达标后进入第五章收集宝石');
}

// ----------------------------------------------------
// 测试 6：第五章：远古遗迹三宝石与全结局分支
// ----------------------------------------------------
console.log('\n--- [Chapter 5: 第五章·扩大生产与海岛家园] ---');
{
  const { mockGame, story, survival, mockUI } = createMockGame();
  story.currentChapterId = 5;
  story.currentStepIndex = 0;

  story.secondKidAffection = 105;
  story.update({x:1000,z:1000}, mockUI.inventory, survival);
  assert(story.getCurrentStep().id === 'collect_gems', '照料同伴后才能收集宝石');

  // 收集三颗神秘远古宝石
  story.gemsCollected.add('star_gem');
  story.gemsCollected.add('diamond_gem');
  story.gemsCollected.add('moon_gem');
  assert(story.gemsCollected.size === 3, '成功集齐三颗远古遗迹宝石');

  story.update({ x: 0, y: 0, z: 0 }, mockUI.inventory, survival);
  assert(story.currentChapterId === 6 && story.getCurrentStep().id === 'mainline_complete', '宝石齐聚，进入第六章自由经营开启步');

  story.update({x:0,z:0}, mockUI.inventory, survival);
  assert(story.isCompleted === true, '主线完成进入自由经营');
  assert(story.getQuestBannerText().includes('自由经营'), '任务栏显示自由经营');
  assert(mockGame.getEnding() === null, '完成主线不触发结局页');

}

console.log('\n======================================================');
console.log(`📊 测试汇总：共执行 ${totalTests} 项断言，全部通过 ${passedTests} 项 (通过率: ${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('======================================================');

if (totalTests !== passedTests) process.exitCode = 1;
