/** Pure helpers shared by the R3F scene components. */
import type { BranchSegment, Vec3 } from '@dream-builder/ipc-contracts';
import * as THREE from 'three';

/** Deterministic FNV-seeded RNG keyed by a string (stable leaf scatter). */
export function createHashRng(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function toVector3(vec: Vec3): THREE.Vector3 {
  return new THREE.Vector3(vec.x, vec.y, vec.z);
}

export interface BranchTransform {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  height: number;
}

/** Midpoint position + orientation that aligns a Y-up cylinder along the branch. */
export function branchTransform(branch: BranchSegment): BranchTransform {
  const start = toVector3(branch.start);
  const end = toVector3(branch.end);
  const direction = new THREE.Vector3().subVectors(end, start);
  const height = Math.max(direction.length(), 0.001);
  const position = start.clone().add(end).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  );
  const twist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), branch.twist);
  quaternion.multiply(twist);
  return { position, quaternion, height };
}

/** Draw a glowing rune glyph onto a canvas texture. */
export function createGlyphTexture(glyph: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('无法创建符文纹理。');
  }
  context.clearRect(0, 0, 128, 128);
  context.shadowColor = color;
  context.shadowBlur = 22;
  context.strokeStyle = color;
  context.lineWidth = 8;
  context.beginPath();
  context.arc(64, 64, 42, 0, Math.PI * 2);
  context.stroke();
  context.font = '700 58px serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#fff3bd';
  context.fillText(glyph, 64, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Smoothly approach a target value (frame-rate-aware-ish lerp). */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
