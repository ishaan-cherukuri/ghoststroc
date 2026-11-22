import type { Channel } from './types';

// ---- Lamp constants -------------------------------------------------------
// EYE-TUNED starting values (CLAUDE.md §3.3). Expected to change after
// playtest. Never retune silently: name old value, new value, and reason.
export const LAMP_DEFAULTS = {
  /** Turns a flash stays at full brightness. Eye-tuned. */
  FULL_TURNS: 2,
  /** Turns of linear decay after full brightness, ending at zero. Eye-tuned. */
  DECAY_TURNS: 3,
} as const;
// ---------------------------------------------------------------------------

export interface LampConfig {
  readonly fullTurns: number;
  readonly decayTurns: number;
}

export const DEFAULT_LAMP_CONFIG: LampConfig = {
  fullTurns: LAMP_DEFAULTS.FULL_TURNS,
  decayTurns: LAMP_DEFAULTS.DECAY_TURNS,
};

/**
 * level = number of remaining legible turns (0 = dark).
 * level > decayTurns  -> full brightness
 * 1..decayTurns       -> decay step (decayTurns = first/brightest decay step)
 */
export interface ChannelLamp {
  readonly level: number;
  readonly flashedThisTurn: boolean;
}

export type LampState = Readonly<Record<Channel, ChannelLamp>>;

export const DARK: ChannelLamp = { level: 0, flashedThisTurn: false };

export function initialLamps(): LampState {
  return { red: DARK, cyan: DARK };
}

/** Flash lights (or refreshes) a channel to full. Never blocked (§7.2). */
export function flash(lamps: LampState, channel: Channel, cfg: LampConfig): LampState {
  return { ...lamps, [channel]: { level: cfg.fullTurns + cfg.decayTurns, flashedThisTurn: true } };
}

/**
 * Turn-loop step 2: decay both channels by one step. A channel flashed this
 * turn is not decayed, so a flash is seen at full for exactly fullTurns
 * player decisions, then decayTurns decaying ones, then dark.
 */
export function decay(lamps: LampState): LampState {
  const one = (c: ChannelLamp): ChannelLamp =>
    c.flashedThisTurn ? { level: c.level, flashedThisTurn: false } : { level: Math.max(0, c.level - 1), flashedThisTurn: false };
  return { red: one(lamps.red), cyan: one(lamps.cyan) };
}

/**
 * Ramp step for a level: 0 = brightest entry, rampLength-1 = dimmest
 * visible entry, null = dark. Pure index math; render.ts maps to palette.
 */
export function rampStep(level: number, cfg: LampConfig, rampLength: number): number | null {
  if (level <= 0) return null;
  if (level > cfg.decayTurns) return 0;
  const i = cfg.decayTurns - level; // 0 on first decay turn
  return 1 + Math.floor((i * (rampLength - 1)) / cfg.decayTurns);
}
