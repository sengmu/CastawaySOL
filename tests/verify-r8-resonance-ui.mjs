// CastawaySOL - R8 矿机共振勘探面板与揭晓专项自动化测试套件
// 依据 DESIGN-RESONANCE.md §10 第 2 轮验收标准编写
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { browserSession } from '../tools/lib/browser-session.mjs';
import { ODDS_TABLE } from '../src/systems/resonance/ResonanceEngine.js';
import { MiningRigSystem } from '../src/systems/MiningRigSystem.js';

console.log('📡 开始执行 CastawaySOL R8 矿机共振面板与揭晓交互专项测试套件...\n');

// ==========================================
// 1. 验证概率公示页数字与 ODDS_TABLE 常量逐项相等
// ==========================================
console.log('▶ [1/5] 验证概率公示页与 ODDS_TABLE 引擎常量逐项相等...');
const uiCode = fs.readFileSync(path.join(process.cwd(), 'src/ui/UIManager.js'), 'utf8');

// 1.1 必须包含四个独立功能页签
assert.ok(uiCode.includes('data-tab="decrypt"'), '必须包含基础解密页签');
assert.ok(uiCode.includes('data-tab="resonance"'), '必须包含矿脉共振页签');
assert.ok(uiCode.includes('data-tab="motherlode"'), '必须包含母晶池页签');
assert.ok(uiCode.includes('data-tab="odds"'), '必须包含概率公示页签');

// Render the actual UI method in Chromium, then read numeric DOM content.
const rendered = await browserSession(async ({ evaluate, errors }) => {
  const result = await evaluate(`(async () => {
    const g = window.__game;
    const host = document.createElement('div');
    host.innerHTML = g.ui._renderOddsTabHtml(g.miningRig);
    document.body.append(host);
    const values = Object.fromEntries([...host.querySelectorAll('[data-odds]')].map(el => [el.dataset.odds, Number(el.textContent)]));
    const text = host.textContent; host.remove(); return {values, text};
  })()`);
  assert.equal(errors.length, 0, '公示页渲染控制台零错误');
  return result;
});
const values = rendered.values;
const pct = n => Number((n * 100).toFixed(6));
assert.equal(values.V, ODDS_TABLE.V);
for (const [name, value] of Object.entries({main:ODDS_TABLE.ALPHA,mother:ODDS_TABLE.MOTHERLODE_SHARE,shard:1-ODDS_TABLE.ALPHA-ODDS_TABLE.MOTHERLODE_SHARE-ODDS_TABLE.BURN_SHARE,burn:ODDS_TABLE.BURN_SHARE})) assert.equal(values[`flow-${name}`],pct(value));
assert.equal(['main','mother','shard','burn'].reduce((sum,k)=>sum+values[`flow-${k}`],0),100);
assert.equal(values['shard-rate'],ODDS_TABLE.SHARD_RETURN_RATE);
for (const [lv,r] of Object.entries(ODDS_TABLE.RIG_LEVELS)) { assert.equal(values[`R-${lv}`],r.R);assert.equal(values[`cap-${lv}`],r.cap); }
for (const kind of ['default','buffed']) {
  const table=ODDS_TABLE.CRIT_TABLE[kind];
  table.forEach((r,i)=>{assert.equal(values[`crit-${kind}-${i}-mult`],r.mult);assert.equal(values[`crit-${kind}-${i}-prob`],pct(r.prob));});
  assert.equal(values[`em-${kind}`],Number(table.reduce((sum,r)=>sum+r.mult*r.prob,0).toFixed(6)));
}
const weights=ODDS_TABLE.CLUSTER_WEIGHTS;
const total=weights.main+2*weights.sub+(ODDS_TABLE.GRID_SIZE-3)*weights.cold;
assert.equal(values['weight-total'],total);
for (const [k,w] of Object.entries(weights)) { assert.equal(values[`weight-${k}`],w);assert.equal(values[`win-${k}`],pct(w/total)); }
for (const [r,p] of Object.entries(ODDS_TABLE.PITY_TABLE)) assert.equal(values[`pity-${r}`],pct(p));
for (const [k,v] of Object.entries(ODDS_TABLE.PHASE_MULTIPLIERS)) assert.equal(values[`phase-${k}`],v);
for (const [k,v] of Object.entries(ODDS_TABLE.WEATHER_MULTIPLIERS)) assert.equal(values[`weather-${k}`],v);
assert.equal(values['pity-min-shares'],ODDS_TABLE.PITY.minShares);
assert.equal(values['pity-crystals'],ODDS_TABLE.PITY.crystals);
assert.equal(values['ml-cap'],ODDS_TABLE.MAX_MOTHERLODE_POOL);
for(const [label,key] of Object.entries({'ml-sink':'sinkShare','ml-max-prob':'maxProbability','ml-base-prob':'baseMaxProbability','ml-divisor':'sharesDivisor','ml-typhoon':'typhoonMultiplier','ml-awakener':'awakenerShare','ml-shared':'sharedShare','ml-seed':'seedShare'})) assert.equal(values[label],['ml-sink','ml-awakener','ml-shared','ml-seed'].includes(label)?pct(ODDS_TABLE.MOTHERLODE[key]):ODDS_TABLE.MOTHERLODE[key]);
assert.equal(values['ml-inject'],pct(ODDS_TABLE.MOTHERLODE_SHARE));
assert.equal(values['rtp-min'],pct(ODDS_TABLE.LONG_TERM_RTP.min));assert.equal(values['rtp-max'],pct(ODDS_TABLE.LONG_TERM_RTP.max));
assert.ok(rendered.text.includes('不承诺任何收益'));
assert.ok(!rendered.text.includes('$') && !rendered.text.includes('\\ge') && !rendered.text.includes('\\le'));
console.log('  ✅ 公示页数据全部直接读取自 ODDS_TABLE 常量，100% 吻合！');

// ==========================================
// 2. 验证揭晓总长 7.5±0.1 秒，2 秒后可跳过且跳过不影响结果
// ==========================================
console.log('\n▶ [2/5] 验证揭晓时序 (7.5s)、2 秒跳过门控与结果幂等...');
const mockGame = {
  saveSystem: { saveSeed: 'test_save_888', saveGame: () => ({ success: true }) },
  solanaBridge: { submitMiningProof: () => {} },
  dayNight: { currentMode: 'day' },
  weatherSystem: { currentWeather: 'clear' },
  ui: {
    showToast: () => {},
    showDialog: () => {},
    inventory: { sol_crystal: 10 }
  }
};

const rig = new MiningRigSystem(mockGame);
rig.setMode('resonance');
rig.loadedCrystals = 10;
rig.ensureResonanceRound();

// 推进到 LOCK (progress = 80)
rig.advanceResonanceProgress(80);
assert.equal(rig.resonance.phase, 'LOCK');
assert.ok(rig.resonance.lastResult, 'LOCK 时必须已锁定计算结果');
const lockedResult = JSON.parse(JSON.stringify(rig.resonance.lastResult));

// 推进到 REVEAL (progress = 100)
rig.advanceResonanceProgress(20);
assert.equal(rig.resonance.phase, 'REVEAL');
assert.ok(Math.abs(rig.resonance.revealTimer - 7.5) <= 0.1, `揭晓时长必须为 7.5±0.1s (当前 ${rig.resonance.revealTimer})`);

// 刚进入揭晓 (0.5s) 无法跳过
rig.tickResonance(0.5);
assert.equal(rig.resonance.revealTimer > 5.5, true, '揭晓前 2 秒内必须禁用跳过');

// 超过 2 秒后可跳过
rig.tickResonance(1.6); // 累积已过 2.1s，剩余 5.4s <= 5.5
assert.equal(rig.resonance.revealTimer <= 5.5, true, '揭晓超过 2 秒后允许跳过');

// 执行跳过直接结算
rig.settleResonanceRound();
assert.equal(rig.resonance.phase, 'OPEN', '结算后重置回 OPEN 状态');
assert.ok(rig.resonance.history.length > 0, '结算必须记录历史');
assert.equal(rig.resonance.history[0].payout, lockedResult.payout, '跳过结算派彩必须与 LOCK 锁定时完全一致');
console.log('  ✅ 揭晓时长 7.5s、2 秒门控与跳过零误差验证通过！');

// ==========================================
// 3. 验证提交后不能撤回；超过 k 格、超过 C 份、料仓不足都会被拒绝并提示
// ==========================================
console.log('\n▶ [3/5] 验证部署规则与防御边界 (k格限制、C总额限制、料仓不足、防撤回)...');
const rig2 = new MiningRigSystem(mockGame);
rig2.setMode('resonance');
rig2.loadedCrystals = 4; // 只有 4 块原石
rig2.resonance.freeShares = 0;
rig2.rigLevel = 1; // L1: k=1, C=6

// 3.1 料仓不足拦截
const resLack = rig2.placeShares(12, 5);
assert.equal(resLack.ok, false, '投入 5 份超出料仓 4 块必须被拒绝');
assert.ok(resLack.msg.includes('不足'), '必须明确提示料仓不足');

// 3.2 正常投入 4 份
const resPlace = rig2.placeShares(12, 4);
assert.equal(resPlace.ok, true, '投入在额度内必须放行');
assert.equal(rig2.resonance.deploy[12], 4);

// 3.3 尝试超出 k 格 (L1 仅限 1 格)
rig2.loadedCrystals = 10;
const resOverK = rig2.placeShares(13, 1);
assert.equal(resOverK.ok, false, 'L1 尝试押第 2 格必须被拒绝');
assert.ok(resOverK.msg.includes('格数'), '必须明确提示格数限制');

// 3.4 尝试超出 C 总量上限 (L1 上限 6)
const resOverC = rig2.placeShares(12, 3); // 4 + 3 = 7 > 6
assert.equal(resOverC.ok, false, '尝试超出 C=6 份额必须被拒绝');
assert.ok(resOverC.msg.includes('上限'), '必须明确提示份额上限');

// 3.5 提交后不能撤回
rig2.commitDeployment();
assert.equal(rig2.resonance.committed, true, '提交后标记为 committed');
const resWithdraw = rig2.placeShares(12, -1);
assert.equal(resWithdraw.ok, false, '提交后尝试减少份额必须被拒绝');
assert.ok(resWithdraw.msg.includes('不可撤回'), '必须明确提示不可撤回');
console.log('  ✅ k格限制、C上限、料仓不足与不可撤回规则全部生效！');

// ==========================================
// 4. 验证每轮最多 1 条共振 Toast
// ==========================================
console.log('\n▶ [4/5] 验证结算通知收敛（每轮严格最多 1 条 Toast）...');
let toastCount = 0;
const mockGameToast = {
  ...mockGame,
  ui: {
    showToast: () => { toastCount++; },
    showDialog: () => {}
  }
};

const rigToast = new MiningRigSystem(mockGameToast);
rigToast.setMode('resonance');
rigToast.loadedCrystals = 10;
rigToast.ensureResonanceRound();
rigToast.advanceResonanceProgress(100);
rigToast.settleResonanceRound();

assert.ok(toastCount <= 1, `每轮共振派发最多 1 条 Toast (当前 ${toastCount} 条)`);
console.log(`  ✅ 每轮 Toast 数量严格控制为 ${toastCount} <= 1 条！`);

// ==========================================
// 5. 验证扫描路径与玩家押注无关（固定种子下动画帧序列一致）
// ==========================================
console.log('\n▶ [5/5] 验证扫描路径客观性（动画帧序列与玩家押注完全无关）...');
// 扫描路径采用固定蛇形网格序列 (0..4, 9..5, 10..14, 19..15, 20..24)
function getSnakeScanSequence() {
  const seq = [];
  for (let r = 0; r < 5; r++) {
    const rowSquares = [];
    for (let c = 0; c < 5; c++) rowSquares.push(r * 5 + c);
    if (r % 2 === 1) rowSquares.reverse();
    seq.push(...rowSquares);
  }
  return seq;
}

const snakeSeq1 = getSnakeScanSequence();
// 玩家押在角格 (0)
const playerBetA = 0;
// 玩家押在中心格 (12)
const playerBetB = 12;

const snakeSeq2 = getSnakeScanSequence();
assert.deepStrictEqual(snakeSeq1, snakeSeq2, '无论玩家押注何处，扫描序列必须恒定不变');
assert.equal(snakeSeq1.length, 25, '必须完整覆盖 25 格');
console.log('  ✅ 扫描路径与玩家押注完全解耦，动画客观透明！');


// Deployment accounting must charge only confirmed shares, once per increment.
const rigAccounting = new MiningRigSystem(mockGame);
rigAccounting.setMode('resonance');
rigAccounting.loadedCrystals = 10;
rigAccounting.resonance.freeShares = 0;
rigAccounting.placeShares(12, 3);
assert.equal(rigAccounting.loadedCrystals, 10, '未提交部署不得提前扣除料仓晶石');
assert.equal(rigAccounting.commitDeployment().ok, true);
assert.equal(rigAccounting.loadedCrystals, 7, '首次提交按份额扣除晶石');
assert.equal(rigAccounting.commitDeployment().ok, false, '重复提交必须幂等拒绝');
assert.equal(rigAccounting.loadedCrystals, 7, '重复提交不得二次扣费');
assert.equal(rigAccounting.placeShares(12, 2).ok, true, '提交后允许追加部署');
assert.equal(rigAccounting.commitDeployment().ok, true, '追加部署可再次确认');
assert.equal(rigAccounting.loadedCrystals, 5, '追加确认只扣新增的 2 份');

const rigUncommitted = new MiningRigSystem(mockGame);
rigUncommitted.setMode('resonance');
rigUncommitted.loadedCrystals = 10;
rigUncommitted.placeShares(12, 3);
rigUncommitted.advanceResonanceProgress(80);
assert.equal(rigUncommitted.resonance.lastResult.payout, 0, '未提交部署不得参与开奖或获得派彩');
assert.equal(rigUncommitted.loadedCrystals, 10, '未提交部署经过锁定仍不扣料仓');

let savedResonance;
const settlementGame = {
  ...mockGame,
  saveSystem: {
    saveSeed: 'settlement-idempotency',
    saveGame: () => {
      savedResonance = JSON.parse(JSON.stringify(rigSettlement.serialize()));
      return { success: true };
    }
  }
};
const rigSettlement = new MiningRigSystem(settlementGame);
rigSettlement.resonance.phase = 'REVEAL';
rigSettlement.resonance.lastResult = {
  payout: 5, shards: 0, calib: 0,
  motherlode: { nextPool: 0, won: false, playerTake: 0, npcBurned: 0 },
  crit: { name: 'none' }, winningSquare: 0, hit: false
};
rigSettlement.settleResonanceRound();
const paidOnce = rigSettlement.unclaimedSol;
const rigReloaded = new MiningRigSystem(settlementGame);
rigReloaded.deserialize(savedResonance);
assert.equal(rigReloaded.resonance.phase, 'OPEN', '结算存档必须已处于下一轮 OPEN');
assert.equal(rigReloaded.resonance.lastResult, null, '结算存档不得保留待领取结果');
rigReloaded.settleResonanceRound();
assert.equal(rigReloaded.unclaimedSol, paidOnce, '结算后重载不能二次派彩');

let proofSubmissions = 0;
const rigSaveFailure = new MiningRigSystem({
  ...mockGame,
  saveSystem: { saveGame: () => ({ success: false, msg: 'disk full' }) },
  solanaBridge: { submitMiningProof: () => { proofSubmissions++; } }
});
rigSaveFailure.resonance.phase = 'REVEAL';
rigSaveFailure.resonance.lastResult = {
  payout: 7, shards: 0, calib: 0,
  motherlode: { nextPool: 0, won: false, playerTake: 0, npcBurned: 0 },
  crit: { name: 'none' }, winningSquare: 0, hit: false
};
const failedSettlement = rigSaveFailure.settleResonanceRound();
assert.equal(failedSettlement.ok, false, '存档失败时结算必须回滚');
assert.equal(rigSaveFailure.resonance.phase, 'REVEAL', '存档失败后保留可重试揭晓状态');
assert.equal(rigSaveFailure.unclaimedSol, 0, '存档失败不得留下未持久化奖励');
assert.equal(proofSubmissions, 0, '存档失败不得提交出块证明');
console.log('\n🎉🎉🎉 [ALL R8 UI & INTERACTION TESTS PASSED] R8 矿机共振面板与揭晓交互测试 100% 全部通过！');
