// Shared world anchors: rendering, interactions and objectives must use these.
export const ISLAND_LAYOUT = Object.freeze({
  spawn: Object.freeze([-10, -0.15, 39.5]),
  campfire: Object.freeze([-12, 0.05, 24]),
  tent: Object.freeze([-17, 0, 23]),
  chest: Object.freeze([-18.5, 0, 26]),
  noticeboard: Object.freeze([-17, 0.05, 19.5]),
  orderBoard: Object.freeze([-12, 0.05, 19.5]),
  radioTerminal: Object.freeze([-7, 0.05, 24]),
  waterPurifier: Object.freeze([-5, 0.05, 28.6]),
  miningRig: Object.freeze([-5.2, 0.05, 16.5]),
  scanner: Object.freeze([-3.5, 0, 17.5]),
  sos: Object.freeze([0, -0.12, 39.5]),
  raft: Object.freeze([-24, 0.05, 40]),
  pier: Object.freeze([-24, -0.15, 38]),
});
export const distanceXZ = (position, anchor) => Math.hypot(position.x - anchor[0], position.z - anchor[2]);
