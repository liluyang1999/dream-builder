import { parseWith, treeSceneSchema } from '@dream-builder/ipc-contracts';
import { describe, expect, test } from 'vitest';
import { createFallbackTreeScene } from '../data/fallbackTree';

describe('createFallbackTreeScene', () => {
  test('creates a usable minimal scene', () => {
    const scene = createFallbackTreeScene(11);

    expect(scene.branches.length).toBeGreaterThan(0);
    expect(scene.leafClusters.length).toBeGreaterThan(0);
    expect(scene.runes.length).toBeGreaterThan(0);
    expect(scene.crystals.length).toBeGreaterThan(0);
    expect(scene.details.length).toBeGreaterThan(0);
  });

  test('satisfies the shared TreeScene contract', () => {
    const result = parseWith(treeSceneSchema, createFallbackTreeScene(11));
    expect(result.ok).toBe(true);
  });

  test('creates unique interactive ids', () => {
    const scene = createFallbackTreeScene(11);
    const ids = [...scene.runes, ...scene.crystals, ...scene.leafClusters].map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
