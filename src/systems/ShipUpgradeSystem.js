// CastawaySOL - 出海船升级与随船货仓系统 (Ship Upgrade & Cargo Hold System)
// 统一管理：船体多阶段进阶 (T1木筏 -> T2龙骨风帆艇 -> T3铁甲探索舰)、随船货运仓、远航补给减免与深海航行能力
import { soundEngine } from '../core/AudioSystem.js';

export const VESSEL_TIERS = {
  tier_1: {
    id: 'tier_1',
    level: 1,
    name: '简易捆扎原木筏',
    title: 'T1 · 简易原木筏',
    icon: '🛶',
    badge: '初级近岸载具',
    desc: '4根粗壮原木与藤蔓简单捆扎而成的简易浮筏，单三角麻布帆。仅能用于近距离风平浪静海域试探。',
    maxDistanceKm: 3.5, // 可到达浮木岛 (2.8km)
    cargoSlots: 0, // 无额外随船货仓
    supplyDiscount: 0, // 正常消耗补给
    stormResistance: '极低 · 易倾覆',
    cost: null, // 初始默认建造
    upgradeBonusDesc: '基础近岸载具，可前往 3.5 海里内近海平缓水域。'
  },
  tier_2: {
    id: 'tier_2',
    level: 2,
    name: '加固龙骨风帆快艇',
    title: 'T2 · 加固龙骨风帆艇',
    icon: '⛵',
    badge: '稳健适航帆船',
    desc: '以高阶重型方木构建弯曲龙骨，加装单面大纵帆与轻型侧翼防浪木，具备抵御中度风浪能力，船尾加装防潮货运木箱。',
    maxDistanceKm: 7.5, // 可到达海蚀矿石岛 (5.6km)
    cargoSlots: 4, // 解锁 4 格随船货仓
    supplyDiscount: 0.5, // 远航补给消耗减半 (取整至少扣 1)
    stormResistance: '良好 · 抵御暴风雨',
    cost: {
      wood_plank: 6, // 坚韧木板 x6
      lumber: 3,     // 浮木岛重型方木 x3
      nail: 4,       // 铁钉 x4
      ivy: 3         // 坚韧藤蔓 x3
    },
    solCost: 8, // 或消耗 8 枚 $SOL 代币黑市蓝图一键快造
    upgradeBonusDesc: '适航范围提升至 7.5 海里、解锁 4 格随船货运木箱、远海出航补给消耗减半！支持 8 $SOL 黑市图纸一键快造！'
  },
  tier_3: {
    id: 'tier_3',
    level: 3,
    name: '铁甲远洋双桅探索舰',
    title: 'T3 · 铁甲远洋探索舰',
    icon: '🚢',
    badge: '远洋钢铁旗舰',
    desc: '船身关键部位全面包覆高强度精密铁甲板与防撞钢角，装备复合双桅大风帆与船头防雾铜灯，装载重型深海拖网。',
    maxDistanceKm: 18.0, // 纵横远洋深海
    cargoSlots: 8, // 随船货仓扩至 8 格
    supplyDiscount: 1.0, // 远航补给消耗 100% 全免
    stormResistance: '顶尖 · 免疫深海狂涛',
    hasAutoFishingNet: true, // 每次航行往返船尾拖网自动起获近海渔获
    cost: {
      iron_ingot: 4,  // 矿石岛高温冶炼精密铁锭 x4
      lumber: 6,      // 重型方木 x6
      nail: 6,        // 铁钉 x6
      stone_chunk: 4  // 玄武原石压舱物 x4
    },
    solCost: 18, // 或消耗 18 枚 $SOL 代币黑市蓝图一键快造
    upgradeBonusDesc: '航程上限跃升至 18.0 海里、随船货仓扩至 8 格、远航干粮淡水完全免消耗、解锁返航自动渔网！支持 18 $SOL 黑市图纸一键快造！'
  }
};

export class ShipUpgradeSystem {
  constructor(game) {
    this.game = game;
    this.currentTierLevel = 1; // 默认等级 1 (tier_1)
    // 随船货舱库存：{ [itemId]: count }
    this.cargoInventory = {};
  }

  // 获取当前船只配置
  getCurrentTier() {
    const key = `tier_${this.currentTierLevel}`;
    return VESSEL_TIERS[key] || VESSEL_TIERS.tier_1;
  }

  // 获取下一级船只配置 (若满级则返回 null)
  getNextTier() {
    if (this.currentTierLevel >= 3) return null;
    const nextKey = `tier_${this.currentTierLevel + 1}`;
    return VESSEL_TIERS[nextKey] || null;
  }

  // 获取随船货仓最大格数
  getMaxCargoSlots() {
    return this.getCurrentTier().cargoSlots;
  }

  // 获取当前随船货舱已占用的槽位数
  getUsedCargoSlots() {
    return Object.keys(this.cargoInventory).filter(k => (this.cargoInventory[k] || 0) > 0).length;
  }

  // 获取随船货舱内某种物品数量
  getCargoItemCount(itemKey) {
    return this.cargoInventory[itemKey] || 0;
  }

  // 存入随船货舱 (从玩家背包转入)
  depositToCargo(itemKey, count = 1) {
    if (!this.game || !this.game.ui) return false;
    const inv = this.game.ui.inventory;
    const currentBag = inv[itemKey] || 0;
    if (currentBag < count) return false;

    // 检查货仓容量限制
    const maxSlots = this.getMaxCargoSlots();
    if (maxSlots <= 0) {
      this.game.ui.showToast('⚠️ 当前船只暂未配置随船货仓！请前往船坞升级至【T2 龙骨风帆艇】！', 'medium');
      return false;
    }

    if (!this.cargoInventory[itemKey] && this.getUsedCargoSlots() >= maxSlots) {
      this.game.ui.showToast(`❌ 随船货仓已满 (${this.getUsedCargoSlots()}/${maxSlots})！升级船体可扩充货位！`, 'medium');
      return false;
    }

    // 扣背包，加货舱
    inv[itemKey] -= count;
    if (inv[itemKey] <= 0) delete inv[itemKey];

    this.cargoInventory[itemKey] = (this.cargoInventory[itemKey] || 0) + count;
    soundEngine.playPlaceFurniture();
    this.game.ui.renderInventory();
    return true;
  }

  // 从随船货舱取出 (转入玩家随身背包)
  withdrawFromCargo(itemKey, count = 1) {
    if (!this.game || !this.game.ui) return false;
    const cargoCount = this.cargoInventory[itemKey] || 0;
    if (cargoCount < count) return false;

    // 检查背包容量
    if (this.game.ui.isInventoryFull && this.game.ui.isInventoryFull(itemKey)) {
      this.game.ui.showToast('❌ 随身行囊已满，无法容纳更多物品！', 'medium');
      return false;
    }

    this.cargoInventory[itemKey] -= count;
    if (this.cargoInventory[itemKey] <= 0) delete this.cargoInventory[itemKey];

    this.game.ui.addInventory(itemKey, count);
    soundEngine.playPlaceFurniture();
    return true;
  }

  // 一键将随船货舱的所有货物转运存入营地大储物箱
  unloadCargoToStorage() {
    if (!this.game || !this.game.storageSystem) return 0;
    const storage = this.game.storageSystem;
    let movedTotal = 0;

    const keys = Object.keys(this.cargoInventory);
    for (const k of keys) {
      const count = this.cargoInventory[k] || 0;
      if (count <= 0) continue;

      // 检查储物箱槽位
      if (!storage.storageInventory[k] && storage.usedSlots >= storage.maxCapacity) {
        break; // 储物箱已满
      }

      storage.storageInventory[k] = (storage.storageInventory[k] || 0) + count;
      delete this.cargoInventory[k];
      movedTotal += count;
    }

    if (movedTotal > 0 && this.game.ui) {
      this.game.ui.showToast(`📦 成功将 ${movedTotal} 件随船货物一键卸载并入库【营地储物箱】！`, 'medium');
      soundEngine.playPlaceFurniture();
    }
    return movedTotal;
  }

  // 使用 $SOL 算力代币黑市蓝图一键快造升级
  performSolUpgrade() {
    const nextTier = this.getNextTier();
    if (!nextTier || !nextTier.solCost) {
      if (this.game && this.game.ui) this.game.ui.showToast('已达到最高探索舰等级！', 'medium');
      return false;
    }

    const inv = this.game && this.game.ui ? this.game.ui.inventory : {};
    const solCount = inv['sol_token'] || 0;
    if (solCount < nextTier.solCost) {
      if (this.game && this.game.ui) {
        this.game.ui.showToast(`🪙 所持 $SOL 不足 (需要 ${nextTier.solCost} $SOL，当前持有 ${solCount} $SOL)！请先至营地矿机出块收取！`, 'medium');
      }
      return false;
    }

    inv['sol_token'] -= nextTier.solCost;
    if (inv['sol_token'] <= 0) delete inv['sol_token'];

    // 提升等级
    this.currentTierLevel = nextTier.level;

    if (this.game && this.game.dockShipEntity) {
      this.game.dockShipEntity.updateVesselTier(this.currentTierLevel);
    }

    if (this.game && this.game.ui) {
      this.game.ui.renderInventory();
      soundEngine.playLevelUp();
      this.game.ui.showDialog(
        `🚢 恭喜！出海座驾成功升级为【${nextTier.name}】！`,
        `🎉 消耗 ${nextTier.solCost} 枚 $SOL 算力代币成功激活黑市高级出海蓝图！\n\n• 当前座驾等级: ${nextTier.title}\n• 适航航程: 达到 ${nextTier.maxDistanceKm} 海里\n• 随船货仓: 拥有 ${nextTier.cargoSlots} 格防潮货运位\n• 适航特性: ${nextTier.upgradeBonusDesc}`
      );
    }
    return true;
  }

  // 检查是否满足升级至下一级船只的材料要求 (聚合背包与营地储物箱)
  checkCanUpgrade() {
    const nextTier = this.getNextTier();
    if (!nextTier || !nextTier.cost) return { ok: false, reason: '已达到最高旗舰等级！' };

    const inv = this.game && this.game.ui ? this.game.ui.inventory : {};
    const storage = this.game && this.game.storageSystem ? this.game.storageSystem.storageInventory : {};

    const missing = [];
    const costDetails = [];

    for (const [matKey, needCount] of Object.entries(nextTier.cost)) {
      const bagCount = inv[matKey] || 0;
      const storeCount = storage[matKey] || 0;
      const totalAvailable = bagCount + storeCount;

      costDetails.push({
        matKey,
        needCount,
        bagCount,
        storeCount,
        totalAvailable,
        satisfied: totalAvailable >= needCount
      });

      if (totalAvailable < needCount) {
        missing.push({
          matKey,
          needed: needCount,
          current: totalAvailable
        });
      }
    }

    return {
      ok: missing.length === 0,
      nextTier,
      costDetails,
      missing
    };
  }

  // 执行船只升级改装
  performUpgrade() {
    const check = this.checkCanUpgrade();
    if (!check.ok) {
      if (this.game && this.game.ui) {
        this.game.ui.showToast('❌ 升级资材不足！请根据工程图纸准备充足材料！', 'medium');
      }
      return false;
    }

    const nextTier = check.nextTier;
    const inv = this.game && this.game.ui ? this.game.ui.inventory : {};
    const storage = this.game && this.game.storageSystem ? this.game.storageSystem.storageInventory : {};

    // 扣除材料：优先从背包扣，不足部分从储物箱扣
    for (const [matKey, needCount] of Object.entries(nextTier.cost)) {
      let remain = needCount;

      // 1. 扣背包
      if (inv[matKey]) {
        const take = Math.min(inv[matKey], remain);
        inv[matKey] -= take;
        remain -= take;
        if (inv[matKey] <= 0) delete inv[matKey];
      }

      // 2. 扣储物箱
      if (remain > 0 && storage[matKey]) {
        const take = Math.min(storage[matKey], remain);
        storage[matKey] -= take;
        remain -= take;
        if (storage[matKey] <= 0) delete storage[matKey];
      }
    }

    // 提升等级
    this.currentTierLevel = nextTier.level;

    // 刷新 UI 与场景船只模型
    if (this.game) {
      if (this.game.ui) {
        this.game.ui.renderInventory();
        soundEngine.playCooking(); // 锻造造船声效
        this.game.ui.showDialog(
          `🎉 远洋船坞重大升级 · ${nextTier.title} 建造落成！`,
          `伴随着铁锤叮当与缆绳拉紧，全新一代出海载具【${nextTier.name}】震撼下水！\n\n` +
          `✨ 性能飞跃提升：\n` +
          `• 最大适航范围：${nextTier.maxDistanceKm} 海里（可探索更远海域）\n` +
          `• 随船货舱容量：${nextTier.cargoSlots} 格（不占背包随行装载）\n` +
          `• 远航补给减免：${Math.round(nextTier.supplyDiscount * 100)}% 减免\n` +
          `• 抗风浪评级：${nextTier.stormResistance}\n` +
          `${nextTier.hasAutoFishingNet ? '• 特权加成：解锁【深海自动渔网】，往返自动捞捕近海鲜鱼与珍珠！\n' : ''}\n` +
          `快登上全新旗舰，开启更广阔的海图大征服！`
        );
      }

      // 通知 3D 船只实体更新模型
      if (this.game.dockShipEntity) {
        this.game.dockShipEntity.updateModel(this.currentTierLevel);
      }
    }

    return true;
  }

  // 检查是否具备前往某距离目标岛屿的适航能力
  canReachDistance(distanceKm) {
    const tier = this.getCurrentTier();
    return distanceKm <= tier.maxDistanceKm;
  }

  // 跨岛航行返航时结算随船拖网特权产出 (T3 探索舰专属)
  onVoyageCompleted() {
    const tier = this.getCurrentTier();
    if (!tier.hasAutoFishingNet) return null;

    // 随机产出鲜鱼或珍珠
    const isRare = Math.random() < 0.25;
    const rewardKey = isRare ? 'diamond_gem' : 'fish';
    const rewardName = isRare ? '深海碧蓝珍珠宝石' : '肥美深海鲜鱼';
    const rewardCount = isRare ? 1 : (Math.floor(Math.random() * 2) + 1);

    // 尝试存入随船货仓或背包
    if (this.getUsedCargoSlots() < this.getMaxCargoSlots() || this.cargoInventory[rewardKey]) {
      this.cargoInventory[rewardKey] = (this.cargoInventory[rewardKey] || 0) + rewardCount;
    } else if (this.game && this.game.ui) {
      this.game.ui.addInventory(rewardKey, rewardCount);
    }

    if (this.game && this.game.ui) {
      this.game.ui.showToast(`🎣 【船尾深海拖网】起航归港：起获了 ${rewardName} x${rewardCount}！已收入随船仓！`, 'small');
    }

    return { key: rewardKey, count: rewardCount, name: rewardName };
  }

  // 打开船坞升级与货仓模态弹窗
  openShipyardModal() {
    if (this.game && this.game.ui) {
      this.game.ui.openShipUpgradeModal(this);
    }
  }

  // 序列化
  serialize() {
    return {
      currentTierLevel: this.currentTierLevel,
      cargoInventory: { ...this.cargoInventory }
    };
  }

  // 反序列化
  deserialize(data) {
    if (data && typeof data === 'object') {
      if (typeof data.currentTierLevel === 'number') {
        this.currentTierLevel = Math.max(1, Math.min(3, data.currentTierLevel));
      }
      if (data.cargoInventory && typeof data.cargoInventory === 'object') {
        this.cargoInventory = { ...data.cargoInventory };
      }
    }
  }
}
