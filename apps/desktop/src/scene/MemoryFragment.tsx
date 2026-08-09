import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import type { Vec2 } from '../game/playerMotion';

export function MemoryFragment({
  position,
  read,
  reducedMotion,
}: { position: Vec2; read: boolean; reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;
    if (!reducedMotion) {
      group.position.y = 0.62 + Math.sin(clock.elapsedTime * 1.8 + position.z) * 0.06;
      group.rotation.y += delta * (read ? 0.08 : 0.3);
    }
  });

  const color = read ? '#6b8f82' : '#b99cff';
  return (
    <group ref={groupRef} position={[position.x, 0.62, position.z]} name="memory-fragment">
      <mesh castShadow>
        <dodecahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={read ? 0.6 : 2.2}
          roughness={0.46}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.39, 0.018, 7, 32]} />
        <meshBasicMaterial color="#7df0bd" transparent opacity={read ? 0.26 : 0.72} />
      </mesh>
      {!read ? <pointLight color={color} intensity={1.7} distance={3} /> : null}
    </group>
  );
}
