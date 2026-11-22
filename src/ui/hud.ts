import type { Meta } from '../sim/economy';
import { lampProgress } from '../sim/lamp';
import { carriedTotal, type RunState } from '../sim/run';
import { LAMP } from '../sim/tuning';
import { drawCompass } from './mapView';

const el = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

/** DOM heads-up display layered over the 3D canvas. */
export class Hud {
  private readonly compass = el('compass') as HTMLCanvasElement;
  private readonly toastBox = el('toasts');

  toast(text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = text;
    this.toastBox.appendChild(t);
    while (this.toastBox.children.length > 4) this.toastBox.firstElementChild?.remove();
    setTimeout(() => t.classList.add('fade'), 2600);
    setTimeout(() => t.remove(), 3400);
  }

  prompt(text: string | null): void {
    const p = el('prompt');
    p.textContent = text ?? '';
    p.style.display = text ? 'block' : 'none';
  }

  drawCompass(yaw: number): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = 84;
    if (this.compass.width !== size * dpr) {
      this.compass.width = size * dpr;
      this.compass.height = size * dpr;
    }
    const ctx = this.compass.getContext('2d') as CanvasRenderingContext2D;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.compass.width, this.compass.height);
    drawCompass(ctx, size * dpr / 2, size * dpr / 2 + 4 * dpr, size * dpr * 0.36, yaw);
  }

  mine(run: RunState, meta: Meta): void {
    el('hud-mine').style.display = 'block';
    el('hud-town').style.display = 'none';
    el('lamp-wrap').style.display = 'block';
    const pct = Math.max(0, run.battery / run.stats.batteryMax);
    const bar = el('battery-fill');
    bar.style.width = `${pct * 100}%`;
    bar.className = pct < 0.2 ? 'low' : pct < 0.45 ? 'mid' : '';
    el('battery-text').textContent = `${Math.ceil(run.battery)} / ${run.stats.batteryMax}`;
    el('depth').textContent = `Depth ${run.depth + 1}`;
    const c = run.carried;
    el('bag').innerHTML =
      `<span class="ore copper">● ${c.copper}</span><span class="ore iron">■ ${c.iron}</span>` +
      `<span class="ore gold">◆ ${c.gold}</span><span class="cap">${carriedTotal(c)}/${run.stats.bagMax}</span>`;
    el('money').textContent = `$${meta.money}`;

    const lamp = run.lamp;
    const lampEl = el('lamp');
    if (lamp.phase === 'off') {
      lampEl.className = 'off';
      lampEl.textContent = `Lamps ready — 1 red (rock, copper, iron) · 2 cyan (safe floor, gold) · ${LAMP.COST} charge each`;
    } else {
      const left = lamp.phase === 'charging' ? LAMP.CHARGE_S * (1 - lampProgress(lamp)) : LAMP.ACTIVE_S * (1 - lampProgress(lamp));
      lampEl.className = lamp.color ?? 'off';
      lampEl.textContent = lamp.phase === 'charging'
        ? `${lamp.color === 'red' ? 'Red' : 'Cyan'} lamp warming… ${left.toFixed(1)}s`
        : `${lamp.color === 'red' ? 'Red' : 'Cyan'} lamp lit ${left.toFixed(1)}s`;
    }
    el('lamp-progress').style.width = `${(lamp.phase === 'off' ? 0 : 1 - lampProgress(lamp)) * 100}%`;
    el('dark').style.opacity = run.battery <= 0 ? String(Math.min(0.92, run.darkTimer / 6)) : '0';
  }

  town(meta: Meta): void {
    el('hud-mine').style.display = 'none';
    el('hud-town').style.display = 'block';
    el('lamp-wrap').style.display = 'none';
    el('dark').style.opacity = '0';
    const s = meta.stash;
    el('town-money').textContent = `$${meta.money}`;
    el('stash').innerHTML =
      `<span class="ore copper">● ${s.copper} copper</span><span class="ore iron">■ ${s.iron} iron</span>` +
      `<span class="ore steel">▲ ${s.steel} steel</span><span class="ore gold">◆ ${s.gold} gold</span>`;
  }
}
