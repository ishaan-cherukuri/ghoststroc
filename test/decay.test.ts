import { DEFAULT_LAMP_CONFIG, LAMP_DEFAULTS, rampStep } from '../src/sim/lamps';
import { newGame, step } from '../src/sim/game';
import { RAMPS } from '../src/art/render';

const cfg = DEFAULT_LAMP_CONFIG;

function levelsAfterFlash(turns: number, c = cfg): number[] {
  let s = step(newGame(), { type: 'flash', channel: 'red' }, c);
  const out = [s.lamps.red.level];
  for (let i = 1; i < turns; i++) {
    s = step(s, { type: 'wait' }, c);
    out.push(s.lamps.red.level);
  }
  return out;
}

describe('decay (§9.6)', () => {
  it('defaults are 2 full + 3 decay', () => {
    expect(LAMP_DEFAULTS.FULL_TURNS).toBe(2);
    expect(LAMP_DEFAULTS.DECAY_TURNS).toBe(3);
  });

  it('a flash is full for exactly FULL_TURNS decisions, decays over DECAY_TURNS, then exactly zero', () => {
    const steps = levelsAfterFlash(8).map((l) => rampStep(l, cfg, RAMPS.red.length));
    expect(steps).toEqual([0, 0, 1, 2, 3, null, null, null]);
  });

  it('is legible for exactly FULL+DECAY turns for other configs', () => {
    for (const c of [{ fullTurns: 1, decayTurns: 1 }, { fullTurns: 3, decayTurns: 5 }, { fullTurns: 0, decayTurns: 2 }]) {
      const levels = levelsAfterFlash(12, c);
      expect(levels.filter((l) => l > 0)).toHaveLength(c.fullTurns + c.decayTurns);
      expect(levels[c.fullTurns + c.decayTurns]).toBe(0);
    }
  });

  it('decay ramp steps are monotonic and end on the dimmest entry', () => {
    const c = { fullTurns: 2, decayTurns: 5 };
    const s = [5, 4, 3, 2, 1].map((l) => rampStep(l, c, 4) as number);
    expect(s).toEqual([...s].sort((a, b) => a - b));
    expect(s.at(-1)).toBe(3);
    expect(s[0]).toBeGreaterThanOrEqual(1);
  });

  it('flashing one channel decays the other, and re-flashing refreshes to full', () => {
    let s = step(newGame(), { type: 'flash', channel: 'red' }, cfg);
    s = step(s, { type: 'flash', channel: 'cyan' }, cfg);
    expect(s.lamps.red.level).toBe(4);
    expect(s.lamps.cyan.level).toBe(5);
    s = step(s, { type: 'flash', channel: 'red' }, cfg);
    expect(s.lamps.red.level).toBe(5);
    expect(s.flashes).toEqual({ red: 2, cyan: 1 });
  });
});
