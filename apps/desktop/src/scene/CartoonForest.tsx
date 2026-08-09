import type { GraphicsQuality } from '@dream-builder/ipc-contracts';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  FOREST_OBSTACLES,
  FOREST_PATHS,
  type ForestObstacle,
  LIGHT_SEED_PLACEMENTS,
  MEMORY_FRAGMENT_PLACEMENT,
  RESTORATION_NODE,
} from '../game/forestLayout';
import { useAppStore } from '../state/store';

interface InstanceTransform {
  x: number;
  y: number;
  z: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

export interface ForestDecorations {
  grass: InstanceTransform[];
  shrubs: InstanceTransform[];
  stones: InstanceTransform[];
  flowers: InstanceTransform[];
}

export function CartoonForest({ seed, quality }: { seed: number; quality: GraphicsQuality }) {
  const restored = useAppStore((state) => state.progress.nodeState === 'restored');
  const decorations = useMemo(() => createForestDecorations(seed, quality), [seed, quality]);
  const castDecorativeShadows = quality === 'high';

  return (
    <group name="cartoon-forest">
      <ForestGround restored={restored} />
      {FOREST_PATHS.map((path) => (
        <PathStrip key={path.id} {...path} restored={restored} />
      ))}
      <RootVeins restored={restored} />
      {FOREST_OBSTACLES.map((obstacle) => (
        <ObstacleMesh key={obstacle.id} obstacle={obstacle} restored={restored} />
      ))}
      <BoundaryForest restored={restored} castShadow={castDecorativeShadows} />
      <InstancedFlora
        decorations={decorations}
        restored={restored}
        castShadow={castDecorativeShadows}
      />
      <MushroomGrove restored={restored} />
      <CreekLandmark restored={restored} />
      <RuinGate restored={restored} />
    </group>
  );
}

function ForestGround({ restored }: { restored: boolean }) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 24, 1, 1]} />
        <meshToonMaterial color={restored ? '#4f875e' : '#294e43'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
        <circleGeometry args={[4.35, 48]} />
        <meshToonMaterial color={restored ? '#6c9a62' : '#385e4b'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-5.8, 0.008, 1.8]} receiveShadow>
        <circleGeometry args={[2.25, 32]} />
        <meshToonMaterial color={restored ? '#577d50' : '#324f43'} />
      </mesh>
    </>
  );
}

function PathStrip({
  from,
  to,
  width,
  tone,
  restored,
}: (typeof FOREST_PATHS)[number] & { restored: boolean }) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const position: [number, number, number] = [
    (from.x + to.x) / 2,
    tone === 'creek' ? 0.018 : 0.012,
    (from.z + to.z) / 2,
  ];

  if (tone === 'creek') {
    return (
      <group>
        <mesh position={[position[0], 0.01, position[2]]} rotation={[-Math.PI / 2, 0, angle]}>
          <planeGeometry args={[width + 0.5, length]} />
          <meshToonMaterial color={restored ? '#759d76' : '#344f48'} />
        </mesh>
        <mesh position={position} rotation={[-Math.PI / 2, 0, angle]}>
          <planeGeometry args={[width, length]} />
          <meshStandardMaterial
            color={restored ? '#49a9bd' : '#28697b'}
            emissive={restored ? '#1c6b70' : '#103a47'}
            emissiveIntensity={0.28}
            transparent
            opacity={0.88}
            roughness={0.26}
            metalness={0.05}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      <mesh
        position={[position[0], position[1] - 0.004, position[2]]}
        rotation={[-Math.PI / 2, 0, angle]}
        receiveShadow
      >
        <planeGeometry args={[width + 0.28, length]} />
        <meshToonMaterial color={restored ? '#536f4f' : '#334e43'} />
      </mesh>
      <mesh position={position} rotation={[-Math.PI / 2, 0, angle]} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshToonMaterial color={restored ? '#91a96c' : '#63785c'} />
      </mesh>
    </group>
  );
}

function ObstacleMesh({ obstacle, restored }: { obstacle: ForestObstacle; restored: boolean }) {
  if (obstacle.visual === 'ancient-tree') return null;
  if (obstacle.kind === 'circle') {
    return (
      <group position={[obstacle.center.x, 0, obstacle.center.z]}>
        <mesh
          position={[0, obstacle.radius * 0.58, 0]}
          rotation={[0.12, obstacle.center.x * 0.3, -0.08]}
          scale={[1, 0.78, 0.9]}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[obstacle.radius, 0]} />
          <meshToonMaterial color={restored ? '#71827b' : '#4d625d'} />
        </mesh>
        <mesh
          position={[-obstacle.radius * 0.08, obstacle.radius * 1.03, 0]}
          scale={[0.68, 0.16, 0.58]}
          rotation={[0.06, 0.4, 0.02]}
        >
          <dodecahedronGeometry args={[obstacle.radius, 0]} />
          <meshToonMaterial color={restored ? '#79a762' : '#456b51'} />
        </mesh>
      </group>
    );
  }

  if (obstacle.visual === 'fallen-log') {
    const width = obstacle.maxX - obstacle.minX;
    const depth = obstacle.maxZ - obstacle.minZ;
    return (
      <group
        position={[
          (obstacle.minX + obstacle.maxX) / 2,
          (obstacle.height ?? 0.48) / 2,
          (obstacle.minZ + obstacle.maxZ) / 2,
        ]}
      >
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[depth * 0.43, depth * 0.5, width, 9]} />
          <meshToonMaterial color="#774a32" />
        </mesh>
        <mesh position={[0.5, 0.23, 0]} rotation={[0, 0, -0.62]} castShadow>
          <cylinderGeometry args={[0.06, 0.11, 0.7, 7]} />
          <meshToonMaterial color="#68412d" />
        </mesh>
        <mesh position={[-0.35, depth * 0.42, 0]} scale={[0.72, 0.18, 0.5]}>
          <dodecahedronGeometry args={[0.44, 0]} />
          <meshToonMaterial color={restored ? '#70a05b' : '#42684e'} />
        </mesh>
      </group>
    );
  }

  const width = obstacle.maxX - obstacle.minX;
  const depth = obstacle.maxZ - obstacle.minZ;
  const height = obstacle.height ?? 0.6;
  return (
    <group position={[(obstacle.minX + obstacle.maxX) / 2, 0, (obstacle.minZ + obstacle.maxZ) / 2]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshToonMaterial color={restored ? '#79867d' : '#596761'} />
      </mesh>
      <mesh position={[0, height + 0.035, 0]} scale={[0.92, 0.08, 0.82]}>
        <boxGeometry args={[width, 0.24, depth]} />
        <meshToonMaterial color={restored ? '#668d5d' : '#435f50'} />
      </mesh>
    </group>
  );
}

function BoundaryForest({ restored, castShadow }: { restored: boolean; castShadow: boolean }) {
  const placements = useMemo(() => createBoundaryTrees(), []);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const lowerCanopyRef = useRef<THREE.InstancedMesh>(null);
  const upperCanopyRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const trunk = trunkRef.current;
    const lower = lowerCanopyRef.current;
    const upper = upperCanopyRef.current;
    if (!trunk || !lower || !upper) return;
    const object = new THREE.Object3D();
    placements.forEach(({ x, z, scale, rotation }, index) => {
      object.position.set(x, scale * 0.55, z);
      object.rotation.set(0, rotation, 0);
      object.scale.set(scale * 0.25, scale * 1.1, scale * 0.25);
      object.updateMatrix();
      trunk.setMatrixAt(index, object.matrix);

      object.position.set(x, scale * 1.38, z);
      object.scale.set(scale * 0.78, scale * 1.05, scale * 0.78);
      object.updateMatrix();
      lower.setMatrixAt(index, object.matrix);

      object.position.set(x, scale * 2.08, z);
      object.scale.set(scale * 0.58, scale * 0.82, scale * 0.58);
      object.updateMatrix();
      upper.setMatrixAt(index, object.matrix);
    });
    for (const mesh of [trunk, lower, upper]) mesh.instanceMatrix.needsUpdate = true;
  }, [placements]);

  return (
    <group name="forest-boundary">
      <instancedMesh
        ref={trunkRef}
        args={[undefined, undefined, placements.length]}
        castShadow={castShadow}
        receiveShadow
      >
        <cylinderGeometry args={[0.32, 0.46, 1, 7]} />
        <meshToonMaterial color="#5a3827" />
      </instancedMesh>
      <instancedMesh
        ref={lowerCanopyRef}
        args={[undefined, undefined, placements.length]}
        castShadow={castShadow}
      >
        <coneGeometry args={[0.72, 1.65, 7]} />
        <meshToonMaterial color={restored ? '#397b54' : '#245544'} />
      </instancedMesh>
      <instancedMesh
        ref={upperCanopyRef}
        args={[undefined, undefined, placements.length]}
        castShadow={castShadow}
      >
        <coneGeometry args={[0.64, 1.45, 7]} />
        <meshToonMaterial color={restored ? '#4c9561' : '#2b6750'} />
      </instancedMesh>
    </group>
  );
}

function InstancedFlora({
  decorations,
  restored,
  castShadow,
}: { decorations: ForestDecorations; restored: boolean; castShadow: boolean }) {
  return (
    <group name="forest-flora">
      <TransformInstances
        transforms={decorations.grass}
        color={restored ? '#77a95c' : '#466f50'}
        geometry="grass"
      />
      <TransformInstances
        transforms={decorations.shrubs}
        color={restored ? '#51955c' : '#315f49'}
        geometry="shrub"
        castShadow={castShadow}
      />
      <TransformInstances
        transforms={decorations.stones}
        color={restored ? '#7a877f' : '#53625e'}
        geometry="stone"
      />
      <TransformInstances
        transforms={decorations.flowers}
        color={restored ? '#ffd184' : '#9b7b76'}
        geometry="flower"
      />
      <FlowerStemInstances transforms={decorations.flowers} restored={restored} />
    </group>
  );
}

function FlowerStemInstances({
  transforms,
  restored,
}: { transforms: InstanceTransform[]; restored: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const stems = useMemo(
    () =>
      transforms.map((transform) => ({
        ...transform,
        y: transform.y * 0.5,
        scaleX: transform.scaleX * 0.16,
        scaleY: transform.scaleY * 0.4,
        scaleZ: transform.scaleZ * 0.16,
      })),
    [transforms],
  );
  useInstanceTransforms(ref, stems);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, stems.length]}>
      <cylinderGeometry args={[0.05, 0.065, 1, 5]} />
      <meshToonMaterial color={restored ? '#70a15b' : '#496b4c'} />
    </instancedMesh>
  );
}

function TransformInstances({
  transforms,
  color,
  geometry,
  castShadow = false,
}: {
  transforms: InstanceTransform[];
  color: string;
  geometry: 'grass' | 'shrub' | 'stone' | 'flower';
  castShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstanceTransforms(ref, transforms);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, transforms.length]}
      castShadow={castShadow}
      receiveShadow={geometry === 'stone'}
    >
      {geometry === 'grass' ? <coneGeometry args={[0.12, 0.52, 4]} /> : null}
      {geometry === 'shrub' ? <dodecahedronGeometry args={[0.42, 0]} /> : null}
      {geometry === 'stone' ? <dodecahedronGeometry args={[0.28, 0]} /> : null}
      {geometry === 'flower' ? <octahedronGeometry args={[0.14, 0]} /> : null}
      <meshToonMaterial
        color={color}
        emissive={geometry === 'flower' ? color : '#000000'}
        emissiveIntensity={geometry === 'flower' ? 0.18 : 0}
      />
    </instancedMesh>
  );
}

function MushroomGrove({ restored }: { restored: boolean }) {
  const mushrooms = [
    [-6.65, 0.48, 1.35, 0.38, '#e56c76'],
    [-6.25, 0.38, 2.03, 0.3, '#f2ad69'],
    [-5.74, 0.58, 1.56, 0.46, '#c87ee4'],
    [-5.35, 0.31, 2.28, 0.25, '#ef7d8b'],
    [-6.85, 0.27, 2.4, 0.22, '#f5c46d'],
  ] as const;
  return (
    <group name="mushroom-grove">
      {mushrooms.map(([x, height, z, scale, color]) => (
        <group key={`${x}-${z}`} position={[x, 0, z]}>
          <mesh position={[0, height / 2, 0]} castShadow>
            <cylinderGeometry args={[scale * 0.2, scale * 0.31, height, 7]} />
            <meshToonMaterial color="#f2dfbd" />
          </mesh>
          <mesh position={[0, height, 0]} scale={[1, 0.52, 1]} castShadow>
            <sphereGeometry args={[scale, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshToonMaterial
              color={color}
              emissive={color}
              emissiveIntensity={restored ? 0.28 : 0.08}
            />
          </mesh>
        </group>
      ))}
      {restored ? (
        <pointLight color="#e9a8ff" intensity={1.1} distance={4} position={[-6.1, 1.2, 1.8]} />
      ) : null}
    </group>
  );
}

function CreekLandmark({ restored }: { restored: boolean }) {
  const stones = [
    [1.95, -3.05, 0.42],
    [2.35, -3.82, 0.35],
    [2.72, -4.62, 0.44],
    [2.95, -5.35, 0.34],
  ] as const;
  return (
    <group name="creek-landmark">
      {stones.map(([x, z, scale], index) => (
        <mesh
          key={`${x}-${z}`}
          position={[x, 0.12 + (index % 2) * 0.025, z]}
          scale={[scale * 1.3, scale * 0.42, scale]}
          rotation={[0, index * 0.64, 0]}
          receiveShadow
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshToonMaterial color={restored ? '#85958d' : '#61716c'} />
        </mesh>
      ))}
      <ReedPatch position={[1.4, 0, -3.7]} restored={restored} />
      <ReedPatch position={[3.42, 0, -5.7]} restored={restored} />
    </group>
  );
}

function ReedPatch({
  position,
  restored,
}: { position: [number, number, number]; restored: boolean }) {
  return (
    <group position={position}>
      {[-0.18, 0, 0.21].map((offset, index) => (
        <mesh key={offset} position={[offset, 0.34 + index * 0.04, index * 0.08]}>
          <cylinderGeometry args={[0.025, 0.035, 0.72 + index * 0.08, 5]} />
          <meshToonMaterial color={restored ? '#7ea95c' : '#506f51'} />
        </mesh>
      ))}
    </group>
  );
}

function RuinGate({ restored }: { restored: boolean }) {
  const stoneColor = restored ? '#829087' : '#5c6964';
  return (
    <group position={[6.82, 0, 2.45]} name="ruin-gate">
      {[-0.82, 0.82].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.46, 1.44, 0.5]} />
            <meshToonMaterial color={stoneColor} />
          </mesh>
          <mesh position={[0, 1.5, 0]} rotation={[0.1, x * 0.08, 0]}>
            <boxGeometry args={[0.58, 0.22, 0.58]} />
            <meshToonMaterial color={restored ? '#648c5d' : '#455f52'} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.62, 0]} castShadow>
        <boxGeometry args={[2.04, 0.38, 0.52]} />
        <meshToonMaterial color={stoneColor} />
      </mesh>
      <mesh position={[0, 1.63, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.54, 0.045, 8, 32, Math.PI]} />
        <meshBasicMaterial
          color={restored ? '#7df0bd' : '#435553'}
          transparent
          opacity={restored ? 0.9 : 0.24}
        />
      </mesh>
      {restored ? (
        <pointLight color="#7df0bd" intensity={2.2} distance={5} position={[0, 1.4, 0]} />
      ) : null}
    </group>
  );
}

function RootVeins({ restored }: { restored: boolean }) {
  if (!restored) return null;
  const veins = [
    [0, -2.6, 0],
    [-2.1, -1.4, -0.86],
    [2.3, -1.2, 0.9],
    [-2.2, 1.8, 0.72],
    [2.4, 1.75, -0.76],
  ] as const;
  return (
    <group name="restored-root-veins">
      {veins.map(([x, z, rotation]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.023, z]} rotation={[-Math.PI / 2, 0, rotation]}>
          <planeGeometry args={[0.055, 4.8]} />
          <meshBasicMaterial
            color="#7df0bd"
            transparent
            opacity={0.42}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function useInstanceTransforms(
  ref: React.RefObject<THREE.InstancedMesh | null>,
  transforms: InstanceTransform[],
): void {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const object = new THREE.Object3D();
    for (const [index, transform] of transforms.entries()) {
      object.position.set(transform.x, transform.y, transform.z);
      object.rotation.set(0, transform.rotation, 0);
      object.scale.set(transform.scaleX, transform.scaleY, transform.scaleZ);
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [ref, transforms]);
}

export function createForestDecorations(seed: number, quality: GraphicsQuality): ForestDecorations {
  const counts =
    quality === 'high'
      ? { grass: 190, shrubs: 42, stones: 28, flowers: 42 }
      : quality === 'balanced'
        ? { grass: 120, shrubs: 28, stones: 20, flowers: 26 }
        : { grass: 58, shrubs: 16, stones: 12, flowers: 12 };
  const random = createSeededRandom(seed ^ 0x5f3759df);
  return {
    grass: createScatteredTransforms(random, counts.grass, 'grass'),
    shrubs: createScatteredTransforms(random, counts.shrubs, 'shrub'),
    stones: createScatteredTransforms(random, counts.stones, 'stone'),
    flowers: createScatteredTransforms(random, counts.flowers, 'flower'),
  };
}

function createScatteredTransforms(
  random: () => number,
  count: number,
  kind: 'grass' | 'shrub' | 'stone' | 'flower',
): InstanceTransform[] {
  const transforms: InstanceTransform[] = [];
  for (let attempt = 0; attempt < count * 24 && transforms.length < count; attempt += 1) {
    const x = (random() * 2 - 1) * 10.35;
    const z = (random() * 2 - 1) * 10.35;
    if (!decorationAllowed(x, z, kind)) continue;
    const base = 0.72 + random() * 0.68;
    const y = kind === 'flower' ? 0.2 * base : kind === 'grass' ? 0.24 * base : 0.22 * base;
    transforms.push({
      x,
      y,
      z,
      rotation: random() * Math.PI * 2,
      scaleX: base * (kind === 'stone' ? 1.15 : 1),
      scaleY: base * (kind === 'shrub' ? 0.72 : kind === 'stone' ? 0.58 : 1),
      scaleZ: base * (kind === 'stone' ? 0.86 : 1),
    });
  }
  return transforms;
}

function decorationAllowed(
  x: number,
  z: number,
  kind: 'grass' | 'shrub' | 'stone' | 'flower',
): boolean {
  const clearance = kind === 'grass' || kind === 'flower' ? 0.22 : 0.55;
  if (Math.hypot(x, z) < 1.65 + clearance) return false;
  for (const path of FOREST_PATHS) {
    if (
      distanceToSegment(x, z, path.from.x, path.from.z, path.to.x, path.to.z) <
      path.width / 2 + clearance
    ) {
      return false;
    }
  }
  for (const placement of LIGHT_SEED_PLACEMENTS) {
    if (Math.hypot(x - placement.position.x, z - placement.position.z) < 0.85 + clearance)
      return false;
  }
  if (
    Math.hypot(x - MEMORY_FRAGMENT_PLACEMENT.position.x, z - MEMORY_FRAGMENT_PLACEMENT.position.z) <
      0.8 + clearance ||
    Math.hypot(x - RESTORATION_NODE.position.x, z - RESTORATION_NODE.position.z) < 1 + clearance
  ) {
    return false;
  }
  return true;
}

function distanceToSegment(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0) return Math.hypot(x - ax, z - az);
  const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / lengthSquared));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

function createBoundaryTrees(): Array<{
  x: number;
  z: number;
  scale: number;
  rotation: number;
}> {
  const trees: Array<{ x: number; z: number; scale: number; rotation: number }> = [];
  const random = createSeededRandom(0x1a2b3c4d);
  for (let index = 0; index < 15; index += 1) {
    const offset = -10.6 + index * (21.2 / 14) + (random() - 0.5) * 0.42;
    const horizontalEdges: Array<readonly [number, number]> = [[offset, -10.7 - random() * 0.42]];
    // Leave a southern camera corridor around the trailhead. The collision
    // boundary remains closed; only decorative trees are omitted.
    if (Math.abs(offset) > 4.35) {
      horizontalEdges.push([offset + (random() - 0.5) * 0.25, 10.7 + random() * 0.42]);
    }
    for (const [x, z] of horizontalEdges) {
      trees.push({ x, z, scale: 0.78 + random() * 0.45, rotation: random() * Math.PI });
    }
    if (index > 0 && index < 14) {
      for (const [x, z] of [
        [-10.7 - random() * 0.42, offset + (random() - 0.5) * 0.25],
        [10.7 + random() * 0.42, offset],
      ] as const) {
        trees.push({ x, z, scale: 0.76 + random() * 0.46, rotation: random() * Math.PI });
      }
    }
  }
  return trees;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
