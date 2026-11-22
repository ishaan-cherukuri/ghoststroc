import { stepResult, truthOf } from '../src/sim/grid';

describe('truth table (§9.3)', () => {
  it.each([
    [true, true, 'sound', 'safe'],
    [true, false, 'hollow', 'collapse-next-turn'],
    [false, true, 'pit', 'fall'],
    [false, false, 'rock', 'blocked'],
  ] as const)('matter=%s support=%s -> %s / %s', (matter, support, truth, result) => {
    expect(truthOf({ matter, support })).toBe(truth);
    expect(stepResult({ matter, support })).toBe(result);
  });
});
