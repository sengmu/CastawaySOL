import { ISLAND_LAYOUT, distanceXZ } from '../core/IslandLayout.js';
import * as THREE from 'three';
import { modelLoader } from '../core/ModelLoader.js';
import { soundEngine } from '../core/AudioSystem.js';
import { GAME_ASSETS } from '../core/AssetRegistry.js';

export class PlayerController {
  constructor(scene, camera, domElement) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;

    this.group = new THREE.Group();
    this.model = null;

    // 出生点定在岛屿中央开阔广场 (Z=4)
    this.position = new THREE.Vector3().fromArray(ISLAND_LAYOUT.spawn);
    this.rotation = 0;
    this.targetRotation = 0;
    this.velocity = new THREE.Vector3();
    this.speed = 6.0;
    this.runMultiplier = 1.6;
    this.isMoving = false;
    this.isRunning = false;
    this.forceRun = false;

    // 虚拟摇杆输入向量
    this.joystickVector = { x: 0, y: 0 };

    // 跳跃
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.gravity = -24.0;
    this.jumpForce = 8.5;

    // 拟人骨骼步态周期系统
    this.walkCycle = 0;
    this.idleTimer = 0;
    this.stepTimer = 0;
    this.movementWeight = 0; // 0 = 静止待机, 1 = 疾速奔跑，平滑过渡防抽搐

    // 缓存四肢、脊柱、三节尾巴核心骨骼与 SkinnedMesh 骨架
    this.skeletons = [];
    this.bones = {
      legL: null, legR: null,
      kneeL: null, kneeR: null,
      armL: null, armR: null,
      head: null,
      tail1: null, tail2: null, tail3: null,
      spine: null
    };
    this.initialBoneRotations = new Map();

    // 键盘监听
    this.keys = {};
    this.initInput();

    // 黄金第三人称背后视角 (广角开阔透视机位，视野更广，饱览宏大树冠、远景海天与矿机流光)
    this.rotation = Math.PI;       // 角色背对镜头向北
    this.targetRotation = Math.PI;
    this.cameraAngleH = 0;
    this.cameraAngleV = (typeof window !== 'undefined' && window.innerWidth < window.innerHeight) ? 0.40 : 0.58;
    this.baseCameraDistance = 8.8; // 8.8 米宏大开阔黄金基准视距
    this.isPortrait = (typeof window !== 'undefined' && window.innerWidth < window.innerHeight);
    const initialDist = this.isPortrait ? (this.baseCameraDistance * 1.25) : this.baseCameraDistance;
    this.cameraDistance = initialDist;
    this.targetCameraDistance = initialDist;
    this.cameraVelH = 0;           // 偏航角平滑旋转阻尼速度
    this.cameraVelV = 0;           // 俯仰角平滑旋转阻尼速度
    this.cameraTarget = new THREE.Vector3(this.position.x, this.position.y + 1.7, this.position.z - 2.2);

    const horizontalDist = this.cameraDistance * Math.cos(this.cameraAngleV);
    const verticalDist = this.cameraDistance * Math.sin(this.cameraAngleV);
    this.camera.position.set(
      this.position.x + Math.sin(this.cameraAngleH) * horizontalDist,
      this.position.y + verticalDist + 0.8,
      this.position.z + Math.cos(this.cameraAngleH) * horizontalDist
    );
    this.camera.lookAt(this.cameraTarget);

    this.isRightMouseDown = false;
    this.prevMousePos = { x: 0, y: 0 };
    this.touchCameraId = null;
    this.touchLastPos = { x: 0, y: 0 };

    // 战斗与手持武器状态
    this.attackAnimTimer = 0;
    this.attackAnimDuration = 0.35;
    this.isAttacking = false;
    this.attackType = 'spear';
    this.hasSpearEquipped = false;

    this.initMouseAndTouch();
    this.createContactShadow();
    this.createWeaponMeshes();
    this.initFootstepFX();
    this.loadCharacter();

    this.group.position.copy(this.position);
    this.scene.add(this.group);
  }

  // 构建低多边形燧石长矛与简易猎弓 3D 模型
  createWeaponMeshes() {
    this.weaponGroup = new THREE.Group();
    this.weaponGroup.position.set(0.32, 0.45, 0.25); // 右手身侧握持位姿

    // 1. 长矛组件组 (Spear Group)
    this.spearMeshGroup = new THREE.Group();

    // 1.1 笔直光滑木质长矛杆 (长 1.6 米)
    const shaftGeo = new THREE.CylinderGeometry(0.022, 0.024, 1.6, 6);
    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0x8b5a2b, // 质朴原木色
      roughness: 0.8,
      metalness: 0.1,
      flatShading: true
    });
    const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
    shaftMesh.position.y = 0.35;
    shaftMesh.rotation.x = Math.PI / 2.3; // 前倾准备突刺
    this.spearMeshGroup.add(shaftMesh);

    // 1.2 枪头细绳绑带
    const bindGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.12, 6);
    const bindMat = new THREE.MeshStandardMaterial({ color: 0x2d3436 });
    const bindMesh = new THREE.Mesh(bindGeo, bindMat);
    bindMesh.position.set(0, 0.35 + 0.65 * Math.cos(Math.PI / 2.3), -0.65 * Math.sin(Math.PI / 2.3));
    bindMesh.rotation.x = Math.PI / 2.3;
    this.spearMeshGroup.add(bindMesh);

    // 1.3 锋利双面燧石尖刃 (Spearhead)
    const headGeo = new THREE.ConeGeometry(0.065, 0.32, 4);
    headGeo.scale(1.2, 1.0, 0.4); // 扁平锋刃
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x2d3436, // 暗灰黑曜石/燧石
      roughness: 0.3,
      metalness: 0.5,
      flatShading: true
    });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.set(0, 0.35 + 0.88 * Math.cos(Math.PI / 2.3), -0.88 * Math.sin(Math.PI / 2.3));
    headMesh.rotation.x = Math.PI / 2.3 - Math.PI / 2;
    this.spearMeshGroup.add(headMesh);

    // 1.4 突刺破风刀弧 (Slash Wind Arc)
    const arcGeo = new THREE.RingGeometry(0.4, 0.75, 12, 1, 0, Math.PI * 0.75);
    arcGeo.rotateX(-Math.PI / 2);
    const arcMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.slashArcMesh = new THREE.Mesh(arcGeo, arcMat);
    this.slashArcMesh.position.set(0, 0.55, 0.7);
    this.spearMeshGroup.add(this.slashArcMesh);
    this.weaponGroup.add(this.spearMeshGroup);

    // 2. 简易猎弓组件组 (Bow Group)
    this.bowMeshGroup = new THREE.Group();
    // 弯曲弓臂 (用半环管道模拟多边形曲木)
    const bowCurveGeo = new THREE.TorusGeometry(0.45, 0.025, 6, 12, Math.PI * 0.85);
    const bowMat = new THREE.MeshStandardMaterial({
      color: 0x6e421f, // 深褐弹性曲木
      roughness: 0.7,
      flatShading: true
    });
    const bowMesh = new THREE.Mesh(bowCurveGeo, bowMat);
    bowMesh.rotation.set(0, Math.PI / 2, Math.PI * 0.57);
    this.bowMeshGroup.add(bowMesh);

    // 绷紧弓弦 (纤细白色张力弦)
    const stringGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.88, 4);
    const stringMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
    const stringMesh = new THREE.Mesh(stringGeo, stringMat);
    stringMesh.position.set(0.05, 0, 0);
    this.bowMeshGroup.add(stringMesh);

    this.bowMeshGroup.visible = false;
    this.weaponGroup.add(this.bowMeshGroup);

    this.weaponGroup.visible = false; // 初始未装备时不显露
    this.group.add(this.weaponGroup);
  }

  // 触发武器挥刺或拉弓射箭动作表现
  playAttackAnimation(type = 'spear') {
    this.isAttacking = true;
    this.attackType = type;
    this.attackAnimTimer = this.attackAnimDuration;
    if (this.weaponGroup) {
      this.weaponGroup.visible = true;
      if (this.spearMeshGroup) this.spearMeshGroup.visible = (type !== 'bow');
      if (this.bowMeshGroup) this.bowMeshGroup.visible = (type === 'bow');
    }
  }

  // 角色脚底柔和贴地接触阴影 (Contact AO Blob Shadow，彻底消除视觉浮空)
  createContactShadow() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
    grad.addColorStop(0, 'rgba(12, 18, 14, 0.62)');
    grad.addColorStop(0.35, 'rgba(14, 20, 16, 0.42)');
    grad.addColorStop(0.72, 'rgba(16, 24, 18, 0.12)');
    grad.addColorStop(1, 'rgba(16, 24, 18, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(0.85, 0.85);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    this.blobShadow = new THREE.Mesh(geo, mat);
    this.blobShadow.renderOrder = 3;
    this.scene.add(this.blobShadow);
  }

  // 初始化主角奔跑踏地沙尘与浅水涟漪微粒子对象池 (16 枚低开销复用)
  initFootstepFX() {
    this.dustPoolSize = 16;
    this.dustPool = [];
    this.dustMeshGroup = new THREE.Group();
    this.scene.add(this.dustMeshGroup);

    const dustGeo = new THREE.SphereGeometry(0.12, 6, 5);
    dustGeo.scale(1.3, 0.4, 1.3); // 压扁为轻盈贴地烟圈

    for (let i = 0; i < this.dustPoolSize; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xdfcbaf, // 温暖沙土米色
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(dustGeo, mat);
      mesh.visible = false;
      this.dustMeshGroup.add(mesh);
      this.dustPool.push({
        mesh,
        life: 0,
        maxLife: 0.32,
        isWater: false
      });
    }
    this.dustIndex = 0;
    this.footstepSide = 1;
  }

  // 生成踏步沙尘微烟或浅水涟漪
  spawnFootstepFX(isDual = false) {
    if (!this.isGrounded) return;

    const count = isDual ? 2 : 1;
    for (let c = 0; c < count; c++) {
      const item = this.dustPool[this.dustIndex];
      this.dustIndex = (this.dustIndex + 1) % this.dustPoolSize;

      this.footstepSide = -this.footstepSide;
      const sideOffset = (isDual ? (c === 0 ? -0.18 : 0.18) : this.footstepSide * 0.16);

      // 逆移动朝向往身后微喷
      const backX = -Math.sin(this.rotation) * 0.14;
      const backZ = -Math.cos(this.rotation) * 0.14;

      const spawnX = this.position.x + backX + Math.cos(this.rotation) * sideOffset;
      const spawnZ = this.position.z + backZ - Math.sin(this.rotation) * sideOffset;
      const spawnY = Math.max(0.03, this.position.y + 0.025);

      // 检测是否身处浅滩水域 (海岛岸边低洼沙滩与浅水)
      const isWater = this.position.y <= 0.06;
      item.isWater = isWater;
      item.mesh.material.color.setHex(isWater ? 0x98e8ff : 0xdfcbaf);
      item.mesh.position.set(spawnX, spawnY, spawnZ);
      item.mesh.scale.setScalar(0.2);
      item.mesh.visible = true;
      item.life = 1.0;
      item.maxLife = isWater ? 0.42 : 0.32;
    }
  }

  // 逐帧更新沙尘消散与扩散动画
  updateFootstepFX(delta) {
    for (const item of this.dustPool) {
      if (item.life > 0) {
        item.life -= delta / item.maxLife;
        if (item.life <= 0) {
          item.mesh.visible = false;
          continue;
        }
        const progress = 1.0 - item.life;
        const curScale = 0.2 + progress * (item.isWater ? 0.95 : 0.65);
        item.mesh.scale.set(curScale, curScale * 0.32, curScale);
        item.mesh.material.opacity = Math.sin(item.life * Math.PI) * (item.isWater ? 0.45 : 0.38);
        if (!item.isWater) {
          item.mesh.position.y += delta * 0.12; // 干燥沙尘轻微上浮消散
        }
      }
    }
  }

  async loadCharacter() {
    // 采用核心主角模型（3D-PILOT: 自建 3D 荒岛款人类模型，走 GLTFLoader）
    // 若需回退至经典小猫模型，可配置 GAME_ASSETS.player.path 为旧 DAE 路径
    const playerAsset = GAME_ASSETS?.player;
    const playerPath = playerAsset?.path || '/models/protagonist.glb';
    const playerScale = playerAsset?.scale ?? 1.0;
    const playerModel = await modelLoader.loadModel(playerPath, {
      scale: playerScale,
      castShadow: true,
      receiveShadow: true
    });
    this.model = playerModel;
    // 主角渲染提亮：Pixal3D 的 PBR 贴图在场景直射光下正面（背阳面）偏暗偏闷，
    // 与设计稿明亮柔和的渲染观感不符。用自身贴图作 emissiveMap 做贴图自补光，
    // 保留方向性明暗的同时把整体亮度抬回设计稿区间（仅主角，不动场景光照）。
    this.model.traverse((mchild) => {
      if (mchild.isMesh && mchild.material) {
        const pmats = Array.isArray(mchild.material) ? mchild.material : [mchild.material];
        pmats.forEach((pmat) => {
          if (pmat.map && 'emissiveMap' in pmat) {
            pmat.emissiveMap = pmat.map;
            pmat.emissive = new THREE.Color(0xffffff);
            pmat.emissiveIntensity = 0.5;
            pmat.needsUpdate = true;
          }
        });
      }
    });
    this.group.add(this.model);

    // 检索并绑定骨骼关节与 SkinnedMesh 蒙皮骨架
    this.skeletons = [];
    this.model.traverse((child) => {
      if (child.isSkinnedMesh && child.skeleton) {
        if (!this.skeletons.includes(child.skeleton)) {
          this.skeletons.push(child.skeleton);
        }
      }

      if (child.isBone || child.type === 'Bone') {
        const n = child.name || '';
        const isNotSub = !n.includes('_Sub');

        if ((n === 'Leg_1_L' || n.endsWith('Leg_1_L')) && isNotSub) this.bones.legL = child;
        else if ((n === 'Leg_1_R' || n.endsWith('Leg_1_R')) && isNotSub) this.bones.legR = child;
        else if ((n === 'Leg_2_L' || n.endsWith('Leg_2_L')) && isNotSub) this.bones.kneeL = child;
        else if ((n === 'Leg_2_R' || n.endsWith('Leg_2_R')) && isNotSub) this.bones.kneeR = child;
        else if ((n === 'Arm_1_L' || n.endsWith('Arm_1_L')) && isNotSub) this.bones.armL = child;
        else if ((n === 'Arm_1_R' || n.endsWith('Arm_1_R')) && isNotSub) this.bones.armR = child;
        else if ((n === 'Arm_2_L' || n.endsWith('Arm_2_L')) && isNotSub) this.bones.forearmL = child;
        else if ((n === 'Arm_2_R' || n.endsWith('Arm_2_R')) && isNotSub) this.bones.forearmR = child;
        else if (n === 'Head' || n.endsWith('Head')) this.bones.head = child;
        else if (n === 'S_Tail_1') this.bones.tail1 = child;
        else if (n === 'S_Tail_2') this.bones.tail2 = child;
        else if (n === 'S_Tail_3') this.bones.tail3 = child;
        else if (n === 'Spine_1') this.bones.spine = child;

        // 保存骨骼的初始绑定姿势
        this.initialBoneRotations.set(child, child.rotation.clone());
      }
    });

    console.log(`[Player] Current Character loaded. Bones mapped. Skeletons: ${this.skeletons.length}, Tail1: ${!!this.bones.tail1}`);
  }

  initInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      soundEngine.init();
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // 关键防粘键机制：窗口失焦、Tab切换、页面隐藏时强制清空所有按键与摇杆向量
    const safeReset = () => this.resetInput();
    window.addEventListener('blur', safeReset);
    window.addEventListener('focus', safeReset);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) safeReset();
    });
    window.addEventListener('contextmenu', safeReset);
  }

  // 立即清空所有输入与移动向量（弹窗、失焦、切换时稳妥刹车）
  resetInput() {
    this.keys = {};
    this.joystickVector = { x: 0, y: 0 };
    this.isMoving = false;
    this.isRightMouseDown = false;
    this.touchCameraId = null;
  }

  initMouseAndTouch() {
    this.domElement.addEventListener('mousedown', (e) => {
      if (e.button === 2) {
        this.isRightMouseDown = true;
        this.prevMousePos = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        this.isRightMouseDown = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isRightMouseDown) {
        const deltaX = e.clientX - this.prevMousePos.x;
        const deltaY = e.clientY - this.prevMousePos.y;
        this.cameraAngleH -= deltaX * 0.005;
        this.cameraAngleV = Math.max(0.45, Math.min(1.35, this.cameraAngleV + deltaY * 0.004));
        this.prevMousePos = { x: e.clientX, y: e.clientY };
      }
    });

    this.domElement.addEventListener('wheel', (e) => {
      this.targetCameraDistance = Math.max(5.5, Math.min(22.0, this.targetCameraDistance + e.deltaY * 0.01));
    });

    // 移动端右半屏滑动转动视角与双指捏合缩放 (具备避让UI热区与惯性阻尼系统)
    this.pinchDist = null;

    this.domElement.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.pinchDist = Math.hypot(dx, dy);
        return;
      }

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        // 避让左侧摇杆感应区 (0.45vw) 与右下角动作控制盘热区
        if (t.clientX > window.innerWidth * 0.45) {
          const elem = document.elementFromPoint(t.clientX, t.clientY);
          if (elem && elem.closest('.mobile-action-zone, button, .aux-btn, .main-action-capsule, .hud-nav-item, .modal-backdrop, .bottom-quick-bar, .recipe-craft-drawer')) {
            continue; // 玩家点击的是操作按键，不转动视角，防止战斗与互动视角乱甩
          }
          this.touchCameraId = t.identifier;
          this.touchLastPos = { x: t.clientX, y: t.clientY };
          this.cameraVelH = 0;
          this.cameraVelV = 0;
          break;
        }
      }
    }, { passive: true });

    this.domElement.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && this.pinchDist !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const newDist = Math.hypot(dx, dy);
        const deltaDist = this.pinchDist - newDist;
        this.targetCameraDistance = Math.max(5.5, Math.min(22.0, this.targetCameraDistance + deltaDist * 0.035));
        this.pinchDist = newDist;
        return;
      }

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.touchCameraId) {
          const dx = t.clientX - this.touchLastPos.x;
          const dy = t.clientY - this.touchLastPos.y;
          // 累加平滑旋转角速度
          this.cameraVelH += -dx * 0.0038;
          this.cameraVelV += dy * 0.0030;
          this.touchLastPos = { x: t.clientX, y: t.clientY };
          break;
        }
      }
    }, { passive: true });

    const clearTouch = (e) => {
      if (!e.touches || e.touches.length < 2) {
        this.pinchDist = null;
      }
      if (!e.touches || e.touches.length === 0) {
        this.touchCameraId = null;
        return;
      }
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.touchCameraId) {
          this.touchCameraId = null;
          break;
        }
      }
    };

    this.domElement.addEventListener('touchend', clearTouch, { passive: true });
    this.domElement.addEventListener('touchcancel', clearTouch, { passive: true });

    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  jump() {
    if (this.isGrounded) {
      this.verticalVelocity = this.jumpForce;
      this.isGrounded = false;
      soundEngine.playFootstep();
      this.spawnFootstepFX(true); // 起跳双脚爆发踏地微尘
    }
  }

  setJoystickVector(vec) {
    this.joystickVector = vec;
  }

  update(delta) {
    // 对显式标记的实体做圆形阻挡，地面、水面、树冠不参与。
    // 关键修复：必须检查物体及其祖先节点的可见性，严禁让未激活的跨岛场景或隐藏物体的碰撞盒变成阻挡行走的“隐形空气墙”
    const obstacles = [];
    const boxes = [];
    const surfaces = [];
    this.scene.traverse(object => {
      // 检查当前物体及其所有祖先节点是否在世界树中真实可见
      let isHierarchyVisible = object.visible;
      for (let p = object.parent; p; p = p.parent) {
        if (!p.visible) {
          isHierarchyVisible = false;
          break;
        }
      }
      if (!isHierarchyVisible) return;

      if (object.userData.walkSurface || object.userData.movementSurface) surfaces.push(object);
      if (object.userData.movementBox) {
        object.updateWorldMatrix(true, true);
        const bounds = new THREE.Box3();
        object.traverseVisible(child => {
          if (child.isMesh && !/shadow/i.test(child.name)) bounds.union(new THREE.Box3().setFromObject(child, true));
        });
        if (!bounds.isEmpty()) boxes.push(bounds);
      }
      if (object.userData.movementRadius > 0) {
        obstacles.push({ center: object.getWorldPosition(new THREE.Vector3()), radius: object.userData.movementRadius + 0.35 });
      }
    });
    const groundRay = new THREE.Raycaster();
    const groundAt = (x, z) => {
      groundRay.set(new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0));
      return groundRay.intersectObjects(surfaces, false)[0]?.point.y ?? 0;
    };
    let moveX = 0;
    let moveZ = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveZ -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveZ += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveX -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX += 1;

    if (Math.abs(this.joystickVector.x) > 0.05 || Math.abs(this.joystickVector.y) > 0.05) {
      moveX = this.joystickVector.x;
      moveZ = this.joystickVector.y;
    }

    this.isRunning = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.forceRun);
    let petSpeedMultiplier = 1.0;
    if (typeof window !== 'undefined' && window.__game && window.__game.petCompanion && window.__game.petCompanion.activePetId === 'dom_sheep') {
      petSpeedMultiplier = 1.10; // 金羊多姆随行耐力移速 +10%
    }
    const currentSpeed = this.speed * (this.isRunning ? this.runMultiplier : 1.0) * petSpeedMultiplier;

    const inputDir = new THREE.Vector3(moveX, 0, moveZ);
    const len = inputDir.length();

    if (len > 0.05) {
      if (len > 1.0) inputDir.normalize();
      this.isMoving = true;

      // 根据相机偏航角进行方向重投影
      inputDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraAngleH);

      this.targetRotation = Math.atan2(inputDir.x, inputDir.z);
      const rotDiff = Math.atan2(Math.sin(this.targetRotation - this.rotation), Math.cos(this.targetRotation - this.rotation));
      this.rotation += rotDiff * 14.0 * delta;

      // 分段推进并沿障碍表面滑动，防止低帧率下直接穿过岩石。
      const distance = currentSpeed * delta * inputDir.length();
      const segments = Math.max(1, Math.ceil(distance / 0.15));
      for (let step = 0; step < segments; step++) {
        const oldX = this.position.x;
        const oldZ = this.position.z;
        const oldGround = groundAt(oldX, oldZ);
        this.position.x += inputDir.x * currentSpeed * delta / segments;
        this.position.z += inputDir.z * currentSpeed * delta / segments;
        for (let pass = 0; pass < 3; pass++) {
          for (const box of boxes) {
            if (box.max.y < oldGround + 0.1 || box.min.y > this.position.y + 1.2) continue;
            const minX = box.min.x - 0.35, maxX = box.max.x + 0.35;
            const minZ = box.min.z - 0.35, maxZ = box.max.z + 0.35;
            if (this.position.x > minX && this.position.x < maxX && this.position.z > minZ && this.position.z < maxZ) {
              const edges = [this.position.x - minX, maxX - this.position.x, this.position.z - minZ, maxZ - this.position.z];
              const edge = edges.indexOf(Math.min(...edges));
              if (edge === 0) this.position.x = minX;
              else if (edge === 1) this.position.x = maxX;
              else if (edge === 2) this.position.z = minZ;
              else this.position.z = maxZ;
            }
          }
          for (const obstacle of obstacles) {
            if (obstacle.center.y > this.position.y + 1.2) continue;
            const dx = this.position.x - obstacle.center.x;
            const dz = this.position.z - obstacle.center.z;
            const length = Math.hypot(dx, dz);
            if (length < obstacle.radius) {
              const nx = length > 0.0001 ? dx / length : 1;
              const nz = length > 0.0001 ? dz / length : 0;
              this.position.x = obstacle.center.x + nx * obstacle.radius;
              this.position.z = obstacle.center.z + nz * obstacle.radius;
            }
          }
        }
        if (groundAt(this.position.x, this.position.z) > oldGround + 0.4) {
          this.position.x = oldX;
          this.position.z = oldZ;
        }
      }

      // 沙滩外轮廓为49×42半尺寸，预留1米海岸安全距离。
      // 圆角也要约束，不能只放大矩形边界而允许从角落走入海面。
      const onPier = Math.abs(this.position.x - ISLAND_LAYOUT.pier[0]) <= 2.8 &&
        this.position.z >= 30 && this.position.z <= 46.5;
      if (!onPier) {
      this.position.x = THREE.MathUtils.clamp(this.position.x, -48, 48);
      this.position.z = THREE.MathUtils.clamp(this.position.z, -41, 41);
      const cornerX = Math.max(0, Math.abs(this.position.x) - 36);
      const cornerZ = Math.max(0, Math.abs(this.position.z) - 29);
      const cornerDistance = Math.hypot(cornerX, cornerZ);
      if (cornerDistance > 12) {
        this.position.x = Math.sign(this.position.x) * (36 + cornerX * 12 / cornerDistance);
        this.position.z = Math.sign(this.position.z) * (29 + cornerZ * 12 / cornerDistance);
      }
      }

      // 灵动轻快脚步声与踏步扬尘
      this.stepTimer += delta * (this.isRunning ? 1.6 : 1.0);
      if (this.stepTimer > 0.28) {
        soundEngine.playFootstep();
        this.spawnFootstepFX(false);
        this.stepTimer = 0;
      }

      // 步态周期推进
      this.walkCycle += delta * (this.isRunning ? 20 : 13);
    } else {
      this.isMoving = false;
      this.idleTimer += delta;
    }

    // 平滑插值运动权重 (0.0 待机 ~ 1.0 全速移动)
    this.movementWeight = THREE.MathUtils.lerp(
      this.movementWeight,
      this.isMoving ? 1.0 : 0.0,
      12.0 * delta
    );

    // 驱动骨骼动画
    this.animateSkeletalLocomotion(delta);

    // 跳跃与重力物理
    if (this.keys['Space']) {
      this.jump();
    }

    const groundHeight = groundAt(this.position.x, this.position.z);
    if (this.isGrounded) this.position.y = groundHeight;
    if (!this.isGrounded) {
      this.verticalVelocity += this.gravity * delta;
      this.position.y += this.verticalVelocity * delta;

      if (this.position.y <= groundHeight) {
        this.position.y = groundHeight;
        this.verticalVelocity = 0;
        this.isGrounded = true;
      }
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.rotation;

    // 同步贴地接触阴影
    if (this.blobShadow) {
      const heightAboveGround = Math.max(0, this.position.y - groundHeight);
      this.blobShadow.position.set(this.position.x, groundHeight + 0.018, this.position.z);
      const shadowScale = 1.0 + heightAboveGround * 0.28;
      this.blobShadow.scale.set(shadowScale, 1.0, shadowScale);
      this.blobShadow.material.opacity = Math.max(0, 0.85 - heightAboveGround * 0.45);
    }

    this.updateFootstepFX(delta);
    this.updateCamera(delta);
  }

  // 骨骼动力学运动与待机动画
  animateSkeletalLocomotion(delta) {
    if (!this.model) return;

    const w = this.movementWeight;
    const isRun = this.isRunning;

    // 1. 双腿交替摆动 (迈大步前蹬与后摆)
    const legAmp = (isRun ? 0.75 : 0.48) * w;
    const legSwing = Math.sin(this.walkCycle) * legAmp;

    if (this.bones.legL && this.initialBoneRotations.has(this.bones.legL)) {
      const initL = this.initialBoneRotations.get(this.bones.legL);
      this.bones.legL.rotation.x = initL.x + legSwing;
      this.bones.legL.rotation.z = initL.z + (isRun ? 0.05 : 0.02) * w;
    }

    if (this.bones.legR && this.initialBoneRotations.has(this.bones.legR)) {
      const initR = this.initialBoneRotations.get(this.bones.legR);
      this.bones.legR.rotation.x = initR.x - legSwing;
      this.bones.legR.rotation.z = initR.z - (isRun ? 0.05 : 0.02) * w;
    }

    // 2. 膝盖弯折 (小腿离地前迈时自然屈膝)
    if (this.bones.kneeL && this.initialBoneRotations.has(this.bones.kneeL)) {
      const initKL = this.initialBoneRotations.get(this.bones.kneeL);
      const kneeFlexL = Math.max(0, -Math.sin(this.walkCycle)) * 0.45 * w;
      this.bones.kneeL.rotation.x = initKL.x + kneeFlexL;
    }
    if (this.bones.kneeR && this.initialBoneRotations.has(this.bones.kneeR)) {
      const initKR = this.initialBoneRotations.get(this.bones.kneeR);
      const kneeFlexR = Math.max(0, Math.sin(this.walkCycle)) * 0.45 * w;
      this.bones.kneeR.rotation.x = initKR.x + kneeFlexR;
    }

    // 3. 手臂自然下垂与交替摆臂 (双手服帖垂顺在身体两侧)
    const baseArmDrop = 0.95; // 待机与行走时双手自然下垂贴于身体两侧约 55°
    const armAmp = (isRun ? 0.75 : 0.45) * w;
    const armSwing = Math.sin(this.walkCycle) * armAmp;
    const armBreathe = Math.sin(this.idleTimer * 1.8) * 0.03 * (1.0 - w);

    // 突刺与拉弓射箭动力学叠加
    let attackProgress = 0;
    let attackThrust = 0;
    const isBowAttack = (this.attackType === 'bow');

    if (this.attackAnimTimer > 0) {
      this.attackAnimTimer -= delta;
      attackProgress = Math.max(0, 1.0 - (this.attackAnimTimer / this.attackAnimDuration));
      attackThrust = Math.sin(attackProgress * Math.PI); // 0 -> 1 -> 0

      if (isBowAttack) {
        if (this.slashArcMesh) this.slashArcMesh.material.opacity = 0;
        if (this.weaponGroup) {
          this.weaponGroup.position.set(0.05, 0.48, 0.32);
          this.weaponGroup.rotation.set(0, 0, 0);
        }
      } else {
        if (this.slashArcMesh) {
          this.slashArcMesh.material.opacity = attackThrust * 0.85;
          this.slashArcMesh.rotation.y = attackProgress * 1.2;
        }
        if (this.weaponGroup) {
          this.weaponGroup.position.z = 0.25 + attackThrust * 0.85; // 迅猛前刺位移
          this.weaponGroup.rotation.x = -attackThrust * 0.35;
        }
      }

      if (this.attackAnimTimer <= 0) {
        this.isAttacking = false;
        if (this.slashArcMesh) this.slashArcMesh.material.opacity = 0;
        if (this.weaponGroup) {
          this.weaponGroup.position.set(0.32, 0.45, 0.25);
          this.weaponGroup.rotation.set(0, 0, 0);
          this.weaponGroup.visible = this.hasSpearEquipped;
        }
      }
    }

    if (this.bones.armL && this.initialBoneRotations.has(this.bones.armL)) {
      const initAL = this.initialBoneRotations.get(this.bones.armL);
      if (this.attackAnimTimer > 0 && isBowAttack) {
        // 左手水平向前坚定推举猎弓把手！
        this.bones.armL.rotation.x = initAL.x - Math.PI / 2.1;
        this.bones.armL.rotation.z = initAL.z + 0.15;
      } else {
        this.bones.armL.rotation.x = initAL.x - armSwing;
        this.bones.armL.rotation.z = initAL.z - baseArmDrop - (isRun ? 0.25 : 0.05) * w + armBreathe;
      }
    }
    if (this.bones.armR && this.initialBoneRotations.has(this.bones.armR)) {
      const initAR = this.initialBoneRotations.get(this.bones.armR);
      if (this.attackAnimTimer > 0) {
        if (isBowAttack) {
          // 右手张弦向后蓄力拉满并在峰值释放放弦！
          const drawString = Math.sin(Math.min(1.0, attackProgress * 1.3) * Math.PI * 0.5);
          this.bones.armR.rotation.x = initAR.x - Math.PI / 2.3 + drawString * 0.32;
          this.bones.armR.rotation.z = initAR.z - 0.28;
        } else {
          // 攻击突刺时右手平举向前猛刺！
          this.bones.armR.rotation.x = initAR.x - Math.PI / 2.2 - attackThrust * 0.45;
          this.bones.armR.rotation.z = initAR.z - 0.2;
        }
      } else {
        this.bones.armR.rotation.x = initAR.x + armSwing;
        this.bones.armR.rotation.z = initAR.z - baseArmDrop - (isRun ? 0.25 : 0.05) * w - armBreathe;
      }
    }

    // 4. 三节尾巴真·自然向上卷曲弧度动力学 (J字形高耸圆润月牙弧 + 奔跑灵动摆动)
    const cycle = this.walkCycle * 1.5;
    const idleC = this.idleTimer * 1.6;

    const baseArchY1 = 0.65;
    const baseArchY2 = 0.85;
    const baseArchY3 = 0.95;

    const baseLiftZ1 = 0.45;
    const baseLiftZ2 = 0.65;
    const baseLiftZ3 = 0.75;

    const tailBounce = Math.cos(this.walkCycle * 2) * 0.15 * w;
    const idleBreathe = Math.sin(idleC) * 0.08 * (1.0 - w);

    if (this.bones.tail1 && this.initialBoneRotations.has(this.bones.tail1)) {
      const init1 = this.initialBoneRotations.get(this.bones.tail1);
      const swing1 = Math.sin(cycle) * 0.28 * w + Math.sin(idleC) * 0.16 * (1.0 - w);
      this.bones.tail1.rotation.y = init1.y + baseArchY1 + swing1;
      this.bones.tail1.rotation.z = init1.z + baseLiftZ1 + tailBounce + idleBreathe;
    }

    if (this.bones.tail2 && this.initialBoneRotations.has(this.bones.tail2)) {
      const init2 = this.initialBoneRotations.get(this.bones.tail2);
      const swing2 = Math.sin(cycle - 0.65) * 0.52 * w + Math.sin(idleC - 0.5) * 0.25 * (1.0 - w);
      this.bones.tail2.rotation.y = init2.y + baseArchY2 + swing2;
      this.bones.tail2.rotation.z = init2.z + baseLiftZ2 + tailBounce * 1.2;
    }

    if (this.bones.tail3 && this.initialBoneRotations.has(this.bones.tail3)) {
      const init3 = this.initialBoneRotations.get(this.bones.tail3);
      const swing3 = Math.sin(cycle - 1.3) * 0.85 * w + Math.sin(idleC - 1.0) * 0.38 * (1.0 - w);
      this.bones.tail3.rotation.y = init3.y + baseArchY3 + swing3;
      this.bones.tail3.rotation.z = init3.z + baseLiftZ3 + tailBounce * 1.5;
    }

    // 5. 头部点动与呆萌张望
    if (this.bones.head && this.initialBoneRotations.has(this.bones.head)) {
      const initHead = this.initialBoneRotations.get(this.bones.head);
      const headNod = Math.sin(this.walkCycle * 2) * 0.05 * w;
      const headBreathe = Math.sin(this.idleTimer * 2.2) * 0.03 * (1.0 - w);
      this.bones.head.rotation.x = initHead.x + headNod + headBreathe;
    }

    // 6. 身体整体上下颠簸与左右扭胯
    const stepBob = Math.abs(Math.sin(this.walkCycle)) * (isRun ? 0.08 : 0.04) * w;
    const breatheBob = Math.sin(this.idleTimer * 2.0) * 0.012 * (1.0 - w);
    this.model.position.y = stepBob + breatheBob;

    const hipSway = Math.sin(this.walkCycle) * 0.04 * w;
    this.model.rotation.z = hipSway;

    // 7. 空中跳跃姿态
    if (!this.isGrounded) {
      if (this.bones.armL && this.bones.armR) {
        this.bones.armL.rotation.z -= 0.3;
        this.bones.armR.rotation.z += 0.3;
      }
      if (this.bones.legL && this.bones.legR) {
        this.bones.legL.rotation.x = 0.2;
        this.bones.legR.rotation.x = -0.2;
      }
    }

    // 8. 刷新骨骼世界矩阵
    this.model.updateMatrixWorld(true);
    for (let i = 0; i < this.skeletons.length; i++) {
      this.skeletons[i].update();
    }
  }

  updateCamera(delta) {
    // 1. 惯性平滑阻尼更新偏航角与俯仰角 (电影级云台阻尼感，俯仰角范围更宽广)
    this.cameraAngleH += this.cameraVelH;
    this.cameraAngleV += this.cameraVelV;
    this.cameraAngleV = Math.max(0.26, Math.min(1.42, this.cameraAngleV));

    // 指数平滑衰减
    const damping = Math.exp(-16.0 * delta);
    this.cameraVelH *= damping;
    this.cameraVelV *= damping;

    // 2. 视距平滑过渡 (Smooth Zoom Lerp) + 移动与疾跑时动态广角后拉 (探索视野大 25%)
    const speedPullback = this.isMoving ? (this.isRunning ? 1.5 : 0.85) : 0.0;
    const portraitOffset = this.isPortrait ? 1.8 : 0.0;
    const desiredDistance = this.targetCameraDistance + speedPullback + portraitOffset;
    this.cameraDistance = THREE.MathUtils.lerp(this.cameraDistance, desiredDistance, Math.min(1.0, 8.0 * delta));

    const horizontalDist = this.cameraDistance * Math.cos(this.cameraAngleV);
    const verticalDist = this.cameraDistance * Math.sin(this.cameraAngleV);

    const targetCamX = this.position.x + Math.sin(this.cameraAngleH) * horizontalDist;
    const targetCamZ = this.position.z + Math.cos(this.cameraAngleH) * horizontalDist;
    const targetCamY = this.position.y + verticalDist + 0.65;

    this.camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 12.0 * delta);

    // 黄金视距重构：视点居中小猫上身，将主角提升至屏幕黄金分割点（垂直约 45% 适中高度），不再沉底或被底部UI遮挡
    const forwardLookZ = this.isPortrait ? -2.0 : -0.6;
    const lookTargetY = this.position.y + 0.95;
    this.cameraTarget.lerp(new THREE.Vector3(this.position.x, lookTargetY, this.position.z + forwardLookZ), 12.0 * delta);
    this.camera.lookAt(this.cameraTarget);
  }

  // 跨场景或传送时瞬时对齐相机机位与朝向，彻底杜绝角度残留与视角穿帮
  onOrientationChange(isPortrait) {
    this.isPortrait = isPortrait;
    // 竖屏切换时平滑推拉基准相机视距
    const base = isPortrait ? (this.baseCameraDistance * 1.25) : this.baseCameraDistance;
    this.targetCameraDistance = THREE.MathUtils.clamp(this.targetCameraDistance, base * 0.8, base * 1.8);
  }

  snapCamera(angleH = 0, angleV = 0.50, distance = 11.0) {
    this.cameraAngleH = angleH;
    this.cameraAngleV = angleV;
    this.cameraDistance = distance;
    this.targetCameraDistance = distance;
    this.cameraVelH = 0;
    this.cameraVelV = 0;

    const horizontalDist = this.cameraDistance * Math.cos(this.cameraAngleV);
    const verticalDist = this.cameraDistance * Math.sin(this.cameraAngleV);

    const targetCamX = this.position.x + Math.sin(this.cameraAngleH) * horizontalDist;
    const targetCamZ = this.position.z + Math.cos(this.cameraAngleH) * horizontalDist;
    const targetCamY = this.position.y + verticalDist + 0.65;

    this.camera.position.set(targetCamX, targetCamY, targetCamZ);

    const forwardLookZ = (angleH === 0) ? -4.0 : -0.6;
    const lookTargetY = this.position.y + 0.95;
    this.cameraTarget.set(this.position.x, lookTargetY, this.position.z + forwardLookZ);
    this.camera.lookAt(this.cameraTarget);
  }
}
