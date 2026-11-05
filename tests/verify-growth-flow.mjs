import assert from 'node:assert/strict';
import { StorySystem } from '../src/systems/StorySystem.js';
import { CampFacilitiesSystem } from '../src/systems/CampFacilitiesSystem.js';

const game = {
  currentIslandId: 'main_island',
  ui: { updateObjective() {}, updateTutorial() {}, showToast() {}, showDialog() {} },
  saveSystem: { saveGame() {} },
  storageSystem: { storageInventory: {} },
  buildSystem: { placedFurniture: [{ isBed: true }] },
  nauticalChart: { islands: { timber_isle: { outpostBuilt: true } } },
};
game.story = new StorySystem(game);
const story = game.story;
assert.equal(story.getGrowthTasks().find(task => task.id === 'assign_job').status, 'locked');
assert.equal(story.getGrowthTasks().some(task => task.id === 'refinery'), false);
story.secondKidAwake = true;
story.trackGrowthTask('assign_job');
assert.equal(story.trackedGrowthTaskId, 'assign_job');
const camp = new CampFacilitiesSystem(game);
assert.equal(camp.assignJob('second_kid', 'forager'), true);
camp.onDayPassed();
assert.ok(game.storageSystem.storageInventory.apple > 0);
assert.ok(game.storageSystem.storageInventory.wood_plank > 0);
assert.equal(story.growthFacts.residentProduced, true);
assert.equal(story.growthFacts.outpostDelivered, true);
game.currentIslandId = 'timber_isle';
story.update({ x: 0, z: 0 }, {}, {});
game.currentIslandId = 'main_island';
story.update({ x: 0, z: 0 }, {}, {});
assert.equal(story.growthFacts.voyageArrived, true);
assert.equal(story.growthFacts.voyageReturned, true);
story.recordGrowthFact('productionSuppliesWithdrawn');
story.recordGrowthFact('suppliesUsedForBuild');
story.trackGrowthTask('collect_output');
const saved = JSON.parse(JSON.stringify(story.serialize()));
const restored = new StorySystem(game);
restored.deserialize(saved);
assert.deepEqual(restored.growthFacts, story.growthFacts);
assert.equal(restored.getGrowthTasks().find(task => task.id === 'use_supplies').done, true);
assert.equal(restored.getGrowthTasks().find(task => task.id === 'outpost_return').done, true);
console.log('Growth dependencies, production, delivery, voyage and save restoration passed.');
