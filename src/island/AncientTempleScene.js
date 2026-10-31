// CastawaySOL - 后山神秘古代神殿与密室独立副本地图场景 (Ancient Temple Interior Scene)
// 包含专属地宫空间、符文图腾立柱、青幽点光源、星辰日冕解谜祭坛、九宫图腾地面机关、深处波塞冬黄金宝座与传送回海岛光阵
import * as THREE from 'three';
import { soundEngine } from '../core/AudioSystem.js';
import { haptics } from '../core/HapticFeedback.js';

export class AncientTempleScene {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.group = new THREE.Group();
    this.group.name = 'AncientTempleSceneGroup';
    this.group.visible = false;
    this.scene.add(this.group);

    // 关键交互锚点坐标 (神殿室内坐标系)
    this.portalSpawnPos = new THREE.Vector3(0, 0.4, 15);   // 入口/返航传送门
    this.altarPos = new THREE.Vector3(0, 0.4, 2);          // 前殿中央日冕解谜祭坛
    this.innerGatePos = new THREE.Vector3(0, 3.5, -13);    // 内殿玄铁石门
    this.vaultPos = new THREE.Vector3(0, 0.8, -22);        // 后殿黄金波塞冬宝座与神藏

    this.isInnerGateOpen = false;
    this.vaultClaimed = false;

    this.initDungeonArchitecture();
    this.initLightingAndTorches();
    this.initPortalReturnPad();
    this.initAltarAndTotem();
    this.initInnerSanctumAndVault();
  }

  // 1. 构建神殿室内宏伟玄石地宫 (地面、高耸围墙与神殿巨柱)
  initDungeonArchitecture() {
    // 地宫玄铁青石地面 (宽 32m, 长 52m, 高 1.2m)
    const floorGeo = new THREE.BoxGeometry(32, 1.2, 54);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e272e,
      roughness: 0.82,
      metalness: 0.25,
      flatShading: true
    });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.position.set(0, -0.6, 0);
    this.floorMesh.receiveShadow = true;
    this.floorMesh.userData.movementSurface = true;
    this.floorMesh.userData.walkSurface = true;
    this.group.add(this.floorMesh);

    // 中央青金导光石阶长廊
    const carpetGeo = new THREE.PlaneGeometry(6.5, 48);
    const carpetMat = new THREE.MeshStandardMaterial({
      color: 0x10ac84,
      roughness: 0.7,
      metalness: 0.35,
      emissive: 0x1dd1a1,
      emissiveIntensity: 0.15
    });
    const carpetMesh = new THREE.Mesh(carpetGeo, carpetMat);
    carpetMesh.rotation.x = -Math.PI / 2;
    carpetMesh.position.set(0, 0.02, 0);
    carpetMesh.receiveShadow = true;
    this.group.add(carpetMesh);

    // 左右与后方高耸巨石护墙 (厚 2m, 高 12m)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x2f3640,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true
    });

    // 左护墙
    const leftWallGeo = new THREE.BoxGeometry(2, 12, 54);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.position.set(-16, 5.4, 0);
    leftWall.userData.movementBox = true;
    this.group.add(leftWall);

    // 右护墙
    const rightWall = new THREE.Mesh(leftWallGeo, wallMat);
    rightWall.position.set(16, 5.4, 0);
    rightWall.userData.movementBox = true;
    this.group.add(rightWall);

    // 南侧入口后墙 (留有 6 米宽的大拱门)
    const southWallMat = wallMat;
    const southPillarL = new THREE.Mesh(new THREE.BoxGeometry(13, 12, 2), southWallMat);
    southPillarL.position.set(-9.5, 5.4, 26);
    southPillarL.userData.movementBox = true;
    this.group.add(southPillarL);

    const southPillarR = new THREE.Mesh(new THREE.BoxGeometry(13, 12, 2), southWallMat);
    southPillarR.position.set(9.5, 5.4, 26);
    southPillarR.userData.movementBox = true;
    this.group.add(southPillarR);

    // 北侧殿堂终焉绝壁 (后墙)
    const northWallGeo = new THREE.BoxGeometry(32, 12, 2);
    const northWall = new THREE.Mesh(northWallGeo, wallMat);
    northWall.position.set(0, 5.4, -26);
    northWall.userData.movementBox = true;
    this.group.add(northWall);

    // 殿堂两侧整齐排列的 8 根古代符文巨石立柱
    this.pillars = [];
    const pillarPositions = [
      [-10, 18], [10, 18],
      [-10, 6],  [10, 6],
      [-10, -6], [10, -6],
      [-10, -18], [10, -18]
    ];

    const pillarGeo = new THREE.CylinderGeometry(1.2, 1.4, 11, 16);
    const runeRingGeo = new THREE.CylinderGeometry(1.28, 1.28, 0.6, 16);
    const runeMat = new THREE.MeshStandardMaterial({
      color: 0x00d2d3,
      emissive: 0x00d2d3,
      emissiveIntensity: 0.6,
      roughness: 0.3
    });

    pillarPositions.forEach(([px, pz]) => {
      const pGroup = new THREE.Group();
      pGroup.position.set(px, 5.5, pz);
      pGroup.userData.movementRadius = 1.2;

      const pMesh = new THREE.Mesh(pillarGeo, wallMat);
      pMesh.castShadow = true;
      pGroup.add(pMesh);

      const rRing = new THREE.Mesh(runeRingGeo, runeMat);
      rRing.position.y = -1.5;
      pGroup.add(rRing);

      this.group.add(pGroup);
      this.pillars.push(pGroup);
    });
  }

  // 2. 初始化幽暗地宫光照与两侧幽炎火把
  initLightingAndTorches() {
    // 基础神秘地宫微弱环境光
    this.ambientLight = new THREE.AmbientLight(0x1a233a, 1.4);
    this.group.add(this.ambientLight);

    // 前后中央两盏暗紫青主天光 (增强立体感与阴影)
    const mainSun = new THREE.DirectionalLight(0x48dbfb, 1.2);
    mainSun.position.set(0, 18, 5);
    this.group.add(mainSun);

    // 沿廊道设置 4 盏青蓝与暖金交错的幽炎火炬点光源
    const torchConfigs = [
      { x: -9.5, y: 3.2, z: 12, color: 0x00cec9, intensity: 2.2, dist: 16 },
      { x: 9.5, y: 3.2, z: 12, color: 0x00cec9, intensity: 2.2, dist: 16 },
      { x: -9.5, y: 3.2, z: -8, color: 0xffd32a, intensity: 2.5, dist: 18 },
      { x: 9.5, y: 3.2, z: -8, color: 0xffd32a, intensity: 2.5, dist: 18 }
    ];

    torchConfigs.forEach(cfg => {
      const pLight = new THREE.PointLight(cfg.color, cfg.intensity, cfg.dist);
      pLight.position.set(cfg.x, cfg.y, cfg.z);
      this.group.add(pLight);

      // 火把台座
      const sconceGeo = new THREE.ConeGeometry(0.3, 0.7, 8);
      const sconceMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.9 });
      const sconceMesh = new THREE.Mesh(sconceGeo, sconceMat);
      sconceMesh.position.set(cfg.x, cfg.y - 0.2, cfg.z);
      sconceMesh.rotation.x = Math.PI;
      this.group.add(sconceMesh);
    });
  }

  // 3. 入口与返航海岛传送阵 (Portal Return Pad)
  initPortalReturnPad() {
    this.portalGroup = new THREE.Group();
    this.portalGroup.position.copy(this.portalSpawnPos);

    // 传送阵发光符文石盘
    const padGeo = new THREE.CylinderGeometry(2.4, 2.6, 0.2, 32);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x0abde3,
      emissive: 0x00d2d3,
      emissiveIntensity: 0.5,
      roughness: 0.4
    });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.position.y = 0.1;
    this.portalGroup.add(padMesh);

    // 旋转上升微型光环柱
    const ringGeo = new THREE.TorusGeometry(2.0, 0.08, 12, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x54a0ff, wireframe: true });
    this.portalRing = new THREE.Mesh(ringGeo, ringMat);
    this.portalRing.rotation.x = Math.PI / 2;
    this.portalRing.position.y = 0.8;
    this.portalGroup.add(this.portalRing);

    // 传送点高能青光
    const portalLight = new THREE.PointLight(0x00d2d3, 2.0, 8.0);
    portalLight.position.y = 1.2;
    this.portalGroup.add(portalLight);

    this.group.add(this.portalGroup);
  }

  // 4. 前殿中央日冕祭坛与九宫图腾地面石阵
  initAltarAndTotem() {
    this.altarGroup = new THREE.Group();
    this.altarGroup.position.copy(this.altarPos);

    // 双层青苔古石祭坛台座
    const baseGeo = new THREE.CylinderGeometry(2.8, 3.2, 0.6, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x3d5a45, roughness: 0.85, flatShading: true });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.3;
    baseMesh.receiveShadow = true;
    this.altarGroup.add(baseMesh);

    // 祭坛中央日冕立柱与悬浮水晶日轮
    const standGeo = new THREE.CylinderGeometry(0.5, 0.8, 1.4, 12);
    const standMat = new THREE.MeshStandardMaterial({ color: 0x576574, roughness: 0.7 });
    const standMesh = new THREE.Mesh(standGeo, standMat);
    standMesh.position.y = 1.2;
    this.altarGroup.add(standMesh);

    // 悬浮日轮水晶球
    const orbGeo = new THREE.IcosahedronGeometry(0.7, 1);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0xffd32a,
      emissive: 0xff9f1a,
      emissiveIntensity: 0.8,
      roughness: 0.2
    });
    this.altarOrb = new THREE.Mesh(orbGeo, orbMat);
    this.altarOrb.position.y = 2.4;
    this.altarGroup.add(this.altarOrb);

    // 日轮金芒点光源
    this.altarLight = new THREE.PointLight(0xffd32a, 3.0, 10.0);
    this.altarLight.position.y = 2.5;
    this.altarGroup.add(this.altarLight);

    this.group.add(this.altarGroup);

    // 中殿地面发光九宫格图腾阵列 (位于 Z = -5)
    this.matrixGroup = new THREE.Group();
    this.matrixGroup.position.set(0, 0.05, -5.5);
    const cellGeo = new THREE.BoxGeometry(1.6, 0.1, 1.6);
    const cellMat = new THREE.MeshStandardMaterial({
      color: 0x222f3e,
      emissive: 0xffd32a,
      emissiveIntensity: 0.25,
      roughness: 0.6
    });

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cell = new THREE.Mesh(cellGeo, cellMat.clone());
        cell.position.set((c - 1) * 2.2, 0, (r - 1) * 2.2);
        cell.receiveShadow = true;
        this.matrixGroup.add(cell);
      }
    }
    this.group.add(this.matrixGroup);
  }

  // 5. 内殿玄铁石门、波塞冬黄金王座与远古宝藏箱
  initInnerSanctumAndVault() {
    // 玄铁石门阻隔墙 (分隔中殿与后殿密室)
    const partitionGeo = new THREE.BoxGeometry(12, 10, 1.2);
    const partitionMat = new THREE.MeshStandardMaterial({ color: 0x2f3640, roughness: 0.9 });
    const partLeft = new THREE.Mesh(partitionGeo, partitionMat);
    partLeft.position.set(-10, 5, -13);
    partLeft.userData.movementBox = true;
    this.group.add(partLeft);

    const partRight = new THREE.Mesh(partitionGeo, partitionMat);
    partRight.position.set(10, 5, -13);
    partRight.userData.movementBox = true;
    this.group.add(partRight);

    // 中间可升降滑动的玄铁青铜大门 (宽 8m, 高 6.5m)
    const doorGeo = new THREE.BoxGeometry(8, 6.5, 0.8);
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x1e272e,
      roughness: 0.6,
      metalness: 0.65,
      emissive: 0x10ac84,
      emissiveIntensity: 0.15
    });
    this.innerDoorMesh = new THREE.Mesh(doorGeo, doorMat);
    this.innerDoorMesh.position.set(0, 3.25, -13);
    this.innerDoorMesh.userData.movementBox = true;
    this.group.add(this.innerDoorMesh);

    // 后殿波塞冬黄金王座与台阶 (位于 Z = -22)
    this.vaultGroup = new THREE.Group();
    this.vaultGroup.position.copy(this.vaultPos);

    // 三层纯金符文基台
    const daisGeo1 = new THREE.BoxGeometry(7, 0.4, 6);
    const daisGeo2 = new THREE.BoxGeometry(5.5, 0.4, 4.8);
    const daisGeo3 = new THREE.BoxGeometry(4.0, 0.4, 3.6);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd32a,
      roughness: 0.35,
      metalness: 0.85,
      emissive: 0xff9f1a,
      emissiveIntensity: 0.25
    });

    const dais1 = new THREE.Mesh(daisGeo1, goldMat); dais1.position.y = 0.2;
    const dais2 = new THREE.Mesh(daisGeo2, goldMat); dais2.position.y = 0.6;
    const dais3 = new THREE.Mesh(daisGeo3, goldMat); dais3.position.y = 1.0;
    this.vaultGroup.add(dais1, dais2, dais3);

    // 宝座靠背与神兽雕饰
    const backGeo = new THREE.BoxGeometry(3.2, 3.8, 0.6);
    const backMesh = new THREE.Mesh(backGeo, goldMat);
    backMesh.position.set(0, 3.1, -1.2);
    this.vaultGroup.add(backMesh);

    // 黄金波塞冬神宝箱
    const chestGeo = new THREE.BoxGeometry(1.6, 1.1, 1.2);
    const chestMat = new THREE.MeshStandardMaterial({
      color: 0xfffa65,
      roughness: 0.2,
      metalness: 0.9,
      emissive: 0xffd32a,
      emissiveIntensity: 0.6
    });
    this.chestMesh = new THREE.Mesh(chestGeo, chestMat);
    this.chestMesh.position.set(0, 1.75, 0.2);
    this.vaultGroup.add(this.chestMesh);

    // 宝箱辉光
    this.vaultGlow = new THREE.PointLight(0xffd32a, 3.5, 12);
    this.vaultGlow.position.set(0, 2.5, 0.5);
    this.vaultGroup.add(this.vaultGlow);

    this.group.add(this.vaultGroup);
  }

  // 升起内殿玄铁大门
  openInnerGate() {
    this.isInnerGateOpen = true;
    if (this.innerDoorMesh) {
      this.innerDoorMesh.position.y = 9.5; // 升起至门框上方洞口
      this.innerDoorMesh.userData.movementBox = false; // 解除阻挡
    }
    soundEngine.playTreeShake(); // 巨石沉重升腾声
    haptics.heavy();
  }

  // 显隐控制
  setVisible(visible) {
    this.group.visible = visible;
  }

  // 每一帧轻微呼吸动画与旋转
  update(delta) {
    if (!this.group.visible) return;

    // 入口光环旋转
    if (this.portalRing) {
      this.portalRing.rotation.z += delta * 1.2;
    }

    // 日轮微弱浮动旋转
    if (this.altarOrb) {
      this.altarOrb.rotation.y += delta * 0.9;
      this.altarOrb.rotation.x += delta * 0.4;
      this.altarOrb.position.y = 2.4 + Math.sin(Date.now() * 0.003) * 0.15;
    }

    // 宝箱金芒微光脉动
    if (this.vaultGlow) {
      this.vaultGlow.intensity = 3.0 + Math.sin(Date.now() * 0.004) * 0.8;
    }
  }

  // 序列化
  serialize() {
    return {
      isInnerGateOpen: this.isInnerGateOpen,
      vaultClaimed: this.vaultClaimed
    };
  }

  // 反序列化
  deserialize(data) {
    if (!data) return;
    if (typeof data.isInnerGateOpen === 'boolean' && data.isInnerGateOpen) {
      this.openInnerGate();
    }
    if (typeof data.vaultClaimed === 'boolean') {
      this.vaultClaimed = data.vaultClaimed;
    }
  }
}
