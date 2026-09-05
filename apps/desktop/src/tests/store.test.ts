import { DEFAULT_SETTINGS, type TreeScene } from '@dream-builder/ipc-contracts';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { INITIAL_GAME_PROGRESS, parseStoredGameProgress } from '../game/gameProgress';
import { useAppStore } from '../state/store';

function reset(): void {
  localStorage.clear();
  useAppStore.setState({
    seed: 424242,
    scene: null,
    source: null,
    warning: null,
    selection: { hoveredId: null, selectedId: null },
    selectedDetail: null,
    theme: 'auto',
    reducedMotion: false,
    graphicsQuality: DEFAULT_SETTINGS.graphicsQuality,
    masterVolume: DEFAULT_SETTINGS.masterVolume,
    musicVolume: DEFAULT_SETTINGS.musicVolume,
    effectsVolume: DEFAULT_SETTINGS.effectsVolume,
    cameraSensitivity: DEFAULT_SETTINGS.cameraSensitivity,
    highContrast: DEFAULT_SETTINGS.highContrast,
    textScale: DEFAULT_SETTINGS.textScale,
    showHints: DEFAULT_SETTINGS.showHints,
    sessionMode: 'title',
    settingsOpen: false,
    creditsOpen: false,
    history: [],
    progress: INITIAL_GAME_PROGRESS,
    interactionPrompt: null,
    activeMemoryId: null,
    progressRecoveryStatus: 'none',
    chapterCompleteOpen: false,
    helpOpen: false,
    hudHidden: false,
  });
}

const sceneWithSeed = (seed: number): TreeScene => ({ seed }) as unknown as TreeScene;

describe('app store', () => {
  beforeEach(reset);

  test('hover/select/clear go through the selection reducer', () => {
    const store = useAppStore.getState();
    store.hover('leaf-0');
    expect(useAppStore.getState().selection.hoveredId).toBe('leaf-0');

    store.select('leaf-0');
    expect(useAppStore.getState().selection.selectedId).toBe('leaf-0');

    store.clearSelection();
    expect(useAppStore.getState().selection.selectedId).toBeNull();
  });

  test('empty click id is ignored by the reducer', () => {
    useAppStore.getState().select('   ');
    expect(useAppStore.getState().selection.selectedId).toBeNull();
  });

  test.each(['toggleHelp', 'setHelpOpen'] as const)(
    '%s reveals a hidden HUD before opening help',
    (action) => {
      useAppStore.getState().toggleHud();
      useAppStore.getState()[action](true);

      expect(useAppStore.getState().helpOpen).toBe(true);
      expect(useAppStore.getState().hudHidden).toBe(false);
    },
  );

  test.each([1.5, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid seed %s before changing state or storage',
    (seed) => {
      useAppStore.getState().setSeed(seed);
      expect(useAppStore.getState().seed).toBe(424242);
      expect(localStorage.getItem('dream-builder.seed')).toBeNull();
    },
  );

  test('scene history is most-recent-first and deduplicated', () => {
    const { applySceneResult } = useAppStore.getState();
    applySceneResult({ scene: sceneWithSeed(1), source: 'rust', warning: null });
    applySceneResult({ scene: sceneWithSeed(2), source: 'rust', warning: null });
    applySceneResult({ scene: sceneWithSeed(1), source: 'rust', warning: null });

    const { history } = useAppStore.getState();
    expect(history[0]).toBe(1);
    expect(history.filter((s) => s === 1)).toHaveLength(1);
  });

  test('hydrates the persisted seed and preferences as one settings snapshot', () => {
    useAppStore.getState().select('leaf-0');
    useAppStore.getState().hydrateSettings({
      ...DEFAULT_SETTINGS,
      seed: 77,
      theme: 'dark',
      reducedMotion: true,
      masterVolume: 42,
      highContrast: true,
    });

    const state = useAppStore.getState();
    expect(state.seed).toBe(77);
    expect(state.theme).toBe('dark');
    expect(state.reducedMotion).toBe(true);
    expect(state.masterVolume).toBe(42);
    expect(state.highContrast).toBe(true);
    expect(state.selection.selectedId).toBeNull();
    expect(localStorage.getItem('dream-builder.seed')).toBe('77');
  });

  test('clamps numeric preferences to their supported ranges', () => {
    const state = useAppStore.getState();
    state.setMasterVolume(120);
    state.setMusicVolume(-5);
    state.setCameraSensitivity(73.6);

    expect(useAppStore.getState().masterVolume).toBe(100);
    expect(useAppStore.getState().musicVolume).toBe(0);
    expect(useAppStore.getState().cameraSensitivity).toBe(74);
  });

  test('moves through title, play, pause, and resume without changing progress', () => {
    const state = useAppStore.getState();
    state.startGame();
    expect(useAppStore.getState().sessionMode).toBe('playing');

    useAppStore.getState().pauseGame();
    expect(useAppStore.getState().sessionMode).toBe('paused');

    useAppStore.getState().resumeGame();
    expect(useAppStore.getState().sessionMode).toBe('playing');
    expect(useAppStore.getState().progress).toEqual(INITIAL_GAME_PROGRESS);

    useAppStore.getState().returnToTitle();
    expect(useAppStore.getState().sessionMode).toBe('title');
  });

  test('persists versioned game progress after a valid transition', () => {
    useAppStore.getState().dispatchGameProgress({ type: 'reveal-seed', id: 'home-glow' });
    useAppStore.getState().dispatchGameProgress({ type: 'collect-seed', id: 'home-glow' });

    const raw = localStorage.getItem('dream-builder.progress.v2');
    expect(raw).not.toBeNull();
    expect(parseStoredGameProgress(raw ?? '')?.collectedCount).toBe(1);
  });

  test('retires the legacy key after the first successful v2 write', () => {
    localStorage.setItem('dream-builder.progress.v1', '{"version":1}');

    useAppStore.getState().dispatchGameProgress({ type: 'reveal-seed', id: 'home-glow' });

    expect(localStorage.getItem('dream-builder.progress.v2')).not.toBeNull();
    expect(localStorage.getItem('dream-builder.progress.v1')).toBeNull();
  });

  test('clears transient gameplay UI when restarting the chapter', () => {
    useAppStore.setState({
      activeMemoryId: 'mossbound-echo',
      interactionPrompt: '旧提示',
      chapterCompleteOpen: true,
    });

    useAppStore.getState().dispatchGameProgress({ type: 'reset' });

    expect(useAppStore.getState().progress).toEqual(INITIAL_GAME_PROGRESS);
    expect(useAppStore.getState().activeMemoryId).toBeNull();
    expect(useAppStore.getState().interactionPrompt).toBeNull();
    expect(useAppStore.getState().chapterCompleteOpen).toBe(false);
  });

  test('opens the chapter ending only when restoration becomes committed', () => {
    const dispatch = useAppStore.getState().dispatchGameProgress;
    for (const id of ['home-glow', 'mushroom-glow', 'creek-glow'] as const) {
      dispatch({ type: 'reveal-seed', id });
      dispatch({ type: 'collect-seed', id });
    }
    dispatch({ type: 'begin-cleansing' });
    expect(useAppStore.getState().chapterCompleteOpen).toBe(false);

    dispatch({ type: 'complete-cleansing' });
    expect(useAppStore.getState().chapterCompleteOpen).toBe(true);
  });

  test('keeps the session playable and warns when progress persistence fails', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('storage unavailable');
    });

    useAppStore.getState().dispatchGameProgress({ type: 'reveal-seed', id: 'home-glow' });

    expect(useAppStore.getState().progress.seeds['home-glow']).toBe('revealed');
    expect(useAppStore.getState().warning).toContain('无法保存');
    setItem.mockRestore();
  });
});
