import type { TreeScene } from '@dream-builder/ipc-contracts';
import { beforeEach, describe, expect, test } from 'vitest';
import { useAppStore } from '../state/store';

function reset(): void {
  useAppStore.setState({
    selection: { hoveredId: null, selectedId: null },
    selectedDetail: null,
    history: [],
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

  test('scene history is most-recent-first and deduplicated', () => {
    const { applySceneResult } = useAppStore.getState();
    applySceneResult({ scene: sceneWithSeed(1), source: 'rust', warning: null });
    applySceneResult({ scene: sceneWithSeed(2), source: 'rust', warning: null });
    applySceneResult({ scene: sceneWithSeed(1), source: 'rust', warning: null });

    const { history } = useAppStore.getState();
    expect(history[0]).toBe(1);
    expect(history.filter((s) => s === 1)).toHaveLength(1);
  });
});
