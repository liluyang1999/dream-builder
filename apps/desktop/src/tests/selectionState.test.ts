import { describe, expect, test } from 'vitest';
import { reduceSelectionState } from '../interaction/selectionState';

describe('reduceSelectionState', () => {
  test('clears hover without clearing a selected detail', () => {
    const selected = reduceSelectionState(
      { hoveredId: 'rune-1', selectedId: null },
      { type: 'click', id: 'rune-1' },
    );
    const result = reduceSelectionState(selected, { type: 'hover-clear' });

    expect(result).toEqual({ hoveredId: null, selectedId: 'rune-1' });
  });

  test('ignores empty click ids', () => {
    const result = reduceSelectionState(
      { hoveredId: 'crystal-1', selectedId: 'rune-1' },
      { type: 'click', id: '   ' },
    );

    expect(result).toEqual({ hoveredId: 'crystal-1', selectedId: 'rune-1' });
  });

  test('updates hover and selected ids independently', () => {
    const hovered = reduceSelectionState(
      { hoveredId: null, selectedId: null },
      { type: 'hover', id: 'leaf-2' },
    );
    const clicked = reduceSelectionState(hovered, { type: 'click', id: 'crystal-3' });

    expect(clicked).toEqual({ hoveredId: 'leaf-2', selectedId: 'crystal-3' });
  });
});
