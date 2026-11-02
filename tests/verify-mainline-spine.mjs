// CastawaySOL - 主线重排轮 (Mainline Spine Reshuffle) 核心验收测试套件
// 依据 docs/MAINLINE-SPINE.md 规范与验收标准设计
// 涵盖：
// 1. 逐章负例 (未满足里程碑凭据绝不可过章；各阶段关键技术/零件/动作章节锁)
// 2. 逐章正例 (达成矿业里程碑后平滑推进过章)
// 3. 灯塔一期工程 (材料检查、三梯晶石扣除、总账记账、视觉状态切换与L4解封)
// 4. 每日订单板 (每日3单刷新、多池生成、交付扣除与 order_deliver 记账)
// 5. 存档向后兼容与快照往返深度相等

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Mock 最小浏览器环境
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
    body: { appendChild: () => {}, innerText: '' },
    getElementById: () => null
  };
}

console.log('🏛️ 开始执行 CastawaySOL 主线矿业脊柱全量验证套件...\n');

// 导入核心模块
const THREE = await import('three');
const { modelLoader } = await import('../src/core/ModelLoader.js');
modelLoader.loadModel = async () => new THREE.Group();

const { StorySystem, CHAPTERS } = await import('../src/systems/StorySystem.js');
const { MiningRigSystem } = await import('../src/systems/MiningRigSystem.js');
const { CampFacilitiesSystem } = await import('../src/systems/CampFacilitiesSystem.js');
const { ShipUpgradeSystem } = await import('../src/systems/ShipUpgradeSystem.js');
const { MonkeyHelperSystem } = await import('../src/systems/MonkeyHelperSystem.js');
const { LighthouseEntity, LIGHTHOUSE_DELIVERY } = await import('../src/entities/LighthouseEntity.js');
const { OrderBoardSystem } = await import('../src/systems/OrderBoardSystem.js');
const { EconomyLedger, LEDGER_SOURCES, LEDGER_SINKS } = await import('../src/systems/EconomyLedger.js');
const { SaveSystem } = await import('../src/systems/SaveSystem.js');
const { StorageSystem } = await import('../src/systems/StorageSystem.js');
const { WeatherSurvivalSystem } = await import('../src/systems/WeatherSurvivalSystem.js');
const { PetCompanionSystem } = await import('../src/systems/PetCompanionSystem.js');
const { ShopManager } = await import('../src/ui/ShopManager.js');
const { FlotsamSalvageSystem } = await import('../src/systems/FlotsamSalvageSystem.js');
const { QuarryIsleScene } = await import('../src/island/QuarryIsleScene.js');
const { TimberIsleScene } = await import('../src/island/TimberIsleScene.js');

// 构造拟真测试 Game 实例
function createTestGame() {
  const mockScene = { add: () => {}, remove: () => {} };
  const game = {
    currentIslandId: 'main_island',
    raymondSettled: false,
    player: {
      position: { x: 0, y: 0, z: 0, set: () => {}, clone: () => ({ x: 0, y: 0, z: 0 }) },
      rotation: 0
    },
    survival: {
      life: 100, hunger: 100, water: 100, fatigue: 0, day: 1, steps: 0, canteenSips: 3, isDead: false,
      refillCanteen: () => {}
    },
    ui: {
      inventory: {},
      baseInventorySlots: 10,
      bonusInventorySlots: 0,
      get maxInventorySlots() { return this.baseInventorySlots + this.bonusInventorySlots; },
      showToast: () => {},
      showDialog: () => {},
      updateSurvivalHUD: () => {},
      renderInventory: () => {},
      addInventory(key, count = 1, reason = 'test') {
        const ledger = game.economyLedger;
        if (ledger && ['sol_token', 'sol_crystal', 'sol_shard'].includes(key)) {
          const cat = key;
          const defaultSrc = cat === 'sol_token' ? 'decrypt' : cat === 'sol_crystal' ? 'vein_mine' : 'resonance_shard';
          ledger.credit(cat, count, reason !== 'test' ? reason : defaultSrc, this.inventory);
        } else {
          this.inventory[key] = (this.inventory[key] || 0) + count;
        }
      },
      getItemName(k) { return k; }
    },
    scene: mockScene
  };

  game.economyLedger = new EconomyLedger(game);
  game.storageSystem = new StorageSystem(game);
  game.campFacilities = new CampFacilitiesSystem(game);
  game.shipUpgradeSystem = new ShipUpgradeSystem(game);
  game.monkeyHelper = new MonkeyHelperSystem(game);
  game.weatherSystem = new WeatherSurvivalSystem(game);
  game.petCompanion = new PetCompanionSystem(game);
  game.miningRig = new MiningRigSystem(game);
  game.flotsamSalvage = new FlotsamSalvageSystem(mockScene, game);
  game.quarryIsleScene = new QuarryIsleScene(mockScene, game);
  game.timberIsleScene = new TimberIsleScene(mockScene, game);
  game.shopManager = new ShopManager(game);
  game.lighthouse = new LighthouseEntity(mockScene, game);
  game.orderBoard = new OrderBoardSystem(game);
  game.story = new StorySystem(game);
  game.saveSystem = new SaveSystem(game);

  return game;
}

// ========================================================
// 1. 账本与UI标签完备性
// ========================================================
console.log('▶ [1/6] 验证账本新枚举与中文翻译完备性...');
assert.ok(LEDGER_SOURCES.sol_token.includes('order_deliver'), 'LEDGER_SOURCES.sol_token 必须包含 order_deliver');
assert.ok(LEDGER_SINKS.sol_crystal.includes('lighthouse'), 'LEDGER_SINKS.sol_crystal 必须包含 lighthouse');

const uiSource = fs.readFileSync(path.join(projectRoot, 'src/ui/UIManager.js'), 'utf8');
const match = uiSource.match(/export const LEDGER_LABELS = Object\.freeze\((\{[\s\S]*?\})\);/);
assert.ok(match, 'UIManager.js 必须导出 LEDGER_LABELS');
const LEDGER_LABELS = (new Function(`return ${match[1]}`))();
assert.equal(LEDGER_LABELS['order_deliver'], '订单交付', 'LEDGER_LABELS 必须支持 order_deliver');
assert.equal(LEDGER_LABELS['lighthouse'], '灯塔工程', 'LEDGER_LABELS 必须支持 lighthouse');
console.log('  ✅ 账本枚举与 A1 UI 标签映射验证通过！');

// ========================================================
// 2. 逐章章节门负例与系统章节锁
// ========================================================
console.log('\n▶ [2/6] 验证逐章章节门负例与系统前置锁 (Negative Gates & System Locks)...');

{
  const game = createTestGame();
  const story = game.story;
  const rig = game.miningRig;

  // --- 序章 (Chapter 0) ---
  story.currentChapterId = 0;
  rig.loadedCrystals = 0;
  rig.totalBlocksMined = 0;
  game.ui.inventory = {};
  assert.equal(story.canPassChapterGate(0), false, '序章负例：未获得晶石且矿机无晶石装填时不可过章');

  // --- 第一章 (Chapter 1) ---
  story.currentChapterId = 1;
  rig.totalBlocksMined = 0;
  rig.totalSolMined = 0;
  assert.equal(story.canPassChapterGate(1), false, '第一章负例：未出块且代币不足时不可过章');

  rig.totalBlocksMined = 1;
  rig.totalSolMined = 4; // 低于 6
  assert.equal(story.canPassChapterGate(1), false, '第一章负例：累计产出未达 6 代币不可过章');

  rig.totalBlocksMined = 0;
  rig.totalSolMined = 10;
  assert.equal(story.canPassChapterGate(1), false, '第一章负例：未出块不可过章');

  // 检查第一章内系统章节锁
  const scannerInstall = rig.installScanner(1);
  assert.equal(scannerInstall.ok, false, '第一章系统锁：不可提前在矿机装载扫描仪 Mk1');
  const rigUpgradeL2 = rig.upgradeRig();
  assert.equal(rigUpgradeL2.ok, false, '第一章系统锁：矿机 L2 在第一章必须锁定');

  // --- 第二章 (Chapter 2) ---
  story.currentChapterId = 2;
  rig.scannerLevel = 0;
  game.ui.inventory.geo_scanner_mk1 = 0;
  story.firstResonanceSettled = false;
  rig.shardCount = 0;
  assert.equal(story.canPassChapterGate(2), false, '第二章负例：无扫描仪且未勘探结算不可过章');

  // 只有扫描仪，未结算共振
  rig.scannerLevel = 1;
  assert.equal(story.canPassChapterGate(2), false, '第二章负例：有扫描仪但未结算首次共振勘探不可过章');

  // 只有共振，无扫描仪
  rig.scannerLevel = 0;
  story.firstResonanceSettled = true;
  assert.equal(story.canPassChapterGate(2), false, '第二章负例：有共振结算但无扫描仪不可过章');

  // 检查第二章内系统章节锁
  const creviceAction = game.monkeyHelper.commandExploreCrevice({ cooldown: 0, pos: { distanceTo: () => 1 } });
  assert.equal(creviceAction, false, '第二章系统锁：小猴岩缝钻穴在此前必须锁定');
  const refineryBuild = game.campFacilities.buildRefinery();
  assert.equal(refineryBuild.ok, false, '第二章系统锁：精炼炉在第二章必须锁定');

  // --- 第三章 (Chapter 3) ---
  story.currentChapterId = 3;
  story.pureCrystalDelivered = false;
  rig.rigLevel = 1;
  assert.equal(story.canPassChapterGate(3), false, '第三章负例：未交付纯晶且矿机未升L2不可过章');

  story.pureCrystalDelivered = true;
  rig.rigLevel = 1;
  assert.equal(story.canPassChapterGate(3), false, '第三章负例：纯晶已交付但矿机未升至L2不可过章');

  story.pureCrystalDelivered = false;
  rig.rigLevel = 2;
  assert.equal(story.canPassChapterGate(3), false, '第三章负例：矿机升至L2但未交付纯晶不可过章');

  // 检查第三章内系统章节锁
  const shipUpgrade = game.shipUpgradeSystem.checkCanUpgrade();
  assert.equal(shipUpgrade.ok, false, '第三章系统锁：船只升级改装在第三章必须锁定');
  assert.match(shipUpgrade.reason, /需进入第四章/);
  const solShipUpgrade = game.shipUpgradeSystem.performSolUpgrade();
  assert.equal(solShipUpgrade, false, '第三章系统锁：船只黑市一键快造在第三章必须锁定');
  rig.rigLevel = 2;
  const rigUpgradeL3 = rig.upgradeRig();
  assert.equal(rigUpgradeL3.ok, false, '第三章系统锁：矿机 L3 在救回雷蒙德之前必须锁定');

  // --- 第四章 (Chapter 4) ---
  story.currentChapterId = 4;
  story.secondKidAwake = true;
  story.raymondRescued = false;
  game.timberIsleScene.survivorRescued = false;
  assert.equal(story.canPassChapterGate(4), false, '第四章负例：未救回探险学者雷蒙德不可过章');

  rig.rigLevel = 3;
  const rigUpgradeL4 = rig.upgradeRig();
  assert.equal(rigUpgradeL4.ok, false, '第四章系统锁：矿机 L4 在点亮北崖灯塔一期前必须锁定');

  // --- 第五章 (Chapter 5) ---
  story.currentChapterId = 5;
  story.lighthouseLit = false;
  game.lighthouse.isLit = false;
  rig.rigLevel = 3;
  assert.equal(story.canPassChapterGate(5), false, '第五章负例：灯塔未点亮且矿机未升L4不可过章');

  story.lighthouseLit = true;
  rig.rigLevel = 3; // 未升L4
  assert.equal(story.canPassChapterGate(5), false, '第五章负例：灯塔点亮但矿机未升L4不可过章');

  story.lighthouseLit = false;
  rig.rigLevel = 4;
  assert.equal(story.canPassChapterGate(5), false, '第五章负例：矿机升L4但灯塔未点亮不可过章');
}
console.log('  ✅ 逐章负例门与系统章节锁严格拦截验证全部通过！');

// ========================================================
// 3. 逐章章节门正例推进
// ========================================================
console.log('\n▶ [3/6] 验证逐章达成里程碑正向过章 (Positive Gate Advancements)...');

{
  const game = createTestGame();
  const story = game.story;
  const rig = game.miningRig;

  // Prologue -> Ch 1
  story.currentChapterId = 0;
  rig.loadedCrystals = 1;
  assert.equal(story.canPassChapterGate(0), true, '序章正例：拾得晶石/装配矿机即可过章');

  // Ch 1 -> Ch 2
  story.currentChapterId = 1;
  rig.totalBlocksMined = 1;
  rig.totalSolMined = 6;
  assert.equal(story.canPassChapterGate(1), true, '第一章正例：完成首次出块且产出达标(>=6)即可过章');

  // Ch 2 -> Ch 3
  story.currentChapterId = 2;
  rig.scannerLevel = 1;
  story.firstResonanceSettled = true;
  assert.equal(story.canPassChapterGate(2), true, '第二章正例：造出扫描仪且结算首次共振即可过章');

  // Ch 3 -> Ch 4
  story.currentChapterId = 3;
  story.pureCrystalDelivered = true;
  rig.rigLevel = 2;
  assert.equal(story.canPassChapterGate(3), true, '第三章正例：交付纯晶且升至L2即可过章');

  // Ch 4 -> Ch 5
  story.currentChapterId = 4;
  story.secondKidAwake = true;
  story.raymondRescued = true;
  assert.equal(story.canPassChapterGate(4), true, '第四章正例：艾莉康复且远航救回雷蒙德即可过章');

  // Ch 5 -> Ch 6
  story.currentChapterId = 5;
  story.lighthouseLit = true;
  rig.rigLevel = 4;
  assert.equal(story.canPassChapterGate(5), true, '第五章正例：灯塔点亮一期且矿机升L4即可过章进入自由漫游');
}
console.log('  ✅ 逐章正向过章里程碑断言通过！');

// ========================================================
// 4. 北崖灯塔一期工程：材料交付、总账扣除、点亮与L4解封
// ========================================================
console.log('\n▶ [4/6] 验证北崖灯塔一期工程 (交付清单、总账记账、视觉状态切换与L4解封)...');

{
  const game = createTestGame();
  const lh = game.lighthouse;
  const ledger = game.economyLedger;
  const inv = game.ui.inventory;

  assert.equal(lh.isLit, false, '灯塔初始必须为未点亮状态');
  assert.equal(lh.beamMesh.visible, false, '灯塔探照光束初始必须不可见');

  // 1. 尝试空仓交付
  assert.equal(lh.checkCanDeliver().ok, false, '材料不足时 checkCanDeliver 必须返回 false');
  assert.equal(lh.deliverPhase1().ok, false, '材料不足时 deliverPhase1 必须拒绝');

  // 2. 注入充足材料
  inv.sol_crystal = LIGHTHOUSE_DELIVERY.sol_crystal;
  inv.sol_crystal_pure = LIGHTHOUSE_DELIVERY.sol_crystal_pure;
  inv.sol_crystal_deep = LIGHTHOUSE_DELIVERY.sol_crystal_deep;

  assert.equal(lh.checkCanDeliver().ok, true, '材料齐备时 checkCanDeliver 必须通过');

  // 3. 执行交付
  const deliverRes = lh.deliverPhase1();
  assert.equal(deliverRes.ok, true, '交付必须成功');

  // 4. 验证总账与库存扣除
  assert.equal(inv.sol_crystal || 0, 0, '原石必须按定额扣除完毕');
  assert.equal(inv.sol_crystal_pure || 0, 0, '纯晶必须扣除完毕');
  assert.equal(inv.sol_crystal_deep || 0, 0, '深层晶石必须扣除完毕');

  const today = ledger.days.find(d => d.day === (game.survival?.day || 1)) || {};
  const lhDebit = today.outflow?.sol_crystal?.lighthouse || 0;
  assert.equal(lhDebit, LIGHTHOUSE_DELIVERY.sol_crystal, '总账必须精准记入 lighthouse 汇');

  // 5. 验证点亮状态与故事标记
  assert.equal(lh.isLit, true, '灯塔状态必须转为已点亮');
  assert.equal(lh.beamMesh.visible, true, '探照光束实体必须可见');
  assert.equal(game.story.lighthouseLit, true, '主线灯塔点亮标记必须置为 true');

  // 6. 验证矿机 L4 图纸解锁
  game.story.currentChapterId = 5;
  game.miningRig.rigLevel = 3;
  // 给矿机 L4 升级所需代币 (200)
  inv.sol_token = 250;
  const l4Upgrade = game.miningRig.upgradeRig();
  assert.equal(l4Upgrade.ok, true, '灯塔点亮后矿机 L4 升级必须允许');
  assert.equal(game.miningRig.rigLevel, 4, '矿机成功升至 L4');
}
console.log('  ✅ 北崖灯塔一期交付、扣账、点亮与 L4 解封验证通过！');

// ========================================================
// 5. 营地日常订单板：每日3单刷新、多池生成、履约记账
// ========================================================
console.log('\n▶ [5/6] 验证营地日常订单板 (多池3单、交付扣除与 order_deliver 记账)...');

{
  const game = createTestGame();
  const board = game.orderBoard;
  const ledger = game.economyLedger;
  const inv = game.ui.inventory;

  // 1. 初始化检查
  assert.equal(board.dailyOrders.length, 3, '每日必须刷新 3 项订单');
  const cats = board.dailyOrders.map(o => o.category);
  assert.ok(cats.includes('primary'), '订单池必须包含天然采集 Pool A');
  assert.ok(cats.includes('crafting'), '订单池必须包含营地构件 Pool B');
  assert.ok(cats.includes('mineral'), '订单池必须包含矿脉深研 Pool C');

  // 2. 尝试无资材交付
  const order0 = board.dailyOrders[0];
  const failDeliver = board.deliverOrder(order0.uniqueId);
  assert.equal(failDeliver.ok, false, '材料不足交付必须失败');

  // 3. 准备订单 0 材料并交付
  for (const [k, v] of Object.entries(order0.req)) {
    inv[k] = v;
  }
  const tokenBefore = inv.sol_token || 0;
  const succDeliver = board.deliverOrder(order0.uniqueId);
  assert.equal(succDeliver.ok, true, '材料满足交付必须成功');
  assert.equal(order0.completed, true, '订单必须标记为已完成');
  assert.equal(board.completedCount, 1, '履约计数必须增加');

  // 4. 验证账本收益
  const today = ledger.days.find(d => d.day === (game.survival?.day || 1)) || {};
  const orderCredit = today.inflow?.sol_token?.order_deliver || 0;
  assert.equal(orderCredit, order0.tokenReward, '总账必须精准记入 order_deliver 源');
  assert.equal((inv.sol_token || 0) - tokenBefore, order0.tokenReward, '背包代币必须正确增加');

  // 5. 跨天刷新
  board.onDayPassed(2);
  assert.equal(board.currentDay, 2, '订单板天数必须递增');
  assert.equal(board.dailyOrders.length, 3, '新一天必须重刷 3 项订单');
}
console.log('  ✅ 订单板多池刷新、履约与 order_deliver 总账记账验证通过！');

// ========================================================
// 6. 存档向后兼容与 Schema 快照往返
// ========================================================
console.log('\n▶ [6/6] 验证存档向后兼容与快照序列化往返 (Save Compatibility & Roundtrip)...');

{
  const game = createTestGame();
  const save = game.saveSystem;

  // 设置部分新状态
  game.lighthouse.setLit(true);
  game.orderBoard.completedCount = 5;

  const snap = save.createSnapshot();
  assert.ok(snap.lighthouse, '快照必须包含 lighthouse 字段');
  assert.equal(snap.lighthouse.isLit, true);
  assert.ok(snap.orderBoard, '快照必须包含 orderBoard 字段');
  assert.equal(snap.orderBoard.completedCount, 5);

  // 导出再导入测试
  const exported = save.exportSave();
  const freshGame = createTestGame();
  const freshSave = freshGame.saveSystem;

  const importRes = freshSave.importSave(exported);
  assert.equal(importRes.success, true, '导入新快照必须成功');
  assert.equal(freshGame.lighthouse.isLit, true, '导入后灯塔必须保持点亮');
  assert.equal(freshGame.orderBoard.completedCount, 5, '导入后订单板履约计数必须恢复');

  // 老存档 (不含 lighthouse / orderBoard) 平滑导入
  const legacySave = JSON.parse(exported);
  delete legacySave.lighthouse;
  delete legacySave.orderBoard;

  const legacyGame = createTestGame();
  const legacySaveSys = legacyGame.saveSystem;
  const legacyRes = legacySaveSys.importSave(JSON.stringify(legacySave));
  assert.equal(legacyRes.success, true, '导入缺失灯塔/订单板的老存档必须成功容灾');
  assert.equal(legacyGame.lighthouse.isLit, false, '老存档缺省时灯塔默认为未点亮');
  assert.equal(legacyGame.orderBoard.completedCount, 0, '老存档缺省时订单板计数默认为 0');
}
console.log('  ✅ 存档序列化往返与老存档向后兼容全部验证通过！');

console.log('\n🎉🎉🎉 [ALL MAINLINE SPINE TESTS PASSED] 主线矿业重排轮全部验收断言 100% 通过！\n');
