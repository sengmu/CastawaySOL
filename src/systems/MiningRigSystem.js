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

    // 待领取的产出槽
    this.unclaimedSol = 0;              // 待收取的 $SOL 算力代币

    this.group = new THREE.Group();
    this.group.name = 'depin-mining-rig-entity';
    if (this.game && this.game.scene) {
      this.game.scene.add(this.group);
    }

    this.initEntityMesh();
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

      // 产出 1~2 枚 $SOL 算力代币
      const reward = 1 + (Math.random() < 0.4 ? 1 : 0);
      this.unclaimedSol += reward;
      this.totalSolMined += reward;

      // 同步成绩至 Solana 链上/本地凭证桥
      if (this.game.solanaBridge) {
        this.game.solanaBridge.submitMiningProof(this.totalBlocksMined, this.totalSolMined);
      }

      // 出块音效与提示
      soundEngine.playLevelUp();
      haptics.success();
      this.game.ui.showToast(`⛏️✨ 恭喜！矿机成功验证新区块 #${this.totalBlocksMined}！产出【$SOL 算力代币】x${reward}！`);

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
    // 太阳能白天算力加成 1.5 倍
    const powerMultiplier = isDay ? 1.5 : (this.batteryPower > 0 ? 1.0 : 0.3);

    if (this.isActive && this.loadedCrystals > 0) {
      // 散热风扇飞速旋转
      if (this.fanGroup) {
        this.fanGroup.rotation.z += delta * 18.0 * powerMultiplier;
      }

      // 指示灯脉冲呼吸
      const time = Date.now() * 0.006;
      if (this.statusLed) {
        this.statusLed.material.emissiveIntensity = 0.5 + Math.sin(time) * 0.45;
        this.statusLed.material.color.setHex(isDay ? 0x14f195 : 0x9945ff);
        this.statusLed.material.emissive.setHex(isDay ? 0x14f195 : 0x9945ff);
      }

      // 实时时间平滑推进解密
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

    // 地表信标光圈动效（有未领取代币时醒目脉冲）
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
