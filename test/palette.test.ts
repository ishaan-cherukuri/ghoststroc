import { CHAR_MAP, PALETTE } from '../src/art/palette';
import { RAMPS } from '../src/art/render';

describe('palette integrity (§9.2)', () => {
  it('has exactly 16 entries', () => expect(PALETTE).toHaveLength(16));
  it('index 0 is transparent, the rest are valid hex', () => {
    expect(PALETTE[0]).toBe('');
    for (const hex of PALETTE.slice(1)) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('visible entries are all distinct', () => {
    expect(new Set(PALETTE.slice(1)).size).toBe(15);
  });
  it('CHAR_MAP indices are contiguous 0..15', () => {
    expect(Object.values(CHAR_MAP).sort((a, b) => a - b)).toEqual([...Array(16).keys()]);
  });
  it('every ramp entry is in CHAR_MAP', () => {
    for (const ramp of Object.values(RAMPS)) for (const ch of ramp) expect(CHAR_MAP).toHaveProperty(ch);
  });
});
