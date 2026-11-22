import { indexOf } from '../src/art/palette';
import { renderIndices } from '../src/art/render';
import { soundPath } from '../src/sim/grid';
import { DEFAULT_LAMP_CONFIG } from '../src/sim/lamps';
import { parseRoom, PROTOTYPE_ROOM } from '../src/sim/prototypeRoom';
import { initialState } from '../src/sim/turn';

describe('stage-1 room', () => {
  const grid = parseRoom(PROTOTYPE_ROOM);
  it('is 20x12', () => {
    expect(grid.width).toBe(20);
    expect(grid.height).toBe(12);
    for (const row of PROTOTYPE_ROOM) expect(row).toHaveLength(20);
  });
  it('has a sound-floor path from start to exit', () => {
    expect(soundPath(grid)).not.toBeNull();
  });
  it('renders all-void (except markers) with no channel lit — nothing remembered', () => {
    const px = renderIndices({ grid, lamps: initialState().lamps, cfg: DEFAULT_LAMP_CONFIG });
    const used = new Set(px);
    expect([...used].sort()).toEqual([indexOf('k'), indexOf('u')].sort());
  });
});
