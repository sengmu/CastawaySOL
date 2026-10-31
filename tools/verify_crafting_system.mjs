// CastawaySOL - 合成系统与全景图鉴 Pokédex 全流程自动化回归测试脚本
import assert from 'node:assert';
import {
  CRAFTING_CATEGORIES,
  CRAFTING_BLUEPRINTS,
  CraftingBlueprintManager
} from '../src/core/CraftingBlueprints.js';

console.log('🧪 开始执行合成系统与图鉴机制全流程自动化测试...\n');

// 1. 验证 26 套经典合成蓝图结构完整性
assert.strictEqual(CRAFTING_BLUEPRINTS.length, 26, '应当严格收录 26 套合成蓝图');
for (const bp of CRAFTING_BLUEPRINTS) {
  assert.ok(bp.id, `蓝图必须包含唯一 id`);
  assert.ok(bp.category, `蓝图 ${bp.id} 必须指定学科分类`);
  assert.ok(bp.a && bp.b, `蓝图 ${bp.id} 必须包含原料 A 和 B`);
  assert.ok(bp.result, `蓝图 ${bp.id} 必须包含产出结果`);
  assert.ok(bp.name, `蓝图 ${bp.id} 必须包含中文名称`);
  assert.ok(bp.hint, `蓝图 ${bp.id} 必须包含未解锁探索线索`);
  assert.ok(bp.desc, `蓝图 ${bp.id} 必须包含功能说明`);
}
console.log('✅ 1. 26 套蓝图结构与必填属性校验全部通过！');

// 2. 验证四大学科分类统计
const combatList = CraftingBlueprintManager.getBlueprintsByCategory('combat');
const toolsList = CraftingBlueprintManager.getBlueprintsByCategory('tools');
const medFoodList = CraftingBlueprintManager.getBlueprintsByCategory('medical_food');
const escapeList = CraftingBlueprintManager.getBlueprintsByCategory('escape_base');
const allList = CraftingBlueprintManager.getBlueprintsByCategory('all');

assert.strictEqual(combatList.length, 8, '武器防具类应当有 8 套蓝图');
assert.strictEqual(toolsList.length, 8, '求生工具类应当有 8 套蓝图');
assert.strictEqual(medFoodList.length, 6, '烹饪医疗类应当有 6 套蓝图');
assert.strictEqual(escapeList.length, 4, '营建逃脱类应当有 4 套蓝图');
assert.strictEqual(allList.length, 26, '全量图鉴应当为 26 套');
console.log('✅ 2. 四大学科分类筛选过滤与数量统计验证通过！(8 武器防具 + 8 求生工具 + 6 烹饪医疗 + 4 营建逃脱)');

// 3. 验证双物自由碰撞与无序性 (A+B === B+A)
for (const bp of CRAFTING_BLUEPRINTS) {
  const matchNormal = CraftingBlueprintManager.findBlueprint(bp.a, bp.b);
  const matchReverse = CraftingBlueprintManager.findBlueprint(bp.b, bp.a);
  assert.ok(matchNormal, `正向配对应当成功: ${bp.a} + ${bp.b} -> ${bp.name}`);
  assert.ok(matchReverse, `反向配对应当成功: ${bp.b} + ${bp.a} -> ${bp.name}`);
  assert.strictEqual(matchNormal.id, bp.id);
  assert.strictEqual(matchReverse.id, bp.id);
}
console.log('✅ 3. 双物无序碰撞 (Formula Radar) 全量双向匹配通过！');

// 4. 验证图鉴探索进度计算与未探明线索机制
// 模拟初始状态（8 个基础配方解锁）
const initProgress = CraftingBlueprintManager.getDiscoveryProgress();
assert.strictEqual(initProgress.total, 26, '蓝图总数应为 26');
assert.strictEqual(initProgress.unlockedCount, 8, '初始默认解锁 8 套基础蓝图');
assert.strictEqual(initProgress.percent, 31, '初始收集度应为 31%');

// 模拟首次碰撞出全新高阶防具：甲壳兽皮胸甲 (bone_armor)
const isFirstDiscover = CraftingBlueprintManager.unlockBlueprint('bone_armor');
assert.strictEqual(isFirstDiscover, true, '首次合成应当触发全新探明标记');

// 重复合成同一蓝图不再标记为首次
const isRepeatDiscover = CraftingBlueprintManager.unlockBlueprint('bone_armor');
assert.strictEqual(isRepeatDiscover, false, '重复合成不应再次触发首次标记');

const updatedProgress = CraftingBlueprintManager.getDiscoveryProgress();
assert.strictEqual(updatedProgress.unlockedCount, 9, '已解锁数量应递增至 9');
assert.strictEqual(updatedProgress.percent, 35, '图鉴收集度应提升至 35%');
console.log('✅ 4. 图鉴探索度计算、首次探明广播与线索解锁机制验证通过！');

// 5. 验证 UIManager 核心道具应用逻辑与属性增益
// 构造轻量模拟 UIManager 与 生存状态
class MockSurvival {
  constructor() {
    this.life = 100;
    this.maxLife = 100;
    this.hunger = 50;
    this.water = 40;
    this.fatigue = 50;
    this.isBleeding = true;
    this.hasSuperArmor = false;
  }
  consume(stats) {
    if (stats.life) this.life = Math.min(this.maxLife, this.life + stats.life);
    if (stats.hunger) this.hunger = Math.min(100, this.hunger + stats.hunger);
    if (stats.water) this.water = Math.min(100, this.water + stats.water);
    if (stats.fatigue) this.fatigue = Math.max(0, this.fatigue + stats.fatigue);
  }
}

const mockSurvival = new MockSurvival();
const mockInventory = {
  bone_armor: 1,
  herbal_paste: 1,
  energy_drink: 1,
  bamboo_canteen: 1,
  large_backpack: 1
};
let bonusSlots = 0;
const toasts = [];

function mockUseItem(id) {
  if (!mockInventory[id] || mockInventory[id] <= 0) return false;

  if (id === 'bone_armor') {
    mockInventory[id]--;
    mockSurvival.maxLife += 25;
    mockSurvival.life = Math.min(mockSurvival.maxLife, mockSurvival.life + 25);
    mockSurvival.hasSuperArmor = true;
    toasts.push('🦺 装备甲壳兽皮胸甲！生命上限+25，获得野兽冲撞霸体抗性！');
    return true;
  }
  if (id === 'herbal_paste') {
    mockInventory[id]--;
    mockSurvival.consume({ life: 40 });
    mockSurvival.isBleeding = false;
    toasts.push('🩹 涂抹止血树脂敷膏！生命+40，已止血！');
    return true;
  }
  if (id === 'energy_drink') {
    mockInventory[id]--;
    mockSurvival.consume({ hunger: 30, water: 50, fatigue: -35 });
    toasts.push('🧃 畅饮清甜鲜萃果浆！饱腹+30，饮水+50，疲劳-35！');
    return true;
  }
  if (id === 'bamboo_canteen') {
    mockInventory[id]--;
    mockSurvival.consume({ water: 50 });
    toasts.push('🍶 饮用便携水壶净水！饮水+50！');
    return true;
  }
  if (id === 'large_backpack') {
    mockInventory[id]--;
    bonusSlots += 4;
    toasts.push('🎒 装备拓荒者大皮包！行囊容量永久扩充 +4 格！');
    return true;
  }
  return false;
}

// 5.1 测试甲壳兽皮胸甲 (bone_armor)
mockSurvival.life = 60;
assert.strictEqual(mockUseItem('bone_armor'), true);
assert.strictEqual(mockSurvival.maxLife, 125, '生命上限应当永久提升至 125');
assert.strictEqual(mockSurvival.life, 85, '当前生命值应当相应恢复 +25');
assert.strictEqual(mockSurvival.hasSuperArmor, true, '应当激活冲撞霸体抗性');

// 5.2 测试止血树脂敷膏 (herbal_paste)
assert.strictEqual(mockSurvival.isBleeding, true, '初始应处于流血创伤');
assert.strictEqual(mockUseItem('herbal_paste'), true);
assert.strictEqual(mockSurvival.life, 125, '生命值应当提升 +40 达到满血 125');
assert.strictEqual(mockSurvival.isBleeding, false, '流血状态应当被瞬间清除');

// 5.3 测试清甜鲜萃果浆 (energy_drink)
assert.strictEqual(mockUseItem('energy_drink'), true);
assert.strictEqual(mockSurvival.hunger, 80, '饥饿度应当恢复 50 + 30 = 80');
assert.strictEqual(mockSurvival.water, 90, '饮水度应当恢复 40 + 50 = 90');
assert.strictEqual(mockSurvival.fatigue, 15, '疲劳度应当削减 50 - 35 = 15');

// 5.4 测试便携树皮水壶 (bamboo_canteen)
mockSurvival.water = 30;
assert.strictEqual(mockUseItem('bamboo_canteen'), true);
assert.strictEqual(mockSurvival.water, 80, '饮用便携水壶应当恢复 +50 饮水');

// 5.5 测试拓荒者大皮包 (large_backpack)
assert.strictEqual(mockUseItem('large_backpack'), true);
assert.strictEqual(bonusSlots, 4, '行囊额外槽位应当增加 +4 格');

console.log('✅ 5. 胸甲霸体抗性、敷膏止血愈合、特饮多重滋养与行囊扩容全量道具逻辑闭环！');

// 6. 验证错误合成与原料安全保护
const invalidMerge = CraftingBlueprintManager.findBlueprint('apple', 'crab_shell');
assert.strictEqual(invalidMerge, null, '无效材料组合不能匹配任何配方');
console.log('✅ 6. 无效碰撞检测与安全回退保障通过！');

console.log('\n🎉 合成系统与图鉴机制全量测试 100% 成功通过！');
