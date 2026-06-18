export interface SelectionState {
  hoveredId: string | null;
  selectedId: string | null;
}

export type SelectionAction =
  | { type: 'hover'; id: string }
  | { type: 'hover-clear' }
  | { type: 'click'; id: string }
  | { type: 'selection-clear' };

export function reduceSelectionState(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case 'hover':
      return normalizedId(action.id) ? { ...state, hoveredId: action.id.trim() } : { ...state, hoveredId: null };
    case 'hover-clear':
      return { ...state, hoveredId: null };
    case 'click': {
      const id = normalizedId(action.id);
      return id ? { ...state, selectedId: id } : state;
    }
    case 'selection-clear':
      return { ...state, selectedId: null };
    default:
      return state;
  }
}

function normalizedId(id: string): string | null {
  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : null;
}
