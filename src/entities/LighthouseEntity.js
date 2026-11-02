// CastawaySOL - 北崖古灯塔大工程与视觉状态实体 (North Cliff Lighthouse Entity)
// 终局大工程汇聚：第 1 章起在北崖高台可见遗迹基座与未点亮塔身；
// 第 5 章开启一期工程交付，同时消纳原石 (sol_crystal)、精炼纯晶 (sol_crystal_pure) 与深层新晶种 (sol_crystal_deep)；
// 交付完成后视觉状态切换为点亮运转（旋转探照光束与高亮晶核），驱动主线第 5 章过章。

import * as THREE from 'three';
import { economyLedger } from '../systems/EconomyLedger.js';
import { soundEngine } from '../core/AudioSystem.js';

export const LIGHTHOUSE_DELIVERY = Object.freeze({
  sol_crystal: 10,
  sol_crystal_pure: 3,
  sol_crystal_deep: 2
});

export class LighthouseEntity {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.anchor = new THREE.Vector3(24, 1.8, -26);

    this.isLit = false;
    this.phase1Complete = false;

    this.group = new THREE.Group();
    this.group.name = 'north-cliff-lighthouse';
    this.group.position.copy(this.anchor);

    this.beaconGroup = new THREE.Group();
    this.beaconGroup.position.set(0, 9.2, 0);

    this.initStructure();
    if (this.scene) {
      this.scene.add(this.group);
    }
  }

  initStructure() {
    // 1. 基座台阶 (双层粗石八角基座)
    const baseGeo1 = new THREE.CylinderGeometry(3.6, 4.2, 1.2, 8);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.92,
      flatShading: true
    });
    const base1 = new THREE.Mesh(baseGeo1, stoneMat);
    base1.position.y = 0.6;
    base1.castShadow = true;
    base1.receiveShadow = true;
    this.group.add(base1);

    const baseGeo2 = new THREE.CylinderGeometry(2.8, 3.4, 1.0, 8);
    const base2 = new THREE.Mesh(baseGeo2, stoneMat);
    base2.position.y = 1.7;
    base2.castShadow = true;
    base2.receiveShadow = true;
    this.group.add(base2);

    // 2. 塔身柱体 (上窄下宽圆台塔身)
    const towerGeo = new THREE.CylinderGeometry(1.6, 2.5, 6.8, 16);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0xdcdde1,
      roughness: 0.8,
      metalness: 0.05
    });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.y = 5.6;
    tower.castShadow = true;
    tower.receiveShadow = true;
    this.group.add(tower);

    // 塔身红白相间装饰环
    const stripeGeo = new THREE.CylinderGeometry(1.9, 2.1, 1.6, 16);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0x9b2226,
      roughness: 0.75
    });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 5.6;
    stripe.castShadow = true;
    this.group.add(stripe);

    // 3. 顶层瞭望回廊 (Catwalk Balcony)
    const balconyGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.35, 16);
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x2f3640,
      roughness: 0.6,
      metalness: 0.6
    });
    const balcony = new THREE.Mesh(balconyGeo, metalMat);
    balcony.position.y = 9.1;
    balcony.castShadow = true;
    this.group.add(balcony);

    // 栏杆圈
    const railGeo = new THREE.CylinderGeometry(2.15, 2.15, 0.6, 16, 1, true);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x353b48,
      wireframe: true
    });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.y = 9.5;
    this.group.add(rail);

    // 4. 灯室玻璃罩 (Lantern Room)
    const glassGeo = new THREE.CylinderGeometry(1.5, 1.5, 1.8, 16);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x74b9ff,
      roughness: 0.15,
      transparent: true,
      opacity: 0.45
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.y = 10.2;
    this.group.add(glass);

    // 5. 顶盖穹顶
    const roofGeo = new THREE.ConeGeometry(2.1, 1.4, 16);
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x1e272e,
      roughness: 0.5,
      metalness: 0.3
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 11.8;
    roof.castShadow = true;
    this.group.add(roof);

    // 6. 灯芯光源与旋转光束组件
    this.coreMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      emissive: 0x000000,
      roughness: 0.3
    });
    const coreGeo = new THREE.SphereGeometry(0.55, 16, 16);
    this.coreMesh = new THREE.Mesh(coreGeo, this.coreMat);
    this.coreMesh.position.set(0, 1.0, 0);
    this.beaconGroup.add(this.coreMesh);

    // 探照光束 (几何锥体模拟半透明体积光)
    const beamGeo = new THREE.ConeGeometry(3.0, 28, 16, 1, true);
    beamGeo.translate(0, 14, 0);
    beamGeo.rotateX(Math.PI / 2);
    this.beamMat = new THREE.MeshBasicMaterial({
      color: 0xffea70,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.beamMesh = new THREE.Mesh(beamGeo, this.beamMat);
    this.beamMesh.position.set(0, 1.0, 0);
    this.beamMesh.visible = false;
    this.beaconGroup.add(this.beamMesh);

    // 点光源
    this.pointLight = new THREE.PointLight(0xffea70, 0, 35);
    this.pointLight.position.set(0, 1.0, 0);
    this.beaconGroup.add(this.pointLight);

    this.group.add(this.beaconGroup);

    // 7. 工程交互台 (基座前方的交付木箱与石台)
    const benchGeo = new THREE.BoxGeometry(1.2, 0.7, 0.7);
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.85 });
    const bench = new THREE.Mesh(benchGeo, benchMat);
    bench.position.set(0, 1.55, 3.2);
    bench.castShadow = true;
    this.group.add(bench);
  }

  // 设置点亮/熄灭状态
  setLit(lit) {
    this.isLit = Boolean(lit);
    this.phase1Complete = Boolean(lit);

    if (this.isLit) {
      this.coreMat.color.setHex(0xffea70);
      this.coreMat.emissive.setHex(0xffbb33);
      this.coreMat.emissiveIntensity = 2.0;
      this.beamMesh.visible = true;
      this.pointLight.intensity = 2.8;
    } else {
      this.coreMat.color.setHex(0x333333);
      this.coreMat.emissive.setHex(0x000000);
      this.coreMat.emissiveIntensity = 0;
      this.beamMesh.visible = false;
      this.pointLight.intensity = 0;
    }
  }

  // 帧更新循环：旋转光束
  update(dt = 0.016) {
    if (this.isLit && this.beaconGroup) {
      this.beaconGroup.rotation.y += dt * 0.75;
    }
  }

  // 检查交付材料是否满足
  checkCanDeliver() {
    const inv = this.game?.ui?.inventory || {};
    const missing = [];

    for (const [key, need] of Object.entries(LIGHTHOUSE_DELIVERY)) {
      const cur = inv[key] || 0;
      if (cur < need) {
        missing.push({ key, need, cur });
      }
    }

    return {
      ok: missing.length === 0,
      missing,
      requirements: LIGHTHOUSE_DELIVERY
    };
  }

  // 执行一期交付点亮
  deliverPhase1() {
    if (this.isLit) {
      if (this.game?.ui) {
        this.game.ui.showToast('🗼 北崖古灯塔一期大工程已全面点亮运转！', 'medium');
      }
      return { ok: false, msg: '灯塔已点亮' };
    }

    const check = this.checkCanDeliver();
    if (!check.ok) {
      const desc = check.missing.map(m => `• ${m.key}: 需 ${m.need}，持有 ${m.cur}`).join('\n');
      if (this.game?.ui) {
        this.game.ui.showDialog('🗼 灯塔一期工程修复材料不足', `尚未备齐多梯晶石原料：\n\n${desc}\n\n【清单：硅晶原石 x10、高纯精炼纯晶 x3、深层海脉晶核 x2】`);
      }
      return { ok: false, msg: '材料不足', missing: check.missing };
    }

    const inv = this.game?.ui?.inventory || {};

    // 扣减原石（走 EconomyLedger lighthouse 汇聚出账）
    economyLedger(this.game).debit('sol_crystal', LIGHTHOUSE_DELIVERY.sol_crystal, 'lighthouse');

    // 扣减纯晶与新晶种
    inv.sol_crystal_pure -= LIGHTHOUSE_DELIVERY.sol_crystal_pure;
    if (inv.sol_crystal_pure <= 0) delete inv.sol_crystal_pure;

    inv.sol_crystal_deep -= LIGHTHOUSE_DELIVERY.sol_crystal_deep;
    if (inv.sol_crystal_deep <= 0) delete inv.sol_crystal_deep;

    // 视觉点亮
    this.setLit(true);

    // 主线故事标记
    if (this.game?.story) {
      this.game.story.lighthouseLit = true;
    }

    soundEngine.playVictory();
    if (this.game?.ui) {
      this.game.ui.renderInventory();
      this.game.ui.showDialog(
        '🌟【灯塔大工程一期·全域点亮】！',
        '随着三梯晶石能量汇聚接入古老地脉枢纽，北崖古灯塔顶部爆发出一道璀璨夺目的金色光柱！\n\n探照光束冲破海雾，横贯茫茫大洋！全岛矿脉共振频率达到巅峰！\n\n• 矿机 L4 终极算力图纸全面解封！\n• 主线第五章终极里程碑达成！'
      );
    }

    if (this.game?.saveSystem) {
      this.game.saveSystem.saveGame('lighthouse_lit');
    }

    return { ok: true };
  }

  serialize() {
    return {
      isLit: this.isLit,
      phase1Complete: this.phase1Complete
    };
  }

  deserialize(data) {
    if (!data) return;
    if (typeof data.isLit === 'boolean') {
      this.setLit(data.isLit);
    }
    if (typeof data.phase1Complete === 'boolean') {
      this.phase1Complete = data.phase1Complete;
    }
  }
}
