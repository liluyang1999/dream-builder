/** The R3F `<Canvas>` host: lights, tree, particles, controls, bloom, capture. */
import type { MagicField, TreeScene } from '@dream-builder/ipc-contracts';
import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { type RefObject, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { Lighting } from './Lighting';
import { MagicParticles } from './MagicParticles';
import { TreeContent } from './TreeContent';

/** Imperative handle the HUD uses for screenshot / export / reset. */
export interface SceneApi {
  screenshot(): Promise<Blob | null>;
  exportGltf(): Promise<Blob | null>;
  resetCamera(): void;
}

const CAMERA_POSITION: [number, number, number] = [3.8, 2.6, 5.2];
const CAMERA_TARGET: [number, number, number] = [0, 2.15, 0];

interface OrbitLike {
  target: THREE.Vector3;
  update(): void;
}

/** Lives inside the Canvas so it can read the renderer/scene/camera/controls. */
function SceneController({ apiRef }: { apiRef: RefObject<SceneApi | null> }) {
  const gl = useThree((state) => state.gl);
  const threeScene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as OrbitLike | null;

  useEffect(() => {
    apiRef.current = {
      async screenshot() {
        gl.render(threeScene, camera);
        return await new Promise<Blob | null>((resolve) => {
          gl.domElement.toBlob((blob) => resolve(blob), 'image/png');
        });
      },
      async exportGltf() {
        const exporter = new GLTFExporter();
        const result = await exporter.parseAsync(threeScene, { binary: true });
        return result instanceof ArrayBuffer
          ? new Blob([result], { type: 'model/gltf-binary' })
          : null;
      },
      resetCamera() {
        camera.position.set(...CAMERA_POSITION);
        if (controls) {
          controls.target.set(...CAMERA_TARGET);
          controls.update();
        }
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [gl, threeScene, camera, controls, apiRef]);

  return null;
}

interface Props {
  scene: TreeScene;
  reducedMotion: boolean;
  fieldRef: RefObject<MagicField | null>;
  apiRef: RefObject<SceneApi | null>;
}

export function SceneCanvas({ scene, reducedMotion, fieldRef, apiRef }: Props) {
  return (
    <Canvas
      camera={{ position: CAMERA_POSITION, fov: 45, near: 0.1, far: 120 }}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
      }}
    >
      <color attach="background" args={[scene.palette.backgroundTop]} />
      <fogExp2 attach="fog" args={[0x071018, 0.045]} />
      <Lighting palette={scene.palette} />
      <TreeContent scene={scene} reducedMotion={reducedMotion} />
      <MagicParticles scene={scene} reducedMotion={reducedMotion} fieldRef={fieldRef} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.06}
        minDistance={2.8}
        maxDistance={8.5}
        maxPolarAngle={Math.PI * 0.48}
        target={CAMERA_TARGET}
      />
      <EffectComposer>
        <Bloom intensity={0.82} luminanceThreshold={0.18} luminanceSmoothing={0.68} mipmapBlur />
      </EffectComposer>
      <SceneController apiRef={apiRef} />
    </Canvas>
  );
}
