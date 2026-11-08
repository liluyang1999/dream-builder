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

  test.each(['write-primary', 'remove-legacy'] as const)(
    'keeps readable legacy progress when migration fails at %s',
    (failure) => {
      const progress = reduceGameProgress(INITIAL_GAME_PROGRESS, {
        type: 'reveal-seed',
        id: 'creek-glow',
      });
      const raw = JSON.stringify({ ...progress, version: 1 });
      localStorage.setItem(LEGACY_PROGRESS_STORAGE_KEY, raw);
      const storage = {
        getItem: (key: string) => localStorage.getItem(key),
        setItem: (key: string, value: string) => {
          if (failure === 'write-primary') throw new Error('quota exceeded');
          localStorage.setItem(key, value);
        },
        removeItem: () => {
          throw new Error('storage is read-only');
        },
      };

      expect(readProgressStorage(storage)).toEqual({ progress, status: 'storage-unavailable' });
      expect(localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY)).toBe(raw);
    },
  );

  test.each(['missing-primary', 'quarantine', 'repair-primary'] as const)(
    'keeps a readable backup when recovery cannot write at %s',
    (failure) => {
      const progress = reduceGameProgress(INITIAL_GAME_PROGRESS, {
        type: 'reveal-seed',
        id: 'mushroom-glow',
      });
      const raw = JSON.stringify(progress);
      localStorage.setItem(PROGRESS_BACKUP_STORAGE_KEY, raw);
      if (failure !== 'missing-primary') localStorage.setItem(PROGRESS_STORAGE_KEY, '{broken');
      const storage = {
        getItem: (key: string) => localStorage.getItem(key),
        setItem: (key: string, value: string) => {
          const failedKey =
            failure === 'quarantine' ? PROGRESS_CORRUPT_STORAGE_KEY : PROGRESS_STORAGE_KEY;
          if (key === failedKey) {
            throw new Error('quota exceeded');
          }
          localStorage.setItem(key, value);
        },
        removeItem: (key: string) => localStorage.removeItem(key),
      };

      expect(readProgressStorage(storage)).toEqual({ progress, status: 'storage-unavailable' });
      expect(localStorage.getItem(PROGRESS_BACKUP_STORAGE_KEY)).toBe(raw);
      expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe(
        failure === 'missing-primary' ? null : '{broken',
      );
    },
  );

  test('recovers a valid backup even when the retired legacy key is corrupt', () => {
    const progress = reduceGameProgress(INITIAL_GAME_PROGRESS, {
      type: 'reveal-seed',
      id: 'creek-glow',
    });
    localStorage.setItem(LEGACY_PROGRESS_STORAGE_KEY, '{broken legacy');
    localStorage.setItem(PROGRESS_BACKUP_STORAGE_KEY, JSON.stringify(progress));

    expect(readProgressStorage(localStorage)).toEqual({ progress, status: 'recovered-backup' });
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe(JSON.stringify(progress));
    expect(localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(PROGRESS_CORRUPT_STORAGE_KEY)).toBe('{broken legacy');
  });

  test.each(['missing', 'corrupt'] as const)(
    'prefers the v2 backup over a valid v1 save when the primary is %s',
    (primary) => {
      const backup = { ...INITIAL_GAME_PROGRESS, activeCheckpoint: 'ruinGate' as const };
      localStorage.setItem(PROGRESS_BACKUP_STORAGE_KEY, JSON.stringify(backup));
      localStorage.setItem(
        LEGACY_PROGRESS_STORAGE_KEY,
        JSON.stringify({ ...INITIAL_GAME_PROGRESS, version: 1 }),
      );
      if (primary === 'corrupt') localStorage.setItem(PROGRESS_STORAGE_KEY, '{broken');

      expect(readProgressStorage(localStorage)).toEqual({
        progress: backup,
        status: 'recovered-backup',
      });
      expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe(JSON.stringify(backup));
      expect(localStorage.getItem(PROGRESS_BACKUP_STORAGE_KEY)).toBe(JSON.stringify(backup));
    },
  );

  test('keeps the valid primary ahead of both recovery sources', () => {
    const primary = { ...INITIAL_GAME_PROGRESS, activeCheckpoint: 'creek' as const };
    const backup = { ...INITIAL_GAME_PROGRESS, activeCheckpoint: 'ruinGate' as const };
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(primary));
    localStorage.setItem(PROGRESS_BACKUP_STORAGE_KEY, JSON.stringify(backup));
    localStorage.setItem(
      LEGACY_PROGRESS_STORAGE_KEY,
      JSON.stringify({ ...INITIAL_GAME_PROGRESS, version: 1 }),
    );

    expect(readProgressStorage(localStorage)).toEqual({ progress: primary, status: 'none' });
  });

  test.each(['missing', 'corrupt'] as const)(
    'migrates a valid v1 save after primary corruption when the backup is %s',
    (backup) => {
      const progress = reduceGameProgress(INITIAL_GAME_PROGRESS, {
        type: 'reveal-seed',
        id: 'home-glow',
      });
      localStorage.setItem(PROGRESS_STORAGE_KEY, '{broken primary');
      localStorage.setItem(
        LEGACY_PROGRESS_STORAGE_KEY,
        JSON.stringify({ ...progress, version: 1 }),
      );
      if (backup === 'corrupt') localStorage.setItem(PROGRESS_BACKUP_STORAGE_KEY, '{broken backup');

      expect(readProgressStorage(localStorage)).toEqual({ progress, status: 'migrated' });
      expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe(JSON.stringify(progress));
      expect(localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem(PROGRESS_CORRUPT_STORAGE_KEY)).toBe('{broken primary');
    },
  );

  test.each(['quarantine', 'write-primary', 'remove-legacy'] as const)(
    'preserves the valid v1 source when repairing a corrupt primary fails at %s',
    (failure) => {
      const progress = reduceGameProgress(INITIAL_GAME_PROGRESS, {
        type: 'reveal-seed',
        id: 'creek-glow',
      });
      const legacyRaw = JSON.stringify({ ...progress, version: 1 });
      localStorage.setItem(PROGRESS_STORAGE_KEY, '{broken primary');
      localStorage.setItem(LEGACY_PROGRESS_STORAGE_KEY, legacyRaw);
      const storage = {
        getItem: (key: string) => localStorage.getItem(key),
        setItem: (key: string, value: string) => {
          if (
            (failure === 'quarantine' && key === PROGRESS_CORRUPT_STORAGE_KEY) ||
            (failure === 'write-primary' && key === PROGRESS_STORAGE_KEY)
          ) {
            throw new Error('storage is read-only');
          }
          localStorage.setItem(key, value);
        },
        removeItem: (key: string) => {
          if (failure === 'remove-legacy') throw new Error('storage is read-only');
          localStorage.removeItem(key);
        },
      };

      expect(readProgressStorage(storage)).toEqual({ progress, status: 'storage-unavailable' });
      expect(localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY)).toBe(legacyRaw);
      expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe(
        failure === 'remove-legacy' ? JSON.stringify(progress) : '{broken primary',
      );
    },
  );

  test('does not fall back to the older v1 source when repairing a readable v2 backup fails', () => {
    const backup = { ...INITIAL_GAME_PROGRESS, activeCheckpoint: 'ruinGate' as const };
    const legacyRaw = JSON.stringify({ ...INITIAL_GAME_PROGRESS, version: 1 });
    localStorage.setItem(PROGRESS_BACKUP_STORAGE_KEY, JSON.stringify(backup));
    localStorage.setItem(LEGACY_PROGRESS_STORAGE_KEY, legacyRaw);
    const storage = {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: () => {
        throw new Error('storage is read-only');
      },
      removeItem: (key: string) => localStorage.removeItem(key),
    };

    expect(readProgressStorage(storage)).toEqual({
      progress: backup,
      status: 'storage-unavailable',
    });
    expect(localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY)).toBe(legacyRaw);
    expect(localStorage.getItem(PROGRESS_BACKUP_STORAGE_KEY)).toBe(JSON.stringify(backup));
  });
});
