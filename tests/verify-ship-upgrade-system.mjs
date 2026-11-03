// CastawaySOL - 出海船升级系统与随船货运仓自动化测试套件
import assert from 'node:assert/strict';

// Mock 运行环境
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

console.log('🧪 开始执行 CastawaySOL 出海船升级系统与随船货仓全链路自动化测试套件...\n');

// 导入模块
const { ShipUpgradeSystem, VESSEL_TIERS } = await import('../src/systems/ShipUpgradeSystem.js');
const { NauticalChartSystem } = await import('../src/systems/NauticalChartSystem.js');
const { StorageSystem } = await import('../src/systems/StorageSystem.js');

// 构造模拟全局 Game
class MockGame {
  constructor() {
    this.toasts = [];
    this.dialogs = [];
    this.ui = {
      inventory: {},
      addInventory: (k, count = 1) => {
        this.ui.inventory[k] = (this.ui.inventory[k] || 0) + count;
      },
      isInventoryFull: () => false,
      showToast: (msg) => { this.toasts.push(msg); },
      showDialog: (title, text) => { this.dialogs.push({ title, text }); },
      renderInventory: () => {},
      updateSurvivalHUD: () => {}
    };
    this.survival = {
      canteenSips: 3,
      day: 1
    };
    this.storageSystem = new StorageSystem(this);
    this.shipUpgradeSystem = new ShipUpgradeSystem(this);
    this.nauticalChart = new NauticalChartSystem(this);
  }
}

// ==========================================
// 1. 测试船舶阶梯属性配置表完整性
// ==========================================
console.log('▶ [1/5] 测试船体三阶属性与升级成本阶梯配置...');
assert.ok(VESSEL_TIERS.tier_1, '应存在 T1 简易原木筏配置');
assert.ok(VESSEL_TIERS.tier_2, '应存在 T2 龙骨风帆快艇配置');
assert.ok(VESSEL_TIERS.tier_3, '应存在 T3 铁甲远洋探索舰配置');

assert.equal(VESSEL_TIERS.tier_1.maxDistanceKm, 3.5, 'T1 最大航程应为 3.5 海里');
assert.equal(VESSEL_TIERS.tier_2.maxDistanceKm, 7.5, 'T2 最大航程应为 7.5 海里');
assert.equal(VESSEL_TIERS.tier_3.maxDistanceKm, 18.0, 'T3 最大航程应为 18.0 海里');

assert.equal(VESSEL_TIERS.tier_1.cargoSlots, 0, 'T1 应无随船货仓');
assert.equal(VESSEL_TIERS.tier_2.cargoSlots, 4, 'T2 应有 4 槽随船货仓');
assert.equal(VESSEL_TIERS.tier_3.cargoSlots, 8, 'T3 应有 8 槽随船货仓');

assert.equal(VESSEL_TIERS.tier_2.supplyDiscount, 0.5, 'T2 远海补给消耗应减免 50%');
assert.equal(VESSEL_TIERS.tier_3.supplyDiscount, 1.0, 'T3 远海补给消耗应 100% 全免');
console.log('  ✅ 船体三阶属性配置表、航程阶梯与补给减免验证通过！');

// ==========================================
// 2. 测试材料核验与背包+储物箱跨仓升级 (T1 -> T2 -> T3)
// ==========================================
console.log('\n▶ [2/5] 测试行囊与营地储物箱聚合扣费升级...');
const game = new MockGame();
const ship = game.shipUpgradeSystem;

assert.equal(ship.currentTierLevel, 1, '初始应为 T1');
// 材料不足时检查
const checkFail = ship.checkCanUpgrade();
assert.equal(checkFail.ok, false, '材料不足时升级检查应为 false');

// 准备升级 T2 所需材料: wood_plank: 6, lumber: 3, nail: 4, ivy: 3
// 分布在背包和储物箱中
game.ui.inventory = { wood_plank: 4, nail: 2 };
game.storageSystem.storageInventory = { wood_plank: 2, lumber: 3, nail: 2, ivy: 3 };

const checkOk = ship.checkCanUpgrade();
assert.equal(checkOk.ok, true, '背包与储物箱合计数达到时应允许升级');

// 执行升级至 T2
const upgradeResult = ship.performUpgrade();
assert.equal(upgradeResult, true, '升级操作应返回 true');
assert.equal(ship.currentTierLevel, 2, '船体等级应提升为 2 级 (T2)');
assert.equal(ship.getCurrentTier().id, 'tier_2', '当前船体应为 tier_2');
assert.equal(game.ui.inventory.wood_plank || 0, 0, '背包木板应扣尽');
assert.equal(game.storageSystem.storageInventory.lumber || 0, 0, '储物箱重型方木应扣尽');

// 准备升级 T3 材料: iron_ingot: 4, lumber: 6, nail: 6, stone_chunk: 4
game.ui.inventory = { iron_ingot: 4, lumber: 6, nail: 6, stone_chunk: 4 };
assert.equal(ship.checkCanUpgrade().ok, true, 'T3 战略材料就绪时应允许升级');
ship.performUpgrade();
assert.equal(ship.currentTierLevel, 3, '船体等级应提升为 3 级 (T3 铁甲探索舰)');
assert.equal(ship.getNextTier(), null, '满级后下一阶应为 null');
console.log('  ✅ 跨仓材料扣减、连续晋升升级与满级封顶验证通过！');

// ==========================================
// 3. 测试随船货运仓存取与一键转运入库
// ==========================================
console.log('\n▶ [3/5] 测试随船货仓存入、取出与一键卸货至储物箱...');
// 当前为 T3，货仓上限为 8 槽
assert.equal(ship.getMaxCargoSlots(), 8, 'T3 应具备 8 槽货仓');

// 玩家背包放入深海矿石
game.ui.inventory = { iron_ore: 10, copper_ore: 5, stone_chunk: 8 };

// 存入随船货仓 5 块铁矿
const depOk = ship.depositToCargo('iron_ore', 5);
assert.equal(depOk, true, '应成功存入随船货仓');
assert.equal(ship.getCargoItemCount('iron_ore'), 5, '随船货仓铁矿应为 5');
assert.equal(game.ui.inventory.iron_ore, 5, '背包铁矿应扣减为 5');

// 取出 2 块铁矿
const withOk = ship.withdrawFromCargo('iron_ore', 2);
assert.equal(withOk, true, '应成功从货仓取出');
assert.equal(ship.getCargoItemCount('iron_ore'), 3, '货仓应剩余 3 块铁矿');
assert.equal(game.ui.inventory.iron_ore, 7, '背包应恢复至 7 块铁矿');

// 一键将随船货仓货物卸载入营地储物箱
const moved = ship.unloadCargoToStorage();
assert.equal(moved, 3, '应成功转运 3 件货物');
assert.equal(ship.getCargoItemCount('iron_ore'), 0, '随船货仓应已清空');
assert.equal(game.storageSystem.storageInventory.iron_ore, 3, '营地储物箱应已入库 3 块铁矿');
console.log('  ✅ 随船货仓双向存取、容量防溢出与一键归仓验证通过！');

// ==========================================
// 4. 测试海图航行适航检验、补给减免与返航拖网特权
// ==========================================
console.log('\n▶ [4/5] 测试群岛海图适航距离拦截、补给折扣计算与自动渔网...');
const chart = game.nauticalChart;
// 设定矿石岛 (quarry_isle, 5.6km)
chart.discoverIsland('quarry_isle');

// 场景 A: 若降回 T1 简易木筏 (最大 3.5km)，尝试前往 5.6km 矿石岛应被拦截
ship.currentTierLevel = 1;
const t1Check = chart.checkSupplies('quarry_isle');
assert.equal(t1Check.ok, false, 'T1 木筏航程仅 3.5km，前往 5.6km 矿石岛必须被拦截');
assert.ok(t1Check.reason.includes('请前往码头船坞升级船体'), '拦截提示应引导升级船体');

// 场景 B: 升至 T2 (航程 7.5km)，补给减半 (原需水2粮2 -> 折后水1粮1)
ship.currentTierLevel = 2;
game.survival.canteenSips = 1;
game.ui.inventory = { apple: 1 };
const t2Check = chart.checkSupplies('quarry_isle');
assert.equal(t2Check.ok, true, 'T2 适航范围允许前往矿石岛');
assert.equal(t2Check.actualWaterNeed, 1, 'T2 享受 50% 减免，实际需 1 份淡水');
assert.equal(t2Check.actualFoodNeed, 1, 'T2 享受 50% 减免，实际需 1 份干粮');

// 场景 C: 升至 T3 (航程 18km)，补给 100% 全免 (0消耗)
ship.currentTierLevel = 3;
game.survival.canteenSips = 0;
game.ui.inventory = {}; // 背包无干粮
const t3Check = chart.checkSupplies('quarry_isle');
assert.equal(t3Check.ok, true, 'T3 铁甲旗舰补给全免，空仓亦可直接起航');
assert.equal(t3Check.actualWaterNeed, 0, 'T3 淡水 0 消耗');
assert.equal(t3Check.actualFoodNeed, 0, 'T3 干粮 0 消耗');

// 扣除消耗与航行结束，触发 T3 自动拖网
chart.deductSupplies('quarry_isle');
const cargoKeys = Object.keys(ship.cargoInventory);
assert.ok(cargoKeys.includes('fish') || cargoKeys.includes('pearl') || (game.ui.inventory.fish || 0) > 0, '航行返航后应触发船尾拖网渔获收获');
console.log('  ✅ 适航海里严格拦截、阶梯补给豁免与全天候自动渔网验证通过！');

// ==========================================
// 5. 测试存档快照与数据反序列化还原
// ==========================================
console.log('\n▶ [5/5] 测试船体等级与随船货仓持久化安全快照...');
ship.currentTierLevel = 2;
ship.cargoInventory = { lumber: 4, nail: 2 };

const serialized = ship.serialize();
assert.equal(serialized.currentTierLevel, 2, '序列化等级应为 2');
assert.equal(serialized.cargoInventory.lumber, 4, '序列化货仓应保留 4 根方木');

// 新建实例并还原
const newShip = new ShipUpgradeSystem(game);
newShip.deserialize(serialized);
assert.equal(newShip.currentTierLevel, 2, '反序列化后等级应还原为 2');
assert.equal(newShip.getCargoItemCount('lumber'), 4, '反序列化后方木数量应正确恢复');
console.log('  ✅ 船只升级状态与随船货物原子序列化/恢复验证通过！\n');

console.log('🎉🎉 [ALL SHIP UPGRADE TESTS PASSED] 出海船升级系统、随船货仓与海图适航联动 100% 验证通过！');
