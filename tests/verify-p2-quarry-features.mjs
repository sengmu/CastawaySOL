// CastawaySOL - P2 阶段海蚀矿石岛、采矿工具与熔炼前哨全流程自动化测试套件
import assert from 'node:assert/strict';

// Mock 基础运行环境
class MockVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }
  distanceTo(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const dz = this.z - other.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  fromArray(arr) { this.x = arr[0]; this.y = arr[1]; this.z = arr[2]; return this; }
}

globalThis.window = {
  localStorage: {
    store: {},
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; }
  },
  addEventListener() {}
};
globalThis.localStorage = globalThis.window.localStorage;
globalThis.document = {
  createElement() {
    return {
      style: {},
      classList: { toggle: () => {}, remove: () => {} },
      appendChild() {},
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      setAttribute() {}
    };
  },
  body: { appendChild() {} },
  getElementById() { return null; }
};

console.log('🧪 开始执行 CastawaySOL P2 海蚀矿石岛与冶炼前哨自动化测试套件...\n');

// 导入模块
const { QuarryIsleScene } = await import('../src/island/QuarryIsleScene.js');
const { CraftingSystem } = await import('../src/systems/CraftingSystem.js');
const { NauticalChartSystem } = await import('../src/systems/NauticalChartSystem.js');
const { CampFacilitiesSystem } = await import('../src/systems/CampFacilitiesSystem.js');
const { StorageSystem } = await import('../src/systems/StorageSystem.js');

// 构造模拟全局 Game 状态
class MockGame {
  constructor() {
    this.toasts = [];
    this.dialogs = [];
    this.ui = {
      inventory: {},
      addInventory: (k, count = 1) => {
        this.ui.inventory[k] = (this.ui.inventory[k] || 0) + count;
      },
      showToast: (msg) => { this.toasts.push(msg); },
      showDialog: (title, text) => { this.dialogs.push({ title, text }); },
      renderInventory: () => {},
      updateSurvivalHUD: () => {}
    };
    this.survival = {
      canteenSips: 3,
      day: 2
    };
    this.storageSystem = new StorageSystem(this);
    this.campFacilities = new CampFacilitiesSystem(this);
    this.nauticalChart = new NauticalChartSystem(this);
    this.crafting = new CraftingSystem();
  }
}

// ==========================================
// 1. 测试采矿工具与高温冶炼配方
// ==========================================
console.log('▶ [1/4] 测试采矿镐制作与纯铁锭高温熔炼配方...');
const game = new MockGame();
const crafting = game.crafting;

// 检查配方存在性
const pickaxeRecipe = crafting.recipes.find(r => r.id === 'stone_pickaxe');
const ironIngotRecipe = crafting.recipes.find(r => r.id === 'iron_ingot');
assert.ok(pickaxeRecipe, '应存在骨柄石镐合成配方');
assert.ok(ironIngotRecipe, '应存在高温冶炼铁锭配方');

// 模拟合成骨柄石镐 (tree_branch: 1, stone_chunk: 2, ivy: 1)
game.ui.inventory = { tree_branch: 2, stone_chunk: 3, ivy: 1 };
assert.equal(crafting.canCraft('stone_pickaxe', game.ui.inventory), true, '原料充足时应能制作石镐');
crafting.craft('stone_pickaxe', game.ui.inventory);
assert.equal(game.ui.inventory.stone_pickaxe, 1, '背包中应获得 1 把骨柄石镐');
assert.equal(game.ui.inventory.stone_chunk, 1, '燧石应正确扣除 2 块');

// 模拟冶炼精密铁锭 (iron_ore: 2, tree_branch: 2)
game.ui.inventory.iron_ore = 4;
game.ui.inventory.tree_branch = 3;
assert.equal(crafting.canCraft('iron_ingot', game.ui.inventory), true, '原料充足时应能冶炼铁锭');
crafting.craft('iron_ingot', game.ui.inventory);
assert.equal(game.ui.inventory.iron_ingot, 1, '背包中应成功产出 1 块精密铁锭');
assert.equal(game.ui.inventory.iron_ore, 2, '富铁矿石应扣除 2 块');
console.log('  ✅ 采矿工具合成、材料扣除与高温铁锭冶炼配方验证通过！');

// ==========================================
// 2. 测试矿石岛 3D 场景与采矿权限交互
// ==========================================
console.log('\n▶ [2/4] 测试海蚀矿石岛场景装配与采矿条件限制...');
const mockScene = { add() {}, remove() {} };
const quarryScene = new QuarryIsleScene(mockScene, game);

assert.ok(quarryScene.islandResources.length >= 6, '矿石岛上应至少分布 6 处矿石与地表原石');
const ironVein = quarryScene.islandResources.find(r => r.type === 'iron_ore' && r.isVein);
assert.ok(ironVein, '应存在露天大型富铁矿脉');

// 未装备石镐时尝试开采大型矿脉
delete game.ui.inventory.stone_pickaxe;
delete game.ui.inventory.iron_pickaxe;
const playerAtVein = new MockVector3(...ironVein.pos);
const minedWithoutTool = quarryScene.checkMineOrPickup(playerAtVein, () => {});
assert.equal(minedWithoutTool, null, '未装备石镐时应无法开采大型富铁矿脉');

// 装备石镐后开采
game.ui.inventory.stone_pickaxe = 1;
let minedResult = null;
const minedWithTool = quarryScene.checkMineOrPickup(playerAtVein, (type, name) => {
  minedResult = { type, name };
});
assert.ok(minedWithTool, '装备石镐后应成功开采');
assert.equal(minedResult.type, 'iron_ore', '开采出的物资类型应为富铁矿石');
assert.equal(minedWithTool.collected, true, '该矿脉应标记为已采集状态');
console.log('  ✅ 矿石岛场景实体装配、硬性工具开采鉴权验证通过！');

// ==========================================
// 3. 测试矿业前哨插旗开拓与每日清晨矿产回运
// ==========================================
console.log('\n▶ [3/4] 测试矿业前哨开拓与每日晨报清算物流...');
// 准备前哨建材: wood_plank: 2, stone_chunk: 2, nail: 1
game.ui.inventory = { wood_plank: 3, stone_chunk: 3, nail: 2 };
assert.equal(quarryScene.outpostClaimed, false, '初始前哨未开拓');

quarryScene.claimOutpost();
assert.equal(quarryScene.outpostClaimed, true, '插旗后前哨应标记为已建立');
assert.equal(game.nauticalChart.islands.quarry_isle.outpostBuilt, true, '海图应同步记录矿业前哨建立');

// 模拟过夜休息触发清晨晨报结算
const storage = game.storageSystem.storageInventory;
const prevIron = storage.iron_ore || 0;
const prevStone = storage.stone_chunk || 0;

game.campFacilities.onDayPassed();
assert.equal(storage.iron_ore, prevIron + 2, '矿业前哨每日拂晓应自动回运 2 份富铁矿石');
assert.equal(storage.stone_chunk, prevStone + 2, '矿业前哨每日拂晓应自动回运 2 份玄武原石');

// 看板状态检查
const overview = game.campFacilities.getSupplyDemandOverview();
assert.equal(overview.quarryOutpost, true, '供需看板中矿业前哨状态应为激活');
console.log('  ✅ 矿业前哨插旗开拓、拂晓晨报自动回运与供需看板同步验证通过！');

// ==========================================
// 4. 测试海图航行与远海矿石岛探索闭环
// ==========================================
console.log('\n▶ [4/4] 测试海图航海解锁、远航补给检验与跨岛状态...');
const chart = game.nauticalChart;
assert.equal(chart.islands.quarry_isle.discovered, false, '矿石岛默认未探明');

// 学者雷蒙德入驻后解锁矿石岛
chart.discoverIsland('quarry_isle');
assert.equal(chart.islands.quarry_isle.discovered, true, '学者雷蒙德入驻后海图应标记矿石岛');

// 补给检查 (矿石岛需要 food: 2, water: 2)
game.ui.inventory = { apple: 1 };
game.survival.canteenSips = 1;
const checkFail = chart.checkSupplies('quarry_isle');
assert.equal(checkFail.ok, false, '补给不足时不应允许出海远航');

// 补齐食物与水壶纯水
game.ui.inventory = { apple: 3 };
game.survival.canteenSips = 3;
const checkSuccess = chart.checkSupplies('quarry_isle');
assert.equal(checkSuccess.ok, true, '备足干粮与饮水时应允许起航');

// 扣除出海远航消耗
chart.deductSupplies('quarry_isle');
assert.equal(game.survival.canteenSips, 1, '航行后水壶应扣除 2 份淡水 (3 - 2 = 1)');
assert.equal(game.ui.inventory.apple, 1, '航行后背包应扣除 2 份苹果 (3 - 2 = 1)');
console.log('  ✅ 海图远海探索解锁、严格补给防死锁核验与消耗闭环验证通过！\n');

console.log('🎉🎉 [ALL P2 TESTS PASSED] 海蚀矿石岛、采矿工具、熔炼配方与前哨物流 100% 验证通过！');
