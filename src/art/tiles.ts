// Hand-authored sprites (CLAUDE.md §5.1). 16 rows x 16 chars, chars from CHAR_MAP.
// Terrain is authored as two channel layers. A tile renders its matter layer
// when red is lit and its support layer when cyan is lit; pixels present in
// both render on the overlap ramp. The layers have different glyphs (bricks vs
// cross-brace) so each truth state is distinct in greyscale (§10.1).

/** Red channel: floor surface. Authored at bright; render picks the ramp step. */
export const LAYER_MATTER = [
  '.XXXXX..XXXXXX..',
  '.XXXXX..XXXXXX..',
  '.XXXXX..XXXXXX..',
  '.XXXXX..XXXXXX..',
  '................',
  'XXX..XXXXXX..XXX',
  'XXX..XXXXXX..XXX',
  'XXX..XXXXXX..XXX',
  'XXX..XXXXXX..XXX',
  '................',
  '.XXXXX..XXXXXX..',
  '.XXXXX..XXXXXX..',
  '.XXXXX..XXXXXX..',
  '.XXXXX..XXXXXX..',
  '................',
  '................',
] as const;

/** Cyan channel: load-bearing brace. Authored at bright; render picks the ramp step. */
export const LAYER_SUPPORT = [
  'YY............YY',
  'YYY..........YYY',
  '.YYY........YYY.',
  '..YYY......YYY..',
  '...YYY....YYY...',
  '....YYY..YYY....',
  '.....YYYYYY.....',
  '......YYYY......',
  '......YYYY......',
  '.....YYYYYY.....',
  '....YYY..YYY....',
  '...YYY....YYY...',
  '..YYY......YYY..',
  '.YYY........YYY.',
  'YYY..........YYY',
  'YY............YY',
] as const;

/** Stairs down: replaces the exit tile's matter layer, so it shows under red (§3.2). */
export const LAYER_STAIRS = [
  'XXX..........XXX',
  'XXX..........XXX',
  'XXXXXXXXXXXXXXXX',
  'XXX..........XXX',
  'XXX..........XXX',
  'XXX..........XXX',
  'XXXXXXXXXXXXXXXX',
  'XXX..........XXX',
  'XXX..........XXX',
  'XXX..........XXX',
  'XXXXXXXXXXXXXXXX',
  'XXX..........XXX',
  'XXX..........XXX',
  'XXX..........XXX',
  'XXXXXXXXXXXXXXXX',
  'XXX..........XXX',
] as const;

/** Extraction lift: a cage with a cable. Replaces the exit's matter layer. */
export const LAYER_LIFT = [
  '.......XX.......',
  '.......XX.......',
  'XXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXX',
  'XX..XX..XX..XX.X',
  'XX..XX..XX..XX.X',
  'XX..XX..XX..XX.X',
  'XX..XX..XX..XX.X',
  'XX..XX..XX..XX.X',
  'XX..XX..XX..XX.X',
  'XX..XX..XX..XX.X',
  'XX..XX..XX..XX.X',
  'XXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXX',
  '................',
  '................',
] as const;

/** Hazard-accent crack drawn on a hollow the player stands on (§7.3). */
export const OVERLAY_CRACK = [
  'hh............hh',
  '.h............h.',
  '.hh..........hh.',
  '..h..........h..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..h..........h..',
  '.hh..........hh.',
  '.h............h.',
  'hh............hh',
] as const;

/** Player: always overlap-white in both channels, read by its dark outline (§5.2). */
export const PLAYER = [
  '................',
  '.....kkkkkk.....',
  '....kWWWWWWk....',
  '...kWWWWWWWWk...',
  '...kkkkkkkkkk...',
  '....kWkWWkWk....',
  '....kWWWWWWk....',
  '.....kkWWkk.....',
  '....kWWWWWWk....',
  '...kWWWWWWWWk...',
  '..kWWkWWWWkWWk..',
  '..kWkkWWWWkkWk..',
  '..kk.kWWWWk.kk..',
  '....kWWkkWWk....',
  '....kWWkkWWk....',
  '....kkkk.kkkk...',
] as const;

export const ALL_SPRITES: Readonly<Record<string, readonly string[]>> = {
  LAYER_MATTER, LAYER_SUPPORT, LAYER_STAIRS, LAYER_LIFT, OVERLAY_CRACK, PLAYER,
};
