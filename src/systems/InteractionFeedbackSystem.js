// CastawaySOL - 全沉浸式【可交互感知系统】(Interaction Feedback System)
// 1. 3D 世界地面交互指示环 (Ground Target Focus Ring) - 零开销单例复用，柔和呼吸起伏
// 2. HUD 动态情境动作胶囊 (Context-Aware Action Button) - 实时响应当前锁定的可交互实体，更新图标、文字与高光色

import * as THREE from 'three';
import { distanceXZ, ISLAND_LAYOUT } from '../core/IslandLayout.js';

export class InteractionFeedbackSystem {
  constructor(game) {
    this.game = game;
    this.currentTarget = null;
    this.time = 0;

    // DOM 动作按钮引用缓存
    this.actionBtn = document.getElementById('main-action-btn');
    this.actionIcon = document.getElementById('main-action-icon');
    this.actionText = document.getElementById('main-action-text');

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

    if (!this.game || !this.game.player) return;
    const playerPos = this.game.player.position;

    // 检索当前最具优先级的交互目标
    const target = this.detectNearestInteractable(playerPos);
    this.currentTarget = target;

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

    // 1. 战利品 / 掉落包裹
    if (game.wildlifeCombat) {
      for (const loot of game.wildlifeCombat.lootBags) {
        if (!loot.picked && loot.pos.distanceTo(playerPos) < 2.5) {
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
      const hasAxeOrStone = (inv['rock'] || 0) + (inv['flint'] || 0) >= 3;
      const fireText = (game.weatherSystem && !game.weatherSystem.hasFireShelter && hasAxeOrStone)
        ? '搭建避雨石棚 / 烤火'
        : '烘烤取暖 / 烹饪';
      return {
        id: 'campfire',
        name: '营地篝火',
        icon: '🔥',
        text: fireText,
        pos: new THREE.Vector3(ISLAND_LAYOUT.campfire[0], 0.05, ISLAND_LAYOUT.campfire[2]),
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
        pos: new THREE.Vector3(-14.5, 0.05, 23.5),
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
        pos: new THREE.Vector3(ISLAND_LAYOUT.tent[0], 0.05, ISLAND_LAYOUT.tent[2]),
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
        pos: new THREE.Vector3(ISLAND_LAYOUT.raft[0], 0.05, ISLAND_LAYOUT.raft[2]),
        scale: 2.2,
        color: 0x3498db
      };
    }

    // 10. 钓鱼状态
    if (game.fishing && game.fishing.isNearWater(playerPos)) {
      return {
        id: 'fishing',
        name: '海钓水域',
        icon: '🎣',
        text: '甩竿海钓',
        pos: new THREE.Vector3(playerPos.x, 0.03, playerPos.z),
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
        if (this.actionIcon) this.actionIcon.innerHTML = target.icon;
        if (this.actionText) this.actionText.textContent = target.text;

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
        if (this.actionIcon) this.actionIcon.innerHTML = '💬';
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
