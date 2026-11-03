import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as engine from '../src/systems/resonance/ResonanceEngine.js';

// Run the real state/accounting methods without the optional Three.js renderer.
const rigUrl = new URL('../src/systems/MiningRigSystem.js', import.meta.url);
const rigSource = readFileSync(rigUrl, 'utf8')
  .replace("import * as THREE from 'three';", 'const THREE = { Vector3: class {}, Group: class {} };')
  .replace(/from '(\.\.?\/[^']+)'/g, (_, relative) => `from '${new URL(relative, rigUrl).href}'`);
const { MiningRigSystem, resonanceRoundRS } = await import(`data:text/javascript;base64,${Buffer.from(rigSource).toString('base64')}`);
class HeadlessRig extends MiningRigSystem {
  initEntityMesh() {}
  initSkyBeam() {}
  initBurstParticles() {}
}

// Execute the actual UI methods with only icon rendering replaced; no DOM/browser required.
const uiSource = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
function uiMethod(name) {
  const start = uiSource.indexOf(`  ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const end = uiSource.indexOf('\n  }', start) + 4;
  return new Function(...Object.keys(engine), 'iconHTML', `return ({${uiSource.slice(start, end)}}).${name};`)(...Object.values(engine), () => '');
}
const motherlodeHtml = uiMethod('_renderMotherlodeTabHtml');
const resonanceHtml = uiMethod('_renderResonanceTabHtml');
const bindEvents = uiMethod('_bindResonanceTabEvents');
function makeRig() {
  const game = {
    saveSystem: { saveSeed: 'commit-lock-2', saveGame: () => ({ success: true }) },
    dayNight: { currentMode: 'day' }, weatherSystem: { currentWeather: 'clear' },
    ui: { inventory: {}, showToast() {} }
  };
  const rig = new HeadlessRig(game);
  rig.setMode('resonance');
  rig.loadedCrystals = 10;
  rig.resonance.freeShares = 0;
  rig.ensureResonanceRound();
  return rig;
}
const ui = { _selectedSquare: 12 };
const probability = rig => motherlodeHtml.call(ui, rig, 0).match(/唤醒概率预估（含中签）: <strong[^>]*>([\d.]+)%/)[1];
const ev = rig => resonanceHtml.call(ui, rig, {}, 0, 0).match(/ · EV ([\d.]+)/)[1];
function finish(rig) {
  rig.advanceResonanceProgress(80);
  const result = structuredClone(rig.resonance.lastResult);
  rig.advanceResonanceProgress(20);
  assert.equal(rig.settleResonanceRound().ok, true);
  return result;
}

// Reproduction (sq = seeded winning square): placeShares(sq, 2)
// -> commitDeployment() -> placeShares(sq, 1)
// -> advanceResonanceProgress(80) -> advanceResonanceProgress(20) -> settle.
if (process.argv.includes('--reproduce')) {
  const rig = makeRig();
  const winner = engine.drawWinner(rig.resonance.roundSeed, rig.resonance.cluster);
  rig.placeShares(winner, 2);
  rig.commitDeployment();
  const added = rig.placeShares(winner, 1);
  console.log('post-commit +1:', { ok: added.ok, crystals: rig.loadedCrystals, draft: rig.resonance.deploy[winner], confirmed: rig.resonance.committedDeploy[winner] });
  const committed = [...rig.resonance.committedDeploy];
  const board = [...rig.resonance.board];
  const committedResult = finish(rig);
  console.log('post-commit RS:', rig.season.rs, 'confirmed-only RS:', resonanceRoundRS(committedResult, committed, board));
  const draft = makeRig();
  const before = { probability: probability(draft), ev: ev(draft) };
  draft.placeShares(12, 5);
  console.log('draft readings:', { before, after: { probability: probability(draft), ev: ev(draft) } });
  const result = finish(draft);
  console.log('unpaid draft RS:', draft.season.rs, 'expected:', resonanceRoundRS(result, new Array(25).fill(0), draft.resonance.board));
  process.exit(0);
}

const rig = makeRig();
const emptyProb = probability(rig);
const emptyEV = ev(rig);
assert.equal(emptyProb, '0.00');
assert.equal(emptyEV, '0');
assert.equal(rig.placeShares(12, 2).ok, true);
assert.equal(probability(rig), emptyProb, '草稿不改变母池概率');
assert.equal(ev(rig), emptyEV, '草稿不改变 EV');
assert.equal(rig.placeShares(12, 3).ok, true);
assert.equal(probability(rig), emptyProb);
assert.equal(ev(rig), emptyEV);
assert.equal(rig.loadedCrystals, 10, '草稿未扣款');
assert.equal(rig.commitDeployment().ok, true);
assert.equal(rig.loadedCrystals, 5);
assert.notEqual(probability(rig), emptyProb, '概率随确认部署变化');
assert.notEqual(ev(rig), emptyEV, 'EV 随确认部署变化');
const locked = structuredClone(rig.serialize());
for (const n of [1, -1]) {
  const rejected = rig.placeShares(12, n);
  assert.equal(rejected.ok, false, '确认后拒绝增减份');
  assert.match(rejected.msg, /已确认|已锁定/);
}
assert.equal(rig.commitDeployment().ok, false, '重复确认被拒绝');
assert.equal(rig.autoSplitEven().ok, false);
assert.equal(rig.autoSplitEvenHighEV().ok, false);
assert.equal(rig.allIn(12).ok, false);
assert.deepEqual(rig.serialize(), locked, '拒绝操作不改变份额、余额或积分');

const lockedHtml = resonanceHtml.call(ui, rig, {}, 0, 0);
for (const id of ['sub', 'add', 'split', 'allin', 'commit']) {
  assert.match(lockedHtml, new RegExp(`<button id="btn-res-${id}"[^>]*\\bdisabled`), `${id} 确认后禁用`);
}
// Even a stale pre-commit DOM click must not call the adjustment methods.
let calls = 0;
const listeners = {};
const staleBody = {
  querySelectorAll: () => [],
  querySelector: selector => ['#btn-res-add', '#btn-res-sub'].includes(selector)
    ? { addEventListener: (_, callback) => { listeners[selector] = callback; } } : null
};
bindEvents.call(ui, staleBody, { resonance: rig.resonance, placeShares() { calls++; } }, {}, () => {});
listeners['#btn-res-add']();
listeners['#btn-res-sub']();
assert.equal(calls, 0, '旧 UI 点击路径也拒绝确认后调整');

// Score/probability/EV must ignore a divergent draft, including old saved states.
const confirmedProb = probability(rig);
const confirmedEV = ev(rig);
rig.resonance.deploy.fill(0);
rig.resonance.deploy[0] = 6;
assert.equal(probability(rig), confirmedProb);
assert.equal(ev(rig), confirmedEV);
const committed = [...rig.resonance.committedDeploy];
const board = [...rig.resonance.board];
const result = finish(rig);
assert.equal(rig.season.rs, resonanceRoundRS(result, committed, board), 'RS 只按确认快照结算');
assert.equal(rig.placeShares(12, 2).ok, true, '下一轮重新允许草稿');

// A hit must also use the confirmed winning-square shares when the draft differs.
const hitRig = makeRig();
const winningSquare = engine.drawWinner(hitRig.resonance.roundSeed, hitRig.resonance.cluster);
assert.equal(hitRig.placeShares(winningSquare, 2).ok, true);
assert.equal(hitRig.commitDeployment().ok, true);
const saved = structuredClone(hitRig.serialize());
const reloaded = makeRig();
reloaded.deserialize(saved);
assert.equal(reloaded.placeShares(winningSquare, 1).ok, false, '重载后仍锁定');
const hitDeploy = [...reloaded.resonance.committedDeploy];
const hitBoard = [...reloaded.resonance.board];
reloaded.resonance.deploy.fill(0);
const hitResult = finish(reloaded);
assert.equal(hitResult.hit, true);
assert.equal(reloaded.season.rs, resonanceRoundRS(hitResult, hitDeploy, hitBoard), '命中 RS 只按确认份额');

for (const shares of [0, 2, 5]) {
  const draft = makeRig();
  if (shares) assert.equal(draft.placeShares(12, shares).ok, true);
  finish(draft);
  assert.equal(draft.season.rs, 0, '未扣款草稿结算 RS 为 0');
  assert.equal(draft.loadedCrystals, 10);
}
console.log('resonance commit lock / committed-only probability, EV and RS passed');
