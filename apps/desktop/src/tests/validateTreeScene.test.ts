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
    const firstBranch = scene.branches[0];
    if (!firstBranch) throw new Error('expected at least one branch');
    firstBranch.start.x = Number.NaN;

    const result = validateTreeScene(scene);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('branches[0].start.x');
    }
  });

  test('rejects duplicate interactive ids', () => {
    const scene = createFallbackTreeScene(7);
    const firstRune = scene.runes[0];
    const firstCrystal = scene.crystals[0];
    if (!firstRune || !firstCrystal) throw new Error('expected a rune and a crystal');
    firstRune.id = firstCrystal.id;

    const result = validateTreeScene(scene);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('duplicate');
    }
  });
});
