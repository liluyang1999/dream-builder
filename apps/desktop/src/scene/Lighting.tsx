/** Scene lighting — ported from the original imperative renderer. */
import type { TreePalette } from '@dream-builder/ipc-contracts';

export function Lighting({ palette }: { palette: TreePalette }) {
  return (
    <>
      <ambientLight color={0xc9f5df} intensity={0.52} />
      <hemisphereLight args={[0xb8f7dc, 0x30452f, 1.55]} />
      <directionalLight
        castShadow
        color={0xf7dfaa}
        intensity={2.65}
        position={[-3.4, 7.2, 3.6]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={28}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <directionalLight color={0x9d8cff} intensity={1.55} position={[3.4, 3.8, -4.4]} />
      <pointLight color={palette.glow} intensity={3.8} distance={6.5} position={[0, 1.35, 0.25]} />
    </>
  );
}
