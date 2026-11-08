import { cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { type ReactElement, type RefObject, createRef } from 'react';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { FOREST_CHECKPOINTS } from '../game/forestLayout';
import type { GamepadLike } from '../game/playerInput';
import type { Vec2 } from '../game/playerMotion';
import {
  PLAYER_CAMERA_OFFSET,
  PLAYER_CAMERA_TARGET_HEIGHT,
  type PlayerApi,
  PlayerController,
} from '../scene/PlayerController';

const frame = vi.hoisted(() => ({
  callback: null as ((state: { clock: THREE.Clock }, delta: number) => void) | null,
}));
const camera = new THREE.PerspectiveCamera();
const clock = new THREE.Clock();
let controls: { target: THREE.Vector3; update(): void } | null = null;

vi.mock('@react-three/fiber', () => ({
  useThree: (
    select: (state: { camera: THREE.PerspectiveCamera; controls: typeof controls }) => unknown,
  ) => select({ camera, controls }),
  useFrame: (callback: NonNullable<typeof frame.callback>) => {
    frame.callback = callback;
  },
}));

function tick() {
  expect(frame.callback).not.toBeNull();
  frame.callback?.({ clock }, 1 / 60);
}

function mountPlayer(inputLocked = false, respawnPosition: Vec2 = { x: 0, z: 0 }) {
  const apiRef = createRef<PlayerApi>();
  const view = renderHook(
    (props: { inputLocked: boolean }) =>
      PlayerController({
        ...props,
        apiRef,
        reducedMotion: true,
        respawnPosition,
      }),
    { initialProps: { inputLocked } },
  );
  // Supply the Three group that R3F would attach; no WebGL renderer is needed
  // to exercise the real controller's frame loop and public snapshot contract.
  const tree = view.result.current as ReactElement<{ ref: RefObject<THREE.Group | null> }>;
  const group = new THREE.Group();
  tree.props.ref.current = group;
  tick();
  return {
    ...view,
    apiRef,
    group,
    revision: () => apiRef.current?.getSnapshot().interactionRevision,
  };
}

beforeEach(() => {
  frame.callback = null;
  controls = null;
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function createControls() {
  const target = new THREE.Vector3(
    FOREST_CHECKPOINTS.spawn.x,
    PLAYER_CAMERA_TARGET_HEIGHT,
    FOREST_CHECKPOINTS.spawn.z,
  );
  return { target, update: vi.fn(() => camera.lookAt(target)) };
}

function expectCameraAtCheckpoint(position: Vec2) {
  expect(camera.position.toArray()).toEqual([
    position.x + PLAYER_CAMERA_OFFSET[0],
    PLAYER_CAMERA_OFFSET[1],
    position.z + PLAYER_CAMERA_OFFSET[2],
  ]);
  expect(controls?.target.toArray()).toEqual([position.x, PLAYER_CAMERA_TARGET_HEIGHT, position.z]);
}

describe('PlayerController camera controls lifecycle', () => {
  test('targets the restored checkpoint when controls arrive after the first reset frame', () => {
    const checkpoint = FOREST_CHECKPOINTS.ruinGate;
    const player = mountPlayer(true, checkpoint);
    const snapshot = player.apiRef.current?.getSnapshot();
    expect(snapshot?.position).toEqual(checkpoint);

    const lateControls = createControls();
    controls = lateControls;
    player.rerender({ inputLocked: true });
    tick();

    expectCameraAtCheckpoint(checkpoint);
    expect(lateControls.update).toHaveBeenCalled();
    expect(player.apiRef.current?.getSnapshot()).toEqual(snapshot);
    expect(player.group.position.toArray()).toEqual([checkpoint.x, 0, checkpoint.z]);
  });

  test('keeps normal reset and explicit reset positions aligned with existing controls', () => {
    controls = createControls();
    const checkpoint = FOREST_CHECKPOINTS.mushroomSlope;
    const player = mountPlayer(true, checkpoint);
    expectCameraAtCheckpoint(checkpoint);

    player.apiRef.current?.reset(FOREST_CHECKPOINTS.ruinGate);
    tick();
    expectCameraAtCheckpoint(FOREST_CHECKPOINTS.ruinGate);
    expect(player.apiRef.current?.getSnapshot().position).toEqual(FOREST_CHECKPOINTS.ruinGate);

    player.apiRef.current?.reset();
    tick();
    expectCameraAtCheckpoint(checkpoint);
    expect(player.apiRef.current?.getSnapshot().position).toEqual(checkpoint);
  });

  test('retargets replacement controls without moving the camera or resetting the player', () => {
    controls = createControls();
    const checkpoint = FOREST_CHECKPOINTS.ruinGate;
    const player = mountPlayer(false, checkpoint);
    fireEvent.keyDown(window, { code: 'KeyW' });
    for (let index = 0; index < 30; index += 1) tick();
    fireEvent.blur(window);
    const snapshot = player.apiRef.current?.getSnapshot();
    if (!snapshot) throw new Error('The mounted player must expose its snapshot.');
    expect(snapshot.position).not.toEqual(checkpoint);
    const cameraPosition = camera.position.toArray();

    const replacement = createControls();
    controls = replacement;
    player.rerender({ inputLocked: true });
    tick();

    expect(replacement.target.toArray()).toEqual([
      snapshot.position.x,
      PLAYER_CAMERA_TARGET_HEIGHT,
      snapshot.position.z,
    ]);
    expect(replacement.update).toHaveBeenCalled();
    expect(camera.position.toArray()).toEqual(cameraPosition);
    expect(player.apiRef.current?.getSnapshot()).toEqual(snapshot);
    expect(player.group.position.toArray()).toEqual([snapshot.position.x, 0, snapshot.position.z]);
  });
});

describe('PlayerController gamepad interaction boundaries', () => {
  let interactPressed = false;

  beforeEach(() => {
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
