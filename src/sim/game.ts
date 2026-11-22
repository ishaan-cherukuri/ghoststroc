import { truthOf, tileAt } from './grid';
import { decay, flash, initialLamps, type LampConfig, type LampState } from './lamps';
import { LEVELS, parseLevel } from './levels';
import type { Channel, Grid, Point } from './types';

// ---- Game constants -------------------------------------------------------
export const GAME = {
  MAX_HP: 3,
  /** HP lost per fall (pit or collapse). Eye-tuned. */
  FALL_DAMAGE: 1,
  /** Charges per lamp granted by taking the stairs onto a floor. Eye-tuned. */
  CHARGES_PER_FLOOR: 4,
  /** Falling is a costly shortcut: it does not refill lamps. Eye-tuned. */
  REFILL_ON_FALL: false,
} as const;
// ---------------------------------------------------------------------------

export type Dir = 'up' | 'down' | 'left' | 'right';
export type Action =
  | { readonly type: 'move'; readonly dir: Dir }
  | { readonly type: 'flash'; readonly channel: Channel }
  | { readonly type: 'wait' };

export type GameEvent =
  | 'blocked' | 'no-charge' | 'cracked' | 'collapsed' | 'fell'
  | 'descended' | 'extracted' | 'died' | 'fell-into-deep';

export interface GameState {
  readonly level: number;
  readonly player: Point;
  readonly hp: number;
  readonly charges: Readonly<Record<Channel, number>>;
  readonly lamps: LampState;
  readonly turn: number;
  /** Hollow tile the player has stood on for one turn; collapses if still there. */
  readonly armedHollow: Point | null;
  readonly status: 'playing' | 'dead' | 'won';
  readonly events: readonly GameEvent[];
  readonly flashes: Readonly<Record<Channel, number>>;
}

const GRIDS: readonly Grid[] = LEVELS.map((l) => parseLevel(l.rows));

export function gridFor(level: number): Grid {
  const g = GRIDS[level];
  if (!g) throw new RangeError(`no level ${level}`);
  return g;
}

const DELTA: Readonly<Record<Dir, Point>> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

const same = (a: Point | null, b: Point): boolean => a !== null && a.x === b.x && a.y === b.y;

function fullCharges(): Record<Channel, number> {
  return { red: GAME.CHARGES_PER_FLOOR, cyan: GAME.CHARGES_PER_FLOOR };
}

export function newGame(): GameState {
  return {
    level: 0, player: gridFor(0).start, hp: GAME.MAX_HP, charges: fullCharges(),
    lamps: initialLamps(), turn: 0, armedHollow: null, status: 'playing', events: [],
    flashes: { red: 0, cyan: 0 },
  };
}

/** Nearest sound tile by Manhattan distance; ties broken in row-major order. */
export function landingSpot(grid: Grid, from: Point): Point {
  let best: Point | null = null;
  let bestD = Infinity;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const d = Math.abs(x - from.x) + Math.abs(y - from.y);
      if (d < bestD && truthOf(tileAt(grid, { x, y })) === 'sound') { best = { x, y }; bestD = d; }
    }
  }
  if (!best) throw new Error('floor has no sound tile');
  return best;
}

function enterLevel(s: GameState, level: number, at: Point, refill: boolean): GameState {
  return {
    ...s, level, player: at, lamps: initialLamps(), armedHollow: null,
    charges: refill ? fullCharges() : s.charges,
  };
}

function fall(s: GameState, events: GameEvent[]): GameState {
  const hp = s.hp - GAME.FALL_DAMAGE;
  if (s.level === GRIDS.length - 1) return { ...s, hp: Math.max(0, hp), status: 'dead', events: [...events, 'fell-into-deep'] };
  if (hp <= 0) return { ...s, hp: 0, status: 'dead', events: [...events, 'died'] };
  const below = s.level + 1;
  return { ...enterLevel(s, below, landingSpot(gridFor(below), s.player), GAME.REFILL_ON_FALL), hp, events };
}

/** One turn (§7.1). Rejected actions cost no turn and change nothing but events. */
export function step(s: GameState, a: Action, cfg: LampConfig): GameState {
  if (s.status !== 'playing') return s;
  const grid = gridFor(s.level);
  const events: GameEvent[] = [];
  let { player, lamps, charges, flashes } = s;

  // 1. Resolve the player's action.
  if (a.type === 'move') {
    const n = { x: player.x + DELTA[a.dir].x, y: player.y + DELTA[a.dir].y };
    const inside = n.x >= 0 && n.y >= 0 && n.x < grid.width && n.y < grid.height;
    if (!inside || truthOf(tileAt(grid, n)) === 'rock') return { ...s, events: ['blocked'] };
    player = n;
  } else if (a.type === 'flash') {
    if (charges[a.channel] <= 0) return { ...s, events: ['no-charge'] };
    charges = { ...charges, [a.channel]: charges[a.channel] - 1 };
    flashes = { ...flashes, [a.channel]: flashes[a.channel] + 1 };
    lamps = flash(lamps, a.channel, cfg);
  }

  // 2. Decay both channels.
  lamps = decay(lamps);

  // 3. Creatures: none until stage 4.

  // 4. Environment: falls and collapses.
  const next: GameState = { ...s, player, lamps, charges, flashes, turn: s.turn + 1, events };
  const truth = truthOf(tileAt(grid, player));
  if (truth === 'pit') return fall(next, [...events, 'fell']);
  let armedHollow: Point | null = null;
  if (truth === 'hollow') {
    if (same(s.armedHollow, player)) return fall(next, [...events, 'collapsed']);
    armedHollow = player;
    events.push('cracked');
  }

  // 5. Exits and run end.
  if (same(grid.exit, player)) {
    if (s.level === GRIDS.length - 1) return { ...next, armedHollow, status: 'won', events: [...events, 'extracted'] };
    return { ...enterLevel(next, s.level + 1, gridFor(s.level + 1).start, true), events: [...events, 'descended'] };
  }
  return { ...next, armedHollow };
}
