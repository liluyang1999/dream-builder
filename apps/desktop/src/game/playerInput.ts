import { type RefObject, useEffect, useRef } from 'react';

export interface PlayerInputIntent {
  forward: number;
  right: number;
  sprint: boolean;
}

export interface PlayerInputState extends PlayerInputIntent {
  interactionRevision: number;
}

export type GamepadDirection = 'north' | 'east' | 'south' | 'west';

export interface StandardGamepadSample extends PlayerInputIntent {
  connected: boolean;
  interactPressed: boolean;
  menuPressed: boolean;
  cancelPressed: boolean;
  direction: GamepadDirection | null;
}

export interface GamepadLike {
  axes: readonly number[];
  buttons: ReadonlyArray<{ pressed: boolean; value: number }>;
  connected?: boolean;
}

const IDLE_INPUT: PlayerInputState = {
  forward: 0,
  right: 0,
  sprint: false,
  interactionRevision: 0,
};
const TRACKED_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
]);
const MINIMUM_MOVEMENT_PRESS_MS = 200;

export function intentFromPressedKeys(pressed: ReadonlySet<string>): PlayerInputIntent {
  return {
    forward:
      Number(pressed.has('KeyW') || pressed.has('ArrowUp')) -
      Number(pressed.has('KeyS') || pressed.has('ArrowDown')),
    right:
      Number(pressed.has('KeyD') || pressed.has('ArrowRight')) -
      Number(pressed.has('KeyA') || pressed.has('ArrowLeft')),
    sprint: pressed.has('ShiftLeft') || pressed.has('ShiftRight'),
  };
}

export function sampleStandardGamepad(
  gamepad: GamepadLike | null | undefined,
  deadzone = 0.18,
): StandardGamepadSample {
  if (!gamepad || gamepad.connected === false) {
    return {
      connected: false,
      forward: 0,
      right: 0,
      sprint: false,
      interactPressed: false,
      menuPressed: false,
      cancelPressed: false,
      direction: null,
    };
  }

  const horizontal = applyGamepadDeadzone(gamepad.axes[0] ?? 0, deadzone);
  const vertical = applyGamepadDeadzone(gamepad.axes[1] ?? 0, deadzone);
  const dpadDirection = directionFromDpad(gamepad);
  const stickDirection =
    Math.max(Math.abs(horizontal), Math.abs(vertical)) >= 0.62
      ? Math.abs(horizontal) > Math.abs(vertical)
        ? horizontal > 0
          ? 'east'
          : 'west'
        : vertical > 0
          ? 'south'
          : 'north'
      : null;

  return {
    connected: true,
    forward: vertical === 0 ? 0 : -vertical,
    right: horizontal,
    sprint:
      isPressed(gamepad, 1) ||
      isPressed(gamepad, 10) ||
      buttonValue(gamepad, 6) > 0.55 ||
      buttonValue(gamepad, 7) > 0.55,
    interactPressed: isPressed(gamepad, 0),
    menuPressed: isPressed(gamepad, 9),
    cancelPressed: isPressed(gamepad, 1),
    direction: dpadDirection ?? stickDirection,
  };
}

export function combinePlayerIntents(
  keyboard: PlayerInputIntent,
  gamepad: PlayerInputIntent,
): PlayerInputIntent {
  return {
    forward: clampAxis(keyboard.forward + gamepad.forward),
    right: clampAxis(keyboard.right + gamepad.right),
    sprint: keyboard.sprint || gamepad.sprint,
  };
}

/** Keeps high-frequency movement input in a ref so it never rerenders React. */
export function usePlayerInput(disabled = false): RefObject<PlayerInputState> {
  const pressedRef = useRef(new Set<string>());
  const pressedAtRef = useRef(new Map<string, number>());
  const releaseTimeoutsRef = useRef(new Map<string, number>());
  const intentRef = useRef<PlayerInputState>(IDLE_INPUT);

  useEffect(() => {
    const publish = () => {
      intentRef.current = {
        ...intentFromPressedKeys(pressedRef.current),
        interactionRevision: intentRef.current.interactionRevision,
      };
    };
    const cancelPendingRelease = (code: string) => {
      const timeout = releaseTimeoutsRef.current.get(code);
      if (timeout === undefined) return;
      window.clearTimeout(timeout);
      releaseTimeoutsRef.current.delete(code);
    };
    const release = (code: string) => {
      cancelPendingRelease(code);
      pressedAtRef.current.delete(code);
      pressedRef.current.delete(code);
      publish();
    };
    const clearImmediately = () => {
      for (const timeout of releaseTimeoutsRef.current.values()) {
        window.clearTimeout(timeout);
      }
      releaseTimeoutsRef.current.clear();
      pressedAtRef.current.clear();
      pressedRef.current.clear();
      intentRef.current = {
        ...IDLE_INPUT,
        interactionRevision: intentRef.current.interactionRevision,
      };
    };
    const releaseAfterMinimumPress = (code: string) => {
      const pressedAt = pressedAtRef.current.get(code) ?? performance.now();
      const remainingMs = MINIMUM_MOVEMENT_PRESS_MS - (performance.now() - pressedAt);
      if (remainingMs <= 0) {
        release(code);
        return;
      }
      cancelPendingRelease(code);
      releaseTimeoutsRef.current.set(
        code,
        window.setTimeout(() => release(code), remainingMs),
      );
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const code = resolveInputCode(event);
      if (
        !code ||
        (!TRACKED_CODES.has(code) && code !== 'KeyE') ||
        isFormField(event.target) ||
        document.querySelector('[aria-modal="true"]')
      ) {
        return;
      }
      if (code === 'KeyE') {
        if (!event.repeat) {
          intentRef.current = {
            ...intentRef.current,
            interactionRevision: intentRef.current.interactionRevision + 1,
          };
        }
        event.preventDefault();
        return;
      }
      cancelPendingRelease(code);
      if (!event.repeat || !pressedRef.current.has(code)) {
        pressedAtRef.current.set(code, performance.now());
      }
      pressedRef.current.add(code);
      publish();
      event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const code = resolveInputCode(event);
      if (!code || !TRACKED_CODES.has(code)) return;
      releaseAfterMinimumPress(code);
    };
    const onBlur = () => {
      // Native shells and assistive input tools can briefly move focus after a
      // complete key tap. Preserve only the bounded remainder of that tap so a
      // render frame can observe it, while a genuinely held key releases now.
      for (const code of [...pressedRef.current]) {
        releaseAfterMinimumPress(code);
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) clearImmediately();
    };

    if (disabled) {
      clearImmediately();
      return;
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearImmediately();
    };
  }, [disabled]);

  return intentRef;
}

function applyGamepadDeadzone(value: number, deadzone: number): number {
  if (!Number.isFinite(value)) return 0;
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) return 0;
  const normalized = (magnitude - deadzone) / (1 - deadzone);
  return Math.sign(value) * Math.min(1, normalized);
}

function clampAxis(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

function buttonValue(gamepad: GamepadLike, index: number): number {
  const button = gamepad.buttons[index];
  return button ? Math.max(button.value, button.pressed ? 1 : 0) : 0;
}

function isPressed(gamepad: GamepadLike, index: number): boolean {
  return buttonValue(gamepad, index) > 0.5;
}

function directionFromDpad(gamepad: GamepadLike): GamepadDirection | null {
  if (isPressed(gamepad, 12)) return 'north';
  if (isPressed(gamepad, 15)) return 'east';
  if (isPressed(gamepad, 13)) return 'south';
  if (isPressed(gamepad, 14)) return 'west';
  return null;
}

function isFormField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function resolveInputCode(event: KeyboardEvent): string | null {
  if (TRACKED_CODES.has(event.code) || event.code === 'KeyE') return event.code;

  switch (event.key.toLowerCase()) {
    case 'w':
      return 'KeyW';
    case 'a':
      return 'KeyA';
    case 's':
      return 'KeyS';
    case 'd':
      return 'KeyD';
    case 'e':
      return 'KeyE';
    case 'arrowup':
    case 'up':
      return 'ArrowUp';
    case 'arrowdown':
    case 'down':
      return 'ArrowDown';
    case 'arrowleft':
    case 'left':
      return 'ArrowLeft';
    case 'arrowright':
    case 'right':
      return 'ArrowRight';
    case 'shift':
      return 'ShiftLeft';
    default:
      return null;
  }
}
