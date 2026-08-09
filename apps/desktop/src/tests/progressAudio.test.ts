import { describe, expect, test } from 'vitest';
import { gainFromPercent } from '../audio/forestAudio';
import { cuesForProgressChange } from '../audio/progressAudio';
import { type GameProgress, INITIAL_GAME_PROGRESS } from '../game/gameProgress';

describe('forest audio rules', () => {
  test('maps percentages to bounded perceptual gain', () => {
    expect(gainFromPercent(-1)).toBe(0);
    expect(gainFromPercent(50)).toBe(0.25);
    expect(gainFromPercent(100)).toBe(1);
    expect(gainFromPercent(140)).toBe(1);
  });

  test('emits only cues represented by committed progress transitions', () => {
    const next: GameProgress = {
      ...INITIAL_GAME_PROGRESS,
      collectedCount: 1,
      activeCheckpoint: 'creek',
      memoriesRead: ['mossbound-echo'],
      nodeState: 'cleansing',
    };

    expect(cuesForProgressChange(INITIAL_GAME_PROGRESS, next)).toEqual([
      'seed',
      'checkpoint',
      'memory',
      'ritual',
    ]);
    expect(cuesForProgressChange(next, next)).toEqual([]);
  });

  test('adds the restoration cue only on the transition into the restored state', () => {
    const ready = { ...INITIAL_GAME_PROGRESS, nodeState: 'ready' as const };
    const restored = { ...ready, nodeState: 'restored' as const };
    expect(cuesForProgressChange(ready, restored)).toEqual(['restore']);
  });
});
