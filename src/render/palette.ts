import * as THREE from 'three';

// Mine albedos are CHANNEL-PURE (CLAUDE.md §3). Red lamp light (pure red)
// only reflects off red albedo; cyan lamp light (pure G+B) only off G/B albedo.
// Adding green to a wall or red to gold breaks the lamp mechanic.
export const MINE_ALBEDO = {
  wall: new THREE.Color(0.42, 0, 0),
  /** Solid floor reflects both lamps. */
  floorSolid: new THREE.Color(0.34, 0.3, 0.3),
  /** Hollow floor: identical to solid under red, black under cyan. */
  floorHollow: new THREE.Color(0.34, 0, 0),
  copper: new THREE.Color(1, 0, 0),
  iron: new THREE.Color(0.7, 0, 0),
  gold: new THREE.Color(0, 1, 0.75),
  /** Checkpoint frames and lift: deliberately visible in both. */
  wood: new THREE.Color(0.5, 0.32, 0.16),
} as const;

export const LIGHT = {
  /** Always-on helmet lamp (pure red). EYE-TUNED. */
  HELMET_COLOR: 0xff0000,
  HELMET_INTENSITY: 16,
  HELMET_RANGE: 6,
  RED: 0xff0000,
  CYAN: 0x00ffff,
  /** Peak lamp intensity. EYE-TUNED. */
  PULSE_INTENSITY: 45,
  LANTERN: 0xffc070,
  LANTERN_INTENSITY: 6,
} as const;

/** Real-world colours for the miner (lit normally in town). */
export const MINER_COLORS = {
  overalls: 0x2f5fb3,
  shirt: 0xd9663a,
  skin: 0xe8b98f,
  helmet: 0xf2c230,
  boots: 0x3b2a1e,
  handle: 0x8a5a2b,
  pickHead: 0x9aa3ad,
} as const;
