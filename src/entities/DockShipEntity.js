// CastawaySOL - 西南码头 3D 船坞工程台与多阶段船体实体 (Dock Shipyard & Dynamic Vessel Entity)
// 统一管理：3D船坞起重滑道、悬浮旋转船舵徽章、T1/T2/T3 程序化船体网格平滑置换与海浪浮动动画
import * as THREE from 'three';
import { ISLAND_LAYOUT, distanceXZ } from '../core/IslandLayout.js';

export class DockShipEntity {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;

    this.group = new THREE.Group();
    this.group.name = 'DockShipyardGroup';

    // 船体停靠锚点与船坞滑道锚点
    this.shipAnchor = new THREE.Vector3(...ISLAND_LAYOUT.raft); // [-24, 0.05, 40]
    this.slipwayAnchor = new THREE.Vector3(-21.5, 0.05, 37.0); // 靠岸船坞滑道工程台

    // 船体模型子 Group
    this.vesselGroup = new THREE.Group();
    this.vesselGroup.position.copy(this.shipAnchor);
    this.group.add(this.vesselGroup);

    // 船坞工程台子 Group
    this.slipwayGroup = new THREE.Group();
    this.slipwayGroup.position.copy(this.slipwayAnchor);
    this.group.add(this.slipwayGroup);

    this.beaconMesh = null;
    this.badgeLight = null;
    this.lanternLight = null;

    this.initShipyardSlipway();
    this.initVesselModel(1);

    this.scene.add(this.group);
  }

  // 构建岸边造船滑道、起重龙门架与悬浮船舵工程台
  initShipyardSlipway() {
    // 1. 斜向入水木质滑道轨木 (2根厚木轨)
    const railMat = new THREE.MeshStandardMaterial({ color: 0x4a2e16, roughness: 0.85 });
    for (let offset = -0.9; offset <= 0.9; offset += 1.8) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 5.0), railMat);
      rail.position.set(offset, 0.1, 1.2);
      rail.rotation.x = 0.08; // 微微倾斜滑入浅滩
      rail.castShadow = true;
      rail.receiveShadow = true;
      this.slipwayGroup.add(rail);
    }

    // 滑道横向垫木
    for (let z = -0.8; z <= 3.2; z += 1.0) {
      const tie = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.2, 0.3), railMat);
      tie.position.set(0, 0.08, z);
      this.slipwayGroup.add(tie);
    }

    // 2. 龙门起重木架与滑轮组
    const timberMat = new THREE.MeshStandardMaterial({ color: 0x613d1c, roughness: 0.8 });
    // 两侧立柱
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.8, 8), timberMat);
    postL.position.set(-1.4, 1.9, -0.6);
    postL.castShadow = true;
    this.slipwayGroup.add(postL);

    const postR = postL.clone();
    postR.position.set(1.4, 1.9, -0.6);
    this.slipwayGroup.add(postR);

    // 顶部斜向支撑架
    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 0.35), timberMat);
    crossBeam.position.set(0, 3.7, -0.6);
    crossBeam.castShadow = true;
    this.slipwayGroup.add(crossBeam);

    // 吊索与滑轮
    const ropeMat = new THREE.MeshBasicMaterial({ color: 0x2d3436 });
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 4), ropeMat);
    rope.position.set(0, 2.9, -0.6);
    this.slipwayGroup.add(rope);

    const hookMat = new THREE.MeshStandardMaterial({ color: 0x636e72, metalness: 0.9, roughness: 0.3 });
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 16), hookMat);
    hook.position.set(0, 2.1, -0.6);
    this.slipwayGroup.add(hook);

    // 3. 造船木工箱台
    const workbenchMat = new THREE.MeshStandardMaterial({ color: 0x8c5828, roughness: 0.7 });
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.75, 0.7), workbenchMat);
    bench.position.set(1.8, 0.38, 0.5);
    bench.castShadow = true;
    this.slipwayGroup.add(bench);

    // 台面上放置木槌与铁锯图纸
    const blueprintMat = new THREE.MeshStandardMaterial({ color: 0x0984e3, roughness: 0.4 });
    const blueprint = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.45), blueprintMat);
    blueprint.rotation.x = -Math.PI / 2;
    blueprint.position.set(1.8, 0.76, 0.5);
    this.slipwayGroup.add(blueprint);

    // 4. 悬浮自转的船坞徽章 (金蓝航海锚舵)
    const badgeGroup = new THREE.Group();
    badgeGroup.position.set(0, 4.5, -0.6);

    const anchorMat = new THREE.MeshStandardMaterial({
      color: 0x00cec9,
      emissive: 0x00cec9,
      emissiveIntensity: 0.5,
      metalness: 0.85,
      roughness: 0.2
    });
    // 外圆环
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.06, 8, 24), anchorMat);
    badgeGroup.add(ring);

    // 核心十字锚杆
    const anchorBarV = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 8), anchorMat);
    badgeGroup.add(anchorBarV);
    const anchorBarH = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 8), anchorMat);
    anchorBarH.rotation.z = Math.PI / 2;
    anchorBarH.position.y = 0.15;
    badgeGroup.add(anchorBarH);

    // 蓝金点光源
    const badgeLight = new THREE.PointLight(0x00cec9, 1.2, 5.0);
    badgeLight.position.set(0, 0, 0);
    badgeLight.visible = false;
    badgeGroup.add(badgeLight);
    this.badgeLight = badgeLight;

    this.beaconMesh = badgeGroup;
    this.slipwayGroup.add(badgeGroup);
  }

  // 动态构建或切换指定等级的 3D 船体网格
  initVesselModel(tierLevel = 1) {
    // 清理旧船模
    while (this.vesselGroup.children.length > 0) {
      const child = this.vesselGroup.children[0];
      this.vesselGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    if (tierLevel === 1) {
      this.buildTier1Raft();
    } else if (tierLevel === 2) {
      this.buildTier2Sailboat();
    } else {
      this.buildTier3Ironclad();
    }
  }

  // ----------------------------------------------------
  // Level 1: 简易捆扎原木筏
  // ----------------------------------------------------
  buildTier1Raft() {
    const logMat = new THREE.MeshStandardMaterial({ color: 0x5c3818, roughness: 0.8 });

    // 4 根并排粗壮圆木
    for (let i = -1.5; i <= 1.5; i += 1.0) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 4.2, 8), logMat);
      log.rotation.x = Math.PI / 2;
      log.position.set(i * 0.62, 0.2, 0);
      log.castShadow = true;
      this.vesselGroup.add(log);
    }

    // 2 根横木加固
    const crossMat = new THREE.MeshStandardMaterial({ color: 0x462912, roughness: 0.9 });
    for (const z of [-1.2, 1.2]) {
      const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.7, 8), crossMat);
      cross.rotation.z = Math.PI / 2;
      cross.position.set(0, 0.46, z);
      this.vesselGroup.add(cross);
    }

    // 单桅杆与简易三角白帆
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 8), crossMat);
    mast.position.set(0, 1.7, 0);
    mast.castShadow = true;
    this.vesselGroup.add(mast);

    const sailMat = new THREE.MeshStandardMaterial({
      color: 0xf5f6fa,
      side: THREE.DoubleSide,
      roughness: 0.65
    });
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.1), sailMat);
    sail.position.set(0.9, 2.1, 0);
    sail.rotation.y = 0.15;
    this.vesselGroup.add(sail);
  }

  // ----------------------------------------------------
  // Level 2: 加固龙骨风帆快艇 (木质船壳、大帆、随船货运箱)
  // ----------------------------------------------------
  buildTier2Sailboat() {
    const hullWoodMat = new THREE.MeshStandardMaterial({ color: 0x835129, roughness: 0.65 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x4a2e16, roughness: 0.8 });

    // 1. 弧形流线木质船壳底板
    const hullBottom = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 5.2), hullWoodMat);
    hullBottom.position.set(0, 0.28, 0);
    hullBottom.castShadow = true;
    this.vesselGroup.add(hullBottom);

    // 2. 船艏尖锐冲角 (向上翘起三角形)
    const bowProw = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 1.2, 1.8, 4), darkWoodMat);
    bowProw.rotation.z = Math.PI / 2;
    bowProw.rotation.y = -Math.PI / 4;
    bowProw.position.set(0, 0.55, -3.1);
    this.vesselGroup.add(bowProw);

    // 3. 两侧上扬防浪板与甲板护栏
    for (const x of [-1.25, 1.25]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 5.4), darkWoodMat);
      rail.position.set(x, 0.65, 0);
      rail.castShadow = true;
      this.vesselGroup.add(rail);

      // 防浪侧翼浮筒
      const pontoon = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.4, 8), hullWoodMat);
      pontoon.rotation.x = Math.PI / 2;
      pontoon.position.set(x * 1.35, 0.18, 0);
      this.vesselGroup.add(pontoon);
    }

    // 4. 甲板主桅杆与大风帆 (带蓝色彩条)
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 4.2, 8), darkWoodMat);
    mast.position.set(0, 2.2, -0.4);
    mast.castShadow = true;
    this.vesselGroup.add(mast);

    const sailMat = new THREE.MeshStandardMaterial({
      color: 0x00cec9, // 碧海蓝纵帆
      side: THREE.DoubleSide,
      roughness: 0.4
    });
    const mainSail = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.8), sailMat);
    mainSail.position.set(0, 2.6, -0.4);
    mainSail.rotation.y = 0.2;
    this.vesselGroup.add(mainSail);

    // 5. 船尾随船货运木箱 (4 格防潮箱视觉)
    const cargoChestMat = new THREE.MeshStandardMaterial({ color: 0x9b59b6, roughness: 0.5 }); // 紫色高阶箱
    const cargoChest = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.65, 1.1), cargoChestMat);
    cargoChest.position.set(0, 0.72, 1.6);
    cargoChest.castShadow = true;
    this.vesselGroup.add(cargoChest);

    // 船尾铁质方向舵柄
    const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.5), darkWoodMat);
    rudder.position.set(0, 0.4, 2.7);
    this.vesselGroup.add(rudder);
  }

  // ----------------------------------------------------
  // Level 3: 铁甲远洋双桅探索舰 (全铁甲防撞装甲、双桅大帆、船头铜灯)
  // ----------------------------------------------------
  buildTier3Ironclad() {
    const armorMetalMat = new THREE.MeshStandardMaterial({
      color: 0x2f3640,
      metalness: 0.85,
      roughness: 0.25
    });
    const brassTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      metalness: 0.9,
      roughness: 0.2
    });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x715842, roughness: 0.7 });

    // 1. 加长加宽铁甲主舰体 (6.4 x 3.0 米)
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.7, 6.4), armorMetalMat);
    hull.position.set(0, 0.45, 0);
    hull.castShadow = true;
    this.vesselGroup.add(hull);

    // 木纹甲板铺面
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.1, 5.8), deckMat);
    deck.position.set(0, 0.82, 0);
    this.vesselGroup.add(deck);

    // 2. 船头精钢防撞冲角 (破冰刺角)
    const ramProw = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.2, 6), armorMetalMat);
    ramProw.rotation.x = -Math.PI / 2;
    ramProw.position.set(0, 0.55, -3.8);
    this.vesselGroup.add(ramProw);

    // 3. 黄铜镶边甲板重装甲防浪胸墙与柳钉
    for (const x of [-1.55, 1.55]) {
      const shieldWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.85, 6.4), armorMetalMat);
      shieldWall.position.set(x, 0.95, 0);
      this.vesselGroup.add(shieldWall);

      const brassRim = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 6.45), brassTrimMat);
      brassRim.position.set(x, 1.4, 0);
      this.vesselGroup.add(brassRim);
    }

    // 4. 双桅杆复合风帆 (主桅 + 前桅)
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.4 });
    const sailMat = new THREE.MeshStandardMaterial({
      color: 0xffdd59, // 黄金探索大帆
      side: THREE.DoubleSide,
      roughness: 0.3
    });

    // 主桅杆 (中心偏后)
    const mainMast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.2, 8), mastMat);
    mainMast.position.set(0, 2.8, 0.3);
    mainMast.castShadow = true;
    this.vesselGroup.add(mainMast);

    const mainSail = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.4), sailMat);
    mainSail.position.set(0, 3.2, 0.3);
    mainSail.rotation.y = 0.18;
    this.vesselGroup.add(mainSail);

    // 前桅杆 (前方)
    const foreMast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.0, 8), mastMat);
    foreMast.position.set(0, 2.2, -1.8);
    foreMast.castShadow = true;
    this.vesselGroup.add(foreMast);

    const foreSail = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), sailMat);
    foreSail.position.set(0, 2.5, -1.8);
    foreSail.rotation.y = 0.25;
    this.vesselGroup.add(foreSail);

    // 5. 船头防雾铜制探照大灯与点光源
    const lanternGroup = new THREE.Group();
    lanternGroup.position.set(0, 1.25, -3.2);

    const lanternMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.5, 8), brassTrimMat);
    lanternGroup.add(lanternMesh);

    this.lanternLight = new THREE.PointLight(0xfffa65, 2.2, 10.0);
    this.lanternLight.position.set(0, 0, -0.4);
    this.lanternLight.visible = false;
    lanternGroup.add(this.lanternLight);

    this.vesselGroup.add(lanternGroup);

    // 6. 船尾双层重型货运密封铁舱 (8 格仓容量视觉)
    const vaultMat = new THREE.MeshStandardMaterial({
      color: 0x3d3d3d,
      metalness: 0.9,
      roughness: 0.2
    });
    const cargoVault = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.8), vaultMat);
    cargoVault.position.set(0, 1.05, 1.9);
    cargoVault.castShadow = true;
    this.vesselGroup.add(cargoVault);

    // 船尾铁质起锚绞盘与拖网缆绳
    const winch = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8, 8), brassTrimMat);
    winch.rotation.z = Math.PI / 2;
    winch.position.set(0, 1.7, 1.9);
    this.vesselGroup.add(winch);
  }

  // 外部通知更新模型
  updateModel(tierLevel) {
    this.initVesselModel(tierLevel);
  }

  // 渲染帧更新：船坞徽章旋转与船体海水波浪浮动微摇曳
  update(time = 0) {
    // 船坞徽章旋转
    if (this.beaconMesh) {
      this.beaconMesh.rotation.y += 0.02;
      this.beaconMesh.position.y = 4.5 + Math.sin(time * 2.5) * 0.12;
    }

    // 船只随海水浮沉微动画 (横摇 + 纵摇 + 垂荡)
    if (this.vesselGroup) {
      this.vesselGroup.position.y = this.shipAnchor.y + Math.sin(time * 1.8) * 0.08;
      this.vesselGroup.rotation.z = Math.sin(time * 1.2) * 0.025; // 横摇
      this.vesselGroup.rotation.x = Math.cos(time * 1.5) * 0.02;  // 纵摇
    }

    // 探照灯光微呼吸
    if (this.lanternLight) {
      this.lanternLight.intensity = 2.0 + Math.sin(time * 4.0) * 0.3;
    }
  }

  // 检查玩家是否靠近船坞工程台或船只
  isNearShipyard(playerPos, radius = 4.5) {
    const distToSlipway = distanceXZ(playerPos, [this.slipwayAnchor.x, 0, this.slipwayAnchor.z]);
    const distToShip = distanceXZ(playerPos, [this.shipAnchor.x, 0, this.shipAnchor.z]);
    return distToSlipway < radius || distToShip < (radius + 0.5);
  }

  // 显隐控制 (跳岛时主岛模型隐藏)
  setVisible(visible) {
    this.group.visible = visible;
  }
}

// 距离动态剔除码头与船只点光源
DockShipEntity.prototype.updateLightsByDistance = function(playerPos) {
  if (!playerPos) {
    if (this.badgeLight) this.badgeLight.visible = false;
    if (this.lanternLight) this.lanternLight.visible = false;
    return;
  }
  // 码头滑道坐标: (-22.0, 0, 36.5)
  const dist = Math.hypot(playerPos.x - (-22.0), playerPos.z - 36.5);
  const isNearby = (dist < 18.0);
  if (this.badgeLight) this.badgeLight.visible = isNearby;
  if (this.lanternLight) this.lanternLight.visible = (isNearby && this.vesselGroup.visible);
};
