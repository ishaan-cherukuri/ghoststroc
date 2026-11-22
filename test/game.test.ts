import { createHash } from 'node:crypto';
import { soundPath } from '../src/sim/grid';
import { GAME, gridFor, newGame, step, type Action, type Dir, type GameState } from '../src/sim/game';
import { DEFAULT_LAMP_CONFIG as cfg } from '../src/sim/lamps';
import type { Point } from '../src/sim/types';

const at = (s: GameState, p: Point): GameState => ({ ...s, player: p });
const onLevel = (level: number, p: Point): GameState => ({ ...newGame(), level, player: p });
const move = (dir: Dir): Action => ({ type: 'move', dir });
const WAIT: Action = { type: 'wait' };
const run = (s: GameState, actions: readonly Action[]): GameState => actions.reduce((acc, a) => step(acc, a, cfg), s);

function dirTo(a: Point, b: Point): Dir {
  if (b.x > a.x) return 'right';
  if (b.x < a.x) return 'left';
  return b.y > a.y ? 'down' : 'up';
}
function walk(level: number): Action[] {
  const path = soundPath(gridFor(level))!;
  return path.slice(1).map((p, i) => move(dirTo(path[i]!, p)));
}

describe('movement', () => {
  it('moving into rock is rejected and costs no turn (§7.3)', () => {
    const s = newGame(); // Adit entry (2,2); (2,1) is rock
    const n = step(s, move('up'), cfg);
    expect(n.player).toEqual(s.player);
    expect(n.turn).toBe(0);
    expect(n.events).toEqual(['blocked']);
  });

  it('moving onto sound floor costs one turn', () => {
    const n = step(newGame(), move('right'), cfg);
    expect(n.player).toEqual({ x: 3, y: 2 });
    expect(n.turn).toBe(1);
  });

  it('stepping on a pit falls immediately to the next floor and costs HP', () => {
    // Adit (9,3) is a pit, reached from (9,2)? (9,2) is hollow — place player beside it.
    const s = at(newGame(), { x: 9, y: 2 });
    const n = step(s, move('down'), cfg);
    expect(n.events).toContain('fell');
    expect(n.level).toBe(1);
    expect(n.hp).toBe(GAME.MAX_HP - GAME.FALL_DAMAGE);
  });

  it('falling does not refill lamps; stairs do', () => {
    const spent = { ...at(newGame(), { x: 9, y: 2 }), charges: { red: 1, cyan: 0 } };
    expect(step(spent, move('down'), cfg).charges).toEqual({ red: 1, cyan: 0 });
    const nearStairs = { ...at(newGame(), { x: 17, y: 8 }), charges: { red: 0, cyan: 0 } };
    const down = step(nearStairs, move('right'), cfg);
    expect(down.events).toContain('descended');
    expect(down.charges).toEqual({ red: GAME.CHARGES_PER_FLOOR, cyan: GAME.CHARGES_PER_FLOOR });
    expect(down.player).toEqual(gridFor(1).start);
    expect(down.lamps.red.level).toBe(0);
  });

  it('lands on a sound tile after falling', () => {
    const n = step(at(newGame(), { x: 9, y: 2 }), move('down'), cfg);
    const t = gridFor(n.level).tiles[n.player.y * 20 + n.player.x]!;
    expect(t.matter && t.support).toBe(true);
  });

  it('falling with 1 HP kills', () => {
    const s = { ...at(newGame(), { x: 9, y: 2 }), hp: 1 };
    expect(step(s, move('down'), cfg).status).toBe('dead');
  });

  it('falling on the last floor kills — nothing is below', () => {
    const s = onLevel(2, { x: 3, y: 2 }); // Underseam (2,2) is a pit
    const n = step(s, move('left'), cfg);
    expect(n.status).toBe('dead');
    expect(n.events).toContain('fell-into-deep');
  });

  it('a dead or won game ignores input', () => {
    const dead = { ...newGame(), status: 'dead' as const };
    expect(step(dead, move('right'), cfg)).toBe(dead);
  });

  it('flashing an empty lamp is rejected and costs no turn', () => {
    const s = { ...newGame(), charges: { red: 0, cyan: 2 } };
    const n = step(s, { type: 'flash', channel: 'red' }, cfg);
    expect(n.turn).toBe(0);
    expect(n.events).toEqual(['no-charge']);
  });
});

describe('collapse timing (§9.9)', () => {
  // Adit: (7,2) sound, (8,2) hollow.
  const onEdge = at(newGame(), { x: 7, y: 2 });

  it('stepping on red-only cracks but holds this turn', () => {
    const n = step(onEdge, move('right'), cfg);
    expect(n.events).toEqual(['cracked']);
    expect(n.level).toBe(0);
    expect(n.armedHollow).toEqual({ x: 8, y: 2 });
  });

  it('staying one more turn collapses it', () => {
    const n = run(onEdge, [move('right'), WAIT]);
    expect(n.events).toContain('collapsed');
    expect(n.level).toBe(1);
  });

  it('flashing counts as staying', () => {
    const n = run(onEdge, [move('right'), { type: 'flash', channel: 'cyan' }]);
    expect(n.events).toContain('collapsed');
  });

  it('moving off within the one turn is safe', () => {
    const n = run(onEdge, [move('right'), move('left')]);
    expect(n.level).toBe(0);
    expect(n.armedHollow).toBeNull();
    expect(n.hp).toBe(GAME.MAX_HP);
  });

  it('hollow to hollow re-arms rather than collapsing', () => {
    const n = run(onEdge, [move('right'), move('right'), move('right')]);
    expect(n.level).toBe(0);
    expect(n.player).toEqual({ x: 10, y: 2 });
  });

  it('a blocked move does not use up the grace turn', () => {
    const n = run(onEdge, [move('right'), move('up'), move('left')]); // (8,1) is rock
    expect(n.level).toBe(0);
  });
});

describe('a full run', () => {
  it('walking each floor\'s sound path from entry wins', () => {
    let s = newGame();
    for (let level = 0; level < 3; level++) {
      expect(s.level).toBe(level);
      s = run(s, walk(level));
    }
    expect(s.status).toBe('won');
    expect(s.hp).toBe(GAME.MAX_HP);
  });
});

describe('determinism (§9.5)', () => {
  it('the same action sequence yields an identical final state', () => {
    const actions: Action[] = [
      { type: 'flash', channel: 'red' }, ...walk(0).slice(0, 7), move('right'), WAIT,
      { type: 'flash', channel: 'cyan' }, move('up'), move('left'), WAIT, move('down'),
    ];
    const hash = (): string => createHash('sha256').update(JSON.stringify(run(newGame(), actions))).digest('hex');
    expect(hash()).toBe(hash());
  });
});
