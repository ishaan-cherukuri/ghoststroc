import { PALETTE, ROLE_NAMES } from './art/palette';
import { blit, LOGICAL_H, LOGICAL_W, renderIndices } from './art/render';
import { GAME, gridFor, newGame, step, type Action, type GameEvent, type GameState } from './sim/game';
import { DEFAULT_LAMP_CONFIG, type LampConfig } from './sim/lamps';
import { LEVELS } from './sim/levels';

const PANEL_W = 300; // px reserved for the side panel
const CHROME_H = 70; // px for banner + page margins
/** Largest whole-number scale that fits the window (§2.5: never non-integer). */
function fitScale(): number {
  const w = Math.floor((window.innerWidth - PANEL_W - 60) / LOGICAL_W);
  const h = Math.floor((window.innerHeight - CHROME_H) / LOGICAL_H);
  return Math.max(1, Math.min(6, w, h));
}
let scale = fitScale();

const palette = [...PALETTE]; // live-tunable copy; still exactly 16 entries
let cfg: LampConfig = { ...DEFAULT_LAMP_CONFIG };
let state: GameState = newGame();
const log: string[] = [];

const MESSAGES: Readonly<Record<GameEvent, string>> = {
  'blocked': 'Solid rock.',
  'no-charge': 'That lamp is empty.',
  'cracked': 'The floor cracks under you!',
  'collapsed': 'The floor gives way — you fall.',
  'fell': 'Nothing holds you — you fall.',
  'descended': 'You take the stairs down. Lamps refilled.',
  'extracted': 'You ride the lift out. You made it.',
  'died': 'The fall was too far.',
  'fell-into-deep': 'You fall into the deep. Nothing is below.',
};

const screen = document.getElementById('screen') as HTMLCanvasElement;
const sctx = screen.getContext('2d') as CanvasRenderingContext2D;

const off = document.createElement('canvas');
off.width = LOGICAL_W;
off.height = LOGICAL_H;
const octx = off.getContext('2d') as CanvasRenderingContext2D;

const el = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;
const pips = (n: number, max: number): string => '●'.repeat(n) + '○'.repeat(Math.max(0, max - n));

function draw(): void {
  const level = LEVELS[state.level];
  blit(octx, renderIndices({
    grid: gridFor(state.level), lamps: state.lamps, cfg, exitKind: level?.exit ?? 'stairs',
    player: state.player, cracked: state.armedHollow !== null,
  }), palette);
  sctx.imageSmoothingEnabled = false;
  if (screen.width !== LOGICAL_W * scale) {
    screen.width = LOGICAL_W * scale;
    screen.height = LOGICAL_H * scale;
  }
  sctx.drawImage(off, 0, 0, LOGICAL_W * scale, LOGICAL_H * scale);
  const lv = (n: number): string =>
    n === 0 ? 'dark' : n > cfg.decayTurns ? `full (${n - cfg.decayTurns} left)` : `fading ${n}/${cfg.decayTurns}`;
  el('status').textContent =
    `floor   ${state.level + 1}/${LEVELS.length}  ${level?.name ?? ''}\n` +
    `hp      ${pips(state.hp, GAME.MAX_HP)}\n` +
    `red     ${pips(state.charges.red, GAME.CHARGES_PER_FLOOR)}  ${lv(state.lamps.red.level)}\n` +
    `cyan    ${pips(state.charges.cyan, GAME.CHARGES_PER_FLOOR)}  ${lv(state.lamps.cyan.level)}\n` +
    `turn    ${state.turn}`;
  el('log').textContent = log.slice(-6).join('\n');
  el('banner').textContent =
    state.status === 'won' ? `Extracted on turn ${state.turn}. Enter for a new run.`
    : state.status === 'dead' ? 'You died. Enter for a new run.'
    : state.armedHollow ? 'Cracking! Move off this tile now.' : '';
}

function act(a: Action): void {
  state = step(state, a, cfg);
  for (const e of state.events) log.push(MESSAGES[e]);
  draw();
}

function restart(): void {
  state = newGame();
  log.length = 0;
  log.push(`Floor 1: ${LEVELS[0]?.name ?? ''}. Find the ladder.`);
  draw();
}

const KEYS: Readonly<Record<string, Action>> = {
  arrowup: { type: 'move', dir: 'up' }, w: { type: 'move', dir: 'up' },
  arrowdown: { type: 'move', dir: 'down' }, s: { type: 'move', dir: 'down' },
  arrowleft: { type: 'move', dir: 'left' }, a: { type: 'move', dir: 'left' },
  arrowright: { type: 'move', dir: 'right' }, d: { type: 'move', dir: 'right' },
  '1': { type: 'flash', channel: 'red' }, r: { type: 'flash', channel: 'red' },
  '2': { type: 'flash', channel: 'cyan' }, c: { type: 'flash', channel: 'cyan' },
  ' ': { type: 'wait' },
};

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key.toLowerCase();
  const a = KEYS[k];
  if (a) act(a);
  else if (k === 'enter' || k === 'backspace') restart();
  else return;
  e.preventDefault();
});

function numberInput(label: string, value: number, onChange: (n: number) => void): void {
  const l = document.createElement('label');
  l.textContent = label;
  const i = document.createElement('input');
  i.type = 'number'; i.min = '0'; i.max = '20'; i.value = String(value);
  i.addEventListener('change', () => { onChange(Math.max(0, Math.round(Number(i.value)))); draw(); });
  l.appendChild(i);
  el('fade').appendChild(l);
}
numberInput('full turns', cfg.fullTurns, (n) => { cfg = { ...cfg, fullTurns: n }; });
numberInput('decay turns', cfg.decayTurns, (n) => { cfg = { ...cfg, decayTurns: Math.max(1, n) }; });

for (let idx = 1; idx <= 10; idx++) {
  const l = document.createElement('label');
  l.textContent = `${idx} ${ROLE_NAMES[idx]}`;
  const i = document.createElement('input');
  i.type = 'color'; i.value = palette[idx] as string;
  i.addEventListener('input', () => { palette[idx] = i.value; draw(); });
  l.appendChild(i);
  el('palette').appendChild(l);
}
const dump = document.createElement('button');
dump.textContent = 'log palette to console';
dump.addEventListener('click', () => console.log(JSON.stringify(palette, null, 2)));
el('palette').appendChild(dump);

window.addEventListener('resize', () => { scale = fitScale(); draw(); });

window.addEventListener('resize', () => { scale = fitScale(); draw(); });

restart();
