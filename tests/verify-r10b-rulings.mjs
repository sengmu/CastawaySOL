import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MiningRigSystem } from '../src/systems/MiningRigSystem.js';
const rig = new MiningRigSystem({ui:{showToast(){}},saveSystem:{saveGame(){}}});
rig.ensureResonanceRound(); rig.loadedCrystals=0;
assert.equal(rig.placeShares(0,1).ok,true);
const before=structuredClone(rig.serialize());
assert.equal(rig.commitDeployment().ok,false,'单份必须拒绝');
assert.deepEqual(rig.serialize(),before,'拒绝不能扣免费份额或修改部署');
assert.match(rig.commitDeployment().msg,/每轮至少部署 2 份/);
rig.placeShares(0,1); assert.equal(rig.commitDeployment().ok,true);
assert.equal(rig.resonance.freeShares,1,'免费三份可用两份，余额保留');
assert.equal(rig.loadedCrystals,0);
const ui=readFileSync('src/ui/UIManager.js','utf8');
assert.ok(ui.includes('每轮至少部署 2 份'));
assert.ok(!/buildRefinery|loadPureCrystal|精炼炉|纯晶装载/.test(ui),'隐藏两处入口');
assert.ok(ui.includes('+5 算力代币'));
assert.ok(!/\+100\s*贝壳/.test(ui));
console.log('R10b rulings passed');
const { settle, genCluster, ODDS_TABLE } = await import('../src/systems/resonance/ResonanceEngine.js');
assert.equal(ODDS_TABLE.PITY.minShares,2,'保底覆盖最低合法部署');
let pitySeen=false;
for(let i=0;i<100;i++){
 const dep=Array(25).fill(0);dep[0]=2;
 const result=settle(Array(25).fill(25),dep,0,{roundSeed:`r10b-${i}`,cluster:genCluster('r10b',i),currentCalib:15});
 if(!result.hit){assert.equal(result.calibReward.crystals,2);pitySeen=true;break;}
}
assert.ok(pitySeen);
