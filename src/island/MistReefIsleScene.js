// CastawaySOL - 晶雾回声岛 (Mist Reef Isle) 场景与终局晶海生态系统
// 纯 Three.js 程序化几何体构建：荧光环礁潟湖、巨型晶簇尖塔、深层海脉晶核、孔雀铜矿脉、深海母贝珍珠、先民潮汐传送残阵与晶雾观测前哨站
import * as THREE from 'three';
import { soundEngine } from '../core/AudioSystem.js';

// 分级跨天再生周期配置（单位：游戏天）
export const MIST_REEF_COOLDOWNS = Object.freeze({
  sol_crystal_deep: 4,
  copper_ore: 3,
  sol_crystal: 3,
  pearl: 3,
  stone_chunk: 2,
  treasure_map_piece: Infinity // 首次登岛唯一保底，不再生
});

export class MistReefIsleScene {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.group = new THREE.Group();
    this.group.name = 'MistReefIsleSceneGroup';
    this.group.visible = false;
    if (this.scene) {
      this.scene.add(this.group);
    }

    // 岛上可采集与开采资源列表
    this.islandResources = [];
    // 资源再生冷却字典：{ [resourceId]: respawnDay }（Infinity 表示永久已采集）
    this.resourceCooldowns = {};
    // 晶雾观测前哨站开拓状态
    this.outpostClaimed = false;
    // 先民潮汐传送阵是否已被北崖灯塔二期激活
    this.teleportActive = false;

    this.initTerrain();
    this.initCrystalSpires();
    this.initResources();
    this.initTidalPortal();
    this.initOutpostFlag();
    this.initReturnRaft();
  }

  // 获取当前生存天数（兼容 survival.day 与 dayNight.dayCount）
  _getCurrentDay() {
    if (this.game && this.game.survival && typeof this.game.survival.day === 'number') {
      return this.game.survival.day;
    }
    if (this.game && this.game.dayNight && typeof this.game.dayNight.dayCount === 'number') {
      return this.game.dayNight.dayCount;
    }
    return 1;
  }

  // 1. 程序化构建荧光环礁与雾海潟湖地形
  initTerrain() {
    // 环岛幽蓝荧光雾海水体
    const waterGeo = new THREE.PlaneGeometry(300, 300);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0a3d62,
      emissive: 0x052238,
      roughness: 0.14,
      metalness: 0.42,
      transparent: true,
      opacity: 0.88
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.y = -0.15;
    this.group.add(this.waterMesh);

    // 银白珊瑚礁主沙洲底座 (X: 38米, Z: 34米)
    const atollGeo = new THREE.CylinderGeometry(20, 24, 1.4, 32);
    atollGeo.scale(1.12, 1.0, 0.92);
    const atollMat = new THREE.MeshStandardMaterial({
      color: 0xdce6f2,
      roughness: 0.88,
      metalness: 0.08,
      flatShading: true
    });
    this.atollMesh = new THREE.Mesh(atollGeo, atollMat);
    this.atollMesh.position.y = -0.35;
    this.atollMesh.receiveShadow = true;
    this.atollMesh.userData.movementSurface = true;
    this.group.add(this.atollMesh);

    // 中央微隆荧光苔藓晶台
    const terraceGeo = new THREE.CylinderGeometry(11.5, 13.5, 0.9, 24);
    terraceGeo.scale(1.05, 1.0, 0.85);
    const terraceMat = new THREE.MeshStandardMaterial({
      color: 0x2c4a52,
      roughness: 0.82,
      metalness: 0.18,
      flatShading: true
    });
    this.terraceMesh = new THREE.Mesh(terraceGeo, terraceMat);
    this.terraceMesh.position.set(0, 0.45, -2.0);
    this.terraceMesh.receiveShadow = true;
    this.terraceMesh.userData.movementSurface = true;
    this.group.add(this.terraceMesh);

    // 中央青紫荧光氛围点光源
    this.mistLight = new THREE.PointLight(0x00d2d3, 1.8, 18.0);
    this.mistLight.position.set(0, 2.6, -2.5);
    this.group.add(this.mistLight);
  }

  // 2. 环礁巨型发光晶簇柱与雾海礁岩（纯程序化八面体与六棱柱，零外部 DAE 引用）
  initCrystalSpires() {
    this.spiresGroup = new THREE.Group();

    const spireMat = new THREE.MeshStandardMaterial({
      color: 0x48dbfb,
      emissive: 0x0abde3,
      emissiveIntensity: 0.55,
      roughness: 0.22,
      metalness: 0.35,
      transparent: true,
      opacity: 0.88,
      flatShading: true
    });

    const reefMat = new THREE.MeshStandardMaterial({
      color: 0x303952,
      roughness: 0.86,
      flatShading: true
    });

    const spireConfigs = [
      [-12, 1.8, -9, 1.1, 4.4, 0.22],
      [-7, 2.3, -13, 1.3, 5.2, -0.18],
      [9, 2.0, -11, 1.2, 4.8, 0.15],
      [14, 1.6, -5, 1.0, 3.8, -0.25],
      [-14, 1.4, 3, 0.95, 3.4, 0.2],
      [12, 1.3, 6, 0.9, 3.2, -0.16]
    ];

    spireConfigs.forEach(([sx, sy, sz, radius, height, tilt]) => {
      const cluster = new THREE.Group();
      cluster.position.set(sx, 0.2, sz);

      // 礁石底座
      const baseRock = new THREE.Mesh(new THREE.DodecahedronGeometry(radius * 1.25, 0), reefMat);
      baseRock.scale.set(1.2, 0.65, 1.2);
      baseRock.castShadow = true;
      baseRock.receiveShadow = true;
      cluster.add(baseRock);

      // 主晶柱
      const mainCrystal = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.25, radius * 0.85, height, 6), spireMat);
      mainCrystal.position.y = sy;
      mainCrystal.rotation.z = tilt;
      mainCrystal.castShadow = true;
      cluster.add(mainCrystal);

      // 侧生副晶刺
      const subCrystal = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.15, radius * 0.5, height * 0.55, 6), spireMat);
      subCrystal.position.set(radius * 0.6, sy * 0.55, 0.2);
      subCrystal.rotation.z = -tilt * 1.6;
      cluster.add(subCrystal);

      cluster.userData.movementBox = true;
      this.spiresGroup.add(cluster);
    });

    this.group.add(this.spiresGroup);
  }

  // 3. 岛上终局晶脉与深海特产资源点
  initResources() {
    const resourceSpawns = [
      { id: 'mri_deep_1', type: 'sol_crystal_deep', name: '深层海脉晶核', pos: [-5.5, 0.95, -4.5], icon: '🔮', isVein: true, cooldown: MIST_REEF_COOLDOWNS.sol_crystal_deep },
      { id: 'mri_deep_2', type: 'sol_crystal_deep', name: '深层海脉晶核', pos: [6.8, 0.95, -3.2], icon: '🔮', isVein: true, cooldown: MIST_REEF_COOLDOWNS.sol_crystal_deep },
      { id: 'mri_copper_1', type: 'copper_ore', name: '荧光孔雀铜矿脉', pos: [-8.5, 0.55, 1.8], icon: '🪨', isVein: true, cooldown: MIST_REEF_COOLDOWNS.copper_ore },
      { id: 'mri_copper_2', type: 'copper_ore', name: '海蚀富铜矿露头', pos: [8.2, 0.55, 2.4], icon: '🪨', isVein: true, cooldown: MIST_REEF_COOLDOWNS.copper_ore },
      { id: 'mri_sol_vein_1', type: 'sol_crystal', name: '高纯硅晶原石露头', pos: [0.8, 1.0, -7.8], icon: '💎', isVein: true, economySource: 'vein_mine', cooldown: MIST_REEF_COOLDOWNS.sol_crystal },
      { id: 'mri_pearl_1', type: 'pearl', name: '深海巨蚌纯白珍珠', pos: [-3.8, 0.35, 7.2], icon: '⚪', isVein: false, cooldown: MIST_REEF_COOLDOWNS.pearl },
      { id: 'mri_map_piece', type: 'treasure_map_piece', name: '雾礁沉船藏宝图残片', pos: [5.4, 0.38, 7.6], icon: '🗺️', isVein: false, cooldown: MIST_REEF_COOLDOWNS.treasure_map_piece }
    ];

    const deepMat = new THREE.MeshStandardMaterial({ color: 0x0984e3, emissive: 0x0652dd, emissiveIntensity: 0.7, roughness: 0.2 });
    const copperMat = new THREE.MeshStandardMaterial({ color: 0x16a085, metalness: 0.6, roughness: 0.45, flatShading: true });
    const crystalMat = new THREE.MeshStandardMaterial({ color: 0xa29bfe, emissive: 0x6c5ce7, emissiveIntensity: 0.6, roughness: 0.25 });
    const pearlMat = new THREE.MeshStandardMaterial({ color: 0xfefefe, emissive: 0xdff9fb, emissiveIntensity: 0.3, roughness: 0.12, metalness: 0.25 });
    const bottleMat = new THREE.MeshStandardMaterial({ color: 0xfeca57, emissive: 0xff9f43, emissiveIntensity: 0.35, roughness: 0.3 });

    resourceSpawns.forEach(item => {
      const rGroup = new THREE.Group();
      rGroup.position.fromArray(item.pos);

      let mesh = null;
      if (item.type === 'sol_crystal_deep') {
        mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), deepMat);
      } else if (item.type === 'copper_ore') {
        mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), copperMat);
      } else if (item.type === 'sol_crystal') {
        mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), crystalMat);
      } else if (item.type === 'pearl') {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 14), pearlMat);
      } else {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.52, 8), bottleMat);
        mesh.rotation.z = Math.PI * 0.38;
      }
      mesh.rotation.y = Math.random() * Math.PI;
      mesh.castShadow = true;
      rGroup.add(mesh);

      const haloGeo = new THREE.RingGeometry(0.28, 0.65, 18);
      haloGeo.rotateX(-Math.PI / 2);
      const haloMat = new THREE.MeshBasicMaterial({
        color: item.type === 'sol_crystal_deep' ? 0x00d2d3 : (item.type === 'pearl' ? 0xffffff : 0xa29bfe),
        transparent: true,
        opacity: 0.62,
        side: THREE.DoubleSide
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.y = 0.05;
      rGroup.add(halo);

      this.group.add(rGroup);
      this.islandResources.push({
        ...item,
        group: rGroup,
        mesh,
        halo,
        collected: false
      });
    });
  }

  // 4. 先民潮汐传送残阵（专题 D 北崖灯塔二期落成后激活三点瞬移）
  initTidalPortal() {
    this.portalGroup = new THREE.Group();
    this.portalGroup.position.set(-1.5, 0.9, -4.8);

    const ringStoneMat = new THREE.MeshStandardMaterial({
      color: 0x3c6382,
      roughness: 0.78,
      flatShading: true
    });
    const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.85, 0.25, 12), ringStoneMat);
    baseDisc.receiveShadow = true;
    this.portalGroup.add(baseDisc);

    // 三座环阵符文矮柱
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.25, 0.32), ringStoneMat);
      pillar.position.set(Math.cos(angle) * 1.35, 0.65, Math.sin(angle) * 1.35);
      pillar.rotation.y = -angle;
      pillar.castShadow = true;
      this.portalGroup.add(pillar);
    }

    // 阵心能量环（未激活暗淡，激活后青金流光）
    const runeGeo = new THREE.RingGeometry(0.45, 1.15, 24);
    runeGeo.rotateX(-Math.PI / 2);
    this.portalRuneMat = new THREE.MeshBasicMaterial({
      color: 0x576574,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    this.portalRuneMesh = new THREE.Mesh(runeGeo, this.portalRuneMat);
    this.portalRuneMesh.position.y = 0.16;
    this.portalGroup.add(this.portalRuneMesh);

    this.group.add(this.portalGroup);
  }

  // 同步传送阵激活外观
  setTeleportActive(active) {
    this.teleportActive = Boolean(active);
    if (this.portalRuneMat) {
      this.portalRuneMat.color.setHex(this.teleportActive ? 0x00f2fe : 0x576574);
      this.portalRuneMat.opacity = this.teleportActive ? 0.88 : 0.45;
    }
  }

  // 交互：先民潮汐传送残阵
  interactTidalPortal() {
    const isPhase2Ready = Boolean(
      this.teleportActive ||
      (this.game && this.game.lighthouse && this.game.lighthouse.phase2Complete)
    );
    if (!isPhase2Ready) {
      if (this.game && this.game.ui) {
        this.game.ui.showDialog(
          '🌀 先民潮汐传送残阵（休眠中）',
          '环礁石台上镌刻着古老的地脉潮汐坐标阵纹，目前能量回路尚处于休眠状态。\n\n💡 学者手记提示：当进入自由经营终局并完成【北崖古灯塔·二期海皇信标】工程后，此阵将与【主岛西南营地】、【北崖灯塔】实现零耗时瞬移共鸣！'
        );
      }
      return false;
    }

    // 已激活二期：瞬移返回主岛营地（若存在专题 D 传送弹窗则优先打开）
    if (this.game && this.game.ui && typeof this.game.ui.openTidalTeleportModal === 'function') {
      this.game.ui.openTidalTeleportModal('mist_reef_isle');
      return true;
    }
    if (this.game && typeof this.game.travelToIsland === 'function') {
      this.game.travelToIsland('home_island', { viaTeleport: true });
      return true;
    }
    return false;
  }

  // 5. 晶雾观测前哨信标基座 (Mist Reef Outpost Beacon)
  initOutpostFlag() {
    this.outpostGroup = new THREE.Group();
    this.outpostGroup.position.set(3.8, 0.9, -1.8);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.1, 0.45, 8),
      new THREE.MeshStandardMaterial({ color: 0x3c6382, flatShading: true })
    );
    base.castShadow = true;
    base.receiveShadow = true;
    this.outpostGroup.add(base);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 3.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x82ccdd, metalness: 0.75, roughness: 0.25 })
    );
    pole.position.y = 1.7;
    pole.castShadow = true;
    this.outpostGroup.add(pole);

    const flagGeo = new THREE.PlaneGeometry(1.3, 0.75);
    this.flagMat = new THREE.MeshStandardMaterial({
      color: 0x7f8c8d,
      roughness: 0.75,
      side: THREE.DoubleSide
    });
    this.flagMesh = new THREE.Mesh(flagGeo, this.flagMat);
    this.flagMesh.position.set(0.7, 2.8, 0);
    this.outpostGroup.add(this.flagMesh);

    this.group.add(this.outpostGroup);
  }

  // 6. 滩头返航船锚点
  initReturnRaft() {
    this.raftGroup = new THREE.Group();
    this.raftGroup.position.set(0, 0.05, 14.0);

    const hullMat = new THREE.MeshStandardMaterial({ color: 0x3d3d3d, metalness: 0.55, roughness: 0.45 });
    for (let i = -1; i <= 1; i++) {
      const pontoon = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 3.8, 8), hullMat);
      pontoon.rotation.x = Math.PI / 2;
      pontoon.position.set(i * 0.62, 0.16, 0);
      pontoon.castShadow = true;
      this.raftGroup.add(pontoon);
    }

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.8, 8), hullMat);
    mast.position.set(0, 1.4, 0);
    this.raftGroup.add(mast);

    const sailGeo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 2.55, 0,
      0, 0.85, 0,
      1.2, 1.25, 0
    ]);
    sailGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    sailGeo.computeVertexNormals();
    const sail = new THREE.Mesh(sailGeo, new THREE.MeshStandardMaterial({ color: 0xdff9fb, side: THREE.DoubleSide }));
    this.raftGroup.add(sail);

    this.group.add(this.raftGroup);
  }

  // 交互：开采或拾取晶雾回声岛资源
  checkMineOrPickup(playerPos, onMined) {
    const inv = this.game && this.game.ui ? this.game.ui.inventory : {};
    const hasPickaxe = (inv['stone_pickaxe'] || 0) > 0 || (inv['iron_pickaxe'] || 0) > 0;
    const currentDay = this._getCurrentDay();

    for (const item of this.islandResources) {
      if (item.collected) continue;
      const d = playerPos.distanceTo(item.group.position);
      if (d < 2.2) {
        if (item.isVein && !hasPickaxe) {
          if (this.game && this.game.ui) {
            this.game.ui.showToast('⚠️ 晶脉坚硬如钢！需在背包中携带【采矿石镐】或【精钢镐】方能凿取！', 'medium');
          }
          return null;
        }

        // 先尝试发放资源（支持满包自动转存随船货仓），成功后再标记已采集并进入再生冷却
        let granted = true;
        if (typeof onMined === 'function') {
          const result = onMined(item.type, item.name, item.economySource || null);
          if (result === false) granted = false;
        }
        if (!granted) return null;

        item.collected = true;
        item.group.visible = false;
        const cd = item.cooldown ?? 3;
        this.resourceCooldowns[item.id] = Number.isFinite(cd) ? (currentDay + cd) : Infinity;
        soundEngine.playPlaceFurniture();
        return item;
      }
    }
    return null;
  }

  // 交互：插旗建立【晶雾观测前哨站】
  claimOutpost() {
    if (this.outpostClaimed) {
      if (this.game && this.game.ui) {
        this.game.ui.showToast('🚩 此处已建成为避风家园【晶雾观测前哨站】！', 'medium');
      }
      return true;
    }

    const inv = this.game && this.game.ui ? this.game.ui.inventory : {};
    const ingots = inv['iron_ingot'] || 0;
    const planks = inv['wood_plank'] || 0;
    const nails = inv['nail'] || 0;

    if (ingots < 2 || planks < 2 || nails < 2) {
      if (this.game && this.game.ui) {
        this.game.ui.showDialog(
          '🚩 建立晶雾观测前哨站',
          `在风暴浓雾环礁设立抗腐蚀观测信标需要储备充足的高阶资材：\n` +
          `• 精密铁锭 x2 (当前: ${ingots})\n` +
          `• 坚固木板 x2 (当前: ${planks})\n` +
          `• 铁钉 x2 (当前: ${nails})\n\n` +
          `建立前哨后，营地每日晨报将自动回运【深层海脉晶核 / 孔雀铜矿】与【深海纯白珍珠】！`
        );
      }
      return false;
    }

    inv['iron_ingot'] -= 2;
    inv['wood_plank'] -= 2;
    inv['nail'] -= 2;
    if (inv['iron_ingot'] <= 0) delete inv['iron_ingot'];
    if (inv['wood_plank'] <= 0) delete inv['wood_plank'];
    if (inv['nail'] <= 0) delete inv['nail'];

    this.outpostClaimed = true;
    if (this.flagMat) {
      this.flagMat.color.set(0x00d2d3);
    }
    soundEngine.playPlaceFurniture();

    if (this.game && this.game.ui) {
      this.game.ui.renderInventory();
      this.game.ui.showDialog(
        '🚩 晶雾观测前哨站建立成功！',
        '🎉 荧光青色信标旗在浓雾环礁高高飘扬！\n【晶雾观测前哨站】正式纳入避风家园领地管辖！每日晨报将自动回运珍稀的【深层海脉晶核 / 孔雀铜矿】与【深海纯白珍珠】！'
      );
    }
    if (this.game && this.game.nauticalChart && this.game.nauticalChart.islands['mist_reef_isle']) {
      this.game.nauticalChart.islands['mist_reef_isle'].outpostBuilt = true;
    }
    return true;
  }

  // 跨天结算：检查到期冷却资源并恢复再生
  onDayPassed(currentDay) {
    const day = typeof currentDay === 'number' ? currentDay : this._getCurrentDay();
    let respawnedCount = 0;
    for (const item of this.islandResources) {
      if (!item.collected) continue;
      const targetDay = this.resourceCooldowns[item.id];
      if (typeof targetDay === 'number' && Number.isFinite(targetDay) && day >= targetDay) {
        item.collected = false;
        if (item.group) item.group.visible = true;
        delete this.resourceCooldowns[item.id];
        respawnedCount++;
      }
    }
    return respawnedCount;
  }

  setVisible(visible) {
    this.group.visible = Boolean(visible);
    if (visible && this.game && this.game.lighthouse) {
      this.setTeleportActive(Boolean(this.game.lighthouse.phase2Complete));
    }
  }

  update(delta) {
    if (!this.group.visible) return;
    const time = Date.now() * 0.003;
    for (const item of this.islandResources) {
      if (!item.collected && item.halo) {
        const s = 1.0 + Math.sin(time * 3 + item.group.position.x) * 0.15;
        item.halo.scale.set(s, s, s);
      }
    }
    if (this.portalRuneMesh && this.teleportActive) {
      this.portalRuneMesh.rotation.z += delta * 0.9;
    }
  }

  serialize() {
    const cooldownOut = {};
    for (const [id, day] of Object.entries(this.resourceCooldowns)) {
      cooldownOut[id] = Number.isFinite(day) ? day : -1; // -1 序列化表示永久不再生
    }
    return {
      outpostClaimed: this.outpostClaimed,
      teleportActive: this.teleportActive,
      collectedResourceIds: this.islandResources.filter(r => r.collected).map(r => r.id),
      resourceCooldowns: cooldownOut
    };
  }

  deserialize(data) {
    if (!data) return;
    this.outpostClaimed = Boolean(data.outpostClaimed);
    if (this.outpostClaimed && this.flagMat) {
      this.flagMat.color.set(0x00d2d3);
    }
    if (typeof data.teleportActive === 'boolean') {
      this.setTeleportActive(data.teleportActive);
    }

    this.resourceCooldowns = {};
    const curDay = this._getCurrentDay();
    if (data.resourceCooldowns && typeof data.resourceCooldowns === 'object') {
      for (const [id, val] of Object.entries(data.resourceCooldowns)) {
        this.resourceCooldowns[id] = val === -1 ? Infinity : Number(val);
      }
    } else if (Array.isArray(data.collectedResourceIds)) {
      // 兼容老档：按默认冷却赋予再生目标天
      data.collectedResourceIds.forEach(id => {
        const found = this.islandResources.find(r => r.id === id);
        const cd = found ? (found.cooldown ?? 3) : 3;
        this.resourceCooldowns[id] = Number.isFinite(cd) ? (curDay + cd) : Infinity;
      });
    }

    const collectedSet = new Set(Object.keys(this.resourceCooldowns));
    this.islandResources.forEach(item => {
      if (collectedSet.has(item.id)) {
        item.collected = true;
        if (item.group) item.group.visible = false;
      } else {
        item.collected = false;
        if (item.group) item.group.visible = true;
      }
    });
  }
}
