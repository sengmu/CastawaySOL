import * as THREE from 'three';
import { GAME_ASSETS } from '../core/AssetRegistry.js';
import { modelLoader } from '../core/ModelLoader.js';
import { soundEngine } from '../core/AudioSystem.js';
import { haptics } from '../core/HapticFeedback.js';

export class TreeInteraction {
  constructor(scene) {
    this.scene = scene;
    this.trees = [];
    this.droppedItems = [];
    this.windTime = 0;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // =========================================================================
    // 全岛植被生态美学重构（四大主题林区 + 组团式景观设计）
    // 1. 南岸与环岛海湾【热带海岛椰林弧带】（双株高低相伴，优美倾斜，海风椰影）
    // 2. 营地生活区【温馨苹果树绿障与花境】（半月形环抱避风，留通透看海视线走廊）
    // 3. 西北内陆【丰盛生态果园区与小径】（错落有致的林荫步道，采摘探索）
    // 4. 东北悬崖天际线【高耸苍翠雪松群】（阶梯垂直纵深，与飞瀑绝美映衬）
    // =========================================================================
    this.treePositions = [
      // -----------------------------------------------------------------------
      // 【林区 1：南岸沙滩与出航湾·热带椰林优美弧带】
      // 依海岸线走向排布，双株/三株错落组团，主树挺拔微倾(1.25x)，伴生树娇小微俯(0.88x)
      // -----------------------------------------------------------------------
      // 组团 A：出航码头西侧岬角景观（西侧海岸屏障）
      { id: 'palm_tree', pos: new THREE.Vector3(-28.5, -0.2, 33.5), scale: 1.25, rotY: 0.6 },
      { id: 'palm_tree', pos: new THREE.Vector3(-26.8, -0.2, 35.0), scale: 0.90, rotY: -0.8 },
      { id: 'camellia_bush', pos: new THREE.Vector3(-27.6, -0.2, 34.0), scale: 0.95 },

      // 组团 B：南岸出生浅滩与木筏西侧（主视角左侧画框树景）
      { id: 'palm_tree', pos: new THREE.Vector3(-18.5, -0.15, 37.0), scale: 1.22, rotY: 0.3 },
      { id: 'palm_tree', pos: new THREE.Vector3(-16.8, -0.15, 38.6), scale: 0.85, rotY: 1.1 },

      // 组团 C：南岸求生步道东侧迎宾椰树（通向营地的林荫入口）
      { id: 'palm_tree', pos: new THREE.Vector3(-4.5, -0.12, 37.5), scale: 1.28, rotY: -0.4 },
      { id: 'palm_tree', pos: new THREE.Vector3(-3.0, -0.12, 39.0), scale: 0.88, rotY: 0.9 },
      { id: 'azalea_bush', pos: new THREE.Vector3(-3.8, -0.12, 38.2), scale: 0.92 },

      // 组团 D：东南黄金浅滩双椰伴生（主视角右侧画框树景）
      { id: 'palm_tree', pos: new THREE.Vector3(7.5, -0.2, 34.5), scale: 1.26, rotY: 0.8 },
      { id: 'palm_tree', pos: new THREE.Vector3(9.2, -0.2, 33.0), scale: 0.92, rotY: -0.5 },

      // 组团 E：东海角沙滩椰影
      { id: 'palm_tree', pos: new THREE.Vector3(18.5, -0.2, 30.5), scale: 1.18, rotY: -0.9 },
      { id: 'palm_tree', pos: new THREE.Vector3(26.0, -0.2, 24.5), scale: 1.15, rotY: 0.4 },

      // -----------------------------------------------------------------------
      // 【林区 2：营地生活区·温馨半月形苹果果林与花境】
      // 营地核心位于 X:-12~-17, Z:23~25（火塘/帐篷/净水台）
      // 树木从北侧、西北侧呈半月弧形环抱，遮阴挡风，但南向完全开阔留出看海通廊
      // -----------------------------------------------------------------------
      // 组团 F：营地西侧生活遮阴大苹果树群（大中小三株生动伴生）
      { id: 'apple_tree', pos: new THREE.Vector3(-21.5, 0, 23.5), scale: 1.25 },
      { id: 'apple_tree', pos: new THREE.Vector3(-20.0, 0, 21.0), scale: 0.92 },
      { id: 'camellia_bush', pos: new THREE.Vector3(-21.0, 0, 22.2), scale: 0.95 },

      // 组团 G：营地北侧背风森林屏障（火塘正后方绿意画壁）
      { id: 'apple_tree', pos: new THREE.Vector3(-14.5, 0, 18.0), scale: 1.28 },
      { id: 'apple_tree', pos: new THREE.Vector3(-11.5, 0, 17.0), scale: 0.95 },
      { id: 'azalea_bush', pos: new THREE.Vector3(-13.0, 0, 17.5), scale: 1.0 },

      // 组团 H：营地东侧迎客果树与花境（告示牌与储物箱旁，点缀生机）
      { id: 'apple_tree', pos: new THREE.Vector3(-6.5, 0, 21.5), scale: 1.18 },
      { id: 'camellia_bush', pos: new THREE.Vector3(-5.2, 0, 23.0), scale: 0.9 },
      { id: 'azalea_bush', pos: new THREE.Vector3(-7.5, 0, 24.5), scale: 0.9 },

      // -----------------------------------------------------------------------
      // 【林区 3：中央草坪与西北自然果林小径】
      // 串联营地向北探索的视觉延伸，杜绝混杂椰树，纯粹温润的果树林荫带
      // -----------------------------------------------------------------------
      // 组团 I：小岛中央绿地过渡双树
      { id: 'apple_tree', pos: new THREE.Vector3(-2.5, 0, 10.5), scale: 1.15 },
      { id: 'apple_tree', pos: new THREE.Vector3(3.5, 0, 8.5), scale: 1.1 },
      { id: 'azalea_bush', pos: new THREE.Vector3(0.5, 0, 9.5), scale: 0.95 },

      // 组团 J：西北深入果园林荫密林
      { id: 'apple_tree', pos: new THREE.Vector3(-12.5, 0, 4.0), scale: 1.22 },
      { id: 'apple_tree', pos: new THREE.Vector3(-16.0, 0, 2.5), scale: 0.95 },
      { id: 'apple_tree', pos: new THREE.Vector3(-19.5, 0, -4.5), scale: 1.25 },
      { id: 'apple_tree', pos: new THREE.Vector3(-17.0, 0, -8.0), scale: 1.05 },
      { id: 'camellia_bush', pos: new THREE.Vector3(-14.0, 0, -2.0), scale: 0.95 },

      // 组团 K：小溪南岸幽静水畔果树
      { id: 'apple_tree', pos: new THREE.Vector3(8.5, 0, -2.5), scale: 1.18 },
      { id: 'apple_tree', pos: new THREE.Vector3(12.0, 0, -5.0), scale: 0.95 },
      { id: 'azalea_bush', pos: new THREE.Vector3(10.2, 0, -3.8), scale: 0.9 },

      // -----------------------------------------------------------------------
      // 【林区 4：东北高地悬崖平台·挺拔雪松天际线】
      // 位于高台(Y=1.8)，阶梯式高低排布(1.15x ~ 1.45x)，气势庄严挺拔，与瀑布同框
      // -----------------------------------------------------------------------
      { id: 'cedar_tree', pos: new THREE.Vector3(14.0, 1.8, -25.5), scale: 1.45 },
      { id: 'cedar_tree', pos: new THREE.Vector3(16.5, 1.8, -28.0), scale: 1.25 },
      { id: 'cedar_tree', pos: new THREE.Vector3(15.5, 1.8, -20.5), scale: 1.38 },
      { id: 'cedar_tree', pos: new THREE.Vector3(32.0, 1.8, -28.0), scale: 1.42 },
      { id: 'cedar_tree', pos: new THREE.Vector3(33.0, 1.8, -23.5), scale: 1.28 },
      { id: 'cedar_tree', pos: new THREE.Vector3(35.5, 1.8, -25.0), scale: 1.35 },
      { id: 'cedar_tree', pos: new THREE.Vector3(32.0, 1.8, -16.5), scale: 1.18 }
    ];

    this.initTrees();
    // 少量真实可拾取漂流木，引导玩家从沙滩走向内陆。
    [[-8, 39.4], [-11.5, 38.6], [-9, 36.8], [-12, 35.8]].forEach(([x, z], index) => {
      this.spawnDropItem(new THREE.Vector3(x, -0.15, z), 'tree_branch');
      const item = this.droppedItems[this.droppedItems.length - 1];
      item.starterId = index;
      item.t = 1;
      item.targetX = x;
      item.targetZ = z;
      item.group.position.set(x, 0.05, z);
    });
  }

  getRemainingStarterDrops() {
    return this.droppedItems.filter(item => Number.isInteger(item.starterId)).map(item => item.starterId);
  }

  getDropSnapshot() {
    return this.droppedItems.map(item => ({
      type: item.type,
      x: item.targetX,
      y: item.targetY,
      z: item.targetZ,
      ...(Number.isInteger(item.starterId) ? { starterId: item.starterId } : {})
    }));
  }

  restoreDrops(saved) {
    if (!Array.isArray(saved)) return;
    const allowed = new Set(['apple', 'coconut', 'tree_branch', 'tree_bark', 'tree_sap', 'ivy', 'lumber', 'wood_plank']);
    for (const item of this.droppedItems) this.group.remove(item.group);
    this.droppedItems = [];
    for (const data of saved.slice(0, 500)) {
      if (!data || !allowed.has(data.type) || ![data.x, data.y, data.z].every(Number.isFinite)) continue;
      this.spawnDropItem(new THREE.Vector3(data.x, data.y - 0.2, data.z), data.type);
      const item = this.droppedItems[this.droppedItems.length - 1];
      item.targetX = data.x;
      item.targetY = data.y;
      item.targetZ = data.z;
      item.group.position.set(data.x, data.y, data.z);
      item.t = 1;
      if (Number.isInteger(data.starterId) && data.starterId >= 0 && data.starterId < 4) item.starterId = data.starterId;
    }
  }

  getNearestDrop(playerPos, maxDist = 2.2) {
    let nearest = null;
    let nearestDist = maxDist;
    for (const item of this.droppedItems) {
      if (item.t < 1) continue;
      const dist = Math.hypot(item.group.position.x - playerPos.x, item.group.position.z - playerPos.z);
      if (dist < nearestDist) {
        nearest = item;
        nearestDist = dist;
      }
    }
    return nearest;
  }

  pickupDrop(playerPos, inventoryCallback) {
    const item = this.getNearestDrop(playerPos);
    if (!item || !inventoryCallback(item.type)) return false;
    soundEngine.playItemDrop();
    haptics.light();
    this.group.remove(item.group);
    this.droppedItems.splice(this.droppedItems.indexOf(item), 1);
    return true;
  }

  restoreStarterDrops(remaining) {
    if (!Array.isArray(remaining)) return;
    const ids = new Set(remaining.filter(id => Number.isInteger(id) && id >= 0 && id < 4));
    this.droppedItems = this.droppedItems.filter(item => {
      if (!Number.isInteger(item.starterId) || ids.has(item.starterId)) return true;
      this.group.remove(item.group);
      return false;
    });
  }

  async initTrees() {
    for (const conf of this.treePositions) {
      const info = GAME_ASSETS.plants[conf.id];
      if (!info) continue;

      const model = await modelLoader.loadModel(info.path, {
        scale: (info.scale || 1.0) * (conf.scale || 1.0),
        castShadow: true,
        receiveShadow: true
      });

      const wrapper = new THREE.Group();
      wrapper.position.copy(conf.pos);
      if (typeof conf.rotY === 'number') {
        wrapper.rotation.y = conf.rotY;
      }
      wrapper.userData.movementRadius = 0.5 * (conf.scale || 1);
      wrapper.add(model);

      // 生态细节：为苹果树和椰子树在枝头自然挂上精巧果实
      const fruits = [];
      const treeScale = (info.scale || 1.0) * (conf.scale || 1.0);
      if (conf.id === 'apple_tree') {
        const fruitGeo = new THREE.SphereGeometry(0.16 * treeScale, 14, 12);
        const fruitMat = new THREE.MeshStandardMaterial({
          color: 0xd82020,
          roughness: 0.35,
          metalness: 0.05,
          emissive: new THREE.Color(0x2b0606)
        });
        // 苹果紧致内嵌于 360 度全向圆润树冠中，杜绝半空悬浮脱离
        const fruitOffsets = [
          new THREE.Vector3(-0.42 * treeScale, 2.32 * treeScale, 0.40 * treeScale),
          new THREE.Vector3(0.44 * treeScale, 2.42 * treeScale, 0.35 * treeScale),
          new THREE.Vector3(0.04 * treeScale, 2.68 * treeScale, 0.45 * treeScale)
        ];
        fruitOffsets.forEach((off) => {
          const fMesh = new THREE.Mesh(fruitGeo, fruitMat);
          fMesh.position.copy(off);
          fMesh.scale.set(1.0, 0.92, 1.0);
          fMesh.castShadow = false; // 树冠本身已有完整浓密阴影，果实无需独立投射深度
          // 挂载至 model 内部，随树冠枝桠微风与晃动同步摆荡
          model.add(fMesh);
          fruits.push(fMesh);
        });
      } else if (conf.id === 'palm_tree') {
        // 椰子紧簇依附在椰树干顶端分叉处 (Y ~ 2.15 米)，尺寸适度，严密贴合树冠
        const coconutGeo = new THREE.SphereGeometry(0.15 * treeScale, 14, 12);
        const coconutMat = new THREE.MeshStandardMaterial({
          color: 0x5a3c20,
          roughness: 0.8,
          metalness: 0.02,
          emissive: new THREE.Color(0x120c04)
        });
        const coconutOffsets = [
          new THREE.Vector3(-0.12 * treeScale, 2.12 * treeScale, 0.16 * treeScale),
          new THREE.Vector3(0.16 * treeScale, 2.18 * treeScale, 0.10 * treeScale),
          new THREE.Vector3(-0.02 * treeScale, 2.10 * treeScale, -0.14 * treeScale)
        ];
        coconutOffsets.forEach((off) => {
          const cMesh = new THREE.Mesh(coconutGeo, coconutMat);
          cMesh.position.copy(off);
          cMesh.scale.set(0.9, 1.25, 0.9);
          cMesh.castShadow = false; // 隐藏在茂密椰叶下，免去多余深度计算
          // 挂载至 model 内部，随椰树杆梢同步摇摆
          model.add(cMesh);
          fruits.push(cMesh);
        });
      }

      // 海岛各树种微风物理动力学配置 (柔韧度、固有频率与空间相位差)
      const isPalm = conf.id === 'palm_tree';
      const isCedar = conf.id === 'cedar_tree';
      const isApple = conf.id === 'apple_tree';
      const windSpeed = isPalm ? 1.25 : (isCedar ? 0.95 : (isApple ? 1.45 : 2.0));
      const windAmpZ = isPalm ? 0.038 : (isCedar ? 0.022 : (isApple ? 0.020 : 0.012));

      this.trees.push({
        id: conf.id,
        name: info.name,
        canShake: !!info.canShake,
        canChop: true, // 支持使用石斧砍伐
        chopHp: 3,     // 砍伐 3 斧伐倒
        maxChopHp: 3,
        isFelled: false,
        regrowthSteps: 0,
        dropItem: info.dropItem || 'apple',
        group: wrapper,
        model: model,
        fruits: fruits,
        shakeProgress: 0,
        shaking: false,
        shookCount: 0,
        windPhase: (conf.pos.x * 0.41 + conf.pos.z * 0.63) % (Math.PI * 2),
        windSpeed,
        windAmpZ,
        windAmpX: windAmpZ * 0.55
      });

      this.group.add(wrapper);
    }
  }

  // 仅触发树木晃动动效 (供小猴爬树采摘等外部动作协同调用)
  shakeTreeMesh(tree) {
    if (!tree) return;
    tree.shaking = true;
    tree.shakeProgress = 0;
    soundEngine.playTreeShake();
    haptics.medium();
  }

  // 摇树触发
  shakeTree(tree) {
    if (!tree.canShake || tree.shaking) return;
    tree.shaking = true;
    tree.shakeProgress = 0;
    soundEngine.playTreeShake();
    haptics.medium();

    // 如果树上还有果实，逐个摇落并隐藏树上果实
    if (tree.fruits && tree.fruits.length > 0) {
      const remainingFruit = tree.fruits.pop();
      if (remainingFruit) {
        remainingFruit.visible = false;
      }
    }

    // 产生掉落物 (苹果、椰子、树枝、树皮或树脂)
    tree.shookCount++;
    this.spawnDropItem(tree.group.position, tree.dropItem);

    // 出战小猴巴布时享受全图采摘丰收增益 (+25% 额外掉落一份果实)
    const isMonkeyActive = typeof window !== 'undefined' && window.__game && window.__game.petCompanion && window.__game.petCompanion.activePetId === 'bub_monkey';
    if (isMonkeyActive && Math.random() < 0.25) {
      this.spawnDropItem(tree.group.position, tree.dropItem);
    }

    // 几率伴随掉落树皮与树脂 (Survival Kids 原版配方核心材料)
    if (Math.random() < 0.6) {
      this.spawnDropItem(tree.group.position, 'tree_bark');
    }
    if (Math.random() < 0.35) {
      this.spawnDropItem(tree.group.position, 'tree_sap');
    }

    // 猴子 Bub 伙伴协同采集彩蛋：若猴子已入队，额外掉落一份高级果实或坚韧藤蔓
    if (window.__game && window.__game.story && window.__game.story.monkeyBefriended) {
      if (Math.random() < 0.5) {
        this.spawnDropItem(tree.group.position, 'ivy');
      }
    }
  }

  // 使用石斧砍伐树木获取建造大木筏的重型圆木 (Lumber)
  chopTree(tree) {
    if (!tree || tree.isFelled) return false;

    tree.shaking = true;
    tree.shakeProgress = 0;
    tree.chopHp = (tree.chopHp || tree.maxChopHp || 3) - 1;

    // 播放沉重利斧劈击裂木声
    soundEngine.playAttackSwish();
    soundEngine.playHitImpact();
    haptics.heavy();

    // 每次斧击均掉落树皮碎屑或细枝
    if (Math.random() < 0.6) {
      this.spawnDropItem(tree.group.position, 'tree_bark');
    }
    if (Math.random() < 0.45) {
      this.spawnDropItem(tree.group.position, 'tree_branch');
    }

    // 判定是否伐倒树木
    if (tree.chopHp <= 0) {
      tree.isFelled = true;
      tree.regrowthSteps = 120; // 120 步后自然萌发新生

      // 伐倒爆出核心建材：重型圆木 x2 + 木材方料 x1 + 粘性树脂 x1
      this.spawnDropItem(tree.group.position, 'lumber');
      this.spawnDropItem(tree.group.position, 'lumber');
      this.spawnDropItem(tree.group.position, 'wood_plank');
      if (Math.random() < 0.65) {
        this.spawnDropItem(tree.group.position, 'tree_sap');
      }

      // 如果树上原本有果实，全部震落
      if (tree.fruits && tree.fruits.length > 0) {
        while (tree.fruits.length > 0) {
          const f = tree.fruits.pop();
          if (f) f.visible = false;
          this.spawnDropItem(tree.group.position, tree.dropItem);
        }
      }

      // 树木快速倒伏淡出
      if (tree.model) {
        tree.model.rotation.x = Math.PI / 2.2;
        tree.model.position.y = -0.3;
        setTimeout(() => {
          if (tree.model) tree.model.visible = false;
        }, 500);
      }

      return { felled: true, name: tree.name };
    }

    return { felled: false, remainingHp: tree.chopHp, name: tree.name };
  }

  // 步数推进树木自然休整与萌发
  recordMovement(stepCount = 1) {
    for (const tree of this.trees) {
      if (tree.isFelled) {
        tree.regrowthSteps -= stepCount;
        if (tree.regrowthSteps <= 0) {
          tree.isFelled = false;
          tree.chopHp = tree.maxChopHp || 3;
          if (tree.model) {
            tree.model.visible = true;
            tree.model.rotation.set(0, 0, 0);
            tree.model.position.y = 0;
          }
        }
      }
    }
  }

  // 生成掉落物与弹跳动画
  spawnDropItem(treePos, itemType) {
    const itemGroup = new THREE.Group();
    let mesh;

    if (itemType === 'apple') {
      const geo = new THREE.SphereGeometry(0.3, 16, 16);
      const mat = new THREE.MeshStandardMaterial({ color: 0xee2222, roughness: 0.3 });
      mesh = new THREE.Mesh(geo, mat);
    } else if (itemType === 'coconut') {
      const geo = new THREE.SphereGeometry(0.32, 16, 16);
      const mat = new THREE.MeshStandardMaterial({ color: 0x6e4726, roughness: 0.7 });
      mesh = new THREE.Mesh(geo, mat);
    } else if (itemType === 'lumber') {
      // 重型圆木
      const geo = new THREE.CylinderGeometry(0.2, 0.22, 1.2, 8);
      const mat = new THREE.MeshStandardMaterial({ color: 0x5c3818, roughness: 0.8 });
      mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.z = Math.PI / 2;
    } else if (itemType === 'tree_bark') {
      // 树皮
      const geo = new THREE.BoxGeometry(0.3, 0.05, 0.4);
      const mat = new THREE.MeshStandardMaterial({ color: 0x8a5028, roughness: 0.9 });
      mesh = new THREE.Mesh(geo, mat);
    } else if (itemType === 'tree_sap') {
      // 琥珀色树脂
      const geo = new THREE.DodecahedronGeometry(0.2);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.1, transparent: true, opacity: 0.85 });
      mesh = new THREE.Mesh(geo, mat);
    } else if (itemType === 'ivy') {
      // 坚韧藤蔓
      const geo = new THREE.TorusGeometry(0.22, 0.05, 8, 16);
      const mat = new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.6 });
      mesh = new THREE.Mesh(geo, mat);
    } else {
      // 坚韧木棍
      const geo = new THREE.CylinderGeometry(0.06, 0.08, 0.7, 8);
      const mat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
      mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.z = Math.PI / 3;
    }

    mesh.castShadow = true;
    itemGroup.add(mesh);

    // 随机掉落在树旁的地面上
    const angle = Math.random() * Math.PI * 2;
    const dist = 1.2 + Math.random() * 0.8;
    const targetX = treePos.x + Math.cos(angle) * dist;
    const targetZ = treePos.z + Math.sin(angle) * dist;

    itemGroup.position.set(treePos.x, treePos.y + 3.0, treePos.z);
    this.group.add(itemGroup);

    this.droppedItems.push({
      group: itemGroup,
      type: itemType,
      targetY: treePos.y + 0.2,
      targetX,
      targetZ,
      velocityY: 1.0,
      t: 0
    });
  }

  update(delta) {
    this.windTime += delta;

    // 海岛自然海风动力学微摆 + 摇树物理震荡复合
    for (const tree of this.trees) {
      if (!tree.model) continue;

      // 1. 自然海风持续轻柔微晃 (根据树种固有频率与空间相位差柔和摆动)
      const windPhaseTime = this.windTime * tree.windSpeed + tree.windPhase;
      const baseSwayZ = Math.sin(windPhaseTime) * tree.windAmpZ;
      const baseSwayX = Math.cos(windPhaseTime * 0.82 + 0.4) * tree.windAmpX;

      // 2. 玩家主动摇树的剧烈动量衰减 (左右大幅度晃动并迅速衰减)
      let shakeZ = 0;
      let shakeX = 0;
      if (tree.shaking) {
        tree.shakeProgress += delta * 12.0;
        const decay = Math.exp(-tree.shakeProgress * 0.45);
        shakeZ = Math.sin(tree.shakeProgress) * 0.22 * decay;
        shakeX = Math.cos(tree.shakeProgress * 0.9) * 0.08 * decay;

        if (tree.shakeProgress > 5.5) {
          tree.shaking = false;
          tree.shakeProgress = 0;
        }
      }

      // 合成最终树体世界朝向
      tree.model.rotation.z = baseSwayZ + shakeZ;
      tree.model.rotation.x = baseSwayX + shakeX;
    }

    // 掉落物物理掉落与弹跳
    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const item = this.droppedItems[i];
      if (item.t < 1.0) {
        item.t += delta * 2.5;
        item.group.position.x = THREE.MathUtils.lerp(item.group.position.x, item.targetX, 0.1);
        item.group.position.z = THREE.MathUtils.lerp(item.group.position.z, item.targetZ, 0.1);
        // 抛物线下落与微弹
        const yOffset = Math.sin(item.t * Math.PI) * 1.5;
        item.group.position.y = THREE.MathUtils.lerp(item.group.position.y, item.targetY, 0.15) + (item.t < 0.6 ? yOffset * 0.1 : 0);

        if (item.t >= 1.0) {
          item.group.position.y = item.targetY;
          soundEngine.playItemDrop();
        }
      }

    }
  }

  // 获取离玩家最近的可互动树木 (忽略已砍伐倒伏树木)
  getNearestTree(playerPos, maxDist = 2.8) {
    let nearest = null;
    let minDist = maxDist;
    for (const t of this.trees) {
      if (t.isFelled) continue;
      const d = t.group.position.distanceTo(playerPos);
      if (d < minDist) {
        minDist = d;
        nearest = t;
      }
    }
    return nearest;
  }
}
