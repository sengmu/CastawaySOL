// CastawaySOL - 潮汐捕蟹笼与营地熏鱼晾晒架系统 (Tidal Crab Trap & Food Smoker System)
// 吸收《疯狂水世界》自动陷阱捕捞与经典荒岛生存风干军粮机制：
// 1. 南岸浅滩潮汐捕蟹笼：利用潮汐涨落自动起网海螯蟹与沙丁鱼，投入诱饵捕获效率加倍；
// 2. 营地熏鱼风干烤架：将易变质的鲜鱼和生蟹熏制为永久保质的【极品熏鱼干】与【香脆熏蟹】，远航出海顶级特权粮。

import * as THREE from 'three';
import { soundEngine } from '../core/AudioSystem.js';
import { haptics } from '../core/HapticFeedback.js';

export class TidalTrapSystem {
  constructor(game) {
    this.game = game;

    // 1. 潮汐捕蟹笼数据
    this.crabTrapAnchor = new THREE.Vector3(-4.0, 0.02, 36.5);
    this.trapBait = null;          // 放入的诱饵物品 ID
    this.trapBaitCount = 0;
    this.trapCatches = {
      sea_crab: 1,                 // 初始预置 1 只海蟹待收获
      sardine: 2
    };
    this.maxTrapCapacity = 6;
    this.trapStepCounter = 0;      // 步数累积推进潮汐

    // 2. 营地熏鱼晾晒架数据
    this.smokerAnchor = new THREE.Vector3(-13.8, 0.05, 24.5);
    this.isSmoking = false;
    this.smokeProgress = 0;        // 0 ~ 100
    this.smokeSpeed = 20;          // 每秒进度
    this.smokingItems = [];        // 正在熏制的原料 [{ id, count, targetId }]
    this.finishedItems = [];       // 已熏制完成的成品 [{ id, count }]

    this.group = new THREE.Group();
    this.group.name = 'tidal-trap-and-smoker-entities';
    if (this.game && this.game.scene) {
      this.game.scene.add(this.group);
    }

    this.initEntities();
  }

  // 构建 3D 实体模型
  initEntities() {
    this.createCrabTrapMesh();
    this.createSmokerRackMesh();
  }

  // 1. 潮汐捕蟹笼 (竹篾编织框与海面系绳浮筒)
  createCrabTrapMesh() {
    const trapGroup = new THREE.Group();
    trapGroup.userData.interactionId = 'crabTrap';
    trapGroup.position.copy(this.crabTrapAnchor);

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x795548,
      roughness: 0.85
    });

    // 浅滩基准木桩 (插在潮水浅滩中)
    const postGeo = new THREE.CylinderGeometry(0.08, 0.09, 1.3, 8);
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.set(0, 0.5, 0);
    post.castShadow = true;
    trapGroup.add(post);

    // 竹篾长方体捕蟹网笼
    const cageGeo = new THREE.BoxGeometry(0.9, 0.45, 0.7);
    const cageMat = new THREE.MeshStandardMaterial({
      color: 0x8d6e63,
      wireframe: false,
      roughness: 0.9
    });
    const cage = new THREE.Mesh(cageGeo, cageMat);
    cage.position.set(0.4, 0.22, 0);
    cage.castShadow = true;
    trapGroup.add(cage);

    // 笼顶亮黄色浮漂
    const buoyGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const buoyMat = new THREE.MeshStandardMaterial({
      color: 0xffd32a,
      emissive: 0xf39c12,
      emissiveIntensity: 0.4
    });
    this.trapBuoyMesh = new THREE.Mesh(buoyGeo, buoyMat);
    this.trapBuoyMesh.position.set(0.4, 0.58, 0);
    trapGroup.add(this.trapBuoyMesh);

    // 微光捕获提示信标 (有渔获时跳动)
    const ringGeo = new THREE.RingGeometry(0.45, 0.6, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00cec9,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    this.trapRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.trapRingMesh.rotation.x = -Math.PI / 2;
    this.trapRingMesh.position.y = 0.04;
    trapGroup.add(this.trapRingMesh);

    this.group.add(trapGroup);
  }

  // 2. 营地熏鱼风干烤架 (三角原木支架与风干悬绳)
  createSmokerRackMesh() {
    const smokerGroup = new THREE.Group();
    smokerGroup.userData.interactionId = 'smoker';
    smokerGroup.position.copy(this.smokerAnchor);

    const timberMat = new THREE.MeshStandardMaterial({
      color: 0x5d4037,
      roughness: 0.9
    });

    // 三脚交叉原木支柱
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const legGeo = new THREE.CylinderGeometry(0.045, 0.06, 1.8, 6);
      const leg = new THREE.Mesh(legGeo, timberMat);
      leg.position.set(Math.cos(angle) * 0.45, 0.8, Math.sin(angle) * 0.45);
      leg.rotation.z = Math.sin(angle) * 0.25;
      leg.rotation.x = Math.cos(angle) * 0.25;
      leg.castShadow = true;
      smokerGroup.add(leg);
    }

    // 顶部风干横梁
    const barGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6);
    const bar = new THREE.Mesh(barGeo, timberMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 1.35, 0);
    smokerGroup.add(bar);

    // 挂晒的熏鱼模型组
    this.hangingFishGroup = new THREE.Group();
    this.hangingFishGroup.position.set(0, 1.15, 0);

    const fishMat = new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.7 });
    for (let x = -0.3; x <= 0.3; x += 0.3) {
      const fGeo = new THREE.ConeGeometry(0.08, 0.32, 5);
      const fMesh = new THREE.Mesh(fGeo, fishMat);
      fMesh.rotation.x = Math.PI;
      fMesh.position.set(x, 0, 0);
      this.hangingFishGroup.add(fMesh);
    }
    smokerGroup.add(this.hangingFishGroup);

    // 底部炭火微光炉坑
    const pitGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.1, 8);
    const pitMat = new THREE.MeshStandardMaterial({
      color: 0x2d3436,
      emissive: 0xd63031,
      emissiveIntensity: 0.5
    });
    this.smokePitMesh = new THREE.Mesh(pitGeo, pitMat);
    this.smokePitMesh.position.set(0, 0.05, 0);
    smokerGroup.add(this.smokePitMesh);

    this.group.add(smokerGroup);
  }

  // 获得捕蟹笼中当前总渔获件数
  getTotalCatches() {
    return Object.values(this.trapCatches).reduce((sum, c) => sum + (c || 0), 0);
  }

  // 步数或时间推进潮汐收获 (Step-driven / Day-driven)
  advanceTide(steps = 1) {
    this.trapStepCounter += steps;
    // 每 40 步退潮一次，捕获新猎物
    if (this.trapStepCounter >= 40) {
      this.trapStepCounter = 0;
      if (this.getTotalCatches() < this.maxTrapCapacity) {
        // 有诱饵时高几率起获两件
        const hasBait = this.trapBaitCount > 0;
        if (Math.random() < 0.75 || hasBait) {
          this.trapCatches.sea_crab = (this.trapCatches.sea_crab || 0) + 1;
        }
        if (Math.random() < 0.65 || hasBait) {
          this.trapCatches.sardine = (this.trapCatches.sardine || 0) + 1;
        }
        if (hasBait) {
          this.trapBaitCount--;
          if (this.trapBaitCount <= 0) this.trapBait = null;
        }
      }
    }
  }

  // 一键起笼收获南岸海蟹与沙丁鱼
  harvestTrap() {
    const total = this.getTotalCatches();
    if (total <= 0) {
      this.game.ui.showToast('🦀 捕蟹笼空空如也，请投入诱饵静待下一次退潮！', 'medium');
      return false;
    }

    const inv = this.game.ui.inventory;
    const harvested = [];

    for (const [k, count] of Object.entries(this.trapCatches)) {
      if (count > 0) {
        inv[k] = (inv[k] || 0) + count;
        harvested.push({ id: k, count });
        this.trapCatches[k] = 0;
      }
    }

    this.game.ui.renderInventory();
    haptics.success();
    soundEngine.playSplash();

    this.game.ui.showDialog(
      '🦀 退潮捕蟹大丰收！',
      `起笼收获成功！竹篾笼中捕获了活蹦乱跳的海味：\n\n${harvested.map(h => `• ${this.game.ui.getItemName(h.id)} x${h.count}`).join('\n')}\n\n【提示：前往营火旁放入熏鱼架，可熏制成永久防腐的远航军粮！】`
    );

    return true;
  }

  // 投入诱饵 (投入野果或鱼类)
  addBait(itemKey) {
    const inv = this.game.ui.inventory;
    if ((inv[itemKey] || 0) <= 0) return false;

    inv[itemKey]--;
    if (inv[itemKey] <= 0) delete inv[itemKey];

    this.trapBait = itemKey;
    this.trapBaitCount = (this.trapBaitCount || 0) + 3; // 1 份诱饵维持 3 次退潮增益

    this.game.ui.renderInventory();
    haptics.medium();
    soundEngine.playItemDrop();
    this.game.ui.showToast(`🪱 成功投入诱饵【${this.game.ui.getItemName(itemKey)}】！未来 3 次潮汐起获率暴涨 200%！`, 'medium');

    return true;
  }

  // 开始熏烤鲜鱼或生蟹
  startSmoking(itemKey, count = 1) {
    const inv = this.game.ui.inventory;
    if ((inv[itemKey] || 0) < count) {
      this.game.ui.showToast('行囊中原料不足！', 'medium');
      return false;
    }

    // 检查燃料：需要 1 份树枝或树皮引火
    const hasFuel = (inv['tree_branch'] || 0) > 0 || (inv['tree_bark'] || 0) > 0 || (inv['kindling'] || 0) > 0;
    if (!hasFuel) {
      this.game.ui.showToast('🔥 熏烤需要引火燃料！请备好【树枝/树皮/引火物】投入炉坑！', 'medium');
      return false;
    }

    // 优先扣引火燃料
    if (inv['tree_bark']) {
      inv['tree_bark']--;
      if (inv['tree_bark'] <= 0) delete inv['tree_bark'];
    } else if (inv['tree_branch']) {
      inv['tree_branch']--;
      if (inv['tree_branch'] <= 0) delete inv['tree_branch'];
    } else {
      inv['kindling']--;
      if (inv['kindling'] <= 0) delete inv['kindling'];
    }

    inv[itemKey] -= count;
    if (inv[itemKey] <= 0) delete inv[itemKey];

    // 映射成品
    let targetProduct = 'smoked_fish';
    if (itemKey === 'sea_crab' || itemKey === 'crab_meat') {
      targetProduct = 'cooked_crab';
    }

    this.smokingItems.push({
      sourceId: itemKey,
      targetId: targetProduct,
      count: count
    });

    this.isSmoking = true;
    this.smokeProgress = 0;

    this.game.ui.renderInventory();
    haptics.success();
    soundEngine.playCooking();
    this.game.ui.showToast(`🔥 熏烤架已点燃！正在将【${this.game.ui.getItemName(itemKey)}】熏制风干为永久保质军粮！`, 'medium');

    return true;
  }

  // 收取熏制好的成品
  collectFinishedProducts() {
    if (this.finishedItems.length === 0) {
      this.game.ui.showToast('熏烤架上暂无已风干熏好的食物！', 'medium');
      return false;
    }

    const inv = this.game.ui.inventory;
    const collected = [];

    this.finishedItems.forEach((f) => {
      inv[f.id] = (inv[f.id] || 0) + f.count;
      collected.push(f);
    });
    this.finishedItems = [];

    this.game.ui.renderInventory();
    haptics.success();
    soundEngine.playItemDrop();

    this.game.ui.showDialog(
      '🍖 远航极品军粮风干出炉！',
      `香喷喷的熏烤食品已彻底风干熟透，绝不会变质损坏：\n\n${collected.map(c => `• ${this.game.ui.getItemName(c.id)} x${c.count}`).join('\n')}\n\n【食用大幅回满体力，出海远航时 1 份可抵扣 2 份常规干粮！】`
    );

    return true;
  }

  // 帧更新动效与进度推进
  update(delta) {
    // 捕蟹浮标在浅滩海浪中轻微上下浮动
    const time = Date.now() * 0.003;
    if (this.trapBuoyMesh) {
      this.trapBuoyMesh.position.y = 0.58 + Math.sin(time) * 0.05;
    }
    if (this.trapRingMesh) {
      const hasCatch = this.getTotalCatches() > 0;
      this.trapRingMesh.visible = hasCatch;
      this.trapRingMesh.rotation.z += delta * 1.5;
    }

    // 熏架工作进度与动态柴火明暗
    if (this.isSmoking) {
      this.smokeProgress += delta * this.smokeSpeed;
      if (this.smokePitMesh) {
        this.smokePitMesh.material.emissiveIntensity = 0.7 + Math.sin(time * 6.0) * 0.3;
      }
      if (this.hangingFishGroup) {
        this.hangingFishGroup.rotation.y = Math.sin(time * 2.0) * 0.08;
      }

      if (this.smokeProgress >= 100) {
        this.isSmoking = false;
        this.smokeProgress = 0;

        // 转化至成品槽
        this.smokingItems.forEach((item) => {
          this.finishedItems.push({
            id: item.targetId,
            count: item.count
          });
        });
        this.smokingItems = [];

        if (this.smokePitMesh) {
          this.smokePitMesh.material.emissiveIntensity = 0.2;
        }

        if (this.game && this.game.ui) {
          this.game.ui.showToast('✨ 熏烤风干完成！请前往营火旁熏架收取【熏鱼/熏蟹】！', 'medium');
        }
      }
    }
  }

  // 持久化存储
  serialize() {
    return {
      trapCatches: { ...this.trapCatches },
      trapBait: this.trapBait,
      trapBaitCount: this.trapBaitCount,
      finishedItems: [...this.finishedItems]
    };
  }

  // 反序列化恢复
  deserialize(data) {
    if (!data) return;
    if (data.trapCatches) this.trapCatches = { ...data.trapCatches };
    if (data.trapBait) this.trapBait = data.trapBait;
    if (typeof data.trapBaitCount === 'number') this.trapBaitCount = data.trapBaitCount;
    if (Array.isArray(data.finishedItems)) this.finishedItems = [...data.finishedItems];
  }
}
