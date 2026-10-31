// CastawaySOL - 荒岛 DePIN 绿色挖矿与算力黑市全流程自动化测试脚本
// 验证内容：
// 1. 海岛高能硅晶矿脉物理敲凿与硅晶原石 (sol_crystal) 爆落机制
// 2. 营地手搓绿色解密矿机装填、日光/电池动力学与步数/时间哈希出块机制
// 3. 验证出块生成 $SOL 算力代币 (sol_token) 与 SolanaBridge 工作证明同步
// 4. 算力黑市双轨支付通道：零充值使用 $SOL 算力代币兑换超频芯片与通关特权

import assert from 'node:assert';
import * as THREE from 'three';

// 1. Node.js 模拟浏览器全局上下文 (localStorage / document)
if (typeof globalThis.localStorage === 'undefined') {
  const store = {};
  globalThis.localStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    clear() { Object.keys(store).forEach(k => delete store[k]); }
  };
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement() {
      return {
        style: {},
        appendChild() {},
        addEventListener() {},
        querySelector() { return null; },
        querySelectorAll() { return []; }
      };
    },
    body: {
      appendChild() {}
    }
  };
}

// 2. 动态导入业务模块
const { BeachResourceSystem } = await import('../src/systems/BeachResourceSystem.js');
const { MiningRigSystem } = await import('../src/systems/MiningRigSystem.js');
const { solanaBridge } = await import('../src/core/SolanaBridge.js');
const { ShopManager } = await import('../src/ui/ShopManager.js');

console.log('⛏️ 开始执行【荒岛 DePIN 挖矿与算力黑市】全流程自动化回归测试...\n');

// 构造拟真轻量级游戏上下文
const mockScene = new THREE.Scene();
const mockGame = {
  scene: mockScene,
  solanaBridge: solanaBridge,
  weatherSystem: { isNight: false, hasOilskinCloak: false, hasFireShelter: false },
  ui: {
    inventory: {},
    getItemName(key) {
      if (key === 'sol_crystal') return '未解密硅晶原石';
      if (key === 'sol_token') return '$SOL 算力代币';
      if (key === 'battery') return '干燥电池';
      if (key === 'tree_sap') return '天然松脂';
      if (key === 'tree_branch') return '干燥木柴';
      return key;
    },
    showToast(msg) {
      // 捕获日志
    },
    showDialog(title, content) {
      // 捕获弹窗
    },
    renderInventory() {},
    expandInventory(count) {}
  },
  storageSystem: {
    storageInventory: {},
    expandCapacity(count) {}
  },
  saveSystem: {
    saveGame(reason) {}
  }
};

// ==========================================
// 1. 验证海岛高能硅晶矿脉生成与敲凿开采机制
// ==========================================
console.log('--- 测试 1: 高能硅晶矿脉物理开采与掉落 ---');
const beachResources = new BeachResourceSystem(mockScene);

// 查找硅晶矿脉 (sol_vein)
const solVeins = beachResources.resources.filter(r => r.type === 'sol_vein');
assert.strictEqual(solVeins.length >= 2, true, '海岛地图上必须部署至少 2 处高能硅晶矿床！');
const targetVein = solVeins[0];
console.log(`✅ 找到矿床: 【${targetVein.name}】，坐标: (${targetVein.pos.x}, ${targetVein.pos.y}, ${targetVein.pos.z})`);

const collectedDrops = [];
const onCollect = (itemKey, sourceName) => {
  collectedDrops.push(itemKey);
  mockGame.ui.inventory[itemKey] = (mockGame.ui.inventory[itemKey] || 0) + 1;
};

// 第一击：敲击未碎，血量扣减
const hit1 = beachResources.mineRock(targetVein, true, false, onCollect);
assert.strictEqual(hit1.broken, false, '第一击不应立即击碎高能矿床');
assert.strictEqual(targetVein.hp < targetVein.maxHp, true, '矿床硬度应该扣减');

// 持续敲击直至完全碎裂
let brokenResult = null;
while (!targetVein.collected) {
  brokenResult = beachResources.mineRock(targetVein, true, true, onCollect);
}
assert.strictEqual(brokenResult.broken, true, '高能硅晶矿床应完全碎裂');
assert.strictEqual(targetVein.collected, true, '矿床应标记为已开采收集');
assert.strictEqual(collectedDrops.includes('sol_crystal'), true, '开采矿脉必须爆落未解密硅晶原石 sol_crystal！');
console.log(`✅ 硅晶矿脉开采成功！爆落资材: ${collectedDrops.join(', ')}`);
console.log(`✅ 背包当前持有硅晶原石: ${mockGame.ui.inventory['sol_crystal']} 块`);

// 步数地质再生验证
targetVein.regrowthSteps = 10;
beachResources.recordMovement(10);
assert.strictEqual(targetVein.collected, false, '步数耗尽后硅晶矿脉必须重新结晶隆起');
console.log('✅ 地壳地质步数再生循环验证通过！\n');

// ==========================================
// 2. 验证营地绿色解密矿机装填与出块运算
// ==========================================
console.log('--- 测试 2: 营地绿色解密矿机与哈希出块验证 ---');
const miningRig = new MiningRigSystem(mockGame);
mockGame.miningRig = miningRig;

// 初始状态
assert.strictEqual(miningRig.isActive, false, '未启动时矿机应处于待机状态');
assert.strictEqual(miningRig.loadedCrystals, 1, '初始矿机预装 1 块体验原石');

// 向背包补充硅晶原石并装填
mockGame.ui.inventory['sol_crystal'] = 3;
const loadSuccess = miningRig.loadCrystal(2);
assert.strictEqual(loadSuccess, true, '应成功向矿机装填硅晶原石');
assert.strictEqual(miningRig.loadedCrystals, 3, '装填后晶石仓应为 3 块');
assert.strictEqual(mockGame.ui.inventory['sol_crystal'], 1, '背包应正确扣减 2 块原石');
assert.strictEqual(miningRig.isActive, true, '装填晶石后矿机自动进入通电计算状态');

// 蓄电池充能测试
miningRig.batteryPower = 40;
mockGame.ui.inventory['battery'] = 1;
miningRig.rechargeBattery('battery');
assert.strictEqual(miningRig.batteryPower, 90, '投入干燥电池后蓄电量应提升 50%');
console.log(`✅ 能源补给成功！当前蓄电量: ${miningRig.batteryPower}%`);

// 步数与时间驱动哈希出块
const initialBlocks = miningRig.totalBlocksMined;
console.log('🏃 模拟玩家在海岛奔跑探索推进步数哈希...');
// 连续奔跑推进步数
for (let i = 0; i < 20; i++) {
  miningRig.recordMovement(10);
}
// 模拟帧循环时间推进
miningRig.update(2.0);

assert.strictEqual(miningRig.totalBlocksMined > initialBlocks, true, '步数与时间推进必须成功验证并产出新区块！');
assert.strictEqual(miningRig.unclaimedSol > 0, true, '成功出块后待领取的 $SOL 算力代币必须大于 0！');
console.log(`✅ 恭喜！矿机累计验证区块: #${miningRig.totalBlocksMined}，产出槽待领取: ${miningRig.unclaimedSol} 枚 $SOL 代币`);

// 验证 SolanaBridge 凭据打通
const miningProof = solanaBridge.getMiningStats();
assert.strictEqual(miningProof.blocks, miningRig.totalBlocksMined, 'SolanaBridge 凭据应同步最新验证区块总数');
console.log(`✅ SolanaBridge 工作量证明同步成功: 记录区块 #${miningProof.blocks}`);

// 领取代币到行囊
const unclaimedCount = miningRig.unclaimedSol;
miningRig.claimSolTokens();
assert.strictEqual(miningRig.unclaimedSol, 0, '领取后产出槽应清零');
assert.strictEqual(mockGame.ui.inventory['sol_token'], unclaimedCount, '领取后背包应到账对应数量的 $SOL 算力代币');
console.log(`✅ 代币归仓成功！行囊现存: ${mockGame.ui.inventory['sol_token']} 枚 $SOL 算力代币！\n`);

// ==========================================
// 3. 验证算力黑市双轨兑换与特权激活
// ==========================================
console.log('--- 测试 3: 算力黑市双轨支付与 DePIN 特权兑换 ---');
const shop = new ShopManager(mockGame);

// 查找 DePIN 超频芯片商品
const chipProduct = shop.products.find(p => p.id === 'overclock_mining_chip');
assert.strictEqual(!!chipProduct, true, '商城商品列表中必须包含 DePIN 超频芯片');
assert.strictEqual(chipProduct.priceToken, 15, '超频芯片代币定价应为 15 代币');

// 代币不足时测试拦截
mockGame.ui.inventory['sol_token'] = 5;
const originalHashSpeed = miningRig.hashSpeed;
shop.handleCheckout('overclock_mining_chip', true);
assert.strictEqual(miningRig.isOverclocked, false, '代币不足时代币兑换应被安全拦截');
assert.strictEqual(miningRig.hashSpeed, originalHashSpeed, '未成功购买时不应提升算力');

// 赠予充足代币进行免充值兑换
mockGame.ui.inventory['sol_token'] = 25;
shop.handleCheckout('overclock_mining_chip', true);
assert.strictEqual(mockGame.ui.inventory['sol_token'], 10, '兑换后应正确扣减 15 枚代币 (25 - 15 = 10)');
assert.strictEqual(miningRig.isOverclocked, true, '兑换后矿机应成功激活超频状态');
assert.strictEqual(miningRig.hashSpeed, 30, '激活超频后算力解密速度应翻倍至 30');
console.log('✅ 成功使用挖矿产出代币免充值兑换【DePIN 超频运算芯片】！算力翻倍提升至 100%！');

// 兑换航天级固态锂电池模组
const lithiumProduct = shop.products.find(p => p.id === 'depin_lithium_pack');
shop.handleCheckout('depin_lithium_pack', true);
assert.strictEqual(mockGame.ui.inventory['sol_token'] || 0, 0, '兑换后代币扣减完毕 (10 - 10 = 0)');
assert.strictEqual(miningRig.hasLithiumPack, true, '固态锂电池组应成功激活');
assert.strictEqual(miningRig.maxBattery, 200, '蓄电池上限应翻倍扩容至 200%');
console.log('✅ 成功兑换【航天级固态锂电储能组】！电池上限翻倍至 200%！');

// 序列化与存档还原测试
const savedData = miningRig.serialize();
assert.strictEqual(savedData.isOverclocked, true, '存档必须保存超频状态');
assert.strictEqual(savedData.hasLithiumPack, true, '存档必须保存锂电池组状态');

const newRig = new MiningRigSystem(mockGame);
newRig.deserialize(savedData);
assert.strictEqual(newRig.isOverclocked, true, '读档后超频特权必须无损恢复');
assert.strictEqual(newRig.hashSpeed, 30, '读档后超频算力必须维持生效');
assert.strictEqual(newRig.maxBattery, 200, '读档后锂电容量必须维持生效');
console.log('✅ 矿机系统序列化存档与读档无损还原验证通过！\n');

console.log('🎉🎉【荒岛 DePIN 绿色挖矿与算力黑市】全流程回归测试全部 100% 通过！');
