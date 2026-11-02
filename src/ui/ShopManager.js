// CastawaySOL - 商业化特权与 Solana 支付商城系统 (Shop & Monetization System)
// 借鉴《疯狂水世界》经典变现模型：自动化减负特权、仓储扩容包、幸存者执照与急救空投
// 深度集成 Solana 钱包与模拟微支付通道，实现无需强制真金白银即可顺畅体验的良性商业化闭环
import { soundEngine } from '../core/AudioSystem.js';
import { solanaBridge } from '../core/SolanaBridge.js';

export class ShopManager {
  constructor(game) {
    this.game = game;
    this.isOpen = false;

    // 商品配置清单 (Price in SOL)
    this.products = [
      {
        id: 'auto_salvage_buoy',
        type: 'perk_permanent',
        title: '近海智能打捞浮标网',
        subtitle: 'Auto-Salvage Buoy',
        badge: '超值必买',
        icon: '⚓',
        priceSOL: 0.05,
        priceToken: 12,
        desc: '在南岸浅海永久部署发光自动打捞浮标网。每 30 秒自动截获潮汐冲刷上岸的木箱、浮木与淡水罐，并自动整理运入营地储物木箱，彻底解放双手！',
        isOwned: () => {
          return this.game.flotsamSalvage && this.game.flotsamSalvage.hasAutoSalvageBuoy;
        },
        onPurchase: () => {
          if (this.game.flotsamSalvage) {
            this.game.flotsamSalvage.unlockAutoSalvageBuoy();
          }
          return '⚓ 近海智能打捞浮标网已永久激活！';
        }
      },
      {
        id: 'auto_production_license',
        type: 'perk_permanent',
        title: '营地自律生产经营执照',
        subtitle: 'Auto-Production License',
        badge: '经营核心',
        icon: '⚡',
        priceSOL: 0.05,
        priceToken: 12,
        desc: '全员幸存者（艾莉、巴布）生产效率永久提升 +50%！净水滴滤台每日清晨自然蓄水自动回满，营地物资充沛无忧！',
        isOwned: () => {
          return this.game.campFacilities && this.game.campFacilities.isAutoProductionActive;
        },
        onPurchase: () => {
          if (this.game.campFacilities) {
            this.game.campFacilities.isAutoProductionActive = true;
          }
          return '⚡ 营地自律生产执照已生效！幸存者产能大幅跃升！';
        }
      },
      {
        id: 'overclock_mining_chip',
        type: 'perk_permanent',
        title: 'DePIN 超频运算芯片',
        subtitle: 'Mining Rig Overclock Chip',
        badge: '算力狂飙',
        icon: '💎',
        priceSOL: 0.06,
        priceToken: 15,
        desc: '将精密收音机高频晶振芯片改装入营地矿机！使矿机基础哈希算力永久暴增 +100% (翻倍)，步数与时间解密出块速度翻倍！',
        isOwned: () => {
          return this.game.miningRig && this.game.miningRig.isOverclocked;
        },
        onPurchase: () => {
          if (this.game.miningRig) {
            this.game.miningRig.unlockOverclock();
          }
          return '💎 DePIN 超频运算芯片已嵌入矿机！解密算力永久提升 +100%！';
        }
      },
      {
        id: 'depin_lithium_pack',
        type: 'perk_permanent',
        title: '航天级固态锂电储能组',
        subtitle: 'Solid-State Lithium Pack (200%)',
        badge: '能源无忧',
        icon: '🔋',
        priceSOL: 0.04,
        priceToken: 10,
        desc: '加装高能量密度固态锂电模组！矿机蓄电上限扩容至 200%，即使无日光夜间也能全速运算，告别电力匮乏！',
        isOwned: () => {
          return this.game.miningRig && this.game.miningRig.hasLithiumPack;
        },
        onPurchase: () => {
          if (this.game.miningRig) {
            this.game.miningRig.unlockLithiumPack();
          }
          return '🔋 固态锂电储能组已安装！矿机蓄电上限永久翻倍至 200%！';
        }
      },
      {
        id: 'deepsea_shipbuilding_kit',
        type: 'consumable',
        title: '深海远航造船特权构件',
        subtitle: 'Ocean Raft Master Kit',
        badge: '逃脱加速',
        icon: '⛵',
        priceSOL: 0.10,
        priceToken: 20,
        desc: '向营地木箱一次性空投造船关键资材：【加固铁钉】x10、【坚韧藤蔓】x8、【干燥优质木料】x10，免去漫长搜集，助你直通深海逃离荒岛！',
        isOwned: () => false,
        onPurchase: () => {
          if (this.game.storageSystem) {
            const st = this.game.storageSystem.storageInventory;
            st['nail'] = (st['nail'] || 0) + 10;
            st['ivy'] = (st['ivy'] || 0) + 8;
            st['wood_plank'] = (st['wood_plank'] || 0) + 10;
          }
          return '⛵ 远洋造船特权构件已空投至【营地储物箱】！通关逃脱加速推进！';
        }
      },
      {
        id: 'backpack_expansion',
        type: 'perk_expand',
        title: '加厚兽皮行囊扩容包',
        subtitle: 'Backpack Expansion (+10)',
        badge: '随身便利',
        icon: '🎒',
        priceSOL: 0.02,
        priceToken: 6,
        desc: '缝制加厚多隔层兽皮行囊，使随身携带的物品栏槽位上限永久额外 +10 格，大幅减少往返跑图存箱的麻烦！',
        isOwned: () => false, // 可多次购买
        onPurchase: () => {
          if (this.game.ui) {
            this.game.ui.expandInventory(10);
          }
          return '🎒 随身行囊格位永久扩充 +10 格！';
        }
      },
      {
        id: 'storage_expansion',
        type: 'perk_expand',
        title: '坚固营地木箱扩容货架',
        subtitle: 'Storage Crate Expansion (+16)',
        badge: '仓储无忧',
        icon: '📦',
        priceSOL: 0.02,
        priceToken: 6,
        desc: '为营地木箱打造加固原木货架，使营地储物总容量永久额外增加 +16 格空间，海量海难建材随心储纳！',
        isOwned: () => false, // 可多次购买
        onPurchase: () => {
          if (this.game.storageSystem) {
            this.game.storageSystem.expandCapacity(16);
          }
          return '📦 营地储物箱总容量永久扩充 +16 格！';
        }
      },
      {
        id: 'airdrop_rescue_crate',
        type: 'consumable',
        title: '皇家探险急救空投箱',
        subtitle: 'Emergency Survival Airdrop',
        badge: '即时空投',
        icon: '🪂',
        priceSOL: 0.03,
        priceToken: 8,
        desc: '救援直升机向海岛营火旁紧急空投一份物资箱：立即获得【香脆烤鱼】x5、【蜜汁烤苹果】x5、【纯净饮水】x5、【坚韧藤蔓】x3、【加固铁钉】x5！',
        isOwned: () => false,
        onPurchase: () => {
          if (this.game.storageSystem) {
            const st = this.game.storageSystem.storageInventory;
            st['baked_fish'] = (st['baked_fish'] || 0) + 5;
            st['baked_apple'] = (st['baked_apple'] || 0) + 5;
            st['canteen_clean_water'] = (st['canteen_clean_water'] || 0) + 5;
            st['ivy'] = (st['ivy'] || 0) + 3;
            st['nail'] = (st['nail'] || 0) + 5;
          }
          return '🪂 急救空投已送达！大量珍贵食物与纯净水已直接存入【营地储物箱】！';
        }
      },
      {
        id: 'pet_bella_dog',
        type: 'perk_pet',
        title: '神宠·忠诚猎犬贝拉',
        subtitle: 'Companion: Bella the Guard Dog',
        badge: '护卫嗅探',
        icon: '🐕',
        priceSOL: 0.15,
        priceToken: 30,
        desc: '随行灵犬伙伴！地脉嗅探深埋宝藏，野兽狂吠硬直震慑，并提供野兽撕咬伤害永久减免 20% 顶级生存护甲特权！',
        isOwned: () => {
          return this.game.petCompanion && this.game.petCompanion.isUnlocked('bella_dog');
        },
        onPurchase: () => {
          if (this.game.petCompanion) {
            this.game.petCompanion.unlockWithSol('bella_dog');
          }
          return '🐕 忠诚猎犬贝拉已空投营地并设为出战伙伴！';
        }
      },
      {
        id: 'pet_raymond_cat',
        type: 'perk_pet',
        title: '神宠·海月玄猫雷蒙德',
        subtitle: 'Companion: Raymond the Sea Cat',
        badge: '捕鱼夜视',
        icon: '🐱',
        priceSOL: 0.20,
        priceToken: 40,
        desc: '浅水自动叼捕鲜鱼海蟹，入夜后在周身自动散发 6.5 米幽蓝夜视光晕驱散黑暗，钓鱼咬钩速度大幅加快 35%！',
        isOwned: () => {
          return this.game.petCompanion && this.game.petCompanion.isUnlocked('raymond_cat');
        },
        onPurchase: () => {
          if (this.game.petCompanion) {
            this.game.petCompanion.unlockWithSol('raymond_cat');
          }
          return '🐱 海月玄猫雷蒙德已空投营地并设为出战伙伴！';
        }
      },
      {
        id: 'pet_dom_sheep',
        type: 'perk_pet',
        title: '神宠·暖绒金羊多姆',
        subtitle: 'Companion: Dom the Cargo Sheep',
        badge: '随行驮载',
        icon: '🐑',
        priceSOL: 0.12,
        priceToken: 25,
        desc: '随身驮袋提供额外 6 格独立移动货仓，静心抚慰使奔跑疲劳累积速度降低 50%，全地形移速额外提升 +10%！',
        isOwned: () => {
          return this.game.petCompanion && this.game.petCompanion.isUnlocked('dom_sheep');
        },
        onPurchase: () => {
          if (this.game.petCompanion) {
            this.game.petCompanion.unlockWithSol('dom_sheep');
          }
          return '🐑 暖绒金羊多姆已空投营地并设为出战伙伴！';
        }
      },
      {
        id: 'storm_oilskin_cloak',
        type: 'perk_permanent',
        title: '防风加厚航海油布斗篷',
        subtitle: 'Stormproof Oilskin Cloak',
        badge: '风雨无阻',
        icon: '🧥',
        priceSOL: 0.08,
        priceToken: 18,
        desc: '密织浸油防水风衣！彻底免疫倾盆暴雨与台风中的露天失温冻伤，恶劣气象中行动自如！',
        isOwned: () => {
          return this.game.weatherSystem && this.game.weatherSystem.hasOilskinCloak;
        },
        onPurchase: () => {
          if (this.game.weatherSystem) {
            this.game.weatherSystem.hasOilskinCloak = true;
          }
          return '🧥 防风加厚航海油布斗篷已装备！全天候暴风雨失温完全免疫！';
        }
      },
      {
        id: 'storm_fire_shelter',
        type: 'perk_permanent',
        title: '合金避雷防雨营火棚',
        subtitle: 'All-Weather Fire Shelter',
        badge: '营地温暖',
        icon: '⛺',
        priceSOL: 0.05,
        priceToken: 12,
        desc: '为营地主篝火打造轻合金防风避雷顶棚，狂风暴雨中篝火永不熄灭，并提供双倍回暖加速！',
        isOwned: () => {
          return this.game.weatherSystem && this.game.weatherSystem.hasFireShelter;
        },
        onPurchase: () => {
          if (this.game.weatherSystem) {
            this.game.weatherSystem.hasFireShelter = true;
          }
          return '⛺ 合金避雷防风营火棚已安装！狂风骤雨中营火永不熄灭！';
        }
      }
    ];

    this.initModal();
  }

  // 初始化商城弹窗容器
  initModal() {
    this.shopBackdrop = document.createElement('div');
    this.shopBackdrop.id = 'shop-modal-backdrop';
    this.shopBackdrop.style.cssText = `
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(10, 16, 26, 0.88);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 10000;
      align-items: center;
      justify-content: center;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    `;

    this.shopContainer = document.createElement('div');
    this.shopContainer.style.cssText = `
      background: linear-gradient(145deg, #182232 0%, #0d1522 100%);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 20px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(153, 69, 255, 0.25);
      width: 100%;
      max-width: 680px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      color: #fff;
    `;

    this.shopBackdrop.appendChild(this.shopContainer);
    document.body.appendChild(this.shopBackdrop);

    // 点击背景空白处关闭
    this.shopBackdrop.addEventListener('click', (e) => {
      if (e.target === this.shopBackdrop) {
        this.close();
      }
    });
  }

  // 打开商城特权界面
  open() {
    if (this.game && this.game.player && this.game.player.resetInput) {
      this.game.player.resetInput();
    }
    this.isOpen = true;
    this.render();
    this.shopBackdrop.style.display = 'flex';
    soundEngine.playPlaceFurniture();
  }

  // 关闭商城
  close() {
    this.isOpen = false;
    this.shopBackdrop.style.display = 'none';
  }

  // 渲染商城主内容
  render() {
    const wallet = solanaBridge.walletAddress;
    const isConnected = solanaBridge.isConnected;
    const playerTokens = (this.game && this.game.ui && this.game.ui.inventory) ? (this.game.ui.inventory['sol_token'] || 0) : 0;
    const miningRig = this.game.miningRig;
    const totalBlocks = miningRig ? miningRig.totalBlocksMined : 0;

    this.shopContainer.innerHTML = `
      <!-- 顶部 Header 状态栏 -->
      <div style="padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 26px;">🛒</span>
          <div>
            <div style="font-size: 17px; font-weight: 900; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px;">
              <span>海岛补给与算力黑市</span>
              <span style="font-size: 11px; background: linear-gradient(90deg, #9945FF, #14F195); color: #000; font-weight: 900; padding: 2px 7px; border-radius: 6px;">
                SOLANA DUAL-PAY
              </span>
            </div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 2px;">
              支持荒岛算力代币免充值兑换与微支付结账 · 探索即是挖矿，特权全线畅享
            </div>
          </div>
        </div>
        <button id="shop-close-btn" style="background: rgba(255,255,255,0.1); border: none; border-radius: 50%; width: 34px; height: 34px; color: #fff; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s;">
          ✕
        </button>
      </div>

      <!-- 钱包与挖矿代币状态指示条 -->
      <div style="padding: 10px 20px; background: rgba(153, 69, 255, 0.12); border-bottom: 1px solid rgba(153, 69, 255, 0.2); display: flex; justify-content: space-between; align-items: center; font-size: 12px; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="color: #14F195;">●</span>
            <span style="color: rgba(255,255,255,0.85);">支付通道：</span>
            <span style="font-family: monospace; font-weight: 700; color: #14F195;">
              ${isConnected ? (wallet ? `${wallet.substring(0, 6)}...${wallet.slice(-4)}` : '游客试玩模式') : '未连接 (支持免密试玩)'}
            </span>
          </div>
          <div style="background: rgba(20, 241, 149, 0.15); border: 1px solid rgba(20, 241, 149, 0.3); border-radius: 6px; padding: 2px 8px; color: #14f195; font-weight: 800; font-family: monospace; display: flex; align-items: center; gap: 4px;">
            <span>🪙 算力代币:</span>
            <span style="font-size: 13px; color: #fff;">${playerTokens}</span>
            <span>枚</span>
            <span style="color: rgba(255,255,255,0.4); margin: 0 2px;">|</span>
            <span style="color: #c7ecee; font-size: 11px;">#${totalBlocks} 区块</span>
          </div>
        </div>
        <button id="shop-switch-wallet-btn" style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 3px 10px; border-radius: 6px; font-size: 11px; cursor: pointer; font-weight: 700;">
          ${isConnected ? '切换身份' : '连接 Phantom'}
        </button>
      </div>

      <!-- 商品展示瀑布流列表 -->
      <div style="padding: 16px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 12px; max-height: calc(85vh - 160px);">
        ${this.products.map(p => {
          const owned = p.isOwned();
          const canAffordTokens = playerTokens >= (p.priceToken || 999);
          return `
            <div style="
              background: ${owned ? 'rgba(0, 184, 148, 0.08)' : 'rgba(255,255,255,0.05)'};
              border: 1px solid ${owned ? 'rgba(0, 184, 148, 0.3)' : 'rgba(255,255,255,0.1)'};
              border-radius: 14px;
              padding: 14px 16px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 16px;
              transition: transform 0.15s, background 0.15s;
            ">
              <div style="display: flex; align-items: flex-start; gap: 12px; flex: 1;">
                <div style="
                  background: rgba(255,255,255,0.08);
                  border-radius: 12px;
                  width: 48px;
                  height: 48px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 26px;
                  flex-shrink: 0;
                ">
                  ${p.icon}
                </div>
                <div style="flex: 1;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 15px; font-weight: 900; color: #fff;">${p.title}</span>
                    <span style="font-size: 10px; background: rgba(255,255,255,0.12); color: #dfe6e9; padding: 1px 6px; border-radius: 4px; font-weight: 700;">
                      ${p.badge}
                    </span>
                  </div>
                  <div style="font-size: 12px; color: rgba(255,255,255,0.65); margin-top: 4px; line-height: 1.45;">
                    ${p.desc}
                  </div>
                </div>
              </div>

              <!-- 右侧购买与状态按钮 (双轨支付通道) -->
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 13px; font-weight: 900; color: #14F195; font-family: monospace;">
                    ${p.priceSOL} SOL
                  </span>
                  ${p.priceToken ? `
                    <span style="font-size: 11px; color: rgba(255,255,255,0.4);">或</span>
                    <span style="font-size: 11px; font-weight: 800; color: #ffeaa7; font-family: monospace; background: rgba(253, 203, 110, 0.12); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(253, 203, 110, 0.25);">
                      🪙 ${p.priceToken} 算力代币
                    </span>
                  ` : ''}
                </div>
                ${owned ? `
                  <button disabled style="
                    background: rgba(0, 184, 148, 0.25);
                    border: 1px solid #00b894;
                    color: #55efc4;
                    padding: 6px 14px;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 900;
                    cursor: default;
                  ">
                    ✅ 已激活
                  </button>
                ` : `
                  <div style="display: flex; gap: 6px; align-items: center;">
                    ${p.priceToken ? `
                      <button class="shop-token-buy-btn" data-id="${p.id}" ${canAffordTokens ? '' : 'disabled'} style="
                        background: ${canAffordTokens ? 'linear-gradient(135deg, #00cec9 0%, #0984e3 100%)' : 'rgba(255,255,255,0.06)'};
                        border: 1px solid ${canAffordTokens ? '#00cec9' : 'rgba(255,255,255,0.1)'};
                        color: ${canAffordTokens ? '#ffffff' : 'rgba(255,255,255,0.3)'};
                        padding: 6px 10px;
                        border-radius: 8px;
                        font-size: 11px;
                        font-weight: 900;
                        cursor: ${canAffordTokens ? 'pointer' : 'not-allowed'};
                        box-shadow: ${canAffordTokens ? '0 4px 10px rgba(0, 206, 201, 0.3)' : 'none'};
                        transition: transform 0.1s;
                      " title="${canAffordTokens ? '使用营地矿机出块获得的荒岛算力代币免充值兑换' : `代币不足 (还差 ${(p.priceToken || 0) - playerTokens} 枚)，去营地矿机出块！`}">
                        🪙 算力代币兑换
                      </button>
                    ` : ''}
                    <button class="shop-buy-btn" data-id="${p.id}" ${Boolean(solanaBridge.treasuryAddress) ? '' : 'disabled'} style="
                      background: ${Boolean(solanaBridge.treasuryAddress) ? 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)' : 'rgba(255,255,255,0.08)'};
                      border: ${Boolean(solanaBridge.treasuryAddress) ? 'none' : '1px solid rgba(255,255,255,0.15)'};
                      color: ${Boolean(solanaBridge.treasuryAddress) ? '#0b101b' : 'rgba(255,255,255,0.35)'};
                      padding: 6px 12px;
                      border-radius: 8px;
                      font-size: 11px;
                      font-weight: 900;
                      cursor: ${Boolean(solanaBridge.treasuryAddress) ? 'pointer' : 'not-allowed'};
                      box-shadow: ${Boolean(solanaBridge.treasuryAddress) ? '0 4px 12px rgba(153, 69, 255, 0.4)' : 'none'};
                      transition: transform 0.1s;
                    " title="${Boolean(solanaBridge.treasuryAddress) ? `使用 Solana 钱包支付 ${p.priceSOL} SOL` : '官方收款地址未配置，支付通道已安全关闭'}">
                      ${Boolean(solanaBridge.treasuryAddress) ? 'SOL 结账' : '暂未开放'}
                    </button>
                  </div>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- 底部安全与背书声明 -->
      <div style="padding: 12px 20px; background: rgba(0,0,0,0.3); border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: rgba(255,255,255,0.5);">
        <span>🔒 具备安全本地沙盒与 Schema 自动落盘机制</span>
        <span>支持荒岛算力代币兑换与 Devnet 极速模拟测试</span>
      </div>
    `;

    // 绑定关闭按钮事件
    const closeBtn = this.shopContainer.querySelector('#shop-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // 绑定钱包切换
    const switchBtn = this.shopContainer.querySelector('#shop-switch-wallet-btn');
    if (switchBtn) {
      switchBtn.addEventListener('click', async () => {
        await solanaBridge.connectWallet();
        this.render();
      });
    }

    // 绑定 SOL 购买按钮事件
    const buyBtns = this.shopContainer.querySelectorAll('.shop-buy-btn');
    buyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const prodId = btn.getAttribute('data-id');
        this.handleCheckout(prodId, false);
      });
    });

    // 绑定 算力代币 算力代币免充值兑换事件
    const tokenBuyBtns = this.shopContainer.querySelectorAll('.shop-token-buy-btn');
    tokenBuyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const prodId = btn.getAttribute('data-id');
        this.handleCheckout(prodId, true);
      });
    });
  }

  // 处理购买结账 (支持 SOL 支付 与 算力代币 算力代币双轨结算)
  async handleCheckout(productId, useToken = false) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const toast = this.game.ui;

    // 1. 若使用 算力代币 算力代币兑换 (Play-to-Unlock 闭环)
    if (useToken) {
      const inv = this.game.ui.inventory;
      const reqTokens = product.priceToken || 999;
      if ((inv['sol_token'] || 0) < reqTokens) {
        if (toast) toast.showToast(`行囊中算力代币不足 (需 ${reqTokens} 枚)！前往营地矿机出块！`, 'medium');
        return;
      }

      inv['sol_token'] -= reqTokens;
      if (inv['sol_token'] <= 0) delete inv['sol_token'];
      this.game.ui.renderInventory();

      // 消费 15% 注入母晶池
      if (this.game && this.game.miningRig && this.game.miningRig.onSinkSpent) {
        this.game.miningRig.onSinkSpent(reqTokens, 'shop');
      }

      // 先持久化扣费
      if (this.game.saveSystem) {
        this.game.saveSystem.saveGame('token_purchase_commit');
      }

      const msg = product.onPurchase();
      soundEngine.playLevelUp();

      // 再持久化特权状态
      if (this.game.saveSystem) {
        this.game.saveSystem.saveGame('token_purchase');
      }

      if (toast) {
        toast.showDialog(
          '🎉 算力代币兑换成功！',
          `成功消耗 ${reqTokens} 枚【荒岛算力代币】兑换【${product.title}】！\n\n${msg}\n\n• 当前剩余算力代币: ${inv['sol_token'] || 0} 枚\n• 闭环达成: 零充值纯靠探索与 DePIN 矿场畅享特权！`
        );
      }
      this.render();
      return;
    }

    // 2. 传统 SOL 钱包微支付流程
    soundEngine.playPlaceFurniture();

    if (!solanaBridge.treasuryAddress) {
      if (toast) toast.showToast('官方收款地址未配置，支付功能已安全禁用', 'important');
      return;
    }

    if (!solanaBridge.isConnected) {
      if (toast) toast.showToast('请先连接 Solana 钱包或启动游客试玩', 'medium');
      this.game.ui.openSolanaModal();
      return;
    }

    if (toast) {
      toast.showToast(`⏳ 正在请求钱包签署 ${product.priceSOL} SOL 支付交易...`, 'medium');
    }

    try {
      const txResult = await solanaBridge.sendPaymentTransaction(product.priceSOL);
      if (!txResult.success) {
        if (toast) toast.showToast(`❌ 支付未完成: ${txResult.message}`, 'important');
        return;
      }

      // 付费授予必须先持久化后发放 (Persist before grant)
      // 1. 交易确认后先将支付凭证落盘提交
      if (this.game.saveSystem) {
        const commitSave = this.game.saveSystem.saveGame('shop_purchase_commit');
        if (!commitSave || !commitSave.success) {
          console.error('❌ [ShopManager] 购买确认存档失败，拒绝授予特权:', commitSave?.msg);
          if (toast) toast.showToast('⚠️ 存档异常：为保障资产安全，特权暂缓发放，请联系支持', 'important');
          return;
        }
      }

      // 2. 存档正常后，再行使特权发放
      const txShort = String(txResult.signature).slice(0, 10) + '...';
      const msg = product.onPurchase();

      // 3. 再次保存锁定已发放的特权状态
      if (this.game.saveSystem) {
        this.game.saveSystem.saveGame('shop_purchase');
      }

      soundEngine.playLevelUp();

      if (toast) {
        toast.showToast(`🎉 支付成功！TX: [${txShort}]\n${msg}`, 'important');
      }

      // 重新渲染面板
      this.render();
    } catch (err) {
      console.error('支付处理异常:', err);
      if (toast) toast.showToast(`支付异常: ${err.message || '未知错误'}`, 'important');
    }
  }
}
