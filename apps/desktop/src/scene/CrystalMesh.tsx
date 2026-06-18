/** A crystal: a custom Fresnel-shader octahedron + point light; pulses on hover/select. */
import type { CrystalCluster } from '@dream-builder/ipc-contracts';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { useInteractive } from '../interaction/useInteractive';
import { type CrystalUniforms, createCrystalMaterial } from './materials/crystalMaterial';
import { damp, toVector3 } from './sceneHelpers';

export function CrystalMesh({
  crystal,
  crystalColor,
}: { crystal: CrystalCluster; crystalColor: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const { hovered, selected, handlers } = useInteractive(crystal.id);

  const material = useMemo(
    () => createCrystalMaterial(crystal.hue, crystalColor),
    [crystal.hue, crystalColor],
  );
  const uniforms = material.uniforms as unknown as CrystalUniforms;
  useEffect(() => () => material.dispose(), [material]);

  const position = useMemo(() => toVector3(crystal.position), [crystal.position]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const light = lightRef.current;
    if (!group || !light) return;
    const targetScale = selected ? 1.18 : hovered ? 1.1 : 1;
    group.scale.setScalar(damp(group.scale.x, targetScale, 9, delta));
    const targetBoost = selected ? 1.4 : hovered ? 0.7 : 0;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uBoost.value = damp(uniforms.uBoost.value, targetBoost, 9, delta);
    light.intensity = damp(light.intensity, selected ? 1.6 : hovered ? 1.1 : 0.8, 9, delta);
  });

  return (
    <group ref={groupRef} position={position} {...handlers}>
      <mesh rotation={[0.4, 0.2, -0.2]} material={material}>
        <octahedronGeometry args={[crystal.scale, 0]} />
      </mesh>
      <pointLight ref={lightRef} color={crystalColor} intensity={0.8} distance={1.8} />
    </group>
  );
}
