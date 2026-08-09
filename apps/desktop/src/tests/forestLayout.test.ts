// @vitest-environment node

import { describe, expect, test } from 'vitest';
import {
  CHECKPOINT_PLACEMENTS,
  FOREST_CHECKPOINTS,
  FOREST_WORLD,
  MEMORY_FRAGMENT_PLACEMENT,
} from '../game/forestLayout';
import { FOREST_CHECKPOINT_IDS } from '../game/gameProgress';
import { isWalkable } from '../game/playerMotion';

describe('forest progression layout', () => {
  test('defines one reachable respawn position for every checkpoint id', () => {
    expect(Object.keys(FOREST_CHECKPOINTS)).toEqual([...FOREST_CHECKPOINT_IDS]);
    expect(CHECKPOINT_PLACEMENTS.map(({ id }) => id)).toEqual([...FOREST_CHECKPOINT_IDS]);

    for (const id of FOREST_CHECKPOINT_IDS) {
      expect(isWalkable(FOREST_CHECKPOINTS[id], 0.34, FOREST_WORLD), id).toBe(true);
    }
  });

  test('places the optional memory fragment on reachable ground', () => {
    expect(isWalkable(MEMORY_FRAGMENT_PLACEMENT.position, 0.34, FOREST_WORLD)).toBe(true);
  });
});
