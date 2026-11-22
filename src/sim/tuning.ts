// Every tunable number lives here. EYE-TUNED values are starting points that
// are expected to change after playtest — never retune silently (CLAUDE.md §5).

/** World units per maze cell. */
export const CELL = 2;
export const DEPTHS = 3;

export const MINE = {
  /** Maze half-size per depth; grid is (2n+1)². */
  MAZE_N: [10, 13, 16],
  SEEDS: [1101, 2202, 3303],
  /** Fraction of floor count turned into extra loop openings. EYE-TUNED. */
  LOOP_FRACTION: [0.08, 0.06, 0.05],
  /** Fraction of floor cells that are hollow. EYE-TUNED. */
  HOLLOW_FRACTION: [0.05, 0.08, 0.11],
  /** Chance a floor-facing wall cell carries ore. EYE-TUNED. */
  ORE_DENSITY: [0.1, 0.11, 0.12],
  ORE_WEIGHTS: [
    { copper: 0.85, iron: 0.15, gold: 0 },
    { copper: 0.4, iron: 0.45, gold: 0.15 },
    { copper: 0.2, iron: 0.4, gold: 0.4 },
  ],
  CHECKPOINTS_MIN: 4,
  CHECKPOINTS_MAX: 5,
} as const;

export const LAMP = {
  /** Rings radiate this long before the lamp lights. Human-specified. */
  CHARGE_S: 2,
  /** Lamp stays lit this long. Human-specified. */
  ACTIVE_S: 12,
  FADE_IN_S: 0.3, // EYE-TUNED
  FADE_OUT_S: 2, // EYE-TUNED
  /** Battery cost per flash. EYE-TUNED. */
  COST: 8,
} as const;

export const BATTERY = {
  /** Battery units per second at depth 1. EYE-TUNED. */
  BASE_DRAIN_PER_S: 0.5,
  DEPTH_MULT: [1, 1.35, 1.75], // EYE-TUNED
  LOW_FRACTION: 0.2,
  /** Seconds of total darkness before you faint. EYE-TUNED. */
  FAINT_AFTER_DARK_S: 6,
} as const;

export const HAZARD = {
  /** Seconds a hollow floor holds you. EYE-TUNED. */
  HOLLOW_GRACE_S: 0.8,
  FALL_BATTERY_COST: 25, // EYE-TUNED
} as const;

export const TREMOR = {
  MIN_S: 70, // EYE-TUNED
  MAX_S: 110, // EYE-TUNED
  WARN_S: 3,
  COLLAPSE: [3, 5, 7], // cells per tremor by depth. EYE-TUNED
  OPEN: 2,
  /** Never collapse within this many cells (Chebyshev) of the player. */
  SAFE_RADIUS: 2,
} as const;

export const PLAYER = { RADIUS: 0.35 } as const;

export const MINING = {
  TIME_S: { copper: 1.2, iron: 1.8, gold: 2.5 }, // EYE-TUNED
  REACH: 1.9,
} as const;
