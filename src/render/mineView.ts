import * as THREE from 'three';
import { lampIntensity } from '../sim/lamp';
import type { MineMap, OreNode } from '../sim/maze';
import { cellCenter } from '../sim/movement';
import { makeRng } from '../sim/rng';
import { orePosition, type RunState } from '../sim/run';
import { CELL } from '../sim/tuning';
import { CameraRig } from './cameraRig';
import { Particles, PulseRings } from './effects';
import { Miner } from './miner';
import { LIGHT, MINE_ALBEDO } from './palette';

const WALL_H = 1.6;

function lambert(color: THREE.Color): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

export class MineView {
  readonly scene = new THREE.Scene();
  readonly miner = new Miner();
  private readonly terrain = new THREE.Group();
  private readonly oreGroup = new THREE.Group();
  private readonly fixtures = new THREE.Group();
  private readonly helmet: THREE.PointLight;
  private readonly pulse: THREE.PointLight;
  private readonly rings = new PulseRings();
  private readonly chips = new Particles(180);
  private readonly oreMeshes = new Map<number, THREE.Object3D>();
  private mapVersion = -1;
  private map: MineMap | null = null;
  private ringTimer = 0;
  private time = 0;

  constructor() {
    this.scene.background = new THREE.Color(0x000000);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.04));
    this.helmet = new THREE.PointLight(LIGHT.HELMET_COLOR, LIGHT.HELMET_INTENSITY, LIGHT.HELMET_RANGE, 1.6);
    this.helmet.castShadow = true;
    this.helmet.shadow.mapSize.set(512, 512);
    this.helmet.shadow.camera.near = 0.1;
    this.helmet.shadow.camera.far = LIGHT.HELMET_RANGE;
    this.helmet.shadow.bias = -0.004;
    this.pulse = new THREE.PointLight(LIGHT.RED, 0, 10, 1);
    this.scene.add(this.terrain, this.oreGroup, this.fixtures, this.miner.group, this.helmet, this.pulse, this.rings.group, this.chips.group);
  }

  /** Build everything for a fresh run. */
  load(run: RunState): void {
    this.map = run.map;
    this.mapVersion = -1;
    this.fixtures.clear();
    this.buildFixtures(run.map);
    this.syncTerrain(run);
    this.syncOres(run.map, true);
  }

  private syncTerrain(run: RunState): void {
    const m = run.map;
    this.mapVersion = run.mapVersion;
    for (const c of this.terrain.children) {
      const mesh = c as THREE.InstancedMesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.terrain.clear();
    const rng = makeRng(m.depth * 977 + 13);
    const floors: number[] = [];
    const hollows: number[] = [];
    const walls: number[] = [];
    m.cells.forEach((c, i) => {
      if (c === 'wall') walls.push(i);
      else if (m.hollow.has(i)) hollows.push(i);
      else floors.push(i);
    });

    const place = (cells: number[], geo: THREE.BufferGeometry, color: THREE.Color, y: (i: number) => [number, number]): THREE.InstancedMesh => {
      const mesh = new THREE.InstancedMesh(geo, lambert(color), cells.length);
      const mtx = new THREE.Matrix4();
      const tint = new THREE.Color();
      cells.forEach((cell, k) => {
        const p = cellCenter(m, cell);
        const [py, sy] = y(cell);
        mtx.makeScale(1, sy, 1).setPosition(p.x, py, p.z);
        mesh.setMatrixAt(k, mtx);
        const v = 0.75 + rng.next() * 0.35; // brightness only: keeps channels pure
        mesh.setColorAt(k, tint.setRGB(v, v, v));
      });
      mesh.receiveShadow = true;
      return mesh;
    };

    const floorGeo = new THREE.BoxGeometry(CELL, 0.2, CELL);
    this.terrain.add(place(floors, floorGeo, MINE_ALBEDO.floorSolid, () => [-0.1, 1]));
    if (hollows.length) this.terrain.add(place(hollows, floorGeo.clone(), MINE_ALBEDO.floorHollow, () => [-0.1, 1]));
    const wallGeo = new THREE.BoxGeometry(CELL, 1, CELL);
    const walls3d = place(walls, wallGeo, MINE_ALBEDO.wall, () => {
      const s = WALL_H * (0.8 + rng.next() * 0.45);
      return [s / 2, s];
    });
    walls3d.castShadow = true;
    this.terrain.add(walls3d);

    // Scattered rubble for texture.
    const rubbleGeo = new THREE.DodecahedronGeometry(0.22, 0);
    const rubble = floors.filter(() => rng.next() < 0.18);
    const rmesh = new THREE.InstancedMesh(rubbleGeo, lambert(MINE_ALBEDO.wall), rubble.length);
    const mtx = new THREE.Matrix4();
    rubble.forEach((cell, k) => {
      const p = cellCenter(m, cell);
      const s = 0.6 + rng.next() * 0.9;
      mtx.makeRotationY(rng.next() * 6).scale(new THREE.Vector3(s, s * 0.7, s))
        .setPosition(p.x + (rng.next() - 0.5) * CELL * 0.8, 0.05, p.z + (rng.next() - 0.5) * CELL * 0.8);
      rmesh.setMatrixAt(k, mtx);
    });
    rmesh.castShadow = true;
    this.terrain.add(rmesh);
  }

  private makeOre(m: MineMap, o: OreNode): THREE.Object3D {
    const g = new THREE.Group();
    const rng = makeRng(o.id * 31 + m.depth);
    const color = MINE_ALBEDO[o.kind];
    const n = o.kind === 'iron' ? 3 : o.kind === 'gold' ? 5 : 4;
    for (let i = 0; i < n; i++) {
      const geo = o.kind === 'iron' ? new THREE.BoxGeometry(0.3, 0.26, 0.3) : new THREE.OctahedronGeometry(o.kind === 'gold' ? 0.16 : 0.2, 0);
      const mesh = new THREE.Mesh(geo, lambert(color));
      mesh.position.set((rng.next() - 0.5) * 0.7, 0.45 + rng.next() * 0.7, (rng.next() - 0.5) * 0.7);
      mesh.rotation.set(rng.next() * 3, rng.next() * 3, rng.next() * 3);
      mesh.castShadow = true;
      g.add(mesh);
    }
    const p = orePosition(m, o);
    const f = cellCenter(m, o.floor);
    // Sit just proud of the wall face.
    g.position.set(p.x + (f.x - p.x) * 0.08, 0, p.z + (f.z - p.z) * 0.08);
    return g;
  }

  private syncOres(m: MineMap, rebuild = false): void {
    if (rebuild) {
      this.oreGroup.clear();
      this.oreMeshes.clear();
    }
    const live = new Set(m.ores.map((o) => o.id));
    for (const [id, obj] of this.oreMeshes) {
      if (!live.has(id)) { this.oreGroup.remove(obj); this.oreMeshes.delete(id); }
    }
    for (const o of m.ores) {
      if (this.oreMeshes.has(o.id)) continue;
      const obj = this.makeOre(m, o);
      this.oreMeshes.set(o.id, obj);
      this.oreGroup.add(obj);
    }
  }

  private buildFixtures(m: MineMap): void {
    const wood = lambert(MINE_ALBEDO.wood);
    const frame = (cell: number, lantern: boolean, beacon: number): void => {
      const p = cellCenter(m, cell);
      const g = new THREE.Group();
      for (const dx of [-0.8, 0.8]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 0.16), wood);
        post.position.set(dx, 0.95, 0);
        post.castShadow = true;
        g.add(post);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 0.2), wood);
      beam.position.y = 1.9;
      g.add(beam);
      // Glowing floor ring so you can spot it in the dark.
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 32), new THREE.MeshBasicMaterial({ color: beacon, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      g.add(ring);
      if (lantern) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: LIGHT.LANTERN }));
        bulb.position.set(0, 1.7, 0.15);
        const light = new THREE.PointLight(LIGHT.LANTERN, LIGHT.LANTERN_INTENSITY, 3.5, 1.5);
        light.position.copy(bulb.position);
        g.add(bulb, light);
      }
      g.position.set(p.x, 0, p.z);
      this.fixtures.add(g);
    };
    m.checkpoints.forEach((c) => frame(c, true, 0xffc070));
    frame(m.lift, true, 0x7dff9a);
    // Lift cage.
    const lp = cellCenter(m, m.lift);
    const cage = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 1.3), wood);
    cage.position.set(lp.x, 0.05, lp.z);
    this.fixtures.add(cage);
    if (m.ladder !== null) {
      const p = cellCenter(m, m.ladder);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      hole.rotation.x = -Math.PI / 2;
      hole.position.set(p.x, 0.02, p.z);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.9, 32), new THREE.MeshBasicMaterial({ color: 0x9ab8ff, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.x, 0.03, p.z);
      this.fixtures.add(hole, ring);
      for (const dx of [-0.3, 0.3]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.08), wood);
        rail.position.set(p.x + dx, 0.5, p.z);
        this.fixtures.add(rail);
      }
    }
  }

  /** Per-frame visual update. `events` are the sim events since last frame. */
  update(run: RunState, dt: number, events: readonly string[], rig: CameraRig): void {
    this.time += dt;
    if (this.map !== run.map) this.load(run);
    if (run.mapVersion !== this.mapVersion) { this.syncTerrain(run); this.syncOres(run.map); }
    else if (this.oreMeshes.size !== run.map.ores.length) this.syncOres(run.map);

    const mining = run.mining !== null;
    this.miner.group.position.set(run.pos.x, 0, run.pos.z);
    this.miner.update(dt, run.moving, mining, run.facing);

    // Helmet lamp: always on while there's battery, flickers when low.
    const anchor = new THREE.Vector3();
    this.miner.lampAnchor.getWorldPosition(anchor);
    this.helmet.position.copy(anchor);
    const low = run.battery < run.stats.batteryMax * 0.2;
    const flicker = low ? 0.75 + 0.25 * Math.sin(this.time * 37) * Math.sin(this.time * 11) : 1;
    this.helmet.intensity = run.battery > 0 ? LIGHT.HELMET_INTENSITY * flicker : 0;

    // Lamp pulse.
    const lamp = run.lamp;
    const color = lamp.color === 'cyan' ? LIGHT.CYAN : LIGHT.RED;
    this.pulse.color.setHex(color);
    this.pulse.distance = run.stats.lampRadius * 1.25;
    this.pulse.position.set(run.pos.x, 3.2, run.pos.z);
    this.pulse.intensity = LIGHT.PULSE_INTENSITY * lampIntensity(lamp);
    const feet = new THREE.Vector3(run.pos.x, 0, run.pos.z);
    if (lamp.phase === 'charging') {
      this.ringTimer -= dt;
      if (this.ringTimer <= 0) { this.rings.spawn(color, feet, run.stats.lampRadius); this.ringTimer = 0.33; }
    } else if (lamp.phase === 'active') {
      this.ringTimer -= dt;
      if (this.ringTimer <= 0) { this.rings.spawn(color, feet, run.stats.lampRadius, 2.2); this.ringTimer = 2.4; }
    } else this.ringTimer = 0;
    this.rings.update(dt);

    // Events → effects.
    for (const e of events) {
      if (e === 'mine-tick' && run.mining) {
        const o = run.map.ores.find((x) => x.id === run.mining?.oreId);
        if (o) {
          const p = orePosition(run.map, o);
          this.chips.emit(new THREE.Vector3(p.x, 0.9, p.z), MINE_ALBEDO[o.kind], 6, { speed: 3, up: 2.5 });
          rig.addShake(0.08);
        }
      }
      if (e === 'mined' && run.lastMined) {
        const p = orePosition(run.map, run.lastMined);
        this.chips.emit(new THREE.Vector3(p.x, 0.9, p.z), MINE_ALBEDO[run.lastMined.kind], 18, { speed: 4, up: 3.5 });
      }
      if (e === 'tremor-warn') rig.addShake(0.4);
      if (e === 'tremor') {
        rig.addShake(1.2);
        for (const c of run.lastTremor?.collapsed ?? []) {
          const p = cellCenter(run.map, c);
          this.chips.emit(new THREE.Vector3(p.x, 1.4, p.z), MINE_ALBEDO.wall, 14, { speed: 3, up: 1, life: 1.2 });
        }
      }
      if (e === 'crack') rig.addShake(0.3);
    }
    this.chips.update(dt);

    rig.update(dt, new THREE.Vector3(run.pos.x, 0.8, run.pos.z));
  }
}
