// CastawaySOL - 海滩与礁石自然资源生成系统 (Beach & Coast Resource System)
// 保证燧石(stone_chunk)、大岩石(big_rock)、漂流木(tree_branch)、漂流物资箱真实物理可达
import * as THREE from 'three';
import { soundEngine } from '../core/AudioSystem.js';
import { haptics } from '../core/HapticFeedback.js';

export class BeachResourceSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // 存储当前世界中散落的可拾取资源点
    this.resources = [];

    // 初始化固定天然资源点配置 (分布在南岸沙滩、退潮礁石与溪流边)
    this.fixedSpawns = [
      // 1. 南岸沙滩初生地漂流木棍 (新玩家第一眼可见)
      { type: 'tree_branch', name: '漂流木棍', pos: new THREE.Vector3(-2.5, 0.05, 7.5), scale: 1.0 },
      { type: 'tree_branch', name: '漂流木棍', pos: new THREE.Vector3(3.2, 0.05, 8.2), scale: 1.0 },
      { type: 'tree_branch', name: '漂流木棍', pos: new THREE.Vector3(1.0, 0.05, 12.0), scale: 1.0 },
      { type: 'tree_branch', name: '漂流木棍', pos: new THREE.Vector3(-5.0, 0.05, 14.5), scale: 1.0 },

      // 2. 东南与西南海岸坚硬燧石 (制作锋利石斧的核心原料)
      { type: 'stone_chunk', name: '坚硬燧石', pos: new THREE.Vector3(-8.5, 0.08, 11.0), scale: 1.0 },
      { type: 'stone_chunk', name: '坚硬燧石', pos: new THREE.Vector3(7.8, 0.08, 10.5), scale: 1.0 },
      { type: 'stone_chunk', name: '坚硬燧石', pos: new THREE.Vector3(-14.2, 0.08, 16.0), scale: 1.1 },
      { type: 'stone_chunk', name: '坚硬燧石', pos: new THREE.Vector3(13.5, 0.08, 15.0), scale: 1.1 },

      // 3. 海滩大礁石 (需要重锤或石镐敲碎开采)
      { type: 'big_rock', name: '海滩大礁石', pos: new THREE.Vector3(-3.5, 0.15, 19.5), scale: 1.2, isMineable: true, hp: 2 },
      { type: 'big_rock', name: '海滩大礁石', pos: new THREE.Vector3(4.2, 0.15, 19.8), scale: 1.25, isMineable: true, hp: 2 },
      { type: 'big_rock', name: '海滩大礁石', pos: new THREE.Vector3(-11.0, 0.15, 22.0), scale: 1.1, isMineable: true, hp: 2 },
      { type: 'big_rock', name: '海滩大礁石', pos: new THREE.Vector3(10.5, 0.15, 21.5), scale: 1.2, isMineable: true, hp: 2 },

      // 3.5 主岛后山与海蚀崖壁玄武岩富铁矿脉露头 (需使用石镐/石锤敲凿开采)
      { type: 'iron_vein', name: '玄武岩铁矿脉', pos: new THREE.Vector3(17.2, 0.4, -16.5), scale: 1.3, isMineable: true, hp: 3 },
      { type: 'iron_vein', name: '海蚀赤铁矿矿床', pos: new THREE.Vector3(-15.5, 0.2, 11.5), scale: 1.25, isMineable: true, hp: 3 },

      // 3.6 主岛后山高台与秘境高能硅晶矿脉 (DePIN 挖矿核心原料，爆出未解密硅晶原石 sol_crystal)
      { type: 'sol_vein', name: '高能硅晶矿脉', pos: new THREE.Vector3(26.5, 1.8, -19.5), scale: 1.35, isMineable: true, hp: 3 },
      { type: 'sol_vein', name: '秘境硅晶矿床', pos: new THREE.Vector3(-24.5, 0.4, -10.5), scale: 1.3, isMineable: true, hp: 3 },

      // 4. 搁浅海难物资漂流木箱 (破损无线电、干燥电池、铁钉)
      { type: 'driftwood_chest', name: '搁浅物资箱', pos: new THREE.Vector3(-18.5, 0.2, 17.5), scale: 1.0, items: ['broken_radio', 'battery', 'nail'] },
      { type: 'driftwood_chest', name: '沉船遗落木箱', pos: new THREE.Vector3(18.0, 0.2, 16.0), scale: 1.0, items: ['nail', 'nail', 'tree_branch'] }
    ];

    this.spawnResources();
  }

  spawnResources() {
    this.fixedSpawns.forEach((spawn, idx) => {
      const itemGroup = new THREE.Group();
      itemGroup.position.copy(spawn.pos);

      let mesh;
      if (spawn.type === 'stone_chunk') {
        // 燧石：深灰菱角多面体
        const geo = new THREE.DodecahedronGeometry(0.22, 0);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x4a4b4d,
          roughness: 0.82,
          metalness: 0.2
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.set(Math.random(), Math.random(), Math.random());
      } else if (spawn.type === 'big_rock') {
        // 大礁石：沉实厚重的海边大岩
        const geo = new THREE.DodecahedronGeometry(0.42, 1);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x7f8c8d,
          roughness: 0.9,
          metalness: 0.1
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.scale.set(1.1, 0.75, 1.0);
      } else if (spawn.type === 'iron_vein') {
        // 玄武岩铁矿脉：深黑玄武岩体并镶嵌赤红铁矿结晶
        const geo = new THREE.DodecahedronGeometry(0.48, 1);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x3d3d3d,
          roughness: 0.7,
          metalness: 0.65
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.scale.set(1.2, 0.85, 1.1);

        // 表面镶嵌 3 颗暗红与金属光泽的铁矿原石微粒
        const crystalGeo = new THREE.OctahedronGeometry(0.14, 0);
        const crystalMat = new THREE.MeshStandardMaterial({
          color: 0xc0392b,
          roughness: 0.3,
          metalness: 0.85,
          emissive: 0x4a1008
        });
        const cOffsets = [
          new THREE.Vector3(0.25, 0.3, 0.2),
          new THREE.Vector3(-0.28, 0.25, -0.15),
          new THREE.Vector3(0.05, 0.42, -0.22)
        ];
        cOffsets.forEach(off => {
          const cMesh = new THREE.Mesh(crystalGeo, crystalMat);
          cMesh.position.copy(off);
          mesh.add(cMesh);
        });
      } else if (spawn.type === 'sol_vein') {
        // 高能硅晶矿脉 (Solana DePIN 矿脉)：深紫曜黑基岩，镶嵌高频发光青碧与紫光硅晶体
        const geo = new THREE.DodecahedronGeometry(0.5, 1);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x1f1b24,
          roughness: 0.6,
          metalness: 0.75
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.scale.set(1.25, 0.9, 1.15);

        // 镶嵌 4 颗发出青碧绿色与高能幽紫双色脉冲荧光的硅晶簇
        const solCrystals = [
          { pos: new THREE.Vector3(0.28, 0.35, 0.22), color: 0x14f195, emissive: 0x0ab874 },
          { pos: new THREE.Vector3(-0.3, 0.28, -0.18), color: 0x9945ff, emissive: 0x6c25c7 },
          { pos: new THREE.Vector3(0.08, 0.48, -0.2), color: 0x14f195, emissive: 0x0ab874 },
          { pos: new THREE.Vector3(-0.15, 0.38, 0.32), color: 0x00cec9, emissive: 0x00a896 }
        ];

        solCrystals.forEach(cfg => {
          const crystalGeo = new THREE.OctahedronGeometry(0.16, 0);
          const crystalMat = new THREE.MeshStandardMaterial({
            color: cfg.color,
            roughness: 0.2,
            metalness: 0.9,
            emissive: cfg.emissive,
            emissiveIntensity: 0.8
          });
          const cMesh = new THREE.Mesh(crystalGeo, crystalMat);
          cMesh.position.copy(cfg.pos);
          mesh.add(cMesh);
        });
      } else if (spawn.type === 'driftwood_chest') {
        // 搁浅木箱
        const geo = new THREE.BoxGeometry(0.65, 0.45, 0.55);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x8b5a2b,
          roughness: 0.75
        });
        mesh = new THREE.Mesh(geo, mat);
        // 加铁箍条纹
        const bandGeo = new THREE.BoxGeometry(0.67, 0.08, 0.57);
        const bandMat = new THREE.MeshStandardMaterial({ color: 0x2d3436, metalness: 0.6 });
        const bandMesh = new THREE.Mesh(bandGeo, bandMat);
        mesh.add(bandMesh);
      } else {
        // 漂流木棍
        const geo = new THREE.CylinderGeometry(0.06, 0.08, 0.75, 6);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x8b5a2b,
          roughness: 0.92
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.z = Math.PI / 2.3;
        mesh.rotation.y = Math.random() * Math.PI;
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      itemGroup.add(mesh);

      // 醒目微光点，方便玩家在沙滩上辨识探索
      const glowGeo = new THREE.RingGeometry(0.28, 0.35, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffdd59,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide
      });
      const glowRing = new THREE.Mesh(glowGeo, glowMat);
      glowRing.rotation.x = -Math.PI / 2;
      glowRing.position.y = -spawn.pos.y + 0.02;
      itemGroup.add(glowRing);

      this.group.add(itemGroup);

      this.resources.push({
        id: `res_${idx}`,
        type: spawn.type,
        name: spawn.name,
        pos: spawn.pos,
        group: itemGroup,
        glow: glowRing,
        items: spawn.items || [spawn.type],
        collected: false,
        isMineable: !!spawn.isMineable,
        hp: spawn.hp || 1,
        maxHp: spawn.hp || 1,
        regrowthSteps: 0
      });
    });
  }

  // 检测玩家走近轻便资源直接拾取 (排除需碎石采矿的坚硬巨石与矿床)
  checkPickup(playerPos, onCollect) {
    for (const res of this.resources) {
      if (res.collected || res.isMineable) continue;
      const dist = res.pos.distanceTo(playerPos);
      if (dist < 1.6) {
        res.collected = true;
        res.group.visible = false;
        soundEngine.playItemDrop();
        haptics.medium();

        // 将物品赋予玩家
        res.items.forEach((itemType) => {
          if (onCollect) {
            onCollect(itemType, res.name);
          }
        });
        return res;
      }
    }
    return null;
  }

  // 碎石采矿：手持石锤、骨柄石镐或精钢锻镐敲凿开采巨石与铁矿脉
  mineRock(res, hasHammer, hasPickaxe, onCollect) {
    if (!res || !res.isMineable || res.collected) return null;

    soundEngine.playHitImpact();
    haptics.heavy();

    // 每次敲击扣减 1 点硬度 (若使用专业石镐则开采效率加倍)
    const dmg = hasPickaxe ? 2 : 1;
    res.hp = Math.max(0, res.hp - dmg);

    // 敲击震颤动效
    if (res.group) {
      res.group.position.y += 0.08;
      setTimeout(() => {
        if (res.group) res.group.position.y = res.pos.y;
      }, 120);
    }

    if (res.hp <= 0) {
      // 成功击碎巨石/矿床！
      res.collected = true;
      res.regrowthSteps = 150; // 150 步后地壳岩脉重新隆起
      res.group.visible = false;
      soundEngine.playPlaceFurniture();

      let dropped = [];
      if (res.type === 'big_rock') {
        // 海滩大礁石碎裂：掉落 2 块坚硬燧石 + 1 块海滩大岩石，40% 爆出富铁矿石
        dropped = ['stone_chunk', 'stone_chunk', 'big_rock'];
        if (Math.random() < 0.45) dropped.push('iron_ore');
      } else if (res.type === 'iron_vein') {
        // 玄武岩铁矿脉：必爆 2 块富铁矿石 + 1 块海蚀碎石
        dropped = ['iron_ore', 'iron_ore', 'stone_chunk'];
        if (Math.random() < 0.5) dropped.push('iron_ore');
      } else if (res.type === 'sol_vein') {
        // 高能硅晶矿脉 (DePIN 矿床)：必爆 2 块未解密硅晶原石 + 1 块海蚀碎石，50% 额外爆出第 3 块硅晶
        dropped = ['sol_crystal', 'sol_crystal', 'stone_chunk'];
        if (Math.random() < 0.5) dropped.push('sol_crystal');
      }

      dropped.forEach(itemType => {
        if (onCollect) onCollect(itemType, res.name);
      });

      return { broken: true, name: res.name, items: dropped };
    }

    return { broken: false, remainingHp: res.hp, name: res.name };
  }

  // 步数驱动矿脉与散落资材地质再生
  recordMovement(stepCount = 1) {
    for (const res of this.resources) {
      if (res.isMineable && res.collected) {
        res.regrowthSteps -= stepCount;
        if (res.regrowthSteps <= 0) {
          res.collected = false;
          res.hp = res.maxHp || 2;
          res.group.visible = true;
        }
      }
    }
  }

  // 检测玩家是否处于淡水溪流或山泉清泉边 (用于水壶装水与补充淡水)
  isNearFreshwater(playerPos) {
    if (playerPos.z >= -13 && playerPos.z <= 35) {
      const progress = (playerPos.z + 14) / 50.0;
      const streamX = 13.5 + Math.sin(progress * Math.PI * 1.8) * 2.2;
      if (Math.abs(playerPos.x - streamX) <= 2.8) {
        return true;
      }
    }
    return false;
  }

  // 获得离玩家最近的资源点（供情境提示 HUD 显示）
  getNearest(playerPos, maxDist = 2.4) {
    let nearest = null;
    let minDist = maxDist;
    for (const res of this.resources) {
      if (res.collected) continue;
      const d = res.pos.distanceTo(playerPos);
      if (d < minDist) {
        minDist = d;
        nearest = res;
      }
    }
    return nearest;
  }

  // 动画更新（光圈轻微脉动）
  update(time) {
    const pulse = 0.35 + Math.sin(time * 3.5) * 0.15;
    for (const res of this.resources) {
      if (!res.collected && res.glow) {
        res.glow.material.opacity = pulse;
      }
    }
  }

  // 序列化与存档支持：记录已被拾取的资源 ID
  serialize() {
    return {
      collectedIds: this.resources.filter(r => r.collected).map(r => r.id)
    };
  }

  // 从存档恢复世界拾取状态
  deserialize(data) {
    if (!data || !Array.isArray(data.collectedIds)) return;
    const set = new Set(data.collectedIds);
    this.resources.forEach(res => {
      if (set.has(res.id)) {
        res.collected = true;
        res.group.visible = false;
      }
    });
  }
}
