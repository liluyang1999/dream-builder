import type { GameProgress } from '../game/gameProgress';
import { parseStoredGameProgress } from '../game/gameProgress';

export const PROGRESS_STORAGE_KEY = 'dream-builder.progress.v2';
export const LEGACY_PROGRESS_STORAGE_KEY = 'dream-builder.progress.v1';
export const PROGRESS_BACKUP_STORAGE_KEY = 'dream-builder.progress.backup.v2';
export const PROGRESS_CORRUPT_STORAGE_KEY = 'dream-builder.progress.corrupt.v2';

export type ProgressRecoveryStatus =
  | 'none'
  | 'migrated'
  | 'recovered-backup'
  | 'reset-corrupt'
  | 'storage-unavailable';

export interface ProgressStorageRead {
  progress: GameProgress | null;
  status: ProgressRecoveryStatus;
}

type ProgressStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readProgressStorage(storage: ProgressStorage | null): ProgressStorageRead {
  if (!storage) return { progress: null, status: 'storage-unavailable' };

  try {
    const primaryRaw = storage.getItem(PROGRESS_STORAGE_KEY);
    if (primaryRaw) {
      const primary = parseStoredGameProgress(primaryRaw);
      if (primary) return { progress: primary, status: 'none' };
      return recoverCorruptPrimary(storage, primaryRaw);
    }

    const legacyRaw = storage.getItem(LEGACY_PROGRESS_STORAGE_KEY);
    if (legacyRaw) {
      const migrated = parseStoredGameProgress(legacyRaw);
      if (migrated) {
        storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(migrated));
        storage.removeItem(LEGACY_PROGRESS_STORAGE_KEY);
        return { progress: migrated, status: 'migrated' };
      }
      quarantine(storage, legacyRaw);
      storage.removeItem(LEGACY_PROGRESS_STORAGE_KEY);
      return { progress: null, status: 'reset-corrupt' };
    }

    const backupRaw = storage.getItem(PROGRESS_BACKUP_STORAGE_KEY);
    const backup = backupRaw ? parseStoredGameProgress(backupRaw) : null;
    if (backup && backupRaw) {
      storage.setItem(PROGRESS_STORAGE_KEY, backupRaw);
      return { progress: backup, status: 'recovered-backup' };
    }

    return { progress: null, status: 'none' };
  } catch {
    return { progress: null, status: 'storage-unavailable' };
  }
}

export function writeProgressStorage(
  storage: ProgressStorage | null,
  progress: GameProgress,
): boolean {
  if (!storage) return false;
  try {
    const previousRaw = storage.getItem(PROGRESS_STORAGE_KEY);
    if (previousRaw && parseStoredGameProgress(previousRaw)) {
      storage.setItem(PROGRESS_BACKUP_STORAGE_KEY, previousRaw);
    }
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    try {
      storage.removeItem(LEGACY_PROGRESS_STORAGE_KEY);
    } catch {
      // The new snapshot is already durable; stale-key cleanup is best-effort.
    }
    return true;
  } catch {
    return false;
  }
}

export function replaceProgressStorage(
  storage: ProgressStorage | null,
  progress: GameProgress,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    storage.removeItem(PROGRESS_BACKUP_STORAGE_KEY);
    storage.removeItem(LEGACY_PROGRESS_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function recoverCorruptPrimary(storage: ProgressStorage, corruptRaw: string): ProgressStorageRead {
  quarantine(storage, corruptRaw);
  const backupRaw = storage.getItem(PROGRESS_BACKUP_STORAGE_KEY);
  const backup = backupRaw ? parseStoredGameProgress(backupRaw) : null;
  if (backup && backupRaw) {
    storage.setItem(PROGRESS_STORAGE_KEY, backupRaw);
    return { progress: backup, status: 'recovered-backup' };
  }
  storage.removeItem(PROGRESS_STORAGE_KEY);
  return { progress: null, status: 'reset-corrupt' };
}

function quarantine(storage: ProgressStorage, raw: string): void {
  storage.setItem(PROGRESS_CORRUPT_STORAGE_KEY, raw);
}
