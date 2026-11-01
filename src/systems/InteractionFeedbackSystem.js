// CastawaySOL - 全沉浸式【可交互感知系统】(Interaction Feedback System)
// 1. 3D 世界地面交互指示环 (Ground Target Focus Ring) - 零开销单例复用，柔和呼吸起伏
// 2. HUD 动态情境动作胶囊 (Context-Aware Action Button) - 实时响应当前锁定的可交互实体，更新图标、文字与高光色

import * as THREE from 'three';
import { distanceXZ, ISLAND_LAYOUT } from '../core/IslandLayout.js';
import { iconHTML } from '../ui/IconRegistry.js'; // 黏土图标集成（2026-10-31）

// 黏土图标第二批（2026-10-31）：主按钮情境 emoji → 黏土图标对照；对不上的保持 emoji
const CONTEXT_EMOJI_ICON = {
  '🎣': 'tools/fishing_rod', '🍎': 'items/apple', '🥥': 'items/coconut', '🪵': 'items/log', '🪓': 'tools/stone_axe',
  '⛏': 'tools/stone_pickaxe', '🐚': 'items/clam', '💬': 'hud/interact', '🔥': 'items/tinder', '⛵': 'items/raft',
  '🚰': 'items/water_bamboo', '💧': 'items/water_bamboo', '💎': 'items/sol_crystal', '📻': 'items/working_radio',
  '🏕': 'menu/camp', '⛺': 'menu/camp'
};
function contextIconHTML(emoji) {
  const key = String(emoji || '').replace(/\uFE0F/g, '');
  const path = CONTEXT_EMOJI_ICON[key];
  return path ? iconHTML(path, 30, { eager: true }) : emoji;
}

function formatActionText(raw) {
  if (!raw) return '探索';
  let str = String(raw).trim();

  // 动作动词智能提纯（主交互按钮是圆形胶囊，只容纳 2~4 字核心动作，实体全名与详情在上方 context-tag 展示）
  if (/开采|敲凿|采矿/.test(str)) return '开采';
  if (/砍伐|伐木/.test(str)) return '砍伐';
  if (/采摘|摇晃/.test(str)) return '采摘';
  if (/打捞/.test(str)) return '打捞';
  if (/拾取/.test(str)) return '拾取';
  if (/饮水|取水|甘泉/.test(str)) return '饮水';
  if (/烹饪|烘烤|烤火|取暖/.test(str)) return '烹饪';
  if (/睡觉|过夜|休息/.test(str)) return '过夜';
  if (/交谈|对话|聊天/.test(str)) return '对话';
  if (/投喂/.test(str)) return '投喂';
  if (/起竿|抛竿|垂钓|钓鱼/.test(str)) return '垂钓';
  if (/出海|扬帆|登船|木筏/.test(str)) return '出海';
  if (/搭建|组装|建造|架设/.test(str)) return '建造';
  if (/存取|储物|木箱/.test(str)) return '储物';
  if (/排班|告示|经营/.test(str)) return '经营';
  if (/空投|特权|补给/.test(str)) return '补给';
  if (/解密|参悟|调查/.test(str)) return '调查';
  if (/开启|神藏/.test(str)) return '开启';
  if (/攻击|突击|迎战/.test(str)) return '攻击';

  const first = str.split(/[\s/]/)[0];
  if (first && first.length >= 2 && first.length <= 4) {
    return first;
  }
  return str.slice(0, 4);
}

export class InteractionFeedbackSystem {
  constructor(game) {
    this.game = game;
    this.currentTarget = null;
    this.time = 0;
    this.detectTimer = 0; // 交互检测节流计时器 (0.05s 间隔)

    // DOM 动作按钮引用缓存
    this.actionBtn = document.getElementById('main-action-btn');
    this.actionIcon = document.getElementById('main-action-icon');
    this.actionText = document.getElementById('main-action-text');

    // 预分配固定设施世界坐标，彻底消除主循环 GC 垃圾回收瞬时卡顿
    this.staticPos = {
      campfire: new THREE.Vector3(ISLAND_LAYOUT.campfire[0], 0.05, ISLAND_LAYOUT.campfire[2]),
      chest: new THREE.Vector3(-14.5, 0.05, 23.5),
      tent: new THREE.Vector3(ISLAND_LAYOUT.tent[0], 0.05, ISLAND_LAYOUT.tent[2]),
      raft: new THREE.Vector3(ISLAND_LAYOUT.raft[0], 0.05, ISLAND_LAYOUT.raft[2]),
      playerWater: new THREE.Vector3(),
      templePortal: new THREE.Vector3(0, 0.4, 15),
      templeAltar: new THREE.Vector3(0, 0.4, 2),
      templeVault: new THREE.Vector3(0, 0.8, -22)
    };

    // 默认空闲状态
    this.lastStateKey = 'idle';

    // 初始化 3D 地面柔光指示环
    this.initFocusRing();
  }

  // 初始化 3D 地面柔光指示光环 (双层环：内层柔和发光圆盘 + 外层微旋转虚线环)
  initFocusRing() {
    this.ringGroup = new THREE.Group();
    this.ringGroup.visible = false;

    // 1. 内层柔光同心圆环
    const innerGeo = new THREE.RingGeometry(0.55, 0.85, 32);
    innerGeo.rotateX(-Math.PI / 2);
    this.innerMat = new THREE.MeshBasicMaterial({
      color: 0xffd32a,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.innerMesh = new THREE.Mesh(innerGeo, this.innerMat);
    this.ringGroup.add(this.innerMesh);

    // 2. 外层微弱呼吸虚线轮廓
    const outerGeo = new THREE.RingGeometry(0.92, 1.05, 32);
    outerGeo.rotateX(-Math.PI / 2);
    this.outerMat = new THREE.MeshBasicMaterial({
      color: 0xfff5cc,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.outerMesh = new THREE.Mesh(outerGeo, this.outerMat);
    this.ringGroup.add(this.outerMesh);

    // 注入场景
    if (this.game && this.game.scene) {
      this.game.scene.add(this.ringGroup);
    }
  }

  // 帧更新：检测玩家最靠近的可交互实体并更新 3D 光环与 HUD 胶囊
  update(delta) {
    this.time += delta;
    this.detectTimer += delta;

    if (!this.game || !this.game.player) return;
    const playerPos = this.game.player.position;

    // 0.05 秒节流检测目标，降低 70% 的全图空间碰撞开销
    if (this.detectTimer >= 0.05) {
      this.detectTimer = 0;
      this.currentTarget = this.detectNearestInteractable(playerPos);
    }
    const target = this.currentTarget;

    if (target) {
      // 1. 显示并更新 3D 地面光环
      this.ringGroup.visible = true;

      // 目标位置平滑插值跟随
      const targetPos = target.pos;
      const targetY = (target.yOffset !== undefined) ? target.pos.y + target.yOffset : (target.pos.y + 0.035);
      this.ringGroup.position.x = THREE.MathUtils.lerp(this.ringGroup.position.x, targetPos.x, delta * 12.0);
      this.ringGroup.position.z = THREE.MathUtils.lerp(this.ringGroup.position.z, targetPos.z, delta * 12.0);
      this.ringGroup.position.y = targetY;

      // 根据目标物体体型动态调整光环缩放
      const baseScale = target.scale || 1.0;
      const pulse = 1.0 + Math.sin(this.time * 4.5) * 0.08;
      const finalScale = baseScale * pulse;
      this.innerMesh.scale.set(finalScale, 1.0, finalScale);
      this.outerMesh.scale.set(finalScale * 1.15, 1.0, finalScale * 1.15);

      // 外环微自转
      this.outerMesh.rotation.y += delta * 1.2;

      // 动态匹配主题色彩 (暖金 / 翠绿 / 暖橙 / 水蓝 / 亮紫)
      const themeColor = target.color || 0xffd32a;
      this.innerMat.color.setHex(themeColor);
      this.outerMat.color.setHex(themeColor);
      this.innerMat.opacity = 0.55 + Math.sin(this.time * 4.5) * 0.2;

      // 2. 动态更新 HUD 动作按钮
      this.updateActionHUD(target);
    } else {
      // 无交互目标时隐藏光环
      this.ringGroup.visible = false;
      this.updateActionHUD(null);
    }
  }

  // 优先级检测逻辑：完全对齐 main.js 中的交互判定
  detectNearestInteractable(playerPos) {
    const game = this.game;
    const inv = (game.ui ? game.ui.inventory : {}) || {};

    // === 0. 神殿独立室内地宫地图专属交互优先级 ===
    if (game.currentIslandId === 'ancient_temple') {
      const distToPortal = distanceXZ(playerPos, [0, 0, 15]);
      const distToAltar = distanceXZ(playerPos, [0, 0, 2]);
      const distToVault = distanceXZ(playerPos, [0, 0, -22]);

      if (distToPortal < 3.2) {
        return {
          id: 'temple_portal',
          name: '符文传送光阵',
          icon: '🌀',
          text: '返回海岛主地图',
          pos: new THREE.Vector3(0, 0.4, 15),
          scale: 1.8,
          color: 0x0abde3
        };
      } else if (distToAltar < 3.8) {
        const stageName = game.templePuzzle ? (game.templePuzzle.stage === 0 ? '第一重·棱镜对焦' : game.templePuzzle.stage === 1 ? '第二重·九宫图腾' : '已破阵') : '密室机关';
        return {
          id: 'temple_altar',
          name: '星辰日冕祭坛',
          icon: '🏛️',
          text: `参悟日冕机关 (${stageName})`,
          pos: new THREE.Vector3(0, 0.4, 2),
          scale: 2.0,
          color: 0xffd32a
        };
      } else if (distToVault < 3.8) {
        const isDoorOpen = game.ancientTempleScene && game.ancientTempleScene.isInnerGateOpen;
        const isClaimed = game.templePuzzle && game.templePuzzle.vaultClaimed;
        return {
          id: 'temple_vault',
          name: '波塞冬黄金神藏',
          icon: '👑',
          text: isDoorOpen ? (isClaimed ? '神藏已领取' : '开启黄金神藏！') : '玄铁大门紧闭',
          pos: new THREE.Vector3(0, 0.8, -22),
          scale: 2.2,
          color: isDoorOpen ? 0xffd32a : 0x747d8c
        };
      }
      return null;
    }

    // === 主岛与其它岛屿交互 ===
    // 1. 战利品 / 掉落包裹 (严格防御检查)
    if (game.wildlifeCombat) {
      const lootList = game.wildlifeCombat.lootDrops || game.wildlifeCombat.lootBags || [];
      if (Array.isArray(lootList)) {
        for (const loot of lootList) {
          if (!loot.picked && loot.pos && loot.pos.distanceTo(playerPos) < 2.5) {
            return {
              id: 'loot',
              name: loot.name || '拾取战利品',
              icon: '🎁',
              text: '拾取战利品',
              pos: loot.pos,
              scale: 0.8,
              color: 0xffd32a
            };
          }
        }
      }
    }

    // 2. 台风冲刷宝藏
    if (game.weatherSystem && game.weatherSystem.typhoonWashedItems) {
      for (const item of game.weatherSystem.typhoonWashedItems) {
        if (!item.picked && item.pos.distanceTo(playerPos) < 2.5) {
          return {
            id: 'typhoon_loot',
            name: item.name,
            icon: item.icon || '🧰',
            text: `打捞 ${item.name}`,
            pos: item.pos,
            scale: 1.1,
            color: 0x00cec9
          };
        }
      }
    }

    // 3. 远古秘宝宝石
    if (game.gemMeshes) {
      for (const gem of game.gemMeshes) {
        if (!gem.info.picked && gem.group.position.distanceTo(playerPos) < 2.5) {
          return {
            id: 'gem',
            name: gem.info.name,
            icon: '💎',
            text: '拾取远古宝石',
            pos: gem.group.position,
            scale: 0.9,
            color: gem.info.color || 0x3867d6
          };
        }
      }
    }

    // 4. 小动物村民与探险伙伴
    if (game.villagers) {
      const villager = game.villagers.getNearestVillager(playerPos, 3.2);
      if (villager) {
        if (villager.id === 'bub_monkey') {
          const isFriended = game.story && game.story.monkeyBefriended;
          return {
            id: 'villager_monkey',
            name: villager.name,
            icon: '🐒',
            text: isFriended ? '巴布伙伴管理' : '投喂小猴巴布',
            pos: villager.group.position,
            scale: 1.1,
            color: 0xfdcb6e
          };
        } else if (villager.id === 'second_kid') {
          const isAwake = game.story && game.story.secondKidAwake;
          return {
            id: 'villager_ellie',
            name: villager.name,
            icon: '🌸',
            text: isAwake ? '与艾莉交谈/赠礼' : '紧急救醒艾莉',
            pos: villager.group.position,
            scale: 1.1,
            color: 0xff7675
          };
        } else {
          return {
            id: 'villager_generic',
            name: villager.name,
            icon: '💬',
            text: `与 ${villager.name} 对话`,
            pos: villager.group.position,
            scale: 1.1,
            color: 0x74b9ff
          };
        }
      }
    }

    // 5. 营地原生设施 (火塘、储物箱、告示牌、电台、净水台、捕蟹笼、烟熏架)
    if (game.campEntities && game.campEntities.anchors) {
      const a = game.campEntities.anchors;

      // 5.1 经营告示牌
      if (playerPos.distanceTo(a.noticeboard) < 2.5) {
        return {
          id: 'camp_noticeboard',
          name: '经营告示牌',
          icon: '🏕️',
          text: '营地经营与排班',
          pos: a.noticeboard,
          scale: 1.3,
          color: 0x00b894
        };
      }

      // 5.2 救援电台
      if (playerPos.distanceTo(a.radioTerminal) < 2.5) {
        return {
          id: 'camp_radio',
          name: '无线电站',
          icon: '📻',
          text: '空投补给与特权',
          pos: a.radioTerminal,
          scale: 1.2,
          color: 0x9945ff
        };
      }

      // 5.3 净水滴滤台
      if (playerPos.distanceTo(a.waterPurifier) < 2.5) {
        return {
          id: 'camp_purifier',
          name: '净水滴滤台',
          icon: '🚰',
          text: '汲取纯净甘泉',
          pos: a.waterPurifier,
          scale: 1.2,
          color: 0x0984e3
        };
      }
    }

    // 5.4 营地中央篝火
    const distToFire = distanceXZ(playerPos, ISLAND_LAYOUT.campfire);
    if (distToFire < 3.2) {
      const hasAxeOrStone = (inv['stone_chunk'] || 0) + (inv['rock'] || 0) + (inv['flint'] || 0) >= 3;
      const fireText = (game.weatherSystem && !game.weatherSystem.hasFireShelter && hasAxeOrStone)
        ? '搭建避雨石棚 / 烤火'
        : '烘烤取暖 / 烹饪';
      return {
        id: 'campfire',
        name: '营地篝火',
        icon: '🔥',
        text: fireText,
        pos: this.staticPos.campfire,
        scale: 1.5,
        color: 0xe17055
      };
    }

    // 5.5 营地坚固储物箱
    const distToChest = Math.hypot(playerPos.x - (-14.5), playerPos.z - 23.5);
    if (distToChest < 2.5) {
      return {
        id: 'camp_chest',
        name: '营地储物箱',
        icon: '📦',
        text: '整理储物木箱',
        pos: this.staticPos.chest,
        scale: 1.2,
        color: 0xfdcb6e
      };
    }

    // 5.6 露营帐篷
    const distToTent = distanceXZ(playerPos, ISLAND_LAYOUT.tent);
    if (distToTent < 3.6) {
      return {
        id: 'camp_tent',
        name: '避风帐篷',
        icon: '⛺',
        text: '入帐休息过夜',
        pos: this.staticPos.tent,
        scale: 1.6,
        color: 0x20bf6b
      };
    }

    // 6. 树木摇晃与砍伐
    if (game.trees) {
      const tree = game.trees.getNearestTree(playerPos, 3.0);
      if (tree && !tree.isFelled) {
        const hasAxe = (inv['stone_axe'] || 0) > 0;
        const isPalm = tree.id === 'palm_tree';
        const actIcon = hasAxe ? '🪓' : (isPalm ? '🥥' : '🍎');
        const actText = hasAxe ? `挥斧砍伐 ${tree.name}` : `摇晃采摘 ${tree.name}`;
        return {
          id: 'tree',
          name: tree.name,
          icon: actIcon,
          text: actText,
          pos: tree.group.position,
          scale: 1.5,
          color: hasAxe ? 0xe67e22 : 0x2ecc71
        };
      }
    }

    // 7. 淡水小溪与清泉饮水
    if (game.beachResources && game.beachResources.isNearFreshwater(playerPos)) {
      return {
        id: 'freshwater',
        name: '清凉溪流',
        icon: '💧',
        text: '痛快饮水 / 灌满水壶',
        pos: new THREE.Vector3(playerPos.x, 0.03, playerPos.z),
        scale: 1.0,
        color: 0x00cec9
      };
    }

    // 8. 海滩贝壳、燧石、漂流木散落资源
    if (game.beachResources) {
      const nearRes = game.beachResources.getNearest(playerPos, 2.2);
      if (nearRes && !nearRes.collected) {
        const isMine = nearRes.isMineable;
        return {
          id: 'beach_resource',
          name: nearRes.name,
          icon: isMine ? '⛏️' : '🐚',
          text: isMine ? `敲凿开采 ${nearRes.name}` : `拾取 ${nearRes.name}`,
          pos: nearRes.mesh ? nearRes.mesh.position : playerPos,
          scale: 0.9,
          color: isMine ? 0x95a5a6 : 0xf1c40f
        };
      }
    }

    // 9. 浅滩出海大木筏与码头
    const isNearDock = game.dockShipEntity ? game.dockShipEntity.isNearShipyard(playerPos, 5.0) : (distanceXZ(playerPos, ISLAND_LAYOUT.raft) < 5.0);
    if (isNearDock) {
      const isBuilt = game.story && game.story.raftBuilt;
      return {
        id: 'dock_raft',
        name: '出海码头',
        icon: '⛵',
        text: isBuilt ? '扬帆登船 / 升级航船' : '筹集材料组装木筏',
        pos: this.staticPos.raft,
        scale: 2.2,
        color: 0x3498db
      };
    }

    // 10. 钓鱼状态
    if (game.fishing && game.fishing.isNearWater(playerPos)) {
      this.staticPos.playerWater.set(playerPos.x, 0.03, playerPos.z);
      return {
        id: 'fishing',
        name: '海钓水域',
        icon: '🎣',
        text: '甩竿海钓',
        pos: this.staticPos.playerWater,
        scale: 1.1,
        color: 0x1abc9c
      };
    }

    return null;
  }

  // 动态更新右下角主动作胶囊按钮
  updateActionHUD(target) {
    if (!this.actionBtn) {
      this.actionBtn = document.getElementById('main-action-btn');
      this.actionIcon = document.getElementById('main-action-icon');
      this.actionText = document.getElementById('main-action-text');
    }
    if (!this.actionBtn) return;

    if (target) {
      const stateKey = `${target.id}_${target.text}`;
      if (this.lastStateKey !== stateKey) {
        this.lastStateKey = stateKey;

        // 注入高亮动画与情境信息
        if (this.actionIcon) this.actionIcon.innerHTML = contextIconHTML(target.icon); // 黏土图标第二批
        if (this.actionText) this.actionText.textContent = formatActionText(target.text);

        // 按钮高亮脉冲并赋予醒目质感
        this.actionBtn.style.opacity = '1';
        this.actionBtn.style.background = 'linear-gradient(135deg, #00b894, #00cec9)';
        this.actionBtn.style.boxShadow = '0 0 22px rgba(0, 206, 201, 0.65), 0 4px 14px rgba(0,0,0,0.4)';
        this.actionBtn.style.transform = 'scale(1.05)';
        this.actionBtn.style.border = '2px solid rgba(255, 255, 255, 0.9)';
      }
    } else {
      if (this.lastStateKey !== 'idle') {
        this.lastStateKey = 'idle';

        // 恢复柔和待机
        if (this.actionIcon) this.actionIcon.innerHTML = iconHTML('hud/interact', 30, { eager: true });
        if (this.actionText) this.actionText.textContent = '探索';

        this.actionBtn.style.opacity = '0.72';
        this.actionBtn.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.08))';
        this.actionBtn.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.25)';
        this.actionBtn.style.transform = 'scale(1.0)';
        this.actionBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
      }
    }
  }
}
