import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import type { LightSeedState } from '../game/gameProgress';
import type { Vec2 } from '../game/playerMotion';
import { damp } from './sceneHelpers';

export function LightSeed({
  position,
  state,
  reducedMotion,
}: { position: Vec2; state: LightSeedState; reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const visibleScale = state === 'revealed' ? 1 : 0;
    group.scale.setScalar(damp(group.scale.x, visibleScale, 10, delta));
    if (!reducedMotion && state === 'revealed') {
      group.position.y = 0.65 + Math.sin(clock.elapsedTime * 2.8 + position.x) * 0.11;
      group.rotation.y += delta * 0.9;
    } else {
      group.position.y = 0.65;
    }
  });

  if (state === 'hidden') return null;

  return (
    <group
      ref={groupRef}
      position={[position.x, 0.65, position.z]}
      scale={state === 'collected' ? 1 : 0}
    >
      <mesh>
        <octahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial
          color="#fff0a6"
          emissive="#f7c76b"
          emissiveIntensity={2.8}
          roughness={0.32}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.31, 0.025, 8, 28]} />
        <meshBasicMaterial color="#7df0bd" transparent opacity={0.75} />
      </mesh>
      <pointLight color="#f7c76b" intensity={2.2} distance={3.2} />
    </group>
  );
}
