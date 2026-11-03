// CastawaySOL - 小群岛海图与航行导航系统 (Nautical Chart & Archipelago Navigation System)
// 统一管理：群岛坐标航线、出航补给检核、前哨归属标记与多岛场景切岛逻辑
import { soundEngine } from '../core/AudioSystem.js';

export const ARCHIPELAGO_ISLANDS = {
  home_island: {
    id: 'home_island',
    name: '避风家园主岛 (Home Island)',
    badge: '🏠 核心大本营',
    desc: '平静安全的求生母港，坐落着温馨的露营帐篷、飞瀑清泉、营地储物箱与净水设施。',
    climate: '四季温和 · 资源均衡',
    dangerLevel: '安全 (0★)',
    distanceKm: 0,
    requiredSupplies: { food: 0, water: 0 },
    discovered: true,
    outpostBuilt: true,
    thumbnailIcon: '🏝️'
  },
  timber_isle: {
    id: 'timber_isle',
    name: '漂流浮木岛 (Timber Isle)',
    badge: '🪵 木料富集 · 邻岛求救源',
    desc: '位于东北洋流交汇处的沉船沙洲，遍布被海浪冲刷上岸的高阶原木方料与板条箱，并传出受困幸存者断续的无线电呼救信号！',
    climate: '潮汐汹涌 · 漂流物富集',
    dangerLevel: '轻度危险 (1★)',
    distanceKm: 2.8,
    requiredSupplies: { food: 1, water: 1 },
    discovered: false, // 需通过修好收音机或探索发现
    outpostBuilt: false,
    thumbnailIcon: '🪵'
  },
  quarry_isle: {
    id: 'quarry_isle',
    name: '海蚀矿石岛 (Quarry Isle)',
    badge: '🪨 玄武岩矿脉 · 待探索',
    desc: '远海火山海蚀孤峰，岩壁密布坚硬的玄武岩、铜铁矿露头与硫磺泉眼，是打造高阶工具与坚固防御前哨的必经之地。',
    climate: '狂风骤雨 · 峭壁险峻',
    dangerLevel: '中度危险 (2★)',
    distanceKm: 5.6,
    requiredSupplies: { food: 2, water: 2 },
    discovered: false,
    outpostBuilt: false,
    thumbnailIcon: '🌋'
  },
  mist_reef_isle: {
    id: 'mist_reef_isle',
    name: '晶雾回声岛 (Mist Reef Isle)',
    badge: '🔮 终局晶海 · 地脉共鸣源',
    desc: '隐匿在 12.8 海里风暴浓雾深处的环礁秘岛，生长着璀璨的荧光深层海脉晶核、孔雀铜矿与深海母贝珍珠，并残存着先民潮汐传送阵。',
    climate: '浓雾潮涌 · 荧光晶脉冲盈',
    dangerLevel: '高度危险 (3★)',
    distanceKm: 12.8,
    requiredSupplies: { food: 4, water: 4 },
    discovered: false,
    outpostBuilt: false,
    requiresLighthouse: true,
    requiredTierLevel: 3,
    thumbnailIcon: '🔮'
  }
};

export class NauticalChartSystem {
  constructor(game) {
    this.game = game;
    this.currentIslandId = 'home_island';
    this.islands = JSON.parse(JSON.stringify(ARCHIPELAGO_ISLANDS));
  }

  // 解锁指定岛屿
  discoverIsland(islandId) {
    if (this.islands[islandId]) {
      const wasDiscovered = this.islands[islandId].discovered;
      this.islands[islandId].discovered = true;
      if (!wasDiscovered && this.game && this.game.ui) {
        this.game.ui.showToast(`🧭 航海图更新：已标记【${this.islands[islandId].name}】！`, 'medium');
      }
    }
  }

  // 当灯塔一期点亮或船坞升级时同步检测晶雾回声岛航路探明状态
  syncEndgameRoutes() {
    const isLighthouseLit = Boolean(
      (this.game && this.game.lighthouse && this.game.lighthouse.isLit) ||
      (this.game && this.game.story && this.game.story.lighthouseLit)
    );
    const tierLevel = this.game && this.game.shipUpgradeSystem ? this.game.shipUpgradeSystem.currentTierLevel : 1;
    if (this.islands.mist_reef_isle && (isLighthouseLit || tierLevel >= 3)) {
      this.discoverIsland('mist_reef_isle');
    }
  }

  // 检查前往指定岛屿的补给是否充分与船只适航能力
  checkSupplies(islandId) {
    const target = this.islands[islandId];
    if (!target) return { ok: false, reason: '目标海域不存在' };
    if (islandId === this.currentIslandId) return { ok: false, reason: '当前已在此岛屿' };

    // 0.0 检查终局海域双锁（北崖灯塔一期已点亮 + 要求船体阶梯）
    if (target.requiresLighthouse) {
      const isLighthouseLit = Boolean(
        (this.game && this.game.lighthouse && this.game.lighthouse.isLit) ||
        (this.game && this.game.story && this.game.story.lighthouseLit)
      );
      if (!isLighthouseLit) {
        return {
          ok: false,
          reason: '目标海域被浓厚晶雾风暴封锁！需先点亮【北崖地脉灯塔一期】照破迷雾，方能校准远洋航向！'
        };
      }
    }

    // 0. 检查出海船只等级与适航距离
    const shipSys = this.game ? this.game.shipUpgradeSystem : null;
    if (shipSys && target.requiredTierLevel && shipSys.currentTierLevel < target.requiredTierLevel) {
      const curTier = shipSys.getCurrentTier();
      return {
        ok: false,
        reason: `【${target.name}】外围暗礁狂浪凶险！当前座驾【${curTier.name}】无法突破，需升级至 T${target.requiredTierLevel}【铁甲远洋探索舰】！`
      };
    }
    if (shipSys && target.distanceKm > 0) {
      if (!shipSys.canReachDistance(target.distanceKm)) {
        const curTier = shipSys.getCurrentTier();
        return {
          ok: false,
          reason: `目标海域距此 ${target.distanceKm} 海里，风浪狂暴！当前座驾【${curTier.name}】最大航程仅 ${curTier.maxDistanceKm} 海里，请前往码头船坞升级船体！`
        };
      }
    }

    const inv = this.game.ui ? this.game.ui.inventory : {};
    const survival = this.game.survival;

    // 计算实际补给需求 (享受船只等级折扣 + D1 海皇圣物归位淡水消耗减半护佑)
    const discount = shipSys ? shipSys.getCurrentTier().supplyDiscount : 0;
    const shipWaterNeed = discount >= 1.0 ? 0 : (discount > 0 ? Math.max(1, Math.ceil(target.requiredSupplies.water * (1 - discount))) : target.requiredSupplies.water);
    const poseidonBlessed = Boolean(this.game?.lighthouse?.phase2Complete || this.game?.lighthouse?.poseidonRelicEnshrined);
    const actualWaterNeed = shipWaterNeed > 0 && poseidonBlessed ? Math.max(1, Math.floor(shipWaterNeed * 0.5)) : shipWaterNeed;
    const actualFoodNeed = discount >= 1.0 ? 0 : (discount > 0 ? Math.max(1, Math.ceil(target.requiredSupplies.food * (1 - discount))) : target.requiredSupplies.food);

    // 1. 水分检查
    if (actualWaterNeed > 0) {
      const hasCanteenWater = survival && survival.canteenSips >= actualWaterNeed;
      const hasBagWater = (inv['canteen_clean_water'] || 0) + (inv['coconut'] || 0) >= actualWaterNeed;
      if (!hasCanteenWater && !hasBagWater) {
        return {
          ok: false,
          reason: `淡水储备不足！横渡海域需准备 ${actualWaterNeed} 份淡水，请补充水壶或备足【椰子/纯净水】！`
        };
      }
    }

    // 2. 食物检查 (背包内任意可食用干粮)
    if (actualFoodNeed > 0) {
      const totalFoodCount = ['apple', 'coconut', 'fish', 'baked_fish', 'baked_apple']
        .reduce((sum, key) => sum + (inv[key] || 0), 0);

      if (totalFoodCount < actualFoodNeed) {
        return {
          ok: false,
          reason: `远航干粮不足！出海需随身携带 ${actualFoodNeed} 份干粮充饥！`
        };
      }
    }

    return { ok: true, actualWaterNeed, actualFoodNeed };
  }

  // 扣除航行所需的随身补给消耗
  deductSupplies(islandId) {
    const target = this.islands[islandId];
    if (!target || !target.requiredSupplies) return;

    const shipSys = this.game ? this.game.shipUpgradeSystem : null;
    const discount = shipSys ? shipSys.getCurrentTier().supplyDiscount : 0;
    const shipWaterNeed = discount >= 1.0 ? 0 : (discount > 0 ? Math.max(1, Math.ceil(target.requiredSupplies.water * (1 - discount))) : target.requiredSupplies.water);
    const poseidonBlessed = Boolean(this.game?.lighthouse?.phase2Complete || this.game?.lighthouse?.poseidonRelicEnshrined);
    const needWater = shipWaterNeed > 0 && poseidonBlessed ? Math.max(1, Math.floor(shipWaterNeed * 0.5)) : shipWaterNeed;
    let needFood = discount >= 1.0 ? 0 : (discount > 0 ? Math.max(1, Math.ceil(target.requiredSupplies.food * (1 - discount))) : target.requiredSupplies.food);

    const inv = this.game.ui ? this.game.ui.inventory : {};
    const survival = this.game.survival;

    // 扣水壶或背包水
    if (needWater > 0) {
      if (survival && survival.canteenSips >= needWater) {
        survival.canteenSips -= needWater;
      } else {
        if (inv['canteen_clean_water']) {
          inv['canteen_clean_water']--;
          if (inv['canteen_clean_water'] <= 0) delete inv['canteen_clean_water'];
        } else if (inv['coconut']) {
          inv['coconut']--;
          if (inv['coconut'] <= 0) delete inv['coconut'];
        }
      }
    }

    // 扣食物
    if (needFood > 0) {
      const foodKeys = ['apple', 'coconut', 'fish', 'baked_fish', 'baked_apple'];
      for (const k of foodKeys) {
        if (inv[k] && needFood > 0) {
          const take = Math.min(inv[k], needFood);
          inv[k] -= take;
          needFood -= take;
          if (inv[k] <= 0) delete inv[k];
        }
      }
    }

    // 触发返航拖网收获 (T3探索舰专属)
    if (shipSys && shipSys.onVoyageCompleted) {
      shipSys.onVoyageCompleted();
    }

    if (this.game.ui) {
      this.game.ui.renderInventory();
      this.game.ui.updateSurvivalHUD();
    }
  }

  // 打开海图航海导航弹窗
  openChartModal() {
    this.syncEndgameRoutes();
    if (this.game && this.game.ui) {
      this.game.ui.openNauticalChartModal(this);
    }
  }

  // 序列化
  serialize() {
    return {
      currentIslandId: this.currentIslandId,
      islands: this.islands
    };
  }

  // 反序列化（合并新增岛屿默认配置以无缝兼容旧存档）
  deserialize(data) {
    if (data && data.islands) {
      const defaults = JSON.parse(JSON.stringify(ARCHIPELAGO_ISLANDS));
      const merged = {};
      for (const [k, defVal] of Object.entries(defaults)) {
        merged[k] = data.islands[k] ? { ...defVal, ...data.islands[k] } : defVal;
      }
      for (const [k, savedVal] of Object.entries(data.islands)) {
        if (!merged[k]) merged[k] = { ...savedVal };
      }
      this.islands = merged;
      if (data.currentIslandId) {
        this.currentIslandId = data.currentIslandId;
      }
      // 读档必须是纯恢复：不在 deserialize 里跑 syncEndgameRoutes，
      // 否则灯塔已点亮的存档会在读档时把晶雾回声岛 discovered 翻为 true，
      // 破坏存档往返一致性。航路探明由点亮/升级/打开海图的游玩期触发负责。
    }
  }
}
