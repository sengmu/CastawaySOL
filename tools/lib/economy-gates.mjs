import { CRYSTAL_VEIN, BeachResourceSystem } from '../../src/systems/BeachResourceSystem.js';
import { MONKEY_CREVICE } from '../../src/systems/MonkeyHelperSystem.js';
import { CAMP_MINER_CRYSTALS } from '../../src/systems/CampFacilitiesSystem.js';
import { ODDS_TABLE, genCluster, genNpcBoard, settle } from '../../src/systems/resonance/ResonanceEngine.js';
import { MiningRigSystem, FREE_SHARES } from '../../src/systems/MiningRigSystem.js';
import { CampFacilitiesSystem } from '../../src/systems/CampFacilitiesSystem.js';
import { FlotsamSalvageSystem } from '../../src/systems/FlotsamSalvageSystem.js';
import { PetCompanionSystem } from '../../src/systems/PetCompanionSystem.js';
import { StorageSystem } from '../../src/systems/StorageSystem.js';
import { ShopManager } from '../../src/ui/ShopManager.js';
import * as THREE from 'three';
const noop=()=>{};
let geography;
export function crystalSourceLimits(scenario) {
  if(!geography){
    const beach=new BeachResourceSystem(new THREE.Scene());
    const salvage=new FlotsamSalvageSystem(new THREE.Scene(),{});
    geography={veins:beach.fixedSpawns.filter(s=>s.type==='sol_vein').length,flotsam:salvage.spawnsConfig.length,respawn:salvage.RESPAWN_INTERVAL};
  }
  return {vein_mine:Math.floor(scenario.steps/CRYSTAL_VEIN.regrowthSteps)*geography.veins*(CRYSTAL_VEIN.base+1),
    camp_miner:CAMP_MINER_CRYSTALS,tidal_spawn:Math.floor(scenario.steps/CRYSTAL_VEIN.tidalSteps),
    monkey_crevice:Math.floor(scenario.minutes*60/MONKEY_CREVICE.cooldown)*MONKEY_CREVICE.crystals,
    flotsam_manual:geography.flotsam+Math.floor(scenario.minutes*60/geography.respawn),resonance_free:FREE_SHARES.daily,
    shard_condense:4*ODDS_TABLE.RIG_LEVELS[4].C*ODDS_TABLE.SHARD_RETURN_RATE,resonance_calib:4*ODDS_TABLE.PITY.crystals};
}
export function rtp(rounds,strategy='neutral',fixedPhase=null,fixedWeather=null) {
  let cost=0,value=0,pool=100,calib=0,maxMiss=0,maxPayoutRatio=0;
  const phases=['dawn','day','day','dusk','night'],weathers=['clear','clear','cloudy','rain','typhoon'];
  for(let i=0;i<rounds;i++){
    const phase=fixedPhase||phases[i%5],weather=fixedWeather||weathers[Math.floor(i/5)%5];
    const seed=`sim_rtp_${i}`,cluster=genCluster('day_1',i);
    const board=genNpcBoard(seed,5,ODDS_TABLE.PHASE_MULTIPLIERS[phase],ODDS_TABLE.WEATHER_MULTIPLIERS[weather],1,cluster);
    const deploy=Array(25).fill(0);
    const squares=strategy==='optimal'?[cluster.mainIndex,...cluster.subIndices]:[i%25,(i+7)%25,(i+14)%25];
    squares.forEach(s=>deploy[s]=5);
    const res=settle(board,deploy,pool,{u:5,roundSeed:seed,cluster,weather,currentCalib:calib});
    pool=res.motherlode.nextPool;calib=res.calib;maxMiss=Math.max(maxMiss,calib);maxPayoutRatio=Math.max(maxPayoutRatio,res.payout/(60*5));
    cost+=15*ODDS_TABLE.V;
    value+=res.payout+res.shards*ODDS_TABLE.SHARD_RETURN_RATE*ODDS_TABLE.V+res.motherlode.playerTake+(res.calibReward?.crystals||0)*ODDS_TABLE.V;
  }
  return {rtp:value/cost,maxMiss,maxPayoutRatio};
}
export function resonanceGates(rounds=200000){
  const failures=[],metrics={};
  for(const [name,strategy,phase,weather] of [
    ['neutral','neutral',null,null],['dawn','neutral','dawn',null],['day','neutral','day',null],
    ['dusk','neutral','dusk',null],['night','neutral','night',null],
    ['dayClear','neutral','day','clear'],['nightClear','neutral','night','clear'],['nightTyphoon','neutral','night','typhoon'],
    ['optimal','optimal',null,null]
  ]){
    const result=rtp(rounds,strategy,phase,weather);metrics[name]=result.rtp;
    if(result.maxMiss>15)failures.push(`${name} miss streak ${result.maxMiss}>15`);
    if(result.maxPayoutRatio>1)failures.push(`${name} payout cap exceeded`);
  }
  for(const key of ['neutral','dawn','day'])if(metrics[key]<.76||metrics[key]>.84)failures.push(`${key} RTP ${metrics[key]} outside [0.76,0.84]`);
  if(metrics.optimal>1.05)failures.push(`optimal RTP ${metrics.optimal}>1.05`);
  metrics.clearTiming=metrics.nightClear/metrics.dayClear-1;
  metrics.typhoonTiming=metrics.nightTyphoon/((metrics.dawn+metrics.day+metrics.dusk+metrics.night)/4)-1;
  for(const key of ['clearTiming','typhoonTiming'])if(metrics[key]>.15)failures.push(`${key} ${metrics[key]}>0.15`);
  return {metrics,failures};
}
export function r3Gates(){
  function make(){
    const game={scene:new THREE.Scene(),survival:{day:1,steps:250},story:{secondKidAwake:true},dayNight:{currentMode:'day'},weatherSystem:{currentWeather:'clear'},
      saveSystem:{saveSeed:'g3-r3',saveGame:()=>({success:true})},ui:{inventory:{},showToast:noop,showDialog:noop,renderInventory:noop,updateSurvivalHUD:noop,expandInventory:noop}};
    game.miningRig=new MiningRigSystem(game);game.campFacilities=new CampFacilitiesSystem(game);
    game.storageSystem=new StorageSystem(game);game.flotsamSalvage=new FlotsamSalvageSystem(game.scene,game);game.petCompanion=new PetCompanionSystem(game);
    game.campFacilities.assignJob('second_kid','miner');return game;
  }
  function measure(game){
    const rig=game.miningRig;
    for(let day=1;day<=30;day++){
      game.survival.day=day;game.campFacilities.onDayPassed();
      game.flotsamSalvage.flotsamList=[{collected:false,group:{visible:true},spec:{name:'crate',drops:['sol_crystal','wood_plank']}}];
      if(game.flotsamSalvage.hasAutoSalvageBuoy)game.flotsamSalvage.performAutoSalvage();
      // Identical actual rig deployments, not a hand-copied RS formula.
      rig.loadedCrystals=6;rig.resonance.freeShares=0;
      rig.ensureResonanceRound();rig.resonance.deploy.fill(0);rig.resonance.deploy[day%25]=6;
      rig.commitDeployment();rig.advanceResonanceProgress(80);rig.advanceResonanceProgress(20);
      if(!rig.settleResonanceRound().ok)throw new Error('R3 real round did not settle');
    }
    return {crystals:(game.storageSystem.storageInventory.sol_crystal||0)+(game.ui.inventory.sol_crystal||0),rs:rig.season.rs,injected:rig.motherlode.injected};
  }
  const reference=measure(make()),failures=[],diffs=[];
  if(reference.crystals!==60||reference.rs<=0)throw new Error('R3 baseline must exercise actual production and RS');
  const ids=new ShopManager(make(),{headless:true}).products.map(p=>p.id);
  for(const id of [...ids,'ALL_13']){
    const game=make(),shop=new ShopManager(game,{headless:true});
    const before=game.miningRig.motherlode.injected;
    for(const product of shop.products)if(product.id===id||id==='ALL_13')product.onPurchase();
    const purchaseInjection=game.miningRig.motherlode.injected-before;
    const value=measure(game),diff={id,crystals:value.crystals-reference.crystals,rs:value.rs-reference.rs,injected:value.injected-reference.injected,purchaseInjection};
    diffs.push(diff);
    if(diff.crystals!==0||diff.rs!==0||diff.injected!==0||purchaseInjection!==0)failures.push(`R3 ${JSON.stringify(diff)}`);
  }
  const game=make(),rig=game.miningRig;
  rig.resonance.freeShares=0;rig.resonance.freeGrantDay=0;rig.resonance.freeGrantTs=0;rig.resonance.freeGrantSteps=0;
  rig.onNewDay(1);const granted=rig.resonance.freeShares;
  for(let day=2;day<=11;day++)rig.onNewDay(day);
  if(granted!==FREE_SHARES.daily||rig.resonance.freeShares!==granted)failures.push('Repeated sleep granted extra free shares');
  return {diffs,failures};
}
