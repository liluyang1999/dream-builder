// @vitest-environment node

import { describe, expect, test } from 'vitest';
import {
  FOREST_CHECKPOINTS,
  FOREST_WORLD,
  LIGHT_SEED_PLACEMENTS,
  RESTORATION_NODE,
} from '../game/forestLayout';
import { intentFromPressedKeys } from '../game/playerInput';
import {
  type CollisionWorld,
  createPlayerMotionState,
  isWalkable,
  movementVectorFromIntent,
  stepPlayerMotion,
} from '../game/playerMotion';

const EMPTY_WORLD: CollisionWorld = {
  bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
  obstacles: [],
};

describe('player input', () => {
  test('maps keyboard codes into one normalized intent contract', () => {
    expect(intentFromPressedKeys(new Set(['KeyW', 'KeyD', 'ShiftLeft']))).toEqual({
      forward: 1,
      right: 1,
      sprint: true,
    });
    expect(intentFromPressedKeys(new Set(['ArrowDown', 'KeyA']))).toEqual({
      forward: -1,
      right: -1,
      sprint: false,
    });
  });
});

describe('player motion', () => {
  test('ships a safe spawn and reachable graybox checkpoints', () => {
    for (const checkpoint of Object.values(FOREST_CHECKPOINTS)) {
      expect(isWalkable(checkpoint, 0.34, FOREST_WORLD)).toBe(true);
    }
    for (const placement of LIGHT_SEED_PLACEMENTS) {
      expect(isWalkable(placement.position, 0.34, FOREST_WORLD)).toBe(true);
    }
    expect(isWalkable(RESTORATION_NODE.position, 0.34, FOREST_WORLD)).toBe(true);
    expect(new Set(FOREST_WORLD.obstacles.map((obstacle) => obstacle.id)).size).toBe(
      FOREST_WORLD.obstacles.length,
    );
  });

  test('normalizes diagonal movement in camera space', () => {
    const direction = movementVectorFromIntent(
      { forward: 1, right: 1, sprint: false },
      { x: 0, z: -1 },
    );

    expect(Math.hypot(direction.x, direction.z)).toBeCloseTo(1);
    expect(direction.x).toBeGreaterThan(0);
    expect(direction.z).toBeLessThan(0);
  });

  test('keeps the full player radius inside world bounds', () => {
    let state = createPlayerMotionState({ x: 9.4, z: 0 });
    for (let frame = 0; frame < 120; frame += 1) {
      state = stepPlayerMotion(
        state,
        { forward: 0, right: 1, sprint: true },
        { x: 0, z: -1 },
        1 / 60,
        EMPTY_WORLD,
      );
    }

    expect(state.position.x).toBeLessThanOrEqual(10 - state.radius);
  });

  test('cannot enter a circular obstacle', () => {
    const world: CollisionWorld = {
      ...EMPTY_WORLD,
      obstacles: [{ id: 'tree', kind: 'circle', center: { x: 0, z: 0 }, radius: 1 }],
    };
    let state = createPlayerMotionState({ x: 0, z: 3 });

    for (let frame = 0; frame < 180; frame += 1) {
      state = stepPlayerMotion(
        state,
        { forward: 1, right: 0, sprint: true },
        { x: 0, z: -1 },
        1 / 60,
        world,
      );
    }

    expect(Math.hypot(state.position.x, state.position.z)).toBeGreaterThanOrEqual(
      1 + state.radius - 0.001,
    );
  });

  test('substeps large frames instead of tunnelling through a thin wall', () => {
    const world: CollisionWorld = {
      ...EMPTY_WORLD,
      obstacles: [
        {
          id: 'wall',
          kind: 'rect',
          minX: -2,
          maxX: 2,
          minZ: -0.05,
          maxZ: 0.05,
        },
      ],
    };
    let state = createPlayerMotionState({ x: 0, z: 1 });

    for (let frame = 0; frame < 20; frame += 1) {
      state = stepPlayerMotion(
        state,
        { forward: 1, right: 0, sprint: true },
        { x: 0, z: -1 },
        0.1,
        world,
      );
    }

    expect(state.position.z).toBeGreaterThanOrEqual(0.05 + state.radius - 0.001);
  });

  test('decelerates after movement input is released', () => {
    let state = createPlayerMotionState({ x: 0, z: 0 });
    for (let frame = 0; frame < 30; frame += 1) {
      state = stepPlayerMotion(
        state,
        { forward: 1, right: 0, sprint: false },
        { x: 0, z: -1 },
        1 / 60,
        EMPTY_WORLD,
      );
    }
    const movingSpeed = Math.hypot(state.velocity.x, state.velocity.z);

    state = stepPlayerMotion(
      state,
      { forward: 0, right: 0, sprint: false },
      { x: 0, z: -1 },
      0.1,
      EMPTY_WORLD,
    );

    expect(Math.hypot(state.velocity.x, state.velocity.z)).toBeLessThan(movingSpeed);
  });
});
