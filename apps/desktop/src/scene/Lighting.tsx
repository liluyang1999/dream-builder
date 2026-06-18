/** Scene lighting — ported from the original imperative renderer. */
import type { TreePalette } from '@dream-builder/ipc-contracts';

export function Lighting({ palette }: { palette: TreePalette }) {
  return (
    <>
      <hemisphereLight args={[0x91ffe3, 0x1c120d, 1.2]} />
      <directionalLight color={0xf7dfaa} intensity={2.4} position={[-3.4, 5.2, 3.6]} />
      <directionalLight color={0x7d6cff} intensity={1.8} position={[3.4, 3.8, -4.4]} />
      <pointLight color={palette.glow} intensity={3.8} distance={6.5} position={[0, 1.35, 0.25]} />
    </>
  );
}
