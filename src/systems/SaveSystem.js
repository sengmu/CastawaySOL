import { economyLedger } from './EconomyLedger.js';
// CastawaySOL - 版本化安全存档系统 (Save & Schema Migration System)
// 统一管理玩家状态、生存指标、行囊物品、主线剧情、地图资源与建筑家具
// 支持版本迁移 (Schema Migration)、备份恢复与写保护 (失败不覆盖旧数据)

export const CHECKIN_REWARD = 5;
export const CURRENT_SCHEMA_VERSION = 2;
export const SAVE_KEY_PRIMARY = 'castaway_sol_savegame';
export const SAVE_KEY_BACKUP = 'castaway_sol_savegame_backup';

export class SaveSystem {
  constructor(game) {
    this.game = game;
    this.saveSeed = this.generateSaveSeed();
    this.checkinClaimDays = [];
    this.isSaving = false;
    this.lastSavedTimestamp = null;
    this.autoSaveInterval = null;

    // 监听窗口卸载自动保存
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.saveGame('unload');
      });
    }
  }

  generateSaveSeed() {
    const words = new Uint32Array(4);
    if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
      globalThis.crypto.getRandomValues(words);
    } else {
      for (let i = 0; i < 4; i++) {
        words[i] = (Math.random() * 0x100000000) >>> 0;
      }
    }
    return Array.from(words, n => n.toString(16).padStart(8, '0')).join('');
  }

  hasClaimedCheckin(day) { return this.checkinClaimDays.includes(day); }

  claimDailyCheckin(day) {
    if (this.hasClaimedCheckin(day)) return false;
    const inv = this.game.ui.inventory;
    const previous = inv.sol_token || 0;
    const ledgerBefore = economyLedger(this.game).serialize();
    this.checkinClaimDays.push(day);
    economyLedger(this.game).credit('sol_token', CHECKIN_REWARD, 'checkin');
    const saved = this.saveGame('daily_checkin');
    if (!saved?.success) { this.checkinClaimDays.pop(); inv.sol_token = previous; economyLedger(this.game).deserialize(ledgerBefore); return false; }
    this.game.ui.renderInventory?.();
    return true;
  }

  // 启动自动保存定时器 (默认每 60 秒)
  startAutoSave(intervalMs = 60000) {
    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
    this.autoSaveInterval = setInterval(() => {
      this.saveGame('autosave');
    }, intervalMs);
  }

  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  // 组装当前游戏全局快照数据
  createSnapshot() {
    if (!this.game) return null;

    const player = this.game.player;
    const survival = this.game.survival;
    const ui = this.game.ui;
    const story = this.game.story;
    const beach = this.game.beachResources;
    const flotsam = this.game.flotsamSalvage;
    const build = this.game.buildSystem;

    // 提取宝石拾取状态
    const collectedGems = [];
    if (this.game.gemObjects) {
      this.game.gemObjects.forEach(gem => {
        if (gem.picked) collectedGems.push(gem.id);
      });
    }

    // 提取家具数据
    let furnitureData = [];
    if (build && Array.isArray(build.placedFurniture)) {
      furnitureData = build.placedFurniture.map(f => ({
        id: f.id,
        path: f.path,
        scale: f.scale,
        pos: f.pos,
        rot: f.rot
      }));
    }

    const snapshot = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      saveSeed: this.saveSeed,
      checkinClaimDays: [...this.checkinClaimDays],
      economyLedger: economyLedger(this.game).serialize(),
      timestamp: Date.now(),
      player: player ? {
        position: [player.position.x, player.position.y, player.position.z],
        rotation: player.rotation || 0
      } : { position: [0, 0, 5], rotation: 0 },
      survival: survival ? {
        life: survival.life,
        hunger: survival.hunger,
        water: survival.water,
        fatigue: survival.fatigue,
        day: survival.day,
        steps: survival.steps,
        canteenSips: survival.canteenSips,
        isDead: survival.isDead
      } : null,
      inventory: ui && ui.inventory ? { ...ui.inventory } : {},
      bonusInventorySlots: ui && typeof ui.bonusInventorySlots === 'number' ? ui.bonusInventorySlots : 0,
      storage: this.game.storageSystem && this.game.storageSystem.serialize ? this.game.storageSystem.serialize() : null,
      campFacilities: this.game.campFacilities && this.game.campFacilities.serialize ? this.game.campFacilities.serialize() : null,
      nauticalChart: this.game.nauticalChart && this.game.nauticalChart.serialize ? this.game.nauticalChart.serialize() : null,
      vesselUpgrade: this.game.shipUpgradeSystem && this.game.shipUpgradeSystem.serialize ? this.game.shipUpgradeSystem.serialize() : null,
      monkeyHelper: this.game.monkeyHelper && this.game.monkeyHelper.serialize ? this.game.monkeyHelper.serialize() : null,
      tidalTrap: this.game.tidalTrap && this.game.tidalTrap.serialize ? this.game.tidalTrap.serialize() : null,
      petCompanion: this.game.petCompanion && this.game.petCompanion.serialize ? this.game.petCompanion.serialize() : null,
      weather: this.game.weatherSystem && this.game.weatherSystem.serialize ? this.game.weatherSystem.serialize() : null,
      templePuzzle: this.game.templePuzzle && this.game.templePuzzle.serialize ? this.game.templePuzzle.serialize() : null,
      ancientTempleScene: this.game.ancientTempleScene && this.game.ancientTempleScene.serialize ? this.game.ancientTempleScene.serialize() : null,
      timberIsle: this.game.timberIsleScene && this.game.timberIsleScene.serialize ? this.game.timberIsleScene.serialize() : null,
      raymondSettled: Boolean(this.game.raymondSettled),
      currentIslandId: this.game.currentIslandId || 'main_island',
      story: story && story.serialize ? story.serialize() : null,
      miningRig: this.game.miningRig && this.game.miningRig.serialize ? this.game.miningRig.serialize() : null,
      quarryIsle: this.game.quarryIsleScene && this.game.quarryIsleScene.serialize ? this.game.quarryIsleScene.serialize() : null,
      flotsamSalvage: flotsam && flotsam.serialize ? flotsam.serialize() : null,
      world: {
        collectedBeachResources: beach && beach.serialize ? beach.serialize().collectedIds : [],
        collectedFlotsam: flotsam && flotsam.serialize ? flotsam.serialize().collectedIds : [],
        collectedGems: collectedGems,
        sosBuilt: story ? story.sosBuilt : false,
        raftBuilt: story ? story.raftBuilt : false
      },
      furniture: furnitureData
    };

    return snapshot;
  }

  // 严格验证存档数据结构的完整性 (防止损坏数据覆盖正常存档，拦截 NaN 与负数值)
  validateSaveData(data) {
    if (!data || typeof data !== 'object') return false;
    if (typeof data.schemaVersion !== 'number') return false;
    if (!data.player || !Array.isArray(data.player.position) || data.player.position.length !== 3) return false;

    // 检查玩家坐标与生存数值有效性
    for (const val of data.player.position) {
      if (typeof val !== 'number' || Number.isNaN(val)) return false;
    }

    if (!data.survival || typeof data.survival !== 'object') return false;
    const { life, hunger, water, fatigue, day, steps } = data.survival;
    const survivalFields = [life, hunger, water, fatigue, day, steps];
    for (const num of survivalFields) {
      if (num !== undefined) {
        if (typeof num !== 'number' || Number.isNaN(num) || num < 0) return false;
      }
    }
    if (typeof life !== 'number' || Number.isNaN(life) || life < 0) return false;

    // 检查背包与剧情
    if (!data.inventory || typeof data.inventory !== 'object') return false;
    for (const itemKey of Object.keys(data.inventory)) {
      const count = data.inventory[itemKey];
      if (typeof count !== 'number' || Number.isNaN(count) || count < 0) return false;
    }

    if (!data.story || typeof data.story.currentChapterId !== 'number' || Number.isNaN(data.story.currentChapterId) || data.story.currentChapterId < 0) {
      return false;
    }

    // 检查矿机与共振数值 (若存在，拦截 NaN 与负数)
    if (data.miningRig && typeof data.miningRig === 'object') {
      const { loadedCrystals, unclaimedSol, totalBlocksMined, totalSolMined } = data.miningRig;
      for (const val of [loadedCrystals, unclaimedSol, totalBlocksMined, totalSolMined]) {
        if (val !== undefined && (typeof val !== 'number' || Number.isNaN(val) || val < 0)) return false;
      }
    }

    // Validate both legacy inputs and the authoritative nested state during migration.
    for (const state of [data, data.miningRig || {}]) {
      for (const key of ['loadedPureCrystals', 'shardCount', 'solDust', 'scannerLevel', 'rigLevel']) {
        if (state[key] !== undefined) {
          if (typeof state[key] !== 'number' || Number.isNaN(state[key]) || state[key] < 0) return false;
        }
      }

      if (state.resonance && typeof state.resonance === 'object') {
        for (const rk of ['roundId', 'progress', 'revealTimer', 'calib', 'freeShares']) {
          const val = state.resonance[rk];
          if (val !== undefined && (typeof val !== 'number' || Number.isNaN(val) || val < 0)) return false;
        }
      }

      if (state.motherlode && typeof state.motherlode === 'object') {
        for (const mk of ['pool', 'injected', 'paid', 'burned']) {
          const val = state.motherlode[mk];
          if (val !== undefined && (typeof val !== 'number' || Number.isNaN(val) || val < 0)) return false;
        }
      }
    }
    return true;
  }

  // 线性版本迁移管道 (Schema Migration Pipeline)
  migrate(rawData) {
    if (!rawData || typeof rawData !== 'object') return null;

    let data = { ...rawData };
    let version = data.schemaVersion || 0;

    // v0 (无版本号旧存档) -> v1
    if (version < 1) {
      data = this.migrateV0ToV1(data);
      version = 1;
    }

    // v1 -> v2 (接入 miningRig, quarryIsle, 全量 flotsam 与共振完整默认字段)
    if (version < 2) {
      data = this.migrateV1ToV2(data);
      version = 2;
    }

    data.schemaVersion = CURRENT_SCHEMA_VERSION;
    data.saveSeed ||= this.generateSaveSeed();
    data.economyLedger ??= { days: [] };
    data.checkinClaimDays = Array.isArray(data.checkinClaimDays) ? [...data.checkinClaimDays] : [];
    data.miningRig = this.mergeRigState(data);
    for (const key of this.rigStateKeys()) delete data[key];
    return data;
  }

  rigStateKeys() { return ['rigMode', 'rigLevel', 'loadedPureCrystals', 'shardCount', 'solDust', 'scannerLevel', 'resonance', 'motherlode', 'season']; }

  mergeRigState(data) {
    const rig = { ...(data.miningRig || {}) };
    const defaults = { rigMode: 'decrypt', rigLevel: 1, loadedPureCrystals: 0, shardCount: 0, solDust: 0, scannerLevel: 0 };
    for (const key of this.rigStateKeys()) {
      if (['resonance', 'motherlode', 'season'].includes(key)) {
        if (data[key] || rig[key]) rig[key] = { ...(data[key] || {}), ...(rig[key] || {}) };
      } else rig[key] = rig[key] ?? data[key] ?? defaults[key];
    }
    if (rig.resonance?.phase === 'idle') rig.resonance.phase = 'OPEN';
    return rig;
  }

  // v1 -> v2 迁移管道：补充 miningRig、quarryIsle、flotsamSalvage 与完整共振协议默认字段 (design §7)
  migrateV1ToV2(v1Data) {
    const data = { ...v1Data };
    data.schemaVersion = 2;

    // 1. 默认 miningRig 状态恢复或兜底
    if (!data.miningRig) {
      data.miningRig = {
        loadedCrystals: 1,
        unclaimedSol: 0,
        totalBlocksMined: 0,
        totalSolMined: 0,
        batteryPower: 75,
        hashProgress: 0,
        isOverclocked: false,
        hasLithiumPack: false
      };
    }

    // 2. 默认 quarryIsle 状态
    if (!data.quarryIsle) {
      data.quarryIsle = {
        outpostClaimed: false,
        collectedResourceIds: []
      };
    }

    // 3. 默认 flotsamSalvage 状态 (从 world.collectedFlotsam 升级)
    if (!data.flotsamSalvage) {
      data.flotsamSalvage = {
        collectedIds: (data.world && data.world.collectedFlotsam) ? [...data.world.collectedFlotsam] : [],
        hasAutoSalvageBuoy: false,
        tier: 1,
        totalSalvaged: 0
      };
    }

    data.miningRig = this.mergeRigState(data);

    return data;
  }

  // v0 (零散旧键值或家具存档) 升级至 v1 规范化架构
  migrateV0ToV1(oldData) {
    return {
      schemaVersion: 1,
      timestamp: Date.now(),
      player: oldData.player || { position: [0, 0, 5], rotation: 0 },
      survival: oldData.survival || {
        life: 100,
        hunger: 55,
        water: 50,
        fatigue: 35,
        day: 1,
        steps: 0,
        canteenSips: 3,
        isDead: false
      },
      inventory: oldData.inventory || { apple: 1 },
      story: oldData.story || {
        currentChapterId: 0,
        currentStepIndex: 0,
        hasGatheredBranch: false,
        hasConsumedFoodOrWater: false,
        hasReachedCampsite: false,
        hasCraftedKindling: false,
        hasCookedFood: false,
        hasCraftedAxe: false,
        monkeyBefriended: false,
        secondKidFound: false,
        secondKidAwake: false,
        secondKidAffection: 50,
        sosBuilt: false,
        radioBroadcasted: false,
        raftBuilt: false,
        gemsCollected: [],
        endedEndingId: null
      },
      world: {
        collectedBeachResources: oldData.collectedBeachResources || [],
        collectedGems: oldData.collectedGems || [],
        sosBuilt: false,
        raftBuilt: false
      },
      furniture: Array.isArray(oldData.furniture) ? oldData.furniture : []
    };
  }

  // 执行安全保存 (带备份与写保护，绝不覆写坏死数据)
  saveGame(reason = 'manual') {
    if (this.isSaving) return { success: false, msg: '正在保存中，请稍候' };
    this.isSaving = true;

    try {
      const snapshot = this.createSnapshot();
      if (!this.validateSaveData(snapshot)) {
        console.error('❌ [SaveSystem] 存档有效性校验未通过，中止保存以保护旧存档！', snapshot);
        return { success: false, msg: '存档校验失败，已拒绝写入' };
      }

      // 1. 将现存有效的主存档复制备份到 backup 槽位
      try {
        const existingRaw = localStorage.getItem(SAVE_KEY_PRIMARY);
        if (existingRaw) {
          localStorage.setItem(SAVE_KEY_BACKUP, existingRaw);
        }
      } catch (backupErr) {
        console.warn('⚠️ [SaveSystem] 创建主存档备份失败', backupErr);
      }

      // 2. 写入主存档槽位
      const jsonStr = JSON.stringify(snapshot);
      localStorage.setItem(SAVE_KEY_PRIMARY, jsonStr);
      this.lastSavedTimestamp = snapshot.timestamp;

      // 同时兼容同步家具到旧版键位，防止老逻辑丢失
      if (snapshot.furniture && snapshot.furniture.length > 0) {
        try {
          localStorage.setItem('castaway_island_furniture_v2', JSON.stringify(snapshot.furniture));
        } catch (e) {}
      }

      return { success: true, timestamp: this.lastSavedTimestamp, reason };
    } catch (err) {
      console.error('❌ [SaveSystem] 保存存档出现未捕获异常:', err);
      return { success: false, error: err };
    } finally {
      this.isSaving = false;
    }
  }

  // 从本地存储读取并加载存档
  loadGame() {
    try {
      let raw = localStorage.getItem(SAVE_KEY_PRIMARY);
      let isUsingBackup = false;

      if (!raw) {
        // 主存档不存在，尝试从备份恢复
        raw = localStorage.getItem(SAVE_KEY_BACKUP);
        if (raw) isUsingBackup = true;
      }

      if (!raw) {
        return { success: false, empty: true, msg: '无本地存档数据' };
      }

      let parsed = JSON.parse(raw);
      // 执行 Schema 迁移
      let data = this.migrate(parsed);

      if (!this.validateSaveData(data)) {
        console.warn('⚠️ [SaveSystem] 主存档破损，尝试使用备份槽位...');
        const backupRaw = localStorage.getItem(SAVE_KEY_BACKUP);
        if (backupRaw) {
          const backupParsed = JSON.parse(backupRaw);
          data = this.migrate(backupParsed);
          if (!this.validateSaveData(data)) {
            return { success: false, msg: '主存档与备份存档均破损' };
          }
        } else {
          return { success: false, msg: '主存档校验失败且无可用备份' };
        }
      }

      // 将数据应用到各个子系统中
      this.applyDataToGame(data);

      return {
        success: true,
        schemaVersion: data.schemaVersion,
        timestamp: data.timestamp,
        isUsingBackup
      };
    } catch (err) {
      console.error('❌ [SaveSystem] 载入存档失败:', err);
      return { success: false, error: err };
    }
  }

  // 将加载的数据分发应用到场景与游戏子系统
  applyDataToGame(data) {
    if (!this.game || !data) return;
    this.saveSeed = data.saveSeed || this.generateSaveSeed();
    this.checkinClaimDays = [...(data.checkinClaimDays || [])];
    economyLedger(this.game).deserialize(data.economyLedger);

    // 1. 恢复玩家坐标与朝向
    if (data.player && this.game.player && this.game.player.position) {
      const [x, y, z] = data.player.position;
      if (typeof this.game.player.position.set === 'function') {
        this.game.player.position.set(x, y, z);
      } else {
        this.game.player.position.x = x;
        this.game.player.position.y = y;
        this.game.player.position.z = z;
      }
      if (this.game.player.pivot && typeof this.game.player.pivot.position?.set === 'function') {
        this.game.player.pivot.position.set(x, y, z);
      }
      if (typeof data.player.rotation === 'number') {
        this.game.player.rotation = data.player.rotation;
        if (this.game.player.mesh) {
          this.game.player.mesh.rotation.y = data.player.rotation;
        }
      }
    }

    // 2. 恢复生存四维状态
    if (data.survival && this.game.survival) {
      const s = data.survival;
      this.game.survival.life = s.life;
      this.game.survival.hunger = s.hunger;
      this.game.survival.water = s.water;
      this.game.survival.fatigue = s.fatigue;
      this.game.survival.day = s.day || 1;
      this.game.survival.steps = s.steps || 0;
      this.game.survival.canteenSips = typeof s.canteenSips === 'number' ? s.canteenSips : 3;
      this.game.survival.isDead = Boolean(s.isDead);
      if (this.game.ui) this.game.ui.updateSurvivalHUD();
    }

    // 3. 恢复行囊背包与扩容格位
    if (data.inventory && this.game.ui) {
      this.game.ui.inventory = { ...data.inventory };
      if (typeof data.bonusInventorySlots === 'number') {
        this.game.ui.bonusInventorySlots = data.bonusInventorySlots;
      }
      this.game.ui.renderInventory();
    }

    // 3.5 恢复营地储物箱
    if (data.storage && this.game.storageSystem) {
      this.game.storageSystem.deserialize(data.storage);
    }

    // 3.8 恢复营地设施与净水台
    if (data.campFacilities && this.game.campFacilities) {
      this.game.campFacilities.deserialize(data.campFacilities);
    }

    // 3.9 恢复群岛海图与航海导航状态
    if (data.nauticalChart && this.game.nauticalChart) {
      this.game.nauticalChart.deserialize(data.nauticalChart);
    }

    // 3.95 恢复浮木岛与雷蒙德学者入驻状态
    if (typeof data.raymondSettled === 'boolean') {
      this.game.raymondSettled = data.raymondSettled;
    }
    if (data.timberIsle && this.game.timberIsleScene) {
      this.game.timberIsleScene.deserialize(data.timberIsle);
    }
    if (data.currentIslandId === 'timber_isle' && this.game.travelToIsland) {
      this.game.currentIslandId = 'timber_isle';
      this.game.setMainIslandVisible(false);
      this.game.timberIsleScene.setVisible(true);
    }

    // 3.4 恢复出海船只等级与随船货仓
    if (data.vesselUpgrade && this.game.shipUpgradeSystem) {
      this.game.shipUpgradeSystem.deserialize(data.vesselUpgrade);
      if (this.game.dockShipEntity) {
        this.game.dockShipEntity.updateModel(this.game.shipUpgradeSystem.currentTierLevel);
      }
    }

    // 3.6 恢复小猴伙伴精力与亲密羁绊
    if (data.monkeyHelper && this.game.monkeyHelper) {
      this.game.monkeyHelper.deserialize(data.monkeyHelper);
    }

    // 3.7 恢复潮汐捕蟹笼与营地风干熏架状态
    if (data.tidalTrap && this.game.tidalTrap) {
      this.game.tidalTrap.deserialize(data.tidalTrap);
    }

    // 3.75 恢复随行神宠羁绊与出战状态
    if (data.petCompanion && this.game.petCompanion) {
      this.game.petCompanion.deserialize(data.petCompanion);
    }

    // 3.8 恢复暴风雨与台风气象生存系统
    if (data.weather && this.game.weatherSystem) {
      this.game.weatherSystem.deserialize(data.weather);
    }

    // 3.85 恢复后山神秘古代神殿与密室解谜副本 (带绝对坐标安全自愈纠正)
    if (data.templePuzzle && this.game.templePuzzle) {
      this.game.templePuzzle.deserialize(data.templePuzzle);
    }
    if (data.ancientTempleScene && this.game.ancientTempleScene) {
      this.game.ancientTempleScene.deserialize(data.ancientTempleScene);
    }
    if (data.currentIslandId === 'ancient_temple') {
      const [px, py, pz] = (data.player && data.player.position) ? data.player.position : [0, 0, 0];
      // 地下独立神殿正常探索区间：Z 轴必须从南向入口 z=15 延伸至北向后殿 z=-22
      // 若 Z 坐标落在主岛后山门前区间 (z < -10 且 x 接近 0)，判定为场景ID脱节脏数据，自动修正回主岛
      const isActuallyOutsideDoor = (Math.abs(px) < 6.0 && pz < -10);
      if (isActuallyOutsideDoor) {
        console.warn('🔄 [SaveSystem] 检测到玩家位置处于主岛后山大门前，自动纠正场景为 main_island，解除传送死锁');
        this.game.currentIslandId = 'main_island';
        this.game.setMainIslandVisible(true);
        if (this.game.ancientTempleScene) this.game.ancientTempleScene.setVisible(false);
      } else {
        this.game.currentIslandId = 'ancient_temple';
        this.game.setMainIslandVisible(false);
        if (this.game.ancientTempleScene) this.game.ancientTempleScene.setVisible(true);
        if (this.game.renderer) this.game.renderer.setClearColor(0x0a101d);
        if (this.game.scene) this.game.scene.fog = new THREE.FogExp2(0x0a101d, 0.012);
        if (this.game.dayNight && this.game.dayNight.dirLight) this.game.dayNight.dirLight.visible = false;
        if (this.game.player && this.game.player.snapCamera) {
          this.game.player.snapCamera(0, 0.50, 11.0);
        }
      }
    }

    // 4. 恢复主线剧情进度
    if (data.story && this.game.story) {
      this.game.story.deserialize(data.story);
      if (this.game.ui && typeof this.game.ui.updateObjective === 'function' && typeof this.game.story.getQuestBannerText === 'function') {
        this.game.ui.updateObjective(this.game.story.getQuestBannerText());
      }
    }

    // 5. 恢复海滩散落资源拾取状态
    if (data.world && data.world.collectedBeachResources && this.game.beachResources) {
      this.game.beachResources.deserialize({
        collectedIds: data.world.collectedBeachResources
      });
    }

    // 5.4 恢复矿石岛资源与前哨状态
    if (data.quarryIsle && this.game.quarryIsleScene) {
      this.game.quarryIsleScene.deserialize(data.quarryIsle);
    }

    // 5.5 恢复海面漂流物打捞状态 (优先全量 flotsamSalvage，兼顾兼容 world.collectedFlotsam)
    if (this.game.flotsamSalvage) {
      if (data.flotsamSalvage) {
        this.game.flotsamSalvage.deserialize(data.flotsamSalvage);
      } else if (data.world && data.world.collectedFlotsam) {
        this.game.flotsamSalvage.deserialize({
          collectedIds: data.world.collectedFlotsam
        });
      }
    }

    // 5.6 恢复 DePIN 绿色解密矿机状态
    if (data.miningRig && this.game.miningRig) {
      this.game.miningRig.deserialize(data.miningRig);
    }

    // 6. 恢复宝石拾取状态
    if (data.world && Array.isArray(data.world.collectedGems) && this.game.gemObjects) {
      const gemSet = new Set(data.world.collectedGems);
      this.game.gemObjects.forEach(gem => {
        if (gemSet.has(gem.id)) {
          gem.picked = true;
        }
      });
      if (this.game.gemMeshes) {
        this.game.gemMeshes.forEach(gm => {
          if (gemSet.has(gm.info.id)) {
            gm.info.picked = true;
            gm.group.visible = false;
          }
        });
      }
    }

    // 7. 恢复 SOS 与木筏地标显隐
    if (data.world) {
      if (data.world.sosBuilt && this.game.sosGroup) {
        this.game.sosGroup.visible = true;
        if (this.game.sosChalk) this.game.sosChalk.visible = false;
      }
      if (data.world.raftBuilt && this.game.raftGroup) {
        this.game.raftGroup.visible = true;
      }
    }
  }

  // 清空存档 (仅供显式重置开新局使用，同时清空主存档与备份)
  clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY_PRIMARY);
      localStorage.removeItem(SAVE_KEY_BACKUP);
      localStorage.removeItem('castaway_island_furniture_v2');
      return { success: true };
    } catch (e) {
      return { success: false, error: e };
    }
  }

  // 导出存档为 JSON 字符串
  exportSave() {
    const snapshot = this.createSnapshot();
    if (!snapshot) return null;
    return JSON.stringify(snapshot, null, 2);
  }

  // 导入 JSON 存档并应用到当前游戏，返回是否成功及快照
  importSave(jsonStr) {
    try {
      if (typeof jsonStr !== 'string') return { success: false, error: 'Invalid input string' };
      const parsed = JSON.parse(jsonStr);
      const migrated = this.migrate(parsed);
      if (!this.validateSaveData(migrated)) {
        return { success: false, error: 'Validation failed for imported save data' };
      }
      this.applyDataToGame(migrated);
      localStorage.setItem(SAVE_KEY_PRIMARY, JSON.stringify(migrated));
      return { success: true, data: migrated };
    } catch (e) {
      return { success: false, error: e.message || String(e) };
    }
  }

}
