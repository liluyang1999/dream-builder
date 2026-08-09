import { useEffect } from 'react';
import {
  type GamepadDirection,
  type StandardGamepadSample,
  sampleStandardGamepad,
} from '../game/playerInput';
import { useAppStore } from '../state/store';

const IDLE_SAMPLE: StandardGamepadSample = sampleStandardGamepad(null);
const DIRECTION_KEY: Record<GamepadDirection, string> = {
  north: 'ArrowUp',
  east: 'ArrowRight',
  south: 'ArrowDown',
  west: 'ArrowLeft',
};

export function GamepadNavigator() {
  useEffect(() => {
    let frame = 0;
    let previous = IDLE_SAMPLE;
    const poll = () => {
      const current = sampleStandardGamepad(findPrimaryGamepad());
      handleNavigationEdges(previous, current);
      previous = current;
      frame = window.requestAnimationFrame(poll);
    };
    frame = window.requestAnimationFrame(poll);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return null;
}

function handleNavigationEdges(
  previous: StandardGamepadSample,
  current: StandardGamepadSample,
): void {
  if (!current.connected) return;
  const state = useAppStore.getState();

  if (current.menuPressed && !previous.menuPressed && !state.settingsOpen && !state.creditsOpen) {
    if (state.sessionMode === 'playing') state.pauseGame();
    else if (state.sessionMode === 'paused') state.resumeGame();
  }

  const modal = document.querySelector<HTMLElement>('[aria-modal="true"]');
  if (!modal) return;

  if (current.cancelPressed && !previous.cancelPressed) {
    dispatchKeyboard('Escape');
    return;
  }

  if (current.direction && current.direction !== previous.direction) {
    if (modal.closest('.purification-overlay')) {
      dispatchKeyboard(DIRECTION_KEY[current.direction]);
    } else {
      navigateModal(modal, current.direction);
    }
  }

  if (current.interactPressed && !previous.interactPressed) {
    const active = document.activeElement;
    if (active instanceof HTMLElement && modal.contains(active)) active.click();
  }
}

function navigateModal(modal: HTMLElement, direction: GamepadDirection): void {
  const active = document.activeElement;
  if (direction === 'east' || direction === 'west') {
    if (active instanceof HTMLInputElement && active.type === 'range') {
      direction === 'east' ? active.stepUp(5) : active.stepDown(5);
      active.dispatchEvent(new Event('input', { bubbles: true }));
      active.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (active instanceof HTMLSelectElement) {
      const offset = direction === 'east' ? 1 : -1;
      active.selectedIndex = Math.min(
        active.options.length - 1,
        Math.max(0, active.selectedIndex + offset),
      );
      active.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
  }

  const focusable = [
    ...modal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((element) => !element.hidden);
  if (focusable.length === 0) return;
  const index = Math.max(0, focusable.indexOf(active as HTMLElement));
  const delta = direction === 'north' || direction === 'west' ? -1 : 1;
  focusable[(index + delta + focusable.length) % focusable.length]?.focus();
}

function dispatchKeyboard(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function findPrimaryGamepad(): Gamepad | null {
  if (typeof navigator.getGamepads !== 'function') return null;
  for (const gamepad of navigator.getGamepads()) {
    if (gamepad?.connected) return gamepad;
  }
  return null;
}
