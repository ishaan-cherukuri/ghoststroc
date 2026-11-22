import * as THREE from 'three';
import { Sfx } from './audio/sfx';
import { CameraRig } from './render/cameraRig';
import { MineView } from './render/mineView';
import { TownView } from './render/townView';
import { endTrip, gearStats, type Meta, type Result } from './sim/economy';
import type { LampColor } from './sim/lamp';
import { cellOf, type Vec2 } from './sim/movement';
import { chartedList, mineTarget, startRun, stepRun, type RunEvent, type RunState } from './sim/run';
import { parseSave, SAVE_KEY, serialize } from './sim/save';
import { doorNear, moveInTown, TOWN } from './sim/town';
import { CELL, PLAYER } from './sim/tuning';
import { Hud } from './ui/hud';
import { MapView } from './ui/mapView';
import { Panels } from './ui/panels';

const STEP = 1 / 60;

// ---- Renderer ---------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('game')?.appendChild(renderer.domElement);

const rig = new CameraRig();
const mineView = new MineView();
const townView = new TownView();
const hud = new Hud();
const sfx = new Sfx();
const mapView = new MapView(document.getElementById('map') as HTMLCanvasElement);

function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight);
  rig.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

// ---- State ------------------------------------------------------------------
let meta: Meta = parseSave(localStorage.getItem(SAVE_KEY));
let mode: 'town' | 'mine' = 'town';
let run: RunState | null = null;
let townPos: Vec2 = TOWN.SPAWN;
let townFacing = Math.PI;
let townMoving = false;
let pendingEvents: RunEvent[] = [];

function save(): void {
  localStorage.setItem(SAVE_KEY, serialize(meta));
}

const panels = new Panels({
  getMeta: () => meta,
  apply: (r: Result, okText: string) => {
    if (r.ok) { meta = r.meta; save(); hud.toast(okText, 'good'); sfx.coin(); }
    else { hud.toast(r.reason, 'bad'); sfx.deny(); }
  },
  descend: (depth: number) => {
    panels.close();
    enterMine(depth);
  },
});

// ---- Input ------------------------------------------------------------------
const held = new Set<string>();
const pressed: string[] = [];
window.addEventListener('keydown', (e) => {
  sfx.unlock();
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (!e.repeat) pressed.push(k);
  held.add(k);
});
window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => held.clear());

const isHeld = (...keys: string[]): boolean => keys.some((k) => held.has(k));

function moveInput(): { x: number; z: number } {
  const right = (isHeld('d', 'arrowright') ? 1 : 0) - (isHeld('a', 'arrowleft') ? 1 : 0);
  const fwd = (isHeld('w', 'arrowup') ? 1 : 0) - (isHeld('s', 'arrowdown') ? 1 : 0);
  return rig.toWorld(right, fwd);
}

// ---- Mode switching -----------------------------------------------------------
function chartedForSave(r: RunState): number[][] {
  return meta.charted.map((list, d) => (d === r.depth ? chartedList(r) : [...list]));
}

interface Carry {
  readonly carried: RunState['carried'];
  readonly battery: number;
  readonly landingFrac?: Vec2;
}

function enterMine(depth: number, carry?: Carry): void {
  meta = { ...meta, unlockedDepth: Math.max(meta.unlockedDepth, depth + 1) };
  run = startRun(depth, gearStats(meta.gear), {
    charted: meta.charted[depth] ?? [],
    tripSeed: meta.trips,
    ...(carry ?? {}),
  });
  mode = 'mine';
  panels.close();
  mapView.toggle(false);
  mineView.load(run);
  rig.snap(new THREE.Vector3(run.pos.x, 0.8, run.pos.z));
  sfx.lift();
  hud.toast(`Depth ${depth + 1}. Your battery is your clock.`, 'info');
  save();
}

function surface(text: string, kind: 'good' | 'bad'): void {
  mode = 'town';
  run = null;
  mapView.toggle(false);
  const head = TOWN.BUILDINGS.find((b) => b.id === 'minehead');
  townPos = head ? { x: head.door.x, z: head.door.z + 1.5 } : TOWN.SPAWN;
  townFacing = 0;
  rig.snap(new THREE.Vector3(townPos.x, 0.8, townPos.z));
  hud.toast(text, kind);
  save();
}

function endRun(r: RunState): void {
  const charted = chartedForSave(r);
  if (r.outcome === 'surfaced') {
    const c = r.carried;
    meta = endTrip(meta, 'surfaced', c, charted);
    sfx.coin();
    surface(c.copper + c.iron + c.gold > 0
      ? `Back in the light with ${c.copper} copper, ${c.iron} iron, ${c.gold} gold. Sell it at the Assay Office.`
      : 'Back in the light, empty-handed.', 'good');
  } else if (r.outcome === 'fainted') {
    meta = endTrip(meta, 'fainted', r.carried, charted);
    surface('You passed out. The rescue crew hauled you up — your ore is lost.', 'bad');
  } else if (r.outcome === 'fell' || r.outcome === 'ladder') {
    meta = { ...meta, charted };
    if (r.outcome === 'fell') hud.toast('The floor gave way! You fell to the level below.', 'bad');
    enterMine(r.depth + 1, {
      carried: r.carried,
      battery: r.battery,
      ...(r.outcome === 'fell' ? { landingFrac: { x: r.pos.x / (r.map.w * CELL), z: r.pos.z / (r.map.h * CELL) } } : {}),
    });
  }
}

// ---- Fixed-step simulation ----------------------------------------------------
function tickMine(r: RunState): void {
  const lamp: LampColor | null = pressed.includes('1') ? 'red' : pressed.includes('2') ? 'cyan' : null;
  const m = mapView.open ? { x: 0, z: 0 } : moveInput();
  stepRun(r, { moveX: m.x, moveZ: m.z, mine: isHeld(' '), use: pressed.includes('f'), lamp }, STEP);
  pendingEvents.push(...r.events);
  for (const e of r.events) {
    switch (e) {
      case 'step': sfx.step(); break;
      case 'lamp-charge': sfx.lampCharge(r.lamp.color === 'red'); break;
      case 'lamp-active': sfx.lampOn(r.lamp.color === 'red'); break;
      case 'lamp-end': sfx.lampOff(); break;
      case 'lamp-empty': hud.toast('Not enough battery for a flash.', 'bad'); sfx.deny(); break;
      case 'mine-tick': sfx.pick(); break;
      case 'mined': sfx.mined(); if (r.lastMined) hud.toast(`+1 ${r.lastMined.kind}`, 'good'); break;
      case 'bag-full': hud.toast('Your bag is full. Head for the lift.', 'bad'); sfx.deny(); break;
      case 'crack': hud.toast('The floor cracks under you — move!', 'bad'); sfx.crack(); break;
      case 'fall': sfx.fall(); break;
      case 'tremor-warn': hud.toast('The ground rumbles…', 'bad'); sfx.rumble(false); break;
      case 'tremor': hud.toast('Tremor! Tunnels have shifted. Your map may be wrong.', 'bad'); sfx.rumble(true); break;
      case 'checkpoint': hud.toast('Checkpoint reached.', 'good'); sfx.checkpoint(); break;
      case 'charted': hud.toast('Your path has been charted on the map (M).', 'info'); break;
      case 'battery-low': hud.toast('Battery low!', 'bad'); sfx.warn(); break;
      case 'dark': hud.toast('Your light is gone. You can barely breathe…', 'bad'); break;
      case 'faint': break;
    }
  }
  if (r.outcome) endRun(r);
}

function tickTown(): void {
  if (panels.current) { townMoving = false; return; }
  const m = moveInput();
  const len = Math.hypot(m.x, m.z);
  townMoving = len > 0.01;
  if (townMoving) {
    const speed = gearStats(meta.gear).speed * STEP;
    townPos = moveInTown(townPos, (m.x / len) * speed, (m.z / len) * speed, PLAYER.RADIUS);
    townFacing = Math.atan2(m.x, m.z);
  }
  if (pressed.includes('f')) {
    const b = doorNear(townPos);
    if (b) panels.open(b.id);
  }
}

function tick(): void {
  if (pressed.includes('q')) rig.rotate(-1);
  if (pressed.includes('e')) rig.rotate(1);
  if (pressed.includes('escape')) { panels.close(); mapView.toggle(false); }
  if (mode === 'mine' && run) {
    if (pressed.includes('m')) mapView.toggle();
    tickMine(run);
  } else if (panels.current && pressed.includes('f')) {
    panels.close();
  } else {
    tickTown();
  }
  pressed.length = 0;
}

// ---- Frame loop -----------------------------------------------------------------
let last = performance.now();
let acc = 0;
let clock = 0;
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  clock += dt;
  while (acc >= STEP) { tick(); acc -= STEP; }

  if (mode === 'mine' && run) {
    mineView.update(run, dt, pendingEvents, rig);
    pendingEvents = [];
    hud.mine(run, meta);
    const cell = cellOf(run.map, run.pos);
    hud.prompt(
      cell === run.map.lift ? 'F — ride the lift up'
        : cell === run.map.ladder ? 'F — climb down the ladder'
          : mineTarget(run) ? 'Hold Space — mine' : null,
    );
    mapView.draw(run, clock);
    renderer.render(mineView.scene, rig.camera);
  } else {
    townView.update(dt, townPos, townFacing, townMoving, rig);
    hud.town(meta);
    const b = doorNear(townPos);
    hud.prompt(panels.current ? null : b ? `F — enter ${b.name}` : null);
    renderer.render(townView.scene, rig.camera);
  }
  hud.drawCompass(rig.yaw);
  requestAnimationFrame(frame);
}

rig.snap(new THREE.Vector3(townPos.x, 0.8, townPos.z));
hud.toast(meta.trips === 0 ? 'Welcome to Ghoststroc. Walk to the Mine Head (north) and press F.' : 'Welcome back.', 'info');
requestAnimationFrame(frame);
