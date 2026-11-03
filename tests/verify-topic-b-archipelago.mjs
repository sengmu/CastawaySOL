// CastawaySOL - 专题 B（群岛航海终局补完：第 3 外岛与动态生态）全链路验证测试
import assert from 'node:assert/strict';
import * as THREE from 'three';

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
  createElement(tag) {
    if (tag === 'canvas') {
      return {
        width: 256,
        height: 64,
        style: {},
        getContext() {
          return {
            clearRect() {},
            fillRect() {},
            strokeRect() {},
            beginPath() {},
            arc() {},
            fill() {},
            stroke() {},
            fillText() {},
            strokeText() {},
            measureText() { return { width: 40 }; }
          };
        }
      };
    }
    return {
      style: {},
      classList: { toggle: () => {}, remove: () => {}, add: () => {} },
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

const { EconomyLedger } = await import('../src/systems/EconomyLedger.js');
// Node 环境无法加载 DAE 模型文件，与主线测试一致替换为空模型
const { modelLoader } = await import('../src/core/ModelLoader.js');
modelLoader.loadModel = async () => new THREE.Group();
const { NauticalChartSystem } = await import('../src/systems/NauticalChartSystem.js');
const { ShipUpgradeSystem } = await import('../src/systems/ShipUpgradeSystem.js');
const { StorageSystem } = await import('../src/systems/StorageSystem.js');
const { CampFacilitiesSystem } = await import('../src/systems/CampFacilitiesSystem.js');
const { MistReefIsleScene } = await import('../src/island/MistReefIsleScene.js');
const { TimberIsleScene } = await import('../src/island/TimberIsleScene.js');
const { QuarryIsleScene } = await import('../src/island/QuarryIsleScene.js');
const { WildlifeCombatSystem } = await import('../src/systems/WildlifeCombatSystem.js');
const { SaveSystem } = await import('../src/systems/SaveSystem.js');

console.log('🧪 开始执行专题 B（群岛航海终局补完与动态生态）自动化验证...');

// 构造轻量模拟游戏容器
const scene = new THREE.Scene();
const game = {
  scene,
  currentIslandId: 'main_island',
  player: { position: new THREE.Vector3(0, 0, 5), rotation: 0 },
  survival: { life: 100, hunger: 80, water: 80, fatigue: 10, day: 1, steps: 0, canteenSips: 3, isDead: false, updateSurvivalHUD() {} },
  story: {
    currentChapterId: 5,
    lighthouseLit: false,
    serialize() { return { currentChapterId: this.currentChapterId, lighthouseLit: this.lighthouseLit }; },
    deserialize(d) { if (d) { this.currentChapterId = d.currentChapterId; this.lighthouseLit = Boolean(d.lighthouseLit); } }
  },
  lighthouse: { isLit: false, phase2Complete: false, serialize() { return { isLit: this.isLit, phase2Complete: this.phase2Complete }; }, deserialize(d) { if (d) { this.isLit = Boolean(d.isLit); this.phase2Complete = Boolean(d.phase2Complete); } } },
  miningRig: {
    loadedCrystals: 0,
    loadedPureCrystals: 0,
    shardCount: 0,
    solDust: 0,
    unclaimedSol: 0,
    totalBlocksMined: 0,
    totalSolMined: 0,
    rigLevel: 1,
    scannerLevel: 0,
    serialize() { return { loadedCrystals: this.loadedCrystals, loadedPureCrystals: this.loadedPureCrystals, shardCount: this.shardCount, solDust: this.solDust, unclaimedSol: 0, totalBlocksMined: 0, totalSolMined: 0 }; },
    deserialize(d) { Object.assign(this, d); }
  },
  setMainIslandVisible() {}
};

game.ui = {
  inventory: {},
  bonusInventorySlots: 0,
  isFullFlag: false,
  isInventoryFull() { return this.isFullFlag; },
  addInventory(k, count = 1, source = null) {
    if (source && k === 'sol_crystal') {
      game.economyLedger.credit('sol_crystal', count, source, this.inventory, 'sol_crystal');
      return true;
    }
    this.inventory[k] = (this.inventory[k] || 0) + count;
    return true;
  },
  getItemName(k) { return k; },
  renderInventory() {},
  updateSurvivalHUD() {},
  showToast() {},
  showDialog() {}
};

game.economyLedger = new EconomyLedger(game);
game.storageSystem = new StorageSystem(game);
game.shipUpgradeSystem = new ShipUpgradeSystem(game);
game.nauticalChart = new NauticalChartSystem(game);
game.campFacilities = new CampFacilitiesSystem(game);
game.timberIsleScene = new TimberIsleScene(scene, game);
game.quarryIsleScene = new QuarryIsleScene(scene, game);
game.mistReefIsleScene = new MistReefIsleScene(scene, game);
game.wildlifeCombat = new WildlifeCombatSystem(game);
game.saveSystem = new SaveSystem(game);

// 1. 验证双锁远洋航线（北崖灯塔一期 + T3 探索舰）
assert.equal(game.nauticalChart.islands.mist_reef_isle.discovered, false, '初始晶雾回声岛未探明');
game.lighthouse.isLit = true;
game.nauticalChart.syncEndgameRoutes();
assert.equal(game.nauticalChart.islands.mist_reef_isle.discovered, true, '点亮北崖灯塔一期后应自动探明晶雾回声岛');

game.shipUpgradeSystem.currentTierLevel = 2;
const blockedByTier = game.nauticalChart.checkSupplies('mist_reef_isle');
assert.equal(blockedByTier.ok, false, 'T2 风帆艇前往晶雾回声岛应被船体阶梯拦截');

game.shipUpgradeSystem.currentTierLevel = 3;
game.lighthouse.isLit = false;
const blockedByLighthouse = game.nauticalChart.checkSupplies('mist_reef_isle');
assert.equal(blockedByLighthouse.ok, false, '灯塔未点亮时即使拥有 T3 探索舰也必须拦截');

game.lighthouse.isLit = true;
const sailReady = game.nauticalChart.checkSupplies('mist_reef_isle');
assert.equal(sailReady.ok, true, '双锁均达成后可正常起航前往晶雾回声岛');
console.log('  ✅ [1/5] 晶雾回声岛双锁校验验证通过');

// 2. 验证满包自动转存随船货仓 & T3 拖网产出修复（无死胡同 diamond_gem）
game.ui.isFullFlag = true;
const storedOk = game.shipUpgradeSystem.collectOutlyingResource('copper_ore', 2, '孔雀铜矿');
assert.equal(storedOk, true, '行囊满时普通外岛矿产应自动转存入 T3 随船货仓');
assert.equal(game.shipUpgradeSystem.cargoInventory.copper_ore, 2, '随船货仓应记录 2 块铜矿');
game.ui.isFullFlag = false;

for (let i = 0; i < 30; i++) {
  const drop = game.shipUpgradeSystem.onVoyageCompleted();
  assert.ok(drop.key === 'fish' || drop.key === 'pearl', `拖网产出仅允许 fish 或 pearl，实际为 ${drop.key}`);
}
console.log('  ✅ [2/5] 满包自动入随船仓与 T3 拖网珍珠修复验证通过');

// 3. 验证三座外岛分级跨天再生与唯一藏宝图不再生
game.survival.day = 5;
game.ui.inventory.stone_pickaxe = 1;

const deepRes = game.mistReefIsleScene.islandResources.find(r => r.id === 'mri_deep_1');
const mapRes = game.mistReefIsleScene.islandResources.find(r => r.id === 'mri_map_piece');
const solVein = game.mistReefIsleScene.islandResources.find(r => r.id === 'mri_sol_vein_1');

game.mistReefIsleScene.checkMineOrPickup(deepRes.group.position.clone(), (k, name, src) => game.shipUpgradeSystem.collectOutlyingResource(k, 1, name, src));
game.mistReefIsleScene.checkMineOrPickup(mapRes.group.position.clone(), (k, name, src) => game.shipUpgradeSystem.collectOutlyingResource(k, 1, name, src));
game.mistReefIsleScene.checkMineOrPickup(solVein.group.position.clone(), (k, name, src) => game.shipUpgradeSystem.collectOutlyingResource(k, 1, name, src));

assert.equal(deepRes.collected, true, '深层海脉晶核已开采');
assert.equal(mapRes.collected, true, '藏宝图残片已拾取');
assert.equal(game.ui.inventory.sol_crystal, 1, '晶雾岛硅晶矿脉应通过 vein_mine 合法入账');

// 推进 3 天（第 8 天）：sol_crystal (+3d) 应再生，sol_crystal_deep (+4d) 尚未再生
game.survival.day = 8;
game.mistReefIsleScene.onDayPassed(8);
assert.equal(solVein.collected, false, '+3 天后硅晶露头应恢复再生');
assert.equal(deepRes.collected, true, '+3 天时深层晶核（4天周期）尚未再生');

// 推进至第 9 天：sol_crystal_deep (+4d) 恢复，藏宝图残片保持不再生
game.survival.day = 9;
game.mistReefIsleScene.onDayPassed(9);
assert.equal(deepRes.collected, false, '+4 天后深层海脉晶核应恢复再生');
assert.equal(mapRes.collected, true, '唯一保底藏宝图残片永久不再生');
console.log('  ✅ [3/5] 外岛分级跨天再生与唯一掉落保护验证通过');

// 4. 验证外岛特有晶兽作用域隔离、玄武岩甲蜥正面减伤、晶簇棱背蟹 sol_shard 账本凝结与 +2 天再生
game.wildlifeCombat.setActiveIsland('mist_reef_isle');
const homeCrab = game.wildlifeCombat.wildlifeList.find(m => m.id === 'crab_1');
const mistCrab1 = game.wildlifeCombat.wildlifeList.find(m => m.id === 'mri_crab_1');
const mistCrab2 = game.wildlifeCombat.wildlifeList.find(m => m.id === 'mri_crab_2');
const quarryLizard = game.wildlifeCombat.wildlifeList.find(m => m.id === 'qi_lizard_1');

assert.equal(homeCrab.group.visible, false, '处于晶雾岛时主岛巨蟹应隐藏');
assert.equal(mistCrab1.group.visible, true, '处于晶雾岛时晶簇棱背蟹应可见');

// 第一轮击杀两只晶簇棱背蟹（每只掉 1 枚 sol_shard，共入账 2 枚）
const hitVec = new THREE.Vector3(0, 0, 1);
game.wildlifeCombat.applyDamageToMob(mistCrab1, 500, hitVec, 0.5, 'melee');
game.wildlifeCombat.applyDamageToMob(mistCrab2, 500, hitVec, 0.5, 'melee');
for (const drop of game.wildlifeCombat.lootDrops.filter(d => !d.picked)) {
  game.wildlifeCombat.checkLootPickup(drop.group.position.clone());
}
assert.equal(game.miningRig.shardCount, 2, '首轮击杀两只晶蟹应入账 2 枚共鸣碎晶');
assert.equal(game.miningRig.loadedCrystals, 0, '未满 4 枚时尚未凝结');

// 验证矿石岛玄武岩甲蜥正面近战 30% 减伤（朝向默认 +Z，攻击方向 -Z 即迎面劈砍 cos = -1 < -0.25）
game.wildlifeCombat.setActiveIsland('quarry_isle');
quarryLizard.group.rotation.y = 0; // 正面朝 +Z
const lizardInitHp = quarryLizard.hp;
game.wildlifeCombat.applyDamageToMob(quarryLizard, 50, new THREE.Vector3(0, 0, -1), 0, 'melee');
assert.equal(quarryLizard.hp, lizardInitHp - 35, '迎面近战攻击玄武岩甲蜥应触发 30% 甲壳减伤（50 -> 35）');
game.wildlifeCombat.setActiveIsland('mist_reef_isle');

// 验证 +2 天晶兽复活，随后第二轮击杀两只凑满 4 枚自动凝结为 1 枚 loadedCrystals
assert.equal(mistCrab1.isDead, true, '击败当天处于死亡冷却');
game.survival.day = 10;
game.wildlifeCombat.onDayPassed(10);
assert.equal(mistCrab1.isDead, true, '+1 天尚未复活');
game.survival.day = 11;
game.wildlifeCombat.onDayPassed(11);
assert.equal(mistCrab1.isDead, false, '+2 天后外岛晶兽应满血再生');
assert.equal(mistCrab1.hp, mistCrab1.maxHp, '再生后生命值应回满');

game.wildlifeCombat.applyDamageToMob(mistCrab1, 500, hitVec, 0.5, 'melee');
game.wildlifeCombat.applyDamageToMob(mistCrab2, 500, hitVec, 0.5, 'melee');
for (const drop of game.wildlifeCombat.lootDrops.filter(d => !d.picked)) {
  game.wildlifeCombat.checkLootPickup(drop.group.position.clone());
}
assert.equal(game.miningRig.shardCount, 0, '集满 4 枚碎晶后碎晶槽应归零');
assert.equal(game.miningRig.loadedCrystals, 1, '4 枚碎晶应通过 shard_condense 自动凝结为 1 枚装填硅晶');
console.log('  ✅ [4/5] 外岛晶兽多岛隔离、正面甲壳减伤、跨天再生与碎晶凝结账本守恒验证通过');

// 5. 验证晶雾观测前哨每日回运与存档读写闭环
game.ui.inventory.iron_ingot = 2;
game.ui.inventory.wood_plank = 2;
game.ui.inventory.nail = 2;
assert.equal(game.mistReefIsleScene.claimOutpost(), true, '材料齐备时应成功建立晶雾观测前哨站');
assert.equal(game.nauticalChart.islands.mist_reef_isle.outpostBuilt, true, '海图应同步标记前哨建成');

game.survival.day = 11; // 奇数天：回运 sol_crystal_deep + pearl
game.campFacilities.onDayPassed();
assert.equal(game.storageSystem.storageInventory.sol_crystal_deep, 1, '奇数天前哨应回运深层海脉晶核 x1');
assert.equal(game.storageSystem.storageInventory.pearl, 1, '前哨每日应回运深海纯白珍珠 x1');

game.survival.day = 12; // 偶数天：回运 copper_ore + pearl
game.campFacilities.onDayPassed();
assert.equal(game.storageSystem.storageInventory.copper_ore, 1, '偶数天前哨应回运孔雀绿铜矿石 x1');
assert.equal(game.storageSystem.storageInventory.pearl, 2, '偶数天累计回运珍珠应为 2');

const saveRes = game.saveSystem.saveGame('test_topic_b');
assert.equal(saveRes.success, true, '包含晶雾岛、野兽与账本状态的存档应通过校验并保存成功');
const loadRes = game.saveSystem.loadGame();
assert.equal(loadRes.success, true, '存档重新加载与反序列化应 100% 成功');
console.log('  ✅ [5/5] 晶雾前哨轮替回运与 SaveSystem 存档闭环验证通过');

console.log('\n🎉 专题 B 全部自动化测试断言通过！');
