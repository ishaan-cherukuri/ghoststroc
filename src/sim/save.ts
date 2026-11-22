import { DEPTHS } from './tuning';
import { GEAR, GEAR_SLOTS, MATERIALS, type GearSlot, type Material, type Meta } from './economy';

export const SAVE_KEY = 'ghoststroc.save';
/** Bump on any shape change and extend migrate(). */
export const SAVE_VERSION = 1;

export function newMeta(): Meta {
  return {
    version: SAVE_VERSION,
    money: 0,
    stash: { copper: 0, iron: 0, steel: 0, gold: 0 },
    gear: { battery: 0, pick: 0, bag: 0, lens: 0, boots: 0 },
    unlockedDepth: 1,
    charted: Array.from({ length: DEPTHS }, () => []),
    trips: 0,
  };
}

export function serialize(meta: Meta): string {
  return JSON.stringify(meta);
}

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback);
const rec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {});

/**
 * Field-by-field migration: anything missing or malformed falls back to its
 * default, everything valid is kept. Old saves (no version, fewer fields)
 * never lose money, stash or charted map.
 */
export function migrate(raw: unknown): Meta {
  const base = newMeta();
  const o = rec(raw);
  const stashIn = rec(o.stash);
  const gearIn = rec(o.gear);
  const stash = Object.fromEntries(MATERIALS.map((m) => [m, Math.floor(num(stashIn[m], 0))])) as Record<Material, number>;
  const gear = Object.fromEntries(GEAR_SLOTS.map((s: GearSlot) =>
    [s, Math.min(GEAR[s].tiers.length - 1, Math.floor(num(gearIn[s], 0)))])) as Record<GearSlot, number>;
  const chartedIn: unknown[] = Array.isArray(o.charted) ? (o.charted as unknown[]) : [];
  const charted = base.charted.map((_, d) => {
    const list = chartedIn[d];
    return Array.isArray(list) ? list.filter((i): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0) : [];
  });
  return {
    version: SAVE_VERSION,
    money: Math.floor(num(o.money, 0)),
    stash,
    gear,
    unlockedDepth: Math.max(1, Math.min(DEPTHS, Math.floor(num(o.unlockedDepth, 1)))),
    charted,
    trips: Math.floor(num(o.trips, 0)),
  };
}

export function parseSave(raw: string | null): Meta {
  if (raw === null) return newMeta();
  try {
    return migrate(JSON.parse(raw) as unknown);
  } catch {
    return newMeta();
  }
}
