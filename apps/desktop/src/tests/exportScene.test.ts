import * as THREE from 'three';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createPortableSceneSnapshot, exportPortableScene } from '../scene/exportScene';
import { createCrystalMaterial } from '../scene/materials/crystalMaterial';

function exportFixture() {
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry();
  const toon = new THREE.MeshToonMaterial({ color: '#37d6b0' });
  const forest = new THREE.InstancedMesh(geometry, toon, 2);
  forest.name = 'forest-instances';
  forest.position.set(2, 1, -3);
  forest.setMatrixAt(0, new THREE.Matrix4().makeTranslation(1, 0, 0));
  forest.setMatrixAt(1, new THREE.Matrix4().makeTranslation(0, 2, 0));
  const crystal = new THREE.Mesh(geometry, createCrystalMaterial(0.7, '#9d70ff'));
  crystal.name = 'crystal';
  const sky = new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({
      uniforms: {
        uHorizon: { value: new THREE.Color('#568980') },
        uZenith: { value: new THREE.Color('#183a55') },
      },
    }),
  );
  sky.name = 'view-sky';
  const points = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 1, 0, 1, 2, 1], 3),
    ),
    new THREE.PointsMaterial({ color: '#f7c76b' }),
  );
  points.name = 'particles';
  const sunlight = new THREE.DirectionalLight('#ffffff', 2);
  sunlight.position.set(3, 4, 5);
  scene.add(
    forest,
    crystal,
    sky,
    points,
    sunlight,
    new THREE.AmbientLight(),
    new THREE.HemisphereLight(),
  );
  return { scene, geometry, toon, forest, crystal, sunlight };
}

function decodeGlb(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  expect(view.getUint32(0, true)).toBe(0x46546c67);
  expect(view.getUint32(4, true)).toBe(2);
  expect(view.getUint32(8, true)).toBe(buffer.byteLength);
  expect(view.getUint32(16, true)).toBe(0x4e4f534a);
  const jsonLength = view.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength))) as {
    nodes: {
      name?: string;
      matrix?: number[];
      mesh?: number;
      extensions?: { EXT_mesh_gpu_instancing?: { attributes: Record<string, number> } };
    }[];
    meshes: { primitives: { material?: number; attributes: Record<string, number> }[] }[];
    materials: {
      pbrMetallicRoughness: {
        baseColorFactor?: number[];
        metallicFactor?: number;
        roughnessFactor?: number;
      };
    }[];
    accessors: {
      componentType: number;
      count: number;
      type: string;
      bufferView: number;
      byteOffset?: number;
    }[];
    bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
    extensions: { KHR_lights_punctual: { lights: { type: string }[] } };
  };
}

describe('portable GLB scene export', () => {
  afterEach(() => vi.restoreAllMocks());

  test('exports current materials and lights without unsupported-material or direction warnings', async () => {
    const { scene } = exportFixture();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await exportPortableScene(scene);
    decodeGlb(result);
    expect(warn).not.toHaveBeenCalled();
  });

  test('preserves static meshes, instances, transforms and finite complete binary accessor data', async () => {
    const { scene } = exportFixture();
    const result = await exportPortableScene(scene);
    const json = decodeGlb(result);
    const forest = json.nodes.find((node) => node.name === 'forest-instances');
    expect(forest?.matrix?.slice(12, 15)).toEqual([2, 1, -3]);
    const translation = forest?.extensions?.EXT_mesh_gpu_instancing?.attributes.TRANSLATION;
    expect(translation).toBeTypeOf('number');
    expect(json.accessors[translation ?? -1]?.count).toBe(2);
    expect(json.nodes.some((node) => node.name === 'crystal' && node.mesh !== undefined)).toBe(
      true,
    );
    expect(json.nodes.some((node) => node.name === 'particles' && node.mesh !== undefined)).toBe(
      true,
    );
    expect(json.nodes.some((node) => node.name === 'view-sky')).toBe(false);
    expect(json.extensions.KHR_lights_punctual.lights.map((light) => light.type)).toEqual([
      'directional',
    ]);
    for (const mesh of json.meshes) {
      for (const primitive of mesh.primitives) {
        expect(primitive.material).toBeTypeOf('number');
        expect(json.materials[primitive.material ?? -1]?.pbrMetallicRoughness).toBeDefined();
      }
    }
    const view = new DataView(result);
    const binaryHeader = 20 + view.getUint32(12, true);
    expect(view.getUint32(binaryHeader + 4, true)).toBe(0x004e4942);
    const binaryStart = binaryHeader + 8;
    expect(binaryStart + view.getUint32(binaryHeader, true)).toBe(result.byteLength);
    for (const accessor of json.accessors) {
      const bufferView = json.bufferViews[accessor.bufferView];
      expect(bufferView).toBeDefined();
      if (!bufferView) continue;
      expect(
        binaryStart + (bufferView.byteOffset ?? 0) + bufferView.byteLength,
      ).toBeLessThanOrEqual(result.byteLength);
      if (accessor.componentType !== 5126) continue;
      const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
      expect(components).toBeDefined();
      if (!components) continue;
      const start = binaryStart + (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
      for (let item = 0; item < accessor.count; item += 1) {
        for (let component = 0; component < components; component += 1) {
          const offset = start + item * (bufferView.byteStride ?? components * 4) + component * 4;
          expect(Number.isFinite(view.getFloat32(offset, true))).toBe(true);
        }
      }
    }
  });

  test('owns snapshot geometry and materials while preserving the live scene and directional target', () => {
    const source = exportFixture();
    const originalScene = source.scene.toJSON();
    const liveGeometryDispose = vi.spyOn(source.geometry, 'dispose');
    const liveMaterialDispose = vi.spyOn(source.toon, 'dispose');
    const snapshot = createPortableSceneSnapshot(source.scene);
    const forest = snapshot.scene.getObjectByName('forest-instances') as THREE.InstancedMesh;
    expect(forest).toBeInstanceOf(THREE.InstancedMesh);
    expect(forest.count).toBe(source.forest.count);
    expect(forest.instanceMatrix.array).toEqual(source.forest.instanceMatrix.array);
    expect(forest.instanceMatrix.array).not.toBe(source.forest.instanceMatrix.array);
    expect(forest.geometry).not.toBe(source.geometry);
    expect(forest.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    const snapshotGeometryDispose = vi.spyOn(forest.geometry, 'dispose');
    const sunlight = snapshot.scene.children.find(
      (node) => node instanceof THREE.DirectionalLight,
    ) as THREE.DirectionalLight;
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(sunlight.quaternion);
    expect(
      direction.distanceTo(source.sunlight.position.clone().negate().normalize()),
    ).toBeLessThan(1e-8);
    expect(sunlight.target.parent).toBe(sunlight);
    expect(source.sunlight.target.parent).toBeNull();
    snapshot.dispose();
    snapshot.dispose();
    expect(snapshotGeometryDispose).toHaveBeenCalledTimes(1);
    expect(liveGeometryDispose).not.toHaveBeenCalled();
    expect(liveMaterialDispose).not.toHaveBeenCalled();
    expect(source.scene.toJSON()).toEqual(originalScene);
  });

  test('rejects unrecognized shader materials and releases partial snapshot resources only', async () => {
    const source = exportFixture();
    source.scene.add(new THREE.Mesh(source.geometry, new THREE.ShaderMaterial()));
    const dispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    await expect(exportPortableScene(source.scene)).rejects.toThrow('无法转换的自定义着色材质');
    expect(dispose).toHaveBeenCalled();
    expect(dispose.mock.contexts).not.toContain(source.geometry);
  });
});
