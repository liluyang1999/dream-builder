import { DEFAULT_SETTINGS, parseWith, settingsSchema } from '@dream-builder/ipc-contracts';
import { describe, expect, test } from 'vitest';

describe('settings IPC contract', () => {
  test('fills new product preferences when reading a legacy snapshot', () => {
    const parsed = parseWith(settingsSchema, {
      seed: 77,
      theme: 'dark',
      reducedMotion: true,
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toEqual({
      ...DEFAULT_SETTINGS,
      seed: 77,
      theme: 'dark',
      reducedMotion: true,
    });
  });

  test('rejects settings outside user-facing bounds', () => {
    expect(
      parseWith(settingsSchema, {
        ...DEFAULT_SETTINGS,
        masterVolume: 101,
      }).ok,
    ).toBe(false);
    expect(
      parseWith(settingsSchema, {
        ...DEFAULT_SETTINGS,
        cameraSensitivity: 49,
      }).ok,
    ).toBe(false);
  });
});
