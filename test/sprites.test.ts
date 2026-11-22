import { CHAR_MAP } from '../src/art/palette';
import { ALL_SPRITES } from '../src/art/tiles';

describe('sprite integrity (§9.1)', () => {
  for (const [name, rows] of Object.entries(ALL_SPRITES)) {
    it(`${name} is 16x16 and uses only CHAR_MAP chars`, () => {
      expect(rows).toHaveLength(16);
      for (const row of rows) {
        expect(row).toHaveLength(16);
        for (const ch of row) expect(CHAR_MAP).toHaveProperty(ch);
      }
    });
  }
});
