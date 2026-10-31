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

    // 预设丰富热带海岛植被生态网络 (环绕营地、果林小径与海滩椰影)
    this.treePositions = [
      // 1. 营地与出生点核心景观 (主角在 Z=4 朝向负Z，果树与海岛椰林分立两侧，视野通透明朗)
      { id: 'apple_tree', pos: new THREE.Vector3(-3.8, 0, -3.0), scale: 1.1 },    // 左前方丰硕苹果树
      { id: 'palm_tree', pos: new THREE.Vector3(4.2, 0, -2.5), scale: 1.12 },     // 右前方热带海岛椰子树
      { id: 'apple_tree', pos: new THREE.Vector3(-8.5, 0, -5.5), scale: 1.1 },     // 西侧营地旁苹果树
      { id: 'camellia_bush', pos: new THREE.Vector3(-2.2, 0, 0.8), scale: 0.95 },  // 近景山茶花灌木
      { id: 'azalea_bush', pos: new THREE.Vector3(2.6, 0, 0.6), scale: 0.95 },     // 近景杜鹃花灌木

      // 2. 东侧小溪与绿荫林带 (热带果树与海岛灌木交相辉映)
      { id: 'apple_tree', pos: new THREE.Vector3(8.5, 0, -6.5), scale: 1.12 },
      { id: 'palm_tree', pos: new THREE.Vector3(6.2, 0, -11.0), scale: 1.08 },
      { id: 'apple_tree', pos: new THREE.Vector3(10.5, 0, 1.5), scale: 1.08 },
      { id: 'azalea_bush', pos: new THREE.Vector3(7.2, 0, -2.5), scale: 0.9 },

      // 3. 西北丰盛果园区 (排布整齐的自然果林)
      { id: 'apple_tree', pos: new THREE.Vector3(-19, 0, 16), scale: 1.1 },
      { id: 'apple_tree', pos: new THREE.Vector3(-18.0, 0, -2.5), scale: 1.15 },
      { id: 'apple_tree', pos: new THREE.Vector3(-15.0, 0, -7.0), scale: 1.08 },
      { id: 'apple_tree', pos: new THREE.Vector3(-20.5, 0, -8.0), scale: 1.12 },
      { id: 'apple_tree', pos: new THREE.Vector3(-16.0, 0, -14.0), scale: 1.05 },
      { id: 'apple_tree', pos: new THREE.Vector3(-22.0, 0, -15.5), scale: 1.1 },
      { id: 'camellia_bush', pos: new THREE.Vector3(-11.5, 0, -2.0), scale: 0.92 },

      // 4. 东北高台雪松深林 (高耸挺拔的雪松掩映原木营地，自然错落形成深林天际线)
      { id: 'cedar_tree', pos: new THREE.Vector3(14.0, 1.8, -25.0), scale: 1.3 },
      { id: 'cedar_tree', pos: new THREE.Vector3(18.5, 1.8, -23.5), scale: 1.25 },
      { id: 'cedar_tree', pos: new THREE.Vector3(25.0, 1.8, -24.5), scale: 1.35 },
      { id: 'cedar_tree', pos: new THREE.Vector3(30.0, 1.8, -21.0), scale: 1.2 },
      { id: 'cedar_tree', pos: new THREE.Vector3(34.0, 1.8, -25.0), scale: 1.3 },
      { id: 'cedar_tree', pos: new THREE.Vector3(21.0, 1.8, -27.0), scale: 1.28 },
      { id: 'cedar_tree', pos: new THREE.Vector3(28.5, 1.8, -16.5), scale: 1.18 },

      // 5. 东南与西南海岸开阔草坪点缀
      { id: 'apple_tree', pos: new THREE.Vector3(-8, 0, 20), scale: 1.05 },
      { id: 'palm_tree', pos: new THREE.Vector3(9.0, 0, 12.0), scale: 1.1 },
      { id: 'apple_tree', pos: new THREE.Vector3(15.0, 0, 8.5), scale: 1.08 },
      { id: 'azalea_bush', pos: new THREE.Vector3(-4.0, 0, 9.5), scale: 0.9 },

      // 6. 南岸与环岛沙滩热带椰林带 (海滩微风拂面，椰影婆娑)
      { id: 'palm_tree', pos: new THREE.Vector3(-6, 0, 30), scale: 1.1 },
      { id: 'palm_tree', pos: new THREE.Vector3(3.5, -0.2, 30), scale: 1.08 },
      { id: 'palm_tree', pos: new THREE.Vector3(12.0, -0.2, 31), scale: 1.15 },
      { id: 'palm_tree', pos: new THREE.Vector3(-14, 0, 32), scale: 1.12 },
      { id: 'palm_tree', pos: new THREE.Vector3(-22, -0.2, 30), scale: 1.15 },
      { id: 'palm_tree', pos: new THREE.Vector3(-30, -0.2, 25), scale: 1.08 },
      { id: 'palm_tree', pos: new THREE.Vector3(22.0, -0.2, 28), scale: 1.12 },
      { id: 'palm_tree', pos: new THREE.Vector3(30.0, -0.2, 22), scale: 1.05 }
    ];

    this.initTrees();
    // 少量真实可拾取漂流木，引导玩家从沙滩走向内陆。
    [[-8, 39.4], [-11.5, 38.6], [-9, 36.8], [-12, 35.8]].forEach(([x, z]) => {
      this.spawnDropItem(new THREE.Vector3(x, -0.15, z), 'tree_branch');
      const item = this.droppedItems[this.droppedItems.length - 1];
      item.t = 1;
      item.targetX = x;
      item.targetZ = z;
      item.group.position.set(x, 0.05, z);
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
          fMesh.castShadow = true;
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
          cMesh.castShadow = true;
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

  update(delta, playerPos, inventoryCallback) {
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

      // 主角走近自动拾取检测 (距离 < 1.4 米)
      const dist = item.group.position.distanceTo(playerPos);
      if (dist < 1.4) {
        soundEngine.playItemDrop();
        haptics.light();
        this.group.remove(item.group);
        this.droppedItems.splice(i, 1);
        if (inventoryCallback) {
          inventoryCallback(item.type);
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
