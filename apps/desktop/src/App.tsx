/**
 * Application root: wires React state, effects, and the R3F scene together.
 *
 * Responsibilities (kept here so leaf components stay pure):
 * - Load the scene whenever the seed changes (stale-guarded).
 * - Fetch detail metadata when the selection changes.
 * - Subscribe to backend magic-field pushes and native menu/tray events.
 * - Own screenshot / glTF / scene-export side effects and keyboard shortcuts.
 */
import type { MagicField } from '@dream-builder/ipc-contracts';
import { GlassProvider } from '@dream-builder/liquid-glass';
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AudioDirector } from './audio/AudioDirector';
import { GamepadNavigator } from './interaction/GamepadNavigator';
import { useKeyboardShortcuts } from './interaction/useKeyboardShortcuts';
import { createAsyncSubscriptionScope } from './ipc/asyncSubscriptionScope';
import { errorMessage } from './ipc/errorMessage';
import { installNativeCloseGuard } from './ipc/nativeCloseGuard';
import { isTauriRuntime } from './ipc/runtime';
import { treeApi } from './ipc/treeApi';
import { performanceCapture } from './performance/performanceCapture';
import type { SceneApi } from './scene/SceneCanvas';
import { readCurrentSettings, useAppStore } from './state/store';
import { ChapterCompleteOverlay } from './ui/ChapterCompleteOverlay';
import { CreditsOverlay } from './ui/CreditsOverlay';
import { GameMenu } from './ui/GameMenu';
import { Hud } from './ui/Hud';
import { MemoryOverlay } from './ui/MemoryOverlay';
import { OnboardingHint, resetOnboardingHint } from './ui/OnboardingHint';
import { ProgressRecoveryNotice } from './ui/ProgressRecoveryNotice';
import { PurificationOverlay } from './ui/PurificationOverlay';
import { SettingsOverlay } from './ui/SettingsOverlay';

const SCENE_LOAD_SETTLE_MS = 1_000;
const sceneCanvasModule = import('./scene/SceneCanvas');
const SceneCanvas = lazy(async () => {
  const module = await sceneCanvasModule;
  return { default: module.SceneCanvas };
});

export function App() {
  const seed = useAppStore((state) => state.seed);
  const scene = useAppStore((state) => state.scene);
  const source = useAppStore((state) => state.source);
  const warning = useAppStore((state) => state.warning);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const graphicsQuality = useAppStore((state) => state.graphicsQuality);
  const masterVolume = useAppStore((state) => state.masterVolume);
  const musicVolume = useAppStore((state) => state.musicVolume);
  const effectsVolume = useAppStore((state) => state.effectsVolume);
  const cameraSensitivity = useAppStore((state) => state.cameraSensitivity);
  const highContrast = useAppStore((state) => state.highContrast);
  const textScale = useAppStore((state) => state.textScale);
  const showHints = useAppStore((state) => state.showHints);
  const sessionMode = useAppStore((state) => state.sessionMode);
  const hudHidden = useAppStore((state) => state.hudHidden);
  const theme = useAppStore((state) => state.theme);
  const selectedId = useAppStore((state) => state.selection.selectedId);
  const applySceneResult = useAppStore((state) => state.applySceneResult);
  const setSelectedDetail = useAppStore((state) => state.setSelectedDetail);
  const setWarning = useAppStore((state) => state.setWarning);
  const setSeed = useAppStore((state) => state.setSeed);
  const toggleHud = useAppStore((state) => state.toggleHud);
  const toggleHelp = useAppStore((state) => state.toggleHelp);
  const setHelpOpen = useAppStore((state) => state.setHelpOpen);
  const clearSelection = useAppStore((state) => state.clearSelection);
  const startGame = useAppStore((state) => state.startGame);
  const pauseGame = useAppStore((state) => state.pauseGame);
  const resumeGame = useAppStore((state) => state.resumeGame);
  const hydrateSettings = useAppStore((state) => state.hydrateSettings);
  const dispatchGameProgress = useAppStore((state) => state.dispatchGameProgress);
  const [settingsReady, setSettingsReady] = useState(false);
  const [onboardingRevision, setOnboardingRevision] = useState(0);

  const fieldRef = useRef<MagicField | null>(null);
  const sceneApiRef = useRef<SceneApi | null>(null);
  const settingsWarningRef = useRef<string | null>(null);

  // --- side-effecting handlers -------------------------------------------
  const handleResetCamera = useCallback(() => sceneApiRef.current?.resetCamera(), []);

  const handleScreenshot = useCallback(async () => {
    try {
      const blob = await sceneApiRef.current?.screenshot();
      if (!blob) throw new Error('场景尚未准备好，请稍后重试。');
      downloadBlob(blob, `dream-builder-${seed}-${Date.now()}.png`);
    } catch (error) {
      setWarning(`截图失败：${errorMessage(error)}`);
    }
  }, [seed, setWarning]);

  const handleExportGltf = useCallback(async () => {
    try {
      const blob = await sceneApiRef.current?.exportGltf();
      if (!blob) throw new Error('场景尚未准备好，请稍后重试。');
      downloadBlob(blob, `dream-builder-${seed}.glb`);
    } catch (error) {
      setWarning(`导出模型失败：${errorMessage(error)}`);
    }
  }, [seed, setWarning]);

  const handleExportScene = useCallback(async () => {
    await exportSceneFile(seed, setWarning);
  }, [seed, setWarning]);

  const handleRestartChapter = useCallback(() => {
    sceneApiRef.current?.restartChapter();
    dispatchGameProgress({ type: 'reset' });
    resetOnboardingHint();
    setOnboardingRevision((revision) => revision + 1);
  }, [dispatchGameProgress]);

  const handleNewGame = useCallback(() => {
    handleRestartChapter();
    startGame();
  }, [handleRestartChapter, startGame]);

  const handleTogglePause = useCallback(() => {
    const mode = useAppStore.getState().sessionMode;
    if (mode === 'playing') {
      pauseGame();
    } else if (mode === 'paused') {
      resumeGame();
    }
  }, [pauseGame, resumeGame]);

  const handleEscape = useCallback(() => {
    if (useAppStore.getState().selection.selectedId) {
      clearSelection();
      return;
    }
    handleTogglePause();
  }, [clearSelection, handleTogglePause]);

  const handleQuit = useCallback(async () => {
    if (!isTauriRuntime()) {
      setWarning('浏览器预览无法直接关闭窗口；桌面版本可从这里安全退出。');
      return;
    }
    try {
      await treeApi.saveSettings(readCurrentSettings());
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    } catch (error) {
      setWarning(`无法关闭窗口：${errorMessage(error)}`);
    }
  }, [setWarning]);

  // Keep the latest action callbacks in a ref so the native-menu subscription
  // can be registered exactly once yet always call current closures.
  const actionsRef = useRef({
    regenerate: () => {},
    resetView: () => {},
    toggleHud: () => {},
    screenshot: () => {},
    about: () => {},
  });
  actionsRef.current = {
    regenerate: () => setSeed(randomSeed()),
    resetView: handleResetCamera,
    toggleHud,
    screenshot: () => void handleScreenshot(),
    about: toggleHelp,
  };

  // --- effects ------------------------------------------------------------
  useEffect(() => {
    let active = true;
    void treeApi
      .getSettings()
      .then((settings) => {
        if (active && settings) hydrateSettings(settings);
      })
      .finally(() => {
        if (active) setSettingsReady(true);
      });
    return () => {
      active = false;
    };
  }, [hydrateSettings]);

  useEffect(() => {
    if (!settingsReady) return;
    let active = true;
    let phaseActive = true;
    let settleTimeout: number | null = null;
    const finishSceneLoadPhase = (marker: string) => {
      if (!phaseActive) return;
      phaseActive = false;
      performanceCapture.mark(marker);
      performanceCapture.endPhase('scene-load');
    };
    performanceCapture.mark('scene-load-started');
    performanceCapture.beginPhase('scene-load');
    void treeApi
      .loadScene(seed)
      .then((result) => {
        if (!active) return;
        applySceneResult(result);
        performanceCapture.mark('scene-data-ready');
        settleTimeout = window.setTimeout(() => {
          settleTimeout = null;
          finishSceneLoadPhase('scene-load-settled');
        }, SCENE_LOAD_SETTLE_MS);
      })
      .catch((error: unknown) => {
        if (!active) return;
        finishSceneLoadPhase('scene-load-failed');
        setWarning(`无法加载场景：${errorMessage(error)}`);
      });
    return () => {
      active = false;
      if (settleTimeout !== null) window.clearTimeout(settleTimeout);
      if (phaseActive) {
        finishSceneLoadPhase('scene-load-cancelled');
      }
    };
  }, [settingsReady, seed, applySceneResult, setWarning]);

  useEffect(() => {
    if (!settingsReady) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      void treeApi
        .saveSettings({
          seed,
          theme,
          reducedMotion,
          graphicsQuality,
          masterVolume,
          musicVolume,
          effectsVolume,
          cameraSensitivity,
          highContrast,
          textScale,
          showHints,
        })
        .then(() => {
          if (!active) return;
          if (settingsWarningRef.current === useAppStore.getState().warning) setWarning(null);
          settingsWarningRef.current = null;
        })
        .catch((error: unknown) => {
          if (!active) return;
          settingsWarningRef.current = `无法保存设置：${errorMessage(error)}`;
          setWarning(settingsWarningRef.current);
        });
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [
    settingsReady,
    seed,
    theme,
    reducedMotion,
    graphicsQuality,
    masterVolume,
    musicVolume,
    effectsVolume,
    cameraSensitivity,
    highContrast,
    textScale,
    showHints,
    setWarning,
  ]);

  useEffect(() => {
    if (!settingsReady || !isTauriRuntime()) return;
    const subscriptions = createAsyncSubscriptionScope((error) => {
      setWarning(`无法保护退出前的设置：${errorMessage(error)}`);
    });
    subscriptions.add(
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) =>
        installNativeCloseGuard(
          getCurrentWindow(),
          () => treeApi.saveSettings(readCurrentSettings()),
          (error) => setWarning(`无法保存设置并退出：${errorMessage(error)}`),
        ),
      ),
    );
    return () => subscriptions.close();
  }, [settingsReady, setWarning]);

  useEffect(() => {
    if (!selectedId || !scene) {
      setSelectedDetail(null);
      return;
    }
    let active = true;
    treeApi
      .loadDetail(selectedId, scene, source ?? 'fallback')
      .then((detail) => {
        if (active) setSelectedDetail(detail);
      })
      .catch((error: unknown) => {
        if (active) setWarning(`无法读取细节信息：${errorMessage(error)}`);
      });
    return () => {
      active = false;
    };
  }, [selectedId, scene, source, setSelectedDetail, setWarning]);

  useEffect(() => {
    const subscriptions = createAsyncSubscriptionScope((error) => {
      setWarning(`原生事件订阅失败：${errorMessage(error)}`);
    });

    subscriptions.add(
      treeApi.listenMagicField((field) => {
        fieldRef.current = field;
      }),
    );
    subscriptions.add(treeApi.listenMenu('regenerate', () => actionsRef.current.regenerate()));
    subscriptions.add(treeApi.listenMenu('reset_view', () => actionsRef.current.resetView()));
    subscriptions.add(treeApi.listenMenu('toggle_hud', () => actionsRef.current.toggleHud()));
    subscriptions.add(treeApi.listenMenu('screenshot', () => actionsRef.current.screenshot()));
    subscriptions.add(treeApi.listenMenu('about', () => actionsRef.current.about()));

    return () => subscriptions.close();
  }, [setWarning]);

  useKeyboardShortcuts({
    onResetCamera: handleResetCamera,
    onToggleHud: toggleHud,
    onToggleFullscreen: toggleFullscreen,
    onScreenshot: () => void handleScreenshot(),
    onEscape: handleEscape,
    onToggleHelp: toggleHelp,
    onRegenerate: () => setSeed(randomSeed()),
  });

  return (
    <GlassProvider
      theme={theme}
      quality={graphicsQuality}
      className={[
        'app-root',
        reducedMotion ? 'app-root--reduced-motion' : '',
        highContrast ? 'app-root--high-contrast' : '',
        textScale === 'large' ? 'app-root--large-text' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={['app-shell', hudHidden ? 'hud-hidden' : '', `app-shell--${sessionMode}`]
          .filter(Boolean)
          .join(' ')}
      >
        <AudioDirector />
        <GamepadNavigator />
        <div className="scene-host">
          {scene ? (
            <Suspense fallback={<SceneLoading />}>
              <SceneCanvas
                scene={scene}
                reducedMotion={reducedMotion}
                fieldRef={fieldRef}
                apiRef={sceneApiRef}
              />
            </Suspense>
          ) : (
            <SceneLoading />
          )}
        </div>
        {sessionMode !== 'title' ? (
          <Hud
            onResetCamera={handleResetCamera}
            onScreenshot={() => void handleScreenshot()}
            onExport={() => void handleExportGltf()}
            onExportScene={() => void handleExportScene()}
            onOpenMenu={pauseGame}
            onRestartChapter={handleRestartChapter}
          />
        ) : null}
        <MemoryOverlay />
        <PurificationOverlay />
        {showHints && sessionMode === 'playing' ? (
          <OnboardingHint key={onboardingRevision} />
        ) : null}
        <GameMenu
          onNewGame={handleNewGame}
          onOpenHelp={() => setHelpOpen(true)}
          onQuit={() => void handleQuit()}
        />
        <SettingsOverlay />
        <CreditsOverlay />
        <ProgressRecoveryNotice />
        <ChapterCompleteOverlay onScreenshot={() => void handleScreenshot()} />
        {warning ? (
          <div className="app-warning" role="alert">
            {warning}
          </div>
        ) : null}
      </div>
    </GlassProvider>
  );
}

function SceneLoading() {
  return (
    <div className="scene-loading" role="status">
      <span className="scene-loading__orb" aria-hidden="true" />
      <strong>正在唤醒森林</strong>
      <span>让光穿过树冠……</span>
    </div>
  );
}

function randomSeed(): number {
  return Math.floor(Math.random() * 4294967295);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}

async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    // Some webviews disallow fullscreen; best-effort.
  }
}

/** Native scene export: pick a path via the dialog plugin, write via Rust. */
async function exportSceneFile(
  seed: number,
  setWarning: (message: string | null) => void,
): Promise<void> {
  if (!isTauriRuntime()) {
    setWarning('导出场景文件需要在桌面应用中运行。');
    return;
  }
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({
      defaultPath: `dream-builder-${seed}.json`,
      filters: [{ name: 'Scene JSON', extensions: ['json'] }],
    });
    if (!path) return;
    await treeApi.exportScene(path, seed);
    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
      await revealItemInDir(path);
    } catch {
      // revealing is a nicety; ignore failures.
    }
    setWarning(null);
  } catch (error) {
    setWarning(`导出场景失败：${errorMessage(error)}`);
  }
}
