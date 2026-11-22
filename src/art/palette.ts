// Single source of truth for colour (CLAUDE.md §5.2). 16 entries, never more.
// Index 0 is transparent and has no hex.
export const PALETTE: readonly string[] = [
  '', // 0  .  transparent
  '#0b0a10', // 1  k  unlit / void black
  '#1a1726', // 2  d  dark rock, barely-there structure
  '#4a1526', // 3  r  red ramp — faded
  '#a8243c', // 4  R  red ramp — mid
  '#f2556b', // 5  X  red ramp — bright
  '#0f3a42', // 6  c  cyan ramp — faded
  '#1d8c99', // 7  C  cyan ramp — mid
  '#5fe3e8', // 8  Y  cyan ramp — bright
  '#8a95a8', // 9  w  overlap — faded
  '#f4f6fb', // 10 W  overlap — bright (safe floor)
  '#7a5a22', // 11 o  ore — faded
  '#e8b04b', // 12 O  ore — bright
  '#ff8a3c', // 13 h  hazard accent
  '#cfd6e4', // 14 u  UI text / player
  '#5a6376', // 15 U  UI dim / disabled
];

export const CHAR_MAP: Readonly<Record<string, number>> = {
  '.': 0, k: 1, d: 2, r: 3, R: 4, X: 5, c: 6, C: 7, Y: 8,
  w: 9, W: 10, o: 11, O: 12, h: 13, u: 14, U: 15,
};

export const ROLE_NAMES: readonly string[] = [
  'transparent', 'void', 'dark rock', 'red faded', 'red mid', 'red bright',
  'cyan faded', 'cyan mid', 'cyan bright', 'overlap faded', 'overlap bright',
  'ore faded', 'ore bright', 'hazard', 'UI', 'UI dim',
];

export function indexOf(ch: string): number {
  const i = CHAR_MAP[ch];
  if (i === undefined) throw new Error(`char not in CHAR_MAP: ${ch}`);
  return i;
}
