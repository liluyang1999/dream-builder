import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const native = vi.hoisted(() => ({ invoke: vi.fn(), present: true }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: native.invoke }));
vi.mock('../ipc/runtime', () => ({ isTauriRuntime: () => native.present }));

import { DEFAULT_SETTINGS } from '@dream-builder/ipc-contracts';
import { createFallbackTreeScene } from '../data/fallbackTree';
import { treeApi } from '../ipc/treeApi';

describe('tree IPC degradation', () => {
  beforeEach(() => {
    native.present = true;
    native.invoke.mockReset();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  test('uses metadata from the displayed fallback scene inside a native shell', async () => {
    const scene = createFallbackTreeScene(11);
    native.invoke.mockRejectedValue({ code: 'UNAVAILABLE', message: '后端不可用' });

    await expect(treeApi.loadDetail('leaf-0', scene, 'fallback')).resolves.toEqual(
      scene.details[0],
    );
    expect(native.invoke).not.toHaveBeenCalled();
  });

  test('rejects metadata for a different selected id', async () => {
    const scene = createFallbackTreeScene(11);
    native.invoke.mockResolvedValue(scene.details[1]);

    await expect(treeApi.loadDetail('leaf-0', scene, 'rust')).rejects.toThrow('细节数据');
  });

  test('preserves readable structured native errors when falling back', async () => {
    native.invoke.mockRejectedValue({ code: 'UNAVAILABLE', message: '后端不可用' });

    const result = await treeApi.loadScene(11);
    expect(result.source).toBe('fallback');
    expect(result.scene.seed).toBe(11);
    expect(result.warning).toBe('无法调用 Rust 后端：后端不可用');
  });

  test('serializes settings snapshots and lets a newer save recover from an earlier rejection', async () => {
    let failFirst!: (error: Error) => void;
    native.invoke
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            failFirst = reject;
          }),
      )
      .mockResolvedValueOnce(undefined);
    const first = treeApi.saveSettings({ ...DEFAULT_SETTINGS, masterVolume: 31 });
    const failed = expect(first).rejects.toThrow('first save failed');
    const second = treeApi.saveSettings({ ...DEFAULT_SETTINGS, masterVolume: 32 });
    await Promise.resolve();
    await Promise.resolve();
    expect(native.invoke).toHaveBeenCalledTimes(1);
    failFirst(new Error('first save failed'));
    await failed;
    await second;

    expect(native.invoke).toHaveBeenNthCalledWith(2, 'save_settings', {
      settings: { ...DEFAULT_SETTINGS, masterVolume: 32 },
    });
  });
});
