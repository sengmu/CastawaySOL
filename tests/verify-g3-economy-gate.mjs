import assert from 'node:assert/strict';
import { EconomyLedger, LEDGER_SOURCES, LEDGER_SINKS } from '../src/systems/EconomyLedger.js';
const game = { survival: {day:1}, ui:{inventory:{}} };
const ledger = new EconomyLedger(game);
for (const [resource, types] of Object.entries(LEDGER_SOURCES)) {
  for (const type of types) {
    ledger.credit(resource, 2, type);
    assert.equal(ledger.serialize().days.at(-1).inflow[resource][type], 2, type);
  }
}
for (const [resource, types] of Object.entries(LEDGER_SINKS)) {
  for (const type of types) {
    assert.equal(ledger.debit(resource, 1, type), true);
    assert.equal(ledger.serialize().days.at(-1).outflow[resource][type], 1, type);
  }
}
const before = structuredClone(game.ui.inventory);
assert.equal(ledger.debit('sol_token', 1e9, 'shop'), false);
assert.deepEqual(game.ui.inventory,before);
for(const n of [-1,NaN,Infinity]) assert.throws(()=>ledger.credit('sol_token',n,'checkin'));
assert.throws(()=>ledger.credit('sol_token',1,'unknown'));
const snapshot=ledger.serialize();
for(let day=2;day<=40;day++){game.survival.day=day;ledger.credit('sol_token',1,'checkin');}
assert.equal(ledger.serialize().days.length,30);
assert.equal(ledger.serialize().days[0].day,11);
game.survival.day=1;ledger.deserialize(snapshot);assert.deepEqual(ledger.serialize(),snapshot);
console.log('G3 ledger enums / validation / retention passed');

// Transfers never mint a second copy of income.
const from={sol_token:5},to={};
const incomeBefore=ledger.serialize();
assert.equal(ledger.transfer('sol_token',3,'claim_payout',from,'sol_token',to,'sol_token'),true);
assert.equal(from.sol_token+to.sol_token,5);
assert.deepEqual(ledger.serialize().days[0].inflow,incomeBefore.days[0].inflow);
assert.equal(ledger.transfer('sol_token',10,'claim_payout',from,'sol_token',to,'sol_token'),false);
assert.throws(()=>ledger.transfer('sol_token',Infinity,'claim_payout',from,'sol_token',to,'sol_token'));

const {MiningRigSystem}=await import('../src/systems/MiningRigSystem.js');
const {SaveSystem,CURRENT_SCHEMA_VERSION}=await import('../src/systems/SaveSystem.js');
const quiet=()=>{};
const g={survival:{day:1},ui:{inventory:{sol_token:100,sol_crystal:5},showToast:quiet,showDialog:quiet,renderInventory:quiet},saveSystem:{saveGame:()=>({success:false})}};
const rig=g.miningRig=new MiningRigSystem(g);
const initial=g.economyLedger.serialize();
assert.equal(rig.upgradeRig().ok,false);
assert.equal(g.ui.inventory.sol_token,100);
assert.equal(rig.rigLevel,1);
assert.deepEqual(g.economyLedger.serialize(),initial,'failed upgrade rolls back ledger and injected pool');
assert.equal(rig.motherlode.injected,0);
const save=new SaveSystem(g);
save.saveGame=()=>({success:false});
assert.equal(save.claimDailyCheckin(1),false);
assert.equal(g.ui.inventory.sol_token,100);
assert.deepEqual(g.economyLedger.serialize(),initial,'failed checkin rolls back ledger');
save.saveGame=()=>({success:true});
assert.equal(save.claimDailyCheckin(1),true);
assert.equal(save.claimDailyCheckin(1),false);
assert.equal(g.ui.inventory.sol_token,105);
assert.equal(CURRENT_SCHEMA_VERSION,2);
assert.deepEqual(save.migrate({schemaVersion:2}).economyLedger,{days:[]});
assert.deepEqual(save.createSnapshot().economyLedger,g.economyLedger.serialize());
rig.resonance.phase='REVEAL';
rig.resonance.lastResult={payout:1.6,shards:4,calib:0,winningSquare:0,hit:false,crit:{name:'none'},motherlode:{won:false,nextPool:0,playerTake:0,npcBurned:0}};
g.saveSystem.saveGame=()=>({success:false});
const beforeSettlement=structuredClone(rig.serialize()),beforeLedger=g.economyLedger.serialize();
assert.equal(rig.settleResonanceRound().ok,false);
assert.deepEqual(rig.serialize(),beforeSettlement);
assert.deepEqual(g.economyLedger.serialize(),beforeLedger,'failed settlement rolls back all income');

const {readFileSync,readdirSync}=await import('node:fs');
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(`${dir}/${e.name}`):[`${dir}/${e.name}`]);}
const bypasses=[];
const literal=/(?:inv|inventory|storage)\s*(?:\[\s*['"]sol_(?:token|crystal)['"]\s*\]|\.sol_(?:token|crystal))\s*(?:\+\+|--|[+\-*/]=)/g;
for(const file of files('src').filter(f=>f.endsWith('.js')&&!f.endsWith('/EconomyLedger.js'))){
 const source=readFileSync(file,'utf8');if(literal.test(source))bypasses.push(file);
}
assert.deepEqual(bypasses,[],'No literal economy-resource increments bypass ledger');
const {simulateEconomy,assertEconomy}=await import('../tools/sim-economy.mjs');
const result=simulateEconomy();
assert.deepEqual(result,simulateEconomy(),'Scenario repeatability');
for(const d of result.snapshots){
 for(const asset of ['sol_token','sol_crystal','sol_shard']){
  const incoming=Object.values(d.totals.inflow[asset]||{}).reduce((a,b)=>a+b,0);
  const outgoing=Object.values(d.totals.outflow[asset]||{}).reduce((a,b)=>a+b,0);
  const balance=asset==='sol_token'?d.balance+d.dust:asset==='sol_crystal'?d.rawRemaining+(d.totals.inflow.sol_crystal.resonance_free||0)-Math.min(d.totals.outflow.sol_crystal.resonance_commit||0,d.totals.inflow.sol_crystal.resonance_free||0):d.shards;
  assert.ok(Math.abs(incoming-outgoing-balance)<1e-7,`${asset} Day${d.day} conservation`);
 }
}
const {ShipUpgradeSystem}=await import('../src/systems/ShipUpgradeSystem.js');
const {PetCompanionSystem}=await import('../src/systems/PetCompanionSystem.js');
const ship=new ShipUpgradeSystem(g);ship.currentTierLevel=2;
const pet=new PetCompanionSystem(g);pet.activePetId='dom_sheep';
for(const resource of ['sol_token','sol_crystal']){
 const amount=g.ui.inventory[resource];
 const before=g.economyLedger.serialize().days[0];
 assert.ok(ship.depositToCargo(resource,1));assert.ok(ship.withdrawFromCargo(resource,1));
 assert.ok(pet.depositToSheepPouch(resource,1));assert.ok(pet.withdrawFromSheepPouch(resource,1));
 assert.equal(g.ui.inventory[resource],amount);
 assert.deepEqual(g.economyLedger.serialize().days[0].inflow,before.inflow);
 assert.equal(g.economyLedger.serialize().days[0].transfers[resource].storage_deposit,2);
 assert.equal(g.economyLedger.serialize().days[0].transfers[resource].storage_withdraw,2);
}
const {resonanceGates,r3Gates}=await import('../tools/lib/economy-gates.mjs');
const r3=r3Gates();assert.equal(r3.diffs.length,14);assert.deepEqual(r3.failures,[]);
console.log('G3 transfers / rollback / save defaults / grep / conservation / 13 SOL callbacks passed');
const resonance=resonanceGates();
console.log('G3 resonance metrics:',JSON.stringify(resonance.metrics));
assert.deepEqual([...assertEconomy(result),...resonance.failures],[],'Unrelaxed economy hard gates');
