import { cleanup, render, renderHook } from '@testing-library/react';
import { type ReactElement, type RefObject, createRef } from 'react';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { GamepadLike } from '../game/playerInput';
import { type PlayerApi, PlayerController } from '../scene/PlayerController';

const frame = vi.hoisted(() => ({
  callback: null as ((state: { clock: THREE.Clock }, delta: number) => void) | null,
}));
const camera = new THREE.PerspectiveCamera();
const clock = new THREE.Clock();

vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: { camera: THREE.PerspectiveCamera; controls: null }) => unknown) =>
    select({ camera, controls: null }),
  useFrame: (callback: NonNullable<typeof frame.callback>) => {
    frame.callback = callback;
  },
}));

function tick() {
  expect(frame.callback).not.toBeNull();
  frame.callback?.({ clock }, 1 / 60);
}

function mountPlayer(inputLocked = false) {
  const apiRef = createRef<PlayerApi>();
  const view = renderHook(
    (props: { inputLocked: boolean }) =>
      PlayerController({
        ...props,
        apiRef,
        reducedMotion: true,
        respawnPosition: { x: 0, z: 0 },
      }),
    { initialProps: { inputLocked } },
  );
  // Supply the Three group that R3F would attach; no WebGL renderer is needed
  // to exercise the real controller's frame loop and public snapshot contract.
  const tree = view.result.current as ReactElement<{ ref: RefObject<THREE.Group | null> }>;
  tree.props.ref.current = new THREE.Group();
  tick();
  return { ...view, revision: () => apiRef.current?.getSnapshot().interactionRevision };
}

describe('PlayerController gamepad interaction boundaries', () => {
  let interactPressed = false;

  beforeEach(() => {
    frame.callback = null;
    interactPressed = false;
    const gamepadNavigator = Object.create(navigator) as Navigator;
    Object.defineProperty(gamepadNavigator, 'getGamepads', {
      value: (): GamepadLike[] => [
        {
          connected: true,
          axes: [0, 0],
          buttons: [{ pressed: interactPressed, value: Number(interactPressed) }],
        },
      ],
    });
    vi.stubGlobal('navigator', gamepadNavigator);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test('counts one world interaction per press and requires release before another', () => {
    const player = mountPlayer();
    tick();
    interactPressed = true;
    tick();
    tick();
    expect(player.revision()).toBe(1);
    interactPressed = false;
    tick();
    interactPressed = true;
    tick();
    expect(player.revision()).toBe(2);
  });

  test.each(['before', 'after'] as const)(
    'does not replay a modal confirm pressed %s the last locked frame',
    (pressTiming) => {
      const player = mountPlayer();
      tick();
      player.rerender({ inputLocked: true });
      if (pressTiming === 'before') interactPressed = true;
      tick();
      interactPressed = true;
      player.rerender({ inputLocked: false });
      tick();
      tick();
      expect(player.revision()).toBe(0);

      interactPressed = false;
      tick();
      interactPressed = true;
      tick();
      expect(player.revision()).toBe(1);
    },
  );

  test('also consumes confirmation when a DOM modal provides the input lock', () => {
    const player = mountPlayer();
    tick();
    const modal = render(<div aria-modal="true" />);
    tick();
    interactPressed = true;
    tick();
    modal.unmount();
    tick();
    expect(player.revision()).toBe(0);

    interactPressed = false;
    tick();
    interactPressed = true;
    tick();
    expect(player.revision()).toBe(1);
  });

  test('consumes confirmation even if no world frame ran while input was locked', () => {
    const player = mountPlayer();
    tick();
    player.rerender({ inputLocked: true });
    interactPressed = true;
    player.rerender({ inputLocked: false });
    tick();
    expect(player.revision()).toBe(0);
  });
});
