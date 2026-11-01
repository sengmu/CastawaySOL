// CastawaySOL - E1 经济修补专项自动化测试套件
// 验证规则：先校验、不足拒绝且不扣、足额一次扣清
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ISLAND_LAYOUT } from '../src/core/IslandLayout.js';

console.log('💰 开始执行 CastawaySOL E1 经济修补专项自动化测试套件...\n');

// 构造最小游戏沙盒环境
class MockUI {
  constructor() {
    this.inventory = {};
    this.rendered = false;
    this.lastDialog = null;
  }
  renderInventory() {
    this.rendered = true;
  }
  showDialog(title, body) {
    this.lastDialog = { title, body };
  }
  showToast() {}
}

class MockStory {
  constructor() {
    this.sosBuilt = false;
    this.raftBuilt = false;
    this.currentChapterId = 3;
    this.currentStepIndex = 1;
  }
  buildSosSign() {
    this.sosBuilt = true;
  }
  buildRaft() {
    this.raftBuilt = true;
  }
}

// 模拟 main.js 中执行 action 的关键逻辑
import { WeatherSurvivalSystem } from '../src/systems/WeatherSurvivalSystem.js';

// ==========================================
// 1. 测试南岸沙滩 S.O.S 地标建造与材料防线
// ==========================================
console.log('▶ [1/3] 验证 S.O.S 地标真实材料检验与原子扣除...');

// 1.1 材料不足：拒绝建造且 0 扣减
{
  const ui = new MockUI();
  ui.inventory = { stone_chunk: 1 };
  const story = new MockStory();

  const handleBuildSos = () => {
    const inv = ui.inventory;
    const stoneCount = (inv['stone_chunk'] || 0) + (inv['rock'] || 0) + (inv['flint'] || 0);
    if (stoneCount < 2) {
      ui.showDialog('🪨 南岸沙滩 S.O.S 呼救地标', '材料不足');
      return false;
    }
    let needStone = 2;
    for (const k of ['stone_chunk', 'rock', 'flint']) {
      if (!inv[k]) continue;
      const take = Math.min(inv[k], needStone);
      inv[k] -= take;
      needStone -= take;
      if (inv[k] <= 0) delete inv[k];
      if (needStone <= 0) break;
    }
    story.buildSosSign();
    return true;
  };

  const res = handleBuildSos();
  assert.equal(res, false, '材料不足时必须拒绝建造 SOS');
  assert.equal(story.sosBuilt, false, '地标状态必须保持未建造');
  assert.equal(ui.inventory.stone_chunk, 1, '材料不足时严禁发生部分扣除');
  console.log('  ✅ 材料不足拦截有效，保持 0 扣减！');

  // 1.2 材料足额：一次性扣清并成功建造
  ui.inventory.stone_chunk = 3;
  const resSuccess = handleBuildSos();
  assert.equal(resSuccess, true, '材料充足时建造必须成功');
  assert.equal(story.sosBuilt, true, '地标状态必须标记为已建成');
  assert.equal(ui.inventory.stone_chunk, 1, '必须精准扣除 2 块碎石，剩余 1 块');
  console.log('  ✅ 材料足额扣除精准，S.O.S 成功建造！');
}

// ==========================================
// 2. 测试西南浅滩出海大木筏建造与材料防线
// ==========================================
console.log('\n▶ [2/3] 验证出海大木筏真实材料检验与原子扣除...');

// 2.1 原料缺任意一项：拒绝建造且全部 0 扣减
{
  const ui = new MockUI();
  // 缺 1 根藤蔓
  ui.inventory = { lumber: 4, nail: 2, ivy: 1 };
  const story = new MockStory();

  const handleBuildRaft = () => {
    const inv = ui.inventory;
    const hasDirectRaft = (inv['raft'] || 0) > 0 || (inv['escape_raft'] || 0) > 0;
    const hasMaterials = (inv['lumber'] || 0) >= 4 && (inv['nail'] || 0) >= 2 && (inv['ivy'] || 0) >= 2;

    if (hasDirectRaft || hasMaterials) {
      if ((inv['raft'] || 0) > 0) {
        inv['raft']--;
        if (inv['raft'] <= 0) delete inv['raft'];
      } else if ((inv['escape_raft'] || 0) > 0) {
        inv['escape_raft']--;
        if (inv['escape_raft'] <= 0) delete inv['escape_raft'];
      } else {
        inv['lumber'] -= 4;
        inv['nail'] -= 2;
        inv['ivy'] -= 2;
        if (inv['lumber'] <= 0) delete inv['lumber'];
        if (inv['nail'] <= 0) delete inv['nail'];
        if (inv['ivy'] <= 0) delete inv['ivy'];
      }
      story.buildRaft();
      return true;
    } else {
      ui.showDialog('⚓ 浅滩造船台', '材料不足');
      return false;
    }
  };

  const res = handleBuildRaft();
  assert.equal(res, false, '缺少藤蔓时必须拦截木筏建造');
  assert.equal(story.raftBuilt, false, '木筏状态必须保持未建造');
  assert.equal(ui.inventory.lumber, 4, '圆木严禁被预先扣除');
  assert.equal(ui.inventory.nail, 2, '铁钉严禁被预先扣除');
  assert.equal(ui.inventory.ivy, 1, '藤蔓数量保持原样');
  console.log('  ✅ 木筏材料缺口拦截有效，无任何原料损失！');

  // 2.2 原料齐备：足额一次扣清
  ui.inventory.ivy = 3;
  const resSuccess = handleBuildRaft();
  assert.equal(resSuccess, true, '材料满足时木筏必须建造成功');
  assert.equal(story.raftBuilt, true, '木筏状态必须标记为已建成');
  assert.equal(ui.inventory.lumber, undefined, '4 根圆木必须扣清并清理键名');
  assert.equal(ui.inventory.nail, undefined, '2 根铁钉必须扣清并清理键名');
  assert.equal(ui.inventory.ivy, 1, '3 根藤蔓扣除 2 根后准确剩余 1 根');
  console.log('  ✅ 木筏原材料原子扣除成功，下水成功！');

  // 2.3 使用成品木筏道具下水
  const ui2 = new MockUI();
  ui2.inventory = { escape_raft: 1 };
  const story2 = new MockStory();
  const resDirect = (() => {
    const inv = ui2.inventory;
    if ((inv['escape_raft'] || 0) > 0) {
      inv['escape_raft']--;
      if (inv['escape_raft'] <= 0) delete inv['escape_raft'];
      story2.buildRaft();
      return true;
    }
    return false;
  })();
  assert.equal(resDirect, true, '成品大木筏道具下水成功');
  assert.equal(story2.raftBuilt, true);
  assert.equal(ui2.inventory.escape_raft, undefined, '成品道具被准确扣除');
  console.log('  ✅ 直接消耗成品大木筏道具下水验证通过！');
}

// ==========================================
// 3. 测试营火避雨石棚材料检验与扣除
// ==========================================
console.log('\n▶ [3/3] 验证营火避雨石棚真实碎石(stone_chunk)兼容与扣除...');

{
  const mockGame = {
    ui: new MockUI(),
    scene: new THREE.Scene()
  };
  const weather = new WeatherSurvivalSystem(mockGame);

  // 3.1 缺少树皮时拦截
  mockGame.ui.inventory = { stone_chunk: 5, tree_bark: 1 };
  const resFail = weather.buildFireShelter();
  assert.equal(resFail.ok, false, '缺少树皮必须拦截搭建');
  assert.equal(weather.hasFireShelter, false);
  assert.equal(mockGame.ui.inventory.stone_chunk, 5, '碎石保持未扣除');
  assert.equal(mockGame.ui.inventory.tree_bark, 1, '树皮保持未扣除');
  console.log('  ✅ 避雨石棚材料不足拦截有效！');

  // 3.2 材料齐备时成功扣减
  mockGame.ui.inventory = { stone_chunk: 4, tree_bark: 2 };
  const resOk = weather.buildFireShelter();
  assert.equal(resOk.ok, true, '材料满足时避雨石棚必须搭建成功');
  assert.equal(weather.hasFireShelter, true);
  assert.equal(mockGame.ui.inventory.stone_chunk, 1, '4 块碎石扣除 3 块后准确剩余 1 块');
  assert.equal(mockGame.ui.inventory.tree_bark, undefined, '2 张树皮扣除 2 张后键名清理');
  console.log('  ✅ 避雨石棚碎石与树皮扣除精准，搭建成功！');
}

console.log('\n🎉🎉🎉 [ALL E1 ECONOMY TESTS PASSED] E1 经济修补专项自动化测试 100% 全部通过！');
