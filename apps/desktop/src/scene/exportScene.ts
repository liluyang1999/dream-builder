import * as THREE from 'three';

export async function exportPortableScene(scene: THREE.Scene): Promise<ArrayBuffer> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const snapshot = createPortableSceneSnapshot(scene);
  try {
    const result = await new GLTFExporter().parseAsync(snapshot.scene, { binary: true });
    if (!(result instanceof ArrayBuffer)) throw new Error('无法生成模型文件。');
    return result;
  } finally {
    snapshot.dispose();
  }
}

/** A static model snapshot: runtime sky, fog, bloom, ambient light and sprites are view effects. */
export function createPortableSceneSnapshot(source: THREE.Scene): {
  scene: THREE.Scene;
  dispose(): void;
} {
  const scene = source.clone(true);
  scene.background = null;
  scene.environment = null;
  scene.fog = null;
  const geometries = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  const materials = new Map<THREE.Material, THREE.Material>();
  const entries: [THREE.Object3D, THREE.Object3D][] = [];
  const collect = (original: THREE.Object3D, copy: THREE.Object3D) => {
    entries.push([original, copy]);
    original.children.forEach((child, index) => {
      const clonedChild = copy.children[index];
      if (clonedChild) collect(child, clonedChild);
    });
  };
  collect(source, scene);

  const dispose = () => {
    for (const geometry of geometries.values()) geometry.dispose();
    for (const material of materials.values()) material.dispose();
    geometries.clear();
    materials.clear();
  };
  const materialFor = (material: THREE.Material): THREE.Material => {
    const cached = materials.get(material);
    if (cached) return cached;
    const portable = portableMaterial(material);
    materials.set(material, portable);
    return portable;
  };

  try {
    for (const [, object] of entries) {
      if (
        object instanceof THREE.AmbientLight ||
        object instanceof THREE.HemisphereLight ||
        object instanceof THREE.Sprite
      ) {
        object.removeFromParent();
        continue;
      }
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) continue;
      if (object.material instanceof THREE.ShaderMaterial && isSkyMaterial(object.material)) {
        object.removeFromParent();
        continue;
      }
      const originalGeometry: THREE.BufferGeometry = object.geometry;
      let geometry = geometries.get(originalGeometry);
      if (!geometry) {
        geometry = originalGeometry.clone();
        if (geometry.hasAttribute('normal')) geometry.normalizeNormals();
        geometries.set(originalGeometry, geometry);
      }
      object.geometry = geometry;
      object.material = Array.isArray(object.material)
        ? object.material.map(materialFor)
        : materialFor(object.material);
    }

    scene.updateMatrixWorld(true);
    for (const [original, object] of entries) {
      if (
        !(original instanceof THREE.DirectionalLight) ||
        !(object instanceof THREE.DirectionalLight)
      )
        continue;
      object.lookAt(worldPosition(original.target));
      object.target = new THREE.Object3D();
      object.target.position.set(0, 0, -1);
      object.add(object.target);
    }
    scene.updateMatrixWorld(true);
    return { scene, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

function portableMaterial(material: THREE.Material): THREE.Material {
  if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial)
    return material.clone();

  let portable: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
  if (material instanceof THREE.MeshToonMaterial) {
    portable = new THREE.MeshStandardMaterial({
      color: material.color,
      map: material.map,
      emissive: material.emissive,
      emissiveIntensity: material.emissiveIntensity,
      emissiveMap: material.emissiveMap,
      roughness: 0.85,
      metalness: 0,
    });
  } else if (material instanceof THREE.PointsMaterial) {
    portable = new THREE.MeshBasicMaterial({ color: material.color, map: material.map });
  } else if (material instanceof THREE.ShaderMaterial) {
    const color: unknown = material.uniforms.uColor?.value;
    const emissive: unknown = material.uniforms.uEmissive?.value;
    if (!(color instanceof THREE.Color) || !(emissive instanceof THREE.Color)) {
      throw new Error('模型包含无法转换的自定义着色材质。');
    }
    portable = new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: 0.55,
      roughness: 0.28,
      metalness: 0.08,
    });
  } else {
    throw new Error(`模型包含不支持的材质：${material.type}`);
  }
  portable.name = material.name;
  portable.opacity = material.opacity;
  portable.transparent = material.transparent;
  portable.alphaTest = material.alphaTest;
  portable.side = material.side;
  portable.vertexColors = material.vertexColors;
  return portable;
}

function isSkyMaterial(material: THREE.ShaderMaterial): boolean {
  return (
    material.uniforms.uHorizon?.value instanceof THREE.Color &&
    material.uniforms.uZenith?.value instanceof THREE.Color
  );
}

/** Compute current transforms without updating any matrices on the live scene. */
function worldPosition(object: THREE.Object3D): THREE.Vector3 {
  const matrix = new THREE.Matrix4();
  const chain: THREE.Object3D[] = [];
  for (let current: THREE.Object3D | null = object; current; current = current.parent)
    chain.unshift(current);
  for (const current of chain) {
    matrix.multiply(
      current.matrixAutoUpdate
        ? new THREE.Matrix4().compose(current.position, current.quaternion, current.scale)
        : current.matrix,
    );
  }
  return new THREE.Vector3().setFromMatrixPosition(matrix);
}
