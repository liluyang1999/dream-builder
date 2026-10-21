import type { Settings } from '@dream-builder/ipc-contracts';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

const loading = vi.hoisted(() => ({
  sceneAttempts: 0,
  finishSettings: null as ((settings: Settings | null) => void) | null,
}));
vi.mock('../scene/SceneCanvas', () => {
  loading.sceneAttempts += 1;
  throw new Error('scene module unavailable');
});
vi.mock('../ipc/treeApi', async () => {
  const { createFallbackTreeScene } = await import('../data/fallbackTree');
  return {
    treeApi: {
      getSettings: () =>
        new Promise<Settings | null>((resolve) => {
          loading.finishSettings = resolve;
        }),
      loadScene: async (seed: number) => ({
        scene: createFallbackTreeScene(seed),
        source: 'fallback',
        warning: null,
      }),
      saveSettings: async () => {},
      listenMagicField: async () => () => {},
      listenMenu: async () => () => {},
    },
  };
});
vi.mock('../audio/AudioDirector', () => ({ AudioDirector: () => null }));
vi.mock('../interaction/GamepadNavigator', () => ({ GamepadNavigator: () => null }));

import { AppErrorBoundary } from '../ui/AppErrorBoundary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('loads the scene module inside the error boundary after settings hydration', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { App } = await import('../App');
  render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>,
  );
  await vi.dynamicImportSettled();

  expect(loading.sceneAttempts).toBe(0);
  await act(async () => loading.finishSettings?.(null));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(loading.sceneAttempts).toBe(1);
  expect(screen.getByRole('button', { name: '重新载入游戏' })).toBeTruthy();
});
