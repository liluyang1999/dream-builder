import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { RestorationNodeState } from '../game/gameProgress';
import type { Vec2 } from '../game/playerMotion';
import { damp } from './sceneHelpers';

export function RestorationNode({
  position,
  state,
  reducedMotion,
}: { position: Vec2; state: RestorationNodeState; reducedMotion: boolean }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, delta) => {
    const core = coreRef.current;
    const ring = ringRef.current;
    if (!core || !ring) return;
    const material = core.material as THREE.MeshStandardMaterial;
    const targetIntensity =
      state === 'restored' ? 4 : state === 'cleansing' ? 3.2 : state === 'ready' ? 2.4 : 0.15;
    material.emissiveIntensity = damp(material.emissiveIntensity, targetIntensity, 7, delta);
    if (!reducedMotion) {
      ring.rotation.z += delta * (state === 'cleansing' ? 1.5 : state === 'ready' ? 0.9 : 0.2);
      core.position.y =
        0.58 + Math.sin(clock.elapsedTime * 2.2) * (state === 'dormant' ? 0.01 : 0.06);
    }
  });

  const color =
    state === 'restored'
      ? '#7df0bd'
      : state === 'cleansing'
        ? '#b99cff'
        : state === 'ready'
          ? '#f7c76b'
          : '#435553';
  return (
    <group position={[position.x, 0, position.z]} name="restoration-node">
      <mesh ref={coreRef} position={[0, 0.58, 0]}>
        <dodecahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.15}
          roughness={0.5}
        />
      </mesh>
      <mesh ref={ringRef} position={[0, 0.58, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.62, 0.045, 10, 36]} />
        <meshBasicMaterial color={color} transparent opacity={state === 'dormant' ? 0.28 : 0.82} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <ringGeometry args={[0.58, 0.82, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.32} side={THREE.DoubleSide} />
      </mesh>
      {state !== 'dormant' ? <pointLight color={color} intensity={2.8} distance={5} /> : null}
    </group>
  );
}
