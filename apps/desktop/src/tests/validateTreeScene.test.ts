import { describe, expect, test } from 'vitest';
import { createFallbackTreeScene } from '../data/fallbackTree';
import { validateTreeScene } from '../data/validateTreeScene';

describe('validateTreeScene', () => {
  test('accepts a complete finite tree scene', () => {
    const scene = createFallbackTreeScene(7);

    expect(validateTreeScene(scene)).toEqual({ ok: true });
  });

  test('rejects malformed branch coordinates', () => {
    const scene = createFallbackTreeScene(7);
    scene.branches[0].start.x = Number.NaN;

    const result = validateTreeScene(scene);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('branches[0].start.x');
    }
  });

  test('rejects duplicate interactive ids', () => {
    const scene = createFallbackTreeScene(7);
    scene.runes[0].id = scene.crystals[0].id;

    const result = validateTreeScene(scene);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('duplicate');
    }
  });
});
