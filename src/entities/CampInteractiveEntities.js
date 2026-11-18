// CastawaySOL - 营地 3D 场景交互实体系统 (Camp Interactive Entities)
// 将“经营排班”、“商业特权空投”、“净水滴滤台”、“打捞浮标缆线”全部具象化为 3D 场景实体
// 玩家在海岛上自由漫步时，走到实体前按下【E】或点击情境动作大胶囊即可无缝互动
import * as THREE from 'three';
import { ISLAND_LAYOUT } from '../core/IslandLayout.js';

export class CampInteractiveEntities {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'camp-interactive-entities';
    this.scene.add(this.group);

    // 动画计时器
    this.animTime = 0;

    // 1. 实体坐标配置
    this.anchors = {
      // 营地经营与岗位排班告示牌 (位于西侧木箱与帐篷之间)
      noticeboard: new THREE.Vector3(...ISLAND_LAYOUT.noticeboard),
      // 商业化特权与救援空投无线电终端 (位于营火东侧木料旁，带微光天线)
      radioTerminal: new THREE.Vector3(...ISLAND_LAYOUT.radioTerminal),
      // 营地原生多孔火山石净水滴滤台 (位于营火南侧溪流旁)
      waterPurifier: new THREE.Vector3(...ISLAND_LAYOUT.waterPurifier),
      // 营地日常交付订单板 (位于告示牌右侧)
      orderBoard: new THREE.Vector3(...ISLAND_LAYOUT.orderBoard),
      // 南岸沙滩自动打捞浮标岸边滑轮锚桩 (南岸与出航湾交汇处)
      buoyWinch: new THREE.Vector3(-20.2, 0.02, 33.2)
    };

    this.initEntities();
  }

  initEntities() {
    this.createNoticeboard();
    this.createOrderBoard();
    this.createRadioTerminal();
    this.createWaterPurifier();
    this.createBuoyWinch();
  }

  // 1. 营地经营与居民排班告示牌 (Noticeboard)
  createNoticeboard() {
    const boardGroup = new THREE.Group();
    boardGroup.userData.interactionId = 'noticeboard';
    boardGroup.position.copy(this.anchors.noticeboard);
    boardGroup.rotation.y = -0.35; // 朝向营地中心营火

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x6e4a2e,
      roughness: 0.85
    });

    // 双原木立柱
    const postGeo = new THREE.CylinderGeometry(0.06, 0.07, 1.4, 8);
    const postL = new THREE.Mesh(postGeo, woodMat);
    postL.position.set(-0.45, 0.7, 0);
    postL.castShadow = true;
    boardGroup.add(postL);

    const postR = new THREE.Mesh(postGeo, woodMat);
    postR.position.set(0.45, 0.7, 0);
    postR.castShadow = true;
    boardGroup.add(postR);

    // 倾斜羊皮纸告示板本体
    const boardGeo = new THREE.BoxGeometry(1.05, 0.75, 0.06);
    const board = new THREE.Mesh(boardGeo, woodMat);
    board.position.set(0, 0.95, 0.02);
    board.castShadow = true;
    boardGroup.add(board);

    // 羊皮纸面
    const paperMat = new THREE.MeshStandardMaterial({
      color: 0xf3e5ab,
      roughness: 0.9
    });
    const paperGeo = new THREE.PlaneGeometry(0.92, 0.62);
    const paper = new THREE.Mesh(paperGeo, paperMat);
    paper.position.set(0, 0.95, 0.055);
    boardGroup.add(paper);

    // 顶部小挂顶
    const roofGeo = new THREE.BoxGeometry(1.2, 0.06, 0.22);
    const roof = new THREE.Mesh(roofGeo, woodMat);
    roof.position.set(0, 1.35, 0.05);
    boardGroup.add(roof);

    // 暖色提示小提灯
    const lampGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xffd32a,
      emissive: 0xffa801,
      emissiveIntensity: 0.8
    });
    this.boardLamp = new THREE.Mesh(lampGeo, lampMat);
    this.boardLamp.position.set(0, 1.25, 0.14);
    boardGroup.add(this.boardLamp);

    // 微型暖光点光源
    const lampLight = new THREE.PointLight(0xffa801, 1.2, 3.5);
    lampLight.position.set(0, 1.2, 0.15);
    boardGroup.add(lampLight);

    // 营地经营专属 3D 悬浮标识 (青翠翡翠多面晶体)
    const badgeGeo = new THREE.OctahedronGeometry(0.14, 0);
    const badgeMat = new THREE.MeshStandardMaterial({
      color: 0x00cec9,
      emissive: 0x00b894,
      emissiveIntensity: 0.85,
      metalness: 0.3,
      roughness: 0.2
    });
    this.boardBadge = new THREE.Mesh(badgeGeo, badgeMat);
    this.boardBadge.position.set(0, 1.62, 0.05);
    boardGroup.add(this.boardBadge);

    this.group.add(boardGroup);
  }

  // 1.5 营地日常交付订单板 (Order Board)
  createOrderBoard() {
    const orderGroup = new THREE.Group();
    orderGroup.userData.interactionId = 'orderBoard';
    orderGroup.position.copy(this.anchors.orderBoard);
    orderGroup.rotation.y = -0.15;

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x543d2b,
      roughness: 0.88
    });

    // 粗原木单立桩与斜撑
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.09, 1.5, 8);
    const pole = new THREE.Mesh(poleGeo, woodMat);
    pole.position.set(0, 0.75, 0);
    pole.castShadow = true;
    orderGroup.add(pole);

    // 宽幅交付订单告示木板
    const boardGeo = new THREE.BoxGeometry(1.2, 0.8, 0.07);
    const board = new THREE.Mesh(boardGeo, woodMat);
    board.position.set(0, 1.1, 0.05);
    board.castShadow = true;
    orderGroup.add(board);

    // 羊皮纸订单条 (3 份并排羊皮纸)
    const paperMat = new THREE.MeshStandardMaterial({
      color: 0xfbf1c7,
      roughness: 0.92
    });
    for (let i = 0; i < 3; i++) {
      const pGeo = new THREE.PlaneGeometry(0.32, 0.6);
      const p = new THREE.Mesh(pGeo, paperMat);
      p.position.set(-0.36 + i * 0.36, 1.1, 0.09);
      orderGroup.add(p);
    }

    // 顶部小顶棚
    const roofGeo = new THREE.BoxGeometry(1.35, 0.06, 0.25);
    const roof = new THREE.Mesh(roofGeo, woodMat);
    roof.position.set(0, 1.54, 0.08);
    orderGroup.add(roof);

    // 金色卷轴悬浮标识
    const badgeGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.28, 8);
    const badgeMat = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      emissive: 0xd35400,
      emissiveIntensity: 0.75
    });
    this.orderBadge = new THREE.Mesh(badgeGeo, badgeMat);
    this.orderBadge.rotation.z = Math.PI / 2;
    this.orderBadge.position.set(0, 1.78, 0.08);
    orderGroup.add(this.orderBadge);

    this.group.add(orderGroup);
  }

  // 2. 救援空投与商业化特权无线电站 (Radio Terminal)
  createRadioTerminal() {
    const radioGroup = new THREE.Group();
    radioGroup.userData.interactionId = 'radioTerminal';
    radioGroup.position.copy(this.anchors.radioTerminal);
    radioGroup.rotation.y = 0.4;

    // 原木垫箱底座
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x4b382a, roughness: 0.8 });
    const baseGeo = new THREE.BoxGeometry(0.8, 0.35, 0.7);
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.175;
    base.castShadow = true;
    radioGroup.add(base);

    // 军工级防水金属通讯电台机身
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x2f3640,
      metalness: 0.7,
      roughness: 0.35
    });
    const bodyGeo = new THREE.BoxGeometry(0.55, 0.38, 0.45);
    const body = new THREE.Mesh(bodyGeo, metalMat);
    body.position.set(0, 0.54, 0);
    body.castShadow = true;
    radioGroup.add(body);

    // 调频旋钮与面板仪表
    const knobMat = new THREE.MeshStandardMaterial({ color: 0xdcdde1, metalness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const knobGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.04, 8);
      const knob = new THREE.Mesh(knobGeo, knobMat);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(-0.16 + i * 0.16, 0.52, 0.23);
      radioGroup.add(knob);
    }

    // 修长通信鞭状天线
    const antGeo = new THREE.CylinderGeometry(0.015, 0.02, 1.2, 8);
    const ant = new THREE.Mesh(antGeo, knobMat);
    ant.position.set(0.18, 1.25, -0.1);
    ant.rotation.z = -0.08;
    ant.castShadow = true;
    radioGroup.add(ant);

    // 顶部全息脉冲信号灯 (呼应 Solana 极光青绿配色 0x14F195)
    const bulbGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0x14f195,
      emissive: 0x14f195,
      emissiveIntensity: 0.9
    });
    this.radioBulb = new THREE.Mesh(bulbGeo, bulbMat);
    this.radioBulb.position.set(0.23, 1.85, -0.1);
    radioGroup.add(this.radioBulb);

    // 补给特权专属 3D 悬浮标识 (Solana 紫晶光芒晶体)
    const radioBadgeGeo = new THREE.DodecahedronGeometry(0.14, 0);
    const radioBadgeMat = new THREE.MeshStandardMaterial({
      color: 0x9945ff,
      emissive: 0x9945ff,
      emissiveIntensity: 0.85,
      metalness: 0.4,
      roughness: 0.15
    });
    this.radioBadge = new THREE.Mesh(radioBadgeGeo, radioBadgeMat);
    this.radioBadge.position.set(0, 1.25, 0);
    radioGroup.add(this.radioBadge);

    // 地面全息扫描光环
    const ringGeo = new THREE.RingGeometry(0.48, 0.65, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x9945ff,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    this.radioRing = new THREE.Mesh(ringGeo, ringMat);
    this.radioRing.position.y = 0.02;
    radioGroup.add(this.radioRing);

    this.group.add(radioGroup);
  }

  // 3. 原生多孔火山石与竹节净水滴滤台 (Water Purifier)
  createWaterPurifier() {
    const purifierGroup = new THREE.Group();
    purifierGroup.userData.interactionId = 'waterPurifier';
    purifierGroup.position.copy(this.anchors.waterPurifier);
    purifierGroup.rotation.y = 0.1;

    // 底座接水木桶
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x574b3a, roughness: 0.75 });
    const barrelGeo = new THREE.CylinderGeometry(0.35, 0.38, 0.55, 12);
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.y = 0.275;
    barrel.castShadow = true;
    purifierGroup.add(barrel);

    // 桶内纯净水面
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x00cec9,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85
    });
    const waterGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.02, 12);
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = 0.52;
    purifierGroup.add(water);

    // 三脚原木滤架
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3d2d1d, roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const legGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.45, 6);
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(Math.cos(angle) * 0.42, 0.75, Math.sin(angle) * 0.42);
      leg.rotation.x = Math.sin(angle) * 0.15;
      leg.rotation.z = -Math.cos(angle) * 0.15;
      leg.castShadow = true;
      purifierGroup.add(leg);
    }

    // 多孔火山石与竹炭过滤漏斗
    const funnelMat = new THREE.MeshStandardMaterial({
      color: 0x636e72,
      roughness: 0.8
    });
    const funnelGeo = new THREE.ConeGeometry(0.32, 0.45, 12);
    const funnel = new THREE.Mesh(funnelGeo, funnelMat);
    funnel.position.y = 1.05;
    funnel.rotation.x = Math.PI; // 漏斗倒悬
    funnel.castShadow = true;
    purifierGroup.add(funnel);

    // 晶莹凝结水滴粒子
    const dropGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const dropMat = new THREE.MeshBasicMaterial({ color: 0x74b9ff });
    this.waterDrop = new THREE.Mesh(dropGeo, dropMat);
    this.waterDrop.position.set(0, 0.78, 0);
    purifierGroup.add(this.waterDrop);

    this.group.add(purifierGroup);
  }

  // 4. 南岸自动打捞浮标岸边滑轮锚桩 (Buoy Winch & Pulley)
  createBuoyWinch() {
    const winchGroup = new THREE.Group();
    winchGroup.userData.interactionId = 'buoyWinch';
    winchGroup.position.copy(this.anchors.buoyWinch);
    winchGroup.rotation.y = -0.6;

    // 斜打入沙滩的坚固锚木桩
    const stakeMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
    const stakeGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.1, 8);
    const stake = new THREE.Mesh(stakeGeo, stakeMat);
    stake.position.y = 0.48;
    stake.rotation.z = 0.22;
    stake.castShadow = true;
    winchGroup.add(stake);

    // 铸铁索道滑轮
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x2d3436, metalness: 0.8, roughness: 0.4 });
    const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12);
    const wheel = new THREE.Mesh(wheelGeo, ironMat);
    wheel.position.set(0.08, 0.85, 0);
    wheel.rotation.z = Math.PI / 2;
    winchGroup.add(wheel);

    // 麻绳与钢缆盘线
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xdfe6e9, roughness: 0.85 });
    const ropeGeo = new THREE.TorusGeometry(0.14, 0.04, 6, 12);
    const rope = new THREE.Mesh(ropeGeo, ropeMat);
    rope.position.set(0.08, 0.85, 0);
    rope.rotation.y = Math.PI / 2;
    winchGroup.add(rope);

    // 锚桩警示指示灯
    const winchLampGeo = new THREE.SphereGeometry(0.065, 8, 8);
    const winchLampMat = new THREE.MeshStandardMaterial({
      color: 0xff7675,
      emissive: 0xff7675,
      emissiveIntensity: 0.8
    });
    this.winchLamp = new THREE.Mesh(winchLampGeo, winchLampMat);
    this.winchLamp.position.set(0.1, 1.08, 0);
    winchGroup.add(this.winchLamp);

    this.group.add(winchGroup);
  }

  // 帧更新微动画 (呼吸灯、水滴冷凝滴落与天线脉冲)
  update(delta) {
    this.animTime += delta;

    // 1. 告示牌小提灯微光呼吸与悬浮翡翠徽标自转
    if (this.boardLamp) {
      this.boardLamp.material.emissiveIntensity = 0.65 + Math.sin(this.animTime * 3.0) * 0.25;
    }
    if (this.boardBadge) {
      this.boardBadge.rotation.y += delta * 1.5;
      this.boardBadge.rotation.x += delta * 0.8;
      this.boardBadge.position.y = 1.62 + Math.sin(this.animTime * 2.8) * 0.06;
    }

    // 1.5 订单板卷轴标识自转与浮沉
    if (this.orderBadge) {
      this.orderBadge.rotation.y += delta * 2.0;
      this.orderBadge.position.y = 1.78 + Math.sin(this.animTime * 3.5) * 0.05;
    }

    // 2. 无线电站天线信标呼吸、特权紫晶悬浮与全息光圈旋转
    if (this.radioBulb) {
      this.radioBulb.material.emissiveIntensity = 0.5 + Math.sin(this.animTime * 5.0) * 0.45;
    }
    if (this.radioBadge) {
      this.radioBadge.rotation.y -= delta * 1.8;
      this.radioBadge.rotation.z += delta * 1.0;
      this.radioBadge.position.y = 1.25 + Math.sin(this.animTime * 3.2) * 0.08;
    }
    if (this.radioRing) {
      this.radioRing.rotation.z += delta * 0.8;
      const s = 1.0 + Math.sin(this.animTime * 2.5) * 0.08;
      this.radioRing.scale.set(s, s, 1.0);
    }

    // 3. 净水滴滤台水滴循环下落
    if (this.waterDrop) {
      const dropY = 0.82 - ((this.animTime * 0.85) % 1.0) * 0.28;
      this.waterDrop.position.y = dropY;
    }

    // 4. 打捞滑轮警示灯
    if (this.winchLamp) {
      this.winchLamp.material.emissiveIntensity = 0.4 + Math.sin(this.animTime * 4.0) * 0.4;
    }
  }

  // 显隐控制
  setVisible(visible) {
    this.group.visible = visible;
  }
}
