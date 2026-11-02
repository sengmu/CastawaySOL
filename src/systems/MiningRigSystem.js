import { economyLedger } from './EconomyLedger.js';
// CastawaySOL - 荒岛绿色解密矿机与 DePIN 算力系统 (Green Mining Rig & DePIN System)
// 结合荒岛废土朋克与 Solana 绿色公链生态：
// 1. 实体建筑：利用漂流木架、沉船太阳能硅晶板、收音机芯片与铜线组装的手搓解密矿机；
// 2. 算力驱动：消耗【未解密硅晶原石 sol_crystal】，结合白天日光太阳能与生物质蓄电池发电；
// 3. 出块结算：移动步数与实时时间推进哈希运算，出块产出【荒岛算力代币 sol_token】。

import * as THREE from 'three';
import { soundEngine } from '../core/AudioSystem.js';
import { haptics } from '../core/HapticFeedback.js';
import { ODDS_TABLE, cyrb53, genRoundSeed, genCluster, genNpcBoard, settle } from './resonance/ResonanceEngine.js';

export const DECRYPT_REWARD = Object.freeze({ base: 2, bonusChance: 0.35, turboChance: 0.45 });
export const SCANNER_COSTS = Object.freeze({1: 0, 2: 45, 3: 165});
export const FREE_SHARES = Object.freeze({ daily: 3, cap: 6, minMs: 15 * 60 * 1000, minSteps: 200 });

export function resonanceRoundRS(res, deploy, board) {
  const shares = res.winningSquare >= 0 ? (deploy[res.winningSquare] || 0) : 0;
  const total = shares + (board ? (board[res.winningSquare] || 0) : 0);
  return res.hit ? 10 + Math.round(20 * shares / Math.max(1, total)) : (deploy.some(v => v > 0) ? 2 : 0);
}

export class MiningRigSystem {
  constructor(game) {
    this.game = game;

    // 营地矿机固定锚点坐标（位于营地西侧开阔平地，靠近储物箱）
    this.anchor = new THREE.Vector3(-10.5, 0.05, 20.0);

    // 矿机运行数据
    this.isActive = true;                // 初始预装硅晶原石后默认通电运行
    this.hashrate = 85.5;               // 基础算力 (MH/s)
    this.totalBlocksMined = 0;           // 历史已验证区块总数
    this.totalSolMined = 0;             // 历史挖出算力代币总数

    // 矿仓与燃料
    this.loadedCrystals = 0;
    economyLedger(game).credit('sol_crystal', 1, 'initial_silo', this, 'loadedCrystals');            // 初始已预装 1 块硅晶原石体验
    this.maxCrystalCapacity = 10;       // 最大矿石装载上限
    this.batteryPower = 75;             // 备用蓄电池电量 (0 ~ 100%)
    this.maxBattery = 100;              // 蓄电池最大上限
    this.isOverclocked = false;         // 是否装载 DePIN 超频算力芯片 (+100% 算力)
    this.hasLithiumPack = false;        // 是否装载航天级固态锂电池组
    this.hashProgress = 0;              // 当前区块解密进度 (0 ~ 100)
    this.hashSpeed = 15;                // 每秒哈希解密进度

    // 狂暴超频与手动增压模式 (Turbo / Overdrive Mode)
    this.turboTimer = 0;                // 狂暴剩余时间 (秒)
    this.turboBoostMultiplier = 1.0;    // 狂暴倍率
    this.manualTapCombo = 0;            // 手动连续点按连击数
    this.lastTapTime = 0;

    // 待领取的产出槽
    this.unclaimedSol = 0;              // 待收取的算力代币

    // 矿脉共振勘探系统字段 (Resonance Mode)
    this.rigMode = 'decrypt';           // 'decrypt' | 'resonance'
    this.rigLevel = 1;
    this.loadedPureCrystals = 0;
    this.shardCount = 0;
    this.solDust = 0;
    this.scannerLevel = 0;
    this.T_base = 120;

    this.resonance = {
      roundId: 1,
      phase: 'OPEN',
      progress: 0,
      revealTimer: 0,
      seedCommit: '',
      roundSeed: '',
      seedReveal: '',
      lockPool: 0,
      lockWeather: 'clear',
      lockBuff: null,
      buffDay: game?.survival?.day || 1,
      fullHeat: false,
      board: null,
      cluster: null,
      deploy: new Array(25).fill(0),
      committed: false,
      committedShares: 0,
      committedDeploy: new Array(25).fill(0),
      lastResult: null,
      history: [],
      calib: 0,
      freeShares: 0,
      freeGrantDay: 1,
      freeGrantTs: Date.now(),
      freeGrantSteps: 0,
      buff: { id: null, roundsLeft: 0 },
      autoRepeat: { pattern: null, roundsLeft: 0 }
    };

    economyLedger(game).credit('sol_crystal', FREE_SHARES.daily, 'resonance_free', this.resonance, 'freeShares');

    this.motherlode = {
      pool: 0,
      injected: 0,
      paid: 0,
      burned: 0,
      hallOfFame: []
    };

    this.season = {
      id: 1,
      rs: 0,
      countedToday: 0,
      utcDay: 1
    };

    // 出块 3D 粒子对象池
    this.burstCoinPool = [];
    this.burstCoinCount = 12;

    this.group = new THREE.Group();
    this.group.name = 'depin-mining-rig-entity';
    if (this.game && this.game.scene) {
      this.game.scene.add(this.group);
    }

    this.initEntityMesh();
    this.initSkyBeam();
    this.initBurstParticles();
  }

  // 构建矿机 3D 拟真模型
  initEntityMesh() {
    const rigGroup = new THREE.Group();
    rigGroup.position.copy(this.anchor);

    // 1. 原木加固基座
    const baseGeo = new THREE.BoxGeometry(1.2, 0.18, 1.0);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x4e342e,
      roughness: 0.9
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.09;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    rigGroup.add(baseMesh);

    // 2. 倾斜太阳能硅晶板 (朝向天空采集日光)
    const panelGroup = new THREE.Group();
    panelGroup.position.set(0, 0.65, -0.15);
    panelGroup.rotation.x = -Math.PI / 6;

    const panelFrameGeo = new THREE.BoxGeometry(0.95, 0.04, 0.65);
    const panelFrameMat = new THREE.MeshStandardMaterial({ color: 0x2d3436, metalness: 0.8 });
    const panelFrame = new THREE.Mesh(panelFrameGeo, panelFrameMat);
    panelGroup.add(panelFrame);

    // 太阳能深蓝晶格吸光面
    const cellGeo = new THREE.PlaneGeometry(0.88, 0.58);
    const cellMat = new THREE.MeshStandardMaterial({
      color: 0x0984e3,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0x0652dd,
      emissiveIntensity: 0.35
    });
    const cellMesh = new THREE.Mesh(cellGeo, cellMat);
    cellMesh.rotation.x = -Math.PI / 2;
    cellMesh.position.y = 0.025;
    panelGroup.add(cellMesh);
    rigGroup.add(panelGroup);

    // 3. 矿机主运算机箱 (收音机+铁板焊接改制)
    const chassisGeo = new THREE.BoxGeometry(0.55, 0.42, 0.45);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x3d3d3d,
      roughness: 0.65,
      metalness: 0.7
    });
    this.chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
    this.chassisMesh.position.set(0, 0.32, 0.15);
    this.chassisMesh.castShadow = true;
    rigGroup.add(this.chassisMesh);

    // 4. 前置高速机械散热风扇 (运转时持续旋转)
    this.fanGroup = new THREE.Group();
    this.fanGroup.position.set(0, 0.32, 0.38);

    const fanRingGeo = new THREE.TorusGeometry(0.12, 0.02, 8, 16);
    const fanRingMat = new THREE.MeshStandardMaterial({ color: 0x636e72, metalness: 0.8 });
    const fanRing = new THREE.Mesh(fanRingGeo, fanRingMat);
    this.fanGroup.add(fanRing);

    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x14f195, roughness: 0.3 });
    for (let i = 0; i < 4; i++) {
      const bladeGeo = new THREE.BoxGeometry(0.03, 0.18, 0.01);
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.rotation.z = (i * Math.PI) / 2;
      this.fanGroup.add(blade);
    }
    rigGroup.add(this.fanGroup);

    // 5. Solana 赛博青紫双色发光哈希状态脉冲灯
    const ledGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x14f195,
      emissive: 0x14f195,
      emissiveIntensity: 0.8
    });
    this.statusLed = new THREE.Mesh(ledGeo, ledMat);
    this.statusLed.position.set(0.18, 0.45, 0.38);
    rigGroup.add(this.statusLed);

    // 6. 地表 DePIN 算力信标光环 (有待领取代币时扩散呼吸)
    const beaconGeo = new THREE.RingGeometry(0.65, 0.82, 20);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0x9945ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45
    });
    this.beaconRing = new THREE.Mesh(beaconGeo, beaconMat);
    this.beaconRing.rotation.x = -Math.PI / 2;
    this.beaconRing.position.y = 0.03;
    rigGroup.add(this.beaconRing);

    this.group.add(rigGroup);
  }

  // 初始化直插天际的 DePIN 算力光柱 (贯通苍穹，全岛可见)
  initSkyBeam() {
    this.beamGroup = new THREE.Group();
    this.beamGroup.position.copy(this.anchor);
    this.beamGroup.position.y += 0.8;

    // 核心内光柱 (青绿高亮)
    const innerGeo = new THREE.CylinderGeometry(0.12, 0.28, 42.0, 12, 1, true);
    innerGeo.translate(0, 21.0, 0);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x14f195,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.innerBeam = new THREE.Mesh(innerGeo, innerMat);
    this.beamGroup.add(this.innerBeam);

    // 外围脉冲光环晕 (紫色弥散光)
    const outerGeo = new THREE.CylinderGeometry(0.35, 0.75, 40.0, 12, 1, true);
    outerGeo.translate(0, 20.0, 0);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x9945ff,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.outerBeam = new THREE.Mesh(outerGeo, outerMat);
    this.beamGroup.add(this.outerBeam);

    // 顶端向外溢散的微粒环 (2 个交替上升)
    this.beamRings = [];
    for (let i = 0; i < 3; i++) {
      const ringGeo = new THREE.RingGeometry(0.3, 0.45, 16);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = i * 2.5;
      ring.userData = { initialY: i * 2.5, speed: 1.8 + i * 0.4 };
      this.beamGroup.add(ring);
      this.beamRings.push(ring);
    }

    this.group.add(this.beamGroup);
  }

  // 初始化出块爆裂金币与粒子池 (对象池复用)
  initBurstParticles() {
    this.burstGroup = new THREE.Group();
    this.burstGroup.position.copy(this.anchor);
    this.burstGroup.position.y += 0.8;

    const coinGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 10);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xfed330,
      emissive: 0xffa801,
      emissiveIntensity: 0.6,
      metalness: 0.9,
      roughness: 0.2
    });

    for (let i = 0; i < this.burstCoinCount; i++) {
      const coin = new THREE.Mesh(coinGeo, coinMat);
      coin.visible = false;
      coin.userData = {
        vel: new THREE.Vector3(),
        rotSpeed: new THREE.Vector3(),
        life: 0,
        maxLife: 1.2
      };
      this.burstGroup.add(coin);
      this.burstCoinPool.push(coin);
    }

    // 出块冲击波光环
    const shockwaveGeo = new THREE.RingGeometry(0.2, 0.4, 24);
    shockwaveGeo.rotateX(-Math.PI / 2);
    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0x14f195,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.shockwave = new THREE.Mesh(shockwaveGeo, shockwaveMat);
    this.shockwave.position.y = 0.1;
    this.shockwave.userData = { life: 0, maxLife: 0.9 };
    this.burstGroup.add(this.shockwave);

    this.group.add(this.burstGroup);
  }

  // 触发一次惊艳的出块爆金币物理喷涌视效
  triggerBlockBurstFX() {
    // 1. 激活冲击波扩散
    if (this.shockwave) {
      this.shockwave.userData.life = 1.0;
      this.shockwave.scale.set(1, 1, 1);
      this.shockwave.material.opacity = 0.85;
      this.shockwave.material.color.setHex(this.turboTimer > 0 ? 0xffd32a : 0x14f195);
    }

    // 2. 喷射 8~12 枚旋转金币
    for (const coin of this.burstCoinPool) {
      coin.visible = true;
      coin.position.set(0, 0.1, 0);
      const angle = Math.random() * Math.PI * 2;
      const speedH = 0.8 + Math.random() * 1.5;
      coin.userData.vel.set(
        Math.cos(angle) * speedH,
        2.5 + Math.random() * 2.0, // 向上喷射
        Math.sin(angle) * speedH
      );
      coin.userData.rotSpeed.set(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      );
      coin.userData.life = 1.0;
      coin.userData.maxLife = 0.8 + Math.random() * 0.4;
      coin.scale.setScalar(1.0);
    }
  }

  // 投入硅晶原石 sol_crystal 进行解密运算
  loadCrystal(count = 1) {
    const inv = this.game.ui.inventory;
    if ((inv['sol_crystal'] || 0) < count) {
      this.game.ui.showToast('行囊中硅晶原石不足，前往后山崖壁开采矿脉！', 'medium');
      return false;
    }

    if (this.loadedCrystals + count > this.maxCrystalCapacity) {
      this.game.ui.showToast(`矿机晶石仓已满 (上限 ${this.maxCrystalCapacity} 块)！`, 'medium');
      return false;
    }

    economyLedger(this.game).transfer('sol_crystal', count, 'rig_load', inv, 'sol_crystal', this, 'loadedCrystals');
    if (inv['sol_crystal'] <= 0) delete inv['sol_crystal'];
    this.isActive = true;

    this.game.ui.renderInventory();
    haptics.success();
    soundEngine.playItemDrop();
    this.game.ui.showToast(`💎 成功装入【未解密硅晶原石】x${count}！矿机进入高速哈希运算解密状态！`, 'small');

    return true;
  }

  // 补充蓄电池电量 (投入电池、树脂或木柴)
  rechargeBattery(itemKey) {
    const inv = this.game.ui.inventory;
    if ((inv[itemKey] || 0) <= 0) return false;

    let rechargeAmt = 0;
    if (itemKey === 'battery') rechargeAmt = 50;
    else if (itemKey === 'tree_sap') rechargeAmt = 25;
    else if (itemKey === 'tree_branch') rechargeAmt = 12;
    else return false;

    inv[itemKey]--;
    if (inv[itemKey] <= 0) delete inv[itemKey];

    this.batteryPower = Math.min(this.maxBattery, this.batteryPower + rechargeAmt);

    this.game.ui.renderInventory();
    haptics.medium();
    soundEngine.playPlaceFurniture();
    this.game.ui.showToast(`⚡ 成功注入能源【${this.game.ui.getItemName(itemKey)}】！矿机蓄电量回升至 ${this.batteryPower}%！`, 'small');

    return true;
  }

  // 解锁 DePIN 超频算力芯片
  unlockOverclock() {
    this.isOverclocked = true;
    this.hashSpeed = 30;
    this.hashrate = 171.0;
    this.T_base = 90; // 共振轮次缩短至 90 秒
  }

  // 解锁航天级固态锂电池组
  unlockLithiumPack() {
    this.hasLithiumPack = true;
    this.maxBattery = 200;
    this.batteryPower = 200;
  }

  setMode(mode) {
    if (mode !== 'decrypt' && mode !== 'resonance') return;
    this.rigMode = mode;
  }

  getCapacityU() {
    const levelInfo = ODDS_TABLE.RIG_LEVELS[this.rigLevel] || ODDS_TABLE.RIG_LEVELS[1];
    return levelInfo.u;
  }

  ensureResonanceRound() {
    if (!this.resonance.cluster) {
      const saveSeed = this.game?.saveSystem?.saveSeed || 'castaway';
      this.resonance.cluster = genCluster(saveSeed, this.resonance.roundId);
      this.resonance.roundSeed ||= genRoundSeed(saveSeed, this.resonance.roundId);
      this.resonance.seedCommit = cyrb53(this.resonance.roundSeed).toString(16);
      const phaseMult = ODDS_TABLE.PHASE_MULTIPLIERS[this.getPhaseKey()];
      const weatherMult = ODDS_TABLE.WEATHER_MULTIPLIERS[this.game?.weatherSystem?.currentWeather] || 1.0;
      this.resonance.board = genNpcBoard(this.resonance.roundSeed, this.getCapacityU(), phaseMult, weatherMult, 1.0, this.resonance.cluster);
    }
  }

  // 部署份额
  placeShares(sq, n = 1) {
    if (this.resonance.phase !== 'OPEN') {
      return { ok: false, msg: '当前轮次已锁定或正在揭晓中，无法调整部署！' };
    }
    const levelInfo = ODDS_TABLE.RIG_LEVELS[this.rigLevel] || ODDS_TABLE.RIG_LEVELS[1];
    const k = levelInfo.k;
    const C = levelInfo.C;

    // 当前已选格子集合
    const activeSquares = this.resonance.deploy.map((v, i) => v > 0 ? i : -1).filter(i => i >= 0);
    const isNewSquare = !activeSquares.includes(sq);

    if (n > 0) {
      if (isNewSquare && activeSquares.length >= k) {
        return { ok: false, msg: `当前等级仅支持同时勘探 ${k} 个矿格！升级矿机可扩充格数` };
      }
      const curTotal = this.resonance.deploy.reduce((a, b) => a + b, 0);
      if (curTotal + n > C) {
        return { ok: false, msg: `单轮投入已达当前矿机上限 (${C} 份额)！` };
      }
      // 检查可用料仓 (免费份额优先，原石其次)
      const available = this.resonance.freeShares + this.loadedCrystals;
      const pendingTotal = curTotal + n - (this.resonance.committedShares || 0);
      if (pendingTotal > available) {
        return { ok: false, msg: `料仓原石不足 (可用: ${available} 份)！请先补充原石` };
      }
      this.resonance.deploy[sq] = (this.resonance.deploy[sq] || 0) + n;
    } else if (n < 0) {
      if (this.resonance.committed) {
        return { ok: false, msg: '本轮部署已确认提交，不可撤回，仅可继续追加！' };
      }
      const cur = this.resonance.deploy[sq] || 0;
      this.resonance.deploy[sq] = Math.max(0, cur + n);
    }
    return { ok: true, deploy: this.resonance.deploy };
  }

  // 一键均分
  autoSplitEven() {
    if (this.resonance.phase !== 'OPEN') return { ok: false, msg: '当前不可部署' };
    if (this.resonance.committed) return { ok: false, msg: '已提交不可均分' };

    const levelInfo = ODDS_TABLE.RIG_LEVELS[this.rigLevel] || ODDS_TABLE.RIG_LEVELS[1];
    const C = levelInfo.C;
    const available = Math.min(C, this.resonance.freeShares + this.loadedCrystals);
    if (available <= 0) return { ok: false, msg: '料仓晶石不足' };

    let activeSquares = this.resonance.deploy.map((v, i) => v > 0 ? i : -1).filter(i => i >= 0);
    if (activeSquares.length === 0) {
      this.ensureResonanceRound();
      if (this.scannerLevel >= 2 && this.resonance.cluster) {
        activeSquares = this.resonance.cluster.heatIndices.slice(0, levelInfo.k);
      } else {
        activeSquares = [12, 11, 13].slice(0, levelInfo.k);
      }
    }

    this.resonance.deploy.fill(0);
    const perSq = Math.floor(available / activeSquares.length);
    const rem = available % activeSquares.length;
    activeSquares.forEach((sq, idx) => {
      this.resonance.deploy[sq] = perSq + (idx === 0 ? rem : 0);
    });
    return { ok: true, deploy: this.resonance.deploy };
  }

  // All-in 单格集中投入
  allIn(sq) {
    if (this.resonance.phase !== 'OPEN') return { ok: false, msg: '当前不可部署' };
    if (this.resonance.committed) return { ok: false, msg: '已提交不可修改' };

    const levelInfo = ODDS_TABLE.RIG_LEVELS[this.rigLevel] || ODDS_TABLE.RIG_LEVELS[1];
    const C = levelInfo.C;
    const available = Math.min(C, this.resonance.freeShares + this.loadedCrystals);
    if (available <= 0) return { ok: false, msg: '料仓晶石不足' };

    this.resonance.deploy.fill(0);
    this.resonance.deploy[sq] = available;
    return { ok: true, deploy: this.resonance.deploy };
  }

  // 确认提交本轮部署
  commitDeployment() {
    if (this.resonance.phase !== 'OPEN') return { ok: false, msg: '当前不可部署' };
    const alreadyCommitted = this.resonance.committedShares || 0;
    const totalShares = this.resonance.deploy.reduce((a, b) => a + b, 0);
    if (totalShares < 2) return { ok: false, msg: '每轮至少部署 2 份！' };
    if (totalShares <= alreadyCommitted) return { ok: false, msg: '本轮部署已全部提交！' };

    // 扣除料仓与免费份额
    let remainToDeduct = totalShares - alreadyCommitted;
    if (remainToDeduct > this.resonance.freeShares + this.loadedCrystals) {
      return { ok: false, msg: '料仓原石不足，无法确认新增份额！' };
    }
    if (this.resonance.freeShares > 0) {
      const takeFree = Math.min(this.resonance.freeShares, remainToDeduct);
      economyLedger(this.game).debit('sol_crystal', takeFree, 'resonance_commit', this.resonance, 'freeShares');
      remainToDeduct -= takeFree;
    }
    if (remainToDeduct > 0) {
      economyLedger(this.game).debit('sol_crystal', remainToDeduct, 'resonance_commit', this, 'loadedCrystals');
    }

    this.resonance.committed = true;
    this.resonance.committedShares = totalShares;
    this.resonance.committedDeploy = [...this.resonance.deploy];
    soundEngine.playPlaceFurniture();
    haptics.medium();

    if (this.game?.saveSystem) {
      this.game.saveSystem.saveGame('resonance_commit');
    }
    return { ok: true, totalShares };
  }

  // 装载高纯度精炼硅晶 (单格折算 2.5 份高权重份额)
  loadPureCrystal(count = 1) {
    const inv = this.game?.ui?.inventory;
    if (!inv || (inv['sol_crystal_pure'] || 0) < count) {
      if (this.game?.ui) this.game.ui.showToast('背包中高纯度精炼硅晶不足！', 'medium');
      return false;
    }
    if (this.loadedPureCrystals + count > this.maxCrystalCapacity) {
      if (this.game?.ui) this.game.ui.showToast('矿机纯晶装载已达上限！', 'medium');
      return false;
    }
    inv['sol_crystal_pure'] -= count;
    if (inv['sol_crystal_pure'] <= 0) delete inv['sol_crystal_pure'];
    this.loadedPureCrystals += count;
    if (this.game?.ui) {
      this.game.ui.renderInventory();
      this.game.ui.showToast(`✨ 成功装载 ${count} 块高纯度硅晶 (单格折算 2.5 份高权重份额)！`, 'small');
    }
    return true;
  }

  // 安装地质扫描仪
  installScanner(level) {
    if (level === 1 && this.game?.story && this.game.story.currentChapterId < 2) {
      return { ok: false, msg: '地质共振扫描仪 Mk1 研制技术尚未解锁（需进入第二章）' };
    }
    const itemKey = `geo_scanner_mk${level}`;
    const inv = this.game?.ui?.inventory;
    if (!inv || (inv[itemKey] || 0) <= 0) {
      return { ok: false, msg: `背包中缺少【${itemKey}】！需在合成台研制` };
    }
    const fee = SCANNER_COSTS[level];
    if (fee > 0 && (inv['sol_token'] || 0) < fee) {
      return { ok: false, msg: `装机算力代币不足 (需要 ${fee} 算力代币)！` };
    }

    inv[itemKey]--;
    if (inv[itemKey] <= 0) delete inv[itemKey];
    if (fee > 0) {
      economyLedger(this.game).debit('sol_token', fee, 'scanner');
      if (inv['sol_token'] <= 0) delete inv['sol_token'];
      this.onSinkSpent(fee, 'scanner');
    }

    this.scannerLevel = Math.max(this.scannerLevel, level);
    if (this.game?.ui) {
      this.game.ui.renderInventory();
      this.game.ui.showToast(`🛰️ 成功安装【地质共振扫描仪 Mk${level}】！地脉透视增强！`, 'important');
    }
    if (this.game?.saveSystem) {
      this.game.saveSystem.saveGame('install_scanner');
    }
    return { ok: true, level: this.scannerLevel };
  }

  // 应用料理增益
  applyResonanceBuff(id) {
    this.resonance.buffDay = this.game?.survival?.day || 1;
    if (id === 'energy_drink') {
      this.resonance.buff = { id: 'energy_drink', name: '专注', roundsLeft: 2 };
    } else if (id === 'smoked_fish') {
      this.resonance.buff = { id: 'smoked_fish', name: '稳手', roundsLeft: 3 };
    } else if (id === 'resonance_crab_pot') {
      this.resonance.buff = { id: 'resonance_crab_pot', name: '晶爆', roundsLeft: 3 };
    }
  }

  // 消费 15% 自动注入母晶池
  onSinkSpent(amount, source = 'general') {
    if (typeof amount !== 'number' || amount <= 0) return;
    const inject = Math.round(amount * ODDS_TABLE.MOTHERLODE.sinkShare);
    if (inject > 0) {
      this.motherlode.injected += inject;
      this.motherlode.pool = Math.min(ODDS_TABLE.MAX_MOTHERLODE_POOL, this.motherlode.pool + inject);
    }
  }

  // 跨游戏日发放免费份额（防刷睡：需同时满足新自然日 + 实际间隔>=15分钟 + 期间步数>=200）
  onNewDay(currentDay) {
    const now = Date.now();
    const r = this.resonance;
    if (currentDay !== (r.buffDay ?? this.game?.survival?.day)) r.buff = { id: null, roundsLeft: 0 };
    r.buffDay = currentDay;
    const isNewDay = currentDay > (r.freeGrantDay || 0);
    const hasEnoughTime = (now - (r.freeGrantTs || 0)) >= FREE_SHARES.minMs;
    const currentSteps = this.game?.survival?.steps || 0;
    const hasEnoughSteps = (currentSteps - (r.freeGrantSteps || 0)) >= FREE_SHARES.minSteps;

    if (isNewDay && hasEnoughTime && hasEnoughSteps) {
      r.freeGrantDay = currentDay;
      r.freeGrantTs = now;
      r.freeGrantSteps = currentSteps;
      economyLedger(this.game).credit('sol_crystal', Math.min(FREE_SHARES.daily, FREE_SHARES.cap - (r.freeShares || 0)), 'resonance_free', r, 'freeShares');
      if (this.game?.ui) {
        this.game.ui.showToast('🌅 新的一天！地脉感应发放 3 份免费共振勘探份额！', 'medium');
      }
    }
  }

  advanceResonanceProgress(dProg) {
    this.ensureResonanceRound();

    if (this.resonance.phase === 'OPEN') {
      this.resonance.progress = Math.min(100, this.resonance.progress + dProg);
      if (this.resonance.progress >= 80) {
        this.resonance.phase = 'LOCK';
        // 锁定计算结果并落盘
        const res = settle(this.resonance.board, this.resonance.committedDeploy, this.motherlode.pool, {
          u: this.getCapacityU(),
          roundSeed: this.resonance.roundSeed,
          cluster: this.resonance.cluster,
          buffId: this.resonance.buff ? this.resonance.buff.id : null,
          weather: this.game?.weatherSystem?.currentWeather || 'clear',
          currentCalib: this.resonance.calib
        });
        this.resonance.lockU = this.getCapacityU();
        this.resonance.lockWeather = this.game?.weatherSystem?.currentWeather || 'clear';
        this.resonance.lockPool = this.motherlode.pool;
        this.resonance.lockBuff = { ...this.resonance.buff };
        this.resonance.lastResult = res;
        if (this.game?.saveSystem) {
          this.game.saveSystem.saveGame('resonance_lock');
        }
      }
    } else if (this.resonance.phase === 'LOCK') {
      this.resonance.progress = Math.min(100, this.resonance.progress + dProg);
      if (this.resonance.progress >= 100) {
        this.resonance.phase = 'REVEAL';
        this.resonance.revealTimer = (this.resonance.lastResult?.motherlode?.won) ? 10.0 : 7.5;
      }
    }
  }

  tickResonance(delta) {
    const isDay = this.isDaytime();
    if (!isDay && this.batteryPower > 0) {
      this.batteryPower = Math.max(0, this.batteryPower - delta * 0.2);
    }

    if (this.resonance.phase === 'REVEAL') {
      this.resonance.revealTimer -= delta;
      if (this.resonance.revealTimer <= 0) {
        this.settleResonanceRound();
      }
      return;
    }

    const powerMultiplier = isDay ? 1.0 : (this.batteryPower > 0 ? 0.8 : 0.5);
    const T_base = this.isOverclocked ? 90 : 120;
    const dProg = delta * (100.0 / T_base) * powerMultiplier;
    this.advanceResonanceProgress(dProg);
  }

  settleResonanceRound() {
    const res = this.resonance.lastResult;
    if (!res || this.resonance.phase !== 'REVEAL') return { ok: false, msg: '当前没有待结算的共振结果' };
    const before = structuredClone(this.serialize());
    const ledgerBefore = economyLedger(this.game).serialize();
    if (res) {
      // Re-evaluate the locked draw against the live pool; seed/board/deployment remain fixed.
      if (this.resonance.roundSeed && this.resonance.board) {
        const live = settle(this.resonance.board, this.resonance.committedDeploy, this.motherlode.pool, {
          u: this.resonance.lockU || this.getCapacityU(), roundSeed: this.resonance.roundSeed, cluster: this.resonance.cluster,
          buffId: this.resonance.lockBuff?.id, weather: this.resonance.lockWeather || this.game?.weatherSystem?.currentWeather || 'clear', currentCalib: this.resonance.calib
        });
        res.motherlode = live.motherlode;
      }
      this.creditPayout(res.payout, 'resonance_main');
      economyLedger(this.game).credit('sol_shard', res.shards, 'resonance_shard', this, 'shardCount');
      this.resonance.calib = res.calib;

      // 4 残晶折算 1 晶石
      while (this.shardCount >= 4 && this.loadedCrystals < this.maxCrystalCapacity) {
        economyLedger(this.game).debit('sol_shard', 4, 'shard_condense', this, 'shardCount');
        economyLedger(this.game).credit('sol_crystal', 1, 'shard_condense', this, 'loadedCrystals');
      }

      if (this.resonance.roundSeed && this.resonance.board) this.motherlode.pool = res.motherlode.nextPool;
      else this.motherlode.pool = Math.max(0, Math.min(ODDS_TABLE.MAX_MOTHERLODE_POOL, this.motherlode.pool + res.motherlode.nextPool - this.resonance.lockPool));
      this.resonance.fullHeat = false;
      if (this.resonance.committedDeploy.some(v => v > 0)) {
        if (this.resonance.buff.roundsLeft > 0 && --this.resonance.buff.roundsLeft === 0) this.resonance.buff = { id: null, roundsLeft: 0 };
      }
      if (res.calibReward) {
        economyLedger(this.game).credit('sol_crystal', res.calibReward.crystals, 'resonance_calib', this, 'loadedCrystals');
        this.resonance.fullHeat = Boolean(res.calibReward.fullHeat);
      }
      if (res.motherlode.won) {
        this.creditPayout(res.motherlode.playerTake, 'resonance_ml');
        this.motherlode.paid += res.motherlode.playerTake;
        this.motherlode.burned += res.motherlode.npcBurned;
        this.motherlode.hallOfFame.unshift({
          roundId: this.resonance.roundId,
          playerTake: res.motherlode.playerTake,
          poolSize: res.motherlode.nextPool + res.motherlode.playerTake,
          ts: Date.now()
        });
        if (this.motherlode.hallOfFame.length > 20) this.motherlode.hallOfFame.pop();
      }

      this.totalBlocksMined++;
      this.resonance.history.unshift({
        roundId: this.resonance.roundId,
        winningSquare: res.winningSquare,
        hit: res.hit,
        payout: res.payout,
        crit: res.crit.name,
        shards: res.shards
      });
      if (this.resonance.history.length > 50) this.resonance.history.pop();

      // 记录共振勘探赛季积分 (RS)
      const roundRS = resonanceRoundRS(res, this.resonance.deploy, this.resonance.board);
      this.season.rs = (this.season.rs || 0) + roundRS;
      if (this.game?.solanaBridge?.submitResonanceProof) {
        this.game.solanaBridge.submitResonanceProof(this.season.rs, this.resonance.roundId);
      }

    }

    // 重置进入下一轮
    this.resonance.seedReveal = this.resonance.roundSeed;
    this.resonance.roundId++;
    this.resonance.progress = 0;
    this.resonance.phase = 'OPEN';
    this.resonance.deploy = new Array(25).fill(0);
    this.resonance.committed = false;
    this.resonance.committedShares = 0;
    this.resonance.committedDeploy = new Array(25).fill(0);
    this.resonance.cluster = null;
    this.resonance.board = null;
    this.resonance.roundSeed = '';
    this.resonance.seedCommit = '';
    this.resonance.lastResult = null;

    const saved = this.game?.saveSystem?.saveGame?.('resonance_settle');
    if (saved && saved.success === false) {
      this.deserialize(before);
      economyLedger(this.game).deserialize(ledgerBefore);
      return { ok: false, msg: saved.msg || '结算存档失败，请稍后重试' };
    }
    if (this.game?.solanaBridge) {
      this.game.solanaBridge.submitMiningProof(this.totalBlocksMined, this.totalSolMined);
    }
    return { ok: true };
  }

  // 步数驱动：玩家在海岛上探索跑图产生的感应电能与时间潮汐推进
  recordMovement(stepCount = 1) {
    if (this.rigMode === 'resonance') {
      this.advanceResonanceProgress(stepCount * 0.6);
      return;
    }
    if (this.loadedCrystals <= 0) return;

    // 每移动 10 步推进一格哈希运算
    const stepBonus = stepCount * 1.2;
    this.advanceHashProgress(stepBonus);
  }

  // 手动狂暴增压点按 (Tap-to-Boost / Manual Turbo)
  triggerManualBoost() {
    if (this.rigMode === 'resonance') {
      if (this.game && this.game.ui) {
        this.game.ui.showToast('共振勘探模式下禁用狂暴增压，请根据地脉节奏部署', 'small');
      }
      return false;
    }
    if (this.loadedCrystals <= 0) {
      if (this.game && this.game.ui) {
        this.game.ui.showToast('⚠️ 矿机晶石仓为空，请先装填【未解密硅晶原石】！', 'medium');
      }
      return false;
    }

    const now = performance.now();
    if (now - this.lastTapTime < 1200) {
      this.manualTapCombo = Math.min(20, this.manualTapCombo + 1);
    } else {
      this.manualTapCombo = 1;
    }
    this.lastTapTime = now;

    // 延长超频狂暴时长 (上限 20 秒)
    this.turboTimer = Math.min(20.0, this.turboTimer + 2.5);

    // 瞬时推进一步哈希进度 (连击数越高，瞬时爆发越强)
    const comboBonus = 1.2 + Math.min(this.manualTapCombo * 0.15, 2.0);
    this.advanceHashProgress(comboBonus);

    // 手机马达与声效反馈
    haptics.heavy();
    soundEngine.playItemDrop();

    return {
      combo: this.manualTapCombo,
      turboTimer: this.turboTimer,
      boostGain: comboBonus
    };
  }

  // 推进哈希出块计算
  advanceHashProgress(amount) {
    if (this.loadedCrystals <= 0) {
      this.isActive = false;
      return;
    }

    this.isActive = true;
    this.hashProgress += amount;

    // 满 100% 成功出块 (Block Validated)
    if (this.hashProgress >= 100) {
      this.hashProgress = 0;
      this.totalBlocksMined++;

      // 消耗 1 块硅晶原石
      economyLedger(this.game).debit('sol_crystal', 1, 'decrypt_consume', this, 'loadedCrystals');

      // 产出 1~2 枚算力代币 (超频状态下有 45% 几率狂暴暴击 +1)
      const isCrit = (this.turboTimer > 0) && (Math.random() < DECRYPT_REWARD.turboChance);
      const baseReward = DECRYPT_REWARD.base + (Math.random() < DECRYPT_REWARD.bonusChance ? 1 : 0);
      const reward = baseReward + (isCrit ? 1 : 0);

      economyLedger(this.game).credit('sol_token', reward, 'decrypt', this, 'unclaimedSol');
      this.totalSolMined += reward;

      // 触发 3D 物理爆金币与冲击波全屏视效
      this.triggerBlockBurstFX();

      // 同步成绩至 Solana 链上/本地凭证桥
      if (this.game.solanaBridge) {
        this.game.solanaBridge.submitMiningProof(this.totalBlocksMined, this.totalSolMined);
      }

      // 出块音效与提示
      soundEngine.playLevelUp();
      haptics.success();
      if (this.game && this.game.ui) {
        const critTag = isCrit ? ' 💥【超频狂暴暴击双倍】' : '';
        this.game.ui.showToast(`⛏️✨ 恭喜！矿机成功验证新区块 #${this.totalBlocksMined}！${critTag} 产出【算力代币】x${reward}！`, 'important');
      }

      if (this.loadedCrystals <= 0) {
        this.isActive = false;
      }
    }
  }

  // 判定当前海岛是否为白天 (日出至日落，享有太阳能 100% 绿色增益)
  isDaytime() {
    const key = this.getPhaseKey();
    return key === ODDS_TABLE.PHASE_KEY_MAP.day || key === ODDS_TABLE.PHASE_KEY_MAP.sunrise;
  }

  getPhaseKey() {
    return ODDS_TABLE.PHASE_KEY_MAP[this.game?.dayNight?.currentMode] || ODDS_TABLE.PHASE_KEY_MAP.day;
  }

  getScannerLevel() {
    return this.resonance.fullHeat ? 3 : Math.min(3, this.scannerLevel + (this.resonance.buff.id === 'energy_drink' && this.resonance.buff.roundsLeft > 0 ? 1 : 0));
  }

  creditPayout(amount, source = 'resonance_main') {
    // Record fractional production once; dust-to-whole conversion is internal.
    const pending = { value: this.solDust };
    economyLedger(this.game).credit('sol_token', amount, source, pending, 'value');
    const combined = Math.round(pending.value * 1e8) / 1e8;
    const whole = Math.floor(combined);
    this.solDust = Math.round((combined - whole) * 1e8) / 1e8;
    this.unclaimedSol += whole;
    this.totalSolMined += whole;
  }

  upgradeRig() {
    const next = this.rigLevel + 1;
    const fee = ODDS_TABLE.UPGRADE_COSTS[next];
    if (!fee) return { ok: false, msg: '矿机已达满级' };

    if (this.game?.story) {
      const ch = this.game.story.currentChapterId;
      if (next === 2 && ch < 3) {
        return { ok: false, msg: '矿机 L2 升级许可尚未解锁（需进入第三章）' };
      }
      if (next === 3 && (ch < 4 || (!this.game.story.raymondRescued && !this.game.timberIsleScene?.survivorRescued))) {
        return { ok: false, msg: '矿机 L3 图纸尚未解锁（需在第四章远航浮木岛营救学者雷蒙德）' };
      }
      if (next === 4 && (ch < 5 || (!this.game.story.lighthouseLit && !this.game.lighthouse?.isLit))) {
        return { ok: false, msg: '矿机 L4 终极算力图纸尚未解锁（需在第五章点亮北崖灯塔一期）' };
      }
    }

    const inv = this.game?.ui?.inventory;
    if (!inv || (inv.sol_token || 0) < fee) return { ok: false, msg: `算力代币不足，需要 ${fee} 枚` };
    const before = structuredClone(this.serialize());
    const ledgerBefore = economyLedger(this.game).serialize();
    const walletBefore = inv.sol_token;
    economyLedger(this.game).debit('sol_token', fee, 'rig_upgrade');
    this.onSinkSpent(fee, 'rig_upgrade');
    this.rigLevel = next;
    this.maxCrystalCapacity = ODDS_TABLE.RIG_LEVELS[next].capacity;
    const saved = this.game?.saveSystem?.saveGame?.('rig_upgrade');
    if (saved?.success === false) { inv.sol_token = walletBefore; economyLedger(this.game).deserialize(ledgerBefore); this.deserialize(before); return { ok: false, msg: '升级存档失败' }; }
    this.game?.ui?.renderInventory?.();
    return { ok: true };
  }

  // 一键收取已挖出的算力代币
  claimSolTokens() {
    // 4 残晶自动折算为 1 晶石入料仓
    while (this.shardCount >= 4 && this.loadedCrystals < this.maxCrystalCapacity) {
      economyLedger(this.game).debit('sol_shard', 4, 'shard_condense', this, 'shardCount');
      economyLedger(this.game).credit('sol_crystal', 1, 'shard_condense', this, 'loadedCrystals');
    }

    if (this.unclaimedSol <= 0) {
      this.game.ui.showToast('矿机产出槽空空如也，静待下一个区块验证出块！', 'medium');
      return false;
    }

    const count = this.unclaimedSol;
    const inv = this.game.ui.inventory;
    economyLedger(this.game).transfer('sol_token', count, 'claim_payout', this, 'unclaimedSol', inv, 'sol_token');

    this.game.ui.renderInventory();
    haptics.success();
    soundEngine.playItemDrop();

    this.game.ui.showDialog(
      '💎 荒岛算力代币收取成功！',
      `成功从营地绿色矿机中收取 ${count} 枚【荒岛算力代币 (sol_token)】！\n\n• 当前背包持有: ${inv['sol_token']} 枚\n• 累计验证区块: ${this.totalBlocksMined} 个\n• 残晶储备: ${this.shardCount} 枚 (每满 4 枚自动凝聚为硅晶原石)\n\n【提示：前往【海岛补给与算力黑市】可兑换稀有出海造船图纸与自动化特权，成绩已同步至 Solana 赛季榜！】`
    );

    return true;
  }

  // 每帧动画动效与算力推进
  update(delta) {
    if (this.rigMode === 'resonance') {
      this.tickResonance(delta);
      return;
    }

    const isDay = this.isDaytime();
    // F4: 夜间平滑按秒耗电: 0.2%/秒
    if (!isDay && this.batteryPower > 0) {
      this.batteryPower = Math.max(0, this.batteryPower - delta * 0.2);
    }

    // 基础能源与超频倍率
    const isTurbo = this.turboTimer > 0;
    const turboBonus = isTurbo ? (2.2 + Math.min(this.manualTapCombo * 0.08, 1.2)) : 1.0;
    const powerMultiplier = (isDay ? 1.5 : (this.batteryPower > 0 ? 1.0 : 0.3)) * turboBonus;

    const isRigRunning = this.isActive && this.loadedCrystals > 0;

    if (isRigRunning) {
      // 散热风扇狂飙飞转 (超频时极速轰鸣)
      if (this.fanGroup) {
        this.fanGroup.rotation.z += delta * (isTurbo ? 48.0 : 18.0) * powerMultiplier;
      }

      // 指示灯脉冲呼吸 (超频时金黄闪耀，平时青紫交替)
      const time = Date.now() * 0.008;
      if (this.statusLed) {
        this.statusLed.material.emissiveIntensity = 0.6 + Math.sin(time * (isTurbo ? 3.0 : 1.0)) * 0.4;
        const ledColor = isTurbo ? 0xffd32a : (isDay ? 0x14f195 : 0x9945ff);
        this.statusLed.material.color.setHex(ledColor);
        this.statusLed.material.emissive.setHex(ledColor);
      }

      // 实时时间平滑推进解密 (受超频狂暴加速驱动)
      this.advanceHashProgress(delta * this.hashSpeed * 0.25 * powerMultiplier);
    } else {
      // 待机慢转
      if (this.fanGroup) {
        this.fanGroup.rotation.z += delta * 1.5;
      }
      if (this.statusLed) {
        this.statusLed.material.emissiveIntensity = 0.2;
        this.statusLed.material.color.setHex(0x636e72);
        this.statusLed.material.emissive.setHex(0x2d3436);
      }
    }

    // 2. 天际 DePIN 算力光柱渲染与呼吸动态
    if (this.beamGroup) {
      this.beamGroup.visible = isRigRunning;
      if (isRigRunning) {
        const beamPulse = 0.5 + Math.sin(Date.now() * 0.004) * 0.2;
        if (this.innerBeam) {
          this.innerBeam.material.opacity = (isTurbo ? 0.85 : 0.45) * beamPulse;
          this.innerBeam.material.color.setHex(isTurbo ? 0xfffa65 : 0x14f195);
        }
        if (this.outerBeam) {
          this.outerBeam.material.opacity = (isTurbo ? 0.45 : 0.22) * beamPulse;
          this.outerBeam.material.color.setHex(isTurbo ? 0xff7675 : 0x9945ff);
        }
        // 光环上升流动
        if (this.beamRings) {
          this.beamRings.forEach(ring => {
            ring.position.y += delta * ring.userData.speed * (isTurbo ? 2.5 : 1.0);
            if (ring.position.y > 38.0) {
              ring.position.y = 0.5;
            }
            ring.rotation.z += delta * 1.5;
          });
        }
      }
    }

    // 3. 出块金币抛物线物理飞散更新
    if (this.burstCoinPool) {
      for (const coin of this.burstCoinPool) {
        if (!coin.visible) continue;
        coin.userData.life -= delta / coin.userData.maxLife;
        if (coin.userData.life <= 0) {
          coin.visible = false;
          continue;
        }

        // 重力下落与阻力
        coin.userData.vel.y -= 9.8 * delta;
        coin.position.x += coin.userData.vel.x * delta;
        coin.position.y += coin.userData.vel.y * delta;
        coin.position.z += coin.userData.vel.z * delta;

        // 自转
        coin.rotation.x += coin.userData.rotSpeed.x * delta;
        coin.rotation.y += coin.userData.rotSpeed.y * delta;
        coin.rotation.z += coin.userData.rotSpeed.z * delta;

        // 落地轻微弹跳与淡出
        if (coin.position.y <= 0.02) {
          coin.position.y = 0.02;
          coin.userData.vel.y = -coin.userData.vel.y * 0.35; // 弹跳衰减
          coin.userData.vel.x *= 0.8;
          coin.userData.vel.z *= 0.8;
        }

        const scale = Math.max(0.01, coin.userData.life);
        coin.scale.set(scale, scale, scale);
      }
    }

    // 4. 出块冲击波光环扩散
    if (this.shockwave && this.shockwave.userData.life > 0) {
      this.shockwave.userData.life -= delta / this.shockwave.userData.maxLife;
      const progress = 1.0 - Math.max(0, this.shockwave.userData.life);
      const ringScale = 1.0 + progress * 6.5; // 扩散至 6.5 倍
      this.shockwave.scale.set(ringScale, 1.0, ringScale);
      this.shockwave.material.opacity = Math.sin(this.shockwave.userData.life * Math.PI) * 0.75;
      if (this.shockwave.userData.life <= 0) {
        this.shockwave.material.opacity = 0;
      }
    }

    // 5. 地表待领取代币信标光圈动效
    if (this.beaconRing) {
      this.beaconRing.visible = this.unclaimedSol > 0;
      if (this.beaconRing.visible) {
        const pulse = 0.4 + Math.sin(Date.now() * 0.005) * 0.25;
        this.beaconRing.material.opacity = pulse;
      }
    }
  }

  // 序列化持久化存档支持
  serialize() {
    return {
      loadedCrystals: this.loadedCrystals,
      unclaimedSol: this.unclaimedSol,
      totalBlocksMined: this.totalBlocksMined,
      totalSolMined: this.totalSolMined,
      batteryPower: this.batteryPower,
      hashProgress: this.hashProgress,
      isOverclocked: this.isOverclocked,
      hasLithiumPack: this.hasLithiumPack,
      rigMode: this.rigMode,
      rigLevel: this.rigLevel,
      loadedPureCrystals: this.loadedPureCrystals,
      shardCount: this.shardCount,
      solDust: this.solDust,
      scannerLevel: this.scannerLevel,
      resonance: {
        roundId: this.resonance.roundId,
        phase: this.resonance.phase,
        progress: this.resonance.progress,
        revealTimer: this.resonance.revealTimer,
        seedCommit: this.resonance.seedCommit,
        roundSeed: this.resonance.roundSeed,
        seedReveal: this.resonance.seedReveal,
        board: this.resonance.board,
        cluster: this.resonance.cluster,
        lockPool: this.resonance.lockPool,
        lockU: this.resonance.lockU || this.getCapacityU(),
        lockWeather: this.resonance.lockWeather,
        lockBuff: this.resonance.lockBuff,
        buffDay: this.resonance.buffDay,
        fullHeat: this.resonance.fullHeat,
        deploy: [...this.resonance.deploy],
        committed: this.resonance.committed,
        committedShares: this.resonance.committedShares || 0,
        committedDeploy: [...(this.resonance.committedDeploy || new Array(25).fill(0))],
        lastResult: this.resonance.lastResult,
        history: [...this.resonance.history],
        calib: this.resonance.calib,
        freeShares: this.resonance.freeShares,
        freeGrantDay: this.resonance.freeGrantDay,
        freeGrantTs: this.resonance.freeGrantTs,
        freeGrantSteps: this.resonance.freeGrantSteps,
        buff: { ...this.resonance.buff },
        autoRepeat: { ...this.resonance.autoRepeat }
      },
      motherlode: {
        pool: this.motherlode.pool,
        injected: this.motherlode.injected,
        paid: this.motherlode.paid,
        burned: this.motherlode.burned,
        hallOfFame: [...this.motherlode.hallOfFame]
      },
      season: { ...this.season }
    };
  }

  deserialize(data) {
    if (!data) return;
    this.loadedCrystals = data.loadedCrystals || 0;
    this.unclaimedSol = data.unclaimedSol || 0;
    this.totalBlocksMined = data.totalBlocksMined || 0;
    this.totalSolMined = data.totalSolMined || 0;
    this.batteryPower = data.batteryPower !== undefined ? data.batteryPower : 75;
    this.hashProgress = data.hashProgress || 0;
    this.isActive = this.loadedCrystals > 0;
    if (data.isOverclocked) {
      this.unlockOverclock();
    }
    if (data.hasLithiumPack) {
      this.unlockLithiumPack();
    }
    if (data.rigMode) this.rigMode = data.rigMode;
    if (data.rigLevel) {
      this.rigLevel = data.rigLevel;
      const levelInfo = ODDS_TABLE.RIG_LEVELS[this.rigLevel];
      if (levelInfo) this.maxCrystalCapacity = levelInfo.capacity;
    }
    if (typeof data.loadedPureCrystals === 'number') this.loadedPureCrystals = data.loadedPureCrystals;
    if (typeof data.shardCount === 'number') this.shardCount = data.shardCount;
    this.solDust = typeof data.solDust === 'number' ? data.solDust : 0;
    const accrued = Math.round((this.unclaimedSol + this.solDust) * 1e8) / 1e8;
    this.unclaimedSol = Math.floor(accrued);
    this.solDust = Math.round((accrued - this.unclaimedSol) * 1e8) / 1e8;
    if (typeof data.scannerLevel === 'number') this.scannerLevel = data.scannerLevel;

    if (data.resonance && typeof data.resonance === 'object') {
      const r = data.resonance;
      this.resonance.roundId = r.roundId || 1;
      this.resonance.phase = r.phase || 'OPEN';
      this.resonance.progress = typeof r.progress === 'number' ? r.progress : 0;
      this.resonance.revealTimer = typeof r.revealTimer === 'number' ? r.revealTimer : 0;
      for (const key of ['roundSeed', 'seedReveal', 'board', 'cluster', 'lockPool', 'lockU', 'lockWeather', 'lockBuff', 'buffDay', 'fullHeat']) if (r[key] !== undefined) this.resonance[key] = r[key];
      this.resonance.roundSeed ||= r.seedCommit || '';
      if (r.lockPool === undefined && r.lastResult) this.resonance.lockPool = data.motherlode?.pool || 0;
      this.resonance.seedCommit = this.resonance.roundSeed ? cyrb53(this.resonance.roundSeed).toString(16) : '';
      if (Array.isArray(r.deploy) && r.deploy.length === 25) {
        this.resonance.deploy = [...r.deploy];
      }
      this.resonance.committed = Boolean(r.committed);
      this.resonance.committedShares = typeof r.committedShares === 'number' ? r.committedShares : (r.committed ? (r.deploy || []).reduce((a, b) => a + b, 0) : 0);
      if (Array.isArray(r.committedDeploy) && r.committedDeploy.length === 25) {
        this.resonance.committedDeploy = [...r.committedDeploy];
      } else if (r.committed) {
        this.resonance.committedDeploy = [...this.resonance.deploy];
      }
      this.resonance.lastResult = r.lastResult || null;
      if (Array.isArray(r.history)) this.resonance.history = [...r.history];
      if (typeof r.calib === 'number') this.resonance.calib = r.calib;
      if (typeof r.freeShares === 'number') this.resonance.freeShares = r.freeShares;
      if (typeof r.freeGrantDay === 'number') this.resonance.freeGrantDay = r.freeGrantDay;
      if (typeof r.freeGrantTs === 'number') this.resonance.freeGrantTs = r.freeGrantTs;
      if (typeof r.freeGrantSteps === 'number') this.resonance.freeGrantSteps = r.freeGrantSteps;
      if (r.buff) this.resonance.buff = { ...r.buff };
      if (r.autoRepeat) this.resonance.autoRepeat = { ...r.autoRepeat };
    }

    if (data.motherlode && typeof data.motherlode === 'object') {
      const m = data.motherlode;
      this.motherlode.pool = typeof m.pool === 'number' ? m.pool : 0;
      this.motherlode.injected = typeof m.injected === 'number' ? m.injected : 0;
      this.motherlode.paid = typeof m.paid === 'number' ? m.paid : 0;
      this.motherlode.burned = typeof m.burned === 'number' ? m.burned : 0;
      if (Array.isArray(m.hallOfFame)) this.motherlode.hallOfFame = [...m.hallOfFame];
    }

    if (data.season && typeof data.season === 'object') {
      this.season = { ...this.season, ...data.season };
    }
  }
}
