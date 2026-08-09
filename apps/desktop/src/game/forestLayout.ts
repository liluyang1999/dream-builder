import type { ForestCheckpointId, LightSeedId, MemoryFragmentId } from './gameProgress';
import type { CircleObstacle, CollisionWorld, RectObstacle, Vec2 } from './playerMotion';

interface VisualSpec {
  visual: 'ancient-tree' | 'boulder' | 'fallen-log' | 'ruin-wall';
  height?: number;
}

export type ForestObstacle = (CircleObstacle | RectObstacle) & VisualSpec;

export interface ForestPath {
  id: string;
  from: Vec2;
  to: Vec2;
  width: number;
  tone: 'moss' | 'creek';
}

export interface LightSeedPlacement {
  id: LightSeedId;
  position: Vec2;
  label: string;
}

export interface CheckpointPlacement {
  id: ForestCheckpointId;
  position: Vec2;
  label: string;
}

export interface MemoryFragmentPlacement {
  id: MemoryFragmentId;
  position: Vec2;
  label: string;
  title: string;
  passages: readonly string[];
}

export const FOREST_CHECKPOINTS = {
  spawn: { x: 0, z: 6.2 },
  treeClearing: { x: 0, z: 2.1 },
  mushroomSlope: { x: -6.2, z: 1.8 },
  creek: { x: 2.8, z: -6.2 },
  ruinGate: { x: 6.8, z: 3.2 },
} as const satisfies Record<ForestCheckpointId, Vec2>;

export const FOREST_OBSTACLES: readonly ForestObstacle[] = [
  {
    id: 'ancient-tree',
    kind: 'circle',
    center: { x: 0, z: 0 },
    radius: 0.72,
    visual: 'ancient-tree',
  },
  {
    id: 'west-boulder',
    kind: 'circle',
    center: { x: -3.7, z: 3.1 },
    radius: 0.82,
    visual: 'boulder',
  },
  {
    id: 'creek-boulder',
    kind: 'circle',
    center: { x: 3.7, z: -4.5 },
    radius: 0.66,
    visual: 'boulder',
  },
  {
    id: 'fallen-log',
    kind: 'rect',
    minX: -4.8,
    maxX: -1.7,
    minZ: -2.5,
    maxZ: -1.95,
    visual: 'fallen-log',
    height: 0.48,
  },
  {
    id: 'ruin-wall-long',
    kind: 'rect',
    minX: 5.55,
    maxX: 5.95,
    minZ: -0.9,
    maxZ: 2.25,
    visual: 'ruin-wall',
    height: 1.55,
  },
  {
    id: 'ruin-wall-short',
    kind: 'rect',
    minX: 5.95,
    maxX: 8.1,
    minZ: 1.85,
    maxZ: 2.25,
    visual: 'ruin-wall',
    height: 1.2,
  },
];

export const FOREST_WORLD: CollisionWorld = {
  bounds: { minX: -11, maxX: 11, minZ: -11, maxZ: 11 },
  obstacles: FOREST_OBSTACLES,
};

export const FOREST_PATHS: readonly ForestPath[] = [
  {
    id: 'home-path',
    from: FOREST_CHECKPOINTS.spawn,
    to: FOREST_CHECKPOINTS.treeClearing,
    width: 1.35,
    tone: 'moss',
  },
  {
    id: 'mushroom-path',
    from: { x: -1.1, z: 1.1 },
    to: FOREST_CHECKPOINTS.mushroomSlope,
    width: 1.1,
    tone: 'moss',
  },
  {
    id: 'creek-path',
    from: { x: 1.1, z: -1.1 },
    to: FOREST_CHECKPOINTS.creek,
    width: 0.72,
    tone: 'creek',
  },
  {
    id: 'ruin-path',
    from: { x: 1.2, z: 1.1 },
    to: FOREST_CHECKPOINTS.ruinGate,
    width: 1.05,
    tone: 'moss',
  },
];

export const LIGHT_SEED_PLACEMENTS: readonly LightSeedPlacement[] = [
  { id: 'home-glow', position: { x: -1.6, z: 4.1 }, label: '归巢光种' },
  { id: 'mushroom-glow', position: FOREST_CHECKPOINTS.mushroomSlope, label: '菌伞光种' },
  { id: 'creek-glow', position: FOREST_CHECKPOINTS.creek, label: '溪语光种' },
];

export const CHECKPOINT_PLACEMENTS: readonly CheckpointPlacement[] = [
  { id: 'spawn', position: FOREST_CHECKPOINTS.spawn, label: '智慧树根' },
  { id: 'treeClearing', position: FOREST_CHECKPOINTS.treeClearing, label: '中央林地' },
  { id: 'mushroomSlope', position: FOREST_CHECKPOINTS.mushroomSlope, label: '蘑菇坡' },
  { id: 'creek', position: FOREST_CHECKPOINTS.creek, label: '溪流浅滩' },
  { id: 'ruinGate', position: FOREST_CHECKPOINTS.ruinGate, label: '遗迹门前' },
];

export const MEMORY_FRAGMENT_PLACEMENT: MemoryFragmentPlacement = {
  id: 'mossbound-echo',
  position: { x: 4.15, z: -1.45 },
  label: '覆苔回声',
  title: '记忆碎片 · 守望者的约定',
  passages: [
    '很久以前，守林人把第一束晨光藏进种子，约定森林黯淡时再将它们带回树根。',
    '石门记得他们离开的方向：沿溪水而下，再循着三道微光回到会呼吸的树旁。',
  ],
};

export const RESTORATION_NODE = {
  position: FOREST_CHECKPOINTS.ruinGate,
  label: '遗迹净化节点',
} as const;
