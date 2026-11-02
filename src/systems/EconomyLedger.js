// Pure account logic. Production credits and internal transfers have separate totals.
export const LEDGER_SOURCES = Object.freeze({
  sol_token: ['decrypt', 'resonance_main', 'resonance_ml', 'checkin'],
  sol_crystal: ['vein_mine', 'tidal_spawn', 'flotsam_manual', 'camp_miner', 'monkey_crevice', 'initial_silo', 'shard_condense', 'resonance_calib', 'resonance_free'],
  sol_shard: ['resonance_shard']
});
export const LEDGER_SINKS = Object.freeze({
  sol_token: ['rig_upgrade', 'scanner', 'shop', 'ship', 'refinery'],
  sol_crystal: ['decrypt_consume', 'resonance_commit', 'refinery_consume'],
  sol_shard: ['shard_condense']
});
export const isEconomyResource = resource => Object.hasOwn(LEDGER_SOURCES, resource);
export function economyLedger(game) {
  return game.economyLedger ||= new EconomyLedger(game);
}
export class EconomyLedger {
  constructor(game) { this.game = game; this.days = []; }
  validate(resource, n, type, direction) {
    if (!Number.isFinite(n) || n < 0) throw new RangeError('Invalid ledger amount');
    if (!(direction === 'inflow' ? LEDGER_SOURCES : LEDGER_SINKS)[resource]?.includes(type)) throw new TypeError(`Unknown ${resource} ${direction}: ${type}`);
  }
  record(resource, n, type, direction) {
    if (!n) return;
    const day = this.game?.survival?.day || 1;
    this.days = this.days.filter(d => d.day >= day - 29 && d.day <= day);
    let row = this.days.find(d => d.day === day);
    if (!row) { row = {day, inflow:{}, outflow:{}, transfers:{}}; this.days.push(row); }
    const group = row[direction];
    const asset = group[resource] ||= {};
    asset[type] = Math.round(((asset[type] || 0) + n) * 1e8) / 1e8;
  }
  credit(resource, n, source, account = this.game.ui.inventory, key = resource) {
    this.validate(resource,n,source,'inflow');
    account[key] = (account[key] || 0) + n;
    this.record(resource,n,source,'inflow');
    return true;
  }
  debit(resource, n, sink, account = this.game.ui.inventory, key = resource) {
    this.validate(resource,n,sink,'outflow');
    if ((account[key] || 0) < n) return false;
    account[key] = Math.max(0,(account[key] || 0) - n);
    this.record(resource,n,sink,'outflow');
    return true;
  }
  transfer(resource,n,type,from,fromKey,to,toKey) {
    if (!isEconomyResource(resource) || !['claim_payout','rig_load','storage_deposit','storage_withdraw'].includes(type)) throw new TypeError('Unknown transfer');
    if (!Number.isFinite(n) || n < 0) throw new RangeError('Invalid transfer');
    if ((from[fromKey] || 0) < n) return false;
    from[fromKey] -= n; to[toKey] = (to[toKey] || 0) + n;
    this.record(resource,n,type,'transfers'); return true;
  }
  serialize() {
    const day = this.game?.survival?.day || 1;
    return {days: structuredClone(this.days.filter(d=>d.day>=day-29 && d.day<=day))};
  }
  deserialize(data) { this.days = structuredClone(data?.days || []); }
}
