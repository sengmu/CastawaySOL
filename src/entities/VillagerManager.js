import * as THREE from 'three';
import { ACNH_ASSETS } from '../core/AssetRegistry.js';
import { modelLoader } from '../core/ModelLoader.js';

export class VillagerManager {
  constructor(scene) {
    this.scene = scene;
    this.villagers = [];
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.time = 0;

    // 居民日常作息时间表与生活情境定义 (晨曦梳洗、白昼巡逻采摘、黄昏围炉烤火、夜间安眠就寝)
    this.routines = {
      second_kid: {
        sunrise: {
          targetPos: new THREE.Vector3(-9.5, 0.05, 26.2), // 晨曦营地净水溪畔
          targetRot: 0.9,
          action: 'freshen_up',
          actionDesc: '在清凉溪水边打水梳洗',
          dialogs: [
            '🌸 早安！清晨的泉水甘甜清凉，整个人都神清气爽了呢！',
            '今天的天空是一片温润的晨曦，海风吹拂着好舒服～今天也要元气满满哦！'
          ]
        },
        day: [
          {
            targetPos: new THREE.Vector3(-15.5, 0.05, 18.5), // 营地北侧果树带采摘
            targetRot: -0.4,
            action: 'gathering',
            actionDesc: '在果树下采摘新鲜野果',
            duration: 35.0,
            dialogs: [
              '🍎 阳光真好！果园里的红苹果散发着诱人香气，今天采摘收获满满呢！',
              '有你在身边一起经营打理营地，每天的荒岛求生都充满了希望！'
            ]
          },
          {
            targetPos: new THREE.Vector3(-11.2, 0.05, 25.2), // 净水滴滤台旁
            targetRot: 0.4,
            action: 'inspect_water',
            actionDesc: '检查净水滴滤台蓄水',
            duration: 30.0,
            dialogs: [
              '🚰 我在帮净水滴滤台添柴蒸馏呢！水壶喝空了随时过来装满清水哦！',
              '在这个孤岛上能有源源不断的甘甜淡水，真是最踏实的保障了～'
            ]
          },
          {
            targetPos: new THREE.Vector3(-13.0, 0.05, 22.4), // 营地经营告示板前
            targetRot: 2.8,
            action: 'reading_board',
            actionDesc: '在营地经营告示板前核对分工',
            duration: 30.0,
            dialogs: [
              '📋 今天的营地物资清单很清晰！大家各司其职，我们的家园越来越繁荣啦！',
              '看看今天还需要采集什么材料，我们一起把出海大木筏建造得更加坚固吧！'
            ]
          }
        ],
        sunset: {
          targetPos: new THREE.Vector3(-13.2, 0.05, 24.4), // 营地中央篝火西侧暖座
          targetRot: 1.2,
          action: 'warming',
          actionDesc: '在篝火旁揉手烤火取暖',
          dialogs: [
            '🔥 坐在暖烘烘的篝火旁看着海面落日，感觉这里越来越像一个温馨的避风家园了……',
            '晚上海风开始变凉了呢，快来火塘边烤烤手，暖和极了～'
          ]
        },
        night: {
          targetPos: new THREE.Vector3(-16.2, 0.05, 23.6), // 西南主营地帐篷旁
          targetRot: 0.4,
          action: 'sleeping',
          actionDesc: '在柔软的树叶木床上安稳就寝',
          dialogs: [
            '💤 呼……呼……（艾莉已经抱着柔软的树叶枕头沉沉睡着了，嘴角挂着安心甜美的微笑）',
            '😴 嘘……（小声）明天还要早起出海呢，今晚好好休息，做个香甜的美梦呀……'
          ]
        }
      },
      raymond: {
        sunrise: {
          targetPos: new THREE.Vector3(-12.2, 0.05, 21.0),
          targetRot: -0.3,
          action: 'planning',
          actionDesc: '推眼镜核对今日工匠图纸',
          dialogs: [
            '📐 早安，根据今日晨光偏角与湿度，今日极适宜进行木工作业与方料烘干。',
            '严谨与逻辑，是文明在这座荒岛上重新萌芽的基石。'
          ]
        },
        day: [
          {
            targetPos: new THREE.Vector3(-20.0, 0.05, 34.0), // 西南码头船坞
            targetRot: 0.2,
            action: 'crafting',
            actionDesc: '在西南码头船坞检修龙骨与缆绳',
            duration: 40.0,
            dialogs: [
              '⚓ 我在检修船坞的龙骨受力结构与榫卯接合处，出海航行的安全性容不得半点含糊。',
              '只要备足坚韧的重型方木和铁钉，我们甚至能建造出足以抵御暴风雨的远洋探索舰！'
            ]
          },
          {
            targetPos: new THREE.Vector3(-14.2, 0.05, 22.8), // 营地工匠木工箱
            targetRot: 1.1,
            action: 'working_wood',
            actionDesc: '在工匠工作台加工方木与铁钉',
            duration: 35.0,
            dialogs: [
              '🔨 我在工匠台将散乱粗木加工为标准化原木方料，这样搭建的设施才具有结构强度。',
              '时刻保持工具分门别类，能将全天的工作效率提高至少 35%。'
            ]
          }
        ],
        sunset: {
          targetPos: new THREE.Vector3(-10.8, 0.05, 23.8), // 篝火另一侧木桩
          targetRot: -1.3,
          action: 'warming',
          actionDesc: '在篝火旁记录航海日志',
          dialogs: [
            '🪵 火焰是人类驱散荒野黑暗最伟大的发明。今日的航海水文数据已经记录归档完毕。',
            '来坐会儿吧，今晚近海洋流很平缓，明早或许是个出航探索的好天气。'
          ]
        },
        night: {
          targetPos: new THREE.Vector3(-17.8, 0.05, 22.4), // 营地避风棚
          targetRot: 0.6,
          action: 'sleeping',
          actionDesc: '取下眼镜安歇就寝',
          dialogs: [
            '💤 呼……呼……（学者雷蒙德端正地躺在睡袋里，眼镜整齐叠放在手边，呼吸均匀沉稳）'
          ]
        }
      }
    };

    // 初始需要加载的角色
    this.spawnConfigs = [
      { id: 'bub_monkey', pos: new THREE.Vector3(12.0, 0, -8.0), rot: -1.8 },
      { id: 'second_kid', pos: new THREE.Vector3(23.0, 1.8, -17.0), rot: 0.2 }
    ];

    // 初始化睡眠 Zzz 粒子特效系统
    this.initSleepZzzFX();

    this.initVillagers();
  }

  // 初始化睡眠温润浮升 Zzz 微粒子 (6 枚复用)
  initSleepZzzFX() {
    this.zzzPool = [];
    this.zzzGroup = new THREE.Group();
    this.scene.add(this.zzzGroup);

    const geo = new THREE.SphereGeometry(0.08, 6, 5);
    geo.scale(1.2, 0.6, 1.2);

    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x9be5ff,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.zzzGroup.add(mesh);
      this.zzzPool.push({
        mesh,
        life: 0,
        maxLife: 2.2,
        baseX: 0,
        baseY: 0,
        baseZ: 0,
        swaySpeed: 2.0 + Math.random()
      });
    }
    this.zzzIndex = 0;
    this.zzzTimer = 0;
  }

  spawnZzzParticle(x, y, z) {
    const item = this.zzzPool[this.zzzIndex];
    this.zzzIndex = (this.zzzIndex + 1) % this.zzzPool.length;
    item.baseX = x + (Math.random() - 0.5) * 0.25;
    item.baseY = y;
    item.baseZ = z + (Math.random() - 0.5) * 0.25;
    item.mesh.position.set(item.baseX, item.baseY, item.baseZ);
    item.mesh.scale.setScalar(0.4);
    item.mesh.visible = true;
    item.life = 1.0;
  }

  updateSleepZzzFX(delta) {
    for (const item of this.zzzPool) {
      if (item.life > 0) {
        item.life -= delta / item.maxLife;
        if (item.life <= 0) {
          item.mesh.visible = false;
          continue;
        }
        const progress = 1.0 - item.life;
        item.mesh.position.y = item.baseY + progress * 1.2;
        item.mesh.position.x = item.baseX + Math.sin(progress * Math.PI * 3.0) * 0.18;
        const scale = 0.4 + progress * 0.7;
        item.mesh.scale.setScalar(scale);
        item.mesh.material.opacity = Math.sin(item.life * Math.PI) * 0.75;
      }
    }
  }

  async initVillagers() {
    for (const conf of this.spawnConfigs) {
      await this.loadSingleVillager(conf);
    }
  }

  async loadSingleVillager(conf) {
    const info = ACNH_ASSETS.npcs[conf.id];
    if (!info) return null;

    const model = await modelLoader.loadModel(info.path, {
      scale: info.scale || 0.8,
      castShadow: true,
      receiveShadow: true
    });

    const wrapper = new THREE.Group();
    wrapper.position.copy(conf.pos);
    wrapper.rotation.y = conf.rot;
    wrapper.add(model);

    // 绑定骨骼关节
    const skeletons = [];
    const bones = { legL: null, legR: null, kneeL: null, kneeR: null, armL: null, armR: null, forearmL: null, forearmR: null, head: null, tail1: null, tail2: null, tail3: null };
    const initRots = new Map();

    model.traverse((child) => {
      if (child.isSkinnedMesh && child.skeleton) {
        if (!skeletons.includes(child.skeleton)) skeletons.push(child.skeleton);
      }
      if (child.isBone || child.type === 'Bone') {
        const n = child.name || '';
        const isNotSub = !n.includes('_Sub');
        if ((n === 'Leg_1_L' || n.endsWith('Leg_1_L')) && isNotSub) bones.legL = child;
        else if ((n === 'Leg_1_R' || n.endsWith('Leg_1_R')) && isNotSub) bones.legR = child;
        else if ((n === 'Leg_2_L' || n.endsWith('Leg_2_L')) && isNotSub) bones.kneeL = child;
        else if ((n === 'Leg_2_R' || n.endsWith('Leg_2_R')) && isNotSub) bones.kneeR = child;
        else if ((n === 'Arm_1_L' || n.endsWith('Arm_1_L')) && isNotSub) bones.armL = child;
        else if ((n === 'Arm_1_R' || n.endsWith('Arm_1_R')) && isNotSub) bones.armR = child;
        else if ((n === 'Arm_2_L' || n.endsWith('Arm_2_L')) && isNotSub) bones.forearmL = child;
        else if ((n === 'Arm_2_R' || n.endsWith('Arm_2_R')) && isNotSub) bones.forearmR = child;
        else if (n === 'Head' || n.endsWith('Head')) bones.head = child;
        else if (n === 'S_Tail_1' || n === 'Tail_1') bones.tail1 = child;
        else if (n === 'S_Tail_2' || n === 'Tail_2') bones.tail2 = child;
        else if (n === 'S_Tail_3') bones.tail3 = child;

        initRots.set(child, child.rotation.clone());
      }
    });

    const villagerObj = {
      id: conf.id,
      name: info.name,
      role: info.role,
      species: info.species,
      dialogs: info.dialogs,
      group: wrapper,
      model: model,
      skeletons: skeletons,
      bones: bones,
      initRots: initRots,
      currentPos: conf.pos.clone(),
      targetPos: conf.pos.clone(),
      targetRot: conf.rot,
      isWalking: false,
      walkCycle: Math.random() * Math.PI,
      idleTimer: Math.random() * 10.0,
      currentAction: 'idle',
      currentDialogs: info.dialogs,
      dialogIndex: 0,
      dayCycleIndex: 0,
      cycleTimer: 0,
      lastScheduleMode: null
    };

    this.villagers.push(villagerObj);
    this.group.add(wrapper);
    return villagerObj;
  }

  // 动态激活雷蒙德入驻营地
  async ensureRaymondSettled() {
    const hasRaymond = this.villagers.some(v => v.id === 'raymond');
    if (!hasRaymond) {
      console.log('🏛️ [VillagerManager] 激活学者雷蒙德入驻主岛营地');
      await this.loadSingleVillager({
        id: 'raymond',
        pos: new THREE.Vector3(-12.2, 0.05, 21.0),
        rot: -0.3
      });
    }
  }

  update(delta, playerPos, storySystem = null) {
    this.time += delta;
    const monkeyBefriended = !!(storySystem && storySystem.monkeyBefriended);
    const secondKidAwake = !!(storySystem && storySystem.secondKidAwake);
    const dayNightMode = (window.__game && window.__game.dayNight) ? window.__game.dayNight.currentMode : 'day';

    // 检查雷蒙德是否已入驻
    if (window.__game && window.__game.raymondSettled) {
      this.ensureRaymondSettled();
    }

    // 更新睡眠气泡特效
    this.updateSleepZzzFX(delta);

    for (const v of this.villagers) {
      // 1. 小猴巴布（Bub）跟随与嬉戏系统
      if (v.id === 'bub_monkey') {
        this.updateMonkeyBub(v, delta, playerPos, monkeyBefriended, dayNightMode);
        continue;
      }

      // 2. 艾莉尚未苏醒的初始昏睡姿态
      if (v.id === 'second_kid' && !secondKidAwake) {
        v.group.rotation.z = Math.PI * 0.44;
        v.group.position.set(23.0, 1.95, -17.0);
        v.idleTimer += delta;
        v.model.position.y = Math.sin(v.idleTimer * 1.5) * 0.015;
        this.animateVillagerAction(v, 'sleeping', delta, false);
        continue;
      } else if (v.id === 'second_kid') {
        if (!v.hasMovedToCamp) {
          v.hasMovedToCamp = true;
          // 苏醒后正式迁入西南主营地生活区
          v.group.position.set(-13.2, 0.05, 24.4);
          v.targetPos.set(-13.2, 0.05, 24.4);
        }
        v.group.rotation.z = 0;
      }

      // 3. 计算并应用作息调度状态 (Routine Schedule)
      this.updateVillagerRoutine(v, delta, dayNightMode);

      // 4. 寻路移动与平滑步态
      const distToPlayer = v.group.position.distanceTo(playerPos);
      const isPlayerNear = distToPlayer < 2.8;

      if (isPlayerNear && v.currentAction !== 'sleeping') {
        // 玩家靠近时停步，温柔转头面向玩家打招呼
        const lookDir = playerPos.clone().sub(v.group.position);
        lookDir.y = 0;
        const targetAngle = Math.atan2(lookDir.x, lookDir.z);
        const diff = Math.atan2(Math.sin(targetAngle - v.group.rotation.y), Math.cos(targetAngle - v.group.rotation.y));
        v.group.rotation.y += diff * 6.0 * delta;

        v.isWalking = false;
        v.idleTimer += delta;
        this.animateVillagerAction(v, 'wave_hello', delta, true);
      } else {
        // 沿作息目标点位行进或执行生活动作
        const distToTarget = v.group.position.distanceTo(v.targetPos);
        if (distToTarget > 0.35) {
          // 自主自然步行巡游
          v.isWalking = true;
          v.walkCycle += delta * 9.5;

          const moveVec = v.targetPos.clone().sub(v.group.position);
          moveVec.y = 0;
          const targetAngle = Math.atan2(moveVec.x, moveVec.z);
          const diff = Math.atan2(Math.sin(targetAngle - v.group.rotation.y), Math.cos(targetAngle - v.group.rotation.y));
          v.group.rotation.y += diff * 5.0 * delta;

          // 匀速前行 (1.35 米/秒)
          v.group.position.lerp(v.targetPos, Math.min(1.0, 1.35 * delta / distToTarget));
          v.group.position.y = v.targetPos.y; // 保持紧贴地形高度

          this.animateVillagerWalk(v, delta);
        } else {
          // 到达点位，执行驻留生活行为动作
          v.isWalking = false;
          v.idleTimer += delta;

          // 平滑回归点位规定朝向
          const diffRot = Math.atan2(Math.sin(v.targetRot - v.group.rotation.y), Math.cos(v.targetRot - v.group.rotation.y));
          v.group.rotation.y += diffRot * 4.0 * delta;

          this.animateVillagerAction(v, v.currentAction, delta, false);

          // 若在就寝，定期冒出睡眠 Zzz 气泡
          if (v.currentAction === 'sleeping') {
            this.zzzTimer += delta;
            if (this.zzzTimer > 1.6) {
              this.spawnZzzParticle(v.group.position.x, v.group.position.y + 1.1, v.group.position.z);
              this.zzzTimer = 0;
            }
          }
        }
      }

      // 刷新 GPU 骨骼蒙皮
      v.model.updateMatrixWorld(true);
      if (v.skeletons) {
        for (let i = 0; i < v.skeletons.length; i++) v.skeletons[i].update();
      }
    }
  }

  // 根据当前时段更新作息时间表目标
  updateVillagerRoutine(v, delta, mode) {
    const routine = this.routines[v.id];
    if (!routine) return;

    if (mode === 'day') {
      const dayTasks = routine.day;
      if (Array.isArray(dayTasks) && dayTasks.length > 0) {
        v.cycleTimer += delta;
        const curTask = dayTasks[v.dayCycleIndex % dayTasks.length];
        if (v.cycleTimer > (curTask.duration || 30.0) || v.lastScheduleMode !== 'day') {
          if (v.lastScheduleMode === 'day') {
            v.dayCycleIndex = (v.dayCycleIndex + 1) % dayTasks.length;
          }
          v.cycleTimer = 0;
          const nextTask = dayTasks[v.dayCycleIndex];
          v.targetPos.copy(nextTask.targetPos);
          v.targetRot = nextTask.targetRot;
          v.currentAction = nextTask.action;
          v.currentDialogs = nextTask.dialogs;
        }
      }
    } else {
      const task = routine[mode] || routine.day[0];
      if (v.lastScheduleMode !== mode) {
        v.targetPos.copy(task.targetPos);
        v.targetRot = task.targetRot;
        v.currentAction = task.action;
        v.currentDialogs = task.dialogs;
      }
    }
    v.lastScheduleMode = mode;
  }

  // 小猴 Bub 协同与日常
  updateMonkeyBub(v, delta, playerPos, monkeyBefriended, mode) {
    if (monkeyBefriended) {
      if (mode === 'night') {
        // 夜间小猴依偎在西南主营地篝火旁打盹 (-12.8, 0.05, 23.2)
        const fireSleepPos = new THREE.Vector3(-12.8, 0.05, 23.2);
        v.group.position.lerp(fireSleepPos, 3.0 * delta);
        v.group.rotation.y = 1.0;
        v.isWalking = false;
        v.idleTimer += delta;
        v.model.position.y = Math.sin(v.idleTimer * 1.8) * 0.02;
        this.animateVillagerAction(v, 'sleeping', delta, false);
      } else {
        // 随行跳跃跟随
        const followTarget = new THREE.Vector3(playerPos.x + 1.1, playerPos.y, playerPos.z + 0.9);
        const dist = v.group.position.distanceTo(followTarget);
        if (dist > 0.25) {
          v.isWalking = true;
          v.walkCycle += delta * 14.0;
          v.group.position.lerp(followTarget, 8.0 * delta);
          const dir = followTarget.clone().sub(v.group.position);
          if (dir.lengthSq() > 0.01) {
            v.group.rotation.y = Math.atan2(dir.x, dir.z);
          }
          v.model.position.y = Math.abs(Math.sin(v.walkCycle * 2.0)) * 0.28;
          this.animateVillagerWalk(v, delta);
        } else {
          v.isWalking = false;
          v.idleTimer += delta;
          v.model.position.y = Math.sin(v.idleTimer * 2.5) * 0.03;
          this.animateVillagerAction(v, 'idle', delta, false);
        }
      }
    } else {
      // 树下灵动翻筋斗吃果子
      v.isWalking = false;
      v.idleTimer += delta;
      v.model.position.y = Math.abs(Math.sin(v.idleTimer * 3.0)) * 0.15;
      this.animateVillagerAction(v, 'idle', delta, false);
    }

    v.model.updateMatrixWorld(true);
    if (v.skeletons) {
      for (let i = 0; i < v.skeletons.length; i++) v.skeletons[i].update();
    }
  }

  // 居民平滑步态骨骼动画 (交替大步前蹬、屈膝与前后自然摆臂)
  animateVillagerWalk(v, delta) {
    if (!v.model) return;
    const baseArmDrop = 0.95;
    const legSwing = Math.sin(v.walkCycle) * 0.52;
    const armSwing = Math.sin(v.walkCycle) * 0.38;

    // 1. 双腿交替摆动
    if (v.bones.legL && v.initRots.has(v.bones.legL)) {
      v.bones.legL.rotation.x = v.initRots.get(v.bones.legL).x + legSwing;
    }
    if (v.bones.legR && v.initRots.has(v.bones.legR)) {
      v.bones.legR.rotation.x = v.initRots.get(v.bones.legR).x - legSwing;
    }

    // 2. 屈膝弯折
    if (v.bones.kneeL && v.initRots.has(v.bones.kneeL)) {
      v.bones.kneeL.rotation.x = v.initRots.get(v.bones.kneeL).x + Math.max(0, -Math.sin(v.walkCycle)) * 0.35;
    }
    if (v.bones.kneeR && v.initRots.has(v.bones.kneeR)) {
      v.bones.kneeR.rotation.x = v.initRots.get(v.bones.kneeR).x + Math.max(0, Math.sin(v.walkCycle)) * 0.35;
    }

    // 3. 手臂前后摆荡
    if (v.bones.armL && v.initRots.has(v.bones.armL)) {
      const initL = v.initRots.get(v.bones.armL);
      v.bones.armL.rotation.x = initL.x - armSwing;
      v.bones.armL.rotation.z = initL.z - baseArmDrop;
    }
    if (v.bones.armR && v.initRots.has(v.bones.armR)) {
      const initR = v.initRots.get(v.bones.armR);
      v.bones.armR.rotation.x = initR.x + armSwing;
      v.bones.armR.rotation.z = initR.z - baseArmDrop;
    }

    // 4. 步伐起伏
    v.model.position.y = Math.abs(Math.sin(v.walkCycle)) * 0.045;
  }

  // 居民情境生活姿态骨骼动画 (取暖、采摘、打水、安眠、挥手致意)
  animateVillagerAction(v, action, delta, isPlayerNear) {
    if (!v.model) return;
    const baseArmDrop = 0.95;
    const idleBreathe = Math.sin(v.idleTimer * 1.8) * 0.025;

    // 恢复基础腿部待机位姿
    if (v.bones.legL && v.initRots.has(v.bones.legL)) v.bones.legL.rotation.x = v.initRots.get(v.bones.legL).x;
    if (v.bones.legR && v.initRots.has(v.bones.legR)) v.bones.legR.rotation.x = v.initRots.get(v.bones.legR).x;
    if (v.bones.kneeL && v.initRots.has(v.bones.kneeL)) v.bones.kneeL.rotation.x = v.initRots.get(v.bones.kneeL).x;
    if (v.bones.kneeR && v.initRots.has(v.bones.kneeR)) v.bones.kneeR.rotation.x = v.initRots.get(v.bones.kneeR).x;

    if (action === 'sleeping') {
      // 😴 安眠就寝姿态：侧身微蜷、双手交叠、身体舒展呼吸
      v.group.rotation.z = Math.PI * 0.42; // 平稳侧卧在床铺上
      v.model.position.y = 0.12 + Math.sin(v.idleTimer * 1.4) * 0.015;

      if (v.bones.armL && v.initRots.has(v.bones.armL)) {
        v.bones.armL.rotation.x = v.initRots.get(v.bones.armL).x + 0.45;
        v.bones.armL.rotation.z = v.initRots.get(v.bones.armL).z - 0.5;
      }
      if (v.bones.armR && v.initRots.has(v.bones.armR)) {
        v.bones.armR.rotation.x = v.initRots.get(v.bones.armR).x + 0.55;
        v.bones.armR.rotation.z = v.initRots.get(v.bones.armR).z - 0.4;
      }
      if (v.bones.head && v.initRots.has(v.bones.head)) {
        v.bones.head.rotation.x = v.initRots.get(v.bones.head).x + 0.2;
        v.bones.head.rotation.z = v.initRots.get(v.bones.head).z + 0.15;
      }
      return;
    }

    // 非睡眠状态恢复站立倾角
    v.group.rotation.z = 0;

    if (isPlayerNear || action === 'wave_hello') {
      // 👋 向玩家可爱招手打招呼
      const waveCycle = Math.sin(v.idleTimer * 6.5) * 0.28;
      if (v.bones.armL && v.initRots.has(v.bones.armL)) {
        v.bones.armL.rotation.z = v.initRots.get(v.bones.armL).z - baseArmDrop + idleBreathe;
        v.bones.armL.rotation.x = v.initRots.get(v.bones.armL).x;
      }
      if (v.bones.armR && v.initRots.has(v.bones.armR)) {
        const initR = v.initRots.get(v.bones.armR);
        v.bones.armR.rotation.z = initR.z - 0.25;
        v.bones.armR.rotation.x = initR.x + 0.65 + waveCycle;
      }
      if (v.bones.head && v.initRots.has(v.bones.head)) {
        v.bones.head.rotation.z = v.initRots.get(v.bones.head).z + Math.sin(v.idleTimer * 1.5) * 0.08;
      }
      v.model.position.y = Math.sin(v.idleTimer * 2.2) * 0.02;
      return;
    }

    if (action === 'warming') {
      // 🔥 篝火旁双手微拢轻搓取暖
      const rub = Math.sin(v.idleTimer * 4.0) * 0.08;
      if (v.bones.armL && v.initRots.has(v.bones.armL)) {
        v.bones.armL.rotation.x = v.initRots.get(v.bones.armL).x + 0.65 + rub;
        v.bones.armL.rotation.z = v.initRots.get(v.bones.armL).z - 0.45;
      }
      if (v.bones.armR && v.initRots.has(v.bones.armR)) {
        v.bones.armR.rotation.x = v.initRots.get(v.bones.armR).x + 0.65 - rub;
        v.bones.armR.rotation.z = v.initRots.get(v.bones.armR).z - 0.45;
      }
      if (v.bones.head && v.initRots.has(v.bones.head)) {
        v.bones.head.rotation.x = v.initRots.get(v.bones.head).x + 0.15; // 惬意低头看火
      }
    } else if (action === 'gathering') {
      // 🍎 果树下仰头看果与俯身采摘
      const pickCycle = Math.sin(v.idleTimer * 0.8);
      const isLookingUp = pickCycle > 0;
      if (v.bones.head && v.initRots.has(v.bones.head)) {
        v.bones.head.rotation.x = v.initRots.get(v.bones.head).x + (isLookingUp ? -0.35 : 0.25);
      }
      if (v.bones.armR && v.initRots.has(v.bones.armR)) {
        v.bones.armR.rotation.x = v.initRots.get(v.bones.armR).x + (isLookingUp ? 0.75 : 0.25);
        v.bones.armR.rotation.z = v.initRots.get(v.bones.armR).z - 0.35;
      }
    } else if (action === 'freshen_up' || action === 'inspect_water') {
      // 🚰 溪边打水梳洗与净水台检查
      const rubFace = Math.sin(v.idleTimer * 3.5) * 0.15;
      if (v.bones.armL && v.initRots.has(v.bones.armL)) {
        v.bones.armL.rotation.x = v.initRots.get(v.bones.armL).x + 0.7 + rubFace;
        v.bones.armL.rotation.z = v.initRots.get(v.bones.armL).z - 0.35;
      }
      if (v.bones.armR && v.initRots.has(v.bones.armR)) {
        v.bones.armR.rotation.x = v.initRots.get(v.bones.armR).x + 0.7 - rubFace;
        v.bones.armR.rotation.z = v.initRots.get(v.bones.armR).z - 0.35;
      }
    } else if (action === 'crafting' || action === 'working_wood') {
      // 🔨 船坞敲打木料检修与工匠台木工
      const hammer = Math.sin(v.idleTimer * 7.0) * 0.35;
      if (v.bones.armR && v.initRots.has(v.bones.armR)) {
        v.bones.armR.rotation.x = v.initRots.get(v.bones.armR).x + 0.6 + hammer;
      }
      if (v.bones.armL && v.initRots.has(v.bones.armL)) {
        v.bones.armL.rotation.x = v.initRots.get(v.bones.armL).x + 0.4;
      }
    } else {
      // 常态待机：双手自然服帖垂顺两侧，悠闲呼吸
      if (v.bones.armL && v.initRots.has(v.bones.armL)) {
        v.bones.armL.rotation.x = v.initRots.get(v.bones.armL).x;
        v.bones.armL.rotation.z = v.initRots.get(v.bones.armL).z - baseArmDrop + idleBreathe;
      }
      if (v.bones.armR && v.initRots.has(v.bones.armR)) {
        v.bones.armR.rotation.x = v.initRots.get(v.bones.armR).x;
        v.bones.armR.rotation.z = v.initRots.get(v.bones.armR).z - baseArmDrop - idleBreathe;
      }
    }

    // 灵动尾巴呼吸微卷
    const idleC = v.idleTimer * 1.5;
    if (v.bones.tail1 && v.initRots.has(v.bones.tail1)) {
      v.bones.tail1.rotation.y = v.initRots.get(v.bones.tail1).y + 0.45 + Math.sin(idleC) * 0.15;
      v.bones.tail1.rotation.z = v.initRots.get(v.bones.tail1).z + 0.4;
    }
    if (v.bones.tail2 && v.initRots.has(v.bones.tail2)) {
      v.bones.tail2.rotation.y = v.initRots.get(v.bones.tail2).y + 0.65 + Math.sin(idleC - 0.5) * 0.25;
      v.bones.tail2.rotation.z = v.initRots.get(v.bones.tail2).z + 0.5;
    }

    v.model.position.y = Math.sin(v.idleTimer * 2.0) * 0.012;
  }

  // 检索附近可对话的村民
  getNearestVillager(playerPos, maxDist = 3.0) {
    let nearest = null;
    let minDist = maxDist;
    for (const v of this.villagers) {
      const d = v.group.position.distanceTo(playerPos);
      if (d < minDist) {
        minDist = d;
        nearest = v;
      }
    }
    return nearest;
  }
}
