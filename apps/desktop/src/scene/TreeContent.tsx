/** Assembles the full tree and rotates it gently (unless reduced-motion). */
import type { TreeScene } from '@dream-builder/ipc-contracts';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { Branches } from './Branches';
import { CrystalMesh } from './CrystalMesh';
import { GroundHalo } from './GroundHalo';
import { LeafClusterMesh } from './LeafClusterMesh';
import { RuneSprite } from './RuneSprite';

export function TreeContent({
  scene,
  reducedMotion,
}: { scene: TreeScene; reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!reducedMotion && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.048;
    }
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
