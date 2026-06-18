/**
 * Floating magic particles, simulated per-frame in `useFrame`.
 *
 * The latest backend magic field arrives via a mutable ref (`fieldRef`) updated
 * by the App's event subscription — so the render loop reads it without React
 * re-renders. Wind biases drift; pulses tug nearby particles toward centers.
 */
import type { MagicField, TreeScene } from '@dream-builder/ipc-contracts';
import { useFrame } from '@react-three/fiber';
import { type RefObject, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../state/store';

const COUNT = 260;
const PULSE_RANGE_MULTIPLIER = 1.6;
const PULSE_FORCE_SCALE = 0.012;
const WIND_SCALE = 0.012;

interface Props {
  scene: TreeScene;
  reducedMotion: boolean;
  fieldRef: RefObject<MagicField | null>;
}

export function MagicParticles({ scene, reducedMotion, fieldRef }: Props) {
  const pointsRef = useRef<THREE.Points>(null);
  const selectedId = useAppStore((state) => state.selection.selectedId);

  const { positions, phases, geometry, material, positionAttribute } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const phases = new Float32Array(COUNT);
    const rng = createSeedRng(scene.seed);
    for (let index = 0; index < COUNT; index += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = 0.55 + rng() * 2.55;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = 0.32 + rng() * 3.85;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
      phases[index] = rng() * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry();
    const positionAttribute = new THREE.BufferAttribute(positions, 3);
    geometry.setAttribute('position', positionAttribute);
    const material = new THREE.PointsMaterial({
      color: new THREE.Color(scene.palette.glow),
      size: 0.035,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return { positions, phases, geometry, material, positionAttribute };
  }, [scene.seed, scene.palette.glow]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state, delta) => {
    const points = pointsRef.current;
    if (!points || reducedMotion) return;
    const elapsed = state.clock.elapsedTime;
    const field = fieldRef.current;
    const baseAttraction = selectedId ? 0.018 : 0.008;
    const windX = (field?.wind.x ?? 0) * WIND_SCALE;
    const windY = (field?.wind.y ?? 0) * WIND_SCALE;
    const windZ = (field?.wind.z ?? 0) * WIND_SCALE;
    const pulses = field?.pulses ?? [];

    for (let index = 0; index < COUNT; index += 1) {
      const offset = index * 3;
      const phase = (phases[index] ?? 0) + elapsed * (0.35 + (index % 7) * 0.018);
      let dx = Math.sin(phase) * baseAttraction + windX;
      let dy = Math.cos(phase * 0.7) * 0.004 + windY;
      let dz = Math.cos(phase) * baseAttraction + windZ;

      const x = positions[offset] ?? 0;
      const y = positions[offset + 1] ?? 0;
      const z = positions[offset + 2] ?? 0;

      for (const pulse of pulses) {
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

      let nx = x + dx;
      const ny = y + dy;
      let nz = z + dz;
      if (Math.hypot(nx, nz) > 3.4) {
        nx *= 0.92;
        nz *= 0.92;
      }
      positions[offset] = nx;
      positions[offset + 1] = ny > 4.6 ? 0.28 : ny;
      positions[offset + 2] = nz;
    }

    positionAttribute.needsUpdate = true;
    points.rotation.y = elapsed * 0.025;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

function createSeedRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}
