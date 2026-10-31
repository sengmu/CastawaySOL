// 移植自 CastawaySOL 原版数值标准：四维指标与步数衰减系统
export class SurvivalSystem {
  constructor(onStatusChange, onGameOver) {
    // 四维状态百分比 (0 - 100) 真实海难初生状态：轻微饥渴与疲惫，推动第一步求生行动
    this.life = 100;
    this.hunger = 55;
    this.water = 50;
    this.fatigue = 35;

    // 生存时间与步数统计
    this.day = 1;
    this.steps = 0;
    this.stepAccumulator = 0;
    this.isDead = false;

    this.onStatusChange = onStatusChange || (() => {});
    this.onGameOver = onGameOver || (() => {});

    // 水壶容量 (最多 3 口清水，每口 +50% Water)
    this.canteenSips = 3;
  }

  // 玩家移动触发步数结算 (对齐 CastawaySOL: 每 5 步 +1% 疲劳，时段平滑衰减)
  recordMovement(distance) {
    if (this.isDead) return;
    this.stepAccumulator += distance;

    if (this.stepAccumulator >= 1.5) { // 约 1 步
      this.steps++;
      this.stepAccumulator = 0;

      // 每 5 步 +1% 疲劳 (出战暖绒金羊时享受疲劳累积减半)
      let fatigueInterval = 5;
      if (typeof window !== 'undefined' && window.__game && window.__game.petCompanion) {
        const mult = window.__game.petCompanion.getFatigueRateMultiplier();
        if (mult > 0) fatigueInterval = Math.round(5 / mult);
      }
      if (this.steps % fatigueInterval === 0) {
        this.fatigue = Math.min(100, this.fatigue + 1);
      }

      // 每 15 步消耗 1% 水分
      if (this.steps % 15 === 0) {
        this.water = Math.max(0, this.water - 1);
      }

      // 每 20 步消耗 1% 饱食度
      if (this.steps % 20 === 0) {
        this.hunger = Math.max(0, this.hunger - 1);
      }

      // 饥饿或脱水濒死惩罚
      if (this.hunger <= 0 || this.water <= 0 || this.fatigue >= 100) {
        this.life = Math.max(0, this.life - 1);
        if (this.life <= 0) {
          this.triggerDeath("荒岛探险体力耗尽");
        }
      }

      this.notify();
    }
  }

  // 饮用水壶
  drinkCanteen() {
    if (this.canteenSips <= 0) {
      return { success: false, msg: "水壶已经空了，需要去清泉灌水！" };
    }
    this.canteenSips--;
    this.water = Math.min(100, this.water + 50);
    this.life = Math.min(100, this.life + 5);
    this.notify();
    return { success: true, msg: `痛快地喝了一口水！饮水度大幅恢复 (剩余 ${this.canteenSips}/3 口)` };
  }

  // 清泉灌满水壶
  refillCanteen() {
    this.canteenSips = 3;
    this.notify();
    return { success: true, msg: "水壶装满了甘甜的清泉水！(3/3 口)" };
  }

  // 进食与补给
  consume(item) {
    if (this.isDead) return;
    let lifeGain = 0;
    let hungerGain = 0;
    let waterGain = 0;
    let fatigueReduce = 0;

    switch (item.id) {
      case 'apple':
        hungerGain = 15; waterGain = 10; break;
      case 'coconut':
        hungerGain = 10; waterGain = 25; fatigueReduce = 5; break;
      case 'baked_fish':
        lifeGain = 20; hungerGain = 35; fatigueReduce = 10; break;
      case 'baked_meat':
        lifeGain = 15; hungerGain = 50; fatigueReduce = 20; break;
      case 'cooked_egg':
        hungerGain = 25; fatigueReduce = 15; break;
      case 'honey':
        lifeGain = 30; hungerGain = 50; waterGain = 10; fatigueReduce = 50; break;
      default:
        hungerGain = 10; break;
    }

    this.life = Math.min(100, this.life + lifeGain);
    this.hunger = Math.min(100, this.hunger + hungerGain);
    this.water = Math.min(100, this.water + waterGain);
    this.fatigue = Math.max(0, this.fatigue - fatigueReduce);

    this.notify();
    return { lifeGain, hungerGain, waterGain };
  }

  // 在帐篷/小屋/篝火旁睡觉休整推进天数
  sleep(quality = 1.0) {
    this.day++;
    this.fatigue = Math.max(0, this.fatigue - Math.round(75 * quality));
    this.life = Math.min(100, this.life + Math.round(30 * quality));
    // 睡眠也会轻微消耗水分和饱食
    this.water = Math.max(0, this.water - 15);
    this.hunger = Math.max(0, this.hunger - 15);
    this.notify();
  }

  // 兼容别名
  sleepOvernight(quality = 1.0) {
    this.sleep(quality);
  }

  triggerDeath(reason) {
    this.isDead = true;
    this.onGameOver(reason);
  }

  notify() {
    this.onStatusChange({
      life: this.life,
      hunger: this.hunger,
      water: this.water,
      fatigue: this.fatigue,
      day: this.day,
      steps: this.steps,
      canteenSips: this.canteenSips
    });
  }
}
