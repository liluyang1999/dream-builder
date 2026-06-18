import * as THREE from 'three';
import type { MagicField, MagicPulse, TreeScene } from '../types/tree';

const PULSE_RANGE_MULTIPLIER = 1.6;
const PULSE_FORCE_SCALE = 0.012;
const WIND_SCALE = 0.012;

export class MagicParticles {
  readonly points: THREE.Points;

  private readonly positions: Float32Array;
  private readonly phases: Float32Array;
  private readonly positionAttribute: THREE.BufferAttribute;
  private readonly wind = new THREE.Vector3();
  private pulses: MagicPulse[] = [];

  constructor(scene: THREE.Scene, tree: TreeScene) {
    const count = 260;
    this.positions = new Float32Array(count * 3);
    this.phases = new Float32Array(count);

    const rng = createSeedRng(tree.seed);
    for (let index = 0; index < count; index += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = 0.55 + rng() * 2.55;
      this.positions[index * 3] = Math.cos(angle) * radius;
      this.positions[index * 3 + 1] = 0.32 + rng() * 3.85;
      this.positions[index * 3 + 2] = Math.sin(angle) * radius;
      this.phases[index] = rng() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    this.positionAttribute = new THREE.BufferAttribute(this.positions, 3);
    geometry.setAttribute('position', this.positionAttribute);

    const material = new THREE.PointsMaterial({
      color: new THREE.Color(tree.palette.glow),
      size: 0.035,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.name = 'magic-particles';
    scene.add(this.points);
  }

  applyField(field: MagicField): void {
    this.wind.set(field.wind.x, field.wind.y, field.wind.z);
    this.pulses = field.pulses;
  }

  update(elapsed: number, selectedId: string | null): void {
    const baseAttraction = selectedId ? 0.018 : 0.008;
    const windX = this.wind.x * WIND_SCALE;
    const windY = this.wind.y * WIND_SCALE;
    const windZ = this.wind.z * WIND_SCALE;
    const hasPulses = this.pulses.length > 0;

    for (let index = 0; index < this.phases.length; index += 1) {
      const offset = index * 3;
      const phase = (this.phases[index] ?? 0) + elapsed * (0.35 + (index % 7) * 0.018);
      let dx = Math.sin(phase) * baseAttraction + windX;
      let dy = Math.cos(phase * 0.7) * 0.004 + windY;
      let dz = Math.cos(phase) * baseAttraction + windZ;

      const x = this.positions[offset] ?? 0;
      const y = this.positions[offset + 1] ?? 0;
      const z = this.positions[offset + 2] ?? 0;

      if (hasPulses) {
        for (const pulse of this.pulses) {
          const pdx = pulse.center.x - x;
          const pdy = pulse.center.y - y;
          const pdz = pulse.center.z - z;
          const dist = Math.hypot(pdx, pdy, pdz);
          const reach = pulse.radius * PULSE_RANGE_MULTIPLIER;
          if (dist > 0 && dist < reach) {
            const falloff = 1 - dist / reach;
            const force = falloff * pulse.strength * PULSE_FORCE_SCALE;
            const inv = force / dist;
            dx += pdx * inv;
            dy += pdy * inv;
            dz += pdz * inv;
          }
        }
      }

      let nx = x + dx;
      const ny = y + dy;
      let nz = z + dz;

      const planar = Math.hypot(nx, nz);
      if (planar > 3.4) {
        nx *= 0.92;
        nz *= 0.92;
      }

      this.positions[offset] = nx;
      this.positions[offset + 1] = ny > 4.6 ? 0.28 : ny;
      this.positions[offset + 2] = nz;
    }
    this.positionAttribute.needsUpdate = true;
    this.points.rotation.y = elapsed * 0.025;
  }

  dispose(): void {
    this.points.geometry.dispose();
    const material = this.points.material;
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
    } else {
      material.dispose();
    }
    this.points.removeFromParent();
  }
}

function createSeedRng(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}
