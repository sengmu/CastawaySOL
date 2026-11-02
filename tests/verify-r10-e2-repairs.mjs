import assert from 'node:assert/strict';
import { MiningRigSystem } from '../src/systems/MiningRigSystem.js';
import { SaveSystem } from '../src/systems/SaveSystem.js';
import { ODDS_TABLE, cyrb53, genNpcBoard } from '../src/systems/resonance/ResonanceEngine.js';
const game = { survival: { day: 1, steps: 0 }, dayNight: { currentMode: 'sunrise' }, ui: { inventory: { sol_token: 400 }, renderInventory() {}, updateSurvivalHUD() {}, showToast() {} }, saveSystem: { saveSeed: 'r10', saveGame: () => ({ success: true }) } };
const rig = new MiningRigSystem(game); game.miningRig = rig;
assert.deepEqual(ODDS_TABLE.PHASE_KEY_MAP, { day:'day', sunrise:'dawn', sunset:'dusk', night:'night' });
assert.equal(rig.isDaytime(), true);
game.dayNight.currentMode = 'sunset'; rig.ensureResonanceRound();
assert.deepEqual(rig.resonance.board, genNpcBoard(rig.resonance.roundSeed, 6, ODDS_TABLE.PHASE_MULTIPLIERS.dusk, 1, 1, rig.resonance.cluster));
assert.equal(rig.resonance.seedCommit, cyrb53(rig.resonance.roundSeed).toString(16));
function finish({ deployed = true, reward = null, payout = 0.6 } = {}) {
 rig.resonance.phase = 'REVEAL'; rig.resonance.committedDeploy.fill(0); if (deployed) rig.resonance.committedDeploy[0] = 2;
 rig.resonance.lastResult = { payout, shards:0, calib:0, calibReward: reward, winningSquare:0, hit:false, crit:{name:'none'}, motherlode:{ won:false, nextPool:0, playerTake:0, npcBurned:0 }, excessToMotherlode:0 };
 rig.settleResonanceRound();
}
rig.applyResonanceBuff('energy_drink'); finish({deployed:false}); assert.equal(rig.resonance.buff.roundsLeft, 2);
finish(); assert.equal(rig.resonance.buff.roundsLeft, 1); finish(); assert.equal(rig.resonance.buff.id, null);
assert.equal(rig.unclaimedSol, 1); assert.ok(Math.abs(rig.solDust - .8) < 1e-9);
rig.loadedCrystals=0; finish({reward:{crystals:2,fullHeat:true},payout:0}); assert.equal(rig.loadedCrystals,2); assert.equal(rig.getScannerLevel(),3);
finish({payout:0}); assert.equal(rig.getScannerLevel(),0);
rig.applyResonanceBuff('smoked_fish'); rig.onNewDay(2); assert.equal(rig.resonance.buff.id,null);
assert.equal(rig.upgradeRig().ok,true); assert.equal(rig.rigLevel,2); assert.equal(game.ui.inventory.sol_token,370); assert.equal(rig.maxCrystalCapacity,15);
assert.equal(rig.upgradeRig().ok,true); assert.equal(rig.upgradeRig().ok,true); assert.equal(game.ui.inventory.sol_token,90); assert.equal(rig.upgradeRig().ok,false);
const save = new SaveSystem(game); const snapshot = save.createSnapshot();
assert.ok(snapshot.saveSeed); assert.equal(snapshot.saveSeed, save.saveSeed);
for (const key of ['resonance','motherlode','season','rigLevel','solDust']) assert.equal(key in snapshot,false);
const migrated = save.migrate({schemaVersion:2,rigLevel:2,resonance:{calib:8, freeShares:4},miningRig:{rigLevel:3,resonance:{calib:2}}});
assert.equal(migrated.miningRig.rigLevel,3); assert.equal(migrated.miningRig.resonance.calib,2); assert.equal(migrated.miningRig.resonance.freeShares,4); assert.ok(migrated.saveSeed);
console.log('R10+E2 repairs passed');
// LOCK -> external sink injection -> reload -> SETTLE uses the live pool.
for (const wantWin of [false, true]) {
 let candidate;
 for (let n=0;n<1000;n++) {
  const g={...game,saveSystem:{saveSeed:`pool-${n}`,saveGame:()=>({success:true})}};
  const r=new MiningRigSystem(g);r.rigLevel=3;r.loadedCrystals=20;r.resonance.freeShares=0;r.motherlode.pool=100;r.ensureResonanceRound();
  const {drawWinner}=await import('../src/systems/resonance/ResonanceEngine.js');
  const sq=drawWinner(r.resonance.roundSeed,r.resonance.cluster);r.placeShares(sq,5);r.commitDeployment();r.advanceResonanceProgress(80);
  if(r.resonance.lastResult.motherlode.won===wantWin){candidate=r;break;}
 }
 assert.ok(candidate,`find motherlode won=${wantWin}`);
 candidate.onSinkSpent(100,'test');
 const reloaded=new MiningRigSystem(candidate.game);reloaded.deserialize(structuredClone(candidate.serialize()));
 const {settle}=await import('../src/systems/resonance/ResonanceEngine.js');
 const expected=settle(reloaded.resonance.board,reloaded.resonance.committedDeploy,reloaded.motherlode.pool,{u:5,roundSeed:reloaded.resonance.roundSeed,cluster:reloaded.resonance.cluster,weather:'clear'});
 reloaded.advanceResonanceProgress(20);reloaded.settleResonanceRound();
 assert.equal(reloaded.motherlode.pool,expected.motherlode.nextPool);
 assert.equal(reloaded.motherlode.paid,expected.motherlode.playerTake);
 assert.equal(reloaded.resonance.seedReveal,candidate.resonance.roundSeed);
 const once=reloaded.serialize();reloaded.settleResonanceRound();assert.deepEqual(reloaded.serialize(),once);
}
// Checkin ownership survives export/import and rejects replay across days.
save.saveGame=()=>({success:true});
assert.equal(save.claimDailyCheckin(1),true);const balance=game.ui.inventory.sol_token;
assert.equal(save.claimDailyCheckin(1),false);assert.equal(game.ui.inventory.sol_token,balance);
const nextSave=new SaveSystem(game);nextSave.applyDataToGame(save.createSnapshot());nextSave.saveGame=()=>({success:true});
assert.equal(nextSave.claimDailyCheckin(1),false);assert.equal(nextSave.claimDailyCheckin(2),true);assert.equal(nextSave.claimDailyCheckin(1),false);
nextSave.saveGame=()=>({success:false});assert.equal(nextSave.claimDailyCheckin(3),false);assert.equal(nextSave.hasClaimedCheckin(3),false);
console.log('R10 live-pool / checkin persistence passed');
const oldFractional = new MiningRigSystem(game);
oldFractional.deserialize({unclaimedSol:0.75,solDust:0.4});
assert.equal(oldFractional.unclaimedSol,1,'旧档小数收入迁移成整数');
assert.ok(Math.abs(oldFractional.solDust-.15)<1e-9);
