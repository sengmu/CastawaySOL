// CastawaySOL - P0 求生流程改造自动化验收测试 (P0 Survival Pipeline Verifier)
// 验证：无自动跳关、真实行为驱动、无资源死锁、合成不结算通关、Schema v1 存档与迁移可靠性

import { StorySystem } from '../src/systems/StorySystem.js';
import { SaveSystem, CURRENT_SCHEMA_VERSION, SAVE_KEY_PRIMARY, SAVE_KEY_BACKUP } from '../src/systems/SaveSystem.js';
import * as THREE from 'three';

console.log('====================================================');
console.log('🏝️ CastawaySOL - 开始 P0 求生流程全闭环自动化验收测试');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failCount++;
  }
}

// 模拟简易 Mock 环境
class MockUI {
  constructor() {
    this.inventory = { apple: 1 }; // 纯净初始背包
    this.objectiveText = '';
  }
  updateObjective(text) { this.objectiveText = text; }
  showToast(text) {}
  showDialog(title, content) {}
  renderInventory() {}
  updateSurvivalHUD() {}
}

class MockSurvival {
  constructor() {
    this.life = 100;
    this.hunger = 55;
    this.water = 50;
    this.fatigue = 35;
    this.day = 1;
    this.steps = 0;
    this.canteenSips = 3;
    this.isDead = false;
  }
}

class MockGame {
  constructor() {
    this.ui = new MockUI();
    this.survival = new MockSurvival();
    this.player = {
      position: new THREE.Vector3(0, 0, 5),
      rotation: 0
    };
    this.story = new StorySystem(this);
    this.beachResources = {
      serialize: () => ({ collectedIds: ['res_0'] }),
      deserialize: () => {}
    };
    this.buildSystem = {
      placedFurniture: []
    };
    this.gemObjects = [
      { id: 'star_gem', picked: false }
    ];
  }
}

// ----------------------------------------------------
// 测试 1: 新存档纯净状态与无自跳验证
// ----------------------------------------------------
console.log('【测试 1: 新存档初始状态与防跳关守卫】');
const game = new MockGame();
assert(game.story.currentChapterId === 0, '初始章节为序章 (Chapter 0)');
assert(game.story.currentStepIndex === 0, '初始步骤为步骤 0 (collect_driftwood)');

// 连续执行 20 帧 update，即使四维有初始值、背包有苹果，也严禁自动跳步
for (let i = 0; i < 20; i++) {
  game.story.update(game.player.position, game.ui.inventory, game.survival);
}
assert(game.story.currentChapterId === 0 && game.story.currentStepIndex === 0, '无真实行动时，即使多帧循环亦绝对不自动跳关');

// ----------------------------------------------------
// 测试 2: 真实物理采集驱动步骤 0 -> 步骤 1
// ----------------------------------------------------
console.log('\n【测试 2: 真实采集驱动步骤 0 -> 1】');
// 模拟玩家在海滩拾取了漂流木棍
game.story.onGatherResource('tree_branch');
assert(game.story.hasGatheredBranch === true, '真实采集标记 hasGatheredBranch 置为 true');
assert(game.story.currentStepIndex === 1, '步骤成功推进至步骤 1 (find_food_water)');

// ----------------------------------------------------
// 测试 3: 真实进食/饮水驱动步骤 1 -> 步骤 2
// ----------------------------------------------------
console.log('\n【测试 3: 真实进食/饮水驱动步骤 1 -> 2】');
// 执行 update，进食前不应跳关
game.story.update(game.player.position, game.ui.inventory, game.survival);
assert(game.story.currentStepIndex === 1, '未进食/饮水前，步骤保持在步骤 1');

// 模拟玩家食用应急野苹果
game.story.onConsumeFood('apple');
assert(game.story.hasConsumedFoodOrWater === true, '真实进食标记 hasConsumedFoodOrWater 置为 true');
assert(game.story.currentStepIndex === 2, '步骤成功推进至步骤 2 (find_campsite)');

// ----------------------------------------------------
// 测试 4: 探索到达营地驱动序章 -> 第一章
// ----------------------------------------------------
console.log('\n【测试 4: 地理探索到达营地驱动晋升第一章】');
// 玩家在 (0, 0, 5)，离营地 (-16, 0, -8) 距离约 20 米，update 不推进
game.story.update(game.player.position, game.ui.inventory, game.survival);
assert(game.story.currentChapterId === 0 && game.story.currentStepIndex === 2, '未到达营地前停留在序章寻找营地步骤');

// 模拟玩家探索行走到营地帐篷 (-16.5, 0, 23.2)，对齐 ISLAND_LAYOUT.tent [-17, 0, 23]
game.player.position.set(-16.5, 0, 23.2);
game.story.update(game.player.position, game.ui.inventory, game.survival);
assert(game.story.hasReachedCampsite === true, '真实到达营地标记 hasReachedCampsite 置为 true');
assert(game.story.currentChapterId === 1 && game.story.currentStepIndex === 0, '成功晋升至第一章：钻木取火与工匠雏形！');

// ----------------------------------------------------
// 测试 5: 第一章制作与烹饪闭环
// ----------------------------------------------------
console.log('\n【测试 5: 第一章工匠与烹饪闭环】');
// 合成引火物
game.story.onCraftItem('kindling');
assert(game.story.hasCraftedKindling === true, '研制引火物成功，hasCraftedKindling 置为 true');
assert(game.story.currentStepIndex === 1, '步骤推进至烹饪热食 (cook_hot_food)');

// 篝火烹饪
game.story.onCookFood();
assert(game.story.hasCookedFood === true, '营火烹饪成功，hasCookedFood 置为 true');
assert(game.story.currentStepIndex === 2, '步骤推进至研制石斧 (craft_axe)');

// 合成石斧
game.story.onCraftItem('stone_axe');
assert(game.story.hasCraftedAxe === true, '研制石斧成功，hasCraftedAxe 置为 true');
assert(game.story.currentChapterId === 2, '第一章圆满达成，成功晋升至第二章：丛林猴影！');

// ----------------------------------------------------
// 测试 6: 严禁合成收音机/木筏直接跳通关结局
// ----------------------------------------------------
console.log('\n【测试 6: 合成物品仅赋予能力，严禁直接结算通关】');
game.story.onCraftItem('workradio');
assert(game.story.endedEndingId === null, '合成工作收音机不会触发结局结算 (endedEndingId 为 null)');
game.story.onCraftItem('escape_raft');
assert(game.story.endedEndingId === null, '合成求生木筏不会触发结局结算 (endedEndingId 为 null)');

// ----------------------------------------------------
// 测试 7: SaveSystem Schema v1 序列化、反序列化、迁移与防破损
// ----------------------------------------------------
console.log('\n【测试 7: SaveSystem 版本化安全存档与迁移】');

// 模拟简易 LocalStorage
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => mockStorage.get(k) || null,
  setItem: (k, v) => mockStorage.set(k, String(v)),
  removeItem: (k) => mockStorage.delete(k)
};

const saveSystem = new SaveSystem(game);
const snapshot = saveSystem.createSnapshot();

assert(saveSystem.validateSaveData(snapshot) === true, '快照数据通过结构有效性验证');
assert(snapshot.schemaVersion === CURRENT_SCHEMA_VERSION, `快照 Schema 版本号为 ${CURRENT_SCHEMA_VERSION}`);
assert(snapshot.story.currentChapterId === 2, '快照记录了正确的剧情章节 ID (Chapter 2)');
assert(snapshot.story.hasCraftedAxe === true, '快照正确记录了已制作石斧行为标记');

// 执行安全保存
const saveRes = saveSystem.saveGame('unit_test');
assert(saveRes.success === true, '执行安全保存成功');
assert(mockStorage.has(SAVE_KEY_PRIMARY) === true, '主存档槽位已写入数据');

// 迁移测试: 传入无版本号旧存档数据 (v0)
const legacyV0Data = {
  player: { position: [10, 0, 20], rotation: 1.57 },
  inventory: { tree_branch: 3, stone_chunk: 1 },
  furniture: [{ id: 'bench', path: '/models/bench.dae', scale: 1, pos: [0, 0, 0], rot: 0 }]
};
const migrated = saveSystem.migrate(legacyV0Data);
assert(migrated.schemaVersion === 1, '旧版 v0 存档成功平滑迁移至 Schema v1');
assert(migrated.inventory.tree_branch === 3, '迁移后保留原背包中的物品');
assert(saveSystem.validateSaveData(migrated) === true, '迁移后数据结构通过安全校验');

// 防破损测试: 尝试写入非法或破坏性数据
const corruptedData = { junk: 'invalid data without required fields' };
assert(saveSystem.validateSaveData(corruptedData) === false, '损坏数据被严格拦截，未通过校验');

console.log('\n====================================================');
console.log(`🎉 测试汇总: ${passCount} 项通过，${failCount} 项失败`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
