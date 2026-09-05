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
import { advanceMagicParticlePositions } from './magicParticleMotion';

const COUNT = 260;

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
    advanceMagicParticlePositions(positions, phases, elapsed, delta, field, selectedId !== null);

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
