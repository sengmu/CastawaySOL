// CastawaySOL - R9 事件钩子与经济平衡专项测试套件
// 依据 DESIGN-RESONANCE.md §10 第 3 轮验收标准编写
import assert from 'node:assert/strict';
import {
  ODDS_TABLE,
  genRoundSeed,
  genCluster,
  genNpcBoard,
  settle
} from '../src/systems/resonance/ResonanceEngine.js';
import { MiningRigSystem } from '../src/systems/MiningRigSystem.js';
import { CampFacilitiesSystem } from '../src/systems/CampFacilitiesSystem.js';
import { FlotsamSalvageSystem } from '../src/systems/FlotsamSalvageSystem.js';
import * as THREE from 'three';

console.log('⚖️ 开始执行 CastawaySOL R9 事件钩子与经济平衡全链路测试套件...\n');

const mockGame = {
  saveSystem: { saveSeed: 'test_save_r9', saveGame: () => ({ success: true }) },
  solanaBridge: { submitMiningProof: () => {} },
  dayNight: { currentMode: 'day' },
  weatherSystem: { currentWeather: 'clear' },
  ui: {
    showToast: () => {},
    showDialog: () => {},
    renderInventory: () => {},
    inventory: {}
  },
  storageSystem: {
    storageInventory: {}
  }
};

// ==========================================
// 断言 3: 防刷睡机制（连续睡觉 10 次只能拿到 1 次免费份额）
// ==========================================
console.log('▶ [断言 3/6] 验证防刷睡门控（连续睡觉 10 次只能获得 1 次免费份额）...');
const rigSleep = new MiningRigSystem(mockGame);
rigSleep.setMode('resonance');
rigSleep.resonance.freeShares = 0;
rigSleep.resonance.freeGrantDay = 0;
rigSleep.resonance.freeGrantTs = 0;
rigSleep.resonance.freeGrantSteps = 0;

// 第一次睡觉：满足新自然日、时间、步数要求，成功发放 3 份
mockGame.survival = { steps: 250 };
rigSleep.onNewDay(1);
assert.equal(rigSleep.resonance.freeShares, 3, '首个有效游戏日必须发放 3 份免费份额');

// 连续快速睡觉 9 次 (无步数增长，未过15分钟)
for (let d = 2; d <= 10; d++) {
  rigSleep.onNewDay(d);
}
assert.equal(rigSleep.resonance.freeShares, 3, '连续刷睡 9 次必须全部被拦截，份额保持 3 不变');
console.log('  ✅ 防刷睡门控生效：连续入睡 10 次严格仅发放 1 次免费份额！');

// ==========================================
// 断言 4: 保底校准值最大未命中连串 <= 15
// ==========================================
console.log('\n▶ [断言 4/6] 验证保底校准值机制（最长未命中连串 <= 15）...');
let maxMissStreak = 0;
let currentStreak = 0;

for (let r = 0; r < 20_000; r++) {
  const seed = `pity_test_${r}`;
  const cl = genCluster('day_1', r);
  const bd = genNpcBoard(seed, 5, 1.0, 1.0, 1.0, cl);

  // 故意押在冷格上测试未命中
  const dep = new Array(25).fill(0);
  dep[0] = 2; // 满足投入 >= 2

  const res = settle(bd, dep, 100, {
    u: 5,
    roundSeed: seed,
    cluster: cl,
    currentCalib: currentStreak
  });

  if (res.hit || res.calibReward) {
    // 命中或触发保底重置
    currentStreak = 0;
  } else {
    currentStreak = res.calib;
    if (currentStreak > maxMissStreak) {
      maxMissStreak = currentStreak;
    }
  }
  assert.ok(currentStreak <= 15, `保底校准值 ${currentStreak} 绝不可超过 15`);
}

assert.ok(maxMissStreak <= 15, `最大未命中连串 ${maxMissStreak} 必须 <= 15`);
console.log(`  ✅ 20,000 轮测试最大连空连串为 ${maxMissStreak} <= 15，保底 100% 生效！`);

// ==========================================
// 断言 5: 可用 SOL 购买的道具对晶石产量和 RS 的影响严格为 0
// ==========================================
console.log('\n▶ [断言 5/6] 验证 SOL 付费道具纯洁性（对晶石产量影响为 0）...');

// 5.1 浮标自动打捞不产晶石
const flotsamSys = new FlotsamSalvageSystem(new THREE.Scene(), mockGame);
flotsamSys.unlockAutoSalvageBuoy();
assert.equal(flotsamSys.hasAutoSalvageBuoy, true);

mockGame.storageSystem.storageInventory = { sol_crystal: 0, wood_plank: 0 };
// 模拟执行 10 次自动打捞
for (let i = 0; i < 10; i++) {
  const crate = {
    collected: false,
    group: { visible: true },
    spec: { name: '海难漂流板条箱', drops: ['wood_plank', 'apple', 'sol_crystal'] }
  };
  flotsamSys.flotsamList = [crate];
  flotsamSys.performAutoSalvage();
}
assert.equal(mockGame.storageSystem.storageInventory.sol_crystal, 0, '付费浮标自动打捞所得晶石增量必须严格为 0');

// 5.2 生产执照不乘算晶石
const campSys = new CampFacilitiesSystem(mockGame);
mockGame.story = { secondKidAwake: true };
campSys.assignJob('second_kid', 'miner');

// 未购买执照
campSys.isAutoProductionActive = false;
campSys.purifierWaterLevel = 0;
mockGame.storageSystem.storageInventory = { sol_crystal: 0 };
campSys.onDayPassed();
const crystalWithoutLicense = mockGame.storageSystem.storageInventory.sol_crystal;

// 购买执照后
campSys.isAutoProductionActive = true;
mockGame.storageSystem.storageInventory = { sol_crystal: 0 };
campSys.onDayPassed();
const crystalWithLicense = mockGame.storageSystem.storageInventory.sol_crystal;

assert.equal(crystalWithoutLicense, 2, '未购执照矿工产晶 2 块');
assert.equal(crystalWithLicense, 2, '购买执照后矿工产晶仍为 2 块，执照不得加速晶石');
console.log('  ✅ SOL 付费道具对晶石供给影响严格为 0，合规防线牢不可破！');

// ==========================================
// 断言 6: 回报率回归测试（重跑第 1 轮第 5 条全部通过）
// ==========================================
console.log('\n▶ [断言 6/6] 回报率回归检验 (中性 76%–84%、最优 <= 105%)...');

function runRTPCheck(rounds, strategy, weather = null, phase = null) {
  let cost = 0, returnVal = 0, pool = 100, calib = 0;
  const phases = ['dawn', 'day', 'day', 'dusk', 'night'];
  const weathers = ['clear', 'clear', 'cloudy', 'rain', 'typhoon'];

  for (let i = 0; i < rounds; i++) {
    const p = phase || phases[i % phases.length];
    const w = weather || weathers[Math.floor(i / 5) % weathers.length];
    const seed = `rtp_regress_${strategy}_${i}`;
    const cl = genCluster('day_1', i);
    const bd = genNpcBoard(seed, 5, ODDS_TABLE.PHASE_MULTIPLIERS[p], ODDS_TABLE.WEATHER_MULTIPLIERS[w], 1.0, cl);

    const dep = new Array(25).fill(0);
    if (strategy === 'neutral') {
      dep[i % 25] = 5;
      dep[(i + 7) % 25] = 5;
      dep[(i + 14) % 25] = 5;
    } else if (strategy === 'optimal') {
      dep[cl.mainIndex] = 5;
      dep[cl.subIndices[0]] = 5;
      dep[cl.subIndices[1]] = 5;
    }

    const shares = dep.reduce((a, b) => a + b, 0);
    if (!shares) continue;

    const res = settle(bd, dep, pool, {
      u: 5,
      roundSeed: seed,
      cluster: cl,
      weather: w,
      currentCalib: calib
    });
    pool = res.motherlode.nextPool;
    calib = res.calib;

    cost += shares * ODDS_TABLE.V;
    returnVal += res.payout + (res.shards * 0.25 * ODDS_TABLE.V) + res.motherlode.playerTake + (res.calibReward ? 2 * ODDS_TABLE.V : 0);
  }
  return returnVal / cost;
}

const rtpNeutral = runRTPCheck(15_000, 'neutral');
console.log(`  中性策略回归 RTP: ${(rtpNeutral * 100).toFixed(2)}% (要求 76% - 84%)`);
assert.ok(rtpNeutral >= 0.76 && rtpNeutral <= 0.84, '中性策略必须在 [0.76, 0.84]');

const rtpOptimal = runRTPCheck(15_000, 'optimal');
console.log(`  最优策略回归 RTP: ${(rtpOptimal * 100).toFixed(2)}% (要求 <= 105%)`);
assert.ok(rtpOptimal <= 1.05, '最优策略必须 <= 1.05');
console.log('  ✅ 回报率回归测试全部通过！');

// ==========================================
// 断言 1 & 2: 30 天模拟经济轨迹与母池触发间隔中位数
// ==========================================
console.log('\n▶ [断言 1&2/6] 30 天典型玩家经济轨迹模拟与母池触发间隔...');

const { simulateEconomy, assertEconomy } = await import('../tools/sim-economy.mjs');
const simResult = simulateEconomy();
const final = simResult.snapshots.at(-1);
console.log(`  新口径 30 天余额: ${final.balance.toFixed(2)}；母池: ${final.pool.toFixed(2)}`);
assert.deepEqual(assertEconomy(simResult), [], 'G3 真实剧本硬线（保留 284±20%，另收紧 Day7）');
console.log('  ✅ 30 天宏观经济模拟平衡验证通过！');

console.log('\n🎉🎉🎉 [ALL R9 TESTS PASSED] R9 事件钩子、母池经济与长线平衡测试 100% 全部通过！');
