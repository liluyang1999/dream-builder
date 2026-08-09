import { beforeEach, describe, expect, test } from 'vitest';
import { INITIAL_GAME_PROGRESS, reduceGameProgress } from '../game/gameProgress';
import {
  LEGACY_PROGRESS_STORAGE_KEY,
  PROGRESS_BACKUP_STORAGE_KEY,
  PROGRESS_CORRUPT_STORAGE_KEY,
  PROGRESS_STORAGE_KEY,
  readProgressStorage,
  replaceProgressStorage,
  writeProgressStorage,
} from '../state/progressStorage';

describe('progress storage recovery', () => {
  beforeEach(() => localStorage.clear());

  test('backs up the previous valid snapshot before committing the next one', () => {
    const first = reduceGameProgress(INITIAL_GAME_PROGRESS, {
      type: 'reveal-seed',
      id: 'home-glow',
    });
    const second = reduceGameProgress(first, {
      type: 'collect-seed',
      id: 'home-glow',
    });

    expect(writeProgressStorage(localStorage, first)).toBe(true);
    expect(writeProgressStorage(localStorage, second)).toBe(true);

    expect(localStorage.getItem(PROGRESS_BACKUP_STORAGE_KEY)).toBe(JSON.stringify(first));
    expect(readProgressStorage(localStorage).progress).toEqual(second);
  });

  test('quarantines a corrupt primary and restores the valid backup', () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, '{broken');
    localStorage.setItem(PROGRESS_BACKUP_STORAGE_KEY, JSON.stringify(INITIAL_GAME_PROGRESS));

    const result = readProgressStorage(localStorage);

    expect(result).toEqual({
      progress: INITIAL_GAME_PROGRESS,
      status: 'recovered-backup',
    });
    expect(localStorage.getItem(PROGRESS_CORRUPT_STORAGE_KEY)).toBe('{broken');
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe(JSON.stringify(INITIAL_GAME_PROGRESS));
  });

  test('an explicitly confirmed new journey cannot resurrect the replaced backup', () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(INITIAL_GAME_PROGRESS));
    localStorage.setItem(PROGRESS_BACKUP_STORAGE_KEY, JSON.stringify(INITIAL_GAME_PROGRESS));

    expect(replaceProgressStorage(localStorage, INITIAL_GAME_PROGRESS)).toBe(true);
    expect(localStorage.getItem(PROGRESS_BACKUP_STORAGE_KEY)).toBeNull();
  });

  test('isolates an unreadable save instead of silently treating it as valid', () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, '{"version":99}');

    expect(readProgressStorage(localStorage)).toEqual({
      progress: null,
      status: 'reset-corrupt',
    });
    expect(localStorage.getItem(PROGRESS_CORRUPT_STORAGE_KEY)).toBe('{"version":99}');
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
  });

  test('persists a valid v1 migration and retires the legacy key', () => {
    const legacy = {
      ...INITIAL_GAME_PROGRESS,
      version: 1,
      activeCheckpoint: undefined,
      memoriesRead: undefined,
    };
    localStorage.setItem(LEGACY_PROGRESS_STORAGE_KEY, JSON.stringify(legacy));

    const result = readProgressStorage(localStorage);

    expect(result.status).toBe('migrated');
    expect(result.progress?.version).toBe(2);
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY)).toBeNull();
  });
});
