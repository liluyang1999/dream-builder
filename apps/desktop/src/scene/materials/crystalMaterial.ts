/**
 * A custom GLSL material for crystals: a Fresnel rim glow with a slow shimmer,
 * brightened by `uBoost` on hover/select. Pairs with the Bloom post-pass.
 *
 * Teaching points: vertex/fragment shaders, uniforms, varyings, the Fresnel
 * term `pow(1 - dot(normal, viewDir), p)`, and animating via a `uTime` uniform.
 */
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uEmissive;
  uniform float uTime;
  uniform float uBoost;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 2.5);
    float shimmer = 0.5 + 0.5 * sin(uTime * 1.5 + vNormal.y * 6.0);
    vec3 core = uColor * 0.35;
    vec3 rim = uEmissive * (0.8 + 0.6 * shimmer) * (1.0 + uBoost);
    vec3 color = mix(core, rim, fresnel) + uEmissive * uBoost * 0.4;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export interface CrystalUniforms {
  uColor: { value: THREE.Color };
  uEmissive: { value: THREE.Color };
  uTime: { value: number };
  uBoost: { value: number };
}

export function createCrystalMaterial(hue: number, emissiveColor: string): THREE.ShaderMaterial {
  const uniforms: CrystalUniforms = {
    uColor: { value: new THREE.Color().setHSL(hue, 0.72, 0.58) },
    uEmissive: { value: new THREE.Color(emissiveColor) },
    uTime: { value: 0 },
    uBoost: { value: 0 },
  };
  return new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as { [uniform: string]: THREE.IUniform },
    vertexShader,
    fragmentShader,
  });
}
