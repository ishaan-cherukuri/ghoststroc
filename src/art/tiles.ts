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

/** Prototype-only markers, always drawn in UI colour. Not walkability info. */
export const MARK_START = [
  '................',
  '................',
  '................',
  '....uuuuuuuu....',
  '...u........u...',
  '...u.uuuuuu.u...',
  '...u.u....u.u...',
  '...u.u....u.u...',
  '...u.u....u.u...',
  '...u.u....u.u...',
  '...u.uuuuuu.u...',
  '...u........u...',
  '....uuuuuuuu....',
  '................',
  '................',
  '................',
] as const;

export const MARK_EXIT = [
  '...uu......uu...',
  '...uu......uu...',
  '...uuuuuuuuuu...',
  '...uu......uu...',
  '...uu......uu...',
  '...uuuuuuuuuu...',
  '...uu......uu...',
  '...uu......uu...',
  '...uuuuuuuuuu...',
  '...uu......uu...',
  '...uu......uu...',
  '...uuuuuuuuuu...',
  '...uu......uu...',
  '...uu......uu...',
  '...uuuuuuuuuu...',
  '...uu......uu...',
] as const;

export const ALL_SPRITES: Readonly<Record<string, readonly string[]>> = {
  LAYER_MATTER, LAYER_SUPPORT, MARK_START, MARK_EXIT,
};
