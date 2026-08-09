import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { usePlayerInput } from '../game/playerInput';

afterEach(() => vi.useRealTimers());

describe('usePlayerInput', () => {
  test('tracks movement keys without triggering React renders', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePlayerInput());

    fireEvent.keyDown(window, { code: 'KeyW' });
    fireEvent.keyDown(window, { code: 'ShiftLeft' });
    expect(result.current.current).toEqual({
      forward: 1,
      right: 0,
      sprint: true,
      interactionRevision: 0,
    });

    act(() => vi.advanceTimersByTime(250));
    fireEvent.keyUp(window, { code: 'KeyW' });
    fireEvent.keyUp(window, { code: 'ShiftLeft' });
    expect(result.current.current).toEqual({
      forward: 0,
      right: 0,
      sprint: false,
      interactionRevision: 0,
    });

    fireEvent.keyDown(window, { code: 'KeyE', repeat: false });
    fireEvent.keyDown(window, { code: 'KeyE', repeat: true });
    expect(result.current.current.interactionRevision).toBe(1);
  });

  test('keeps an instantaneous movement tap active long enough for a render frame to sample it', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePlayerInput());

    fireEvent.keyDown(window, { code: 'KeyW' });
    fireEvent.keyUp(window, { code: 'KeyW' });

    expect(result.current.current.forward).toBe(1);
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.current.forward).toBe(0);
  });

  test('accepts the keyboard key when an embedded webview omits the physical code', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePlayerInput());

    fireEvent.keyDown(window, { key: 'w', code: '' });
    fireEvent.keyUp(window, { key: 'w', code: '' });

    expect(result.current.current.forward).toBe(1);
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.current.forward).toBe(0);
  });

  test('preserves only the bounded remainder of a short tap when the window loses focus', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePlayerInput());

    fireEvent.keyDown(window, { code: 'KeyW' });
    fireEvent.keyUp(window, { code: 'KeyW' });
    fireEvent.blur(window);

    expect(result.current.current.forward).toBe(1);
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.current.forward).toBe(0);
  });

  test('releases a genuinely held movement key immediately when the window loses focus', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePlayerInput());

    fireEvent.keyDown(window, { code: 'KeyW' });
    act(() => vi.advanceTimersByTime(250));
    fireEvent.blur(window);

    expect(result.current.current.forward).toBe(0);
  });

  test('does not move the player behind a modal dialog', () => {
    const modal = render(<div aria-modal="true" />);
    const { result } = renderHook(() => usePlayerInput());

    fireEvent.keyDown(window, { code: 'KeyW' });

    expect(result.current.current.forward).toBe(0);
    modal.unmount();
  });
});
