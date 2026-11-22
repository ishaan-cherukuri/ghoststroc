import { indexOf } from '../src/art/palette';
import { renderIndices } from '../src/art/render';
import { soundPath, truthOf } from '../src/sim/grid';
import { DEFAULT_LAMP_CONFIG, initialLamps } from '../src/sim/lamps';
import { LEVELS, parseLevel } from '../src/sim/levels';

const grids = LEVELS.map((l) => parseLevel(l.rows));

describe('floors', () => {
  it('there are three, ending in the lift', () => {
    expect(LEVELS).toHaveLength(3);
    expect(LEVELS.map((l) => l.exit)).toEqual(['stairs', 'stairs', 'lift']);
  });

  LEVELS.forEach((level, i) => {
    const grid = grids[i]!;
    describe(level.name, () => {
      it('is 20x12 with one entry and one exit', () => {
        expect(level.rows).toHaveLength(12);
        for (const row of level.rows) expect(row).toHaveLength(20);
        expect(level.rows.join('').split('S')).toHaveLength(2);
        expect(level.rows.join('').split('E')).toHaveLength(2);
      });
      it('has a sound-floor path from entry to exit (§7.6)', () => {
        expect(soundPath(grid)).not.toBeNull();
      });
      it('is bordered by rock', () => {
        for (let x = 0; x < 20; x++) for (const y of [0, 11]) expect(level.rows[y]![x]).toBe('#');
        for (let y = 0; y < 12; y++) for (const x of [0, 19]) expect(level.rows[y]![x]).toBe('#');
      });
      it('renders nothing but void with no lamp lit and no player — nothing remembered (§3.4)', () => {
        const px = renderIndices({ grid, lamps: initialLamps(), cfg: DEFAULT_LAMP_CONFIG, exitKind: level.exit, player: null, cracked: false });
        expect(new Set(px)).toEqual(new Set([indexOf('k')]));
      });
    });
  });

  it('difficulty rises: more hollow+pit ground and longer paths each floor', () => {
    const hazard = grids.map((g) => g.tiles.filter((t) => ['hollow', 'pit'].includes(truthOf(t))).length);
    const length = grids.map((g) => soundPath(g)!.length);
    expect(hazard[0]!).toBeLessThan(hazard[1]!);
    expect(hazard[1]!).toBeLessThan(hazard[2]!);
    expect(length[0]!).toBeLessThan(length[1]!);
    expect(length[1]!).toBeLessThan(length[2]!);
  });
});
