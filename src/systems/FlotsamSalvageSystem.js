// CastawaySOL - 海面漂流物动态打捞系统 (Flotsam Salvage System)
// 沿南岸沙滩与出航浅水洋流漂荡物资箱、浮木板、金属桶与淡水罐
// 随海浪浮动、支持近海【E】键打捞、支持自动化打捞浮标网 (Auto-Salvage Buoy) 与 Schema v1 存档联动
import * as THREE from 'three';
import { soundEngine } from '../core/AudioSystem.js';
import { haptics } from '../core/HapticFeedback.js';

export class FlotsamSalvageSystem {
  constructor(scene, game = null) {
    this.scene = scene;
    this.game = game;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // 活跃的漂流物实体列表
    this.flotsamList = [];

    // 自动打捞浮标网特权状态 (类似《疯狂水世界》自动打捞网减负特权)
    this.hasAutoSalvageBuoy = false;
    this.buoyGroup = null;
    this.autoSalvageTimer = 0;
    this.AUTO_SALVAGE_INTERVAL = 30.0; // 浮标每 30 秒自动捕获并归仓一件漂流物

    // 初始海面浮动预设点 (位于南岸浅海与出航湾附近 Z: 26 ~ 38, X: -22 ~ 18)
    this.flotsamTypes = [
      {
        type: 'flotsam_wood',
        name: '漂流木板捆',
        color: 0x8b5a2b,
        geo: 'box',
        size: [0.75, 0.22, 1.2],
        drops: ['tree_branch', 'tree_branch', 'wood_plank']
      },
      {
        type: 'flotsam_barrel',
        name: '密封金属桶',
        color: 0x5a6577,
        geo: 'cylinder',
        size: [0.32, 0.32, 0.75],
        drops: ['nail', 'nail', 'battery'] // 产出矿机备用电池
      },
      {
        type: 'flotsam_crate',
        name: '海难漂流板条箱',
        color: 0xa07844,
        geo: 'box',
        size: [0.65, 0.55, 0.65],
        drops: ['wood_plank', 'apple', 'sol_crystal'] // 漂流打捞可开出未解密硅晶原石
      },
      {
        type: 'flotsam_jug',
        name: '搁浅淡水塑料罐',
        color: 0x38ada9,
        geo: 'cylinder',
        size: [0.22, 0.25, 0.45],
        drops: ['canteen_sip', 'apple']
      }
    ];

    this.spawnsConfig = [
      { typeIdx: 0, x: -16.5, z: 32.0, baseWaterY: -0.2 },
      { typeIdx: 1, x: -6.0, z: 36.5, baseWaterY: -0.22 },
      { typeIdx: 2, x: 5.5, z: 35.0, baseWaterY: -0.2 },
      { typeIdx: 3, x: 14.0, z: 31.5, baseWaterY: -0.18 },
      { typeIdx: 0, x: -21.0, z: 28.5, baseWaterY: -0.18 },
      { typeIdx: 2, x: -1.5, z: 38.0, baseWaterY: -0.24 }
    ];

    this.time = 0;
    this.respawnTimer = 0;
    this.RESPAWN_INTERVAL = 75.0; // 每 75 秒随潮水自然补充一个漂流物

    this.initFlotsam();
  }

  setGame(game) {
    this.game = game;
  }

  // 解锁并部署近海自动打捞浮标网
  unlockAutoSalvageBuoy() {
    this.hasAutoSalvageBuoy = true;
    this.deployBuoyMesh();
    if (this.game && this.game.ui) {
      this.game.ui.showToast('⚓ 近海【自动打捞浮标网】已成功部署！潮汐漂流物将自动归仓！', 'medium');
    }
  }

  // 部署 3D 浮标实体
  deployBuoyMesh() {
    if (this.buoyGroup) return;

    this.buoyGroup = new THREE.Group();
    this.buoyGroup.position.set(-20.5, -0.15, 34.5);

    // 亮橙色警示浮筒
    const floatGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.5, 12);
    const floatMat = new THREE.MeshStandardMaterial({
      color: 0xff6b35,
      roughness: 0.35,
      metalness: 0.2
    });
    const floatMesh = new THREE.Mesh(floatGeo, floatMat);
    floatMesh.castShadow = true;
    this.buoyGroup.add(floatMesh);

    // 顶部信标杆与闪烁信号灯
    const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 0.55;
    this.buoyGroup.add(pole);

    const lampGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0x00cec9,
      emissive: 0x00cec9,
      emissiveIntensity: 0.8
    });
    this.buoyLamp = new THREE.Mesh(lampGeo, lampMat);
    this.buoyLamp.position.y = 0.95;
    this.buoyGroup.add(this.buoyLamp);

    // 底部拦网浮球连线
    for (let i = 1; i <= 3; i++) {
      const netBallGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const netBallMat = new THREE.MeshStandardMaterial({ color: 0xfdcb6e });
      const netBall = new THREE.Mesh(netBallGeo, netBallMat);
      netBall.position.set(i * 0.9, -0.05, i * 0.4);
      this.buoyGroup.add(netBall);
    }

    this.group.add(this.buoyGroup);
  }

  // 初始化海面漂流物
  initFlotsam() {
    this.spawnsConfig.forEach((cfg, idx) => {
      this.createFlotsamItem(`flotsam_${idx}`, cfg.typeIdx, cfg.x, cfg.z, cfg.baseWaterY);
    });
  }

  // 创建单件海面漂流物实体
  createFlotsamItem(id, typeIdx, x, z, baseWaterY) {
    const spec = this.flotsamTypes[typeIdx % this.flotsamTypes.length];
    const itemGroup = new THREE.Group();
    itemGroup.position.set(x, baseWaterY, z);

    let mesh;
    const mat = new THREE.MeshStandardMaterial({
      color: spec.color,
      roughness: 0.65,
      metalness: spec.geo === 'cylinder' && spec.type === 'flotsam_barrel' ? 0.45 : 0.08
    });

    if (spec.geo === 'box') {
      const geo = new THREE.BoxGeometry(...spec.size);
      mesh = new THREE.Mesh(geo, mat);
      // 木箱绑带细节
      const strapGeo = new THREE.BoxGeometry(spec.size[0] + 0.02, spec.size[1] + 0.02, 0.08);
      const strapMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
      const strap = new THREE.Mesh(strapGeo, strapMat);
      mesh.add(strap);
    } else {
      const geo = new THREE.CylinderGeometry(...spec.size, 10);
      mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.z = Math.PI / 2.2; // 侧卧漂浮
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    itemGroup.add(mesh);

    // 海面漂浮波纹白色光环
    const rippleGeo = new THREE.RingGeometry(0.45, 0.65, 16);
    rippleGeo.rotateX(-Math.PI / 2);
    const rippleMat = new THREE.MeshBasicMaterial({
      color: 0x90e0ef,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
    rippleMesh.position.y = 0.05;
    itemGroup.add(rippleMesh);

    this.group.add(itemGroup);

    const flotsamObj = {
      id,
      spec,
      pos: new THREE.Vector3(x, baseWaterY, z),
      baseY: baseWaterY,
      group: itemGroup,
      ripple: rippleMesh,
      mesh,
      collected: false,
      driftPhase: Math.random() * Math.PI * 2,
      bobSpeed: 1.8 + Math.random() * 0.8
    };

    this.flotsamList.push(flotsamObj);
    return flotsamObj;
  }

  // 帧更新：模拟海浪浮动摇曳动力学与潮汐周期性补充
  update(delta) {
    this.time += delta;

    for (const item of this.flotsamList) {
      if (item.collected) continue;

      // 1. 随海浪浮动 (波峰波谷自然颠簸)
      const wave = Math.sin(this.time * item.bobSpeed + item.driftPhase);
      const waveRoll = Math.cos(this.time * 1.2 + item.driftPhase) * 0.12;
      item.group.position.y = item.baseY + wave * 0.08;
      item.mesh.rotation.x = waveRoll;
      item.mesh.rotation.z = wave * 0.08;

      // 2. 波纹收放与呼吸
      const rScale = 1.0 + wave * 0.15;
      item.ripple.scale.set(rScale, 1.0, rScale);
      item.ripple.material.opacity = 0.35 + wave * 0.15;
    }

    // 3. 潮汐自然补充
    this.respawnTimer += delta;
    if (this.respawnTimer >= this.RESPAWN_INTERVAL) {
      this.respawnTimer = 0;
      this.respawnOneFlotsam();
    }

    // 4. 自动打捞浮标网自动截获处理
    if (this.hasAutoSalvageBuoy) {
      // 浮标信标灯呼吸与海浪轻微浮动
      if (this.buoyGroup) {
        const bWave = Math.sin(this.time * 2.0);
        this.buoyGroup.position.y = -0.15 + bWave * 0.05;
        if (this.buoyLamp && this.buoyLamp.material) {
          this.buoyLamp.material.emissiveIntensity = 0.5 + Math.sin(this.time * 4.0) * 0.5;
        }
      }

      this.autoSalvageTimer += delta;
      if (this.autoSalvageTimer >= this.AUTO_SALVAGE_INTERVAL) {
        this.autoSalvageTimer = 0;
        this.performAutoSalvage();
      }
    }
  }

  // 自动打捞执行：将海面一件漂流物捕获并自动送入营地储物木箱
  performAutoSalvage() {
    const uncollected = this.flotsamList.find(f => !f.collected);
    if (!uncollected) return false;

    uncollected.collected = true;
    uncollected.group.visible = false;

    // 材料存入储物箱
    if (this.game && this.game.storageSystem) {
      const storage = this.game.storageSystem.storageInventory;
      uncollected.spec.drops.forEach(itemKey => {
        storage[itemKey] = (storage[itemKey] || 0) + 1;
      });
      if (this.game.ui) {
        this.game.ui.showToast(`⚓ 打捞浮标截获了【${uncollected.spec.name}】，建材已自动归入营地木箱！`, 'small');
      }
      return true;
    }
    return false;
  }

  // 潮汐涨落时随机冲刷上岸一件新漂流物
  respawnOneFlotsam() {
    const uncollected = this.flotsamList.filter(f => !f.collected);
    if (uncollected.length >= 8) return; // 维持海面不过度拥挤

    const randX = -20.0 + Math.random() * 36.0;
    const randZ = 28.0 + Math.random() * 9.0;
    const randType = Math.floor(Math.random() * this.flotsamTypes.length);
    const newId = `flotsam_${Date.now()}`;
    this.createFlotsamItem(newId, randType, randX, randZ, -0.2);
  }

  // 玩家走进打捞检测 (距离小于 2.0 米按【E】打捞)
  checkSalvage(playerPos, onSalvage) {
    for (const item of this.flotsamList) {
      if (item.collected) continue;
      const d = playerPos.distanceTo(item.group.position);
      if (d < 2.0) {
        item.collected = true;
        item.group.visible = false;
        soundEngine.playItemDrop();
        haptics.medium();

        // 掉落原材料分配
        item.spec.drops.forEach(dropItem => {
          if (onSalvage) {
            onSalvage(dropItem, item.spec.name);
          }
        });
        return item;
      }
    }
    return null;
  }

  // 获取离玩家最近的可打捞物品
  getNearest(playerPos, maxDist = 2.8) {
    let nearest = null;
    let minDist = maxDist;
    for (const item of this.flotsamList) {
      if (item.collected) continue;
      const d = playerPos.distanceTo(item.group.position);
      if (d < minDist) {
        minDist = d;
        nearest = item;
      }
    }
    return nearest;
  }

  // 序列化与存档支持
  serialize() {
    return {
      collectedIds: this.flotsamList.filter(f => f.collected).map(f => f.id),
      hasAutoSalvageBuoy: this.hasAutoSalvageBuoy
    };
  }

  // 反序列化恢复
  deserialize(data) {
    if (!data) return;
    if (Array.isArray(data.collectedIds)) {
      const set = new Set(data.collectedIds);
      this.flotsamList.forEach(item => {
        if (set.has(item.id)) {
          item.collected = true;
          item.group.visible = false;
        }
      });
    }
    if (data.hasAutoSalvageBuoy) {
      this.hasAutoSalvageBuoy = true;
      this.deployBuoyMesh();
    }
  }
}
