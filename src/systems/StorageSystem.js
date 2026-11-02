import { economyLedger, isEconomyResource } from './EconomyLedger.js';
// CastawaySOL - 营地储物箱管理系统 (Camp Storage System)
// 支持营地储物箱物品存放、取出、一键整理、容量扩容与 Schema v1 存档保护
import { soundEngine } from '../core/AudioSystem.js';

export class StorageSystem {
  constructor(game) {
    this.game = game;
    // 基础储物槽位上限 (可通过制作或商业化特权扩容)
    this.baseCapacity = 16;
    this.bonusCapacity = 0; // 扩容附加槽位

    // 存储箱库存映射：{ itemKey: count }
    this.storageInventory = {
      wood_plank: 1, // 初始备用资材
      tree_branch: 2
    };
    this.isOpen = false;
    this.activeStorageId = null;
  }

  // 获取当前总容量上限
  get maxCapacity() {
    return this.baseCapacity + this.bonusCapacity;
  }

  // 获取已占用的物品种类数
  get usedSlots() {
    return Object.keys(this.storageInventory).filter(k => (this.storageInventory[k] || 0) > 0).length;
  }

  // 扩展储物箱容量
  expandCapacity(extraSlots = 16) {
    this.bonusCapacity += extraSlots;
    if (this.game && this.game.ui) {
      this.game.ui.showToast(`📦 营地储物空间成功扩容 +${extraSlots} 格！(当前总容量: ${this.maxCapacity})`, 'medium');
    }
    return this.maxCapacity;
  }

  // 获取储物箱内某物品数量
  getItemCount(itemKey) {
    return this.storageInventory[itemKey] || 0;
  }

  // 存入物品 (从玩家背包转入储物箱，带容量校验)
  depositItem(itemKey, count = 1) {
    if (!this.game || !this.game.ui) return false;
    const inv = this.game.ui.inventory;
    const currentBag = inv[itemKey] || 0;
    if (currentBag < count) return false;

    // 若储物箱尚未存放该物品，检查是否达到种类上限
    if (!this.storageInventory[itemKey] && this.usedSlots >= this.maxCapacity) {
      if (this.game.ui.showToast) {
        this.game.ui.showToast(`❌ 储物箱已满 (${this.usedSlots}/${this.maxCapacity})，请使用【仓储扩容蓝图】提升容量！`, 'medium');
      }
      return false;
    }

    // 扣背包
    if (isEconomyResource(itemKey)) {
      economyLedger(this.game).transfer(itemKey, count, 'storage_deposit', inv, itemKey, this.storageInventory, itemKey);
    } else {
      inv[itemKey] -= count;
      this.storageInventory[itemKey] = (this.storageInventory[itemKey] || 0) + count;
    }
    if (inv[itemKey] <= 0) delete inv[itemKey];

    soundEngine.playItemDrop();
    this.game.ui.renderInventory();
    return true;
  }

  // 一键存入所有基础建材与资源 (类似《疯狂水世界》减负便捷操作)
  depositAllMaterials() {
    if (!this.game || !this.game.ui) return 0;
    const inv = this.game.ui.inventory;
    const materialKeys = [
      'tree_branch', 'stone_chunk', 'wood_plank', 'nail',
      'big_rock', 'driftwood_chest', 'ivy', 'battery', 'broken_radio'
    ];

    let totalDeposited = 0;
    for (const key of materialKeys) {
      const count = inv[key];
      if (count && count > 0) {
        if (!this.storageInventory[key] && this.usedSlots >= this.maxCapacity) {
          break;
        }
        inv[key] -= count;
        if (inv[key] <= 0) delete inv[key];
        this.storageInventory[key] = (this.storageInventory[key] || 0) + count;
        totalDeposited += count;
      }
    }

    if (totalDeposited > 0) {
      soundEngine.playItemDrop();
      this.game.ui.renderInventory();
      if (this.game.ui.showToast) {
        this.game.ui.showToast(`📦 一键归仓成功！已将 ${totalDeposited} 件建材存入营地储物箱。`, 'medium');
      }
    }
    return totalDeposited;
  }

  // 取出物品 (从储物箱转入玩家背包)
  withdrawItem(itemKey, count = 1) {
    if (!this.game || !this.game.ui) return false;
    const currentBox = this.storageInventory[itemKey] || 0;
    if (currentBox < count) return false;

    // 检查玩家背包是否能容纳
    if (this.game.ui.isInventoryFull && this.game.ui.isInventoryFull(itemKey)) {
      this.game.ui.showToast('❌ 行囊已满，无法携带更多不同种类的物品！', 'medium');
      return false;
    }

    // 扣储物箱
    if (isEconomyResource(itemKey)) {
      economyLedger(this.game).transfer(itemKey, count, 'storage_withdraw', this.storageInventory, itemKey, this.game.ui.inventory, itemKey);
    } else {
      this.storageInventory[itemKey] -= count;
      this.game.ui.addInventory(itemKey, count);
    }
    if (this.storageInventory[itemKey] <= 0) delete this.storageInventory[itemKey];

    soundEngine.playItemDrop();
    this.game.ui.renderInventory();
    return true;
  }

  // 打开储物箱界面
  openStorage(storageId = 'camp_chest') {
    this.isOpen = true;
    this.activeStorageId = storageId;
    if (this.game && this.game.ui) {
      this.game.ui.openStorageModal(this);
    }
  }

  // 关闭储物箱界面
  closeStorage() {
    this.isOpen = false;
    this.activeStorageId = null;
  }

  // 序列化与存档
  serialize() {
    return {
      storageInventory: { ...this.storageInventory },
      bonusCapacity: this.bonusCapacity
    };
  }

  // 反序列化恢复
  deserialize(data) {
    if (data && typeof data === 'object') {
      if (data.storageInventory && typeof data.storageInventory === 'object') {
        this.storageInventory = { ...data.storageInventory };
      }
      if (typeof data.bonusCapacity === 'number') {
        this.bonusCapacity = data.bonusCapacity;
      }
    }
  }
}
