import * as THREE from 'three';
import type { BranchSegment, CrystalCluster, LeafCluster, RuneMark, TreeScene, Vec3 } from '../types/tree';

export interface TreeObjects {
  group: THREE.Group;
  interactive: THREE.Object3D[];
  labels: Map<string, string>;
}

export function createTreeObjects(scene: TreeScene): TreeObjects {
  const group = new THREE.Group();
  group.name = 'fantasy-tree';

  const interactive: THREE.Object3D[] = [];
  const labels = new Map(scene.details.map((detail) => [detail.id, detail.title]));

  const bark = new THREE.MeshStandardMaterial({
    color: new THREE.Color(scene.palette.bark),
    roughness: 0.74,
    metalness: 0.04,
    emissive: new THREE.Color('#241007'),
    emissiveIntensity: 0.08,
  });

  for (const branch of scene.branches) {
    group.add(createBranchMesh(branch, bark));
  }

  for (const leaf of scene.leafClusters) {
    const mesh = createLeafCluster(leaf, scene.palette.leaves);
    markInteractive(mesh, leaf.id, 'leaf');
    interactive.push(mesh);
    group.add(mesh);
  }

  for (const rune of scene.runes) {
    const sprite = createRuneSprite(rune, scene.palette.glow);
    markInteractive(sprite, rune.id, 'rune');
    interactive.push(sprite);
    group.add(sprite);
  }

  for (const crystal of scene.crystals) {
    const mesh = createCrystal(crystal, scene.palette.crystal);
    markInteractive(mesh, crystal.id, 'crystal');
    interactive.push(mesh);
    group.add(mesh);
  }

  group.add(createGroundHalo());

  return { group, interactive, labels };
}

function createBranchMesh(branch: BranchSegment, material: THREE.Material): THREE.Mesh {
  const start = toVector3(branch.start);
  const end = toVector3(branch.end);
  const direction = new THREE.Vector3().subVectors(end, start);
  const height = Math.max(direction.length(), 0.001);
  const geometry = new THREE.CylinderGeometry(branch.radiusEnd, branch.radiusStart, height, 10, 4, false);
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.rotateY(branch.twist);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function createLeafCluster(cluster: LeafCluster, fallbackColor: string): THREE.InstancedMesh {
  const count = Math.min(Math.max(cluster.density, 6), 64);
  const geometry = new THREE.IcosahedronGeometry(0.08, 0);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(cluster.hue, 0.62, 0.42),
    emissive: new THREE.Color(fallbackColor),
    emissiveIntensity: 0.12,
    roughness: 0.58,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const rng = createHashRng(cluster.id);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  for (let index = 0; index < count; index += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = Math.cbrt(rng()) * cluster.radius;
    position.set(
      cluster.position.x + Math.cos(angle) * radius,
      cluster.position.y + (rng() - 0.5) * cluster.radius * 0.78,
      cluster.position.z + Math.sin(angle) * radius,
    );
    quaternion.setFromEuler(new THREE.Euler(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI));
    const leafScale = 0.8 + rng() * 1.9;
    scale.set(leafScale * 1.4, leafScale * 0.62, leafScale);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function createRuneSprite(rune: RuneMark, color: string): THREE.Sprite {
  const texture = createGlyphTexture(rune.glyph, color);
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: new THREE.Color(color),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(toVector3(rune.position));
  sprite.scale.setScalar(0.34 + rune.intensity * 0.12);
  return sprite;
}

function createCrystal(crystal: CrystalCluster, color: string): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(crystal.hue, 0.72, 0.58),
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.72,
    roughness: 0.18,
    metalness: 0.08,
  });
  const geometry = new THREE.OctahedronGeometry(crystal.scale, 0);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.set(0.4, 0.2, -0.2);
  group.add(mesh);

  const light = new THREE.PointLight(new THREE.Color(color), 0.8, 1.8);
  group.add(light);
  group.position.copy(toVector3(crystal.position));
  return group;
}

function createGroundHalo(): THREE.Mesh {
  const geometry = new THREE.RingGeometry(0.72, 2.2, 96);
  const material = new THREE.MeshBasicMaterial({
    color: 0x37d6b0,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.015;
  return mesh;
}

function markInteractive(object: THREE.Object3D, detailId: string, kind: string): void {
  object.userData.detailId = detailId;
  object.userData.kind = kind;
  object.userData.baseScale = object.scale.clone();
  object.traverse((child) => {
    child.userData.detailId = detailId;
    child.userData.kind = kind;
  });
}

function createGlyphTexture(glyph: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('无法创建符文纹理。');
  }
  context.clearRect(0, 0, 128, 128);
  context.shadowColor = color;
  context.shadowBlur = 22;
  context.strokeStyle = color;
  context.lineWidth = 8;
  context.beginPath();
  context.arc(64, 64, 42, 0, Math.PI * 2);
  context.stroke();
  context.font = '700 58px serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#fff3bd';
  context.fillText(glyph, 64, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function toVector3(vec: Vec3): THREE.Vector3 {
  return new THREE.Vector3(vec.x, vec.y, vec.z);
}

function createHashRng(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
