import { economyLedger, isEconomyResource } from '../systems/EconomyLedger.js';
import { soundEngine } from '../core/AudioSystem.js';
import { VirtualJoystick } from './VirtualJoystick.js';
import { solanaBridge } from '../core/SolanaBridge.js';
import { CraftingSystem } from '../systems/CraftingSystem.js';
import { CRAFTING_CATEGORIES, CRAFTING_BLUEPRINTS, CraftingBlueprintManager } from '../core/CraftingBlueprints.js';
import { ShopManager } from './ShopManager.js';
import { haptics } from '../core/HapticFeedback.js';
import { createElement, Backpack, Hammer, BookOpen, Maximize, Minimize, MoreHorizontal, Wallet, Zap, ArrowUp, Droplets, MessageCircle, Gem, Mountain, Sailboat, PawPrint, Heart, Fish, Flame, Bed, Trees, Drumstick, Menu } from 'lucide';
import { VISUAL_QUALITY_KEY } from '../core/VisualQuality.js';
import { iconHTML, getSurvivalIconHtml, getWeatherIconHtml } from './IconRegistry.js'; // 黏土图标集成（2026-10-31）
import { NoticeCenter, NOTICE_MODES } from './NoticeCenter.js'; // 提示系统优化（2026-10-31）
import cozyPortraitHudCSS from './CozyPortraitHud.css?inline';
import cozyLandscapeHudCSS from './CozyLandscapeHud.css?inline';
import { ODDS_TABLE, expectedCritMultiplier, clusterWeightTotal, motherlodeProbability, estimateSquareEV, scannerHints, npcArrival } from '../systems/resonance/ResonanceEngine.js';

function hudIcon(definition) {
  const svg = createElement(definition);
  svg.setAttribute('class', 'hud-icon');
  svg.setAttribute('aria-hidden', 'true');
  return svg.outerHTML;
}

// UI 第一步优化（2026-10-31，手机优先）：界面上不显示任何键盘提示（「按 [E] 或」「[F]」等），键盘快捷键本身保留
function formatKeyHints(text) {
  if (text == null) return text;
  // UI 第二步优化：同时去掉全角写法「按【E】」「【R】键」
  return String(text).replace(/按下?\s*[\[【][A-Za-z][\]】]\s*键?\s*(或\s*)?/g, '').replace(/\s*[\[【][A-Za-z][\]】]\s*键?/g, '');
}

export class UIManager {
  constructor(buildSystem, dayNightCycle, playerController, survivalSystem, onActionCallback) {
    this.buildSystem = buildSystem;
    this.dayNightCycle = dayNightCycle;
    this.player = playerController;
    this.survival = survivalSystem;
    this.onActionCallback = onActionCallback;
    this.crafting = new CraftingSystem();

    // 荒岛求生真实初始行囊：仅保留海难漂流随身携带的 1 只应急青苹果
    this.inventory = {
      apple: 1
    };

    // 行囊容量上限 (默认 10 种物品，可通过加厚兽皮行囊或商业化特权扩充)
    this.baseInventorySlots = 10;
    this.bonusInventorySlots = 0;

    // 选中的物品槽位
    this.selectedItemId = 'apple';
    // Merge 台选中的双物品
    this.mergeSlots = [null, null];
    this.mergeTab = 'materials'; // 'materials' | 'blueprints'
    this.mergeCategory = 'all'; // 'all' | 'combat' | 'tools' | 'medical_food' | 'escape_base'

    this.currentQuest = '🚩 阶段1：摇晃果树采集果实，并在背包中点击食用充饥！';

    this.initUI();
    this.initTouchControls();

    // 全屏场景航行转场黑幕
    this.fadeOverlay = document.createElement('div');
    this.fadeOverlay.id = 'scene-fade-overlay';
    this.fadeOverlay.style.cssText = `
      position: fixed; inset: 0; width: 100vw; height: 100vh;
      background: #0b1318; z-index: 9999; opacity: 0;
      pointer-events: none; transition: opacity 0.45s ease-in-out;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: #fff; font-family: 'Fredoka', 'Noto Sans SC', sans-serif;
    `;
    this.fadeOverlay.innerHTML = `
      <div style="font-size: 42px; margin-bottom: 12px; animation: floatAnim 1.5s ease-in-out infinite;">⛵</div>
      <div style="font-size: 16px; font-weight: 800; color: #00cec9; letter-spacing: 1px;">乘风破浪航行中……</div>
    `;
    document.body.appendChild(this.fadeOverlay);
  }

  initUI() {
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Noto+Sans+SC:wght@500;700;900&display=swap');

      * {
        box-sizing: border-box;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
        -webkit-tap-highlight-color: transparent;
        outline: none;
      }
      body, html {
        margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden;
        font-family: 'Fredoka', 'Noto Sans SC', sans-serif;
        touch-action: none;
      }

      /* 探索 HUD */
      .top-dashboard {
        position: absolute;
        top: calc(12px + var(--sat, 0px));
        left: calc(14px + var(--sal, 0px));
        z-index: 100;
        display: flex; flex-direction: column; gap: 8px;
        width: min(320px, calc(100vw - 28px));
      }

      .dashboard-panel {
        background: rgba(24, 42, 39, 0.9);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 22px;
        border-top: 3px solid #e7cd89;
        padding: 14px 16px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.38);
        color: #ffffff;
      }

      /* 状态与时间栏 */
      .stats-header {
        display: flex; justify-content: space-between; align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 8px; margin-bottom: 8px;
      }
      .time-tag {
        font-size: 13px; font-weight: 700; color: #ffdd59;
        display: flex; align-items: center; gap: 6px;
      }
      .canteen-pill {
        background: linear-gradient(135deg, #0984e3, #00cec9);
        padding: 4px 10px; border-radius: 12px;
        font-size: 11px; font-weight: 700; color: #ffffff;
        cursor: pointer; box-shadow: 0 2px 8px rgba(0, 206, 201, 0.4);
        transition: transform 0.1s;
      }
      .canteen-pill:active { transform: scale(0.95); }

      /* 四维生存仪表槽 */
      .gauges-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px;
      }
      .gauge-item {
        display: flex; flex-direction: column; gap: 3px;
      }
      .gauge-label-row {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 12px; font-weight: 700; color: rgba(255, 255, 255, 0.9);
      }
      .gauge-track {
        width: 100%; height: 7px; background: rgba(0, 0, 0, 0.5);
        border-radius: 4px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .gauge-fill {
        height: 100%; border-radius: 3px; transition: width 0.35s ease-out;
      }
      .gauge-fill-life { background: linear-gradient(90deg, #ff7675, #d63031); box-shadow: 0 0 8px rgba(214, 48, 49, 0.6); }
      .gauge-fill-hunger { background: linear-gradient(90deg, #fdcb6e, #e17055); box-shadow: 0 0 8px rgba(225, 112, 85, 0.6); }
      .gauge-fill-water { background: linear-gradient(90deg, #74b9ff, #0984e3); box-shadow: 0 0 8px rgba(9, 132, 227, 0.6); }
      .gauge-fill-fatigue { background: linear-gradient(90deg, #a29bfe, #6c5ce7); box-shadow: 0 0 8px rgba(108, 92, 231, 0.6); }

      /* CastawaySOL 经典当前主线目标 Banner */
      .quest-banner {
        background: rgba(250, 242, 218, 0.96);
        border: 1px solid rgba(255, 255, 255, 0.65);
        border-radius: 12px;
        padding: 8px 12px;
        min-height: 38px;
        font-size: 12px; font-weight: 700; color: #344c40; line-height: 1.5;
        display: flex; align-items: center; gap: 6px;
      }

      /* 右上角操作按键组 (全屏、背包、Merge、手册、Solana) */
      .top-right-group {
        position: absolute;
        top: calc(12px + var(--sat, 0px));
        right: calc(14px + var(--sar, 0px));
        z-index: 100;
        display: flex; gap: 8px; align-items: center; justify-content: flex-end;
        max-width: min(58vw, 610px);
      }
      .hud-nav-btn {
        background: rgba(18, 24, 28, 0.82);
        backdrop-filter: blur(14px);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 18px; padding: 12px 16px; min-height: 48px;
        color: #ffffff; font-size: 13px; font-weight: 700;
        display: flex; align-items: center; gap: 6px;
        cursor: pointer; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25);
        font-family: inherit; line-height: 1; white-space: nowrap;
        transition: transform 0.1s, background 0.15s;
      }
      .hud-nav-btn:hover { background: rgba(36, 48, 56, 0.95); }
      .hud-nav-btn:active { transform: scale(0.95); }
      .hud-nav-sol {
        background: linear-gradient(135deg, #9945FF 0%, #14F195 100%);
        border: 1px solid rgba(255, 255, 255, 0.4);
        box-shadow: 0 4px 18px rgba(153, 69, 255, 0.4);
      }
      .hud-nav-secondary { display: none; }
      .hud-nav-secondary.open {
        display: flex; position: absolute; top: calc(100% + 8px); right: 0;
        flex-direction: column; align-items: stretch; min-width: 160px; gap: 6px;
        padding: 8px; border: 1px solid rgba(255,255,255,.16); border-radius: 16px;
        background: rgba(18,24,28,.94); backdrop-filter: blur(16px);
      }

      /* 右下角大尺寸情境动作胶囊 (Context Action Capsule) */
      .mobile-action-zone {
        position: absolute;
        bottom: calc(20px + var(--sab, 0px));
        right: calc(20px + var(--sar, 0px));
        z-index: 100;
        display: flex; flex-direction: column; align-items: flex-end; gap: 12px;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      .aux-action-row {
        display: flex; gap: 10px; align-items: center;
        touch-action: manipulation;
      }
      .aux-btn {
        width: 54px; height: 54px; border-radius: 50%;
        background: rgba(18, 24, 28, 0.85);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1.5px solid rgba(255, 255, 255, 0.28);
        color: #ffffff; font-size: 16px; font-weight: 700;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        box-shadow: 0 6px 22px rgba(0,0,0,0.35);
        cursor: pointer; transition: transform 0.08s ease-out, border-color 0.15s;
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      .aux-btn:active { transform: scale(0.90); border-color: #00cec9; }
      .aux-btn-label { font-size: 9.5px; color: rgba(255, 255, 255, 0.8); margin-top: 1px; pointer-events: none; }

      /* 主情境动作大胶囊 */
      .main-action-capsule {
        width: 154px; height: 68px;
        border-radius: 36px;
        background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
        border: 2px solid rgba(255, 255, 255, 0.7);
        box-shadow: 0 8px 30px rgba(0, 206, 201, 0.5);
        display: flex; align-items: center; justify-content: center; gap: 10px;
        color: #ffffff; font-size: 20px; font-weight: 900;
        cursor: pointer; transition: transform 0.08s ease-out, box-shadow 0.2s;
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      .main-action-capsule:active {
        transform: scale(0.93);
        box-shadow: 0 4px 15px rgba(0, 206, 201, 0.35);
      }

      /* 底部快捷物品栏 (避开中央角色，布局在左侧摇杆旁，防遮挡与静默横滑) */
      .bottom-quick-bar {
        position: absolute;
        bottom: calc(14px + var(--sab, 0px));
        left: calc(185px + max(16px, var(--sal, 0px)));
        transform: none;
        background: rgba(18, 24, 28, 0.85);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 18px;
        padding: 5px 8px;
        display: flex; gap: 6px; align-items: center;
        box-shadow: 0 8px 30px rgba(0,0,0,0.35);
        z-index: 90;
        max-width: min(36vw, calc(100vw - 420px));
        overflow-x: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .bottom-quick-bar::-webkit-scrollbar {
        display: none; width: 0; height: 0;
      }
      .quick-slot {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        padding: 5px 8px; min-width: 52px; min-height: 46px;
        display: flex; flex-direction: column; align-items: center; gap: 2px;
        color: #ffffff; font-size: 11px; font-weight: 700;
        cursor: pointer; white-space: nowrap; transition: background 0.15s, transform 0.1s;
      }
      .quick-slot.selected {
        border-color: rgba(255,221,89,.9); background: rgba(255,221,89,.2);
        box-shadow: 0 0 14px rgba(255,221,89,.2);
      }
      @media (orientation: landscape) and (max-height: 500px) {
        .top-dashboard { top: calc(8px + var(--sat, 0px)); left: calc(8px + var(--sal, 0px)); width: min(310px, 34vw); gap: 5px; }
        .dashboard-panel { padding: 7px 10px; border-radius: 14px; }
        .stats-header { padding-bottom: 5px; margin-bottom: 5px; }
        .time-tag { font-size: 11px; }
        .canteen-pill { padding: 5px 8px; font-size: 10px; }
        .gauges-grid { gap: 5px 10px; }
        .gauge-label-row { font-size: 10px; }
        .gauge-track { height: 6px; }
        .quest-banner { min-height: 34px; padding: 6px 9px; font-size: 10px; }
        .top-right-group { top: calc(8px + var(--sat, 0px)); right: calc(8px + var(--sar, 0px)); gap: 5px; max-width: 62vw; }
        .hud-nav-btn { min-height: 42px; padding: 7px 10px; border-radius: 12px; font-size: 11px; }
        .hud-nav-desktop-label { display: none; }
        .mobile-action-zone { right: calc(10px + var(--sar, 0px)); bottom: calc(10px + var(--sab, 0px)); gap: 7px; }
        .aux-action-row { gap: 7px; }
        .aux-btn { width: 46px; height: 46px; font-size: 14px; }
        .aux-btn-label { font-size: 9px; }
        .main-action-capsule { width: 136px; height: 58px; font-size: 17px; }
        .bottom-quick-bar { bottom: calc(10px + var(--sab, 0px)); max-width: min(44vw, calc(100vw - 340px)); padding: 5px 8px; gap: 5px; }
        .quick-slot { min-height: 40px; padding: 5px 7px; font-size: 11px; }
        .toast-banner { top: 82px; max-width: 60vw; text-align: center; font-size: 13px; }
      }
      @media (max-width: 620px) and (orientation: landscape) {
        .top-dashboard { width: min(270px, 36vw); }
        .time-tag { font-size: 10px; }
        .top-right-group { max-width: 58vw; }
        .hud-nav-btn { min-width: 42px; justify-content: center; padding: 7px; font-size: 17px; }
        .bottom-quick-bar { max-width: calc(100vw - 300px); }
        .quick-slot { gap: 3px; }
      }
      @media (max-height: 430px) and (orientation: landscape) {
        .top-dashboard { top: calc(5px + var(--sat, 0px)); }
        .mobile-action-zone { bottom: calc(6px + var(--sab, 0px)); }
        .main-action-capsule { height: 52px; }
        .aux-btn { width: 42px; height: 42px; }
        .bottom-quick-bar { bottom: calc(6px + var(--sab, 0px)); }
      }

      /* === 手机竖屏自适应专精适配 (Mobile Portrait Adaptive) === */
      @media (orientation: portrait) {
        .top-dashboard {
          top: calc(8px + var(--sat, 0px));
          left: calc(8px + var(--sal, 0px));
          width: calc(100vw - 16px - var(--sal, 0px) - var(--sar, 0px));
          max-width: none;
          gap: 6px;
        }
        .dashboard-panel {
          padding: 8px 12px;
          border-radius: 16px;
        }
        .stats-header {
          padding-bottom: 6px;
          margin-bottom: 6px;
          flex-wrap: wrap;
          gap: 6px;
        }
        .time-tag { font-size: 11px; }
        .canteen-pill { font-size: 11px; padding: 4px 8px; }
        .gauges-grid {
          grid-template-columns: repeat(4, 1fr);
          gap: 4px 8px;
        }
        .gauge-label-row { font-size: 10px; }
        .gauge-track { height: 5px; }
        .quest-banner {
          font-size: 11px;
          padding: 6px 10px;
          min-height: 32px;
          line-height: 1.4;
        }
        .top-right-group {
          top: calc(86px + var(--sat, 0px));
          right: calc(8px + var(--sar, 0px));
          max-width: calc(100vw - 16px);
          gap: 6px;
        }
        .hud-nav-btn {
          min-height: 38px;
          padding: 6px 10px;
          border-radius: 12px;
          font-size: 12px;
        }
        .hud-nav-desktop-label { display: none; }

        .mobile-action-zone {
          right: calc(12px + var(--sar, 0px));
          bottom: calc(16px + var(--sab, 0px));
          gap: 10px;
        }
        .aux-btn {
          width: 48px;
          height: 48px;
          font-size: 16px;
        }
        .main-action-capsule {
          width: 126px;
          height: 56px;
          font-size: 16px;
        }
        .bottom-quick-bar {
          left: 50%;
          transform: translateX(-50%);
          bottom: calc(82px + var(--sab, 0px));
          max-width: calc(100vw - 24px);
          padding: 6px 8px;
          gap: 6px;
        }
        .quick-slot {
          min-width: 54px;
          min-height: 48px;
          padding: 6px 6px;
          font-size: 11px;
        }
        .modal-card {
          width: calc(100vw - 16px);
          max-height: calc(100vh - 32px - var(--sat, 0px) - var(--sab, 0px));
          border-radius: 18px;
        }
        .toast-banner {
          top: 140px;
          max-width: 88vw;
          font-size: 13px;
          padding: 8px 16px;
        }
      }
      
      .quick-slot-badge { display: none; }
      @media (orientation: portrait) {
        .quick-slot-label { display: none !important; }
        .quick-slot-badge {
          display: block !important;
          position: absolute;
          top: -3px; right: -3px;
          background: #00cec9;
          color: #0b101b;
          font-size: 9px;
          font-weight: 900;
          line-height: 1;
          padding: 2px 4px;
          border-radius: 6px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        }
      }
.quick-slot:hover, .quick-slot:active {
        background: rgba(255, 255, 255, 0.2); transform: scale(1.04);
      }

      /* 醒目全局 Toast 提示 */
      .toast-banner {
        position: absolute; top: 110px; left: 50%; transform: translateX(-50%);
        background: rgba(18, 24, 28, 0.92);
        backdrop-filter: blur(14px);
        border: 1px solid rgba(255, 221, 89, 0.4);
        padding: 10px 24px; border-radius: 30px;
        color: #fffa65; font-size: 15px; font-weight: 700;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
        display: none; align-items: center; gap: 8px;
        z-index: 500; pointer-events: none;
      }

      /* 模态大弹窗框架 (背包/Merge/帮助) */
      .modal-backdrop {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.72);
        backdrop-filter: blur(12px);
        display: none; align-items: center; justify-content: center;
        z-index: 600;
      }
      .modal-card {
        background: rgba(22, 27, 34, 0.96);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 2px solid rgba(255, 221, 89, 0.32);
        border-radius: 20px;
        width: calc(100% - 32px - var(--sal, 0px) - var(--sar, 0px));
        max-width: 780px;
        max-height: calc(100vh - 28px - var(--sat, 0px) - var(--sab, 0px));
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.75);
        color: #ffffff; display: flex; flex-direction: column;
        overflow: hidden;
      }
      .modal-header {
        background: rgba(0, 0, 0, 0.35);
        padding: 10px 18px;
        display: flex; justify-content: space-between; align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .modal-title { font-size: 16px; font-weight: 900; color: #ffdd59; display: flex; align-items: center; gap: 8px; }
      .modal-close-btn {
        width: 32px; height: 32px; border-radius: 50%;
        background: rgba(255, 255, 255, 0.1); border: none;
        color: #ffffff; font-size: 16px; cursor: pointer;
        display: flex; align-items: center; justify-content: center; transition: all 0.15s;
      }
      .modal-close-btn:hover { background: rgba(235, 77, 75, 0.7); }
      .modal-body {
        padding: 12px 16px; overflow-y: auto; flex: 1; min-height: 0;
      }
      .modal-body::-webkit-scrollbar { width: 5px; }
      .modal-body::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 3px; }

      /* 双栏横屏布局通用容器 */
      .split-modal-layout {
        display: flex; gap: 14px; min-height: 230px;
      }
      @media (max-width: 620px) {
        .split-modal-layout { flex-direction: column; }
      }

      /* 探险行囊左栏 4x4 网格 */
      .inv-left-pane {
        flex: 0 0 54%; display: flex; flex-direction: column;
      }
      .inv-grid {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
        max-height: 206px; overflow-y: auto; padding-right: 2px;
      }
      .inv-grid::-webkit-scrollbar { width: 4px; }
      .inv-grid::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 2px; }
      .inv-cell {
        min-height: 64px;
        background: rgba(255, 255, 255, 0.05);
        border: 1.5px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        position: relative; cursor: pointer; transition: all 0.15s;
      }
      .inv-cell.selected {
        border-color: #ffdd59; background: rgba(255, 221, 89, 0.18);
        box-shadow: 0 0 14px rgba(255, 221, 89, 0.4); transform: translateY(-1px);
      }
      .inv-icon { font-size: 20px; line-height: 1; }
      .inv-name { font-size: 12px; font-weight: 700; color: rgba(255, 255, 255, 0.9); margin-top: 4px; text-align: center; }
      .inv-count {
        position: absolute; top: 2px; right: 4px;
        background: rgba(0, 0, 0, 0.7); padding: 0 4px; border-radius: 4px;
        font-size: 9px; font-weight: 900; color: #00cec9;
      }

      /* 探险行囊右栏 详情与操作卡 */
      .inv-right-pane {
        flex: 1; display: flex; flex-direction: column; justify-content: space-between;
        background: rgba(0, 0, 0, 0.28); border-radius: 14px; padding: 10px 12px;
        border: 1px solid rgba(255, 255, 255, 0.08); min-height: 206px;
      }
      .item-detail-panel {
        display: flex; flex-direction: column; gap: 6px;
      }
      .detail-title { font-size: 15px; font-weight: 900; color: #ffdd59; display: flex; align-items: center; gap: 6px; }
      .detail-desc { font-size: 13px; color: rgba(255, 255, 255, 0.82); line-height: 1.6; }
      .detail-stat-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
      .stat-pill { font-size: 12px; font-weight: 800; padding: 4px 8px; border-radius: 6px; }
      .detail-action-btn {
        background: linear-gradient(135deg, #00b894, #00cec9);
        border: none; border-radius: 12px; padding: 10px 14px;
        color: #ffffff; font-size: 14px; font-weight: 900;
        cursor: pointer; box-shadow: 0 4px 15px rgba(0, 206, 201, 0.35);
        transition: transform 0.1s; width: 100%;
      }
      .detail-action-btn:active { transform: scale(0.97); }

      /* CastawaySOL 合成台专属双栏 */
      .merge-left-pane {
        flex: 0 0 42%; display: flex; flex-direction: column; align-items: center; justify-content: space-between;
        background: rgba(0, 0, 0, 0.28); border-radius: 16px; padding: 12px;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .merge-slots-row {
        display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%;
      }
      .merge-slot {
        flex: 1; max-width: 82px; height: 82px;
        background: rgba(255, 255, 255, 0.05);
        border: 2px dashed rgba(255, 255, 255, 0.25);
        border-radius: 16px;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        cursor: pointer; position: relative; transition: all 0.15s;
      }
      .merge-slot.filled {
        border-style: solid; border-color: #00cec9; background: rgba(0, 206, 201, 0.12);
        box-shadow: 0 0 16px rgba(0, 206, 201, 0.25);
      }
      .merge-slot-remove {
        position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%;
        background: #e17055; color: #fff; font-size: 11px; display: flex; align-items: center; justify-content: center;
      }
      .merge-plus { font-size: 20px; font-weight: 900; color: #ffdd59; }
      .merge-preview-pill {
        width: 100%; text-align: center; font-size: 12px; font-weight: 700; color: #dfe6e9;
        background: rgba(255, 255, 255, 0.06); padding: 6px 8px; border-radius: 10px; margin: 8px 0;
        min-height: 28px; display: flex; align-items: center; justify-content: center;
      }
      .merge-submit-btn {
        width: 100%;
        background: linear-gradient(135deg, #fdcb6e, #e17055);
        border: none; border-radius: 14px; padding: 11px 0;
        color: #ffffff; font-size: 15px; font-weight: 900;
        cursor: pointer; box-shadow: 0 4px 18px rgba(225, 112, 85, 0.45);
        transition: transform 0.1s, opacity 0.2s;
      }
      .merge-submit-btn:active { transform: scale(0.97); }

      /* 合成台右栏 (原料选择卡片网格与蓝图清单) */
      .merge-right-pane {
        flex: 1; display: flex; flex-direction: column; min-width: 0;
        background: rgba(0, 0, 0, 0.22); border-radius: 16px; padding: 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .tab-header-row {
        display: flex; gap: 8px; margin-bottom: 8px;
      }
      .tab-btn {
        flex: 1; padding: 10px 8px; min-height: 42px; border-radius: 10px; border: none;
        font-size: 12px; font-weight: 800; cursor: pointer;
        background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.7);
        transition: all 0.15s;
      }
      .tab-btn.active {
        background: #ffdd59; color: #1e272e;
      }
      .material-cards-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 8px;
        overflow-y: auto; max-height: 200px; padding-right: 4px;
      }
      .material-cards-grid::-webkit-scrollbar { width: 4px; }
      .material-cards-grid::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 2px; }
      .material-card {
        background: rgba(255, 255, 255, 0.06); border: 1.5px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px; padding: 8px 6px; display: flex; flex-direction: column; align-items: center;
        cursor: pointer; transition: all 0.15s; position: relative;
      }
      .material-card:hover {
        border-color: #00cec9; background: rgba(0, 206, 201, 0.15); transform: translateY(-1px);
      }
      .material-card-icon { font-size: 24px; }
      .material-card-name { font-size: 11px; font-weight: 700; color: #fff; margin-top: 2px; }
      .material-card-count {
        position: absolute; top: 4px; right: 6px; font-size: 10px; font-weight: 900; color: #ffdd59;
        background: rgba(0, 0, 0, 0.55); padding: 1px 5px; border-radius: 6px;
      }
      .blueprint-list {
        display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: 200px; padding-right: 4px;
      }
      .blueprint-list::-webkit-scrollbar { width: 4px; }
      .blueprint-list::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 2px; }
      .blueprint-item {
        background: rgba(255, 255, 255, 0.05); border-radius: 10px; padding: 8px 10px;
        display: flex; justify-content: space-between; align-items: center; font-size: 12px;
      }
      .blueprint-formula { font-weight: 700; color: #f5f6fa; }
      .blueprint-apply-btn {
        background: #00b894; border: none; border-radius: 8px; padding: 4px 10px;
        color: #fff; font-size: 12px; min-height: 40px; font-weight: 800; cursor: pointer;
      }
      .blueprint-apply-btn:disabled {
        background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.4); cursor: not-allowed;
      }

      /* 幸存者伙伴打字机对话框 (支持横屏安全区) */
      .animal-dialog {
        position: absolute;
        bottom: calc(20px + var(--sab, 0px));
        left: 50%; transform: translateX(-50%);
        width: 88%; max-width: 620px;
        background: #fcf9ee; border: 4px solid #84c341;
        border-radius: 24px; padding: 14px 20px;
        box-shadow: 0 10px 35px rgba(0, 0, 0, 0.35);
        z-index: 550; display: none; color: #2d3436;
      }
      .dialog-header {
        display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;
      }
      .dialog-tag {
        background: #84c341; color: #ffffff; padding: 4px 14px; border-radius: 12px;
        font-size: 14px; font-weight: 900;
      }
      .dialog-body { font-size: 16px; font-weight: 700; line-height: 1.6; min-height: 50px; white-space: pre-line; }
      .dialog-tap-hint { text-align: right; font-size: 12px; color: #b2bec3; font-weight: 700; margin-top: 6px; }
    `;
    style.textContent += `
      .hud-icon { width: 21px; height: 21px; flex-shrink: 0; stroke-width: 1.8; vertical-align: middle; }
      .dashboard-panel, .modal-card { background: linear-gradient(145deg, rgba(38,61,53,.97), rgba(18,35,32,.96)); border-color: rgba(229,211,163,.28); box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 12px 32px rgba(8,24,20,.3); }
      .modal-header { background: rgba(245,234,201,.06); border-bottom-color: rgba(229,211,163,.18); }
      .modal-title, .detail-title { color: #efdfb7; }
      .hud-nav-btn, .aux-btn { background: linear-gradient(145deg, rgba(47,69,59,.96), rgba(23,42,36,.94)); border-color: rgba(229,211,163,.24); color: #f7efd9; }
      .hud-nav-sol { box-shadow: none; }
      .inv-cell, .material-card { background: rgba(246,237,210,.05); border-color: rgba(246,237,210,.16); }
      .inv-cell.selected { background: rgba(223,199,139,.16); box-shadow: inset 0 0 0 1px #d9c08a; border-color: #d9c08a; }
      .hud-nav-btn:active, .aux-btn:active, .quick-slot:active, .inv-cell:active, .material-card:active { transform: scale(.94); }
      .hud-nav-btn:focus-visible, button:focus-visible { outline: 2px solid #ecd39a; outline-offset: 3px; }
      .toast-banner { color: #f4e8c8; border-color: rgba(226,202,148,.4); background: rgba(28,49,40,.96); }
      @keyframes item-received { 0% { box-shadow: 0 0 0 2px #e8cd89; background: rgba(232,205,137,.35); } 100% { box-shadow: none; } }
      .quick-slot.received { animation: item-received .7s ease-out; }
      .gauge-label-row span:first-child { display: flex; align-items: center; gap: 5px; }
      .gauge-label-row .hud-icon { width: 14px; height: 14px; }
      .gauge-item[data-warning="true"] .gauge-label-row { color: #ffb6a5; }
      .gauge-item[data-warning="true"] .gauge-track { outline: 1px solid #e29a7d; }
      .main-action-capsule .hud-icon { width: 25px; height: 25px; }
      @keyframes toast-enter { from { opacity: 0; translate: 0 -8px; } to { opacity: 1; translate: 0 0; } }
      .toast-banner.toast-enter { animation: toast-enter .2s ease-out; }
      @media (prefers-reduced-motion: reduce) { .toast-banner.toast-enter { animation: none; } }
      @media (prefers-reduced-motion: reduce) { .quick-slot.received { animation: none; border-color: #e8cd89; } }
    `;
    style.textContent += `
      .top-dashboard { width: 248px; gap: 5px; }
      .dashboard-panel { border: 1px solid #b9a675; border-radius: 14px; padding: 7px 9px; }
      .stats-header { margin-bottom: 5px; padding-bottom: 5px; border-color: rgba(232,214,167,.28); }
      .time-tag { color: #f3e9cc; font-size: 12px; letter-spacing: .2px; }
      .gauges-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3px 8px; }
      .gauge-item { position: relative; display: grid; grid-template-columns: minmax(0,1fr) 24px; align-items: center; padding: 3px; gap: 4px; border: 1px solid transparent; border-radius: 6px; }
      .gauge-label-row { display: contents; font-size: 12px; }
      .gauge-label-row span:first-child { grid-column: 1; grid-row: 1; color: #f3e9cc; }
      .gauge-label-row span:last-child { grid-column: 2; grid-row: 1; text-align: right; font-variant-numeric: tabular-nums; font-family: system-ui, sans-serif; font-size: 11px; white-space: nowrap; }
      .gauge-item, .gauge-track { min-width: 0; }
      .gauge-label-row span:first-child { min-width: 0; white-space: nowrap; }
      .gauge-track { grid-column: 1 / -1; grid-row: 2; height: 5px; border: 0; background: rgba(239,223,183,.18); }
      .gauge-fill { box-shadow: none; }
      .gauge-item[data-warning="true"] { background: rgba(183,128,35,.25); border-color: #bd9142; }
      .gauge-item[data-warning="true"] .gauge-track { outline: none; }
      .survival-water-row { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(232,214,167,.28); font-size: 11px; color: #f3e9cc; }
      .canteen-pill { min-width: 56px; min-height: 32px; padding: 3px 8px; border: 1px solid #65c2af; background: #187969; color: #fff4d9; font: inherit; box-shadow: none; }
      .canteen-pill:disabled { opacity: .55; cursor: default; }
      .survival-warning { margin-top: 8px; padding: 7px 9px; border-radius: 10px; background: rgba(161,109,23,.4); border: 1px solid #bd9142; color: #ffe0a0; font-size: 11px; line-height: 1.4; }
      @media (orientation: landscape) and (max-height: 500px) {
        .top-dashboard { width: min(224px, 30vw); }
        .dashboard-panel { padding: 5px 7px; }
        .gauge-item { grid-template-columns: minmax(0,1fr) 20px; gap: 3px; padding: 2px; }
        .gauge-label-row { font-size: 10px; }
        .time-tag { font-size: 12px; }
        .stats-header { padding-bottom: 5px; margin-bottom: 4px; }
        .survival-water-row { margin-top: 4px; padding-top: 5px; font-size: 11px; }
        .canteen-pill { min-height: 32px; }
        .survival-warning { padding: 4px 6px; margin-top: 4px; font-size: 10px; }
      }
    `;
    // UI 第一步优化（2026-10-31）：手机横屏优先：触控尺寸 ≥44px、手机 HUD 最小字号（集中在这一层）
    style.textContent += `
      .hud-nav-btn { min-width: 44px; min-height: 44px; justify-content: center; }
      .hud-nav-secondary .hud-nav-btn { justify-content: flex-start; font-size: 13px; }
      .hud-nav-secondary .hud-nav-desktop-label { display: inline; }
      .aux-btn { min-width: 44px; min-height: 44px; }
      .canteen-pill, .modal-close-btn { position: relative; }
      .canteen-pill::after { content: ''; position: absolute; inset: -6px -2px; }
      .modal-close-btn::after { content: ''; position: absolute; inset: -6px; }
      .gauge-drinkable, .survival-water-row { cursor: pointer; }
      .quick-slot { min-height: 44px; }
      /* 标准设备 Solana Seeker 横屏约 914x411（DPR 2.625），兜底 844x390：按横屏低高度匹配，而不是 max-width 900 */
      @media (orientation: landscape) and (max-height: 500px) {
        /* 安全区：左右至少 24px，避开刘孔与圆角；四角不贴按钮 */
        .top-dashboard { left: max(24px, var(--sal, 0px)); top: max(8px, var(--sat, 0px)); }
        .top-right-group { right: max(24px, var(--sar, 0px)); top: max(10px, var(--sat, 0px)); }
        .mobile-action-zone { right: max(24px, var(--sar, 0px)); bottom: max(12px, var(--sab, 0px)); }
        #joystick-zone { left: max(24px, var(--sal, 0px)) !important; bottom: max(8px, var(--sab, 0px)) !important; }
        .bottom-quick-bar { left: calc(185px + max(16px, var(--sal, 0px))); transform: none; bottom: max(10px, var(--sab, 0px)); }
        .time-tag, .gauge-label-row, .canteen-pill, .survival-water-row, .survival-warning, .quest-banner, .aux-btn-label, .quick-slot { font-size: 12px; }
        .gauge-label-row span:last-child { font-size: 13px; }
        .gauge-item { grid-template-columns: minmax(0,1fr) 26px; }
      }
    `;
    // UI 第二步优化（2026-10-31）：菜单抽屉、任务条与情境标签分离、紧凑状态卡、提示队列、情境攻击键（集中在这一层，便于回滚）
    style.textContent += `
      .hud-drawer-scrim { position: fixed; inset: 0; z-index: 550; background: rgba(6,14,12,.28); opacity: 0; visibility: hidden; transition: opacity .18s, visibility 0s .18s; }
      .hud-drawer-scrim.open { opacity: 1; visibility: visible; transition: opacity .18s; }
      .hud-nav-secondary.hud-drawer, .hud-nav-secondary.hud-drawer.open {
        display: flex; flex-direction: column; align-items: stretch; gap: 4px;
        position: fixed; top: 0; right: 0; bottom: 0; left: auto; min-width: 0;
        width: min(280px, 46vw);
        padding: max(8px, var(--sat, 0px)) max(24px, var(--sar, 0px)) max(8px, var(--sab, 0px)) 14px;
        background: linear-gradient(160deg, rgba(38,61,53,.98), rgba(18,35,32,.98));
        border: 0; border-left: 1px solid rgba(229,211,163,.28); border-radius: 18px 0 0 18px;
        box-shadow: -12px 0 32px rgba(0,0,0,.35);
        overflow-y: auto; z-index: 560;
        transform: translateX(105%); visibility: hidden; transition: transform .2s ease-out, visibility 0s .2s;
      }
      .hud-nav-secondary.hud-drawer.open { transform: none; visibility: visible; transition: transform .2s ease-out; }
      .hud-drawer-title { font-size: 13px; font-weight: 800; color: #efdfb7; padding: 2px 4px; letter-spacing: 1px; flex-shrink: 0; }
      .hud-drawer .hud-nav-btn { width: 100%; min-height: 44px; padding: 0 14px; justify-content: flex-start; border-radius: 12px; font-size: 13px; flex-shrink: 0; }
      .hud-drawer .hud-nav-desktop-label { display: inline; }
      .hud-drawer-quality { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
      .hud-drawer-qlabel { font-size: 12px; font-weight: 700; color: #f3e9cc; min-width: 30px; }
      .quality-opt { flex: 1; min-height: 44px; border-radius: 12px; border: 1px solid rgba(229,211,163,.24); background: rgba(246,237,210,.08); color: #f7efd9; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; }
      .quality-opt[aria-pressed="true"] { background: #d9c08a; color: #1e272e; border-color: #d9c08a; }
      body.hud-drawer-open .top-dashboard, body.hud-drawer-open .top-right-group, body.hud-drawer-open .mobile-action-zone,
      body.hud-drawer-open .bottom-quick-bar, body.hud-drawer-open #joystick-zone, body.hud-drawer-open .toast-stack { opacity: .3; transition: opacity .18s; }
      .toast-stack {
        position: fixed; top: calc(max(10px, var(--sat, 0px)) + 42px); left: 50%; transform: translateX(-50%);
        z-index: 500; pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 6px;
        width: max-content; max-width: min(460px, max(240px, calc(100vw - 440px)));
      }
      .toast-item {
        max-width: 100%; padding: 6px 14px; border-radius: 16px; font-size: 13px; font-weight: 700; line-height: 1.35; text-align: center;
        color: #f4e8c8; background: rgba(28,49,40,.95); border: 1px solid rgba(226,202,148,.4); box-shadow: 0 6px 20px rgba(0,0,0,.35);
        animation: toast-enter .2s ease-out; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      }
      .toast-item.toast-ok { border-color: #63c99a; color: #dff8ea; background: rgba(22,72,52,.95); }
      .toast-item.toast-fail { border-color: #e58a74; color: #ffe2da; background: rgba(92,34,26,.95); }
      .toast-item.toast-gain { border-color: #e8cd89; color: #fff1c9; background: rgba(78,60,22,.95); }
      .toast-count { margin-left: 6px; font-size: 12px; color: #ffdd59; }
      @media (prefers-reduced-motion: reduce) { .toast-item { animation: none; } }
      .aux-btn.ctx-hidden { display: none; }
      .context-tag {
        max-width: 190px; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; line-height: 1.35; text-align: right;
        color: #f7efd9; background: rgba(23,42,36,.88); border: 1px solid rgba(229,211,163,.3); pointer-events: none;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      }
      .context-tag[hidden] { display: none; }
      /* 状态卡修复：竖屏/旧卡最小字号 12px（标签、数值、水壶 3/3、喝水按钮、任务条） */
      @media (orientation: portrait) {
        .top-dashboard .gauge-label-row span, .top-dashboard .gauge-label-row span:last-child, .top-dashboard .survival-water-row, .top-dashboard .survival-water-row span,
        .top-dashboard .canteen-pill, .top-dashboard .survival-warning, .top-dashboard .quest-banner { font-size: 12px; }
      }
      .gauge-fill { width: 100% !important; transform-origin: left center; transition: transform .35s ease-out; }
      .canteen-dots { display: none; }
      @media (orientation: landscape) {
        /* 顶栏只留「背包」「☰ 菜单」；UI 重叠优化：顶栏规则统一按「横屏」匹配 */
        .top-right-group { gap: 8px; max-width: none; }
        .top-right-group .hud-nav-btn { min-width: 48px; min-height: 48px; padding: 0 14px; border-radius: 14px; font-size: 13px; }
        .top-right-group .hud-nav-desktop-label { display: inline; }
      }
      /* 状态卡修复（2026-10-31）：紧凑状态卡改为横屏都生效（不再要求高度 ≤500px），竖屏仍用竖屏样式 */
      @media (orientation: landscape) {
        /* 紧凑状态卡（约 192x60）：图标 + 细条，数值低于 30% 才显示并变色 */
        .top-dashboard { width: 200px; gap: 0; }
        .dashboard-panel { padding: 4px 8px 5px; border-radius: 12px; }
        .stats-header { margin: 0 0 2px; padding: 0; border: 0; gap: 4px; min-height: 16px; flex-wrap: nowrap; }
        .stats-header .time-tag { font-size: 12px; line-height: 16px; white-space: nowrap; }
        #hud-time { flex-shrink: 0; }
        #hud-weather { min-width: 0; overflow: hidden; text-overflow: ellipsis; padding: 0 5px; border-radius: 6px; }
        .gauges-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 8px; }
        .gauge-item { display: flex; flex-direction: row; align-items: center; gap: 3px; height: 14px; padding: 0 2px; border-radius: 5px; } /* 状态卡修复：底层是 column，导致血条被压成 0 高 */
        .gauge-label-row span:first-child { order: 0; flex: 0 0 auto; }
        .gauge-label-row .hud-icon { width: 13px; height: 13px; }
        .gauge-name { display: none; }
        .gauge-track { order: 1; flex: 1 1 auto; min-width: 24px; height: 4px; border-radius: 2px; }
        .gauge-label-row span:last-child { order: 2; flex-shrink: 0; font-size: 13px; font-weight: 800; color: #ffb6a5; }
        .gauge-item:not([data-low="true"]) .gauge-label-row span:last-child { display: none; }
        .gauge-item[data-low="true"] .gauge-fill { background: linear-gradient(90deg, #ff9f7a, #e5533d); }
        .canteen-dots { display: inline-block; order: 3; flex-shrink: 0; font-size: 12px; line-height: 1; letter-spacing: -2px; color: #74b9ff; white-space: nowrap; }
        .gauge-drinkable::after { content: ''; position: absolute; left: -4px; right: -4px; top: -16px; bottom: -16px; }
        .survival-water-row { display: none; }
        .survival-warning { margin-top: 4px; padding: 3px 6px; font-size: 12px; }
      }
      @media (orientation: landscape) {
        /* 任务条：固定在上中，只显示一行（UI 重叠优化：统一为横屏） */
        .quest-banner {
          position: fixed; top: max(10px, var(--sat, 0px)); left: 50%; transform: translateX(-50%); z-index: 95;
          height: 32px; min-height: 0; padding: 0 14px; border-radius: 16px; display: block; line-height: 32px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px;
          width: max-content; max-width: min(440px, calc(100vw - 464px)); /* 状态卡修复：卡片加宽到 200px 后留出间距 */
        }
        /* 右下动作区：主要按钮 48px 以上 */
        .aux-btn { width: 48px; height: 48px; }
        .aux-action-row { gap: 8px; }
        .main-action-capsule { min-height: 52px; }
      }
    `;
    // UI 重叠优化（2026-10-31）：顶栏避让、对话中遮罩、提示下移、主按钮安全区、抽屉不盖菜单键、面板打开 HUD 淡出（集中在这一层，便于回滚）
    style.textContent += `
      :root { --hud-nav-w: 230px; --hud-nav-b: 58px; --hud-top-b: 66px; }
      #btn-quick-mining { position: relative; }
      .hud-sol-gift { position: absolute; top: 4px; right: 4px; width: 10px; height: 10px; border-radius: 50%; background: #ff4757; border: 2px solid #fff; box-shadow: 0 0 6px rgba(255,71,87,.8); pointer-events: none; }
      .hud-sol-gift[hidden] { display: none; }
      .toast-item.toast-quest { -webkit-line-clamp: 4; }
      .hud-dialog-scrim { position: fixed; inset: 0; z-index: 545; background: rgba(6,14,12,.32); display: none; }
      body.hud-dialog-open .hud-dialog-scrim { display: block; }
      body.hud-dialog-open #joystick-zone, body.hud-dialog-open .bottom-quick-bar, body.hud-dialog-open .mobile-action-zone,
      body.hud-modal-open .top-dashboard, body.hud-modal-open .top-right-group, body.hud-modal-open #joystick-zone, body.hud-modal-open .bottom-quick-bar, body.hud-modal-open .mobile-action-zone { opacity: .25 !important; transition: opacity .18s; }
      body.hud-dialog-open #joystick-zone, body.hud-dialog-open #joystick-zone *, body.hud-dialog-open .bottom-quick-bar, body.hud-dialog-open .bottom-quick-bar *, body.hud-dialog-open .mobile-action-zone, body.hud-dialog-open .mobile-action-zone *,
      body.hud-modal-open .top-dashboard, body.hud-modal-open .top-dashboard *, body.hud-modal-open .top-right-group, body.hud-modal-open .top-right-group *, body.hud-modal-open #joystick-zone, body.hud-modal-open #joystick-zone *,
      body.hud-modal-open .bottom-quick-bar, body.hud-modal-open .bottom-quick-bar *, body.hud-modal-open .mobile-action-zone, body.hud-modal-open .mobile-action-zone * { pointer-events: none !important; }
      /* 新浮动摇杆（#virtual-joystick-touch-zone 感应层 z95 / #joystick-base）同样淡出、不可点；快捷栏抬到感应层之上，避免被左半屏感应层盖住点不到 */
      body.hud-dialog-open #joystick-base, body.hud-modal-open #joystick-base, body.hud-drawer-open #joystick-base { opacity: .25 !important; }
      body.hud-dialog-open #virtual-joystick-touch-zone, body.hud-modal-open #virtual-joystick-touch-zone { pointer-events: none !important; }
      .bottom-quick-bar { z-index: 97; }
      /* 抽屉打开时菜单键保持可见可点（再点一次收起），其余顶栏按钮淡出 */
      body.hud-drawer-open .top-right-group { opacity: 1; z-index: 565; }
      body.hud-drawer-open .top-right-group > :not(#btn-hud-more) { opacity: .3; pointer-events: none; }
      body.hud-drawer-open #btn-hud-more { background: rgba(217,192,138,.95); color: #1e272e; }
      @media (orientation: landscape) {
        :root { --hud-ql: calc(max(24px, var(--sal, 0px)) + 212px); --hud-qr: calc(max(24px, var(--sar, 0px)) + var(--hud-nav-w) + 12px); }
        /* 顶栏：算力代币 只显示数量（🎁 改角标），背包/菜单为 48x48 图标键 */
        .top-right-group { gap: 10px; }
        .top-right-group .hud-nav-btn { padding: 0 12px; }
        .top-right-group #btn-open-inv, .top-right-group #btn-hud-more { width: 48px; min-width: 48px; padding: 0; }
        .top-right-group .hud-nav-desktop-label, .top-right-group .hud-sol-unit { display: none; }
        /* 任务条：居中于状态卡与按钮组之间的空隙；上下透明边把点击区撑到 44px，视觉仍是 32px */
        .quest-banner {
          top: calc(max(10px, var(--sat, 0px)) - 6px); left: calc((var(--hud-ql) + 100vw - var(--hud-qr)) / 2);
          max-width: calc(100vw - var(--hud-ql) - var(--hud-qr)); box-sizing: border-box; height: 44px; line-height: 32px;
          border-top: 6px solid transparent; border-bottom: 6px solid transparent; background-clip: padding-box; cursor: pointer;
        }
        .toast-stack { top: calc(max(10px, var(--sat, 0px)) + 40px); left: calc((var(--hud-ql) + 100vw - var(--hud-qr)) / 2); max-width: calc(100vw - var(--hud-ql) - var(--hud-qr)); }
        /* 对话框（晨报等）：顶栏下方居中，可滚动 */
        .animal-dialog {
          top: calc(var(--hud-top-b) + 8px); bottom: auto; width: min(620px, calc(100vw - 48px)); max-width: none; box-sizing: border-box;
          max-height: min(calc(100vh - 80px), calc(100vh - var(--hud-top-b) - 20px)); overflow-y: auto; padding: 10px 16px; border-width: 3px; border-radius: 18px;
        }
        .animal-dialog .dialog-body { font-size: 14px; line-height: 1.55; min-height: 0; }
        .animal-dialog .dialog-header { margin-bottom: 4px; }
        /* 主按钮回到安全区内（右侧 ≥24px） */
        .mobile-action-zone .main-action-capsule { width: 136px; max-width: 136px; box-sizing: border-box; transform-origin: right center; } /* 靠近目标时 scale(1.05) 向左放大，不越过右侧 24px */
        /* 抽屉从顶栏下方开始，不盖住「☰ 菜单」键 */
        .hud-nav-secondary.hud-drawer, .hud-nav-secondary.hud-drawer.open { top: calc(var(--hud-nav-b) + 8px); padding-top: 8px; border-radius: 18px 0 0 18px; }
      }
    `;
    // 黏土图标集成（2026-10-31）：图片图标通用样式（尺寸由 iconHTML 内联指定，点击区仍由按钮本身保证 ≥44px）
    style.textContent += `
      .clay-icon { display: inline-block; vertical-align: middle; object-fit: contain; flex-shrink: 0; pointer-events: none; user-select: none; -webkit-user-select: none; -webkit-user-drag: none; filter: drop-shadow(0 1px 1.5px rgba(0,0,0,.28)); }
      .aux-btn .clay-icon { margin-bottom: 1px; }
      .hud-drawer .clay-nav-icon { margin-right: 2px; }
      
      /* 基础跨端支持：竖屏极简状态条与任务条在横屏/默认下的状态 */
      .portrait-survival-strip { display: none; }
      .quest-card-container { display: contents; }
/* ==========================================================================
         手机竖屏第二轮深度重构 (Mobile Portrait Phase 2 Refinement)
         实证问题彻底解决：
         1. 顶部三层打架 -> 极简单行Survival Kids状态条 (天数/天气/四维/水壶)，高度仅约28px
         2. 右上角图标组与状态条左右分工并列，零重叠
         3. 任务卡折叠简条 -> 默认单行，可点展开全文；顶部总高度压到12%以内
         4. Toast通知排队 -> 置于任务条正下方独占一行，文字不截断，可自动占两行
         5. 底部快捷栏缩小30%并与右侧大胶囊完全解耦避让，结合安全区
         ========================================================================== */
      @media (orientation: portrait) {
        /* --- 1. 顶部状态带：贴顶满宽带 (高 56px + 顶部安全区)，带自身背景与底边框，非悬浮胶囊压画面 --- */
        .top-dashboard {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          width: 100vw !important;
          max-width: 100vw !important;
          height: calc(56px + var(--sat, 0px)) !important;
          margin: 0 !important;
          padding-top: var(--sat, 0px) !important;
          padding-left: calc(max(12px, var(--sal, 0px))) !important;
          padding-right: calc(max(12px, var(--sar, 0px)) + 160px + 8px) !important;
          box-sizing: border-box !important;
          z-index: 120 !important;
          background: rgba(12, 18, 20, 0.94) !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
          border-bottom: 1px solid rgba(229, 211, 163, 0.22) !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
          pointer-events: auto !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          gap: 0 !important;
          transition: opacity 0.2s ease-out !important;
        }
        .dashboard-panel { display: none !important; }

        .portrait-capsule-wrapper {
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          width: 100% !important;
          height: 56px !important;
          gap: 2px !important;
        }

        /* 顶部状态带内部两行层级：第一行生命+水壶，第二行天候+饱水疲三均分，无内层突兀边框与背景 */
        .portrait-survival-strip {
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          gap: 2px !important;
          width: 100% !important;
          height: 100% !important;
          padding: 2px 0 !important;
          box-sizing: border-box !important;
          background: transparent !important;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          color: #f7efd9 !important;
          font-size: 11px !important;
          font-weight: 800 !important;
          white-space: nowrap !important;
          overflow: visible !important;
          transition: opacity 0.2s ease-out !important;
        }

        .strip-row {
          display: flex !important;
          align-items: center !important;
          width: 100% !important;
        }
        .strip-row-top {
          display: flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 8px !important;
          height: 24px !important;
          padding-right: 4px !important;
        }
        .strip-row-top .strip-life { font-size: 13px !important; }
        .strip-row-top .strip-life span { font-size: 14px !important; }
        .strip-row-top .strip-life b { font-size: 14px !important; font-weight: 900 !important; color: #ff7675; }

        .strip-row-bottom {
          display: grid !important;
          grid-template-columns: 1fr 1fr 1fr !important;
          width: 100% !important;
          justify-items: center !important;
          align-items: center !important;
          height: 20px !important;
        }
        .strip-row-bottom .strip-item {
          justify-content: center !important;
          width: 100% !important;
        }
        .portrait-survival-strip.strip-danger-border {
          border-color: #ff3838 !important;
          box-shadow: 0 0 14px rgba(255, 56, 56, 0.75), 0 4px 16px rgba(0,0,0,0.5) !important;
          animation: stripBorderPulse 0.8s infinite alternate !important;
        }
        @keyframes stripBorderPulse {
          0% { border-color: rgba(255, 56, 56, 0.4); box-shadow: 0 0 6px rgba(255, 56, 56, 0.3); }
          100% { border-color: #ff3838; box-shadow: 0 0 16px rgba(255, 56, 56, 0.9); }
        }
        .portrait-survival-strip::-webkit-scrollbar { display: none; }
        .strip-item {
          display: flex !important;
          align-items: center !important;
          gap: 2px !important;
          flex-shrink: 0 !important;
          font-size: 11px !important;
          line-height: 1 !important;
        }
        .strip-stat span { font-size: 11px; }
        .strip-stat b { font-size: 11px; font-weight: 900; }
        .strip-stat.strip-low b { color: #ff7675 !important; }
        .strip-stat.strip-warn b { color: #ff3838 !important; animation: blink 1s infinite alternate; }
        .strip-stat.strip-zero b { color: #ff1e1e !important; text-shadow: 0 0 8px #ff3838 !important; animation: zeroAlert 0.4s infinite alternate !important; }
        @keyframes blink { 0% { opacity: 0.5; } 100% { opacity: 1; } }
        @keyframes zeroAlert { 0% { opacity: 0.4; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1.18); } }
        
        .strip-subline {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          font-size: 11px !important;
          line-height: 1 !important;
          color: rgba(229, 211, 163, 0.65) !important;
          margin-left: 8px !important;
          padding-left: 0 !important;
        }
        .strip-subline .strip-sub-day { color: #ffeaa7; font-size: 11px; }
        .strip-subline .strip-sub-sep { color: rgba(255,255,255,0.3); font-size: 11px; }
        .strip-subline .strip-sub-weather { color: #00cec9; font-size: 11px; }
        .strip-subline .strip-sub-steps { display: none !important; }

        /* --- 2. 顶部右侧导航按键组：收进满宽状态带右端，与带同高居中 (高 48px，gap 8px，右边距 12px) --- */
        .top-right-group {
          position: fixed !important;
          top: calc(var(--sat, 0px) + 4px) !important;
          right: calc(max(12px, var(--sar, 0px))) !important;
          left: auto !important;
          width: 160px !important;
          max-width: 160px !important;
          height: 48px !important;
          z-index: 125 !important;
          display: flex !important;
          gap: 8px !important;
          align-items: center !important;
          justify-content: flex-end !important;
          transition: opacity 0.2s ease-out !important;
        }
        .top-right-group .hud-nav-btn {
          min-width: 48px !important;
          width: 48px !important;
          min-height: 48px !important;
          height: 48px !important;
          padding: 0 !important;
          border-radius: 12px !important;
          font-size: 14px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          position: relative !important;
          box-sizing: border-box !important;
        }
        /* 竖屏下按钮本体不印数字 */
        .top-right-group .hud-nav-desktop-label, 
        .top-right-group .hud-sol-unit,
        .top-right-group #txt-hud-sol-token { display: none !important; }
        
        .top-right-group #btn-quick-mining {
          min-width: 48px !important;
          width: 48px !important;
          padding: 0 !important;
          gap: 0 !important;
        }
        /* 统一角标为按钮右上角 16px 圆点 */
        .hud-sol-gift {
          position: absolute !important;
          top: -4px !important;
          right: -4px !important;
          width: 16px !important;
          height: 16px !important;
          border-radius: 50% !important;
          background: #ff4757 !important;
          border: 2px solid #fff !important;
          box-shadow: 0 0 8px rgba(255,71,87,.9) !important;
          pointer-events: none !important;
          z-index: 10 !important;
        }

        /* --- 3. 任务提示简条：置于满宽状态带正下方 (紧贴带底边 56px) --- */
        .quest-card-container {
          position: fixed !important;
          top: calc(var(--sat, 0px) + 56px) !important;
          left: calc(max(12px, var(--sal, 0px))) !important;
          right: calc(max(12px, var(--sar, 0px))) !important;
          z-index: 115 !important;
          pointer-events: none !important;
        }
        .quest-banner {
          position: relative !important;
          transform: none !important;
          left: auto !important;
          top: auto !important;
          pointer-events: auto !important;
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 4px 10px !important;
          min-height: 28px !important;
          max-height: 28px !important;
          height: 28px !important;
          line-height: 1.25 !important;
          border-radius: 12px !important;
          background: rgba(14, 24, 20, 0.96) !important;
          border: 1.5px solid rgba(255, 234, 167, 0.75) !important;
          box-shadow: 0 3px 12px rgba(0, 0, 0, 0.5) !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
        }
        .quest-banner .quest-icon { font-size: 13px; flex-shrink: 0; }
        .quest-banner .quest-text {
          flex: 1 1 auto;
          font-size: 11px !important;
          font-weight: 800 !important;
          color: #ffffff !important;
          text-shadow: 0 1px 3px rgba(0,0,0,0.8) !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        .quest-banner .quest-toggle-arrow {
          font-size: 9px;
          color: #d9c08a;
          flex-shrink: 0;
          transition: transform 0.2s;
        }
        .quest-banner.expanded {
          max-height: none !important;
          height: auto !important;
          border-color: rgba(255, 234, 167, 0.95) !important;
          background: rgba(14, 24, 20, 0.98) !important;
        }
        .quest-banner.expanded .quest-text {
          white-space: normal !important;
          word-break: break-word !important;
          display: block !important;
        }

        /* --- 4. 提示固定在状态行下方、宽 min(92vw,380px) 居中、同时最多 1 条 3 秒淡出 --- */
        .toast-stack {
          position: fixed !important;
          top: calc(var(--sat, 0px) + 94px) !important;
          left: 50% !important;
          right: auto !important;
          transform: translateX(-50%) !important;
          width: min(92vw, 380px) !important;
          max-width: min(92vw, 380px) !important;
          z-index: 130 !important;
          pointer-events: none !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 6px !important;
        }
        .toast-item {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          padding: 8px 14px !important;
          border-radius: 12px !important;
          font-size: 12px !important;
          line-height: 1.4 !important;
          text-align: center !important;
          white-space: normal !important;
          word-break: break-word !important;
          display: -webkit-box !important;
          -webkit-line-clamp: 2 !important;
          -webkit-box-orient: vertical !important;
          overflow: hidden !important;
          text-overflow: clip !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5) !important;
        }

        /* --- 5. 底部双锚：底部安全区一致 (bottom: calc(max(12px, var(--sab, 0px)))) --- */
        .bottom-quick-bar {
          position: fixed !important;
          left: 50% !important;
          bottom: calc(max(12px, var(--sab, 0px))) !important;
          transform: translateX(-50%) !important;
          max-width: calc(100vw - 230px) !important;
          margin: 0 !important;
          padding: 3px 6px !important;
          gap: 8px !important;
          background: rgba(14, 24, 20, 0.88) !important;
          border: 1px solid rgba(229, 211, 163, 0.25) !important;
          border-radius: 12px !important;
          z-index: 97 !important;
          display: flex !important;
        }
        .quick-slot {
          min-width: 36px !important;
          width: 36px !important;
          min-height: 36px !important;
          height: 36px !important;
          padding: 2px !important;
          font-size: 9px !important;
          border-radius: 8px !important;
          box-sizing: border-box !important;
          position: relative !important;
        }
        .quick-slot.quick-canteen-alert {
          border-color: #ff3838 !important;
          box-shadow: 0 0 12px rgba(255, 56, 56, 0.8) !important;
          animation: stripBorderPulse 0.8s infinite alternate !important;
        }
        .quick-slot span:first-child { font-size: 16px !important; }
        .quick-slot span:last-child { display: none !important; }

        /* --- 6. 右下组 grid 两列 48px、gap 8px，主按钮跨两列 104x56 且与上排边缘对齐 --- */
        .mobile-action-zone {
          position: fixed !important;
          right: calc(max(12px, var(--sar, 0px))) !important;
          bottom: calc(max(12px, var(--sab, 0px))) !important;
          width: 104px !important;
          z-index: 98 !important;
          display: grid !important;
          grid-template-columns: 48px 48px !important;
          grid-gap: 8px !important;
          align-items: center !important;
          justify-content: end !important;
          box-sizing: border-box !important;
        }
        .aux-action-row {
          display: contents !important;
        }
        .aux-btn {
          width: 48px !important;
          height: 48px !important;
          font-size: 16px !important;
          border-radius: 12px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-sizing: border-box !important;
        }
        #btn-quick-run {
          grid-column: 1 !important;
          grid-row: 1 !important;
        }
        #btn-quick-jump {
          grid-column: 2 !important;
          grid-row: 1 !important;
        }
        #btn-quick-attack:not(.ctx-hidden) {
          grid-column: 1 !important;
          grid-row: 1 !important;
        }
        #btn-quick-attack:not(.ctx-hidden) ~ #btn-quick-run {
          grid-column: 2 !important;
          grid-row: 1 !important;
        }
        .aux-btn .aux-btn-label {
          display: none !important; /* 小标签放不下只留图标 */
        }
        .context-tag {
          display: none !important;
        }
        .main-action-capsule {
          grid-column: span 2 !important;
          width: 104px !important;
          height: 56px !important;
          min-height: 56px !important;
          max-height: 56px !important;
          padding: 4px 6px !important;
          box-sizing: border-box !important;
          border-radius: 28px !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 2px !important;
          overflow: hidden !important;
        }
        .main-action-capsule #main-action-icon {
          font-size: 18px !important;
          line-height: 1 !important;
        }
        .main-action-capsule #main-action-text {
          font-size: clamp(10px, 2.9vw, 12px) !important;
          font-weight: 900 !important;
          line-height: 1.15 !important;
          text-align: center !important;
          white-space: pre-line !important;
          display: -webkit-box !important;
          -webkit-line-clamp: 2 !important;
          -webkit-box-orient: vertical !important;
          overflow: hidden !important;
          word-break: break-all !important;
          max-width: 100% !important;
        }

        /* --- 7. 抽屉菜单与弹窗：贴合屏幕与安全区约束 --- */
        .hud-nav-secondary.hud-drawer, .hud-nav-secondary.hud-drawer.open {
          width: min(280px, 75vw) !important;
          top: 0 !important;
          padding-top: calc(max(12px, var(--sat, 0px))) !important;
          padding-bottom: calc(max(12px, var(--sab, 0px))) !important;
        }
        .modal-card {
          width: calc(100vw - 16px - var(--sal, 0px) - var(--sar, 0px)) !important;
          max-width: 480px !important;
          max-height: calc(100vh - 24px - var(--sat, 0px) - var(--sab, 0px)) !important;
          border-radius: 18px !important;
        }
        .split-modal-layout {
          flex-direction: column !important;
          gap: 10px !important;
        }
        .animal-dialog {
          width: calc(100vw - 20px - var(--sal, 0px) - var(--sar, 0px)) !important;
          max-width: 440px !important;
          top: auto !important;
          bottom: calc(max(70px, var(--sab, 0px) + 65px)) !important;
          max-height: 50vh !important;
          padding: 10px 14px !important;
          border-radius: 16px !important;
        }
      }

    `;
    style.textContent += cozyPortraitHudCSS;
    style.textContent += cozyLandscapeHudCSS;
    document.head.appendChild(style);

    // 1. 顶部 CastawaySOL 主仪表盘（兼容横屏经典面板 + 竖屏极简单行Survival Kids状态条）
    const dashboard = document.createElement('div');
    dashboard.className = 'top-dashboard';
    dashboard.innerHTML = `
      <!-- 横屏桌面/平板展示面板 -->
      <div class="dashboard-panel">
        <div class="stats-header" style="display:flex; justify-content:space-between; align-items:center;">
          <span class="landscape-weather-symbol" aria-hidden="true">${getWeatherIconHtml('clear', 22)}</span>
          <div class="landscape-time-copy"><div class="time-tag" id="hud-time">第 1 天 · 0 步</div>
          <div class="time-tag" id="hud-weather" style="background:rgba(0, 206, 201, 0.2); color:#00cec9; font-weight:800;">晴朗 37.0°C</div></div>
        </div>
        <div class="gauges-grid">
          <div class="gauge-item">
            <div class="gauge-label-row"><span>${getSurvivalIconHtml('health', 24)} 生命</span><span id="txt-life">100</span></div>
            <div class="gauge-track"><div class="gauge-fill gauge-fill-life" id="bar-life" style="width:100%;"></div></div>
          </div>
          <div class="gauge-item">
            <div class="gauge-label-row"><span>${getSurvivalIconHtml('food', 24)} 饥饿</span><span id="txt-hunger">70</span></div>
            <div class="gauge-track"><div class="gauge-fill gauge-fill-hunger" id="bar-hunger" style="width:70%;"></div></div>
          </div>
          <div class="gauge-item">
            <div class="gauge-label-row"><span>${getSurvivalIconHtml('water', 24)} 饮水</span><span id="txt-water">70</span></div>
            <div class="gauge-track"><div class="gauge-fill gauge-fill-water" id="bar-water" style="width:70%;"></div></div>
          </div>
          <div class="gauge-item">
            <div class="gauge-label-row"><span>${getSurvivalIconHtml('energy', 24)} 疲劳</span><span id="txt-fatigue">30</span></div>
            <div class="gauge-track"><div class="gauge-fill gauge-fill-fatigue" id="bar-fatigue" style="width:30%;"></div></div>
          </div>
        </div>
      </div>

      <!-- 竖屏 Survival Kids 经典顶部状态带：两行层级 (第一行生命+天数天气，第二行饱食/水分/疲劳严格三等分) -->
      <div class="portrait-capsule-wrapper" id="portrait-capsule-wrapper">
        <div class="portrait-survival-strip" id="portrait-survival-strip">
          <!-- 第一行：生命数值在左，天数天气弱文本并入右侧 -->
          <div class="strip-row strip-row-top" id="strip-row-top">
            <img class="portrait-cat-avatar" src="/ui/cozy/cat-avatar.webp" alt="" aria-hidden="true">
            <div class="strip-item strip-stat strip-life" title="生命值" aria-label="生命 100">
              <span class="life-hearts" aria-hidden="true"><i>❤️</i><i>❤️</i><i>❤️</i><i>❤️</i><i>❤️</i></span>
              <b id="strip-val-life">100</b>
            </div>
          </div>
          <!-- 第二行：天候与饱食、水分、疲劳 -->
          <div class="strip-row strip-row-bottom" id="strip-row-bottom">
            <div class="strip-subline" id="strip-subline">
              <span class="strip-weather-icon" id="strip-weather-icon" aria-hidden="true">${getWeatherIconHtml('clear', 20)}</span>
              <span class="strip-weather-copy"><span class="strip-sub-day" id="strip-time">第1天</span><span class="strip-sub-weather" id="strip-weather">晴朗</span></span>
              <span class="strip-sub-steps" id="strip-steps" style="display:none;">0步</span>
            </div>
            <div class="strip-item strip-stat strip-hunger" title="饱食度"><span class="strip-meter-icon" aria-hidden="true">${getSurvivalIconHtml('food', 18)}</span><b id="strip-val-hunger">70</b></div>
            <div class="strip-item strip-stat strip-water" title="饮水度"><span class="strip-meter-icon" aria-hidden="true">${getSurvivalIconHtml('water', 18)}</span><b id="strip-val-water">70</b></div>
            <div class="strip-item strip-stat strip-fatigue" title="疲劳度"><span class="strip-meter-icon" aria-hidden="true">${getSurvivalIconHtml('energy', 18)}</span><b id="strip-val-fatigue">30</b></div>
          </div>
        </div>
      </div>
    `;
    const survivalPanel = dashboard.querySelector('.dashboard-panel');
    survivalPanel.insertAdjacentHTML('beforeend', `
      <div class="survival-water-row"><span id="canteen-count">水壶 3/3</span><button type="button" class="canteen-pill" id="canteen-btn" aria-label="喝一口水">喝水</button></div>
      <div class="survival-warning" id="survival-warning" role="status" hidden></div>
    `);
    document.body.appendChild(dashboard);

    // 独立任务简条容器（横屏与竖屏统一承载，竖屏默认单行，可点展开全文；无内容时彻底隐藏）
    const questCard = document.createElement('div');
    questCard.className = 'quest-card-container';
    questCard.id = 'quest-card-container';
    if (!this.currentQuest || !String(this.currentQuest).trim()) {
      questCard.style.display = 'none';
    }
    questCard.innerHTML = `
      <div class="quest-banner" id="quest-banner" title="点击展开/折叠任务目标" role="button" aria-expanded="false">
        <span class="quest-icon">${iconHTML('hud/quest', 18, { eager: true })}</span>
        <span class="quest-text" id="quest-text">${formatKeyHints(this.currentQuest).replace(/^🚩\s*/, '')}</span>
        <span class="quest-toggle-arrow" id="quest-toggle-arrow">▼</span>
      </div>
    `;
    document.body.appendChild(questCard);

    const tutorialCard = document.createElement('section');
    tutorialCard.id = 'onboarding-card';
    tutorialCard.setAttribute('aria-live', 'polite');
    tutorialCard.style.cssText = 'display:none;position:fixed;z-index:120;top:calc(env(safe-area-inset-top, 0px) + 20%);left:50%;transform:translateX(-50%);width:min(390px,calc(100vw - 28px));box-sizing:border-box;padding:13px 15px;border:2px solid rgba(244,231,187,.88);border-radius:18px;background:rgba(28,43,40,.94);color:#fff4dc;box-shadow:0 8px 28px rgba(0,0,0,.3);pointer-events:auto;';
    tutorialCard.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><strong id="onboarding-title" style="font-size:15px;flex:1"></strong><span id="onboarding-count" style="font-size:11px;opacity:.78"></span><button id="onboarding-skip" type="button" style="border:1px solid rgba(244,231,187,.6);border-radius:12px;padding:5px 8px;background:rgba(248,238,209,.12);color:#fff4dc;font:inherit;font-size:11px">跳过</button></div><div id="onboarding-text" style="font-size:13px;line-height:1.5"></div>';
    document.body.appendChild(tutorialCard);
    tutorialCard.querySelector('#onboarding-skip').addEventListener('click', () => window.__game?.story?.dismissOnboarding?.());

    // 2. 右上角功能系统导航组（突出 DePIN 挖矿与 算力代币 资产）
    const topNav = document.createElement('div');
    topNav.className = 'top-right-group';
    topNav.innerHTML = `
      <button class="hud-nav-btn hud-nav-sol" id="btn-quick-mining" style="background: linear-gradient(135deg, #9945FF 0%, #14F195 100%); color:#0b101b; font-weight:900; border:1px solid rgba(255,255,255,0.7); box-shadow:0 0 16px rgba(20,241,149,0.5);" aria-label="矿机中枢">
        ${iconHTML('hud/mining_rig', 26, { eager: true })} <span id="txt-hud-sol-token" style="font-size:13px; font-weight:900;">0</span><span class="hud-sol-unit" style="font-size:12px; font-weight:900; color:rgba(11,16,27,0.75); margin-left:2px;">算力</span><span class="hud-sol-gift" id="hud-sol-gift" hidden></span>
      </button>
      <button class="hud-nav-btn" id="btn-open-inv" aria-label="背包">🎒 <span class="hud-nav-desktop-label">背包</span></button>
      <button class="hud-nav-btn" id="btn-hud-more" aria-label="菜单" aria-expanded="false" aria-controls="hud-nav-secondary">☰ <span class="hud-nav-desktop-label">菜单</span></button>
    `;
    document.body.appendChild(topNav);

    // UI 第二步优化：右侧「☰ 菜单」抽屉（合成台、营地经营、补给特权、手册、SOL 钱包、全屏、画质），沿用原按钮 id 与事件
    const drawerScrim = document.createElement('div');
    drawerScrim.className = 'hud-drawer-scrim';
    drawerScrim.id = 'hud-drawer-scrim';
    document.body.appendChild(drawerScrim);
    const drawer = document.createElement('aside');
    drawer.className = 'hud-nav-secondary hud-drawer';
    drawer.id = 'hud-nav-secondary';
    drawer.setAttribute('aria-label', '菜单');
    drawer.innerHTML = `
      <div class="hud-drawer-title">菜单</div>
      <button class="hud-nav-btn" id="btn-open-merge" aria-label="合成台">🔨 <span class="hud-nav-desktop-label">合成台</span></button>
      <button class="hud-nav-btn" id="btn-camp-manage">🏕️ 营地经营中枢</button>
      <button class="hud-nav-btn" id="btn-open-shop" style="background: linear-gradient(135deg, #9945FF 0%, #14F195 100%); color:#0b101b; font-weight:900;">🛒 补给与特权</button>
      <button class="hud-nav-btn" id="btn-open-help" aria-label="手册">📖 <span class="hud-nav-desktop-label">手册</span></button>
      <button class="hud-nav-btn hud-nav-sol" id="btn-solana">${iconHTML('hud/solana', 18, { eager: true })} SOL 钱包连接</button>
      <button class="hud-nav-btn" id="btn-fullscreen" title="进入全屏沉浸模式" aria-label="全屏">⛶ <span class="hud-nav-desktop-label">全屏</span></button>
      <div class="hud-drawer-quality" role="group" aria-label="画质设置"><span class="hud-drawer-qlabel">画质</span><button type="button" class="quality-opt" data-quality="low" aria-pressed="false">低</button><button type="button" class="quality-opt" data-quality="medium" aria-pressed="false">中</button><button type="button" class="quality-opt" data-quality="high" aria-pressed="false">高</button></div>
      <div class="hud-drawer-quality hud-drawer-notice" role="group" aria-label="提示强度"><span class="hud-drawer-qlabel">提示</span><button type="button" class="notice-opt" data-notice="full" aria-pressed="false">完整</button><button type="button" class="notice-opt" data-notice="lite" aria-pressed="false">精简</button><button type="button" class="notice-opt" data-notice="important" aria-pressed="false">仅重要</button></div>
    `;
    document.body.appendChild(drawer);

    // 3. 右下角大尺寸动作胶囊轮盘
    const actionZone = document.createElement('div');
    actionZone.className = 'mobile-action-zone';
    actionZone.innerHTML = `
      <div class="aux-action-row">
        <div class="context-tag" id="context-tag" role="status" hidden></div>
        <div class="aux-btn ctx-hidden" id="btn-quick-attack" style="background: linear-gradient(135deg, rgba(231, 76, 60, 0.92), rgba(214, 48, 49, 0.92)); border: 1.5px solid rgba(255, 150, 150, 0.7); box-shadow: 0 4px 16px rgba(231, 76, 60, 0.5);">${iconHTML('hud/attack', 26, { eager: true })}<span class="aux-btn-label" style="color:#ffeaa7; font-weight:800;">攻击 [F]</span></div>
        <div class="aux-btn" id="btn-quick-run">⚡<span class="aux-btn-label">疾跑</span></div>
        <div class="aux-btn" id="btn-quick-jump">🦘<span class="aux-btn-label">跳跃</span></div>
      </div>
      <div class="main-action-capsule" id="main-action-btn">
        <span id="main-action-icon">💬</span>
        <span id="main-action-text">互动</span>
      </div>
    `;
    document.body.appendChild(actionZone);

    // 4. 底部快捷物品栏 (点击直接食用)
    this.bottomBar = document.createElement('div');
    this.bottomBar.className = 'bottom-quick-bar';
    document.body.appendChild(this.bottomBar);
    this.renderQuickBar();

    // 5. Toast 醒目通知
    this.toast = document.createElement('div');
    this.toast.className = 'toast-stack'; // UI 第二步优化：提示队列容器（id 仍为 toast-banner）
    this.toast.id = 'toast-banner';
    document.body.appendChild(this.toast);

    // 6. 模态大弹窗框架 (支持 背包 / Merge / 帮助)
    this.modalBackdrop = document.createElement('div');
    this.modalBackdrop.className = 'modal-backdrop';
    this.modalBackdrop.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title" id="modal-title">🎒 探险行囊</div>
          <button class="modal-close-btn" id="modal-close-btn" aria-label="关闭">${iconHTML('hud/close', 18, { eager: true })}</button>
        </div>
        <div class="modal-body" id="modal-body"></div>
      </div>
    `;
    document.body.appendChild(this.modalBackdrop);

    // 7. 幸存者伙伴打字机对话框
    this.dialogBox = document.createElement('div');
    this.dialogBox.className = 'animal-dialog';
    this.dialogBox.innerHTML = `
      <div class="dialog-header">
        <div class="dialog-tag" id="dialog-speaker">诺克</div>
      </div>
      <div class="dialog-body" id="dialog-text"></div>
      <div class="dialog-tap-hint">▼ 点击屏幕继续</div>
    `;
    document.body.appendChild(this.dialogBox);
    // UI 重叠优化：对话中遮罩（点任意处关闭对话框），顶栏尺寸跟随，面板/对话打开状态标记
    this.dialogScrim = document.createElement('div');
    this.dialogScrim.className = 'hud-dialog-scrim';
    this.dialogScrim.id = 'hud-dialog-scrim';
    document.body.appendChild(this.dialogScrim);
    this._initOverlapGuards(topNav, dashboard);

    const navIcons = { 'btn-fullscreen': Maximize, 'btn-open-inv': Backpack, 'btn-open-merge': Hammer, 'btn-open-help': BookOpen, 'btn-hud-more': Menu, 'btn-solana': Wallet, 'btn-quick-run': Zap, 'btn-quick-jump': ArrowUp };
    // 黏土图标集成：顶栏背包/菜单、抽屉合成台/营地/商店/手册、疾跑/跳跃改用黏土图标（其余仍用 lucide）
    const CLAY_NAV = { 'btn-open-inv': 'hud/backpack', 'btn-hud-more': 'hud/menu', 'btn-open-merge': 'menu/crafting_table', 'btn-camp-manage': 'menu/camp', 'btn-open-shop': 'menu/shop', 'btn-open-help': 'menu/manual', 'btn-quick-run': 'hud/sprint', 'btn-quick-jump': 'hud/jump', 'btn-solana': 'hud/solana' };
    const CLAY_NAV_SIZE = { 'btn-open-inv': 30, 'btn-hud-more': 30, 'btn-quick-run': 26, 'btn-quick-jump': 26, 'btn-solana': 24 };
    navIcons['btn-camp-manage'] = null;
    navIcons['btn-open-shop'] = null;
    Object.entries(navIcons).forEach(([id, definition]) => {
      const button = document.getElementById(id);
      if (!button) return; // 按钮可能已被移除（如 UI 第一步删掉的右下喝水键）
      const text = button.firstChild;
      if (text?.nodeType === Node.TEXT_NODE) {
        const label = text.textContent.replace(/^[^\p{L}\p{N}]+/u, '');
        text.remove();
        button.insertAdjacentHTML('afterbegin', (CLAY_NAV[id] ? iconHTML(CLAY_NAV[id], CLAY_NAV_SIZE[id] || 24, { eager: true, className: 'clay-nav-icon' }) : hudIcon(definition)) + label);
      }
    });
    document.getElementById('main-action-icon').innerHTML = iconHTML('hud/interact', 30, { eager: true }); // 黏土图标集成
    const gaugeIcons = [['hud/health', '生命'], ['hud/food', '饱食'], ['hud/water', '水分'], ['hud/energy', '疲劳']];
    dashboard.querySelectorAll('.gauge-label-row span:first-child').forEach((label, index) => {
      label.innerHTML = iconHTML(gaugeIcons[index][0], 24, { eager: true, className: 'gauge-clay-icon' }) + `<span class="gauge-name">${gaugeIcons[index][1]}</span>`;
    });
    // UI 第二步优化：水壶口数用小圆点显示在水分条旁（横屏紧凑状态卡；竖屏仍用原水壶行）
    const waterItem = document.getElementById('bar-water')?.closest('.gauge-item');
    if (waterItem) waterItem.insertAdjacentHTML('beforeend', '<span class="canteen-dots" id="canteen-dots" aria-hidden="true">●●●</span>');
    this.toast.setAttribute('role', 'status');
    this.toast.setAttribute('aria-live', 'polite');
    this.bindEvents();
    this.applyInputModeTweaks();
    // UI 第二步优化：攻击键按情境显示（每 250ms 检查一次，状态变化才写 DOM）
    this.updateAttackVisibility();
    this._attackVisTimer = setInterval(() => this.updateAttackVisibility(), 250);
  }

  // UI 第一步优化：隐藏攻击按钮上的 [F]（战斗系统会重写按钮内容，用轻量监听过滤）
  applyInputModeTweaks() {
    if (typeof MutationObserver === 'undefined') return;
    const atk = document.getElementById('btn-quick-attack');
    if (!atk) return;
    const strip = () => {
      atk.querySelectorAll('.aux-btn-label').forEach((label) => {
        const next = formatKeyHints(label.textContent);
        if (next !== label.textContent) label.textContent = next;
      });
    };
    strip();
    new MutationObserver(strip).observe(atk, { childList: true, subtree: true, characterData: true });
  }

  // UI 第二步优化：攻击键按情境出现——野兽 8 米内、远程模式、正在攻击或刚攻击/切换过时显示（只在状态变化时写 DOM）
  updateAttackVisibility() {
    const atk = this._attackBtn && this._attackBtn.isConnected ? this._attackBtn : (this._attackBtn = document.getElementById('btn-quick-attack'));
    if (!atk) return;
    const g = window.__game;
    const wc = g && g.wildlifeCombat;
    let show = !wc; // 没有战斗系统时保持常显，兼容旧逻辑
    if (wc) {
      if (wc.combatMode === 'ranged' || wc.isAttacking || (this._attackShownUntil || 0) > performance.now()) {
        show = true;
      } else if (g.player && g.player.position && Array.isArray(wc.wildlifeList)) {
        const p = g.player.position;
        for (const mob of wc.wildlifeList) {
          if (!mob || mob.isDead || !mob.group) continue;
          const dx = mob.group.position.x - p.x;
          const dz = mob.group.position.z - p.z;
          if (dx * dx + dz * dz <= 64) { show = true; break; }
        }
      }
    }
    if (this._attackVisible !== show) {
      this._attackVisible = show;
      atk.classList.toggle('ctx-hidden', !show);
    }
  }

  // UI 第二步优化：菜单里的画质设置（写入 localStorage，下次启动生效；URL ?quality= 仍优先）
  syncQualityButtons(selected) {
    let quality = selected;
    if (!quality) { try { quality = window.localStorage.getItem(VISUAL_QUALITY_KEY); } catch (e) { quality = null; } }
    if (!quality) quality = (window.__game && window.__game.visualQuality && window.__game.visualQuality.name) || 'medium';
    document.querySelectorAll('#hud-nav-secondary .quality-opt').forEach((btn) => {
      const pressed = String(btn.dataset.quality === quality);
      if (btn.getAttribute('aria-pressed') !== pressed) btn.setAttribute('aria-pressed', pressed);
    });
  }
  bindEvents() {
    // 喝水
    const drink = () => {
      haptics.medium();
      const res = this.survival.drinkCanteen();
      soundEngine.playItemDrop();
      this.updateSurvivalHUD();
      this.showToast(res.msg, 'medium');
      if (res.success && window.__game && window.__game.story && window.__game.story.onDrinkWater) {
        window.__game.story.onDrinkWater();
      }
    };
    document.getElementById('canteen-btn').addEventListener('click', drink);
    // 原右下重复的喝水按钮已移除：水分条、水壶胶囊、喝水按钮都可以喝水（UI 第一步优化）
    const waterGauge = document.getElementById('bar-water')?.closest('.gauge-item');
    if (waterGauge) {
      waterGauge.classList.add('gauge-drinkable');
      waterGauge.setAttribute('role', 'button');
      waterGauge.setAttribute('aria-label', '点击喝一口水');
      waterGauge.addEventListener('click', drink);
    }
    const waterRow = document.querySelector('.survival-water-row');
    if (waterRow) waterRow.addEventListener('click', (e) => { if (!e.target.closest('#canteen-btn')) drink(); });

    // 跳跃 (零延迟极速响应)
    const jumpBtn = document.getElementById('btn-quick-jump');
    if (jumpBtn) {
      jumpBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        haptics.heavy();
        this.player.jump();
      });
    }

    // 快速攻击突刺与远程猎弓射击
    const attackBtn = document.getElementById('btn-quick-attack');
    if (attackBtn) {
      // UI 第二步优化：长按攻击键切换近战/远程（不依赖右键；键盘 R 键仍可切换），短按照常攻击
      let pressTimer = null;
      let longPressed = false;
      const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
      attackBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        longPressed = false;
        cancelPress();
        pressTimer = setTimeout(() => {
          pressTimer = null;
          longPressed = true;
          haptics.heavy();
          if (window.__game && window.__game.wildlifeCombat) window.__game.wildlifeCombat.toggleCombatMode();
          this._attackShownUntil = performance.now() + 5000;
        }, 550);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => attackBtn.addEventListener(type, cancelPress));
      attackBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (longPressed) { longPressed = false; return; }
        haptics.medium();
        this._attackShownUntil = performance.now() + 4000;
        if (this.onActionCallback) this.onActionCallback('attack');
      });
      // 长按时屏蔽系统菜单（不再用右键切换）
      attackBtn.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // 疾跑开关 (瞬时轻微触觉反馈)
    const runBtn = document.getElementById('btn-quick-run');
    if (runBtn) {
      runBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        haptics.light();
        this.player.forceRun = !this.player.forceRun;
        runBtn.classList.toggle('is-running', this.player.forceRun);
        runBtn.style.background = this.player.forceRun ? 'rgba(0, 184, 148, 0.85)' : 'rgba(18, 24, 28, 0.82)';
        runBtn.style.borderColor = this.player.forceRun ? '#00cec9' : 'rgba(255, 255, 255, 0.28)';
      });
    }

    // 主情境动作触发
    const mainActionBtn = document.getElementById('main-action-btn');
    if (mainActionBtn) {
      mainActionBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        haptics.medium();
        if (this._isWaterDepleted) {
          drink();
          return;
        }
        if (this.onActionCallback) this.onActionCallback('interact');
      });
    }

    // 顶部全屏与系统按键
    const fsBtn = document.getElementById('btn-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        haptics.light();
        this.toggleFullscreen();
      });
    }
    document.addEventListener('fullscreenchange', () => this.updateFullscreenBtn());
    document.addEventListener('webkitfullscreenchange', () => this.updateFullscreenBtn());

    // 顶部 DePIN 矿机中枢一键打开
    const quickMiningBtn = document.getElementById('btn-quick-mining');
    if (quickMiningBtn) {
      quickMiningBtn.addEventListener('click', () => {
        haptics.medium();
        const g = window.__game;
        if (g && g.miningRig) {
          this.openMiningRigModal(g.miningRig);
        } else {
          this.showToast('⛏️ 正在连接营地 DePIN 绿色解密矿机……', 'medium');
        }
      });
    }

    // 算力总账入口：只在算力代币数量显示上挂点击事件
    const solTokenEl = document.getElementById('txt-hud-sol-token');
    if (solTokenEl) {
      solTokenEl.style.cursor = 'pointer';
      solTokenEl.setAttribute('title', '点击查看算力总账');
      solTokenEl.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.openLedgerDrawer();
      });
    }

    document.getElementById('btn-open-inv').addEventListener('click', () => {
      haptics.light();
      this.openInventoryModal();
    });
    document.getElementById('btn-open-merge').addEventListener('click', () => {
      haptics.light();
      this.openMergeModal();
    });
    document.getElementById('btn-open-help').addEventListener('click', () => {
      haptics.light();
      this.openHelpModal();
    });
    // UI 第二步优化：右侧「☰ 菜单」抽屉，打开时 HUD 淡化，点空白处关闭，点功能项后自动收起
    const moreBtn = document.getElementById('btn-hud-more');
    const secondaryNav = document.getElementById('hud-nav-secondary');
    const drawerScrim = document.getElementById('hud-drawer-scrim');
    const setDrawer = (open) => {
      if (secondaryNav.classList.contains('open') === open) return;
      secondaryNav.classList.toggle('open', open);
      if (drawerScrim) drawerScrim.classList.toggle('open', open);
      document.body.classList.toggle('hud-drawer-open', open);
      moreBtn.setAttribute('aria-expanded', String(open));
      if (open) this.syncQualityButtons();
    };
    this.closeDrawer = () => setDrawer(false);
    moreBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      haptics.light();
      setDrawer(!secondaryNav.classList.contains('open'));
    });
    if (drawerScrim) drawerScrim.addEventListener('click', () => setDrawer(false));
    document.addEventListener('click', (event) => {
      if (secondaryNav.classList.contains('open') && !secondaryNav.contains(event.target) && !moreBtn.contains(event.target)) setDrawer(false);
    });
    secondaryNav.addEventListener('click', (event) => {
      if (event.target.closest('.hud-nav-btn')) setDrawer(false);
    });
    secondaryNav.querySelectorAll('.quality-opt').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        haptics.light();
        const quality = btn.dataset.quality;
        try { window.localStorage.setItem(VISUAL_QUALITY_KEY, quality); } catch (e) { /* 隐私模式下无法保存 */ }
        this.syncQualityButtons(quality);
        this.showToast(`✅ 画质已设为「${btn.textContent}」，重新打开游戏后生效`, 'ok', 'medium');
      });
    });
    // 提示系统优化（2026-10-31）：菜单里的「提示强度」完整 / 精简 / 仅重要（默认精简，存 localStorage）
    const noticeLabels = { full: '完整', lite: '精简', important: '仅重要' };
    const syncNotice = () => {
      const m = this._notice().mode;
      secondaryNav.querySelectorAll('.notice-opt').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.notice === m)));
    };
    secondaryNav.querySelectorAll('.notice-opt').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        haptics.light();
        const mode = btn.dataset.notice;
        if (!NOTICE_MODES.includes(mode)) return;
        this._notice().setMode(mode);
        syncNotice();
        this.showToast(`✅ 提示强度：${noticeLabels[mode]}`, 'ok', 'important');
      });
    });
    syncNotice();
    document.getElementById('btn-open-shop').addEventListener('click', () => {
      haptics.light();
      this.openShopModal();
    });
    document.getElementById('btn-camp-manage').addEventListener('click', () => {
      haptics.light();
      this.openCampManageModal();
    });
    document.getElementById('btn-solana').addEventListener('click', () => {
      haptics.light();
      this.handleSolanaWallet();
    });
    window.addEventListener('solana-wallet-changed', () => {
      this.updateSolanaBtn();
    });

    // 关闭弹窗
    document.getElementById('modal-close-btn').addEventListener('click', () => {
      haptics.light();
      this.modalBackdrop.style.display = 'none';
    });

    // 关闭对话框
    this.dialogBox.addEventListener('click', () => {
      haptics.light();
      this.dialogBox.style.display = 'none';
      soundEngine.playAnimalVoice();
    });
    // UI 重叠优化：点遮罩（任意处）同样关闭对话框；点任务条用提示显示完整任务
    if (this.dialogScrim) this.dialogScrim.addEventListener('click', (event) => { event.stopPropagation(); this.dialogBox.click(); });
    const questEl = document.getElementById('quest-banner');
    if (questEl) {
      questEl.addEventListener('click', () => {
        haptics.light();
        const isExpanded = questEl.classList.toggle('expanded');
        questEl.setAttribute('aria-expanded', String(isExpanded));
        const arrow = document.getElementById('quest-toggle-arrow');
        if (arrow) arrow.textContent = isExpanded ? '▲' : '▼';
        // 如果再次点击展开状态，才轻提示
        if (!isExpanded) {
          this.showToast(this.currentQuest, 'quest', 'small');
        }
      });
    }

    // 绑定竖屏极简状态条点击水壶直接喝水
    const auxDrink = document.getElementById('btn-quick-drink');
    if (auxDrink) auxDrink.addEventListener('click', drink);
    const stripCanteen = document.getElementById('strip-canteen');
    if (stripCanteen) {
      stripCanteen.addEventListener('click', drink);
    }

    // 初始化 Solana 钱包按钮状态
    this.updateSolanaBtn();
    this.initLedgerDrawer();
  }

  // 移动端全屏沉浸与横屏锁定切换
  toggleFullscreen() {
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || false;
    const docEl = document.documentElement;

    if (!isFullscreen) {
      const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
      if (req) {
        req.call(docEl).then(() => {
          this.showToast('📱 已开启全屏沉浸式探索模式', 'medium');
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
          }
        }).catch(() => {
          this.showToast('提示：可将本游戏添加到手机桌面主屏幕以开启最佳原生全屏体验', 'medium');
        });
      }
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
      if (exit) {
        exit.call(document).then(() => {
          this.showToast('已退出全屏', 'medium');
          if (screen.orientation && screen.orientation.unlock) {
            try { screen.orientation.unlock(); } catch (e) {}
          }
        }).catch(() => {});
      }
    }
  }

  updateFullscreenBtn() {
    const fsBtn = document.getElementById('btn-fullscreen');
    if (!fsBtn) return;
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || false;
    if (isFullscreen) {
      fsBtn.innerHTML = hudIcon(Minimize) + '<span class="hud-nav-desktop-label">退出</span>';
      fsBtn.style.borderColor = '#00cec9';
    } else {
      fsBtn.innerHTML = hudIcon(Maximize) + '<span class="hud-nav-desktop-label">全屏</span>';
      fsBtn.style.borderColor = 'rgba(255, 255, 255, 0.18)';
    }
  }

  initTouchControls() {
    this.joystick = new VirtualJoystick(document.body, (vec) => {
      this.player.setJoystickVector(vec);
      const dist = Math.sqrt(vec.x * vec.x + vec.y * vec.y) * 0.08;
      if (dist > 0.01) {
        this.survival.recordMovement(dist);
        this.updateSurvivalHUD();
      }
    });
  }

  // UI 第二步优化：HUD 每秒最多刷新约 10 次（多余调用合并为一次尾随刷新）；只在数值变化时写 DOM；血条用 transform: scaleX
  updateSurvivalHUD() {
    const now = performance.now();
    const wait = 100 - (now - (this._hudLastAt || -1e9));
    if (wait > 0) {
      if (!this._hudTimer) this._hudTimer = setTimeout(() => { this._hudTimer = null; this.updateSurvivalHUD(); }, wait);
      return;
    }
    this._hudLastAt = now;
    this._renderSurvivalHUD();
  }

  _hudWrite(key, value, apply) {
    const cache = this._hudCache || (this._hudCache = {});
    if (cache[key] === value) return;
    cache[key] = value;
    apply(value);
  }

  _hudEl(id) {
    const els = this._hudEls || (this._hudEls = {});
    if (!els[id] || !els[id].isConnected) els[id] = document.getElementById(id);
    return els[id];
  }

  _renderSurvivalHUD() {
    const l = Math.max(0, Math.round(this.survival.life));
    const h = Math.max(0, Math.round(this.survival.hunger));
    const w = Math.max(0, Math.round(this.survival.water));
    const f = Math.min(100, Math.round(this.survival.fatigue));
    const values = { life: l, hunger: h, water: w, fatigue: f };
    // 数值只在低于 30% 时显示并变色（疲劳是反向指标：≥70 即剩余体力不足 30%）
    const low = { life: l < 30, hunger: h < 30, water: w < 30, fatigue: f >= 70 };
    const warn = { life: l <= 25, hunger: h <= 20, water: w <= 20, fatigue: f >= 80 };
    Object.keys(values).forEach((name) => {
      const bar = this._hudEl(`bar-${name}`);
      if (!bar) return;
      const item = bar.closest('.gauge-item');
      const value = Math.min(100, values[name]);
      this._hudWrite(`bar-${name}`, value, (v) => { bar.style.transform = `scaleX(${v / 100})`; });
      if (item) {
        this._hudWrite(`warn-${name}`, String(warn[name]), (v) => { item.dataset.warning = v; });
        this._hudWrite(`low-${name}`, String(low[name]), (v) => { item.dataset.low = v; });
      }
      const txt = this._hudEl(`txt-${name}`);
      if (txt) this._hudWrite(`txt-${name}`, String(values[name]), (v) => { txt.textContent = v; });
    });
    const timeEl = this._hudEl('hud-time');
    if (timeEl) this._hudWrite('time', `第 ${this.survival.day} 天 · ${this.survival.steps} 步`, (v) => { timeEl.textContent = v; });

    // 动态刷新当前天气与体温（保留原有天气逻辑，只在变化时写）
    const weatherEl = this._hudEl('hud-weather');
    if (weatherEl && this.game && this.game.weatherSystem) {
      const ws = this.game.weatherSystem;
      const temp = ws.bodyTemp.toFixed(1);
      const wIcons = { clear: '☀️', cloudy: '⛅', rain: '🌧️', typhoon: '⛈️' };
      const wNames = { clear: '晴朗', cloudy: '多云', rain: '暴雨', typhoon: '台风' };
      const isHypo = ws.bodyTemp < 35.0;
      this._hudWrite('weather-text', `${wNames[ws.currentWeather] || '晴'} ${temp}°C${isHypo ? ' ⚠️失温' : ''}`, (v) => { weatherEl.textContent = v; });
      const weatherSymbol = this._hudEl('landscape-weather-symbol') || weatherEl.closest('.stats-header')?.querySelector('.landscape-weather-symbol');
      if (weatherSymbol) this._hudWrite('landscape-weather-symbol', getWeatherIconHtml(ws.currentWeather, 22), (v) => { weatherSymbol.innerHTML = v; });
      this._hudWrite('weather-bg', isHypo ? 'rgba(235, 77, 75, 0.3)' : (ws.currentWeather === 'rain' || ws.currentWeather === 'typhoon' ? 'rgba(9, 132, 227, 0.3)' : 'rgba(0, 206, 201, 0.2)'), (v) => { weatherEl.style.background = v; });
      this._hudWrite('weather-color', isHypo ? '#ff7675' : '#00cec9', (v) => { weatherEl.style.color = v; });
    }

    // 动态刷新顶部 算力代币 资产与矿机待领取状态
    const solHud = this._hudEl('txt-hud-sol-token');
    if (solHud) {
      if (!solHud._ledgerBound) {
        solHud._ledgerBound = true;
        solHud.style.cursor = 'pointer';
        solHud.setAttribute('title', '点击查看算力总账');
        solHud.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.openLedgerDrawer();
        });
      }
      const solCount = (this.inventory ? this.inventory['sol_token'] : 0) || 0;
      const g = window.__game;
      const unclaimed = (g && g.miningRig) ? g.miningRig.unclaimedSol : 0;
      // UI 重叠优化：顶栏只写数量，待领取用角标小圆点表示（完整信息放在 aria-label）
      this._hudWrite('hud-sol-token', String(solCount), (v) => { solHud.textContent = v; });
      const giftDot = this._hudEl('hud-sol-gift');
      this._hudWrite('hud-sol-gift', `${solCount}|${unclaimed > 0 ? unclaimed : ''}`, (v) => {
        const gift = v.split('|')[1];
        if (giftDot) giftDot.hidden = !gift;
        const btn = document.getElementById('btn-quick-mining');
        if (btn) btn.setAttribute('aria-label', gift ? `矿机中枢：${solCount} 算力代币，待领取 ${gift}` : `矿机中枢：${solCount} 算力代币`);
      });
    }

    const sips = this.survival.canteenSips;
    const countEl = this._hudEl('canteen-count');
    if (countEl) this._hudWrite('canteen-count', `水壶 ${sips}/3`, (v) => { countEl.textContent = v; });
    const dots = this._hudEl('canteen-dots');
    const full = Math.max(0, Math.min(3, sips));
    if (dots) this._hudWrite('canteen-dots', '●'.repeat(full) + '○'.repeat(3 - full), (v) => { dots.textContent = v; });
    const waterGauge = dots ? dots.closest('.gauge-item') : null;
    if (waterGauge) this._hudWrite('water-aria', `饮水 ${w}，水壶 ${sips}/3 口，点按喝一口水`, (v) => { waterGauge.setAttribute('aria-label', v); });
    const canteenBtn = this._hudEl('canteen-btn');
    if (canteenBtn) this._hudWrite('canteen-disabled', sips <= 0, (v) => { canteenBtn.disabled = v; });
    const warning = this._hudEl('survival-warning');
    const message = l <= 25 ? '生命偏低，请补充食物或休息' : w <= 20 ? (sips > 0 ? '水分不足，记得喝水' : '水壶已空，寻找清泉补水') : h <= 20 ? '饱食不足，打开背包进食' : f >= 80 ? '疲劳过高，前往营地休息' : '';
    if (warning) {
      this._hudWrite('warning-hidden', !message, (v) => { warning.hidden = v; });
      this._hudWrite('warning-text', message, (v) => { warning.textContent = v; });
    }

    // 动态同步竖屏单行极简状态条 (Survival Kids 极简数值与报警高亮)
    const stripTime = this._hudEl('strip-time');
    if (stripTime) this._hudWrite('strip-time', `第${this.survival.day}天`, (v) => { stripTime.textContent = v; });
    const stripSteps = this._hudEl('strip-steps');
    if (stripSteps) this._hudWrite('strip-steps', `${this.survival.steps}步`, (v) => { stripSteps.textContent = v; });
    const stripWeather = this._hudEl('strip-weather');
    if (stripWeather && this.game && this.game.weatherSystem) {
      const ws = this.game.weatherSystem;
      const wIcons = { clear: '☀️', cloudy: '⛅', rain: '🌧️', typhoon: '⛈️' };
      const wNames = { clear: '晴朗', cloudy: '多云', rain: '下雨', typhoon: '台风' };
      this._hudWrite('strip-weather', wNames[ws.currentWeather] || '晴朗', (v) => {
        stripWeather.textContent = v;
        stripWeather.title = `体温 ${Math.round(ws.bodyTemp)}°C`;
      });
      const weatherIcon = this._hudEl('strip-weather-icon');
      if (weatherIcon) this._hudWrite('strip-weather-icon', getWeatherIconHtml(ws.currentWeather, 20), (v) => { weatherIcon.innerHTML = v; });
    }
    const statKeys = ['life', 'hunger', 'water', 'fatigue'];
    let hasZeroDanger = (values.life <= 0 || values.water <= 0);
    statKeys.forEach(k => {
      const el = this._hudEl(`strip-val-${k}`);
      if (el) {
        this._hudWrite(`strip-val-${k}`, String(values[k]), (v) => {
          el.textContent = v;
          const parent = el.closest('.strip-stat');
          if (parent) {
            parent.classList.toggle('strip-low', low[k]);
            parent.classList.toggle('strip-warn', warn[k]);
            parent.classList.toggle('strip-zero', values[k] <= 0);
            parent.style.setProperty('--fill', `${Math.max(0, Math.min(100, values[k]))}%`);
            if (k === 'life') {
              parent.setAttribute('aria-label', `生命 ${values[k]}`);
              parent.querySelectorAll('.life-hearts i').forEach((heart, index) => {
                heart.classList.toggle('filled', index < Math.ceil(values[k] / 20));
              });
            }
          }
        });
      }
    });
    const stripContainer = this._hudEl('portrait-survival-strip');
    if (stripContainer) {
      stripContainer.classList.toggle('strip-danger-border', hasZeroDanger);
    }
    // 喝水位置纠正：缺水状态同步给快捷栏水壶；水分归零时临时顶替主动作胶囊按钮
    this._isWaterDepleted = (values.water <= 0);
    document.getElementById('main-action-btn')?.classList.toggle('is-urgent', this._isWaterDepleted);
    this.renderQuickBar();
    if (this._isWaterDepleted) {
      const capIcon = document.getElementById('main-action-icon');
      const capText = document.getElementById('main-action-text');
      const capBtn = document.getElementById('main-action-btn');
      if (capIcon && capText && capBtn) {
        capIcon.textContent = '🍶';
        capText.textContent = '喝水救命';
        capBtn.style.background = 'linear-gradient(135deg, #d63031, #e17055)';
        capBtn.style.boxShadow = '0 0 20px rgba(214, 48, 49, 0.8)';
      }
    }
    const stripCanteen = this._hudEl('strip-val-canteen');
    if (stripCanteen) {
      this._hudWrite('strip-val-canteen', String(sips), (v) => {
        stripCanteen.textContent = v;
        const parent = stripCanteen.closest('.strip-canteen');
        if (parent) {
          parent.classList.toggle('strip-empty', sips <= 0);
        }
      });
    }
  }

  // 状态带显隐行为（第六轮：移动中弱化到约 40%，停止移动约 0.5s 后用约 200ms 平滑恢复；告警/濒死/闪烁强制全显）
  updateHUDMovementState(isMoving) {
    const dashboard = this._hudEl('portrait-capsule-wrapper') || document.querySelector('.top-dashboard');
    if (!dashboard) return;

    // 检查是否有任何一维濒死/归零或处于危险状态 (生命<=25, 水分<=20, 饱食<=20, 疲劳>=80 或归零)
    const values = this.survival ? {
      life: Math.max(0, Math.round(this.survival.life)),
      hunger: Math.max(0, Math.round(this.survival.hunger)),
      water: Math.max(0, Math.round(this.survival.water)),
      fatigue: Math.min(100, Math.round(this.survival.fatigue))
    } : null;

    const hasDanger = values && (
      values.life <= 25 || values.water <= 20 || values.hunger <= 20 || values.fatigue >= 80 ||
      values.life <= 0 || values.water <= 0 || values.hunger <= 0
    );

    const topBar = document.querySelector('.top-dashboard');
    const topNav = document.querySelector('.top-right-group');

    if (hasDanger) {
      if (this._hudFadeTimer) { clearTimeout(this._hudFadeTimer); this._hudFadeTimer = null; }
      if (topBar) topBar.style.opacity = '1.0';
      if (topNav) topNav.style.opacity = '1.0';
      return;
    }

    if (isMoving) {
      if (this._hudFadeTimer) { clearTimeout(this._hudFadeTimer); this._hudFadeTimer = null; }
      if (topBar) topBar.style.opacity = '0.4';
      if (topNav) topNav.style.opacity = '0.4';
    } else {
      // 停止移动约 0.5 秒后，用约 200ms 平滑恢复全显
      if (!this._hudFadeTimer && topBar && topBar.style.opacity === '0.4') {
        this._hudFadeTimer = setTimeout(() => {
          this._hudFadeTimer = null;
          if (topBar) topBar.style.opacity = '1.0';
          if (topNav) topNav.style.opacity = '1.0';
        }, 500);
      }
    }
  }

  // 动态情境感知 (切换大胶囊按键图标与文字)
  setContextAction(type) {
    // UI 第二步优化：main.js 每帧都会调用，类型没变就不写 DOM
    if (type === this._ctxType) return;
    this._ctxType = type;
    this._applyContextAction(type);
  }

  _applyContextAction(type) {
    const icon = document.getElementById('main-action-icon');
    const text = document.getElementById('main-action-text');
    const cap = document.getElementById('main-action-btn');
    if (!icon || !text || !cap) return;

    if (type === 'gem') {
      icon.textContent = '💎';
      text.textContent = '拾取秘宝';
      cap.style.background = 'linear-gradient(135deg, #a55eea, #4b7bec)';
    } else if (type === 'sos') {
      icon.textContent = '🪨';
      text.textContent = 'SOS地标';
      cap.style.background = 'linear-gradient(135deg, #fd9644, #fa8231)';
    } else if (type === 'raft') {
      icon.textContent = '⛵';
      text.textContent = '扬帆出海';
      cap.style.background = 'linear-gradient(135deg, #2bcbba, #0fb9b1)';
    } else if (type === 'monkey') {
      icon.textContent = '🐒';
      text.textContent = '巴布互动';
      cap.style.background = 'linear-gradient(135deg, #fed330, #f7b731)';
    } else if (type === 'partner') {
      icon.textContent = '💖';
      text.textContent = '艾莉同伴';
      cap.style.background = 'linear-gradient(135deg, #fc5c65, #eb3b5a)';
    } else if (type === 'fishing') {
      icon.textContent = '🎣';
      text.textContent = '垂钓';
      cap.style.background = 'linear-gradient(135deg, #0984e3, #74b9ff)';
    } else if (type === 'cooking') {
      icon.textContent = '🔥';
      text.textContent = '烹饪';
      cap.style.background = 'linear-gradient(135deg, #e17055, #fab1a0)';
    } else if (type === 'storage') {
      icon.textContent = '📦';
      text.textContent = '储物箱';
      cap.style.background = 'linear-gradient(135deg, #e67e22, #f39c12)';
    } else if (type === 'sleep') {
      icon.textContent = '🛏️';
      text.textContent = '过夜';
      cap.style.background = 'linear-gradient(135deg, #6c5ce7, #a29bfe)';
    } else if (type === 'camp_manage') {
      icon.textContent = '🏕️';
      text.textContent = '营地经营';
      cap.style.background = 'linear-gradient(135deg, #0984e3, #00cec9)';
    } else if (type === 'mine') {
      icon.textContent = '⛏️';
      text.textContent = '开采矿石';
      cap.style.background = 'linear-gradient(135deg, #e67e22, #d35400)';
    } else if (type === 'shipyard' || type === 'ship_upgrade') {
      icon.textContent = '⛵';
      text.textContent = '船坞修造';
      cap.style.background = 'linear-gradient(135deg, #0984e3, #00cec9)';
    } else if (type === 'shop') {
      icon.textContent = '🛒';
      text.textContent = '补给特权';
      cap.style.background = 'linear-gradient(135deg, #9945FF, #14F195)';
    } else if (type === 'tree') {
      icon.textContent = '🌲';
      text.textContent = '摇树';
      cap.style.background = 'linear-gradient(135deg, #00b894, #55efc4)';
    } else if (type === 'villager') {
      icon.textContent = '💬';
      text.textContent = '对话';
      cap.style.background = 'linear-gradient(135deg, #fdcb6e, #ffeaa7)';
    } else if (type === 'monkey_helper') {
      icon.textContent = '🐒';
      text.textContent = '小猴伙伴';
      cap.style.background = 'linear-gradient(135deg, #e17055, #f39c12)';
    } else if (type === 'monkey_crevice') {
      icon.textContent = '🕳️';
      text.textContent = '小猴探穴';
      cap.style.background = 'linear-gradient(135deg, #a55eea, #4b7bec)';
    } else if (type === 'crab_trap') {
      icon.textContent = '🦀';
      text.textContent = '潮汐蟹笼';
      cap.style.background = 'linear-gradient(135deg, #0984e3, #00cec9)';
    } else if (type === 'smoker_rack') {
      icon.textContent = '🔥';
      text.textContent = '营地熏架';
      cap.style.background = 'linear-gradient(135deg, #d63031, #e17055)';
    } else if (type === 'pet_nest') {
      icon.textContent = '🐾';
      text.textContent = '宠物暖巢';
      cap.style.background = 'linear-gradient(135deg, #f39c12, #e67e22)';
    } else if (type === 'mining_rig') {
      icon.textContent = '⛏️';
      text.textContent = '解密矿机';
      cap.style.background = 'linear-gradient(135deg, #9945ff, #14f195)';
    } else if (type === 'temple_altar') {
      icon.textContent = '🏛️';
      text.textContent = '神殿机关';
      cap.style.background = 'linear-gradient(135deg, #ffd32a, #ff9f1a)';
    } else if (type === 'temple_enter') {
      icon.textContent = '🏛️';
      text.textContent = '进入神殿';
      cap.style.background = 'linear-gradient(135deg, #ffd32a, #ff9f1a)';
    } else if (type === 'temple_portal') {
      icon.textContent = '🌀';
      text.textContent = '返回海岛';
      cap.style.background = 'linear-gradient(135deg, #0abde3, #54a0ff)';
    } else if (type === 'temple_vault') {
      icon.textContent = '👑';
      text.textContent = '开启神藏';
      cap.style.background = 'linear-gradient(135deg, #ffd32a, #e1b12c)';
    } else if (type === 'sheep_pouch') {
      icon.textContent = '🐑';
      text.textContent = '金羊驮袋';
      cap.style.background = 'linear-gradient(135deg, #10ac84, #1dd1a1)';
    } else {
      icon.textContent = '💬';
      text.textContent = '互动';
      cap.style.background = 'linear-gradient(135deg, #00b894, #00cec9)';
    }
    const contextIcons = {
      gem: Gem, sos: Mountain, raft: Sailboat, monkey: PawPrint, partner: Heart,
      fishing: Fish, cooking: Flame, sleep: Bed, tree: Trees, villager: MessageCircle,
      pet_nest: PawPrint, sheep_pouch: Backpack, mining_rig: Zap,
      temple_enter: Mountain, temple_portal: Sailboat, temple_altar: Gem, temple_vault: Gem
    };
    // 黏土/动森新图标第三批：世界交互浮标与情境动作图标映射
    const clayCtx = {
      mining_rig: 'hud/mining_rig',
      sheep_pouch: 'hud/backpack',
      gem: 'hud/prompt_crystal',
      monkey: 'hud/prompt_monkey',
      monkey_helper: 'hud/prompt_monkey',
      monkey_crevice: 'hud/prompt_monkey',
      partner: 'hud/prompt_heart',
      crab_trap: 'hud/prompt_crab',
      cooking: 'hud/prompt_fire',
      smoker_rack: 'hud/prompt_fire',
      campfire: 'hud/prompt_fire',
      pet_nest: 'hud/prompt_tracks',
      temple_vault: 'hud/prompt_boss',
      villager: 'hud/prompt_generic'
    };
    const ctxDef = contextIcons[type];
    icon.innerHTML = clayCtx[type] ? iconHTML(clayCtx[type], 30, { eager: true }) : (ctxDef && ctxDef !== MessageCircle ? hudIcon(ctxDef) : iconHTML('hud/interact', 30, { eager: true }));
  }

  updateObjective(text) {
    this.currentQuest = text;
    const banner = document.getElementById('quest-banner');
    const container = document.getElementById('quest-card-container');
    const textEl = document.getElementById('quest-text');
    const hasText = !!(text && String(text).trim());
    if (container) {
      container.style.display = hasText ? '' : 'none';
    }
    const next = formatKeyHints(text).replace(/^🚩\s*/, '');
    if (textEl) {
      if (textEl.textContent !== next) textEl.textContent = next;
    } else if (banner && banner.textContent !== next) {
      banner.textContent = next;
    }
  }

  updateTutorial(hint, step, total) {
    const card = document.getElementById('onboarding-card');
    if (!card) return;
    card.style.display = hint ? 'block' : 'none';
    if (!hint) return;
    const title = card.querySelector('#onboarding-title');
    const body = card.querySelector('#onboarding-text');
    const count = card.querySelector('#onboarding-count');
    if (title) title.textContent = hint.title;
    if (body) body.textContent = hint.text;
    if (count) count.textContent = `${Math.min(step + 1, total)}/${total}`;
  }

  // UI 第二步优化：靠近物体的情境提示不再占用任务条；主按钮已写动作，只在按钮旁显示很小的名称/状态标签
  showInteraction(text) {
    const raw = text == null ? '' : String(text);
    if (raw === this._interactionText) return;
    this._interactionText = raw;
    this._setContextTag(this._interactionLabel(raw));
  }

  hideInteraction() {
    if (this._interactionText === '') return;
    this._interactionText = '';
    this._setContextTag('');
  }

  _interactionLabel(raw) {
    const plain = formatKeyHints(raw).trim();
    if (!plain) return '';
    // 状态/警告类（不是「按…」「点击…」开头）：显示整句，例如「⚠️ 需装备采矿石镐」「浮标静置水中」
    if (!/^(按|点击)/.test(raw.trim())) return plain;
    // 动作类：主按钮已写动作，只显示对象名称
    const named = raw.match(/【([^】]{1,20})】/);
    return named ? named[1] : '';
  }

  _setContextTag(label) {
    const tag = this._contextTag && this._contextTag.isConnected ? this._contextTag : (this._contextTag = document.getElementById('context-tag'));
    if (!tag) return;
    if (tag.textContent !== label) tag.textContent = label;
    const hidden = !label;
    if (tag.hidden !== hidden) tag.hidden = hidden;
  }

  // 提示系统优化（2026-10-31）：交给 NoticeCenter（同时 1 条横幅 + 排队、三档 small/medium/important、3 秒合并计数、对话框打开时暂停）
  // 兼容旧调用 showToast(text) / showToast(text, type)；新增 level：showToast(text, 'small') / showToast(text, 'ok', 'important') / showToast(text, { type, level, item, count, group })
  showToast(text, type, level) {
    this._notice().push(text, type, level);
  }

  // 兼容 showBubbleNotice(text)、(text, 'ok'|'fail'|'gain'|'info')、(text, 'small'|'medium'|'important')、(text, { type, level })；时长、图标等参数忽略
  showBubbleNotice(text, options, level) {
    this._notice().push(text, options, level);
  }

  _notice() {
    if (!this.notices) this.notices = new NoticeCenter(this, formatKeyHints);
    return this.notices;
  }

  _toastKind(msg) {
    if (/❌|⚠|失败|不足|不够|没有|无法|已满|太早|慢了|脱钩|吓跑|缺少|已空|尚未|不能|损坏/.test(msg)) return 'fail';
    if (/获得|拾取|收获|钓到|捡到|打捞|采集到|入账|\+\d/.test(msg)) return 'gain';
    if (/✅|成功|完成|🎉|已(开启|切换|建|装|放|存|解锁|升级|设为|扩容|退出)/.test(msg)) return 'ok';
    return 'info';
  }

  // UI 重叠优化（2026-10-31）：把顶栏按钮组宽度/底边写进 CSS 变量（任务条、提示、对话框、抽屉据此避让）；标记对话框/面板打开状态
  _initOverlapGuards(topNav, dashboard) {
    const root = document.documentElement;
    const panel = dashboard && dashboard.querySelector('.dashboard-panel');
    let last = '';
    const sync = () => {
      const n = topNav.getBoundingClientRect();
      const c = panel ? panel.getBoundingClientRect() : null;
      const vals = [Math.ceil(n.width), Math.ceil(n.bottom), Math.ceil(Math.max(n.bottom, c ? c.bottom : 0))];
      const key = vals.join(',');
      if (key === last) return;
      last = key;
      root.style.setProperty('--hud-nav-w', vals[0] + 'px');
      root.style.setProperty('--hud-nav-b', vals[1] + 'px');
      root.style.setProperty('--hud-top-b', vals[2] + 'px');
    };
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(sync);
      ro.observe(topNav);
      if (panel) ro.observe(panel);
    }
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', () => setTimeout(sync, 300));
    sync();
    const watch = (el, cls) => {
      if (!el) return;
      const upd = () => document.body.classList.toggle(cls, el.style.display !== '' && el.style.display !== 'none');
      new MutationObserver(upd).observe(el, { attributes: true, attributeFilter: ['style'] });
      upd();
    };
    watch(this.dialogBox, 'hud-dialog-open');
    watch(this.modalBackdrop, 'hud-modal-open');
    this._initPwaInstall();
  }

  // UI 重叠优化：PWA 安装入口放进「☰ 菜单」抽屉；App 内（Capacitor 原生）或已安装（standalone）时不显示
  _initPwaInstall() {
    const cap = window.Capacitor;
    const isApp = !!(cap && (typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : cap.platform && cap.platform !== 'web'));
    const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    const remove = () => { const b = document.getElementById('pwa-install-btn'); if (b) b.remove(); };
    if (isApp || standalone) { remove(); return; }
    const add = () => {
      const prompt = window.__pwaInstallPrompt;
      const drawer = document.getElementById('hud-nav-secondary');
      if (!prompt || !drawer || document.getElementById('pwa-install-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'hud-nav-btn';
      btn.id = 'pwa-install-btn';
      btn.type = 'button';
      btn.innerHTML = '📲 <span class="hud-nav-desktop-label">安装到桌面</span>';
      btn.addEventListener('click', async () => {
        const p = window.__pwaInstallPrompt;
        if (!p) { btn.remove(); return; }
        p.prompt();
        try { const { outcome } = await p.userChoice; if (outcome === 'accepted') btn.remove(); } catch (e) { /* 忽略 */ }
        window.__pwaInstallPrompt = null;
      });
      const quality = drawer.querySelector('.hud-drawer-quality');
      drawer.insertBefore(btn, quality || null);
    };
    window.addEventListener('pwa-installable', add);
    window.addEventListener('appinstalled', () => { window.__pwaInstallPrompt = null; remove(); });
    add();
  }

  showDialog(speaker, text) {
    if (this.player && this.player.resetInput) this.player.resetInput();
    document.getElementById('dialog-speaker').textContent = speaker;
    const content = document.getElementById('dialog-text');
    content.textContent = '';
    this.dialogBox.style.display = 'block';

    let idx = 0;
    const timer = setInterval(() => {
      if (idx < text.length) {
        content.textContent += text[idx];
        if (idx % 2 === 0) soundEngine.playAnimalVoice();
        idx++;
      } else {
        clearInterval(timer);
      }
    }, 22);
  }

  // 获取当前随身行囊容量上限
  get maxInventorySlots() {
    return this.baseInventorySlots + this.bonusInventorySlots;
  }

  // 获取当前已占用的行囊格位数
  get usedInventorySlots() {
    return Object.keys(this.inventory).filter(k => (this.inventory[k] || 0) > 0).length;
  }

  // 检查行囊是否已满（对于新种类物品）
  isInventoryFull(type) {
    if ((this.inventory[type] || 0) > 0) return false;
    return this.usedInventorySlots >= this.maxInventorySlots;
  }

  // 扩充行囊容量
  expandInventory(extraSlots = 10) {
    this.bonusInventorySlots += extraSlots;
    this.showToast(`🎒 随身行囊成功扩容 +${extraSlots} 格！(当前总容量: ${this.maxInventorySlots})`, 'medium');
    return this.maxInventorySlots;
  }

  addInventory(type, count = 1, source) {
    if (this.isInventoryFull(type)) {
      this.showToast(`❌ 行囊已满 (${this.usedInventorySlots}/${this.maxInventorySlots})！请将物资存入营地木箱或使用【行囊扩容】！`, 'medium');
      return false;
    }
    if (isEconomyResource(type)) {
      if (!source) throw new Error(`Missing economy source for ${type}`);
      const game = this.buildSystem.game;
      economyLedger(game).credit(type, count, source, this.inventory);
    } else this.inventory[type] = (this.inventory[type] || 0) + count;
    this.renderQuickBar();
    this.bottomBar.querySelectorAll('[data-id]').forEach(slot => {
      if (slot.dataset.id === type) slot.classList.add('received');
    });
    this.showToast(`获得了【${this.getItemName(type)}】x${count}！`, { level: 'small', item: type, count });
    return true;
  }

  renderQuickBar() {
    const sips = (this.survival && this.survival.canteenSips !== undefined) ? this.survival.canteenSips : 3;
    const isWaterLow = (this.survival && this.survival.water < 30);
    const portraitQuickBar = window.matchMedia?.('(orientation: portrait)').matches ?? false;
    const quickItems = Object.entries(this.inventory)
      .filter(([k, cnt]) => cnt > 0 && k !== 'canteen_clean_water');
    const pageCount = Math.max(1, Math.ceil(quickItems.length / 4));
    this._quickBarPage = Math.min(this._quickBarPage || 0, pageCount - 1);
    const visibleItems = quickItems.slice(this._quickBarPage * 4, this._quickBarPage * 4 + 4);
    const selectedQuickItem = visibleItems.some(([id]) => id === this.selectedItemId) ? this.selectedItemId : 'canteen';
    const canteenSlotHtml = `
      <div class="quick-slot quick-canteen-slot ${isWaterLow ? 'quick-canteen-alert' : ''} ${selectedQuickItem === 'canteen' ? 'selected' : ''}" data-id="canteen" title="饮用便携水壶 (剩余: ${sips}/3)">
        <span class="quick-slot-icon" style="line-height:1;">${iconHTML('items/water_bamboo', 36, { eager: true })}</span>
        <span class="quick-slot-label">水壶 <span style="color:#74b9ff;">${sips}</span></span>
        <span class="quick-slot-badge">${sips}</span>
      </div>
    `;

    const itemSlots = visibleItems.map(([k, cnt]) => `
        <div class="quick-slot ${selectedQuickItem === k ? 'selected' : ''}" data-id="${k}" title="点击直接食用或使用: ${this.getItemName(k)} (${cnt})">
          <span class="quick-slot-icon" style="line-height:1;">${this.getItemIcon(k, 36)}</span>
          <span class="quick-slot-label">${this.getItemName(k)} <span style="color:#91dbc4;">${cnt}</span></span>
          <span class="quick-slot-badge">${cnt}</span>
        </div>
      `).join('');

    const occupiedSlots = 1 + visibleItems.length;
    const emptySlots = '<div class="quick-slot quick-slot-empty" aria-hidden="true"></div>'.repeat(Math.max(0, 5 - occupiedSlots));
    this.bottomBar.innerHTML = (portraitQuickBar ? `<button class="quick-page-arrow" type="button" data-page="prev" aria-label="上一页物品" ${this._quickBarPage === 0 ? 'disabled' : ''}>‹</button>` : '')
      + canteenSlotHtml + itemSlots + emptySlots
      + (portraitQuickBar ? `<button class="quick-page-arrow" type="button" data-page="next" aria-label="下一页物品" ${this._quickBarPage >= pageCount - 1 ? 'disabled' : ''}>›</button>` : '');
    this.bottomBar.style.display = '';

    this.bottomBar.querySelectorAll('.quick-page-arrow').forEach(button => {
      button.addEventListener('click', () => {
        this._quickBarPage += button.dataset.page === 'next' ? 1 : -1;
        this.renderQuickBar();
      });
    });

    this.bottomBar.querySelectorAll('.quick-slot[data-id]').forEach(el => {
      el.addEventListener('click', () => {
        haptics.medium();
        const id = el.getAttribute('data-id');
        this.selectedItemId = id;
        if (id === 'canteen') {
          const res = this.survival.drinkCanteen();
          this.updateSurvivalHUD();
          this.showToast(res.msg, 'medium');
          if (res.success && window.__game && window.__game.story && window.__game.story.onDrinkWater) {
            window.__game.story.onDrinkWater();
          }
        } else {
          this.consumeItem(id);
          this.renderQuickBar();
        }
      });
    });
  }

  // 16 格专业背包网格弹窗 (横屏自适应双栏)
  openInventoryModal() {
    window.__game?.story?.onInventoryOpened?.();
    if (this.player && this.player.resetInput) this.player.resetInput();
    document.getElementById('modal-title').textContent = '🎒 探险行囊';
    const body = document.getElementById('modal-body');

    const items = Object.entries(this.inventory).filter(([_, c]) => c > 0);
    if (!items.some(([id]) => id === this.selectedItemId)) {
      this.selectedItemId = items[0]?.[0] || null;
    }
    let cellsHtml = '';

    for (let i = 0; i < Math.max(16, items.length); i++) {
      if (i < items.length) {
        const [id, count] = items[i];
        const isSel = id === this.selectedItemId;
        cellsHtml += `
          <div class="inv-cell ${isSel ? 'selected' : ''}" data-id="${id}">
            <div class="inv-count">x${count}</div>
            <div class="inv-icon">${this.getItemIcon(id)}</div>
            <div class="inv-name">${this.getItemName(id)}</div>
          </div>
        `;
      } else {
        cellsHtml += `
          <div class="inv-cell" style="opacity:0.3; cursor:default;">
            <div class="inv-icon" style="font-size:22px;">·</div>
          </div>
        `;
      }
    }

    const selItem = this.selectedItemId || (items[0] ? items[0][0] : null);
    const detailHtml = selItem ? `
      <div class="inv-right-pane">
        <div class="item-detail-panel">
          <div class="detail-title">${this.getItemIcon(selItem)} ${this.getItemName(selItem)}</div>
          <div class="detail-desc">持有 ${this.inventory[selItem] || 0} 件 · ${this.isEdible(selItem) ? '食物' : '工具与材料'}</div>
          <div class="detail-desc">${this.getItemDesc(selItem)}</div>
          <div class="detail-stat-row">${this.getItemStatPills(selItem)}</div>
        </div>
        <button class="detail-action-btn" id="btn-modal-use" data-id="${selItem}">
          ${this.isEdible(selItem) ? '🍽️ 食用一份' : '🔨 前往合成台'}
        </button>
      </div>
    ` : `
      <div class="inv-right-pane" style="align-items:center; justify-content:center; color:rgba(255,255,255,0.4);">
        <div>点击左侧物品查看详情</div>
      </div>
    `;

    body.innerHTML = `
      <div class="split-modal-layout">
        <div class="inv-left-pane">
          <div class="inv-grid">${cellsHtml}</div>
        </div>
        ${detailHtml}
      </div>
    `;

    body.querySelectorAll('.inv-cell[data-id]').forEach(cell => {
      cell.addEventListener('click', () => {
        haptics.light();
        this.selectedItemId = cell.getAttribute('data-id');
        this.openInventoryModal();
      });
    });

    const useBtn = document.getElementById('btn-modal-use');
    if (useBtn) {
      useBtn.addEventListener('click', () => {
        haptics.medium();
        const id = useBtn.getAttribute('data-id');
        if (this.isEdible(id)) {
          this.consumeItem(id);
          this.openInventoryModal();
        } else {
          this.openMergeModal();
        }
      });
    }

    this.modalBackdrop.style.display = 'flex';
    soundEngine.playPlaceFurniture();
  }

  // CastawaySOL 经典双物品自由 Merge 合成台与全景图鉴 Pokédex (横屏双栏沉浸式)
  openMergeModal() {
    if (this.player && this.player.resetInput) this.player.resetInput();
    const progress = CraftingBlueprintManager.getDiscoveryProgress();
    document.getElementById('modal-title').innerHTML = `🔨 CastawaySOL 融合合成台 <span style="font-size:12px; font-weight:700; color:#ffdd59; margin-left:8px;">(📖 图鉴收录: ${progress.unlockedCount}/${progress.total} · ${progress.percent}%)</span>`;
    const body = document.getElementById('modal-body');

    const slotA = this.mergeSlots[0];
    const slotB = this.mergeSlots[1];

    // 动态配方雷达预测 (Formula Radar)
    let previewText = '💡 从右侧点击两件原料放入槽位试验';
    let canMerge = false;
    let matchedBp = null;

    if (slotA && slotB) {
      matchedBp = CraftingBlueprintManager.findBlueprint(slotA, slotB);
      if (matchedBp) {
        previewText = `✨ 探明蓝图：可融合【${matchedBp.name}】`;
        canMerge = true;
      } else {
        previewText = '🧪 尝试融合试验未知反应……';
        canMerge = true;
      }
    } else if (slotA || slotB) {
      previewText = '👈 请点击右侧选择第二件材料';
    }

    // 右侧内容渲染
    let rightContentHtml = '';
    if (this.mergeTab === 'materials') {
      const items = Object.entries(this.inventory).filter(([_, c]) => c > 0);
      if (items.length > 0) {
        let cardsHtml = '';
        items.forEach(([k, c]) => {
          cardsHtml += `
            <div class="material-card" data-id="${k}">
              <div class="material-card-count">x${c}</div>
              <div class="material-card-icon">${this.getItemIcon(k)}</div>
              <div class="material-card-name">${this.getItemName(k)}</div>
            </div>
          `;
        });
        rightContentHtml = `<div class="material-cards-grid">${cardsHtml}</div>`;
      } else {
        rightContentHtml = `
          <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; color:rgba(255,255,255,0.6); padding:20px; font-size:12px;">
            <div style="font-size:28px; margin-bottom:8px;">🏝️</div>
            <div>行囊暂无可用原料！</div>
            <div style="color:#ffdd59; margin-top:4px;">摇晃岛上果树可采摘苹果与树枝！</div>
          </div>
        `;
      }
    } else {
      // 蓝图图鉴模式：先渲染学科分类导航胶囊
      let catChipsHtml = '<div class="craft-cat-bar" style="display:flex; gap:6px; margin-bottom:8px; overflow-x:auto; padding-bottom:2px;">';
      Object.values(CRAFTING_CATEGORIES).forEach(cat => {
        const isSel = this.mergeCategory === cat.id;
        catChipsHtml += `
          <button class="craft-cat-chip" data-cat="${cat.id}" style="
            background:${isSel ? '#ffdd59' : 'rgba(255,255,255,0.08)'};
            color:${isSel ? '#1e272e' : 'rgba(255,255,255,0.8)'};
            font-size:11px; font-weight:800; border:none; border-radius:12px;
            padding:5px 10px; cursor:pointer; white-space:nowrap; transition:all 0.15s;
          ">${cat.icon} ${cat.name}</button>
        `;
      });
      catChipsHtml += '</div>';

      // 蓝图列表渲染
      const currentBlueprints = CraftingBlueprintManager.getBlueprintsByCategory(this.mergeCategory);
      const discoveredIds = CraftingBlueprintManager.getDiscoveredIds();
      let bpRows = '';

      currentBlueprints.forEach(bp => {
        const isDiscovered = discoveredIds.includes(bp.id);
        const hasA = (this.inventory[bp.a] || 0) > 0;
        const hasB = (this.inventory[bp.b] || 0) > 0;
        const canApply = hasA && hasB;

        if (isDiscovered) {
          // 已探明解锁蓝图：展示完整配方、说明与快速制作按钮
          bpRows += `
            <div class="blueprint-item" style="background:rgba(255,255,255,0.06); border-radius:10px; padding:8px 10px; display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <div style="flex:1; min-width:0; margin-right:8px;">
                <div class="blueprint-formula" style="font-weight:700; color:#f5f6fa; font-size:12px;">${this.getItemIcon(bp.a)} + ${this.getItemIcon(bp.b)} ➔ ${bp.name}</div>
                <div style="font-size:10px; color:rgba(255,255,255,0.65); margin-top:2px; line-height:1.4;">${bp.desc}</div>
              </div>
              <div style="display:flex; gap:6px;">
                <button class="blueprint-apply-btn" data-a="${bp.a}" data-b="${bp.b}" ${canApply ? '' : 'disabled style="opacity:0.4; cursor:not-allowed;"'} style="background:#34495e; border:none; border-radius:6px; color:#fff; font-size:11px; font-weight:700; padding:6px 9px; cursor:pointer;">
                  ${canApply ? '放入槽' : '缺料'}
                </button>
                <button class="blueprint-quick-btn" data-id="${bp.id}" ${canApply ? '' : 'disabled style="opacity:0.4; cursor:not-allowed;"'} style="background:linear-gradient(135deg, #00b894, #00cec9); border:none; border-radius:6px; color:#fff; font-size:11px; font-weight:800; padding:6px 10px; cursor:pointer; box-shadow:0 2px 6px rgba(0,184,148,0.3);">
                  ⚡制作
                </button>
              </div>
            </div>
          `;
        } else {
          // 未解锁配方：以暗色剪影与探索线索形式呈现
          bpRows += `
            <div class="blueprint-item blueprint-unknown" style="background:rgba(0,0,0,0.35); border:1px dashed rgba(255,255,255,0.15); border-radius:10px; padding:8px 10px; display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <div style="flex:1; min-width:0; margin-right:8px;">
                <div style="font-weight:800; color:#a4b0be; font-size:12px;">❓ 未探明蓝图 (${this.getItemIcon(bp.a)} + ❓)</div>
                <div style="font-size:10px; color:#eccc68; margin-top:2px;">🔍 线索：${bp.hint}</div>
              </div>
              <button class="blueprint-apply-btn" data-a="${bp.a}" data-b="${bp.b}" ${canApply ? '' : 'disabled style="opacity:0.3; cursor:not-allowed;"'} style="background:#57606f; border:none; border-radius:6px; color:#ced6e0; font-size:11px; font-weight:700; padding:6px 9px; cursor:pointer;">
                ${canApply ? '试验' : '未解锁'}
              </button>
            </div>
          `;
        }
      });

      rightContentHtml = `
        <div style="display:flex; flex-direction:column; flex:1; min-height:0;">
          ${catChipsHtml}
          <div class="blueprint-list" style="overflow-y:auto; max-height:190px; padding-right:4px;">${bpRows}</div>
        </div>
      `;
    }

    body.innerHTML = `
      <div class="split-modal-layout">
        <div class="merge-left-pane">
          <div style="font-size:11px; color:rgba(255,255,255,0.6); text-align:center;">双物自由融合反应炉</div>
          <div class="merge-slots-row">
            <div class="merge-slot ${slotA ? 'filled' : ''}" id="merge-slot-0">
              ${slotA ? `
                <div class="merge-slot-remove" data-slot="0">✕</div>
                <span style="font-size:30px;">${this.getItemIcon(slotA)}</span>
                <span style="font-size:10px; font-weight:700;">${this.getItemName(slotA)}</span>
              ` : '<span style="color:rgba(255,255,255,0.3); font-size:11px;">原料 A</span>'}
            </div>
            <div class="merge-plus">+</div>
            <div class="merge-slot ${slotB ? 'filled' : ''}" id="merge-slot-1">
              ${slotB ? `
                <div class="merge-slot-remove" data-slot="1">✕</div>
                <span style="font-size:30px;">${this.getItemIcon(slotB)}</span>
                <span style="font-size:10px; font-weight:700;">${this.getItemName(slotB)}</span>
              ` : '<span style="color:rgba(255,255,255,0.3); font-size:11px;">原料 B</span>'}
            </div>
          </div>
          <div class="merge-preview-pill">${previewText}</div>
          <button class="merge-submit-btn" id="merge-btn" ${canMerge ? '' : 'disabled style="opacity:0.4; cursor:not-allowed;"'}>
            🔥 开始融合合成
          </button>
        </div>

        <div class="merge-right-pane">
          <div class="tab-header-row">
            <button class="tab-btn ${this.mergeTab === 'materials' ? 'active' : ''}" id="tab-btn-mat">🎒 行囊原料 (点击填入)</button>
            <button class="tab-btn ${this.mergeTab === 'blueprints' ? 'active' : ''}" id="tab-btn-bp">📜 荒岛图鉴蓝图</button>
          </div>
          ${rightContentHtml}
        </div>
      </div>
    `;

    // 绑定 Tab 切换
    const tabMat = document.getElementById('tab-btn-mat');
    const tabBp = document.getElementById('tab-btn-bp');
    if (tabMat) tabMat.addEventListener('click', () => { this.mergeTab = 'materials'; this.openMergeModal(); });
    if (tabBp) tabBp.addEventListener('click', () => { this.mergeTab = 'blueprints'; this.openMergeModal(); });

    // 绑定分类筛选胶囊点击
    body.querySelectorAll('.craft-cat-chip[data-cat]').forEach(chip => {
      chip.addEventListener('click', () => {
        haptics.light();
        this.mergeCategory = chip.getAttribute('data-cat');
        this.openMergeModal();
      });
    });

    // 槽位点击清空
    body.querySelectorAll('.merge-slot-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slotIdx = parseInt(btn.getAttribute('data-slot'));
        this.mergeSlots[slotIdx] = null;
        this.openMergeModal();
      });
    });

    // 原料卡片点击填入槽位
    body.querySelectorAll('.material-card[data-id]').forEach(card => {
      card.addEventListener('click', () => {
        haptics.light();
        const id = card.getAttribute('data-id');
        if (!this.mergeSlots[0]) {
          this.mergeSlots[0] = id;
        } else if (!this.mergeSlots[1]) {
          this.mergeSlots[1] = id;
        } else {
          this.mergeSlots[0] = id;
        }
        this.openMergeModal();
      });
    });

    // 蓝图放入槽位
    body.querySelectorAll('.blueprint-apply-btn[data-a]').forEach(btn => {
      btn.addEventListener('click', () => {
        haptics.light();
        this.mergeSlots[0] = btn.getAttribute('data-a');
        this.mergeSlots[1] = btn.getAttribute('data-b');
        this.openMergeModal();
      });
    });

    // 蓝图⚡一键快捷制作 (原料充足直接制作，省去反复放置步骤)
    body.querySelectorAll('.blueprint-quick-btn[data-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const bpId = btn.getAttribute('data-id');
        const bp = CRAFTING_BLUEPRINTS.find(b => b.id === bpId);
        if (!bp) return;
        this.mergeSlots[0] = bp.a;
        this.mergeSlots[1] = bp.b;
        this.executeMerge();
      });
    });

    const mergeBtn = document.getElementById('merge-btn');
    if (mergeBtn) {
      mergeBtn.addEventListener('click', () => {
        this.executeMerge();
      });
    }

    this.modalBackdrop.style.display = 'flex';
  }

  executeMerge() {
    const [a, b] = this.mergeSlots;
    if (!a || !b) return;

    // 优先通过全局蓝图知识库检索
    const matched = CraftingBlueprintManager.findBlueprint(a, b);

    let product = null;
    let prodCount = 1;
    let prodName = '';
    let isNewDiscovery = false;

    if (matched) {
      product = matched.result;
      prodCount = matched.count || 1;
      prodName = matched.name;
      // 记录图鉴并判定是否为首次探明
      isNewDiscovery = CraftingBlueprintManager.unlockBlueprint(matched.id);
    } else {
      // 兼容历史遗留硬编码合成 fallback
      const pair = [a, b].sort().join('+');
      if (pair === 'tree_bark+tree_branch') {
        product = 'kindling'; prodName = '引火物 🔥';
      } else if (pair === 'stone_chunk+tree_branch') {
        product = 'stone_axe'; prodName = '锋利石斧 🪓';
      } else if (pair === 'beast_hide+tree_branch') {
        product = 'wooden_bow'; prodName = '简易猎弓 🏹';
      } else if (pair === 'stone_chunk+tree_bark') {
        product = 'flint_arrow'; prodCount = 5; prodName = '燧石羽箭 🏹 (x5)';
      }
    }

    if (product) {
      if (product === 'geo_scanner_mk1' && window.__game?.story && window.__game.story.currentChapterId < 2) {
        soundEngine.playMonsterGrowl();
        this.showToast('🛰️ 地质扫描仪 Mk1 研制技术尚未解锁（需进入第二章）！', 'medium');
        this.mergeSlots = [null, null];
        this.openMergeModal();
        return;
      }

      this.inventory[a] = Math.max(0, (this.inventory[a] || 1) - 1);
      this.inventory[b] = Math.max(0, (this.inventory[b] || 1) - 1);
      this.inventory[product] = (this.inventory[product] || 0) + prodCount;

      if (product === 'escape_raft') {
        this.inventory['raft'] = (this.inventory['raft'] || 0) + 1;
      }
      this.mergeSlots = [null, null];
      soundEngine.playItemDrop();
      haptics.success();
      this.renderQuickBar();

      // 首次探明全新蓝图：触发胜利金光音效与专属高光通知
      if (isNewDiscovery) {
        soundEngine.playVictory();
        this.showToast(`✨【图鉴大突破】探明全新蓝图：成功融合【${prodName}】！`, 'medium');
      } else {
        this.showToast(`✨ 成功融合制作【${prodName}】！`, 'medium');
      }

      this.openMergeModal();

      // 通知剧情引擎记录真实合成行为 (合成仅解锁设施或工具，严禁直接跳结局)
      if (window.__game && window.__game.story && window.__game.story.onCraftItem) {
        window.__game.story.onCraftItem(product);
      }
    } else {
      soundEngine.playMonsterGrowl();
      haptics.light();
      this.showToast('💨 融合未产生有效化学反应！原料已返还，尝试其他道具组合吧！', 'medium');
      this.mergeSlots = [null, null];
      this.openMergeModal();
    }
  }

  openHelpModal() {
    if (this.player && this.player.resetInput) this.player.resetInput();
    document.getElementById('modal-title').innerHTML = '📖 CastawaySOL 荒岛生存秘籍';
    const body = document.getElementById('modal-body');
    body.innerHTML = `
      <div style="font-size:14px; line-height:1.7; color:rgba(255,255,255,0.85);">
        <p><strong style="color:#ffdd59;">【荒岛求生主线】</strong><br>
        因遭遇风暴海难，你流落在这座荒岛上。首要任务是活下去，并寻找逃生方法回家！</p>

        <p><strong style="color:#00cec9;">【四维代谢与步数制】</strong><br>
        移动步数驱动你的生命、饥饿、水分与疲劳：<br>
        • 走动每一步都会缓慢消耗水分与饱腹感；<br>
        • 点击水壶可随时痛快喝水（3口喝完可在淡水河流补充）；<br>
        • 疲劳过高会减缓移速，必须前往帐篷过夜睡眠消除！</p>

        <p><strong style="color:#ff7675;">【采集、垂钓与烹饪】</strong><br>
        • 果树：靠近按【摇树】可掉落苹果与椰子；<br>
        • 垂钓：前往南侧木栈桥码头按【垂钓】，鱼咬钩溅起水花时起竿；<br>
        • 营火：将生肉、红蟹、生鱼与苹果带回营地篝火旁加工成高营养熟食！</p>

        <p><strong style="color:#e17055;">【野兽战斗与远程射击】</strong><br>
        • 武器切换：按【R】键或长按攻击键切换【近战长矛 🗡️】与【远程猎弓 🏹】；<br>
        • 弓箭弹道：猎弓消耗【燧石羽箭】发射重力抛物线箭矢，击中远处野兽可激怒引怪（Pull Aggro），落空箭矢有 50% 概率完好回收；<br>
        • 极限闪避：野猪蓄力冲撞（地面红光警示）时，看准时机按【空格】起跳闪避伤害！<br>
        • 破绽暴击：野猪撞树陷入眩晕后，长矛突刺必出【200% 致命暴击】！</p>

        <p><strong style="color:#a29bfe;">【逃离结局与纪念证书】</strong><br>
        • 结局1：在合成台将【坏收音机 + 电池】组合成【修好的收音机】，发送救援电波！<br>
        • 结局6：搜集木材与钉子，在合成台制作【求生大木筏】，扬帆出海逃离！<br>
        • 达成结局后会生成本地纪念证书；当前版本不会铸造链上 NFT。</p>
      </div>
    `;
    this.modalBackdrop.style.display = 'flex';
  }

  updateSolanaBtn() {
    const btn = document.getElementById('btn-solana');
    if (!btn) return;
    if (solanaBridge.isConnected && solanaBridge.walletAddress) {
      const addrShort = solanaBridge.walletAddress.slice(0, 4) + '...' + solanaBridge.walletAddress.slice(-4);
      const balStr = solanaBridge.isGuest ? '游客' : `${solanaBridge.balance.toFixed(2)} SOL`;
      const devTag = solanaBridge.isMWA ? '📱' : iconHTML('hud/solana', 18, { eager: true });
      btn.innerHTML = `${devTag} ${addrShort} (${balStr})`;
      btn.style.background = 'linear-gradient(135deg, rgba(153, 69, 255, 0.4), rgba(20, 241, 149, 0.4))';
      btn.style.border = '1px solid #14F195';
    } else {
      btn.innerHTML = `${iconHTML('hud/solana', 18, { eager: true })} SOL 钱包连接`;
      btn.style.background = '';
      btn.style.border = '';
    }
  }

  async handleSolanaWallet() {
    this.openSolanaModal();
  }

  // Solana Seeker Web3 专属控制台与硬件级交互面板
  openSolanaModal() {
    soundEngine.playPlaceFurniture();
    document.getElementById('modal-title').innerHTML = `🟣 Solana Web3 钱包管理中心`;
    const body = document.getElementById('modal-body');

    const renderModal = () => {
      const isConn = solanaBridge.isConnected;
      const addr = solanaBridge.walletAddress || '';
      const balance = solanaBridge.balance.toFixed(3);
      const isMwa = solanaBridge.isMWA;
      const isGuest = solanaBridge.isGuest;
      const isSeeker = solanaBridge.isSeeker;
      const currentNet = solanaBridge.network;
      const checkins = solanaBridge.getCheckinRecords();
      const availableWallets = solanaBridge.getAvailableWallets();

      const typeLabel = isMwa ? '📱 Solana Mobile (Seed Vault)' : (isGuest ? '👤 免钱包游客沙盒' : '💻 浏览器插件 (Phantom/Backpack)');
      const statusBadge = isConn ? `<span style="background:#2ed573; color:#fff; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:bold; box-shadow:0 0 10px rgba(46,213,115,0.4);">● 已接入</span>` : `<span style="background:rgba(255,255,255,0.15); color:#cbd5e1; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:600;">○ 未连接</span>`;

      let checkinListHtml = '';
      if (checkins.length > 0) {
        checkinListHtml = checkins.slice(0, 3).map(c => `
          <div style="background:rgba(255,255,255,0.06); border-radius:8px; padding:6px 10px; margin-top:5px; font-size:11px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="color:#14F195; font-weight:bold;">第 ${c.day} 天签到</span>
              <span style="color:rgba(255,255,255,0.5); margin-left:6px;">${new Date(c.timestamp).toLocaleTimeString()}</span>
            </div>
            <div style="color:${c.isHardwareSigned ? '#9945FF' : '#fffa65'}; font-weight:bold;">
              ${c.isHardwareSigned ? '📱 硬件签名认证' : (c.isGuest ? '👤 游客存证' : '✍️ 链上签名')}
            </div>
          </div>
        `).join('');
      } else {
        checkinListHtml = `<div style="color:rgba(255,255,255,0.4); font-size:12px; padding:6px 0;">暂无链上签到存证，点击下方按钮完成今日求生打卡</div>`;
      }

      // 钱包选择项列表
      const walletItemsHtml = availableWallets.map(w => {
        const isRec = w.recommended;
        const borderStyle = isRec ? 'border:1.5px solid #14F195; background:rgba(20,241,149,0.08);' : 'border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04);';
        return `
          <div class="wallet-option-item" data-wallet="${w.id}" style="${borderStyle} border-radius:12px; padding:10px 12px; cursor:pointer; display:flex; align-items:center; justify-content:space-between; transition:all 0.2s ease;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:22px;">${w.icon}</span>
              <div>
                <div style="font-size:13px; font-weight:700; color:#fff; display:flex; align-items:center; gap:6px;">
                  <span>${w.name}</span>
                  ${isRec ? `<span style="background:linear-gradient(135deg, #14F195, #0ea569); color:#081b11; font-size:10px; font-weight:900; padding:1px 6px; border-radius:6px;">推荐</span>` : ''}
                </div>
                <div style="font-size:11px; color:rgba(255,255,255,0.55); margin-top:2px;">${w.description}</div>
              </div>
            </div>
            <div>
              <span style="background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.8); font-size:11px; padding:3px 8px; border-radius:8px;">${w.badge}</span>
            </div>
          </div>
        `;
      }).join('');

      body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px; font-family:-apple-system, BlinkMacSystemFont, sans-serif; color:#ffffff; max-height:75vh; overflow-y:auto; padding-right:2px;">
          <!-- 顶部状态卡与网络选择 -->
          <div style="background:linear-gradient(135deg, rgba(153, 69, 255, 0.15), rgba(20, 241, 149, 0.15)); border:1px solid rgba(20, 241, 149, 0.35); border-radius:14px; padding:12px 16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:18px;">🟣</span>
                <span style="font-size:14px; font-weight:800; color:#14F195;">${isSeeker ? 'Solana Seeker 认证设备' : 'Solana Web3 生态'}</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <select id="wallet-network-select" style="background:rgba(0,0,0,0.5); color:#14F195; border:1px solid rgba(20,241,149,0.4); border-radius:8px; padding:2px 6px; font-size:11px; outline:none; cursor:pointer;">
                  <option value="devnet" ${currentNet === 'devnet' ? 'selected' : ''}>Devnet (开发网)</option>
                  <option value="testnet" ${currentNet === 'testnet' ? 'selected' : ''}>Testnet (测试网)</option>
                </select>
                ${statusBadge}
              </div>
            </div>

            <div style="font-size:12px; color:rgba(255,255,255,0.7); display:flex; flex-direction:column; gap:4px;">
              <div>连接通道：<strong style="color:#14F195;">${typeLabel}</strong></div>
              ${isConn ? `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                  <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    钱包地址：<code style="background:rgba(0,0,0,0.4); padding:2px 6px; border-radius:4px; color:#ffeaa7; word-break:break-all;">${addr}</code>
                  </div>
                  <button id="btn-copy-address" style="flex-shrink:0; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:6px; padding:2px 8px; font-size:11px; cursor:pointer;">复制</button>
                </div>
                <div style="display:flex; align-items:center; justify-content:space-between; margin-top:2px;">
                  <div>当前余额：<strong style="color:#fffa65; font-size:14px;">${balance} SOL</strong></div>
                  <button id="btn-refresh-balance" style="background:none; border:none; color:#14F195; font-size:12px; cursor:pointer; padding:0 4px;">🔄 刷新</button>
                </div>
              ` : `
                <div style="color:rgba(255,255,255,0.5); font-size:11px; margin-top:2px;">选择下方任意方式连接钱包，开启链上求生打卡与特权兑换</div>
              `}
            </div>
          </div>

          <!-- 未连接时：多钱包选择通道 -->
          ${!isConn ? `
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="font-size:12px; font-weight:700; color:rgba(255,255,255,0.85); margin-left:2px;">选择连接方式：</div>
              ${walletItemsHtml}
            </div>
          ` : `
            <!-- 已连接时：控制中心操作栏 -->
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <button id="btn-seeker-checkin" ${window.__game.saveSystem.hasClaimedCheckin(this.survival.day) ? 'disabled' : ''} style="opacity:${window.__game.saveSystem.hasClaimedCheckin(this.survival.day) ? 0.45 : 1};background:linear-gradient(135deg, #14F195, #0ea569); color:#081b11; border:none; border-radius:10px; padding:10px 8px; font-size:13px; font-weight:900; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px; box-shadow:0 4px 12px rgba(20,241,149,0.35);">
                  ${window.__game.saveSystem.hasClaimedCheckin(this.survival.day) ? '今日已领取' : '📝 链上生存打卡 (+5 算力代币)'}
                </button>
                ${!isGuest ? `
                  <button id="btn-devnet-airdrop" style="background:linear-gradient(135deg, #9945FF, #7429d8); color:#fff; border:none; border-radius:10px; padding:10px 8px; font-size:13px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px; box-shadow:0 4px 12px rgba(153,69,255,0.35);">
                    🪂 申请 1 SOL 测试币
                  </button>
                ` : `
                  <button id="btn-switch-real-wallet" style="background:linear-gradient(135deg, #9945FF, #7429d8); color:#fff; border:none; border-radius:10px; padding:10px 8px; font-size:13px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;">
                    🔗 切换至正式钱包
                  </button>
                `}
              </div>
              <button id="btn-disconnect-wallet" style="background:rgba(235, 77, 75, 0.15); border:1px solid rgba(235, 77, 75, 0.4); color:#ff7675; border-radius:10px; padding:7px 10px; font-size:12px; cursor:pointer; margin-top:2px;">
                断开当前钱包连接
              </button>
            </div>
          `}

          <!-- 链上生存签到存证记录 -->
          <div style="background:rgba(0,0,0,0.25); border-radius:12px; padding:10px 14px;">
            <div style="font-size:13px; font-weight:700; color:rgba(255,255,255,0.85); display:flex; justify-content:space-between;">
              <span>📜 链上签到与存证凭据</span>
              <span style="font-size:11px; color:#14F195;">${isSeeker ? 'Seed Vault 硬件级保护' : 'ED25519 签名存证'}</span>
            </div>
            ${checkinListHtml}
          </div>
        </div>
      `;

      // 绑定网络切换
      const netSelect = document.getElementById('wallet-network-select');
      if (netSelect) {
        netSelect.onchange = (e) => {
          solanaBridge.setNetwork(e.target.value);
          this.showToast(`🌐 网络已切换为: ${e.target.value}`, 'small');
          this.updateSolanaBtn();
          renderModal();
        };
      }

      // 绑定复制地址
      const btnCopy = document.getElementById('btn-copy-address');
      if (btnCopy) {
        btnCopy.onclick = async () => {
          const res = await solanaBridge.copyWalletAddress();
          this.showToast(res.message, 'small');
        };
      }

      // 绑定刷新余额
      const btnRefresh = document.getElementById('btn-refresh-balance');
      if (btnRefresh) {
        btnRefresh.onclick = async () => {
          btnRefresh.disabled = true;
          await solanaBridge.fetchBalance();
          this.showToast('✅ 余额已刷新', 'small');
          this.updateSolanaBtn();
          renderModal();
        };
      }

      // 绑定多钱包选择项点击
      const optionItems = document.querySelectorAll('.wallet-option-item');
      optionItems.forEach(item => {
        item.onclick = async () => {
          const walletType = item.getAttribute('data-wallet');
          this.showToast(`正在唤起 ${walletType} 钱包连接...`, 'small');
          const res = await solanaBridge.connectWallet(walletType);
          if (res.success) {
            soundEngine.playPlaceFurniture();
            this.showToast(`🎉 已成功接入: ${res.type}！`, 'medium');
            this.updateSolanaBtn();
            renderModal();
          } else {
            this.showToast(`连接未完成: ${res.message || '未授权'}`, 'medium');
            renderModal();
          }
        };
      });

      // 切换至正式钱包按钮
      const btnSwitchReal = document.getElementById('btn-switch-real-wallet');
      if (btnSwitchReal) {
        btnSwitchReal.onclick = async () => {
          await solanaBridge.disconnect();
          renderModal();
        };
      }

      // 签到存证按钮
      const btnCheckin = document.getElementById('btn-seeker-checkin');
      if (btnCheckin) {
        btnCheckin.onclick = async () => {
          const claimDay = this.survival.day;
          if (window.__game.saveSystem.hasClaimedCheckin(claimDay)) return;
          btnCheckin.disabled = true;
          btnCheckin.innerText = '✍️ 签名确认中...';
          const res = await solanaBridge.signSurvivalCheckin(claimDay, this.survival.steps);
          btnCheckin.disabled = false;
          if (res.success) {
            soundEngine.playPlaceFurniture();
            if (!window.__game.saveSystem.claimDailyCheckin(claimDay)) { this.showToast('今日已领取或存档失败', 'medium'); renderModal(); return; }
            const tipText = res.hardwareSigned
              ? `🌟 恭喜！已使用 Seeker 硬件私钥完成第 ${claimDay} 天链上打卡！(+5 算力代币)`
              : `✅ 完成今日打卡存证！(+5 算力代币)`;
            this.showToast(tipText, 'medium');
            renderModal();
          } else {
            this.showToast(`打卡未完成: ${res.message || '用户取消'}`, 'medium');
            renderModal();
          }
        };
      }

      // 申请空投测试币
      const btnAirdrop = document.getElementById('btn-devnet-airdrop');
      if (btnAirdrop) {
        btnAirdrop.onclick = async () => {
          btnAirdrop.disabled = true;
          btnAirdrop.innerText = '🪂 申请 Devnet 空投中...';
          const res = await solanaBridge.requestAirdrop();
          btnAirdrop.disabled = false;
          if (res.success) {
            soundEngine.playPlaceFurniture();
            this.showToast(`🎉 成功领取 1.0 SOL 测试币！余额: ${res.balance.toFixed(3)} SOL`, 'important');
            this.updateSolanaBtn();
            renderModal();
          } else {
            this.showToast(`空投提示: ${res.message}`, 'medium');
          }
        };
      }

      // 断开连接
      const btnDisconnect = document.getElementById('btn-disconnect-wallet');
      if (btnDisconnect) {
        btnDisconnect.onclick = async () => {
          await solanaBridge.disconnect();
          this.showToast('已断开钱包连接', 'medium');
          this.updateSolanaBtn();
          renderModal();
        };
      }
    };

    renderModal();
    this.modalBackdrop.style.display = 'flex';
  }

  async triggerEndingScreen(endingId, data = {}) {
    soundEngine.playItemDrop();

    const endingsMeta = {
      ED1: {
        title: '🚁【结局 1】搜救直升机救援 (Helicopter Rescue)',
        subtitle: '搜救直升机救援 · 重返现代文明',
        rating: '🏆 S 级 · 智慧生还',
        badge: '🎖️ 黄金级生还者 · 搜救联络大师',
        color: '#ffdd59',
        icon: '🚁',
        desc: '南岸沙滩上醒目的白贝壳巨石【S.O.S】与修复完好的无线电呼叫电波穿越重重云雾，终于引来了搜救直升机的螺旋桨轰鸣盘旋！你带着同伴挥舞双臂登机脱险，平安重返人类文明！'
      },
      ED2: {
        title: '🌊【结局 2】孤舟海难·悲壮漂流 (Tragic Drifting)',
        subtitle: '深海风暴 · 遗落的孤舟勇者',
        rating: '🌊 B 级 · 悲情生还',
        badge: '🌊 无畏漂流者 · 孤海孤舟',
        color: '#74b9ff',
        icon: '🌊',
        desc: '你未能备齐足够的淡水与食粮，或抛下了未曾苏醒的同伴孤身一人乘简易木筏远航。突如其来的雷暴狂涛将木筏撕碎……虽然未能顺利靠岸，但你的无畏探险精神将永远铭刻在浩瀚深海之中。'
      },
      ED6: {
        title: '⛵【结局 6】平安双人归航 (Safe Raft Voyage)',
        subtitle: '扬帆破浪 · 相互扶持的凯旋',
        rating: '🌟 SS 级 · 卓越生还',
        badge: '⛵ 坚毅航海家 · 破浪生还者',
        color: '#00cec9',
        icon: '⛵',
        desc: '坚固的双桅大木筏承载着你与艾莉、机灵小猴巴布穿越无垠大洋。历经数日逆风破浪与星夜航行，远方海平线上终于出现了熟悉的灯塔与商船！你们相互扶持，战胜了残酷的自然考验，凯旋归来！'
      },
      ED8: {
        title: '💖【结局 8】真爱羁绊·永恒誓约 (True Love & Boundless Future)',
        subtitle: '刻骨誓约 · 生死相随的完美终章',
        rating: '👑 SSS 级 · 终极传说',
        badge: '💖 荒岛真爱传奇 · 永恒相守誓约',
        color: '#ff7675',
        icon: '💖',
        desc: '不仅突破绝境生还，更在患难与共中赢得了此生最珍贵的真挚羁绊。落日霞光将海面染成灿烂金红，艾莉温柔地依偎在你的怀中，小猴巴布在桅杆上乘风欢呼。只要彼此相守，任何风浪都是走向未来的浪漫序章！'
      }
    };

    const endInfo = endingsMeta[endingId] || endingsMeta['ED1'];
    const days = data.day || this.survival.day || 1;
    const steps = data.steps || this.survival.steps || 0;
    const affection = data.secondKidAffection || 50;

    // 生成本地逃脱纪念证书（当前版本不会上链）
    const cert = await solanaBridge.mintEscapeCertificate({
      day: days,
      steps: steps,
      endingName: endInfo.title
    });

    // 弹出逃脱结算与本地纪念证书
    document.getElementById('modal-title').innerHTML = `🏆 Survival Kids · 官方逃脱结案报告`;
    const body = document.getElementById('modal-body');
    body.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; text-align:center; padding:6px 12px;">
        <div style="font-size:48px; margin-bottom:2px; filter:drop-shadow(0 0 25px ${endInfo.color});">${endInfo.icon}</div>
        <div style="font-size:20px; font-weight:900; color:${endInfo.color}; margin-bottom:4px; letter-spacing:0.5px;">
          ${endInfo.title}
        </div>
        <div style="font-size:12px; font-weight:700; color:#ffffff; background:rgba(255,255,255,0.12); padding:3px 12px; border-radius:12px; margin-bottom:10px;">
          ${endInfo.badge} · 评级：${endInfo.rating}
        </div>

        <div style="font-size:13px; line-height:1.6; color:rgba(255,255,255,0.88); background:rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.12); border-radius:14px; padding:12px 14px; margin-bottom:14px; text-align:left;">
          ${endInfo.desc}
        </div>

        <div style="width:100%; max-width:480px; background:rgba(20,241,149,0.08); border:1.5px solid rgba(20,241,149,0.35); border-radius:16px; padding:12px 14px; margin-bottom:14px; text-align:left;">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:12px;">
            <span style="color:#b2bec3;">🏝️ 生存历时与步数</span>
            <span style="font-weight:800; color:#ffdd59;">第 ${days} 天 (${steps} 步)</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:12px;">
            <span style="color:#b2bec3;">💖 艾莉羁绊好感度</span>
            <span style="font-weight:800; color:#ff7675;">${affection} / 250 (${data.secondKidAwake ? '已救治' : '未救治'})</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:12px;">
            <span style="color:#b2bec3;">🐒 忠实伙伴</span>
            <span style="font-weight:800; color:#00cec9;">${data.monkeyBefriended ? '机灵小猴 Bub (已入队)' : '独行探索'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:12px;">
            <span style="color:#b2bec3;">🏝️ 本地纪念证书编号（未上链）</span>
            <span style="font-weight:800; color:#9945FF; font-family:monospace;">${cert.mintId}</span>
          </div>
        </div>

        <div style="display:flex; gap:10px; width:100%; max-width:480px;">
          <button id="btn-cert-copy" style="flex:1; background:linear-gradient(135deg, #9945FF, #14F195); border:none; border-radius:12px; padding:11px 0; color:#ffffff; font-size:13px; font-weight:900; cursor:pointer; box-shadow:0 4px 15px rgba(20,241,149,0.3);">
            📋 复制证书编号
          </button>
          <button id="btn-cert-restart" style="flex:1; background:linear-gradient(135deg, #ff7675, #d63031); border:none; border-radius:12px; padding:11px 0; color:#ffffff; font-size:13px; font-weight:900; cursor:pointer;">
            🔄 重新启航
          </button>
          <button id="btn-cert-stay" style="flex:1; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.2); border-radius:12px; padding:11px 0; color:#ffffff; font-size:13px; font-weight:800; cursor:pointer;">
            🏝️ 留岛漫游
          </button>
        </div>
      </div>
    `;

    const copyBtn = document.getElementById('btn-cert-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard?.writeText(cert.mintId);
        this.showToast(`已复制本地纪念证书编号: ${cert.mintId}！`, 'medium');
      });
    }

    const restartBtn = document.getElementById('btn-cert-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        window.location.reload();
      });
    }

    const stayBtn = document.getElementById('btn-cert-stay');
    if (stayBtn) {
      stayBtn.addEventListener('click', () => {
        this.modalBackdrop.style.display = 'none';
        this.showToast('继续留岛漫游，享受无拘无束的海岛慢生活吧！', 'medium');
      });
    }

    this.modalBackdrop.style.display = 'flex';
  }

  async triggerSolanaEscapeEnding(craftId) {
    const endingId = craftId === 'escape_raft' ? 'ED6' : 'ED1';
    this.triggerEndingScreen(endingId, {
      day: this.survival.day,
      steps: this.survival.steps,
      monkeyBefriended: true,
      secondKidAwake: true,
      secondKidAffection: 120
    });
  }

  consumeItem(id) {
    if (!this.inventory[id] || this.inventory[id] <= 0) return;

    if (id === 'apple') {
      this.inventory.apple -= 1;
      this.survival.consume({ hunger: 20, life: 5 });
      soundEngine.playItemDrop();
      this.showToast('🍎 咬下一口清脆甘甜的苹果，饥饿+20，生命+5！', 'small');
    } else if (id === 'coconut') {
      this.inventory.coconut -= 1;
      this.survival.consume({ hunger: 15, water: 25, life: 8 });
      soundEngine.playItemDrop();
      this.showToast('🥥 喝尽清甜椰子水，饥饿+15，饮水+25，生命+8！', 'small');
    } else if (id === 'fish') {
      this.inventory.fish -= 1;
      this.survival.consume({ hunger: 25, life: 8 });
      soundEngine.playItemDrop();
      this.showToast('🐟 生吃了条鱼，饥饿+25（去中央篝火烤熟营养加倍）！', 'small');
    } else if (id === 'baked_fish') {
      this.inventory.baked_fish -= 1;
      this.survival.consume({ hunger: 65, life: 25, fatigue: -15 });
      soundEngine.playCooking();
      this.showToast('🍱 享用了外焦里嫩的烤大鱼！饥饿+65，生命+25，疲劳-15！', 'small');
    } else if (id === 'baked_apple') {
      this.inventory.baked_apple -= 1;
      this.survival.consume({ hunger: 35, water: 10, life: 15 });
      soundEngine.playCooking();
      this.showToast('🥧 享用了热气腾腾的烤苹果！饥饿+35，饮水+10，生命+15！', 'small');
    } else if (id === 'canteen_clean_water') {
      this.inventory.canteen_clean_water -= 1;
      this.survival.consume({ water: 50, life: 20 });
      this.survival.refillCanteen();
      soundEngine.playSplash();
      this.showToast('💧 畅饮了甘甜冰冽的纯净水！水分大幅回满，水壶已灌满！', 'small');
    } else if (id === 'raw_meat') {
      this.inventory.raw_meat -= 1;
      this.survival.consume({ hunger: 30, life: 5 });
      soundEngine.playItemDrop();
      this.showToast('🥩 生嚼了野兽肉，饥饿+30，生命+5（前往营火烤熟更美味！）', 'small');
    } else if (id === 'cooked_meat') {
      this.inventory.cooked_meat -= 1;
      this.survival.consume({ hunger: 75, life: 35, fatigue: -20 });
      soundEngine.playCooking();
      this.showToast('🍖 享用了香烤野味排骨大餐！外酥里嫩，饥饿+75，生命+35，疲劳-20！', 'small');
    } else if (id === 'crab_meat') {
      this.inventory.crab_meat -= 1;
      this.survival.consume({ hunger: 25, life: 8 });
      soundEngine.playItemDrop();
      this.showToast('🦀 品尝了新鲜红蟹肉，饥饿+25，生命+8！', 'small');
    } else if (id === 'cooked_crab') {
      this.inventory.cooked_crab -= 1;
      this.survival.consume({ hunger: 55, life: 25, fatigue: -10 });
      soundEngine.playCooking();
      this.showToast('🦀 享用了炭烤极品红蟹！鲜甜多汁，饥饿+55，生命+25，疲劳-10！', 'small');
    } else if (id === 'large_backpack') {
      this.inventory.large_backpack -= 1;
      this.bonusInventorySlots = (this.bonusInventorySlots || 0) + 4;
      soundEngine.playPlaceFurniture();
      this.showToast('🎒 装备了【拓荒者大皮包】！随身行囊存储容量永久扩充 +4 格！', 'medium');
    } else if (id === 'beast_trap') {
      if (window.__game && window.__game.wildlifeCombat) {
        this.inventory.beast_trap -= 1;
        window.__game.wildlifeCombat.placeTrapAtPlayer();
        soundEngine.playPlaceFurniture();
        this.showToast('🪤 成功在脚下布置【齿状捕兽夹】！踏入的野兽将被禁锢 4 秒并遭受致命破绽！', 'medium');
      } else {
        this.showToast('当前无法布置捕兽夹！', 'medium');
        return;
      }
    } else if (id === 'wooden_spikes') {
      if (window.__game && window.__game.wildlifeCombat) {
        this.inventory.wooden_spikes -= 1;
        window.__game.wildlifeCombat.placeSpikesAtPlayer();
        soundEngine.playPlaceFurniture();
        this.showToast('🪵 成功在脚下筑起【防兽尖木拒马】！可阻挡野兽冲撞并反震 50 点伤害！', 'medium');
      } else {
        this.showToast('当前无法扎制拒马！', 'medium');
        return;
      }
    } else if (id === 'golden_coconut') {
      this.inventory.golden_coconut -= 1;
      this.survival.consume({ hunger: 45, water: 50, life: 25, fatigue: -30 });
      soundEngine.playSplash();
      this.showToast('🥥✨ 痛饮了小猴采摘的黄金海岛椰！饥饿+45，水分+50，疲劳消除-30！', 'small');
    } else if (id === 'bird_egg') {
      this.inventory.bird_egg -= 1;
      this.survival.consume({ hunger: 30, life: 15 });
      soundEngine.playCooking();
      this.showToast('🥚 品尝了富含优质蛋白的林间海鸟蛋！饥饿+30，生命+15！', 'small');
    } else if (id === 'sea_crab') {
      this.inventory.sea_crab -= 1;
      this.survival.consume({ hunger: 25, life: 8 });
      soundEngine.playItemDrop();
      this.showToast('🦀 生吃了退潮捕获的海蟹（去营火熏烤风味更佳）！饥饿+25，生命+8！', 'small');
    } else if (id === 'sardine') {
      this.inventory.sardine -= 1;
      this.survival.consume({ hunger: 20, life: 6 });
      soundEngine.playItemDrop();
      this.showToast('🐟 生吃了肥美的小沙丁鱼！饥饿+20，生命+6！', 'small');
    } else if (id === 'smoked_fish') {
      this.inventory.smoked_fish -= 1;
      this.survival.consume({ hunger: 80, life: 35, fatigue: -25 });
      soundEngine.playCooking();
      if (window.__game?.miningRig?.applyResonanceBuff) {
        window.__game.miningRig.applyResonanceBuff('smoked_fish');
      }
      this.showToast('🍱✨ 享用了极品熏鱼干！饥饿+80，生命+35，并获得 3 轮共振【稳手】双倍残晶增益！', 'small');
    } else if (id === 'bone_armor') {
      this.inventory.bone_armor -= 1;
      this.hasBoneArmorEquipped = true;
      if (this.survival) {
        this.survival.maxLife = (this.survival.maxLife || 100) + 25;
        this.survival.consume({ life: 25 });
      }
      soundEngine.playPlaceFurniture();
      this.showToast('🦺 成功穿戴【甲壳兽皮胸甲】！生命上限永久提升至 125，并获得冲撞霸体抗性！', 'medium');
    } else if (id === 'herbal_paste') {
      this.inventory.herbal_paste -= 1;
      this.survival.consume({ life: 45, fatigue: -10 });
      soundEngine.playCooking();
      this.showToast('🩹 涂抹了【止血树脂敷膏】！创伤迅速愈合，生命值大幅恢复 +45，疲劳-10！', 'small');
    } else if (id === 'energy_drink') {
      this.inventory.energy_drink -= 1;
      this.survival.consume({ hunger: 30, water: 50, fatigue: -35 });
      soundEngine.playSplash();
      if (window.__game?.miningRig?.applyResonanceBuff) {
        window.__game.miningRig.applyResonanceBuff('energy_drink');
      }
      this.showToast('🧃 痛饮了【清甜鲜萃果浆】！饥饿+30，饮水+50，疲劳大减-35，并获得 2 轮共振【专注】地脉透视增强！', 'small');
    } else if (id === 'resonance_crab_pot') {
      this.inventory.resonance_crab_pot -= 1;
      this.survival.consume({ hunger: 70, water: 30, life: 30, fatigue: -20 });
      soundEngine.playCooking();
      if (window.__game?.miningRig?.applyResonanceBuff) {
        window.__game.miningRig.applyResonanceBuff('resonance_crab_pot');
      }
      this.showToast('🍲✨ 享用了【共振浓香椰子蟹煲】！饥饿+70，生命+30，并获得 3 轮共振【晶爆概率 x1.5】灵感增益！', 'small');
    } else if (id === 'bamboo_canteen') {
      this.inventory.bamboo_canteen -= 1;
      this.survival.consume({ water: 45, life: 10 });
      soundEngine.playSplash();
      this.showToast('🍶 痛饮了便携水壶中的甘泉！饮水+45，生命+10！', 'small');
    } else if (id === 'fire_arrow') {
      this.showToast('🏹🔥【烈焰爆燃箭】：持有猎弓按 [R] 即可作为特殊贯穿弹药射出！', 'medium');
      return;
    } else {
      this.showToast(`这是重要材料【${this.getItemName(id)}】，点击右上角【🔨合成台】进行组合融合！`, 'medium');
      return;
    }

    this.renderQuickBar();
    this.updateSurvivalHUD();

    // 通知剧情引擎记录真实进食行为
    if (window.__game && window.__game.story && window.__game.story.onConsumeFood) {
      window.__game.story.onConsumeFood(id);
    }
  }

  // 兼容别名调用
  renderInventory() {
    this.renderQuickBar();
  }

  // 营地储物箱双向存取模态弹窗 (左侧随身行囊，右侧营地储物箱)
  openStorageModal(storageSystem) {
    if (this.player && this.player.resetInput) this.player.resetInput();
    document.getElementById('modal-title').innerHTML = '📦 营地坚固储物箱 (Camp Storage)';
    const body = document.getElementById('modal-body');

    const renderContents = () => {
      const bagItems = Object.entries(this.inventory).filter(([_, c]) => c > 0);
      const boxItems = Object.entries(storageSystem.storageInventory).filter(([_, c]) => c > 0);

      let bagListHtml = '';
      if (bagItems.length > 0) {
        bagListHtml = bagItems.map(([id, cnt]) => `
          <div class="storage-item-row" data-action="deposit" data-id="${id}" style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.06); padding:8px 12px; border-radius:10px; cursor:pointer; margin-bottom:6px; border:1px solid rgba(255,255,255,0.08); transition:all 0.15s;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:20px;">${this.getItemIcon(id)}</span>
              <span style="font-size:13px; font-weight:700; color:#ffffff;">${this.getItemName(id)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:12px; font-weight:800; color:#00cec9;">x${cnt}</span>
              <span style="font-size:11px; background:#0984e3; color:#fff; padding:2px 6px; border-radius:6px;">存入 ➔</span>
            </div>
          </div>
        `).join('');
      } else {
        bagListHtml = '<div style="color:rgba(255,255,255,0.4); text-align:center; padding:24px 0; font-size:12px;">背包内暂无物品</div>';
      }

      let boxListHtml = '';
      if (boxItems.length > 0) {
        boxListHtml = boxItems.map(([id, cnt]) => `
          <div class="storage-item-row" data-action="withdraw" data-id="${id}" style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.06); padding:8px 12px; border-radius:10px; cursor:pointer; margin-bottom:6px; border:1px solid rgba(255,255,255,0.08); transition:all 0.15s;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:20px;">${this.getItemIcon(id)}</span>
              <span style="font-size:13px; font-weight:700; color:#ffffff;">${this.getItemName(id)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:12px; font-weight:800; color:#ffdd59;">x${cnt}</span>
              <span style="font-size:11px; background:#e17055; color:#fff; padding:2px 6px; border-radius:6px;">取出 ⬅</span>
            </div>
          </div>
        `).join('');
      } else {
        boxListHtml = '<div style="color:rgba(255,255,255,0.4); text-align:center; padding:24px 0; font-size:12px;">储物箱内空空如也</div>';
      }

      body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px; width:100%; max-height:60vh; overflow-y:auto; padding:4px;">
          <div style="display:flex; gap:12px; flex:1; min-height:220px;">
            <!-- 左侧：随身行囊 -->
            <div style="flex:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.12); border-radius:14px; padding:10px; display:flex; flex-direction:column;">
              <div style="font-size:13px; font-weight:800; color:#74b9ff; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
                <span>🎒 随身行囊 (点击存入)</span>
                <span style="font-size:11px; color:rgba(255,255,255,0.7); background:rgba(0,0,0,0.4); padding:2px 8px; border-radius:10px;">
                  ${this.usedInventorySlots} / ${this.maxInventorySlots} 格
                </span>
              </div>
              <div style="flex:1; overflow-y:auto;">
                ${bagListHtml}
              </div>
            </div>

            <!-- 右侧：营地储物箱 -->
            <div style="flex:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.12); border-radius:14px; padding:10px; display:flex; flex-direction:column;">
              <div style="font-size:13px; font-weight:800; color:#ffeaa7; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
                <span>📦 营地木箱 (点击取出)</span>
                <span style="font-size:11px; color:rgba(255,255,255,0.7); background:rgba(0,0,0,0.4); padding:2px 8px; border-radius:10px;">
                  ${storageSystem.usedSlots} / ${storageSystem.maxCapacity} 格
                </span>
              </div>
              <div style="flex:1; overflow-y:auto;">
                ${boxListHtml}
              </div>
            </div>
          </div>

          <!-- 底部快捷控制栏 -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:12px; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:12px; color:rgba(255,255,255,0.6);">💡 提示：建造时优先扣除背包并联动扣除箱内资材</span>
            </div>
            <div style="display:flex; gap:8px;">
              <button id="btn-deposit-all-mats" style="background:#00b894; border:none; border-radius:8px; padding:6px 14px; color:#fff; font-weight:800; font-size:12px; cursor:pointer;">
                一键存入建材
              </button>
              <button id="btn-expand-storage" style="background:linear-gradient(135deg, #e17055, #d63031); border:none; border-radius:8px; padding:6px 12px; color:#fff; font-weight:800; font-size:12px; cursor:pointer;">
                📦 扩容木箱 (+16)
              </button>
            </div>
          </div>
        </div>
      `;

      // 绑定存入事件
      body.querySelectorAll('[data-action="deposit"]').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.getAttribute('data-id');
          storageSystem.depositItem(id, 1);
          renderContents();
        });
      });

      // 绑定取出事件
      body.querySelectorAll('[data-action="withdraw"]').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.getAttribute('data-id');
          storageSystem.withdrawItem(id, 1);
          renderContents();
        });
      });

      // 绑定一键存入原料
      const depAllBtn = body.querySelector('#btn-deposit-all-mats');
      if (depAllBtn) {
        depAllBtn.addEventListener('click', () => {
          const matKeys = ['wood_plank', 'nail', 'tree_branch', 'stone_chunk', 'metal_scrap', 'lumber', 'ivy', 'tree_bark', 'tree_sap'];
          let moved = 0;
          matKeys.forEach(k => {
            const count = this.inventory[k] || 0;
            if (count > 0) {
              storageSystem.depositItem(k, count);
              moved += count;
            }
          });
          if (moved > 0) {
            this.showToast(`📦 已将 ${moved} 件建材资材规整归入营地储物箱！`, 'medium');
          } else {
            this.showToast('背包中暂无未归档的建筑材料。', 'medium');
          }
          renderContents();
        });
      }
      // 绑定扩容储物箱
      const expandBtn = body.querySelector('#btn-expand-storage');
      if (expandBtn) {
        expandBtn.addEventListener('click', () => {
          if (window.__game && window.__game.shopManager) {
            window.__game.shopManager.openShopModal('storage_expand');
          } else {
            storageSystem.expandCapacity(16);
            renderContents();
          }
        });
      }
    };

    renderContents();
    this.modalBackdrop.style.display = 'flex';
    soundEngine.playPlaceFurniture();
  }

  // 商业化特权与 Solana 商城模态面板
  openShopModal() {
    if (this.player && this.player.resetInput) this.player.resetInput();
    const game = window.__game;
    if (game && game.shopManager) {
      game.shopManager.open();
    } else {
      if (!this.shop) {
        this.shop = new ShopManager(window.__game || { ui: this });
      }
      this.shop.open();
    }
  }

  // 营地经营与幸存者生产排班中枢模态面板 (双 Tab: 供需看板 + 居民排班)
  openCampManageModal() {
    if (this.player && this.player.resetInput) this.player.resetInput();
    const game = window.__game;
    if (!game || !game.campFacilities) return;

    const camp = game.campFacilities;
    const story = game.story;

    document.getElementById('modal-title').innerHTML = '🏕️ 荒岛营地中枢 · 供需看板与居民排班';
    const body = document.getElementById('modal-body');

    let currentTab = 'dashboard'; // 'dashboard' | 'jobs'

    const render = () => {
      const summary = camp.getSupplyDemandOverview();
      const activeJob = camp.getResidentJob('second_kid');
      const isAuto = camp.isAutoProductionActive;

      const tabsHtml = `
        <div style="display:flex; gap:8px; border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:8px; margin-bottom:12px;">
          <button class="camp-tab-btn ${currentTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard" style="
            flex:1; padding:9px 12px; border-radius:10px; border:none; cursor:pointer; font-weight:900; font-size:13px;
            background:${currentTab === 'dashboard' ? 'linear-gradient(135deg, #00cec9, #0984e3)' : 'rgba(255,255,255,0.06)'};
            color:${currentTab === 'dashboard' ? '#fff' : 'rgba(255,255,255,0.65)'};
            box-shadow:${currentTab === 'dashboard' ? '0 4px 14px rgba(0,206,201,0.3)' : 'none'};
          ">
            📊 供需平衡看板
          </button>
          <button class="camp-tab-btn ${currentTab === 'jobs' ? 'active' : ''}" data-tab="jobs" style="
            flex:1; padding:9px 12px; border-radius:10px; border:none; cursor:pointer; font-weight:900; font-size:13px;
            background:${currentTab === 'jobs' ? 'linear-gradient(135deg, #fdcb6e, #e17055)' : 'rgba(255,255,255,0.06)'};
            color:${currentTab === 'jobs' ? '#fff' : 'rgba(255,255,255,0.65)'};
            box-shadow:${currentTab === 'jobs' ? '0 4px 14px rgba(225,112,85,0.3)' : 'none'};
          ">
            👥 居民岗位排班
          </button>
        </div>
      `;

      let contentHtml = '';

      if (currentTab === 'dashboard') {
        const waterBalColor = summary.waterBalance >= 0 ? '#00b894' : '#ff7675';
        const waterBalTag = summary.waterBalance >= 0 ? '🟢 稳健自给 (盈余)' : '🔴 赤字预警 (需增源)';

        contentHtml = `
          <div style="display:flex; flex-direction:column; gap:12px;">
            <!-- 核心指标四宫格 -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px;">
              <!-- 1. 人口与居所 -->
              <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:14px; padding:12px; display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:11px; color:rgba(255,255,255,0.6);">营地人口 / 床位</span>
                  <span style="font-size:14px;">🛌</span>
                </div>
                <div style="font-size:18px; font-weight:900; color:#fff;">
                  ${summary.population} 人 <span style="font-size:12px; font-weight:700; color:${summary.isBedSufficient ? '#00b894' : '#ff7675'};">(${summary.bedCapacity}/${summary.neededBeds} 床)</span>
                </div>
                <div style="font-size:11px; color:${summary.isBedSufficient ? '#55efc4' : '#fab1a0'};">
                  ${summary.isBedSufficient ? '居所充足 · 效率100%' : '⚠️ 床位不足 · 效率受挫'}
                </div>
              </div>

              <!-- 2. 淡水每日平衡 -->
              <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:14px; padding:12px; display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:11px; color:rgba(255,255,255,0.6);">淡水日供需</span>
                  <span style="font-size:14px;">💧</span>
                </div>
                <div style="font-size:18px; font-weight:900; color:${waterBalColor};">
                  ${summary.waterBalance >= 0 ? '+' : ''}${summary.waterBalance} 份/日
                </div>
                <div style="font-size:11px; color:${waterBalColor};">
                  ${waterBalTag}
                </div>
              </div>

              <!-- 3. 食物储备与日产 -->
              <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:14px; padding:12px; display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:11px; color:rgba(255,255,255,0.6);">干粮总库存</span>
                  <span style="font-size:14px;">🍎</span>
                </div>
                <div style="font-size:18px; font-weight:900; color:#ffeaa7;">
                  ${summary.foodStock} 份
                </div>
                <div style="font-size:11px; color:rgba(255,255,255,0.7);">
                  自律日采: ~${summary.dailyFoodSupply} 份
                </div>
              </div>

              <!-- 4. 海外前哨管辖 -->
              <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:14px; padding:12px; display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:11px; color:rgba(255,255,255,0.6);">海外开拓前哨</span>
                  <span style="font-size:14px;">🚩</span>
                </div>
                <div style="font-size:18px; font-weight:900; color:#00cec9;">
                  ${summary.timberOutpost ? '1 座 (浮木岛)' : '0 座 (待开拓)'}
                </div>
                <div style="font-size:11px; color:${summary.timberOutpost ? '#55efc4' : '#b2bec3'};">
                  ${summary.timberOutpost ? '每日潮汐自动回运' : '乘木筏出海插旗设立'}
                </div>
              </div>
            </div>

            <!-- 淡水供需明细剖析表 -->
            <div style="background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.1); border-radius:14px; padding:12px; display:flex; flex-direction:column; gap:8px;">
              <div style="font-size:13px; font-weight:900; color:#74b9ff; display:flex; align-items:center; gap:6px;">
                <span>💧</span> 每日淡水清算明细账
              </div>
              <div style="display:flex; justify-content:space-between; font-size:12px; color:rgba(255,255,255,0.85); border-bottom:1px dashed rgba(255,255,255,0.1); padding-bottom:5px;">
                <span>🚰 净水滴滤台自然冷凝</span>
                <span style="color:#00b894; font-weight:800;">+${summary.hasPurifier ? 2 : 0} 份/天</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:12px; color:rgba(255,255,255,0.85); border-bottom:1px dashed rgba(255,255,255,0.1); padding-bottom:5px;">
                <span>👧 艾莉·净水维护管工岗位产出</span>
                <span style="color:#00b894; font-weight:800;">+${summary.ellieAwake && activeJob.id === 'water_worker' ? 3 : 0} 份/天</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:12px; color:rgba(255,255,255,0.85); border-bottom:1px dashed rgba(255,255,255,0.1); padding-bottom:5px;">
                <span>👥 居民生存日常消耗 (1份/人)</span>
                <span style="color:#ff7675; font-weight:800;">-${summary.dailyWaterDemand} 份/天</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:900; padding-top:4px;">
                <span>每日净供水平衡：</span>
                <span style="color:${waterBalColor};">${summary.waterBalance >= 0 ? '+' : ''}${summary.waterBalance} 份/天</span>
              </div>
            </div>

            <!-- 海外前哨物流概览 -->
            <div style="background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.1); border-radius:14px; padding:12px; display:flex; flex-direction:column; gap:8px;">
              <div style="font-size:13px; font-weight:900; color:#ffeaa7; display:flex; align-items:center; gap:6px;">
                <span>🚩</span> 海外前哨资源回运网络
              </div>
              <div style="display:flex; flex-direction:column; gap:6px; font-size:12px; color:rgba(255,255,255,0.8); line-height:1.5;">
                ${summary.timberOutpost ? `
                  <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,206,201,0.1); padding:8px 10px; border-radius:8px; border:1px solid rgba(0,206,201,0.2);">
                    <div>
                      <span style="font-weight:900; color:#00cec9;">【浮木前哨站】</span>
                      <span style="color:rgba(255,255,255,0.85);">沉船沙洲洋流顺畅</span>
                    </div>
                    <span style="font-weight:800; color:#55efc4;">每日回运：木板x2、重型方木x1</span>
                  </div>
                ` : `
                  <div style="color:rgba(255,255,255,0.5); font-size:11px;">
                    • 【浮木前哨站】未开拓：前往浮木岛插旗可回运建材。
                  </div>
                `}

                ${summary.quarryOutpost ? `
                  <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(230,126,34,0.12); padding:8px 10px; border-radius:8px; border:1px solid rgba(230,126,34,0.25);">
                    <div>
                      <span style="font-weight:900; color:#e67e22;">【矿石前哨站】</span>
                      <span style="color:rgba(255,255,255,0.85);">火山矿脉稳定开采</span>
                    </div>
                    <span style="font-weight:800; color:#f39c12;">每日回运：富铁矿x2、玄武原石x2</span>
                  </div>
                ` : `
                  <div style="color:rgba(255,255,255,0.5); font-size:11px;">
                    • 【矿石前哨站】未开拓：乘木筏前往海蚀矿石岛插旗可每日回运富铁矿与玄武石。
                  </div>
                `}
              </div>
            </div>
          </div>
        `;
      } else {
        contentHtml = `
          <div style="display:flex; flex-direction:column; gap:10px;">
            <!-- 艾莉卡片 -->
            <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.12); border-radius:14px; padding:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:24px;">👧</span>
                  <div>
                    <div style="font-size:14px; font-weight:900; color:#fff;">幸存少女·艾莉 (Ellie)</div>
                    <div style="font-size:11px; color:rgba(255,255,255,0.6);">
                      ${summary.ellieAwake ? `当前任职：${activeJob.icon} ${activeJob.name}` : '处于脱水昏迷状态，救治苏醒后可委派岗位'}
                    </div>
                  </div>
                </div>
                <span style="font-size:11px; background:rgba(255,221,89,0.2); color:#ffeaa7; padding:3px 8px; border-radius:8px; font-weight:700;">
                  好感羁绊: ${story ? story.secondKidAffection : 0}
                </span>
              </div>

              ${summary.ellieAwake ? `
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:6px;">
                  ${Object.values(camp.jobsConfig).map(job => {
                    const isSelected = activeJob.id === job.id;
                    return `
                      <div class="job-card" data-job="${job.id}" style="
                        background:${isSelected ? 'rgba(0, 206, 201, 0.2)' : 'rgba(255,255,255,0.05)'};
                        border:2px solid ${isSelected ? '#00cec9' : 'rgba(255,255,255,0.1)'};
                        border-radius:10px; padding:8px 10px; cursor:pointer; transition:all 0.15s;
                      ">
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:3px;">
                          <span style="font-weight:900; font-size:12px; color:#fff;">${job.icon} ${job.name}</span>
                          ${isSelected ? '<span style="font-size:10px; background:#00cec9; color:#000; font-weight:900; padding:1px 5px; border-radius:4px;">在任</span>' : ''}
                        </div>
                        <div style="font-size:10.5px; color:rgba(255,255,255,0.7); line-height:1.35;">${job.desc}</div>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : ''}
            </div>

            <!-- 雷蒙德学者卡片 -->
            <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.12); border-radius:14px; padding:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:24px;">👓</span>
                  <div>
                    <div style="font-size:14px; font-weight:900; color:#fff;">探险学者·雷蒙德 (Raymond)</div>
                    <div style="font-size:11px; color:rgba(255,255,255,0.6);">
                      ${summary.isRaymond ? '【工坊技师】每日拂晓精密切削加工【重型方木】与【铁钉】' : '受困于东北海域【浮木岛】沉船沙洲，乘木筏出海展开营救'}
                    </div>
                  </div>
                </div>
                <span style="font-size:11px; color:${summary.isRaymond ? '#00cec9' : '#b2bec3'}; font-weight:800;">
                  ${summary.isRaymond ? '常驻技师' : '待救援'}
                </span>
              </div>
            </div>

            <!-- 巴布伙伴卡片 -->
            <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.12); border-radius:14px; padding:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:24px;">🐒</span>
                  <div>
                    <div style="font-size:14px; font-weight:900; color:#fff;">机灵灵猴·巴布 (Bub)</div>
                    <div style="font-size:11px; color:rgba(255,255,255,0.6);">
                      ${summary.bubFriended ? '随身机敏伙伴 · 每日穿梭林间自动采摘野果与树枝' : '在东侧椰树林徘徊，投喂苹果或烤鱼收服'}
                    </div>
                  </div>
                </div>
                <span style="font-size:11px; color:#00b894; font-weight:800;">
                  ${summary.bubFriended ? '已入队' : '待收服'}
                </span>
              </div>
            </div>
          </div>
        `;
      }

      body.innerHTML = `
        <div style="display:flex; flex-direction:column; width:100%; max-height:65vh; overflow-y:auto; padding:4px;">
          ${tabsHtml}
          ${contentHtml}

          <!-- 底部储物箱快捷入口 -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:10px 14px; border-radius:12px; margin-top:12px;">
            <span style="font-size:12px; color:rgba(255,255,255,0.6);">每日清晨在营地帐篷过夜休息时，结算全岛生产收益</span>
            <button id="btn-open-camp-storage" style="background:#0984e3; border:none; border-radius:8px; padding:7px 16px; color:#fff; font-weight:800; font-size:12px; cursor:pointer;">
              📦 打开营地储物箱 ➔
            </button>
          </div>
        </div>
      `;

      // 绑定 Tab 切换
      body.querySelectorAll('.camp-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          currentTab = btn.getAttribute('data-tab');
          soundEngine.playPlaceFurniture();
          render();
        });
      });

      // 绑定岗位任命
      body.querySelectorAll('.job-card').forEach(el => {
        el.addEventListener('click', () => {
          const jobId = el.getAttribute('data-job');
          camp.assignJob('second_kid', jobId);
          soundEngine.playPlaceFurniture();
          render();
        });
      });

      // 绑定打开储物箱
      const openStorageBtn = body.querySelector('#btn-open-camp-storage');
      if (openStorageBtn) {
        openStorageBtn.addEventListener('click', () => {
          this.closeModal();
          if (game.storageSystem) {
            game.storageSystem.openStorageModal();
          }
        });
      }
    };

    render();
    this.modalBackdrop.style.display = 'flex';
    soundEngine.playPlaceFurniture();
  }

  // 0.5 营地日常交付订单板模态弹窗
  openOrderBoardModal() {
    if (this.player && this.player.resetInput) this.player.resetInput();
    const game = window.__game;
    if (!game || !game.orderBoard) return;

    document.getElementById('modal-title').innerHTML = '📜 营地日常交付订单板 · 商业契约';
    const body = document.getElementById('modal-body');

    const render = () => {
      const orders = game.orderBoard.getOrdersWithStatus();
      const currentDay = game.orderBoard.currentDay;
      const completedCount = game.orderBoard.completedCount;

      let listHtml = '';
      orders.forEach(o => {
        const reqStr = o.reqStatus.map(r => `<span style="color:${r.cur >= r.need ? '#55efc4' : '#ff7675'}; font-weight:700;">${this.getItemName(r.key)}: ${r.cur}/${r.need}</span>`).join('，');
        const canFulfill = o.canFulfill && !o.completed;

        listHtml += `
          <div style="background:rgba(0,0,0,0.3); border:1px solid ${o.completed ? 'rgba(85,239,196,0.3)' : 'rgba(255,255,255,0.1)'}; border-radius:12px; padding:12px; display:flex; justify-content:space-between; align-items:center;">
            <div style="flex:1;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:18px;">${o.icon || '📜'}</span>
                <span style="font-weight:900; color:#fff; font-size:14px;">${o.name}</span>
                <span style="font-size:11px; padding:2px 6px; border-radius:4px; background:rgba(255,255,255,0.08); color:#00cec9;">${o.category === 'minerals' ? '矿脉深研' : o.category === 'crafted' ? '营地构件' : '天然采集'}</span>
              </div>
              <div style="font-size:12px; color:rgba(255,255,255,0.8); margin-top:4px;">${o.desc}</div>
              <div style="font-size:11px; margin-top:6px;">所需资源：${reqStr}</div>
              <div style="font-size:11px; color:#ffeaa7; margin-top:4px; font-weight:800;">奖励：+${o.tokenReward} 算力代币 (SOL)</div>
            </div>
            <div>
              ${o.completed ? `
                <span style="background:rgba(85,239,196,0.2); color:#55efc4; padding:6px 14px; border-radius:8px; font-weight:900; font-size:12px;">✅ 已完成</span>
              ` : `
                <button class="order-deliver-btn" data-order-id="${o.uniqueId}" ${canFulfill ? '' : 'disabled'} style="
                  background:${canFulfill ? 'linear-gradient(135deg, #00cec9, #0984e3)' : 'rgba(255,255,255,0.1)'};
                  color:${canFulfill ? '#fff' : 'rgba(255,255,255,0.4)'};
                  border:none; border-radius:8px; padding:8px 16px; font-weight:800; font-size:12px;
                  cursor:${canFulfill ? 'pointer' : 'not-allowed'};
                ">
                  交付履约
                </button>
              `}
            </div>
          </div>
        `;
      });

      body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px; width:100%; max-height:65vh; overflow-y:auto; padding:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:10px;">
            <span style="font-size:12px; color:rgba(255,255,255,0.8);">📅 第 ${currentDay} 天日常订单（每日清晨重置刷新 3 项契约）</span>
            <span style="font-size:12px; color:#00cec9; font-weight:800;">已累计履约: ${completedCount} 单</span>
          </div>
          ${listHtml}
        </div>
      `;

      body.querySelectorAll('.order-deliver-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-order-id');
          const res = game.orderBoard.deliverOrder(id);
          if (res.ok) {
            render();
          } else {
            this.showToast(res.msg, 'medium');
          }
        });
      });
    };

    render();
    this.modalBackdrop.style.display = 'flex';
    soundEngine.playPlaceFurniture();
  }

  // 1. 小猴伙伴专属协同互动面板
  openMonkeyModal(monkeyHelper) {
    if (this.player && this.player.resetInput) this.player.resetInput();
    document.getElementById('modal-title').innerHTML = '🐒 机灵伙伴·小猴 Bub (Monkey Companion)';
    const body = document.getElementById('modal-body');

    const render = () => {
      const energy = monkeyHelper.energy;
      const affinity = monkeyHelper.affinity;
      const mode = monkeyHelper.mode;
      const inv = this.inventory;

      // 找出背包中可投喂的食物
      const feedableItems = ['apple', 'coconut', 'golden_coconut', 'fish', 'baked_fish', 'cooked_crab', 'sardine', 'smoked_fish']
        .filter(k => (inv[k] || 0) > 0);

      let foodListHtml = '';
      if (feedableItems.length > 0) {
        foodListHtml = feedableItems.map(k => `
          <button class="btn-feed-monkey" data-id="${k}" style="
            background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:10px;
            padding:8px 12px; color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:10px;
          ">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:22px;">${this.getItemIcon(k)}</span>
              <span style="font-size:12.5px; font-weight:700;">${this.getItemName(k)}</span>
            </div>
            <span style="font-size:11.5px; background:rgba(0,206,201,0.25); color:#00cec9; padding:2px 8px; border-radius:6px; font-weight:800;">
              投喂 x1 (余${inv[k]})
            </span>
          </button>
        `).join('');
      } else {
        foodListHtml = `
          <div style="font-size:12px; color:rgba(255,255,255,0.45); padding:10px; text-align:center;">
            🎒 行囊中暂无小猴喜爱的水果或熟食，摇树采摘些红苹果或海岛椰子吧！
          </div>
        `;
      }

      body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px; max-height:65vh; overflow-y:auto; padding:4px;">
          <!-- 伙伴核心属性卡 -->
          <div style="background:linear-gradient(135deg, rgba(225,112,85,0.25), rgba(243,156,18,0.15)); border:1.5px solid #f39c12; border-radius:14px; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:32px;">🐒</span>
                <div>
                  <div style="font-size:16px; font-weight:900; color:#fff;">小猴 Bub</div>
                  <div style="font-size:11px; font-weight:700; color:#f39c12;">
                    ${affinity >= 80 ? '💖 生死相依 · 默契满分' : (affinity >= 50 ? '🌟 亲密伙伴 · 值得信赖' : '🌱 刚刚驯服 · 仍有戒心')}
                  </div>
                </div>
              </div>
              <span style="font-size:11px; background:${mode === 'follow' ? '#00b894' : '#636e72'}; color:#fff; font-weight:900; padding:4px 8px; border-radius:8px;">
                ${mode === 'follow' ? '🐾 跟随探索中' : '💤 原地待命'}
              </span>
            </div>

            <!-- 精力值与亲密度条 -->
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div>
                <div style="display:flex; justify-content:space-between; font-size:11.5px; font-weight:700; color:rgba(255,255,255,0.8); margin-bottom:3px;">
                  <span>⚡ 伙伴精力 (爬树需10，钻缝需15)</span>
                  <span style="color:#00cec9;">${energy} / 100</span>
                </div>
                <div style="height:8px; background:rgba(0,0,0,0.35); border-radius:4px; overflow:hidden;">
                  <div style="width:${energy}%; height:100%; background:linear-gradient(90deg, #00cec9, #0984e3); border-radius:4px;"></div>
                </div>
              </div>

              <div>
                <div style="display:flex; justify-content:space-between; font-size:11.5px; font-weight:700; color:rgba(255,255,255,0.8); margin-bottom:3px;">
                  <span>💖 亲密羁绊 (影响稀有宝物概率与双倍采摘)</span>
                  <span style="color:#ff7675;">${affinity} / 100</span>
                </div>
                <div style="height:8px; background:rgba(0,0,0,0.35); border-radius:4px; overflow:hidden;">
                  <div style="width:${affinity}%; height:100%; background:linear-gradient(90deg, #fd79a8, #e84393); border-radius:4px;"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 专属技能说明 -->
          <div style="background:rgba(255,255,255,0.06); border-radius:12px; padding:12px;">
            <div style="font-size:12.5px; font-weight:900; color:#ffdd59; margin-bottom:8px;">🎯 伙伴协同探险神技</div>
            <div style="font-size:11.5px; line-height:1.6; color:rgba(255,255,255,0.85); display:flex; flex-direction:column; gap:6px;">
              <div>🌲 <strong>高空爬树摇果</strong>：靠近椰子树或果树时按【E】或胶囊，指派小猴蹿上树冠，必落【黄金椰果】与【高枝海鸟蛋】！</div>
              <div>🕳️ <strong>狭窄石缝探宝</strong>：在后山悬崖与海蚀拱门的微光石缝前，指派小猴钻入黑洞搜寻【古代海盗金币】与【藏宝图残页】！</div>
            </div>
          </div>

          <!-- 投喂美食恢复精力 -->
          <div style="background:rgba(255,255,255,0.06); border-radius:12px; padding:12px;">
            <div style="font-size:12.5px; font-weight:900; color:#fff; margin-bottom:8px;">🍽️ 投喂美食恢复精力与好感</div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${foodListHtml}
            </div>
          </div>

          <!-- 底部待命切换 -->
          <button id="btn-toggle-monkey-mode" style="
            background:${mode === 'follow' ? 'rgba(255,255,255,0.12)' : 'linear-gradient(135deg, #00b894, #00cec9)'};
            border:none; border-radius:10px; padding:10px; color:#fff; font-weight:900; font-size:13px; cursor:pointer;
          ">
            ${mode === 'follow' ? '⏸️ 指令：让小猴原地待命休息' : '🐾 指令：跟随我一起探索荒岛'}
          </button>
        </div>
      `;

      // 绑定投喂
      body.querySelectorAll('.btn-feed-monkey').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          monkeyHelper.feedMonkey(id);
          render();
        });
      });

      // 绑定模式切换
      const toggleBtn = body.querySelector('#btn-toggle-monkey-mode');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          monkeyHelper.mode = monkeyHelper.mode === 'follow' ? 'stay' : 'follow';
          haptics.medium();
          soundEngine.playPlaceFurniture();
          this.showToast(monkeyHelper.mode === 'follow' ? '🐾 小猴已进入跟随探索模式！' : '⏸️ 小猴正在原地待命休息！', 'medium');
          render();
        });
      }
    };

    render();
    this.modalBackdrop.style.display = 'flex';
    soundEngine.playItemDrop();
  }

  // 2. 潮汐捕蟹笼管理弹窗
  openCrabTrapModal(tidalTrap) {
    if (this.player && this.player.resetInput) this.player.resetInput();
    document.getElementById('modal-title').innerHTML = '🦀 南岸退潮潮汐捕蟹笼 (Tidal Crab Trap)';
    const body = document.getElementById('modal-body');

    const render = () => {
      const catches = tidalTrap.trapCatches;
      const total = tidalTrap.getTotalCatches();
      const bait = tidalTrap.trapBait;
      const baitCount = tidalTrap.trapBaitCount;
      const inv = this.inventory;

      // 可用诱饵列表
      const baitOptions = ['apple', 'sardine', 'fish', 'tree_bark', 'tree_branch']
        .filter(k => (inv[k] || 0) > 0);

      body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px; max-height:65vh; overflow-y:auto; padding:4px;">
          <!-- 捕获状态大卡片 -->
          <div style="background:linear-gradient(135deg, rgba(9,132,227,0.25), rgba(0,206,201,0.15)); border:1.5px solid #00cec9; border-radius:14px; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div>
                <div style="font-size:16px; font-weight:900; color:#fff;">笼内潮汐渔获 (${total} / ${tidalTrap.maxTrapCapacity})</div>
                <div style="font-size:11px; color:#00cec9;">每退潮一次（约40步）自动起网汇聚海货</div>
              </div>
              <button id="btn-harvest-trap" style="
                background:${total > 0 ? 'linear-gradient(135deg, #00b894, #00cec9)' : 'rgba(255,255,255,0.1)'};
                border:none; border-radius:8px; padding:8px 14px; color:#fff; font-weight:900; font-size:12.5px;
                cursor:${total > 0 ? 'pointer' : 'default'}; box-shadow:${total > 0 ? '0 4px 12px rgba(0,206,201,0.35)' : 'none'};
              " ${total > 0 ? '' : 'disabled'}>
                🎉 一键起笼收获
              </button>
            </div>

            <!-- 渔获明细 -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <div style="background:rgba(0,0,0,0.25); border-radius:10px; padding:8px 10px; display:flex; align-items:center; gap:8px;">
                <span style="font-size:24px;">🦀</span>
                <div>
                  <div style="font-size:12px; font-weight:800; color:#fff;">生猛青花海蟹</div>
                  <div style="font-size:13px; font-weight:900; color:#ff7675;">x${catches.sea_crab || 0} 只</div>
                </div>
              </div>

              <div style="background:rgba(0,0,0,0.25); border-radius:10px; padding:8px 10px; display:flex; align-items:center; gap:8px;">
                <span style="font-size:24px;">🐟</span>
                <div>
                  <div style="font-size:12px; font-weight:800; color:#fff;">银鳞小沙丁鱼</div>
                  <div style="font-size:13px; font-weight:900; color:#74b9ff;">x${catches.sardine || 0} 条</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 诱饵投放卡片 -->
          <div style="background:rgba(255,255,255,0.06); border-radius:12px; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div style="font-size:12.5px; font-weight:900; color:#fff;">🪱 投入诱饵 (提升起获量与稀有度)</div>
              <span style="font-size:11px; color:#f39c12; font-weight:800;">
                ${bait ? `已挂诱饵：${this.getItemName(bait)} (余${baitCount}次)` : '暂无诱饵'}
              </span>
            </div>

            <div style="display:flex; flex-wrap:wrap; gap:6px;">
              ${baitOptions.length > 0 ? baitOptions.map(k => `
                <button class="btn-add-bait" data-id="${k}" style="
                  background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:8px;
                  padding:6px 10px; color:#fff; font-size:12px; cursor:pointer; font-weight:700; display:flex; align-items:center; gap:6px;
                ">
                  <span>${this.getItemIcon(k)}</span>
                  <span>${this.getItemName(k)} (余${inv[k]})</span>
                </button>
              `).join('') : '<div style="font-size:11.5px; color:rgba(255,255,255,0.45);">背包中暂无可用作诱饵的食材或树枝</div>'}
            </div>
          </div>
        </div>
      `;

      // 绑定收获
      const harvestBtn = body.querySelector('#btn-harvest-trap');
      if (harvestBtn) {
        harvestBtn.addEventListener('click', () => {
          tidalTrap.harvestTrap();
          render();
        });
      }

      // 绑定投入诱饵
      body.querySelectorAll('.btn-add-bait').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          tidalTrap.addBait(id);
          render();
        });
      });
    };

    render();
    this.modalBackdrop.style.display = 'flex';
    soundEngine.playSplash();
  }

  // 3. 营地熏鱼晾晒架弹窗
  openSmokerModal(tidalTrap) {
    if (this.player && this.player.resetInput) this.player.resetInput();
    document.getElementById('modal-title').innerHTML = '🔥 营地慢火烟熏风干架 (Camp Food Smoker)';
    const body = document.getElementById('modal-body');

    const render = () => {
      const isSmoking = tidalTrap.isSmoking;
      const progress = Math.min(100, Math.round(tidalTrap.smokeProgress));
      const finished = tidalTrap.finishedItems;
      const inv = this.inventory;

      // 检查背包燃料
      const fuelCount = (inv['tree_bark'] || 0) + (inv['tree_branch'] || 0) + (inv['kindling'] || 0);

      // 可熏烤的生鲜原料
      const rawOptions = ['fish', 'sea_crab', 'sardine', 'crab_meat']
        .filter(k => (inv[k] || 0) > 0);

      body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px; max-height:65vh; overflow-y:auto; padding:4px;">
          <!-- 当前熏制状态卡 -->
          <div style="background:linear-gradient(135deg, rgba(214,48,49,0.25), rgba(225,112,85,0.15)); border:1.5px solid #d63031; border-radius:14px; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div>
                <div style="font-size:16px; font-weight:900; color:#fff;">
                  ${isSmoking ? '🔥 慢火风干烟熏中……' : (finished.length > 0 ? '🎉 熏制熟透完成！' : '💤 炉火已熄灭')}
                </div>
                <div style="font-size:11px; color:#fab1a0;">
                  风干后永久防腐变质 · 远洋航海 1 份抵 2 份常规干粮
                </div>
              </div>

              ${finished.length > 0 ? `
                <button id="btn-collect-smoked" style="
                  background:linear-gradient(135deg, #00b894, #00cec9); border:none; border-radius:8px;
                  padding:8px 14px; color:#fff; font-weight:900; font-size:12.5px; cursor:pointer; box-shadow:0 4px 12px rgba(0,206,201,0.35);
                ">
                  🍱 一键收取熏鱼干
                </button>
              ` : ''}
            </div>

            ${isSmoking ? `
              <div>
                <div style="display:flex; justify-content:space-between; font-size:11.5px; font-weight:700; color:#fff; margin-bottom:3px;">
                  <span>烟熏进度</span>
                  <span style="color:#ff7675;">${progress}%</span>
                </div>
                <div style="height:10px; background:rgba(0,0,0,0.35); border-radius:5px; overflow:hidden;">
                  <div style="width:${progress}%; height:100%; background:linear-gradient(90deg, #d63031, #f39c12); border-radius:5px;"></div>
                </div>
              </div>
            ` : (finished.length > 0 ? `
              <div style="background:rgba(0,0,0,0.25); border-radius:10px; padding:8px 12px; display:flex; align-items:center; gap:8px;">
                <span style="font-size:24px;">🍱</span>
                <span style="font-size:12px; font-weight:800; color:#fff;">
                  已有 ${finished.reduce((s, f) => s + f.count, 0)} 件香喷喷的军粮悬挂在风干梁上！
                </span>
              </div>
            ` : '')}
          </div>

          <!-- 原料投放点火区 -->
          <div style="background:rgba(255,255,255,0.06); border-radius:12px; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div style="font-size:12.5px; font-weight:900; color:#fff;">🐟 放入鲜鱼或生蟹熏烤</div>
              <span style="font-size:11px; color:${fuelCount > 0 ? '#00cec9' : '#ff7675'}; font-weight:800;">
                引火木柴储备：${fuelCount} 份
              </span>
            </div>

            <div style="display:flex; flex-direction:column; gap:6px;">
              ${rawOptions.length > 0 ? rawOptions.map(k => `
                <button class="btn-start-smoke" data-id="${k}" style="
                  background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:10px;
                  padding:8px 12px; color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:space-between;
                " ${isSmoking ? 'disabled' : ''}>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:22px;">${this.getItemIcon(k)}</span>
                    <span style="font-size:12.5px; font-weight:700;">${this.getItemName(k)} (持有${inv[k]})</span>
                  </div>
                  <span style="font-size:11.5px; background:linear-gradient(135deg, #d63031, #e17055); color:#fff; padding:3px 10px; border-radius:6px; font-weight:900;">
                    ${isSmoking ? '正在熏制中' : '🔥 点火熏烤 (消耗1木柴)'}
                  </span>
                </button>
              `).join('') : '<div style="font-size:11.5px; color:rgba(255,255,255,0.45); padding:8px;">行囊中暂无生鱼或海蟹，去南岸捕蟹笼或码头垂钓搜集原料吧！</div>'}
            </div>
          </div>
        </div>
      `;

      // 绑定收取
      const collectBtn = body.querySelector('#btn-collect-smoked');
      if (collectBtn) {
        collectBtn.addEventListener('click', () => {
          tidalTrap.collectFinishedProducts();
          render();
        });
      }

      // 绑定开始熏制
      body.querySelectorAll('.btn-start-smoke').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          tidalTrap.startSmoking(id, 1);
          render();
        });
      });
    };

    render();
    this.modalBackdrop.style.display = 'flex';
    soundEngine.playCooking();
  }

  // --- R8: 矿机共振勘探四个功能页签辅助渲染 ---
  _renderOddsTabHtml(miningRig = window.__game?.miningRig) {
    const o = ODDS_TABLE;
    const num = (key, value) => `<strong data-odds="${key}">${value}</strong>`;
    const pct = n => Number((n * 100).toFixed(6));
    const flows = { main: o.ALPHA, mother: o.MOTHERLODE_SHARE, shard: 1 - o.ALPHA - o.MOTHERLODE_SHARE - o.BURN_SHARE, burn: o.BURN_SHARE };
    const pityRounds = Object.keys(o.PITY_TABLE).map(Number);
    const m = o.MOTHERLODE;
    return `<div style="font-size:12px;line-height:1.8;padding:12px;">
      <p>不承诺任何收益。晶石消耗即为成本；荒岛算力代币为游戏内货币。</p>
      <p>价值基准 V：${num('V', o.V)} 算力代币/份额</p>
      <p>资金流向：主池 ${num('flow-main', pct(flows.main))}% · 母晶池 ${num('flow-mother', pct(flows.mother))}% · 残晶预算 ${num('flow-shard', pct(flows.shard))}% · 销毁 ${num('flow-burn', pct(flows.burn))}%（合计 100%）。</p>
      <p>残晶折算率：${num('shard-rate', o.SHARD_RETURN_RATE)}，每 ${1 / o.SHARD_RETURN_RATE} 残晶折 1 原石；获胜格的八邻格按投入份额返还残晶。</p>
      <p>长期中性回报率参考区间 ${num('rtp-min', pct(o.LONG_TERM_RTP.min))}%–${num('rtp-max', pct(o.LONG_TERM_RTP.max))}%，单轮结果有波动。</p>
      <p>矿机参数：${Object.entries(o.RIG_LEVELS).map(([lv, r]) => `L${lv}：R=${num(`R-${lv}`, r.R)}，单轮硬顶=${num(`cap-${lv}`, r.cap)}`).join('；')}</p>
      <p>晶爆表：${['default', 'buffed'].map(kind => `${kind === 'default' ? '基础' : '蟹煲增益'} E[m]=${num(`em-${kind}`, Number(expectedCritMultiplier(kind === 'buffed').toFixed(6)))}；${o.CRIT_TABLE[kind].map((row, i) => `×${num(`crit-${kind}-${i}-mult`, row.mult)}：${num(`crit-${kind}-${i}-prob`, pct(row.prob))}%`).join('，')}`).join('<br>')}</p>
      <p>矿脉总权重 ${num('weight-total', clusterWeightTotal())}：${Object.entries(o.CLUSTER_WEIGHTS).map(([kind, weight]) => `${{main:'主脉（1 格）',sub:'副脉（2 格）',cold:`冷格（${o.GRID_SIZE - 3} 格）`}[kind]}权重 ${num(`weight-${kind}`, weight)}，理论胜率 ${num(`win-${kind}`, pct(weight / clusterWeightTotal()))}%`).join('；')}</p>
      <p>模拟矿工负载系数：时段 ${Object.entries(o.PHASE_MULTIPLIERS).map(([k,v]) => `${k}=${num(`phase-${k}`,v)}`).join('，')}；天气 ${Object.entries(o.WEATHER_MULTIPLIERS).map(([k,v]) => `${k}=${num(`weather-${k}`,v)}`).join('，')}。</p>
      <p>保底：每轮投入 ≥ ${num('pity-min-shares',o.PITY.minShares)} 份且未中主池，校准值 +1。校准奖概率：${pityRounds.map(r => `第 ${r} 轮 ${num(`pity-${r}`,pct(o.PITY_TABLE[r]))}%`).join('，')}。奖励 ${num('pity-crystals',o.PITY.crystals)} 原石及下一轮满级热力；校准奖不等于主池命中。</p>
      <p>母池：投入 ${num('ml-inject',pct(o.MOTHERLODE_SHARE))}%、消费 ${num('ml-sink',pct(m.sinkShare))}%、超硬顶部分注入；池上限 ${num('ml-cap',o.MAX_MOTHERLODE_POOL)}。命中后检定概率 min(${num('ml-max-prob',m.maxProbability)}, min(${num('ml-base-prob',m.baseMaxProbability)}, 获胜格己方份额/${num('ml-divisor',m.sharesDivisor)}) × 天气系数)，台风系数 ${num('ml-typhoon',m.typhoonMultiplier)}。</p>
      <p>唤醒者独得 ${num('ml-awakener',pct(m.awakenerShare))}%；余下 ${num('ml-shared',pct(m.sharedShare))}% 按获胜格份额分配，模拟矿工所得销毁，其中 ${num('ml-seed',pct(m.seedShare))}% 留作下一池种子。</p>
      <p>母晶池需单轮押注满 5 份方可参与分配。</p>
      <p>本轮种子哈希（cyrb53）：<span data-seed="commit">${miningRig?.resonance.seedCommit || '尚未生成'}</span><br>上一轮种子揭示：<span data-seed="reveal">${miningRig?.resonance.seedReveal || '暂无'}</span></p>
      <p>最近获胜格：${(miningRig?.resonance.history || []).map(r => r.winningSquare + 1).join('、') || '暂无'}</p>
    </div>`;
  }

  _renderMotherlodeTabHtml(miningRig, tokenCount) {
    const ml = miningRig.motherlode || { pool: 0, hallOfFame: [] };
    // Each winning square gets its own conditional awakening check.
    const w = ODDS_TABLE.CLUSTER_WEIGHTS;
    const cl = miningRig.resonance.cluster;
    const estProb = (100 * (miningRig.resonance.deploy || []).reduce((sum, shares, sq) => {
      const weight = cl?.mainIndex === sq ? w.main : cl?.subIndices.includes(sq) ? w.sub : w.cold;
      return sum + weight / clusterWeightTotal() * motherlodeProbability(shares, miningRig.game?.weatherSystem?.currentWeather || 'clear');
    }, 0)).toFixed(2);

    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="background:radial-gradient(circle at center, rgba(153,69,255,0.25) 0%, rgba(10,16,26,0.6) 100%); border:1.5px solid #9945ff; border-radius:14px; padding:16px; text-align:center;">
          <div style="font-size:13px; color:#e056fd; font-weight:800; display:inline-flex; align-items:center; gap:6px; justify-content:center;">${iconHTML('hud/motherlode', 18, { eager: true })} 远古深渊全岛母晶池 (Motherlode)</div>
          <div style="font-size:32px; font-weight:900; color:#ffd32a; font-family:monospace; margin:8px 0; text-shadow:0 0 20px rgba(255,211,42,0.6);">
            <span id="ml-pool-amount">${ml.pool || 0}</span> 🪙
          </div>
          <div style="font-size:11.5px; color:rgba(255,255,255,0.7);">
            当前部署每轮唤醒概率预估（含中签）: <strong style="color:#14f195;">${estProb}%</strong> · 爆池唤醒者独得 <strong>${ODDS_TABLE.MOTHERLODE.awakenerShare * 100}%</strong>！
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.06); border-radius:12px; padding:12px; font-size:11.5px; line-height:1.6; color:rgba(255,255,255,0.8);">
          <div style="font-weight:900; color:#fff; margin-bottom:4px;">💎 母池生态循环账本：</div>
          <div>• 玩家共振投入：<span style="color:#14f195;">${ODDS_TABLE.MOTHERLODE_SHARE * 100}% (${(ODDS_TABLE.MOTHERLODE_SHARE * ODDS_TABLE.V).toFixed(2)} 代币/份额)</span> 自动注入母池</div>
          <div>• 岛上建设消费：<span style="color:#14f195;">${ODDS_TABLE.MOTHERLODE.sinkShare * 100}%</span> (商城、船只升级、扫描仪改装) 注入</div>
          <div>• 单轮超额溢出：超出单轮硬顶派彩全额注入母池</div>
          <div>• 模拟矿工分走部分作为系统 SINK 彻底销毁，绝不伪造虚假中奖播报</div>
        </div>

        <div style="background:rgba(255,255,255,0.06); border-radius:12px; padding:12px;">
          <div style="font-size:12.5px; font-weight:900; color:#fff; margin-bottom:8px;">🏆 远古母脉名人堂 (最近爆池存证)</div>
          ${ml.hallOfFame && ml.hallOfFame.length > 0 ? ml.hallOfFame.map(r => `
            <div style="display:flex; justify-content:space-between; font-size:11px; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
              <span>轮次 #${r.roundId}</span>
              <span style="color:#ffd32a; font-weight:800;">+${r.playerTake} 🪙 (池总: ${r.poolSize})</span>
            </div>
          `).join('') : '<div style="font-size:11px; color:rgba(255,255,255,0.4); text-align:center; padding:10px;">暂无爆池记录，静待首位地脉唤醒勇者！</div>'}
        </div>
      </div>
    `;
  }

  _renderResonanceTabHtml(miningRig, inv, crystalCount, tokenCount) {
    miningRig.ensureResonanceRound();
    const res = miningRig.resonance;
    const levelInfo = ODDS_TABLE.RIG_LEVELS[miningRig.rigLevel] || ODDS_TABLE.RIG_LEVELS[1];
    const k = levelInfo.k;
    const C = levelInfo.C;
    const u = levelInfo.u;
    const progress = Math.min(100, Math.round(res.progress));
    const selectedSq = this._selectedSquare !== undefined ? this._selectedSquare : 12;

    const visibleBoard = res.board ? npcArrival(res.board, res.progress) : new Array(25).fill(0);
    const hints = scannerHints(res.cluster, miningRig.getScannerLevel(), res.roundSeed);

    const phaseLabels = {
      OPEN: '📡 正在部署 (可调整)',
      LOCK: `${iconHTML('hud/lock', 14, { eager: true })} 测算锁定中 (停止部署)`,
      REVEAL: '🌀 地脉揭晓中...',
      SETTLE: `${iconHTML('hud/check', 14, { eager: true })} 结算完成`
    };
    const phaseColors = {
      OPEN: '#14f195',
      LOCK: '#fed330',
      REVEAL: '#9945ff',
      SETTLE: '#00cec9'
    };

    const isReveal = res.phase === 'REVEAL';
    const winningSq = res.lastResult ? res.lastResult.winningSquare : -1;

    let gridHtml = '';
    for (let i = 0; i < 25; i++) {
      const isSelected = (i === selectedSq);
      const myShares = res.deploy[i] || 0;
      const npcShares = Math.round(visibleBoard[i] || 0);
      const ev = estimateSquareEV(visibleBoard, i, myShares > 0 ? myShares : 1, u);

      let isHeat = false;
      let isMainHint = false;
      if (hints) {
        if (hints.level === 1 && hints.squares && hints.squares.includes(i)) isHeat = true;
        if (hints.level === 2 && hints.candidates && hints.candidates.includes(i)) isHeat = true;
        if (hints.level === 3 && hints.heatSquares && hints.heatSquares.includes(i)) {
          isHeat = true;
          if (hints.estimatedMainSquare === i) isMainHint = true;
        }
      }

      const isWinner = (isReveal || res.phase === 'SETTLE') && (i === winningSq);

      gridHtml += `
        <div class="res-grid-cell" data-idx="${i}" style="
          background:${isWinner ? 'radial-gradient(circle, rgba(255,211,42,0.45) 0%, rgba(20,241,149,0.3) 100%)' : (isSelected ? 'rgba(20,241,149,0.22)' : (isHeat ? 'rgba(153,69,255,0.18)' : 'rgba(255,255,255,0.05)'))};
          border:1.5px solid ${isWinner ? '#ffd32a' : (isSelected ? '#14f195' : (isHeat ? '#a29bfe' : 'rgba(255,255,255,0.1)'))};
          box-shadow:${isWinner ? '0 0 16px rgba(255,211,42,0.8)' : (isHeat ? '0 0 10px rgba(153,69,255,0.4)' : 'none')};
          border-radius:8px; padding:6px 4px; display:flex; flex-direction:column; align-items:center; justify-content:space-between;
          height:56px; cursor:pointer; user-select:none; transition:all 0.15s; position:relative;
        ">
          <div style="display:flex; justify-content:space-between; width:100%; font-size:9.5px; color:rgba(255,255,255,0.5);">
            <span>#${i + 1}</span>
            <span>${isMainHint ? '⭐' : (isHeat ? '🔥' : '')}</span>
          </div>
          <div style="font-size:11px; font-weight:900; color:${myShares > 0 ? '#14f195' : '#dfe6e9'};">
            ${myShares > 0 ? `💎 ${myShares} · ` : ''}<span class="npc-shares">${npcShares}<sup>模拟</sup></span>
          </div>
          <div style="font-size:8.5px; color:rgba(255,255,255,0.45);">
            ${isWinner ? '👑获胜' : `EV:${ev}`}
          </div>
        </div>
      `;
    }

    const totalDeployed = res.deploy.reduce((a, b) => a + b, 0);
    const nextScannerLv = miningRig.scannerLevel + 1;
    const hasNextScanner = (inv[`geo_scanner_mk${nextScannerLv}`] || 0) > 0;

    return `
      <div style="display:flex; flex-direction:column; gap:10px;">
        <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.12); border-radius:12px; padding:10px 14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-weight:900; color:#fff; font-size:13px;">轮次 #${res.roundId}</span>
              <span style="font-size:11px; font-weight:800; color:${phaseColors[res.phase] || '#fff'}; background:rgba(0,0,0,0.3); padding:2px 8px; border-radius:6px;">
                ${phaseLabels[res.phase] || res.phase}
              </span>
            </div>
            <div style="font-size:11px; color:#ffeaa7;">
              免费份额: <strong>${res.freeShares}</strong> · 料仓: <strong>${miningRig.loadedCrystals}</strong>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:11px; color:rgba(255,255,255,0.85); background:rgba(255,255,255,0.06); padding:4px 8px; border-radius:8px;">
            <span style="display:inline-flex; align-items:center; gap:4px;" title="全岛母晶池">${iconHTML('hud/motherlode', 14, { eager: true })} 母池: <strong id="mr-motherlode-pool" style="color:#ffd32a;">${miningRig.motherlode?.pool || 0}</strong></span>
            <span style="display:inline-flex; align-items:center; gap:4px;" title="残晶存量">${iconHTML('hud/shard', 14, { eager: true })} 残晶: <strong id="mr-shard-count" style="color:#14f195;">${miningRig.shardCount || 0}</strong></span>
            <span style="display:inline-flex; align-items:center; gap:4px;" title="赛季算力评分">${iconHTML('hud/score_rs', 14, { eager: true })} 算力评分: <strong id="mr-score-rs" style="color:#00cec9;">${miningRig.season?.rs || 0}</strong></span>
          </div>

          <div style="width:100%; height:8px; background:rgba(0,0,0,0.4); border-radius:4px; overflow:hidden; border:1px solid rgba(255,255,255,0.1); margin-bottom:6px;">
            <div id="mr-res-progress-bar" style="width:${progress}%; height:100%; background:linear-gradient(90deg, #9945ff, #14f195); border-radius:4px; transition:width 0.2s linear;"></div>
          </div>

          <div style="display:flex; justify-content:space-between; font-size:10.5px; color:rgba(255,255,255,0.6);">
            <span>进度: <strong id="mr-res-progress-text" style="color:#14f195;">${progress}%</strong> (80% 锁定测算，100% 揭晓)</span>
            ${isReveal ? `<button id="btn-skip-reveal" style="background:#9945ff; color:#fff; border:none; border-radius:6px; padding:2px 8px; font-size:10px; cursor:pointer;" ${res.revealTimer <= 5.5 ? '' : 'disabled'}>⏩ 跳过揭晓动画</button>` : ''}
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:6px;">
          ${gridHtml}
        </div>

        <div style="background:rgba(255,255,255,0.06); border-radius:12px; padding:10px 12px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:12px; font-weight:800; color:#fff;">
              已选格: <span style="color:#14f195;">[${selectedSq + 1}]</span> · 当前投入: <strong style="color:#ffd32a;">${res.deploy[selectedSq] || 0}</strong> 份
            </div>
            <div style="font-size:11px; color:rgba(255,255,255,0.5);">
              格数上限: ${k} · 总额上限: ${C} 份
            </div>
          </div>

          <div style="display:flex; gap:6px; align-items:center;">
            <button id="btn-res-sub" style="background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:8px; width:44px; height:34px; font-size:16px; font-weight:900; cursor:pointer;">-1</button>
            <button id="btn-res-add" style="background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:8px; width:44px; height:34px; font-size:16px; font-weight:900; cursor:pointer;">+1</button>
            <button id="btn-res-split" style="flex:1; background:rgba(0,206,201,0.15); color:#00cec9; border:1px solid rgba(0,206,201,0.3); border-radius:8px; height:34px; font-size:11.5px; font-weight:800; cursor:pointer;">⚖️ 一键均分</button>
            <button id="btn-res-allin" style="flex:1; background:rgba(255,211,42,0.15); color:#ffd32a; border:1px solid rgba(255,211,42,0.3); border-radius:8px; height:34px; font-size:11.5px; font-weight:800; cursor:pointer;">💥 All-In</button>
            <button id="btn-res-commit" style="flex:1.4; background:linear-gradient(135deg, #14f195, #00cec9); color:#0b101b; border:none; border-radius:8px; height:34px; font-size:12px; font-weight:900; cursor:pointer;" ${res.committed || totalDeployed < 2 ? 'disabled' : ''}>
              ${res.committed ? `${iconHTML('hud/check', 14, { eager: true })} 已锁定` : `确认部署 (${totalDeployed}份) · 每轮至少部署 2 份`}
            </button>
          </div>

          ${hasNextScanner ? `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(153,69,255,0.15); border:1px solid rgba(153,69,255,0.3); border-radius:8px; padding:6px 10px; margin-top:2px;">
              <span style="font-size:11px; color:#e056fd;">背包拥有【地质扫描仪 Mk${nextScannerLv}】</span>
              <button id="btn-install-scanner" style="background:linear-gradient(135deg, #9945ff, #14f195); border:none; border-radius:6px; padding:3px 10px; color:#0b101b; font-weight:900; font-size:11px; cursor:pointer;">
                🛠️ 装载 Mk${nextScannerLv}
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  _bindResonanceTabEvents(body, miningRig, inv, render) {
    body.querySelectorAll('.res-grid-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const idx = parseInt(cell.getAttribute('data-idx'), 10);
        this._selectedSquare = idx;
        render();
      });
    });

    const subBtn = body.querySelector('#btn-res-sub');
    if (subBtn) {
      subBtn.addEventListener('click', () => {
        miningRig.placeShares(this._selectedSquare, -1);
        render();
      });
    }

    const addBtn = body.querySelector('#btn-res-add');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const res = miningRig.placeShares(this._selectedSquare, 1);
        if (!res.ok) {
          this.showToast(res.msg, 'medium');
        }
        render();
      });
    }

    const splitBtn = body.querySelector('#btn-res-split');
    if (splitBtn) {
      splitBtn.addEventListener('click', () => {
        const res = miningRig.autoSplitEven();
        if (!res.ok) this.showToast(res.msg, 'medium');
        render();
      });
    }

    const allInBtn = body.querySelector('#btn-res-allin');
    if (allInBtn) {
      allInBtn.addEventListener('click', () => {
        const res = miningRig.allIn(this._selectedSquare);
        if (!res.ok) this.showToast(res.msg, 'medium');
        render();
      });
    }

    const commitBtn = body.querySelector('#btn-res-commit');
    if (commitBtn) {
      commitBtn.addEventListener('click', () => {
        const res = miningRig.commitDeployment();
        if (res.ok) {
          this.showToast(`✅ 成功锁定本轮 ${res.totalShares} 份共振部署！`, 'medium');
        } else {
          this.showToast(res.msg, 'medium');
        }
        render();
      });
    }

    const skipBtn = body.querySelector('#btn-skip-reveal');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        if (miningRig.resonance.revealTimer <= 5.5) {
          miningRig.settleResonanceRound();
          render();
        }
      });
    }

    const installBtn = body.querySelector('#btn-install-scanner');
    if (installBtn) {
      installBtn.addEventListener('click', () => {
        const nextLv = miningRig.scannerLevel + 1;
        const res = miningRig.installScanner(nextLv);
        if (res.ok) render();
        else this.showToast(res.msg, 'medium');
      });
    }
  }

  // --- 基础解密页签渲染与事件绑定 ---
  _renderDecryptTabHtml(miningRig, inv, crystalCount, tokenCount) {
    const isDay = miningRig.isDaytime();
    const progress = Math.min(100, Math.round(miningRig.hashProgress));
    const battery = Math.round(miningRig.batteryPower);
    const isTurbo = miningRig.turboTimer > 0;
    const combo = miningRig.manualTapCombo || 0;
    const turboBonus = isTurbo ? (2.2 + Math.min(combo * 0.08, 1.2)) : 1.0;
    const currentHashrate = (miningRig.hashrate * (isDay ? 1.5 : (battery > 0 ? 1.0 : 0.3)) * turboBonus).toFixed(1);

    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <!-- 1. 核心算力与出块大看板 -->
        <div style="
          background:${isTurbo ? 'linear-gradient(135deg, rgba(255,211,42,0.28), rgba(255,118,117,0.2))' : 'linear-gradient(135deg, rgba(153,69,255,0.22), rgba(20,241,149,0.18))'};
          border:1.5px solid ${isTurbo ? '#ffd32a' : '#14f195'};
          border-radius:14px; padding:14px;
          box-shadow:0 8px 24px ${isTurbo ? 'rgba(255,211,42,0.28)' : 'rgba(20,241,149,0.15)'};
          transition: all 0.25s ease;
        ">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:22px;">${isTurbo ? '🔥' : '⚡'}</span>
                <div style="font-size:16px; font-weight:900; color:#fff;">
                  ${isTurbo ? '⚡ 狂暴超频状态 (OVERDRIVE)' : (miningRig.isActive && miningRig.loadedCrystals > 0 ? (isDay ? '☀️ 太阳能全速哈希运算中' : '🔋 蓄电池储能解密中') : '💤 待料中 (装填原石启动)')}
                </div>
              </div>
              <div style="font-size:11.5px; color:${isTurbo ? '#fed330' : '#14f195'}; margin-top:2px; font-weight:700;">
                运算算力：<span id="mr-hashrate" style="font-size:14px; font-weight:900;">${currentHashrate} MH/s</span> · ${isTurbo ? `🔥 狂暴加速 ${turboBonus.toFixed(1)}x + 45%暴击` : (isDay ? '☀️ 日光加成 +50%' : '🌙 蓄电池供电')}
              </div>
            </div>

            ${miningRig.unclaimedSol > 0 ? `
              <button id="btn-claim-sol" style="
                background:linear-gradient(135deg, #ffd32a, #ff9f1a); border:none; border-radius:10px;
                padding:8px 14px; color:#1e272e; font-weight:900; font-size:12.5px; cursor:pointer;
                box-shadow:0 4px 18px rgba(255,211,42,0.6); animation:pulse 1.2s infinite;
              ">
                🪙 收获 ${miningRig.unclaimedSol} 枚算力代币！
              </button>
            ` : `
              <div style="font-size:11px; background:rgba(0,0,0,0.3); color:rgba(255,255,255,0.6); padding:4px 8px; border-radius:6px;">
                待出块产出
              </div>
            `}
          </div>

          <!-- 当前区块解密进度条 -->
          <div style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; font-size:11px; color:#fff; margin-bottom:4px; font-weight:700;">
              <span>当前区块哈希进度: <strong id="mr-progress-text" style="color:#14f195;">${progress}%</strong></span>
              <span>已验证区块: #${miningRig.totalBlocksMined} (累计挖出 ${miningRig.totalSolMined} 算力代币)</span>
            </div>
            <div style="width:100%; height:12px; background:rgba(0,0,0,0.45); border-radius:6px; overflow:hidden; border:1px solid rgba(255,255,255,0.18); position:relative;">
              <div id="mr-progress-bar" style="
                width:${progress}%; height:100%;
                background:${isTurbo ? 'linear-gradient(90deg, #ff7675, #ffd32a)' : 'linear-gradient(90deg, #9945ff, #14f195)'};
                border-radius:6px; transition:width 0.15s linear;
              "></div>
            </div>
          </div>

          <!-- 矿机硬件核心指标 -->
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
            <div style="background:rgba(0,0,0,0.32); border-radius:8px; padding:6px 8px; text-align:center;">
              <div style="font-size:10.5px; color:rgba(255,255,255,0.6);">晶石装载量</div>
              <div style="font-size:13px; font-weight:900; color:#14f195;">${miningRig.loadedCrystals} / ${miningRig.maxCrystalCapacity} 块</div>
            </div>
            <div style="background:rgba(0,0,0,0.32); border-radius:8px; padding:6px 8px; text-align:center;">
              <div style="font-size:10.5px; color:rgba(255,255,255,0.6);">蓄电池储能</div>
              <div style="font-size:13px; font-weight:900; color:${battery > 20 ? '#00cec9' : '#ff7675'};">${battery}%</div>
            </div>
            <div style="background:rgba(0,0,0,0.32); border-radius:8px; padding:6px 8px; text-align:center;">
              <div style="font-size:10.5px; color:rgba(255,255,255,0.6);">背包算力储备</div>
              <div style="font-size:13px; font-weight:900; color:#fed330;">${tokenCount} 🪙</div>
            </div>
          </div>
        </div>

        <!-- 2. 手动狂暴增压点按核心区 -->
        <div style="
          background:rgba(255,255,255,0.06); border:1.5px dashed ${isTurbo ? '#ffd32a' : 'rgba(255,255,255,0.22)'};
          border-radius:14px; padding:12px; text-align:center; position:relative; overflow:hidden;
        ">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-size:12.5px; font-weight:900; color:#fff;">⚡ 手工手摇增压 · 狂暴解密 (Tap to Boost)</div>
            <div id="mr-combo-badge" style="
              font-size:11px; font-weight:900;
              background:${combo > 5 ? 'linear-gradient(135deg, #ff7675, #d63031)' : 'rgba(255,255,255,0.12)'};
              color:#fff; padding:2px 8px; border-radius:10px;
            ">
              ${combo > 0 ? `COMBO x${combo}` : '待增压'}
            </div>
          </div>

          <button id="btn-manual-boost" style="
            width:100%; height:48px;
            background:${isTurbo ? 'linear-gradient(135deg, #ff9f1a, #ff3838)' : 'linear-gradient(135deg, #9945ff, #14f195)'};
            border:none; border-radius:12px;
            color:#fff; font-size:15px; font-weight:900; letter-spacing:0.5px;
            cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;
            box-shadow:0 6px 20px ${isTurbo ? 'rgba(255,56,56,0.45)' : 'rgba(20,241,149,0.35)'};
            user-select:none; -webkit-user-select:none;
            transition:transform 0.08s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          ">
            <span style="font-size:20px;">⚡</span>
            <span>${isTurbo ? `🔥 极速狂暴增压中 (${miningRig.turboTimer.toFixed(1)}s)` : '猛击摇动加速 · 触发超频！'}</span>
          </button>
          <div style="font-size:11px; color:rgba(255,255,255,0.55); margin-top:6px;">
            连续点按注入机械动能：算力爆发飞涨 + 立即推进解密进度 + 45%概率出块暴击！
          </div>
        </div>

        <!-- 3. 硅晶原石装填区 -->
        <div style="background:rgba(255,255,255,0.06); border-radius:12px; padding:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-size:12.5px; font-weight:900; color:#fff;">💎 装填硅晶原石 (提供运算原料)</div>
            <span style="font-size:11.5px; color:#14f195; font-weight:800;">
              背包持有：${crystalCount} 块
            </span>
          </div>

          <div style="display:flex; gap:8px;">
            <button id="btn-load-1-crystal" style="
              flex:1; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:8px;
              padding:8px 12px; color:#fff; font-size:12px; font-weight:700; cursor:${crystalCount > 0 ? 'pointer' : 'default'};
            " ${crystalCount > 0 ? '' : 'disabled'}>
              ➕ 装填 1 块原石
            </button>
            <button id="btn-load-all-crystals" style="
              flex:1; background:linear-gradient(135deg, rgba(20,241,149,0.3), rgba(153,69,255,0.3)); border:1px solid #14f195;
              border-radius:8px; padding:8px 12px; color:#fff; font-size:12px; font-weight:800; cursor:${crystalCount > 0 ? 'pointer' : 'default'};
            " ${crystalCount > 0 ? '' : 'disabled'}>
              ⚡ 一键填满矿仓
            </button>
          </div>
        </div>

        <!-- 4. 生物质与电池储能维护区 -->
        <div style="background:rgba(255,255,255,0.06); border-radius:12px; padding:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-size:12.5px; font-weight:900; color:#fff;">🔋 蓄能维护 (夜间与阴雨天保障算力)</div>
            <span style="font-size:11px; color:#00cec9;">太阳能板白天免费供电</span>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${(inv['battery'] || 0) > 0 ? `
              <button class="btn-feed-power" data-id="battery" style="
                background:rgba(0,206,201,0.18); border:1px solid #00cec9; border-radius:8px;
                padding:6px 10px; color:#fff; font-size:11.5px; cursor:pointer; font-weight:700;
              ">
                🔋 充入备用电池 (+50%电量)
              </button>
            ` : ''}
            ${(inv['tree_sap'] || 0) > 0 ? `
              <button class="btn-feed-power" data-id="tree_sap" style="
                background:rgba(255,170,0,0.15); border:1px solid #ffa801; border-radius:8px;
                padding:6px 10px; color:#fff; font-size:11.5px; cursor:pointer; font-weight:700;
              ">
                💧 投入树脂生物质 (+25%电量)
              </button>
            ` : ''}
            ${(inv['tree_branch'] || 0) > 0 ? `
              <button class="btn-feed-power" data-id="tree_branch" style="
                background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:8px;
                padding:6px 10px; color:#fff; font-size:11.5px; cursor:pointer; font-weight:700;
              ">
                🥢 投入干燥木柴 (+12%电量)
              </button>
            ` : ''}
          </div>
        </div>

        <!-- 5. Solana 链上算力存证 -->
        <div style="background:linear-gradient(135deg, rgba(153,69,255,0.18), rgba(20,241,149,0.14)); border:1.5px solid #9945ff; border-radius:12px; padding:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-size:12.5px; font-weight:900; color:#fff; display:flex; align-items:center; gap:6px;">
              <span>🔗</span>
              <span>Solana 链上算力存证</span>
            </div>
            <span style="font-size:11px; color:#14f195; font-weight:800; background:rgba(0,0,0,0.3); padding:2px 8px; border-radius:6px;">
              ${solanaBridge.isConnected ? (solanaBridge.isGuestMode ? "免钱包沙盒" : "Seed Vault/钱包已连接") : "未连接钱包"}
            </span>
          </div>
          <div style="font-size:11px; color:#dfe6e9; margin-bottom:8px; line-height:1.4;">
            一键使用 Solana 手机硬件私钥对矿机出块与算力代币产出凭证进行签名，记录至链上成就！
          </div>
          <button id="btn-submit-chain-proof" style="
            width:100%; background:linear-gradient(135deg, #9945ff, #14f195); border:none; border-radius:8px;
            padding:8px 12px; color:#fff; font-size:12px; font-weight:800; cursor:pointer;
            box-shadow:0 4px 12px rgba(153,69,255,0.3);
          ">
            📝 签署算力工作证明上链存证 (区块 #${miningRig.totalBlocksMined})
          </button>
        </div>
      </div>
    `;
  }

  _bindDecryptTabEvents(body, miningRig, inv, render) {
    const boostBtn = body.querySelector('#btn-manual-boost');
    if (boostBtn) {
      boostBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        boostBtn.style.transform = 'scale(0.94)';
        miningRig.triggerManualBoost();
        render();
      });
      boostBtn.addEventListener('pointerup', () => { boostBtn.style.transform = 'scale(1.0)'; });
      boostBtn.addEventListener('pointerleave', () => { boostBtn.style.transform = 'scale(1.0)'; });
    }

    const claimBtn = body.querySelector('#btn-claim-sol');
    if (claimBtn) {
      claimBtn.addEventListener('click', () => {
        miningRig.claimSolTokens();
        render();
      });
    }

    const load1Btn = body.querySelector('#btn-load-1-crystal');
    if (load1Btn) {
      load1Btn.addEventListener('click', () => {
        miningRig.loadCrystal(1);
        render();
      });
    }

    const loadAllBtn = body.querySelector('#btn-load-all-crystals');
    if (loadAllBtn) {
      loadAllBtn.addEventListener('click', () => {
        const avail = Math.min(inv['sol_crystal'] || 0, miningRig.maxCrystalCapacity - miningRig.loadedCrystals);
        if (avail > 0) {
          miningRig.loadCrystal(avail);
          render();
        }
      });
    }

    const proofBtn = body.querySelector('#btn-submit-chain-proof');
    if (proofBtn) {
      proofBtn.addEventListener('click', async () => {
        proofBtn.disabled = true;
        proofBtn.textContent = '⏳ 正在签署算力凭证...';
        try {
          const proof = solanaBridge.submitMiningProof(miningRig.totalBlocksMined, miningRig.totalSolMined);
          if (solanaBridge.isConnected && !solanaBridge.isGuestMode && solanaBridge.signSurvivalCheckin) {
            await solanaBridge.signSurvivalCheckin(miningRig.totalBlocksMined);
          }
          this.showToast(`✅ 算力出块证明已成功签名并存证！已验证区块: #${proof.blocks}，累计: ${proof.totalSol} 算力代币`, 'important');
        } catch (err) {
          this.showToast(`⚠️ 存证提示: ${err.message || err}`, 'medium');
        } finally {
          proofBtn.disabled = false;
          render();
        }
      });
    }

    body.querySelectorAll('.btn-feed-power').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        miningRig.rechargeBattery(id);
        render();
      });
    });
  }

  // 2.5 荒岛绿色矿机 (DePIN Green Mining Rig) 控制台弹窗（R8: 四页签支持）
  openMiningRigModal(miningRig) {
    if (this.player && this.player.resetInput) this.player.resetInput();
    document.getElementById('modal-title').innerHTML = '⛏️ 荒岛绿色矿机 · 算力与共振中枢';
    const body = document.getElementById('modal-body');

    if (this._miningRigTimer) {
      clearInterval(this._miningRigTimer);
      this._miningRigTimer = null;
    }

    this._rigModalTab = this._rigModalTab || 'decrypt';
    this._selectedSquare = this._selectedSquare !== undefined ? this._selectedSquare : 12;

    const render = () => {
      const inv = this.inventory;
      const crystalCount = inv['sol_crystal'] || 0;
      const tokenCount = inv['sol_token'] || 0;
      const currentTab = this._rigModalTab;

      // 顶部四个功能页签（固定顶栏，绝不被 flex 挤压，绝不被内容滚走）
      const tabNavHtml = `
        <div class="rig-tabs-nav" style="display:flex; gap:8px; border-bottom:1px solid rgba(255,255,255,0.15); margin-bottom:10px; padding-bottom:8px; overflow-x:auto; flex-shrink:0 !important; min-height:42px !important;">
          <button class="rig-tab-btn ${currentTab === 'decrypt' ? 'active' : ''}" data-tab="decrypt" type="button" style="
            background:${currentTab === 'decrypt' ? '#14f195' : 'rgba(255,255,255,0.08)'};
            color:${currentTab === 'decrypt' ? '#0b101b' : '#fff'};
            border:none; padding:8px 14px; border-radius:10px; font-weight:900; font-size:12.5px; cursor:pointer;
            white-space:nowrap; flex-shrink:0 !important; min-height:36px !important; height:36px;
            box-shadow:${currentTab === 'decrypt' ? '0 2px 10px rgba(20,241,149,0.35)' : 'none'};
          ">⚡ 基础解密</button>
          <button class="rig-tab-btn ${currentTab === 'resonance' ? 'active' : ''}" data-tab="resonance" type="button" style="
            background:${currentTab === 'resonance' ? '#14f195' : 'rgba(255,255,255,0.08)'};
            color:${currentTab === 'resonance' ? '#0b101b' : '#fff'};
            border:none; padding:8px 14px; border-radius:10px; font-weight:900; font-size:12.5px; cursor:pointer;
            white-space:nowrap; flex-shrink:0 !important; min-height:36px !important; height:36px;
            box-shadow:${currentTab === 'resonance' ? '0 2px 10px rgba(20,241,149,0.35)' : 'none'};
          ">📡 矿脉共振</button>
          <button class="rig-tab-btn ${currentTab === 'motherlode' ? 'active' : ''}" data-tab="motherlode" type="button" style="
            background:${currentTab === 'motherlode' ? '#14f195' : 'rgba(255,255,255,0.08)'};
            color:${currentTab === 'motherlode' ? '#0b101b' : '#fff'};
            border:none; padding:8px 14px; border-radius:10px; font-weight:900; font-size:12.5px; cursor:pointer;
            white-space:nowrap; flex-shrink:0 !important; min-height:36px !important; height:36px;
            box-shadow:${currentTab === 'motherlode' ? '0 2px 10px rgba(20,241,149,0.35)' : 'none'};
          ">${iconHTML('hud/motherlode', 14, { eager: true })} 母晶池</button>
          <button class="rig-tab-btn ${currentTab === 'odds' ? 'active' : ''}" data-tab="odds" type="button" style="
            background:${currentTab === 'odds' ? '#14f195' : 'rgba(255,255,255,0.08)'};
            color:${currentTab === 'odds' ? '#0b101b' : '#fff'};
            border:none; padding:8px 14px; border-radius:10px; font-weight:900; font-size:12.5px; cursor:pointer;
            white-space:nowrap; flex-shrink:0 !important; min-height:36px !important; height:36px;
            box-shadow:${currentTab === 'odds' ? '0 2px 10px rgba(20,241,149,0.35)' : 'none'};
          ">📜 概率公示</button>
        </div>
      `;

      let contentHtml = '';
      if (currentTab === 'decrypt') {
        contentHtml = this._renderDecryptTabHtml(miningRig, inv, crystalCount, tokenCount);
      } else if (currentTab === 'resonance') {
        contentHtml = this._renderResonanceTabHtml(miningRig, inv, crystalCount, tokenCount);
      } else if (currentTab === 'motherlode') {
        contentHtml = this._renderMotherlodeTabHtml(miningRig, tokenCount);
      } else if (currentTab === 'odds') {
        miningRig.ensureResonanceRound();
        contentHtml = this._renderOddsTabHtml(miningRig);
      }

      body.innerHTML = `
        <div style="display:flex; flex-direction:column; height:100%; max-height:calc(100vh - 80px); overflow:hidden; padding:2px;">
          ${tabNavHtml}
          <div style="flex:1; overflow-y:auto; min-height:0; padding-right:2px;">
            <div style="font-size:11px;padding:4px;">其他矿工均为模拟矿工（非真人）</div>
            ${['decrypt', 'resonance'].includes(currentTab) ? `<button id="btn-rig-upgrade" ${!ODDS_TABLE.UPGRADE_COSTS[miningRig.rigLevel + 1] || tokenCount < ODDS_TABLE.UPGRADE_COSTS[miningRig.rigLevel + 1] ? 'disabled' : ''}>${ODDS_TABLE.UPGRADE_COSTS[miningRig.rigLevel + 1] ? `升级矿机 L${miningRig.rigLevel + 1} · ${ODDS_TABLE.UPGRADE_COSTS[miningRig.rigLevel + 1]} 算力代币` : '矿机已满级'}</button>` : ''}
            ${contentHtml}
          </div>
        </div>
      `;

      const upgradeBtn = body.querySelector('#btn-rig-upgrade');
      if (upgradeBtn) upgradeBtn.onclick = () => { const result = miningRig.upgradeRig(); if (!result.ok) this.showToast(result.msg, 'medium'); render(); };
      // 绑定页签切换
      body.querySelectorAll('.rig-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this._rigModalTab = btn.getAttribute('data-tab');
          if (this._rigModalTab === 'resonance') {
            miningRig.setMode('resonance');
          } else if (this._rigModalTab === 'decrypt') {
            miningRig.setMode('decrypt');
          }
          render();
        });
      });

      // 绑定具体页签事件
      if (currentTab === 'decrypt') {
        this._bindDecryptTabEvents(body, miningRig, inv, render);
      } else if (currentTab === 'resonance') {
        this._bindResonanceTabEvents(body, miningRig, inv, render);
      }
    };

    render();

    // 开启高频轻量实时同步 (每 200ms 同步进度条与状态)
    this._miningRigTimer = setInterval(() => {
      if (!this.modalBackdrop || this.modalBackdrop.style.display === 'none') {
        clearInterval(this._miningRigTimer);
        this._miningRigTimer = null;
        return;
      }
      if (this._rigModalTab === 'decrypt') {
        const p = Math.min(100, Math.round(miningRig.hashProgress));
        const pBar = body.querySelector('#mr-progress-bar');
        const pTxt = body.querySelector('#mr-progress-text');
        if (pBar) pBar.style.width = `${p}%`;
        if (pTxt) pTxt.textContent = `${p}%`;
      } else if (this._rigModalTab === 'resonance') {
        const p = Math.min(100, Math.round(miningRig.resonance.progress));
        const rBar = body.querySelector('#mr-res-progress-bar');
        const rTxt = body.querySelector('#mr-res-progress-text');
        if (rBar) rBar.style.width = `${p}%`;
        if (rTxt) rTxt.textContent = `${p}%`;

        const mrPoolEl = body.querySelector('#mr-motherlode-pool');
        if (mrPoolEl) mrPoolEl.textContent = `${miningRig.motherlode?.pool || 0}`;
        const mrShardEl = body.querySelector('#mr-shard-count');
        if (mrShardEl) mrShardEl.textContent = `${miningRig.shardCount || 0}`;
        const mrRsEl = body.querySelector('#mr-score-rs');
        if (mrRsEl) mrRsEl.textContent = `${miningRig.season?.rs || 0}`;

        // REVEAL 阶段更新跳过按钮状态 (2.0s 后方可跳过)
        if (miningRig.resonance.phase === 'REVEAL') {
          const skipBtn = body.querySelector('#btn-skip-reveal');
          if (skipBtn) {
            const canSkip = miningRig.resonance.revealTimer <= 5.5; // 7.5 - 2.0 = 5.5
            skipBtn.disabled = !canSkip;
            skipBtn.textContent = canSkip ? '⏩ 跳过揭晓动画' : `⏳ 正在测算揭晓 (${miningRig.resonance.revealTimer.toFixed(1)}s)`;
          }
        }
      } else if (this._rigModalTab === 'motherlode') {
        const poolEl = body.querySelector('#ml-pool-amount');
        if (poolEl) poolEl.textContent = `${miningRig.motherlode.pool}`;
      }
    }, 200);

    this.modalBackdrop.style.display = 'flex';
    soundEngine.playItemDrop();
  }

  // 3. 营地随行异兽暖巢与多宠物出战中枢
  openPetCompanionModal(petCompanion) {
    if (this.player && this.player.resetInput) this.player.resetInput();
    document.getElementById('modal-title').innerHTML = '🐾 营地异兽暖巢 · 随行伙伴与特权中枢';
    const body = document.getElementById('modal-body');

    const render = () => {
      const inv = this.inventory;
      const coinCount = inv['ancient_coin'] || 0;
      const activePetId = petCompanion.activePetId;
      const petCatalog = Object.values(window.__PET_CATALOG || {
        bub_monkey: { id: 'bub_monkey', name: '机灵小猴·巴布', icon: '🐒', badge: '敏捷探险', priceCoins: 0, priceSOL: 0, perks: ['高空爬树摇果', '岩缝钻穴探宝', '果实掉落率+25%'], desc: '攀爬椰树摇下黄金椰与鸟蛋，钻入石缝搜寻古代金币' },
        bella_dog: { id: 'bella_dog', name: '忠诚猎犬·贝拉', icon: '🐕', badge: '护卫嗅探', priceCoins: 180, priceSOL: 0.15, perks: ['野兽免伤20%', '地脉嗅探高亮', '战斗咆哮硬直'], desc: '侦测深埋宝藏，野兽突袭咆哮震慑，提供野兽伤害永久减免 20%' },
        raymond_cat: { id: 'raymond_cat', name: '海月玄猫·雷蒙德', icon: '🐱', badge: '浅滩捕捞', priceCoins: 240, priceSOL: 0.20, perks: ['浅滩自动叼鱼', '黑夜夜视光环', '钓鱼咬钩提速35%'], desc: '浅滩自动叼捕鲜鱼海蟹，入夜散发柔和夜视暖光，大幅加快咬钩速度' },
        dom_sheep: { id: 'dom_sheep', name: '暖绒金羊·多姆', icon: '🐑', badge: '随行驮载', priceCoins: 150, priceSOL: 0.12, perks: ['专属6格驮袋', '奔跑疲劳累积-50%', '全地形移速+10%'], desc: '随行额外 6 格独立移动货仓，奔跑疲劳累积减半，移速提升 +10%' }
      });

      // 背包中可投喂的食物
      const feedableItems = ['apple', 'coconut', 'golden_coconut', 'fish', 'baked_fish', 'cooked_crab', 'sardine', 'smoked_fish']
        .filter(k => (inv[k] || 0) > 0);

      body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px; max-height:68vh; overflow-y:auto; padding:4px;">
          <!-- 顶部状态指示栏 -->
          <div style="background:rgba(0,0,0,0.25); border-radius:12px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:20px;">🪙</span>
              <span style="font-size:12.5px; color:rgba(255,255,255,0.85); font-weight:700;">
                古代海盗金币：<strong style="color:#ffd32a; font-size:14px;">${coinCount}</strong> 枚
              </span>
            </div>
            <button id="btn-pet-open-shop" style="
              background:linear-gradient(90deg, #9945FF, #14F195); border:none; border-radius:8px;
              color:#000; font-weight:900; font-size:11.5px; padding:5px 12px; cursor:pointer;
            ">
              🛒 特权无线电空投
            </button>
          </div>

          <!-- 四大神宠展示列表 -->
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${petCatalog.map(pet => {
              const unlocked = petCompanion.isUnlocked(pet.id);
              const isActive = (activePetId === pet.id);
              const state = petCompanion.petStates[pet.id] || { energy: 100, affinity: 70 };

              return `
                <div style="
                  background:${isActive ? 'rgba(0, 184, 148, 0.12)' : (unlocked ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.3)')};
                  border:1.5px solid ${isActive ? '#00cec9' : (unlocked ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)')};
                  border-radius:14px; padding:12px 14px; display:flex; flex-direction:column; gap:8px;
                ">
                  <!-- 宠物标头 -->
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                      <span style="font-size:30px;">${pet.icon}</span>
                      <div>
                        <div style="display:flex; align-items:center; gap:6px;">
                          <span style="font-size:15px; font-weight:900; color:#fff;">${pet.name}</span>
                          <span style="font-size:10.5px; background:rgba(255,255,255,0.12); color:#dfe6e9; padding:1px 6px; border-radius:4px; font-weight:700;">
                            ${pet.badge}
                          </span>
                        </div>
                        <div style="font-size:11px; color:rgba(255,255,255,0.6); margin-top:2px;">
                          ${pet.desc}
                        </div>
                      </div>
                    </div>

                    <!-- 右侧出战状态或操作按钮 -->
                    <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                      ${isActive ? `
                        <span style="background:rgba(0,206,201,0.25); border:1px solid #00cec9; color:#55efc4; padding:5px 10px; border-radius:8px; font-size:11.5px; font-weight:900;">
                          ✅ 当前出战
                        </span>
                        ${pet.id === 'dom_sheep' ? `
                          <button id="btn-quick-pouch" style="background:linear-gradient(135deg, #f1c40f, #e67e22); border:none; border-radius:8px; color:#000; font-weight:900; font-size:11px; padding:5px 9px; cursor:pointer;">
                            🎒 驮袋
                          </button>
                        ` : ''}
                      ` : (unlocked ? `
                        <button class="btn-switch-pet" data-id="${pet.id}" style="
                          background:linear-gradient(135deg, #0984e3, #00cec9); border:none; border-radius:8px;
                          color:#fff; font-weight:900; font-size:11.5px; padding:6px 14px; cursor:pointer;
                        ">
                          🐾 出战随行
                        </button>
                      ` : `
                        <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
                          <button class="btn-unlock-coin" data-id="${pet.id}" ${coinCount >= pet.priceCoins ? '' : 'disabled'} style="
                            background:${coinCount >= pet.priceCoins ? 'linear-gradient(135deg, #f39c12, #e67e22)' : 'rgba(255,255,255,0.08)'};
                            border:none; border-radius:7px; color:${coinCount >= pet.priceCoins ? '#000' : 'rgba(255,255,255,0.4)'};
                            font-weight:900; font-size:11px; padding:5px 10px; cursor:${coinCount >= pet.priceCoins ? 'pointer' : 'not-allowed'};
                          ">
                            🪙 ${pet.priceCoins} 金币结缘
                          </button>
                          <button class="btn-unlock-sol" data-id="${pet.id}" style="
                            background:linear-gradient(135deg, #9945FF, #14F195); border:none; border-radius:7px;
                            color:#000; font-weight:900; font-size:10.5px; padding:4px 8px; cursor:pointer;
                          ">
                            ⚡ ${pet.priceSOL} SOL 空投
                          </button>
                        </div>
                      `)}
                    </div>
                  </div>

                  <!-- 特权三连标签 -->
                  <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:2px;">
                    ${pet.perks.map(perk => `
                      <span style="font-size:10.5px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08); color:#feca57; padding:2px 8px; border-radius:6px; font-weight:700;">
                        ${perk}
                      </span>
                    `).join('')}
                  </div>

                  <!-- 若已解锁，显示精力与亲密条 -->
                  ${unlocked ? `
                    <div style="background:rgba(0,0,0,0.25); border-radius:8px; padding:6px 10px; display:flex; justify-content:space-between; align-items:center; font-size:11px; color:rgba(255,255,255,0.75);">
                      <span>⚡ 精力: <strong style="color:#00cec9;">${state.energy}/100</strong></span>
                      <span>💖 亲密羁绊: <strong style="color:#ff7675;">${state.affinity}/100</strong></span>
                      <button class="btn-toggle-feed-panel" data-id="${pet.id}" style="background:rgba(255,255,255,0.12); border:none; border-radius:5px; color:#fff; font-size:10px; padding:2px 7px; cursor:pointer;">
                        🍽️ 投喂
                      </button>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>

          <!-- 展开投喂抽屉区 -->
          <div id="pet-feed-drawer" style="display:none; background:rgba(255,255,255,0.06); border-radius:12px; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span id="pet-feed-target-name" style="font-size:12.5px; font-weight:900; color:#fff;">🍽️ 投喂美食</span>
              <button id="btn-close-feed-drawer" style="background:transparent; border:none; color:rgba(255,255,255,0.6); cursor:pointer;">✕</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${feedableItems.length > 0 ? feedableItems.map(k => `
                <button class="btn-feed-target" data-food="${k}" style="
                  background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:8px;
                  padding:6px 10px; color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:space-between;
                ">
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:18px;">${this.getItemIcon(k)}</span>
                    <span style="font-size:12px; font-weight:700;">${this.getItemName(k)}</span>
                  </div>
                  <span style="font-size:11px; color:#00cec9; font-weight:800;">投喂 x1 (余${inv[k]})</span>
                </button>
              `).join('') : '<div style="font-size:11.5px; color:rgba(255,255,255,0.45); padding:6px;">行囊中暂无可食用水果或烤鱼</div>'}
            </div>
          </div>
        </div>
      `;

      // 绑定打开商城
      const shopBtn = body.querySelector('#btn-pet-open-shop');
      if (shopBtn) {
        shopBtn.addEventListener('click', () => {
          this.closeModal();
          if (this.game && this.game.shopManager) this.game.shopManager.open();
          else this.openShopModal();
        });
      }

      // 绑定出战切换
      body.querySelectorAll('.btn-switch-pet').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          petCompanion.setActivePet(id);
          render();
        });
      });

      // 绑定金币解锁
      body.querySelectorAll('.btn-unlock-coin').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const res = petCompanion.unlockWithCoins(id);
          if (res.ok) {
            petCompanion.setActivePet(id);
            this.showToast(res.msg, 'medium');
          } else {
            this.showToast(`⚠️ ${res.msg}`, 'medium');
          }
          render();
        });
      });

      // 绑定 Solana 特权直接结账解锁
      body.querySelectorAll('.btn-unlock-sol').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          this.closeModal();
          if (this.game && this.game.shopManager) {
            this.game.shopManager.open();
          } else {
            petCompanion.unlockWithSol(id);
            this.showToast(`⚡ 成功激活【${petCompanion.getPetSpec(id).name}】随行特权！`, 'medium');
          }
        });
      });

      // 绑定金羊驮袋快捷入口
      const quickPouchBtn = body.querySelector('#btn-quick-pouch');
      if (quickPouchBtn) {
        quickPouchBtn.addEventListener('click', () => {
          this.openSheepPouchModal(petCompanion);
        });
      }

      // 绑定投喂抽屉
      let currentFeedingPetId = null;
      const feedDrawer = body.querySelector('#pet-feed-drawer');
      const feedTargetTitle = body.querySelector('#pet-feed-target-name');

      body.querySelectorAll('.btn-toggle-feed-panel').forEach(btn => {
        btn.addEventListener('click', () => {
          currentFeedingPetId = btn.getAttribute('data-id');
          const spec = petCompanion.getPetSpec(currentFeedingPetId);
          if (feedDrawer && spec) {
            feedDrawer.style.display = 'block';
            feedTargetTitle.textContent = `🍽️ 正在投喂：${spec.name}`;
          }
        });
      });

      const closeDrawerBtn = body.querySelector('#btn-close-feed-drawer');
      if (closeDrawerBtn && feedDrawer) {
        closeDrawerBtn.addEventListener('click', () => {
          feedDrawer.style.display = 'none';
        });
      }

      body.querySelectorAll('.btn-feed-target').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!currentFeedingPetId) return;
          const foodKey = btn.getAttribute('data-food');
          const res = petCompanion.feedPet(currentFeedingPetId, foodKey);
          if (res.ok) {
            this.showToast(res.msg, 'medium');
          }
          render();
        });
      });
    };

    render();
    this.modalBackdrop.style.display = 'flex';
    soundEngine.playItemDrop();
  }

  // 4. 暖绒金羊专属随行驮袋管理弹窗 (6格独立移动货仓)
  openSheepPouchModal(petCompanion) {
    if (this.player && this.player.resetInput) this.player.resetInput();
    document.getElementById('modal-title').innerHTML = '🐑 暖绒金羊·随行专属驮袋 (Dom\'s Cargo Pouch)';
    const body = document.getElementById('modal-body');

    const render = () => {
      const pouch = petCompanion.sheepPouchInventory;
      const pouchCount = Object.keys(pouch).length;
      const inv = this.inventory;
      const invKeys = Object.keys(inv).filter(k => (inv[k] || 0) > 0);

      body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px; max-height:68vh; overflow-y:auto; padding:4px;">
          <!-- 驮袋简介 -->
          <div style="background:rgba(241, 196, 15, 0.12); border:1px solid #f1c40f; border-radius:12px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:14px; font-weight:900; color:#fff;">🐑 随行移动货仓 · 6格上限</div>
              <div style="font-size:11.5px; color:rgba(255,255,255,0.65); margin-top:2px;">
                金羊贴身驮载，轻装前进！点击背包物品存入，点击驮袋物品取回。
              </div>
            </div>
            <span style="font-size:13px; font-weight:900; color:#ffd32a; font-family:monospace;">
              ${pouchCount} / 6 格
            </span>
          </div>

          <!-- 驮袋内物品区 -->
          <div style="background:rgba(255,255,255,0.06); border-radius:12px; padding:12px;">
            <div style="font-size:12.5px; font-weight:900; color:#00cec9; margin-bottom:8px;">📦 驮袋内现存物资 (点击取出到背包)</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:8px;">
              ${pouchCount > 0 ? Object.keys(pouch).map(k => `
                <button class="btn-withdraw-pouch" data-id="${k}" style="
                  background:rgba(0,0,0,0.35); border:1px solid rgba(0,206,201,0.3); border-radius:10px;
                  padding:8px; color:#fff; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px;
                ">
                  <span style="font-size:24px;">${this.getItemIcon(k)}</span>
                  <span style="font-size:12px; font-weight:700;">${this.getItemName(k)}</span>
                  <span style="font-size:11px; color:#55efc4; font-weight:900;">x${pouch[k]}</span>
                </button>
              `).join('') : '<div style="font-size:12px; color:rgba(255,255,255,0.4); padding:10px; grid-column:1/-1; text-align:center;">驮袋目前空空如也，从下方背包中存入物资吧！</div>'}
            </div>
          </div>

          <!-- 主角背包物品区 (存入源) -->
          <div style="background:rgba(255,255,255,0.06); border-radius:12px; padding:12px;">
            <div style="font-size:12.5px; font-weight:900; color:#ffd32a; margin-bottom:8px;">🎒 主角随身背包 (点击存入金羊驮袋)</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:8px;">
              ${invKeys.length > 0 ? invKeys.map(k => `
                <button class="btn-deposit-pouch" data-id="${k}" style="
                  background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.12); border-radius:10px;
                  padding:8px; color:#fff; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px;
                ">
                  <span style="font-size:24px;">${this.getItemIcon(k)}</span>
                  <span style="font-size:12px; font-weight:700;">${this.getItemName(k)}</span>
                  <span style="font-size:11px; color:#ffd32a; font-weight:900;">x${inv[k]}</span>
                </button>
              `).join('') : '<div style="font-size:12px; color:rgba(255,255,255,0.4); padding:10px; grid-column:1/-1; text-align:center;">随身背包暂无可转移物品</div>'}
            </div>
          </div>
        </div>
      `;

      // 绑定取出
      body.querySelectorAll('.btn-withdraw-pouch').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          petCompanion.withdrawFromSheepPouch(id, 1);
          render();
        });
      });

      // 绑定存入
      body.querySelectorAll('.btn-deposit-pouch').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          petCompanion.depositToSheepPouch(id, 1);
          render();
        });
      });
    };

    render();
    this.modalBackdrop.style.display = 'flex';
    soundEngine.playItemDrop();
  }

  // 关闭当前打开的通用模态弹窗
  closeModal() {
    if (this.modalBackdrop) {
      this.modalBackdrop.style.display = 'none';
    }
  }

  isEdible(id) {
    return ['apple', 'coconut', 'fish', 'baked_fish', 'baked_apple', 'canteen_clean_water', 'raw_meat', 'cooked_meat', 'crab_meat', 'cooked_crab', 'large_backpack', 'beast_trap', 'wooden_spikes', 'golden_coconut', 'bird_egg', 'sea_crab', 'sardine', 'smoked_fish', 'bone_armor', 'herbal_paste', 'energy_drink', 'bamboo_canteen', 'fire_arrow'].includes(id);
  }

  getItemStatPills(id) {
    if (id === 'apple') {
      return '<span class="stat-pill" style="background:rgba(255,107,129,0.25); color:#ff6b81;">🍗 饥饿+20</span><span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">❤️ 生命+5</span>';
    } else if (id === 'coconut') {
      return '<span class="stat-pill" style="background:rgba(255,107,129,0.25); color:#ff6b81;">🍗 饥饿+15</span><span class="stat-pill" style="background:rgba(0,206,201,0.25); color:#00cec9;">💧 饮水+25</span><span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">❤️ 生命+8</span>';
    } else if (id === 'golden_coconut') {
      return '<span class="stat-pill" style="background:rgba(255,215,0,0.3); color:#ffd700;">🍗 饥饿+45</span><span class="stat-pill" style="background:rgba(0,206,201,0.25); color:#00cec9;">💧 饮水+50</span><span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">❤️ 生命+25</span><span class="stat-pill" style="background:rgba(254,202,87,0.3); color:#feca57;">⚡ 疲劳清空</span>';
    } else if (id === 'bird_egg') {
      return '<span class="stat-pill" style="background:rgba(255,107,129,0.25); color:#ff6b81;">🍗 饥饿+30</span><span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">❤️ 生命+15</span>';
    } else if (id === 'sea_crab') {
      return '<span class="stat-pill" style="background:rgba(255,107,129,0.25); color:#ff6b81;">🍗 饥饿+25</span><span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">❤️ 生命+8</span>';
    } else if (id === 'sardine') {
      return '<span class="stat-pill" style="background:rgba(255,107,129,0.25); color:#ff6b81;">🍗 饥饿+20</span><span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">❤️ 生命+6</span>';
    } else if (id === 'smoked_fish') {
      return '<span class="stat-pill" style="background:rgba(255,107,129,0.25); color:#ff6b81;">🍗 饥饿+80</span><span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">❤️ 生命+35</span><span class="stat-pill" style="background:rgba(254,202,87,0.25); color:#feca57;">⚡ 疲劳-25</span><span class="stat-pill" style="background:rgba(0,206,201,0.25); color:#00cec9;">⛵ 远航双倍军粮</span>';
    } else if (id === 'fish') {
      return '<span class="stat-pill" style="background:rgba(255,107,129,0.25); color:#ff6b81;">🍗 饥饿+25</span><span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">❤️ 生命+8</span>';
    } else if (id === 'baked_fish') {
      return '<span class="stat-pill" style="background:rgba(255,107,129,0.25); color:#ff6b81;">🍗 饥饿+65</span><span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">❤️ 生命+25</span><span class="stat-pill" style="background:rgba(254,202,87,0.25); color:#feca57;">⚡ 疲劳-15</span>';
    } else if (id === 'baked_apple') {
      return '<span class="stat-pill" style="background:rgba(255,107,129,0.25); color:#ff6b81;">🍗 饥饿+35</span><span class="stat-pill" style="background:rgba(0,206,201,0.25); color:#00cec9;">💧 饮水+10</span><span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">❤️ 生命+15</span>';
    } else if (id === 'raw_meat') {
      return '<span class="stat-pill" style="background:rgba(255,107,129,0.25); color:#ff6b81;">🍗 饥饿+30</span><span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">❤️ 生命+5</span>';
    } else if (id === 'cooked_meat') {
      return '<span class="stat-pill" style="background:rgba(255,107,129,0.25); color:#ff6b81;">🍗 饥饿+75</span><span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">❤️ 生命+35</span><span class="stat-pill" style="background:rgba(254,202,87,0.25); color:#feca57;">⚡ 疲劳-20</span>';
    } else if (id === 'crab_meat') {
      return '<span class="stat-pill" style="background:rgba(255,107,129,0.25); color:#ff6b81;">🍗 饥饿+25</span><span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">❤️ 生命+8</span>';
    } else if (id === 'cooked_crab') {
      return '<span class="stat-pill" style="background:rgba(255,107,129,0.25); color:#ff6b81;">🍗 饥饿+55</span><span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">❤️ 生命+25</span><span class="stat-pill" style="background:rgba(254,202,87,0.25); color:#feca57;">⚡ 疲劳-10</span>';
    } else if (id === 'spear') {
      return '<span class="stat-pill" style="background:rgba(225,112,85,0.25); color:#e17055;">🗡️ 刺击伤害 38</span><span class="stat-pill" style="background:rgba(0,206,201,0.25); color:#00cec9;">📏 突刺距离 3.2米</span>';
    } else if (id === 'wooden_bow') {
      return '<span class="stat-pill" style="background:rgba(243,156,18,0.25); color:#f39c12;">🏹 远程贯穿 28</span><span class="stat-pill" style="background:rgba(0,206,201,0.25); color:#00cec9;">🎯 有效射程 20米</span><span class="stat-pill" style="background:rgba(155,89,182,0.25); color:#9b59b6;">⚡ 远距引怪仇恨</span>';
    } else if (id === 'flint_arrow') {
      return '<span class="stat-pill" style="background:rgba(241,196,15,0.25); color:#f1c40f;">🎯 弓箭专属弹药</span><span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">🏹 50% 落地回收</span>';
    } else if (id === 'fire_arrow') {
      return '<span class="stat-pill" style="background:rgba(231,76,60,0.25); color:#e74c3c;">🔥 爆燃灼烧伤害</span><span class="stat-pill" style="background:rgba(243,156,18,0.25); color:#f39c12;">🏹 远程爆破</span>';
    } else if (id === 'bone_armor') {
      return '<span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">❤️ 生命上限 +25</span><span class="stat-pill" style="background:rgba(155,89,182,0.25); color:#9b59b6;">🛡️ 冲撞霸体抗性</span>';
    } else if (id === 'herbal_paste') {
      return '<span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">❤️ 恢复生命 45</span><span class="stat-pill" style="background:rgba(0,206,201,0.25); color:#00cec9;">🩹 清除流血创伤</span>';
    } else if (id === 'energy_drink') {
      return '<span class="stat-pill" style="background:rgba(255,107,129,0.25); color:#ff6b81;">🍗 饥饿+30</span><span class="stat-pill" style="background:rgba(0,206,201,0.25); color:#00cec9;">💧 饮水+50</span><span class="stat-pill" style="background:rgba(254,202,87,0.3); color:#feca57;">⚡ 疲劳-35</span>';
    } else if (id === 'bamboo_canteen') {
      return '<span class="stat-pill" style="background:rgba(0,206,201,0.25); color:#00cec9;">💧 随身甘泉+45</span><span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">❤️ 生命+10</span>';
    } else if (id === 'beast_trap') {
      return '<span class="stat-pill" style="background:rgba(231,76,60,0.25); color:#e74c3c;">🪤 夹伤 45</span><span class="stat-pill" style="background:rgba(241,196,15,0.25); color:#f1c40f;">⛓️ 强力禁锢 4.0秒</span><span class="stat-pill" style="background:rgba(155,89,182,0.25); color:#9b59b6;">💥 必现破绽暴击</span>';
    } else if (id === 'wooden_spikes') {
      return '<span class="stat-pill" style="background:rgba(230,126,34,0.25); color:#e67e22;">🪵 营地拒马反震 50</span><span class="stat-pill" style="background:rgba(46,213,115,0.25); color:#2ed573;">🛡️ 阻断野猪冲撞</span>';
    } else if (id === 'crab_shield') {
      return '<span class="stat-pill" style="background:rgba(9,132,227,0.25); color:#74b9ff;">🛡️ 被动受击减伤 50%</span>';
    } else if (id === 'large_backpack') {
      return '<span class="stat-pill" style="background:rgba(253,203,110,0.25); color:#ffeaa7;">🎒 行囊容量永久 +4 格</span>';
    } else if (id === 'workradio') {
      return '<span class="stat-pill" style="background:rgba(108,92,231,0.3); color:#a29bfe;">📡 达成飞机逃脱结局</span>';
    } else if (id === 'escape_raft') {
      return '<span class="stat-pill" style="background:rgba(9,132,227,0.3); color:#74b9ff;">⛵ 达成扬帆逃脱结局</span>';
    } else {
      return '<span class="stat-pill" style="background:rgba(255,255,255,0.1); color:#dfe6e9;">🛠️ 基础合成原料</span>';
    }
  }

  // ⛵ 西南码头 · 远洋船坞修造与随船货仓模态弹窗 (Shipyard Upgrade & Cargo Hold Modal)
  openShipUpgradeModal(shipSys) {
    if (this.player && this.player.resetInput) this.player.resetInput();
    const system = shipSys || (window.__game ? window.__game.shipUpgradeSystem : null);
    if (!system) return;

    document.getElementById('modal-title').innerHTML = '⛵ 西南码头 · 远洋船坞工程台与随船货仓';
    const body = document.getElementById('modal-body');

    let currentTab = 'upgrade'; // 'upgrade' | 'cargo'

    const render = () => {
      const curTier = system.getCurrentTier();
      const nextTier = system.getNextTier();
      const check = system.checkCanUpgrade();
      const usedSlots = system.getUsedCargoSlots();
      const maxSlots = system.getMaxCargoSlots();

      const tabsHtml = `
        <div style="display:flex; gap:8px; border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:8px; margin-bottom:12px;">
          <button class="ship-tab-btn ${currentTab === 'upgrade' ? 'active' : ''}" data-tab="upgrade" style="
            flex:1; padding:9px 12px; border-radius:10px; border:none; cursor:pointer; font-weight:900; font-size:13px;
            background:${currentTab === 'upgrade' ? 'linear-gradient(135deg, #0984e3, #00cec9)' : 'rgba(255,255,255,0.06)'};
            color:${currentTab === 'upgrade' ? '#fff' : 'rgba(255,255,255,0.65)'};
            box-shadow:${currentTab === 'upgrade' ? '0 4px 14px rgba(0,206,201,0.3)' : 'none'};
          ">
            ⚓ 船体修造与性能改良
          </button>
          <button class="ship-tab-btn ${currentTab === 'cargo' ? 'active' : ''}" data-tab="cargo" style="
            flex:1; padding:9px 12px; border-radius:10px; border:none; cursor:pointer; font-weight:900; font-size:13px;
            background:${currentTab === 'cargo' ? 'linear-gradient(135deg, #a55eea, #4b7bec)' : 'rgba(255,255,255,0.06)'};
            color:${currentTab === 'cargo' ? '#fff' : 'rgba(255,255,255,0.65)'};
            box-shadow:${currentTab === 'cargo' ? '0 4px 14px rgba(165,94,234,0.3)' : 'none'};
          ">
            📦 随船专属货仓 (${usedSlots}/${maxSlots})
          </button>
        </div>
      `;

      let contentHtml = '';

      if (currentTab === 'upgrade') {
        contentHtml = `
          <div style="display:flex; flex-direction:column; gap:12px;">
            <!-- 当前船只状态大卡片 -->
            <div style="background:linear-gradient(135deg, rgba(9,132,227,0.2), rgba(0,206,201,0.12)); border:1.5px solid #00cec9; border-radius:14px; padding:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <span style="font-size:32px;">${curTier.icon}</span>
                  <div>
                    <div style="font-size:16px; font-weight:900; color:#fff;">${curTier.name}</div>
                    <div style="font-size:11px; font-weight:700; color:#00cec9;">${curTier.title} · ${curTier.badge}</div>
                  </div>
                </div>
                <span style="font-size:11px; background:#00cec9; color:#000; font-weight:900; padding:4px 8px; border-radius:8px;">
                  当前出海座驾
                </span>
              </div>
              <div style="font-size:12px; color:rgba(255,255,255,0.85); line-height:1.45; margin-bottom:10px; background:rgba(0,0,0,0.25); padding:8px 10px; border-radius:8px;">
                ${curTier.desc}
              </div>

              <!-- 4 大核心适航指标 -->
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
                <div style="background:rgba(255,255,255,0.06); border-radius:8px; padding:8px 10px;">
                  <div style="font-size:10.5px; color:rgba(255,255,255,0.6);">🌊 最大适航范围</div>
                  <div style="font-size:14px; font-weight:900; color:#00cec9;">${curTier.maxDistanceKm} 海里</div>
                </div>
                <div style="background:rgba(255,255,255,0.06); border-radius:8px; padding:8px 10px;">
                  <div style="font-size:10.5px; color:rgba(255,255,255,0.6);">📦 随船货舱容量</div>
                  <div style="font-size:14px; font-weight:900; color:#a55eea;">${curTier.cargoSlots} 格</div>
                </div>
                <div style="background:rgba(255,255,255,0.06); border-radius:8px; padding:8px 10px;">
                  <div style="font-size:10.5px; color:rgba(255,255,255,0.6);">⚡ 远航补给减免</div>
                  <div style="font-size:14px; font-weight:900; color:#fdcb6e;">${Math.round(curTier.supplyDiscount * 100)}% 减免</div>
                </div>
                <div style="background:rgba(255,255,255,0.06); border-radius:8px; padding:8px 10px;">
                  <div style="font-size:10.5px; color:rgba(255,255,255,0.6);">🌪️ 抗风浪能力</div>
                  <div style="font-size:14px; font-weight:900; color:#2ed573;">${curTier.stormResistance}</div>
                </div>
              </div>
            </div>

            <!-- 下一等级升级改装蓝图 -->
            ${nextTier ? `
              <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.15); border-radius:14px; padding:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:24px;">🔨</span>
                    <div>
                      <div style="font-size:14px; font-weight:900; color:#fff;">下一代造船图纸：${nextTier.name}</div>
                      <div style="font-size:11px; color:#ffeaa7;">${nextTier.upgradeBonusDesc}</div>
                    </div>
                  </div>
                  <span style="font-size:11px; color:#74b9ff; font-weight:700;">阶梯晋升</span>
                </div>

                <!-- 材料扣减进度清单 -->
                <div style="display:flex; flex-direction:column; gap:6px; margin:10px 0;">
                  ${check.costDetails.map(item => {
                    const itemName = this.getItemName(item.matKey);
                    const percent = Math.min(100, Math.round((item.totalAvailable / item.needCount) * 100));
                    return `
                      <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:8px;">
                        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                          <span style="color:#fff; font-weight:800;">${itemName}</span>
                          <span style="color:${item.satisfied ? '#2ed573' : '#ff7675'}; font-weight:800;">
                            ${item.totalAvailable} / ${item.needCount} ${item.satisfied ? '✅' : '(缺少 ' + (item.needCount - item.totalAvailable) + ')'}
                          </span>
                        </div>
                        <div style="background:rgba(255,255,255,0.1); height:6px; border-radius:3px; overflow:hidden;">
                          <div style="background:${item.satisfied ? 'linear-gradient(90deg, #00b894, #00cec9)' : '#e17055'}; width:${percent}%; height:100%;"></div>
                        </div>
                        <div style="font-size:10px; color:rgba(255,255,255,0.45); margin-top:2px;">
                          背包: ${item.bagCount} | 营地储物箱: ${item.storeCount} (支持自动聚合扣除)
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>

                <!-- 升级按钮组（双轨：常规资材组装 / 算力代币黑市蓝图快造） -->
                <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
                  <div style="display:flex; gap:10px;">
                    <button id="btn-perform-upgrade" style="
                      flex:1; padding:10px; border-radius:10px; border:none; cursor:${check.ok ? 'pointer' : 'not-allowed'};
                      background:${check.ok ? 'linear-gradient(135deg, #00b894, #00cec9)' : 'rgba(255,255,255,0.1)'};
                      color:${check.ok ? '#fff' : 'rgba(255,255,255,0.4)'};
                      font-weight:900; font-size:12.5px; box-shadow:${check.ok ? '0 4px 14px rgba(0,206,201,0.4)' : 'none'};
                    ">
                      ${check.ok ? `🔨 资材组装升级【${nextTier.title}】` : '❌ 资材不足，无法组装'}
                    </button>
                    ${nextTier.solCost ? `
                      <button id="btn-sol-upgrade" style="
                        flex:1; padding:10px; border-radius:10px; border:1px solid #14f195; cursor:pointer;
                        background:linear-gradient(135deg, #9945ff, #14f195); color:#0b101b; font-weight:900; font-size:12.5px;
                        box-shadow:0 4px 14px rgba(20,241,149,0.35);
                      ">
                        🪙 ${nextTier.solCost} 算力代币黑市蓝图一键快造
                      </button>
                    ` : ''}
                  </div>
                  <button id="btn-quick-sail" style="
                    width:100%; padding:9px; border-radius:10px; border:none; cursor:pointer;
                    background:linear-gradient(135deg, #0984e3, #74b9ff); color:#fff; font-weight:900; font-size:12.5px;
                  ">
                    🧭 展开海图出航
                  </button>
                </div>
              </div>
            ` : `
              <div style="background:rgba(255,215,0,0.12); border:1.5px solid #ffd700; border-radius:14px; padding:14px; text-align:center;">
                <span style="font-size:32px;">🌟</span>
                <div style="font-size:16px; font-weight:900; color:#ffd700; margin:6px 0 4px;">远洋顶峰旗舰 · 征服全海域</div>
                <div style="font-size:12px; color:rgba(255,255,255,0.8); line-height:1.45;">
                  您的座驾已达到最高等级【铁甲远洋双桅探索舰】！<br/>
                  深海狂暴风浪完全免疫、远航干粮与饮水完全免除消耗、船尾全自动深海拖网持续捕捞！
                </div>
                <button id="btn-quick-sail" style="
                  margin-top:12px; padding:9px 24px; border-radius:10px; border:none; cursor:pointer;
                  background:linear-gradient(135deg, #0984e3, #00cec9); color:#fff; font-weight:900; font-size:13px;
                ">
                  🧭 展开群岛海图起航 ➔
                </button>
              </div>
            `}
          </div>
        `;
      } else {
        // Tab 2: 随船专属货仓
        const cargoEntries = Object.entries(system.cargoInventory).filter(([k, c]) => c > 0);
        const bagEntries = Object.entries(this.inventory).filter(([k, c]) => c > 0);

        contentHtml = `
          <div style="display:flex; flex-direction:column; gap:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(165,94,234,0.15); border:1px solid rgba(165,94,234,0.3); border-radius:10px; padding:8px 12px;">
              <span style="font-size:12px; color:#dff9fb;">
                💡 随船货仓跟随船只航行，可用于在跨岛探索中运载大批珍贵矿石与重型原木，不占背包！
              </span>
              <button id="btn-unload-cargo-storage" style="
                background:#0984e3; border:none; border-radius:8px; padding:6px 12px; color:#fff; font-weight:800; font-size:11px; cursor:pointer; white-space:nowrap;
              ">
                📦 一键卸货入营地箱 ➔
              </button>
            </div>

            ${maxSlots <= 0 ? `
              <div style="text-align:center; padding:30px 10px; background:rgba(0,0,0,0.25); border-radius:14px;">
                <span style="font-size:36px;">🛶</span>
                <div style="font-size:14px; font-weight:900; color:#fff; margin-top:8px;">当前简易木筏未配备随船货运木箱</div>
                <div style="font-size:11.5px; color:rgba(255,255,255,0.6); margin-top:4px;">请前往【船体修造】升级至【T2 龙骨风帆艇】以解锁 4 槽位随船货仓！</div>
              </div>
            ` : `
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <!-- 左列：玩家随身行囊 -->
                <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:10px;">
                  <div style="font-size:13px; font-weight:900; color:#fff; margin-bottom:8px; display:flex; justify-content:space-between;">
                    <span>🎒 随身行囊</span>
                    <span style="font-size:11px; color:#ffeaa7;">点击存入 ➔</span>
                  </div>
                  <div style="display:flex; flex-direction:column; gap:5px; max-height:38vh; overflow-y:auto; padding-right:2px;">
                    ${bagEntries.length === 0 ? '<div style="font-size:11px; color:rgba(255,255,255,0.4); text-align:center; padding:16px;">背包空空如也</div>' :
                      bagEntries.map(([k, c]) => `
                        <div class="btn-deposit-cargo" data-item="${k}" style="
                          display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:6px; cursor:pointer; font-size:11.5px;
                        ">
                          <span style="color:#fff; font-weight:700;">${this.getItemName(k)}</span>
                          <span style="color:#00cec9; font-weight:900;">x${c} ➔</span>
                        </div>
                      `).join('')
                    }
                  </div>
                </div>

                <!-- 右列：随船货运仓 -->
                <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:10px;">
                  <div style="font-size:13px; font-weight:900; color:#fff; margin-bottom:8px; display:flex; justify-content:space-between;">
                    <span>🚢 随船货仓 (${usedSlots}/${maxSlots})</span>
                    <span style="font-size:11px; color:#a55eea;">⬅ 点击取出</span>
                  </div>
                  <div style="display:flex; flex-direction:column; gap:5px; max-height:38vh; overflow-y:auto; padding-right:2px;">
                    ${cargoEntries.length === 0 ? '<div style="font-size:11px; color:rgba(255,255,255,0.4); text-align:center; padding:16px;">货仓暂无货物</div>' :
                      cargoEntries.map(([k, c]) => `
                        <div class="btn-withdraw-cargo" data-item="${k}" style="
                          display:flex; justify-content:space-between; align-items:center; background:rgba(165,94,234,0.15); border:1px solid rgba(165,94,234,0.3); padding:6px 8px; border-radius:6px; cursor:pointer; font-size:11.5px;
                        ">
                          <span style="color:#ffeaa7; font-weight:900;">⬅ x${c}</span>
                          <span style="color:#fff; font-weight:700;">${this.getItemName(k)}</span>
                        </div>
                      `).join('')
                    }
                  </div>
                </div>
              </div>
            `}
          </div>
        `;
      }

      body.innerHTML = `
        <div style="display:flex; flex-direction:column; width:100%; max-height:68vh; overflow-y:auto; padding:4px;">
          ${tabsHtml}
          ${contentHtml}
        </div>
      `;

      // 绑定 Tab 切换
      body.querySelectorAll('.ship-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          currentTab = btn.getAttribute('data-tab');
          soundEngine.playPlaceFurniture();
          render();
        });
      });

      // 绑定升级按钮
      const upBtn = body.querySelector('#btn-perform-upgrade');
      if (upBtn) {
        upBtn.addEventListener('click', () => {
          if (system.performUpgrade()) {
            render();
          }
        });
      }

      // 绑定 算力代币 算力代币黑市快造
      const solUpBtn = body.querySelector('#btn-sol-upgrade');
      if (solUpBtn) {
        solUpBtn.addEventListener('click', () => {
          if (system.performSolUpgrade()) {
            render();
          }
        });
      }

      // 绑定快捷出海海图
      body.querySelectorAll('#btn-quick-sail').forEach(btn => {
        btn.addEventListener('click', () => {
          this.closeModal();
          if (window.__game && window.__game.nauticalChart) {
            window.__game.nauticalChart.openChartModal();
          }
        });
      });

      // 绑定存入货仓
      body.querySelectorAll('.btn-deposit-cargo').forEach(el => {
        el.addEventListener('click', () => {
          const itemKey = el.getAttribute('data-item');
          if (system.depositToCargo(itemKey, 1)) {
            render();
          }
        });
      });

      // 绑定取出货仓
      body.querySelectorAll('.btn-withdraw-cargo').forEach(el => {
        el.addEventListener('click', () => {
          const itemKey = el.getAttribute('data-item');
          if (system.withdrawFromCargo(itemKey, 1)) {
            render();
          }
        });
      });

      // 绑定一键卸货
      const unloadBtn = body.querySelector('#btn-unload-cargo-storage');
      if (unloadBtn) {
        unloadBtn.addEventListener('click', () => {
          system.unloadCargoToStorage();
          render();
        });
      }
    };

    render();
    this.modalBackdrop.style.display = 'flex';
    soundEngine.playPlaceFurniture();
  }

  // 🧭 荒岛群岛海图与出海航行导航弹窗 (Nautical Chart Modal)
  openNauticalChartModal(nauticalChart) {
    if (this.player && this.player.resetInput) this.player.resetInput();
    document.getElementById('modal-title').innerHTML = '🧭 荒岛群岛海图与航海导航 (Nautical Chart)';
    const body = document.getElementById('modal-body');

    const islands = Object.values(nauticalChart.islands);
    const shipSys = window.__game ? window.__game.shipUpgradeSystem : null;
    const curTier = shipSys ? shipSys.getCurrentTier() : null;

    const islandCardsHtml = islands.map(isl => {
      const isCurrent = isl.id === nauticalChart.currentIslandId;
      const isDiscovered = isl.discovered;
      const canReach = !shipSys || isl.distanceKm <= 0 || shipSys.canReachDistance(isl.distanceKm);

      let actionBtnHtml = '';
      if (isCurrent) {
        actionBtnHtml = `<span style="font-size:12px; font-weight:800; color:#00cec9; background:rgba(0,206,201,0.15); padding:6px 12px; border-radius:8px;">📍 当前停靠港</span>`;
      } else if (!isDiscovered) {
        actionBtnHtml = `<span style="font-size:12px; font-weight:700; color:rgba(255,255,255,0.4); background:rgba(255,255,255,0.06); padding:6px 12px; border-radius:8px;">🔒 海雾笼罩 (未探明)</span>`;
      } else if (!canReach) {
        actionBtnHtml = `
          <button class="btn-ship-upgrade-shortcut" style="background:rgba(225,112,85,0.25); border:1.5px solid #e17055; border-radius:10px; padding:7px 12px; color:#ff7675; font-weight:900; font-size:12px; cursor:pointer;">
            ⚠️ 航程不足 (点此升级)
          </button>
        `;
      } else {
        actionBtnHtml = `
          <button class="btn-sail-to" data-id="${isl.id}" style="background:linear-gradient(135deg, #0984e3, #00cec9); border:none; border-radius:10px; padding:7px 16px; color:#fff; font-weight:900; font-size:13px; cursor:pointer; box-shadow:0 4px 14px rgba(0,206,201,0.4); transition:transform 0.1s;">
            ⛵ 扬帆起航 ➔
          </button>
        `;
      }

      // 计算减免后的实际消耗
      const discount = curTier ? curTier.supplyDiscount : 0;
      const actualWater = discount >= 1.0 ? 0 : (discount > 0 ? Math.max(1, Math.ceil(isl.requiredSupplies.water * (1 - discount))) : isl.requiredSupplies.water);
      const actualFood = discount >= 1.0 ? 0 : (discount > 0 ? Math.max(1, Math.ceil(isl.requiredSupplies.food * (1 - discount))) : isl.requiredSupplies.food);

      return `
        <div style="background:rgba(255,255,255,${isCurrent ? '0.1' : '0.05'}); border:1.5px solid ${isCurrent ? '#00cec9' : 'rgba(255,255,255,0.12)'}; border-radius:16px; padding:14px; margin-bottom:10px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:28px;">${isl.thumbnailIcon}</span>
              <div>
                <div style="font-size:15px; font-weight:900; color:#ffffff;">${isl.name}</div>
                <div style="font-size:11px; font-weight:700; color:#ffdd59;">${isl.badge} · 危险度：${isl.dangerLevel}</div>
              </div>
            </div>
            <div>
              ${actionBtnHtml}
            </div>
          </div>
          <div style="font-size:12px; line-height:1.5; color:rgba(255,255,255,0.8); background:rgba(0,0,0,0.25); padding:8px 10px; border-radius:10px;">
            ${isDiscovered ? isl.desc : '遥远海平线之外被浓厚海雾遮蔽的未知海域，修复无线电通讯或登高眺望可探明航向。'}
          </div>
          ${isDiscovered && !isCurrent ? `
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#dfe6e9;">
              <span>🌊 航程：${isl.distanceKm} 海里 · 气候：${isl.climate}</span>
              <span style="color:#ffeaa7;">
                🎒 实际消耗：${discount >= 1.0 ? '<b style="color:#2ed573;">0 消耗 (铁甲旗舰特权全免)</b>' : `淡水 x${actualWater}，干粮 x${actualFood} ${discount > 0 ? '(减半)' : ''}`}
              </span>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px; width:100%; max-height:65vh; overflow-y:auto; padding:4px;">
        ${curTier ? `
          <div style="background:linear-gradient(135deg, rgba(9,132,227,0.25), rgba(0,206,201,0.15)); border:1px solid #00cec9; border-radius:12px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:24px;">${curTier.icon}</span>
              <div>
                <div style="font-size:13px; font-weight:900; color:#fff;">出海座驾：${curTier.name}</div>
                <div style="font-size:11px; color:#00cec9;">最大适航 ${curTier.maxDistanceKm} 海里 | 随船货仓 ${curTier.cargoSlots} 格 | 补给减免 ${Math.round(curTier.supplyDiscount * 100)}%</div>
              </div>
            </div>
            <button id="btn-goto-shipyard" style="background:#0984e3; border:none; border-radius:8px; padding:6px 12px; color:#fff; font-weight:800; font-size:11.5px; cursor:pointer; white-space:nowrap;">
              ⛵ 船坞升级与货仓 ➔
            </button>
          </div>
        ` : ''}

        <div style="flex:1;">
          ${islandCardsHtml}
        </div>
      </div>
    `;

    // 绑定起航事件
    body.querySelectorAll('.btn-sail-to').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-id');
        const check = nauticalChart.checkSupplies(targetId);
        if (!check.ok) {
          this.showToast(`❌ 无法起航：${check.reason}`, 'medium');
          return;
        }

        // 补给充分，扣除消耗并起航
        nauticalChart.deductSupplies(targetId);
        this.modalBackdrop.style.display = 'none';

        if (window.__game && window.__game.travelToIsland) {
          window.__game.travelToIsland(targetId);
        } else {
          this.showToast(`⛵ 正在扬帆驶向【${nauticalChart.islands[targetId].name}】……`, 'medium');
        }
      });
    });

    // 绑定打开船坞界面
    const gotoShipyard = body.querySelector('#btn-goto-shipyard');
    if (gotoShipyard) {
      gotoShipyard.addEventListener('click', () => {
        this.openShipUpgradeModal();
      });
    }

    body.querySelectorAll('.btn-ship-upgrade-shortcut').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openShipUpgradeModal();
      });
    });

    this.modalBackdrop.style.display = 'flex';
    soundEngine.playPlaceFurniture();
  }

  getItemDesc(id) {
    const descs = {
      apple: '多汁清脆的红苹果，直接食用可恢复饥饿与少量生命。',
      coconut: '高大椰树上结出的海岛椰子，甘甜的椰汁能同时补充大量水分。',
      tree_branch: '散落林间的木棍，坚韧耐用，是制作工具、鱼竿与引火物的核心原料。',
      tree_bark: '干燥的树皮纤维，极易被火星引燃，与木棍组合可制作引火物。',
      tree_sap: '粘稠的树脂，富含油脂，可与木棍制成照亮洞穴与黑夜的火把。',
      ivy: '林间垂挂的柔韧藤蔓，极难扯断，是捆扎鱼竿与求生木筏的关键缆绳。',
      lumber: '厚重坚固的浮木方料，是打造坚固出海木筏的龙骨骨架。',
      wood_plank: '从海面打捞并风干的平整木板，是搭建营地设施与储物箱的优质建材。',
      stone_chunk: '海蚀崩落的坚硬碎石，用于搭建净水滴滤台与稳固营火基底。',
      nail: '从海难碎船板中搜集到的锈铁钉，用于将木材固定成木筏与坚固构件。',
      canteen_clean_water: '经滴滤台彻底净化的清澈纯净淡水，饮用能大幅恢复水合与生命。',
      fish: '近海捕获的鲜鱼，肉质饱满，在篝火上炙烤后是荒岛顶级美食。',
      kindling: '用树枝与树皮摩擦制成的引火装置，能瞬间燃起熊键篝火。',
      torch: '浸满树脂的明亮火把，可照亮深夜的丛林与深邃洞穴。',
      fishingrod: '柔韧木棍与藤蔓编制的简易鱼竿，可在码头与海岸垂钓。',
      baked_fish: '在篝火上精心炙烤的金黄烤鱼，散发诱人香气，大幅恢复饱腹与体力。',
      baked_apple: '经火烘烤后软糯香甜的苹果，温热适口，兼具解渴与充饥。',
      broken_radio: '被海水泡坏的旧便携收音机，内部电路依然完整，只缺电源。',
      battery: '完好未拆封的工业高能电池，可让坏收音机重新接收无线电。',
      workradio: '重新通电的求生收音机，能接收海上紧急频段并发送求救 SOS！',
      escape_raft: '使用4根木材与钉子扎制的大型求生木筏，具备横渡大洋的能力！',
      spear: '用坚韧木棍绑缚锋利燧石制成的燧石战矛！按 [F] 或右下角攻击键可发动远距离扇形强力刺击！',
      wooden_bow: '用兽皮韧弦与弹性硬木制成的简易猎弓！按 [R] 键切换远程射击模式，射出物理抛物线羽箭！',
      flint_arrow: '精巧绑缚轻盈树皮羽毛的燧石羽箭，猎弓远程弹药，击中地面有 50% 概率完好回收！',
      beast_trap: '铁钉与坚石打造的机械夹，点击使用放置在地表，踩中的野兽陷入 4 秒禁锢与致命破绽！',
      wooden_spikes: '削尖硬木加固构成的防兽拒马，放置在营地四周可反弹野兽冲撞并造成 50 点震伤！',
      crab_shield: '由巨蟹外壳与木板压合而成的坚甲木盾，放在背包中受击可减免 50% 伤害！',
      raw_meat: '从丛林野猪身上猎获的新鲜带骨兽肉，生吃稍显粗粝，在营火烤制后是绝佳美食！',
      cooked_meat: '在营火上慢火炙烤的金黄排骨大餐！外酥里嫩，恢复 75 饱腹度与 35 生命！',
      crab_meat: '从沙滩巨蟹身上剥出的细嫩红蟹肉，烤熟后鲜甜爽口，极大提振求生士气！',
      cooked_crab: '炭火烘烤的香脆极品红蟹，富含优质蛋白，饱腹+55，生命+25！',
      beast_hide: '野兽身上的厚重保暖皮毛，与藤蔓结合可缝制成扩容背包！',
      crab_shell: '沙滩巨蟹的坚韧背甲，拥有天然海蚀弧度与高抗压硬度，适合制作盾牌防具！',
      large_backpack: '精工缝制的加厚拓荒者大皮包！点击使用可永久扩充行囊背包 +4 个储物格！',
      golden_coconut: '小猴攀上高大椰树采摘的稀有黄金椰！清甜蜜汁，饥饿+45，饮水+50，疲劳清空！',
      bird_egg: '从树顶海鸟巢穴中拾获的新鲜海鸟蛋，富含优质蛋白，生吃或营火烹制均可。',
      ancient_coin: '小猴钻入狭窄岩缝掏出的古代海盗金币！表面铸有神秘航海符文，可用于营地商贸。',
      treasure_map_piece: '风干的羊皮纸藏宝图残页，隐约标记着荒岛远古密室与宝藏的线索。',
      pearl: '海蚀石缝深处起获的圆润深海珍珠，流光溢彩，极其稀有的高阶硬通货。',
      tough_bark: '树冠老枝剥下的坚韧树皮，纤维如钢丝般强韧，是制作高级绑绳与坚固防具的核心。',
      sea_crab: '退潮潮汐捕蟹笼中起获的生猛海螯蟹，生食或挂上营地熏架烤熟风味绝佳。',
      sardine: '随海潮游入潮汐笼的银鳞小沙丁鱼，鲜活肥嫩，可作为生食、鱼饵或熏制军粮。',
      smoked_fish: '经营地烟熏架慢火风干的极品熏鱼干！远洋特权军粮，永久防腐不烂，出海 1 份抵 2 份！',
      sol_crystal: '后山高能矿脉开采的高频硅晶原石！蕴藏大量链上哈希数据，投入营地矿机可解密出荒岛算力代币！',
      sol_token: '矿机成功计算哈希区块产出的荒岛算力代币（游戏内货币）。可在黑市兑换特权蓝图，与真实 SOL 严格分离。',
      geo_scanner_mk1: '初阶地脉行波探测仪。在矿机控制台安装后，每轮可勘探出 1 条包含主矿脉的行或列！',
      geo_scanner_mk2: '高精度地质扫描仪。在矿机控制台安装后，每轮锁定 4 个高能候选格，大幅提升勘探中签率！',
      geo_scanner_mk3: '终极量子地质扫描仪。在矿机控制台安装后，精确透视 3 个热脉格，主脉预测准确率达 80%！',
      resonance_crab_pot: '海岛珍馐美食。食用后获得「晶爆」灵感：接下来 3 轮共振勘探晶爆触发概率提升 1.5 倍！'
    };
    return descs[id] || '荒岛上搜集到的珍贵物资。';
  }

  getItemName(id) {
    const names = {
      apple: '红苹果', coconut: '海岛椰子', tree_branch: '坚韧木棍', tree_bark: '干燥树皮',
      tree_sap: '天然树脂', ivy: '柔韧藤蔓', lumber: '木材方料', wood_plank: '优质木板', stone_chunk: '海蚀碎石',
      nail: '坚固铁钉', canteen_clean_water: '甘甜纯净水', fish: '肥美鲜鱼',
      kindling: '引火物', torch: '防风火把', fishingrod: '简易鱼竿', baked_fish: '香烤大鱼',
      baked_apple: '热烤苹果', broken_radio: '坏收音机', battery: '备用电池',
      workradio: '修好的收音机', escape_raft: '求生大木筏',
      spear: '燧石战矛 🗡️', wooden_bow: '简易猎弓 🏹', flint_arrow: '燧石羽箭 🏹',
      fire_arrow: '烈焰爆燃箭 🏹🔥', bone_armor: '甲壳兽皮胸甲 🦺', herbal_paste: '止血树脂敷膏 🩹',
      energy_drink: '清甜鲜萃果浆 🧃', bamboo_canteen: '便携树皮水壶 🍶', stone_pickaxe: '骨柄石镐 ⛏️', iron_ore: '富铁矿石 ⛏️', iron_ingot: '精炼铁质构件 🧱',
      beast_trap: '齿状捕兽夹 🪤', wooden_spikes: '防兽尖木拒马 🪵', crab_shield: '坚甲木盾 🛡️',
      raw_meat: '野兽生肉 🥩', cooked_meat: '香烤野味排骨 🍖',
      crab_meat: '新鲜红蟹肉 🦀', cooked_crab: '香烤极品红蟹 🦀',
      beast_hide: '加厚兽皮 🧶', crab_shell: '坚硬蟹壳 🛡️',
      large_backpack: '拓荒者大皮包 🎒',
      golden_coconut: '黄金海岛椰 🥥✨', bird_egg: '高枝海鸟蛋 🥚',
      ancient_coin: '古代海盗金币 🪙', treasure_map_piece: '藏宝图残页 🗺️',
      pearl: '深海纯白珍珠 🦪', tough_bark: '高枝坚韧树皮 🍂',
      sea_crab: '生猛青花海蟹 🦀', sardine: '银鳞小沙丁鱼 🐟',
      smoked_fish: '极品熏鱼干 🍱✨',
      sol_crystal: '未解密硅晶原石 💎',
      sol_token: '荒岛算力代币 🪙',
      geo_scanner_mk1: '地质共振扫描仪 Mk1 📡',
      geo_scanner_mk2: '精密共振扫描仪 Mk2 🛰️',
      geo_scanner_mk3: '全域量子扫描仪 Mk3 🌌',
      resonance_crab_pot: '共振浓香椰子蟹煲 🍲✨'
    };
    return names[id] || id;
  }

  // 黏土图标集成（2026-10-31）：合并原 53 项 emoji 表与 CraftingSystem 34 项，统一走 IconRegistry；有黏土图返回 <img>，否则回退 emoji
  getItemIcon(id, size) {
    return iconHTML(id, size);
  }

  // 航行黑幕转场淡入
  createTransitionFade() {
    if (this.fadeOverlay) {
      this.fadeOverlay.style.pointerEvents = 'all';
      this.fadeOverlay.style.opacity = '1';
    }
    return this.fadeOverlay;
  }

  // 航行黑幕转场淡出
  fadeTransitionOut() {
    if (this.fadeOverlay) {
      setTimeout(() => {
        this.fadeOverlay.style.opacity = '0';
        this.fadeOverlay.style.pointerEvents = 'none';
      }, 350);
    }
  }

  // 电影级全屏黑幕入眠与黎明破晓唤醒动效 (Sleep Fade Cutscene)
  triggerSleepFade(icon = "⛺", title = "夜色渐深 · 进入梦乡……", onWakeCallback) {
    if (!this.fadeOverlay) {
      if (onWakeCallback) onWakeCallback();
      return;
    }

    this.fadeOverlay.innerHTML = `
      <div style="font-size: 52px; margin-bottom: 16px; animation: floatAnim 2s ease-in-out infinite;">${icon}</div>
      <div style="font-size: 20px; font-weight: 900; color: #f1c40f; letter-spacing: 2px; margin-bottom: 8px;">${title}</div>
      <div style="font-size: 13px; color: rgba(255,255,255,0.7); font-weight: 500;">伴着静谧海浪与晚风安然入眠……</div>
    `;

    this.fadeOverlay.style.pointerEvents = "all";
    this.fadeOverlay.style.opacity = "1";

    setTimeout(() => {
      this.fadeOverlay.innerHTML = `
        <div style="font-size: 52px; margin-bottom: 16px; animation: floatAnim 2s ease-in-out infinite;">🌅</div>
        <div style="font-size: 20px; font-weight: 900; color: #00cec9; letter-spacing: 2px; margin-bottom: 8px;">朝阳破晓 · 晨曦微露</div>
        <div style="font-size: 13px; color: rgba(255,255,255,0.85); font-weight: 500;">新的一天开始了，四维代谢全满复苏！</div>
      `;

      if (onWakeCallback) onWakeCallback();

      setTimeout(() => {
        this.fadeOverlay.style.opacity = "0";
        this.fadeOverlay.style.pointerEvents = "none";
        setTimeout(() => {
          this.fadeOverlay.innerHTML = `
            <div style="font-size: 42px; margin-bottom: 12px; animation: floatAnim 1.5s ease-in-out infinite;">⛵</div>
            <div style="font-size: 16px; font-weight: 800; color: #00cec9; letter-spacing: 1px;">乘风破浪航行中……</div>
          `;
        }, 400);
      }, 700);
    }, 900);
  }

  // 3.8 近海打捞滑轮浮标网与集捞工坊控制台
  openAutoSalvageModal(flotsamSalvage) {
    if (this.player && this.player.resetInput) this.player.resetInput();
    document.getElementById("modal-title").innerHTML = "⚓ 近海打捞滑轮浮标网与集捞工坊";
    const body = document.getElementById("modal-body");

    const render = () => {
      const isDeployed = flotsamSalvage && flotsamSalvage.hasAutoSalvageBuoy;
      const tier = flotsamSalvage ? (flotsamSalvage.tier || 1) : 1;
      const stats = flotsamSalvage ? flotsamSalvage.getStats() : { totalSalvaged: 0, interval: 30 };
      const storageInv = (this.game && this.game.storageSystem) ? this.game.storageSystem.storageInventory : {};

      const tierNames = {
        1: { name: "T1 简易海面浮标网", interval: 30, desc: "基础洋流捕捞，每 30 秒自动截获近海漂流物并归入大木箱。" },
        2: { name: "T2 动力滑轮双索道网", interval: 18, desc: "强化滑轮与缆绳动力，捕捞周期大幅缩短至 18 秒，附带额外建材！" },
        3: { name: "T3 深海磁吸集捞仓", interval: 10, desc: "工业级高能磁吸，每 10 秒截获一件远洋高阶物资并自动清点入仓！" }
      };
      const curTierInfo = tierNames[tier] || tierNames[1];

      body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px; max-height:68vh; overflow-y:auto; padding:4px;">
          <div style="
            background: linear-gradient(135deg, rgba(0,206,201,0.22), rgba(9,132,227,0.18));
            border: 1.5px solid #00cec9; border-radius: 14px; padding: 14px;
            box-shadow: 0 8px 24px rgba(0,206,201,0.15);
          ">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div style="font-size:16px; font-weight:900; color:#fff; display:flex; align-items:center; gap:8px;">
                <span>⚓</span>
                <span>${curTierInfo.name}</span>
              </div>
              <div style="font-size:11.5px; font-weight:800; padding:4px 10px; border-radius:20px; background:${isDeployed ? "rgba(46,204,113,0.2)" : "rgba(231,76,60,0.2)"}; color:${isDeployed ? "#2ecc71" : "#e74c3c"}; border:1px solid ${isDeployed ? "#2ecc71" : "#e74c3c"};">
                ${isDeployed ? "● 运转中 (AUTO-ON)" : "○ 待部署 (OFFLINE)"}
              </div>
            </div>
            <div style="font-size:12px; color:#dff9fb; line-height:1.5;">${curTierInfo.desc}</div>
            <div style="display:flex; gap:16px; margin-top:10px; font-size:12px; color:#fff;">
              <div>⚡ 捕捞周期：<strong style="color:#f1c40f;">${stats.interval} 秒/件</strong></div>
              <div>📦 累计捕捞：<strong style="color:#00cec9;">${stats.totalSalvaged} 件</strong></div>
            </div>
          </div>

          <div style="background:rgba(0,0,0,0.25); border-radius:12px; padding:12px; border:1px solid rgba(255,255,255,0.08);">
            <div style="font-size:13px; font-weight:800; color:#fff; margin-bottom:8px;">📦 营地大木箱中的打捞建材储备</div>
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap:8px;">
              <div style="background:rgba(255,255,255,0.06); padding:6px; border-radius:8px; text-align:center;">
                <div style="font-size:18px;">🪵</div>
                <div style="font-size:11px; color:#dfe6e9;">木板捆</div>
                <div style="font-size:13px; font-weight:900; color:#f1c40f;">${storageInv["wood_plank"] || 0}</div>
              </div>
              <div style="background:rgba(255,255,255,0.06); padding:6px; border-radius:8px; text-align:center;">
                <div style="font-size:18px;">🔩</div>
                <div style="font-size:11px; color:#dfe6e9;">坚固铁钉</div>
                <div style="font-size:13px; font-weight:900; color:#f1c40f;">${storageInv["nail"] || 0}</div>
              </div>
              <div style="background:rgba(255,255,255,0.06); padding:6px; border-radius:8px; text-align:center;">
                <div style="font-size:18px;">🔋</div>
                <div style="font-size:11px; color:#dfe6e9;">备用电池</div>
                <div style="font-size:13px; font-weight:900; color:#f1c40f;">${storageInv["battery"] || 0}</div>
              </div>
              <div style="background:rgba(255,255,255,0.06); padding:6px; border-radius:8px; text-align:center;">
                <div style="font-size:18px;">💎</div>
                <div style="font-size:11px; color:#dfe6e9;">硅晶原石</div>
                <div style="font-size:13px; font-weight:900; color:#f1c40f;">${storageInv["sol_crystal"] || 0}</div>
              </div>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px; margin-top:4px;">
            ${!isDeployed ? `
              <button id="btn-deploy-buoy" style="
                background: linear-gradient(135deg, #0984e3, #00cec9); border:none; border-radius:10px;
                padding:12px; color:#fff; font-weight:900; font-size:14px; cursor:pointer;
                box-shadow: 0 4px 14px rgba(0,206,201,0.4);
              ">
                🚀 部署【近海自动打捞浮标网】(可在商城特权或营地制作)
              </button>
            ` : (tier < 3 ? `
              <button id="btn-upgrade-buoy" style="
                background: linear-gradient(135deg, #6c5ce7, #a29bfe); border:none; border-radius:10px;
                padding:12px; color:#fff; font-weight:900; font-size:14px; cursor:pointer;
                box-shadow: 0 4px 14px rgba(108,92,231,0.4);
              ">
                ⚡ 升级为【${tierNames[tier+1].name}】(打捞周期缩短至 ${tierNames[tier+1].interval} 秒)
              </button>
            ` : `
              <div style="background:rgba(241,196,15,0.15); border:1px solid #f1c40f; border-radius:10px; padding:10px; text-align:center; color:#f1c40f; font-size:13px; font-weight:800;">
                👑 浮标网已达到最高【T3 深海磁吸集捞仓】工业级极速打捞！
              </div>
            `)}
            <button id="btn-open-storage-from-buoy" style="
              background: rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.2);
              border-radius:10px; padding:10px; color:#fff; font-weight:700; font-size:13px; cursor:pointer;
            ">
              📦 打开营地储物箱查验全量建材
            </button>
          </div>
        </div>
      `;

      const deployBtn = document.getElementById("btn-deploy-buoy");
      if (deployBtn) {
        deployBtn.onclick = () => {
          if (flotsamSalvage.unlockAutoSalvageBuoy) {
            flotsamSalvage.unlockAutoSalvageBuoy();
            render();
          }
        };
      }

      const upgradeBtn = document.getElementById("btn-upgrade-buoy");
      if (upgradeBtn) {
        upgradeBtn.onclick = () => {
          if (flotsamSalvage.upgradeTier) {
            const upRes = flotsamSalvage.upgradeTier();
            if (upRes.success) {
              this.showToast(`⚓ 浮标网成功升级至【T${upRes.tier}】！打捞效率大幅飙升！`, "important");
              render();
            } else {
              this.showToast(`⚠️ ${upRes.msg}`, "medium");
            }
          }
        };
      }

      const storageBtn = document.getElementById("btn-open-storage-from-buoy");
      if (storageBtn) {
        storageBtn.onclick = () => {
          if (this.game && this.game.storageSystem) {
            this.game.storageSystem.openStorage("camp_default_chest");
          }
        };
      }
    };

    render();
    this.openModal();
  }

  // ========================================================
  // 算力总账 (Compute Ledger Drawer) - A1 轮展示层
  // ========================================================
  initLedgerDrawer() {
    if (document.getElementById('ledger-drawer')) return;

    let scrim = document.getElementById('ledger-drawer-scrim');
    if (!scrim) {
      scrim = document.createElement('div');
      scrim.className = 'ledger-drawer-scrim';
      scrim.id = 'ledger-drawer-scrim';
      document.body.appendChild(scrim);
    }

    const drawer = document.createElement('aside');
    drawer.className = 'ledger-drawer';
    drawer.id = 'ledger-drawer';
    drawer.setAttribute('aria-label', '算力总账');
    drawer.innerHTML = `
      <div class="ledger-drawer-header">
        <div class="ledger-drawer-title">
          ${iconHTML('items/sol_token', 20) || '🪙'} <span>算力总账</span>
        </div>
        <button type="button" class="ledger-drawer-close" id="btn-ledger-close" aria-label="关闭">✕</button>
      </div>
      <div class="ledger-drawer-body" id="ledger-drawer-body"></div>
      <div class="ledger-drawer-disclaimer" id="ledger-drawer-disclaimer">算力代币是游戏内道具，不能兑换 SOL 或 SKR，不承诺任何收益。</div>
    `;
    document.body.appendChild(drawer);

    scrim.addEventListener('click', () => {
      this.closeLedgerDrawer();
    });
    const closeBtn = drawer.querySelector('#btn-ledger-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeLedgerDrawer();
      });
    }
  }

  getEconomyLedger() {
    if (this._injectedLedger) return this._injectedLedger;
    const game = this.game || this.buildSystem?.game || window.__game;
    if (game?.economyLedger) return game.economyLedger;
    if (game) return economyLedger(game);
    return null;
  }

  openLedgerDrawer() {
    this.initLedgerDrawer();
    const drawer = document.getElementById('ledger-drawer');
    const scrim = document.getElementById('ledger-drawer-scrim');
    if (!drawer) return;

    this.renderLedgerDrawer();

    drawer.classList.add('open');
    if (scrim) scrim.classList.add('open');
    document.body.classList.add('hud-modal-open');
    document.body.classList.add('hud-ledger-open');

    // 暂停/隐藏会被抽屉压住的独立任务简条
    const questCard = document.getElementById('quest-card-container');
    if (questCard) {
      this._questCardPrevDisplay = questCard.style.display;
      questCard.style.display = 'none';
    }
  }

  closeLedgerDrawer() {
    const drawer = document.getElementById('ledger-drawer');
    const scrim = document.getElementById('ledger-drawer-scrim');
    if (drawer) drawer.classList.remove('open');
    if (scrim) scrim.classList.remove('open');

    document.body.classList.remove('hud-modal-open');
    document.body.classList.remove('hud-ledger-open');

    // 恢复任务简条
    const questCard = document.getElementById('quest-card-container');
    if (questCard && this._questCardPrevDisplay !== undefined) {
      questCard.style.display = this._questCardPrevDisplay;
      this._questCardPrevDisplay = undefined;
    }
  }

  getLedgerSummary() {
    const game = this.game || this.buildSystem?.game || window.__game;
    const ledger = this.getEconomyLedger();
    const currentDay = this.survival?.day || game?.survival?.day || 1;
    const days = ledger?.days || [];
    const todayRow = days.find(d => d.day === currentDay) || { day: currentDay, inflow: {}, outflow: {}, transfers: {} };

    // 1. 今日算力代币
    const tokenInflowMap = todayRow.inflow?.sol_token || {};
    const tokenOutflowMap = todayRow.outflow?.sol_token || {};
    let tokenInflowTotal = 0;
    for (const k in tokenInflowMap) tokenInflowTotal += Number(tokenInflowMap[k]) || 0;
    let tokenOutflowTotal = 0;
    for (const k in tokenOutflowMap) tokenOutflowTotal += Number(tokenOutflowMap[k]) || 0;
    tokenInflowTotal = Math.round(tokenInflowTotal * 1e8) / 1e8;
    tokenOutflowTotal = Math.round(tokenOutflowTotal * 1e8) / 1e8;
    const tokenNet = Math.round((tokenInflowTotal - tokenOutflowTotal) * 1e8) / 1e8;

    // 2. 今日晶石
    const crystalInflowMap = todayRow.inflow?.sol_crystal || {};
    const crystalOutflowMap = todayRow.outflow?.sol_crystal || {};
    let crystalInflowTotal = 0;
    for (const k in crystalInflowMap) crystalInflowTotal += Number(crystalInflowMap[k]) || 0;
    let crystalOutflowTotal = 0;
    for (const k in crystalOutflowMap) crystalOutflowTotal += Number(crystalOutflowMap[k]) || 0;
    crystalInflowTotal = Math.round(crystalInflowTotal * 1e8) / 1e8;
    crystalOutflowTotal = Math.round(crystalOutflowTotal * 1e8) / 1e8;
    const crystalNet = Math.round((crystalInflowTotal - crystalOutflowTotal) * 1e8) / 1e8;

    // 3. 近 7 日每日净流入
    const chartDays = [];
    const startDay = Math.max(1, currentDay - 6);
    for (let d = startDay; d <= currentDay; d++) {
      const row = days.find(r => r.day === d);
      let inflow = 0;
      let outflow = 0;
      if (row) {
        if (row.inflow?.sol_token) {
          for (const k in row.inflow.sol_token) inflow += Number(row.inflow.sol_token[k]) || 0;
        }
        if (row.outflow?.sol_token) {
          for (const k in row.outflow.sol_token) outflow += Number(row.outflow.sol_token[k]) || 0;
        }
      }
      const net = Math.round((inflow - outflow) * 1e8) / 1e8;
      chartDays.push({ day: d, net, inflow, outflow });
    }

    // 4. 会话共振统计
    let totalCommittedCrystals = 0;
    let totalRecoveredTokens = 0;
    let totalResonanceMlTokens = 0;

    for (const d of days) {
      if (d.outflow?.sol_crystal?.resonance_commit) {
        totalCommittedCrystals += Number(d.outflow.sol_crystal.resonance_commit) || 0;
      }
      if (d.inflow?.sol_token?.resonance_main) {
        totalRecoveredTokens += Number(d.inflow.sol_token.resonance_main) || 0;
      }
      if (d.inflow?.sol_token?.resonance_ml) {
        totalRecoveredTokens += Number(d.inflow.sol_token.resonance_ml) || 0;
        totalResonanceMlTokens += Number(d.inflow.sol_token.resonance_ml) || 0;
      }
    }
    totalCommittedCrystals = Math.round(totalCommittedCrystals * 1e8) / 1e8;
    totalRecoveredTokens = Math.round(totalRecoveredTokens * 1e8) / 1e8;

    const tokenEquivalent = Math.round(totalCommittedCrystals * ODDS_TABLE.V * 100) / 100;

    const ml = game?.miningRig?.motherlode || ledger?.motherlode || {};
    const mlInjected = Number(ml.injected ?? 0);
    const mlPaid = Number(ml.paid ?? totalResonanceMlTokens);
    const mlBurned = Number(ml.burned ?? 0);

    return {
      currentDay,
      today: {
        token: { inflow: tokenInflowTotal, outflow: tokenOutflowTotal, net: tokenNet, map: { inflow: tokenInflowMap, outflow: tokenOutflowMap } },
        crystal: { inflow: crystalInflowTotal, outflow: crystalOutflowTotal, net: crystalNet, map: { inflow: crystalInflowMap, outflow: crystalOutflowMap } }
      },
      chartDays,
      resonance: {
        committedCrystals: totalCommittedCrystals,
        tokenEquivalent,
        recoveredTokens: totalRecoveredTokens,
        motherlodeInjected: mlInjected,
        motherlodePaid: mlPaid,
        motherlodeBurned: mlBurned
      }
    };
  }

  renderLedgerDrawer() {
    this.initLedgerDrawer();
    const body = document.getElementById('ledger-drawer-body');
    if (!body) return;

    const summary = this.getLedgerSummary();
    const { currentDay, today, chartDays, resonance } = summary;

    const tokenItems = [];
    for (const [source, val] of Object.entries(today.token.map.inflow)) {
      if (val > 0) tokenItems.push({ key: source, label: LEDGER_LABELS[source] || source, val: `+${val}`, numVal: val, type: 'inflow' });
    }
    for (const [sink, val] of Object.entries(today.token.map.outflow)) {
      if (val > 0) tokenItems.push({ key: sink, label: LEDGER_LABELS[sink] || sink, val: `-${val}`, numVal: val, type: 'outflow' });
    }

    const crystalItems = [];
    for (const [source, val] of Object.entries(today.crystal.map.inflow)) {
      if (val > 0) crystalItems.push({ key: source, label: LEDGER_LABELS[source] || source, val: `+${val}`, numVal: val, type: 'inflow' });
    }
    for (const [sink, val] of Object.entries(today.crystal.map.outflow)) {
      if (val > 0) crystalItems.push({ key: sink, label: LEDGER_LABELS[sink] || sink, val: `-${val}`, numVal: val, type: 'outflow' });
    }

    const renderItemsHtml = (items) => {
      if (!items.length) {
        return '<div style="font-size:11px;opacity:0.65;padding:2px 0;">今日暂无明细变动</div>';
      }
      return items.map(item => `
        <span class="ledger-drawer-item" data-key="${item.key}" data-val="${item.numVal}">
          <span class="ledger-drawer-item-label">${item.label}</span>
          <span class="ledger-drawer-item-val ${item.type === 'inflow' ? 'ledger-drawer-inflow' : 'ledger-drawer-outflow'}">${item.val}</span>
        </span>
      `).join('');
    };

    const maxAbsNet = Math.max(1, ...chartDays.map(cd => Math.abs(cd.net)));
    const chartBarsHtml = chartDays.map(cd => {
      const heightPct = Math.min(100, Math.max(6, Math.round((Math.abs(cd.net) / maxAbsNet) * 100)));
      return `
        <div class="ledger-drawer-chart-col" data-day="${cd.day}" data-net="${cd.net}" title="第${cd.day}天 净流入: ${cd.net}">
          <div class="ledger-drawer-chart-val">${cd.net > 0 ? '+' : ''}${cd.net}</div>
          <div class="ledger-drawer-chart-bar-wrap">
            <div class="ledger-drawer-chart-bar" style="height:${heightPct}%;"></div>
          </div>
          <div class="ledger-drawer-chart-label">D${cd.day}</div>
        </div>
      `;
    }).join('');

    body.innerHTML = `
      <!-- 今日收支 -->
      <section class="ledger-drawer-section" id="ledger-section-today">
        <div class="ledger-drawer-section-title">
          <span>今日收支 (第 ${currentDay} 天)</span>
          <span style="font-size:11px;opacity:0.75;">按账本来源/去向记录</span>
        </div>
        <div class="ledger-drawer-card" id="ledger-card-sol-token">
          <div class="ledger-drawer-card-header">
            <div class="ledger-drawer-card-title">
              ${iconHTML('items/sol_token', 18) || '🪙'} <span>算力代币</span>
            </div>
            <div class="ledger-drawer-card-summary">
              <span class="ledger-drawer-inflow" id="ledger-token-inflow" data-val="${today.token.inflow}">+${today.token.inflow}</span>
              <span class="ledger-drawer-outflow" id="ledger-token-outflow" data-val="${today.token.outflow}">-${today.token.outflow}</span>
              <span class="ledger-drawer-net" id="ledger-token-net" data-val="${today.token.net}">净 ${today.token.net >= 0 ? '+' : ''}${today.token.net}</span>
            </div>
          </div>
          <div class="ledger-drawer-items-grid" id="ledger-token-items">
            ${renderItemsHtml(tokenItems)}
          </div>
        </div>
        <div class="ledger-drawer-card" id="ledger-card-sol-crystal">
          <div class="ledger-drawer-card-header">
            <div class="ledger-drawer-card-title">
              ${iconHTML('items/sol_crystal', 18) || '💎'} <span>晶石</span>
            </div>
            <div class="ledger-drawer-card-summary">
              <span class="ledger-drawer-inflow" id="ledger-crystal-inflow" data-val="${today.crystal.inflow}">+${today.crystal.inflow}</span>
              <span class="ledger-drawer-outflow" id="ledger-crystal-outflow" data-val="${today.crystal.outflow}">-${today.crystal.outflow}</span>
              <span class="ledger-drawer-net" id="ledger-crystal-net" data-val="${today.crystal.net}">净 ${today.crystal.net >= 0 ? '+' : ''}${today.crystal.net}</span>
            </div>
          </div>
          <div class="ledger-drawer-items-grid" id="ledger-crystal-items">
            ${renderItemsHtml(crystalItems)}
          </div>
        </div>
      </section>

      <!-- 近 7 日每日净流入 -->
      <section class="ledger-drawer-section" id="ledger-section-chart">
        <div class="ledger-drawer-section-title">
          <span>近 7 日每日净流入</span>
          <span style="font-size:11px;opacity:0.75;">算力代币 · 单色按日汇总</span>
        </div>
        <div class="ledger-drawer-card">
          <div class="ledger-drawer-chart-container" id="ledger-chart-bars">
            ${chartBarsHtml}
          </div>
        </div>
      </section>

      <!-- 共振专项 -->
      <section class="ledger-drawer-section" id="ledger-section-resonance">
        <div class="ledger-drawer-section-title">
          <span>共振专项</span>
          <span style="font-size:11px;opacity:0.75;">基准比价: 1晶石 ≈ ${ODDS_TABLE.V}代币</span>
        </div>
        <div class="ledger-drawer-card">
          <div class="ledger-drawer-resonance-row">
            <span class="ledger-drawer-resonance-label">本次会话投入晶石数</span>
            <span class="ledger-drawer-resonance-val" id="ledger-res-committed" data-val="${resonance.committedCrystals}">${resonance.committedCrystals} 晶</span>
          </div>
          <div class="ledger-drawer-resonance-row">
            <span class="ledger-drawer-resonance-label">投入折合代币</span>
            <span class="ledger-drawer-resonance-val" id="ledger-res-equiv" data-val="${resonance.tokenEquivalent}">≈ ${resonance.tokenEquivalent} 算力</span>
          </div>
          <div class="ledger-drawer-resonance-row">
            <span class="ledger-drawer-resonance-label">共振回收代币</span>
            <span class="ledger-drawer-resonance-val ledger-drawer-inflow" id="ledger-res-recovered" data-val="${resonance.recoveredTokens}">+${resonance.recoveredTokens} 算力</span>
          </div>
          <div style="height:1px;background:var(--cozy-hud-border);margin:4px 0;opacity:0.4;"></div>
          <div class="ledger-drawer-resonance-row">
            <span class="ledger-drawer-resonance-label">母晶池注入</span>
            <span class="ledger-drawer-resonance-val" id="ledger-ml-injected" data-val="${resonance.motherlodeInjected}">${resonance.motherlodeInjected} 算力</span>
          </div>
          <div class="ledger-drawer-resonance-row">
            <span class="ledger-drawer-resonance-label">母晶池派发</span>
            <span class="ledger-drawer-resonance-val" id="ledger-ml-paid" data-val="${resonance.motherlodePaid}">${resonance.motherlodePaid} 算力</span>
          </div>
          <div class="ledger-drawer-resonance-row">
            <span class="ledger-drawer-resonance-label">
              <span class="ledger-drawer-tag-sim">模拟</span> 模拟矿工分走（已销毁）
            </span>
            <span class="ledger-drawer-resonance-val ledger-drawer-outflow" id="ledger-ml-burned" data-val="${resonance.motherlodeBurned}">${resonance.motherlodeBurned} 算力</span>
          </div>
        </div>
      </section>
    `;
  }

}

export const LEDGER_LABELS = Object.freeze({
  decrypt: '矿机解密',
  resonance_main: '共振主池',
  resonance_ml: '母晶池',
  checkin: '每日签到',
  order_deliver: '订单交付',
  rig_upgrade: '矿机升级',
  scanner: '扫描仪',
  shop: '营地商城',
  ship: '船只',
  refinery: '精炼',
  vein_mine: '矿脉开采',
  tidal_spawn: '潮汐冲刷',
  flotsam_manual: '漂流拾取',
  camp_miner: '营地矿工',
  monkey_crevice: '猴子裂隙',
  initial_silo: '初始矿仓',
  shard_condense: '残晶凝聚',
  resonance_calib: '共振校准',
  resonance_free: '共振赠予',
  decrypt_consume: '矿机解密',
  resonance_commit: '共振投入',
  refinery_consume: '精炼消耗',
  lighthouse: '灯塔工程',
  resonance_shard: '共振残晶'
});

export { getSurvivalIconHtml, getWeatherIconHtml };
