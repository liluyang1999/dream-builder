//! Settings file adapter. The native state owns the only in-memory snapshot.
//!
//! The existing `{ "settings": ... }` JSON format stays compatible. Saving
//! preserves unknown root keys and atomically replaces the file; there is no
//! second plugin cache or implicit save during shutdown.

use crate::atomic_file;
use crate::errors::AppError;
use crate::state::Settings;
use serde_json::{Map, Value};
use std::fs::{self, File};
use std::io::{self, Read};
use std::path::Path;
use tauri::{AppHandle, Manager, Runtime};

const STORE_FILE: &str = "settings.json";
const SETTINGS_KEY: &str = "settings";
const MAX_SETTINGS_BYTES: u64 = 1024 * 1024;

/// Load settings, falling back to defaults on any read/parse/validation failure.
pub fn load_settings<R: Runtime>(app: &AppHandle<R>) -> Settings {
    let result = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::Persistence(error.to_string()))
        .and_then(|directory| load_settings_at(&directory.join(STORE_FILE)));
    match result {
        Ok(settings) => settings,
        Err(error) => {
            log::warn!("无法读取设置，将使用默认值：{error}");
            Settings::default()
        }
    }
}

/// Persist the full snapshot. Callers commit AppState only after this succeeds.
pub fn save_settings<R: Runtime>(app: &AppHandle<R>, settings: &Settings) -> Result<(), AppError> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::Persistence(error.to_string()))?;
    fs::create_dir_all(&directory).map_err(persistence_error)?;
    save_settings_at(&directory.join(STORE_FILE), settings)
}

fn load_settings_at(path: &Path) -> Result<Settings, AppError> {
    Ok(read_document(path)?
        .remove(SETTINGS_KEY)
        .and_then(|value| serde_json::from_value(value).ok())
        .filter(|settings: &Settings| settings.validate().is_ok())
        .unwrap_or_default())
}

fn save_settings_at(path: &Path, settings: &Settings) -> Result<(), AppError> {
    settings
        .validate()
        .map_err(|reason| AppError::InvalidSettings(reason.into()))?;
    let mut document = read_document(path)?;
    document.insert(
        SETTINGS_KEY.into(),
        serde_json::to_value(settings).map_err(persistence_error)?,
    );
    let bytes = serde_json::to_vec_pretty(&document).map_err(persistence_error)?;
    // Apply the same bound to writes so every successful save is readable.
    if bytes.len() as u64 > MAX_SETTINGS_BYTES {
        return Err(persistence_error("设置文件超过 1 MiB 上限"));
    }
    atomic_file::write(path, &bytes).map_err(persistence_error)
}

fn read_document(path: &Path) -> Result<Map<String, Value>, AppError> {
    let file = match File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(Map::new()),
        Err(error) => return Err(persistence_error(error)),
    };
    // A bounded read also protects against a file that grows after opening.
    let mut bytes = Vec::new();
    file.take(MAX_SETTINGS_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(persistence_error)?;
    if bytes.len() as u64 > MAX_SETTINGS_BYTES {
        return Err(persistence_error("设置文件超过 1 MiB 上限"));
    }
    // Match the former Store loader: a malformed document recovers to defaults.
    // Valid objects keep all keys so newer/other metadata survives a save.
    Ok(serde_json::from_slice(&bytes).unwrap_or_default())
}

fn persistence_error(error: impl std::fmt::Display) -> AppError {
    AppError::Persistence(error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::atomic_file::tests::TestDirectory;

    #[test]
    fn legacy_settings_load_and_saves_preserve_unrelated_root_keys() {
        let directory = TestDirectory::new();
        let path = directory.path().join(STORE_FILE);
        fs::write(
            &path,
            br#"{"settings":{"seed":77,"theme":"dark","reducedMotion":true},"future":{"v":3}}"#,
        )
        .unwrap();
        let loaded = load_settings_at(&path).unwrap();
        assert_eq!(loaded.seed, 77);
        assert_eq!(loaded.master_volume, Settings::default().master_volume);
        let updated = Settings {
            master_volume: 12,
            ..loaded
        };

        save_settings_at(&path, &updated).unwrap();

        assert_eq!(load_settings_at(&path).unwrap(), updated);
        assert_eq!(read_document(&path).unwrap()["future"]["v"], 3);
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn missing_corrupt_and_invalid_settings_recover_without_writing_on_read() {
        let directory = TestDirectory::new();
        let path = directory.path().join(STORE_FILE);
        assert_eq!(load_settings_at(&path).unwrap(), Settings::default());
        assert!(!path.exists());

        for bytes in [
            b"{incomplete JSON".as_slice(),
            br#"{"settings":{"masterVolume":101}}"#,
            br#"{"settings":{"seed":9007199254740992}}"#,
        ] {
            fs::write(&path, bytes).unwrap();
            assert_eq!(load_settings_at(&path).unwrap(), Settings::default());
            assert_eq!(fs::read(&path).unwrap(), bytes);
            save_settings_at(&path, &Settings::default()).unwrap();
            assert_eq!(load_settings_at(&path).unwrap(), Settings::default());
        }
    }

    #[test]
    fn invalid_snapshot_never_changes_existing_settings_file() {
        let directory = TestDirectory::new();
        let path = directory.path().join(STORE_FILE);
        save_settings_at(&path, &Settings::default()).unwrap();
        let original = fs::read(&path).unwrap();
        let invalid = Settings {
            master_volume: 101,
            ..Settings::default()
        };

        assert_eq!(
            save_settings_at(&path, &invalid).unwrap_err().code(),
            "invalid_settings"
        );
        assert_eq!(fs::read(&path).unwrap(), original);
    }

    #[test]
    fn oversized_existing_document_is_rejected_without_overwriting_it() {
        let directory = TestDirectory::new();
        let path = directory.path().join(STORE_FILE);
        let bytes = vec![b' '; MAX_SETTINGS_BYTES as usize + 1];
        fs::write(&path, &bytes).unwrap();

        assert!(load_settings_at(&path).is_err());
        assert!(save_settings_at(&path, &Settings::default()).is_err());
        assert_eq!(fs::read(&path).unwrap(), bytes);
    }

    #[cfg(windows)]
    #[test]
    fn failed_save_preserves_the_last_readable_snapshot_and_can_retry() {
        use std::fs::OpenOptions;
        use std::os::windows::fs::OpenOptionsExt;

        let directory = TestDirectory::new();
        let path = directory.path().join(STORE_FILE);
        let original = Settings::default();
        save_settings_at(&path, &original).unwrap();
        let occupied = OpenOptions::new()
            .read(true)
            .share_mode(0x0000_0001 | 0x0000_0002)
            .open(&path)
            .unwrap();
        let updated = Settings {
            master_volume: 12,
            ..original.clone()
        };

        assert_eq!(
            save_settings_at(&path, &updated).unwrap_err().code(),
            "persistence_error"
        );
        assert_eq!(load_settings_at(&path).unwrap(), original);
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
        drop(occupied);
        save_settings_at(&path, &updated).unwrap();
        assert_eq!(load_settings_at(&path).unwrap(), updated);
    }
}
