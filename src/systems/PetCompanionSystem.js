// CastawaySOL - 多宠物出战切换与荒岛随行异兽系统 (Pet Companion System)
// 1. 深度整合神宠随行体系：灵猴巴布 (采摘探宝)、猎犬贝拉 (护主嗅探)、玄猫雷蒙德 (浅水捕鱼与夜视)、金羊多姆 (驮包储物与减疲劳)
// 2. 双轨商业化与探索解锁机制：支持消耗古代金币兑换，或通过 Solana 救援无线电特权空投直通
// 3. 营地 3D 暖巢交互实体：出战宠物贴身跟随护卫，未出战宠物在营地干草暖巢中休憩待机

import * as THREE from 'three';
import { soundEngine } from '../core/AudioSystem.js';
import { haptics } from '../core/HapticFeedback.js';
import { isEconomyResource } from './EconomyLedger.js';

export const PET_CATALOG = {
  bub_monkey: {
    id: 'bub_monkey',
    name: '机灵小猴·巴布',
    species: '荒岛灵猴',
    icon: '🐒',
    badge: '敏捷探险',
    modelKey: 'bub_monkey',
    priceCoins: 0,        // 免费主线入队
    priceSOL: 0,
    freeInitial: true,
    desc: '身手敏捷的小猴伙伴，擅长攀爬高大椰子树摇下稀有黄金椰与鸟蛋，并能钻入人类无法通过的悬崖狭缝搜寻古代金币。',
    perks: [
      '🌳 高空爬树摇果：必定掉落黄金海岛椰与鸟蛋',
      '🕳️ 岩缝钻穴探宝：搜刮古代海盗金币与深海珍珠',
      '✨ 采摘丰收增益：全图摇树果实掉落率 +25%'
    ]
  },
  bella_dog: {
    id: 'bella_dog',
    name: '忠诚猎犬·贝拉',
    species: '探险猎犬',
    icon: '🐕',
    badge: '护卫嗅探',
    modelKey: 'isabelle',
    priceCoins: 180,
    priceSOL: 0.15,
    freeInitial: false,
    desc: '嗅觉极其灵敏的忠诚探险犬，能侦测沙滩泥地深埋的宝藏与燧石，并在野兽靠近时发出震慑狂吠使敌人陷入硬直。',
    perks: [
      '🛡️ 护主威慑：玩家受到野兽撕咬伤害永久减免 20%',
      '👃 地脉嗅探：附近有埋藏物资或战利品时主动引路并高亮',
      '⚡ 战斗狂吠：野兽突袭时自动触发音波震慑硬直'
    ]
  },
  raymond_cat: {
    id: 'raymond_cat',
    name: '海月玄猫·雷蒙德',
    species: '海月灵猫',
    icon: '🐱',
    badge: '浅滩捕捞',
    modelKey: 'raymond',
    priceCoins: 240,
    priceSOL: 0.20,
    freeInitial: false,
    desc: '优雅神秘的海岛灵猫，拥有黑夜穿透视野与超凡水性，常在浅滩自行为主人叼捕鲜鱼，并在黑夜中散发柔和夜视光环。',
    perks: [
      '🐟 自动水产叼捕：走近水域时几率叼出沙丁鱼与海蟹',
      '🌙 幽夜灵视光环：黑夜中以玩家为中心生成柔和夜视暖光',
      '🎣 灵动垂钓感知：钓鱼咬钩速度提升 35%'
    ]
  },
  dom_sheep: {
    id: 'dom_sheep',
    name: '暖绒金羊·多姆',
    species: '高原卷角羊',
    icon: '🐑',
    badge: '随行驮载',
    modelKey: 'dom',
    priceCoins: 150,
    priceSOL: 0.12,
    freeInitial: false,
    desc: '体格健壮、温顺耐劳的卷角金羊，背负轻便两用行囊，不仅能随行扩充 6 格额外存储货仓，还能抚慰心灵大幅减免长途奔波的疲劳。',
    perks: [
      '🎒 随行专属驮袋：出战时额外提供 6 格随身储物仓',
      '🍃 奔跑体能抚慰：移动步数疲劳积累速度降低 50%',
      '👟 全地形耐力：全地形奔跑移速小幅提升 +10%'
    ]
  }
};

if (typeof window !== 'undefined') {
  window.__PET_CATALOG = PET_CATALOG;
}

export class PetCompanionSystem {
  constructor(game) {
    this.game = game;

    // 状态数据
    this.unlockedPets = ['bub_monkey']; // 默认已解锁小猴
    this.activePetId = 'bub_monkey';    // 当前出战宠物
    this.petStates = {
      bub_monkey: { energy: 80, affinity: 60 },
      bella_dog: { energy: 100, affinity: 70 },
      raymond_cat: { energy: 100, affinity: 70 },
      dom_sheep: { energy: 100, affinity: 70 }
    };

    // 金羊随行专属驮袋 (6 格独立物品栏)
    this.sheepPouchInventory = {};

    // 营地 3D 暖巢实体位置 (位于营地帐篷右侧: -15.5, 0.05, 21.0)
    this.nestAnchor = new THREE.Vector3(-15.5, 0.05, 21.0);
    this.group = new THREE.Group();
    this.group.name = 'pet-companion-system';
    if (this.game && this.game.scene) {
      this.game.scene.add(this.group);
    }

    // 玄猫黑夜夜视灯光
    this.nightVisionLight = null;
    this.catFishTimer = 30.0; // 玄猫浅滩水产自动捕捞计时器

    this.initNestEntity();
    this.initNightVisionLight();
  }

  // 构建营地 3D 宠物暖巢小屋与干草窝
  initNestEntity() {
    const nestGroup = new THREE.Group();
    nestGroup.position.copy(this.nestAnchor);

    // 原木围栏小平台
    const baseGeo = new THREE.CylinderGeometry(1.4, 1.5, 0.12, 12);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.06;
    base.receiveShadow = true;
    nestGroup.add(base);

    // 金黄蓬松干草铺垫
    const strawGeo = new THREE.CylinderGeometry(1.1, 1.2, 0.08, 12);
    const strawMat = new THREE.MeshStandardMaterial({ color: 0xdfe6e9, roughness: 0.7 });
    const straw = new THREE.Mesh(strawGeo, strawMat);
    straw.position.y = 0.14;
    nestGroup.add(straw);

    // 原木三角避风顶棚
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.85 });
    for (let i = 0; i < 3; i++) {
      const poleGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.2, 6);
      const pole = new THREE.Mesh(poleGeo, roofMat);
      const angle = (i * Math.PI * 2) / 3;
      pole.position.set(Math.cos(angle) * 0.8, 0.6, Math.sin(angle) * 0.8);
      nestGroup.add(pole);
    }

    // 遮阳麻布顶帆
    const canopyGeo = new THREE.ConeGeometry(1.2, 0.5, 6);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.8 });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.y = 1.35;
    canopy.castShadow = true;
    nestGroup.add(canopy);

    // 悬挂可爱的木雕宠物小脚印招牌
    const signGeo = new THREE.BoxGeometry(0.5, 0.25, 0.05);
    const signMat = new THREE.MeshStandardMaterial({ color: 0xffd32a, emissive: 0xf39c12, emissiveIntensity: 0.3 });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 0.8, 0.85);
    nestGroup.add(sign);

    // 地面提示光环
    const ringGeo = new THREE.RingGeometry(1.2, 1.4, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00cec9, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    nestGroup.add(ring);

    this.nestMesh = nestGroup;
    this.nestMesh.userData.interactionId = 'petNest';
    this.group.add(nestGroup);
  }

  // 初始化玄猫专属夜视点光源
  initNightVisionLight() {
    if (!this.game || !this.game.scene) return;
    this.nightVisionLight = new THREE.PointLight(0xa29bfe, 0, 12, 1.5);
    this.nightVisionLight.position.set(0, 1.5, 0);
    this.nightVisionLight.visible = false;
    this.game.scene.add(this.nightVisionLight);
  }

  // 获取指定宠物定义
  getPetSpec(petId) {
    return PET_CATALOG[petId] || null;
  }

  // 判断是否拥有该宠物
  isUnlocked(petId) {
    return this.unlockedPets.includes(petId);
  }

  // 获得当前出战宠物
  getActivePet() {
    return this.getPetSpec(this.activePetId);
  }

  // 切换出战随行宠物
  setActivePet(petId) {
    if (!this.isUnlocked(petId)) {
      if (this.game && this.game.ui) {
        this.game.ui.showToast('⚠️ 尚未收服该伙伴，请在营地暖巢用金币兑换或呼叫特权空投！', 'medium');
      }
      return false;
    }

    this.activePetId = petId;
    haptics.success();
    soundEngine.playPlaceFurniture();

    const spec = this.getPetSpec(petId);
    if (this.game && this.game.ui) {
      this.game.ui.showToast(`✨ 【${spec.name}】已设为当前出战随行伙伴！`, 'medium');
    }

    // 同步刷新 3D 模型显隐与跟随映射
    this.syncActivePetModel();

    return true;
  }

  // 消耗古代海盗金币兑换解锁宠物
  unlockWithCoins(petId) {
    const spec = this.getPetSpec(petId);
    if (!spec) return { ok: false, msg: '不存在此伙伴' };
    if (this.isUnlocked(petId)) return { ok: false, msg: '已经拥有该伙伴' };

    const inv = this.game.ui ? this.game.ui.inventory : {};
    const coinCount = inv['ancient_coin'] || 0;
    if (coinCount < spec.priceCoins) {
      return { ok: false, msg: `古代金币不足！需要 ${spec.priceCoins} 枚，当前拥有 ${coinCount} 枚` };
    }

    // 扣减金币
    inv['ancient_coin'] -= spec.priceCoins;
    if (inv['ancient_coin'] <= 0) delete inv['ancient_coin'];

    this.unlockedPets.push(petId);
    if (this.game.ui) this.game.ui.renderInventory();

    haptics.success();
    soundEngine.playLevelUp ? soundEngine.playLevelUp() : soundEngine.playPlaceFurniture();

    return { ok: true, msg: `🎉 成功用 ${spec.priceCoins} 枚古代金币与【${spec.name}】结为羁绊！` };
  }

  // 消耗 Solana 商业化特权解锁宠物
  unlockWithSol(petId) {
    const spec = this.getPetSpec(petId);
    if (!spec) return { ok: false, msg: '不存在此伙伴' };
    if (this.isUnlocked(petId)) return { ok: false, msg: '已经拥有该伙伴' };

    this.unlockedPets.push(petId);
    this.setActivePet(petId);

    haptics.success();
    return { ok: true, msg: `⚡ 空投成功！【${spec.name}】已激活随行特权！` };
  }

  // 投喂当前或指定宠物
  feedPet(petId, foodKey) {
    const inv = this.game.ui ? this.game.ui.inventory : {};
    if ((inv[foodKey] || 0) <= 0) return { ok: false, msg: '行囊中无此食物' };

    inv[foodKey]--;
    if (inv[foodKey] <= 0) delete inv[foodKey];

    const state = this.petStates[petId] || { energy: 80, affinity: 60 };
    let eAdd = 35;
    let aAdd = 10;

    if (foodKey === 'golden_coconut' || foodKey === 'cooked_crab' || foodKey === 'smoked_fish') {
      eAdd = 60;
      aAdd = 20;
    } else if (foodKey === 'apple' || foodKey === 'coconut' || foodKey === 'baked_fish') {
      eAdd = 40;
      aAdd = 12;
    }

    state.energy = Math.min(100, state.energy + eAdd);
    state.affinity = Math.min(100, state.affinity + aAdd);
    this.petStates[petId] = state;

    if (this.game.ui) {
      this.game.ui.renderInventory();
    }
    soundEngine.playCooking();
    haptics.medium();

    return {
      ok: true,
      energy: state.energy,
      affinity: state.affinity,
      msg: `🐾 投喂成功！${this.getPetSpec(petId).name} 精力+${eAdd}，亲密度+${aAdd}！`
    };
  }

  // 同步当前出战宠物的 3D 实体模型显隐与位置
  syncActivePetModel() {
    if (!this.game || !this.game.villagers) return;
    const villagers = this.game.villagers.villagers;

    // 所有宠物 model 集合
    const petModelIds = ['bub_monkey', 'isabelle', 'raymond', 'dom'];

    villagers.forEach((v) => {
      if (petModelIds.includes(v.id)) {
        const spec = Object.values(PET_CATALOG).find(p => p.modelKey === v.id);
        if (!spec) return;

        const isCurrentActive = (this.activePetId === spec.id);
        if (isCurrentActive) {
          v.group.visible = true;
          // 出战宠物跟随
        } else {
          // 未出战宠物：若已解锁，安置在营地暖巢边休息待机；若未解锁，暂不显示
          const unlocked = this.isUnlocked(spec.id);
          v.group.visible = unlocked;
          if (unlocked) {
            // 环绕在营地暖巢边
            const idx = Object.keys(PET_CATALOG).indexOf(spec.id);
            const ang = (idx * Math.PI * 2) / 4;
            v.group.position.set(
              this.nestAnchor.x + Math.cos(ang) * 1.6,
              this.nestAnchor.y,
              this.nestAnchor.z + Math.sin(ang) * 1.6
            );
            v.group.rotation.y = ang + Math.PI;
          }
        }
      }
    });
  }

  // 获得野兽战斗免伤百分比 (出战贝拉时享受 20% 免伤)
  getDamageReduction() {
    return this.activePetId === 'bella_dog' ? 0.20 : 0.0;
  }

  // 获得移动疲劳减免因子 (出战金羊多姆时疲劳减半)
  getFatigueRateMultiplier() {
    return this.activePetId === 'dom_sheep' ? 0.50 : 1.0;
  }

  // 获得钓鱼咬钩速度加成 (出战玄猫时加快 35%)
  getFishingBiteTimeMultiplier() {
    return this.activePetId === 'raymond_cat' ? 0.65 : 1.0;
  }

  // 金羊专属随行驮包存取
  getSheepPouchCount() {
    return Object.values(this.sheepPouchInventory).reduce((sum, n) => sum + (n || 0), 0);
  }

  depositToSheepPouch(itemKey, count = 1) {
    if (this.activePetId !== 'dom_sheep') return false;
    const inv = this.game.ui.inventory;
    if ((inv[itemKey] || 0) < count) return false;

    // 检查驮包格数上限 (最多 6 种不同物品)
    const distinctKeys = Object.keys(this.sheepPouchInventory);
    if (!distinctKeys.includes(itemKey) && distinctKeys.length >= 6) {
      if (this.game.ui) this.game.ui.showToast('🐑 金羊随行驮包已装满 (最多 6 格)！', 'medium');
      return false;
    }

    if (this.game.economyLedger && isEconomyResource(itemKey)) {
      this.game.economyLedger.transfer(itemKey, count, 'storage_deposit', inv, itemKey, this.sheepPouchInventory, itemKey);
    } else {
      const bag = inv;
      bag[itemKey] -= count;
      this.sheepPouchInventory[itemKey] = (this.sheepPouchInventory[itemKey] || 0) + count;
    }
    if (inv[itemKey] <= 0) delete inv[itemKey];

    if (this.game.ui && this.game.ui.renderInventory) this.game.ui.renderInventory();

    haptics.medium();
    soundEngine.playItemDrop();
    return true;
  }

  withdrawFromSheepPouch(itemKey, count = 1) {
    if ((this.sheepPouchInventory[itemKey] || 0) < count) return false;

    const inv = this.game.ui.inventory;
    if (this.game.economyLedger && isEconomyResource(itemKey)) {
      this.game.economyLedger.transfer(itemKey, count, 'storage_withdraw', this.sheepPouchInventory, itemKey, inv, itemKey);
    } else {
      this.sheepPouchInventory[itemKey] -= count;
      const bag = inv;
      bag[itemKey] = (bag[itemKey] || 0) + count;
    }
    if (this.sheepPouchInventory[itemKey] <= 0) delete this.sheepPouchInventory[itemKey];

    if (this.game.ui && this.game.ui.renderInventory) this.game.ui.renderInventory();

    haptics.medium();
    soundEngine.playItemDrop();
    return true;
  }

  // 帧更新 (玄猫夜视灯光联动与宠物待机)
  update(delta) {
    // 1. 玄猫夜视光环：仅在出战且黑夜时点亮并跟随玩家
    if (this.nightVisionLight && this.game && this.game.player) {
      const isCatActive = (this.activePetId === 'raymond_cat');
      const isNight = this.game.dayNight ? (this.game.dayNight.isNight || false) : false;

      if (isCatActive && isNight) {
        this.nightVisionLight.visible = true;
        this.nightVisionLight.intensity = THREE.MathUtils.lerp(this.nightVisionLight.intensity, 1.8, delta * 3.0);
        this.nightVisionLight.position.copy(this.game.player.position);
        this.nightVisionLight.position.y += 1.2;
      } else {
        this.nightVisionLight.intensity = THREE.MathUtils.lerp(this.nightVisionLight.intensity, 0, delta * 5.0);
        if (this.nightVisionLight.intensity < 0.02) {
          this.nightVisionLight.visible = false;
        }
      }
    }

    // 2. 玄猫浅滩水产自动叼捕机制 (出战玄猫且靠近浅滩或水域时，每 35~50 秒自动叼回鲜鱼/海蟹)
    if (this.activePetId === 'raymond_cat' && this.game && this.game.player) {
      this.catFishTimer -= delta;
      if (this.catFishTimer <= 0) {
        this.catFishTimer = 35.0 + Math.random() * 20.0;
        const playerPos = this.game.player.position;
        // 判定玩家是否靠近海水或淡水小溪
        const isNearWater = (this.game.fishing && this.game.fishing.isNearWater(playerPos)) ||
                            (this.game.beachResources && this.game.beachResources.isNearFreshwater(playerPos)) ||
                            Math.abs(playerPos.z) > 28 || Math.abs(playerPos.x) > 28;

        if (isNearWater && this.game.ui) {
          const catches = ['sardine', 'sea_crab', 'fish'];
          const pickedCatch = catches[Math.floor(Math.random() * catches.length)];
          const catchNames = { sardine: '鲜美沙丁鱼', sea_crab: '肥硕海蟹', fish: '肥美海鱼' };
          this.game.ui.addInventory(pickedCatch, 1);
          soundEngine.playSplash();
          haptics.success();
          this.game.ui.showToast(`🐱 海月玄猫雷蒙德敏捷地跃入浅滩，嘴里叼回了一条【${catchNames[pickedCatch]}】塞给你！`, 'small');
        }
      }
    }

    // 3. 营地暖巢顶棚微风轻晃
    if (this.nestMesh) {
      const t = Date.now() * 0.002;
      this.nestMesh.children[3].rotation.y = Math.sin(t) * 0.05;
    }
  }

  // 序列化快照保存
  serialize() {
    return {
      unlockedPets: [...this.unlockedPets],
      activePetId: this.activePetId,
      petStates: JSON.parse(JSON.stringify(this.petStates)),
      sheepPouchInventory: { ...this.sheepPouchInventory }
    };
  }

  // 反序列化恢复
  deserialize(data) {
    if (!data) return;
    if (Array.isArray(data.unlockedPets)) this.unlockedPets = [...data.unlockedPets];
    if (data.activePetId) this.activePetId = data.activePetId;
    if (data.petStates) this.petStates = JSON.parse(JSON.stringify(data.petStates));
    if (data.sheepPouchInventory) this.sheepPouchInventory = { ...data.sheepPouchInventory };

    // 恢复后同步刷新 3D 模型
    this.syncActivePetModel();
  }
}
