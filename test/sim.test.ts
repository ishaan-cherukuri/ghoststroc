import { createHash } from 'node:crypto';
import { endTrip, gearStats, sell, smelt, upgrade, type Meta } from '../src/sim/economy';
import { LAMP_OFF, lampIntensity, pressLamp, tickLamp, type LampState } from '../src/sim/lamp';
import { bfs, generateMine, isSolid, type MineMap } from '../src/sim/maze';
import { cellCenter, cellOf, moveCircle } from '../src/sim/movement';
import { makeRng } from '../src/sim/rng';
import { chartedList, mineTarget, NO_INPUT, orePosition, startRun, stepRun, type RunInput, type RunState } from '../src/sim/run';
import { migrate, newMeta, parseSave, serialize } from '../src/sim/save';
import { doorNear, moveInTown, TOWN } from '../src/sim/town';
import { applyTremor } from '../src/sim/tremor';
import { BATTERY, CELL, HAZARD, LAMP, TREMOR } from '../src/sim/tuning';

const DT = 1 / 60;
const stats = gearStats(newMeta().gear);
const tick = (r: RunState, input: RunInput = NO_INPUT, n = 1): void => {
  for (let i = 0; i < n; i++) stepRun(r, input, DT);
};
const secs = (s: number): number => Math.round(s / DT);
const solidReach = (m: MineMap): Map<number, number> => bfs(m, m.lift, (i) => isSolid(m, i));

describe('maze generation', () => {
  const maps = [0, 1, 2].map((d) => generateMine(d));

  it('is deterministic', () => {
    expect(JSON.stringify({ ...generateMine(1), hollow: [...generateMine(1).hollow] }))
      .toBe(JSON.stringify({ ...maps[1]!, hollow: [...maps[1]!.hollow] }));
  });

  maps.forEach((m, d) => {
    describe(`depth ${d + 1}`, () => {
      it('every solid floor cell is reachable from the lift without crossing hollow', () => {
        const solid = m.cells.filter((_, i) => isSolid(m, i)).length;
        expect(solidReach(m).size).toBe(solid);
      });
      it('has 4–5 distinct solid checkpoints', () => {
        expect(m.checkpoints.length).toBeGreaterThanOrEqual(4);
        expect(m.checkpoints.length).toBeLessThanOrEqual(5);
        expect(new Set(m.checkpoints).size).toBe(m.checkpoints.length);
        for (const c of m.checkpoints) expect(isSolid(m, c)).toBe(true);
      });
      it('has hollow floors and ore', () => {
        expect(m.hollow.size).toBeGreaterThan(0);
        expect(m.ores.length).toBeGreaterThan(10);
      });
      it('ore sits in wall facing floor', () => {
        for (const o of m.ores) {
          expect(m.cells[o.wall]).toBe('wall');
          expect(m.cells[o.floor]).toBe('floor');
        }
      });
    });
  });

  it('gets bigger and more hollow with depth; ladder on all but the deepest', () => {
    expect(maps[0]!.w).toBeLessThan(maps[1]!.w);
    expect(maps[1]!.w).toBeLessThan(maps[2]!.w);
    const ratio = (m: MineMap): number => m.hollow.size / m.cells.filter((c) => c === 'floor').length;
    expect(ratio(maps[0]!)).toBeLessThan(ratio(maps[2]!));
    expect(maps[0]!.ladder).not.toBeNull();
    expect(maps[1]!.ladder).not.toBeNull();
    expect(maps[2]!.ladder).toBeNull();
  });

  it('no gold at depth 1, gold at depth 2+', () => {
    expect(maps[0]!.ores.some((o) => o.kind === 'gold')).toBe(false);
    expect(maps[1]!.ores.some((o) => o.kind === 'gold')).toBe(true);
    expect(maps[2]!.ores.some((o) => o.kind === 'gold')).toBe(true);
  });
});

describe('lamp timing (human-specified: 2 s rings, then 12 s lit)', () => {
  const run = (l: LampState, s: number): LampState => {
    let x = l;
    for (let i = 0; i < secs(s); i++) x = tickLamp(x, DT);
    return x;
  };
  it('charges for 2 s with no reveal, then is active', () => {
    const l = pressLamp(LAMP_OFF, 'red');
    expect(run(l, 1.9).phase).toBe('charging');
    expect(lampIntensity(run(l, 1.9))).toBe(0);
    expect(run(l, 2.05).phase).toBe('active');
  });
  it('is fully lit mid-way and off after 12 s active', () => {
    const l = pressLamp(LAMP_OFF, 'cyan');
    expect(lampIntensity(run(l, 2 + 5))).toBe(1);
    expect(run(l, 2 + 11.9).phase).toBe('active');
    expect(run(l, 2 + 12.05).phase).toBe('off');
  });
  it('only one lamp at a time: pressing the other switches', () => {
    const red = run(pressLamp(LAMP_OFF, 'red'), 4);
    const sw = pressLamp(red, 'cyan');
    expect(sw.color).toBe('cyan');
    expect(sw.phase).toBe('charging');
  });
  it('pressing the lamp that is already charging does nothing', () => {
    const l = pressLamp(LAMP_OFF, 'red');
    expect(pressLamp(l, 'red')).toBe(l);
  });
});

describe('movement', () => {
  const m = generateMine(0);
  it('cannot walk into walls', () => {
    const start = cellCenter(m, m.lift);
    let p = start;
    for (let i = 0; i < 100; i++) p = moveCircle(m, p, -0.1, 0, 0.35); // west of (1,1) is border
    expect(p.x).toBeGreaterThanOrEqual(CELL + 0.35 - 1e-9);
  });
});

describe('run', () => {
  it('battery drains over time', () => {
    const r = startRun(0, stats);
    tick(r, NO_INPUT, secs(10));
    expect(r.battery).toBeCloseTo(stats.batteryMax - 10 * BATTERY.BASE_DRAIN_PER_S, 0);
  });

  it('a lamp flash costs battery', () => {
    const r = startRun(0, stats);
    stepRun(r, { ...NO_INPUT, lamp: 'red' }, DT);
    expect(r.events).toContain('lamp-charge');
    expect(stats.batteryMax - r.battery).toBeGreaterThanOrEqual(LAMP.COST);
  });

  it('standing on hollow floor drops you a level after the grace time', () => {
    const r = startRun(0, stats);
    const h = [...r.map.hollow][0]!;
    r.pos = cellCenter(r.map, h);
    tick(r, NO_INPUT, secs(HAZARD.HOLLOW_GRACE_S * 0.5));
    expect(r.outcome).toBeNull();
    tick(r, NO_INPUT, secs(HAZARD.HOLLOW_GRACE_S * 0.6));
    expect(r.outcome).toBe('fell');
  });

  it('falling on the deepest level makes you faint', () => {
    const r = startRun(2, stats);
    r.pos = cellCenter(r.map, [...r.map.hollow][0]!);
    tick(r, NO_INPUT, secs(1));
    expect(r.outcome).toBe('fainted');
  });

  it('battery at zero: darkness, then faint', () => {
    const r = startRun(0, stats);
    r.battery = 0.001;
    tick(r, NO_INPUT, secs(BATTERY.FAINT_AFTER_DARK_S - 0.5));
    expect(r.outcome).toBeNull();
    tick(r, NO_INPUT, secs(1));
    expect(r.outcome).toBe('fainted');
  });

  it('your path is charted only when you reach a checkpoint', () => {
    const r = startRun(0, stats);
    r.charted.clear();
    const cp = r.map.checkpoints[0]!;
    const path = [...bfs(r.map, r.map.lift, (i) => r.map.cells[i] === 'floor').keys()].slice(1, 6);
    for (const c of path) { r.pos = cellCenter(r.map, c); tick(r); }
    expect(r.charted.size).toBe(0);
    r.pos = cellCenter(r.map, cp);
    tick(r);
    expect(r.events).toContain('checkpoint');
    for (const c of path) expect(r.charted.has(c)).toBe(true);
  });

  it('mining ore in front of you fills the bag; a full bag refuses', () => {
    const r = startRun(1, stats);
    const ore = r.map.ores.find((o) => o.kind === 'gold' && isSolid(r.map, o.floor))!;
    r.pos = cellCenter(r.map, ore.floor);
    const op = orePosition(r.map, ore);
    r.facing = Math.atan2(op.x - r.pos.x, op.z - r.pos.z);
    expect(mineTarget(r)?.id).toBe(ore.id);
    tick(r, { ...NO_INPUT, mine: true }, secs(2.6));
    expect(r.carried.gold).toBe(1);
    expect(r.map.ores.some((o) => o.id === ore.id)).toBe(false);

    const full = startRun(0, stats, { carried: { copper: stats.bagMax, iron: 0, gold: 0 } });
    const o2 = full.map.ores.find((o) => isSolid(full.map, o.floor))!;
    full.pos = cellCenter(full.map, o2.floor);
    const p2 = orePosition(full.map, o2);
    full.facing = Math.atan2(p2.x - full.pos.x, p2.z - full.pos.z);
    const seen: string[] = [];
    for (let i = 0; i < secs(2); i++) { tick(full, { ...NO_INPUT, mine: true }); seen.push(...full.events); }
    expect(seen).toContain('bag-full');
    expect(full.carried.copper).toBe(stats.bagMax);
  });

  it('using the lift surfaces; using the ladder goes down', () => {
    const r = startRun(0, stats);
    stepRun(r, { ...NO_INPUT, use: true }, DT);
    expect(r.outcome).toBe('surfaced');
    const l = startRun(0, stats);
    l.pos = cellCenter(l.map, l.map.ladder!);
    stepRun(l, { ...NO_INPUT, use: true }, DT);
    expect(l.outcome).toBe('ladder');
  });

  it('a tremor arrives with a warning first', () => {
    const r = startRun(0, stats);
    r.battery = 1e9;
    const seen: string[] = [];
    for (let i = 0; i < secs(TREMOR.MAX_S + 1) && !seen.includes('tremor'); i++) { tick(r); seen.push(...r.events); }
    expect(seen.indexOf('tremor-warn')).toBeGreaterThanOrEqual(0);
    expect(seen.indexOf('tremor-warn')).toBeLessThan(seen.indexOf('tremor'));
    expect(r.mapVersion).toBe(1);
  });
});

describe('tremors never trap you', () => {
  for (const depth of [0, 1, 2]) {
    it(`depth ${depth + 1}: 30 tremors keep lift, checkpoints, ladder and player connected`, () => {
      const m = generateMine(depth);
      const rng = makeRng(42 + depth);
      for (let k = 0; k < 30; k++) {
        const solid = [...solidReach(m).keys()]; // a real player is always somewhere connected
        const player = solid[rng.int(solid.length)]!;
        applyTremor(m, rng, player);
        const reach = bfs(m, m.lift, (i) => m.cells[i] === 'floor' && (!m.hollow.has(i) || i === player));
        for (const c of [...m.checkpoints, player, ...(m.ladder === null ? [] : [m.ladder])]) expect(reach.has(c)).toBe(true);
      }
    });
  }
});

describe('determinism', () => {
  it('same inputs → identical run state', () => {
    const script = (): string => {
      const r = startRun(1, stats, { tripSeed: 3 });
      r.battery = 1e9;
      for (let i = 0; i < secs(120); i++) {
        const t = i * DT;
        stepRun(r, {
          moveX: Math.sin(t * 0.7), moveZ: Math.cos(t * 0.3), mine: i % 90 > 60,
          use: false, lamp: i % 900 === 10 ? 'cyan' : i % 900 === 450 ? 'red' : null,
        }, DT);
      }
      return createHash('sha256').update(JSON.stringify({
        pos: r.pos, battery: r.battery, carried: r.carried, lamp: r.lamp, cells: r.map.cells,
        charted: chartedList(r), time: r.time, mapVersion: r.mapVersion,
      })).digest('hex');
    };
    expect(script()).toBe(script());
  });
});

describe('economy', () => {
  const rich: Meta = { ...newMeta(), money: 1000, stash: { copper: 5, iron: 5, steel: 0, gold: 2 } };
  it('sells', () => {
    const r = sell(rich, 'gold', 99);
    expect(r.ok && r.meta.money).toBe(1080);
    expect(r.ok && r.meta.stash.gold).toBe(0);
  });
  it('smelts 2 iron into 1 steel for a fee', () => {
    const r = smelt(rich);
    expect(r.ok && r.meta.stash).toMatchObject({ iron: 3, steel: 1 });
    expect(smelt({ ...rich, stash: { ...rich.stash, iron: 1 } }).ok).toBe(false);
  });
  it('upgrades need money and steel', () => {
    expect(upgrade(rich, 'battery').ok).toBe(true);
    expect(upgrade({ ...rich, gear: { ...rich.gear, battery: 1 } }, 'battery').ok).toBe(false); // needs steel
    expect(upgrade(newMeta(), 'bag').ok).toBe(false); // needs money
  });
  it('surfacing banks the haul; fainting loses it', () => {
    const carried = { copper: 3, iron: 1, gold: 1 };
    expect(endTrip(newMeta(), 'surfaced', carried, [[], [], []]).stash).toMatchObject({ copper: 3, iron: 1, gold: 1 });
    expect(endTrip(newMeta(), 'fainted', carried, [[], [], []]).stash).toMatchObject({ copper: 0, iron: 0, gold: 0 });
  });
});

describe('save', () => {
  it('round-trips', () => {
    const m: Meta = { ...newMeta(), money: 77, charted: [[1, 2, 3], [], [9]] };
    expect(parseSave(serialize(m))).toEqual(m);
  });
  it('migrates an older, partial save without losing money or charted map', () => {
    const old = { money: 120, stash: { copper: 4 }, charted: [[5, 6]] };
    const m = migrate(old);
    expect(m.money).toBe(120);
    expect(m.stash.copper).toBe(4);
    expect(m.stash.steel).toBe(0);
    expect(m.charted[0]).toEqual([5, 6]);
    expect(m.gear.boots).toBe(0);
  });
  it('garbage becomes a fresh save', () => {
    expect(parseSave('{not json')).toEqual(newMeta());
    expect(parseSave(null)).toEqual(newMeta());
  });
});

describe('town', () => {
  it('buildings block you; doors are reachable', () => {
    const p = moveInTown(TOWN.SPAWN, 0, -30, 0.35);
    expect(p.z).toBeGreaterThan(-8);
    for (const b of TOWN.BUILDINGS) expect(doorNear(b.door)?.id).toBe(b.id);
  });
  it('the spawn point is clear', () => {
    expect(moveInTown(TOWN.SPAWN, 0.01, 0, 0.35).x).toBeCloseTo(0.01);
  });
});

describe('sanity', () => {
  it('cellOf/cellCenter agree', () => {
    const m = generateMine(0);
    expect(cellOf(m, cellCenter(m, 47))).toBe(47);
  });
});
