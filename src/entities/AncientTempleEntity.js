// CastawaySOL - 后山神殿入口遗迹·秘境传送光门 (Ancient Temple Gateway & Vortex Portal)
// 位于主岛后山北部高地 (0, 0, -26)
// 方案 A 定位：作为通往地下独立副本【AncientTempleScene】的秘境传送大门
// 包含：三层古老青苔台阶、4 根发光符文石柱、太阳神兽雕像、深邃青蓝空间传送漩涡与导引信标石台
import * as THREE from 'three';

export class AncientTempleEntity {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'ancient-temple-gateway-group';

    // 锚点位于后山北侧山麓台地
    this.anchorPosition = new THREE.Vector3(0, 0, -26);
    this.group.position.copy(this.anchorPosition);

    // 传送光门交互导引点位置 (世界坐标: 0, 0.4, -22.5)
    this.altarWorldPos = new THREE.Vector3(0, 0.4, -22.5);

    this.isDoorOpen = true; // 秘境传送门常驻流转开启
    this.doorMesh = null;
    this.portalVortexMesh = null;
    this.portalRings = [];
    this.portalLight = null;
    this.altarGlowMesh = null;
    this.crystalLight = null;

    this.buildTempleArchitecture();
    this.scene.add(this.group);
  }

  buildTempleArchitecture() {
    // 材质定义：古代青灰石料、青苔石砖与发光金珀、青蓝传送灵光
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x576574,
      roughness: 0.85,
      metalness: 0.15,
      flatShading: true
    });

    const mossStoneMat = new THREE.MeshStandardMaterial({
      color: 0x3d5a45,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true
    });

    const runeMat = new THREE.MeshStandardMaterial({
      color: 0xffd32a,
      emissive: 0xffaa00,
      emissiveIntensity: 0.8,
      roughness: 0.2
    });

    const portalVortexMat = new THREE.MeshBasicMaterial({
      color: 0x00cec9,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });

    const portalEnergyMat = new THREE.MeshBasicMaterial({
      color: 0x74b9ff,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    });

    // 1. 三层渐进式青苔石阶基座
    for (let i = 0; i < 3; i++) {
      const w = 18 - i * 2.2;
      const d = 16 - i * 1.8;
      const h = 0.45;
      const stepGeo = new THREE.BoxGeometry(w, h, d);
      const stepMesh = new THREE.Mesh(stepGeo, i % 2 === 0 ? stoneMat : mossStoneMat);
      stepMesh.position.set(0, (i + 0.5) * h, 0);
      stepMesh.receiveShadow = true;
      stepMesh.castShadow = true;
      this.group.add(stepMesh);
    }

    const baseTopY = 3 * 0.45; // 1.35 米

    // 2. 神殿后方巍峨玄武岩后壁与拱顶框架
    const backWallGeo = new THREE.BoxGeometry(13.5, 7.5, 1.8);
    const backWall = new THREE.Mesh(backWallGeo, stoneMat);
    backWall.position.set(0, baseTopY + 3.75, -5.5);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    this.group.add(backWall);

    // 左右护壁
    const sideWallGeo = new THREE.BoxGeometry(1.6, 6.0, 9.0);
    const leftWall = new THREE.Mesh(sideWallGeo, mossStoneMat);
    leftWall.position.set(-6.0, baseTopY + 3.0, -1.0);
    leftWall.castShadow = true;
    this.group.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, mossStoneMat);
    rightWall.position.set(6.0, baseTopY + 3.0, -1.0);
    rightWall.castShadow = true;
    this.group.add(rightWall);

    // 3. 门楣与古代太阳神浮雕徽章
    const lintelGeo = new THREE.BoxGeometry(14.0, 1.4, 2.2);
    const lintel = new THREE.Mesh(lintelGeo, stoneMat);
    lintel.position.set(0, baseTopY + 6.8, -4.5);
    lintel.castShadow = true;
    this.group.add(lintel);

    const sunEmblemGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.4, 8);
    sunEmblemGeo.rotateX(Math.PI / 2);
    const sunEmblem = new THREE.Mesh(sunEmblemGeo, runeMat);
    sunEmblem.position.set(0, baseTopY + 7.0, -3.3);
    this.group.add(sunEmblem);

    // 4. 四根庄严古朴多边形立柱与发光符文环
    const pillarPositions = [
      [-4.5, 2.0], [4.5, 2.0],
      [-4.5, -2.5], [4.5, -2.5]
    ];

    pillarPositions.forEach(([px, pz]) => {
      // 柱基
      const baseGeo = new THREE.BoxGeometry(1.3, 0.6, 1.3);
      const pillarBase = new THREE.Mesh(baseGeo, stoneMat);
      pillarBase.position.set(px, baseTopY + 0.3, pz);
      pillarBase.castShadow = true;
      this.group.add(pillarBase);

      // 主柱身
      const colGeo = new THREE.CylinderGeometry(0.5, 0.58, 5.5, 7);
      const col = new THREE.Mesh(colGeo, mossStoneMat);
      col.position.set(px, baseTopY + 0.6 + 2.75, pz);
      col.castShadow = true;
      this.group.add(col);

      // 符文光环
      const ringGeo = new THREE.TorusGeometry(0.62, 0.08, 6, 16);
      ringGeo.rotateX(Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, runeMat);
      ring.position.set(px, baseTopY + 3.5, pz);
      this.group.add(ring);
    });

    // 5. 方案 A：门框内【深邃时空传送漩涡】(Vortex Portal Gateway)
    // 门洞内深渊背景
    const portalBackdropGeo = new THREE.PlaneGeometry(4.8, 5.6);
    const portalBackdropMat = new THREE.MeshBasicMaterial({ color: 0x050c18, side: THREE.DoubleSide });
    const portalBackdrop = new THREE.Mesh(portalBackdropGeo, portalBackdropMat);
    portalBackdrop.position.set(0, baseTopY + 2.8, -4.55);
    this.group.add(portalBackdrop);

    // 旋转的青蓝流光传送漩涡盘
    const vortexGeo = new THREE.CircleGeometry(2.2, 32);
    this.portalVortexMesh = new THREE.Mesh(vortexGeo, portalVortexMat);
    this.portalVortexMesh.position.set(0, baseTopY + 2.8, -4.5);
    this.group.add(this.portalVortexMesh);

    // 双层同心流光光环
    const ringInnerGeo = new THREE.RingGeometry(1.0, 1.4, 24);
    const ringInner = new THREE.Mesh(ringInnerGeo, portalEnergyMat);
    ringInner.position.set(0, baseTopY + 2.8, -4.48);
    this.group.add(ringInner);
    this.portalRings.push(ringInner);

    const ringOuterGeo = new THREE.RingGeometry(1.7, 2.1, 24);
    const ringOuter = new THREE.Mesh(ringOuterGeo, runeMat);
    ringOuter.position.set(0, baseTopY + 2.8, -4.46);
    this.group.add(ringOuter);
    this.portalRings.push(ringOuter);

    // 传送漩涡神秘青蓝点光源
    this.portalLight = new THREE.PointLight(0x00cec9, 3.0, 16, 1.8);
    this.portalLight.position.set(0, baseTopY + 2.8, -3.8);
    this.group.add(this.portalLight);

    // 6. 前台【秘境传送导引石碑】(Portal Beacon Pedestal)
    // 剔除地表重复日冕，塑造成接引探险者的传送石台
    const pedestalGeo = new THREE.CylinderGeometry(1.2, 1.5, 0.7, 8);
    const pedestal = new THREE.Mesh(pedestalGeo, stoneMat);
    pedestal.position.set(0, baseTopY + 0.35, 3.5);
    pedestal.castShadow = true;
    this.group.add(pedestal);

    // 导引台面上的符文星盘
    const starDialGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.15, 16);
    const starDialMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.3, metalness: 0.8 });
    const starDial = new THREE.Mesh(starDialGeo, starDialMat);
    starDial.position.set(0, baseTopY + 0.75, 3.5);
    this.group.add(starDial);

    // 中央悬浮跳动的空间信标灵石
    const beaconGeo = new THREE.OctahedronGeometry(0.35, 0);
    this.altarGlowMesh = new THREE.Mesh(beaconGeo, runeMat);
    this.altarGlowMesh.position.set(0, baseTopY + 1.35, 3.5);
    this.group.add(this.altarGlowMesh);

    // 温暖的导引金光点光源
    this.crystalLight = new THREE.PointLight(0xffaa00, 2.0, 12, 1.5);
    this.crystalLight.position.set(0, baseTopY + 1.5, 3.5);
    this.group.add(this.crystalLight);

    // 7. 左右两尊远古太阳守护兽雕像
    this.createGuardianBeast(-3.8, baseTopY + 0.3, 4.0, 0.4);
    this.createGuardianBeast(3.8, baseTopY + 0.3, 4.0, -0.4);
  }

  // 构建远古护法雕像
  createGuardianBeast(x, y, z, rotY) {
    const beastGroup = new THREE.Group();
    beastGroup.position.set(x, y, z);
    beastGroup.rotation.y = rotY;

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x485460, roughness: 0.8, flatShading: true });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00cec9 });

    // 底座
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.5), stoneMat);
    base.position.y = 0.25;
    beastGroup.add(base);

    // 身躯
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 1.1), stoneMat);
    body.position.set(0, 0.9, -0.1);
    beastGroup.add(body);

    // 狮面神兽首级
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.8), stoneMat);
    head.position.set(0, 1.6, 0.2);
    beastGroup.add(head);

    // 幽蓝发光双眸
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), eyeMat);
    eyeL.position.set(-0.2, 1.65, 0.62);
    beastGroup.add(eyeL);

    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), eyeMat);
    eyeR.position.set(0.2, 1.65, 0.62);
    beastGroup.add(eyeR);

    this.group.add(beastGroup);
  }

  // 打开古代石门 (方案 A 保持兼容，增强传送漩涡光辉)
  openTempleDoor() {
    this.isDoorOpen = true;
    if (this.portalLight) {
      this.portalLight.intensity = 4.5;
      this.portalLight.distance = 22;
    }
  }

  // 帧动画更新：传送旋涡旋转、符文光圈对冲与信标浮动
  update(delta) {
    // 1. 传送漩涡流光旋转
    if (this.portalVortexMesh) {
      this.portalVortexMesh.rotation.z += delta * 1.2;
    }
    if (this.portalRings && this.portalRings.length >= 2) {
      this.portalRings[0].rotation.z -= delta * 1.8;
      this.portalRings[1].rotation.z += delta * 0.9;
    }
    if (this.portalLight) {
      this.portalLight.intensity = 2.8 + Math.sin(Date.now() * 0.005) * 0.6;
    }

    // 2. 导引信标悬浮与光晕呼吸
    if (this.altarGlowMesh) {
      this.altarGlowMesh.rotation.y += delta * 1.5;
      this.altarGlowMesh.rotation.z += delta * 0.8;
      this.altarGlowMesh.position.y = 3 * 0.45 + 1.35 + Math.sin(Date.now() * 0.003) * 0.08;
    }
    if (this.crystalLight) {
      this.crystalLight.intensity = 2.0 + Math.sin(Date.now() * 0.004) * 0.5;
    }
  }
}
