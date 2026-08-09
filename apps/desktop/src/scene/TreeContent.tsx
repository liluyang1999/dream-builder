/** Assembles the central tree. The trunk stays fixed so gameplay collision is stable. */
import type { TreeScene } from '@dream-builder/ipc-contracts';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { useAppStore } from '../state/store';
import { Branches } from './Branches';
import { CrystalMesh } from './CrystalMesh';
import { GroundHalo } from './GroundHalo';
import { LeafClusterMesh } from './LeafClusterMesh';
import { RuneSprite } from './RuneSprite';

import { damp } from './sceneHelpers';

export function TreeContent({
  scene,
  reducedMotion,
}: { scene: TreeScene; reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const treeStage = useAppStore((state) => state.progress.treeStage);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const targetScale = treeStage === 1 ? 1.16 : 1;
    group.scale.y = reducedMotion ? targetScale : damp(group.scale.y, targetScale, 3.2, delta);
  });

  return (
    <group ref={groupRef}>
      <Branches branches={scene.branches} barkColor={scene.palette.bark} />
      {scene.leafClusters.map((cluster) => (
        <LeafClusterMesh key={cluster.id} cluster={cluster} leafColor={scene.palette.leaves} />
      ))}
      {scene.runes.map((rune) => (
        <RuneSprite key={rune.id} rune={rune} glowColor={scene.palette.glow} />
      ))}
      {scene.crystals.map((crystal) => (
        <CrystalMesh key={crystal.id} crystal={crystal} crystalColor={scene.palette.crystal} />
      ))}
      <GroundHalo />
    </group>
  );
}
