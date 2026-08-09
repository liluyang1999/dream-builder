import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { type ShortcutHandlers, useKeyboardShortcuts } from '../interaction/useKeyboardShortcuts';

function handlers(): ShortcutHandlers {
  return {
    onResetCamera: vi.fn(),
    onToggleHud: vi.fn(),
    onToggleFullscreen: vi.fn(),
    onScreenshot: vi.fn(),
    onEscape: vi.fn(),
    onToggleHelp: vi.fn(),
    onRegenerate: vi.fn(),
  };
}

describe('useKeyboardShortcuts', () => {
  test('reserves WASD for player movement and uses P for screenshots', () => {
    const callbacks = handlers();
    renderHook(() => useKeyboardShortcuts(callbacks));

    for (const key of ['w', 'a', 's', 'd']) fireEvent.keyDown(window, { key });
    expect(callbacks.onScreenshot).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'p' });
    expect(callbacks.onScreenshot).toHaveBeenCalledOnce();
  });

  test('does not send global commands through an open modal', () => {
    const callbacks = handlers();
    renderHook(() => useKeyboardShortcuts(callbacks));
    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);

    for (const key of ['r', 'h', 'f', 'p', 'g', '?', 'Escape']) {
      fireEvent.keyDown(window, { key });
    }

    expect(Object.values(callbacks).every((callback) => callback.mock.calls.length === 0)).toBe(
      true,
    );
    modal.remove();
  });
});
