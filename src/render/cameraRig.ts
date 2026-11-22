import * as THREE from 'three';

/** Third-person follow camera: angled down, rotates in 90° steps, can shake. */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  /** Current (smoothed) yaw in radians. 0 = camera south of the player looking north. */
  yaw = 0;
  private yawTarget = 0;
  private shake = 0;
  private readonly pos = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  distance = 7;
  height = 10;

  rotate(steps: number): void {
    this.yawTarget += (steps * Math.PI) / 2;
  }

  addShake(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  private desired(target: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(
      target.x + Math.sin(this.yaw) * this.distance,
      target.y + this.height,
      target.z + Math.cos(this.yaw) * this.distance,
    );
  }

  snap(target: THREE.Vector3): void {
    this.yaw = this.yawTarget;
    this.pos.copy(this.desired(target));
    this.look.copy(target);
  }

  update(dt: number, target: THREE.Vector3): void {
    this.yaw += (this.yawTarget - this.yaw) * Math.min(1, dt * 8);
    const k = 1 - Math.exp(-dt * 7);
    this.pos.lerp(this.desired(target), k);
    this.look.lerp(target, k);
    this.camera.position.copy(this.pos);
    if (this.shake > 0) {
      const s = this.shake * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 1.2);
    }
    this.camera.lookAt(this.look);
  }

  /** World-space (x, z) for screen-relative input: forward = away from camera. */
  toWorld(right: number, forward: number): { x: number; z: number } {
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    return { x: right * c - forward * s, z: -right * s - forward * c };
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
