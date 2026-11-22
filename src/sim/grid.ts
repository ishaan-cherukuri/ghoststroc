import type { Grid, Point, StepResult, Tile, TileTruth } from './types';

/** Truth table, CLAUDE.md §3.2. This is the game. */
export function truthOf(tile: Tile): TileTruth {
  if (tile.matter && tile.support) return 'sound';
  if (tile.matter) return 'hollow';
  if (tile.support) return 'pit';
  return 'rock';
}

export function stepResult(tile: Tile): StepResult {
  switch (truthOf(tile)) {
    case 'sound':
      return 'safe';
    case 'hollow':
      return 'collapse-next-turn';
    case 'pit':
      return 'fall';
    case 'rock':
      return 'blocked';
  }
}

export function tileAt(grid: Grid, p: Point): Tile {
  const t = grid.tiles[p.y * grid.width + p.x];
  if (!t) throw new RangeError(`tile out of bounds: ${p.x},${p.y}`);
  return t;
}

/** BFS over sound floor only. Returns the path from start to exit, or null. */
export function soundPath(grid: Grid): Point[] | null {
  const key = (p: Point): number => p.y * grid.width + p.x;
  const prev = new Map<number, number>();
  const queue: Point[] = [grid.start];
  prev.set(key(grid.start), -1);
  while (queue.length > 0) {
    const cur = queue.shift() as Point;
    if (cur.x === grid.exit.x && cur.y === grid.exit.y) {
      const path: Point[] = [];
      for (let k = key(cur); k !== -1; k = prev.get(k) as number) {
        path.unshift({ x: k % grid.width, y: Math.floor(k / grid.width) });
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: cur.x + dx, y: cur.y + dy };
      if (n.x < 0 || n.y < 0 || n.x >= grid.width || n.y >= grid.height) continue;
      if (prev.has(key(n)) || truthOf(tileAt(grid, n)) !== 'sound') continue;
      prev.set(key(n), key(cur));
      queue.push(n);
    }
  }
  return null;
}
