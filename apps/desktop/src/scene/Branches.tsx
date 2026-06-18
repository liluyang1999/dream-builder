/** Tree branches: tapered cylinders oriented along each segment. */
import type { BranchSegment } from '@dream-builder/ipc-contracts';
import { useMemo } from 'react';
import * as THREE from 'three';
import { branchTransform } from './sceneHelpers';

export function Branches({
  branches,
  barkColor,
}: { branches: BranchSegment[]; barkColor: string }) {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(barkColor),
        roughness: 0.74,
        metalness: 0.04,
        emissive: new THREE.Color('#241007'),
        emissiveIntensity: 0.08,
      }),
    [barkColor],
  );

  return (
    <group>
      {branches.map((branch) => {
        const { position, quaternion, height } = branchTransform(branch);
        return (
          <mesh key={branch.id} position={position} quaternion={quaternion} material={material}>
            <cylinderGeometry args={[branch.radiusEnd, branch.radiusStart, height, 10, 4, false]} />
          </mesh>
        );
      })}
    </group>
  );
}
