import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import type { Vec2 } from '../game/playerMotion';

export function CheckpointMarker({
  position,
  active,
  reducedMotion,
}: { position: Vec2; active: boolean; reducedMotion: boolean }) {
  const runeRef = useRef<THREE.Mesh>(null);
  const color = active ? '#7df0bd' : '#42665b';

  useFrame(({ clock }) => {
    const rune = runeRef.current;
    if (!rune || reducedMotion || !active) return;
    rune.rotation.z = Math.sin(clock.elapsedTime * 0.65) * 0.08;
  });

  return (
    <group position={[position.x, 0, position.z]} name="forest-checkpoint">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.34, 0.48, 20]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.78 : 0.24} />
      </mesh>
      <mesh ref={runeRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.026, 0]}>
        <torusGeometry args={[0.19, 0.025, 6, 6]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.92 : 0.32} />
      </mesh>
      {active ? (
        <pointLight color={color} intensity={0.85} distance={2.2} position={[0, 0.3, 0]} />
      ) : null}
    </group>
  );
}
