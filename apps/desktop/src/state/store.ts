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
import type { DetailInfo, Settings, Theme, TreeScene } from '@dream-builder/ipc-contracts';
import { create } from 'zustand';
import { type SelectionState, reduceSelectionState } from '../interaction/selectionState';
import type { SceneSource } from '../ipc/treeApi';

export const DEFAULT_SEED = 424242;
const SEED_STORAGE_KEY = 'dream-builder.seed';
const HISTORY_LIMIT = 24;

const INITIAL_SELECTION: SelectionState = { hoveredId: null, selectedId: null };

export interface AppState {
  seed: number;
  scene: TreeScene | null;
  source: SceneSource | null;
  warning: string | null;
  selection: SelectionState;
  selectedDetail: DetailInfo | null;
  theme: Theme;
  reducedMotion: boolean;
  hudHidden: boolean;
  helpOpen: boolean;
  history: number[];

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
  toggleHud(): void;
  toggleHelp(): void;
  setHelpOpen(open: boolean): void;
  hydrateSettings(settings: Settings): void;
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
  hudHidden: false,
  helpOpen: false,
  history: [],

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
    set({ theme: settings.theme, reducedMotion: settings.reducedMotion });
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

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
