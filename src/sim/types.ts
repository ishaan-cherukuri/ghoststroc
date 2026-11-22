export type Channel = 'red' | 'cyan';

/** The four truth-table states (CLAUDE.md §3.2). */
export type TileTruth = 'sound' | 'hollow' | 'pit' | 'rock';

/** What stepping onto a tile does (CLAUDE.md §3.2). */
export type StepResult = 'safe' | 'collapse-next-turn' | 'fall' | 'blocked';

export interface Tile {
  readonly matter: boolean; // red channel
  readonly support: boolean; // cyan channel
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly Tile[]; // row-major
  readonly start: Point;
  readonly exit: Point;
}
