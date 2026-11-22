import { EMPTY_CARRIED, type Carried, type GearStats } from './economy';
import { LAMP_OFF, pressLamp, tickLamp, type LampColor, type LampState } from './lamp';
import { generateMine, isSolid, neighbors, type Cell, type MineMap, type OreNode } from './maze';
import { cellCenter, cellOf, moveCircle, type Vec2 } from './movement';
import { makeRng, type Rng } from './rng';
import { applyTremor, type TremorResult } from './tremor';
import { BATTERY, CELL, DEPTHS, HAZARD, LAMP, MINING, PLAYER, TREMOR } from './tuning';

export type RunEvent =
  | 'step' | 'lamp-charge' | 'lamp-active' | 'lamp-end' | 'lamp-empty'
  | 'mine-tick' | 'mined' | 'bag-full' | 'crack' | 'fall'
  | 'tremor-warn' | 'tremor' | 'checkpoint' | 'charted'
  | 'battery-low' | 'dark' | 'faint';

export type RunOutcome = 'surfaced' | 'fainted' | 'fell' | 'ladder';

export interface RunInput {
  /** World-space move direction (already camera-relative). Length ≤ 1. */
  readonly moveX: number;
  readonly moveZ: number;
  /** Held: swing the pickaxe at the ore in front of you. */
  readonly mine: boolean;
  /** Pressed this tick: use lift / ladder. */
  readonly use: boolean;
  /** Pressed this tick. */
  readonly lamp: LampColor | null;
}

export const NO_INPUT: RunInput = { moveX: 0, moveZ: 0, mine: false, use: false, lamp: null };

export interface RunState {
  readonly depth: number;
  readonly map: MineMap;
  readonly stats: GearStats;
  pos: Vec2;
  /** Radians; 0 faces +z. */
  facing: number;
  moving: boolean;
  battery: number;
  carried: Carried;
  lamp: LampState;
  hollowTimer: number;
  darkTimer: number;
  /** Cells walked since the last checkpoint — charted on reaching one. */
  visited: Set<number>;
  /** What the map shows: cell type as it was when charted. */
  charted: Map<number, Cell>;
  checkpointsReached: Set<number>;
  time: number;
  nextTremor: number;
  tremorWarned: boolean;
  lastTremor: TremorResult | null;
  /** Bumped whenever map.cells changes, so views can rebuild. */
  mapVersion: number;
  mining: { oreId: number; progress: number } | null;
  /** Ore that was just mined (for particles). */
  lastMined: OreNode | null;
  lowWarned: boolean;
  stepAcc: number;
  outcome: RunOutcome | null;
  events: RunEvent[];
  readonly rng: Rng;
}

export interface RunOptions {
  /** Previously charted cells for this depth (from the save). */
  readonly charted?: readonly number[];
  readonly carried?: Carried;
  readonly battery?: number;
  /** Land at the solid floor nearest this fraction of the map (after a fall). */
  readonly landingFrac?: Vec2;
  /** Varies tremor timing between trips. */
  readonly tripSeed?: number;
}

export function nearestSolid(m: MineMap, target: Vec2): number {
  let best = m.lift;
  let bestD = Infinity;
  for (let i = 0; i < m.cells.length; i++) {
    if (!isSolid(m, i)) continue;
    const c = cellCenter(m, i);
    const d = Math.hypot(c.x - target.x, c.z - target.z);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

export function startRun(depth: number, stats: GearStats, opts: RunOptions = {}): RunState {
  const map = generateMine(depth);
  const rng = makeRng(0x9e3779b9 ^ ((depth + 1) * 7919) ^ ((opts.tripSeed ?? 0) * 104729));
  const startCell = opts.landingFrac
    ? nearestSolid(map, { x: opts.landingFrac.x * map.w * CELL, z: opts.landingFrac.z * map.h * CELL })
    : map.lift;
  const charted = new Map<number, Cell>();
  for (const i of opts.charted ?? []) {
    const c = map.cells[i];
    if (c) charted.set(i, c);
  }
  return {
    depth, map, stats,
    pos: cellCenter(map, startCell),
    facing: 0, moving: false,
    battery: Math.min(stats.batteryMax, opts.battery ?? stats.batteryMax),
    carried: { ...(opts.carried ?? EMPTY_CARRIED) },
    lamp: LAMP_OFF, hollowTimer: 0, darkTimer: 0,
    visited: new Set([startCell]), charted, checkpointsReached: new Set(),
    time: 0,
    nextTremor: TREMOR.MIN_S + rng.next() * (TREMOR.MAX_S - TREMOR.MIN_S),
    tremorWarned: false, lastTremor: null, mapVersion: 0,
    mining: null, lastMined: null, lowWarned: false, stepAcc: 0,
    outcome: null, events: [], rng,
  };
}

export function carriedTotal(c: Carried): number {
  return c.copper + c.iron + c.gold;
}

export function orePosition(m: MineMap, o: OreNode): Vec2 {
  const a = cellCenter(m, o.wall);
  const b = cellCenter(m, o.floor);
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
}

/** The ore you would hit if you swung now: in reach and roughly in front. */
export function mineTarget(r: RunState): OreNode | null {
  const fx = Math.sin(r.facing);
  const fz = Math.cos(r.facing);
  let best: OreNode | null = null;
  let bestD: number = MINING.REACH;
  for (const o of r.map.ores) {
    const p = orePosition(r.map, o);
    const dx = p.x - r.pos.x;
    const dz = p.z - r.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > bestD || d < 1e-6) continue;
    if ((dx * fx + dz * fz) / d < 0.35) continue;
    best = o;
    bestD = d;
  }
  return best;
}

/** Chart the path walked since the last checkpoint (plus the walls beside it). */
function chart(r: RunState): number {
  let changed = 0;
  const put = (i: number): void => {
    const c = r.map.cells[i];
    if (c && r.charted.get(i) !== c) { r.charted.set(i, c); changed++; }
  };
  for (const v of r.visited) {
    put(v);
    for (const n of neighbors(r.map, v)) put(n);
  }
  r.visited = new Set([cellOf(r.map, r.pos)]);
  return changed;
}

/** Advance one fixed step. Mutates `r`; read `r.events` afterwards. */
export function stepRun(r: RunState, input: RunInput, dt: number): void {
  r.events = [];
  r.lastMined = null;
  if (r.outcome) return;
  const ev = (e: RunEvent): void => { r.events.push(e); };
  r.time += dt;

  // Battery: the clock.
  const drain = BATTERY.BASE_DRAIN_PER_S * (BATTERY.DEPTH_MULT[r.depth] ?? 1) * dt;
  r.battery = Math.max(0, r.battery - drain);
  if (!r.lowWarned && r.battery <= r.stats.batteryMax * BATTERY.LOW_FRACTION) { r.lowWarned = true; ev('battery-low'); }
  if (r.battery <= 0) {
    if (r.darkTimer === 0) ev('dark');
    r.darkTimer += dt;
    r.lamp = LAMP_OFF;
    if (r.darkTimer >= BATTERY.FAINT_AFTER_DARK_S) { r.outcome = 'fainted'; ev('faint'); return; }
  }

  // Lamps.
  if (input.lamp && r.battery > 0) {
    if (r.battery < LAMP.COST) ev('lamp-empty');
    else {
      const next = pressLamp(r.lamp, input.lamp);
      if (next !== r.lamp) { r.lamp = next; r.battery -= LAMP.COST; ev('lamp-charge'); }
    }
  }
  const before = r.lamp.phase;
  r.lamp = tickLamp(r.lamp, dt);
  if (before === 'charging' && r.lamp.phase === 'active') ev('lamp-active');
  if (before === 'active' && r.lamp.phase === 'off') ev('lamp-end');

  // Movement.
  const len = Math.hypot(input.moveX, input.moveZ);
  if (len > 0.01) {
    const k = Math.min(1, len) / len;
    const dx = input.moveX * k * r.stats.speed * dt;
    const dz = input.moveZ * k * r.stats.speed * dt;
    r.pos = moveCircle(r.map, r.pos, dx, dz, PLAYER.RADIUS);
    r.facing = Math.atan2(input.moveX, input.moveZ);
    r.moving = true;
    r.mining = null;
    r.stepAcc += dt;
    if (r.stepAcc >= 0.32) { r.stepAcc = 0; ev('step'); }
  } else {
    r.moving = false;
  }

  const cell = cellOf(r.map, r.pos);
  r.visited.add(cell);

  // Checkpoints (and the lift) chart your path.
  const isCheckpoint = r.map.checkpoints.includes(cell);
  if (isCheckpoint || cell === r.map.lift) {
    if (chart(r) > 0) ev('charted');
    if (isCheckpoint && !r.checkpointsReached.has(cell)) { r.checkpointsReached.add(cell); ev('checkpoint'); }
  }

  // Hollow floor.
  if (r.map.hollow.has(cell) && r.map.cells[cell] === 'floor') {
    if (r.hollowTimer === 0) ev('crack');
    r.hollowTimer += dt;
    if (r.hollowTimer >= HAZARD.HOLLOW_GRACE_S) {
      r.battery = Math.max(0, r.battery - HAZARD.FALL_BATTERY_COST);
      r.outcome = r.depth >= DEPTHS - 1 ? 'fainted' : 'fell';
      ev('fall');
      return;
    }
  } else {
    r.hollowTimer = 0;
  }

  // Mining.
  if (input.mine && !r.moving) {
    const t = mineTarget(r);
    if (t) {
      if (!r.mining || r.mining.oreId !== t.id) r.mining = { oreId: t.id, progress: 0 };
      const prev = r.mining.progress;
      r.mining.progress += dt * r.stats.pickSpeed;
      if (Math.floor(prev / 0.4) !== Math.floor(r.mining.progress / 0.4)) ev('mine-tick');
      if (r.mining.progress >= MINING.TIME_S[t.kind]) {
        r.mining = null;
        if (carriedTotal(r.carried) >= r.stats.bagMax) ev('bag-full');
        else {
          r.carried = { ...r.carried, [t.kind]: r.carried[t.kind] + 1 };
          r.map.ores = r.map.ores.filter((o) => o.id !== t.id);
          r.lastMined = t;
          ev('mined');
        }
      }
    } else r.mining = null;
  } else r.mining = null;

  // Lift and ladder.
  if (input.use) {
    if (cell === r.map.lift) { chart(r); r.outcome = 'surfaced'; return; }
    if (cell === r.map.ladder) { chart(r); r.outcome = 'ladder'; return; }
  }

  // Tremors.
  if (!r.tremorWarned && r.time >= r.nextTremor - TREMOR.WARN_S) { r.tremorWarned = true; ev('tremor-warn'); }
  if (r.time >= r.nextTremor) {
    r.lastTremor = applyTremor(r.map, r.rng, cell);
    r.mapVersion++;
    r.tremorWarned = false;
    r.nextTremor = r.time + TREMOR.MIN_S + r.rng.next() * (TREMOR.MAX_S - TREMOR.MIN_S);
    ev('tremor');
  }
}

/** Charted indices, for saving. */
export function chartedList(r: RunState): number[] {
  return [...r.charted.keys()].sort((a, b) => a - b);
}
