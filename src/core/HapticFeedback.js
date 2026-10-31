// CastawaySOL 原生触觉震动反馈系统 (Mobile Haptics API)
class HapticFeedback {
  constructor() {
    this.supported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
    this.enabled = true;
  }

  // 1. 轻量点击反馈 (UI 按钮、切换 Tab、选中物品)
  light() {
    if (!this.supported || !this.enabled) return;
    try { navigator.vibrate(12); } catch (e) {}
  }

  // 2. 中度打击感反馈 (摇树掉落果实、踏步、喝水)
  medium() {
    if (!this.supported || !this.enabled) return;
    try { navigator.vibrate(24); } catch (e) {}
  }

  // 3. 重感反馈 (设施摆放、砍树、跳跃着地)
  heavy() {
    if (!this.supported || !this.enabled) return;
    try { navigator.vibrate(42); } catch (e) {}
  }

  // 4. 成功通关/合成/上钩大鱼清脆双震
  success() {
    if (!this.supported || !this.enabled) return;
    try { navigator.vibrate([20, 35, 30]); } catch (e) {}
  }

  // 5. 危险/警报反馈 (渴死/饿死边缘或鱼咬钩起竿提示)
  warning() {
    if (!this.supported || !this.enabled) return;
    try { navigator.vibrate([40, 40, 50, 40, 60]); } catch (e) {}
  }
}

export const haptics = new HapticFeedback();
