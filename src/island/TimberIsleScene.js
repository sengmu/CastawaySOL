// CastawaySOL - 漂流浮木岛 (Timber Isle) 场景与生态系统
// 呈现独特海难沉船沙洲、高阶原木残骸、受困幸存者学者雷蒙德与前哨旗帜开拓
import * as THREE from 'three';
import { soundEngine } from '../core/AudioSystem.js';
import { modelLoader } from '../core/ModelLoader.js';

export class TimberIsleScene {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.group = new THREE.Group();
    this.group.name = 'TimberIsleSceneGroup';
    this.group.visible = false;
    this.scene.add(this.group);

    // 岛上资源拾取物列表
    this.islandResources = [];
    // 资源分级跨天再生冷却字典：{ [resourceId]: respawnDay }
    this.resourceCooldowns = {};
    // 幸存者 NPC 状态
    this.survivorRescued = false;
    this.outpostClaimed = false;

    this.initTerrain();
    this.initShipwreck();
    this.initResources();
    this.initSurvivor();
    this.initOutpostFlag();
    this.initReturnRaft();
  }

  // 1. 程序化构建狭长沉船沙洲地形 (低多边形沙滩 + 浅滩暗礁 + 专属浅海水体)
  initTerrain() {
    // 环岛清澈海水
    const waterGeo = new THREE.PlaneGeometry(260, 260);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x17748e,
      roughness: 0.12,
      metalness: 0.35,
      transparent: true,
      opacity: 0.85
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.y = -0.15;
    this.group.add(this.waterMesh);
    // 沉船沙洲主体 (X轴稍宽 38米, Z轴 26米)
    const sandGeo = new THREE.CylinderGeometry(18, 22, 1.2, 32);
    sandGeo.scale(1.2, 1.0, 0.75); // 椭圆沙洲
    const sandMat = new THREE.MeshStandardMaterial({
      color: 0xf5dfa6, // 暖黄细沙滩
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true
    });
    this.sandMesh = new THREE.Mesh(sandGeo, sandMat);
    this.sandMesh.position.y = -0.4;
    this.sandMesh.receiveShadow = true;
    this.sandMesh.userData.movementSurface = true;
    this.group.add(this.sandMesh);

    // 沙洲中央低矮稀疏植被绿地
    const grassGeo = new THREE.CylinderGeometry(9, 11, 0.4, 24);
    grassGeo.scale(1.1, 1.0, 0.65);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x76b852, // 坚韧耐碱的海滨草甸
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true
    });
    this.grassMesh = new THREE.Mesh(grassGeo, grassMat);
    this.grassMesh.position.y = 0.25;
    this.grassMesh.receiveShadow = true;
    this.grassMesh.userData.movementSurface = true;
    this.group.add(this.grassMesh);

    // 周围散落的深灰海浪侵蚀暗礁 (防止单调)
    const rockGeo = new THREE.DodecahedronGeometry(1.6, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x5a6268,
      roughness: 0.88,
      flatShading: true
    });

    const rockCoords = [
      [-16, 0.2, -8], [-12, 0.1, 10], [14, 0.3, -7], [18, 0.1, 5], [-8, 0.2, -12]
    ];
    rockCoords.forEach(([rx, ry, rz]) => {
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(rx, ry, rz);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.scale.set(0.9 + Math.random() * 0.4, 0.8 + Math.random() * 0.5, 0.9 + Math.random() * 0.4);
      rock.castShadow = true;
      rock.receiveShadow = true;
      rock.userData.movementBox = true;
      this.group.add(rock);
    });
  }

  // 2. 沉船龙骨与倾斜断桅残骸
  initShipwreck() {
    this.shipwreckGroup = new THREE.Group();
    this.shipwreckGroup.position.set(-6, 0.6, -4);
    this.shipwreckGroup.rotation.y = 0.45;
    this.shipwreckGroup.rotation.z = -0.15; // 搁浅倾侧

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x4a3728, // 海水浸泡风化深褐
      roughness: 0.85,
      flatShading: true
    });

    // 巨大弧形龙骨肋骨 (5 根粗壮船肋弧)
    for (let i = 0; i < 5; i++) {
      const ribGeo = new THREE.TorusGeometry(3.2, 0.28, 6, 12, Math.PI * 0.7);
      const rib = new THREE.Mesh(ribGeo, woodMat);
      rib.position.x = (i - 2) * 1.8;
      rib.rotation.x = Math.PI * 0.5;
      rib.rotation.y = 0.1 * (i - 2);
      rib.castShadow = true;
      this.shipwreckGroup.add(rib);
    }

    // 倾倒的主桅杆
    const mastGeo = new THREE.CylinderGeometry(0.24, 0.35, 7.5, 8);
    const mast = new THREE.Mesh(mastGeo, woodMat);
    mast.position.set(0.8, 1.2, 1.5);
    mast.rotation.set(0.3, 0.2, 1.1);
    mast.castShadow = true;
    this.shipwreckGroup.add(mast);

    // 散落的破帆布与板条箱
    const canvasGeo = new THREE.PlaneGeometry(2.4, 3.0, 4, 4);
    const canvasMat = new THREE.MeshStandardMaterial({
      color: 0xdcdde1,
      roughness: 0.95,
      side: THREE.DoubleSide
    });
    const canvas = new THREE.Mesh(canvasGeo, canvasMat);
    canvas.position.set(0.2, 1.1, 0.8);
    canvas.rotation.set(Math.PI * 0.4, 0.2, -0.4);
    this.shipwreckGroup.add(canvas);

    this.shipwreckGroup.userData.movementBox = true;
    this.group.add(this.shipwreckGroup);
  }

  // 3. 岛上特产物理资源 (高阶方木料 lumber、坚固木板 wood_plank、散落铁钉 nail、深层海脉晶核 sol_crystal_deep)
  initResources() {
    const resourceSpawns = [
      { id: 'ti_res_1', type: 'lumber', name: '重型浮木方料', pos: [6, 0.4, -3], icon: '🪵' },
      { id: 'ti_res_2', type: 'lumber', name: '重型浮木方料', pos: [11, 0.3, 2], icon: '🪵' },
      { id: 'ti_res_3', type: 'wood_plank', name: '冲岸坚固木板', pos: [-12, 0.2, 4], icon: '🪵' },
      { id: 'ti_res_4', type: 'wood_plank', name: '冲岸坚固木板', pos: [2, 0.3, -9], icon: '🪵' },
      { id: 'ti_res_5', type: 'nail', name: '沉船散落铁钉', pos: [-4, 0.3, 2], icon: '🔩' },
      { id: 'ti_res_6', type: 'wood_plank', name: '风干破船板', pos: [8, 0.2, 8], icon: '🪵' },
      { id: 'ti_res_deep_1', type: 'sol_crystal_deep', name: '深层海脉晶核', pos: [-9, 0.3, -5], icon: '🔮' },
      { id: 'ti_res_deep_2', type: 'sol_crystal_deep', name: '深层海脉晶核', pos: [14, 0.3, -2], icon: '🔮' }
    ];

    const lumberGeo = new THREE.BoxGeometry(0.55, 0.35, 1.9);
    const lumberMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8, flatShading: true });

    const plankGeo = new THREE.BoxGeometry(0.75, 0.12, 1.4);
    const plankMat = new THREE.MeshStandardMaterial({ color: 0xc89666, roughness: 0.75, flatShading: true });

    const nailGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.45, 6);
    const nailMat = new THREE.MeshStandardMaterial({ color: 0x718093, metalness: 0.7, roughness: 0.3 });

    const deepGeo = new THREE.OctahedronGeometry(0.35, 0);
    const deepMat = new THREE.MeshStandardMaterial({ color: 0x0984e3, emissive: 0x0652dd, roughness: 0.2 });

    resourceSpawns.forEach(item => {
      const rGroup = new THREE.Group();
      rGroup.position.fromArray(item.pos);

      let mesh = null;
      if (item.type === 'lumber') {
        mesh = new THREE.Mesh(lumberGeo, lumberMat);
        mesh.rotation.y = Math.random() * Math.PI;
      } else if (item.type === 'wood_plank') {
        mesh = new THREE.Mesh(plankGeo, plankMat);
        mesh.rotation.y = Math.random() * Math.PI;
      } else if (item.type === 'sol_crystal_deep') {
        mesh = new THREE.Mesh(deepGeo, deepMat);
        mesh.rotation.y = Math.random() * Math.PI;
      } else {
        mesh = new THREE.Mesh(nailGeo, nailMat);
        mesh.rotation.z = Math.PI * 0.4;
      }
      mesh.castShadow = true;
      rGroup.add(mesh);

      // 发光提示光环
      const haloGeo = new THREE.RingGeometry(0.25, 0.6, 16);
      haloGeo.rotateX(-Math.PI / 2);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0x00cec9,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.y = 0.05;
      rGroup.add(halo);

      this.group.add(rGroup);
      this.islandResources.push({
        ...item,
        group: rGroup,
        halo: halo,
        collected: false
      });
    });
  }

  // 4. 受困学者雷蒙德 (Raymond) 与临时掩体
  async initSurvivor() {
    this.survivorGroup = new THREE.Group();
    // 位于沉船骨架避风侧 (-5.5, 0.5, -2.2)
    this.survivorGroup.position.set(-5.5, 0.5, -2.2);

    try {
      const model = await modelLoader.loadModel('/models/npcs/Model/NpcNmlCat23.Nin_NX_NVN/NpcNmlCat23.dae', {
        scale: 0.8,
        castShadow: true,
        receiveShadow: true
      });
      model.rotation.y = 1.2;
      this.survivorGroup.add(model);
    } catch (e) {
      // 容灾占位方块
      const cubeGeo = new THREE.BoxGeometry(0.6, 1.2, 0.6);
      const cubeMat = new THREE.MeshStandardMaterial({ color: 0x34495e });
      const cube = new THREE.Mesh(cubeGeo, cubeMat);
      this.survivorGroup.add(cube);
    }

    // 求救气泡光标
    const alertGeo = new THREE.ConeGeometry(0.2, 0.5, 6);
    alertGeo.rotateX(Math.PI);
    const alertMat = new THREE.MeshBasicMaterial({ color: 0xff4757 });
    this.alertMesh = new THREE.Mesh(alertGeo, alertMat);
    this.alertMesh.position.set(0, 1.8, 0);
    this.survivorGroup.add(this.alertMesh);

    this.group.add(this.survivorGroup);
  }

  // 5. 营地前哨信标基座 (Outpost Beacon)
  initOutpostFlag() {
    this.outpostGroup = new THREE.Group();
    this.outpostGroup.position.set(3.5, 0.35, 1.5);

    // 粗石基座
    const baseGeo = new THREE.CylinderGeometry(0.8, 1.0, 0.4, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x636e72, flatShading: true });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.castShadow = true;
    base.receiveShadow = true;
    this.outpostGroup.add(base);

    // 木制旗杆
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 3.2, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x535c68 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.6;
    pole.castShadow = true;
    this.outpostGroup.add(pole);

    // 未开拓旗面 (灰色) / 开拓后 (青绿锦旗)
    const flagGeo = new THREE.PlaneGeometry(1.2, 0.7);
    this.flagMat = new THREE.MeshStandardMaterial({
      color: 0x95a5a6,
      roughness: 0.8,
      side: THREE.DoubleSide
    });
    this.flagMesh = new THREE.Mesh(flagGeo, this.flagMat);
    this.flagMesh.position.set(0.65, 2.7, 0);
    this.outpostGroup.add(this.flagMesh);

    this.group.add(this.outpostGroup);
  }

  // 6. 浮木岛滩头返航木筏
  initReturnRaft() {
    this.raftGroup = new THREE.Group();
    this.raftGroup.position.set(0, 0.05, 13.5);

    const logMat = new THREE.MeshStandardMaterial({ color: 0x5c3818, roughness: 0.8 });
    for (let i = -1; i <= 1; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 3.6, 8), logMat);
      log.rotation.x = Math.PI / 2;
      log.position.set(i * 0.6, 0.15, 0);
      log.castShadow = true;
      this.raftGroup.add(log);
    }

    // 小桅杆与三角帆
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

  // 交互：救援幸存者雷蒙德
  rescueSurvivor() {
    if (this.survivorRescued) {
      if (this.game && this.game.ui) {
        this.game.ui.showDialog('探险学者·雷蒙德', '👓 “我已经把随身的技术笔记整理好了！只要跟你乘木筏回到主岛，我就能立刻在大本营投入高效建造！”');
      }
      return;
    }

    const inv = this.game.ui ? this.game.ui.inventory : {};
    const survival = this.game.survival;

    // 救援需要提供一份水或食物
    const hasWater = survival && survival.canteenSips > 0;
    const foodKey = ['apple', 'coconut', 'fish', 'baked_fish', 'baked_apple'].find(k => (inv[k] || 0) > 0);

    if (hasWater || foodKey) {
      if (hasWater) {
        survival.canteenSips--;
      } else {
        inv[foodKey]--;
      }

      this.survivorRescued = true;
      if (this.game?.story) {
        this.game.story.raymondRescued = true;
      }
      if (this.alertMesh) this.alertMesh.visible = false;
      soundEngine.playPlaceFurniture();

      if (this.game.ui) {
        this.game.ui.renderInventory();
        this.game.ui.updateSurvivalHUD();
        this.game.ui.showDialog(
          '👓 救援成功 · 探险学者雷蒙德入队！',
          '你递上了清冽甘泉与干粮……\n\n雷蒙德推了推眼镜，苍白的脸上恢复了血色：“天呐……收音机求救真的引来了救援！这艘沉船的龙骨彻底撕裂了，我被困在这里数日……太感谢你了！\n\n我愿意随你的木筏返回主岛家园，担任营地【工坊技师】岗位！请在码头按【E】扬帆返航带我回家吧！”'
        );
      }
    } else {
      if (this.game.ui) {
        this.game.ui.showDialog(
          '虚弱的遇难者',
          '受困者极度虚弱脱水！请在背包中准备好【水壶淡水】或【干粮熟食】前来按【E】喂食救治！'
        );
      }
    }
  }

  // 交互：插旗建立海外资源前哨
  claimOutpost() {
    if (this.outpostClaimed) {
      if (this.game && this.game.ui) {
        this.game.ui.showToast('🚩 此处已建成为避风家园【浮木前哨站】！', 'medium');
      }
      return;
    }

    const inv = this.game.ui ? this.game.ui.inventory : {};
    const planks = inv['wood_plank'] || 0;
    const nails = inv['nail'] || 0;

    if (planks < 2 || nails < 1) {
      if (this.game && this.game.ui) {
        this.game.ui.showDialog('🚩 建立海外资源前哨', '在此处建立【浮木前哨信标】需要：木板 x2、铁钉 x1！\n建立前哨后，可在此设立避风坐标，并每日自动回收海浪冲刷的原木！');
      }
      return;
    }

    // 扣除材料
    inv['wood_plank'] -= 2;
    inv['nail'] -= 1;
    if (inv['wood_plank'] <= 0) delete inv['wood_plank'];
    if (inv['nail'] <= 0) delete inv['nail'];

    this.outpostClaimed = true;
    if (this.flagMat) {
      this.flagMat.color.set(0x00cec9); // 变为亮青色营地阵营旗帜
    }
    soundEngine.playPlaceFurniture();

    if (this.game.ui) {
      this.game.ui.renderInventory();
      this.game.ui.showDialog('🚩 前哨站建立成功！', '🎉 雄伟的开拓旗帜在沙洲迎风招展！\n【浮木前哨站】正式纳入避风家园领地管辖！每日营地结算将获得额外的海滩漂流木收益！');
    }
    if (this.game.nauticalChart) {
      this.game.nauticalChart.islands['timber_isle'].outpostBuilt = true;
    }
  }

  // 获取某类资源的再生周期（天）：普通木料铁钉 2 天，深层海脉晶核 4 天
  _getResourceCooldownDays(type) {
    if (type === 'sol_crystal_deep') return 4;
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

  // 拾取岛上散落资源
  checkPickup(playerPos, onPickup) {
    const currentDay = this._getCurrentDay();
    for (const item of this.islandResources) {
      if (item.collected) continue;
      const d = playerPos.distanceTo(item.group.position);
      if (d < 1.8) {
        let granted = true;
        if (typeof onPickup === 'function') {
          const res = onPickup(item.type, item.name);
          if (res === false) granted = false;
        }
        if (!granted) return null;

        item.collected = true;
        item.group.visible = false;
        this.resourceCooldowns[item.id] = currentDay + this._getResourceCooldownDays(item.type);
        soundEngine.playItemDrop();
        return item;
      }
    }
    return null;
  }

  // 跨天结算：到期资源自动刷新再生
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

  // 帧循环驱动脉动特效
  update(delta) {
    if (!this.group.visible) return;

    const time = Date.now() * 0.003;
    // 呼吸脉动光圈
    for (const item of this.islandResources) {
      if (!item.collected && item.halo) {
        const s = 1.0 + Math.sin(time * 3 + item.group.position.x) * 0.15;
        item.halo.scale.set(s, s, s);
      }
    }

    // 幸存者求救锥形标上下跳动
    if (this.alertMesh && this.alertMesh.visible) {
      this.alertMesh.position.y = 1.8 + Math.sin(time * 4) * 0.18;
      this.alertMesh.rotation.y += delta * 2.0;
    }
  }

  // 显隐切换
  setVisible(visible) {
    this.group.visible = visible;
  }

  // 序列化
  serialize() {
    return {
      survivorRescued: this.survivorRescued,
      outpostClaimed: this.outpostClaimed,
      collectedResourceIds: this.islandResources.filter(r => r.collected).map(r => r.id),
      resourceCooldowns: { ...this.resourceCooldowns }
    };
  }

  // 反序列化（兼容旧档仅含 collectedResourceIds 的情况）
  deserialize(data) {
    if (!data) return;
    this.survivorRescued = Boolean(data.survivorRescued);
    if (this.survivorRescued && this.alertMesh) {
      this.alertMesh.visible = false;
    }

    this.outpostClaimed = Boolean(data.outpostClaimed);
    if (this.outpostClaimed && this.flagMat) {
      this.flagMat.color.set(0x00cec9);
    }

    this.resourceCooldowns = {};
    const curDay = this._getCurrentDay();
    if (data.resourceCooldowns && typeof data.resourceCooldowns === 'object') {
      for (const [id, day] of Object.entries(data.resourceCooldowns)) {
        this.resourceCooldowns[id] = Number(day);
      }
    } else if (Array.isArray(data.collectedResourceIds)) {
      data.collectedResourceIds.forEach(id => {
        const found = this.islandResources.find(r => r.id === id);
        this.resourceCooldowns[id] = curDay + this._getResourceCooldownDays(found ? found.type : 'lumber');
      });
    }

    const set = new Set(Object.keys(this.resourceCooldowns));
    this.islandResources.forEach(r => {
      if (set.has(r.id)) {
        r.collected = true;
        r.group.visible = false;
      } else {
        r.collected = false;
        r.group.visible = true;
      }
    });
  }
}
