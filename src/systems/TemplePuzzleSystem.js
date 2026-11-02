// CastawaySOL - 后山神秘古代神殿与密室解谜副本系统 (Ancient Temple Puzzle System)
// 专为移动端手机触控打造的沉浸式解谜体验：
// 1. 第一重：星辰三色光棱镜对焦 (大触控旋转透镜汇聚光束)
// 2. 第二重：远古九宫太阳图腾矩阵 (经典直观翻转石板)
// 3. 第三重：深渊密室黄金宝藏结算 (波塞冬金冠、深渊附魔燧石巨斧、100金币)
import { soundEngine } from '../core/AudioSystem.js';
import { haptics } from '../core/HapticFeedback.js';
import { iconHTML } from '../ui/IconRegistry.js';

export class TemplePuzzleSystem {
  constructor(game) {
    this.game = game;

    // 解谜关卡状态：0 = 未开始, 1 = 第一重棱镜通过, 2 = 第二重九宫矩阵通过, 3 = 神殿大门开启并领取终极宝藏
    this.stage = 0;
    this.isDoorOpened = false;
    this.vaultClaimed = false;

    // 第一重：三色光棱镜对焦角度 (0, 90, 180, 270)
    // 目标角度：红=180, 绿=90, 蓝=270
    this.prismAngles = {
      red: 0,
      green: 0,
      blue: 0
    };
    this.prismTarget = {
      red: 180,
      green: 90,
      blue: 270
    };

    // 第二重：九宫图腾翻转矩阵 (3x3, 1 = ☀️太阳金图腾, 0 = 🌊暗潮图腾)
    // 目标：全为 1
    this.matrix = [
      [1, 0, 1],
      [0, 1, 0],
      [1, 0, 1]
    ];

    this.isOpen = false;
    this.initModal();
  }

  // 初始化移动端全屏触控抽屉容器
  initModal() {
    if (typeof document === 'undefined') return;

    this.backdrop = document.createElement('div');
    this.backdrop.id = 'temple-modal-backdrop';
    this.backdrop.style.cssText = `
      display: none;
      position: fixed; inset: 0;
      background: rgba(10, 16, 26, 0.92);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      z-index: 10000;
      align-items: center; justify-content: center;
      padding: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      touch-action: manipulation;
    `;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      background: linear-gradient(155deg, #1b2636 0%, #0d1520 100%);
      border: 2px solid rgba(255, 211, 42, 0.4);
      border-radius: 22px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(255, 211, 42, 0.2);
      width: 100%;
      max-width: 520px;
      max-height: 92vh;
      display: flex; flex-direction: column;
      overflow: hidden;
      color: #fff;
    `;

    this.backdrop.appendChild(this.container);
    document.body.appendChild(this.backdrop);

    // 点击蒙版边缘安全关闭
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) {
        this.close();
      }
    });
  }

  open() {
    if (this.game && this.game.player && this.game.player.resetInput) {
      this.game.player.resetInput();
    }
    this.isOpen = true;
    this.render();
    this.backdrop.style.display = 'flex';
    soundEngine.playPlaceFurniture();
    haptics.medium();
  }

  close() {
    this.isOpen = false;
    this.backdrop.style.display = 'none';
  }

  // 渲染手机端沉浸式解谜面板
  render() {
    let contentHtml = '';

    if (this.stage === 0) {
      contentHtml = this.renderPrismStage();
    } else if (this.stage === 1) {
      contentHtml = this.renderMatrixStage();
    } else {
      contentHtml = this.renderVaultStage();
    }

    this.container.innerHTML = `
      <!-- 顶部 Header -->
      <div style="padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.12); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 24px;">🏛️</span>
          <div>
            <div style="font-size: 16px; font-weight: 900; color: #ffd32a; letter-spacing: 0.5px;">
              后山古代神殿 · 密室机关
            </div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.6); margin-top: 2px;">
              当前关卡：${this.stage === 0 ? '第一重·星辰三色光棱镜对焦' : this.stage === 1 ? '第二重·太阳图腾矩阵翻转' : '第三重·深渊密室黄金宝藏'}
            </div>
          </div>
        </div>
        <button id="temple-close-btn" style="background: rgba(255,255,255,0.1); border: none; border-radius: 50%; width: 36px; height: 36px; color: #fff; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          ✕
        </button>
      </div>

      <!-- 核心解谜触控主区域 -->
      <div style="padding: 16px; overflow-y: auto; flex: 1;">
        ${contentHtml}
      </div>

      <!-- 底部小贴士与伙伴提示 -->
      <div style="padding: 10px 18px; background: rgba(0,0,0,0.4); border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: rgba(255,255,255,0.65);">
        <span>💡 专为手机触控优化 · 点击即转</span>
        <button id="temple-hint-btn" style="background: rgba(255,211,42,0.18); border: 1px solid #ffd32a; color: #ffd32a; border-radius: 8px; padding: 4px 10px; font-weight: 700; cursor: pointer;">
          🐒 机灵小猴解读机关
        </button>
      </div>
    `;

    // 绑定关闭
    const closeBtn = this.container.querySelector('#temple-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    // 绑定小猴提示
    const hintBtn = this.container.querySelector('#temple-hint-btn');
    if (hintBtn) {
      hintBtn.addEventListener('click', () => {
        haptics.light();
        soundEngine.playLevelUp();
        if (this.stage === 0) {
          alert('🐒 小猴巴布挠了挠头，指着石碑壁画比划道：\n“赤红透镜指向南方(180°)、苍翠透镜指向东方(90°)、蔚蓝透镜指向西方(270°)！三道光斑交汇即可破解！”');
        } else if (this.stage === 1) {
          alert('🐒 小猴巴布指着四个角落的暗潮方块跳来跳去：\n“点击中间和四边的石板，就能将九块全部翻为金光璀璨的太阳图腾☀️啦！”');
        } else {
          alert('🐒 小猴巴布兴奋地手舞足蹈：“石门已经轰隆隆升起！快去收取远古波塞冬金冠和神级巨斧吧！”');
        }
      });
    }

    this.bindStageEvents();
  }

  // 1. 渲染第一重：棱镜对焦
  renderPrismStage() {
    const isRedOk = this.prismAngles.red === this.prismTarget.red;
    const isGreenOk = this.prismAngles.green === this.prismTarget.green;
    const isBlueOk = this.prismAngles.blue === this.prismTarget.blue;
    const allAligned = isRedOk && isGreenOk && isBlueOk;

    return `
      <div style="text-align: center; margin-bottom: 14px;">
        <div style="font-size: 13px; color: rgba(255,255,255,0.8); line-height: 1.5;">
          旋转中央三组聚光透镜，使红、绿、蓝三束古代灵光汇聚在石门凹槽！
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <!-- 红透镜 -->
        <div style="background: rgba(235, 77, 75, 0.12); border: 1.5px solid ${isRedOk ? '#ff7675' : 'rgba(235,77,75,0.3)'}; border-radius: 14px; padding: 12px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: #eb4d4b; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 0 12px rgba(235,77,75,0.5);">
              🔴
            </div>
            <div>
              <div style="font-size: 14px; font-weight: 900; color: #ff7675;">赤红聚光透镜</div>
              <div style="font-size: 11px; color: rgba(255,255,255,0.6);">当前角度：${this.prismAngles.red}° ${isRedOk ? '✅ 已对焦' : ''}</div>
            </div>
          </div>
          <button class="rotate-prism-btn" data-color="red" style="background: #eb4d4b; border: none; color: #fff; font-weight: 900; padding: 8px 14px; border-radius: 10px; font-size: 13px; cursor: pointer;">
            旋转 90° ↻
          </button>
        </div>

        <!-- 绿透镜 -->
        <div style="background: rgba(46, 204, 113, 0.12); border: 1.5px solid ${isGreenOk ? '#2ecc71' : 'rgba(46,204,113,0.3)'}; border-radius: 14px; padding: 12px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: #2ecc71; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 0 12px rgba(46,204,113,0.5);">
              🟢
            </div>
            <div>
              <div style="font-size: 14px; font-weight: 900; color: #2ecc71;">苍翠聚光透镜</div>
              <div style="font-size: 11px; color: rgba(255,255,255,0.6);">当前角度：${this.prismAngles.green}° ${isGreenOk ? '✅ 已对焦' : ''}</div>
            </div>
          </div>
          <button class="rotate-prism-btn" data-color="green" style="background: #2ecc71; border: none; color: #fff; font-weight: 900; padding: 8px 14px; border-radius: 10px; font-size: 13px; cursor: pointer;">
            旋转 90° ↻
          </button>
        </div>

        <!-- 蓝透镜 -->
        <div style="background: rgba(9, 132, 227, 0.12); border: 1.5px solid ${isBlueOk ? '#74b9ff' : 'rgba(9,132,227,0.3)'}; border-radius: 14px; padding: 12px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: #0984e3; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 0 12px rgba(9,132,227,0.5);">
              🔵
            </div>
            <div>
              <div style="font-size: 14px; font-weight: 900; color: #74b9ff;">蔚蓝聚光透镜</div>
              <div style="font-size: 11px; color: rgba(255,255,255,0.6);">当前角度：${this.prismAngles.blue}° ${isBlueOk ? '✅ 已对焦' : ''}</div>
            </div>
          </div>
          <button class="rotate-prism-btn" data-color="blue" style="background: #0984e3; border: none; color: #fff; font-weight: 900; padding: 8px 14px; border-radius: 10px; font-size: 13px; cursor: pointer;">
            旋转 90° ↻
          </button>
        </div>
      </div>

      <div style="margin-top: 16px;">
        <button id="submit-prism-btn" ${allAligned ? '' : 'disabled'} style="
          width: 100%; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 900;
          background: ${allAligned ? 'linear-gradient(135deg, #ffd32a 0%, #ff9f1a 100%)' : 'rgba(255,255,255,0.1)'};
          color: ${allAligned ? '#1e272e' : 'rgba(255,255,255,0.4)'};
          border: none; cursor: ${allAligned ? 'pointer' : 'default'};
          box-shadow: ${allAligned ? '0 4px 18px rgba(255,211,42,0.45)' : 'none'};
        ">
          ${allAligned ? '✨ 开启第二道机关：太阳图腾矩阵 ➔' : '等待三色透镜全部对焦'}
        </button>
      </div>
    `;
  }

  // 2. 渲染第二重：九宫图腾翻转矩阵
  renderMatrixStage() {
    let allSun = true;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (this.matrix[r][c] === 0) allSun = false;
      }
    }

    return `
      <div style="text-align: center; margin-bottom: 12px;">
        <div style="font-size: 13px; color: rgba(255,255,255,0.8); line-height: 1.5;">
          触摸石板翻转它与相邻石板，将 9 块石板全部同调为【☀️ 太阳金图腾】！
        </div>
      </div>

      <!-- 3x3 大触控九宫格 -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 320px; margin: 0 auto;">
        ${this.matrix.map((row, r) => row.map((val, c) => `
          <button class="matrix-cell-btn" data-r="${r}" data-c="${c}" style="
            aspect-ratio: 1; border-radius: 14px;
            background: ${val === 1 ? 'linear-gradient(135deg, #ffd32a 0%, #ff9f1a 100%)' : 'rgba(255,255,255,0.06)'};
            border: 2px solid ${val === 1 ? '#ffd32a' : 'rgba(255,255,255,0.15)'};
            font-size: 32px; display: flex; align-items: center; justify-content: center;
            cursor: pointer; box-shadow: ${val === 1 ? '0 0 16px rgba(255,211,42,0.4)' : 'none'};
            transition: transform 0.1s;
          ">
            ${val === 1 ? '☀️' : '🌊'}
          </button>
        `).join('')).join('')}
      </div>

      <div style="margin-top: 16px;">
        <button id="submit-matrix-btn" ${allSun ? '' : 'disabled'} style="
          width: 100%; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 900;
          background: ${allSun ? 'linear-gradient(135deg, #00b894 0%, #00cec9 100%)' : 'rgba(255,255,255,0.1)'};
          color: ${allSun ? '#0d1520' : 'rgba(255,255,255,0.4)'};
          border: none; cursor: ${allSun ? 'pointer' : 'default'};
          box-shadow: ${allSun ? '0 4px 18px rgba(0,206,201,0.4)' : 'none'};
        ">
          ${allSun ? '🎉 轰开古代玄铁神殿大门！➔' : '调谐石板使全部变为 ☀️'}
        </button>
      </div>
    `;
  }

  // 3. 渲染第三重：宝藏领取
  renderVaultStage() {
    return `
      <div style="text-align: center; padding: 10px 0;">
        <div style="font-size: 48px; animation: floatAnim 1.5s infinite alternate;">👑</div>
        <div style="font-size: 18px; font-weight: 900; color: #ffd32a; margin-top: 6px;">
          神殿深渊秘室已洞开！
        </div>
        <div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-top: 6px; line-height: 1.5;">
          石门轰然升起，黄金祭坛上陈列着沉睡了千年的波塞冬神器！
        </div>

        <div style="background: rgba(255,211,42,0.1); border: 1.5px solid #ffd32a; border-radius: 16px; padding: 14px; margin: 16px 0; text-align: left;">
          <div style="font-size: 14px; font-weight: 900; color: #ffd32a; margin-bottom: 6px;">🏆 殿堂级远古宝藏清点：</div>
          <div style="font-size: 12px; color: #fff; line-height: 1.8;">
            👑 <b>远古波塞冬金冠</b>（全地形奔跑速度 +20%，涉水如履平地）<br/>
            🪓 <b>深渊附魔燧石战斧</b>（砍伐与碎石伤害倍增，战斗力爆发）<br/>
            ${iconHTML('items/ancient_coin', 14, { eager: true })} <b>纯金古代金币 x100</b>（海量通货）<br/>
            🔋 <b>高能古代蓄能核心 x2</b>
          </div>
        </div>

        ${this.vaultClaimed ? `
          <button disabled style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(0, 184, 148, 0.25); border: 1px solid #00b894; color: #55efc4; font-weight: 900; font-size: 14px;">
            ✅ 远古神殿宝藏已领取，祭坛永久供奉中
          </button>
        ` : `
          <button id="claim-vault-btn" style="width: 100%; padding: 14px; border-radius: 12px; background: linear-gradient(135deg, #ffd32a 0%, #ff9f1a 100%); border: none; color: #1e272e; font-weight: 900; font-size: 15px; cursor: pointer; box-shadow: 0 4px 20px rgba(255,211,42,0.5);">
            🎁 奉纳祭品并领取波塞冬黄金宝藏！
          </button>
        `}
      </div>
    `;
  }

  // 绑定解谜触控事件
  bindStageEvents() {
    // 1. 棱镜旋转事件
    const rotateBtns = this.container.querySelectorAll('.rotate-prism-btn');
    rotateBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        if (this.prismAngles[color] !== undefined) {
          this.prismAngles[color] = (this.prismAngles[color] + 90) % 360;
          soundEngine.playPlaceFurniture();
          haptics.light();
          this.render();
        }
      });
    });

    const submitPrismBtn = this.container.querySelector('#submit-prism-btn');
    if (submitPrismBtn && !submitPrismBtn.disabled) {
      submitPrismBtn.addEventListener('click', () => {
        this.stage = 1;
        soundEngine.playLevelUp();
        haptics.heavy();
        this.render();
      });
    }

    // 2. 九宫格翻转事件
    const matrixBtns = this.container.querySelectorAll('.matrix-cell-btn');
    matrixBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const r = parseInt(btn.getAttribute('data-r'));
        const c = parseInt(btn.getAttribute('data-c'));
        this.flipMatrixCell(r, c);
        soundEngine.playFootstep();
        haptics.light();
        this.render();
      });
    });

    const submitMatrixBtn = this.container.querySelector('#submit-matrix-btn');
    if (submitMatrixBtn && !submitMatrixBtn.disabled) {
      submitMatrixBtn.addEventListener('click', () => {
        this.stage = 2;
        this.isDoorOpened = true;
        if (this.game && this.game.ancientTemple) {
          this.game.ancientTemple.openTempleDoor();
        }
        if (this.game && this.game.ancientTempleScene) {
          this.game.ancientTempleScene.openInnerGate();
        }
        if (soundEngine && typeof soundEngine.playTreeShake === 'function') soundEngine.playTreeShake(); // 巨石轰鸣
        haptics.heavy();
        this.render();
      });
    }

    // 3. 宝藏领取事件
    const claimBtn = this.container.querySelector('#claim-vault-btn');
    if (claimBtn) {
      claimBtn.addEventListener('click', () => {
        this.claimTempleVault();
      });
    }
  }

  // 九宫格翻转相邻石板
  flipMatrixCell(r, c) {
    const toggle = (row, col) => {
      if (row >= 0 && row < 3 && col >= 0 && col < 3) {
        this.matrix[row][col] = this.matrix[row][col] === 1 ? 0 : 1;
      }
    };
    toggle(r, c);
    toggle(r - 1, c);
    toggle(r + 1, c);
    toggle(r, c - 1);
    toggle(r, c + 1);
  }

  // 结算并发放宝藏
  claimTempleVault() {
    if (this.vaultClaimed) return;
    this.vaultClaimed = true;

    if (this.game && this.game.ancientTempleScene) {
      this.game.ancientTempleScene.vaultClaimed = true;
    }

    if (soundEngine && typeof soundEngine.playLevelUp === 'function') {
      soundEngine.playLevelUp();
    } else if (soundEngine && typeof soundEngine.playVictory === 'function') {
      soundEngine.playVictory();
    }
    haptics.heavy();

    if (this.game && this.game.ui) {
      const inv = this.game.ui.inventory;
      inv['ancient_coin'] = (inv['ancient_coin'] || 0) + 100;
      inv['poseidon_crown'] = 1;
      inv['abyssal_axe'] = 1;
      inv['ancient_core'] = 2;

      this.game.ui.renderInventory();
      this.game.ui.showDialog(
        '👑 远古波塞冬神器已入囊！',
        '你获得了神殿最珍贵的遗泽：\n' +
        '👑【远古波塞冬金冠】：全地形奔跑速度永久 +20%，涉水如履平地！\n' +
        '🪓【深渊附魔燧石战斧】：摧山断木，破坏力大幅提升！\n' +
        '💰【古代海盗金币】+100！\n\n' +
        '神殿的神秘光芒长明，主岛古迹已完全破译！'
      );
    }

    if (this.game && this.game.saveSystem) {
      this.game.saveSystem.saveGame('temple_cleared');
    }

    this.render();
  }

  // 序列化
  serialize() {
    return {
      stage: this.stage,
      isDoorOpened: this.isDoorOpened,
      vaultClaimed: this.vaultClaimed,
      prismAngles: { ...this.prismAngles },
      matrix: this.matrix.map(row => [...row])
    };
  }

  // 反序列化
  deserialize(data) {
    if (!data) return;
    if (typeof data.stage === 'number') this.stage = data.stage;
    if (typeof data.isDoorOpened === 'boolean') {
      this.isDoorOpened = data.isDoorOpened;
      if (this.isDoorOpened && this.game && this.game.ancientTemple) {
        this.game.ancientTemple.openTempleDoor();
      }
      if (this.isDoorOpened && this.game && this.game.ancientTempleScene) {
        this.game.ancientTempleScene.openInnerGate();
      }
    }
    if (typeof data.vaultClaimed === 'boolean') {
      this.vaultClaimed = data.vaultClaimed;
      if (this.game && this.game.ancientTempleScene) {
        this.game.ancientTempleScene.vaultClaimed = data.vaultClaimed;
      }
    }
    if (data.prismAngles) this.prismAngles = { ...data.prismAngles };
    if (data.matrix) this.matrix = data.matrix.map(row => [...row]);
  }
}
