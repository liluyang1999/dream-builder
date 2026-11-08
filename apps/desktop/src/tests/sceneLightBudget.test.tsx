import type { TreeScene } from '@dream-builder/ipc-contracts';
import { act, createRoot, extend } from '@react-three/fiber';
import { createRef } from 'react';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createFallbackTreeScene } from '../data/fallbackTree';
import {
  CHECKPOINT_PLACEMENTS,
  FOREST_CHECKPOINTS,
  LIGHT_SEED_PLACEMENTS,
  MEMORY_FRAGMENT_PLACEMENT,
  RESTORATION_NODE,
} from '../game/forestLayout';
import {
  type GameProgress,
  type GameProgressAction,
  createInitialGameProgress,
  reduceGameProgress,
} from '../game/gameProgress';
import { CartoonForest } from '../scene/CartoonForest';
import { GameplayWorld } from '../scene/GameplayWorld';
import { Lighting } from '../scene/Lighting';
import { type PlayerApi, PlayerController } from '../scene/PlayerController';
import { TreeContent } from '../scene/TreeContent';
import * as sceneHelpers from '../scene/sceneHelpers';
import { useAppStore } from '../state/store';

// R3F's Node entry uses CommonJS Three. Share those real constructors with the
// scene components so applyProps can recognize Color/Vector instances in tests.
vi.mock('three', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('three');
});

extend({
  AmbientLight: THREE.AmbientLight,
  HemisphereLight: THREE.HemisphereLight,
  DirectionalLight: THREE.DirectionalLight,
  PointLight: THREE.PointLight,
  Group: THREE.Group,
  Mesh: THREE.Mesh,
  InstancedMesh: THREE.InstancedMesh,
  Sprite: THREE.Sprite,
  SpriteMaterial: THREE.SpriteMaterial,
  MeshBasicMaterial: THREE.MeshBasicMaterial,
  MeshStandardMaterial: THREE.MeshStandardMaterial,
  MeshToonMaterial: THREE.MeshToonMaterial,
  BoxGeometry: THREE.BoxGeometry,
  CircleGeometry: THREE.CircleGeometry,
  ConeGeometry: THREE.ConeGeometry,
  CylinderGeometry: THREE.CylinderGeometry,
  DodecahedronGeometry: THREE.DodecahedronGeometry,
  IcosahedronGeometry: THREE.IcosahedronGeometry,
  OctahedronGeometry: THREE.OctahedronGeometry,
  PlaneGeometry: THREE.PlaneGeometry,
  RingGeometry: THREE.RingGeometry,
  SphereGeometry: THREE.SphereGeometry,
  TorusGeometry: THREE.TorusGeometry,
});

const journey: GameProgressAction[] = [
  { type: 'reveal-seed', id: 'home-glow' },
  { type: 'collect-seed', id: 'home-glow' },
  { type: 'activate-checkpoint', id: 'mushroomSlope' },
  { type: 'reveal-seed', id: 'mushroom-glow' },
  { type: 'collect-seed', id: 'mushroom-glow' },
  { type: 'read-memory', id: 'mossbound-echo' },
  { type: 'reveal-seed', id: 'creek-glow' },
  { type: 'collect-seed', id: 'creek-glow' },
  { type: 'activate-checkpoint', id: 'ruinGate' },
  { type: 'begin-cleansing' },
  { type: 'cancel-cleansing' },
  { type: 'begin-cleansing' },
  { type: 'complete-cleansing' },
  { type: 'reset' },
];

let root: ReturnType<typeof createRoot> | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  // Keep the real component/Three scene graph, but skip 2D drawing and GPU work.
  vi.spyOn(sceneHelpers, 'createGlyphTexture').mockImplementation(
    () => new THREE.CanvasTexture(document.createElement('canvas')),
  );
  useAppStore.setState({ progress: createInitialGameProgress() });
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    await vi.advanceTimersByTimeAsync(500);
    root = null;
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function mountScene(crystalCount: number) {
  const tree = makeTree(crystalCount);
  const scene = new THREE.Scene();
  const playerApiRef = createRef<PlayerApi>();
  root = createRoot(document.createElement('canvas'));
  await root.configure({
    scene,
    frameloop: 'never',
    size: { width: 800, height: 600, top: 0, left: 0 },
    gl: () => ({
      render: vi.fn(),
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
    }),
  });
  await act(async () => {
    root?.render(
      <>
        <Lighting palette={tree.palette} />
        <TreeContent scene={tree} reducedMotion />
        <PlayerController
          apiRef={playerApiRef}
          reducedMotion
          respawnPosition={FOREST_CHECKPOINTS.spawn}
          inputLocked
        />
        <CartoonForest seed={tree.seed} quality="balanced" />
        <GameplayWorld reducedMotion />
      </>,
    );
  });
  return scene;
}

function makeTree(crystalCount: number): TreeScene {
  const tree = createFallbackTreeScene(424242);
  const template = tree.crystals[0];
  if (!template) throw new Error('The scene fixture requires a crystal.');
  // Native generation has six crystals; browser fallback has two. Render both
  // existing light-bearing component configurations without invoking a backend.
  const crystals = Array.from({ length: crystalCount }, (_, index) => ({
    ...template,
    id: `crystal-${index}`,
    position: { x: index * 0.2, y: 2, z: 0 },
  }));
  return {
    ...tree,
    crystals,
    details: [
      ...tree.details.filter((detail) => detail.kind !== 'crystal'),
      ...crystals.map(({ id }) => ({
        id,
        kind: 'crystal' as const,
        title: id,
        description: '',
        energy: 0.5,
      })),
    ],
  };
}

function pointLights(object: THREE.Object3D): THREE.PointLight[] {
  const lights: THREE.PointLight[] = [];
  object.traverseVisible((child) => {
    if (child instanceof THREE.PointLight) lights.push(child);
  });
  return lights;
}

function lightingSignature(light: THREE.PointLight) {
  const position = light.getWorldPosition(new THREE.Vector3()).toArray();
  return {
    position,
    intensity: light.intensity,
    distance: light.distance,
    color: light.color.getHexString(),
  };
}

function expectedGameplayLights(progress: GameProgress) {
  const checkpoint = CHECKPOINT_PLACEMENTS.find(({ id }) => id === progress.activeCheckpoint);
  if (!checkpoint) throw new Error('The progress fixture requires a checkpoint.');
  const restored = progress.nodeState === 'restored';
  const memoryRead = progress.memoriesRead.includes(MEMORY_FRAGMENT_PLACEMENT.id);
  const nodeColors = {
    dormant: '435553',
    ready: 'f7c76b',
    cleansing: 'b99cff',
    restored: '7df0bd',
  };
  return [
    ...LIGHT_SEED_PLACEMENTS.map(({ id, position }) => ({
      position: [position.x, 0.65, position.z],
      intensity: progress.seeds[id] === 'hidden' ? 0 : 2.2,
      distance: 3.2,
      color: 'f7c76b',
    })),
    {
      position: [checkpoint.position.x, 0.3, checkpoint.position.z],
      intensity: 0.85,
      distance: 2.2,
      color: '7df0bd',
    },
    {
      position: [MEMORY_FRAGMENT_PLACEMENT.position.x, 0.62, MEMORY_FRAGMENT_PLACEMENT.position.z],
      intensity: memoryRead ? 0 : 1.7,
      distance: 3,
      color: memoryRead ? '6b8f82' : 'b99cff',
    },
    {
      position: [RESTORATION_NODE.position.x, 0, RESTORATION_NODE.position.z],
      intensity: progress.nodeState === 'dormant' ? 0 : 2.8,
      distance: 5,
      color: nodeColors[progress.nodeState],
    },
    { position: [0, 2.4, 0], intensity: restored ? 4.2 : 0, distance: 15, color: '7df0bd' },
  ];
}

describe('scene point-light budget', () => {
  test.each([
    [2, 13],
    [6, 17],
  ])(
    'keeps the rendered budget at %i crystals / %i point lights throughout a journey',
    async (crystals, budget) => {
      const scene = await mountScene(crystals);
      let progress = createInitialGameProgress();
      const counts = [pointLights(scene).length];
      for (const action of journey) {
        progress = reduceGameProgress(progress, action);
        await act(async () => useAppStore.setState({ progress }));
        counts.push(pointLights(scene).length);
      }

      expect(counts).toEqual(Array(journey.length + 1).fill(budget));
    },
  );

  test('preserves each gameplay light position, color and enabled intensity in every state', async () => {
    const scene = await mountScene(6);
    let progress = createInitialGameProgress();
    for (const action of [null, ...journey]) {
      if (action) progress = reduceGameProgress(progress, action);
      await act(async () => useAppStore.setState({ progress }));
      scene.updateMatrixWorld(true);
      const gameplay = scene.getObjectByName('gameplay-world');
      const forest = scene.getObjectByName('cartoon-forest');
      if (!gameplay || !forest) throw new Error('The complete scene must be mounted.');
      expect(pointLights(gameplay).map(lightingSignature)).toEqual(
        expectedGameplayLights(progress),
      );
      expect(pointLights(forest).map(lightingSignature)).toEqual([
        {
          position: [-6.1, 1.2, 1.8],
          intensity: progress.nodeState === 'restored' ? 1.1 : 0,
          distance: 4,
          color: 'e9a8ff',
        },
        {
          position: [6.82, 1.4, 2.45],
          intensity: progress.nodeState === 'restored' ? 2.2 : 0,
          distance: 5,
          color: '7df0bd',
        },
      ]);
    }
  });
});
