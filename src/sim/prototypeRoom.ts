import type { Grid, Point, Tile } from './types';

// Stage-1 static hand-built room (CLAUDE.md §8). 20x12.
// '.' sound  'h' hollow (red only)  'p' pit (cyan only)  '#' rock
// 'S' start, 'E' exit (both sound). Exactly one sound path S -> E; hollow and
// pit decoys are placed so each single channel suggests false routes.
export const PROTOTYPE_ROOM = [
  '####################',
  '#S..hhhh#pppp#######',
  '#pp.#pp.....hhh#pp##',
  '#h#.hh#.pp#.#phhp#h#',
  '#h#.....hhp.pp#hphh#',
  '#pph#ph##ph.h#pp#hp#',
  '##phh#pph...hp....h#',
  '#hh#pph#p.ph#h.ph.p#',
  '#p#hh#phh.#pph.#p.h#',
  '#pph#ph#h......hp.p#',
  '#hhpph#pphh#pphhp.E#',
  '####################',
] as const;

export function parseRoom(rows: readonly string[]): Grid {
  const tiles: Tile[] = [];
  let start: Point | null = null;
  let exit: Point | null = null;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === 'S') start = { x, y };
      if (ch === 'E') exit = { x, y };
      const sound = ch === '.' || ch === 'S' || ch === 'E';
      tiles.push({ matter: sound || ch === 'h', support: sound || ch === 'p' });
    });
  });
  if (!start || !exit) throw new Error('room needs S and E');
  return { width: rows[0]?.length ?? 0, height: rows.length, tiles, start, exit };
}
