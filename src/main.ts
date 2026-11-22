import { PALETTE, ROLE_NAMES } from './art/palette';
import { blit, LOGICAL_H, LOGICAL_W, renderIndices } from './art/render';
import { DEFAULT_LAMP_CONFIG, type LampConfig, type LampState } from './sim/lamps';
import { parseRoom, PROTOTYPE_ROOM } from './sim/prototypeRoom';
import { initialState, step, type Action, type ProtoState } from './sim/turn';

const SCALE = 4; // integer only (§2.5)

const grid = parseRoom(PROTOTYPE_ROOM);
const palette = [...PALETTE]; // live-tunable copy; still exactly 16 entries
let cfg: LampConfig = { ...DEFAULT_LAMP_CONFIG };
let state: ProtoState = initialState();
let peeking = false;
let peeks = 0;

const screen = document.getElementById('screen') as HTMLCanvasElement;
screen.width = LOGICAL_W * SCALE;
screen.height = LOGICAL_H * SCALE;
const sctx = screen.getContext('2d') as CanvasRenderingContext2D;
sctx.imageSmoothingEnabled = false;

const off = document.createElement('canvas');
off.width = LOGICAL_W;
off.height = LOGICAL_H;
const octx = off.getContext('2d') as CanvasRenderingContext2D;

function draw(): void {
  const full = { level: cfg.fullTurns + cfg.decayTurns, flashedThisTurn: false };
  const lamps: LampState = peeking ? { red: full, cyan: full } : state.lamps;
  blit(octx, renderIndices({ grid, lamps, cfg }), palette);
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(off, 0, 0, LOGICAL_W * SCALE, LOGICAL_H * SCALE);
  const lv = (n: number): string =>
    n === 0 ? 'dark' : n > cfg.decayTurns ? `full (${n - cfg.decayTurns} left)` : `decay ${n}/${cfg.decayTurns}`;
  (document.getElementById('status') as HTMLElement).textContent =
    `turn    ${state.turn}\nred     ${lv(state.lamps.red.level)}\ncyan    ${lv(state.lamps.cyan.level)}\n` +
    `flashes red ${state.flashes.red} / cyan ${state.flashes.cyan}\nchecks  ${peeks}${peeking ? '  [CHECKING]' : ''}`;
}

function act(a: Action): void {
  state = step(state, a, cfg);
  draw();
}

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key.toLowerCase();
  if (k === '1' || k === 'r') act({ type: 'flash', channel: 'red' });
  else if (k === '2' || k === 'c') act({ type: 'flash', channel: 'cyan' });
  else if (k === ' ') act({ type: 'wait' });
  else if (k === 'backspace') { state = initialState(); peeks = 0; draw(); }
  else if (k === 't' && !e.repeat) { peeking = true; peeks++; draw(); }
  else return;
  e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  if (e.key.toLowerCase() === 't') { peeking = false; draw(); }
});

function numberInput(label: string, value: number, onChange: (n: number) => void): void {
  const l = document.createElement('label');
  l.textContent = label;
  const i = document.createElement('input');
  i.type = 'number'; i.min = '0'; i.max = '20'; i.value = String(value);
  i.addEventListener('change', () => { onChange(Math.max(0, Math.round(Number(i.value)))); draw(); });
  l.appendChild(i);
  (document.getElementById('fade') as HTMLElement).appendChild(l);
}
numberInput('full turns', cfg.fullTurns, (n) => { cfg = { ...cfg, fullTurns: n }; });
numberInput('decay turns', cfg.decayTurns, (n) => { cfg = { ...cfg, decayTurns: Math.max(1, n) }; });

const palBox = document.getElementById('palette') as HTMLElement;
for (let idx = 1; idx <= 10; idx++) {
  const l = document.createElement('label');
  l.textContent = `${idx} ${ROLE_NAMES[idx]}`;
  const i = document.createElement('input');
  i.type = 'color'; i.value = palette[idx] as string;
  i.addEventListener('input', () => { palette[idx] = i.value; draw(); });
  l.appendChild(i);
  palBox.appendChild(l);
}
const dump = document.createElement('button');
dump.textContent = 'log palette to console';
dump.addEventListener('click', () => console.log(JSON.stringify(palette, null, 2)));
palBox.appendChild(dump);

draw();
