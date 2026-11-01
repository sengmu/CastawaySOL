// CastawaySOL 现代化移动端动态浮动虚拟摇杆 (Dynamic Floating Virtual Joystick)
// 1. 支持屏幕左半区盲操按下即时呼出，落点即中心，大幅提升横屏操作盲操舒适度
// 2. 具备动态跟随算法 (Dynamic Follow)：手指长距离拖曳时底盘顺畅平移，彻底避免滑行脱手
// 3. 0.08 径向滤波死区 (Deadzone) 与二次方渐进响应曲线，微推走位对准精准，推满奔跑敏捷
// 4. 全局触控安全自愈守护，多指交互或异常失焦时 100% 无残留复位归零
import { haptics } from '../core/HapticFeedback.js';

export class VirtualJoystick {
  constructor(container, onMove) {
    this.container = container || document.body;
    this.onMove = onMove;

    this.touchId = null;
    this.active = false;

    // 摇杆物理尺寸参数 (竖屏直径上限 min(30vw, 120px)，即最大半径 60px)
    this.isSmallScreen = (typeof window !== 'undefined' && window.innerWidth <= 640);
    const maxAllowedRadius = (typeof window !== 'undefined') ? Math.min(window.innerWidth * 0.15, 60) : 56;
    const isPortrait = typeof window !== 'undefined' && window.innerWidth < window.innerHeight;
    this.baseRadius = isPortrait ? Math.min(this.isSmallScreen ? 54 : 64, maxAllowedRadius) : Math.min(90, window.innerHeight * 0.13); // 底盘半径
    this.maxRadius = this.baseRadius * 0.88;             // 最大推移半径
    this.thumbRadius = this.baseRadius * 0.42;           // 摇杆球半径
    this.deadZone = 0.08;                                // 死区防指尖微颤 (0~1)
    this.followThreshold = this.maxRadius * 1.35;        // 动态跟随阈值

    // 默认待机锚定坐标 (左下角)
    this.defaultAnchor = { x: 0, y: 0 };
    this.basePos = { x: 0, y: 0 };
    this.vector = { x: 0, y: 0 }; // 归一化输入 [-1, 1]

    this.createElements();
    this.bindEvents();
    this.updateDefaultAnchor();

    window.addEventListener('resize', () => {
      this.updateDefaultAnchor();
    });
  }

  // 计算屏幕左下角的默认静息驻留位（支持竖屏与横屏单手拇指人体工程学优化）
  updateDefaultAnchor() {
    const isPortrait = window.innerWidth < window.innerHeight;
    // 结合 CSS safe-area-inset
    const sal = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sal')) || 0;
    const sab = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0;

    // 严密贴合安全区：左侧与底部保留舒适留白
    const safeLeftMargin = Math.max(16, sal + 8);
    const safeBottomMargin = Math.max(16, sab + 8);

    // 动态限制底盘半径
    if (isPortrait && typeof window !== 'undefined') {
      const maxAllowedRadius = Math.min(window.innerWidth * 0.15, 60);
      this.baseRadius = Math.min(this.isSmallScreen ? 54 : 64, maxAllowedRadius);
      this.maxRadius = this.baseRadius * 0.88;
      this.thumbRadius = this.baseRadius * 0.42;
      if (this.base) {
        this.base.style.width = `${this.baseRadius * 2}px`;
        this.base.style.height = `${this.baseRadius * 2}px`;
      }
    } else {
      // 横屏下基座半径约 48~52px（直径约 100px），精巧舒适不挡视野
      this.baseRadius = Math.min(52, Math.max(44, window.innerHeight * 0.13));
      this.maxRadius = this.baseRadius * 0.88;
      this.thumbRadius = this.baseRadius * 0.42;
      if (this.base) {
        this.base.style.width = `${this.baseRadius * 2}px`;
        this.base.style.height = `${this.baseRadius * 2}px`;
        const ring = this.base.firstElementChild;
        if (ring) {
          ring.style.width = `${this.baseRadius * 1.4}px`;
          ring.style.height = `${this.baseRadius * 1.4}px`;
        }
      }
      if (this.thumb) {
        this.thumb.style.width = `${this.thumbRadius * 2}px`;
        this.thumb.style.height = `${this.thumbRadius * 2}px`;
      }
    }

    // 横屏下摇杆垂直中心距底边贴合左手拇指自然握持区（距底约 75~85px），与右侧动作区对称，绝不浮到屏幕中上方
    const centerYFromBottom = isPortrait ? (Math.max(16, sab) + this.baseRadius) : (safeBottomMargin + this.baseRadius + 14);
    const centerXFromLeft = isPortrait ? (Math.max(12, sal) + this.baseRadius + 6) : (safeLeftMargin + this.baseRadius + 18);

    this.defaultAnchor = {
      x: centerXFromLeft,
      y: window.innerHeight - centerYFromBottom
    };

    if (this.touchZone) {
      // 触控感应区：覆盖左侧舒适操作区，避开顶部导航
      const topOffset = isPortrait ? Math.max(140, window.innerHeight * 0.35) : Math.max(55, window.innerHeight * 0.22);
      const zoneHeight = window.innerHeight - topOffset;
      const zoneWidth = isPortrait ? 58 : 48;
      this.touchZone.style.top = topOffset + 'px';
      this.touchZone.style.height = zoneHeight + 'px';
      this.touchZone.style.width = zoneWidth + 'vw';
    }

    if (!this.active) {
      this.setVisualPosition(this.defaultAnchor.x, this.defaultAnchor.y, false);
    }
  }

  createElements() {
    // 1. 全局感应层：占据整个屏幕左侧半区 (除去顶部状态栏约 60px 和底部快捷栏区域)
    this.touchZone = document.createElement('div');
    this.touchZone.id = 'virtual-joystick-touch-zone';
    this.touchZone.style.cssText = `
      position: absolute;
      top: 55px;
      left: 0;
      width: 48vw;
      height: calc(100vh - 55px);
      z-index: 95;
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      -webkit-user-select: none;
      pointer-events: auto;
    `;

    // 2. 摇杆外盘基座 (带有外环渐变、磨砂流光)
    const baseDiameter = this.baseRadius * 2;
    this.base = document.createElement('div');
    this.base.id = 'joystick-base';
    this.base.style.cssText = `
      position: absolute;
      width: ${baseDiameter}px;
      height: ${baseDiameter}px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(16, 26, 34, 0.45) 0%, rgba(8, 14, 18, 0.65) 100%);
      border: 2px solid rgba(0, 206, 201, 0.35);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), inset 0 0 20px rgba(0, 206, 201, 0.15);
      opacity: 0.55;
      transform: translate(-50%, -50%) scale(0.92);
      transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                  transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                  border-color 0.2s, box-shadow 0.2s;
      will-change: transform, left, top, opacity;
      z-index: 96;
    `;

    // 基座内饰环刻度
    const innerRing = document.createElement('div');
    innerRing.style.cssText = `
      position: absolute;
      width: ${this.baseRadius * 1.4}px;
      height: ${this.baseRadius * 1.4}px;
      border-radius: 50%;
      border: 1px dashed rgba(255, 255, 255, 0.2);
      pointer-events: none;
    `;
    this.base.appendChild(innerRing);

    // 3. 摇杆拇指操作滑块 (立体高光白瓷/青玉色)
    const thumbDiameter = this.thumbRadius * 2;
    this.thumb = document.createElement('div');
    this.thumb.id = 'joystick-thumb';
    this.thumb.style.cssText = `
      position: absolute;
      width: ${thumbDiameter}px;
      height: ${thumbDiameter}px;
      border-radius: 50%;
      background: radial-gradient(circle at 36% 32%, #ffffff 0%, #00cec9 65%, #0984e3 100%);
      box-shadow: 0 0 22px rgba(0, 206, 201, 0.85), inset 0 2px 4px rgba(255, 255, 255, 0.95), 0 4px 12px rgba(0, 0, 0, 0.3);
      border: 2px solid rgba(255, 255, 255, 0.95);
      transform: translate(0px, 0px);
      pointer-events: none;
      will-change: transform;
      z-index: 97;
    `;

    // 操纵球中心触感微光点
    const thumbDot = document.createElement('div');
    thumbDot.style.cssText = `
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 0 6px #ffffff;
      margin: auto;
      margin-top: calc(50% - 3.5px);
    `;
    this.thumb.appendChild(thumbDot);

    this.base.appendChild(this.thumb);
    this.container.appendChild(this.touchZone);
    this.container.appendChild(this.base);
  }

  // 移动底盘视觉位置
  setVisualPosition(x, y, isActivated = false) {
    this.base.style.left = `${x}px`;
    this.base.style.top = `${y}px`;

    if (isActivated) {
      this.base.style.opacity = '0.96';
      this.base.style.transform = 'translate(-50%, -50%) scale(1.05)';
      this.base.style.borderColor = 'rgba(0, 206, 201, 0.85)';
      this.base.style.boxShadow = '0 10px 36px rgba(0, 206, 201, 0.4), inset 0 0 24px rgba(0, 206, 201, 0.3)';
    } else {
      this.base.style.opacity = '0.45';
      this.base.style.transform = 'translate(-50%, -50%) scale(0.92)';
      this.base.style.borderColor = 'rgba(0, 206, 201, 0.3)';
      this.base.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.45), inset 0 0 20px rgba(0, 206, 201, 0.15)';
    }
  }

  bindEvents() {
    // 1. 手指在左半屏感应区触碰
    this.touchZone.addEventListener('touchstart', (e) => {
      // 若已有一个激活的手指正在操控摇杆，忽略后续额外触点（避免双指混乱）
      if (this.active) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      // 避免误触左侧快捷栏等浮层
      const targetElem = document.elementFromPoint(touch.clientX, touch.clientY);
      if (targetElem && targetElem.closest('.bottom-quick-bar, .hud-nav-item, button, .aux-btn, .modal-backdrop')) {
        return;
      }

      e.preventDefault();

      this.touchId = touch.identifier;
      this.active = true;

      // 以手指触摸坐标为中心动态定点呼出摇杆！
      this.basePos = { x: touch.clientX, y: touch.clientY };
      this.setVisualPosition(touch.clientX, touch.clientY, true);

      // 微触感反馈
      haptics.light();

      // 立即计算初始触碰点（通常为原地 0）
      this.handleTouchMove(touch.clientX, touch.clientY);
    }, { passive: false });

    // 2. 窗口级全屏监听手指移动（手指划出左半区时依然可以平滑操作）
    window.addEventListener('touchmove', (e) => {
      if (!this.active || this.touchId === null) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.touchId) {
          this.handleTouchMove(touch.clientX, touch.clientY);
          break;
        }
      }
    }, { passive: false });

    // 3. 稳健的触摸结束与丢失保护
    const onTouchEndOrCancel = (e) => {
      if (!this.active) return;

      // 若屏幕上所有触点已离开，立即强行复位
      if (!e.touches || e.touches.length === 0) {
        this.reset();
        return;
      }

      // 检查当前操控手指是否包含在结束列表中
      let touchEnded = false;
      if (e.changedTouches) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.touchId) {
            touchEnded = true;
            break;
          }
        }
      }

      // 如果当前 touchId 已经不在屏幕现存触点中，亦确认复位
      let touchStillAlive = false;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === this.touchId) {
          touchStillAlive = true;
          break;
        }
      }

      if (touchEnded || !touchStillAlive) {
        this.reset();
      }
    };

    window.addEventListener('touchend', onTouchEndOrCancel, { passive: true });
    window.addEventListener('touchcancel', onTouchEndOrCancel, { passive: true });

    // 4. 关键：窗口失焦、Tab 切换、弹窗呼出时 100% 自动清空
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
  }

  // 核心滑动与动态跟手运算
  handleTouchMove(clientX, clientY) {
    let dx = clientX - this.basePos.x;
    let dy = clientY - this.basePos.y;
    let dist = Math.hypot(dx, dy);

    if (dist === 0) {
      this.vector = { x: 0, y: 0 };
      this.thumb.style.transform = 'translate(0px, 0px)';
      if (this.onMove) this.onMove(this.vector);
      return;
    }

    const angle = Math.atan2(dy, dx);

    // 【动态跟手算法 (Dynamic Follow)】
    // 如果手指拖动距离超过跟手阈值，底盘随着手指顺滑平移，防止手指拉得过远脱手失控
    if (dist > this.followThreshold) {
      const excess = dist - this.followThreshold;
      this.basePos.x += Math.cos(angle) * excess;
      this.basePos.y += Math.sin(angle) * excess;
      this.base.style.left = `${this.basePos.x}px`;
      this.base.style.top = `${this.basePos.y}px`;

      // 重新修正 dx, dy, dist
      dx = clientX - this.basePos.x;
      dy = clientY - this.basePos.y;
      dist = Math.hypot(dx, dy);
    }

    // 限制拇指滑块在最大物理半径之内
    const clampedDist = Math.min(dist, this.maxRadius);
    const thumbX = Math.cos(angle) * clampedDist;
    const thumbY = Math.sin(angle) * clampedDist;

    this.thumb.style.transform = `translate(${thumbX}px, ${thumbY}px)`;

    // 【死区与二次方平滑加速响应曲线】
    const normalizedRatio = clampedDist / this.maxRadius; // 0 ~ 1.0

    if (normalizedRatio <= this.deadZone) {
      // 死区内：过滤手指微小抖动，角色保持静止
      this.vector = { x: 0, y: 0 };
    } else {
      // 重新映射死区外部为 0 ~ 1.0
      const activeRange = (normalizedRatio - this.deadZone) / (1.0 - this.deadZone);
      // 引入平滑曲线：低推力更轻柔，满推力直达峰值
      const smoothCurve = Math.pow(activeRange, 1.15);

      this.vector = {
        x: Math.cos(angle) * smoothCurve,
        y: Math.sin(angle) * smoothCurve
      };
    }

    if (this.onMove) {
      this.onMove(this.vector);
    }
  }

  // 释放复位
  reset() {
    this.active = false;
    this.touchId = null;
    this.vector = { x: 0, y: 0 };

    // 操纵球平滑弹回中心
    this.thumb.style.transition = 'transform 0.18s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
    this.thumb.style.transform = 'translate(0px, 0px)';
    setTimeout(() => {
      if (!this.active) {
        this.thumb.style.transition = '';
      }
    }, 200);

    // 基座平滑回弹到默认待机锚点
    this.basePos = { x: this.defaultAnchor.x, y: this.defaultAnchor.y };
    this.setVisualPosition(this.defaultAnchor.x, this.defaultAnchor.y, false);

    if (this.onMove) {
      this.onMove(this.vector);
    }
  }

  // 外部主动销毁或刷新
  destroy() {
    if (this.touchZone && this.touchZone.parentNode) {
      this.touchZone.parentNode.removeChild(this.touchZone);
    }
    if (this.base && this.base.parentNode) {
      this.base.parentNode.removeChild(this.base);
    }
  }
}

