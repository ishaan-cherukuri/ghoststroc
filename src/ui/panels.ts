import { GEAR, GEAR_SLOTS, MATERIALS, PRICES, SMELT, nextTier, sell, smelt, upgrade, type Meta, type Result } from '../sim/economy';
import type { BuildingId } from '../sim/town';

export interface PanelHooks {
  getMeta(): Meta;
  apply(r: Result, okText: string): void;
  descend(depth: number): void;
}

const NAMES: Readonly<Record<string, string>> = { copper: 'Copper', iron: 'Iron', steel: 'Steel', gold: 'Gold' };

/** Modal shop panels for the town buildings. */
export class Panels {
  private readonly root = document.getElementById('panel') as HTMLElement;
  current: BuildingId | null = null;

  constructor(private readonly hooks: PanelHooks) {}

  close(): void {
    this.current = null;
    this.root.style.display = 'none';
  }

  open(id: BuildingId): void {
    this.current = id;
    this.root.style.display = 'block';
    this.render();
  }

  render(): void {
    const id = this.current;
    if (!id) return;
    const meta = this.hooks.getMeta();
    const r = this.root;
    r.innerHTML = '';
    const h = (tag: string, text: string, cls = ''): HTMLElement => {
      const e = document.createElement(tag);
      e.textContent = text;
      if (cls) e.className = cls;
      r.appendChild(e);
      return e;
    };
    const row = (text: string, buttons: [string, () => void, boolean][]): void => {
      const d = document.createElement('div');
      d.className = 'row';
      const span = document.createElement('span');
      span.textContent = text;
      d.appendChild(span);
      for (const [label, fn, enabled] of buttons) {
        const b = document.createElement('button');
        b.textContent = label;
        b.disabled = !enabled;
        b.addEventListener('click', () => { fn(); this.render(); });
        d.appendChild(b);
      }
      r.appendChild(d);
    };

    if (id === 'assay') {
      h('h2', 'Assay Office');
      h('p', 'We buy what you dig up.', 'sub');
      for (const m of MATERIALS) {
        const n = meta.stash[m];
        row(`${NAMES[m]} — $${PRICES[m]} each (you have ${n})`, [
          ['Sell 1', () => this.hooks.apply(sell(this.hooks.getMeta(), m, 1), `Sold 1 ${m}.`), n > 0],
          ['Sell all', () => this.hooks.apply(sell(this.hooks.getMeta(), m, n), `Sold ${n} ${m} for $${n * PRICES[m]}.`), n > 0],
        ]);
      }
    } else if (id === 'smelter') {
      h('h2', 'Smelter');
      h('p', `${SMELT.IRON_PER_STEEL} iron + $${SMELT.FEE} → 1 steel. Steel sells for $${PRICES.steel} and better gear needs it.`, 'sub');
      const can = meta.stash.iron >= SMELT.IRON_PER_STEEL && meta.money >= SMELT.FEE;
      row(`Iron: ${meta.stash.iron} · Steel: ${meta.stash.steel}`, [
        ['Smelt 1', () => this.hooks.apply(smelt(this.hooks.getMeta()), 'The furnace roars. +1 steel.'), can],
        ['Smelt all', () => {
          let m = this.hooks.getMeta();
          let n = 0;
          for (;;) { const res = smelt(m); if (!res.ok) break; m = res.meta; n++; }
          this.hooks.apply({ ok: true, meta: m }, `Smelted ${n} steel.`);
        }, can],
      ]);
    } else if (id === 'outfitter') {
      h('h2', 'Outfitter');
      h('p', `You have $${meta.money} and ${meta.stash.steel} steel.`, 'sub');
      for (const slot of GEAR_SLOTS) {
        const g = GEAR[slot];
        const cur = g.tiers[meta.gear[slot]];
        const next = nextTier(meta, slot);
        const text = next
          ? `${g.name}: ${cur?.value} → ${next.value} ${g.unit} — $${next.cost}${next.steel ? ` + ${next.steel} steel` : ''}`
          : `${g.name}: ${cur?.value} ${g.unit} (best)`;
        row(text, next ? [['Buy', () => this.hooks.apply(upgrade(this.hooks.getMeta(), slot), `${g.name} upgraded.`),
          meta.money >= next.cost && meta.stash.steel >= next.steel]] : []);
      }
    } else {
      h('h2', 'Mine Head');
      h('p', 'Ride the lift down. Bring back what you can before your battery dies.', 'sub');
      const blurb = ['Copper, some iron. Few hollows.', 'Iron and the first gold. More hollow ground.', 'Gold country. Treacherous floor — a fall here is the end.'];
      for (let d = 0; d < 3; d++) {
        const open = d < meta.unlockedDepth;
        row(`Depth ${d + 1}: ${open ? blurb[d] : 'Locked — find the ladder down on the level above.'}`, [
          [open ? 'Descend' : 'Locked', () => this.hooks.descend(d), open],
        ]);
      }
    }
    const close = document.createElement('div');
    close.className = 'hint';
    close.textContent = 'Esc or F to close';
    r.appendChild(close);
  }
}
