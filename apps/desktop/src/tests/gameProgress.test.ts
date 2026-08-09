// @vitest-environment node

import { describe, expect, test } from 'vitest';
import {
  FOREST_CHECKPOINT_IDS,
  INITIAL_GAME_PROGRESS,
  LIGHT_SEED_IDS,
  MEMORY_FRAGMENT_IDS,
  parseStoredGameProgress,
  reduceGameProgress,
} from '../game/gameProgress';

describe('game progress', () => {
  test('requires a seed to be revealed before it can be collected', () => {
    const hiddenCollect = reduceGameProgress(INITIAL_GAME_PROGRESS, {
      type: 'collect-seed',
      id: 'home-glow',
    });
    expect(hiddenCollect).toBe(INITIAL_GAME_PROGRESS);

    const revealed = reduceGameProgress(INITIAL_GAME_PROGRESS, {
      type: 'reveal-seed',
      id: 'home-glow',
    });
    const collected = reduceGameProgress(revealed, {
      type: 'collect-seed',
      id: 'home-glow',
    });
    expect(collected.seeds['home-glow']).toBe('collected');
    expect(collected.collectedCount).toBe(1);
  });

  test('readies the restoration node only after all three seeds are collected', () => {
    let progress = INITIAL_GAME_PROGRESS;
    for (const id of LIGHT_SEED_IDS) {
      progress = reduceGameProgress(progress, { type: 'reveal-seed', id });
      progress = reduceGameProgress(progress, { type: 'collect-seed', id });
    }

    expect(progress.collectedCount).toBe(3);
    expect(progress.nodeState).toBe('ready');
    expect(progress.treeStage).toBe(0);
    expect(progress.gateUnlocked).toBe(false);
  });

  test('restores the forest as one atomic state transition', () => {
    let progress = INITIAL_GAME_PROGRESS;
    expect(reduceGameProgress(progress, { type: 'begin-cleansing' })).toBe(progress);
    expect(reduceGameProgress(progress, { type: 'complete-cleansing' })).toBe(progress);

    for (const id of LIGHT_SEED_IDS) {
      progress = reduceGameProgress(progress, { type: 'reveal-seed', id });
      progress = reduceGameProgress(progress, { type: 'collect-seed', id });
    }
    progress = reduceGameProgress(progress, { type: 'begin-cleansing' });
    expect(progress.nodeState).toBe('cleansing');
    progress = reduceGameProgress(progress, { type: 'complete-cleansing' });

    expect(progress.nodeState).toBe('restored');
    expect(progress.treeStage).toBe(1);
    expect(progress.gateUnlocked).toBe(true);
  });

  test('cancels only the local cleansing attempt without consuming collected seeds', () => {
    let progress = INITIAL_GAME_PROGRESS;
    for (const id of LIGHT_SEED_IDS) {
      progress = reduceGameProgress(progress, { type: 'reveal-seed', id });
      progress = reduceGameProgress(progress, { type: 'collect-seed', id });
    }
    progress = reduceGameProgress(progress, { type: 'begin-cleansing' });
    progress = reduceGameProgress(progress, { type: 'cancel-cleansing' });

    expect(progress.nodeState).toBe('ready');
    expect(progress.collectedCount).toBe(3);
    expect(Object.values(progress.seeds).every((state) => state === 'collected')).toBe(true);
  });

  test('records the latest safe checkpoint and read memories idempotently', () => {
    const checkpointed = reduceGameProgress(INITIAL_GAME_PROGRESS, {
      type: 'activate-checkpoint',
      id: 'mushroomSlope',
    });
    expect(checkpointed.activeCheckpoint).toBe('mushroomSlope');
    expect(
      reduceGameProgress(checkpointed, {
        type: 'activate-checkpoint',
        id: 'mushroomSlope',
      }),
    ).toBe(checkpointed);

    const remembered = reduceGameProgress(checkpointed, {
      type: 'read-memory',
      id: 'mossbound-echo',
    });
    expect(remembered.memoriesRead).toEqual(['mossbound-echo']);
    expect(reduceGameProgress(remembered, { type: 'read-memory', id: 'mossbound-echo' })).toBe(
      remembered,
    );

    expect(reduceGameProgress(remembered, { type: 'reset' })).toEqual(INITIAL_GAME_PROGRESS);
  });

  test('accepts only internally consistent versioned save data', () => {
    expect(parseStoredGameProgress(JSON.stringify(INITIAL_GAME_PROGRESS))).toEqual(
      INITIAL_GAME_PROGRESS,
    );
    expect(parseStoredGameProgress('{bad json')).toBeNull();
    expect(
      parseStoredGameProgress(
        JSON.stringify({ ...INITIAL_GAME_PROGRESS, collectedCount: 3, nodeState: 'ready' }),
      ),
    ).toBeNull();
    expect(
      parseStoredGameProgress(JSON.stringify({ ...INITIAL_GAME_PROGRESS, version: 99 })),
    ).toBeNull();
    expect(
      parseStoredGameProgress(
        JSON.stringify({ ...INITIAL_GAME_PROGRESS, activeCheckpoint: 'outside-the-forest' }),
      ),
    ).toBeNull();
    expect(
      parseStoredGameProgress(
        JSON.stringify({
          ...INITIAL_GAME_PROGRESS,
          memoriesRead: ['mossbound-echo', 'mossbound-echo'],
        }),
      ),
    ).toBeNull();
    expect(FOREST_CHECKPOINT_IDS).toContain(INITIAL_GAME_PROGRESS.activeCheckpoint);
    expect(MEMORY_FRAGMENT_IDS).toEqual(['mossbound-echo']);

    expect(
      parseStoredGameProgress(
        JSON.stringify({ ...INITIAL_GAME_PROGRESS, ...fullyCollected(), nodeState: 'cleansing' }),
      )?.nodeState,
    ).toBe('cleansing');
  });

  test('migrates a consistent v1 save without inventing player discoveries', () => {
    const legacy = {
      version: 1,
      seeds: {
        'home-glow': 'revealed',
        'mushroom-glow': 'hidden',
        'creek-glow': 'hidden',
      },
      collectedCount: 0,
      nodeState: 'dormant',
      treeStage: 0,
      gateUnlocked: false,
    };

    expect(parseStoredGameProgress(JSON.stringify(legacy))).toEqual({
      ...legacy,
      version: 2,
      activeCheckpoint: 'spawn',
      memoriesRead: [],
    });
  });
});

function fullyCollected() {
  return {
    seeds: {
      'home-glow': 'collected' as const,
      'mushroom-glow': 'collected' as const,
      'creek-glow': 'collected' as const,
    },
    collectedCount: 3,
  };
}
