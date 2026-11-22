import type { RunState } from '../sim/run';
import { cellOf } from '../sim/movement';
import { CELL } from '../sim/tuning';

/**
 * Full-screen map (M). Only charted cells are drawn; everything else is under
 * drifting dark cloud. Checkpoints and the lift are always marked. North is up.
 */
export class MapView {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fog = document.createElement('canvas');
  open = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  }

  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
    this.canvas.style.display = this.open ? 'block' : 'none';
  }

  draw(run: RunState, time: number): void {
    if (!this.open) return;
    const { map } = run;
    const size = Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.86);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas.width !== size * dpr) {
      this.canvas.width = size * dpr;
      this.canvas.height = size * dpr;
      this.canvas.style.width = `${size}px`;
      this.canvas.style.height = `${size}px`;
      this.fog.width = this.canvas.width;
      this.fog.height = this.canvas.height;
    }
    const ctx = this.ctx;
    const W = this.canvas.width;
    const pad = W * 0.06;
    const cs = (W - pad * 2) / map.w;
    const ox = pad;
    const oy = pad;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Parchment backing.
    ctx.fillStyle = '#e9dcb8';
    ctx.fillRect(0, 0, W, W);
    ctx.strokeStyle = '#6b5434';
    ctx.lineWidth = 4 * dpr;
    ctx.strokeRect(2 * dpr, 2 * dpr, W - 4 * dpr, W - 4 * dpr);

    // Charted cells.
    for (const [i, c] of run.charted) {
      const x = ox + (i % map.w) * cs;
      const y = oy + Math.floor(i / map.w) * cs;
      ctx.fillStyle = c === 'floor' ? '#f6efd9' : '#5b4630';
      ctx.fillRect(x, y, cs + 0.5, cs + 0.5);
    }

    // Fog: dark over every uncharted cell, with drifting cloud texture.
    const f = this.fog.getContext('2d') as CanvasRenderingContext2D;
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, W, W);
    f.fillStyle = '#1b1826';
    for (let i = 0; i < map.cells.length; i++) {
      if (run.charted.has(i)) continue;
      f.fillRect(ox + (i % map.w) * cs - 0.5, oy + Math.floor(i / map.w) * cs - 0.5, cs + 1, cs + 1);
    }
    f.globalCompositeOperation = 'source-atop';
    for (let k = 0; k < 26; k++) {
      const bx = ((k * 0.37 + time * 0.012 * (1 + (k % 3) * 0.4)) % 1.2) * W - W * 0.1;
      const by = ((k * 0.61) % 1) * W + Math.sin(time * 0.3 + k) * W * 0.02;
      const r = W * (0.08 + ((k * 0.13) % 0.1));
      const g = f.createRadialGradient(bx, by, 0, bx, by, r);
      g.addColorStop(0, k % 2 ? 'rgba(70,64,92,0.55)' : 'rgba(46,40,64,0.6)');
      g.addColorStop(1, 'rgba(30,26,44,0)');
      f.fillStyle = g;
      f.fillRect(bx - r, by - r, r * 2, r * 2);
    }
    ctx.drawImage(this.fog, 0, 0);

    const centre = (i: number): [number, number] => [ox + ((i % map.w) + 0.5) * cs, oy + (Math.floor(i / map.w) + 0.5) * cs];

    // Lift.
    const [lx, ly] = centre(map.lift);
    ctx.fillStyle = '#2f9e55';
    ctx.beginPath();
    ctx.arc(lx, ly, cs * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${cs * 0.9}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↑', lx, ly);

    // Ladder, if charted.
    if (map.ladder !== null && run.charted.has(map.ladder)) {
      const [x, y] = centre(map.ladder);
      ctx.fillStyle = '#4a6fd6';
      ctx.fillRect(x - cs * 0.6, y - cs * 0.6, cs * 1.2, cs * 1.2);
      ctx.fillStyle = '#fff';
      ctx.fillText('↓', x, y);
    }

    // Checkpoints: always shown.
    map.checkpoints.forEach((c, n) => {
      const [x, y] = centre(c);
      const reached = run.checkpointsReached.has(c);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = reached ? '#f0a92e' : '#c9c2a8';
      ctx.strokeStyle = '#3d2c14';
      ctx.lineWidth = 2 * dpr;
      ctx.fillRect(-cs * 0.6, -cs * 0.6, cs * 1.2, cs * 1.2);
      ctx.strokeRect(-cs * 0.6, -cs * 0.6, cs * 1.2, cs * 1.2);
      ctx.restore();
      ctx.fillStyle = '#3d2c14';
      ctx.font = `bold ${cs * 0.8}px system-ui`;
      ctx.fillText(String(n + 1), x, y + 1);
    });

    // You.
    const pc = cellOf(map, run.pos);
    const px = ox + (run.pos.x / CELL) * cs;
    const py = oy + (run.pos.z / CELL) * cs;
    void pc;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - run.facing);
    ctx.fillStyle = '#d63b2f';
    ctx.beginPath();
    ctx.moveTo(0, -cs * 0.7);
    ctx.lineTo(cs * 0.5, cs * 0.5);
    ctx.lineTo(-cs * 0.5, cs * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    drawCompass(ctx, W - pad * 0.5 - W * 0.07, pad * 0.5 + W * 0.07, W * 0.065, 0);

    ctx.fillStyle = '#3d2c14';
    ctx.font = `${W * 0.022}px system-ui`;
    ctx.textAlign = 'left';
    ctx.fillText(`Depth ${run.depth + 1} — charted path updates at checkpoints ◆`, pad, pad * 0.5);
  }
}

/** Compass rose; `rotation` turns the needle (radians, clockwise). */
export function drawCompass(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rotation: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(246,239,217,0.95)';
  ctx.strokeStyle = '#6b5434';
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.rotate(rotation);
  ctx.fillStyle = '#d63b2f';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.8);
  ctx.lineTo(r * 0.2, 0);
  ctx.lineTo(-r * 0.2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3d2c14';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.8);
  ctx.lineTo(r * 0.2, 0);
  ctx.lineTo(-r * 0.2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.font = `bold ${r * 0.42}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d63b2f';
  ctx.fillText('N', 0, -r * 1.28 + r * 0.32);
  ctx.restore();
}
