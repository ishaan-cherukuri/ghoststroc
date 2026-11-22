import * as THREE from 'three';
import { MINER_COLORS } from './palette';

// Placeholder miner built from primitives. Swap this file for a loaded model
// later; the rest of the game only uses `group` and `update()`.

const mat = (color: number): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color, flatShading: true });

function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}

/** A limb that pivots at its top. */
function limb(w: number, h: number, color: number, footColor?: number): THREE.Group {
  const g = new THREE.Group();
  const m = box(w, h, w, color);
  m.position.y = -h / 2;
  g.add(m);
  if (footColor !== undefined) {
    const foot = box(w * 1.1, 0.12, w * 1.5, footColor);
    foot.position.set(0, -h + 0.04, 0.06);
    g.add(foot);
  }
  return g;
}

export class Miner {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly legL: THREE.Group;
  private readonly legR: THREE.Group;
  private readonly armL: THREE.Group;
  private readonly armR: THREE.Group;
  private readonly head = new THREE.Group();
  /** Where the helmet lamp sits, for attaching a light. */
  readonly lampAnchor = new THREE.Object3D();
  private t = 0;
  private swing = 0;
  private walkBlend = 0;
  private facing = 0;

  constructor() {
    this.group.add(this.body);

    this.legL = limb(0.2, 0.62, MINER_COLORS.overalls, MINER_COLORS.boots);
    this.legR = limb(0.2, 0.62, MINER_COLORS.overalls, MINER_COLORS.boots);
    this.legL.position.set(-0.13, 0.66, 0);
    this.legR.position.set(0.13, 0.66, 0);

    const torso = box(0.52, 0.62, 0.3, MINER_COLORS.overalls);
    torso.position.y = 0.98;
    const chest = box(0.54, 0.24, 0.32, MINER_COLORS.shirt);
    chest.position.y = 1.2;

    this.armL = limb(0.15, 0.56, MINER_COLORS.shirt);
    this.armR = limb(0.15, 0.56, MINER_COLORS.shirt);
    this.armL.position.set(-0.35, 1.28, 0);
    this.armR.position.set(0.35, 1.28, 0);
    const handL = box(0.15, 0.12, 0.15, MINER_COLORS.skin);
    handL.position.y = -0.6;
    this.armL.add(handL);
    const handR = box(0.15, 0.12, 0.15, MINER_COLORS.skin);
    handR.position.y = -0.6;
    this.armR.add(handR);

    // Pickaxe in the right hand.
    const pick = new THREE.Group();
    const handle = box(0.06, 0.06, 0.8, MINER_COLORS.handle);
    handle.position.z = 0.3;
    const headM = box(0.5, 0.08, 0.08, MINER_COLORS.pickHead);
    headM.position.z = 0.68;
    pick.add(handle, headM);
    pick.position.y = -0.6;
    this.armR.add(pick);

    const face = box(0.36, 0.34, 0.32, MINER_COLORS.skin);
    face.position.y = 0.17;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(MINER_COLORS.helmet));
    helmet.position.y = 0.3;
    helmet.castShadow = true;
    const brim = box(0.5, 0.04, 0.5, MINER_COLORS.helmet);
    brim.position.y = 0.3;
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), new THREE.MeshBasicMaterial({ color: 0xffe9b0 }));
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(0, 0.4, 0.22);
    this.lampAnchor.position.set(0, 0.42, 0.3);
    this.head.add(face, helmet, brim, lamp, this.lampAnchor);
    this.head.position.y = 1.32;

    this.body.add(this.legL, this.legR, torso, chest, this.armL, this.armR, this.head);
  }

  /** Smoothly animate. `facing` in radians (0 = +z). */
  update(dt: number, moving: boolean, mining: boolean, facing: number): void {
    this.t += dt;
    let diff = facing - this.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.facing += diff * Math.min(1, dt * 14);
    this.group.rotation.y = this.facing;

    this.walkBlend += ((moving ? 1 : 0) - this.walkBlend) * Math.min(1, dt * 10);
    const w = Math.sin(this.t * 11) * 0.7 * this.walkBlend;
    this.legL.rotation.x = w;
    this.legR.rotation.x = -w;
    this.armL.rotation.x = -w * 0.8;
    this.body.position.y = Math.abs(Math.sin(this.t * 11)) * 0.06 * this.walkBlend + Math.sin(this.t * 2) * 0.01;

    if (mining) {
      this.swing += dt * 7.5;
      // Wind up over the head, then strike down.
      const ph = this.swing % (Math.PI * 2);
      this.armR.rotation.x = ph < Math.PI ? -2.6 * Math.sin(ph / 2) : -2.6 + (ph - Math.PI) * 0.95;
      this.body.rotation.x = Math.sin(ph) * 0.08;
    } else {
      this.swing = 0;
      this.armR.rotation.x += (w * 0.8 - this.armR.rotation.x) * Math.min(1, dt * 12);
      this.body.rotation.x *= 0.85;
    }
    this.head.rotation.y = Math.sin(this.t * 0.7) * 0.08 * (1 - this.walkBlend);
  }
}
