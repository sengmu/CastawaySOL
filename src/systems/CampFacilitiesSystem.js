import { economyLedger } from './EconomyLedger.js';
// CastawaySOL - 营地设施与居民生产经营中枢 (Camp Facilities & Resident Production System)
// 统一管理：净水滴滤台淡水蓄积与快速蒸馏、营地床位绑定、居民幸存者自动采集生产、自动化排班特权与清晨经营简报
import { soundEngine } from '../core/AudioSystem.js';

export const CAMP_MINER_CRYSTALS = 2;
export const REFINERY_CRYSTAL_COST = 2;
export class CampFacilitiesSystem {
  constructor(game) {
    this.game = game;
    // 净水滴滤台储水量 (单位：份，最大容量 6，可通过特权扩容至 12)
    this.purifierWaterLevel = 3;
    this.maxPurifierWater = 6;
    this.fuelLevel = 0; // 添柴蒸馏燃料储备
    this.stepCounter = 0; // 步数冷凝累积器
    this.isAutoProductionActive = false; // 是否激活自动生产减负特权 (类似《疯狂水世界》12元自动生产执照)

    // 幸存者居民生产岗位排班映射表 (支持打捞、采集、净水、矿石开采运送)
    this.jobsConfig = {
      miner: {
        id: 'miner',
        name: '硅晶矿脉探采员',
        icon: '⛏️',
        desc: '巡视全岛 DePIN 硅晶矿脉与海蚀崖壁，每日运回高能原石直接供矿机运算',
        baseYield: { sol_crystal: 2, stone_chunk: 2 }
      },
      salvager: {
        id: 'salvager',
        name: '浅海打捞巡警',
        icon: '⚓',
        desc: '巡视南岸与出航湾，打捞潮汐冲刷上来的木板、铁钉与备用电池',
        baseYield: { wood_plank: 2, nail: 1, battery: 1 }
      },
      forager: {
        id: 'forager',
        name: '丛林采集先锋',
        icon: '🌿',
        desc: '在西部树林与果树间采集新鲜苹果、木棍与坚韧藤蔓',
        baseYield: { apple: 2, tree_branch: 3, ivy: 1 }
      },
      water_worker: {
        id: 'water_worker',
        name: '净水维护管工',
        icon: '🚰',
        desc: '照看净水滴滤台并添柴除垢，每天额外产出纯净甘泉',
        baseYield: { water_bonus: 3, canteen_clean_water: 1 }
      }
    };

    // 当前已分配岗位 (默认艾莉为打捞员)
    this.residentJobs = {
      second_kid: 'salvager'
    };

    // 纯晶精炼炉系统 (Refinery System: 2原石 + 1树脂 -> 1高纯度硅晶 2.5份额)
    this.refineryLevel = 0; // 0: 未建造, 1: L1(每日3批), 2: L2(每日6批)
    this.refineryQueue = 0;
  }

  // 为幸存者分配新生产岗位
  assignJob(villagerId, jobId) {
    if (!this.jobsConfig[jobId]) return false;
    this.residentJobs[villagerId] = jobId;
    const jobInfo = this.jobsConfig[jobId];
    if (this.game && this.game.ui) {
      this.game.ui.showToast(`📋 成功任命岗位：【${jobInfo.name}】！每日清晨将按新岗位产出！`, 'medium');
    }
    return true;
  }

  // 获取幸存者当前岗位信息
  getResidentJob(villagerId) {
    const jobId = this.residentJobs[villagerId] || 'salvager';
    return this.jobsConfig[jobId] || this.jobsConfig.salvager;
  }

  // 计算营地全局供需平衡指标 (用于看板与经营预测)
  getSupplyDemandOverview() {
    const game = this.game;
    const story = game ? game.story : null;
    const isRaymond = (game && game.raymondSettled) || (game && game.timberIsleScene && game.timberIsleScene.survivorRescued);
    const ellieAwake = story && story.secondKidAwake;
    const bubFriended = story && story.monkeyBefriended;

    // 1. 人口与床位
    const population = 1 + (ellieAwake ? 1 : 0) + (isRaymond ? 1 : 0);
    const companions = (bubFriended ? 1 : 0);
    const neededBeds = population;
    const bedCapacity = this.getBedCapacity();
    const isBedSufficient = bedCapacity >= neededBeds;

    // 2. 淡水每日平衡 (滴滤台冷凝 + 岗位加成 vs 人口消耗)
    const hasPurifier = this.hasWaterPurifier();
    const waterBaseDaily = hasPurifier ? 2 : 0;
    const ellieJob = this.getResidentJob('second_kid');
    const ellieWaterBonus = (ellieAwake && ellieJob.id === 'water_worker') ? 3 : 0;
    const dailyWaterSupply = waterBaseDaily + ellieWaterBonus;
    const dailyWaterDemand = population; // 每位居民每日消耗 1 份淡水
    const waterBalance = dailyWaterSupply - dailyWaterDemand;

    // 3. 粮食每日估算与库存
    let dailyFoodSupply = 0;
    if (bubFriended) dailyFoodSupply += 1.5;
    if (ellieAwake && ellieJob.id === 'forager') dailyFoodSupply += 2.0;
    const dailyFoodDemand = population;
    const foodBalance = dailyFoodSupply - dailyFoodDemand;

    // 储物箱食物存量
    const storageInv = game && game.storageSystem ? game.storageSystem.storageInventory : {};
    const foodStock = ['apple', 'coconut', 'fish', 'baked_fish', 'baked_apple']
      .reduce((sum, k) => sum + (storageInv[k] || 0), 0);

    // 4. 前哨开拓状态
    const timberOutpost = game && game.nauticalChart &&
      game.nauticalChart.islands['timber_isle'] &&
      game.nauticalChart.islands['timber_isle'].outpostBuilt;

    const quarryOutpost = game && game.nauticalChart &&
      game.nauticalChart.islands['quarry_isle'] &&
      game.nauticalChart.islands['quarry_isle'].outpostBuilt;

    return {
      population,
      companions,
      neededBeds,
      bedCapacity,
      isBedSufficient,
      hasPurifier,
      purifierWaterLevel: this.purifierWaterLevel,
      maxPurifierWater: this.maxPurifierWater,
      dailyWaterSupply,
      dailyWaterDemand,
      waterBalance,
      dailyFoodSupply,
      dailyFoodDemand,
      foodBalance,
      foodStock,
      timberOutpost,
      quarryOutpost,
      ellieAwake,
      isRaymond,
      bubFriended
    };
  }

  // 步数驱动：随户外探索与日照，净水器自然冷凝蓄水 (每 50 步自然冷凝 1 份甘露)
  recordMovement(stepDelta = 1) {
    if (!this.hasWaterPurifier()) return;
    this.stepCounter += stepDelta;
    if (this.stepCounter >= 50) {
      this.stepCounter = 0;
      if (this.purifierWaterLevel < this.maxPurifierWater) {
        this.purifierWaterLevel++;
      }
    }
  }

  // 添柴蒸馏加速产水 (放入树枝或木板，立即煮沸冷凝产出净水)
  addFuel(fuelItem = 'tree_branch', count = 1) {
    if (!this.game || !this.game.ui) return false;
    const inv = this.game.ui.inventory;
    if ((inv[fuelItem] || 0) < count) {
      this.game.ui.showToast(`❌ 背包中缺少【${this.game.ui.getItemName(fuelItem)}】！`, 'medium');
      return false;
    }

    inv[fuelItem] -= count;
    if (inv[fuelItem] <= 0) delete inv[fuelItem];
    this.game.ui.renderInventory();

    const waterYield = fuelItem === 'wood_plank' ? 3 * count : 2 * count;
    const oldLevel = this.purifierWaterLevel;
    this.purifierWaterLevel = Math.min(this.maxPurifierWater, this.purifierWaterLevel + waterYield);
    const added = this.purifierWaterLevel - oldLevel;

    soundEngine.playCooking();
    this.game.ui.showToast(`🔥 添柴快速蒸馏中！成功凝结了 ${added} 份纯净甘泉！(当前蓄水: ${this.purifierWaterLevel}/${this.maxPurifierWater})`, 'medium');
    return true;
  }

  // 净水设施交互：玩家靠近按【E】进行痛快畅饮或灌装取水
  interactWaterPurifier(facility) {
    if (!this.game || !this.game.ui || !this.game.survival) return;

    if (this.purifierWaterLevel <= 0) {
      this.game.ui.showDialog(
        '🚰 自然净水滴滤台',
        '滴滤石英砂与多孔火山炭正在缓慢冷凝过滤海雾与露水……\n当前储水箱暂空。\n\n💡 提示：可放入【木棍】或【木板】添柴快速沸腾蒸馏产水，或等待清晨与探索自然冷凝！'
      );
      return;
    }

    // 优先灌满水壶并消除口渴
    const survival = this.game.survival;
    const needSips = 3 - (survival.canteenSips || 0);
    const needHydration = 100 - (survival.water || 0);

    if (needSips > 0 || needHydration > 15) {
      survival.refillCanteen();
      survival.water = Math.min(100, survival.water + 45);
      survival.life = Math.min(100, survival.life + 10);
      this.game.ui.updateSurvivalHUD();
      this.purifierWaterLevel = Math.max(0, this.purifierWaterLevel - 1);
      soundEngine.playSplash();

      this.game.ui.showToast('💧 从净水滴滤台畅饮了冰凉甘泉！水壶已备满！', 'small');
      if (this.game.story && this.game.story.onDrinkWater) {
        this.game.story.onDrinkWater();
      }
      return;
    }

    // 若玩家状态充盈，将过滤好的淡水灌装成纯净水道具收入背包
    if (this.purifierWaterLevel > 0) {
      if (this.game.ui.isInventoryFull && this.game.ui.isInventoryFull('canteen_clean_water')) {
        this.game.ui.showToast('❌ 行囊已满，无法容纳新的纯净水道具！', 'medium');
        return;
      }
      this.purifierWaterLevel--;
      this.game.ui.addInventory('canteen_clean_water', 1);
      soundEngine.playSplash();
      this.game.ui.showToast(`🚰 从净水台灌装了【甘甜纯净水】收入行囊！（水箱剩余：${this.purifierWaterLevel}/${this.maxPurifierWater}）`, 'small');
    }
  }

  // 检查已建造的营地床位数
  getBedCapacity() {
    if (!this.game || !this.game.buildSystem) return 0;
    return this.game.buildSystem.placedFurniture.filter(f => f.isBed).length;
  }

  // 检查是否具备净水设施 (包括营地原生净水台与玩家建造的净水台)
  hasWaterPurifier() {
    if (this.game && this.game.campEntities) return true; // 营地原生已具备净水滴滤台
    if (!this.game || !this.game.buildSystem) return false;
    return this.game.buildSystem.placedFurniture.some(f => f.isWaterPurifier);
  }

  // 新一天/过夜睡觉时触发每日经营产出结算
  onDayPassed() {
    if (!this.game) return;

    const reports = [];
    const storage = this.game.storageSystem ? this.game.storageSystem.storageInventory : null;
    const story = this.game.story;

    // 1. 净水滴滤台每日冷凝产水 (若开通自动生产执照，直接补满)
    if (this.hasWaterPurifier()) {
      if (this.isAutoProductionActive) {
        this.purifierWaterLevel = this.maxPurifierWater;
        reports.push(`🚰 【自动净水管网】特权自动保持水箱饱和满蓄 (${this.maxPurifierWater}/${this.maxPurifierWater})！`);
      } else {
        const generatedWater = 2;
        this.purifierWaterLevel = Math.min(this.maxPurifierWater, this.purifierWaterLevel + generatedWater);
        reports.push(`🚰 【净水滴滤台】自然冷凝凝结了 ${generatedWater} 壶甘甜纯净水 (蓄水 ${this.purifierWaterLevel}/${this.maxPurifierWater})`);
      }
    }

    // 2. 检查是否有床位供幸存者入驻并开展生产
    const bedCount = this.getBedCapacity();

    // 2.1 幸存者艾莉 (Ellie) - 根据当前任命的岗位产出
    if (story && story.secondKidAwake) {
      const job = this.getResidentJob('second_kid');
      const efficiency = bedCount >= 1 ? (this.isAutoProductionActive ? 1.5 : 1.0) : 0.5;

      if (storage) {
        if (job.id === 'salvager') {
          const planks = Math.max(1, Math.round(2 * efficiency));
          const nails = Math.max(1, Math.round(1 * efficiency));
          storage['wood_plank'] = (storage['wood_plank'] || 0) + planks;
          storage['nail'] = (storage['nail'] || 0) + nails;
          reports.push(`👧 【艾莉·${job.name}】清晨巡岸，打捞入库：木板 x${planks}、铁钉 x${nails}`);
        } else if (job.id === 'forager') {
          const apples = Math.max(1, Math.round(2 * efficiency));
          const branches = Math.max(1, Math.round(3 * efficiency));
          const ivy = Math.round(1 * efficiency);
          storage['apple'] = (storage['apple'] || 0) + apples;
          storage['tree_branch'] = (storage['tree_branch'] || 0) + branches;
          if (ivy > 0) storage['ivy'] = (storage['ivy'] || 0) + ivy;
          reports.push(`👧 【艾莉·${job.name}】密林采摘，送来：苹果 x${apples}、木棍 x${branches}${ivy > 0 ? `、藤蔓 x${ivy}` : ''}`);
        } else if (job.id === 'water_worker') {
          const bonusWater = Math.max(1, Math.round(3 * efficiency));
          this.purifierWaterLevel = Math.min(this.maxPurifierWater, this.purifierWaterLevel + bonusWater);
          storage['canteen_clean_water'] = (storage['canteen_clean_water'] || 0) + 1;
          reports.push(`👧 【艾莉·${job.name}】细心维护滴滤台，额外蓄水 +${bonusWater} 份，并装备纯净水 x1 入库`);
        } else if (job.id === 'miner') {
          // F5 补齐实现：硅晶矿脉探采员产出（执照的 x1.5 不作用于晶石）
          const baseCrystals = CAMP_MINER_CRYSTALS;
          const stones = Math.max(1, Math.round(2 * efficiency));
          economyLedger(this.game).credit('sol_crystal', baseCrystals, 'camp_miner', storage);
          storage['stone_chunk'] = (storage['stone_chunk'] || 0) + stones;
          reports.push(`👧 【艾莉·${job.name}】勘探矿脉，采集入库：硅晶原石 x${baseCrystals}、玄武碎石 x${stones}`);
        }

        if (bedCount < 1) {
          reports.push(`  ↳ ⚠️ 艾莉昨夜露宿草地，生产效率降低 50% (请在营地建造【避风原木单人床】保障体能)`);
        }
      }
    }

    // 2.2 灵猴巴布 (Bub) - 负责丛林果实采摘
    if (story && story.monkeyBefriended && storage) {
      const apples = Math.floor(Math.random() * 2) + 1;
      const branches = 2;
      storage['apple'] = (storage['apple'] || 0) + apples;
      storage['tree_branch'] = (storage['tree_branch'] || 0) + branches;
      reports.push(`🐒 【巴布】穿梭树梢翻跟头采摘，送来了：苹果 x${apples}、木棍 x${branches}`);
    }

    // 2.3 探险学者雷蒙德 (Raymond) - 工坊技师 (需完成浮木岛救援返航)
    const isRaymondSettled = (this.game && this.game.raymondSettled) || (this.game && this.game.timberIsleScene && this.game.timberIsleScene.survivorRescued);
    if (isRaymondSettled && storage) {
      const efficiency = bedCount >= 2 ? (this.isAutoProductionActive ? 1.5 : 1.0) : 0.5;
      const lumberCount = Math.max(1, Math.round(1 * efficiency));
      const nailCount = Math.max(1, Math.round(1 * efficiency));
      storage['lumber'] = (storage['lumber'] || 0) + lumberCount;
      storage['nail'] = (storage['nail'] || 0) + nailCount;
      reports.push(`👓 【雷蒙德·工坊技师】精密切割与锻打：重型方木 x${lumberCount}、铁钉 x${nailCount}`);

      if (bedCount < 2) {
        reports.push(`  ↳ ⚠️ 营地床位短缺 (需 2 张床位)！雷蒙德疲倦受挫，生产效率受限`);
      }
    }

    // 2.35 纯晶精炼炉连夜淬炼产出 (R9: 2原石 + 1树脂 -> 1高纯度硅晶 2.5份额)
    if (this.refineryLevel > 0 && storage) {
      const maxBatches = this.refineryLevel === 1 ? 3 : 6;
      let batchCount = 0;
      while (batchCount < maxBatches) {
        if ((storage['sol_crystal'] || 0) >= 2 && (storage['tree_sap'] || 0) >= 1) {
          economyLedger(this.game).debit('sol_crystal', REFINERY_CRYSTAL_COST, 'refinery_consume', storage);
          storage['tree_sap'] -= 1;
          storage['sol_crystal_pure'] = (storage['sol_crystal_pure'] || 0) + 1;
          batchCount++;
          if (storage['sol_crystal'] <= 0) delete storage['sol_crystal'];
          if (storage['tree_sap'] <= 0) delete storage['tree_sap'];
        } else {
          break;
        }
      }
      if (batchCount > 0) {
        reports.push(`🔥 【纯晶精炼炉 L${this.refineryLevel}】连夜提纯产出：高纯度精炼硅晶 x${batchCount}！`);
      }
    }

    // 2.4 海外前哨资源回运网络独立结算 (浮木前哨与矿石前哨)
    if (storage && this.game.nauticalChart) {
      // 浮木前哨站
      if (this.game.nauticalChart.islands['timber_isle'] && this.game.nauticalChart.islands['timber_isle'].outpostBuilt) {
        const outpostPlanks = 2;
        const outpostLumber = 1;
        storage['wood_plank'] = (storage['wood_plank'] || 0) + outpostPlanks;
        storage['lumber'] = (storage['lumber'] || 0) + outpostLumber;
        reports.push(`🚩 【浮木前哨站】洋流潮汐回运：木板 x${outpostPlanks}、重型方木 x${outpostLumber}`);
      }

      // 海蚀矿石前哨站
      if (this.game.nauticalChart.islands['quarry_isle'] && this.game.nauticalChart.islands['quarry_isle'].outpostBuilt) {
        const outpostIron = 2;
        const outpostStone = 2;
        storage['iron_ore'] = (storage['iron_ore'] || 0) + outpostIron;
        storage['stone_chunk'] = (storage['stone_chunk'] || 0) + outpostStone;
        reports.push(`🚩 【矿石前哨站】火山矿脉回运：富铁矿石 x${outpostIron}、玄武原石 x${outpostStone}`);
      }
    }

    // 3. 弹出晨间生产经营简报
    if (reports.length > 0 && this.game.ui) {
      const dayNum = this.game.survival ? this.game.survival.day : 1;
      const reportText = `🌅 拂晓海风轻拂，营地伙伴今日为您带来了丰硕成果：\n\n` +
        reports.join('\n') +
        `\n\n📦 全部采集物资已自动整理存入【营地储物木箱】！`;
      this.game.ui.showDialog(`🌅 第 ${dayNum} 天 · 荒岛营地晨报`, reportText);
    }
  }

  // 建造与升级古法纯晶精炼炉 (L1: 3批/日, L2: 6批/日)
  buildRefinery() {
    const nextLevel = this.refineryLevel + 1;
    if (nextLevel > 2) {
      if (this.game?.ui) this.game.ui.showToast('精炼炉已达到最高等级！', 'medium');
      return { ok: false, msg: '已达最高等级' };
    }

    const inv = this.game?.ui?.inventory || {};
    const storage = this.game?.storageSystem?.storageInventory || {};

    const costTokens = nextLevel === 1 ? 20 : 50;
    const costStone = nextLevel === 1 ? 4 : 0;
    const costIron = nextLevel === 1 ? 2 : 4;

    const curTokens = inv['sol_token'] || 0;
    if (curTokens < costTokens) {
      const msg = `建造精炼炉所需算力代币不足 (需要 ${costTokens}，当前持有 ${curTokens})！`;
      if (this.game?.ui) this.game.ui.showToast(msg, 'medium');
      return { ok: false, msg };
    }

    const availStone = (inv['stone_chunk'] || 0) + (storage['stone_chunk'] || 0);
    const availIron = (inv['iron_ingot'] || 0) + (storage['iron_ingot'] || 0);

    if (availStone < costStone || availIron < costIron) {
      const msg = `材料不足！需要【算力代币 x${costTokens}】+【碎石 x${costStone}】+【铁锭 x${costIron}】`;
      if (this.game?.ui) this.game.ui.showToast(msg, 'medium');
      return { ok: false, msg };
    }

    economyLedger(this.game).debit('sol_token', costTokens, 'refinery');
    if (inv['sol_token'] <= 0) delete inv['sol_token'];

    let remStone = costStone;
    if (inv['stone_chunk']) {
      const take = Math.min(inv['stone_chunk'], remStone);
      inv['stone_chunk'] -= take;
      remStone -= take;
      if (inv['stone_chunk'] <= 0) delete inv['stone_chunk'];
    }
    if (remStone > 0 && storage['stone_chunk']) {
      storage['stone_chunk'] -= remStone;
      if (storage['stone_chunk'] <= 0) delete storage['stone_chunk'];
    }

    let remIron = costIron;
    if (inv['iron_ingot']) {
      const take = Math.min(inv['iron_ingot'], remIron);
      inv['iron_ingot'] -= take;
      remIron -= take;
      if (inv['iron_ingot'] <= 0) delete inv['iron_ingot'];
    }
    if (remIron > 0 && storage['iron_ingot']) {
      storage['iron_ingot'] -= remIron;
      if (storage['iron_ingot'] <= 0) delete storage['iron_ingot'];
    }

    if (this.game?.miningRig?.onSinkSpent) {
      this.game.miningRig.onSinkSpent(costTokens, 'refinery');
    }

    this.refineryLevel = nextLevel;
    soundEngine.playPlaceFurniture();
    haptics.success();

    if (this.game?.ui) {
      this.game.ui.renderInventory();
      this.game.ui.showToast(`🔥 营地【古法纯晶精炼炉 L${this.refineryLevel}】建造成功！`, 'important');
    }
    if (this.game?.saveSystem) {
      this.game.saveSystem.saveGame('build_refinery');
    }
    return { ok: true, level: this.refineryLevel };
  }

  // 序列化
  serialize() {
    return {
      purifierWaterLevel: this.purifierWaterLevel,
      maxPurifierWater: this.maxPurifierWater,
      isAutoProductionActive: this.isAutoProductionActive,
      residentJobs: { ...this.residentJobs },
      refineryLevel: this.refineryLevel,
      refineryQueue: this.refineryQueue
    };
  }

  // 反序列化恢复
  deserialize(data) {
    if (data && typeof data === 'object') {
      if (typeof data.purifierWaterLevel === 'number') {
        this.purifierWaterLevel = data.purifierWaterLevel;
      }
      if (typeof data.maxPurifierWater === 'number') {
        this.maxPurifierWater = data.maxPurifierWater;
      }
      if (typeof data.isAutoProductionActive === 'boolean') {
        this.isAutoProductionActive = data.isAutoProductionActive;
      }
      if (data.residentJobs && typeof data.residentJobs === 'object') {
        this.residentJobs = { ...data.residentJobs };
      }
      if (typeof data.refineryLevel === 'number') {
        this.refineryLevel = data.refineryLevel;
      }
      if (typeof data.refineryQueue === 'number') {
        this.refineryQueue = data.refineryQueue;
      }
    }
  }
}
