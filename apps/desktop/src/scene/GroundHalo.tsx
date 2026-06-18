/** Soft additive ring on the ground beneath the tree. */
import * as THREE from 'three';

export function GroundHalo() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
      <ringGeometry args={[0.72, 2.2, 96]} />
      <meshBasicMaterial
        color={0x37d6b0}
        transparent
        opacity={0.08}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}
