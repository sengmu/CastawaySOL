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
  if (typeof window === 'undefined' || !window.location || typeof window.location.assign !== 'function') return;
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

    // 官方国库/收款地址配置项 (默认为空；为空时严格禁用真实与沙盒支付通道，绝不使用占位假地址)
    this.treasuryAddress = null;

    // 检测是否为 Seeker / 原生移动设备环境
    this.isSeeker = this.detectSeekerDevice();

    // 监听与外部通信事件绑定
    this.bindEvents();

    // 初始化 MWA 适配器
    this.initMWA();

    // 载入本地缓存状态
    this.loadState();
  }

  // 切换网络 (devnet | testnet - 主网已全局锁死拦截)
  setNetwork(net = 'devnet') {
    if (net === 'mainnet' || net === 'mainnet-beta') {
      console.warn('⛔ [SolanaBridge] 主网已锁死，禁止接入 mainnet');
      throw new Error('主网已锁死禁用，仅支持 Devnet / Testnet');
    }
    if (this.network === net) return;
    this.network = net;
    this.rpcUrl = clusterApiUrl(net);
    this.connection = new Connection(this.rpcUrl, 'confirmed');
    console.log(`🌐 [SolanaBridge] 网络已切换至: ${net}`);
    this.fetchBalance();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('solana-wallet-changed'));
    }
  }

  // 配置官方国库/收款地址
  setTreasuryAddress(address) {
    if (!address || typeof address !== 'string' || !address.trim()) {
      this.treasuryAddress = null;
      return;
    }
    try {
      new PublicKey(address.trim());
      this.treasuryAddress = address.trim();
    } catch (e) {
      console.warn('⚠️ [SolanaBridge] 收款地址格式无效:', address);
      this.treasuryAddress = null;
    }
  }

  getTreasuryAddress() {
    return this.treasuryAddress;
  }

  // 获取可用钱包提供商清单及当前可用性状态
  getAvailableWallets() {
    const list = [];
    const hasWindow = typeof window !== 'undefined';

    // 1. Solana Mobile Wallet Adapter (Seed Vault / Mobile Wallet)
    const isMobile = this.detectMobileDevice();
    list.push({
      id: 'mwa',
      name: 'Seed Vault / 原生移动钱包',
      icon: '📱',
      badge: 'Solana Mobile',
      available: Boolean(this.adapter && (isMobile || this.isSeeker)),
      recommended: this.isSeeker || isMobile,
      description: '支持 Solana Seeker / Saga 原生硬件私钥库与移动钱包授权'
    });

    // 2. Phantom 钱包 (浏览器插件或深度注入)
    const hasPhantom = hasWindow && Boolean(window.phantom?.solana?.isPhantom || window.solana?.isPhantom);
    list.push({
      id: 'phantom',
      name: 'Phantom 钱包',
      icon: '👻',
      badge: hasPhantom ? '已就绪' : '扩展插件',
      available: hasPhantom,
      recommended: !this.isSeeker && !isMobile && hasPhantom,
      description: '主流 Solana 官方扩展钱包，支持即时签名与资产查验'
    });

    // 3. Backpack 钱包
    const hasBackpack = hasWindow && Boolean(window.backpack?.isBackpack);
    list.push({
      id: 'backpack',
      name: 'Backpack 钱包',
      icon: '🎒',
      badge: hasBackpack ? '已就绪' : 'xNFT 钱包',
      available: hasBackpack,
      recommended: false,
      description: '新一代加密资产与 xNFT 原生应用钱包'
    });

    // 4. 通用 Injected 扩展钱包
    const hasGeneralInjected = hasWindow && Boolean(window.solana && !hasPhantom);
    if (hasGeneralInjected) {
      list.push({
        id: 'injected',
        name: 'Injected Solana 钱包',
        icon: '💻',
        badge: '浏览器注入',
        available: true,
        recommended: false,
        description: '标准 EIP/Solana 浏览器注入式钱包'
      });
    }

    // 5. 游客体验模式
    list.push({
      id: 'guest',
      name: '免钱包游客试玩',
      icon: '👤',
      badge: '离线沙盒',
      available: true,
      recommended: false,
      description: '生成确定性本地沙盒密钥，无门槛体验荒岛求生与矿机出块'
    });

    return list;
  }

  detectMobileDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    return /android|iphone|ipad|ipod|mobile/i.test(ua) || (typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform()));
  }

  bindEvents() {
    if (typeof window === 'undefined') return;

    // 监听注入式钱包账户切换与断开
    if (window.solana && typeof window.solana.on === 'function') {
      window.solana.on('accountChanged', (publicKey) => {
        if (publicKey) {
          console.log('🔄 [SolanaBridge] 监测到钱包账户变更:', publicKey.toBase58());
          this.publicKey = publicKey;
          this.walletAddress = publicKey.toBase58();
          this.fetchBalance();
          window.dispatchEvent(new CustomEvent('solana-wallet-changed'));
        } else {
          this.disconnect();
        }
      });
      window.solana.on('disconnect', () => {
        console.log('🔌 [SolanaBridge] 钱包已断开连接');
        this.disconnect();
      });
    }
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
      if (typeof localStorage === 'undefined') return;
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

  // 连接指定类型的钱包 ('mwa' | 'phantom' | 'backpack' | 'injected' | 'guest' | 'auto')
  async connectWallet(preferType = 'auto') {
    const hasWindow = typeof window !== 'undefined';

    // 1. 游客模式直连
    if (preferType === 'guest') {
      const randomHex = Array.from({ length: 4 }, () => Math.random().toString(36).substring(2, 6)).join('');
      this.walletAddress = `SEEKER_${randomHex.toUpperCase()}`;
      this.publicKey = null;
      this.isConnected = true;
      this.isMWA = false;
      this.isGuest = true;
      this.balance = 5.0; // 游客试玩赠送虚拟试玩币
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('castaway_sol_wallet', JSON.stringify({
          address: this.walletAddress,
          isMWA: false,
          isGuest: true
        }));
      }
      if (hasWindow) {
        window.dispatchEvent(new CustomEvent('solana-wallet-changed'));
      }
      return {
        success: true,
        address: this.walletAddress,
        isGuest: true,
        type: '免钱包游客试玩',
        balance: this.balance
      };
    }

    // 2. 指定或优先尝试 Solana Mobile Wallet Adapter (MWA)
    if (this.adapter && (preferType === 'mwa' || (preferType === 'auto' && (this.isSeeker || this.detectMobileDevice())))) {
      try {
        console.log('📱 [SolanaBridge] 正在通过 MWA 唤起移动钱包 / Seed Vault...');
        await this.adapter.connect();
        if (this.adapter.publicKey) {
          this.publicKey = this.adapter.publicKey;
          this.walletAddress = this.publicKey.toBase58();
          this.isConnected = true;
          this.isMWA = true;
          this.isGuest = false;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('castaway_sol_wallet', JSON.stringify({
              address: this.walletAddress,
              isMWA: true,
              isGuest: false
            }));
          }
          await this.fetchBalance();
          if (hasWindow) {
            window.dispatchEvent(new CustomEvent('solana-wallet-changed'));
          }
          return {
            success: true,
            address: this.walletAddress,
            type: 'Solana Mobile (Seed Vault)',
            balance: this.balance
          };
        }
      } catch (mwaErr) {
        console.warn('⚠️ MWA 唤起未完成或用户取消:', mwaErr);
        if (preferType === 'mwa') {
          const errMsg = mwaErr.message || '';
          let userTip = '连接未完成或已被取消';
          if (errMsg.includes('ERROR_WALLET_NOT_FOUND') || errMsg.includes('no installed wallet')) {
            userTip = '未检测到可用手机钱包，请安装 Phantom 或使用免钱包试玩';
          } else if (errMsg.includes('rejected') || errMsg.includes('cancelled') || errMsg.includes('User rejected')) {
            userTip = '您已取消本次钱包授权';
          }
          return { success: false, message: userTip, originalError: errMsg };
        }
      }
    }

    // 3. Phantom 钱包扩展
    if (hasWindow && (preferType === 'phantom' || preferType === 'auto')) {
      const phantomProvider = window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null);
      if (phantomProvider) {
        try {
          console.log('👻 [SolanaBridge] 尝试连接 Phantom 钱包...');
          const resp = await phantomProvider.connect();
          const pubkey = resp.publicKey || phantomProvider.publicKey;
          if (pubkey) {
            this.publicKey = pubkey;
            this.walletAddress = pubkey.toBase58();
            this.isConnected = true;
            this.isMWA = false;
            this.isGuest = false;
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('castaway_sol_wallet', JSON.stringify({
                address: this.walletAddress,
                isMWA: false,
                isGuest: false
              }));
            }
            await this.fetchBalance();
            window.dispatchEvent(new CustomEvent('solana-wallet-changed'));
            return {
              success: true,
              address: this.walletAddress,
              type: 'Phantom 钱包',
              balance: this.balance
            };
          }
        } catch (phantomErr) {
          console.warn('Phantom 连接异常:', phantomErr);
          if (preferType === 'phantom') {
            return { success: false, message: phantomErr.message || '用户取消连接' };
          }
        }
      } else if (preferType === 'phantom') {
        return { success: false, message: '未检测到 Phantom 浏览器扩展插件' };
      }
    }

    // 4. Backpack 钱包扩展
    if (hasWindow && (preferType === 'backpack' || preferType === 'auto')) {
      const backpackProvider = window.backpack;
      if (backpackProvider && backpackProvider.isBackpack) {
        try {
          console.log('🎒 [SolanaBridge] 尝试连接 Backpack 钱包...');
          const resp = await backpackProvider.connect();
          const pubkey = resp.publicKey || backpackProvider.publicKey;
          if (pubkey) {
            this.publicKey = pubkey;
            this.walletAddress = pubkey.toBase58();
            this.isConnected = true;
            this.isMWA = false;
            this.isGuest = false;
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('castaway_sol_wallet', JSON.stringify({
                address: this.walletAddress,
                isMWA: false,
                isGuest: false
              }));
            }
            await this.fetchBalance();
            window.dispatchEvent(new CustomEvent('solana-wallet-changed'));
            return {
              success: true,
              address: this.walletAddress,
              type: 'Backpack 钱包',
              balance: this.balance
            };
          }
        } catch (bpErr) {
          console.warn('Backpack 连接异常:', bpErr);
          if (preferType === 'backpack') {
            return { success: false, message: bpErr.message || '用户取消连接' };
          }
        }
      } else if (preferType === 'backpack') {
        return { success: false, message: '未检测到 Backpack 浏览器扩展插件' };
      }
    }

    // 5. 通用 Injected 钱包 (window.solana)
    if (hasWindow && window.solana && (preferType === 'injected' || preferType === 'auto')) {
      try {
        console.log('💻 [SolanaBridge] 尝试连接 Injected 钱包...');
        const resp = await window.solana.connect();
        const pubkey = resp.publicKey || window.solana.publicKey;
        if (pubkey) {
          this.publicKey = pubkey;
          this.walletAddress = pubkey.toBase58 ? pubkey.toBase58() : pubkey.toString();
          this.isConnected = true;
          this.isMWA = false;
          this.isGuest = false;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('castaway_sol_wallet', JSON.stringify({
              address: this.walletAddress,
              isMWA: false,
              isGuest: false
            }));
          }
          await this.fetchBalance();
          window.dispatchEvent(new CustomEvent('solana-wallet-changed'));
          return {
            success: true,
            address: this.walletAddress,
            type: '浏览器扩展钱包',
            balance: this.balance
          };
        }
      } catch (extErr) {
        console.warn('Injected 连接异常:', extErr);
      }
    }

    // 兜底降级为游客试玩模式
    return this.connectWallet('guest');
  }

  // 复制当前钱包地址到剪贴板
  async copyWalletAddress() {
    if (!this.walletAddress) return { success: false, message: '暂无钱包地址' };
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(this.walletAddress);
        return { success: true, message: '地址已复制到剪贴板' };
      }
      return { success: true, message: this.walletAddress };
    } catch (e) {
      return { success: false, message: '复制失败，请手动长按复制' };
    }
  }

  // 发起 SOL 真实支付交易 (支持 MWA 硬件签名与 Injected 钱包)
  async sendPaymentTransaction(amountSOL, recipientAddress = this.treasuryAddress) {
    if (!recipientAddress || typeof recipientAddress !== 'string' || !recipientAddress.trim()) {
      return { success: false, message: '官方收款地址未配置，支付功能已安全禁用' };
    }
    let recipientPubkey;
    try {
      recipientPubkey = new PublicKey(recipientAddress.trim());
    } catch (e) {
      return { success: false, message: '官方收款地址无效，支付功能已安全禁用' };
    }

    if (!this.isConnected) {
      return { success: false, message: '请先连接钱包' };
    }

    // 游客模式直接扣除本地虚拟余额
    if (this.isGuest || !this.publicKey) {
      if (this.balance < amountSOL) {
        return { success: false, message: `游客余额不足 (需 ${amountSOL} SOL，当前 ${this.balance.toFixed(2)} SOL)` };
      }
      this.balance = Math.max(0, this.balance - amountSOL);
      const simulatedTx = 'GUEST_TX_' + Math.random().toString(36).substring(2, 10).toUpperCase();
      console.log(`💳 [SolanaBridge] 游客模式虚拟支付完成: ${amountSOL} SOL, TX: ${simulatedTx}`);
      return {
        success: true,
        signature: simulatedTx,
        isGuest: true,
        remainingBalance: this.balance
      };
    }

    // 真实链上支付交易构建与发送
    try {
      console.log(`💳 [SolanaBridge] 构建链上转账交易: ${amountSOL} SOL -> ${recipientAddress}...`);
      const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.publicKey,
          toPubkey: recipientPubkey,
          lamports: lamports
        })
      );

      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.publicKey;

      let signature = '';

      // 1. 通过 MWA 发送并签名交易
      if (this.isMWA && this.adapter && this.adapter.connected) {
        console.log('📱 正在通过 MWA 请求钱包对交易签名并广播...');
        signature = await this.adapter.sendTransaction(transaction, this.connection);
      } else if (typeof window !== 'undefined' && window.solana?.sendTransaction) {
        // 2. 通过 Injected 钱包发送交易
        console.log('💻 正在通过浏览器钱包扩展发送交易...');
        signature = await window.solana.sendTransaction(transaction, this.connection);
      } else {
        throw new Error('未找到可用交易签名通道');
      }

      console.log('⏳ 交易已广播，等待链上确认... 签名:', signature);
      await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');

      console.log('✅ 交易已被网络确认！');
      await this.fetchBalance();

      return {
        success: true,
        signature,
        isGuest: false,
        remainingBalance: this.balance
      };
    } catch (err) {
      console.error('❌ 发送支付交易失败:', err);
      return {
        success: false,
        message: err.message || '支付被取消或网络错误'
      };
    }
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
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('castaway_sol_wallet');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('solana-wallet-changed'));
    }
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
      if (typeof localStorage === 'undefined') return;
      const records = JSON.parse(localStorage.getItem('castaway_sol_checkins') || '[]');
      records.unshift(record);
      if (records.length > 20) records.pop();
      localStorage.setItem('castaway_sol_checkins', JSON.stringify(records));
    } catch (e) {}
  }

  getCheckinRecords() {
    try {
      if (typeof localStorage === 'undefined') return [];
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

  // 提交共振勘探赛季证明 (仅作本地与测试网成就排行记录，不发放真实代币)
  submitResonanceProof(rsScore, roundId) {
    const proof = {
      wallet: this.walletAddress || "Guest_Resonator",
      rs: rsScore,
      roundId: roundId,
      timestamp: Date.now(),
      isSeeker: this.isSeeker
    };
    try {
      localStorage.setItem('castaway_sol_resonance_proof', JSON.stringify(proof));
    } catch (e) {}
    console.log("📡 [SolanaBridge] 共振勘探成绩存证更新:", proof);
    return proof;
  }

  getResonanceStats() {
    try {
      const raw = localStorage.getItem('castaway_sol_resonance_proof');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { wallet: this.walletAddress || "Guest_Resonator", rs: 0, roundId: 0, isSeeker: this.isSeeker };
  }
}

export const solanaBridge = new SolanaBridge();
