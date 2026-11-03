// CastawaySOL - 营地每日求生与算力订单板 (Daily Camp Order Board System)
// 第六章自由经营及终局存量消纳：每日拂晓刷新 3 张交付合同（初级采集、加工构件、高阶矿产）；
// D4 升级：第 6 章起动态并入高阶远洋矿产订单，支持背包+营地储物箱联合库存履约；
// 当日全部 3 单完成后触发全勤奖励【船长全勤餐盒】，闭环反哺高阶共振勘探。
// 履约交付走 EconomyLedger order_deliver 流入枚举记账；奖励数值经过经济模型防膨胀压测。

import { economyLedger } from './EconomyLedger.js';
import { soundEngine } from '../core/AudioSystem.js';

export const ORDER_POOLS = {
  // A 类：初级自然采集物 (奖励 2 算力代币)
  poolA: [
    { id: 'order_apple', name: '果林甜品供给', req: { apple: 3 }, tokenReward: 2, desc: '营地工匠急需鲜美红苹果补充维生素' },
    { id: 'order_stone', name: '营建地基碎石', req: { stone_chunk: 4 }, tokenReward: 2, desc: '加固储物木箱与防潮地台所需坚硬燧石' },
    { id: 'order_branch', name: '篝火干燥柴禾', req: { tree_branch: 4 }, tokenReward: 2, desc: '维持营火夜间常亮所需的坚韧木棍' }
  ],
  // B 类：工匠加工构件 (奖励 3 算力代币 + 1 古代金币)
  poolB: [
    { id: 'order_plank', name: '船坞方木构件', req: { wood_plank: 2 }, tokenReward: 3, extraReward: { ancient_coin: 1 }, desc: '船坞扩建防浪板所需的规整木板' },
    { id: 'order_iron', name: '矿业精密铁构件', req: { iron_ingot: 1 }, tokenReward: 3, extraReward: { ancient_coin: 1 }, desc: '冶炼纯净铁锭，用于改装高耐磨矿镐' },
    { id: 'order_nail', name: '紧固沉船钢钉', req: { nail: 2 }, tokenReward: 3, extraReward: { ancient_coin: 1 }, desc: '加固码头浮桥与防波堤所需铁钉' }
  ],
  // C 类：高阶晶石与精炼物 (奖励 4 算力代币)
  poolC: [
    { id: 'order_crystal', name: '原石能量配额', req: { sol_crystal: 2 }, tokenReward: 4, desc: '紧急支援矿机解密与电网稳压的未解密原石' },
    { id: 'order_pure', name: '纯晶高阶科研', req: { sol_crystal_pure: 1 }, tokenReward: 4, desc: '供学者雷蒙德开展量子地脉勘探的高纯度硅晶' }
  ],
  // D 类：第 6 章终局远洋高阶矿产订单 (奖励 5 算力代币，需第 6 章解锁)
  poolD: [
    { id: 'order_copper', name: '孔雀铜矿精粹供给', req: { copper_ore: 3 }, tokenReward: 5, desc: '晶雾回声岛特有孔雀绿铜矿，用于远洋导航仪校准' },
    { id: 'order_deep_crystal', name: '深层海脉晶核研究', req: { sol_crystal_deep: 2 }, tokenReward: 5, desc: '星海谐振塔地脉频率调谐所需的深层共振晶核' },
    { id: 'order_pearl', name: '深海母贝珍珠征集', req: { pearl: 2 }, tokenReward: 5, desc: '海皇圣物研究院征集的远洋天然珍珠原浆' }
  ]
};

export class OrderBoardSystem {
  constructor(game) {
    this.game = game;
    this.currentDay = 1;
    this.dailyOrders = [];
    this.completedCount = 0;
    this.fullAttendanceClaimedDay = null;

    this.refreshOrders(game?.survival?.day || 1);
  }

  // 判断当前是否已进入第 6 章终局自由经营（解锁 D 类高阶订单）
  isEndgameChapter() {
    const story = this.game?.story;
    if (!story) return false;
    return story.isCompleted === true || story.currentChapterId >= 6;
  }

  // 每日拂晓刷新 3 张订单
  refreshOrders(day) {
    this.currentDay = day || 1;
    this.fullAttendanceClaimedDay = null;

    // 伪随机可复现哈希，保证同一天生成的订单确定
    const pickIndex = (poolLength, salt) => {
      let h = (this.currentDay * 9301 + 49297 + salt * 233) % 233280;
      return Math.floor((h / 233280) * poolLength);
    };

    const oA = ORDER_POOLS.poolA[pickIndex(ORDER_POOLS.poolA.length, 1)];
    const oB = ORDER_POOLS.poolB[pickIndex(ORDER_POOLS.poolB.length, 2)];

    // D4：第 6 章起 C 类订单替换为 D 类高阶远洋矿产订单
    let oC;
    if (this.isEndgameChapter()) {
      oC = ORDER_POOLS.poolD[pickIndex(ORDER_POOLS.poolD.length, 3)];
    } else {
      oC = ORDER_POOLS.poolC[pickIndex(ORDER_POOLS.poolC.length, 3)];
    }

    this.dailyOrders = [
      { ...oA, uniqueId: `day_${this.currentDay}_A`, category: 'primary', completed: false },
      { ...oB, uniqueId: `day_${this.currentDay}_B`, category: 'crafting', completed: false },
      { ...oC, uniqueId: `day_${this.currentDay}_C`, category: 'mineral', completed: false }
    ];
  }

  // 跨天通知钩子
  onNewDay(day) {
    this.refreshOrders(day);
  }

  onDayPassed(day) {
    const nextDay = day || (this.game?.survival?.day ? this.game.survival.day + 1 : this.currentDay + 1);
    this.refreshOrders(nextDay);
  }

  // 获取所有当前订单状态
  getOrders() {
    return this.dailyOrders.map(order => {
      let canFulfill = true;
      const reqStatus = [];

      for (const [itemKey, need] of Object.entries(order.req)) {
        const inv = this.game?.ui?.inventory || {};
        const box = this.game?.storageSystem?.storageInventory || {};
        const cur = (inv[itemKey] || 0) + (box[itemKey] || 0);
        if (cur < need) canFulfill = false;
        reqStatus.push({ itemKey, key: itemKey, need, cur, satisfied: cur >= need });
      }

      return {
        ...order,
        canFulfill,
        reqStatus
      };
    });
  }

  getOrdersWithStatus() {
    return this.getOrders();
  }

  // 执行交付履约（D4：优先扣背包，差额从营地储物箱扣减）
  deliverOrder(uniqueId) {
    const order = this.dailyOrders.find(o => o.uniqueId === uniqueId);
    if (!order) {
      return { ok: false, msg: '未找到指定订单' };
    }
    if (order.completed) {
      return { ok: false, msg: '该订单已交付完成' };
    }

    const inv = this.game?.ui?.inventory || {};
    const box = this.game?.storageSystem?.storageInventory || {};

    // 联合校验
    for (const [itemKey, need] of Object.entries(order.req)) {
      const combined = (inv[itemKey] || 0) + (box[itemKey] || 0);
      if (combined < need) {
        return { ok: false, msg: `缺少所需材料【${itemKey}】！需 ${need} 件（背包+储物箱合计 ${combined}）` };
      }
    }

    // 优先扣背包，差额扣储物箱
    for (const [itemKey, need] of Object.entries(order.req)) {
      let remaining = need;
      const fromBag = Math.min(inv[itemKey] || 0, remaining);
      if (fromBag > 0) {
        inv[itemKey] -= fromBag;
        if (inv[itemKey] <= 0) delete inv[itemKey];
        remaining -= fromBag;
      }
      if (remaining > 0) {
        box[itemKey] = Math.max(0, (box[itemKey] || 0) - remaining);
        if (box[itemKey] <= 0) delete box[itemKey];
      }
    }

    // 账本发放代币奖励 (order_deliver)
    economyLedger(this.game).credit('sol_token', order.tokenReward, 'order_deliver');

    // 额外材料奖励
    if (order.extraReward) {
      for (const [k, v] of Object.entries(order.extraReward)) {
        inv[k] = (inv[k] || 0) + v;
      }
    }

    order.completed = true;
    this.completedCount++;

    soundEngine.playVictory();
    if (this.game?.ui) {
      this.game.ui.renderInventory();
      this.game.ui.showToast(`📜 成功完成订单【${order.name}】！获得 +${order.tokenReward} 算力代币！`, 'medium');
    }

    if (this.game?.saveSystem) {
      this.game.saveSystem.saveGame('order_deliver');
    }

    // D4：检查当日全勤（3 单全部完成后发放【船长全勤餐盒】）
    const todayCompleted = this.dailyOrders.filter(o => o.completed).length;
    if (todayCompleted >= 3 && this.fullAttendanceClaimedDay !== this.currentDay) {
      this._claimFullAttendanceBonus();
    }

    return { ok: true, rewardTokens: order.tokenReward };
  }

  // D4：全勤奖励发放（附赠船长全勤餐盒 + 随机共振料理）
  _claimFullAttendanceBonus() {
    this.fullAttendanceClaimedDay = this.currentDay;
    const inv = this.game?.ui?.inventory || {};
    inv.captain_lunchbox = (inv.captain_lunchbox || 0) + 1;
    const bonusItem = Math.random() < 0.5 ? 'resonance_crab_pot' : 'energy_drink';
    inv[bonusItem] = (inv[bonusItem] || 0) + 1;
    if (this.game?.ui) {
      this.game.ui.renderInventory();
      this.game.ui.showDialog(
        '🍱【船长全勤奖励】当日三单全勤达成！',
        `今日三张订单全部完成！营地厨师特别准备了丰盛的全勤奖励：\n\n• 🍱 船长全勤餐盒 ×1（大幅补充生命值、饱食度与水分）\n• ${bonusItem === 'resonance_crab_pot' ? '🍲 共振椰子蟹煲 ×1（矿机共振晶爆增益 3 轮）' : '🧃 高浓度能量饮料 ×1（疲劳快速恢复）'}\n\n坚持每日全勤，让地脉矿机以最高效率运转！`
      );
    }
    if (this.game?.saveSystem) {
      this.game.saveSystem.saveGame('order_full_attendance');
    }
  }

  serialize() {
    return {
      currentDay: this.currentDay,
      dailyOrders: structuredClone(this.dailyOrders),
      completedCount: this.completedCount,
      fullAttendanceClaimedDay: this.fullAttendanceClaimedDay
    };
  }

  deserialize(data) {
    if (!data) return;
    if (typeof data.currentDay === 'number') this.currentDay = data.currentDay;
    if (typeof data.completedCount === 'number') this.completedCount = data.completedCount;
    if (typeof data.fullAttendanceClaimedDay === 'number') this.fullAttendanceClaimedDay = data.fullAttendanceClaimedDay;
    if (Array.isArray(data.dailyOrders)) {
      this.dailyOrders = structuredClone(data.dailyOrders);
    }
  }
}
