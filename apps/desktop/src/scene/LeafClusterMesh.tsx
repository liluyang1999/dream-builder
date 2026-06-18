/** A leaf cluster: an instanced mesh of scattered leaves, interactive as a unit. */
import type { LeafCluster } from '@dream-builder/ipc-contracts';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useInteractive } from '../interaction/useInteractive';
import { createHashRng, damp } from './sceneHelpers';

export function LeafClusterMesh({
  cluster,
  leafColor,
}: { cluster: LeafCluster; leafColor: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { hovered, selected, handlers } = useInteractive(cluster.id);

  const count = Math.min(Math.max(cluster.density, 6), 64);
  const color = useMemo(() => new THREE.Color().setHSL(cluster.hue, 0.62, 0.42), [cluster.hue]);
  const emissive = useMemo(() => new THREE.Color(leafColor), [leafColor]);

  const matrices = useMemo(() => {
    const rng = createHashRng(cluster.id);
    const list: THREE.Matrix4[] = [];
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const euler = new THREE.Euler();
    for (let index = 0; index < count; index += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = Math.cbrt(rng()) * cluster.radius;
      position.set(
        cluster.position.x + Math.cos(angle) * radius,
        cluster.position.y + (rng() - 0.5) * cluster.radius * 0.78,
        cluster.position.z + Math.sin(angle) * radius,
      );
      euler.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
      quaternion.setFromEuler(euler);
      const leafScale = 0.8 + rng() * 1.9;
      scale.set(leafScale * 1.4, leafScale * 0.62, leafScale);
      list.push(new THREE.Matrix4().compose(position, quaternion, scale));
    }
    return list;
  }, [
    cluster.id,
    cluster.position.x,
    cluster.position.y,
    cluster.position.z,
    cluster.radius,
    count,
  ]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    const mesh = meshRef.current;
    if (!group || !mesh) return;
    const targetScale = selected ? 1.18 : hovered ? 1.1 : 1;
    group.scale.setScalar(damp(group.scale.x, targetScale, 9, delta));
    const material = mesh.material as THREE.MeshStandardMaterial;
    const targetEmissive = selected ? 0.5 : hovered ? 0.3 : 0.12;
    material.emissiveIntensity = damp(material.emissiveIntensity, targetEmissive, 9, delta);
  });

  return (
    <group ref={groupRef} {...handlers}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <icosahedronGeometry args={[0.08, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={0.12}
          roughness={0.58}
        />
      </instancedMesh>
    </group>
  );
}
