import type { Grid, Point, Tile } from './types';

// Hand-built floors, easiest first. 20x12 each.
// '.' sound  'h' hollow (red only)  'p' pit (cyan only)  '#' rock
// 'S' entry, 'E' exit (both sound). Difficulty rises by more hollow/pit
// ground, longer paths and dead-end sound spurs — never by starving lamps (§7.6).

export type ExitKind = 'stairs' | 'lift';

export interface LevelDef {
  readonly name: string;
  readonly exit: ExitKind;
  readonly rows: readonly string[];
}

export const LEVELS: readonly LevelDef[] = [
  {
    name: 'The Adit',
    exit: 'stairs',
    rows: [
      '####################',
      '####################',
      '##S.....hhh#########',
      '#######.#ppp########',
      '#######.....hh######',
      '####pp#####.########',
      '###########......###',
      '##########ppp##h.###',
      '################..E#',
      '####################',
      '####################',
      '####################',
    ],
  },
  {
    name: 'Hollow Gallery',
    exit: 'stairs',
    rows: [
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
    ],
  },
  {
    name: 'The Underseam',
    exit: 'lift',
    rows: [
      '####################',
      '#hhhhhpphhphhhppppE#',
      '#hp.......pphhhppp.#',
      '#ph.ph.hhphhhppphh.#',
      '#ph.ph.....hp...hp.#',
      '#hh.phphph.pp.phph.#',
      '###.....ph.hp....p.#',
      '#hpphpp.hh.hp.hh.h.#',
      '#....#h.hh.ph.h#.h.#',
      '#.p#.hp.hp....ph...#',
      '#Shh....pppphhhphhp#',
      '####################',
    ],
  },
];

export function parseLevel(rows: readonly string[]): Grid {
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
  if (!start || !exit) throw new Error('level needs S and E');
  return { width: rows[0]?.length ?? 0, height: rows.length, tiles, start, exit };
}
