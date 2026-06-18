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
import { useCallback, useEffect, useRef } from 'react';
import { useKeyboardShortcuts } from './interaction/useKeyboardShortcuts';
import { isTauriRuntime } from './ipc/runtime';
import { treeApi } from './ipc/treeApi';
import { type SceneApi, SceneCanvas } from './scene/SceneCanvas';
import { useAppStore } from './state/store';
import { Hud } from './ui/Hud';
import { OnboardingHint } from './ui/OnboardingHint';

export function App() {
  const seed = useAppStore((state) => state.seed);
  const scene = useAppStore((state) => state.scene);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const hudHidden = useAppStore((state) => state.hudHidden);
  const theme = useAppStore((state) => state.theme);
  const selectedId = useAppStore((state) => state.selection.selectedId);
  const applySceneResult = useAppStore((state) => state.applySceneResult);
  const setSelectedDetail = useAppStore((state) => state.setSelectedDetail);
  const setWarning = useAppStore((state) => state.setWarning);
  const setSeed = useAppStore((state) => state.setSeed);
  const toggleHud = useAppStore((state) => state.toggleHud);
  const toggleHelp = useAppStore((state) => state.toggleHelp);
  const clearSelection = useAppStore((state) => state.clearSelection);
  const hydrateSettings = useAppStore((state) => state.hydrateSettings);

  const fieldRef = useRef<MagicField | null>(null);
  const sceneApiRef = useRef<SceneApi | null>(null);

  // --- side-effecting handlers -------------------------------------------
  const handleResetCamera = useCallback(() => sceneApiRef.current?.resetCamera(), []);

  const handleScreenshot = useCallback(async () => {
    const blob = await sceneApiRef.current?.screenshot();
    if (blob) downloadBlob(blob, `dream-builder-${seed}-${Date.now()}.png`);
  }, [seed]);

  const handleExportGltf = useCallback(async () => {
    const blob = await sceneApiRef.current?.exportGltf();
    if (blob) downloadBlob(blob, `dream-builder-${seed}.glb`);
  }, [seed]);

  const handleExportScene = useCallback(async () => {
    await exportSceneFile(seed, setWarning);
  }, [seed, setWarning]);

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
    void treeApi.getSettings().then((settings) => {
      if (active && settings) hydrateSettings(settings);
    });
    return () => {
      active = false;
    };
  }, [hydrateSettings]);

  useEffect(() => {
    let active = true;
    void treeApi.loadScene(seed).then((result) => {
      if (active) applySceneResult(result);
    });
    return () => {
      active = false;
    };
  }, [seed, applySceneResult]);

  useEffect(() => {
    if (!selectedId || !scene) {
      setSelectedDetail(null);
      return;
    }
    let active = true;
    treeApi
      .loadDetail(selectedId, scene)
      .then((detail) => {
        if (active) setSelectedDetail(detail);
      })
      .catch((error: unknown) => {
        if (active) setWarning(`无法读取细节信息：${errorMessage(error)}`);
      });
    return () => {
      active = false;
    };
  }, [selectedId, scene, setSelectedDetail, setWarning]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void treeApi
      .listenMagicField((field) => {
        fieldRef.current = field;
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];
    const register = async (id: string, run: () => void): Promise<void> => {
      unsubscribers.push(await treeApi.listenMenu(id, run));
    };
    void register('regenerate', () => actionsRef.current.regenerate());
    void register('reset_view', () => actionsRef.current.resetView());
    void register('toggle_hud', () => actionsRef.current.toggleHud());
    void register('screenshot', () => actionsRef.current.screenshot());
    void register('about', () => actionsRef.current.about());
    return () => {
      for (const fn of unsubscribers) fn();
    };
  }, []);

  useKeyboardShortcuts({
    onResetCamera: handleResetCamera,
    onToggleHud: toggleHud,
    onToggleFullscreen: toggleFullscreen,
    onScreenshot: () => void handleScreenshot(),
    onDeselect: clearSelection,
    onToggleHelp: toggleHelp,
    onRegenerate: () => setSeed(randomSeed()),
  });

  return (
    <GlassProvider theme={theme} className="app-root">
      <div className={hudHidden ? 'app-shell hud-hidden' : 'app-shell'}>
        <div className="scene-host">
          {scene ? (
            <SceneCanvas
              scene={scene}
              reducedMotion={reducedMotion}
              fieldRef={fieldRef}
              apiRef={sceneApiRef}
            />
          ) : null}
        </div>
        <Hud
          onResetCamera={handleResetCamera}
          onScreenshot={() => void handleScreenshot()}
          onExport={() => void handleExportGltf()}
          onExportScene={() => void handleExportScene()}
        />
        <OnboardingHint />
      </div>
    </GlassProvider>
  );
}

function randomSeed(): number {
  return Math.floor(Math.random() * 4294967295);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
