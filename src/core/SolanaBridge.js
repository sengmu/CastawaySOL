// Solana Mobile Stack (MWA) & Seeker 生态集成模块
import {
  Connection,
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram
} from '@solana/web3.js';
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache
} from '@solana-mobile/wallet-adapter-mobile';

// 安装针对 Android WebView / Capacitor 环境的 MWA 协议桥接补丁
function installMwaWebViewBridge() {
  if (typeof window === 'undefined') return;
  if (window.__mwa_bridge_installed) return;
  window.__mwa_bridge_installed = true;

  try {
    const origAssign = window.location.assign.bind(window.location);
    window.location.assign = function(url) {
      const urlStr = String(url || '');
      if (urlStr.startsWith('solana-wallet:') || urlStr.startsWith('solana:')) {
        console.log('📱 [SolanaBridge] 捕获到 MWA 协议跳转:', urlStr.slice(0, 50) + '...');
        // 关键：在下一个事件循环触发 window.blur，使 MWA getDetectionPromise 立即完成探针校验，避免 3000ms 伪超时
        setTimeout(() => {
          console.log('📱 [SolanaBridge] 主动派发 window.blur 事件响应 MWA 探针');
          window.dispatchEvent(new Event('blur'));
        }, 80);
      }
      return origAssign(url);
    };
  } catch (e) {
    console.warn('⚠️ 劫持 location.assign 失败:', e);
  }
}

export class SolanaBridge {
  constructor() {
    this.walletAddress = null;
    this.publicKey = null;
    this.isConnected = false;
    this.network = 'devnet';
    this.rpcUrl = clusterApiUrl('devnet');
    this.connection = new Connection(this.rpcUrl, 'confirmed');
    this.balance = 0;
    this.isMWA = false;
    this.isGuest = false;
    this.adapter = null;
    this.leaderboard = [];

    // 检测是否为 Seeker / 原生移动设备环境
    this.isSeeker = this.detectSeekerDevice();

    // 初始化 MWA 适配器
    this.initMWA();

    // 载入本地缓存状态
    this.loadState();
  }

  detectSeekerDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    // 包含 seeker, solana, 或 capacitor android 原生环境标识
    return ua.includes('seeker') || ua.includes('solana') || (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform());
  }

  initMWA() {
    installMwaWebViewBridge();
    try {
      this.adapter = new SolanaMobileWalletAdapter({
        addressSelector: createDefaultAddressSelector(),
        appIdentity: {
          name: 'CastawaySOL',
          uri: 'https://castawaysol.game',
          icon: 'https://castawaysol.game/icon.png'
        },
        authorizationResultCache: createDefaultAuthorizationResultCache(),
        chain: 'solana:devnet',
        onWalletNotFound: async (adapter) => {
          console.warn('⚠️ [SolanaBridge] onWalletNotFound 回调被触发');
        }
      });
    } catch (e) {
      console.warn('⚠️ [SolanaBridge] MWA 初始化降级:', e);
    }
  }

  loadState() {
    try {
      const saved = localStorage.getItem('castaway_sol_wallet');
      if (saved) {
        const data = JSON.parse(saved);
        this.walletAddress = data.address;
        this.isGuest = Boolean(data.isGuest);
        this.isMWA = Boolean(data.isMWA);
        if (this.walletAddress && !this.isGuest) {
          try {
            this.publicKey = new PublicKey(this.walletAddress);
          } catch (e) {}
        }
        this.isConnected = true;
        // 异步查询真实 Devnet 余额
        this.fetchBalance();
      }
    } catch (e) {
      console.warn('读取本地钱包存储异常:', e);
    }
  }

  // 获取 Devnet 真实链上余额
  async fetchBalance() {
    if (!this.publicKey || this.isGuest) {
      this.balance = 0;
      return 0;
    }
    try {
      const lamports = await this.connection.getBalance(this.publicKey);
      this.balance = lamports / LAMPORTS_PER_SOL;
      return this.balance;
    } catch (err) {
      console.warn('获取 Devnet 余额失败:', err);
      return this.balance;
    }
  }

  // 向 Solana Devnet 水龙头申请 1.0 SOL 测试币
  async requestAirdrop() {
    if (!this.publicKey || this.isGuest) {
      return { success: false, message: '请先连接真实 Solana 钱包 (非游客模式)' };
    }
    try {
      console.log('向 Devnet 申请空投 1 SOL...');
      const sig = await this.connection.requestAirdrop(this.publicKey, 1 * LAMPORTS_PER_SOL);
      await this.connection.confirmTransaction(sig, 'confirmed');
      await this.fetchBalance();
      return { success: true, balance: this.balance, txSig: sig };
    } catch (err) {
      console.error('Devnet 空投请求异常:', err);
      return { success: false, message: err.message || '网络繁忙，请稍后再试' };
    }
  }

  // 连接 Solana 钱包 (MWA 优先唤起 Seed Vault / Phantom -> Injected -> 游客模拟)
  async connectWallet(preferType = 'auto') {
    // 1. 尝试使用 Solana Mobile Wallet Adapter (唤起真机 Seed Vault / Phantom / Backpack)
    if (this.adapter && (preferType === 'mwa' || preferType === 'auto')) {
      try {
        console.log('📱 正在通过 Solana Mobile Wallet Adapter (MWA) 唤起原生钱包...');
        await this.adapter.connect();
        if (this.adapter.publicKey) {
          this.publicKey = this.adapter.publicKey;
          this.walletAddress = this.publicKey.toBase58();
          this.isConnected = true;
          this.isMWA = true;
          this.isGuest = false;
          localStorage.setItem('castaway_sol_wallet', JSON.stringify({
            address: this.walletAddress,
            isMWA: true,
            isGuest: false
          }));
          await this.fetchBalance();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('solana-wallet-changed'));
          }
          return {
            success: true,
            address: this.walletAddress,
            type: 'MWA (Solana Mobile / Seed Vault)',
            balance: this.balance
          };
        }
      } catch (mwaErr) {
        console.warn('⚠️ MWA 唤起未完成或用户取消:', mwaErr);
        if (preferType === 'mwa') {
          const errMsg = mwaErr.message || '';
          let userTip = '连接未完成或已被取消';
          if (errMsg.includes('ERROR_WALLET_NOT_FOUND') || errMsg.includes('no installed wallet')) {
            userTip = '未检测到可用钱包，请确保已安装 Phantom 并在弹出菜单中授权';
          } else if (errMsg.includes('rejected') || errMsg.includes('cancelled') || errMsg.includes('User rejected')) {
            userTip = '您已取消本次钱包授权';
          }
          return { success: false, message: userTip, originalError: errMsg };
        }
      }
    }

    // 2. 尝试标准浏览器注入式钱包 (如桌面 Chrome Phantom / Backpack 插件)
    if (typeof window !== 'undefined' && window.solana && (preferType === 'injected' || preferType === 'auto')) {
      try {
        console.log('💻 正在尝试连接浏览器扩展钱包...');
        const resp = await window.solana.connect();
        this.walletAddress = resp.publicKey.toString();
        this.publicKey = new PublicKey(this.walletAddress);
        this.isConnected = true;
        this.isMWA = false;
        this.isGuest = false;
        localStorage.setItem('castaway_sol_wallet', JSON.stringify({
          address: this.walletAddress,
          isMWA: false,
          isGuest: false
        }));
        await this.fetchBalance();
        return {
          success: true,
          address: this.walletAddress,
          type: 'Browser Injected (Phantom)',
          balance: this.balance
        };
      } catch (extErr) {
        console.warn('浏览器插件钱包连接异常:', extErr);
      }
    }

    // 3. 降级为游客试玩模式 (生成确定性本地公钥，免安装即玩)
    const randomHex = Array.from({ length: 4 }, () => Math.random().toString(36).substring(2, 6)).join('');
    this.walletAddress = `SEEKER_${randomHex.toUpperCase()}`;
    this.publicKey = null;
    this.isConnected = true;
    this.isMWA = false;
    this.isGuest = true;
    this.balance = 5.0; // 游客试玩赠送虚拟试玩币
    localStorage.setItem('castaway_sol_wallet', JSON.stringify({
      address: this.walletAddress,
      isMWA: false,
      isGuest: true
    }));
    return {
      success: true,
      address: this.walletAddress,
      isGuest: true,
      type: 'Guest Mode (游客试玩模式)',
      balance: this.balance
    };
  }

  // 断开连接
  async disconnect() {
    if (this.adapter && this.isMWA) {
      try {
        await this.adapter.disconnect();
      } catch (e) {}
    }
    this.walletAddress = null;
    this.publicKey = null;
    this.isConnected = false;
    this.isMWA = false;
    this.isGuest = false;
    this.balance = 0;
    localStorage.removeItem('castaway_sol_wallet');
  }

  // 链上生存打卡签到 (调用硬件私钥对签到存证签名)
  async signSurvivalCheckin(day, steps) {
    const timestamp = Date.now();
    const messageStr = `CastawaySOL Survival Checkin\nDay: ${day}\nSteps: ${steps}\nTime: ${new Date(timestamp).toISOString()}\nDevice: Solana Seeker`;
    const messageBytes = new TextEncoder().encode(messageStr);

    if (this.isMWA && this.adapter && this.adapter.connected) {
      try {
        console.log('📱 正在唤起 Seed Vault / 钱包进行硬件级消息签名...');
        const signatureBytes = await this.adapter.signMessage(messageBytes);
        const signatureHex = Array.from(signatureBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const record = {
          day,
          steps,
          timestamp,
          signature: signatureHex.substring(0, 32) + '...',
          isHardwareSigned: true,
          signer: this.walletAddress
        };
        this.saveCheckinRecord(record);
        return { success: true, record, hardwareSigned: true };
      } catch (err) {
        console.warn('MWA 签名未完成:', err);
        return { success: false, message: err.message || '签名被取消' };
      }
    } else if (typeof window !== 'undefined' && window.solana?.signMessage && !this.isGuest) {
      try {
        const resp = await window.solana.signMessage(messageBytes, 'utf8');
        const record = {
          day,
          steps,
          timestamp,
          signature: resp.signature ? '0x' + Array.from(resp.signature).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32) : 'signed',
          isHardwareSigned: false,
          signer: this.walletAddress
        };
        this.saveCheckinRecord(record);
        return { success: true, record, hardwareSigned: false };
      } catch (err) {
        return { success: false, message: err.message };
      }
    } else {
      // 游客模式纯本地签名记录
      const record = {
        day,
        steps,
        timestamp,
        signature: 'LOCAL_SIG_' + Math.random().toString(36).substring(2, 12).toUpperCase(),
        isHardwareSigned: false,
        signer: this.walletAddress,
        isGuest: true
      };
      this.saveCheckinRecord(record);
      return { success: true, record, hardwareSigned: false, isGuest: true };
    }
  }

  saveCheckinRecord(record) {
    try {
      const records = JSON.parse(localStorage.getItem('castaway_sol_checkins') || '[]');
      records.unshift(record);
      if (records.length > 20) records.pop();
      localStorage.setItem('castaway_sol_checkins', JSON.stringify(records));
    } catch (e) {}
  }

  getCheckinRecords() {
    try {
      return JSON.parse(localStorage.getItem('castaway_sol_checkins') || '[]');
    } catch (e) {
      return [];
    }
  }

  // 生成荒岛生还证书 (逃脱结算)
  async mintEscapeCertificate(gameStats) {
    const certData = {
      title: "Castaway SOL 荒岛幸存者官方证书",
      recipient: this.walletAddress || "Guest_Explorer",
      survivedDays: gameStats.day,
      ending: gameStats.endingName || "扬帆远航 (Raft Escape)",
      steps: gameStats.steps,
      timestamp: new Date().toISOString(),
      device: this.isSeeker ? 'Solana Seeker 硬件认证' : 'Web/Hybrid',
      attributes: [
        { trait_type: "Survival Days", value: gameStats.day },
        { trait_type: "Ending", value: gameStats.endingName },
        { trait_type: "Tier", value: gameStats.day >= 10 ? "Legendary Castaway" : "Skilled Survivor" },
        { trait_type: "Network", value: this.network }
      ]
    };

    console.log("📜 生成荒岛幸存者官方证书数据:", certData);
    return {
      success: true,
      mintId: `SOL_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      metadata: certData
    };
  }

  // 提交成绩至赛季榜
  submitLeaderboard(days, ending) {
    const record = {
      address: this.walletAddress ? `${this.walletAddress.substring(0, 4)}...${this.walletAddress.slice(-4)}` : "匿名岛民",
      days: days,
      ending: ending,
      date: new Date().toLocaleDateString(),
      device: this.isSeeker ? 'Seeker 📱' : 'Web 💻'
    };
    this.leaderboard.push(record);
    this.leaderboard.sort((a, b) => b.days - a.days);
    return record;
  }

  // 提交 DePIN 绿色矿机算力工作证明
  submitMiningProof(blocks, totalSol) {
    const proof = {
      wallet: this.walletAddress || "Guest_Miner",
      blocks: blocks,
      totalSol: totalSol,
      timestamp: Date.now(),
      isSeeker: this.isSeeker
    };
    try {
      localStorage.setItem('castaway_sol_mining_proof', JSON.stringify(proof));
    } catch (e) {}
    console.log("⛏️ [SolanaBridge] 算力区块记录更新:", proof);
    return proof;
  }

  getMiningStats() {
    try {
      const raw = localStorage.getItem('castaway_sol_mining_proof');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { wallet: this.walletAddress || "Guest_Miner", blocks: 0, totalSol: 0, isSeeker: this.isSeeker };
  }
}

export const solanaBridge = new SolanaBridge();
