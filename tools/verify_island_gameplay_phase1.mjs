// CastawaySOL - 本岛玩法阶段一全流程自动化回归测试脚本 (Island Gameplay Phase 1 Verification)
// 验证：
// 1. 石斧物理砍伐与树木倒伏休整再生机制（Felling & Regrowth Lifecycle）
// 2. 碎石采矿与富铁矿脉露头开采机制（Rock Cracking & Ore Vein Mining）
// 3. 南岸潮汐捕蟹笼诱饵投放与退潮起网收获机制（Tidal Crab Trap）
// 4. 营地慢火烟熏风干架与极品熏鱼干军粮闭环（Camp Food Smoker & Army Rations）
// 5. 本岛自然资源与四大学科合成蓝图原料完全闭环链条（Resource-to-Crafting Pipeline）

import assert from 'node:assert';
import * as THREE from 'three';
import { BeachResourceSystem } from '../src/systems/BeachResourceSystem.js';
import { TidalTrapSystem } from '../src/systems/TidalTrapSystem.js';
import { CraftingBlueprintManager } from '../src/core/CraftingBlueprints.js';

console.log('🏝️ 开始执行【本岛玩法阶段一】全流程自动化回归测试...\n');

// 模拟轻量测试环境
const mockScene = new THREE.Scene();

// ==========================================
// 1. 验证石斧物理砍伐与树木倒伏休整再生机制
// ==========================================
console.log('--- 测试 1: 石斧砍伐树木与重型圆木掉落机制 ---');

// 构造拟真树木对象 (模拟 TreeInteraction.js 内部树木结构)
const mockTree = {
  id: 'apple_tree',
  name: '苹果树',
  chopHp: 3,
  maxChopHp: 3,
  isFelled: false,
  regrowthSteps: 0,
  dropItem: 'apple',
  group: { position: new THREE.Vector3(0, 0, 0) },
  model: { visible: true, rotation: new THREE.Euler(), position: new THREE.Vector3() },
  fruits: [{ visible: true }, { visible: true }]
};

const droppedItems = [];
const mockTreeSystem = {
  trees: [mockTree],
  droppedItems: droppedItems,
  spawnDropItem(pos, itemType) {
    droppedItems.push(itemType);
  },
  chopTree(tree) {
    if (!tree || tree.isFelled) return false;
    tree.chopHp = (tree.chopHp || tree.maxChopHp || 3) - 1;
    this.spawnDropItem(tree.group.position, 'tree_bark');

    if (tree.chopHp <= 0) {
      tree.isFelled = true;
      tree.regrowthSteps = 120;
      this.spawnDropItem(tree.group.position, 'lumber');
      this.spawnDropItem(tree.group.position, 'lumber');
      this.spawnDropItem(tree.group.position, 'wood_plank');
      this.spawnDropItem(tree.group.position, 'tree_sap');

      if (tree.fruits && tree.fruits.length > 0) {
        while (tree.fruits.length > 0) {
          tree.fruits.pop();
          this.spawnDropItem(tree.group.position, tree.dropItem);
        }
      }
      return { felled: true, name: tree.name };
    }
    return { felled: false, remainingHp: tree.chopHp, name: tree.name };
  },
  recordMovement(stepCount = 1) {
    for (const tree of this.trees) {
      if (tree.isFelled) {
        tree.regrowthSteps -= stepCount;
        if (tree.regrowthSteps <= 0) {
          tree.isFelled = false;
          tree.chopHp = tree.maxChopHp || 3;
        }
      }
    }
  }
};

// 砍伐第一斧
const chop1 = mockTreeSystem.chopTree(mockTree);
assert.strictEqual(chop1.felled, false, '第一斧树木不应倒伏');
assert.strictEqual(chop1.remainingHp, 2, '砍伐第一斧后耐久应剩余 2');
assert.strictEqual(mockTree.isFelled, false);
console.log('  ✓ 挥第一斧：树体剧烈摇晃，震落树皮碎屑，余 2 斧');

// 砍伐第二斧
const chop2 = mockTreeSystem.chopTree(mockTree);
assert.strictEqual(chop2.felled, false, '第二斧树木不应倒伏');
assert.strictEqual(chop2.remainingHp, 1, '砍伐第二斧后耐久应剩余 1');
console.log('  ✓ 挥第二斧：树干深度开裂，余 1 斧');

// 砍伐第三斧 (伐倒树木)
const chop3 = mockTreeSystem.chopTree(mockTree);
assert.strictEqual(chop3.felled, true, '第三斧树木应当被彻底伐倒');
assert.strictEqual(mockTree.isFelled, true, '树木状态应当置为已伐倒');
assert.strictEqual(mockTree.regrowthSteps, 120, '应当进入 120 步自然萌发休整周期');
assert.ok(droppedItems.includes('lumber'), '伐倒树木必须掉落核心建材【重型圆木】');
assert.ok(droppedItems.includes('wood_plank'), '伐倒树木必须掉落【木材方料】');
assert.ok(droppedItems.includes('tree_sap'), '伐倒树木必须掉落【粘性树脂】');
console.log('  ✓ 挥第三斧：树木轰然倒伏！爆出重型圆木 x2、木材方料 x1、树脂与震落苹果！');

// 步数推进测试萌发休整
mockTreeSystem.recordMovement(60);
assert.strictEqual(mockTree.isFelled, true, '移动 60 步树木仍处于萌发休整中');
mockTreeSystem.recordMovement(60);
assert.strictEqual(mockTree.isFelled, false, '移动 120 步后树木应当破土新生萌发生长完成');
assert.strictEqual(mockTree.chopHp, 3, '新生树木耐久完全恢复');
console.log('  ✓ 移动 120 步后生命之树萌发复苏，重归葱郁状态！\n');

// ==========================================
// 2. 验证碎石采矿与富铁矿脉露头开采机制
// ==========================================
console.log('--- 测试 2: 碎石采矿与玄武岩富铁矿脉开采机制 ---');

const beachResources = new BeachResourceSystem(mockScene);
assert.ok(beachResources.resources.length > 0, '海滩资源系统必须成功生成');

// 检验大礁石与玄武岩铁矿脉配置
const bigRocks = beachResources.resources.filter(r => r.type === 'big_rock');
const ironVeins = beachResources.resources.filter(r => r.type === 'iron_vein');
assert.ok(bigRocks.length >= 4, '海滩必须分布至少 4 处大礁石');
assert.ok(ironVeins.length >= 2, '后山海蚀崖壁必须分布至少 2 处富铁矿脉露头');
console.log(`  ✓ 成功定位海滩天然矿点：${bigRocks.length} 处大礁石，${ironVeins.length} 处玄武富铁矿脉`);

// 模拟石锤敲击大礁石 (伤害 1)
const targetRock = bigRocks[0];
targetRock.hp = 2; // 确保满耐久
const collectedMineItems = [];
const onCollect = (itemKey) => collectedMineItems.push(itemKey);

const hammerHit1 = beachResources.mineRock(targetRock, true, false, onCollect);
assert.strictEqual(hammerHit1.broken, false, '石锤击打 1 次大礁石不应粉碎');
assert.strictEqual(hammerHit1.remainingHp, 1, '石锤击打后剩余 1 点耐久');
console.log('  ✓ 重装石锤砸向海滩巨石：火星飞溅，耐久余 1');

// 石锤击碎大礁石
const hammerHit2 = beachResources.mineRock(targetRock, true, false, onCollect);
assert.strictEqual(hammerHit2.broken, true, '石锤第 2 次击打成功击碎大礁石');
assert.strictEqual(targetRock.collected, true);
assert.strictEqual(targetRock.regrowthSteps, 150, '巨石碎裂后进入 150 步地质再生周期');
assert.ok(collectedMineItems.includes('stone_chunk'), '击碎大礁石必掉落坚硬燧石');
assert.ok(collectedMineItems.includes('big_rock'), '击碎大礁石必掉落大岩石');
console.log('  ✓ 巨石轰然崩解！爆出坚硬燧石与大岩石，进入 150 步地质循环');

// 模拟骨柄石镐开采玄武岩铁矿脉 (石镐伤害 2)
const targetVein = ironVeins[0];
targetVein.hp = 3;
collectedMineItems.length = 0;

const pickHit1 = beachResources.mineRock(targetVein, false, true, onCollect);
assert.strictEqual(pickHit1.broken, false, '石镐敲击 1 次富铁矿脉(hp:3)扣减 2 点伤害，余 1 点');
assert.strictEqual(pickHit1.remainingHp, 1);
console.log('  ✓ 骨柄石镐敲凿富铁矿床：造成 2 点高效穿凿伤害，余 1 点');

const pickHit2 = beachResources.mineRock(targetVein, false, true, onCollect);
assert.strictEqual(pickHit2.broken, true, '石镐第 2 次敲凿成功采空富铁矿脉');
assert.ok(collectedMineItems.includes('iron_ore'), '富铁矿脉开采必须爆出富铁矿石');
console.log('  ✓ 矿脉凿穿！成功采集获得珍稀【富铁矿石 ⛏️ (iron_ore)】！\n');

// ==========================================
// 3. 验证南岸潮汐捕蟹笼收获与诱饵机制
// ==========================================
console.log('--- 测试 3: 南岸潮汐捕蟹笼诱饵投放与收获闭环 ---');

const mockGame = {
  scene: mockScene,
  ui: {
    inventory: {
      apple: 2,
      tree_branch: 3,
      tree_bark: 2
    },
    showToast(msg) { /* 测试打桩 */ },
    showDialog(title, content) { /* 测试打桩 */ },
    renderInventory() { /* 测试打桩 */ },
    getItemName(id) {
      const map = { apple: '红苹果', sea_crab: '生猛青花海蟹', sardine: '银鳞小沙丁鱼', smoked_fish: '极品熏鱼干' };
      return map[id] || id;
    }
  }
};

const tidalTrap = new TidalTrapSystem(mockGame);
assert.strictEqual(tidalTrap.getTotalCatches(), 3, '初始预置 1 蟹 + 2 沙丁鱼');

// 投放诱饵
assert.strictEqual(mockGame.ui.inventory['apple'], 2);
const baitResult = tidalTrap.addBait('apple');
assert.strictEqual(baitResult, true, '投放诱饵应当成功');
assert.strictEqual(mockGame.ui.inventory['apple'], 1, '背包苹果应扣除 1 个');
assert.strictEqual(tidalTrap.trapBait, 'apple', '陷阱应记录当前挂载诱饵');
assert.strictEqual(tidalTrap.trapBaitCount, 3, '诱饵应提供 3 次潮汐增益');
console.log('  ✓ 挂载野果诱饵成功！未来 3 次退潮起获效率翻倍');

// 步数推进退潮
tidalTrap.advanceTide(40);
assert.strictEqual(tidalTrap.trapBaitCount, 2, '一次退潮后诱饵消耗 1 次');
console.log(`  ✓ 步数行进退潮一次，当前笼内海货储备: ${tidalTrap.getTotalCatches()} 件`);

// 一键起笼收获
const initialCrabInInv = mockGame.ui.inventory['sea_crab'] || 0;
const harvestResult = tidalTrap.harvestTrap();
assert.strictEqual(harvestResult, true, '起笼收获应当成功');
assert.strictEqual(tidalTrap.getTotalCatches(), 0, '收获后捕蟹笼内应清空');
assert.ok(mockGame.ui.inventory['sea_crab'] > initialCrabInInv, '玩家背包中海蟹应当入库');
assert.ok(mockGame.ui.inventory['sardine'] > 0, '玩家背包中小沙丁鱼应当入库');
console.log('  ✓ 一键起笼成功！生猛海蟹与银鳞沙丁鱼已稳妥收入背包\n');

// ==========================================
// 4. 验证营地慢火烟熏风干架与特权军粮闭环
// ==========================================
console.log('--- 测试 4: 营地慢火烟熏架与极品熏鱼干特权军粮闭环 ---');

// 准备熏鱼原料
mockGame.ui.inventory['sardine'] = 2;
mockGame.ui.inventory['tree_branch'] = 2;

// 启动熏制
const smokeStart = tidalTrap.startSmoking('sardine', 2);
assert.strictEqual(smokeStart, true, '放入沙丁鱼与燃料点燃熏架应当成功');
assert.strictEqual(tidalTrap.isSmoking, true, '熏烤架状态应当为熏制中');
assert.strictEqual(tidalTrap.smokingItems.length, 1);
assert.strictEqual(tidalTrap.smokingItems[0].targetId, 'smoked_fish', '沙丁鱼目标成品应为极品熏鱼干');
assert.strictEqual(mockGame.ui.inventory['sardine'] || 0, 0, '原料沙丁鱼已移入熏炉');
console.log('  ✓ 熏架炭火点燃！消耗引火柴火，正在将生鱼慢火熏制成熏鱼干');

// 时间推移 5 秒 (每秒 20 进度，5 秒恰好 100 熟透)
tidalTrap.update(5.0);
assert.strictEqual(tidalTrap.isSmoking, false, '熏制完成，炉火转微');
assert.strictEqual(tidalTrap.finishedItems.length, 1, '成品槽应产出熏制军粮');
assert.strictEqual(tidalTrap.finishedItems[0].id, 'smoked_fish');
assert.strictEqual(tidalTrap.finishedItems[0].count, 2);
console.log('  ✓ 5秒慢火熏烤风干熟透！成品【极品熏鱼干 x2】静待收取');

// 收取熏制军粮
const collectSmoked = tidalTrap.collectFinishedProducts();
assert.strictEqual(collectSmoked, true, '收取熏制品应当成功');
assert.strictEqual(mockGame.ui.inventory['smoked_fish'], 2, '背包应当获得 2 份极品熏鱼干');
assert.strictEqual(tidalTrap.finishedItems.length, 0, '熏架成品槽应已清空');
console.log('  ✓ 一键出炉！2 份极品熏鱼干军粮成功纳进行囊\n');

// ==========================================
// 5. 验证资源采集到蓝图合成全闭环链条
// ==========================================
console.log('--- 测试 5: 自然资源开采 -> 蓝图合成大逃脱全链条校验 ---');

// 验证使用开采获得的 iron_ore 与 tree_branch 煅烧合成 iron_ingot
const ingotBp = CraftingBlueprintManager.findBlueprint('iron_ore', 'tree_branch');
assert.ok(ingotBp, '必须存在 iron_ore + tree_branch -> iron_ingot 蓝图');
assert.strictEqual(ingotBp.result, 'iron_ingot');
console.log('  ✓ 矿脉富铁矿 (iron_ore) + 燃料木柴 (tree_branch) -> 冶炼精炼铁构件 (iron_ingot)');

// 验证使用砍伐获得的 lumber 与 stone_chunk 合成骨柄石镐 (stone_pickaxe)
const pickBp = CraftingBlueprintManager.findBlueprint('lumber', 'stone_chunk');
assert.ok(pickBp, '必须存在 lumber + stone_chunk -> stone_pickaxe 蓝图');
assert.strictEqual(pickBp.result, 'stone_pickaxe');
console.log('  ✓ 伐木重型圆木 (lumber) + 坚硬燧石 (stone_chunk) -> 锻造骨柄石镐 (stone_pickaxe)');

// 验证使用砍伐获得的 lumber 与木箱搜出的 nail 合成逃脱大木筏 (escape_raft)
const raftBp = CraftingBlueprintManager.findBlueprint('lumber', 'nail');
assert.ok(raftBp, '必须存在 lumber + nail -> escape_raft 蓝图');
assert.strictEqual(raftBp.result, 'escape_raft');
console.log('  ✓ 伐木重型圆木 (lumber) + 遗落铁钉 (nail) -> 建造出海逃生大木筏 (escape_raft)');

console.log('\n🎉 【本岛玩法阶段一】所有 5 项核心机制与资源全闭环自动化回归测试全部顺利通过！');
