/** A rune: an additive, glyph-textured sprite that brightens on hover/select. */
import type { RuneMark } from '@dream-builder/ipc-contracts';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useInteractive } from '../interaction/useInteractive';
import { createGlyphTexture, damp, toVector3 } from './sceneHelpers';

export function RuneSprite({ rune, glowColor }: { rune: RuneMark; glowColor: string }) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const { hovered, selected, handlers } = useInteractive(rune.id);

  const texture = useMemo(() => createGlyphTexture(rune.glyph, glowColor), [rune.glyph, glowColor]);
  useEffect(() => () => texture.dispose(), [texture]);

  const baseScale = 0.34 + rune.intensity * 0.12;
  const position = useMemo(() => toVector3(rune.position), [rune.position]);

  useFrame((_, delta) => {
    const sprite = spriteRef.current;
    if (!sprite) return;
    const target = baseScale * (selected ? 1.4 : hovered ? 1.2 : 1);
    sprite.scale.setScalar(damp(sprite.scale.x, target, 9, delta));
  });

  return (
    <sprite ref={spriteRef} position={position} scale={baseScale} {...handlers}>
      <spriteMaterial
        map={texture}
        color={glowColor}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </sprite>
  );
}
