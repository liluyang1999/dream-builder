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
    }

    // A v2 backup belongs to the current save lineage. A leftover v1 key may
    // predate it, so only migrate v1 when neither v2 snapshot is usable.
    const backupRaw = storage.getItem(PROGRESS_BACKUP_STORAGE_KEY);
    const backup = backupRaw ? parseStoredGameProgress(backupRaw) : null;
    if (backup && backupRaw) {
      return recoverBackup(storage, backup, backupRaw, primaryRaw);
    }

    const legacyRaw = storage.getItem(LEGACY_PROGRESS_STORAGE_KEY);
    if (legacyRaw) {
      const migrated = parseStoredGameProgress(legacyRaw);
      if (migrated) {
        try {
          if (primaryRaw) quarantine(storage, primaryRaw);
          storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(migrated));
          storage.removeItem(LEGACY_PROGRESS_STORAGE_KEY);
        } catch {
          return { progress: migrated, status: 'storage-unavailable' };
        }
        return { progress: migrated, status: 'migrated' };
      }
    }

    if (primaryRaw) return isolateCorruptSave(storage, PROGRESS_STORAGE_KEY, primaryRaw);
    if (legacyRaw) return isolateCorruptSave(storage, LEGACY_PROGRESS_STORAGE_KEY, legacyRaw);
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

function recoverBackup(
  storage: ProgressStorage,
  backup: GameProgress,
  backupRaw: string,
  primaryRaw: string | null,
): ProgressStorageRead {
  try {
    const legacyRaw = storage.getItem(LEGACY_PROGRESS_STORAGE_KEY);
    if (primaryRaw) quarantine(storage, primaryRaw);
    else if (legacyRaw && !parseStoredGameProgress(legacyRaw)) quarantine(storage, legacyRaw);
    storage.setItem(PROGRESS_STORAGE_KEY, backupRaw);
    // Retire the old source only after the chosen snapshot is durable.
    if (legacyRaw) storage.removeItem(LEGACY_PROGRESS_STORAGE_KEY);
    return { progress: backup, status: 'recovered-backup' };
  } catch {
    return { progress: backup, status: 'storage-unavailable' };
  }
}

function isolateCorruptSave(
  storage: ProgressStorage,
  corruptKey: string,
  corruptRaw: string,
): ProgressStorageRead {
  try {
    quarantine(storage, corruptRaw);
    storage.removeItem(corruptKey);
    return { progress: null, status: 'reset-corrupt' };
  } catch {
    return { progress: null, status: 'storage-unavailable' };
  }
}

function quarantine(storage: ProgressStorage, raw: string): void {
  storage.setItem(PROGRESS_CORRUPT_STORAGE_KEY, raw);
}
