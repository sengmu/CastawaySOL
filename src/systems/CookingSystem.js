import { ISLAND_LAYOUT, distanceXZ } from '../core/IslandLayout.js';
import { soundEngine } from '../core/AudioSystem.js';
import { haptics } from '../core/HapticFeedback.js';

export class CookingSystem {
  constructor(ui, survival) {
    this.ui = ui;
    this.survival = survival;
    // 营地篝火坐标
    this.campfirePos = { x: ISLAND_LAYOUT.campfire[0], z: ISLAND_LAYOUT.campfire[2] };
  }

  // 检测玩家是否处于篝火旁
  isNearCampfire(playerPos) {
    const dx = playerPos.x - this.campfirePos.x;
    const dz = playerPos.z - this.campfirePos.z;
    return Math.sqrt(dx * dx + dz * dz) < 3.2;
  }

  // 烹饪逻辑
  cook() {
    const inv = this.ui.inventory;
    if (inv.raw_meat && inv.raw_meat > 0) {
      inv.raw_meat -= 1;
      inv.cooked_meat = (inv.cooked_meat || 0) + 1;
      soundEngine.playCooking();
      haptics.success();
      this.ui.renderInventory();
      this.ui.showBubbleNotice('🔥 在营火上滋滋烤熟了金黄多汁的排骨，获得了【香烤野味排骨 🍖】！', 'small');
      if (typeof window !== 'undefined' && window.__game && window.__game.story && window.__game.story.onCookFood) {
        window.__game.story.onCookFood();
      }
      return true;
    } else if (inv.crab_meat && inv.crab_meat > 0) {
      inv.crab_meat -= 1;
      inv.cooked_crab = (inv.cooked_crab || 0) + 1;
      soundEngine.playCooking();
      haptics.success();
      this.ui.renderInventory();
      this.ui.showBubbleNotice('🔥 烤熟了肥美鲜红的蟹肉，获得了【香烤极品红蟹 🦀】！', 'small');
      if (typeof window !== 'undefined' && window.__game && window.__game.story && window.__game.story.onCookFood) {
        window.__game.story.onCookFood();
      }
      return true;
    } else if (inv.fish && inv.fish > 0) {
      inv.fish -= 1;
      inv.baked_fish = (inv.baked_fish || 0) + 1;
      soundEngine.playCooking();
      haptics.success();
      this.ui.renderInventory();
      this.ui.showBubbleNotice('🔥 在温暖的篝火上烤熟了一条大鱼，获得了【香烤大鱼 🍱】！', 'small');
      if (typeof window !== 'undefined' && window.__game && window.__game.story && window.__game.story.onCookFood) {
        window.__game.story.onCookFood();
      }
      return true;
    } else if (inv.apple && inv.apple > 0) {
      inv.apple -= 1;
      inv.baked_apple = (inv.baked_apple || 0) + 1;
      soundEngine.playCooking();
      haptics.success();
      this.ui.renderInventory();
      this.ui.showBubbleNotice('🔥 烤熟了一颗金黄诱人的苹果，获得了【烤苹果 🥧】！', 'small');
      if (typeof window !== 'undefined' && window.__game && window.__game.story && window.__game.story.onCookFood) {
        window.__game.story.onCookFood();
      }
      return true;
    } else {
      haptics.light();
      this.ui.showBubbleNotice('没有可以烹饪的食材！先去海边捕蟹 🦀、狩猎野猪 🐗、钓鱼 🐟 或采苹果 🍎 吧！', 'medium');
      return false;
    }
  }
}
