import * as THREE from 'three';
import type { Vec2 } from '../sim/movement';
import { makeRng } from '../sim/rng';
import { TOWN, type Building } from '../sim/town';
import { CameraRig } from './cameraRig';
import { Particles } from './effects';
import { Miner } from './miner';

// Placeholder town built from primitives. Bright, colourful, daytime.

const std = (color: number, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...opts });

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, shadows = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
}

function label(text: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = 'rgba(40, 28, 18, 0.85)';
  ctx.beginPath();
  ctx.roundRect(8, 16, 496, 96, 24);
  ctx.fill();
  ctx.fillStyle = '#fff4d6';
  ctx.font = 'bold 56px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set(4, 1, 1);
  return s;
}

export class TownView {
  readonly scene = new THREE.Scene();
  readonly miner = new Miner();
  private readonly smoke = new Particles(60, false);
  private readonly ripples: { m: THREE.Mesh; age: number }[] = [];
  private readonly trees: THREE.Group[] = [];
  private readonly clouds: THREE.Group[] = [];
  private wheel: THREE.Mesh | null = null;
  private smokeAt = new THREE.Vector3();
  private t = 0;
  private smokeTimer = 0;
  private rippleTimer = 0;

  constructor() {
    const s = this.scene;
    s.fog = new THREE.Fog(0xbfe3ff, 45, 140);

    // Sky dome with a gradient.
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(250, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color(0x2f7fe0) }, bottom: { value: new THREE.Color(0xcdeeff) } },
        vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vP,1.0); }',
        fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.55)), 1.0);\n#include <colorspace_fragment>\n}',
      }),
    );
    s.add(sky);

    // Sun and sky light.
    s.add(new THREE.HemisphereLight(0xcfeaff, 0x5f8f3a, 1.6));
    const sun = new THREE.DirectionalLight(0xfff1d0, 2.6);
    sun.position.set(18, 30, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 90;
    sun.shadow.bias = -0.0005;
    s.add(sun, sun.target);

    // Ground with gentle colour variation.
    const rng = makeRng(77);
    const groundGeo = new THREE.PlaneGeometry(160, 160, 80, 80);
    groundGeo.rotateX(-Math.PI / 2);
    const colors: number[] = [];
    const pos = groundGeo.attributes.position as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const far = Math.max(0, Math.hypot(x, z) - 30);
      pos.setY(i, far * 0.06 * Math.sin(x * 0.15) * Math.cos(z * 0.13) + (far > 0 ? far * 0.04 : 0));
      c.setHSL(0.27 + rng.next() * 0.04, 0.5, 0.4 + rng.next() * 0.08);
      colors.push(c.r, c.g, c.b);
    }
    groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    groundGeo.computeVertexNormals();
    const ground = mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }), false);
    s.add(ground);

    // Dirt plaza and paths to each door.
    const dirt = std(0xc9a56b, { roughness: 1 });
    const plaza = mesh(new THREE.CircleGeometry(7, 40), dirt, false);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.02;
    s.add(plaza);
    for (const b of TOWN.BUILDINGS) {
      const len = Math.hypot(b.door.x, b.door.z);
      const geo = new THREE.PlaneGeometry(2.2, len);
      geo.rotateX(-Math.PI / 2);
      const path = mesh(geo, dirt, false);
      path.rotation.y = Math.atan2(b.door.x, b.door.z);
      path.position.set(b.door.x / 2, 0.025, b.door.z / 2);
      s.add(path);
    }

    for (const b of TOWN.BUILDINGS) this.building(b);

    // Pond with lily pads.
    const water = mesh(new THREE.CircleGeometry(TOWN.POND.r, 48), new THREE.MeshStandardMaterial({ color: 0x2b8fe0, roughness: 0.15, metalness: 0.1 }), false);
    water.rotation.x = -Math.PI / 2;
    water.position.set(TOWN.POND.x, 0.04, TOWN.POND.z);
    const bank = mesh(new THREE.RingGeometry(TOWN.POND.r, TOWN.POND.r + 0.6, 48), std(0x8a7a55), false);
    bank.rotation.x = -Math.PI / 2;
    bank.position.set(TOWN.POND.x, 0.03, TOWN.POND.z);
    s.add(water, bank);
    for (let i = 0; i < 5; i++) {
      const pad = mesh(new THREE.CircleGeometry(0.35, 12), std(0x3f9b3a), false);
      pad.rotation.x = -Math.PI / 2;
      const a = rng.next() * 6.28;
      const r = rng.next() * (TOWN.POND.r - 1);
      pad.position.set(TOWN.POND.x + Math.cos(a) * r, 0.06, TOWN.POND.z + Math.sin(a) * r);
      s.add(pad);
    }
    const rippleGeo = new THREE.RingGeometry(0.9, 1, 32);
    rippleGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
      m.visible = false;
      s.add(m);
      this.ripples.push({ m, age: 0 });
    }

    // Trees.
    for (const [x, z] of TOWN.TREES) this.tree(x, z, rng.next());
    for (let i = 0; i < 40; i++) {
      const a = rng.next() * 6.28;
      const r = 30 + rng.next() * 30;
      this.tree(Math.cos(a) * r, Math.sin(a) * r, rng.next());
    }

    // Clouds.
    const cloudMat = std(0xffffff, { roughness: 1, emissive: 0x99aabb, emissiveIntensity: 0.25 });
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      const n = 4 + rng.int(3);
      for (let k = 0; k < n; k++) {
        const puff = mesh(new THREE.IcosahedronGeometry(2 + rng.next() * 1.8, 0), cloudMat, false);
        puff.position.set(k * 2.4 - n, rng.next() * 1.2, (rng.next() - 0.5) * 2);
        g.add(puff);
      }
      g.position.set(-80 + rng.next() * 160, 32 + rng.next() * 12, -70 + rng.next() * 100);
      s.add(g);
      this.clouds.push(g);
    }

    s.add(this.miner.group, this.smoke.group);
  }

  private tree(x: number, z: number, v: number): void {
    const g = new THREE.Group();
    const trunk = mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.4, 6), std(0x7a4f2a));
    trunk.position.y = 0.7;
    const green = [0x3e9b40, 0x2f8a3a, 0x57ad45][Math.floor(v * 3)] ?? 0x3e9b40;
    const c1 = mesh(new THREE.ConeGeometry(1.4, 2.4, 7), std(green));
    c1.position.y = 2.2;
    const c2 = mesh(new THREE.ConeGeometry(1, 1.8, 7), std(green));
    c2.position.y = 3.3;
    g.add(trunk, c1, c2);
    g.position.set(x, 0, z);
    g.scale.setScalar(0.85 + v * 0.5);
    g.userData.phase = v * 10;
    this.scene.add(g);
    this.trees.push(g);
  }

  private building(b: Building): void {
    const g = new THREE.Group();
    // Build in a local frame where +z faces the door, sized to the collision box.
    const dx = b.door.x - b.x;
    const dz = b.door.z - b.z;
    const doorYaw = Math.atan2(dx, dz);
    const alongX = Math.abs(dx) > Math.abs(dz);
    const w = (alongX ? b.hd : b.hw) * 2;
    const d = (alongX ? b.hw : b.hd) * 2;

    if (b.id === 'minehead') {
      const timber = std(0x8b5a2b);
      const base = mesh(new THREE.BoxGeometry(w, 2.4, d), std(0x6b6f76));
      base.position.y = 1.2;
      g.add(base);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const leg = mesh(new THREE.BoxGeometry(0.35, 9, 0.35), timber);
          leg.position.set(sx * 1.6, 6.5, sz * 1.2);
          leg.rotation.z = -sx * 0.12;
          g.add(leg);
        }
      }
      const top = mesh(new THREE.BoxGeometry(3, 0.4, 3), timber);
      top.position.y = 10.8;
      g.add(top);
      this.wheel = mesh(new THREE.TorusGeometry(1.3, 0.14, 6, 18), std(0x444a52, { metalness: 0.5, roughness: 0.4 }));
      this.wheel.position.y = 11.8;
      g.add(this.wheel);
      const spokeA = mesh(new THREE.BoxGeometry(2.6, 0.1, 0.1), std(0x444a52));
      const spokeB = mesh(new THREE.BoxGeometry(0.1, 2.6, 0.1), std(0x444a52));
      this.wheel.add(spokeA, spokeB);
    } else {
      const wallColor = b.id === 'assay' ? 0x4f86c6 : b.id === 'smelter' ? 0x8d8f94 : 0xc2553a;
      const roofColor = b.id === 'assay' ? 0x23466e : b.id === 'smelter' ? 0x4a4c50 : 0x6e2b1d;
      const body = mesh(new THREE.BoxGeometry(w, 3.2, d), std(wallColor));
      body.position.y = 1.6;
      const roof = mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.3, 2, 4), std(roofColor));
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(w / Math.hypot(w, d) * 1.45, 1, d / Math.hypot(w, d) * 1.45);
      roof.position.y = 4.2;
      g.add(body, roof);
      // Windows.
      for (const side of [-1, 1]) {
        const win = mesh(new THREE.BoxGeometry(0.9, 0.8, 0.05), std(0xbfe8ff, { emissive: 0x3a5f7a, emissiveIntensity: 0.4 }), false);
        win.position.set(side * (w / 2 - 1.1), 2, d / 2 + 0.03);
        g.add(win);
      }
      if (b.id === 'smelter') {
        const chimney = mesh(new THREE.CylinderGeometry(0.45, 0.55, 3.5, 8), std(0x6b4a3a));
        chimney.position.set(-w / 4, 4.6, -d / 4);
        chimney.userData.smoke = true;
        g.add(chimney);
      }
    }
    // Door on the face toward the plaza.
    const door = mesh(new THREE.BoxGeometry(1.3, 2.1, 0.12), std(0x4a2d17), false);
    const local = new THREE.Vector3(0, 1.05, 0);
    g.add(door);
    g.position.set(b.x, 0, b.z);
    g.rotation.y = doorYaw;
    door.position.copy(local).setZ(d / 2 + 0.05);
    this.scene.add(g);
    g.updateMatrixWorld(true);
    g.traverse((o) => {
      if (o.userData.smoke === true) { o.getWorldPosition(this.smokeAt); this.smokeAt.y += 1.9; }
    });

    const sign = label(b.name);
    sign.position.set(b.door.x, b.id === 'minehead' ? 4 : 4.2, b.door.z);
    this.scene.add(sign);
  }

  update(dt: number, pos: Vec2, facing: number, moving: boolean, rig: CameraRig): void {
    this.t += dt;
    this.miner.group.position.set(pos.x, 0, pos.z);
    this.miner.update(dt, moving, false, facing);
    for (const tr of this.trees) tr.rotation.z = Math.sin(this.t * 1.3 + (tr.userData.phase as number)) * 0.03;
    for (const cl of this.clouds) {
      cl.position.x += dt * 1.2;
      if (cl.position.x > 90) cl.position.x = -90;
    }
    if (this.wheel) this.wheel.rotation.z += dt * 0.8;

    this.smokeTimer -= dt;
    if (this.smokeTimer <= 0 && this.smokeAt.lengthSq() > 0) {
      this.smoke.emit(this.smokeAt, 0xdddddd, 1, { speed: 0.4, up: 1.2, gravity: -0.3, life: 3.5, size: 4, grow: 0.5 });
      this.smokeTimer = 0.25;
    }
    this.smoke.update(dt);

    this.rippleTimer -= dt;
    if (this.rippleTimer <= 0) {
      const r = this.ripples.find((x) => !x.m.visible);
      if (r) {
        const a = Math.random() * 6.28;
        const d = Math.random() * (TOWN.POND.r - 1.2);
        r.m.position.set(TOWN.POND.x + Math.cos(a) * d, 0.07, TOWN.POND.z + Math.sin(a) * d);
        r.age = 0;
        r.m.visible = true;
      }
      this.rippleTimer = 0.9;
    }
    for (const r of this.ripples) {
      if (!r.m.visible) continue;
      r.age += dt;
      const k = r.age / 2;
      if (k >= 1) { r.m.visible = false; continue; }
      r.m.scale.setScalar(0.2 + k * 1.2);
      (r.m.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.6;
    }
    rig.update(dt, new THREE.Vector3(pos.x, 0.8, pos.z));
  }
}
