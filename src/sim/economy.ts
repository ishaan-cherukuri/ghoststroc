import type { OreKind } from './maze';

export type Material = OreKind | 'steel';
export const MATERIALS: readonly Material[] = ['copper', 'iron', 'steel', 'gold'];

/** Price per unit at the Assay Office. EYE-TUNED. */
export const PRICES: Readonly<Record<Material, number>> = { copper: 6, iron: 9, steel: 28, gold: 40 };

/** Smelter recipe. EYE-TUNED. */
export const SMELT = { IRON_PER_STEEL: 2, FEE: 5 } as const;

export type GearSlot = 'battery' | 'pick' | 'bag' | 'lens' | 'boots';
export const GEAR_SLOTS: readonly GearSlot[] = ['battery', 'pick', 'bag', 'lens', 'boots'];

export interface GearTier {
  readonly value: number;
  readonly cost: number;
  readonly steel: number;
}

/** Gear tiers; tier 0 is what you start with. EYE-TUNED. */
export const GEAR: Readonly<Record<GearSlot, { readonly name: string; readonly unit: string; readonly tiers: readonly GearTier[] }>> = {
  battery: { name: 'Battery pack', unit: 'charge', tiers: [
    { value: 100, cost: 0, steel: 0 }, { value: 150, cost: 40, steel: 0 },
    { value: 210, cost: 120, steel: 1 }, { value: 280, cost: 300, steel: 3 }] },
  pick: { name: 'Pickaxe', unit: '× speed', tiers: [
    { value: 1, cost: 0, steel: 0 }, { value: 1.4, cost: 50, steel: 1 },
    { value: 1.9, cost: 150, steel: 2 }, { value: 2.6, cost: 320, steel: 4 }] },
  bag: { name: 'Ore bag', unit: 'slots', tiers: [
    { value: 8, cost: 0, steel: 0 }, { value: 12, cost: 30, steel: 0 },
    { value: 16, cost: 90, steel: 1 }, { value: 22, cost: 200, steel: 2 }] },
  lens: { name: 'Lamp lens', unit: 'm radius', tiers: [
    { value: 10, cost: 0, steel: 0 }, { value: 13, cost: 60, steel: 1 }, { value: 17, cost: 160, steel: 2 }] },
  boots: { name: 'Boots', unit: 'm/s', tiers: [
    { value: 4.5, cost: 0, steel: 0 }, { value: 5.4, cost: 40, steel: 0 }, { value: 6.3, cost: 110, steel: 1 }] },
};

export interface GearStats {
  readonly batteryMax: number;
  readonly pickSpeed: number;
  readonly bagMax: number;
  readonly lampRadius: number;
  readonly speed: number;
}

export type Carried = Record<OreKind, number>;
export const EMPTY_CARRIED: Readonly<Carried> = { copper: 0, iron: 0, gold: 0 };

export interface Meta {
  readonly version: number;
  readonly money: number;
  readonly stash: Readonly<Record<Material, number>>;
  readonly gear: Readonly<Record<GearSlot, number>>;
  /** Number of depths reachable by lift (1..3). */
  readonly unlockedDepth: number;
  /** Charted cell indices per depth. */
  readonly charted: readonly (readonly number[])[];
  readonly trips: number;
}

export type Result = { readonly ok: true; readonly meta: Meta } | { readonly ok: false; readonly reason: string };

const tierValue = (slot: GearSlot, tier: number): number => {
  const tiers = GEAR[slot].tiers;
  return (tiers[Math.min(tier, tiers.length - 1)] as GearTier).value;
};

export function gearStats(gear: Meta['gear']): GearStats {
  return {
    batteryMax: tierValue('battery', gear.battery),
    pickSpeed: tierValue('pick', gear.pick),
    bagMax: tierValue('bag', gear.bag),
    lampRadius: tierValue('lens', gear.lens),
    speed: tierValue('boots', gear.boots),
  };
}

export function sell(meta: Meta, mat: Material, qty: number): Result {
  const have = meta.stash[mat];
  const n = Math.min(have, qty);
  if (n <= 0) return { ok: false, reason: `No ${mat} to sell.` };
  return { ok: true, meta: { ...meta, money: meta.money + n * PRICES[mat], stash: { ...meta.stash, [mat]: have - n } } };
}

export function smelt(meta: Meta): Result {
  if (meta.stash.iron < SMELT.IRON_PER_STEEL) return { ok: false, reason: `Need ${SMELT.IRON_PER_STEEL} iron.` };
  if (meta.money < SMELT.FEE) return { ok: false, reason: 'The smelter charges $' + SMELT.FEE + '.' };
  return { ok: true, meta: {
    ...meta, money: meta.money - SMELT.FEE,
    stash: { ...meta.stash, iron: meta.stash.iron - SMELT.IRON_PER_STEEL, steel: meta.stash.steel + 1 },
  } };
}

export function nextTier(meta: Meta, slot: GearSlot): GearTier | null {
  return GEAR[slot].tiers[meta.gear[slot] + 1] ?? null;
}

export function upgrade(meta: Meta, slot: GearSlot): Result {
  const t = nextTier(meta, slot);
  if (!t) return { ok: false, reason: 'Already the best.' };
  if (meta.money < t.cost) return { ok: false, reason: 'Need $' + t.cost + '.' };
  if (meta.stash.steel < t.steel) return { ok: false, reason: `Need ${t.steel} steel.` };
  return { ok: true, meta: {
    ...meta, money: meta.money - t.cost,
    stash: { ...meta.stash, steel: meta.stash.steel - t.steel },
    gear: { ...meta.gear, [slot]: meta.gear[slot] + 1 },
  } };
}

export type RunEnd = 'surfaced' | 'fainted';

/** Close a trip: surfacing banks the haul into the stash; fainting loses it. */
export function endTrip(meta: Meta, end: RunEnd, carried: Carried, charted: readonly (readonly number[])[]): Meta {
  const keep = end === 'surfaced';
  return {
    ...meta,
    trips: meta.trips + 1,
    charted,
    stash: keep
      ? { ...meta.stash, copper: meta.stash.copper + carried.copper, iron: meta.stash.iron + carried.iron, gold: meta.stash.gold + carried.gold }
      : meta.stash,
  };
}
