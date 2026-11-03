// CastawaySOL - 海蚀矿石岛 (Quarry Isle) 场景与矿业生态系统
// 呈现独特火山玄武岩孤峰、地热暗礁、露天富铁矿脉、开采遗迹石碑与前哨旗帜开拓
import * as THREE from 'three';
import { soundEngine } from '../core/AudioSystem.js';

export class QuarryIsleScene {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.group = new THREE.Group();
    this.group.name = 'QuarryIsleSceneGroup';
    this.group.visible = false;
    this.scene.add(this.group);

    // 岛上可采集与开采矿石列表
    this.islandResources = [];
    // 资源分级跨天再生冷却字典：{ [resourceId]: respawnDay }
    this.resourceCooldowns = {};
    // 矿业前哨开拓状态与古代冶炼石碑研读标记
    this.outpostClaimed = false;
    this.monolithRead = false;

    this.initTerrain();
    this.initVolcanicCrags();
    this.initMineralVeins();
    this.initAncientMonolith();
    this.initOutpostFlag();
    this.initReturnRaft();
  }

  // 1. 程序化构建火山玄武岩岛地形 (暗黑砾石滩 + 玄武岩台地 + 深海冷色水体)
  initTerrain() {
    // 环岛深海冷海水体
    const waterGeo = new THREE.PlaneGeometry(280, 280);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0c2461, // 险峻深海冷蓝
      roughness: 0.15,
      metalness: 0.4,
      transparent: true,
      opacity: 0.88
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.y = -0.15;
    this.group.add(this.waterMesh);

    // 火山砾石外滩底座 (X: 36米, Z: 32米，暗黑火山碎屑岩色调)
    const gravelGeo = new THREE.CylinderGeometry(19, 23, 1.4, 28);
    gravelGeo.scale(1.15, 1.0, 0.9);
    const gravelMat = new THREE.MeshStandardMaterial({
      color: 0x2f3640, // 坚硬深玄武岩石色
      roughness: 0.95,
      metalness: 0.1,
      flatShading: true
    });
    this.gravelMesh = new THREE.Mesh(gravelGeo, gravelMat);
    this.gravelMesh.position.y = -0.35;
    this.gravelMesh.receiveShadow = true;
    this.gravelMesh.userData.movementSurface = true;
    this.group.add(this.gravelMesh);

    // 中央微高火山凝灰岩高台
    const plateauGeo = new THREE.CylinderGeometry(11, 13, 1.0, 20);
    plateauGeo.scale(1.1, 1.0, 0.8);
    const plateauMat = new THREE.MeshStandardMaterial({
      color: 0x3d3d3d,
      roughness: 0.88,
      metalness: 0.15,
      flatShading: true
    });
    this.plateauMesh = new THREE.Mesh(plateauGeo, plateauMat);
    this.plateauMesh.position.set(0, 0.5, -2);
    this.plateauMesh.receiveShadow = true;
    this.plateauMesh.userData.movementSurface = true;
    this.group.add(this.plateauMesh);

    // 火山地热裂隙微光点光源
    const ventLight = new THREE.PointLight(0xe17055, 1.2, 8.0);
    ventLight.position.set(4, 0.8, -3);
    this.group.add(ventLight);
  }

  // 2. 耸立的陡峭玄武岩柱与悬崖石笋
  initVolcanicCrags() {
    this.cragsGroup = new THREE.Group();

    const basaltMat = new THREE.MeshStandardMaterial({
      color: 0x1e272e,
      roughness: 0.85,
      flatShading: true
    });

    // 险峻玄武岩立柱群
    const cragCoords = [
      [-12, 1.6, -9, 1.8, 3.8, 1.6],
      [-7, 2.2, -14, 2.2, 5.0, 2.0],
      [10, 1.8, -12, 1.9, 4.2, 1.7],
      [14, 1.4, -6, 1.6, 3.4, 1.5],
      [-15, 1.2, 2, 1.7, 3.0, 1.7],
      [-10, 0.8, 8, 1.4, 2.2, 1.4],
      [13, 1.0, 6, 1.5, 2.5, 1.5]
    ];

    cragCoords.forEach(([cx, cy, cz, sx, sy, sz]) => {
      const colGeo = new THREE.CylinderGeometry(sx * 0.65, sx, sy, 6);
      const col = new THREE.Mesh(colGeo, basaltMat);
      col.position.set(cx, cy, cz);
      col.rotation.y = Math.random() * Math.PI;
      col.castShadow = true;
      col.receiveShadow = true;
      col.userData.movementBox = true;
      this.cragsGroup.add(col);
    });

    this.group.add(this.cragsGroup);
  }

  // 3. 露天富铁矿脉、铜矿露头与散落原石
  initMineralVeins() {
    const veinSpawns = [
      // 1. 富铁矿脉石 (Iron Ore Veins) - 泛着暗红金属光泽与赭石结晶
      { id: 'qi_iron_1', type: 'iron_ore', name: '露天富铁矿脉', pos: [-5, 0.9, -4], icon: '⛏️', isVein: true },
      { id: 'qi_iron_2', type: 'iron_ore', name: '重金属铁矿石', pos: [7, 0.9, -1], icon: '⛏️', isVein: true },
      { id: 'qi_iron_3', type: 'iron_ore', name: '赤铁矿露头', pos: [1, 1.2, -8], icon: '⛏️', isVein: true },
      // 2. 铜矿石露头 (Copper Ore Vein) - 泛着青绿孔雀石暗金条纹
      { id: 'qi_copper_1', type: 'copper_ore', name: '孔雀绿铜矿脉', pos: [-8, 0.6, 1], icon: '🪨', isVein: true },
      // 3. 散落风化燧石块与地热碎石 (免工具直接拾取)
      { id: 'qi_stone_1', type: 'stone_chunk', name: '坚硬玄武岩原石', pos: [-2, 0.4, 5], icon: '🪨', isVein: false },
      { id: 'qi_stone_2', type: 'stone_chunk', name: '坚硬玄武岩原石', pos: [5, 0.4, 6], icon: '🪨', isVein: false },
      { id: 'qi_iron_loose', type: 'iron_ore', name: '冲蚀赤铁原矿', pos: [3, 0.4, 9], icon: '⛏️', isVein: false }
    ];

    // 铁矿结晶材质 (暗褐微红带金属反光)
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x8a4b38,
      metalness: 0.65,
      roughness: 0.45,
      flatShading: true
    });

    // 铜矿材质 (古铜青绿)
    const copperMat = new THREE.MeshStandardMaterial({
      color: 0x16a085,
      metalness: 0.55,
      roughness: 0.5,
      flatShading: true
    });

    // 玄武岩石块材质
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x57606f,
      roughness: 0.9,
      flatShading: true
    });

    veinSpawns.forEach(item => {
      const vGroup = new THREE.Group();
      vGroup.position.fromArray(item.pos);

      let mesh = null;
      if (item.type === 'iron_ore') {
        const geo = item.isVein
          ? new THREE.DodecahedronGeometry(0.7, 0)
          : new THREE.DodecahedronGeometry(0.35, 0);
        mesh = new THREE.Mesh(geo, ironMat);
        mesh.rotation.set(Math.random(), Math.random(), Math.random());
      } else if (item.type === 'copper_ore') {
        const geo = new THREE.DodecahedronGeometry(0.65, 0);
        mesh = new THREE.Mesh(geo, copperMat);
        mesh.rotation.set(Math.random(), Math.random(), Math.random());
      } else {
        const geo = new THREE.DodecahedronGeometry(0.4, 0);
        mesh = new THREE.Mesh(geo, stoneMat);
        mesh.rotation.set(Math.random(), Math.random(), Math.random());
      }
      mesh.castShadow = true;
      vGroup.add(mesh);

      // 发光提示光环 (矿脉使用金色光圈，碎石使用青色)
      const haloGeo = new THREE.RingGeometry(0.3, 0.65, 16);
      haloGeo.rotateX(-Math.PI / 2);
      const haloMat = new THREE.MeshBasicMaterial({
        color: item.type === 'iron_ore' ? 0xe67e22 : (item.type === 'copper_ore' ? 0x1abc9c : 0x74b9ff),
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.y = 0.05;
      vGroup.add(halo);

      this.group.add(vGroup);
      this.islandResources.push({
        ...item,
        group: vGroup,
        mesh: mesh,
        halo: halo,
        collected: false
      });
    });
  }

  // 4. 古代水手冶炼遗迹石碑 (Ancient Smelting Monolith)
  initAncientMonolith() {
    this.monolithGroup = new THREE.Group();
    this.monolithGroup.position.set(-1.5, 0.9, -6.5);

    // 粗琢耐火石碑
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x353b48,
      roughness: 0.8,
      metalness: 0.2
    });
    const slabGeo = new THREE.BoxGeometry(0.9, 1.8, 0.25);
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.y = 0.9;
    slab.rotation.y = 0.15;
    slab.castShadow = true;
    this.monolithGroup.add(slab);

    // 石碑发光古符文 (熔炉冶炼图腾)
    const runeGeo = new THREE.PlaneGeometry(0.6, 0.9);
    const runeMat = new THREE.MeshBasicMaterial({
      color: 0xe17055,
      transparent: true,
      opacity: 0.85
    });
    const rune = new THREE.Mesh(runeGeo, runeMat);
    rune.position.set(0, 0.95, 0.14);
    rune.rotation.y = 0.15;
    this.monolithGroup.add(rune);

    this.group.add(this.monolithGroup);
  }

  // 5. 矿业前哨信标基座 (Mining Outpost Beacon)
  initOutpostFlag() {
    this.outpostGroup = new THREE.Group();
    this.outpostGroup.position.set(4.0, 0.9, -5.0);

    // 粗石基座
    const baseGeo = new THREE.CylinderGeometry(0.9, 1.1, 0.45, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x4b4b4b, flatShading: true });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.castShadow = true;
    base.receiveShadow = true;
    this.outpostGroup.add(base);

    // 锻铁旗杆
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 3.4, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2f3640, metalness: 0.7 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.7;
    pole.castShadow = true;
    this.outpostGroup.add(pole);

    // 营地开拓旗面 (未开拓灰暗 / 开拓后暗金烈火色)
    const flagGeo = new THREE.PlaneGeometry(1.3, 0.75);
    this.flagMat = new THREE.MeshStandardMaterial({
      color: 0x7f8c8d,
      roughness: 0.8,
      side: THREE.DoubleSide
    });
    this.flagMesh = new THREE.Mesh(flagGeo, this.flagMat);
    this.flagMesh.position.set(0.7, 2.8, 0);
    this.outpostGroup.add(this.flagMesh);

    this.group.add(this.outpostGroup);
  }

  // 6. 滩头返航木筏
  initReturnRaft() {
    this.raftGroup = new THREE.Group();
    this.raftGroup.position.set(0, 0.05, 14.0);

    const logMat = new THREE.MeshStandardMaterial({ color: 0x4a3219, roughness: 0.8 });
    for (let i = -1; i <= 1; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 3.6, 8), logMat);
      log.rotation.x = Math.PI / 2;
      log.position.set(i * 0.6, 0.15, 0);
      log.castShadow = true;
      this.raftGroup.add(log);
    }

    // 桅杆与白帆
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 6), logMat);
    mast.position.set(0, 1.3, 0);
    this.raftGroup.add(mast);

    const sailGeo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 2.4, 0,
      0, 0.8, 0,
      1.1, 1.2, 0
    ]);
    sailGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    sailGeo.computeVertexNormals();
    const sailMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const sail = new THREE.Mesh(sailGeo, sailMat);
    this.raftGroup.add(sail);

    this.group.add(this.raftGroup);
  }

  // 交互：检视古代冶炼石碑 (阅读古代手记，领悟熔炉配方并持久化标记)
  readMonolith() {
    this.monolithRead = true;
    if (!this.game || !this.game.ui) return;
    this.game.ui.showDialog(
      '📜 古代冶炼遗迹石碑',
      '风化的玄武岩板上刻着昔日沉船铁匠的古朴手记：\n\n' +
      '“火山孤峰深处孕育着纯度极高的赤铁与孔雀铜。\n' +
      '用【坚硬石块】与【坚韧木棍】捆扎制成【采矿石镐】，方能凿碎坚硬矿脉剥离原石。\n' +
      '在大本营收集【玄武岩块】与【粘土灰泥】，可垒砌【耐火熔炉】。\n' +
      '投以木柴与矿石，高温熔铸即可锻打出坚不可摧的【精密铁锭】！”\n\n' +
      '💡 提示：你的合成知识已扩展！返回大本营可在工坊建造【耐火熔炉】！'
    );
  }

  _getResourceCooldownDays(type) {
    if (type === 'iron_ore' || type === 'copper_ore') return 3;
    return 2;
  }

  _getCurrentDay() {
    if (this.game && this.game.survival && typeof this.game.survival.day === 'number') {
      return this.game.survival.day;
    }
    if (this.game && this.game.dayNight && typeof this.game.dayNight.dayCount === 'number') {
      return this.game.dayNight.dayCount;
    }
    return 1;
  }

  // 交互：开采或拾取矿产资源 (若为矿脉，优先检查是否装备石镐；未装配则提示)
  checkMineOrPickup(playerPos, onMined) {
    const inv = this.game && this.game.ui ? this.game.ui.inventory : {};
    const hasPickaxe = (inv['stone_pickaxe'] || 0) > 0 || (inv['iron_pickaxe'] || 0) > 0;
    const currentDay = this._getCurrentDay();

    for (const item of this.islandResources) {
      if (item.collected) continue;
      const d = playerPos.distanceTo(item.group.position);
      if (d < 2.2) {
        // 若为大型露天矿脉且无采矿镐
        if (item.isVein && !hasPickaxe) {
          if (this.game && this.game.ui) {
            this.game.ui.showToast(`⚠️ 矿脉坚硬无比！需在背包中装备【采矿石镐】方能凿取！`, 'medium');
          }
          return null;
        }

        let granted = true;
        if (typeof onMined === 'function') {
          const res = onMined(item.type, item.name);
          if (res === false) granted = false;
        }
        if (!granted) return null;

        item.collected = true;
        item.group.visible = false;
        this.resourceCooldowns[item.id] = currentDay + this._getResourceCooldownDays(item.type);
        soundEngine.playPlaceFurniture();
        return item;
      }
    }
    return null;
  }

  // 跨天结算：到期矿脉自动刷新再生
  onDayPassed(currentDay) {
    const day = typeof currentDay === 'number' ? currentDay : this._getCurrentDay();
    let respawnedCount = 0;
    for (const item of this.islandResources) {
      if (!item.collected) continue;
      const targetDay = this.resourceCooldowns[item.id];
      if (typeof targetDay === 'number' && day >= targetDay) {
        item.collected = false;
        if (item.group) item.group.visible = true;
        delete this.resourceCooldowns[item.id];
        respawnedCount++;
      }
    }
    return respawnedCount;
  }

  // 交互：插旗建立海外矿业前哨
  claimOutpost() {
    if (this.outpostClaimed) {
      if (this.game && this.game.ui) {
        this.game.ui.showToast('🚩 此处已建成为避风家园【矿业开采前哨站】！', 'medium');
      }
      return;
    }

    const inv = this.game.ui ? this.game.ui.inventory : {};
    const planks = inv['wood_plank'] || 0;
    const stones = inv['stone_chunk'] || 0;
    const nails = inv['nail'] || 0;

    if (planks < 2 || stones < 2 || nails < 1) {
      if (this.game && this.game.ui) {
        this.game.ui.showDialog(
          '🚩 建立矿业前哨站',
          '在火山口设立【矿石前哨信标】需要储备充足的建材：\n• 木板 x2 (当前: ' + planks + ')\n• 燧石原石 x2 (当前: ' + stones + ')\n• 铁钉 x1 (当前: ' + nails + ')\n\n建立前哨后，营地每日晨报将自动回运产出的赤铁原石！'
        );
      }
      return;
    }

    // 扣除材料
    inv['wood_plank'] -= 2;
    inv['stone_chunk'] -= 2;
    inv['nail'] -= 1;
    if (inv['wood_plank'] <= 0) delete inv['wood_plank'];
    if (inv['stone_chunk'] <= 0) delete inv['stone_chunk'];
    if (inv['nail'] <= 0) delete inv['nail'];

    this.outpostClaimed = true;
    if (this.flagMat) {
      this.flagMat.color.set(0xe67e22); // 变为亮暗金烈焰色旗帜
    }
    soundEngine.playPlaceFurniture();

    if (this.game.ui) {
      this.game.ui.renderInventory();
      this.game.ui.showDialog(
        '🚩 矿业前哨站建立成功！',
        '🎉 烈焰图腾旗帜在火山口傲然升起！\n【矿石前哨站】正式纳入避风家园领地！每日晨报将自动回运【富铁矿石】与【玄武原石】！'
      );
    }
    if (this.game.nauticalChart) {
      this.game.nauticalChart.islands['quarry_isle'].outpostBuilt = true;
    }
  }

  // 显隐控制
  setVisible(visible) {
    this.group.visible = visible;
  }

  // 帧动画更新
  update(delta) {
    if (!this.group.visible) return;
    const time = Date.now() * 0.003;

    // 矿石光环呼吸脉动
    for (const item of this.islandResources) {
      if (!item.collected && item.halo) {
        const s = 1.0 + Math.sin(time * 3 + item.group.position.x) * 0.14;
        item.halo.scale.set(s, s, s);
      }
    }
  }

  // 序列化与持久化支持
  serialize() {
    return {
      outpostClaimed: this.outpostClaimed,
      monolithRead: this.monolithRead,
      collectedResourceIds: this.islandResources.filter(r => r.collected).map(r => r.id),
      resourceCooldowns: { ...this.resourceCooldowns }
    };
  }

  // 反序列化恢复（兼容旧档仅含 collectedResourceIds 的情况）
  deserialize(data) {
    if (!data) return;
    if (data.outpostClaimed !== undefined) {
      this.outpostClaimed = Boolean(data.outpostClaimed);
      if (this.outpostClaimed && this.flagMat) {
        this.flagMat.color.set(0xe67e22);
      }
    }
    if (data.monolithRead !== undefined) {
      this.monolithRead = Boolean(data.monolithRead);
    }

    this.resourceCooldowns = {};
    const curDay = this._getCurrentDay();
    if (data.resourceCooldowns && typeof data.resourceCooldowns === 'object') {
      for (const [id, day] of Object.entries(data.resourceCooldowns)) {
        this.resourceCooldowns[id] = Number(day);
      }
    }
    // 兼容旧档或仅有 collectedResourceIds 的情况（cooldowns 为空时 fallback）
    if (Object.keys(this.resourceCooldowns).length === 0 && Array.isArray(data.collectedResourceIds)) {
      data.collectedResourceIds.forEach(id => {
        const found = this.islandResources.find(r => r.id === id);
        this.resourceCooldowns[id] = curDay + this._getResourceCooldownDays(found ? found.type : 'stone_chunk');
      });
    }

    const set = new Set(Object.keys(this.resourceCooldowns));
    this.islandResources.forEach(item => {
      if (set.has(item.id)) {
        item.collected = true;
        if (item.group) item.group.visible = false;
      } else {
        item.collected = false;
        if (item.group) item.group.visible = true;
      }
    });
  }

}
