import * as THREE from 'three';
import { soundEngine } from '../core/AudioSystem.js';
import { haptics } from '../core/HapticFeedback.js';

export class FishingSystem {
  constructor(scene, player, ui, survival, game = null) {
    this.scene = scene;
    this.player = player;
    this.ui = ui;
    this.survival = survival;
    this.game = game;

    this.state = 'idle'; // idle | waiting | bite | hooked
    this.biteTimer = 0;
    this.bobber = null;

    this.createBobber();
  }

  // 检测海皇圣物是否已在北崖星海谐振塔归位（对晶石与声望 RS 严格零影响，仅提升稀有海产率）
  isPoseidonRelicActive() {
    const g = this.game || (typeof window !== 'undefined' ? window.__game : null);
    return Boolean(g?.lighthouse?.phase2Complete || g?.lighthouse?.poseidonRelicEnshrined);
  }

  // 获取当前垂钓稀有海产概率（基础 10%，海皇圣物归位后提升至 45%）
  getRareSeafoodChance() {
    return this.isPoseidonRelicActive() ? 0.45 : 0.10;
  }

  // 按当前权重抽取收竿渔获
  rollCatchOutcome(rng = Math.random) {
    const r = rng();
    if (r < 0.20) {
      return { itemId: 'broken_radio', isRareSeafood: false, notice: '🍾 钓出了一个装有零件的漂流罐，获得了【坏收音机】！' };
    }
    const rareChance = this.getRareSeafoodChance();
    if (r < 0.20 + rareChance) {
      const sub = (r - 0.20) / rareChance;
      if (sub < 0.26) {
        return { itemId: 'pearl', isRareSeafood: true, notice: '🦪 海皇潮汐眷顾！钓获了晶莹温润的【天然珍珠】！' };
      }
      if (sub < 0.52) {
        return { itemId: 'sea_crab', isRareSeafood: true, notice: '🦀 成功钓起一只膏满黄肥的【潮间带红蟹】！' };
      }
      if (sub < 0.76) {
        return { itemId: 'clam', isRareSeafood: true, notice: '🐚 钓起了一枚鲜甜饱满的【浅滩花蛤】！' };
      }
      return { itemId: 'sardine', isRareSeafood: true, notice: '🐟 收获了一条银光闪闪的【银鳞沙丁鱼】！' };
    }
    return { itemId: 'fish', isRareSeafood: false, notice: '🎉 哇！成功钓到了一条鲜活肥美的大鱼 🐟！' };
  }

  createBobber() {
    const group = new THREE.Group();
    // 经典红白双色钓鱼浮标
    const topGeo = new THREE.SphereGeometry(0.14, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const topMat = new THREE.MeshStandardMaterial({ color: 0xee3322, roughness: 0.2 });
    const topMesh = new THREE.Mesh(topGeo, topMat);

    const botGeo = new THREE.SphereGeometry(0.14, 8, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const botMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const botMesh = new THREE.Mesh(botGeo, botMat);

    group.add(topMesh);
    group.add(botMesh);
    group.visible = false;

    this.bobber = group;
    this.scene.add(this.bobber);
  }

  // 检测玩家是否处于近海或栈桥码头可钓鱼区域
  isNearWater(playerPos) {
    // 码头区域 (-31 < x < -25, z > 30)
    const isAtPier = playerPos.x > -33 && playerPos.x < -23 && playerPos.z > 28;
    // 环岛沙滩近海边缘 (|x| > 38 || |z| > 32)
    const isAtBeachEdge = Math.abs(playerPos.x) > 37 || Math.abs(playerPos.z) > 31;
    return isAtPier || isAtBeachEdge;
  }

  // 抛竿或收竿动作响应
  handleAction() {
    if (this.state === 'idle') {
      if (!this.ui.inventory.fishingrod || this.ui.inventory.fishingrod <= 0) {
        this.ui.showBubbleNotice('背包里没有鱼竿！先去工作台用【木棍x2 + 藤蔓x1】制作一根吧！', 'medium');
        return false;
      }

      // 开始抛竿
      this.state = 'waiting';
      const lookDir = new THREE.Vector3(
        Math.sin(this.player.rotation),
        0,
        Math.cos(this.player.rotation)
      ).normalize();

      // 浮标落在前方 3.5 米水面上
      this.bobber.position.copy(this.player.position).addScaledVector(lookDir, 3.5);
      this.bobber.position.y = -0.32;
      this.bobber.visible = true;

      haptics.medium();
      soundEngine.playSplash();
      this.ui.showBubbleNotice('🎣 抛竿入水！静心等待鱼儿咬钩……', 'small');

      // 2.5 ~ 4.5 秒后咬钩 (出战海月玄猫雷蒙德时享受 35% 提速加成)
      let biteMult = 1.0;
      if (typeof window !== 'undefined' && window.__game && window.__game.petCompanion) {
        biteMult = window.__game.petCompanion.getFishingBiteTimeMultiplier();
      }
      this.biteTimer = (2.2 + Math.random() * 2.3) * biteMult;
      return true;
    } else if (this.state === 'bite') {
      // 成功起竿！
      this.state = 'idle';
      this.bobber.visible = false;
      haptics.success();
      soundEngine.playSplash();

      // 抽取渔获（海皇圣物归位后大幅提升天然珍珠/红蟹/花蛤/沙丁鱼等稀有海产钓获率）
      const outcome = this.rollCatchOutcome();
      this.ui.addInventory(outcome.itemId, 1);
      this.ui.showBubbleNotice(outcome.notice, 'small');
      return true;
    } else if (this.state === 'waiting') {
      // 太早起竿，鱼惊跑了
      this.state = 'idle';
      this.bobber.visible = false;
      haptics.light();
      this.ui.showBubbleNotice('收竿太早了，鱼儿被吓跑了……', 'medium');
      return true;
    }
    return false;
  }

  update(delta) {
    if (this.state === 'waiting') {
      // 浮标在水面随微波上下浮动
      this.bobber.position.y = -0.32 + Math.sin(Date.now() * 0.006) * 0.03;
      this.biteTimer -= delta;
      if (this.biteTimer <= 0) {
        this.state = 'bite';
        haptics.warning();
        soundEngine.playItemDrop();
        this.ui.showBubbleNotice('❗ 鱼咬钩了！快点击【🎣收竿】！', 'important');
        // 咬钩后给 1.8 秒反应窗口
        this.escapeTimer = 1.8;
      }
    } else if (this.state === 'bite') {
      // 剧烈下沉晃动
      this.bobber.position.y = -0.42 + Math.sin(Date.now() * 0.03) * 0.06;
      this.escapeTimer -= delta;
      if (this.escapeTimer <= 0) {
        this.state = 'idle';
        this.bobber.visible = false;
        haptics.light();
        this.ui.showBubbleNotice('哎呀！收竿慢了一步，大鱼脱钩游走了！', 'medium');
      }
    }
  }
}
