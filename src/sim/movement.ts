import type { MineMap } from './maze';
import { CELL } from './tuning';

export interface Vec2 {
  readonly x: number;
  readonly z: number;
}

export function cellOf(m: { w: number }, p: Vec2): number {
  return Math.floor(p.z / CELL) * m.w + Math.floor(p.x / CELL);
}

export function cellCenter(m: { w: number }, i: number): Vec2 {
  return { x: ((i % m.w) + 0.5) * CELL, z: (Math.floor(i / m.w) + 0.5) * CELL };
}

function hitsWall(m: MineMap, p: Vec2, r: number): boolean {
  const x0 = Math.floor((p.x - r) / CELL);
  const x1 = Math.floor((p.x + r) / CELL);
  const z0 = Math.floor((p.z - r) / CELL);
  const z1 = Math.floor((p.z + r) / CELL);
  for (let cz = z0; cz <= z1; cz++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (cx < 0 || cz < 0 || cx >= m.w || cz >= m.h) return true;
      if (m.cells[cz * m.w + cx] !== 'wall') continue;
      const nx = Math.max(cx * CELL, Math.min(p.x, (cx + 1) * CELL));
      const nz = Math.max(cz * CELL, Math.min(p.z, (cz + 1) * CELL));
      if ((p.x - nx) ** 2 + (p.z - nz) ** 2 < r * r) return true;
    }
  }
  return false;
}

/** Axis-separated circle-vs-grid movement: slides along walls. */
export function moveCircle(m: MineMap, p: Vec2, dx: number, dz: number, r: number): Vec2 {
  let q = p;
  const tx = { x: q.x + dx, z: q.z };
  if (!hitsWall(m, tx, r)) q = tx;
  const tz = { x: q.x, z: q.z + dz };
  if (!hitsWall(m, tz, r)) q = tz;
  return q;
}
