/** A crystal: an emissive octahedron + point light; pulses on hover/select. */
import type { CrystalCluster } from '@dream-builder/ipc-contracts';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useInteractive } from '../interaction/useInteractive';
import { damp, toVector3 } from './sceneHelpers';

export function CrystalMesh({
  crystal,
  crystalColor,
}: { crystal: CrystalCluster; crystalColor: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const { hovered, selected, handlers } = useInteractive(crystal.id);

  const color = useMemo(() => new THREE.Color().setHSL(crystal.hue, 0.72, 0.58), [crystal.hue]);
  const emissive = useMemo(() => new THREE.Color(crystalColor), [crystalColor]);
  const position = useMemo(() => toVector3(crystal.position), [crystal.position]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    const mesh = meshRef.current;
    const light = lightRef.current;
    if (!group || !mesh || !light) return;
    const targetScale = selected ? 1.18 : hovered ? 1.1 : 1;
    group.scale.setScalar(damp(group.scale.x, targetScale, 9, delta));
    const material = mesh.material as THREE.MeshStandardMaterial;
    const targetEmissive = selected ? 1.4 : hovered ? 1.0 : 0.72;
    material.emissiveIntensity = damp(material.emissiveIntensity, targetEmissive, 9, delta);
    light.intensity = damp(light.intensity, selected ? 1.6 : hovered ? 1.1 : 0.8, 9, delta);
  });

  return (
    <group ref={groupRef} position={position} {...handlers}>
      <mesh ref={meshRef} rotation={[0.4, 0.2, -0.2]}>
        <octahedronGeometry args={[crystal.scale, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={0.72}
          roughness={0.18}
          metalness={0.08}
        />
      </mesh>
      <pointLight ref={lightRef} color={crystalColor} intensity={0.8} distance={1.8} />
    </group>
  );
}
