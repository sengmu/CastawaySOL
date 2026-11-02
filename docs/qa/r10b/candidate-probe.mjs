import { ODDS_TABLE,genCluster,genNpcBoard,settle } from '../../../src/systems/resonance/ResonanceEngine.js';
function testStrategyRTP(rounds, strategy = 'neutral', fixedWeather = null, fixedPhase = null, buffId = null) {
  let totalCost = 0;
  let totalReturn = 0;
  let pool = 100;
  let calib = 0;
  const u = 5;

  const phases = ['dawn', 'day', 'day', 'dusk', 'night'];
  const weathers = ['clear', 'clear', 'cloudy', 'rain', 'typhoon'];

  for (let i = 0; i < rounds; i++) {
    const phase = fixedPhase || phases[i % phases.length];
    const weather = fixedWeather || weathers[Math.floor(i / 5) % weathers.length];

    const M_phase = ODDS_TABLE.PHASE_MULTIPLIERS[phase] || 1.0;
    const M_weather = ODDS_TABLE.WEATHER_MULTIPLIERS[weather] || 1.0;

    const seed = `sim_rtp_${i}`;
    const cl = genCluster('day_1', i);
    const bd = genNpcBoard(seed, u, M_phase, M_weather, 1.0, cl);

    const dep = new Array(25).fill(0);
    if (strategy === 'neutral') {
      // 中性策略：无扫描仪信息，分散押 3 个格子
      dep[i % 25] = 5;
      dep[(i + 7) % 25] = 5;
      dep[(i + 14) % 25] = 5;
    } else if (strategy === 'optimal') {
      // 最优策略：在热脉格上押注 (Mk3扫描仪)
      dep[cl.mainIndex] = 5;
      dep[cl.subIndices[0]] = 5;
      dep[cl.subIndices[1]] = 5;
    } else if (strategy === 'snipe') {
      // 最小份额狙击母池：无扫描仪信息，单格押最低合法 2 份碰运气
      dep[i % 25] = 2;
    }

    const shares = dep.reduce((a, b) => a + b, 0);
    if (shares === 0) continue;

    const res = settle(bd, dep, pool, {
      u,
      roundSeed: seed,
      cluster: cl,
      buffId,
      weather,
      currentCalib: calib
    });

    pool = res.motherlode.nextPool;
    calib = res.calib;

    // 收益汇总：主池派彩 + 残晶折算 + 母池获利 + 保底原石
    const payout = res.payout;
    const shardVal = res.shards * ODDS_TABLE.SHARD_RETURN_RATE * ODDS_TABLE.V;
    const mlTake = res.motherlode.playerTake;
    const calibVal = res.calibReward ? res.calibReward.crystals * ODDS_TABLE.V : 0;

    totalCost += shares * ODDS_TABLE.V;
    totalReturn += (payout + shardVal + mlTake + calibVal);
  }

  return totalReturn / totalCost;
}

for (const coefficient of [.45,.55,.60]) {
 ODDS_TABLE.WEATHER_MULTIPLIERS.typhoon=coefficient;
 const dawn=testStrategyRTP(200000,'neutral',null,'dawn');
 const crabOptimal=testStrategyRTP(200000,'optimal','typhoon','night','resonance_crab_pot');
 console.log(JSON.stringify({coefficient,dawn,crabOptimal}));
}
