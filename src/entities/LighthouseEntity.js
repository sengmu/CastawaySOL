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

// D1 二期【星海谐振塔】升级交付清单（消纳终局高阶产出并共鸣归位波塞冬金冠圣物）
export const LIGHTHOUSE_PHASE2_DELIVERY = Object.freeze({
  sol_crystal_pure: 4,
  sol_crystal_deep: 3,
  pearl: 2,
  poseidon_crown: 1
});

export class LighthouseEntity {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.anchor = new THREE.Vector3(24, 1.8, -26);

    this.isLit = false;
    this.phase1Complete = false;
    this.phase2Complete = false;
    this.poseidonRelicEnshrined = false;
    this._phase2Elapsed = 0;

    this.group = new THREE.Group();
    this.group.name = 'north-cliff-lighthouse';
    this.group.position.copy(this.anchor);

    this.beaconGroup = new THREE.Group();
    this.beaconGroup.position.set(0, 9.2, 0);

    this.phase2Group = new THREE.Group();
    this.phase2Group.name = 'stellar-harmonic-crown';
    this.phase2Group.position.set(0, 12.8, 0);
    this.phase2Group.visible = false;

    this.auroraGroup = new THREE.Group();
    this.auroraGroup.name = 'aurora-dual-beams';
    this.auroraGroup.position.set(0, 10.2, 0);
    this.auroraGroup.visible = false;

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

    // 8. D1 二期【星海谐振塔】双环星冕棱镜与极光双光束 (程序化低多边形黏土几何体)
    const outerRingGeo = new THREE.TorusGeometry(1.65, 0.09, 8, 24);
    const outerRingMat = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0xd99b26,
      emissiveIntensity: 0.85,
      roughness: 0.3,
      metalness: 0.65,
      flatShading: true
    });
    this.outerCoronaRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    this.outerCoronaRing.rotation.x = Math.PI / 3;
    this.phase2Group.add(this.outerCoronaRing);

    const innerRingGeo = new THREE.TorusGeometry(1.15, 0.075, 8, 20);
    const innerRingMat = new THREE.MeshStandardMaterial({
      color: 0x56cfe1,
      emissive: 0x48bfe3,
      emissiveIntensity: 1.1,
      roughness: 0.25,
      metalness: 0.5,
      flatShading: true
    });
    this.innerCoronaRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    this.innerCoronaRing.rotation.y = Math.PI / 4;
    this.phase2Group.add(this.innerCoronaRing);

    const prismGeo = new THREE.OctahedronGeometry(0.55, 0);
    const prismMat = new THREE.MeshStandardMaterial({
      color: 0x80ffdb,
      emissive: 0x64dfdf,
      emissiveIntensity: 1.6,
      roughness: 0.15,
      metalness: 0.2,
      flatShading: true
    });
    this.stellarPrism = new THREE.Mesh(prismGeo, prismMat);
    this.phase2Group.add(this.stellarPrism);

    // 共鸣归位的波塞冬海皇金冠环饰
    const crownBandGeo = new THREE.CylinderGeometry(0.38, 0.32, 0.22, 8);
    const crownBandMat = new THREE.MeshStandardMaterial({
      color: 0xffbe0b,
      emissive: 0xfb8500,
      emissiveIntensity: 0.9,
      roughness: 0.3,
      metalness: 0.8,
      flatShading: true
    });
    const crownBand = new THREE.Mesh(crownBandGeo, crownBandMat);
    crownBand.position.y = 0.62;
    this.phase2Group.add(crownBand);
    this.group.add(this.phase2Group);

    // 反向交错极光双光束 (青翠极光束 + 星紫极光束)
    const auroraGeoA = new THREE.ConeGeometry(2.4, 30, 14, 1, true);
    auroraGeoA.translate(0, 15, 0);
    auroraGeoA.rotateX(Math.PI / 2.15);
    const auroraMatA = new THREE.MeshBasicMaterial({
      color: 0x38ef7d,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const auroraBeamA = new THREE.Mesh(auroraGeoA, auroraMatA);
    this.auroraGroup.add(auroraBeamA);

    const auroraGeoB = new THREE.ConeGeometry(2.4, 30, 14, 1, true);
    auroraGeoB.translate(0, 15, 0);
    auroraGeoB.rotateX(-Math.PI / 2.15);
    const auroraMatB = new THREE.MeshBasicMaterial({
      color: 0xa29bfe,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const auroraBeamB = new THREE.Mesh(auroraGeoB, auroraMatB);
    this.auroraGroup.add(auroraBeamB);

    this.group.add(this.auroraGroup);
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

  // 设置二期【星海谐振塔】激活状态
  setPhase2(active) {
    const enabled = Boolean(active);
    this.phase2Complete = enabled;
    this.poseidonRelicEnshrined = enabled;
    if (enabled && !this.isLit) {
      this.setLit(true);
    }
    if (this.phase2Group) this.phase2Group.visible = enabled;
    if (this.auroraGroup) this.auroraGroup.visible = enabled;
    if (enabled && this.pointLight) {
      this.pointLight.color.setHex(0x80ffdb);
      this.pointLight.intensity = 3.6;
    }
    if (this.game?.mistReefIsleScene) {
      this.game.mistReefIsleScene.teleportActive = enabled;
    }
  }

  // 帧更新循环：旋转探照光束与二期双环星冕棱镜
  update(dt = 0.016) {
    if (this.isLit && this.beaconGroup) {
      this.beaconGroup.rotation.y += dt * 0.75;
    }
    if (this.phase2Complete) {
      this._phase2Elapsed += dt;
      if (this.auroraGroup) {
        this.auroraGroup.rotation.y -= dt * 0.58;
      }
      if (this.outerCoronaRing) {
        this.outerCoronaRing.rotation.z += dt * 0.9;
      }
      if (this.innerCoronaRing) {
        this.innerCoronaRing.rotation.x -= dt * 1.25;
      }
      if (this.stellarPrism) {
        this.stellarPrism.rotation.y += dt * 1.5;
        this.stellarPrism.position.y = Math.sin(this._phase2Elapsed * 2.2) * 0.14;
      }
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

    // 主线故事标记与远洋晶雾航路解锁同步
    if (this.game?.story) {
      this.game.story.lighthouseLit = true;
    }
    if (this.game?.nauticalChart && typeof this.game.nauticalChart.syncEndgameRoutes === 'function') {
      this.game.nauticalChart.syncEndgameRoutes();
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

  // 检查二期【星海谐振塔】升级交付条件（支持背包 + 营地储物箱联合核验）
  checkCanDeliverPhase2() {
    if (!this.isLit) {
      return {
        ok: false,
        reason: '需先完成北崖古灯塔一期点亮工程',
        missing: [],
        requirements: LIGHTHOUSE_PHASE2_DELIVERY
      };
    }
    const inv = this.game?.ui?.inventory || {};
    const box = this.game?.storageSystem?.storageInventory || {};
    const missing = [];

    for (const [key, need] of Object.entries(LIGHTHOUSE_PHASE2_DELIVERY)) {
      const cur = (inv[key] || 0) + (box[key] || 0);
      if (cur < need) {
        missing.push({ key, need, cur });
      }
    }

    return {
      ok: missing.length === 0,
      missing,
      requirements: LIGHTHOUSE_PHASE2_DELIVERY
    };
  }

  // 执行二期【星海谐振塔】交付升级，打通先民三点零补给传送网并激活海皇归位增益
  deliverPhase2() {
    if (!this.isLit) {
      if (this.game?.ui) {
        this.game.ui.showToast('🗼 请先完成灯塔一期点亮工程！', 'medium');
      }
      return { ok: false, msg: '一期尚未点亮' };
    }
    if (this.phase2Complete) {
      if (this.game?.ui) {
        this.game.ui.showToast('🌌 星海谐振塔已处于满功率共鸣状态！', 'medium');
      }
      return { ok: false, msg: '二期已完成' };
    }

    const check = this.checkCanDeliverPhase2();
    if (!check.ok) {
      const labelMap = {
        sol_crystal_pure: '高纯精炼纯晶',
        sol_crystal_deep: '深层海脉晶核',
        pearl: '天然珍珠',
        poseidon_crown: '波塞冬海皇金冠'
      };
      const desc = check.missing
        .map(m => `• ${labelMap[m.key] || m.key}: 需 ${m.need}，当前共持有 ${m.cur}`)
        .join('\n');
      if (this.game?.ui) {
        this.game.ui.showDialog(
          '🌌【星海谐振塔·二期】共鸣资材不足',
          `升级星海谐振塔并贯通先民潮汐传送网，尚缺以下资材（支持背包+储物箱合并计入）：\n\n${desc}\n\n【二期清单：高纯精炼纯晶 ×4、深层海脉晶核 ×3、天然珍珠 ×2、波塞冬海皇金冠 ×1】`
        );
      }
      return { ok: false, msg: '材料不足', missing: check.missing };
    }

    const inv = this.game?.ui?.inventory || {};
    const box = this.game?.storageSystem?.storageInventory || {};

    // 优先扣减背包，差额从营地储物箱扣减
    for (const [key, need] of Object.entries(LIGHTHOUSE_PHASE2_DELIVERY)) {
      const fromBag = Math.min(inv[key] || 0, need);
      const fromBox = need - fromBag;
      if (fromBag > 0) {
        inv[key] -= fromBag;
        if (inv[key] <= 0) delete inv[key];
      }
      if (fromBox > 0) {
        box[key] = Math.max(0, (box[key] || 0) - fromBox);
        if (box[key] <= 0) delete box[key];
      }
    }

    this.setPhase2(true);

    if (this.game?.codexSystem) {
      this.game.codexSystem.unlockEntry('relic_poseidon_crown');
      this.game.codexSystem.unlockEntry('relic_harmonic_tower');
    }

    soundEngine.playVictory();
    if (this.game?.ui) {
      this.game.ui.renderInventory();
      this.game.ui.showDialog(
        '🌌【星海谐振塔·二期大工程圆满落成】！',
        '波塞冬海皇金冠悬浮升入塔顶双环星冕棱镜，青紫极光双光束横贯群岛天际！\n\n• 【先民潮汐传送网】已全面贯通：主岛先民祭坛 ⇄ 后山神殿内殿 ⇄ 晶雾回声岛实现零补给瞬移！\n• 【海皇圣物归位护佑】永久生效：群岛远航淡水消耗减半，近海垂钓稀有海产率大幅提升！'
      );
    }

    if (this.game?.saveSystem) {
      this.game.saveSystem.saveGame('lighthouse_phase2');
    }

    return { ok: true };
  }

  serialize() {
    return {
      isLit: this.isLit,
      phase1Complete: this.phase1Complete,
      phase2Complete: this.phase2Complete,
      poseidonRelicEnshrined: this.poseidonRelicEnshrined
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
    if (typeof data.phase2Complete === 'boolean') {
      this.setPhase2(data.phase2Complete);
    } else if (typeof data.poseidonRelicEnshrined === 'boolean' && data.poseidonRelicEnshrined) {
      this.setPhase2(true);
    }
  }
}
