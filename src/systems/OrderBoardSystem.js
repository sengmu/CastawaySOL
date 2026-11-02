// CastawaySOL - 营地每日求生与算力订单板 (Daily Camp Order Board System)
// 第六章自由经营及终局存量消纳：每日拂晓刷新 3 张交付合同（初级采集、加工构件、高阶矿产）；
// 履约交付走 EconomyLedger order_deliver 流入枚举记账；
// 奖励数值经过经济模型防膨胀压测。

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
  ]
};

export class OrderBoardSystem {
  constructor(game) {
    this.game = game;
    this.currentDay = 1;
    this.dailyOrders = [];
    this.completedCount = 0;

    this.refreshOrders(game?.survival?.day || 1);
  }

  // 每日拂晓刷新 3 张订单
  refreshOrders(day) {
    this.currentDay = day || 1;

    // 伪随机可复现哈希，保证同一天生成的订单确定
    const pickIndex = (poolLength, salt) => {
      let h = (this.currentDay * 9301 + 49297 + salt * 233) % 233280;
      return Math.floor((h / 233280) * poolLength);
    };

    const oA = ORDER_POOLS.poolA[pickIndex(ORDER_POOLS.poolA.length, 1)];
    const oB = ORDER_POOLS.poolB[pickIndex(ORDER_POOLS.poolB.length, 2)];
    const oC = ORDER_POOLS.poolC[pickIndex(ORDER_POOLS.poolC.length, 3)];

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
    const inv = this.game?.ui?.inventory || {};
    return this.dailyOrders.map(order => {
      let canFulfill = true;
      const reqStatus = [];

      for (const [itemKey, need] of Object.entries(order.req)) {
        const cur = inv[itemKey] || 0;
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

  // 执行交付履约
  deliverOrder(uniqueId) {
    const order = this.dailyOrders.find(o => o.uniqueId === uniqueId);
    if (!order) {
      return { ok: false, msg: '未找到指定订单' };
    }
    if (order.completed) {
      return { ok: false, msg: '该订单已交付完成' };
    }

    const inv = this.game?.ui?.inventory || {};

    // 检查所需物品
    for (const [itemKey, need] of Object.entries(order.req)) {
      if ((inv[itemKey] || 0) < need) {
        return { ok: false, msg: `缺少所需材料【${itemKey}】！需 ${need} 件` };
      }
    }

    // 扣除材料
    for (const [itemKey, need] of Object.entries(order.req)) {
      inv[itemKey] -= need;
      if (inv[itemKey] <= 0) delete inv[itemKey];
    }

    // 账本发放代币奖励 (order_deliver)
    economyLedger(this.game).credit('sol_token', order.tokenReward, 'order_deliver');

    // 额外材料/代币奖励
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

    return { ok: true, rewardTokens: order.tokenReward };
  }

  serialize() {
    return {
      currentDay: this.currentDay,
      dailyOrders: structuredClone(this.dailyOrders),
      completedCount: this.completedCount
    };
  }

  deserialize(data) {
    if (!data) return;
    if (typeof data.currentDay === 'number') this.currentDay = data.currentDay;
    if (typeof data.completedCount === 'number') this.completedCount = data.completedCount;
    if (Array.isArray(data.dailyOrders)) {
      this.dailyOrders = structuredClone(data.dailyOrders);
    }
  }
}
