import * as THREE from 'three';

/** Rings that radiate outward from the miner while a lamp charges. */
export class PulseRings {
  readonly group = new THREE.Group();
  private readonly rings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; age: number; life: number; max: number }[] = [];

  constructor() {
    const geo = new THREE.RingGeometry(0.92, 1, 64);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push({ mesh, mat, age: 0, life: 1, max: 1 });
    }
  }

  spawn(color: number, at: THREE.Vector3, maxRadius: number, life = 1.3): void {
    const r = this.rings.find((x) => !x.mesh.visible) ?? this.rings[0];
    if (!r) return;
    r.mat.color.setHex(color);
    r.mesh.position.set(at.x, 0.08, at.z);
    r.age = 0;
    r.life = life;
    r.max = maxRadius;
    r.mesh.visible = true;
  }

  update(dt: number): void {
    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.age += dt;
      const k = r.age / r.life;
      if (k >= 1) { r.mesh.visible = false; continue; }
      const s = 0.3 + (r.max - 0.3) * (1 - (1 - k) ** 2);
      r.mesh.scale.set(s, 1, s);
      r.mat.opacity = (1 - k) * 0.9;
    }
  }
}

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  age: number;
  gravity: number;
  grow: number;
}

/** Pooled particles: rock chips, dust, smoke. */
export class Particles {
  readonly group = new THREE.Group();
  private readonly pool: Particle[] = [];

  constructor(size = 160, lit = true) {
    const geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    for (let i = 0; i < size; i++) {
      const mat = lit
        ? new THREE.MeshLambertMaterial({ transparent: true })
        : new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({ mesh, vel: new THREE.Vector3(), life: 1, age: 0, gravity: 9, grow: 0 });
    }
  }

  emit(at: THREE.Vector3, color: THREE.Color | number, n: number, opts: { speed?: number; up?: number; life?: number; gravity?: number; size?: number; grow?: number } = {}): void {
    let made = 0;
    for (const p of this.pool) {
      if (made >= n) break;
      if (p.mesh.visible) continue;
      made++;
      const m = p.mesh.material as THREE.MeshLambertMaterial;
      m.color.set(color);
      m.opacity = 1;
      p.mesh.position.copy(at);
      const sp = opts.speed ?? 2.5;
      p.vel.set((Math.random() - 0.5) * sp, (opts.up ?? 2) * (0.5 + Math.random()), (Math.random() - 0.5) * sp);
      p.life = (opts.life ?? 0.7) * (0.7 + Math.random() * 0.6);
      p.age = 0;
      p.gravity = opts.gravity ?? 9;
      p.grow = opts.grow ?? 0;
      p.mesh.scale.setScalar(opts.size ?? 1);
      p.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      p.mesh.visible = true;
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.mesh.visible) continue;
      p.age += dt;
      if (p.age >= p.life) { p.mesh.visible = false; continue; }
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.05 && p.gravity > 0) { p.mesh.position.y = 0.05; p.vel.multiplyScalar(0.4); p.vel.y = Math.abs(p.vel.y) * 0.3; }
      p.mesh.rotation.x += dt * 4;
      if (p.grow) p.mesh.scale.multiplyScalar(1 + p.grow * dt);
      (p.mesh.material as THREE.MeshLambertMaterial).opacity = 1 - p.age / p.life;
    }
  }
}
