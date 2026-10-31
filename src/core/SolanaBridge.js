// Solana Mobile & dApp Store 生态集成模块
export class SolanaBridge {
  constructor() {
    this.walletAddress = null;
    this.isConnected = false;
    this.network = 'devnet'; // 默认 devnet 试玩网络
    this.leaderboard = [];

    // 初始化本地存储的钱包信息或游客模式
    this.loadState();
  }

  loadState() {
    const saved = localStorage.getItem('castaway_sol_wallet');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.walletAddress = data.address;
        this.isConnected = true;
      } catch (e) {}
    }
  }

  // 连接 Solana 钱包 (兼容 Phantom, Solflare 与 Solana Mobile Wallet Adapter)
  async connectWallet() {
    if (window.solana && window.solana.isPhantom) {
      try {
        const resp = await window.solana.connect();
        this.walletAddress = resp.publicKey.toString();
        this.isConnected = true;
        localStorage.setItem('castaway_sol_wallet', JSON.stringify({ address: this.walletAddress }));
        return { success: true, address: this.walletAddress };
      } catch (err) {
        console.warn('用户取消了钱包连接:', err);
      }
    }

    // 移动端/游客快捷连接模拟（用于免钱包试玩与体验）
    const randomHex = Array.from({length: 4}, () => Math.random().toString(36).substring(2, 6)).join('');
    this.walletAddress = `SOL_${randomHex.toUpperCase()}`;
    this.isConnected = true;
    localStorage.setItem('castaway_sol_wallet', JSON.stringify({ address: this.walletAddress }));
    return { success: true, address: this.walletAddress, isGuest: true };
  }

  disconnect() {
    this.walletAddress = null;
    this.isConnected = false;
    localStorage.removeItem('castaway_sol_wallet');
  }

  // 生成本地逃脱纪念证书数据；当前不会提交交易或铸造链上 NFT。
  async mintEscapeCertificate(gameStats) {
    const certData = {
      title: "Castaway SOL 荒岛幸存者官方证书",
      recipient: this.walletAddress || "Guest_Explorer",
      survivedDays: gameStats.day,
      ending: gameStats.endingName || "扬帆远航 (Raft Escape)",
      steps: gameStats.steps,
      timestamp: new Date().toISOString(),
      attributes: [
        { trait_type: "Survival Days", value: gameStats.day },
        { trait_type: "Ending", value: gameStats.endingName },
        { trait_type: "Tier", value: gameStats.day >= 10 ? "Legendary Castaway" : "Skilled Survivor" }
      ]
    };

    console.log("生成本地逃脱纪念证书数据（未上链）:", certData);
    return {
      success: true,
      mintId: `LOCAL_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      isOnChain: false,
      metadata: certData
    };
  }

  // 提交成绩至 Solana 赛季榜
  submitLeaderboard(days, ending) {
    const record = {
      address: this.walletAddress ? `${this.walletAddress.substring(0, 4)}...${this.walletAddress.slice(-4)}` : "匿名岛民",
      days: days,
      ending: ending,
      date: new Date().toLocaleDateString()
    };
    this.leaderboard.push(record);
    this.leaderboard.sort((a, b) => b.days - a.days);
    return record;
  }

  // 提交 DePIN 绿色矿机算力工作证明与区块验证
  submitMiningProof(blocks, totalSol) {
    const proof = {
      wallet: this.walletAddress || "Guest_Miner",
      blocks: blocks,
      totalSol: totalSol,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem('castaway_sol_mining_proof', JSON.stringify(proof));
    } catch (e) {}
    console.log("⛏️ [SolanaBridge] 算力区块已本地确权记录:", proof);
    return proof;
  }

  // 获取挖矿算力统计
  getMiningStats() {
    try {
      const raw = localStorage.getItem('castaway_sol_mining_proof');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { wallet: this.walletAddress || "Guest_Miner", blocks: 0, totalSol: 0 };
  }
}

export const solanaBridge = new SolanaBridge();
