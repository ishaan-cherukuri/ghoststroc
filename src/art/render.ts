import { rampStep, type LampConfig, type LampState } from '../sim/lamps';
import type { Grid } from '../sim/types';
import { indexOf } from './palette';
import { LAYER_MATTER, LAYER_SUPPORT, MARK_EXIT, MARK_START } from './tiles';

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
}

function rampChar(ramp: readonly string[], level: number, cfg: LampConfig): string | null {
  const s = rampStep(level, cfg, ramp.length);
  return s === null ? null : (ramp[s] as string);
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
  for (let ty = 0; ty < v.grid.height; ty++) {
    for (let tx = 0; tx < v.grid.width; tx++) {
      const tile = v.grid.tiles[ty * v.grid.width + tx];
      if (!tile) continue;
      for (let py = 0; py < TILE; py++) {
        for (let px = 0; px < TILE; px++) {
          const m = redCh !== null && tile.matter && LAYER_MATTER[py]?.[px] !== '.';
          const s = cyanCh !== null && tile.support && LAYER_SUPPORT[py]?.[px] !== '.';
          const ch = m && s ? overCh : m ? redCh : s ? cyanCh : null;
          if (ch !== null) out[(ty * TILE + py) * LOGICAL_W + tx * TILE + px] = indexOf(ch);
        }
      }
    }
  }
  for (const [sprite, p] of [[MARK_START, v.grid.start], [MARK_EXIT, v.grid.exit]] as const) {
    for (let py = 0; py < TILE; py++) {
      for (let px = 0; px < TILE; px++) {
        const c = sprite[py]?.[px] ?? '.';
        if (c !== '.') out[(p.y * TILE + py) * LOGICAL_W + p.x * TILE + px] = indexOf(c);
      }
    }
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
