// CastawaySOL - 小猴伙伴专属协同技能系统 (Monkey Helper Companion System)
// 深度还原《Survival Kids / 迷失蔚蓝》核心神髓：
// 1. 爬树摇果（Climb & Shake）：指挥小猴敏捷攀爬椰树/果树，摇落稀有黄金椰、高枝海鸟蛋与坚韧树皮；
// 2. 岩缝钻穴寻宝（Explore Crevices）：指派小猴钻入人类无法通过的狭窄后山岩缝，搜寻古代金币与珍稀宝物；
// 3. 投喂互动与亲密羁绊（Feed & Bonding）：投喂美味食物提升活力与亲密度，解锁更强寻宝机率与双倍采摘！

import * as THREE from 'three';
import { soundEngine } from '../core/AudioSystem.js';
import { haptics } from '../core/HapticFeedback.js';

export const MONKEY_CREVICE = Object.freeze({cooldown:45,crystals:2,chance:0.75});
export class MonkeyHelperSystem {
  constructor(game) {
    this.game = game;

    // 小猴状态属性
    this.affinity = 60;       // 亲密度 (0 ~ 100)
    this.energy = 80;         // 精力值 (0 ~ 100，爬树消耗 10，钻缝消耗 15)
    this.mode = 'follow';     // 'follow' 跟随 | 'stay' 留守 | 'busy' 执行任务中

    // 任务执行内部状态
    this.busyTimer = 0;
    this.busyAction = null;   // 'climbing' | 'crevice'
    this.busyTarget = null;
    this.originalPos = null;

    // 场景中的神秘狭小岩缝 (Monkey Crevices) 坐标
    this.crevices = [
      {
        id: 'crevice_cliff',
        name: '后山悬崖狭窄石隙',
        pos: new THREE.Vector3(18.5, 1.8, -19.5),
        desc: '悬崖峭壁下仅有掌宽的漆黑石缝，内部隐约有古代金属反光。',
        cooldown: 0,
        mesh: null
      },
      {
        id: 'crevice_arch',
        name: '海蚀拱门幽深石缝',
        pos: new THREE.Vector3(-16.0, 0.05, -12.0),
        desc: '潮汐岩洞玄武岩壁上的神秘缝隙，深不可测，常有海鸥落足。',
        cooldown: 0,
        mesh: null
      }
    ];

    this.initCreviceMarkers();
  }

  // 在 3D 场景中标记岩缝视觉实体
  initCreviceMarkers() {
    if (!this.game || !this.game.scene) return;
    const scene = this.game.scene;

    const markerGroup = new THREE.Group();
    markerGroup.name = 'monkey-crevice-markers';

    this.crevices.forEach((c) => {
      const g = new THREE.Group();
      g.position.copy(c.pos);

      // 深邃缝隙黑洞
      const holeGeo = new THREE.BoxGeometry(0.35, 0.7, 0.15);
      const holeMat = new THREE.MeshStandardMaterial({
        color: 0x0a0a0f,
        roughness: 0.95
      });
      const hole = new THREE.Mesh(holeGeo, holeMat);
      hole.position.y = 0.35;
      g.add(hole);

      // 微光幽蓝光环标记
      const ringGeo = new THREE.RingGeometry(0.4, 0.52, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00cec9,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      g.add(ring);

      // 小巧悬浮金币微缩标识
      const iconGeo = new THREE.SphereGeometry(0.1, 8, 8);
      const iconMat = new THREE.MeshStandardMaterial({
        color: 0xffd32a,
        emissive: 0xffa801,
        emissiveIntensity: 0.6
      });
      const icon = new THREE.Mesh(iconGeo, iconMat);
      icon.position.y = 0.85;
      g.add(icon);

      c.mesh = g;
      markerGroup.add(g);
    });

    scene.add(markerGroup);
  }

  // 获取小猴 3D 实体对象 (来自 VillagerManager)
  getMonkeyEntity() {
    if (!this.game || !this.game.villagers) return null;
    return this.game.villagers.villagers.find(v => v.id === 'bub_monkey') || null;
  }

  // 检查小猴是否已经成为伙伴并处于跟随状态
  isAvailable() {
    const isFriended = this.game && this.game.story && this.game.story.monkeyBefriended;
    return Boolean(isFriended) && this.mode !== 'busy';
  }

  // 检测玩家身边是否有可指派小猴交互的目标
  getAvailableAction(playerPos) {
    if (!this.isAvailable()) return null;

    // 1. 优先检测岩缝 (距离 2.5 米内)
    for (const crevice of this.crevices) {
      const dist = crevice.pos.distanceTo(playerPos);
      if (dist < 2.5) {
        return {
          type: 'crevice',
          target: crevice,
          title: `🐒 指派小猴钻入【${crevice.name}】探宝`,
          energyCost: 15
        };
      }
    }

    // 2. 检测树木 (距离 3.2 米内的椰子树或果树)
    if (this.game && this.game.trees) {
      const nearestTree = this.game.trees.getNearestTree(playerPos, 3.2);
      if (nearestTree) {
        const isPalm = nearestTree.info && nearestTree.info.id === 'palm_tree';
        const isApple = nearestTree.info && nearestTree.info.id === 'apple_tree';
        if (isPalm || isApple) {
          return {
            type: 'tree',
            target: nearestTree,
            title: `🐒 指挥小猴攀爬【${nearestTree.info.name}】采摘稀有果实`,
            energyCost: 10
          };
        }
      }
    }

    return null;
  }

  // 执行爬树采摘技能 (Climb & Shake)
  commandClimbTree(treeObj) {
    if (!this.isAvailable()) {
      this.game.ui.showToast('🐒 小猴 Bub 正忙或尚未入队！', 'medium');
      return false;
    }
    if (this.energy < 10) {
      this.game.ui.showToast('🐒 小猴 Bub 已经精疲力竭了，请先喂食苹果或香蕉恢复精力！', 'medium');
      return false;
    }

    const monkey = this.getMonkeyEntity();
    if (!monkey) return false;

    this.energy -= 10;
    this.mode = 'busy';
    this.busyAction = 'climbing';
    this.busyTarget = treeObj;
    this.busyTimer = 2.4; // 攀爬持续时间 2.4 秒
    this.originalPos = monkey.group.position.clone();

    haptics.medium();
    soundEngine.playItemDrop();
    this.game.ui.showToast('🐒 小猴 Bub 灵巧地蹿上树冠，正在奋力晃动树枝！', 'small');

    // 摇晃树木物理动效
    if (this.game.trees && this.game.trees.shakeTreeMesh) {
      this.game.trees.shakeTreeMesh(treeObj);
    }

    return true;
  }

  // 执行岩缝钻穴寻宝技能 (Explore Crevice)
  commandExploreCrevice(creviceObj) {
    if (!this.isAvailable()) {
      this.game.ui.showToast('🐒 小猴 Bub 正忙或尚未入队！', 'medium');
      return false;
    }
    if (this.energy < 15) {
      this.game.ui.showToast('🐒 小猴 Bub 肚子咕咕叫，精力不足，请先投喂点心！', 'medium');
      return false;
    }
    if (creviceObj.cooldown > 0) {
      this.game.ui.showToast(`⌛ 此处石缝刚被搜寻过，小海兽尚未搬来新宝物（剩余冷却 ${Math.ceil(creviceObj.cooldown)}秒）！`, 'medium');
      return false;
    }

    const monkey = this.getMonkeyEntity();
    if (!monkey) return false;

    this.energy -= 15;
    this.mode = 'busy';
    this.busyAction = 'crevice';
    this.busyTarget = creviceObj;
    this.busyTimer = 2.8;
    this.originalPos = monkey.group.position.clone();

    // 小猴快速冲向岩缝并钻入黑洞
    monkey.group.position.copy(creviceObj.pos);
    monkey.group.visible = false; // 钻入隐身

    haptics.success();
    soundEngine.playSplash();
    this.game.ui.showToast(`🐒 小猴哧溜一声钻进了【${creviceObj.name}】的黑暗深处！`, 'small');

    return true;
  }

  // 投喂食物 (Feed Monkey)
  feedMonkey(foodKey) {
    const inv = this.game.ui ? this.game.ui.inventory : {};
    if ((inv[foodKey] || 0) <= 0) return { ok: false, msg: '行囊中无此食物' };

    inv[foodKey]--;
    if (inv[foodKey] <= 0) delete inv[foodKey];

    // 根据食物类型大幅恢复精力与好感
    let energyAdd = 30;
    let affinityAdd = 5;

    if (foodKey === 'golden_coconut') {
      energyAdd = 60;
      affinityAdd = 15;
    } else if (foodKey === 'baked_fish' || foodKey === 'cooked_crab') {
      energyAdd = 50;
      affinityAdd = 10;
    } else if (foodKey === 'coconut' || foodKey === 'apple') {
      energyAdd = 35;
      affinityAdd = 8;
    }

    this.energy = Math.min(100, this.energy + energyAdd);
    this.affinity = Math.min(100, this.affinity + affinityAdd);

    haptics.success();
    soundEngine.playCooking();
    if (this.game.ui) {
      this.game.ui.renderInventory();
      this.game.ui.showToast(`🐒 小猴美美地吃光了【${this.game.ui.getItemName(foodKey)}】！精力+${energyAdd}，好感度+${affinityAdd}！`, 'small');
    }

    return { ok: true, energy: this.energy, affinity: this.affinity };
  }

  // 每帧更新动画与任务结算
  update(delta) {
    // 1. 冷却计时器
    this.crevices.forEach((c) => {
      if (c.cooldown > 0) c.cooldown -= delta;
      if (c.mesh) {
        c.mesh.children[2].rotation.y += delta * 2.0; // 金币图标自转
      }
    });

    if (this.mode !== 'busy') return;

    this.busyTimer -= delta;
    const monkey = this.getMonkeyEntity();

    if (this.busyAction === 'climbing' && monkey && this.busyTarget) {
      // 驱动小猴顺着树干上下移动
      const treePos = this.busyTarget.group.position;
      const progress = 1.0 - (this.busyTimer / 2.4); // 0 -> 1

      monkey.group.position.x = treePos.x + 0.3;
      monkey.group.position.z = treePos.z + 0.3;

      if (progress < 0.4) {
        // 向上攀爬
        monkey.group.position.y = treePos.y + (progress / 0.4) * 3.2;
      } else if (progress < 0.7) {
        // 在树顶摇晃
        monkey.group.position.y = treePos.y + 3.2 + Math.sin(progress * 25.0) * 0.15;
      } else {
        // 顺滑下滑落地
        monkey.group.position.y = treePos.y + (1.0 - (progress - 0.7) / 0.3) * 3.2;
      }
    }

    // 任务完成结算
    if (this.busyTimer <= 0) {
      this.finishBusyAction();
    }
  }

  // 结算任务产出
  finishBusyAction() {
    const monkey = this.getMonkeyEntity();
    if (monkey) {
      monkey.group.visible = true;
      if (this.originalPos) monkey.group.position.copy(this.originalPos);
    }

    if (this.busyAction === 'climbing' && this.busyTarget) {
      // 爬树收获结算：必定产出稀有黄金果实与高处鸟蛋
      const isPalm = this.busyTarget.info && this.busyTarget.info.id === 'palm_tree';
      const treePos = this.busyTarget.group.position;

      const drops = [];
      if (isPalm) {
        drops.push({ id: 'golden_coconut', count: 1, name: '黄金海岛椰子 🥥✨' });
        if (Math.random() < 0.6 || this.affinity > 75) {
          drops.push({ id: 'bird_egg', count: 1, name: '高枝海鸟蛋 🥚' });
        }
      } else {
        drops.push({ id: 'apple', count: 2, name: '多汁鲜甜红苹果 🍎' });
        drops.push({ id: 'bird_egg', count: 1, name: '林间海鸟蛋 🥚' });
      }

      drops.push({ id: 'tough_bark', count: 2, name: '坚韧高枝树皮 🍂' });

      // 掉落在树下
      drops.forEach((d) => {
        this.game.ui.addInventory(d.id, d.count);
      });

      soundEngine.playItemDrop();
      haptics.success();
      this.game.ui.showDialog(
        '🐒 小猴爬树丰收归来！',
        `小猴 Bub 从树顶哧溜滑下，兴高采烈地向你献上采摘的稀有物资：\n\n${drops.map(d => `• ${d.name} x${d.count}`).join('\n')}\n\n【小猴获得了你的认可，心情大好！】`
      );
    } else if (this.busyAction === 'crevice' && this.busyTarget) {
      // 岩缝寻宝收获结算：概率产出古代金币、珍珠、藏宝图残页与铁矿
      this.busyTarget.cooldown = MONKEY_CREVICE.cooldown; // 冷却 45 秒

      const lootPool = [
        { id: 'sol_crystal', count: MONKEY_CREVICE.crystals, name: '未解密高能硅晶原石 💎 (DePIN 算力核心)', prob: MONKEY_CREVICE.chance },
        { id: 'battery', count: 1, name: '干燥储能电池 🔋 (矿机备用电源)', prob: 0.5 },
        { id: 'ancient_coin', count: 1, name: '古代文明海盗金币 🪙', prob: 0.45 },
        { id: 'treasure_map_piece', count: 1, name: '羊皮纸藏宝图残页 🗺️', prob: 0.35 },
        { id: 'iron_ore', count: 2, name: '深层天然铁矿石 🪨', prob: 0.5 }
      ];

      const gotten = [];
      lootPool.forEach((item) => {
        if (Math.random() < item.prob) {
          gotten.push(item);
          this.game.ui.addInventory(item.id, item.count, 'monkey_crevice');
        }
      });

      if (gotten.length === 0) {
        gotten.push(lootPool[0]);
        this.game.ui.addInventory(lootPool[0].id, lootPool[0].count, 'monkey_crevice');
      }

      soundEngine.playItemDrop();
      haptics.success();
      this.game.ui.showDialog(
        '🐒 小猴岩缝淘金凯旋！',
        `小猴 Bub 满身泥灰地从石缝钻出，嘴里叼着闪闪发光的古老宝物献给你：\n\n${gotten.map(g => `• ${g.name} x${g.count}`).join('\n')}\n\n【古金币可用于未来向过路商船兑换传奇图纸！】`
      );
    }

    this.mode = 'follow';
    this.busyAction = null;
    this.busyTarget = null;
  }

  // 序列化持久化存档
  serialize() {
    return {
      affinity: this.affinity,
      energy: this.energy,
      mode: this.mode
    };
  }

  // 反序列化恢复
  deserialize(data) {
    if (!data) return;
    if (typeof data.affinity === 'number') this.affinity = data.affinity;
    if (typeof data.energy === 'number') this.energy = data.energy;
    if (data.mode) this.mode = data.mode;
  }
}
