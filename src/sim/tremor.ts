import { bfs, neighbors, type MineMap } from './maze';
import { shuffle, type Rng } from './rng';
import { TREMOR } from './tuning';

export interface TremorResult {
  readonly collapsed: readonly number[];
  readonly opened: readonly number[];
}

/**
 * Collapse some tunnels and open a few new passages. Guarantees the lift can
 * still reach every checkpoint, the ladder and the player over solid floor.
 */
export function applyTremor(m: MineMap, rng: Rng, playerCell: number): TremorResult {
  const { w } = m;
  const px = playerCell % w;
  const py = Math.floor(playerCell / w);
  const near = (i: number): boolean =>
    Math.max(Math.abs((i % w) - px), Math.abs(Math.floor(i / w) - py)) <= TREMOR.SAFE_RADIUS;
  const special = new Set<number>([m.lift, ...m.checkpoints, ...(m.ladder === null ? [] : [m.ladder])]);
  const mustReach = [...special, playerCell];
  const pass = (i: number): boolean => m.cells[i] === 'floor' && (!m.hollow.has(i) || i === playerCell);
  const connected = (): boolean => {
    const r = bfs(m, m.lift, pass);
    return mustReach.every((i) => r.has(i));
  };

  const count = TREMOR.COLLAPSE[m.depth] ?? 3;
  const collapseCands: number[] = [];
  const openCands: number[] = [];
  for (let i = 0; i < m.cells.length; i++) {
    const x = i % w;
    const y = Math.floor(i / w);
    if (m.cells[i] === 'floor' && !special.has(i) && !m.hollow.has(i) && !near(i)) collapseCands.push(i);
    const border = x === 0 || y === 0 || x === w - 1 || y === m.h - 1;
    if (m.cells[i] === 'wall' && !border && neighbors(m, i).filter((n) => m.cells[n] === 'floor').length >= 2) openCands.push(i);
  }

  const collapsed: number[] = [];
  for (const c of shuffle(rng, collapseCands)) {
    if (collapsed.length >= count) break;
    m.cells[c] = 'wall';
    if (connected()) collapsed.push(c);
    else m.cells[c] = 'floor';
  }
  const opened = shuffle(rng, openCands.filter((c) => !collapsed.includes(c))).slice(0, TREMOR.OPEN);
  for (const c of opened) m.cells[c] = 'floor';

  m.ores = m.ores.filter((o) => m.cells[o.wall] === 'wall' && m.cells[o.floor] === 'floor');
  return { collapsed, opened };
}
