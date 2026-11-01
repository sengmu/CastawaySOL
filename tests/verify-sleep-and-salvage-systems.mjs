// Mock global localStorage for Node environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
}
import assert from 'node:assert';
import { SurvivalSystem } from '../src/systems/SurvivalSystem.js';
import { FlotsamSalvageSystem } from '../src/systems/FlotsamSalvageSystem.js';
import { solanaBridge } from '../src/core/SolanaBridge.js';
import { ISLAND_LAYOUT, distanceXZ } from '../src/core/IslandLayout.js';

console.log('🛌 开始执行 CastawaySOL 睡眠反馈、自动化打捞与矿机存证自动化测试套件...\n');

// 1. 验证过夜睡眠与数值恢复
console.log('▶ [1/4] 验证睡眠过夜数值与天数推进...');
const mockPlayer = { position: { x: -17, y: 0, z: 23 } };
const survival = new SurvivalSystem(() => {});
survival.fatigue = 80;
survival.life = 60;
survival.hunger = 80;
survival.water = 80;
const prevDay = survival.day;

survival.sleepOvernight();
assert.strictEqual(survival.day, prevDay + 1, '天数应当推进 1 天');
assert.strictEqual(survival.fatigue <= 10, true, '疲劳应当大幅消除');
assert.strictEqual(survival.life >= 80, true, '生命应当得到恢复');
console.log(`  ✅ 睡眠结算通过：第 ${survival.day} 天，疲劳: ${survival.fatigue}，生命: ${survival.life}`);

// 2. 验证营地坐标与帐篷距离
console.log('\n▶ [2/4] 验证营地帐篷与篝火物理锚点...');
assert.deepStrictEqual(ISLAND_LAYOUT.tent, [-17, 0, 23], '帐篷坐标必须为 [-17, 0, 23]');
assert.deepStrictEqual(ISLAND_LAYOUT.campfire, [-12, 0.05, 24], '营火坐标必须为 [-12, 0.05, 24]');
const tentDist = distanceXZ({ x: -17, z: 23 }, ISLAND_LAYOUT.tent);
assert.strictEqual(tentDist < 0.01, true, '原点距离帐篷几乎为 0');
console.log('  ✅ 帐篷与营火物理锚点统一验证通过！');

// 3. 验证近海自动化打捞浮标网多阶升级与归仓
console.log('\n▶ [3/4] 验证近海自动化打捞浮标多阶升级与归仓...');
// Mock THREE scene
const mockScene = { add: () => {} };
const mockStorage = { storageInventory: {} };
const mockGame = { storageSystem: mockStorage, ui: { showToast: () => {} } };

const salvage = new FlotsamSalvageSystem(mockScene, mockGame);
assert.strictEqual(salvage.tier, 1, '初始等级必须为 T1');
assert.strictEqual(salvage.AUTO_SALVAGE_INTERVAL, 30.0, 'T1 间隔必须为 30s');

salvage.unlockAutoSalvageBuoy();
assert.strictEqual(salvage.hasAutoSalvageBuoy, true, '浮标网必须已解锁');

const up1 = salvage.upgradeTier();
assert.strictEqual(up1.success, true);
assert.strictEqual(salvage.tier, 2, '升级后必须为 T2');
assert.strictEqual(salvage.AUTO_SALVAGE_INTERVAL, 18.0, 'T2 间隔必须为 18s');

const up2 = salvage.upgradeTier();
assert.strictEqual(up2.success, true);
assert.strictEqual(salvage.tier, 3, '升级后必须为 T3');
assert.strictEqual(salvage.AUTO_SALVAGE_INTERVAL, 10.0, 'T3 间隔必须为 10s');

// 测试自动归仓
salvage.performAutoSalvage();
assert.strictEqual(salvage.totalSalvaged, 1, '累计捕获数应当记录为 1');
const storedItems = Object.keys(mockStorage.storageInventory);
assert.strictEqual(storedItems.length > 0, true, '储物箱应当成功收入打捞建材');
console.log(`  ✅ 自动打捞归仓成功，储物箱收入: ${JSON.stringify(mockStorage.storageInventory)}`);

// 测试序列化与反序列化
const saved = salvage.serialize();
assert.strictEqual(saved.tier, 3);
assert.strictEqual(saved.totalSalvaged, 1);

const salvage2 = new FlotsamSalvageSystem(mockScene, mockGame);
salvage2.deserialize(saved);
assert.strictEqual(salvage2.tier, 3);
assert.strictEqual(salvage2.totalSalvaged, 1);
assert.strictEqual(salvage2.AUTO_SALVAGE_INTERVAL, 10.0);
console.log('  ✅ 浮标网多阶存档与读档验证通过！');

// 4. 验证矿机算力工作证明上链存证
console.log('\n▶ [4/4] 验证 DePIN 矿机算力工作证明存证...');
const proof = solanaBridge.submitMiningProof(12, 18);
assert.strictEqual(proof.blocks, 12, '已验证区块应当一致');
assert.strictEqual(proof.totalSol, 18, '代币产出应当一致');
const retrieved = solanaBridge.getMiningStats();
assert.strictEqual(retrieved.blocks, 12, '读取本地存证区块一致');
assert.strictEqual(retrieved.totalSol, 18, '读取本地存证代币一致');
console.log(`  ✅ 算力工作证明存证验证通过：区块 #${proof.blocks}，累计 ${proof.totalSol} $SOL！`);

console.log('\n🎉🎉 [ALL SLEEP & SALVAGE TESTS PASSED] 睡眠反馈、打捞工坊与矿机存证 100% 验证通过！');
