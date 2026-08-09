// @vitest-environment node

import { describe, expect, test } from 'vitest';
import {
  type GameplayPerformanceSnapshot,
  deriveGameplayPerformanceEvents,
} from '../performance/gameplayPerformanceEvents';

const ready: GameplayPerformanceSnapshot = {
  seed: 424242,
  source: 'fallback',
  activeCheckpoint: 'ruinGate',
  collectedCount: 3,
  memoriesRead: 1,
  nodeState: 'ready',
  treeStage: 0,
};

describe('deriveGameplayPerformanceEvents', () => {
  test('describes the bounded baseline when capture begins', () => {
    expect(deriveGameplayPerformanceEvents(null, ready)).toEqual([
      { type: 'mark', name: 'scene-seed:424242' },
      { type: 'mark', name: 'source:fallback' },
      { type: 'mark', name: 'checkpoint:ruinGate' },
      { type: 'mark', name: 'light-seeds:3' },
      { type: 'mark', name: 'memory-fragments:1' },
      { type: 'mark', name: 'restoration:ready' },
      { type: 'mark', name: 'tree-stage:0' },
    ]);
  });

  test('brackets cleansing and marks only changed public game state', () => {
    const cleansing = { ...ready, nodeState: 'cleansing' };
    expect(deriveGameplayPerformanceEvents(ready, cleansing)).toEqual([
      { type: 'mark', name: 'restoration:cleansing' },
      { type: 'begin-phase', name: 'cleansing' },
    ]);

    expect(
      deriveGameplayPerformanceEvents(cleansing, {
        ...cleansing,
        nodeState: 'restored',
        treeStage: 1,
      }),
    ).toEqual([
      { type: 'end-phase', name: 'cleansing' },
      { type: 'mark', name: 'restoration:restored' },
      { type: 'mark', name: 'tree-stage:1' },
    ]);
  });
});
