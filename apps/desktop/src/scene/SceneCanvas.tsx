/** The R3F `<Canvas>` host: lights, tree, particles, controls, bloom, capture. */
import type { MagicField, TreeScene } from '@dream-builder/ipc-contracts';
import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { type RefObject, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FOREST_CHECKPOINTS } from '../game/forestLayout';
import { useAppStore } from '../state/store';
import { CartoonForest } from './CartoonForest';
import { ForestSky } from './ForestSky';
import { GameplayController } from './GameplayController';
import { GameplayWorld } from './GameplayWorld';
import { Lighting } from './Lighting';
import { MagicParticles } from './MagicParticles';
import { PerformanceProbe } from './PerformanceProbe';
import {
  PLAYER_CAMERA_OFFSET,
  PLAYER_CAMERA_TARGET_HEIGHT,
  type PlayerApi,
  PlayerController,
} from './PlayerController';
import { TreeContent } from './TreeContent';

/** Imperative handle the HUD uses for screenshot / export / reset. */
export interface SceneApi {
  screenshot(): Promise<Blob | null>;
  exportGltf(): Promise<Blob | null>;
  resetCamera(): void;
  restartChapter(): void;
}

const CAMERA_POSITION: [number, number, number] = [
  FOREST_CHECKPOINTS.spawn.x + PLAYER_CAMERA_OFFSET[0],
  PLAYER_CAMERA_OFFSET[1],
  FOREST_CHECKPOINTS.spawn.z + PLAYER_CAMERA_OFFSET[2],
];
const CAMERA_TARGET: [number, number, number] = [
  FOREST_CHECKPOINTS.spawn.x,
  PLAYER_CAMERA_TARGET_HEIGHT,
  FOREST_CHECKPOINTS.spawn.z,
];

/** Lives inside the Canvas so it can read the renderer/scene/camera/controls. */
function SceneController({
  apiRef,
  playerApiRef,
}: { apiRef: RefObject<SceneApi | null>; playerApiRef: RefObject<PlayerApi | null> }) {
  const gl = useThree((state) => state.gl);
  const threeScene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    apiRef.current = {
      async screenshot() {
        gl.render(threeScene, camera);
        return await new Promise<Blob | null>((resolve) => {
          gl.domElement.toBlob((blob) => resolve(blob), 'image/png');
        });
      },
      async exportGltf() {
        const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
        const exporter = new GLTFExporter();
        const result = await exporter.parseAsync(threeScene, { binary: true });
        return result instanceof ArrayBuffer
          ? new Blob([result], { type: 'model/gltf-binary' })
          : null;
      },
      resetCamera() {
        playerApiRef.current?.reset();
      },
      restartChapter() {
        playerApiRef.current?.reset(FOREST_CHECKPOINTS.spawn);
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [gl, threeScene, camera, apiRef, playerApiRef]);

  return null;
}

interface Props {
  scene: TreeScene;
  reducedMotion: boolean;
  fieldRef: RefObject<MagicField | null>;
  apiRef: RefObject<SceneApi | null>;
}

export function SceneCanvas({ scene, reducedMotion, fieldRef, apiRef }: Props) {
  const playerApiRef = useRef<PlayerApi | null>(null);
  const activeCheckpoint = useAppStore((state) => state.progress.activeCheckpoint);
  const inputLocked = useAppStore(
    (state) =>
      state.sessionMode !== 'playing' ||
      state.settingsOpen ||
      state.creditsOpen ||
      state.chapterCompleteOpen ||
      state.helpOpen ||
      state.activeMemoryId !== null ||
      state.progress.nodeState === 'cleansing',
  );
  const graphicsQuality = useAppStore((state) => state.graphicsQuality);
  const cameraSensitivity = useAppStore((state) => state.cameraSensitivity);
  const restored = useAppStore((state) => state.progress.nodeState === 'restored');
  const respawnPosition = FOREST_CHECKPOINTS[activeCheckpoint];
  const shadows = graphicsQuality !== 'low';
  const dpr: [number, number] =
    graphicsQuality === 'high' ? [1, 2] : graphicsQuality === 'balanced' ? [1, 1.5] : [1, 1];

  return (
    <Canvas
      shadows={shadows}
      camera={{ position: CAMERA_POSITION, fov: 50, near: 0.1, far: 120 }}
      dpr={dpr}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.18;
      }}
    >
      <color attach="background" args={[scene.palette.backgroundTop]} />
      <fogExp2 attach="fog" args={[restored ? 0x477966 : 0x173c3b, 0.032]} />
      <ForestSky />
      <Lighting palette={scene.palette} />
      <CartoonForest seed={scene.seed} quality={graphicsQuality} />
      <TreeContent scene={scene} reducedMotion={reducedMotion} />
      <MagicParticles scene={scene} reducedMotion={reducedMotion} fieldRef={fieldRef} />
      <GameplayWorld reducedMotion={reducedMotion} />
      <PlayerController
        apiRef={playerApiRef}
        reducedMotion={reducedMotion}
        respawnPosition={respawnPosition}
        inputLocked={inputLocked}
      />
      <GameplayController playerApiRef={playerApiRef} inputLocked={inputLocked} />
      <OrbitControls
        makeDefault
        enabled={!inputLocked}
        enablePan={false}
        enableDamping
        dampingFactor={0.06}
        minDistance={2.4}
        maxDistance={8.2}
        maxPolarAngle={Math.PI * 0.48}
        rotateSpeed={cameraSensitivity / 100}
        target={CAMERA_TARGET}
      />
      {graphicsQuality === 'low' ? null : (
        <EffectComposer>
          <Bloom
            intensity={graphicsQuality === 'high' ? 0.82 : 0.64}
            luminanceThreshold={0.18}
            luminanceSmoothing={0.68}
            mipmapBlur={graphicsQuality === 'high'}
          />
        </EffectComposer>
      )}
      <PerformanceProbe />
      <SceneController apiRef={apiRef} playerApiRef={playerApiRef} />
    </Canvas>
  );
}
