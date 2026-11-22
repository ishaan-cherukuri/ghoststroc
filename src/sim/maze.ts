import { makeRng, shuffle } from './rng';
import { DEPTHS, MINE } from './tuning';

export type Cell = 'wall' | 'floor';
export type OreKind = 'copper' | 'iron' | 'gold';
export const ORE_KINDS: readonly OreKind[] = ['copper', 'iron', 'gold'];

export interface OreNode {
  readonly id: number;
  /** Wall cell the ore sits in. */
  readonly wall: number;
  /** Floor cell it faces (where you stand to mine it). */
  readonly floor: number;
  readonly kind: OreKind;
}

export interface MineMap {
  readonly depth: number;
  readonly w: number;
  readonly h: number;
  /** Mutable: tremors change it during a run. */
  cells: Cell[];
  readonly hollow: ReadonlySet<number>;
  readonly checkpoints: readonly number[];
  readonly lift: number;
  /** Ladder down; null on the deepest level. */
  readonly ladder: number | null;
  ores: OreNode[];
}

export function neighbors(m: { w: number; h: number }, i: number): number[] {
  const x = i % m.w;
  const y = Math.floor(i / m.w);
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < m.w - 1) out.push(i + 1);
  if (y > 0) out.push(i - m.w);
  if (y < m.h - 1) out.push(i + m.w);
  return out;
}

/** BFS distances from `from` over cells where `pass` is true. */
export function bfs(m: { w: number; h: number }, from: number, pass: (i: number) => boolean): Map<number, number> {
  const dist = new Map<number, number>([[from, 0]]);
  const queue = [from];
  for (let q = 0; q < queue.length; q++) {
    const cur = queue[q] as number;
    const d = dist.get(cur) as number;
    for (const n of neighbors(m, cur)) {
      if (dist.has(n) || !pass(n)) continue;
      dist.set(n, d + 1);
      queue.push(n);
    }
  }
  return dist;
}

/** Floor that will hold you. */
export function isSolid(m: MineMap, i: number): boolean {
  return m.cells[i] === 'floor' && !m.hollow.has(i);
}

export function generateMine(depth: number, seed: number = MINE.SEEDS[depth] ?? depth + 1): MineMap {
  const n = MINE.MAZE_N[depth] ?? 10;
  const w = 2 * n + 1;
  const h = w;
  const rng = makeRng(seed);
  const cells: Cell[] = new Array<Cell>(w * h).fill('wall');
  const at = (x: number, y: number): number => y * w + x;
  const dims = { w, h };

  // Perfect maze by recursive backtracking over odd coordinates.
  const stack: [number, number][] = [[1, 1]];
  cells[at(1, 1)] = 'floor';
  while (stack.length > 0) {
    const [x, y] = stack[stack.length - 1] as [number, number];
    const opts = ([[2, 0], [-2, 0], [0, 2], [0, -2]] as const)
      .map(([dx, dy]) => [x + dx, y + dy] as const)
      .filter(([nx, ny]) => nx > 0 && ny > 0 && nx < w - 1 && ny < h - 1 && cells[at(nx, ny)] === 'wall');
    if (opts.length === 0) { stack.pop(); continue; }
    const [nx, ny] = opts[rng.int(opts.length)] as readonly [number, number];
    cells[at((x + nx) / 2, (y + ny) / 2)] = 'floor';
    cells[at(nx, ny)] = 'floor';
    stack.push([nx, ny]);
  }

  // Open some loops so there is more than one way around.
  const floorCount = (): number => cells.filter((c) => c === 'floor').length;
  const loopCands: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (cells[at(x, y)] !== 'wall') continue;
      const lr = cells[at(x - 1, y)] === 'floor' && cells[at(x + 1, y)] === 'floor';
      const ud = cells[at(x, y - 1)] === 'floor' && cells[at(x, y + 1)] === 'floor';
      if (lr !== ud) loopCands.push(at(x, y));
    }
  }
  const loops = Math.round(floorCount() * (MINE.LOOP_FRACTION[depth] ?? 0.05));
  for (const c of shuffle(rng, loopCands).slice(0, loops)) cells[c] = 'floor';

  const isFloor = (i: number): boolean => cells[i] === 'floor';
  const lift = at(1, 1);
  const fromLift = bfs(dims, lift, isFloor);
  const farthest = (score: (i: number) => number, exclude: ReadonlySet<number>): number => {
    let best = -1;
    let bestScore = -Infinity;
    for (const [i] of fromLift) {
      if (exclude.has(i)) continue;
      const s = score(i);
      if (s > bestScore) { bestScore = s; best = i; }
    }
    return best;
  };
  const ladder = depth < DEPTHS - 1 ? farthest((i) => fromLift.get(i) ?? 0, new Set([lift])) : null;

  // Checkpoints: farthest-point sampling by walking distance.
  const count = MINE.CHECKPOINTS_MIN + rng.int(MINE.CHECKPOINTS_MAX - MINE.CHECKPOINTS_MIN + 1);
  const anchors = ladder === null ? [lift] : [lift, ladder];
  const minDist = new Map<number, number>();
  const absorb = (from: number): void => {
    const d = bfs(dims, from, isFloor);
    for (const [i, v] of d) minDist.set(i, Math.min(minDist.get(i) ?? Infinity, v));
  };
  anchors.forEach(absorb);
  const checkpoints: number[] = [];
  for (let k = 0; k < count; k++) {
    const c = farthest((i) => minDist.get(i) ?? 0, new Set([...anchors, ...checkpoints]));
    checkpoints.push(c);
    absorb(c);
  }

  // Hollows: only where every solid floor cell stays reachable from the lift.
  const hollow = new Set<number>();
  const forbidden = new Set<number>();
  for (const s of [...anchors, ...checkpoints]) {
    forbidden.add(s);
    for (const nb of neighbors(dims, s)) forbidden.add(nb);
  }
  const hollowCands = [...fromLift.keys()].filter((i) => !forbidden.has(i)).sort((a, b) => a - b);
  const target = Math.round(fromLift.size * (MINE.HOLLOW_FRACTION[depth] ?? 0.05));
  for (const c of shuffle(rng, hollowCands)) {
    if (hollow.size >= target) break;
    hollow.add(c);
    const reach = bfs(dims, lift, (i) => isFloor(i) && !hollow.has(i));
    if (reach.size !== fromLift.size - hollow.size) hollow.delete(c);
  }

  // Ore: on wall cells that face a floor cell.
  const weights = MINE.ORE_WEIGHTS[depth] ?? MINE.ORE_WEIGHTS[0];
  const ores: OreNode[] = [];
  const special = new Set([lift, ...(ladder === null ? [] : [ladder])]);
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== 'wall') continue;
    const faces = neighbors(dims, i).filter((nb) => isFloor(nb) && !special.has(nb));
    if (faces.length === 0) continue;
    const face = faces[rng.int(faces.length)] as number;
    if (rng.next() >= (MINE.ORE_DENSITY[depth] ?? 0.1)) continue;
    const r = rng.next();
    const kind: OreKind = r < weights.copper ? 'copper' : r < weights.copper + weights.iron ? 'iron' : 'gold';
    ores.push({ id: ores.length, wall: i, floor: face, kind });
  }

  return { depth, w, h, cells, hollow, checkpoints, lift, ladder, ores };
}
