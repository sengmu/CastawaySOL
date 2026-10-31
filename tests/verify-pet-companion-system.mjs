// CastawaySOL - 多宠物出战切换与商业化特权系统自动化测试套件
import assert from 'node:assert/strict';

// 1. Mock 运行环境
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

console.log('🧪 开始执行 CastawaySOL 多宠物随行切换与商业化特权系统全链路测试套件...\n');

// 导入核心类
const { PET_CATALOG, PetCompanionSystem } = await import('../src/systems/PetCompanionSystem.js');
const { SaveSystem } = await import('../src/systems/SaveSystem.js');
const { ShopManager } = await import('../src/ui/ShopManager.js');

// 构造 MockGame
class MockGame {
  constructor() {
    this.toasts = [];
    this.scene = {
      add: () => {}
    };
    this.ui = {
      inventory: {},
      addInventory: (k, count = 1) => {
        this.ui.inventory[k] = (this.ui.inventory[k] || 0) + count;
      },
      showToast: (msg) => { this.toasts.push(msg); },
      renderInventory: () => {},
      updateSurvivalHUD: () => {}
    };
    this.player = {
      position: { x: -15.5, y: 0.05, z: 21.0, distanceTo: () => 0, copy: () => {} },
      rotation: 0
    };
    this.survival = {
      life: 100,
      hunger: 55,
      water: 50,
      fatigue: 35,
      steps: 0,
      canteenSips: 3,
      isDead: false
    };
    this.villagers = {
      villagers: [
        { id: 'bub_monkey', group: { visible: true, position: { set: () => {} }, rotation: {} } },
        { id: 'isabelle', group: { visible: false, position: { set: () => {} }, rotation: {} } },
        { id: 'raymond', group: { visible: false, position: { set: () => {} }, rotation: {} } },
        { id: 'dom', group: { visible: false, position: { set: () => {} }, rotation: {} } }
      ]
    };
    this.dayNight = {
      isNight: true
    };
    this.story = {
      currentChapterId: 1,
      serialize: () => ({ currentChapterId: 1 }),
      deserialize: () => {},
      getQuestBannerText: () => '荒岛求生主线'
    };
  }
}

const game = new MockGame();
const petSystem = new PetCompanionSystem(game);
game.petCompanion = petSystem;
const saveSystem = new SaveSystem(game);
game.saveSystem = saveSystem;
const shopManager = new ShopManager(game);
game.shopManager = shopManager;

// Test 1: 四大神宠配置目录完整性
console.log('▶ [Test 1] 校验四大神宠配置目录 (PET_CATALOG)...');
assert.ok(PET_CATALOG.bub_monkey, '小猴巴布必须存在');
assert.ok(PET_CATALOG.bella_dog, '猎犬贝拉必须存在');
assert.ok(PET_CATALOG.raymond_cat, '玄猫雷蒙德必须存在');
assert.ok(PET_CATALOG.dom_sheep, '金羊多姆必须存在');
assert.equal(PET_CATALOG.bub_monkey.freeInitial, true, '小猴巴布初始必须免费');
assert.equal(PET_CATALOG.bella_dog.priceCoins, 180, '猎犬贝拉金币价格为180');
assert.equal(PET_CATALOG.raymond_cat.priceCoins, 240, '玄猫雷蒙德金币价格为240');
assert.equal(PET_CATALOG.dom_sheep.priceCoins, 150, '金羊多姆金币价格为150');
console.log('✅ [Test 1 通过] 四大神宠目录、特权文案与双轨标价配置完整。\n');

// Test 2: 初始状态与出战控制
console.log('▶ [Test 2] 校验宠物系统初始状态与默认出战...');
assert.deepEqual(petSystem.unlockedPets, ['bub_monkey'], '初始只应解锁小猴巴布');
assert.equal(petSystem.activePetId, 'bub_monkey', '初始默认出战小猴巴布');
assert.equal(petSystem.isUnlocked('bub_monkey'), true);
assert.equal(petSystem.isUnlocked('bella_dog'), false);
console.log('✅ [Test 2 通过] 初始状态与解锁校验符合预期。\n');

// Test 3: 未解锁宠物出战拦截
console.log('▶ [Test 3] 验证未解锁宠物出战切换拦截...');
const switchBlocked = petSystem.setActivePet('bella_dog');
assert.equal(switchBlocked, false, '未收服猎犬应被拒绝出战');
assert.equal(petSystem.activePetId, 'bub_monkey', '出战宠物应保持为小猴');
console.log('✅ [Test 3 通过] 未解锁宠物出战拦截有效。\n');

// Test 4: 古代金币兑换解锁流程
console.log('▶ [Test 4] 测试古代金币兑换解锁神宠...');
game.ui.inventory['ancient_coin'] = 100;
const coinFail = petSystem.unlockWithCoins('bella_dog'); // 需 180
assert.equal(coinFail.ok, false, '金币不足时必须拒绝兑换');

game.ui.inventory['ancient_coin'] = 200;
const coinSuccess = petSystem.unlockWithCoins('bella_dog');
assert.equal(coinSuccess.ok, true, '金币充足时应成功结缘');
assert.equal(game.ui.inventory['ancient_coin'], 20, '应准确扣除 180 枚金币，剩余 20 枚');
assert.equal(petSystem.isUnlocked('bella_dog'), true, '猎犬贝拉应加入已拥有列表');
console.log('✅ [Test 4 通过] 古代金币兑换与扣减流程严密准确。\n');

// Test 5: 出战切换与特权属性动态计算
console.log('▶ [Test 5] 测试出战切换与专属生存特权计算...');
const switchOk = petSystem.setActivePet('bella_dog');
assert.equal(switchOk, true, '已解锁的猎犬应成功设为出战伙伴');
assert.equal(petSystem.activePetId, 'bella_dog');

// 猎犬免伤特权 20%
assert.equal(petSystem.getDamageReduction(), 0.20, '猎犬出战时应提供 20% 免伤');
assert.equal(petSystem.getFatigueRateMultiplier(), 1.0, '非金羊出战疲劳倍率应为 1.0');
assert.equal(petSystem.getFishingBiteTimeMultiplier(), 1.0, '非玄猫出战咬钩倍率应为 1.0');
console.log('✅ [Test 5 通过] 猎犬出战与伤害减免特权计算正确。\n');

// Test 6: Solana 支付直通解锁金羊并测试随行驮袋
console.log('▶ [Test 6] 测试 Solana 直通解锁金羊多姆与 6 格专属随行驮袋...');
const solUnlock = petSystem.unlockWithSol('dom_sheep');
assert.equal(solUnlock.ok, true);
assert.equal(petSystem.isUnlocked('dom_sheep'), true);
assert.equal(petSystem.activePetId, 'dom_sheep', '解锁后应自动设为出战');

// 金羊特权属性
assert.equal(petSystem.getFatigueRateMultiplier(), 0.50, '金羊出战时奔跑疲劳累积速度降低 50%');

// 驮袋存取测试
game.ui.inventory['apple'] = 5;
game.ui.inventory['fish'] = 3;
const dep1 = petSystem.depositToSheepPouch('apple', 2);
assert.equal(dep1, true);
assert.equal(game.ui.inventory['apple'], 3);
assert.equal(petSystem.sheepPouchInventory['apple'], 2);

const with1 = petSystem.withdrawFromSheepPouch('apple', 1);
assert.equal(with1, true);
assert.equal(game.ui.inventory['apple'], 4);
assert.equal(petSystem.sheepPouchInventory['apple'], 1);
console.log('✅ [Test 6 通过] 金羊多姆疲劳减半与 6 格随身驮袋存取验证无误。\n');

// Test 7: 玄猫出战与夜视/钓鱼加成/浅水捕鱼
console.log('▶ [Test 7] 测试海月玄猫雷蒙德夜视光环与钓鱼咬钩提速...');
petSystem.unlockWithSol('raymond_cat');
petSystem.setActivePet('raymond_cat');
assert.equal(petSystem.activePetId, 'raymond_cat');
assert.equal(petSystem.getFishingBiteTimeMultiplier(), 0.65, '玄猫出战时咬钩耗时缩短至 65%');

// 模拟帧更新测试玄猫夜视光晕平滑点亮
petSystem.update(0.5);
assert.ok(petSystem.nightVisionLight.intensity > 0, '入夜玄猫出战时光环应开始发光');
console.log('✅ [Test 7 通过] 玄猫雷蒙德专属特权与夜视点光源平滑渐变显现。\n');

// Test 8: 投喂恢复精力与亲密羁绊
console.log('▶ [Test 8] 测试宠物投喂与精力/亲密增长...');
game.ui.inventory['cooked_crab'] = 2;
const feedRes = petSystem.feedPet('raymond_cat', 'cooked_crab');
assert.equal(feedRes.ok, true);
assert.equal(game.ui.inventory['cooked_crab'], 1);
assert.ok(feedRes.energy > 0);
assert.ok(feedRes.affinity > 0);
console.log('✅ [Test 8 通过] 投喂美食食物扣减与精力好感增长正常。\n');

// Test 9: 商城商品上架与 Solana 支付通道
console.log('▶ [Test 9] 验证 ShopManager 神宠商品上架与 Solana 支付...');
const petDogProd = shopManager.products.find(p => p.id === 'pet_bella_dog');
const petCatProd = shopManager.products.find(p => p.id === 'pet_raymond_cat');
const petSheepProd = shopManager.products.find(p => p.id === 'pet_dom_sheep');
assert.ok(petDogProd, '商城应上架忠诚猎犬贝拉');
assert.ok(petCatProd, '商城应上架海月玄猫雷蒙德');
assert.ok(petSheepProd, '商城应上架暖绒金羊多姆');
assert.equal(petDogProd.isOwned(), true, '前面已解锁猎犬，商城应识别为已拥有');
assert.equal(petCatProd.isOwned(), true, '前面已解锁玄猫，商城应识别为已拥有');
assert.equal(petSheepProd.isOwned(), true, '前面已解锁金羊，商城应识别为已拥有');
console.log('✅ [Test 9 通过] 商城特权上架与拥有态响应无缝打通。\n');

// Test 10: 存档系统 (SaveSystem) 快照序列化与反序列化持久化
console.log('▶ [Test 10] 验证 SaveSystem 存档快照与异兽羁绊恢复...');
const snapshot = saveSystem.createSnapshot();
assert.ok(snapshot.petCompanion, '存档快照必须包含 petCompanion 字段');
assert.equal(snapshot.petCompanion.activePetId, 'raymond_cat');
assert.ok(snapshot.petCompanion.unlockedPets.includes('bella_dog'));
assert.ok(snapshot.petCompanion.unlockedPets.includes('dom_sheep'));
assert.ok(snapshot.petCompanion.unlockedPets.includes('raymond_cat'));

// 模拟新建游戏对象并恢复存档
const game2 = new MockGame();
const petSystem2 = new PetCompanionSystem(game2);
game2.petCompanion = petSystem2;
const saveSystem2 = new SaveSystem(game2);
saveSystem2.applyDataToGame(snapshot);

assert.equal(petSystem2.activePetId, 'raymond_cat', '恢复后出战宠物应保持为玄猫');
assert.equal(petSystem2.isUnlocked('bella_dog'), true, '恢复后应保留猎犬');
assert.equal(petSystem2.isUnlocked('dom_sheep'), true, '恢复后应保留金羊');
assert.equal(petSystem2.sheepPouchInventory['apple'], 1, '恢复后金羊驮袋物资应完整保存');
console.log('✅ [Test 10 通过] 随行神宠状态、出战与随身驮袋持久化与恢复 100% 吻合！\n');

console.log('🎉🎉 全部 10 组 CastawaySOL 多宠物随行切换与商业化特权系统自动化测试 100% PASS！');
