import type { Vec2 } from './movement';

export type BuildingId = 'assay' | 'smelter' | 'outfitter' | 'minehead';

export interface Building {
  readonly id: BuildingId;
  readonly name: string;
  readonly x: number;
  readonly z: number;
  /** Half extents. */
  readonly hw: number;
  readonly hd: number;
  readonly door: Vec2;
}

/** Town layout, shared by collision (sim) and the town view (render). */
export const TOWN = {
  BOUNDS: 24,
  SPAWN: { x: 0, z: 0 } as Vec2,
  DOOR_REACH: 2.4,
  BUILDINGS: [
    { id: 'minehead', name: 'Mine Head', x: 0, z: -11, hw: 3, hd: 3, door: { x: 0, z: -7.4 } },
    { id: 'assay', name: 'Assay Office', x: -12, z: -4, hw: 3.5, hd: 3, door: { x: -8, z: -4 } },
    { id: 'smelter', name: 'Smelter', x: 12, z: -4, hw: 3.5, hd: 3, door: { x: 8, z: -4 } },
    { id: 'outfitter', name: 'Outfitter', x: -11, z: 10, hw: 3.5, hd: 3, door: { x: -7, z: 10 } },
  ] as readonly Building[],
  POND: { x: 11, z: 11, r: 4 },
  TREES: [
    [-20, -16], [-16, -19], [17, -17], [21, -12], [-21, 3], [-19, 18], [-6, 19], [3, 21],
    [20, 3], [21, 20], [6, -19], [-7, -18], [-22, -6], [22, -2], [-14, 21], [14, 21],
  ] as readonly (readonly [number, number])[],
  TREE_R: 0.7,
} as const;

function blocked(p: Vec2, r: number): boolean {
  if (Math.abs(p.x) > TOWN.BOUNDS || Math.abs(p.z) > TOWN.BOUNDS) return true;
  for (const b of TOWN.BUILDINGS) {
    if (Math.abs(p.x - b.x) < b.hw + r && Math.abs(p.z - b.z) < b.hd + r) return true;
  }
  if (Math.hypot(p.x - TOWN.POND.x, p.z - TOWN.POND.z) < TOWN.POND.r + r) return true;
  return TOWN.TREES.some(([x, z]) => Math.hypot(p.x - x, p.z - z) < TOWN.TREE_R + r);
}

export function moveInTown(p: Vec2, dx: number, dz: number, r: number): Vec2 {
  let q = p;
  const tx = { x: q.x + dx, z: q.z };
  if (!blocked(tx, r)) q = tx;
  const tz = { x: q.x, z: q.z + dz };
  if (!blocked(tz, r)) q = tz;
  return q;
}

export function doorNear(p: Vec2): Building | null {
  let best: Building | null = null;
  let bestD: number = TOWN.DOOR_REACH;
  for (const b of TOWN.BUILDINGS) {
    const d = Math.hypot(p.x - b.door.x, p.z - b.door.z);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}
