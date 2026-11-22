import { LAMP } from './tuning';

export type LampColor = 'red' | 'cyan';

export interface LampState {
  readonly color: LampColor | null;
  readonly phase: 'off' | 'charging' | 'active';
  /** Seconds spent in the current phase. */
  readonly t: number;
}

export const LAMP_OFF: LampState = { color: null, phase: 'off', t: 0 };

/**
 * Pressing a lamp starts its charge (rings radiate). Only one lamp burns at a
 * time, so pressing the other colour switches. Pressing the colour that is
 * already charging does nothing. Returns the same object if nothing changed.
 */
export function pressLamp(l: LampState, color: LampColor): LampState {
  if (l.phase === 'charging' && l.color === color) return l;
  return { color, phase: 'charging', t: 0 };
}

export function tickLamp(l: LampState, dt: number): LampState {
  if (l.phase === 'off') return l;
  const t = l.t + dt;
  if (l.phase === 'charging' && t >= LAMP.CHARGE_S) return { color: l.color, phase: 'active', t: t - LAMP.CHARGE_S };
  if (l.phase === 'active' && t >= LAMP.ACTIVE_S) return LAMP_OFF;
  return { ...l, t };
}

/** 0..1 reveal strength. Zero while charging. */
export function lampIntensity(l: LampState): number {
  if (l.phase !== 'active') return 0;
  const fadeIn = Math.min(1, l.t / LAMP.FADE_IN_S);
  const fadeOut = Math.min(1, (LAMP.ACTIVE_S - l.t) / LAMP.FADE_OUT_S);
  return Math.max(0, Math.min(fadeIn, fadeOut));
}

/** 0..1 progress through the current phase, for UI. */
export function lampProgress(l: LampState): number {
  if (l.phase === 'charging') return l.t / LAMP.CHARGE_S;
  if (l.phase === 'active') return l.t / LAMP.ACTIVE_S;
  return 0;
}
