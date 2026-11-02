// CastawaySOL - 荒岛野兽生态与实时战斗打击系统 (Wildlife & Real-time Combat System)
// 包含：低多边形沙滩巨蟹与丛林野猪程序化模型、巡逻与警戒冲撞状态机、扇形长矛打击判定、伤害飘字与战利品掉落
import * as THREE from 'three';
import { soundEngine } from '../core/AudioSystem.js';
import { iconHTML } from '../ui/IconRegistry.js'; // 黏土图标集成（2026-10-31）
import { distanceXZ, ISLAND_LAYOUT } from '../core/IslandLayout.js';

// 伤害飘字画布生成工具
function createDamageSprite(text, color = '#ff4757') {
  if (typeof document === 'undefined') {
    return new THREE.Sprite();
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 36px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 6;
  ctx.strokeText(text, 64, 32);
  ctx.fillStyle = color;
  ctx.fillText(text, 64, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.4, 0.7, 1.0);
  return sprite;
}

export class WildlifeCombatSystem {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.group = new THREE.Group();
    this.group.name = 'WildlifeCombatGroup';
    this.scene.add(this.group);

    // 野兽实体列表
    this.wildlifeList = [];
    // 飘字实体列表
    this.damageTexts = [];
    // 战利品掉落包列表
    this.lootDrops = [];
    // 玩家受击屏幕红晕元素
    this.vignetteOverlay = null;

    // 攻击冷却与判定
    this.playerAttackCooldown = 0;
    this.isAttacking = false;
    // 战斗模式：'melee' (近战长矛/拳头) | 'ranged' (简易猎弓远程射击)
    this.combatMode = 'melee';
    // 飞行中的物理实体箭矢数组
    this.arrows = [];
    // 地表捕兽夹与营地防御工事
    this.traps = [];
    this.spikes = [];
    // 夜间袭营与伙伴警戒定时器
    this.nightRaidCooldown = 30.0;
    this.hasAlertedTonight = false;

    // 地形与地面碰撞采样缓存
    this.groundRay = new THREE.Raycaster();
    this.cachedWalkSurfaces = null;

    this.initVignette();
    this.spawnDefaultCreatures();
  }

  // 采样指定 X,Z 坐标下的真实地形地表高度，杜绝野兽浮空或陷入地下
  sampleFloorHeight(x, z, defaultY = 0) {
    if (!this.cachedWalkSurfaces || this.cachedWalkSurfaces.length === 0) {
      this.cachedWalkSurfaces = [];
      if (this.scene) {
        this.scene.traverse(object => {
          if (object.isMesh && object.userData && object.userData.walkSurface) {
            this.cachedWalkSurfaces.push(object);
          }
        });
      }
    }

    if (this.cachedWalkSurfaces && this.cachedWalkSurfaces.length > 0) {
      this.groundRay.set(new THREE.Vector3(x, 25, z), new THREE.Vector3(0, -1, 0));
      const intersects = this.groundRay.intersectObjects(this.cachedWalkSurfaces, false);
      if (intersects && intersects.length > 0) {
        return intersects[0].point.y;
      }
    }

    // 默认高程安全兜底 (高台/平地/沙滩平滑判定)
    if (x >= 10 && x <= 40 && z >= -32 && z <= -10) return 1.8; // 高台
    if (Math.hypot(x, z) > 36) return -0.15; // 沙滩
    return defaultY;
  }

  // 屏幕受击红晕遮罩 (采用电影级有机椭圆径向渐变，杜绝盒状硬边框阴影)
  initVignette() {
    if (typeof document === 'undefined') return;
    let overlay = document.getElementById('combat-damage-vignette');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'combat-damage-vignette';
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '888';
      overlay.style.background = 'radial-gradient(ellipse at center, rgba(255, 0, 0, 0) 55%, rgba(220, 20, 60, 0.28) 80%, rgba(180, 0, 0, 0.65) 100%)';
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.25s ease-out';
      document.body.appendChild(overlay);
    }
    this.vignetteOverlay = overlay;
  }

  // 触发玩家受击闪红屏幕特效
  flashPlayerHurt() {
    if (!this.vignetteOverlay) return;
    this.vignetteOverlay.style.opacity = '1';
    setTimeout(() => {
      if (this.vignetteOverlay) {
        this.vignetteOverlay.style.opacity = '0';
      }
    }, 280);
  }

  // 生成初始野兽集群 (沙滩巨蟹 + 丛林野猪)
  spawnDefaultCreatures() {
    // 1. 沙滩巨蟹 (主要游荡在退潮沙滩与礁石边缘)
    this.createCrab('crab_1', '沙滩坚甲巨蟹', [16, -0.15, 33]);
    this.createCrab('crab_2', '红螯大沙蟹', [-28, -0.15, 28]);
    this.createCrab('crab_3', '潮间带硬壳蟹', [-32, -0.15, 5]);

    // 2. 丛林野猪 (游荡在西部林区与内陆开阔林地，boar_3 部署在东北高台东侧林缘，避开北崖灯塔交互区)
    this.createBoar('boar_1', '丛林狂暴野猪', [-22, 0.0, -5]);
    this.createBoar('boar_2', '黑鬃尖牙野猪', [-14, 0.0, -16]);
    this.createBoar('boar_3', '斑纹剑齿小野猪', [34, 1.8, -16]);
  }

  // 构建低多边形沙滩巨蟹 3D 模型
  createCrab(id, name, spawnPos) {
    const crabGroup = new THREE.Group();
    const spawnY = this.sampleFloorHeight(spawnPos[0], spawnPos[2], spawnPos[1]);
    crabGroup.position.set(spawnPos[0], spawnY, spawnPos[2]);

    // 1. 坚硬主甲壳 (红橙色扁平球体)
    const shellGeo = new THREE.SphereGeometry(0.55, 10, 8);
    shellGeo.scale(1.2, 0.45, 0.85);
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xd63031, // 鲜亮红橙甲壳
      roughness: 0.6,
      metalness: 0.2,
      flatShading: true
    });
    const shellMesh = new THREE.Mesh(shellGeo, shellMat);
    shellMesh.position.y = 0.28;
    shellMesh.castShadow = true;
    crabGroup.add(shellMesh);

    // 2. 双眼柄与黑亮双眸
    const eyeStemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6);
    const eyeStemMat = new THREE.MeshStandardMaterial({ color: 0xd63031 });
    const eyePupilGeo = new THREE.SphereGeometry(0.07, 6, 6);
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const leftEyeGroup = new THREE.Group();
    leftEyeGroup.position.set(-0.22, 0.45, 0.38);
    const stemL = new THREE.Mesh(eyeStemGeo, eyeStemMat);
    stemL.rotation.x = 0.2;
    const pupilL = new THREE.Mesh(eyePupilGeo, eyePupilMat);
    pupilL.position.set(0, 0.12, 0.03);
    leftEyeGroup.add(stemL, pupilL);
    crabGroup.add(leftEyeGroup);

    const rightEyeGroup = new THREE.Group();
    rightEyeGroup.position.set(0.22, 0.45, 0.38);
    const stemR = new THREE.Mesh(eyeStemGeo, eyeStemMat);
    stemR.rotation.x = 0.2;
    const pupilR = new THREE.Mesh(eyePupilGeo, eyePupilMat);
    pupilR.position.set(0, 0.12, 0.03);
    rightEyeGroup.add(stemR, pupilR);
    crabGroup.add(rightEyeGroup);

    // 3. 左右威武大螯钳 (Claws)
    const clawArmGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.35, 6);
    const clawArmMat = new THREE.MeshStandardMaterial({ color: 0xe17055, flatShading: true });
    const pincerGeo = new THREE.ConeGeometry(0.16, 0.38, 5);
    const pincerMat = new THREE.MeshStandardMaterial({ color: 0xd63031, flatShading: true });

    // 左螯
    const clawLGroup = new THREE.Group();
    clawLGroup.position.set(-0.65, 0.25, 0.4);
    const clawArmL = new THREE.Mesh(clawArmGeo, clawArmMat);
    clawArmL.rotation.z = Math.PI / 3;
    const pincerL1 = new THREE.Mesh(pincerGeo, pincerMat);
    pincerL1.position.set(-0.15, 0.12, 0.12);
    pincerL1.rotation.set(-Math.PI / 4, 0, -Math.PI / 3);
    clawLGroup.add(clawArmL, pincerL1);
    crabGroup.add(clawLGroup);

    // 右螯
    const clawRGroup = new THREE.Group();
    clawRGroup.position.set(0.65, 0.25, 0.4);
    const clawArmR = new THREE.Mesh(clawArmGeo, clawArmMat);
    clawArmR.rotation.z = -Math.PI / 3;
    const pincerR1 = new THREE.Mesh(pincerGeo, pincerMat);
    pincerR1.position.set(0.15, 0.12, 0.12);
    pincerR1.rotation.set(-Math.PI / 4, 0, Math.PI / 3);
    clawRGroup.add(clawArmR, pincerR1);
    crabGroup.add(clawRGroup);

    // 4. 侧面爬行小步足 (6条)
    const legGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.4, 4);
    const legMat = new THREE.MeshStandardMaterial({ color: 0xe17055 });
    const legs = [];
    for (let i = 0; i < 3; i++) {
      // 左足
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(-0.6, 0.18, 0.15 - i * 0.22);
      legL.rotation.set(0, 0, Math.PI / 2.6);
      crabGroup.add(legL);
      legs.push(legL);
      // 右足
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.position.set(0.6, 0.18, 0.15 - i * 0.22);
      legR.rotation.set(0, 0, -Math.PI / 2.6);
      crabGroup.add(legR);
      legs.push(legR);
    }

    // 5. 头顶血条指示板
    const hpBar = this.createHealthBarMesh();
    hpBar.group.position.set(0, 0.85, 0);
    crabGroup.add(hpBar.group);

    this.group.add(crabGroup);

    const creature = {
      id,
      name,
      type: 'crab',
      group: crabGroup,
      shellMesh,
      clawL: clawLGroup,
      clawR: clawRGroup,
      legs,
      hpBar,
      maxHp: 65,
      hp: 65,
      attackDamage: 12,
      attackRange: 1.6,
      attackCooldownTimer: 0,
      attackCooldown: 1.8,
      speed: 2.8,
      alertRadius: 7.0,
      state: 'PATROL', // PATROL, ALERT, CHASE, ATTACK, STAGGER, DEAD, FLEE
      stateTimer: Math.random() * 3,
      patrolCenter: new THREE.Vector3(...spawnPos),
      patrolTarget: new THREE.Vector3(...spawnPos),
      staggerTimer: 0,
      animCycle: Math.random() * 10,
      isDead: false,
      loot: [
        { id: 'crab_meat', name: '新鲜红蟹肉', count: 2, chance: 1.0 },
        { id: 'crab_shell', name: '坚硬蟹壳', count: 1, chance: 0.85 }
      ]
    };

    this.wildlifeList.push(creature);
    return creature;
  }

  // 构建低多边形丛林狂暴野猪 3D 模型
  createBoar(id, name, spawnPos) {
    const boarGroup = new THREE.Group();
    const spawnY = this.sampleFloorHeight(spawnPos[0], spawnPos[2], spawnPos[1]);
    boarGroup.position.set(spawnPos[0], spawnY, spawnPos[2]);

    // 1. 强壮躯干 (深棕色倒角立方体)
    const bodyGeo = new THREE.BoxGeometry(0.75, 0.75, 1.25);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x4a2c16, // 深棕鬃毛
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.65;
    bodyMesh.castShadow = true;
    boarGroup.add(bodyMesh);

    // 2. 野性头部与长拱嘴
    const headGeo = new THREE.BoxGeometry(0.55, 0.55, 0.65);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x5a371c, flatShading: true });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.set(0, 0.72, 0.75);
    boarGroup.add(headMesh);

    const snoutGeo = new THREE.BoxGeometry(0.36, 0.32, 0.35);
    const snoutMat = new THREE.MeshStandardMaterial({ color: 0xd69a7c, flatShading: true });
    const snoutMesh = new THREE.Mesh(snoutGeo, snoutMat);
    snoutMesh.position.set(0, 0.62, 1.15);
    boarGroup.add(snoutMesh);

    // 3. 左右锋利白森森獠牙 (Tusks)
    const tuskGeo = new THREE.ConeGeometry(0.06, 0.32, 5);
    const tuskMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const tuskL = new THREE.Mesh(tuskGeo, tuskMat);
    tuskL.position.set(-0.25, 0.68, 1.05);
    tuskL.rotation.set(-0.6, 0, -0.4);
    boarGroup.add(tuskL);

    const tuskR = new THREE.Mesh(tuskGeo, tuskMat);
    tuskR.position.set(0.25, 0.68, 1.05);
    tuskR.rotation.set(-0.6, 0, 0.4);
    boarGroup.add(tuskR);

    // 4. 赤红愤怒凶睛
    const eyeGeo = new THREE.SphereGeometry(0.06, 5, 5);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.26, 0.85, 0.92);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.26, 0.85, 0.92);
    boarGroup.add(eyeL, eyeR);

    // 5. 健硕四肢
    const legGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.5, 6);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3d2310, flatShading: true });
    const legs = [];
    const legOffsets = [
      [-0.28, 0.25, 0.42],  // 前左
      [0.28, 0.25, 0.42],   // 前右
      [-0.28, 0.25, -0.42], // 后左
      [0.28, 0.25, -0.42]   // 后右
    ];
    legOffsets.forEach(pos => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(...pos);
      leg.castShadow = true;
      boarGroup.add(leg);
      legs.push(leg);
    });

    // 6. 微翘小尾巴
    const tailGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.22, 4);
    const tailMesh = new THREE.Mesh(tailGeo, legMat);
    tailMesh.position.set(0, 0.75, -0.68);
    tailMesh.rotation.x = -Math.PI / 3;
    boarGroup.add(tailMesh);

    // 7. 头顶血条指示板
    const hpBar = this.createHealthBarMesh();
    hpBar.group.position.set(0, 1.45, 0);
    boarGroup.add(hpBar.group);

    // 8. 冲撞突进危险警示矩形投影 (Telegraph Warning Mesh)
    const telegraphGeo = new THREE.PlaneGeometry(1.6, 7.0);
    telegraphGeo.rotateX(-Math.PI / 2);
    telegraphGeo.translate(0, 0.03, 3.5); // 向前延伸 7 米冲刺区域
    const telegraphMat = new THREE.MeshBasicMaterial({
      color: 0xff2222,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const telegraphMesh = new THREE.Mesh(telegraphGeo, telegraphMat);
    telegraphMesh.visible = false;
    boarGroup.add(telegraphMesh);

    // 9. 眩晕破绽旋转金星光环 (Stun Stars Ring)
    const stunGroup = new THREE.Group();
    stunGroup.position.set(0, 1.55, 0.2);
    const starGeo = new THREE.DodecahedronGeometry(0.08, 0);
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xffea00,
      emissive: 0xffaa00,
      emissiveIntensity: 0.6,
      roughness: 0.2
    });
    for (let i = 0; i < 3; i++) {
      const star = new THREE.Mesh(starGeo, starMat);
      const angle = (i / 3) * Math.PI * 2;
      star.position.set(Math.cos(angle) * 0.42, 0, Math.sin(angle) * 0.42);
      stunGroup.add(star);
    }
    stunGroup.visible = false;
    boarGroup.add(stunGroup);

    this.group.add(boarGroup);

    const creature = {
      id,
      name,
      type: 'boar',
      group: boarGroup,
      bodyMesh,
      legs,
      tailMesh,
      hpBar,
      telegraphMesh,
      stunGroup,
      maxHp: 95,
      hp: 95,
      attackDamage: 18,
      attackRange: 1.8,
      attackCooldownTimer: 0,
      attackCooldown: 2.2,
      chargeCooldownTimer: 3.0 + Math.random() * 2.0, // 初始冲撞就绪倒计时
      chargeCooldown: 6.5, // 冲锋技能间隔
      chargePrepareTimer: 0, // 蓄力预警倒计时 (1.0s)
      chargeDashTimer: 0, // 高速突刺倒计时 (1.1s)
      chargeDir: new THREE.Vector3(),
      chargeDistanceTraveled: 0,
      isStunned: false,
      stunTimer: 0,
      speed: 3.8,
      alertRadius: 8.5,
      state: 'PATROL',
      stateTimer: Math.random() * 3,
      patrolCenter: new THREE.Vector3(...spawnPos),
      patrolTarget: new THREE.Vector3(...spawnPos),
      staggerTimer: 0,
      animCycle: Math.random() * 10,
      isDead: false,
      loot: [
        { id: 'raw_meat', name: '新鲜兽肉排骨', count: 2, chance: 1.0 },
        { id: 'beast_hide', name: '野兽厚皮', count: 1, chance: 0.9 }
      ]
    };

    this.wildlifeList.push(creature);
    return creature;
  }

  // 实体头顶 3D 血条网格构建
  createHealthBarMesh() {
    const group = new THREE.Group();
    // 背景深灰底槽
    const bgGeo = new THREE.PlaneGeometry(0.9, 0.12);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    group.add(bgMesh);

    // 绿色/红色血条前景
    const fgGeo = new THREE.PlaneGeometry(0.86, 0.08);
    const fgMat = new THREE.MeshBasicMaterial({ color: 0x00b894, side: THREE.DoubleSide });
    const fgMesh = new THREE.Mesh(fgGeo, fgMat);
    fgMesh.position.z = 0.005;
    group.add(fgMesh);

    group.visible = false; // 默认满血巡逻时不显露，受到警觉或受击时显示

    return {
      group,
      fgMesh,
      update(currentHp, maxHp) {
        const pct = Math.max(0, Math.min(1.0, currentHp / maxHp));
        fgMesh.scale.x = pct;
        fgMesh.position.x = -(0.86 * (1 - pct)) / 2;
        if (pct < 0.35) {
          fgMat.color.setHex(0xd63031); // 濒死红
        } else if (pct < 0.65) {
          fgMat.color.setHex(0xfdcb6e); // 中等黄
        } else {
          fgMat.color.setHex(0x00b894); // 健康绿
        }
      }
    };
  }

  // 构建低多边形燧石羽箭 3D 实体
  createArrowMesh() {
    const arrowGroup = new THREE.Group();

    // 1. 箭杆 (轻韧细木圆柱，长 0.72m)
    const shaftGeo = new THREE.CylinderGeometry(0.012, 0.014, 0.72, 5);
    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0x8b5a2b, // 原木色
      roughness: 0.8,
      flatShading: true
    });
    const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
    arrowGroup.add(shaftMesh);

    // 2. 燧石锋刃箭头 (暗黑反光四棱锥，长 0.14m)
    const tipGeo = new THREE.ConeGeometry(0.038, 0.14, 4);
    tipGeo.scale(1.2, 1.0, 0.5); // 压扁双面刃
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0x222f3e,
      roughness: 0.25,
      metalness: 0.4,
      flatShading: true
    });
    const tipMesh = new THREE.Mesh(tipGeo, tipMat);
    tipMesh.position.y = 0.36 + 0.07;
    arrowGroup.add(tipMesh);

    // 3. 尾部三片平衡树皮羽毛
    const featherGeo = new THREE.BoxGeometry(0.006, 0.12, 0.04);
    const featherMat = new THREE.MeshBasicMaterial({ color: 0xecf0f1 });
    for (let i = 0; i < 3; i++) {
      const feather = new THREE.Mesh(featherGeo, featherMat);
      feather.position.y = -0.3;
      feather.rotation.y = (i * Math.PI * 2) / 3;
      feather.position.x = Math.sin((i * Math.PI * 2) / 3) * 0.02;
      feather.position.z = Math.cos((i * Math.PI * 2) / 3) * 0.02;
      arrowGroup.add(feather);
    }

    return arrowGroup;
  }

  // 切换攻击模式：近战长矛 <-> 远程猎弓
  toggleCombatMode() {
    const game = this.game;
    const inv = game && game.ui ? game.ui.inventory : {};
    const hasBow = (inv['wooden_bow'] || 0) > 0;

    if (!hasBow) {
      if (game && game.ui) {
        game.ui.showToast('❌ 背包中尚未持有【简易猎弓 🏹】！请前往合成台使用 [加厚兽皮 + 坚韧木棍] 制作！', 'medium');
      }
      return false;
    }

    this.combatMode = (this.combatMode === 'melee') ? 'ranged' : 'melee';
    const arrowCount = inv['flint_arrow'] || 0;

    // 更新右下角虚拟攻击按键的图标与文案
    if (typeof document !== 'undefined') {
      const atkBtn = document.getElementById('btn-quick-attack');
      if (atkBtn) {
        if (this.combatMode === 'ranged') {
          atkBtn.innerHTML = `${iconHTML('tools/hunting_bow', 26, { eager: true })}<span class="aux-btn-label" style="color:#ffeaa7; font-weight:800;">射击(${arrowCount})</span>`;
          atkBtn.style.background = 'linear-gradient(135deg, rgba(230, 126, 34, 0.95), rgba(211, 84, 0, 0.95))';
          atkBtn.style.borderColor = 'rgba(243, 156, 18, 0.85)';
        } else {
          atkBtn.innerHTML = `${iconHTML('hud/attack', 26, { eager: true })}<span class="aux-btn-label" style="color:#ffeaa7; font-weight:800;">攻击</span>`;
          atkBtn.style.background = 'linear-gradient(135deg, rgba(231, 76, 60, 0.92), rgba(214, 48, 49, 0.92))';
          atkBtn.style.borderColor = 'rgba(255, 150, 150, 0.7)';
        }
      }
    }

    if (game && game.ui) {
      if (this.combatMode === 'ranged') {
        game.ui.showToast(`🏹 已切换至【远程猎弓模式】！剩余羽箭: ${arrowCount} 支，点按攻击键射击，长按攻击键切回近战！`, 'medium');
      } else {
        game.ui.showToast('🗡️ 已切换至【近战长矛模式】！点按攻击键挥刺，长按攻击键切换猎弓！', 'medium');
      }
    }
    return true;
  }

  // 发射一枚物理抛物线羽箭
  shootArrow() {
    const game = this.game;
    if (!game || !game.player || this.isAttacking) return false;

    const inv = game.ui ? game.ui.inventory : {};
    const arrowCount = inv['flint_arrow'] || 0;

    if (arrowCount <= 0) {
      if (game.ui) {
        game.ui.showToast('❌ 箭袋已空！缺少【燧石羽箭 🏹】！请前往合成台使用 [海蚀碎石 + 干燥树皮] 制作羽箭！', 'medium');
      }
      return false;
    }

    // 消耗 1 支箭
    inv['flint_arrow'] = arrowCount - 1;
    if (game.ui) {
      if (typeof game.ui.renderQuickBar === 'function') game.ui.renderQuickBar();
      if (typeof game.ui.renderInventory === 'function') game.ui.renderInventory();
      // 同步刷新攻击按键上的余量显示
      if (typeof document !== 'undefined') {
        const atkBtn = document.getElementById('btn-quick-attack');
        if (atkBtn && this.combatMode === 'ranged') {
          atkBtn.innerHTML = `${iconHTML('tools/hunting_bow', 26, { eager: true })}<span class="aux-btn-label" style="color:#ffeaa7; font-weight:800;">射击(${inv['flint_arrow']})</span>`;
        }
      }
    }

    this.isAttacking = true;
    this.playerAttackCooldown = 0.55;

    // 播放拉弦放箭音效
    soundEngine.playBowShoot();

    // 触发玩家骨骼拉弓动作
    if (game.player && game.player.playAttackAnimation) {
      game.player.playAttackAnimation('bow');
    }

    // 构造箭矢实体并赋予初始抛物线初速度
    const playerPos = game.player.position;
    const playerRot = game.player.rotation;
    // 玩家水平朝向向量
    const forwardX = Math.sin(playerRot);
    const forwardZ = Math.cos(playerRot);

    const arrowMesh = this.createArrowMesh();
    // 初始位置放置在玩家身前胸口高度
    const startY = playerPos.y + 0.55;
    arrowMesh.position.set(playerPos.x + forwardX * 0.35, startY, playerPos.z + forwardZ * 0.35);

    // 初速度 23 m/s，略微向上微仰 (0.07 rad 抛物线仰角)
    const speed = 23.0;
    const velY = 1.7; // 向上初速
    const velX = forwardX * speed;
    const velZ = forwardZ * speed;
    const velocity = new THREE.Vector3(velX, velY, velZ);

    // 初始朝向
    arrowMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), velocity.clone().normalize());
    this.group.add(arrowMesh);

    this.arrows.push({
      mesh: arrowMesh,
      velocity: velocity,
      distanceTraveled: 0,
      maxDistance: 26.0,
      isSpent: false,
      fadeTimer: 0
    });

    setTimeout(() => {
      this.isAttacking = false;
    }, 550);

    return true;
  }

  // 每帧更新飞行箭矢的抛物线动力学、野兽碰撞与远距引怪仇恨
  updateArrows(delta) {
    if (!this.arrows || this.arrows.length === 0) return;

    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arrow = this.arrows[i];

      // 落地或命中后的停留渐隐消散逻辑
      if (arrow.isSpent) {
        arrow.fadeTimer += delta;
        arrow.mesh.scale.multiplyScalar(Math.max(0, 1.0 - delta * 2.5));
        if (arrow.fadeTimer >= 0.8) {
          this.group.remove(arrow.mesh);
          this.arrows.splice(i, 1);
        }
        continue;
      }

      // 1. 物理重力加速度叠加
      arrow.velocity.y -= 9.8 * delta;

      // 2. 位移推进
      const stepDist = arrow.velocity.length() * delta;
      arrow.mesh.position.addScaledVector(arrow.velocity, delta);
      arrow.distanceTraveled += stepDist;

      // 3. 箭矢姿态随瞬时速度切线动态对齐
      if (arrow.velocity.lengthSq() > 0.1) {
        arrow.mesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          arrow.velocity.clone().normalize()
        );
      }

      // 4. 地表高程碰撞检测
      const groundH = this.sampleFloorHeight(arrow.mesh.position.x, arrow.mesh.position.z, -0.3);
      if (arrow.mesh.position.y <= groundH + 0.05) {
        arrow.mesh.position.y = groundH + 0.05;
        arrow.isSpent = true;
        // 50% 概率完好回收羽箭
        if (Math.random() < 0.5 && this.game && this.game.ui) {
          this.game.ui.addInventory('flint_arrow', 1);
          this.spawnDamageNumber(arrow.mesh.position, '+1 🏹 回收', '#2ed573');
          soundEngine.playItemDrop();
        }
        continue;
      }

      // 5. 命中野兽实体碰撞检测 (半径 0.85 米)
      let hitMob = null;
      for (const mob of this.wildlifeList) {
        if (mob.isDead) continue;
        const mobCenter = mob.group.position.clone();
        mobCenter.y += (mob.type === 'boar' ? 0.65 : 0.35);

        if (arrow.mesh.position.distanceTo(mobCenter) <= 0.85) {
          hitMob = mob;
          break;
        }
      }

      if (hitMob) {
        arrow.isSpent = true;
        soundEngine.playHitImpact();

        // 🎯 核心机制：远距引怪仇恨激怒 (Pull Aggro)
        // 记录受击前状态，并大幅拉宽仇恨警戒半径（确保远距离也能锁定玩家追击）
        const wasPeaceful = (hitMob.state === 'IDLE' || hitMob.state === 'WANDER' || hitMob.state === 'PATROL');
        hitMob.alertRadius = Math.max(hitMob.alertRadius, 28.0);

        // 远程箭矢伤害结算 (基础 28 点，若野兽破绽眩晕则双倍暴击 56 点)
        const hitDir = new THREE.Vector3(arrow.velocity.x, 0, arrow.velocity.z).normalize();
        this.applyDamageToMob(hitMob, 28, hitDir, 0.7);

        // 若命中前处于非战斗状态，强制拉入狂暴 CHASE 状态！
        if (wasPeaceful || hitMob.state === 'STAGGER') {
          hitMob.state = 'CHASE';
          soundEngine.playMonsterGrowl();
          if (this.game && this.game.ui) {
            this.game.ui.showToast(`🎯 远距命中！【${hitMob.name}】被羽箭激怒，正发出低吼朝你狂奔扑来！`, 'medium');
          }
        }
        continue;
      }

      // 6. 超出最大射程力竭坠落消散
      if (arrow.distanceTraveled >= arrow.maxDistance) {
        arrow.isSpent = true;
      }
    }
  }

  // 构建低多边形齿状捕兽夹 3D 实体
  createTrapMesh() {
    const trapGroup = new THREE.Group();

    // 1. 金属底盘底座 (深冷铁色圆盘)
    const baseGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.05, 8);
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x2d3436,
      roughness: 0.35,
      metalness: 0.85,
      flatShading: true
    });
    const baseMesh = new THREE.Mesh(baseGeo, ironMat);
    baseMesh.position.y = 0.025;
    trapGroup.add(baseMesh);

    // 2. 核心触压机关感应板 (暗黄铜色)
    const plateGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.04, 6);
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0xd35400,
      metalness: 0.6,
      roughness: 0.4
    });
    const plateMesh = new THREE.Mesh(plateGeo, plateMat);
    plateMesh.position.y = 0.055;
    trapGroup.add(plateMesh);

    // 3. 左右可活动的锋利交错齿轮夹瓣 (Jaws)
    const jawGeo = new THREE.BoxGeometry(0.06, 0.16, 0.65);
    const jawL = new THREE.Mesh(jawGeo, ironMat);
    jawL.position.set(-0.24, 0.08, 0);
    jawL.rotation.z = Math.PI / 4.5; // 张开待触发状态
    const jawR = new THREE.Mesh(jawGeo, ironMat);
    jawR.position.set(0.24, 0.08, 0);
    jawR.rotation.z = -Math.PI / 4.5;
    trapGroup.add(jawL, jawR);

    // 4. 发光警示微圈 (方便玩家夜间识别己方陷阱位置)
    const beaconGeo = new THREE.RingGeometry(0.42, 0.48, 12);
    beaconGeo.rotateX(-Math.PI / 2);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xe74c3c,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.y = 0.01;
    trapGroup.add(beaconMesh);

    return { group: trapGroup, jawL, jawR, beaconMesh };
  }

  // 构建防兽尖木拒马 3D 实体
  createSpikesMesh() {
    const spikeGroup = new THREE.Group();

    // 交叉三根斜向削尖重型原木
    const logGeo = new THREE.ConeGeometry(0.12, 1.4, 5);
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x795548, // 深褐粗糙削尖木材
      roughness: 0.9,
      flatShading: true
    });

    const angles = [-0.38, 0, 0.38];
    angles.forEach((ang, i) => {
      const log = new THREE.Mesh(logGeo, woodMat);
      log.position.set(ang * 1.5, 0.55, 0);
      log.rotation.set(-Math.PI / 4.2, 0, ang * 0.4);
      spikeGroup.add(log);
    });

    // 横向藤蔓捆绑横木
    const crossGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.6, 5);
    const crossMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.85 });
    const crossMesh = new THREE.Mesh(crossGeo, crossMat);
    crossMesh.position.set(0, 0.45, -0.15);
    crossMesh.rotation.z = Math.PI / 2;
    spikeGroup.add(crossMesh);

    return spikeGroup;
  }

  // 在玩家脚下布置【齿状捕兽夹】
  placeTrapAtPlayer() {
    const game = this.game;
    if (!game || !game.player) return null;

    const pPos = game.player.position;
    const groundY = this.sampleFloorHeight(pPos.x, pPos.z, pPos.y);

    const trapMeshObj = this.createTrapMesh();
    trapMeshObj.group.position.set(pPos.x, groundY, pPos.z);
    this.group.add(trapMeshObj.group);

    const trapEntity = {
      ...trapMeshObj,
      position: new THREE.Vector3(pPos.x, groundY, pPos.z),
      armed: true,
      lifeTimer: 90.0, // 持续 90 秒
      isTriggered: false,
      disappearTimer: 0
    };

    this.traps.push(trapEntity);
    return trapEntity;
  }

  // 在玩家面前布置【防兽尖木拒马】
  placeSpikesAtPlayer() {
    const game = this.game;
    if (!game || !game.player) return null;

    const pPos = game.player.position;
    const pRot = game.player.rotation;
    const fX = Math.sin(pRot);
    const fZ = Math.cos(pRot);

    const targetX = pPos.x + fX * 1.1;
    const targetZ = pPos.z + fZ * 1.1;
    const groundY = this.sampleFloorHeight(targetX, targetZ, pPos.y);

    const spikeMesh = this.createSpikesMesh();
    spikeMesh.position.set(targetX, groundY, targetZ);
    spikeMesh.rotation.y = pRot;
    this.group.add(spikeMesh);

    const spikeEntity = {
      group: spikeMesh,
      position: new THREE.Vector3(targetX, groundY, targetZ),
      durability: 3, // 可承受 3 次冲击
      hitCooldown: 0
    };

    this.spikes.push(spikeEntity);
    return spikeEntity;
  }

  // 每帧更新地表捕兽夹 (野兽触碰判定、咬合动画与禁锢破绽结算)
  updateTraps(delta) {
    if (!this.traps || this.traps.length === 0) return;

    for (let i = this.traps.length - 1; i >= 0; i--) {
      const trap = this.traps[i];

      // 触发后缓慢消散
      if (trap.isTriggered) {
        trap.disappearTimer += delta;
        if (trap.disappearTimer >= 6.0) {
          this.group.remove(trap.group);
          this.traps.splice(i, 1);
        }
        continue;
      }

      // 超时自然失效
      trap.lifeTimer -= delta;
      if (trap.lifeTimer <= 0) {
        this.group.remove(trap.group);
        this.traps.splice(i, 1);
        continue;
      }

      // 呼吸脉动微光
      if (trap.beaconMesh) {
        trap.beaconMesh.material.opacity = Math.sin(Date.now() * 0.006) * 0.2 + 0.35;
      }

      // 触碰检测：寻找踏入陷阱判定圈 (0.78米) 内的存活野兽
      for (const mob of this.wildlifeList) {
        if (mob.isDead) continue;
        const d = trap.position.distanceTo(mob.group.position);

        if (d <= 0.78 && trap.armed) {
          trap.armed = false;
          trap.isTriggered = true;

          // 1. 播放铁齿瞬间闭合咬击音效
          soundEngine.playTrapSnap();

          // 2. 夹瓣剧烈合拢动画
          trap.jawL.rotation.z = -0.15;
          trap.jawR.rotation.z = 0.15;
          if (trap.beaconMesh) trap.beaconMesh.visible = false;

          // 3. 巨额夹伤 (45点穿刺伤害)
          this.applyDamageToMob(mob, 45, new THREE.Vector3(0, 0, 0), 0);
          this.spawnDamageNumber(mob.group.position, '⛓️ TRAPPED! -45', '#e74c3c');

          // 4. 施加强力禁锢眩晕破绽 (4.0 秒无法动弹，受长矛刺击 100% 暴击！)
          mob.state = 'STUNNED';
          mob.isStunned = true;
          mob.stunTimer = 4.0;
          if (mob.stunGroup) mob.stunGroup.visible = true;

          if (this.game && this.game.ui) {
            this.game.ui.showToast(`🪤 咔嚓！【${mob.name}】踩中捕兽夹！被铁齿死死钳住，陷入 4 秒禁锢破绽！`, 'medium');
          }
          break;
        }
      }
    }
  }

  // 每帧更新防兽尖木拒马 (阻击野兽冲撞反弹与反震破坏)
  updateSpikes(delta) {
    if (!this.spikes || this.spikes.length === 0) return;

    for (let i = this.spikes.length - 1; i >= 0; i--) {
      const sp = this.spikes[i];
      if (sp.hitCooldown > 0) sp.hitCooldown -= delta;

      for (const mob of this.wildlifeList) {
        if (mob.isDead) continue;
        const d = sp.position.distanceTo(mob.group.position);

        // 检测冲刺突进中的野猪撞上拒马
        if (d <= 1.25 && sp.hitCooldown <= 0) {
          if (mob.state === 'CHARGING' || mob.state === 'CHASE') {
            sp.hitCooldown = 1.0;
            sp.durability -= 1;

            soundEngine.playHitImpact();
            // 造成 50 点反震重创并打断冲撞
            this.applyDamageToMob(mob, 50, new THREE.Vector3(mob.chargeDir?.x ? -mob.chargeDir.x : 0, 0, mob.chargeDir?.z ? -mob.chargeDir.z : -1), 1.5);
            this.spawnDamageNumber(mob.group.position, '🪵 SPIKE CRASH! -50', '#f39c12');

            // 野兽撞击尖木倒地眩晕 3.2 秒！
            mob.state = 'STUNNED';
            mob.isStunned = true;
            mob.stunTimer = 3.2;
            if (mob.stunGroup) mob.stunGroup.visible = true;

            if (this.game && this.game.ui) {
              this.game.ui.showToast(`🛡️ 轰！【${mob.name}】猛烈撞上防兽尖木拒马！受到 50 点反震重创陷入眩晕！`, 'medium');
            }

            // 拒马耐久耗尽粉碎
            if (sp.durability <= 0) {
              this.group.remove(sp.group);
              this.spikes.splice(i, 1);
              if (this.game && this.game.ui) {
                this.game.ui.showToast('⚠️ 防兽尖木拒马在野兽剧烈撞击下破碎散架！', 'medium');
              }
            }
            break;
          }
        }
      }
    }
  }

  // 夜间野兽袭营与伙伴警戒互动系统 (Night Raid & Companion Alert)
  updateNightRaid(delta) {
    const game = this.game;
    if (!game) return;

    // 检查昼夜时间
    const dayNight = game.dayNight;
    const isNightTime = dayNight ? !!dayNight.isNight : false;

    if (!isNightTime) {
      this.hasAlertedTonight = false;
      return;
    }

    if (this.nightRaidCooldown > 0) this.nightRaidCooldown -= delta;

    // 当入夜且冷却就绪时，检查是否有野兽靠近营地中心 (篝火半径 15 米)
    const campfirePos = new THREE.Vector3(...ISLAND_LAYOUT.campfire);
    let nearestBeastToCamp = null;
    let minCampDist = 999;

    for (const mob of this.wildlifeList) {
      if (mob.isDead) continue;
      const d = mob.group.position.distanceTo(campfirePos);
      if (d < minCampDist) {
        minCampDist = d;
        nearestBeastToCamp = mob;
      }
    }

    // 若有暗夜野兽逼近至 14 米营地外围
    if (nearestBeastToCamp && minCampDist <= 14.0 && !this.hasAlertedTonight && this.nightRaidCooldown <= 0) {
      this.hasAlertedTonight = true;
      this.nightRaidCooldown = 45.0; // 45 秒内不再重复警报

      // 检查营地中是否有苏醒的伙伴艾莉 (Ellie)
      const story = game.story;
      const isEllieAwake = story ? !!story.secondKidAwake : false;

      soundEngine.playAnimalVoice();
      if (isEllieAwake && game.ui) {
        game.ui.showDialog(
          '艾莉 (警戒中)',
          '⚠️ “嘘……！等等！海风里有粗重的喘息声……！\n丛林深处有凶猛的野兽正悄悄朝营火逼近！\n快检查周围布置的【齿状捕兽夹 🪤】与【防兽尖木拒马 🪵】，备好长矛与猎弓！不要让营火熄灭！”'
        );
      } else if (game.ui) {
        game.ui.showToast('🐺【夜幕危机】黑暗的林间传来阵阵低吼，有野兽正悄悄逼近营地篝火！', 'important');
      }
    }
  }

  // 玩家攻击指令分流 (支持近战挥刺与远程射箭)
  performPlayerAttack() {
    const game = this.game;
    if (!game || !game.player || this.isAttacking) return false;

    const inv = game.ui ? game.ui.inventory : {};
    const hasBow = (inv['wooden_bow'] || 0) > 0;
    const hasMelee = (inv['spear'] || 0) > 0 || (inv['stone_axe'] || 0) > 0 || (inv['stone_hammer'] || 0) > 0;

    // 如果处于远程模式，或者只有弓箭而没有近战武器，自动执行远程射击！
    if (this.combatMode === 'ranged' || (hasBow && !hasMelee)) {
      return this.shootArrow();
    }

    // 否则执行近战武器攻击
    const hasSpear = (inv['spear'] || 0) > 0;
    const hasAxe = (inv['stone_axe'] || 0) > 0;
    const hasHammer = (inv['stone_hammer'] || 0) > 0;

    // 基础伤害与打击距离参数
    let weaponName = '徒手挥拳 👊';
    let damage = 14;
    let reach = 2.0;
    let hitAngle = 1.35; // 约 77 度扇形
    let knockbackDist = 0.9;

    if (hasSpear) {
      weaponName = '燧石长矛刺击 🗡️';
      damage = 38;
      reach = 3.2; // 长矛突刺攻击距离大幅占优
      hitAngle = 1.05; // 突刺扇面集中
      knockbackDist = 1.8;
    } else if (hasHammer) {
      weaponName = '重装石锤重砸 🔨';
      damage = 45;
      reach = 2.2;
      hitAngle = 1.6;
      knockbackDist = 2.2;
    } else if (hasAxe) {
      weaponName = '锋利石斧横斩 🪓';
      damage = 28;
      reach = 2.3;
      hitAngle = 1.45;
      knockbackDist = 1.3;
    }

    this.isAttacking = true;
    this.playerAttackCooldown = 0.45;

    // 播放攻击破空呼啸音效
    soundEngine.playAttackSwish();

    // 触发玩家骨骼挥刺动画
    if (game.player && game.player.playAttackAnimation) {
      game.player.playAttackAnimation(hasSpear ? 'spear' : 'slash');
    }

    // 判定命中扇形内的野兽
    const playerPos = game.player.position;
    const playerRot = game.player.rotation;
    // 玩家正前方向量
    const forwardVec = new THREE.Vector3(Math.sin(playerRot), 0, Math.cos(playerRot)).normalize();

    let hitCount = 0;
    for (const mob of this.wildlifeList) {
      if (mob.isDead) continue;

      const mobPos = mob.group.position;
      const toMob = new THREE.Vector3(mobPos.x - playerPos.x, 0, mobPos.z - playerPos.z);
      const dist = toMob.length();

      if (dist <= reach + 0.3) {
        toMob.normalize();
        // 点积计算前向夹角
        const dot = forwardVec.dot(toMob);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

        if (angle <= hitAngle / 2) {
          // 判定命中！
          hitCount++;
          this.applyDamageToMob(mob, damage, forwardVec, knockbackDist);
        }
      }
    }

    if (hitCount > 0) {
      soundEngine.playHitImpact();
      if (game.ui) {
        game.ui.showToast(`💥 ${weaponName} 命中目标！造成 ${damage} 点打击伤害！`, 'small');
      }
    }

    setTimeout(() => {
      this.isAttacking = false;
    }, 450);

    return true;
  }

  // 对野兽结算伤害、击退与死亡掉落
  applyDamageToMob(mob, damage, attackDir, knockbackDist) {
    // 检查是否命中处于破绽眩晕中的野兽 (Vulnerability Exploitation)
    const isVulnerable = mob.state === 'STUNNED' || mob.isStunned;
    let actualDmg = damage;
    let isCrit = false;

    if (isVulnerable) {
      // 破绽暴击：必出双倍致命暴击 (CRIT x2)！
      isCrit = true;
      actualDmg = Math.round(damage * 2.0);
      this.spawnDamageNumber(mob.group.position, `CRIT -${actualDmg}!!`, '#f1c40f');
      if (this.game && this.game.ui) {
        this.game.ui.showToast(`🎯 【破绽暴击】长矛精准贯穿弱点！造成 ${actualDmg} 点双倍暴击伤害！`, 'small');
      }
      // 暴击打断眩晕并造成超大击退
      knockbackDist *= 1.8;
      if (mob.stunGroup) mob.stunGroup.visible = false;
      mob.isStunned = false;
    } else {
      isCrit = Math.random() < 0.25;
      actualDmg = isCrit ? Math.round(damage * 1.5) : damage;
      this.spawnDamageNumber(mob.group.position, `-${actualDmg}${isCrit ? '!' : ''}`, isCrit ? '#ffdd59' : '#ff4757');
    }

    mob.hp -= actualDmg;
    mob.hpBar.group.visible = true;
    mob.hpBar.update(mob.hp, mob.maxHp);

    // 闪红受击特效
    this.flashMobHit(mob);

    // 击退后移
    mob.group.position.x += attackDir.x * knockbackDist;
    mob.group.position.z += attackDir.z * knockbackDist;

    // 贴合击退后地面高度
    mob.group.position.y = this.sampleFloorHeight(mob.group.position.x, mob.group.position.z, mob.group.position.y);

    // 陷入硬直并激活仇恨追逐
    mob.state = 'STAGGER';
    mob.staggerTimer = 0.35;
    if (mob.telegraphMesh) mob.telegraphMesh.visible = false;

    // 检查是否死亡
    if (mob.hp <= 0 && !mob.isDead) {
      this.killMob(mob);
    }
  }

  // 受击闪白/闪红表现
  flashMobHit(mob) {
    const mat = mob.type === 'crab' ? mob.shellMesh.material : mob.bodyMesh.material;
    const origColor = mat.color.getHex();
    mat.color.setHex(0xffffff); // 瞬间白炽
    setTimeout(() => {
      if (mat) mat.color.setHex(0xff3838); // 痛感赤红
      setTimeout(() => {
        if (mat) mat.color.setHex(origColor);
      }, 160);
    }, 80);
  }

  // 野兽阵亡与战利品结算
  killMob(mob) {
    mob.isDead = true;
    mob.state = 'DEAD';
    mob.hpBar.group.visible = false;
    soundEngine.playVictory();

    const dropPosition = mob.group.position.clone();
    // 击败瞬间地表爆出金色战利品包裹，打击感清脆即时！
    this.spawnLootDrop(dropPosition, mob.loot, mob.name);

    // 怪物躯体微仰倾斜并逐渐缩微光辉消散
    let collapseTimer = 0;
    const deadAnim = setInterval(() => {
      collapseTimer += 0.05;
      mob.group.rotation.x += 0.12;
      mob.group.scale.multiplyScalar(0.92);
      if (collapseTimer >= 0.6) {
        clearInterval(deadAnim);
        this.group.remove(mob.group);
      }
    }, 50);

    if (this.game && this.game.ui) {
      this.game.ui.showToast(`🏆 成功击败【${mob.name}】！战利品掉落在附近！`, 'medium');
    }
  }

  // 生成地表物理战利品包 (发光皮囊 + 旋转金色光环)
  spawnLootDrop(pos, lootTable, mobName) {
    const lootGroup = new THREE.Group();
    lootGroup.position.copy(pos);
    lootGroup.position.y = Math.max(0.05, pos.y);

    // 兽皮包裹网格
    const bagGeo = new THREE.DodecahedronGeometry(0.3, 0);
    const bagMat = new THREE.MeshStandardMaterial({
      color: 0xf39c12, // 诱人战利品金橙色
      roughness: 0.4,
      metalness: 0.6,
      emissive: 0x995500,
      emissiveIntensity: 0.4
    });
    const bagMesh = new THREE.Mesh(bagGeo, bagMat);
    bagMesh.position.y = 0.25;
    lootGroup.add(bagMesh);

    // 环绕光环光柱
    const ringGeo = new THREE.RingGeometry(0.35, 0.52, 16);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf1c40f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 0.04;
    lootGroup.add(ringMesh);

    this.group.add(lootGroup);

    // 结算掉落物
    const items = [];
    lootTable.forEach(item => {
      if (Math.random() <= item.chance) {
        items.push({ id: item.id, name: item.name, count: item.count });
      }
    });

    const drop = {
      group: lootGroup,
      ringMesh,
      bagMesh,
      items,
      mobName,
      picked: false,
      pulseTimer: 0
    };

    this.lootDrops.push(drop);
    return drop;
  }

  // 检查玩家靠近按 [E] 拾取战利品
  checkLootPickup(playerPos) {
    for (const drop of this.lootDrops) {
      if (drop.picked) continue;

      const dist = distanceXZ(playerPos, [drop.group.position.x, drop.group.position.y, drop.group.position.z]);
      if (dist <= 2.2) {
        drop.picked = true;
        this.group.remove(drop.group);
        soundEngine.playItemDrop();

        const receivedNames = [];
        drop.items.forEach(it => {
          if (this.game && this.game.ui) {
            this.game.ui.addInventory(it.id, it.count);
            receivedNames.push(`${it.name} x${it.count}`);
          }
        });

        if (this.game && this.game.ui) {
          this.game.ui.showToast(`🎒 拾取战利品：【${receivedNames.join('、')}】！`, 'small');
        }
        return true;
      }
    }
    return false;
  }

  // 生成飘字伤害数字动画
  spawnDamageNumber(worldPos, text, color) {
    const sprite = createDamageSprite(text, color);
    sprite.position.copy(worldPos);
    sprite.position.y += 1.0;
    this.group.add(sprite);

    this.damageTexts.push({
      sprite,
      life: 0.85,
      maxLife: 0.85
    });
  }

  // 帧驱动更新：AI 巡逻追逐、安全区避险、伤害跳字消散
  update(delta) {
    const game = this.game;
    if (!game || !game.player) return;

    // 玩家攻击冷却与姿态重置
    if (this.playerAttackCooldown > 0) {
      this.playerAttackCooldown -= delta;
      if (this.playerAttackCooldown <= 0) {
        this.isAttacking = false;
      }
    }

    const playerPos = game.player.position;
    const campfirePos = new THREE.Vector3(...ISLAND_LAYOUT.campfire);

    // 0. 更新地表陷阱与防兽拒马 (踩踏禁锢与冲撞拦截优先判定)
    this.updateTraps(delta);
    this.updateSpikes(delta);

    // 1. 更新所有存活野兽 AI
    for (const mob of this.wildlifeList) {
      if (mob.isDead) continue;

      mob.animCycle += delta * 4.0;
      if (mob.attackCooldownTimer > 0) mob.attackCooldownTimer -= delta;

      // 头顶血条朝向相机
      if (mob.hpBar.group.visible && game.camera) {
        mob.hpBar.group.quaternion.copy(game.camera.quaternion);
      }

      const mobPos = mob.group.position;
      const distToPlayer = distanceXZ(playerPos, [mobPos.x, mobPos.y, mobPos.z]);
      const distToCampfire = distanceXZ(campfirePos, [mobPos.x, mobPos.y, mobPos.z]);

      // === 营火避险驱兽法则 (Campfire Repellent Safe Zone) ===
      // 野兽极端惧怕火焰，距离营火 7.5 米内时惊恐尖叫逃跑
      if (distToCampfire < 7.5) {
        mob.state = 'FLEE';
      }

      // === 状态机轮转 ===
      switch (mob.state) {
        case 'STUNNED':
          mob.stunTimer -= delta;
          if (mob.stunGroup) {
            mob.stunGroup.visible = true;
            mob.stunGroup.rotation.y += delta * 6.5; // 头顶金色小星疾速公转
          }
          // 身躯由于眩晕左右微微晃动
          mob.group.rotation.z = Math.sin(mob.animCycle * 1.5) * 0.12;

          if (mob.stunTimer <= 0) {
            mob.state = 'CHASE';
            mob.isStunned = false;
            mob.group.rotation.z = 0;
            if (mob.stunGroup) mob.stunGroup.visible = false;
            mob.chargeCooldownTimer = mob.chargeCooldown;
          }
          break;

        case 'PREPARE_CHARGE': {
          // 蓄力前摇示警状态 (1.0 秒前蹄刨地蓄力)
          mob.chargePrepareTimer -= delta;
          const toPlayer = new THREE.Vector3(playerPos.x - mobPos.x, 0, playerPos.z - mobPos.z).normalize();
          mob.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

          // 呈现地面半透明红色冲撞危险矩形 (Telegraph)
          if (mob.telegraphMesh) {
            mob.telegraphMesh.visible = true;
            // 危险红光急促呼吸脉动
            const pulse = Math.sin((1.0 - mob.chargePrepareTimer) * Math.PI * 6.0) * 0.25 + 0.55;
            mob.telegraphMesh.material.opacity = pulse;
          }

          // 前蹄高频刨地蹬步微动作
          if (mob.legs && mob.legs.length >= 2) {
            mob.legs[0].rotation.x = Math.sin(mob.animCycle * 14.0) * 0.65;
            mob.legs[1].rotation.x = -Math.sin(mob.animCycle * 14.0) * 0.65;
          }

          if (mob.chargePrepareTimer <= 0) {
            // 蓄力结束，正式引爆全速冲撞突刺！
            if (mob.telegraphMesh) mob.telegraphMesh.visible = false;
            mob.chargeDir.copy(toPlayer);
            mob.state = 'CHARGING';
            mob.chargeDashTimer = 1.1; // 极速狂飙 1.1 秒
            mob.chargeDistanceTraveled = 0;
            soundEngine.playAttackSwish();
            if (game.ui) {
              game.ui.showToast('🚨 野猪发起凶猛冲撞！按【空格 Space】跳跃或侧闪避险！', 'important');
            }
          }
          break;
        }

        case 'CHARGING': {
          // 高速狂暴直线突刺 (以 2.4 倍移速向前狂飙)
          mob.chargeDashTimer -= delta;
          const dashSpeed = mob.speed * 2.4;
          const stepDist = dashSpeed * delta;
          mob.group.position.x += mob.chargeDir.x * stepDist;
          mob.group.position.z += mob.chargeDir.z * stepDist;
          mob.chargeDistanceTraveled += stepDist;

          // 冲锋极速倒蹬四肢
          if (mob.legs) {
            mob.legs[0].rotation.x = Math.sin(mob.animCycle * 10.0) * 0.7;
            mob.legs[1].rotation.x = -Math.sin(mob.animCycle * 10.0) * 0.7;
            mob.legs[2].rotation.x = -Math.sin(mob.animCycle * 10.0) * 0.7;
            mob.legs[3].rotation.x = Math.sin(mob.animCycle * 10.0) * 0.7;
          }

          // 1. 检测是否冲撞触及玩家
          const distToPlayerNow = distanceXZ(playerPos, [mob.group.position.x, mob.group.position.y, mob.group.position.z]);
          if (distToPlayerNow <= 1.55) {
            // 判定玩家是否跳跃闪避
            const groundH = this.sampleFloorHeight(playerPos.x, playerPos.z, 0);
            const playerHeightAbove = playerPos.y - groundH;
            const isPlayerJumping = playerHeightAbove > 0.35 || !!game.player.isJumping;

            if (isPlayerJumping) {
              // 成功实现完美腾空跳跃闪避！
              soundEngine.playAttackSwish();
              this.spawnDamageNumber(playerPos, '💨 DODGE!', '#00d2d3');
              if (game.ui) {
                game.ui.showToast('✨ 完美跳跃！擦着野猪獠牙极限闪避！', 'small');
              }
            } else {
              // 未能闪避，遭受重创挑飞
              this.mobAttackPlayer(mob, 26);
              // 剧烈震飞玩家
              if (game.player.position) {
                game.player.position.x += mob.chargeDir.x * 2.5;
                game.player.position.z += mob.chargeDir.z * 2.5;
              }
            }

            // 触碰玩家后冲刺势能抵消，重归 CHASE
            mob.state = 'CHASE';
            mob.chargeCooldownTimer = mob.chargeCooldown;
            break;
          }

          // 2. 检测是否撞击障碍物（树干/巨石/冲刺力竭）
          const isCrashObstacle = this.checkMobObstacleCollision(mob);
          if (isCrashObstacle) {
            // 撞树/撞石产生失衡撞击，陷入破绽眩晕！
            soundEngine.playHitImpact();
            this.spawnDamageNumber(mob.group.position, '💥 STUNNED!', '#f1c40f');
            mob.state = 'STUNNED';
            mob.isStunned = true;
            mob.stunTimer = 2.8; // 破绽大硬直 2.8 秒！
            if (mob.stunGroup) mob.stunGroup.visible = true;
            if (game.ui) {
              game.ui.showToast('🎯 野猪撞晕陷入破绽！立即长矛突刺触发【100% 暴击】！', 'important');
            }
          }
          break;
        }

        case 'STAGGER':
          mob.staggerTimer -= delta;
          if (mob.staggerTimer <= 0) {
            mob.state = distToPlayer < mob.alertRadius ? 'CHASE' : 'PATROL';
          }
          break;

        case 'FLEE': {
          // 背离营火全力逃遁
          const awayFromFire = new THREE.Vector3(mobPos.x - campfirePos.x, 0, mobPos.z - campfirePos.z).normalize();
          mob.group.position.x += awayFromFire.x * (mob.speed * 1.3) * delta;
          mob.group.position.z += awayFromFire.z * (mob.speed * 1.3) * delta;
          mob.group.rotation.y = Math.atan2(awayFromFire.x, awayFromFire.z);
          if (distToCampfire >= 8.5) {
            mob.state = 'PATROL';
          }
          break;
        }

        case 'PATROL':
          mob.stateTimer -= delta;
          if (mob.stateTimer <= 0) {
            mob.stateTimer = 2.5 + Math.random() * 3.0;
            // 在巡逻中枢附近随机挑选游荡目标
            const rx = (Math.random() - 0.5) * 8.0;
            const rz = (Math.random() - 0.5) * 8.0;
            mob.patrolTarget.set(mob.patrolCenter.x + rx, mob.patrolCenter.y, mob.patrolCenter.z + rz);
          }

          // 向巡逻目标平滑漫步
          const toTarget = new THREE.Vector3().subVectors(mob.patrolTarget, mobPos);
          toTarget.y = 0;
          if (toTarget.length() > 0.4) {
            toTarget.normalize();
            mob.group.position.x += toTarget.x * (mob.speed * 0.45) * delta;
            mob.group.position.z += toTarget.z * (mob.speed * 0.45) * delta;
            mob.group.rotation.y = Math.atan2(toTarget.x, toTarget.z);
          }

          // 若玩家进入警觉圈，进入 ALERT 状态
          if (distToPlayer <= mob.alertRadius) {
            mob.state = 'ALERT';
            mob.hpBar.group.visible = true;
            soundEngine.playMonsterGrowl();
          }
          break;

        case 'ALERT': {
          // 原地警觉咆哮对峙
          const toPlayer = new THREE.Vector3(playerPos.x - mobPos.x, 0, playerPos.z - mobPos.z).normalize();
          mob.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

          if (distToPlayer <= mob.alertRadius * 0.75) {
            mob.state = 'CHASE';
          } else if (distToPlayer > mob.alertRadius * 1.3) {
            mob.state = 'PATROL';
            mob.hpBar.group.visible = false;
          }
          break;
        }

        case 'CHASE': {
          // 野猪冲锋冷却计时与触发判定
          if (mob.type === 'boar') {
            if (mob.chargeCooldownTimer > 0) mob.chargeCooldownTimer -= delta;
            // 距离玩家 3.0~7.5 米且冲锋冷却就绪，开启蓄力冲撞预警！
            if (mob.chargeCooldownTimer <= 0 && distToPlayer >= 3.2 && distToPlayer <= 7.8) {
              mob.state = 'PREPARE_CHARGE';
              mob.chargePrepareTimer = 1.0;
              soundEngine.playMonsterGrowl();
              break;
            }
          }

          // 全速冲向玩家
          const toPlayer = new THREE.Vector3(playerPos.x - mobPos.x, 0, playerPos.z - mobPos.z);
          toPlayer.y = 0;
          const chaseDist = toPlayer.length();

          if (chaseDist > 0.2) {
            toPlayer.normalize();
            mob.group.position.x += toPlayer.x * mob.speed * delta;
            mob.group.position.z += toPlayer.z * mob.speed * delta;
            mob.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
          }

          // 到达攻击距离发动打击
          if (chaseDist <= mob.attackRange && mob.attackCooldownTimer <= 0) {
            this.mobAttackPlayer(mob);
          }

          // 玩家脱出追击范围
          if (chaseDist > mob.alertRadius * 1.5) {
            mob.state = 'PATROL';
          }
          break;
        }
      }

      // === 全局地表高度实时采样贴合 (彻底消除飞天或穿地) ===
      const floorY = this.sampleFloorHeight(mob.group.position.x, mob.group.position.z, mob.group.position.y);
      mob.group.position.y = THREE.MathUtils.lerp(mob.group.position.y, floorY, Math.min(1.0, 16.0 * delta));

      // 躯体微动画与步态
      if (mob.type === 'crab') {
        // 巨蟹螯剪与侧向步足
        mob.clawL.rotation.y = Math.sin(mob.animCycle * 2.0) * 0.35;
        mob.clawR.rotation.y = -Math.sin(mob.animCycle * 2.0) * 0.35;
        mob.legs.forEach((leg, i) => {
          leg.rotation.x = Math.sin(mob.animCycle * 3.0 + i) * 0.25;
        });
      } else if (mob.type === 'boar') {
        // 野猪四蹄与微倾
        mob.legs[0].rotation.x = Math.sin(mob.animCycle * 3.0) * 0.45;
        mob.legs[1].rotation.x = -Math.sin(mob.animCycle * 3.0) * 0.45;
        mob.legs[2].rotation.x = -Math.sin(mob.animCycle * 3.0) * 0.45;
        mob.legs[3].rotation.x = Math.sin(mob.animCycle * 3.0) * 0.45;
      }
    }

    // 2. 更新战利品微浮动与光环旋转
    for (const drop of this.lootDrops) {
      if (drop.picked) continue;
      drop.pulseTimer += delta * 2.5;
      drop.ringMesh.rotation.z += delta * 1.5;
      drop.bagMesh.rotation.y += delta * 1.2;
      drop.bagMesh.position.y = 0.25 + Math.sin(drop.pulseTimer) * 0.06;
    }

    // 2.5 更新物理弹道飞行箭矢 (抛物线运动、碰撞结算与引怪激怒)
    this.updateArrows(delta);

    // 2.6 更新夜间野兽袭营与伙伴警戒互动
    this.updateNightRaid(delta);

    // 3. 更新飘字动画与渐隐淡出
    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      const dt = this.damageTexts[i];
      dt.life -= delta;
      dt.sprite.position.y += delta * 1.1; // 向上缓缓飘浮
      dt.sprite.material.opacity = Math.max(0, dt.life / dt.maxLife);
      if (game.camera) dt.sprite.quaternion.copy(game.camera.quaternion);

      if (dt.life <= 0) {
        this.group.remove(dt.sprite);
        this.damageTexts.splice(i, 1);
      }
    }
  }

  // 检查野猪冲撞是否撞到障碍物（树干/巨石/冲刺力竭）
  checkMobObstacleCollision(mob) {
    // 1. 冲锋距离超过 6.8 米或时间耗尽未撞到玩家，冲势衰竭失衡撞地
    if (mob.chargeDistanceTraveled >= 6.8 || mob.chargeDashTimer <= 0) {
      return true;
    }

    // 2. 检查与场景中树木或大岩石的物理包围半径
    if (this.game && this.game.scene) {
      const mobX = mob.group.position.x;
      const mobZ = mob.group.position.z;
      if (!this.cachedObstacles) {
        this.cachedObstacles = [];
        this.game.scene.traverse(obj => {
          if (obj.userData && obj.userData.movementRadius && obj.userData.movementRadius > 0.6) {
            const worldPos = new THREE.Vector3();
            obj.getWorldPosition(worldPos);
            this.cachedObstacles.push({ x: worldPos.x, z: worldPos.z, r: obj.userData.movementRadius });
          }
        });
      }
      for (const obs of this.cachedObstacles) {
        const dx = mobX - obs.x;
        const dz = mobZ - obs.z;
        if (Math.hypot(dx, dz) < obs.r + 0.55) {
          return true; // 撞树/撞石！
        }
      }
    }
    return false;
  }

  // 野兽对玩家造成伤害 (支持普通攻击与冲撞暴击伤害 overrideDmg)
  mobAttackPlayer(mob, overrideDmg = null) {
    const game = this.game;
    if (!game || !game.survival) return;

    mob.attackCooldownTimer = mob.attackCooldown;
    soundEngine.playPlayerHurt();
    this.flashPlayerHurt();

    // 检查玩家是否装备了蟹壳坚甲木盾
    const inv = game.ui ? game.ui.inventory : {};
    const hasShield = (inv['crab_shield'] || 0) > 0;
    let actualDmg = overrideDmg !== null ? overrideDmg : mob.attackDamage;
    if (hasShield) {
      actualDmg = Math.round(actualDmg * 0.5); // 减免 50%
      if (game.ui) game.ui.showToast(`🛡️ 【坚甲木盾】成功格挡！减免了 50% 伤害！`, 'small');
    }

    // 检查神宠忠诚猎犬贝拉护主减伤特权 (减免 20%)
    if (game.petCompanion) {
      const petRed = game.petCompanion.getDamageReduction();
      if (petRed > 0) {
        actualDmg = Math.round(actualDmg * (1 - petRed));
        if (game.ui) game.ui.showToast(`🐕 【忠诚猎犬贝拉】发出震慑狂吠护主！免伤 20%！`, 'small');
      }
    }

    // 扣除生命
    game.survival.life = Math.max(0, game.survival.life - actualDmg);
    if (game.ui) game.ui.updateSurvivalHUD();

    if (game.ui) {
      const attackName = overrideDmg ? '致命猛烈冲撞' : '猛烈突击';
      game.ui.showToast(`⚠️ 遭受【${mob.name}】${attackName}！生命 -${actualDmg}！`, 'important');
    }

    // 玩家濒死警告
    if (game.survival.life <= 20 && game.ui) {
      game.ui.showToast(`🚨 生命值告急！请迅速撤回营火安全区或食用食物急救！`, 'important');
    }
  }
}
