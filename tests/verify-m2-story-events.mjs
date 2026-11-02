import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { StorySystem } from '../src/systems/StorySystem.js';

const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
const external = [...walk('src'), ...walk('tools'), ...walk('tests')].filter(p => p.endsWith('.js') || p.endsWith('.mjs')).filter(p => p !== 'src/systems/StorySystem.js');
for (const file of external) assert.equal(/\.advanceStep\s*\(/.test(readFileSync(file, 'utf8')), false, `${file}: 禁止外部推进`);
const source = readFileSync('src/systems/StorySystem.js', 'utf8');
assert.ok(source.includes('#advanceStep()'), '推进入口必须是私有方法');
assert.equal(/按【?\[?E|E 键|WASD|方向键|鼠标|键盘/.test(source), false, '主线及新手引导使用触屏语言');

const make = () => new StorySystem(null);
const events = [
 ['branch', s => s.onGatherResource('tree_branch')],
 ['driftwood', s => s.onGatherResource('driftwood')],
 ['stone', s => s.onGatherResource('stone_chunk')],
 ['food', s => s.onConsumeFood('apple')],
 ['water', s => s.onDrinkWater()],
 ['kindling', s => s.onCraftItem('kindling')],
 ['axe', s => s.onCraftItem('stone_axe')],
 ['radio', s => s.onCraftItem('workradio')],
 ['otherCraft', s => s.onCraftItem('ivy')],
 ['cook', s => s.onCookFood()],
 ['contact', s => s.onRadioContact()],
 ['sos', s => s.buildSosSign()],
 ['raft', s => s.buildRaft()],
 ['awake', s => s.onPartnerAwakened()],
 ['monkey', s => s.befriendMonkey()],
 ['inventory', s => s.onInventoryOpened()],
 ['dismiss', s => s.dismissOnboarding()],
 ['affection', s => { s.secondKidAffection = 105; }],
 ['gems', s => { s.gemsCollected = new Set(['a', 'b', 'c']); }],
 ['tick', s => s.update({ x: 1000, z: 1000 }, {}, {})]
];
const actionEvents = {
 collect_driftwood: ['branch', 'driftwood'], find_food_water: ['food', 'water'],
 craft_kindling: ['kindling'], craft_axe: ['axe'], fix_radio: ['radio'], cook_hot_food: ['cook']
};
const ordinal = s => s.chapters.slice(0, s.currentChapterId).reduce((n,c) => n+c.steps.length, 0) + s.currentStepIndex;
let checks = 0;
for (let seed = 1; seed <= 100; seed++) {
 const s = make(); let rng = seed;
 const shuffle = () => { const a = [...events]; for (let i=a.length-1;i>0;i--) { rng = (Math.imul(rng,1664525)+1013904223) >>> 0; const j=rng%(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; };
 // Every M1 step receives all 20 event types, in 100 deterministic shuffled orders.
 for (let chapter=0; chapter<s.chapters.length; chapter++) for (let index=0; index<s.chapters[chapter].steps.length; index++) {
  const t = make(); t.currentChapterId=chapter; t.currentStepIndex=index;
  for (const [name, fire] of shuffle()) {
   const step=t.getCurrentStep(), before=ordinal(t);
   const allowed = actionEvents[step.id]?.includes(name) || false;
   fire(t);
   const delta=ordinal(t)-before;
   assert.ok(delta===0 || delta===1, `${seed}/${step.id}/${name}: 单事件只能推进一步`);
   if (step.type==='action') assert.equal(delta, Number(allowed), `${step.id}/${name}: 唯一动作触发`);
   if (step.type==='position') assert.equal(delta, 0, `${step.id}/${name}: 事件不能代替到达`);
   if (step.type==='state' && delta) assert.equal(step.checkState(), true, `${step.id}/${name}: 当前里程碑必须满足`);
   checks++;
  }
 }
}
// Reproduce the original early Ellie interaction: it must never skip the current task.
const early = make(); early.onPartnerAwakened();
assert.equal(early.getCurrentStep().id, 'collect_driftwood');
assert.equal(early.secondKidAwake, true);
assert.equal(early.secondKidAffection, 80);
console.log(`M2 PASS: 20 种事件 × 100 乱序种子 × 15 个 M1 步骤 = ${checks} 检查；外部推进 0，触屏文案通过`);
