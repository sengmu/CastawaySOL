// Deterministic neutral-player scenario, not an expected-value promise.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
import { resonanceGates, r3Gates, crystalSourceLimits } from './lib/economy-gates.mjs';
import { EconomyLedger } from '../src/systems/EconomyLedger.js';
import { MiningRigSystem, resonanceRoundRS, DECRYPT_REWARD, FREE_SHARES, SCANNER_COSTS } from '../src/systems/MiningRigSystem.js';
import { CHECKIN_REWARD } from '../src/systems/SaveSystem.js';
import { CAMP_MINER_CRYSTALS } from '../src/systems/CampFacilitiesSystem.js';
import { CRYSTAL_VEIN } from '../src/systems/BeachResourceSystem.js';
import { MONKEY_CREVICE } from '../src/systems/MonkeyHelperSystem.js';
import { VESSEL_TIERS } from '../src/systems/ShipUpgradeSystem.js';
import { ShopManager } from '../src/ui/ShopManager.js';
import { ODDS_TABLE, genRoundSeed, genCluster, genNpcBoard, settle, mulberry32, cyrb53, scannerHints } from '../src/systems/resonance/ResonanceEngine.js';

export const NEUTRAL_SCENARIO = Object.freeze({steps:1500,minutes:18,earlySupply:15,lateSupply:22,resonanceRatio:0.75,earlyRounds:2,lateRounds:3,seed:'g3-neutral-v1'});
const quiet = () => {};
export function simulateEconomy({days=30,seed=NEUTRAL_SCENARIO.seed}={}) {
  const game={survival:{day:1,steps:0},ui:{inventory:{},showToast:quiet,showDialog:quiet,renderInventory:quiet},
    saveSystem:{saveSeed:seed,saveGame:()=>({success:true})},dayNight:{currentMode:'day'},weatherSystem:{currentWeather:'clear'},solanaBridge:{submitMiningProof:quiet}};
  game.economyLedger=new EconomyLedger(game);
  const ledger=game.economyLedger;
  const rig=game.miningRig=new MiningRigSystem(game);
  const shop=new ShopManager(game,{headless:true});
  const rng=mulberry32(cyrb53(seed));
  const snapshots=[],purchases=[],rejected=[];
  // Neutral progression stops at L3, and buys nine core privileges (352 total).
  // L4 plus all thirteen products is the separate hardcore buyout profile.
  let calib=0,roundId=0,rs=0,totalBurn=0,totalSupply=0,fullHeat=false;
  let clock=Date.now();
  const queue=[
    {day:3,type:'ship',cost:VESSEL_TIERS.tier_2.solCost,id:'tier_2'},
    {day:4,type:'rig_upgrade',cost:ODDS_TABLE.UPGRADE_COSTS[2],id:'rig_2',level:2},
    {day:5,type:'scanner',cost:SCANNER_COSTS[1],id:'scanner_1',scanner:1},
    {day:8,type:'rig_upgrade',cost:ODDS_TABLE.UPGRADE_COSTS[3],id:'rig_3',level:3},
    {day:10,type:'scanner',cost:SCANNER_COSTS[2],id:'scanner_2',scanner:2},
    {day:14,type:'ship',cost:VESSEL_TIERS.tier_3.solCost,id:'tier_3'},
    {day:20,type:'scanner',cost:SCANNER_COSTS[3],id:'scanner_3',scanner:3},
    ...shop.products.filter(p=>['auto_salvage_buoy','auto_production_license','overclock_mining_chip','depin_lithium_pack','backpack_expansion','storage_expansion','pet_bella_dog','storm_oilskin_cloak','storm_fire_shelter'].includes(p.id)).map((p,i)=>({day:4+i*2,type:'shop',cost:p.priceToken,id:p.id}))
  ];
  const bought=new Set();
  for(let day=1;day<=days;day++) {
    game.survival.day=day;game.survival.steps+=NEUTRAL_SCENARIO.steps;
    ledger.credit('sol_token',CHECKIN_REWARD,'checkin');
    if(day>1){
      clock+=NEUTRAL_SCENARIO.minutes*60*1000;
      const now=Date.now;try{Date.now=()=>clock;rig.onNewDay(day);}finally{Date.now=now;}
    }
    // §2.4 supply includes free shares. Source mix is an explicit player assumption,
    // with no paid-production multiplier. Initial silo and recycling are additional.
    const target=day<=7?NEUTRAL_SCENARIO.earlySupply:NEUTRAL_SCENARIO.lateSupply;
    const camp=day>=4?CAMP_MINER_CRYSTALS:0;
    const tidal=day%4===0?1:0;
    const monkey=day>=5?MONKEY_CREVICE.crystals:0;
    const manual=day%3===0?1:0;
    const mine=target-FREE_SHARES.daily-camp-tidal-monkey-manual;
    for(const [source,n] of Object.entries({vein_mine:mine,camp_miner:camp,tidal_spawn:tidal,monkey_crevice:monkey,flotsam_manual:manual}))ledger.credit('sol_crystal',n,source);
    totalSupply+=target;
    // Carry raw crystals and condensed shards; free shares cannot enter decrypt.
    let budget=Math.floor((game.ui.inventory.sol_crystal+rig.loadedCrystals)*NEUTRAL_SCENARIO.resonanceRatio)+rig.resonance.freeShares;
    const rounds=day<=7?NEUTRAL_SCENARIO.earlyRounds:NEUTRAL_SCENARIO.lateRounds;
    let played=0;
    for(let r=0;r<rounds;r++) {
      const {u,k,C}=ODDS_TABLE.RIG_LEVELS[rig.rigLevel];
      const shares=Math.min(C,budget,Math.max(2,Math.ceil(budget/(rounds-r))));
      if(shares<ODDS_TABLE.PITY.minShares)break;
      const free=Math.min(rig.resonance.freeShares,shares);
      ledger.debit('sol_crystal',free,'resonance_commit',rig.resonance,'freeShares');
      let raw=shares-free;
      const silo=Math.min(raw,rig.loadedCrystals);
      ledger.debit('sol_crystal',silo,'resonance_commit',rig,'loadedCrystals');raw-=silo;
      assert.ok(ledger.debit('sol_crystal',raw,'resonance_commit'));
      budget-=shares;played++;roundId++;
      const roundSeed=genRoundSeed(seed,roundId),cluster=genCluster(`${seed}_day_${day}`,roundId);
      const board=genNpcBoard(roundSeed,u,1,1,1,cluster);
      const hints=scannerHints(rig.scannerLevel,cluster,roundSeed);
      const dep=Array(25).fill(0);
      // Neutral player uses only unlocked scanner information, never hidden cluster data.
      const candidates=fullHeat?cluster.heatIndices:(hints?.squares||hints?.candidates||hints?.heatSquares||Array.from({length:25},(_,i)=>i));
      fullHeat=false;
      const start=Math.floor(rng()*candidates.length);
      const chosen=Array.from({length:k},(_,j)=>candidates[(start+j)%candidates.length]);
      let left=shares;
      for(const square of chosen){const n=Math.min(u,left);dep[square]+=n;left-=n;}
      assert.equal(left,0,'All paid shares deployed');
      const result=settle(board,dep,rig.motherlode.pool,{u,roundSeed,cluster,weather:'clear',currentCalib:calib});
      assert.ok(result.payout<=60*u,'Round payout cap');
      rig.motherlode.pool=result.motherlode.nextPool;
      rig.creditPayout(result.payout,'resonance_main');rig.creditPayout(result.motherlode.playerTake,'resonance_ml');
      totalBurn+=result.motherlode.npcBurned;
      totalBurn+=shares*ODDS_TABLE.V*ODDS_TABLE.BURN_SHARE;
      ledger.credit('sol_shard',result.shards,'resonance_shard',rig,'shardCount');
      while(rig.shardCount>=1/ODDS_TABLE.SHARD_RETURN_RATE){
        ledger.debit('sol_shard',1/ODDS_TABLE.SHARD_RETURN_RATE,'shard_condense',rig,'shardCount');
        ledger.credit('sol_crystal',1,'shard_condense');
      }
      calib=result.calib;
      if(result.calibReward){ledger.credit('sol_crystal',result.calibReward.crystals,'resonance_calib');fullHeat=true;}
      rs+=resonanceRoundRS(result,dep,board);
    }
    // Every raw remainder is decrypted, including capacity and integer-division remainders.
    const remaining=(game.ui.inventory.sol_crystal||0)+rig.loadedCrystals;
    if(rig.loadedCrystals)ledger.transfer('sol_crystal',rig.loadedCrystals,'rig_load',rig,'loadedCrystals',game.ui.inventory,'sol_crystal');
    for(let i=0;i<remaining;i++){
      assert.ok(ledger.debit('sol_crystal',1,'decrypt_consume'));
      const reward=DECRYPT_REWARD.base+(rng()<DECRYPT_REWARD.bonusChance?1:0);
      ledger.credit('sol_token',reward,'decrypt',rig,'unclaimedSol');
    }
    if(rig.unclaimedSol)ledger.transfer('sol_token',rig.unclaimedSol,'claim_payout',rig,'unclaimedSol',game.ui.inventory,'sol_token');
    for(const p of queue.filter(p=>day>=p.day&&!bought.has(p.id))){
      if(!ledger.debit('sol_token',p.cost,p.type)){rejected.push({day,id:p.id,cost:p.cost});continue;}
      rig.onSinkSpent(p.cost,p.type);bought.add(p.id);purchases.push({day,...p});
      if(p.level)rig.rigLevel=p.level;
      if(p.scanner)rig.scannerLevel=p.scanner;
    }
    assert.ok((game.ui.inventory.sol_token||0)>=0);
    const totals={inflow:{},outflow:{},transfers:{}};
    for(const row of ledger.serialize().days)for(const dir of Object.keys(totals))for(const [asset,types] of Object.entries(row[dir])){
      const group=totals[dir][asset]||={};for(const [type,n] of Object.entries(types))group[type]=(group[type]||0)+n;
    }
    snapshots.push({day,balance:game.ui.inventory.sol_token||0,dust:rig.solDust,pool:rig.motherlode.pool,burned:totalBurn,rs,totalSupply,rounds:played,rawRemaining:game.ui.inventory.sol_crystal||0,shards:rig.shardCount,totals});
  }
  return {scenario:NEUTRAL_SCENARIO,snapshots,purchases,rejected,ledger:ledger.serialize()};
}
export function assertEconomy(result) {
  const failures=[];
  let previous={};
  for(const d of result.snapshots){
    const crystals=d.totals.inflow.sol_crystal||{};
    // Rates are finite at fixed play time/steps; recycling and pity are bounded by
    // the finite deployment count, not treated as new natural supply.
    const limits={...crystalSourceLimits(NEUTRAL_SCENARIO),initial_silo:d.day===1?1:0};
    for(const [source,total] of Object.entries(crystals)){
      const delta=total-(previous[source]||0);
      if(!Number.isFinite(limits[source])||delta>limits[source])failures.push(`Day${d.day} unbounded faucet ${source}: ${delta}`);
    }
    previous=crystals;
    if(d.balance<0)failures.push(`Day${d.day} wallet negative`);
    if(d.rounds<2||d.rounds>4)failures.push(`Day${d.day} rounds ${d.rounds} outside 2–4`);
    if(d.rawRemaining!==0)failures.push(`Day${d.day} raw remainder not decrypted`);
  }
  const d7=result.snapshots.find(d=>d.day===7),d30=result.snapshots.find(d=>d.day===30);
  const progression=VESSEL_TIERS.tier_2.solCost+ODDS_TABLE.UPGRADE_COSTS[2];
  if(d7&&d7.balance<progression)failures.push(`Day7 balance ${d7.balance.toFixed(2)} < T2+L2 ${progression}`);
  if(d30&&(d30.balance<284*0.8||d30.balance>284*1.2))failures.push(`Day30 balance ${d30.balance.toFixed(2)} outside 284±20% [227.2,340.8]`);
  return failures;
}
export function printEconomy(result,days) {
  const selected=result.snapshots.filter(d=>days.includes(d.day));
  const rows=[];
  for(const dir of ['inflow','outflow','transfers'])for(const resource of ['sol_crystal','sol_token','sol_shard']){
    const keys=new Set(selected.flatMap(d=>Object.keys(d.totals[dir][resource]||{})));
    for(const type of keys)rows.push(Object.fromEntries([['metric',`${resource} ${dir}/${type}`],...selected.map(d=>[`Day${d.day}`,Number((d.totals[dir][resource]?.[type]||0).toFixed(2))]) ]));
  }
  for(const metric of ['balance','dust','pool','burned','rs','totalSupply'])rows.push(Object.fromEntries([['metric',metric],...selected.map(d=>[`Day${d.day}`,Number(d[metric].toFixed(2))])]));
  console.table(rows);
  console.log('Scenario:',JSON.stringify(result.scenario));
  console.log('Prices from real systems; deferred unaffordable attempts:',result.rejected.length);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const arg=process.argv.indexOf('--days');
  const days=arg>=0?process.argv[arg+1].split(',').map(Number):[1,7,30];
  assert.ok(days.every(n=>Number.isInteger(n)&&n>=1&&n<=30),'--days must be integers 1..30');
  const result=simulateEconomy({days:Math.max(...days)});printEconomy(result,days);
  const json=process.argv.indexOf('--json');
  if(process.argv.includes('--assert')){
    const resonance=resonanceGates(),r3=r3Gates();
    console.log('Resonance red lines:',JSON.stringify(resonance.metrics));
    console.log('R3 product differentials:',JSON.stringify(r3.diffs));
    const failures=[...assertEconomy(result),...resonance.failures,...r3.failures];
    result.gates={resonance,r3,failures};
    for(const failure of failures)console.error('GATE FAIL:',failure);
    if(failures.length)process.exitCode=1;else console.log('Economy gate passed');
  }
  if(json>=0)writeFileSync(process.argv[json+1],JSON.stringify(result,null,2));
}
