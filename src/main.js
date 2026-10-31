import { Buffer } from 'buffer';
if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

import { populateOpening, placeOpeningAsset } from './core/OpeningAssets.js';
import { ISLAND_LAYOUT, distanceXZ } from './core/IslandLayout.js';
import * as THREE from 'three';
import { IslandTerrain } from './island/IslandTerrain.js';
import { AmbientEcosystemParticles } from './island/AmbientEcosystemParticles.js';
import { DayNightCycle } from './core/DayNightCycle.js';
import { PlayerController } from './entities/PlayerController.js';
import { VillagerManager } from './entities/VillagerManager.js';
import { TreeInteraction } from './systems/TreeInteraction.js';
import { BuildSystem } from './systems/BuildSystem.js';
import { SurvivalSystem } from './systems/SurvivalSystem.js';
import { FishingSystem } from './systems/FishingSystem.js';
import { CookingSystem } from './systems/CookingSystem.js';
import { UIManager } from './ui/UIManager.js';
import { StorySystem } from './systems/StorySystem.js';
import { BeachResourceSystem } from './systems/BeachResourceSystem.js';
import { FlotsamSalvageSystem } from './systems/FlotsamSalvageSystem.js';
import { StorageSystem } from './systems/StorageSystem.js';
import { CampFacilitiesSystem } from './systems/CampFacilitiesSystem.js';
import { CampInteractiveEntities } from './entities/CampInteractiveEntities.js';
import { NauticalChartSystem } from './systems/NauticalChartSystem.js';
import { ShipUpgradeSystem } from './systems/ShipUpgradeSystem.js';
import { DockShipEntity } from './entities/DockShipEntity.js';
import { TimberIsleScene } from './island/TimberIsleScene.js';
import { QuarryIsleScene } from './island/QuarryIsleScene.js';
import { WildlifeCombatSystem } from './systems/WildlifeCombatSystem.js';
import { SaveSystem } from './systems/SaveSystem.js';
import { ShopManager } from './ui/ShopManager.js';
import { MonkeyHelperSystem } from './systems/MonkeyHelperSystem.js';
import { TidalTrapSystem } from './systems/TidalTrapSystem.js';
import { MiningRigSystem } from './systems/MiningRigSystem.js';
import { PetCompanionSystem } from './systems/PetCompanionSystem.js';
import { WeatherSurvivalSystem } from './systems/WeatherSurvivalSystem.js';
import { AncientTempleEntity } from './entities/AncientTempleEntity.js';
import { AncientTempleScene } from './island/AncientTempleScene.js';
import { TemplePuzzleSystem } from './systems/TemplePuzzleSystem.js';
import { modelLoader } from './core/ModelLoader.js';
import { soundEngine } from './core/AudioSystem.js';
import { resolveVisualQuality, applyPostOverlay, isMobileDevice } from './core/VisualQuality.js';
import { InteractionFeedbackSystem } from './systems/InteractionFeedbackSystem.js';

class Game {
  constructor() {
    this.container = document.getElementById('app');

    // 1. 初始化 Three.js 渲染管线 (移动端由高物理PPI屏幕自然呈现抗锯齿，免去昂贵的硬件 MSAA 带宽抢占)
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({
      antialias: !isMobileDevice,
      powerPreference: 'high-performance',
      stencil: false // 关闭不必要的模版缓冲
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // 画质档位：低档关闭后期叠加并降低像素比/阴影精度，默认中档（详见 core/VisualQuality.js）
    this.visualQuality = resolveVisualQuality();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.visualQuality.pixelRatioCap));
    this.renderer.shadowMap.enabled = this.visualQuality.enableShadows !== false;
    this.renderer.shadowMap.type = this.visualQuality.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08; // 原 1.12，水面高光增强后略降，避免沙滩过曝

    this.container.appendChild(this.renderer.domElement);
    this.postOverlay = applyPostOverlay(this.container, this.visualQuality, this.renderer.domElement);

    // 2. 昼夜循环与光照
    this.dayNight = new DayNightCycle(this.scene, this.renderer, this.visualQuality);

    // 3. 岛屿地貌与水体 (遵循 CastawaySOL 纯净热带海蓝与草坪)
    this.terrain = new IslandTerrain(this.scene, this.visualQuality);
    // 雾色与水面天空反射色随昼夜模式联动
    this.dayNight.attachWater(this.terrain.waterUniforms);

    // 4. CastawaySOL 四维生存系统 (生命/饱食/饮水/疲劳，步数结算)
    this.survival = new SurvivalSystem(
      (stats) => {
        if (this.ui) this.ui.updateSurvivalHUD();
      },
      (reason) => {
        if (this.ui) this.ui.showDialog('游戏结束', `💀 ${reason}！请注意及时采集果实烤鱼、并使用水壶补充水分！`);
      }
    );

    // 5. 主角控制器 (55° 高清俯视大视角，视距 14.5 米，视野开阔通透)
    this.player = new PlayerController(this.scene, this.camera, this.renderer.domElement);

    // 6. 小动物村民自主生态
    this.villagers = new VillagerManager(this.scene);

    // 7. 自然生态树木与掉落系统 (苹果树、椰子树、雪松)
    this.trees = new TreeInteraction(this.scene);

    // 7.2 全岛林间生态微粒子 (林间飘转翠叶微粒 + 黄昏夜晚温润灵动萤火虫)
    this.ambientParticles = new AmbientEcosystemParticles(this.scene, () => {
      return this.dayNight ? this.dayNight.currentMode : 'day';
    });

    // 7.5 海滩自然散落物资与海蚀礁石系统 (保证燧石、漂流木、大礁石、物资箱真实可达)
    this.beachResources = new BeachResourceSystem(this.scene);

    // 7.8 海面漂流物动态打捞系统 (潮汐涌浪、浮木板、金属桶与淡水罐)
    this.flotsamSalvage = new FlotsamSalvageSystem(this.scene, this);

    // 7.9 营地储物箱管理系统 (支持行囊双向存取与建造消耗联动)
    this.storageSystem = new StorageSystem(this);

    // 7.95 营地设施与居民生产经营中枢 (净水滴滤台、床位分配与每日晨报产出)
    this.campFacilities = new CampFacilitiesSystem(this);

    // 7.98 荒岛群岛海图与航行系统 (小群岛航路、出海补给与前哨开拓)
    this.nauticalChart = new NauticalChartSystem(this);

    // 7.985 出海船升级系统与随船货运仓 (T1原木筏 -> T2龙骨风帆艇 -> T3铁甲探索舰)
    this.shipUpgradeSystem = new ShipUpgradeSystem(this);

    // 7.99 浮木岛 (Timber Isle) 与海蚀矿石岛 (Quarry Isle) 小群岛生态
    this.timberIsleScene = new TimberIsleScene(this.scene, this);
    this.quarryIsleScene = new QuarryIsleScene(this.scene, this);
    this.currentIslandId = 'main_island';
    this.raymondSettled = false;

    // 8. 建造装修与家具摆放系统
    this.buildSystem = new BuildSystem(this.scene, this.camera, this.renderer.domElement, this);

    // 9. UI 管理器
    this.ui = new UIManager(this.buildSystem, this.dayNight, this.player, this.survival, (action) => {
      this.handlePlayerAction(action);
    });

    // 10. 装配 CastawaySOL 垂钓与烹饪系统
    this.fishing = new FishingSystem(this.scene, this.player, this.ui, this.survival);
    this.cooking = new CookingSystem(this.ui, this.survival);

    // 10.5 引入 Survival Kids 经典主线剧情引擎
    this.story = new StorySystem(this);

    // 10.8 引入版本化安全存档系统 (SaveSystem v1)
    this.saveSystem = new SaveSystem(this);

    // 10.9 商业化特权与 Solana 商城系统
    this.shopManager = new ShopManager(this);

    // 11. 初始化营地标志性建筑、篝火与 Survival Kids 逃脱地标
    this.initLandmarks();
    this.openingAssetsReady = populateOpening(this.scene);
    this.createCampfire();
    this.initSurvivalKidsLandmarks();

    // 11.5 营地 3D 交互场景实体 (经营告示牌、无线电空投站、净水滴滤台、浮标滑轮缆桩)
    this.campEntities = new CampInteractiveEntities(this.scene);

    // 11.6 西南码头 3D 船坞工程台与动态船只实体
    this.dockShipEntity = new DockShipEntity(this.scene, this);
    if (this.dockShipEntity && this.dockShipEntity.vesselGroup) {
      this.dockShipEntity.vesselGroup.visible = Boolean(this.story && this.story.raftBuilt);
    }

    // 11.8 荒岛野生生物生态与实时战斗打击系统 (沙滩巨蟹、丛林野猪、长矛刺击、战利品)
    this.wildlifeCombat = new WildlifeCombatSystem(this);

    // 11.9 荒岛深度玩法：小猴伙伴协同技能系统与潮汐捕蟹/营地熏烤架
    this.monkeyHelper = new MonkeyHelperSystem(this);
    this.tidalTrap = new TidalTrapSystem(this);
    this.miningRig = new MiningRigSystem(this);
    this.petCompanion = new PetCompanionSystem(this);
    this.weatherSystem = new WeatherSurvivalSystem(this);
    this.ancientTemple = new AncientTempleEntity(this.scene);
    this.ancientTempleScene = new AncientTempleScene(this.scene, this);
    this.templePuzzle = new TemplePuzzleSystem(this);

    // 12. 键盘交互与战斗快捷键 (E键互动，F键挥矛/射击，R键切换近战与远程模式)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') {
        this.handlePlayerAction('interact');
      } else if (e.code === 'KeyF' || e.code === 'KeyJ') {
        this.handlePlayerAction('attack');
      } else if (e.code === 'KeyR') {
        if (this.wildlifeCombat) {
          this.wildlifeCombat.toggleCombatMode();
        }
      }
    });

    // 13. 窗口尺寸自适应
    window.addEventListener('resize', () => this.onWindowResize());

    // 14. 尝试安全载入本地持久化存档，无存档则保持全新求生初始状态
    if (this.saveSystem) {
      const loadRes = this.saveSystem.loadGame();
      if (loadRes.success) {
        console.log(`💾 [SaveSystem] 成功载入本地存档 (Schema v${loadRes.schemaVersion})`);
      }
      this.saveSystem.startAutoSave(60000);
    }

    // 15. 初始化全沉浸式【可交互感知系统】(3D 地面柔光环 + HUD 动态情境胶囊)
    this.interactionFeedback = new InteractionFeedbackSystem(this);

    // 16. 启动时钟与渲染循环
    this.clock = new THREE.Clock();
    this.animate();
    window.__game = this;
    window.THREE = THREE;

    // 17. 实时联动 Survival Kids 经典主线任务目标 Banner
    if (this.ui) {
      this.ui.updateObjective(this.story.getQuestBannerText());
    }
  }

  // 创建营地温暖跳动的篝火
  createCampfire() {
    this.campfireGroup = new THREE.Group();
    // 篝火基准坐标 (-7, 0, -4)
    this.campfireGroup.position.fromArray(ISLAND_LAYOUT.campfire);

    // 围石圆圈
    placeOpeningAsset(this.campfireGroup, 'survival', 'campfire-pit', [0, 0, 0], 1.5, 0, false).catch(error => console.error('Campfire asset load failed', error));

    const flameGeo = new THREE.ConeGeometry(0.35, 0.8, 6);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6600, wireframe: false });
    this.flameMesh = new THREE.Mesh(flameGeo, flameMat);
    this.flameMesh.position.y = 0.8;
    this.campfireGroup.add(this.flameMesh);

    // 暖光点光源
    this.campfireLight = new THREE.PointLight(0xff7722, 2.5, 9);
    this.campfireLight.position.set(0, 0.6, 0);
    this.campfireLight.castShadow = true;
    this.campfireGroup.add(this.campfireLight);

    this.scene.add(this.campfireGroup);
  }

  async initLandmarks() {
    // 露营帐篷放在西侧 (-16, 0, -8)
    const house = await modelLoader.loadModel('/models/structures/Model/FtrMjkHouse.Nin_NX_NVN/FtrMjkHouse.dae', {
      scale: 3.0,
      castShadow: true,
      receiveShadow: true
    });
    house.position.set(25, 1.8, -19);
    house.rotation.y = -0.4;
    house.userData.movementBox = true;
    this.scene.add(house);
  }

  // 初始化 Survival Kids 逃脱地标 (沙滩 SOS 巨石阵、出海大木筏、远古神秘宝石)
  initSurvivalKidsLandmarks() {
    this.landmarksGroup = new THREE.Group();
    this.scene.add(this.landmarksGroup);

    // 1. 南岸沙滩巨型 S.O.S 地标基座 (0, 0.05, 18)
    this.sosGroup = new THREE.Group();
    this.sosGroup.position.fromArray(ISLAND_LAYOUT.sos);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });

    // 用白石与贝壳排布出 S-O-S 字母阵列
    const makeStoneLetter = (dots, offsetX) => {
      dots.forEach(([x, z]) => {
        const geo = new THREE.DodecahedronGeometry(0.24, 1);
        const mesh = new THREE.Mesh(geo, stoneMat);
        mesh.position.set(offsetX + x * 0.5, 0.08, z * 0.5);
        mesh.rotation.y = Math.random() * Math.PI;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.sosGroup.add(mesh);
      });
    };

    // 'S'
    const sDots = [[-1,-2],[0,-2],[1,-2], [-1,-1], [-1,0],[0,0],[1,0], [1,1], [-1,2],[0,2],[1,2]];
    // 'O'
    const oDots = [[-1,-2],[0,-2],[1,-2], [-1,-1],[1,-1], [-1,0],[1,0], [-1,1],[1,1], [-1,2],[0,2],[1,2]];
    // 布局 S O S
    makeStoneLetter(sDots, -3.2);
    makeStoneLetter(oDots, 0);
    makeStoneLetter(sDots, 3.2);

    this.sosGroup.visible = false; // 初始未拼装
    this.landmarksGroup.add(this.sosGroup);

    // 沙滩拼装标杆轮廓线
    const chalkMat = new THREE.MeshBasicMaterial({ color: 0xffdd59, transparent: true, opacity: 0.45 });
    this.sosChalk = new THREE.Mesh(new THREE.RingGeometry(2.8, 3.0, 32), chalkMat);
    this.sosChalk.rotation.x = -Math.PI / 2;
    this.sosChalk.position.fromArray(ISLAND_LAYOUT.sos);
    this.landmarksGroup.add(this.sosChalk);

    // 2. 西南浅滩求生大木筏 ((-24, 0.02, 12))
    this.raftGroup = new THREE.Group();
    this.raftGroup.position.fromArray(ISLAND_LAYOUT.raft);

    // 4 根并排粗壮圆木
    const logMat = new THREE.MeshStandardMaterial({ color: 0x5c3818, roughness: 0.8 });
    for (let i = -1.5; i <= 1.5; i += 1.0) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 4.2, 8), logMat);
      log.rotation.x = Math.PI / 2;
      log.position.set(i * 0.65, 0.2, 0);
      log.castShadow = true;
      this.raftGroup.add(log);
    }
    // 横向加固木与桅杆
    const cross1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.8, 8), logMat);
    cross1.rotation.z = Math.PI / 2;
    cross1.position.set(0, 0.48, -1.2);
    this.raftGroup.add(cross1);

    const cross2 = cross1.clone();
    cross2.position.set(0, 0.48, 1.2);
    this.raftGroup.add(cross2);

    // 桅杆与白帆
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 8), logMat);
    mast.position.set(0, 1.6, 0);
    this.raftGroup.add(mast);

    const sailMat = new THREE.MeshStandardMaterial({ color: 0xf5f6fa, side: THREE.DoubleSide, roughness: 0.6 });
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.0), sailMat);
    sail.position.set(0.9, 2.0, 0);
    sail.rotation.y = 0.2;
    this.raftGroup.add(sail);

    this.raftGroup.visible = false; // 初始未建造
    this.landmarksGroup.add(this.raftGroup);

    // 3. 远古遗迹 3 颗神秘宝石 (星形红宝石、菱形蓝宝石、苍翠圆月绿宝石)
    this.gemObjects = [
      { id: 'star_gem', name: '远古·星形红宝石', pos: new THREE.Vector3(18, 0.5, 6), color: 0xff3838, picked: false },
      { id: 'diamond_gem', name: '远古·菱形蓝宝石', pos: new THREE.Vector3(26, 2.3, -15), color: 0x3867d6, picked: false },
      { id: 'moon_gem', name: '远古·圆月苍翠宝石', pos: new THREE.Vector3(-20, 0.5, -18), color: 0x20bf6b, picked: false }
    ];

    this.gemMeshes = [];
    this.gemObjects.forEach((gem) => {
      const gGroup = new THREE.Group();
      gGroup.position.copy(gem.pos);

      const geo = new THREE.OctahedronGeometry(0.35, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: gem.color,
        roughness: 0.15,
        metalness: 0.8,
        emissive: gem.color,
        emissiveIntensity: 0.6
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      gGroup.add(mesh);

      // 发光点光源
      const light = new THREE.PointLight(gem.color, 1.5, 4.0);
      light.position.set(0, 0.2, 0);
      gGroup.add(light);

      this.landmarksGroup.add(gGroup);
      this.gemMeshes.push({ info: gem, group: gGroup, mesh: mesh });
    });
  }

  // 主岛所有环境实体显隐控制
  setMainIslandVisible(visible) {
    if (this.terrain && this.terrain.group) this.terrain.group.visible = visible;
    if (this.trees && this.trees.group) this.trees.group.visible = visible;
    if (this.beachResources && this.beachResources.group) this.beachResources.group.visible = visible;
    if (this.flotsamSalvage && this.flotsamSalvage.group) this.flotsamSalvage.group.visible = visible;
    if (this.villagers && this.villagers.group) this.villagers.group.visible = visible;
    if (this.wildlifeCombat && this.wildlifeCombat.group) this.wildlifeCombat.group.visible = visible;
    if (this.buildSystem && this.buildSystem.furnitureGroup) this.buildSystem.furnitureGroup.visible = visible;
    if (this.landmarksGroup) this.landmarksGroup.visible = visible;
    if (this.campfireGroup) this.campfireGroup.visible = visible;
    if (this.campEntities && this.campEntities.group) this.campEntities.setVisible(visible);
    if (this.ancientTemple && this.ancientTemple.group) this.ancientTemple.group.visible = visible;
    if (this.dockShipEntity) this.dockShipEntity.setVisible(visible);
    if (this.ambientParticles && this.ambientParticles.group) this.ambientParticles.group.visible = visible;
    if (visible && this.ancientTempleScene) this.ancientTempleScene.setVisible(false);
  }

  // 跨岛航行与地宫场景平滑跳转 (带有音效与黑幕淡入淡出，支持 force 强制突破异常状态死锁)
  travelToIsland(islandId, force = false) {
    if (!force && this.currentIslandId === islandId) return;

    const previousIsland = this.currentIslandId;
    soundEngine.playPlaceFurniture();
    if (islandId === 'ancient_temple') {
      this.ui.showToast('🏛️ 穿越青蓝秘境漩涡……踏入远古神殿独立地宫！');
    } else if (previousIsland === 'ancient_temple') {
      this.ui.showToast('🌀 踏入青蓝符文传送阵……返回海岛主地图！');
    } else {
      this.ui.showToast('⛵ 扬帆起航！破浪驶向远方海域……');
    }
    this.ui.createTransitionFade();

    setTimeout(() => {
      if (islandId === 'ancient_temple') {
        this.currentIslandId = 'ancient_temple';
        this.setMainIslandVisible(false);
        if (this.timberIsleScene) this.timberIsleScene.setVisible(false);
        if (this.quarryIsleScene) this.quarryIsleScene.setVisible(false);
        if (this.ancientTempleScene) this.ancientTempleScene.setVisible(true);

        // 切换为地宫幽暗氛围光与深渊轻雾，严密同步清除底色
        this.renderer.setClearColor(0x0a101d);
        if (this.dayNight && this.dayNight.dirLight) this.dayNight.dirLight.visible = false;
        if (this.scene) this.scene.fog = new THREE.FogExp2(0x0a101d, 0.012);

        // 传送到古代神殿入口传送光阵 (0, 0.4, 15)
        this.player.position.set(0, 0.4, 15);
        if (this.player.pivot) this.player.pivot.position.set(0, 0.4, 15);
        this.player.rotation = Math.PI; // 朝向神殿大殿内部 (北向)
        if (this.player.mesh) this.player.mesh.rotation.y = Math.PI;

        // 瞬时校准相机机位，杜绝角度残留与视角穿帮
        if (this.player && this.player.snapCamera) {
          this.player.snapCamera(0, 0.50, 11.0);
        } else if (this.camera && this.player) {
          const camDistH = this.player.cameraDistance * Math.cos(this.player.cameraAngleV);
          const camDistV = this.player.cameraDistance * Math.sin(this.player.cameraAngleV);
          this.camera.position.set(0, 0.4 + camDistV + 0.8, 15 + camDistH);
          if (this.player.cameraTarget) {
            this.player.cameraTarget.set(0, 0.4 + 1.7, 15 - 2.2);
            this.camera.lookAt(this.player.cameraTarget);
          }
        }

        this.ui.showDialog(
          '🏛️ 踏入 · 后山古代神殿 (Ancient Temple)',
          '穿越呼啸的空间漩涡，你踏入了深埋后山地底千年的远古神殿独立密室！\n\n' +
          '四周耸立着散发幽光的象形符文巨柱，大殿中央伫立着神秘的【星辰日冕祭坛】与【九宫图腾石阵】！\n' +
          '深入殿堂参悟机关解谜，轰开内殿玄铁大门，探寻沉睡的远古波塞冬黄金神藏！\n\n' +
          '💡 提示：若需返回海岛，随时走入身后的【青蓝符文光阵】即可！'
        );
      } else if (islandId === 'timber_isle') {
        this.currentIslandId = 'timber_isle';
        if (this.nauticalChart) this.nauticalChart.currentIslandId = 'timber_isle';
        this.setMainIslandVisible(false);
        if (this.ancientTempleScene) this.ancientTempleScene.setVisible(false);
        if (this.quarryIsleScene) this.quarryIsleScene.setVisible(false);
        this.timberIsleScene.setVisible(true);

        if (this.dayNight && this.dayNight.dirLight) this.dayNight.dirLight.visible = true;
        if (this.scene) this.scene.fog = new THREE.FogExp2(0xb8e9f8, 0.0032);

        // 传送到浮木岛沙滩码头
        this.player.position.set(0, 0.4, 11);
        if (this.player.pivot) this.player.pivot.position.set(0, 0.4, 11);
        if (this.player && this.player.snapCamera) this.player.snapCamera(0, 0.42, 12.0);

        this.ui.showDialog(
          '⛵ 抵达 · 漂流浮木岛 (Timber Isle)',
          '历经数海里乘风破浪，你驾筏冲上了一处被海浪包围的沉船沙洲！\n四周散落着厚重的风化原木方料与破损龙骨，沉船避风处传来微弱的求救呼唤！\n在岛上搜索遇难同伴，建立前哨，并收集珍贵的造船方料吧！'
        );
      } else if (islandId === 'quarry_isle') {
        this.currentIslandId = 'quarry_isle';
        if (this.nauticalChart) this.nauticalChart.currentIslandId = 'quarry_isle';
        this.setMainIslandVisible(false);
        if (this.ancientTempleScene) this.ancientTempleScene.setVisible(false);
        if (this.timberIsleScene) this.timberIsleScene.setVisible(false);
        this.quarryIsleScene.setVisible(true);

        if (this.dayNight && this.dayNight.dirLight) this.dayNight.dirLight.visible = true;
        if (this.scene) this.scene.fog = new THREE.FogExp2(0xb8e9f8, 0.0032);

        // 传送到矿石岛滩头
        this.player.position.set(0, 0.4, 11.5);
        if (this.player.pivot) this.player.pivot.position.set(0, 0.4, 11.5);
        if (this.player && this.player.snapCamera) this.player.snapCamera(0, 0.42, 12.0);

        this.ui.showDialog(
          '🌋 抵达 · 海蚀矿石岛 (Quarry Isle)',
          '狂暴的黑礁海浪将木筏推上了一处险峻的火山碎屑岩滩！\n四周耸立着刀削般的玄武岩立柱，空气中弥漫着硫磺与金属的气息！\n在岛上寻找露天富铁矿脉，参悟古代水手石碑，并插旗建立矿业前哨吧！'
        );
      } else if (islandId === 'main_island') {
        const wasSurvivorRescued = this.timberIsleScene && this.timberIsleScene.survivorRescued;
        this.currentIslandId = 'main_island';
        if (this.nauticalChart) this.nauticalChart.currentIslandId = 'main_island';
        if (this.ancientTempleScene) this.ancientTempleScene.setVisible(false);
        if (this.timberIsleScene) this.timberIsleScene.setVisible(false);
        if (this.quarryIsleScene) this.quarryIsleScene.setVisible(false);
        this.setMainIslandVisible(true);

        // 恢复海岛蓝天日光与清润海雾与天空清除底色
        if (this.dayNight) {
          this.dayNight.setMode(this.dayNight.currentMode);
        } else {
          this.renderer.setClearColor(0x76c4e0);
        }
        if (this.dayNight && this.dayNight.dirLight) this.dayNight.dirLight.visible = true;
        if (this.scene) this.scene.fog = new THREE.FogExp2(0xb8e9f8, 0.0032);

        // 判断返航来源：若从古代神殿出来，传送到后山神殿大门前；若从海上归来，传送到西南码头
        if (previousIsland === 'ancient_temple') {
          this.player.position.set(0, 0.4, -20.0);
          if (this.player.pivot) this.player.pivot.position.set(0, 0.4, -20.0);
          this.player.rotation = 0; // 朝向南面海岛腹地
          if (this.player.mesh) this.player.mesh.rotation.y = 0;

          if (this.player && this.player.snapCamera) {
            this.player.snapCamera(0, 0.38, 12.0);
          } else if (this.camera && this.player) {
            const camDistH = this.player.cameraDistance * Math.cos(this.player.cameraAngleV);
            const camDistV = this.player.cameraDistance * Math.sin(this.player.cameraAngleV);
            this.camera.position.set(0, 0.4 + camDistV + 0.8, -20.0 + camDistH);
            if (this.player.cameraTarget) {
              this.player.cameraTarget.set(0, 0.4 + 1.7, -20.0 - 2.2);
              this.camera.lookAt(this.player.cameraTarget);
            }
          }

          this.ui.showToast('🏛️ 穿过符文传送光阵，回到了后山海风之中！');
        } else {
          // 传送到西南出航湾码头栈桥
          this.player.position.set(-22, 0.05, 38.0);
          if (this.player.pivot) this.player.pivot.position.set(-22, 0.05, 38.0);

          if (this.dockShipEntity && this.shipUpgradeSystem) {
            this.dockShipEntity.vesselGroup.visible = true;
            this.dockShipEntity.updateModel(this.shipUpgradeSystem.currentTierLevel);
          }

          // 若成功营救了学者雷蒙德并返航主岛
          if (wasSurvivorRescued && !this.raymondSettled) {
            this.raymondSettled = true;
            if (this.nauticalChart) {
              this.nauticalChart.discoverIsland('quarry_isle');
            }
            this.ui.showDialog(
              '🎉 营地扩容 · 探险学者雷蒙德入驻！',
              '探险学者雷蒙德随同木筏平安抵达成主岛避风家园！\n\n雷蒙德推了推眼镜，惊叹道：“天呐……这里简直是世外桃源！我已经把随身的工匠工具箱安置在大本营，今后每日拂晓我都将为你加工【重型方木】与【铁钉】！\n另外，我在沉船研究航海图时，标定出了远海火山孤峰【海蚀矿石岛 (Quarry Isle)】的航线，已录入海图！\n不过……营地现在多了一张嘴吃饭，请务必保证淡水供给，并为我在营地多造一张【原木单人床】！”\n\n营地总人口升至 3 人，每日晨报产出升级！'
            );
          } else {
            this.ui.showToast('⛵ 顺利返航，回到了避风家园主岛！');
          }
        }
      }

      this.ui.fadeTransitionOut();
    }, 600);
  }

  // 统一响应玩家动作触发 (支持点击虚拟轮盘主按键或键盘E/F)
  handlePlayerAction(action) {
    // 优先响应战斗攻击刺击
    if (action === 'attack') {
      if (this.wildlifeCombat) {
        this.wildlifeCombat.performPlayerAttack();
      }
      return;
    }

    const playerPos = this.player.position;

    // 0. 优先检测附近是否有战斗战利品包裹可按 [E] 拾取
    if (this.wildlifeCombat && this.wildlifeCombat.checkLootPickup(playerPos)) {
      return;
    }

    // 0.05 优先检测台风巨浪冲刷的沉船黑匣子与深海遗落
    if (this.weatherSystem && this.weatherSystem.checkTyphoonPickup(playerPos)) {
      return;
    }

    // === 0. 浮木岛专属场景行为响应 ===
    if (this.currentIslandId === 'timber_isle') {
      // 0.1 拾取浮木岛资源
      const picked = this.timberIsleScene.checkPickup(playerPos, (itemType, resName) => {
        this.ui.addInventory(itemType, 1);
        this.ui.showToast(`拾取了【${resName}】！`);
      });
      if (picked) return;

      // 0.2 救援幸存者雷蒙德 (沉船避风处 -5.5, 0.5, -2.2)
      if (playerPos.distanceTo(new THREE.Vector3(-5.5, 0.5, -2.2)) < 3.2) {
        this.timberIsleScene.rescueSurvivor();
        return;
      }

      // 0.3 插旗建立海外前哨 (前哨信标 3.5, 0.35, 1.5)
      if (playerPos.distanceTo(new THREE.Vector3(3.5, 0.35, 1.5)) < 3.0) {
        this.timberIsleScene.claimOutpost();
        return;
      }

      // 0.4 滩头返航木筏 (0, 0.05, 13.5)
      if (playerPos.distanceTo(new THREE.Vector3(0, 0.05, 13.5)) < 3.8) {
        this.travelToIsland('main_island');
        return;
      }
      return;
    }

    // === 0.5 海蚀矿石岛专属场景行为响应 ===
    if (this.currentIslandId === 'quarry_isle') {
      // 0.5.1 开采或拾取矿石岛资源
      const mined = this.quarryIsleScene.checkMineOrPickup(playerPos, (itemType, resName) => {
        this.ui.addInventory(itemType, 1);
        this.ui.showToast(`成功获取了【${resName}】！`);
      });
      if (mined) return;

      // 0.5.2 检视古代冶炼遗迹石碑 (-1.5, 0.9, -6.5)
      if (playerPos.distanceTo(new THREE.Vector3(-1.5, 0.9, -6.5)) < 3.0) {
        this.quarryIsleScene.readMonolith();
        return;
      }

      // 0.5.3 插旗建立海外矿业前哨 (4.0, 0.9, -5.0)
      if (playerPos.distanceTo(new THREE.Vector3(4.0, 0.9, -5.0)) < 3.0) {
        this.quarryIsleScene.claimOutpost();
        return;
      }

      // 0.5.4 滩头返航木筏 (0, 0.05, 14.0)
      if (playerPos.distanceTo(new THREE.Vector3(0, 0.05, 14.0)) < 3.8) {
        this.travelToIsland('main_island');
        return;
      }
      return;
    }

    // 1. 优先检测附近是否有远古宝石可拾取
    for (const gemItem of this.gemMeshes) {
      if (!gemItem.info.picked && gemItem.group.position.distanceTo(playerPos) < 2.5) {
        gemItem.info.picked = true;
        gemItem.group.visible = false;
        this.story.gemsCollected.add(gemItem.info.id);
        soundEngine.playPlaceFurniture();
        this.ui.showDialog('💎 发现远古秘宝！', `你拾取了【${gemItem.info.name}】！\n神秘的光芒在手心流转……集齐 3 颗古代宝石即可解开荒岛远古神殿的终极生还之谜！（当前已收集：${this.story.gemsCollected.size} / 3）`);
        this.story.update(playerPos, this.ui.inventory, this.survival);
        return;
      }
    }

    // 1.5 检测附近是否有沙滩漂流物资、燧石、礁石或搁浅物资箱可拾取
    if (this.beachResources) {
      const nearMineable = this.beachResources.getNearest(playerPos, 2.2);
      if (nearMineable && nearMineable.isMineable && !nearMineable.collected) {
        const hasHammer = (this.ui.inventory['stone_hammer'] || 0) > 0;
        const hasPickaxe = (this.ui.inventory['stone_pickaxe'] || 0) > 0 || (this.ui.inventory['iron_pickaxe'] || 0) > 0;
        if (hasHammer || hasPickaxe) {
          const mineRes = this.beachResources.mineRock(nearMineable, hasHammer, hasPickaxe, (itemType) => {
            this.ui.addInventory(itemType, 1);
            if (this.story && this.story.onGatherResource) {
              this.story.onGatherResource(itemType);
            }
          });
          if (mineRes && mineRes.broken) {
            this.ui.showToast(`⛏️ 轰然击碎了【${mineRes.name}】！开采出大量燧石原矿与富铁矿石！`);
          } else if (mineRes) {
            this.ui.showToast(`🔨 奋力敲凿【${mineRes.name}】！碎石四溅！(岩脉耐久余 ${mineRes.remainingHp})`);
          }
          return;
        } else {
          this.ui.showToast(`🪨【${nearMineable.name}】坚不可摧！需在合成台研制【重装石锤 🔨】或【骨柄石镐 ⛏️】方可敲凿开采！`);
          return;
        }
      }

      const picked = this.beachResources.checkPickup(playerPos, (itemType, resName) => {
        this.ui.addInventory(itemType, 1);
        this.ui.showToast(`拾取了【${resName}】！`);
        if (this.story && this.story.onGatherResource) {
          this.story.onGatherResource(itemType);
        }
      });
      if (picked) return;
    }

    // 1.6 检测浅海漂浮的木板捆、金属桶、板条箱等漂流物打捞
    if (this.flotsamSalvage) {
      const salvaged = this.flotsamSalvage.checkSalvage(playerPos, (itemType, flotsamName) => {
        this.ui.addInventory(itemType, 1);
        this.ui.showToast(`打捞获得了【${flotsamName}】！`);
        if (this.story && this.story.onGatherResource) {
          this.story.onGatherResource(itemType);
        }
      });
      if (salvaged) return;
    }

    // 1.8 检查是否处于淡水小溪或清泉边补充饮水与灌水
    if (this.beachResources && this.beachResources.isNearFreshwater(playerPos)) {
      this.survival.refillCanteen();
      this.survival.water = Math.min(100, this.survival.water + 35);
      this.ui.updateSurvivalHUD();
      soundEngine.playSplash();
      this.ui.showToast('💧 痛快地饮用了清凉甘甜的溪水！水壶已灌满！');
      if (this.story && this.story.onDrinkWater) {
        this.story.onDrinkWater();
      }
      return;
    }

    // 2. 钓鱼状态中起竿/抛竿
    if (this.fishing.state !== 'idle') {
      this.fishing.handleAction();
      return;
    }

    // 3. 检查是否在近海/栈桥边缘准备钓鱼
    if (this.fishing.isNearWater(playerPos)) {
      this.fishing.handleAction();
      return;
    }

    // 4. 检查是否在营地篝火旁准备烹饪
    if (this.cooking.isNearCampfire(playerPos)) {
      this.cooking.cook();
      return;
    }

    // 4.3 检查是否在营地初始坚固储物木箱旁 (-14.5, 0, 23.5)
    const distToCampChest = Math.hypot(playerPos.x - (-14.5), playerPos.z - 23.5);
    if (distToCampChest < 2.5 && this.storageSystem) {
      this.storageSystem.openStorage('camp_default_chest');
      return;
    }

    // 4.4 检查营地原生 3D 场景交互实体 (经营告示牌、无线电空投站、净水滴滤台、浮标滑轮)
    if (this.campEntities) {
      const anchors = this.campEntities.anchors;

      // 4.4.1 营地经营与居民岗位排班告示牌 (-13.2, 0.05, 21.8)
      if (playerPos.distanceTo(anchors.noticeboard) < 2.5) {
        if (this.ui) this.ui.openCampManageModal();
        return;
      }

      // 4.4.2 救援空投与商业化特权无线电站 (-10.2, 0.05, 22.2)
      if (playerPos.distanceTo(anchors.radioTerminal) < 2.5) {
        if (this.shopManager) this.shopManager.open();
        else if (this.ui) this.ui.openShopModal();
        return;
      }

      // 4.4.3 原生净水滴滤台 (-11.0, 0.05, 25.8)
      if (playerPos.distanceTo(anchors.waterPurifier) < 2.5) {
        if (this.campFacilities) {
          this.campFacilities.interactWaterPurifier({ isWaterPurifier: true });
        }
        return;
      }

      // 4.4.4 南岸打捞浮标岸边滑轮锚桩 (-20.2, 0.02, 33.2)
      if (playerPos.distanceTo(anchors.buoyWinch) < 2.8) {
        if (this.flotsamSalvage && this.flotsamSalvage.hasAutoSalvageBuoy) {
          this.ui.showToast('⚓ 近海【自动打捞浮标网】正在持续运转中，每 30 秒自动捕获海难物资入库！');
        } else {
          // 未解锁时，引导打开商城直接购买部署
          if (this.shopManager) this.shopManager.open();
          else if (this.ui) this.ui.openShopModal();
        }
        return;
      }
    }

    // 4.4.5 南岸潮汐捕蟹笼 (-4.0, 0.02, 36.5)
    if (this.tidalTrap && playerPos.distanceTo(this.tidalTrap.crabTrapAnchor) < 2.6) {
      if (this.ui) this.ui.openCrabTrapModal(this.tidalTrap);
      return;
    }

    // 4.4.6 营地慢火烟熏风干架 (-13.8, 0.05, 24.5)
    if (this.tidalTrap && playerPos.distanceTo(this.tidalTrap.smokerAnchor) < 2.6) {
      if (this.ui) this.ui.openSmokerModal(this.tidalTrap);
      return;
    }

    // 4.4.6.2 营地荒岛绿色解密矿机 (-10.5, 0.05, 20.0)
    if (this.miningRig && playerPos.distanceTo(this.miningRig.anchor) < 2.6) {
      if (this.ui) this.ui.openMiningRigModal(this.miningRig);
      return;
    }

    // 4.4.6.5 营地随行异兽暖巢与伙伴特权中枢 (-15.5, 0.05, 21.0)
    if (this.petCompanion && playerPos.distanceTo(this.petCompanion.nestAnchor) < 2.8) {
      if (this.ui) this.ui.openPetCompanionModal(this.petCompanion);
      return;
    }

    // 4.4.7 小猴伙伴专属岩缝钻穴寻宝探险
    if (this.monkeyHelper) {
      const creviceAction = this.monkeyHelper.getAvailableAction(playerPos);
      if (creviceAction && creviceAction.type === 'crevice') {
        this.monkeyHelper.commandExploreCrevice(creviceAction.target);
        return;
      }
    }

    // 4.5 检查是否在摆放的营地功能设施旁 (储物木箱、净水滴滤台、营地单人床)
    if (this.buildSystem) {
      const facility = this.buildSystem.getNearestInteractable(playerPos, 2.6);
      if (facility) {
        if (facility.isStorage) {
          if (this.storageSystem) {
            this.storageSystem.openStorage(facility.id);
            return;
          }
        } else if (facility.isWaterPurifier) {
          if (this.campFacilities) {
            this.campFacilities.interactWaterPurifier(facility);
            return;
          }
        } else if (facility.isBed) {
          this.survival.sleepOvernight();
          this.ui.updateSurvivalHUD();
          soundEngine.playPlaceFurniture();
          if (this.campFacilities) {
            this.campFacilities.onDayPassed();
          }
          if (this.saveSystem) {
            this.saveSystem.saveGame('sleep_overnight_bed');
          }
          this.ui.showToast('🛏️ 在亲手搭建的原木单人床上熟睡了一夜……疲劳全消！');
          return;
        }
      }
    }

    // 4.9 检查是否在营地中央篝火旁烘烤取暖或搭建避雨石棚 (-7, 0, -4)
    const distToFire = distanceXZ(playerPos, ISLAND_LAYOUT.campfire);
    if (distToFire < 3.2) {
      if (this.weatherSystem) {
        if (!this.weatherSystem.hasFireShelter) {
          const inv = this.ui.inventory;
          const stoneCount = (inv['flint'] || 0) + (inv['rock'] || 0);
          const barkCount = inv['tree_bark'] || 0;
          if (stoneCount >= 3 && barkCount >= 2) {
            const res = this.weatherSystem.buildFireShelter();
            this.ui.showDialog('⛺ 避雨石棚搭建成功！', res.msg + '\n\n火焰受到石板与坚韧树皮遮挡，暴雨与台风中永不熄灭，并提供强劲回暖庇护！');
            if (this.saveSystem) this.saveSystem.saveGame('build_fire_shelter');
            return;
          }
        }
        this.weatherSystem.bodyTemp = Math.min(37.0, this.weatherSystem.bodyTemp + 2.5);
        this.weatherSystem.isWet = false;
        soundEngine.playPlaceFurniture();
        const shelterStatus = this.weatherSystem.hasFireShelter ? '⛺ 已加盖避雨防风石棚（全天候避雨保温）' : '💡 背包携带【石料/燧石 x3 + 坚固树皮 x2】按 [E] 可在此搭建避雨石棚！';
        this.ui.showDialog(
          '🔥 营地温暖篝火',
          `你在跳动的篝火旁烘烤湿透的衣衫与双手……\n当前体温迅速回暖至：【${this.weatherSystem.bodyTemp.toFixed(1)}°C】！\n\n${shelterStatus}`
        );
        return;
      }
    }

    // 4.95 检查神殿交互（分为室内地宫独立地图与主岛后山入口）
    if (this.currentIslandId === 'ancient_temple') {
      const distToPortal = distanceXZ(playerPos, [0, 0, 15]);
      const distToAltar = distanceXZ(playerPos, [0, 0, 2]);
      const distToVault = distanceXZ(playerPos, [0, 0, -22]);

      if (distToPortal < 3.2) {
        // 穿越光阵返回海岛主地图
        this.travelToIsland('main_island', true);
        return;
      } else if (distToAltar < 3.8) {
        // 参悟前殿日冕解谜
        if (this.templePuzzle) {
          this.templePuzzle.open();
        }
        return;
      } else if (distToVault < 3.8) {
        // 后殿黄金宝座神藏
        if (this.ancientTempleScene && this.ancientTempleScene.isInnerGateOpen) {
          if (this.templePuzzle && !this.templePuzzle.vaultClaimed) {
            this.templePuzzle.claimTempleVault();
          } else {
            this.ui.showToast('👑 远古波塞冬金冠已入囊，王座永受神光护佑！');
          }
        } else {
          this.ui.showDialog('🔒 玄铁门扉紧锁', '深渊密室的玄铁石门紧闭！\n请先前往中央【星辰日冕祭坛】参悟三色棱镜对焦与九宫太阳图腾机关，轰开大门！');
        }
        return;
      }
    } else if (this.ancientTemple && distanceXZ(playerPos, [this.ancientTemple.altarWorldPos.x, 0, this.ancientTemple.altarWorldPos.z]) < 4.2) {
      // 在主岛后山神殿门前，点击或按E直接踏入独立地图 (传入 force=true 确保任何旧存档状态下均可瞬移进入)
      this.travelToIsland('ancient_temple', true);
      return;
    }

    // 5. 检查是否在露营帐篷旁准备过夜睡觉 (-16, 0, -8)
    const distToTent = distanceXZ(playerPos, ISLAND_LAYOUT.tent);
    if (distToTent < 4.0) {
      this.survival.sleepOvernight();
      this.ui.updateSurvivalHUD();
      soundEngine.playPlaceFurniture();
      if (this.campFacilities) {
        this.campFacilities.onDayPassed();
      }
      if (this.saveSystem) {
        this.saveSystem.saveGame('sleep_overnight');
      }
      return;
    }

    // 6. 检查是否在南岸沙滩 S.O.S 地标区域 (0, 0, 18)
    const distToSos = distanceXZ(playerPos, ISLAND_LAYOUT.sos);
    if (distToSos < 4.8) {
      if (!this.story.sosBuilt) {
        this.story.buildSosSign();
        this.sosGroup.visible = true;
        this.sosChalk.visible = false;
        soundEngine.playPlaceFurniture();
        return;
      } else {
        // 已建成：使用收音机架设天线搜索无线电频率
        if (this.ui.inventory['workradio'] > 0) {
          soundEngine.playAnimalVoice();
          if (this.nauticalChart) {
            this.nauticalChart.discoverIsland('timber_isle');
          }
          if (this.story && this.story.onRadioContact) {
            this.story.onRadioContact();
          }
          this.ui.showDialog('📡 无线电频段接收 · 邻岛求救呼号！', '滋……滋滋……无线电指示灯急促闪烁！\n\n扬声器中传来微弱急切的人声：“呼叫……这里是东北方漂流浮木岛……我们的双桅帆船触礁搁浅了……受困在沉船沙洲，淡水和干粮即将耗尽……有人能听到吗……”\n\n电波信号在您的海图上清晰标定出了【浮木岛 (Timber Isle)】的精确航向坐标！\n立即前往西南浅滩登上木筏，带足干粮与淡水展开出海营救！');
        } else {
          this.ui.showDialog('沙滩 S.O.S 呼救地标', '巨石地标已排布成型！\n空中机群与邻岛需要配合无线电频率定位，请在工作台用【损坏收音机 + 干电池】合成【工作收音机】后前来架设天线！');
        }
        return;
      }
    }

    // 7. 检查是否在西南浅滩造船船坞与出海码头区域
    const isNearDock = this.dockShipEntity ? this.dockShipEntity.isNearShipyard(playerPos, 5.2) : (distanceXZ(playerPos, ISLAND_LAYOUT.raft) < 5.0);
    if (isNearDock) {
      if (!this.story.raftBuilt) {
        if (this.ui.inventory['raft'] > 0 || this.ui.inventory['escape_raft'] > 0 || (this.ui.inventory['lumber'] >= 4 && this.ui.inventory['nail'] >= 2 && this.ui.inventory['ivy'] >= 2)) {
          this.story.buildRaft();
          if (this.dockShipEntity && this.dockShipEntity.vesselGroup) {
            this.dockShipEntity.vesselGroup.visible = true;
            this.dockShipEntity.updateModel(1);
          }
          this.raftGroup.visible = false;
          soundEngine.playCooking(); // 锻造造船声效
          this.ui.showDialog(
            '🎉 造船船坞大功告成 · 首艘出海木筏下水！',
            '经过细心打磨与藤蔓绑扎，第一艘【T1 简易捆扎原木筏】成功推入海浪！\n\n' +
            '现在您既可以扬帆出海探索邻近岛屿，也可以在码头造船台收集高阶材料将木筏升级为【T2 龙骨帆船】或【T3 铁甲探索舰】！'
          );
          if (this.nauticalChart) {
            this.nauticalChart.openChartModal();
          }
        } else {
          this.ui.showDialog('西南码头 · 远洋船坞', '⛵ 这里是平静适航的入海浅滩与船坞工程台！\n在合成台准备【4 根方木 + 2 枚铁钉 + 2 根藤蔓】合成首艘【求生大木筏】后，可在此下海扬帆远航与升级船体！');
        }
        return;
      } else {
        // 已建好大船：判定是靠近岸上船坞工程台还是靠近水上船只
        const distToSlipway = this.dockShipEntity ? distanceXZ(playerPos, [this.dockShipEntity.slipwayAnchor.x, 0, this.dockShipEntity.slipwayAnchor.z]) : 5.0;
        const distToShip = distanceXZ(playerPos, ISLAND_LAYOUT.raft);

        if (distToSlipway <= 3.4) {
          // 靠近岸边船坞工程台：打开船体修造与随船货仓
          if (this.shipUpgradeSystem) {
            this.shipUpgradeSystem.openShipyardModal();
          } else if (this.nauticalChart) {
            this.nauticalChart.openChartModal();
          }
        } else {
          // 靠近水面船只：展开群岛海图起航
          if (this.nauticalChart) {
            this.nauticalChart.openChartModal();
          } else if (this.shipUpgradeSystem) {
            this.shipUpgradeSystem.openShipyardModal();
          }
        }
        return;
      }
    }

    // 8. 优先检测附近是否有伙伴或村民可对话/互动
    const nearestVillager = this.villagers.getNearestVillager(playerPos, 3.5);
    if (nearestVillager) {
      // 8.1 机灵小猴 Bub 投喂与跟随
      if (nearestVillager.id === 'bub_monkey') {
        if (!this.story.monkeyBefriended) {
          const inv = this.ui.inventory;
          const foodKey = ['apple', 'baked_apple', 'baked_fish', 'fish', 'coconut'].find(k => (inv[k] || 0) > 0);
          if (foodKey) {
            inv[foodKey]--;
            this.ui.renderInventoryGrid();
            this.story.befriendMonkey();
            soundEngine.playPlaceFurniture();
          } else {
            this.ui.showDialog(nearestVillager.name, '🐒 吱吱！吱吱吱！（小猴子眼巴巴地摸着干瘪的小肚子，看着你直流口水……它渴望吃背包里的【苹果】或【烤鱼】呢！）');
          }
          return;
        } else {
          // 已收服后互动：打开小猴伙伴专属协同管理面板 (投喂恢复精力、查看技能、指挥状态)
          if (this.monkeyHelper) {
            this.ui.openMonkeyModal(this.monkeyHelper);
          } else {
            soundEngine.playPlaceFurniture();
            this.ui.addInventory('ivy', 1);
            this.ui.showDialog(nearestVillager.name, '🐒 吱吱！巴布敏捷地翻了个筋斗跳下树干，嘴里叼着一根珍稀坚韧的【藤蔓】塞进了你的背包！好能干的探险伙伴！');
          }
          return;
        }
      }

      // 8.2 第二幸存者艾莉 Ellie 救醒与好感增进
      if (nearestVillager.id === 'second_kid') {
        if (!this.story.secondKidAwake) {
          const inv = this.ui.inventory;
          const hasWater = this.survival.canteenCount > 0;
          const foodKey = ['baked_fish', 'baked_apple', 'apple'].find(k => (inv[k] || 0) > 0);

          if (hasWater || foodKey) {
            if (hasWater) this.survival.canteenCount = Math.max(0, this.survival.canteenCount - 1);
            else if (foodKey) inv[foodKey]--;

            this.story.secondKidAwake = true;
            this.story.secondKidAffection = 80;
            this.ui.renderInventoryGrid();
            this.ui.updateSurvivalHUD();
            soundEngine.playPlaceFurniture();
            this.ui.showDialog(nearestVillager.name, '✨ 你轻轻将温水与食物喂入少女干裂的唇齿中……\n少女长睫轻颤，缓缓睁开了清澈的双眸：“唔……是你救了我吗？我叫艾莉……谢谢你……在这个孤岛上能遇见你，真的太好了！”\n【💖 好感度提升至 80！】');
            this.story.advanceStep();
          } else {
            this.ui.showDialog(nearestVillager.name, '少女面色苍白，处于严重的饥渴与昏迷状态！\n请准备【水壶中的清水】或【烤鱼/烤苹果】靠近按【E】进行紧急喂食唤醒救治！');
          }
          return;
        } else {
          // 已苏醒：赠礼增加好感度
          const inv = this.ui.inventory;
          const giftKey = ['baked_fish', 'apple', 'baked_apple', 'cherry_blossom_petal', 'coconut'].find(k => (inv[k] || 0) > 0);
          if (giftKey) {
            inv[giftKey]--;
            this.ui.renderInventoryGrid();
            this.story.secondKidAffection = Math.min(250, this.story.secondKidAffection + 25);
            soundEngine.playPlaceFurniture();
            const currentJob = this.campFacilities ? this.campFacilities.getResidentJob('second_kid') : null;
            const jobStr = currentJob ? `\n（目前岗位：${currentJob.icon} ${currentJob.name}）` : '';
            this.ui.showDialog(nearestVillager.name, `🌸 艾莉接过你赠送的礼物，温柔地浅浅一笑：\n“有你一直在身边真好……今天的生产采集我已经认真去办啦！${jobStr}\n如果需要切换我的营地分工，可随时在右上角菜单【🏕️ 营地经营中枢】调整哦！”\n【💖 艾莉好感度升至 ${this.story.secondKidAffection} / 250！】`);
          } else {
            const currentJob = this.campFacilities ? this.campFacilities.getResidentJob('second_kid') : null;
            const jobStr = currentJob ? `\n【当前安排岗位：${currentJob.icon} ${currentJob.name} · 明早结算】` : '';
            const dialogList = (nearestVillager.currentDialogs && nearestVillager.currentDialogs.length > 0)
              ? nearestVillager.currentDialogs
              : nearestVillager.dialogs;
            const contextText = dialogList[nearestVillager.dialogIndex % dialogList.length];
            nearestVillager.dialogIndex++;
            this.ui.showDialog(nearestVillager.name, `${contextText}${jobStr}\n💡 提示：点击右上角菜单中的【🏕️ 营地经营中枢】可随时调整艾莉的工作岗位与生产任务！`);
          }
          return;
        }
      }

      // 普通村民日常闲聊 (结合当前昼夜时段与生活情境)
      const dialogList = (nearestVillager.currentDialogs && nearestVillager.currentDialogs.length > 0)
        ? nearestVillager.currentDialogs
        : nearestVillager.dialogs;
      const text = dialogList[nearestVillager.dialogIndex % dialogList.length];
      nearestVillager.dialogIndex++;
      this.ui.showDialog(nearestVillager.name, text);
      return;
    }

    // 9. 其次检测附近是否有树木可摇或使用石斧砍伐
    const nearestTree = this.trees.getNearestTree(playerPos, 3.2);
    if (nearestTree) {
      // 检查玩家行囊是否持有【锋利石斧 🪓】
      const hasAxe = (this.ui.inventory['stone_axe'] || 0) > 0;
      if (hasAxe) {
        const res = this.trees.chopTree(nearestTree);
        if (res && res.felled) {
          this.ui.showToast(`🪓 奋力砍倒了【${res.name}】！爆出重型建筑圆木 🪵 与木材方料！`);
        } else if (res) {
          this.ui.showToast(`🪓 挥舞石斧劈击【${res.name}】！(再砍 ${res.remainingHp} 斧将伐倒)`);
        }
        return;
      }
      // 若小猴已入队且精力充沛，指挥小猴攀爬采摘高处稀有黄金果与海鸟蛋
      if (this.monkeyHelper && this.monkeyHelper.isAvailable() && this.monkeyHelper.energy >= 10) {
        this.monkeyHelper.commandClimbTree(nearestTree);
        return;
      }
      this.trees.shakeTree(nearestTree);
      return;
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = Math.min(this.clock.getDelta(), 0.1);

    // 更新各个子系统
    this.terrain.update(delta);
    this.player.update(delta);

    // 动态更新阴影中心紧随玩家核心视野，实现次世代丝滑软阴影
    if (this.dayNight) {
      this.dayNight.update(delta, this.player.position);
    }

    // 键盘移动步数衰减结算与潮汐推进
    if (this.player.isMoving) {
      this.survival.recordMovement(0.08);
      if (this.campFacilities) {
        this.campFacilities.recordMovement(0.08);
      }
      if (this.tidalTrap) {
        this.tidalTrap.advanceTide(1);
      }
      if (this.trees && this.trees.recordMovement) {
        this.trees.recordMovement(1);
      }
      if (this.beachResources && this.beachResources.recordMovement) {
        this.beachResources.recordMovement(1);
      }
      if (this.miningRig && this.miningRig.recordMovement) {
        this.miningRig.recordMovement(1);
      }
      this.ui.updateSurvivalHUD();
    }

    // 更新伙伴与村民 (注入 story 驱动猴子跟随与第二幸存者状态)
    this.villagers.update(delta, this.player.position, this.story);
    this.trees.update(delta, this.player.position, (itemType) => {
      this.ui.addInventory(itemType);
      if (this.story && this.story.onGatherResource) {
        this.story.onGatherResource(itemType);
      }
    });

    // 更新全岛林间落叶漂流与黄昏夜幕萤火虫微光
    if (this.ambientParticles && this.currentIslandId === 'main_island') {
      this.ambientParticles.update(delta, this.player.position);
    }

    // 更新海滩散落资源光圈脉动与物理状态
    if (this.beachResources) {
      this.beachResources.update(delta);
    }

    // 实时更新 Survival Kids 剧情任务进度状态机
    if (this.story) {
      this.story.update(this.player.position, this.ui.inventory, this.survival);
    }

    // 远古宝石自转与漂浮动画
    if (this.gemMeshes) {
      const time = Date.now() * 0.002;
      for (const gemItem of this.gemMeshes) {
        if (!gemItem.info.picked) {
          gemItem.mesh.rotation.y += delta * 1.8;
          gemItem.mesh.rotation.x = Math.sin(time) * 0.2;
          gemItem.mesh.position.y = Math.sin(time * 2.0) * 0.12;
        }
      }
    }

    // 更新钓鱼系统物理与时间
    this.fishing.update(delta);

    // 更新海面漂流物浮动动力学
    if (this.flotsamSalvage) {
      this.flotsamSalvage.update(delta);
    }

    // 更新浮木岛与矿石岛生态动画
    if (this.timberIsleScene) {
      this.timberIsleScene.update(delta);
    }
    if (this.quarryIsleScene) {
      this.quarryIsleScene.update(delta);
    }
    if (this.ancientTempleScene) {
      this.ancientTempleScene.update(delta);
    }

    // 更新营地 3D 场景交互实体微动画 (告示板小油灯、无线电呼吸灯、水滴滴落)
    if (this.campEntities) {
      this.campEntities.update(delta);
    }

    // 更新西南码头 3D 船坞工程台徽章旋转与船体海水波浪浮动摇曳
    if (this.dockShipEntity) {
      this.dockShipEntity.update(delta);
    }

    // 更新荒岛野生生物与战斗打击系统 (巨蟹/野猪巡逻与追逐、攻击判定、战利品)
    if (this.wildlifeCombat) {
      this.wildlifeCombat.update(delta);
      if (this.player && this.ui) {
        const hasSpear = (this.ui.inventory['spear'] || 0) > 0;
        this.player.hasSpearEquipped = hasSpear;
        if (!this.player.isAttacking && this.player.weaponGroup) {
          this.player.weaponGroup.visible = hasSpear;
        }
      }
    }

    // 篝火火焰动态跳动
    if (this.flameMesh && this.campfireLight) {
      const flicker = 1.0 + Math.sin(Date.now() * 0.015) * 0.2 + (Math.random() - 0.5) * 0.15;
      this.flameMesh.scale.set(flicker, 1.0 + flicker * 0.3, flicker);
      this.campfireLight.intensity = 2.0 + flicker * 0.8;
    }

    // 更新小猴专属协同技能与潮汐捕蟹/营地熏架
    if (this.monkeyHelper) {
      this.monkeyHelper.update(delta);
    }
    if (this.tidalTrap) {
      this.tidalTrap.update(delta);
    }
    if (this.miningRig) {
      this.miningRig.update(delta);
    }
    if (this.petCompanion) {
      this.petCompanion.update(delta);
    }
    if (this.weatherSystem) {
      this.weatherSystem.update(delta);
    }
    if (this.ancientTemple) {
      this.ancientTemple.update(delta);
    }
    if (this.ancientTempleScene) {
      this.ancientTempleScene.update(delta);
    }

    // 动态智能情境感知与 UI 气泡提示
    const playerPos = this.player.position;

    // === 0. 浮木岛专属感知提示 ===
    if (this.currentIslandId === 'timber_isle') {
      const isReturnRaft = playerPos.distanceTo(new THREE.Vector3(0, 0.05, 13.5)) < 3.8;
      const isSurvivor = playerPos.distanceTo(new THREE.Vector3(-5.5, 0.5, -2.2)) < 3.2;
      const isOutpost = playerPos.distanceTo(new THREE.Vector3(3.5, 0.35, 1.5)) < 3.0;
      const nearTiRes = this.timberIsleScene ? this.timberIsleScene.islandResources.find(r => !r.collected && playerPos.distanceTo(r.group.position) < 2.0) : null;

      if (isReturnRaft) {
        this.ui.setContextAction('raft');
        this.ui.showInteraction('按 [E] 扬帆返航 · 返回主岛大本营');
      } else if (isSurvivor) {
        this.ui.setContextAction('partner');
        this.ui.showInteraction(this.timberIsleScene.survivorRescued ? '按 [E] 与探险学者雷蒙德对话' : '按 [E] 喂水/喂食紧急救援受困学者雷蒙德！');
      } else if (isOutpost) {
        this.ui.setContextAction('default');
        this.ui.showInteraction(this.timberIsleScene.outpostClaimed ? '🚩 【浮木前哨站】已建成并每日运送浮木' : '按 [E] 消耗木板x2+铁钉x1 插旗建立海外前哨');
      } else if (nearTiRes) {
        this.ui.setContextAction('pickup');
        this.ui.showInteraction(`按 [E] 拾取特产资源：【${nearTiRes.name}】`);
      } else {
        this.ui.setContextAction('default');
        this.ui.hideInteraction();
      }

      if (this.interactionFeedback) {
        this.interactionFeedback.update(delta);
      }
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // === 0.5 海蚀矿石岛专属感知提示 ===
    if (this.currentIslandId === 'quarry_isle') {
      const isReturnRaft = playerPos.distanceTo(new THREE.Vector3(0, 0.05, 14.0)) < 3.8;
      const isMonolith = playerPos.distanceTo(new THREE.Vector3(-1.5, 0.9, -6.5)) < 3.0;
      const isOutpost = playerPos.distanceTo(new THREE.Vector3(4.0, 0.9, -5.0)) < 3.0;
      const nearQiRes = this.quarryIsleScene ? this.quarryIsleScene.islandResources.find(r => !r.collected && playerPos.distanceTo(r.group.position) < 2.2) : null;

      if (isReturnRaft) {
        this.ui.setContextAction('raft');
        this.ui.showInteraction('按 [E] 扬帆返航 · 返回主岛大本营');
      } else if (isMonolith) {
        this.ui.setContextAction('default');
        this.ui.showInteraction('按 [E] 参悟【古代水手冶炼石碑】· 领悟熔炉知识');
      } else if (isOutpost) {
        this.ui.setContextAction('default');
        this.ui.showInteraction(this.quarryIsleScene.outpostClaimed ? '🚩 【矿石前哨站】已建立并每日回运铁矿' : '按 [E] 消耗木板x2+玄武石x2+铁钉x1 插旗建立矿业前哨');
      } else if (nearQiRes) {
        if (nearQiRes.isVein) {
          const hasPick = (this.ui.inventory['stone_pickaxe'] || 0) > 0 || (this.ui.inventory['iron_pickaxe'] || 0) > 0;
          this.ui.setContextAction('mine');
          this.ui.showInteraction(hasPick ? `按 [E] 挥镐开采：【${nearQiRes.name}】` : `⚠️ 靠近【${nearQiRes.name}】· 需装备【采矿石镐】方可凿取`);
        } else {
          this.ui.setContextAction('pickup');
          this.ui.showInteraction(`按 [E] 拾取地表原石：【${nearQiRes.name}】`);
        }
      } else {
        this.ui.setContextAction('default');
        this.ui.hideInteraction();
      }

      if (this.interactionFeedback) {
        this.interactionFeedback.update(delta);
      }
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const isWater = this.fishing.isNearWater(playerPos);
    const isFire = this.cooking.isNearCampfire(playerPos);
    const isTent = distanceXZ(playerPos, ISLAND_LAYOUT.tent) < 4.0;
    const isSos = distanceXZ(playerPos, ISLAND_LAYOUT.sos) < 4.8;
    const isRaft = distanceXZ(playerPos, ISLAND_LAYOUT.raft) < 5.0;
    const nearestVillager = this.villagers.getNearestVillager(playerPos, 3.5);
    const nearestTree = this.trees.getNearestTree(playerPos, 3.2);

    // 检查宝石
    const nearGem = this.gemMeshes?.find(g => !g.info.picked && g.group.position.distanceTo(playerPos) < 2.5);
    const nearestBeachRes = this.beachResources?.getNearest(playerPos, 2.2);
    const nearestFlotsam = this.flotsamSalvage?.getNearest(playerPos, 2.4);
    const isFreshwater = this.beachResources?.isNearFreshwater(playerPos);
    const nearestFacility = this.buildSystem?.getNearestInteractable(playerPos, 2.6);

    // 战斗战利品与野兽交战态势检测
    const nearLoot = this.wildlifeCombat?.lootDrops.find(d => !d.picked && distanceXZ(playerPos, [d.group.position.x, d.group.position.y, d.group.position.z]) < 2.5);
    const nearTyphoonLoot = this.weatherSystem?.typhoonWashedItems.find(i => !i.picked && i.pos.distanceTo(playerPos) < 2.5);
    const nearAggroMob = this.wildlifeCombat?.wildlifeList.find(m => !m.isDead && distanceXZ(playerPos, [m.group.position.x, m.group.position.y, m.group.position.z]) < 5.0);

    // 营地原生 3D 实体近距检测
    const isCampfire = distanceXZ(playerPos, ISLAND_LAYOUT.campfire) < 3.2;
    const isCampChest = Math.hypot(playerPos.x - (-14.5), playerPos.z - 23.5) < 2.5;
    const isNoticeboard = this.campEntities ? playerPos.distanceTo(this.campEntities.anchors.noticeboard) < 2.5 : false;
    const isRadioTerminal = this.campEntities ? playerPos.distanceTo(this.campEntities.anchors.radioTerminal) < 2.5 : false;
    const isNativePurifier = this.campEntities ? playerPos.distanceTo(this.campEntities.anchors.waterPurifier) < 2.5 : false;
    const isBuoyWinch = this.campEntities ? playerPos.distanceTo(this.campEntities.anchors.buoyWinch) < 2.8 : false;
    const isCrabTrap = this.tidalTrap && playerPos.distanceTo(this.tidalTrap.crabTrapAnchor) < 3.0;
    const isSmoker = this.tidalTrap && playerPos.distanceTo(this.tidalTrap.smokerAnchor) < 2.8;
    const isMiningRig = this.miningRig && playerPos.distanceTo(this.miningRig.anchor) < 2.8;
    const isPetNest = this.petCompanion && playerPos.distanceTo(this.petCompanion.nestAnchor) < 2.8;
    const monkeyCreviceAction = this.monkeyHelper ? this.monkeyHelper.getAvailableAction(playerPos) : null;
    const isNearDockSlipway = this.dockShipEntity ? distanceXZ(playerPos, [this.dockShipEntity.slipwayAnchor.x, 0, this.dockShipEntity.slipwayAnchor.z]) < 3.6 : false;
    const isNearVessel = distanceXZ(playerPos, ISLAND_LAYOUT.raft) < 5.0;
    const isTempleAltar = this.ancientTemple && distanceXZ(playerPos, [this.ancientTemple.altarWorldPos.x, 0, this.ancientTemple.altarWorldPos.z]) < 3.8;

    // 若当前处于古代神殿独立地宫室内地图
    if (this.currentIslandId === 'ancient_temple') {
      const distToPortal = distanceXZ(playerPos, [0, 0, 15]);
      const distToAltar = distanceXZ(playerPos, [0, 0, 2]);
      const distToVault = distanceXZ(playerPos, [0, 0, -22]);

      if (distToPortal < 3.2) {
        this.ui.setContextAction('temple_portal');
        this.ui.showInteraction('按 [E] 穿越青蓝光阵返回【海岛主地图】');
      } else if (distToAltar < 3.8) {
        this.ui.setContextAction('temple_altar');
        const stageName = this.templePuzzle ? (this.templePuzzle.stage === 0 ? '第一重·星辰光棱镜对焦' : this.templePuzzle.stage === 1 ? '第二重·太阳图腾矩阵翻转' : '第三重·深渊密室黄金宝藏') : '密室机关';
        this.ui.showInteraction(`按 [E] 参悟【星辰日冕】机关解谜（${stageName}）`);
      } else if (distToVault < 3.8) {
        this.ui.setContextAction('temple_vault');
        if (this.ancientTempleScene && this.ancientTempleScene.isInnerGateOpen) {
          const isClaimed = this.templePuzzle && this.templePuzzle.vaultClaimed;
          this.ui.showInteraction(isClaimed ? '👑 远古波塞冬金冠已收取（永久护佑中）' : '按 [E] 开启【远古波塞冬黄金神藏】！');
        } else {
          this.ui.showInteraction('🔒 前方玄铁大门紧闭，请先参悟前殿日冕机关');
        }
      } else {
        this.ui.setContextAction('default');
        this.ui.showInteraction('🏛️ 漫步在古老神秘的地下神殿……');
      }

      if (this.interactionFeedback) {
        this.interactionFeedback.update(delta);
      }
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (nearTyphoonLoot) {
      this.ui.setContextAction('pickup');
      this.ui.showInteraction(`按 [E] 抢救打捞台风巨浪冲刷物：【${nearTyphoonLoot.name}】`);
    } else if (nearLoot) {
      this.ui.setContextAction('pickup');
      this.ui.showInteraction(`按 [E] 拾取战利品包裹：【${nearLoot.mobName} 遗落】`);
    } else if (nearAggroMob) {
      this.ui.setContextAction('default');
      this.ui.showInteraction(`⚔️ 警惕【${nearAggroMob.name}】！按 [F] 或右下角 [⚔️] 发动挥刺突击！`);
    } else if (nearGem) {
      this.ui.setContextAction('gem');
      this.ui.showInteraction(`按 [E] 拾取神秘秘宝：【${nearGem.info.name}】`);
    } else if (isTempleAltar) {
      this.ui.setContextAction('temple_enter');
      this.ui.showInteraction('按 [E] 踏入【后山古代神殿】独立地宫密室');
    } else if (monkeyCreviceAction && monkeyCreviceAction.type === 'crevice') {
      this.ui.setContextAction('monkey_crevice');
      this.ui.showInteraction(`按 [E] 指派小猴钻入【${monkeyCreviceAction.target.name}】探宝 (精力-15)`);
    } else if (isCrabTrap) {
      this.ui.setContextAction('crab_trap');
      const trapTotal = this.tidalTrap.getTotalCatches();
      this.ui.showInteraction(`按 [E] 检视【南岸浅滩潮汐捕蟹笼】(当前渔获: ${trapTotal} 件)`);
    } else if (isSmoker) {
      this.ui.setContextAction('smoker_rack');
      this.ui.showInteraction(this.tidalTrap.isSmoking ? '按 [E] 查阅【营地熏烤风干架】(慢火熏制中...)' : '按 [E] 使用【营地熏烤风干架】制作防腐军粮');
    } else if (isMiningRig) {
      this.ui.setContextAction('mining_rig');
      const hasUnclaimed = this.miningRig.unclaimedSol > 0;
      this.ui.showInteraction(hasUnclaimed ? `按 [E] 操作【绿色解密矿机】(🪙 有 ${this.miningRig.unclaimedSol} 枚 $SOL 待收取!)` : `按 [E] 操作【绿色解密矿机】(${this.miningRig.isActive ? '⚡正在高速哈希解密中' : '💤待装填硅晶原石'})`);
    } else if (isPetNest) {
      this.ui.setContextAction('pet_nest');
      const activePet = this.petCompanion ? this.petCompanion.getActivePet() : null;
      this.ui.showInteraction(`按 [E] 打开【营地随行异兽暖巢】(当前出战: ${activePet ? activePet.name : '巴布'})`);
    } else if (isCampChest) {
      this.ui.setContextAction('storage');
      this.ui.showInteraction('按 [E] 打开营地储物木箱存取材料');
    } else if (isNoticeboard) {
      this.ui.setContextAction('camp_manage');
      const curJob = this.campFacilities ? this.campFacilities.getResidentJob('second_kid') : null;
      this.ui.showInteraction(`按 [E] 查阅【营地经营告示板】· 幸存者排班 (当前: ${curJob ? curJob.name : '在岗'})`);
    } else if (isRadioTerminal) {
      this.ui.setContextAction('shop');
      this.ui.showInteraction('按 [E] 接入【救援无线电站】· 呼叫空投与特权');
    } else if (isNativePurifier) {
      this.ui.setContextAction('water');
      const wLvl = this.campFacilities ? this.campFacilities.purifierWaterLevel : 0;
      this.ui.showInteraction(`按 [E] 从【净水滴滤台】畅饮/添柴蒸馏 (蓄水: ${wLvl}/6 份)`);
    } else if (isCampfire) {
      this.ui.setContextAction('campfire');
      const hasShelter = this.weatherSystem && this.weatherSystem.hasFireShelter;
      const curTemp = this.weatherSystem ? this.weatherSystem.bodyTemp.toFixed(1) : '37.0';
      const shelterHint = hasShelter ? '⛺ 避雨石棚庇护中' : '可造避雨石棚';
      this.ui.showInteraction(`按 [E] 靠近【营地篝火】烘烤取暖 / ${shelterHint} (当前体温: ${curTemp}°C)`);
    } else if (isBuoyWinch) {
      this.ui.setContextAction('default');
      const hasBuoy = this.flotsamSalvage && this.flotsamSalvage.hasAutoSalvageBuoy;
      this.ui.showInteraction(hasBuoy ? '按 [E] 检视【近海自动打捞浮标网】(运转中)' : '按 [E] 在南岸部署【近海自动打捞浮标网】');
    } else if (nearestFacility) {
      if (nearestFacility.isStorage) {
        this.ui.setContextAction('storage');
        this.ui.showInteraction('按 [E] 打开营地储物木箱存取物资');
      } else if (nearestFacility.isWaterPurifier) {
        this.ui.setContextAction('water');
        const waterLvl = this.campFacilities ? this.campFacilities.purifierWaterLevel : 0;
        this.ui.showInteraction(`按 [E] 从净水滴滤台取水 (蓄水: ${waterLvl} 份)`);
      } else if (nearestFacility.isBed) {
        this.ui.setContextAction('sleep');
        this.ui.showInteraction('按 [E] 在原木单人床上安稳休息过夜');
      }
    } else if (nearestBeachRes) {
      if (nearestBeachRes.isMineable) {
        this.ui.setContextAction('mine');
        const hasHammer = (this.ui.inventory['stone_hammer'] || 0) > 0;
        const hasPick = (this.ui.inventory['stone_pickaxe'] || 0) > 0 || (this.ui.inventory['iron_pickaxe'] || 0) > 0;
        if (hasPick) {
          const veinType = nearestBeachRes.type === 'sol_vein' ? '高能硅晶矿脉' : '富铁矿脉';
          this.ui.showInteraction(`按 [E] 挥镐开采【${nearestBeachRes.name}】(${veinType}，耐久余${nearestBeachRes.hp})`);
        } else if (hasHammer) {
          this.ui.showInteraction(`按 [E] 挥锤碎石【${nearestBeachRes.name}】(耐久余${nearestBeachRes.hp})`);
        } else {
          this.ui.showInteraction(`🪨 发现【${nearestBeachRes.name}】(需手持石锤或石镐方可敲凿开采)`);
        }
      } else {
        this.ui.setContextAction('pickup');
        this.ui.showInteraction(`按 [E] 拾取散落物资：【${nearestBeachRes.name}】`);
      }
    } else if (nearestFlotsam) {
      this.ui.setContextAction('pickup');
      this.ui.showInteraction(`按 [E] 打捞海面物资：【${nearestFlotsam.spec.name}】`);
    } else if (isFreshwater) {
      this.ui.setContextAction('water');
      this.ui.showInteraction('按 [E] 饮用甘甜溪水并装满水壶');
    } else if (this.fishing.state === 'bite') {
      this.ui.setContextAction('fishing');
      this.ui.showInteraction('❗ 鱼儿咬钩了！点击 [🎣起竿]！');
    } else if (this.fishing.state === 'waiting') {
      this.ui.setContextAction('fishing');
      this.ui.showInteraction('🎣 浮标静置水中……等待大鱼咬钩');
    } else if (isSos) {
      this.ui.setContextAction('sos');
      this.ui.showInteraction(this.story.sosBuilt ? '按 [E] 架设收音机天线搜索无线电求救信号' : '按 [E] 搭建南岸沙滩巨型 S.O.S 地标');
    } else if (isNearDockSlipway) {
      this.ui.setContextAction('shipyard');
      const curTier = this.shipUpgradeSystem ? this.shipUpgradeSystem.getCurrentTier() : null;
      this.ui.showInteraction(this.story.raftBuilt ? `按 [E] 打开【西南船坞工程台】· 船体升级与随船货仓 (${curTier ? curTier.title : 'T1'})` : '按 [E] 在船坞滑道拼装【首艘求生大木筏】');
    } else if (isNearVessel) {
      this.ui.setContextAction('raft');
      const curTier = this.shipUpgradeSystem ? this.shipUpgradeSystem.getCurrentTier() : null;
      this.ui.showInteraction(this.story.raftBuilt ? `按 [E] 登上【${curTier ? curTier.name : '出海座驾'}】· 展开群岛海图扬帆起航` : '按 [E] 在入海浅滩下水组装【求生大木筏】');
    } else if (nearestVillager) {
      if (nearestVillager.id === 'bub_monkey') {
        if (this.story.monkeyBefriended) {
          this.ui.setContextAction('monkey_helper');
          const energy = this.monkeyHelper ? this.monkeyHelper.energy : 80;
          const aff = this.monkeyHelper ? this.monkeyHelper.affinity : 60;
          this.ui.showInteraction(`按 [E] 打开【小猴伙伴协同面板】(精力: ${energy}/100 亲密: ${aff})`);
        } else {
          this.ui.setContextAction('monkey');
          this.ui.showInteraction('按 [E] 投喂美味果实收服小猴巴布！');
        }
      } else if (nearestVillager.id === 'second_kid') {
        this.ui.setContextAction('partner');
        this.ui.showInteraction(this.story.secondKidAwake ? `按 [E] 与艾莉交谈/送礼 (好感: ${this.story.secondKidAffection})` : '按 [E] 紧急喂水/喂食唤醒昏迷同伴！');
      } else {
        this.ui.setContextAction('villager');
        this.ui.showInteraction(`按 [E] 或点击 [💬对话] 与 ${nearestVillager.name.split(' ')[0]} 聊天`);
      }
    } else if (isWater) {
      this.ui.setContextAction('fishing');
      this.ui.showInteraction('按 [E] 或点击 [🎣钓鱼] 抛竿垂钓');
    } else if (isFire) {
      this.ui.setContextAction('cooking');
      this.ui.showInteraction('按 [E] 或点击 [🔥烹饪] 烤鱼/烤苹果');
    } else if (isTent) {
      this.ui.setContextAction('sleep');
      this.ui.showInteraction('按 [E] 或点击 [🛏️睡觉] 消除疲劳过夜');
    } else if (nearestTree && !nearestTree.isFelled) {
      const hasAxe = (this.ui.inventory['stone_axe'] || 0) > 0;
      if (hasAxe) {
        this.ui.setContextAction('tree');
        this.ui.showInteraction(`按 [E] 挥舞锋利石斧砍伐【${nearestTree.name}】获取重型圆木 (余${nearestTree.chopHp || 3}斧)`);
      } else if (this.monkeyHelper && this.monkeyHelper.isAvailable() && this.monkeyHelper.energy >= 10) {
        this.ui.setContextAction('monkey_helper');
        this.ui.showInteraction(`按 [E] 指挥小猴攀爬【${nearestTree.name}】采摘稀有果实 (精力-10)`);
      } else {
        this.ui.setContextAction('tree');
        this.ui.showInteraction(`按 [E] 或点击 [🌲摇树] 摇晃 ${nearestTree.name}`);
      }
    } else {
      this.ui.setContextAction('default');
      this.ui.hideInteraction();
    }

    // 更新可交互感知系统 (3D 地面柔光指示环 + HUD 动态情境胶囊)
    if (this.interactionFeedback) {
      this.interactionFeedback.update(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
