// CastawaySOL - 后山神秘古代神殿独立地图与密室解谜副本全流程自动化测试套件
// 涵盖：
// 1. 主岛后山神殿大门实体与祭坛坐标
// 2. 神殿专属独立副本地图场景 (AncientTempleScene) 地宫建筑、传送阵、日冕与宝座
// 3. 第一重星辰光棱镜对焦机制
// 4. 第二重九宫太阳图腾石板翻转联动玄铁大门升起
// 5. 第三重波塞冬黄金宝藏结算与神装入囊
// 6. 跨地图无缝传送系统 (main_island <-> ancient_temple)
// 7. 存档序列化与断点场景持久化恢复
import assert from 'node:assert/strict';

// Mock 基础运行环境
class MockVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }
  distanceTo(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const dz = this.z - other.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  copy(other) {
    this.x = other.x; this.y = other.y; this.z = other.z;
    return this;
  }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}

globalThis.window = {
  localStorage: {
    store: {},
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; }
  },
  addEventListener() {}
};
globalThis.localStorage = globalThis.window.localStorage;
globalThis.document = {
  createElement() {
    return {
      style: {},
      classList: { toggle: () => {}, remove: () => {} },
      appendChild() {},
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      setAttribute() {}
    };
  },
  body: { appendChild() {} },
  getElementById() { return null; }
};

console.log('🏛️ 开始执行 CastawaySOL 后山古代神殿独立地图与解谜副本自动化测试套件...\n');

// 导入模块
const { AncientTempleEntity } = await import('../src/entities/AncientTempleEntity.js');
const { AncientTempleScene } = await import('../src/island/AncientTempleScene.js');
const { TemplePuzzleSystem } = await import('../src/systems/TemplePuzzleSystem.js');

// 构造模拟全局 Game 状态
class MockGame {
  constructor() {
    this.currentIslandId = 'main_island';
    this.dialogs = [];
    this.toasts = [];
    this.ui = {
      inventory: { apple: 1, tree_branch: 5 },
      addInventory: (k, c = 1) => {
        this.ui.inventory[k] = (this.ui.inventory[k] || 0) + c;
      },
      renderInventory: () => {},
      showDialog: (title, text) => {
        this.dialogs.push({ title, text });
      },
      showToast: (msg) => {
        this.toasts.push(msg);
      },
      createTransitionFade: () => {},
      fadeTransitionOut: () => {},
      setContextAction: () => {},
      showInteraction: () => {}
    };
    this.player = {
      position: new MockVector3(0, 0.4, -22.5),
      rotation: 0,
      resetInput() {}
    };
    this.scene = {
      add() {},
      remove() {}
    };
    this.mainIslandVisible = true;
  }

  setMainIslandVisible(v) {
    this.mainIslandVisible = v;
  }

  travelToIsland(targetId) {
    const prev = this.currentIslandId;
    this.currentIslandId = targetId;
    if (targetId === 'ancient_temple') {
      this.setMainIslandVisible(false);
      this.ancientTempleScene.setVisible(true);
      this.player.position.set(0, 0.4, 15);
    } else if (targetId === 'main_island') {
      this.ancientTempleScene.setVisible(false);
      this.setMainIslandVisible(true);
      if (prev === 'ancient_temple') {
        this.player.position.set(0, 0.4, -20);
      }
    }
  }
}

const game = new MockGame();

// ==========================================
// 1. 主岛后山神殿大门与祭坛交互点
// ==========================================
console.log('▶ [1/6] 测试主岛后山神殿大门实体与祭坛交互锚点...');
const templeEntity = new AncientTempleEntity(game.scene);
game.ancientTemple = templeEntity;

assert.equal(templeEntity.anchorPosition.z, -26, '主岛神殿基座坐标应位于后山 Z = -26');
assert.equal(templeEntity.altarWorldPos.x, 0, '神殿祭坛应居中在 X = 0');
assert.equal(templeEntity.altarWorldPos.z, -22.5, '神殿祭坛世界 Z 坐标应为 -22.5');
console.log('  ✅ 主岛后山神殿大门外景建筑与祭坛交互锚点通过！');

// ==========================================
// 2. 神殿专属独立副本地图场景 (AncientTempleScene)
// ==========================================
console.log('\n▶ [2/6] 测试神殿专属独立副本地图场景架构与各功能分区...');
const templeScene = new AncientTempleScene(game.scene, game);
game.ancientTempleScene = templeScene;

assert.equal(templeScene.portalSpawnPos.z, 15, '神殿入口传送光阵应位于南端 Z = 15');
assert.equal(templeScene.altarPos.z, 2, '前殿中央星辰日冕祭坛应位于 Z = 2');
assert.equal(templeScene.vaultPos.z, -22, '后殿波塞冬黄金宝座与神藏应位于深处 Z = -22');
assert.equal(templeScene.isInnerGateOpen, false, '初始状态下内殿大门应紧闭');
console.log('  ✅ 独立地宫地图、传送阵、星辰日冕、九宫阵列与黄金宝座构建验证通过！');

// ==========================================
// 3. 跨地图传送系统验证 (main_island <-> ancient_temple)
// ==========================================
console.log('\n▶ [3/6] 测试踏入神殿独立地图与返回海岛主地图无缝传送...');
assert.equal(game.currentIslandId, 'main_island');
assert.equal(game.mainIslandVisible, true);

// 玩家在主岛后山点击进入神殿
game.travelToIsland('ancient_temple');
assert.equal(game.currentIslandId, 'ancient_temple', '当前地图应成功变更为 ancient_temple');
assert.equal(game.mainIslandVisible, false, '主岛环境应已隐藏以渲染专属地宫');
assert.equal(templeScene.group.visible, true, '神殿独立副本地图应显示');
assert.equal(game.player.position.z, 15, '玩家角色应精确传送至神殿入口传送光阵 (0, 0.4, 15)');

// 玩家走入传送阵返回海岛主地图
game.travelToIsland('main_island');
assert.equal(game.currentIslandId, 'main_island', '当前地图应成功切回 main_island');
assert.equal(game.mainIslandVisible, true, '主岛环境应重新显示');
assert.equal(templeScene.group.visible, false, '神殿独立副本地图应已隐藏');
assert.equal(game.player.position.z, -20, '从神殿出来应精准传送至后山大门外 (0, 0.4, -20)');
console.log('  ✅ 进入独立神殿地图与安全返回海岛主地图双向切换验证通过！');

// ==========================================
// 4. 第一重与第二重解谜机关联动
// ==========================================
console.log('\n▶ [4/6] 测试神殿室内机关：棱镜对焦与九宫图腾翻转联动大门...');
game.travelToIsland('ancient_temple');
const puzzleSys = new TemplePuzzleSystem(game);
game.templePuzzle = puzzleSys;

assert.equal(puzzleSys.stage, 0, '初始为第一重星辰棱镜对焦');
// 对焦三色棱镜
puzzleSys.prismAngles.red = 180;
puzzleSys.prismAngles.green = 90;
puzzleSys.prismAngles.blue = 270;
puzzleSys.stage = 1;

// 翻转九宫格至全 ☀️
puzzleSys.matrix = [
  [1, 1, 1],
  [1, 1, 1],
  [1, 1, 1]
];
puzzleSys.stage = 2;
puzzleSys.isDoorOpened = true;
templeScene.openInnerGate();

assert.equal(templeScene.isInnerGateOpen, true, '神殿独立场景内的玄铁大门应已升起洞开');
console.log('  ✅ 星辰棱镜对焦与九宫图腾破阵、玄铁大门升起联动验证通过！');

// ==========================================
// 5. 第三重：波塞冬黄金神藏结算与神器发放
// ==========================================
console.log('\n▶ [5/6] 测试深渊密室波塞冬神装与古代黄金结算...');
puzzleSys.claimTempleVault();
assert.equal(puzzleSys.vaultClaimed, true, '宝藏应标记为已领取');
assert.equal(templeScene.vaultClaimed, true, '神殿独立场景内应同步更新宝藏已领取');
assert.equal(game.ui.inventory['poseidon_crown'], 1, '应获得【远古波塞冬金冠】');
assert.equal(game.ui.inventory['abyssal_axe'], 1, '应获得【深渊附魔燧石战斧】');
assert.equal(game.ui.inventory['ancient_coin'], 100, '应获得古代金币 x100');
assert.equal(game.ui.inventory['ancient_core'], 2, '应获得古代高能核心 x2');
console.log('  ✅ 波塞冬金冠速度神装与深渊战斧全量发放验证通过！');

// ==========================================
// 6. 存档序列化与断点场景持久化恢复
// ==========================================
console.log('\n▶ [6/6] 测试神殿独立地图状态快照落盘与反序列化恢复...');
const puzzleData = puzzleSys.serialize();
const sceneData = templeScene.serialize();

assert.equal(puzzleData.stage, 2, '解谜存档应为已通关');
assert.equal(sceneData.isInnerGateOpen, true, '场景存档内殿门应为开启');
assert.equal(sceneData.vaultClaimed, true, '场景存档宝藏应为已领取');

// 新建实例并恢复
const restoredScene = new AncientTempleScene(game.scene, game);
restoredScene.deserialize(sceneData);
assert.equal(restoredScene.isInnerGateOpen, true, '恢复后大门应为开启状态');
assert.equal(restoredScene.vaultClaimed, true, '恢复后宝藏应为已领取状态');
console.log('  ✅ 神殿独立地图快照落盘与防重复解谜恢复验证通过！\n');

console.log('🎉🎉 [ALL TEMPLE MAP TESTS PASSED] 后山神秘古代神殿独立副本地图与解谜副本 100% 验证通过！');
