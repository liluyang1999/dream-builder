/**
 * Hook that wires an interactive 3D object to the selection store.
 *
 * Returns whether the object is currently hovered/selected plus the R3F pointer
 * handlers to spread onto the mesh/group. Each interactive component subscribes
 * only to its own hovered/selected booleans, so unrelated objects don't
 * re-render when the selection changes.
 */
import type { ThreeEvent } from '@react-three/fiber';
import { useAppStore } from '../state/store';

export interface InteractiveBinding {
  hovered: boolean;
  selected: boolean;
  handlers: {
    onPointerOver(event: ThreeEvent<PointerEvent>): void;
    onPointerOut(event: ThreeEvent<PointerEvent>): void;
    onClick(event: ThreeEvent<MouseEvent>): void;
  };
}

export function useInteractive(id: string): InteractiveBinding {
  const hovered = useAppStore((state) => state.selection.hoveredId === id);
  const selected = useAppStore((state) => state.selection.selectedId === id);
  const hover = useAppStore((state) => state.hover);
  const hoverClear = useAppStore((state) => state.hoverClear);
  const select = useAppStore((state) => state.select);

  return {
    hovered,
    selected,
    handlers: {
      onPointerOver(event) {
        event.stopPropagation();
        hover(id);
        document.body.style.cursor = 'pointer';
      },
      onPointerOut(event) {
        event.stopPropagation();
        hoverClear();
        document.body.style.cursor = '';
      },
      onClick(event) {
        event.stopPropagation();
        select(id);
      },
    },
  };
}
