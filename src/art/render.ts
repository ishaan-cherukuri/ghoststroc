import { rampStep, type LampConfig, type LampState } from '../sim/lamps';
import type { ExitKind } from '../sim/levels';
import type { Grid, Point } from '../sim/types';
import { indexOf } from './palette';
import { LAYER_LIFT, LAYER_MATTER, LAYER_STAIRS, LAYER_SUPPORT, OVERLAY_CRACK, PLAYER } from './tiles';

// ---- Render constants -----------------------------------------------------
export const LOGICAL_W = 320;
export const LOGICAL_H = 192;
export const TILE = 16;

// Ramps, brightest first; last entry is the "barely there" step before dark.
// EYE-TUNED starting values (§3.3, §5.3); expected to change after playtest.
export const RAMPS = {
  red: ['X', 'R', 'r', 'd'],
  cyan: ['Y', 'C', 'c', 'd'],
  overlap: ['W', 'w', 'w', 'd'],
} as const;
// ---------------------------------------------------------------------------

export interface View {
  readonly grid: Grid;
  readonly lamps: LampState;
  readonly cfg: LampConfig;
  readonly exitKind: ExitKind;
  readonly player: Point | null;
  readonly cracked: boolean;
}

function rampChar(ramp: readonly string[], level: number, cfg: LampConfig): string | null {
  const s = rampStep(level, cfg, ramp.length);
  return s === null ? null : (ramp[s] as string);
}

function stamp(out: Uint8Array, sprite: readonly string[], p: Point): void {
  for (let py = 0; py < TILE; py++) {
    for (let px = 0; px < TILE; px++) {
      const c = sprite[py]?.[px] ?? '.';
      if (c !== '.') out[(p.y * TILE + py) * LOGICAL_W + p.x * TILE + px] = indexOf(c);
    }
  }
}

/**
 * Returns a 320x192 array of palette indices. Brightness is ramp selection
 * only — every output pixel is an exact palette entry (§5.3).
 */
export function renderIndices(v: View): Uint8Array {
  const out = new Uint8Array(LOGICAL_W * LOGICAL_H).fill(indexOf('k'));
  const red = v.lamps.red.level;
  const cyan = v.lamps.cyan.level;
  const redCh = rampChar(RAMPS.red, red, v.cfg);
  const cyanCh = rampChar(RAMPS.cyan, cyan, v.cfg);
  const overCh = rampChar(RAMPS.overlap, Math.min(red, cyan), v.cfg);
  const exitLayer = v.exitKind === 'lift' ? LAYER_LIFT : LAYER_STAIRS;
  for (let ty = 0; ty < v.grid.height; ty++) {
    for (let tx = 0; tx < v.grid.width; tx++) {
      const tile = v.grid.tiles[ty * v.grid.width + tx];
      if (!tile) continue;
      const matter = tx === v.grid.exit.x && ty === v.grid.exit.y ? exitLayer : LAYER_MATTER;
      for (let py = 0; py < TILE; py++) {
        for (let px = 0; px < TILE; px++) {
          const m = redCh !== null && tile.matter && matter[py]?.[px] !== '.';
          const s = cyanCh !== null && tile.support && LAYER_SUPPORT[py]?.[px] !== '.';
          const ch = m && s ? overCh : m ? redCh : s ? cyanCh : null;
          if (ch !== null) out[(ty * TILE + py) * LOGICAL_W + tx * TILE + px] = indexOf(ch);
        }
      }
    }
  }
  if (v.player) {
    if (v.cracked) stamp(out, OVERLAY_CRACK, v.player);
    stamp(out, PLAYER, v.player);
  }
  return out;
}

/** Blit indices through the palette into the 1:1 offscreen canvas. */
export function blit(ctx: CanvasRenderingContext2D, indices: Uint8Array, palette: readonly string[]): void {
  const rgb = palette.map((hex) => {
    const n = parseInt(hex.slice(1) || '000000', 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  });
  const img = ctx.createImageData(LOGICAL_W, LOGICAL_H);
  for (let i = 0; i < indices.length; i++) {
    const c = rgb[indices[i] as number] ?? [0, 0, 0];
    img.data[i * 4] = c[0];
    img.data[i * 4 + 1] = c[1];
    img.data[i * 4 + 2] = c[2];
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
