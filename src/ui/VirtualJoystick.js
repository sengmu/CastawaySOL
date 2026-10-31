// CastawaySOL 移动端触控摇杆与安全区适配
import { haptics } from '../core/HapticFeedback.js';

export class VirtualJoystick {
  constructor(container, onMove) {
    this.container = container || document.body;
    this.onMove = onMove;

    this.touchId = null;
    this.basePos = { x: 0, y: 0 };
    this.vector = { x: 0, y: 0 }; // [-1, 1]
    this.maxRadius = 55;          // 最大滑动半径
    this.active = false;

    this.createElements();
    this.bindEvents();
  }

  createElements() {
    const isSmallScreen = (typeof window !== 'undefined' && window.innerWidth <= 600);
    const zoneSize = isSmallScreen ? 140 : 170;
    const baseSize = isSmallScreen ? 106 : 130;
    const thumbSize = isSmallScreen ? 44 : 52;
    this.maxRadius = isSmallScreen ? 45 : 55;

    this.joystickZone = document.createElement('div');
    this.joystickZone.id = 'joystick-zone';
    this.joystickZone.style.cssText = `
      position: absolute;
      bottom: calc(16px + var(--sab, 0px));
      left: calc(16px + var(--sal, 0px));
      width: ${zoneSize}px; height: ${zoneSize}px;
      z-index: 100; touch-action: none;
      -webkit-tap-highlight-color: transparent;
      display: flex; align-items: center; justify-content: center;
    `;

    // 外环：磨砂玻璃微光环
    this.base = document.createElement('div');
    this.base.style.cssText = `
      position: relative; width: ${baseSize}px; height: ${baseSize}px; border-radius: 50%;
      background: rgba(18, 24, 28, 0.45);
      border: 2px solid rgba(255, 255, 255, 0.35);
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      pointer-events: none;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
      transition: border-color 0.15s, background 0.15s;
    `;

    // 内操纵球：高光拟物触感球
    this.thumb = document.createElement('div');
    this.thumb.style.cssText = `
      width: ${thumbSize}px; height: ${thumbSize}px; border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #ffffff, #00cec9 80%);
      box-shadow: 0 0 18px rgba(0, 206, 201, 0.75), inset 0 2px 4px rgba(255,255,255,0.9);
      border: 2px solid rgba(255, 255, 255, 0.95);
      transform: translate(0px, 0px); transition: transform 0.03s ease-out;
      will-change: transform;
    `;

    this.base.appendChild(this.thumb);
    this.joystickZone.appendChild(this.base);
    this.container.appendChild(this.joystickZone);
  }

  bindEvents() {
    this.joystickZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      this.touchId = touch.identifier;
      this.active = true;

      haptics.light();
      this.base.style.borderColor = '#00cec9';
      this.base.style.background = 'rgba(0, 206, 201, 0.2)';

      const rect = this.joystickZone.getBoundingClientRect();
      this.basePos = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      this.handleTouch(touch.clientX, touch.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!this.active) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.touchId) {
          this.handleTouch(touch.clientX, touch.clientY);
          break;
        }
      }
    }, { passive: false });

    const endHandler = (e) => {
      if (!this.active) return;
      // 若当前屏幕上已经没有任何触点，无条件复位归零
      if (!e.touches || e.touches.length === 0) {
        this.reset();
        return;
      }
      // 检查当前绑定的触点是否已结束
      let touchFound = false;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === this.touchId) {
          touchFound = true;
          break;
        }
      }
      if (!touchFound) {
        this.reset();
      }
    };

    window.addEventListener('touchend', endHandler, { passive: true });
    window.addEventListener('touchcancel', () => this.reset(), { passive: true });
    window.addEventListener('blur', () => this.reset());
  }

  handleTouch(clientX, clientY) {
    const dx = clientX - this.basePos.x;
    const dy = clientY - this.basePos.y;
    const dist = Math.hypot(dx, dy);

    if (dist === 0) {
      this.vector = { x: 0, y: 0 };
      this.thumb.style.transform = 'translate(0px, 0px)';
      if (this.onMove) this.onMove(this.vector);
      return;
    }

    const angle = Math.atan2(dy, dx);
    const clampedDist = Math.min(dist, this.maxRadius);

    const thumbX = Math.cos(angle) * clampedDist;
    const thumbY = Math.sin(angle) * clampedDist;

    this.thumb.style.transform = `translate(${thumbX}px, ${thumbY}px)`;

    // 归一化输入向量
    this.vector = {
      x: thumbX / this.maxRadius,
      y: thumbY / this.maxRadius
    };

    if (this.onMove) {
      this.onMove(this.vector);
    }
  }

  reset() {
    this.active = false;
    this.touchId = null;
    this.vector = { x: 0, y: 0 };
    this.thumb.style.transform = 'translate(0px, 0px)';
    this.base.style.borderColor = 'rgba(255, 255, 255, 0.35)';
    this.base.style.background = 'rgba(18, 24, 28, 0.45)';
    if (this.onMove) {
      this.onMove(this.vector);
    }
  }
}
