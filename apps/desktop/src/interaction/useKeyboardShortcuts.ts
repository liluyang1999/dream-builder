/**
 * Window-level keyboard shortcuts as a reusable hook.
 *
 * Teaching points:
 * - A custom hook encapsulates an effect (add/remove listener) with cleanup.
 * - Handlers are kept in a ref so the listener is bound once, yet always calls
 *   the latest callbacks (avoids stale closures without re-subscribing).
 */
import { useEffect, useRef } from 'react';

export interface ShortcutHandlers {
  onResetCamera(): void;
  onToggleHud(): void;
  onToggleFullscreen(): void;
  onScreenshot(): void;
  onDeselect(): void;
  onToggleHelp(): void;
  onRegenerate(): void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || isFormField(target))) return;

      const h = ref.current;
      switch (event.key.toLowerCase()) {
        case 'r':
          h.onResetCamera();
          break;
        case 'h':
          h.onToggleHud();
          break;
        case 'f':
          h.onToggleFullscreen();
          break;
        case 's':
          h.onScreenshot();
          break;
        case 'g':
          h.onRegenerate();
          break;
        case 'escape':
          h.onDeselect();
          break;
        case '?':
        case '/':
          h.onToggleHelp();
          break;
        default:
          return;
      }
      event.preventDefault();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

function isFormField(element: HTMLElement): boolean {
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
