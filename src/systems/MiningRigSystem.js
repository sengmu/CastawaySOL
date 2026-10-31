// CastawaySOL - 荒岛绿色解密矿机与 DePIN 算力系统 (Green Mining Rig & DePIN System)
// 结合荒岛废土朋克与 Solana 绿色公链生态：
// 1. 实体建筑：利用漂流木架、沉船太阳能硅晶板、收音机芯片与铜线组装的手搓解密矿机；
// 2. 算力驱动：消耗【未解密硅晶原石 sol_crystal】，结合白天日光太阳能与生物质蓄电池发电；
// 3. 出块结算：移动步数与实时时间推进哈希运算，出块产出【$SOL 算力代币 sol_token】。

import * as THREE from 'three';
import { soundEngine } from '../core/AudioSystem.js';
import { haptics } from '../core/HapticFeedback.js';

export class MiningRigSystem {
  constructor(game) {
    this.game = game;

    // 营地矿机固定锚点坐标（位于营地西侧开阔平地，靠近储物箱）
    this.anchor = new THREE.Vector3(-10.5, 0.05, 20.0);

    // 矿机运行数据
    this.isActive = false;               // 是否正在通电哈希计算中
    this.hashrate = 85.5;               // 基础算力 (MH/s)
    this.totalBlocksMined = 0;           // 历史已验证区块总数
    this.totalSolMined = 0;             // 历史挖出 $SOL 代币总数

    // 矿仓与燃料
    this.loadedCrystals = 1;            // 初始已预装 1 块硅晶原石体验
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
    this.unclaimedSol = 0;              // 待收取的 $SOL 算力代币

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
      this.game.ui.showToast('行囊中硅晶原石不足，前往后山崖壁开采矿脉！');
      return false;
    }

    if (this.loadedCrystals + count > this.maxCrystalCapacity) {
      this.game.ui.showToast(`矿机晶石仓已满 (上限 ${this.maxCrystalCapacity} 块)！`);
      return false;
    }

    inv['sol_crystal'] -= count;
    if (inv['sol_crystal'] <= 0) delete inv['sol_crystal'];

    this.loadedCrystals += count;
    this.isActive = true;

    this.game.ui.renderInventory();
    haptics.success();
    soundEngine.playItemDrop();
    this.game.ui.showToast(`💎 成功装入【未解密硅晶原石】x${count}！矿机进入高速哈希运算解密状态！`);

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
    this.game.ui.showToast(`⚡ 成功注入能源【${this.game.ui.getItemName(itemKey)}】！矿机蓄电量回升至 ${this.batteryPower}%！`);

    return true;
  }

  // 解锁 DePIN 超频算力芯片
  unlockOverclock() {
    this.isOverclocked = true;
    this.hashSpeed = 30;
    this.hashrate = 171.0;
  }

  // 解锁航天级固态锂电池组
  unlockLithiumPack() {
    this.hasLithiumPack = true;
    this.maxBattery = 200;
    this.batteryPower = 200;
  }

  // 步数驱动：玩家在海岛上探索跑图产生的感应电能与时间潮汐推进
  recordMovement(stepCount = 1) {
    if (this.loadedCrystals <= 0) return;

    // 每移动 10 步推进一格哈希运算
    const stepBonus = stepCount * 1.2;
    this.advanceHashProgress(stepBonus);
  }

  // 手动狂暴增压点按 (Tap-to-Boost / Manual Turbo)
  triggerManualBoost() {
    if (this.loadedCrystals <= 0) {
      if (this.game && this.game.ui) {
        this.game.ui.showToast('⚠️ 矿机晶石仓为空，请先装填【未解密硅晶原石】！');
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

    // 检查蓄电池消耗（若没有阳光则缓慢消耗蓄电池）
    const isDay = this.isDaytime();
    if (!isDay && this.batteryPower > 0) {
      this.batteryPower = Math.max(0, this.batteryPower - 0.05);
    }

    // 满 100% 成功出块 (Block Validated)
    if (this.hashProgress >= 100) {
      this.hashProgress = 0;
      this.totalBlocksMined++;

      // 消耗 1 块硅晶原石
      this.loadedCrystals--;

      // 产出 1~2 枚 $SOL 算力代币 (超频状态下有 45% 几率狂暴暴击 +1)
      const isCrit = (this.turboTimer > 0) && (Math.random() < 0.45);
      const baseReward = 1 + (Math.random() < 0.35 ? 1 : 0);
      const reward = baseReward + (isCrit ? 1 : 0);

      this.unclaimedSol += reward;
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
        this.game.ui.showToast(`⛏️✨ 恭喜！矿机成功验证新区块 #${this.totalBlocksMined}！${critTag} 产出【$SOL 算力代币】x${reward}！`);
      }

      if (this.loadedCrystals <= 0) {
        this.isActive = false;
      }
    }
  }

  // 判定当前海岛是否为白天 (日出至日落，享有太阳能 100% 绿色增益)
  isDaytime() {
    if (this.game && this.game.weatherSystem) {
      return !this.game.weatherSystem.isNight;
    }
    return true;
  }

  // 一键收取已挖出的 $SOL 算力代币
  claimSolTokens() {
    if (this.unclaimedSol <= 0) {
      this.game.ui.showToast('矿机产出槽空空如也，静待下一个区块验证出块！');
      return false;
    }

    const count = this.unclaimedSol;
    const inv = this.game.ui.inventory;
    inv['sol_token'] = (inv['sol_token'] || 0) + count;
    this.unclaimedSol = 0;

    this.game.ui.renderInventory();
    haptics.success();
    soundEngine.playItemDrop();

    this.game.ui.showDialog(
      '🪙 $SOL 算力代币收取成功！',
      `成功从营地绿色矿机中收取 ${count} 枚【$SOL 算力代币】！\n\n• 当前背包持有: ${inv['sol_token']} 枚\n• 累计验证区块: ${this.totalBlocksMined} 个\n\n【提示：前往【黑市算力特权】可兑换稀有出海造船图纸与自动化特权，成绩已同步至 Solana 赛季榜！】`
    );

    return true;
  }

  // 每帧动画动效与算力推进
  update(delta) {
    const isDay = this.isDaytime();
    // 1. 狂暴超频计时器衰减
    if (this.turboTimer > 0) {
      this.turboTimer -= delta;
      if (this.turboTimer <= 0) {
        this.turboTimer = 0;
        this.manualTapCombo = 0;
      }
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
      hasLithiumPack: this.hasLithiumPack
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
  }
}
