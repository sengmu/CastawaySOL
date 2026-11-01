// CastawaySOL - 小猴伙伴协同技能与潮汐捕捞熏制两大玩法全链路自动化测试套件
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

console.log('🧪 开始执行 CastawaySOL 小猴伙伴技能与潮汐捕捞熏制系统自动化测试套件...\n');

// 导入模块
const { MonkeyHelperSystem } = await import('../src/systems/MonkeyHelperSystem.js');
const { TidalTrapSystem } = await import('../src/systems/TidalTrapSystem.js');
const { SaveSystem } = await import('../src/systems/SaveSystem.js');

// 构造模拟全局 Game
class MockGame {
  constructor() {
    this.toasts = [];
    this.dialogs = [];
    this.scene = {
      add: () => {}
    };
    this.ui = {
      inventory: {},
      addInventory: (k, count = 1) => {
        this.ui.inventory[k] = (this.ui.inventory[k] || 0) + count;
      },
      getItemName: (id) => id,
      isInventoryFull: () => false,
      showToast: (msg) => { this.toasts.push(msg); },
      showDialog: (title, text) => { this.dialogs.push({ title, text }); },
      renderInventory: () => {},
      updateSurvivalHUD: () => {}
    };
    this.story = {
      monkeyBefriended: true,
      currentChapterId: 1,
      serialize: () => ({ currentChapterId: 1 }),
      deserialize: () => {}
    };
    this.player = {
      position: { x: 0, y: 0, z: 0, set: () => {} },
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
    this.trees = {
      shakeTreeMesh: () => {}
    };
    this.villagers = {
      villagers: [
        {
          id: 'bub_monkey',
          name: '🐒 机灵小猴 Bub',
          group: {
            position: { x: 0, y: 0, z: 0, clone: () => ({ x: 0, y: 0, z: 0 }), copy: () => {} },
            visible: true
          }
        }
      ]
    };

    this.monkeyHelper = new MonkeyHelperSystem(this);
    this.tidalTrap = new TidalTrapSystem(this);
    this.saveSystem = new SaveSystem(this);
  }
}

const game = new MockGame();

// ==========================================
// 测试 1：小猴伙伴属性与投喂恢复 (Feed & Energy)
// ==========================================
console.log('▶ [测试 1] 验证小猴精力属性与投喂机制...');
assert.strictEqual(game.monkeyHelper.affinity, 60, '初始好感度应为 60');
assert.strictEqual(game.monkeyHelper.energy, 80, '初始精力值应为 80');
assert.strictEqual(game.monkeyHelper.mode, 'follow', '初始模式应为跟随 follow');

// 投喂普通苹果
game.ui.inventory['apple'] = 2;
const feedRes = game.monkeyHelper.feedMonkey('apple');
assert.strictEqual(feedRes.ok, true, '投喂苹果应成功');
assert.strictEqual(game.ui.inventory['apple'], 1, '背包苹果应扣除 1 个');
assert.strictEqual(game.monkeyHelper.energy, 100, '精力值应恢复至上限 100');
assert.strictEqual(game.monkeyHelper.affinity, 68, '好感度应增加 8 点变为 68');
console.log('✅ 测试 1 通过：小猴投喂营养吸收与好感增益正常！\n');

// ==========================================
// 测试 2：小猴攀爬果树摇果技能 (Climb & Shake)
// ==========================================
console.log('▶ [测试 2] 验证小猴攀爬果树摇果技能...');
const mockPalmTree = {
  info: { id: 'palm_tree', name: '高大椰子树' },
  group: { position: { x: 2, y: 0, z: 5 } }
};

const climbSuccess = game.monkeyHelper.commandClimbTree(mockPalmTree);
assert.strictEqual(climbSuccess, true, '有精力且入队时应成功指派爬树');
assert.strictEqual(game.monkeyHelper.energy, 90, '爬树应扣除 10 点精力');
assert.strictEqual(game.monkeyHelper.mode, 'busy', '小猴状态应变更为 busy');

// 模拟动画帧推进直至采摘完成
game.monkeyHelper.update(2.5);
assert.strictEqual(game.monkeyHelper.mode, 'follow', '任务完成后小猴应重置为 follow 状态');
assert(game.ui.inventory['golden_coconut'] >= 1, '应必定收获至少 1 个稀有黄金海岛椰子');
assert(game.ui.inventory['tough_bark'] >= 2, '应掉落坚韧高枝树皮材料');
console.log('✅ 测试 2 通过：小猴爬树采摘技能与稀有黄金椰产出正常！\n');

// ==========================================
// 测试 3：小猴岩缝钻穴寻宝技能 (Explore Crevice)
// ==========================================
console.log('▶ [测试 3] 验证小猴狭窄岩缝钻穴探宝技能...');
const cliffCrevice = game.monkeyHelper.crevices[0];
assert.strictEqual(cliffCrevice.id, 'crevice_cliff', '第一处岩缝应为后山悬崖石隙');
assert.strictEqual(cliffCrevice.cooldown, 0, '初始冷却时间应为 0');

const creviceSuccess = game.monkeyHelper.commandExploreCrevice(cliffCrevice);
assert.strictEqual(creviceSuccess, true, '钻入岩缝探宝应成功触发');
assert.strictEqual(game.monkeyHelper.energy, 75, '钻缝探宝应扣除 15 点精力');
assert.strictEqual(game.monkeyHelper.mode, 'busy', '小猴状态应进入 busy 寻宝');

// 推进寻宝时间直至完成
game.monkeyHelper.update(3.0);
assert.strictEqual(game.monkeyHelper.mode, 'follow', '探宝完成后小猴应回归');
assert(cliffCrevice.cooldown > 40, '探宝后该处石缝应进入约 45 秒冷却时间');

// 验证获得的古代珍宝（古代金币或珍珠或地图碎片）
const hasRareTreasure = (game.ui.inventory['ancient_coin'] || 0) > 0 ||
                        (game.ui.inventory['pearl'] || 0) > 0 ||
                        (game.ui.inventory['treasure_map_piece'] || 0) > 0 ||
                        (game.ui.inventory['iron_ore'] || 0) > 0 ||
                        (game.ui.inventory['sol_crystal'] || 0) > 0 ||
                        (game.ui.inventory['battery'] || 0) > 0;
assert.strictEqual(hasRareTreasure, true, '小猴钻穴应带回古代宝物或深层铁矿');
console.log('✅ 测试 3 通过：小猴岩缝探宝与古代金币掉落闭环成功！\n');

// ==========================================
// 测试 4：潮汐捕蟹笼起获与诱饵投放 (Crab Trap)
// ==========================================
console.log('▶ [测试 4] 验证潮汐捕蟹笼起获与诱饵加成...');
assert.strictEqual(game.tidalTrap.getTotalCatches(), 3, '初始捕蟹笼预置 3 件渔获');

// 一键起获
const harvestOk = game.tidalTrap.harvestTrap();
assert.strictEqual(harvestOk, true, '起网应成功');
assert.strictEqual(game.tidalTrap.getTotalCatches(), 0, '起网后笼中渔获应清空');
assert.strictEqual(game.ui.inventory['sea_crab'], 1, '背包应增加 1 只海螯蟹');
assert.strictEqual(game.ui.inventory['sardine'], 2, '背包应增加 2 条沙丁鱼');

// 投入诱饵
game.ui.inventory['apple'] = 1;
const baitOk = game.tidalTrap.addBait('apple');
assert.strictEqual(baitOk, true, '投入诱饵应成功');
assert.strictEqual(game.tidalTrap.trapBait, 'apple', '当前诱饵记录应为 apple');
assert.strictEqual(game.tidalTrap.trapBaitCount, 3, '诱饵应提供 3 次潮汐增益');

// 模拟步数驱动潮汐退潮
game.tidalTrap.advanceTide(40);
assert(game.tidalTrap.getTotalCatches() >= 1, '退潮后捕蟹笼应自动起获新海鲜');
assert.strictEqual(game.tidalTrap.trapBaitCount, 2, '退潮应消耗 1 次诱饵储备');
console.log('✅ 测试 4 通过：潮汐捕蟹起获与步数驱动退潮机制正常！\n');

// ==========================================
// 测试 5：营地熏鱼架慢火风干军粮 (Food Smoker)
// ==========================================
console.log('▶ [测试 5] 验证营地熏烤风干架永久防腐军粮加工...');
game.ui.inventory['sea_crab'] = 1;
game.ui.inventory['tree_bark'] = 1; // 引火树皮

const smokeOk = game.tidalTrap.startSmoking('sea_crab', 1);
assert.strictEqual(smokeOk, true, '原料与引火充足时应成功点燃熏架');
assert.strictEqual(game.ui.inventory['sea_crab'] || 0, 0, '行囊生蟹应被消耗投入熏架');
assert.strictEqual(game.ui.inventory['tree_bark'] || 0, 0, '引火树皮应被消耗');
assert.strictEqual(game.tidalTrap.isSmoking, true, '熏架应处于熏烤工作中');

// 模拟熏制完成
game.tidalTrap.update(6.0); // 推进 120 点进度
assert.strictEqual(game.tidalTrap.isSmoking, false, '进度达到 100% 后熏烤停止');
assert.strictEqual(game.tidalTrap.finishedItems.length, 1, '成品槽应有 1 份已风干食物');
assert.strictEqual(game.tidalTrap.finishedItems[0].id, 'cooked_crab', '成品应为香脆熏蟹');

// 收取成品
const collectOk = game.tidalTrap.collectFinishedProducts();
assert.strictEqual(collectOk, true, '收取熏熟成品应成功');
assert.strictEqual(game.ui.inventory['cooked_crab'], 1, '背包应获得 1 份香脆熏蟹');
console.log('✅ 测试 5 通过：生鲜熏烤为永久防腐军粮生产链完美闭环！\n');

// ==========================================
// 测试 6：SaveSystem 存档保存与恢复
// ==========================================
console.log('▶ [测试 6] 验证 SaveSystem 完整快照与还原...');
const snapshot = game.saveSystem.createSnapshot();
assert(snapshot.monkeyHelper, '快照应包含 monkeyHelper 字段');
assert.strictEqual(snapshot.monkeyHelper.affinity, 68, '小猴好感度应准确记录');
assert(snapshot.tidalTrap, '快照应包含 tidalTrap 字段');
assert.strictEqual(snapshot.tidalTrap.trapBait, 'apple', '捕蟹笼诱饵应准确记录');

// 还原测试
const game2 = new MockGame();
game2.saveSystem.applyDataToGame(snapshot);
assert.strictEqual(game2.monkeyHelper.affinity, 68, '还原后小猴好感度应匹配');
assert.strictEqual(game2.tidalTrap.trapBait, 'apple', '还原后捕蟹笼诱饵应匹配');
console.log('✅ 测试 6 通过：SaveSystem 存档序列化与反序列化双向无损！\n');

console.log('🎉🎉🎉 全套测试全部通过 (6/6 PASS)！小猴协同技能与潮汐捕蟹熏制系统验证 100% 成功！');
