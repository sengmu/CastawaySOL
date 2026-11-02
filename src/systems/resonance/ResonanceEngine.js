// CastawaySOL - 矿脉共振勘探纯逻辑引擎 (ResonanceEngine)
// 依据 DESIGN-RESONANCE.md 施工定稿实现
// 纯 JavaScript 模块，无 THREE.js 或 DOM 依赖，供前端系统与模拟套件直接 import

export const ODDS_TABLE = {
  PHASE_KEY_MAP: { day: 'day', sunrise: 'dawn', sunset: 'dusk', night: 'night' },
  UPGRADE_COSTS: { 2: 30, 3: 80, 4: 200 },
  MOTHERLODE: { sinkShare: 0.15, maxProbability: 0.40, baseMaxProbability: 0.30, sharesDivisor: 20, typhoonMultiplier: 1.5, awakenerShare: 0.70, sharedShare: 0.30, seedShare: 0.10 },
  PITY: { minShares: 2, crystals: 2, fullHeat: true },
  LONG_TERM_RTP: { min: 0.78, max: 0.82 },
  GRID_SIZE: 25,
  GRID_ROWS: 5,
  GRID_COLS: 5,
  V: 1.35,                      // 基准价值：1.35 sol_token/份额
  ALPHA: 0.24,                   // 本轮主池占比 24%
  MOTHERLODE_SHARE: 0.40,        // 母晶池注入 40% (0.54 tok/份额)
  SHARD_RETURN_RATE: 0.25,       // 残晶价值折算 (4 残晶 = 1 晶石)
  BURN_SHARE: 0.30,              // 系统销毁 30%
  MAX_MOTHERLODE_POOL: 1000,     // 母池硬顶 1000 枚

  RIG_LEVELS: {
    1: { k: 1, C: 6, capacity: 10, u: 6, R: 141.6, cap: 360 },
    2: { k: 2, C: 10, capacity: 15, u: 5, R: 118.0, cap: 300 },
    3: { k: 3, C: 15, capacity: 20, u: 5, R: 118.0, cap: 300 },
    4: { k: 3, C: 24, capacity: 30, u: 8, R: 188.8, cap: 480 }
  },

  CRIT_TABLE: {
    default: [
      { name: 'none', mult: 1, prob: 0.876 },
      { name: 'small', mult: 2, prob: 0.100 },
      { name: 'big', mult: 3, prob: 0.020 },
      { name: 'supernova', mult: 8, prob: 0.004 }
    ],
    buffed: [
      { name: 'none', mult: 1, prob: 0.814 },
      { name: 'small', mult: 2, prob: 0.150 },
      { name: 'big', mult: 3, prob: 0.030 },
      { name: 'supernova', mult: 8, prob: 0.006 }
    ]
  },

  PITY_TABLE: {
    10: 0.10,
    11: 0.20,
    12: 0.30,
    13: 0.45,
    14: 0.60,
    15: 1.00
  },

  CLUSTER_WEIGHTS: {
    main: 1.6,
    sub: 1.3,
    cold: 1.0
  },

  PHASE_MULTIPLIERS: {
    dawn: 1.20,
    day: 1.00,
    dusk: 0.85,
    night: 0.60
  },

  WEATHER_MULTIPLIERS: {
    clear: 1.00,
    cloudy: 0.95,
    rain: 0.75,
    typhoon: 0.55
  }
};

// 确定性哈希函数 (cyrb53)
export function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// 确定性 PRNG (Mulberry32)
export function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 正态分布抽样 (Box-Muller)
export function randNormal(rng, mean = 0, std = 1) {
  let u1 = rng();
  while (u1 === 0) u1 = rng();
  const u2 = rng();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z0 * std;
}

export function randLogNormal(rng, mean = 0, std = 1) {
  return Math.exp(randNormal(rng, mean, std));
}

// 1. 生成轮次确定性种子
export function genRoundSeed(saveSeed, roundId) {
  const raw = `${saveSeed || 'castaway'}_round_${roundId}`;
  const h = cyrb53(raw);
  return h.toString(16).padStart(12, '0');
}

// 2. 8-邻域网格辅助函数
export function getNeighbors(sq) {
  const r = Math.floor(sq / 5);
  const c = sq % 5;
  const n = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5) {
        n.push(nr * 5 + nc);
      }
    }
  }
  return n;
}

// 3. 生成本轮矿脉簇 (Cluster)
// 1 个主脉 (权重 1.6) + 2 个副脉 (权重 1.3)，其余 22 格为冷格 (权重 1.0)
export function genCluster(daySeed, roundId) {
  const rng = mulberry32(cyrb53(`cluster_${daySeed}_${roundId}`));
  const mainSq = Math.floor(rng() * 25);
  const neighbors = getNeighbors(mainSq);

  // 从邻格中挑选 2 个作为副脉
  const sub1Idx = Math.floor(rng() * neighbors.length);
  const sub1 = neighbors[sub1Idx];
  neighbors.splice(sub1Idx, 1);
  const sub2 = neighbors[Math.floor(rng() * neighbors.length)];

  return {
    mainIndex: mainSq,
    subIndices: [sub1, sub2],
    heatIndices: [mainSq, sub1, sub2]
  };
}

// 4. 生成 NPC 模拟矿工部署全网面板
// N = 125·u × M_phase × M_weather × M_event × ε
export function genNpcBoard(seed, u, M_phase = 1.0, M_weather = 1.0, M_event = 1.0, cluster = null) {
  const rng = mulberry32(typeof seed === 'number' ? seed : cyrb53(String(seed)));
  const eps = randLogNormal(rng, 0, 0.12);
  const totalN = 125 * u * M_phase * M_weather * M_event * eps;

  const weights = new Array(25).fill(0);
  for (let i = 0; i < 25; i++) {
    let base = randLogNormal(rng, 0, 0.25);
    // 矿脉簇所在格 NPC 能部分感知 x1.2
    if (cluster && cluster.heatIndices.includes(i)) {
      base *= 1.2;
    }
    weights[i] = base;
  }

  const sumWeights = weights.reduce((a, b) => a + b, 0);
  const board = weights.map(w => Number(((w / sumWeights) * totalN).toFixed(2)));
  return board;
}

// 5. NPC 份额平滑入场函数 (progress 0..80)
// f(t) = 0.25 + 0.75 * (t / 80)^1.6
export function npcArrival(board, progress) {
  const t = Math.max(0, Math.min(80, progress));
  const ratio = 0.25 + 0.75 * Math.pow(t / 80.0, 1.6);
  return board.map(val => Number((val * ratio).toFixed(2)));
}

// 6. 抽选获胜格 (drawWinner)
// 冷格权重 1.0，副脉 1.3，主脉 1.6，总权重 26.2
export function drawWinner(seed, cluster) {
  const rng = mulberry32(typeof seed === 'number' ? seed : cyrb53(`draw_${seed}`));
  const weights = new Array(25).fill(ODDS_TABLE.CLUSTER_WEIGHTS.cold);
  if (cluster) {
    if (typeof cluster.mainIndex === 'number') weights[cluster.mainIndex] = ODDS_TABLE.CLUSTER_WEIGHTS.main;
    if (Array.isArray(cluster.subIndices)) {
      cluster.subIndices.forEach(idx => {
        weights[idx] = ODDS_TABLE.CLUSTER_WEIGHTS.sub;
      });
    }
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0); // 26.2
  const pick = rng() * totalWeight;
  let acc = 0;
  for (let i = 0; i < 25; i++) {
    acc += weights[i];
    if (pick <= acc) return i;
  }
  return 24;
}

// 7. 晶爆抽签 (rollCrit)
export function rollCrit(seed, hasCrabPotBuff = false) {
  const rng = mulberry32(typeof seed === 'number' ? seed : cyrb53(`crit_${seed}`));
  const roll = rng();
  const table = hasCrabPotBuff ? ODDS_TABLE.CRIT_TABLE.buffed : ODDS_TABLE.CRIT_TABLE.default;

  // table: none, small, big, supernova
  const pSuper = table[3].prob;
  const pBig = table[2].prob;
  const pSmall = table[1].prob;

  if (roll < pSuper) {
    return { name: 'supernova', mult: 8, tier: 3 };
  } else if (roll < pSuper + pBig) {
    return { name: 'big', mult: 3, tier: 2 };
  } else if (roll < pSuper + pBig + pSmall) {
    return { name: 'small', mult: 2, tier: 1 };
  } else {
    return { name: 'none', mult: 1, tier: 0 };
  }
}

// 8. 扫描仪情报获取 (scannerHints)
export function scannerHints(cluster, scannerLevel, seed) {
  if (!scannerLevel || scannerLevel <= 0 || !cluster) {
    return null;
  }
  const rng = mulberry32(typeof seed === 'number' ? seed : cyrb53(`scanner_${seed}`));
  const main = cluster.mainIndex;
  const mainR = Math.floor(main / 5);
  const mainC = main % 5;

  if (scannerLevel === 1) {
    // Mk1: 标出 1 条行或列 (5格)，包含主脉格
    const isRow = rng() < 0.5;
    const squares = [];
    if (isRow) {
      for (let c = 0; c < 5; c++) squares.push(mainR * 5 + c);
    } else {
      for (let r = 0; r < 5; r++) squares.push(r * 5 + mainC);
    }
    return { level: 1, mode: isRow ? 'row' : 'col', lineIndex: isRow ? mainR : mainC, squares };
  } else if (scannerLevel === 2) {
    // Mk2: 4 个候选格 = 3 个簇格 + 1 个相邻诱饵格
    const decoys = getNeighbors(main).filter(sq => !cluster.heatIndices.includes(sq));
    const decoy = decoys.length > 0 ? decoys[Math.floor(rng() * decoys.length)] : ((main + 1) % 25);
    const candidates = [...cluster.heatIndices, decoy].sort((a, b) => a - b);
    return { level: 2, candidates };
  } else if (scannerLevel >= 3) {
    // Mk3: 精确标出 3 个簇格；主脉格标记 80% 准确
    const markAccurate = rng() < 0.80;
    const mainGuess = markAccurate ? main : (cluster.subIndices[0] ?? main);
    return {
      level: 3,
      heatSquares: [...cluster.heatIndices],
      estimatedMainSquare: mainGuess
    };
  }
  return null;
}

// 9. 单格 EV 预估函数 (供 UI 实时展示稀释效应)
export function estimateSquareEV(board, squareIdx, playerShares, u, M_phase = 1.0, M_weather = 1.0) {
  if (playerShares <= 0) return 0;
  const V = ODDS_TABLE.V;
  const ALPHA = ODDS_TABLE.ALPHA;
  const { R } = rigParameters(u);
  const totalNpc = board.reduce((a, b) => a + b, 0);
  const totalShares = totalNpc + playerShares;
  const pot = ALPHA * V * totalShares + R;

  const sqNpc = board[squareIdx] || 0;
  const sqTotal = sqNpc + playerShares;
  const shareRatio = playerShares / sqTotal;

  // 假设平均中签概率约 1/25 = 0.04，期望晶爆 1.168
  const baseWinProb = 1.0 / ODDS_TABLE.GRID_SIZE;
  const expectedPayout = baseWinProb * (shareRatio * pot * expectedCritMultiplier());
  const cost = playerShares * V;
  return Number((expectedPayout / cost).toFixed(3));
}

// 10. 核心单轮结算引擎 (settle)
export function settle(board, deploy, motherlodePool = 0, params = {}) {
  const {
    u = 5,
    roundSeed = 'round_0',
    cluster = null,
    buffId = null,
    weather = 'clear',
    currentCalib = 0
  } = params;

  const V = ODDS_TABLE.V;
  const ALPHA = ODDS_TABLE.ALPHA;
  const { R, cap } = rigParameters(u);

  // 1. 抽选获胜格
  const winningSquare = drawWinner(roundSeed, cluster);

  // 2. 玩家总投入份额
  const playerTotalShares = deploy.reduce((a, b) => a + b, 0);
  const s_W = deploy[winningSquare] || 0;
  const hit = s_W > 0;

  // 3. 全局总奖池计算: Pot = α·V·Σ(N_k + s_k) + R
  const sumNpc = board.reduce((a, b) => a + b, 0);
  const sumTotal = sumNpc + playerTotalShares;
  const pot = ALPHA * V * sumTotal + R;

  // 4. 晶爆抽签
  const hasCrabPot = buffId === 'resonance_crab_pot';
  const crit = rollCrit(roundSeed, hasCrabPot);

  // 5. 主池派彩计算
  let payout = 0;
  let excessToMotherlode = 0;
  if (hit) {
    const T_W = (board[winningSquare] || 0) + s_W;
    const rawPayout = (s_W / T_W) * pot * crit.mult;
    if (rawPayout > cap) {
      payout = cap;
      excessToMotherlode = rawPayout - cap;
    } else {
      payout = rawPayout;
    }
  }

  // 6. 邻格残晶 (8-邻域)
  const neighbors = getNeighbors(winningSquare);
  let shards = 0;
  const shardMult = buffId === 'smoked_fish' ? 2 : 1;
  neighbors.forEach(nSq => {
    const sharesInNeighbor = deploy[nSq] || 0;
    if (sharesInNeighbor > 0) {
      shards += Math.round(sharesInNeighbor * shardMult);
    }
  });

  // 7. 保底 (校准值)
  let nextCalib = currentCalib;
  let calibReward = null;
  if (playerTotalShares >= ODDS_TABLE.PITY.minShares) {
    if (hit) {
      nextCalib = 0;
    } else {
      nextCalib = currentCalib + 1;
      if (nextCalib >= Math.min(...Object.keys(ODDS_TABLE.PITY_TABLE).map(Number))) {
        const pityProb = ODDS_TABLE.PITY_TABLE[nextCalib] || 1.0;
        const rngCalib = mulberry32(cyrb53(`pity_${roundSeed}`));
        if (rngCalib() < pityProb) {
          calibReward = { crystals: ODDS_TABLE.PITY.crystals, fullHeat: ODDS_TABLE.PITY.fullHeat };
          nextCalib = 0;
        }
      }
    }
  }

  // 8. 母晶池注入与触发检定
  // 注入：玩家投入的 40% (0.54 tok/份额) + 单轮溢出
  const injected = playerTotalShares * (ODDS_TABLE.MOTHERLODE_SHARE * V) + excessToMotherlode;
  let currentPool = Math.min(ODDS_TABLE.MAX_MOTHERLODE_POOL, motherlodePool + injected);

  let mlWon = false;
  let playerMlTake = 0;
  let npcMlBurned = 0;
  let seedForNext = 0;

  if (hit) {
    const mlProb = motherlodeProbability(s_W, weather);
    const rngMl = mulberry32(cyrb53(`ml_${roundSeed}`));
    if (rngMl() < mlProb && currentPool > 0) {
      mlWon = true;
      const T_W = (board[winningSquare] || 0) + s_W;
      playerMlTake = Math.round(currentPool * ODDS_TABLE.MOTHERLODE.awakenerShare + (currentPool * ODDS_TABLE.MOTHERLODE.sharedShare) * (s_W / T_W));
      playerMlTake = Math.min(currentPool, playerMlTake);
      npcMlBurned = currentPool - playerMlTake;
      seedForNext = Math.round(npcMlBurned * ODDS_TABLE.MOTHERLODE.seedShare);
      currentPool = seedForNext;
    }
  }

  return {
    winningSquare,
    hit,
    crit,
    pot: Number(pot.toFixed(2)),
    payout: Number(payout.toFixed(2)),
    excessToMotherlode: Number(excessToMotherlode.toFixed(2)),
    shards,
    calib: nextCalib,
    calibReward,
    motherlode: {
      won: mlWon,
      playerTake: playerMlTake,
      npcBurned: npcMlBurned,
      nextPool: currentPool
    }
  };
}

export function rigParameters(u) {
  const info = Object.values(ODDS_TABLE.RIG_LEVELS).find(info => info.u === u);
  if (!info) throw new RangeError(`Unknown rig capacity ${u}`);
  return info;
}
export function expectedCritMultiplier(buffed = false) {
  return ODDS_TABLE.CRIT_TABLE[buffed ? 'buffed' : 'default'].reduce((sum, row) => sum + row.prob * row.mult, 0);
}
export function motherlodeProbability(shares, weather = 'clear') {
  const m = ODDS_TABLE.MOTHERLODE;
  return Math.min(m.maxProbability, Math.min(m.baseMaxProbability, shares / m.sharesDivisor) * (weather === 'typhoon' ? m.typhoonMultiplier : 1));
}
export function clusterWeightTotal() {
  const w = ODDS_TABLE.CLUSTER_WEIGHTS;
  return w.main + 2 * w.sub + (ODDS_TABLE.GRID_SIZE - 3) * w.cold;
}
