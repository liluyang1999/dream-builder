/**
 * Global application state (Zustand).
 *
 * Teaching points:
 * - Zustand keeps a single typed store; components subscribe to slices via
 *   selectors and only re-render when their slice changes.
 * - Selection transitions are delegated to the pure `reduceSelectionState`
 *   reducer, so that logic stays unit-testable and framework-free.
 * - Seed persistence uses `localStorage`, guarded for webviews that disallow it.
 */
import {
  DEFAULT_SETTINGS,
  type DetailInfo,
  type GraphicsQuality,
  type Settings,
  type TextScale,
  type Theme,
  type TreeScene,
} from '@dream-builder/ipc-contracts';
import { create } from 'zustand';
import {
  type GameProgress,
  type GameProgressAction,
  INITIAL_GAME_PROGRESS,
  type MemoryFragmentId,
  reduceGameProgress,
} from '../game/gameProgress';
import { type SelectionState, reduceSelectionState } from '../interaction/selectionState';
import type { SceneSource } from '../ipc/treeApi';
import {
  type ProgressRecoveryStatus,
  readProgressStorage,
  replaceProgressStorage,
  writeProgressStorage,
} from './progressStorage';

export const DEFAULT_SEED = DEFAULT_SETTINGS.seed;
const SEED_STORAGE_KEY = 'dream-builder.seed';
const HISTORY_LIMIT = 24;

const INITIAL_SELECTION: SelectionState = { hoveredId: null, selectedId: null };
const STORED_PROGRESS = readProgressStorage(getLocalStorage());

export type SessionMode = 'title' | 'playing' | 'paused';

export interface AppState {
  seed: number;
  scene: TreeScene | null;
  source: SceneSource | null;
  warning: string | null;
  selection: SelectionState;
  selectedDetail: DetailInfo | null;
  theme: Theme;
  reducedMotion: boolean;
  graphicsQuality: GraphicsQuality;
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  cameraSensitivity: number;
  highContrast: boolean;
  textScale: TextScale;
  showHints: boolean;
  sessionMode: SessionMode;
  settingsOpen: boolean;
  creditsOpen: boolean;
  hudHidden: boolean;
  helpOpen: boolean;
  history: number[];
  progress: GameProgress;
  interactionPrompt: string | null;
  activeMemoryId: MemoryFragmentId | null;
  progressRecoveryStatus: ProgressRecoveryStatus;
  chapterCompleteOpen: boolean;

  setSeed(seed: number): void;
  applySceneResult(result: { scene: TreeScene; source: SceneSource; warning: string | null }): void;
  setWarning(warning: string | null): void;
  hover(id: string): void;
  hoverClear(): void;
  select(id: string): void;
  clearSelection(): void;
  setSelectedDetail(detail: DetailInfo | null): void;
  setTheme(theme: Theme): void;
  setReducedMotion(value: boolean): void;
  setGraphicsQuality(value: GraphicsQuality): void;
  setMasterVolume(value: number): void;
  setMusicVolume(value: number): void;
  setEffectsVolume(value: number): void;
  setCameraSensitivity(value: number): void;
  setHighContrast(value: boolean): void;
  setTextScale(value: TextScale): void;
  setShowHints(value: boolean): void;
  startGame(): void;
  pauseGame(): void;
  resumeGame(): void;
  returnToTitle(): void;
  setSettingsOpen(open: boolean): void;
  setCreditsOpen(open: boolean): void;
  resetPreferences(): void;
  toggleHud(): void;
  toggleHelp(): void;
  setHelpOpen(open: boolean): void;
  hydrateSettings(settings: Settings): void;
  dispatchGameProgress(action: GameProgressAction): void;
  setInteractionPrompt(prompt: string | null): void;
  openMemory(id: MemoryFragmentId): void;
  closeMemory(): void;
  dismissProgressRecovery(): void;
  dismissChapterComplete(): void;
}

export const useAppStore = create<AppState>((set) => ({
  seed: readStoredSeed() ?? DEFAULT_SEED,
  scene: null,
  source: null,
  warning: null,
  selection: INITIAL_SELECTION,
  selectedDetail: null,
  theme: 'auto',
  reducedMotion: prefersReducedMotion(),
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
  hudHidden: false,
  helpOpen: false,
  history: [],
  progress: STORED_PROGRESS.progress ?? INITIAL_GAME_PROGRESS,
  interactionPrompt: null,
  activeMemoryId: null,
  progressRecoveryStatus: STORED_PROGRESS.status,
  chapterCompleteOpen: false,

  setSeed(seed) {
    if (!Number.isFinite(seed) || seed < 0) return;
    writeStoredSeed(seed);
    set({ seed, selection: INITIAL_SELECTION, selectedDetail: null });
  },
  applySceneResult({ scene, source, warning }) {
    set((state) => ({
      scene,
      source,
      warning,
      history: [scene.seed, ...state.history.filter((s) => s !== scene.seed)].slice(
        0,
        HISTORY_LIMIT,
      ),
    }));
  },
  setWarning(warning) {
    set({ warning });
  },
  hover(id) {
    set((state) => ({ selection: reduceSelectionState(state.selection, { type: 'hover', id }) }));
  },
  hoverClear() {
    set((state) => ({ selection: reduceSelectionState(state.selection, { type: 'hover-clear' }) }));
  },
  select(id) {
    set((state) => ({ selection: reduceSelectionState(state.selection, { type: 'click', id }) }));
  },
  clearSelection() {
    set((state) => ({
      selection: reduceSelectionState(state.selection, { type: 'selection-clear' }),
      selectedDetail: null,
    }));
  },
  setSelectedDetail(detail) {
    set({ selectedDetail: detail });
  },
  setTheme(theme) {
    set({ theme });
  },
  setReducedMotion(value) {
    set({ reducedMotion: value });
  },
  setGraphicsQuality(graphicsQuality) {
    set({ graphicsQuality });
  },
  setMasterVolume(masterVolume) {
    set({ masterVolume: clampSetting(masterVolume, 0, 100) });
  },
  setMusicVolume(musicVolume) {
    set({ musicVolume: clampSetting(musicVolume, 0, 100) });
  },
  setEffectsVolume(effectsVolume) {
    set({ effectsVolume: clampSetting(effectsVolume, 0, 100) });
  },
  setCameraSensitivity(cameraSensitivity) {
    set({ cameraSensitivity: clampSetting(cameraSensitivity, 50, 150) });
  },
  setHighContrast(highContrast) {
    set({ highContrast });
  },
  setTextScale(textScale) {
    set({ textScale });
  },
  setShowHints(showHints) {
    set({ showHints });
  },
  startGame() {
    set({
      sessionMode: 'playing',
      settingsOpen: false,
      creditsOpen: false,
      helpOpen: false,
      hudHidden: false,
    });
  },
  pauseGame() {
    set((state) => (state.sessionMode === 'playing' ? { sessionMode: 'paused' } : state));
  },
  resumeGame() {
    set((state) => (state.sessionMode === 'paused' ? { sessionMode: 'playing' } : state));
  },
  returnToTitle() {
    set({
      sessionMode: 'title',
      settingsOpen: false,
      creditsOpen: false,
      helpOpen: false,
      interactionPrompt: null,
      activeMemoryId: null,
    });
  },
  setSettingsOpen(settingsOpen) {
    set({ settingsOpen });
  },
  setCreditsOpen(creditsOpen) {
    set({ creditsOpen });
  },
  resetPreferences() {
    set({
      theme: DEFAULT_SETTINGS.theme,
      reducedMotion: DEFAULT_SETTINGS.reducedMotion,
      graphicsQuality: DEFAULT_SETTINGS.graphicsQuality,
      masterVolume: DEFAULT_SETTINGS.masterVolume,
      musicVolume: DEFAULT_SETTINGS.musicVolume,
      effectsVolume: DEFAULT_SETTINGS.effectsVolume,
      cameraSensitivity: DEFAULT_SETTINGS.cameraSensitivity,
      highContrast: DEFAULT_SETTINGS.highContrast,
      textScale: DEFAULT_SETTINGS.textScale,
      showHints: DEFAULT_SETTINGS.showHints,
    });
  },
  toggleHud() {
    set((state) => ({ hudHidden: !state.hudHidden }));
  },
  toggleHelp() {
    set((state) => ({ helpOpen: !state.helpOpen }));
  },
  setHelpOpen(open) {
    set({ helpOpen: open });
  },
  hydrateSettings(settings) {
    writeStoredSeed(settings.seed);
    set({
      seed: settings.seed,
      theme: settings.theme,
      reducedMotion: settings.reducedMotion,
      graphicsQuality: settings.graphicsQuality,
      masterVolume: settings.masterVolume,
      musicVolume: settings.musicVolume,
      effectsVolume: settings.effectsVolume,
      cameraSensitivity: settings.cameraSensitivity,
      highContrast: settings.highContrast,
      textScale: settings.textScale,
      showHints: settings.showHints,
      selection: INITIAL_SELECTION,
      selectedDetail: null,
    });
  },
  dispatchGameProgress(action) {
    set((state) => {
      const progress = reduceGameProgress(state.progress, action);
      if (progress === state.progress) return state;
      const persisted =
        action.type === 'reset'
          ? replaceProgressStorage(getLocalStorage(), progress)
          : writeStoredGameProgress(progress);
      return {
        progress,
        ...(action.type === 'reset'
          ? { activeMemoryId: null, interactionPrompt: null, chapterCompleteOpen: false }
          : {}),
        ...(state.progress.nodeState !== 'restored' && progress.nodeState === 'restored'
          ? { chapterCompleteOpen: true }
          : {}),
        ...(persisted ? {} : { warning: '游戏进度暂时无法保存；本次游玩仍可继续。' }),
      };
    });
  },
  setInteractionPrompt(interactionPrompt) {
    set({ interactionPrompt });
  },
  openMemory(activeMemoryId) {
    set({ activeMemoryId });
  },
  closeMemory() {
    set({ activeMemoryId: null });
  },
  dismissProgressRecovery() {
    set({ progressRecoveryStatus: 'none' });
  },
  dismissChapterComplete() {
    set({ chapterCompleteOpen: false });
  },
}));

function readStoredSeed(): number | null {
  try {
    const raw = globalThis.localStorage?.getItem(SEED_STORAGE_KEY);
    if (!raw) return null;
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

function writeStoredSeed(seed: number): void {
  try {
    globalThis.localStorage?.setItem(SEED_STORAGE_KEY, String(seed));
  } catch {
    // Some webviews disallow localStorage; ignore.
  }
}

function writeStoredGameProgress(progress: GameProgress): boolean {
  return writeProgressStorage(getLocalStorage(), progress);
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clampSetting(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.round(Math.min(maximum, Math.max(minimum, value)));
}

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
