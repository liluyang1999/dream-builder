import { useMemo } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../state/store';

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  varying vec2 vUv;
  void main() {
    float blend = smoothstep(0.08, 0.92, vUv.y);
    vec3 color = mix(uHorizon, uZenith, blend);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function ForestSky() {
  const restored = useAppStore((state) => state.progress.nodeState === 'restored');
  const uniforms = useMemo(
    () => ({
      uHorizon: {
        value: new THREE.Color(restored ? '#9bd6b3' : '#568980'),
      },
      uZenith: {
        value: new THREE.Color(restored ? '#356b87' : '#183a55'),
      },
    }),
    [restored],
  );

  return (
    <mesh scale={70} renderOrder={-100}>
      <sphereGeometry args={[1, 32, 18]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}
