// CastawaySOL - 安全网第1轮 S1 存档补全与 Schema v2 全链路测试套件
// 验证项：
// 1. 各系统序列化与持久化：miningRig, flotsamSalvage (含 hasAutoSalvageBuoy), quarryIsle (矿脉 collected)
// 2. 13 个付费商品逐一购买 -> 存档 -> 重新加载 -> 仍生效（超频芯片重点断言）
// 3. 矿石岛矿脉开采后刷新，不重生
// 4. 守卫测试：凡带 serialize 的系统必须在 snapshot 里登记，故意漏登记一个系统能报红
// 5. 存档导出/导入：导出再导入后快照深度相等 (assert.deepStrictEqual)
// 6. Schema v1 老存档平滑升级到 v2，赋共振默认字段，validateSaveData 拦截 NaN 与负数值

import assert from 'node:assert/strict';

// Mock Browser Environment for Node.js
if (typeof globalThis.window === 'undefined') {
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear()
    },
    addEventListener: () => {}
  };
}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = globalThis.window.localStorage;
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: () => ({
      style: {},
      classList: { toggle: () => {}, remove: () => {} },
      appendChild: () => {},
      addEventListener: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      setAttribute: () => {}
    }),
    body: { appendChild: () => {} },
    getElementById: () => null
  };
}

console.log('🛡️ 开始执行 CastawaySOL S1 存档补全与 Schema v2 守卫全链路测试套件...\n');

// 导入模块
const { SaveSystem, CURRENT_SCHEMA_VERSION } = await import('../src/systems/SaveSystem.js');
const { MiningRigSystem } = await import('../src/systems/MiningRigSystem.js');
const { FlotsamSalvageSystem } = await import('../src/systems/FlotsamSalvageSystem.js');
const { QuarryIsleScene } = await import('../src/island/QuarryIsleScene.js');
const { StorageSystem } = await import('../src/systems/StorageSystem.js');
const { CampFacilitiesSystem } = await import('../src/systems/CampFacilitiesSystem.js');
const { WeatherSurvivalSystem } = await import('../src/systems/WeatherSurvivalSystem.js');
const { PetCompanionSystem } = await import('../src/systems/PetCompanionSystem.js');
const { ShopManager } = await import('../src/ui/ShopManager.js');

// 构造拟真 Game 实例
class MockGame {
  constructor() {
    this.currentIslandId = 'main_island';
    this.raymondSettled = false;
    this.player = {
      position: { x: -10, y: 0, z: 20 },
      rotation: 0
    };
    this.survival = {
      life: 100,
      hunger: 80,
      water: 75,
      fatigue: 20,
      day: 3,
      steps: 120,
      canteenSips: 3,
      isDead: false
    };
    this.ui = {
      inventory: { apple: 2, tree_branch: 5 },
      baseInventorySlots: 10,
      bonusInventorySlots: 0,
      get maxInventorySlots() { return this.baseInventorySlots + this.bonusInventorySlots; },
      expandInventory(extra) { this.bonusInventorySlots += extra; },
      showToast: () => {},
      showDialog: () => {},
      updateSurvivalHUD: () => {},
      renderInventory: () => {}
    };
    this.story = {
      currentChapterId: 1,
      currentStepIndex: 2,
      sosBuilt: false,
      raftBuilt: false,
      serialize() {
        return {
          currentChapterId: this.currentChapterId,
          currentStepIndex: this.currentStepIndex,
          sosBuilt: this.sosBuilt,
          raftBuilt: this.raftBuilt
        };
      },
      deserialize(d) {
        if (!d) return;
        this.currentChapterId = d.currentChapterId;
        this.currentStepIndex = d.currentStepIndex;
        this.sosBuilt = Boolean(d.sosBuilt);
        this.raftBuilt = Boolean(d.raftBuilt);
      }
    };
    this.beachResources = {
      collectedIds: [],
      serialize() { return { collectedIds: [...this.collectedIds] }; },
      deserialize(d) { if (d && d.collectedIds) this.collectedIds = [...d.collectedIds]; }
    };

    const mockScene = { add: () => {}, remove: () => {} };
    this.storageSystem = new StorageSystem(this);
    this.campFacilities = new CampFacilitiesSystem(this);
    this.weatherSystem = new WeatherSurvivalSystem(this);
    this.petCompanion = new PetCompanionSystem(this);
    this.miningRig = new MiningRigSystem(this);
    this.flotsamSalvage = new FlotsamSalvageSystem(mockScene, this);
    this.quarryIsleScene = new QuarryIsleScene(mockScene, this);
    this.shopManager = new ShopManager(this);


  }
}

// ==========================================
// 1. 验证 Schema 升级与共振字段完整默认值
// ==========================================
console.log('▶ [1/6] 验证 CURRENT_SCHEMA_VERSION = 2 与 v1 -> v2 迁移管道...');
assert.strictEqual(CURRENT_SCHEMA_VERSION, 2, '当前 Schema 版本必须升为 2');

const testGame = new MockGame();
const saveSystem = new SaveSystem(testGame);

const snapshot = saveSystem.createSnapshot();
assert.strictEqual(snapshot.schemaVersion, 2, '生成的快照必须包含 schemaVersion: 2');
assert.ok(snapshot.miningRig, '快照必须包含 miningRig');
assert.ok(snapshot.flotsamSalvage, '快照必须包含 flotsamSalvage');
assert.ok(snapshot.quarryIsle, '快照必须包含 quarryIsle');
assert.strictEqual(snapshot.miningRig.rigMode, 'decrypt', 'rigMode 默认必须为 decrypt');
assert.strictEqual(snapshot.miningRig.rigLevel, 1, 'rigLevel 默认必须为 1');
assert.strictEqual(snapshot.miningRig.loadedPureCrystals, 0);
assert.strictEqual(snapshot.miningRig.shardCount, 0);
assert.strictEqual(snapshot.miningRig.solDust, 0);
assert.strictEqual(snapshot.miningRig.scannerLevel, 0);
assert.ok(snapshot.miningRig.resonance, '共振对象必须存在');
assert.strictEqual(snapshot.miningRig.resonance.deploy.length, 25, '共振 deploy 格子必须为 25');
assert.strictEqual(snapshot.miningRig.resonance.freeShares, 3, '免费 share 初始为 3');
assert.ok(snapshot.miningRig.motherlode, 'motherlode 对象必须存在');
assert.ok(snapshot.miningRig.season, 'season 对象必须存在');
for (const key of ['rigMode','rigLevel','loadedPureCrystals','shardCount','solDust','scannerLevel','resonance','motherlode','season']) assert.equal(key in snapshot, false, `禁止影子字段 ${key}`);
console.log('  ✅ Schema v2 顶级快照与共振字段默认值验证通过！');

// ==========================================
// 2. 验证 validateSaveData 防御 (NaN 与负数)
// ==========================================
console.log('\n▶ [2/6] 验证 validateSaveData 拦截 NaN 与负数值...');
assert.strictEqual(saveSystem.validateSaveData(snapshot), true, '合法快照必须验证通过');

// 测试 NaN
const corruptNaN = JSON.parse(JSON.stringify(snapshot));
corruptNaN.survival.life = NaN;
assert.strictEqual(saveSystem.validateSaveData(corruptNaN), false, 'life 为 NaN 必须拦截');

const corruptNaNRig = JSON.parse(JSON.stringify(snapshot));
corruptNaNRig.miningRig.loadedCrystals = NaN;
assert.strictEqual(saveSystem.validateSaveData(corruptNaNRig), false, 'miningRig 字段为 NaN 必须拦截');

// 测试负数
const corruptNegative = JSON.parse(JSON.stringify(snapshot));
corruptNegative.survival.hunger = -5;
assert.strictEqual(saveSystem.validateSaveData(corruptNegative), false, 'hunger 为负数必须拦截');

const corruptNegSol = JSON.parse(JSON.stringify(snapshot));
corruptNegSol.miningRig.unclaimedSol = -1;
assert.strictEqual(saveSystem.validateSaveData(corruptNegSol), false, 'unclaimedSol 为负数必须拦截');

// 测试 v1 老存档迁移到 v2
const v1OldSave = {
  schemaVersion: 1,
  timestamp: Date.now() - 10000,
  player: { position: [0, 0, 5], rotation: 0 },
  survival: { life: 80, hunger: 60, water: 50, fatigue: 20, day: 2, steps: 50 },
  inventory: { apple: 1 },
  story: { currentChapterId: 0 },
  world: { collectedFlotsam: ['flotsam_wood_1'] }
};
const migratedV2 = saveSystem.migrate(v1OldSave);
assert.strictEqual(migratedV2.schemaVersion, 2, 'v1 迁移后版本必须为 2');
assert.ok(migratedV2.miningRig, 'v1 迁移后必须带有默认 miningRig');
assert.strictEqual(migratedV2.miningRig.loadedCrystals, 1);
assert.ok(migratedV2.flotsamSalvage, 'v1 迁移后必须带有 flotsamSalvage');
assert.deepStrictEqual(migratedV2.flotsamSalvage.collectedIds, ['flotsam_wood_1']);
assert.strictEqual(saveSystem.validateSaveData(migratedV2), true, '迁移后数据必须能通过校验');
console.log('  ✅ validateSaveData 成功拦截 NaN/负数，v1 老存档平滑升级带出默认矿机与共振字段！');

// ==========================================
// 3. 守卫测试：凡带 serialize 的系统必须在 snapshot 里登记
// ==========================================
console.log('\n▶ [3/6] 执行系统序列化注册守卫测试 (Guard Test)...');
function checkSerializationGuard(gameInstance, saveSys) {
  const currentSnap = saveSys.createSnapshot();
  const missingSystems = [];

  // 扫描挂载在 game 上的核心系统
  const candidates = [
    { key: 'storage', obj: gameInstance.storageSystem },
    { key: 'campFacilities', obj: gameInstance.campFacilities },
    { key: 'vesselUpgrade', obj: gameInstance.shipUpgradeSystem },
    { key: 'monkeyHelper', obj: gameInstance.monkeyHelper },
    { key: 'tidalTrap', obj: gameInstance.tidalTrap },
    { key: 'petCompanion', obj: gameInstance.petCompanion },
    { key: 'weather', obj: gameInstance.weatherSystem },
    { key: 'templePuzzle', obj: gameInstance.templePuzzle },
    { key: 'ancientTempleScene', obj: gameInstance.ancientTempleScene },
    { key: 'timberIsle', obj: gameInstance.timberIsleScene },
    { key: 'story', obj: gameInstance.story },
    { key: 'miningRig', obj: gameInstance.miningRig },
    { key: 'flotsamSalvage', obj: gameInstance.flotsamSalvage },
    { key: 'quarryIsle', obj: gameInstance.quarryIsleScene }
  ];

  for (const c of candidates) {
    if (c.obj && typeof c.obj.serialize === 'function') {
      if (!(c.key in currentSnap)) {
        missingSystems.push(c.key);
      }
    }
  }

  if (missingSystems.length > 0) {
    throw new Error(`[Guard Test Failure] 以下系统具备 serialize() 但未在 SaveSystem snapshot 登记: ${missingSystems.join(', ')}`);
  }
}

// 正常测试必须通过
checkSerializationGuard(testGame, saveSystem);

// 故意模拟漏登记，断言能立刻报红
let guardCaughtError = false;
try {
  // 模拟假冒未登记的系统
  const fakeGame = new MockGame();
  fakeGame.dummySystem = { serialize: () => ({ dummy: true }) };
  const mockSnapWithoutKey = saveSystem.createSnapshot();
  // 如果把 snapshot 中的 miningRig 删掉，模拟漏登记
  delete mockSnapWithoutKey.miningRig;
  const mockSaveWithOmission = {
    createSnapshot: () => mockSnapWithoutKey
  };
  checkSerializationGuard(fakeGame, mockSaveWithOmission);
} catch (e) {
  guardCaughtError = true;
  assert.ok(e.message.includes('miningRig'), '守卫应准确报错漏登记的 miningRig');
}
assert.strictEqual(guardCaughtError, true, '故意漏登记系统必须触发守卫测试报红！');
console.log('  ✅ 序列化注册守卫测试通过！漏登记系统必定红灯拦截！');

// ==========================================
// 4. 矿石岛矿脉开采与前哨：刷新后不重生
// ==========================================
console.log('\n▶ [4/6] 验证矿石岛矿脉开采与海外前哨状态持久化 (刷新不重生)...');
const qGame = new MockGame();
const qSave = new SaveSystem(qGame);

// 开采富铁矿脉 qi_iron_1 和铜矿脉 qi_copper_1
const ore1 = qGame.quarryIsleScene.islandResources.find(r => r.id === 'qi_iron_1');
const ore2 = qGame.quarryIsleScene.islandResources.find(r => r.id === 'qi_copper_1');
assert.ok(ore1 && ore2, '矿石岛必须具备初始矿脉');
ore1.collected = true;
ore1.group.visible = false;
ore2.collected = true;
ore2.group.visible = false;

// 插旗建立前哨
qGame.quarryIsleScene.outpostClaimed = true;

// 存档并导出
const qSnapshot = qSave.createSnapshot();
assert.ok(qSnapshot.quarryIsle.collectedResourceIds.includes('qi_iron_1'));
assert.ok(qSnapshot.quarryIsle.collectedResourceIds.includes('qi_copper_1'));
assert.strictEqual(qSnapshot.quarryIsle.outpostClaimed, true);

// 模拟页面刷新（全新创建 Game 实例并加载存档）
const reloadedQGame = new MockGame();
const reloadedQSave = new SaveSystem(reloadedQGame);
reloadedQSave.applyDataToGame(qSnapshot);

const reloadedOre1 = reloadedQGame.quarryIsleScene.islandResources.find(r => r.id === 'qi_iron_1');
const reloadedOre2 = reloadedQGame.quarryIsleScene.islandResources.find(r => r.id === 'qi_copper_1');
assert.strictEqual(reloadedOre1.collected, true, '刷新后已采矿脉 qi_iron_1 绝不可重生');
assert.strictEqual(reloadedOre1.group.visible, false, '刷新后已采矿脉实体必须不可见');
assert.strictEqual(reloadedOre2.collected, true, '刷新后已采铜矿脉 qi_copper_1 绝不可重生');
assert.strictEqual(reloadedOre2.group.visible, false, '刷新后已采铜矿脉实体必须不可见');
assert.strictEqual(reloadedQGame.quarryIsleScene.outpostClaimed, true, '刷新后海外矿业前哨开拓状态必须保持');
console.log('  ✅ 矿石岛矿脉开采与前哨刷新后状态完全持久，绝不重生！');

// ==========================================
// 5. 13 个付费商品逐个「购买 -> 刷新/恢复 -> 仍生效」
// ==========================================
console.log('\n▶ [5/6] 验证 13 个付费商品逐一购买 -> 存档 -> 恢复后仍生效...');
const shopGame = new MockGame();
const shopSave = new SaveSystem(shopGame);
const shop = shopGame.shopManager;

const products = shop.products;
assert.strictEqual(products.length, 13, `商品总数必须为 13 个 (实测: ${products.length})`);

// 记录购买前状态
const preStatus = {
  storageWoodPlank: shopGame.storageSystem.storageInventory.wood_plank || 0,
  maxInventorySlots: shopGame.ui.maxInventorySlots,
  storageCapacity: shopGame.storageSystem.maxCapacity,
  bakedFish: shopGame.storageSystem.storageInventory.baked_fish || 0
};

// 逐个购买 13 个商品
for (let i = 0; i < products.length; i++) {
  const prod = products[i];
  prod.onPurchase();
}

// 重点断言：超频芯片购买后已生效
assert.strictEqual(shopGame.miningRig.isOverclocked, true, '超频芯片购买后必须处于 isOverclocked: true');
assert.strictEqual(shopGame.miningRig.hasLithiumPack, true, '锂电池组购买后必须处于 hasLithiumPack: true');
assert.strictEqual(shopGame.flotsamSalvage.hasAutoSalvageBuoy, true, '自动打捞浮标必须激活');
assert.strictEqual(shopGame.campFacilities.isAutoProductionActive, true, '自律生产执照必须激活');
assert.strictEqual(shopGame.weatherSystem.hasOilskinCloak, true, '油布斗篷必须激活');
assert.strictEqual(shopGame.weatherSystem.hasFireShelter, true, '营火棚必须激活');
assert.strictEqual(shopGame.petCompanion.isUnlocked('bella_dog'), true, '灵犬贝拉必须已解锁');
assert.strictEqual(shopGame.petCompanion.isUnlocked('raymond_cat'), true, '玄猫雷蒙德必须已解锁');
assert.strictEqual(shopGame.petCompanion.isUnlocked('dom_sheep'), true, '金羊多姆必须已解锁');
assert.strictEqual(shopGame.ui.maxInventorySlots, preStatus.maxInventorySlots + 10, '行囊格位应 +10');
assert.strictEqual(shopGame.storageSystem.maxCapacity, preStatus.storageCapacity + 16, '营地储物箱容量应 +16');
assert.ok((shopGame.storageSystem.storageInventory.wood_plank || 0) >= preStatus.storageWoodPlank + 10, '造船特权构件木料已归仓');
assert.ok((shopGame.storageSystem.storageInventory.baked_fish || 0) >= preStatus.bakedFish + 5, '急救空投香脆烤鱼已归仓');

// 生成快照并模拟刷新重载
const shopSnapshot = shopSave.createSnapshot();
const freshGame = new MockGame();
const freshSave = new SaveSystem(freshGame);
freshSave.applyDataToGame(shopSnapshot);

// 断言刷新后 13 个商品全部依旧生效
console.log('  核对刷新后 13 个付费特权生效状态:');
// 1. auto_salvage_buoy
assert.strictEqual(freshGame.flotsamSalvage.hasAutoSalvageBuoy, true, '1. 自动打捞浮标网刷新后仍生效');
// 2. auto_production_license
assert.strictEqual(freshGame.campFacilities.isAutoProductionActive, true, '2. 营地自律生产执照刷新后仍生效');
// 3. overclock_mining_chip (必须验！)
assert.strictEqual(freshGame.miningRig.isOverclocked, true, '3. DePIN超频运算芯片刷新后仍生效！[重点]');
// 4. depin_lithium_pack
assert.strictEqual(freshGame.miningRig.hasLithiumPack, true, '4. 固态锂电储能组刷新后仍生效');
// 5. deepsea_shipbuilding_kit
assert.ok((freshGame.storageSystem.storageInventory.nail || 0) >= 10, '5. 深海远航造船构件物料在木箱中仍保留');
// 6. backpack_expansion
assert.strictEqual(freshGame.ui.bonusInventorySlots, 10, '6. 行囊扩容包刷新后格位仍保持 +10');
// 7. storage_expansion
assert.strictEqual(freshGame.storageSystem.maxCapacity, preStatus.storageCapacity + 16, '7. 储物箱扩容货架刷新后仍保持 +16');
// 8. airdrop_rescue_crate
assert.ok((freshGame.storageSystem.storageInventory.canteen_clean_water || 0) >= 5, '8. 急救空投纯净饮水在木箱中仍保留');
// 9. pet_bella_dog
assert.strictEqual(freshGame.petCompanion.isUnlocked('bella_dog'), true, '9. 猎犬贝拉刷新后出战状态仍保留');
// 10. pet_raymond_cat
assert.strictEqual(freshGame.petCompanion.isUnlocked('raymond_cat'), true, '10. 玄猫雷蒙德刷新后夜视特权仍保留');
// 11. pet_dom_sheep
assert.strictEqual(freshGame.petCompanion.isUnlocked('dom_sheep'), true, '11. 金羊多姆刷新后仍保留');
// 12. storm_oilskin_cloak
assert.strictEqual(freshGame.weatherSystem.hasOilskinCloak, true, '12. 航海油布斗篷刷新后防失温仍生效');
// 13. storm_fire_shelter
assert.strictEqual(freshGame.weatherSystem.hasFireShelter, true, '13. 避雷防雨营火棚刷新后仍生效');
console.log('  ✅ 全部 13 个付费商品「购买 -> 刷新 -> 仍生效」全量断言通过！');

// ==========================================
// 6. 存档导出与导入快照深度相等测试
// ==========================================
console.log('\n▶ [6/6] 验证存档导出/导入与快照深度相等 (assert.deepStrictEqual)...');
const exportedJson = shopSave.exportSave();
assert.strictEqual(typeof exportedJson, 'string', '导出必须为合法的 JSON 字符串');

const importResult = freshSave.importSave(exportedJson);
assert.strictEqual(importResult.success, true, '导入合法 JSON 必须成功');

const snapshotAfterImport = freshSave.createSnapshot();
// 对比除 timestamp 之外的所有核心属性
const snapA = { ...shopSnapshot, timestamp: 0 };
const snapB = { ...snapshotAfterImport, timestamp: 0 };
assert.deepStrictEqual(snapA, snapB, '导出再导入后的游戏快照必须与原快照完全深度相等！');
console.log('  ✅ 导出与导入快照深度相等验证通过！');

console.log('\n🎉🎉🎉 [ALL S1 SCHEMA V2 TESTS PASSED] 安全网第1轮 S1 存档补全 100% 验证成功！');

// M3: use the real story serializer for completion and legacy chapter-6 migration.
const { StorySystem } = await import('../src/systems/StorySystem.js');
const completedGame = new MockGame();
completedGame.story = new StorySystem(completedGame);
completedGame.story.currentChapterId = 6;
completedGame.story.update({x:0,z:0},{},{});
const completedSave = new SaveSystem(completedGame);
const completedJson = completedSave.exportSave();
assert.equal(JSON.parse(completedJson).story.isCompleted, true);
const freeplayGame = new MockGame();
freeplayGame.story = new StorySystem(freeplayGame);
const freeplaySave = new SaveSystem(freeplayGame);
assert.equal(freeplaySave.importSave(completedJson).success, true);
assert.equal(freeplayGame.story.isCompleted, true);
assert.match(freeplayGame.story.getQuestBannerText(), /自由经营/);
assert.deepStrictEqual({...freeplaySave.createSnapshot(),timestamp:0},{...JSON.parse(completedJson),timestamp:0}, '主线完成后全存档往返深相等');
const legacyChapter6 = JSON.parse(completedJson);
delete legacyChapter6.story.isCompleted;
assert.equal(freeplaySave.importSave(JSON.stringify(legacyChapter6)).success,true);
assert.equal(freeplayGame.story.isCompleted,true,'旧第六章存档通过 SaveSystem 导入即进入漫游');
assert.match(freeplayGame.story.getQuestBannerText(), /自由经营/);
console.log('M3 SAVE PASS: 完成主线全存档往返深相等；旧第六章档导入迁移通过');
