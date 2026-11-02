import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CampFacilitiesSystem } from '../src/systems/CampFacilitiesSystem.js';
import { MiningRigSystem } from '../src/systems/MiningRigSystem.js';
import { StorySystem } from '../src/systems/StorySystem.js';
const s = new StorySystem(null);
assert.equal(s.isCompleted, false);
s.currentChapterId = 5; s.currentStepIndex = 1;
s.gemsCollected = new Set(['a','b','c']);
s.update({x:0,z:0}, {}, {});
assert.equal(s.currentChapterId, 6);
assert.equal(s.getCurrentStep().id, 'mainline_complete');
s.update({x:0,z:0}, {}, {});
assert.equal(s.isCompleted, true);
assert.match(s.getQuestBannerText(), /自由经营/);
const saved = s.serialize();
assert.equal(saved.isCompleted, true);
for (const data of [saved, {currentChapterId:6,currentStepIndex:0}, {currentChapterId:6,currentStepIndex:0,endedEndingId:'ED1'}]) {
 const restored = new StorySystem(null); restored.deserialize(data);
 assert.equal(restored.isCompleted, true, '旧第六章档立即进入漫游');
 assert.match(restored.getQuestBannerText(), /自由经营/);
 const before = restored.serialize();
 for(let i=0;i<100;i++) restored.update({x:0,z:0}, {}, {});
 assert.deepEqual(restored.serialize(), before, '漫游更新幂等');
 assert.equal(restored.endedEndingId, null);
}
const walk = dir => readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
for(const file of walk('src').filter(f=>f.endsWith('.js'))) {
 assert.doesNotMatch(readFileSync(file,'utf8'), /\.\s*(?:triggerEnding|triggerSolanaEscapeEnding)\s*\(/, `${file}: 结局调用入口必须为零`);
}
assert.equal(typeof s.triggerEnding, 'undefined', '移除可经调试对象调用的剧情结局口');
console.log('M3 PASS: 主线完成、持久化、旧档迁移、漫游幂等、结局入口封闭');

// Exercise the shipped Ellie interaction block, including real M2 StorySystem callbacks.
const main = readFileSync('src/main.js','utf8');
const start = main.indexOf("      if (nearestVillager.id === 'second_kid') {");
let end = start, depth = 0, opened = false;
for (; end < main.length; end++) {
 if(main[end] === '{') { depth++; opened = true; }
 if(main[end] === '}') depth--;
 if(opened && depth === 0) {end++;break;}
}
const interact = new Function('nearestVillager','soundEngine', main.slice(start,end));
const game = {ui:{inventory:{apple:2},renderInventory(){},updateSurvivalHUD(){},showDialog(){},showToast(){},updateObjective(){}},survival:{canteenSips:1},storageSystem:{storageInventory:{}},campEntities:{}};
game.story = new StorySystem(game);
game.campFacilities = new CampFacilitiesSystem(game);
game.story.currentChapterId = 4;game.story.currentStepIndex = 1;
const villager = {id:'second_kid',name:'Ellie'};
interact.call(game,villager,{playPlaceFurniture(){}});
game.story.update({x:0,z:0},{},{});
assert.equal(game.story.getCurrentStep().id,'care_partner');
interact.call(game,villager,{playPlaceFurniture(){}});
game.story.update({x:0,z:0},{},{});
assert.equal(game.story.secondKidAffection,105);
assert.equal(game.story.getCurrentStep().id,'collect_gems');
game.story.deserialize({currentChapterId:6,currentStepIndex:0});
game.campFacilities.onDayPassed();
assert.ok(game.storageSystem.storageInventory.nail > 0,'漫游营地产出正常');
// Real rig update on a headless instance: no rendering constructor is required.
const rig = Object.create(MiningRigSystem.prototype);
Object.assign(rig,{game,rigMode:'mining',isActive:true,loadedCrystals:1,hashSpeed:1,turboTimer:0,manualTapCombo:0,batteryPower:100,hashProgress:0,beamRings:[]});
rig.isDaytime = () => true;
const beforeHash = rig.hashProgress;
rig.update(1/60);
assert.ok(rig.hashProgress > beforeHash,'漫游矿机算力继续推进');
console.log('M3 integration PASS: 真实艾莉唤醒→赠礼→care_partner 推进；漫游营地与矿机继续产出');
