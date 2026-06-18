import { describe, expect, test } from 'vitest';
import { type TreeScene, parseWith, treeSceneSchema } from './index';

function makeValidScene(): TreeScene {
  const vec = { x: 0, y: 1, z: 0 };
  return {
    seed: 7,
    branches: [
      {
        id: 'branch-0',
        start: vec,
        end: { x: 0, y: 2, z: 0 },
        radiusStart: 0.4,
        radiusEnd: 0.2,
        twist: 0.1,
        level: 0,
      },
    ],
    leafClusters: [{ id: 'leaf-0', position: vec, radius: 0.6, density: 20, hue: 0.5 }],
    runes: [{ id: 'rune-0', position: vec, normal: vec, glyph: 'A', intensity: 0.8 }],
    crystals: [{ id: 'crystal-0', position: vec, scale: 0.3, hue: 0.7 }],
    details: [
      { id: 'leaf-0', kind: 'leaf', title: 't', description: 'd', energy: 0.5 },
      { id: 'rune-0', kind: 'rune', title: 't', description: 'd', energy: 0.9 },
      { id: 'crystal-0', kind: 'crystal', title: 't', description: 'd', energy: 0.7 },
    ],
    palette: {
      bark: '#000',
      leaves: '#0f0',
      glow: '#ff0',
      crystal: '#90f',
      backgroundTop: '#001',
      backgroundBottom: '#012',
    },
  };
}

describe('treeSceneSchema', () => {
  test('accepts a complete, finite, consistent scene', () => {
    expect(parseWith(treeSceneSchema, makeValidScene())).toEqual({
      ok: true,
      value: makeValidScene(),
    });
  });

  test('rejects non-finite coordinates', () => {
    const scene = makeValidScene();
    const branch = scene.branches[0];
    if (!branch) throw new Error('fixture has a branch');
    branch.start.x = Number.NaN;
    const result = parseWith(treeSceneSchema, scene);
    expect(result.ok).toBe(false);
  });

  test('rejects duplicate interactive ids', () => {
    const scene = makeValidScene();
    const rune = scene.runes[0];
    const crystal = scene.crystals[0];
    if (!rune || !crystal) throw new Error('fixture has a rune and crystal');
    rune.id = crystal.id;
    const result = parseWith(treeSceneSchema, scene);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('duplicate');
  });

  test('rejects energy out of [0,1]', () => {
    const scene = makeValidScene();
    const detail = scene.details[0];
    if (!detail) throw new Error('fixture has a detail');
    detail.energy = 1.5;
    expect(parseWith(treeSceneSchema, scene).ok).toBe(false);
  });
});
