import type { TreeScene } from '../types/tree';

const GLYPHS = ['A', 'E', 'I', 'O', 'U', 'R', 'S', 'T'];

export function createFallbackTreeScene(seed: number): TreeScene {
  const rng = mulberry32((seed >>> 0) || 1);
  const jitter = (mid: number, span: number) => mid + (rng() - 0.5) * span;

  const leafSlots = [
    { x: -1.5, z: -0.3 },
    { x: 1.5, z: 0.35 },
    { x: 0.65, z: 1.5 },
    { x: -0.7, z: -1.4 },
  ];

  const leafClusters = leafSlots.map((slot, index) => ({
    id: `leaf-${index}`,
    position: { x: jitter(slot.x, 0.45), y: jitter(3.85, 0.45), z: jitter(slot.z, 0.45) },
    radius: clamp(jitter(0.85, 0.22), 0.4, 1.2),
    density: Math.round(clamp(jitter(28, 10), 14, 42)),
    hue: clamp(jitter(0.5, 0.16), 0.32, 0.68),
  }));

  const runes = Array.from({ length: 3 }, (_, index) => {
    const angle = (index / 3) * Math.PI * 2 + jitter(0, 0.4);
    return {
      id: `rune-${index}`,
      position: { x: Math.cos(angle) * 0.34, y: jitter(1.4, 0.7), z: Math.sin(angle) * 0.34 },
      normal: { x: Math.cos(angle), y: 0, z: Math.sin(angle) },
      glyph: GLYPHS[Math.floor(rng() * GLYPHS.length)],
      intensity: clamp(jitter(0.82, 0.2), 0.4, 1),
    };
  });

  const crystals = Array.from({ length: 2 }, (_, index) => {
    const angle = jitter(index * Math.PI, 0.6);
    return {
      id: `crystal-${index}`,
      position: {
        x: Math.cos(angle) * jitter(0.9, 0.3),
        y: jitter(2.9, 0.45),
        z: Math.sin(angle) * jitter(0.9, 0.3),
      },
      scale: clamp(jitter(0.32, 0.1), 0.18, 0.46),
      hue: clamp(jitter(0.74, 0.06), 0.66, 0.82),
    };
  });

  const branches = [
    {
      id: 'branch-trunk',
      start: { x: 0, y: 0, z: 0 },
      end: { x: jitter(0, 0.12), y: jitter(3.2, 0.32), z: jitter(0, 0.12) },
      radiusStart: 0.42,
      radiusEnd: 0.18,
      twist: jitter(0.2, 0.6),
      level: 0,
    },
    ...leafClusters.map((leaf, index) => ({
      id: `branch-arm-${index}`,
      start: { x: jitter(0, 0.18), y: jitter(2.3, 0.32), z: jitter(0, 0.18) },
      end: { x: leaf.position.x, y: leaf.position.y - 0.45, z: leaf.position.z },
      radiusStart: clamp(jitter(0.16, 0.04), 0.08, 0.22),
      radiusEnd: clamp(jitter(0.06, 0.02), 0.03, 0.09),
      twist: jitter(0, 1),
      level: 1,
    })),
  ];

  const details = [
    ...leafClusters.map((leaf, i) => ({
      id: leaf.id,
      kind: 'leaf' as const,
      title: `星雾叶簇 ${i + 1}`,
      description: '叶簇会在鼠标掠过时泛起青绿色微光，点击放大附近的魔法场。',
      energy: clamp(jitter(0.6, 0.22), 0, 1),
    })),
    ...runes.map((rune, i) => ({
      id: rune.id,
      kind: 'rune' as const,
      title: `树心符文 ${i + 1}`,
      description: '树皮里的金色纹路记录着古树的年轮和魔法流向。',
      energy: clamp(jitter(0.84, 0.14), 0, 1),
    })),
    ...crystals.map((crystal, i) => ({
      id: crystal.id,
      kind: 'crystal' as const,
      title: `暮光水晶 ${i + 1}`,
      description: '紫色晶体会在选中后增强附近 Bloom，并向树冠释放脉冲光。',
      energy: clamp(jitter(0.74, 0.16), 0, 1),
    })),
  ];

  return {
    seed,
    branches,
    leafClusters,
    runes,
    crystals,
    details,
    palette: {
      bark: '#5b3728',
      leaves: '#37d6b0',
      glow: '#f7c76b',
      crystal: '#9d70ff',
      backgroundTop: '#070914',
      backgroundBottom: '#13251f',
    },
  };
}

function mulberry32(initial: number): () => number {
  let state = initial >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
