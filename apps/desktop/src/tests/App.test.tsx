import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const captures = vi.hoisted(() => ({ screenshot: vi.fn(), exportGltf: vi.fn() }));
const native = vi.hoisted(() => ({
  present: false,
  close: vi.fn(async () => {}),
  onClose: null as ((event: { preventDefault(): void }) => Promise<void>) | null,
}));
vi.mock('../ipc/runtime', () => ({ isTauriRuntime: () => native.present }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    close: native.close,
    onCloseRequested: async (handler: NonNullable<typeof native.onClose>) => {
      native.onClose = handler;
      return () => {
        native.onClose = null;
      };
    },
  }),
}));
vi.mock('../scene/SceneCanvas', () => ({
  SceneCanvas: ({ apiRef }: { apiRef: { current: unknown } }) => {
    apiRef.current = captures;
    return null;
  },
}));
vi.mock('../ipc/treeApi', () => ({
  treeApi: {
    getSettings: async () => null,
    loadScene: vi.fn(async () => ({ scene: null, source: 'fallback', warning: null })),
    saveSettings: vi.fn(async () => {}),
    listenMagicField: async () => () => {},
    listenMenu: async () => () => {},
  },
}));
vi.mock('../audio/AudioDirector', () => ({ AudioDirector: () => null }));
vi.mock('../interaction/GamepadNavigator', () => ({ GamepadNavigator: () => null }));
vi.mock('../ui/ChapterCompleteOverlay', () => ({ ChapterCompleteOverlay: () => null }));
vi.mock('../ui/CreditsOverlay', () => ({ CreditsOverlay: () => null }));
vi.mock('../ui/GameMenu', () => ({
  GameMenu: ({ onQuit }: { onQuit(): void }) => (
    <button type="button" onClick={onQuit}>
      退出
    </button>
  ),
}));
vi.mock('../ui/MemoryOverlay', () => ({ MemoryOverlay: () => null }));
vi.mock('../ui/OnboardingHint', () => ({
  OnboardingHint: () => null,
  resetOnboardingHint: vi.fn(),
}));
vi.mock('../ui/ProgressRecoveryNotice', () => ({ ProgressRecoveryNotice: () => null }));
vi.mock('../ui/PurificationOverlay', () => ({ PurificationOverlay: () => null }));
vi.mock('../ui/SettingsOverlay', () => ({ SettingsOverlay: () => null }));
vi.mock('../ui/Hud', () => ({
  Hud: ({ onScreenshot, onExport }: { onScreenshot(): void; onExport(): void }) => (
    <>
      <button type="button" onClick={onScreenshot}>
        截图
      </button>
      <button type="button" onClick={onExport}>
        导出模型
      </button>
    </>
  ),
}));

import { App } from '../App';
import { createFallbackTreeScene } from '../data/fallbackTree';
import { treeApi } from '../ipc/treeApi';
import { useAppStore } from '../state/store';

describe('App capture failure recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    native.present = false;
    native.onClose = null;
    vi.mocked(treeApi.saveSettings).mockReset().mockResolvedValue(undefined);
    const scene = createFallbackTreeScene(11);
    vi.mocked(treeApi.loadScene).mockResolvedValue({ scene, source: 'fallback', warning: null });
    useAppStore.setState({
      scene,
      seed: 11,
      sessionMode: 'playing',
      warning: null,
      showHints: false,
      settingsOpen: false,
      hudHidden: false,
    });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test.each([
    ['截图', 'screenshot', '截图失败'],
    ['导出模型', 'exportGltf', '导出模型失败'],
  ] as const)('shows recoverable feedback when %s rejects', async (label, method, message) => {
    captures[method].mockRejectedValue({ code: 'IO_ERROR', message: '磁盘不可用' });
    render(<App />);
    await waitFor(() => expect(treeApi.loadScene).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: label }));

    await waitFor(() => expect(useAppStore.getState().warning).toBe(`${message}：磁盘不可用`));
  });

  test('flushes the latest preferences before an in-app quit inside the debounce window', async () => {
    vi.useFakeTimers();
    native.present = true;
    let finishSave!: () => void;
    vi.mocked(treeApi.saveSettings).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );
    await act(async () => {
      render(<App />);
    });
    act(() => useAppStore.getState().setMasterVolume(31));
    fireEvent.click(screen.getByRole('button', { name: '退出' }));

    expect(treeApi.saveSettings).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ masterVolume: 31 }),
    );
    expect(native.close).not.toHaveBeenCalled();
    await act(async () => {
      finishSave();
    });
    expect(native.close).toHaveBeenCalledTimes(1);
  });

  test.each(['title', 'settings'] as const)(
    'shows a single global native-close error on the %s screen even without visible HUD',
    async (screenMode) => {
      vi.useFakeTimers();
      native.present = true;
      useAppStore.setState({
        sessionMode: screenMode === 'title' ? 'title' : 'paused',
        settingsOpen: screenMode === 'settings',
        hudHidden: true,
      });
      await act(async () => {
        render(<App />);
      });
      vi.mocked(treeApi.saveSettings).mockRejectedValueOnce({
        code: 'IO_ERROR',
        message: '磁盘不可用',
      });
      expect(native.onClose).not.toBeNull();
      await act(async () => {
        await native.onClose?.({ preventDefault: vi.fn() });
      });

      expect(native.close).not.toHaveBeenCalled();
      expect(screen.getAllByRole('alert')).toHaveLength(1);
      expect(screen.getByRole('alert').textContent).toBe('无法保存设置并退出：磁盘不可用');
    },
  );

  test.each([false, true])(
    'clears a recovered save warning without erasing a newer warning (%s)',
    async (newerWarning) => {
      vi.useFakeTimers();
      vi.mocked(treeApi.saveSettings).mockRejectedValueOnce({
        code: 'IO_ERROR',
        message: '磁盘不可用',
      });
      await act(async () => {
        render(<App />);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(150);
      });
      expect(useAppStore.getState().warning).toBe('无法保存设置：磁盘不可用');
      act(() => {
        useAppStore.getState().setMusicVolume(useAppStore.getState().musicVolume === 24 ? 25 : 24);
        if (newerWarning) useAppStore.getState().setWarning('场景加载失败');
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(150);
      });
      expect(useAppStore.getState().warning).toBe(newerWarning ? '场景加载失败' : null);
    },
  );
});
