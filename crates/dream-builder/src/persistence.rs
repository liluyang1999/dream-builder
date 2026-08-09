//! Settings persistence via the Store plugin.
//!
//! Teaching points:
//! - Using a Tauri plugin from Rust through its extension trait (`StoreExt`).
//! - Converting library errors into our `AppError` with context (`map_err`),
//!   so failures surface meaningfully rather than being swallowed.
//! - Reads are best-effort: a missing/corrupt store falls back to defaults.

use crate::errors::AppError;
use crate::state::Settings;
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json";
const SETTINGS_KEY: &str = "settings";

/// Load settings, falling back to defaults on any read/parse failure.
pub fn load_settings<R: Runtime>(app: &AppHandle<R>) -> Settings {
    let Ok(store) = app.store(STORE_FILE) else {
        return Settings::default();
    };
    store
        .get(SETTINGS_KEY)
        .and_then(|value| serde_json::from_value(value).ok())
        .filter(|settings: &Settings| settings.validate().is_ok())
        .unwrap_or_default()
}

/// Persist settings to disk, returning a typed error on failure.
pub fn save_settings<R: Runtime>(app: &AppHandle<R>, settings: &Settings) -> Result<(), AppError> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::Persistence(e.to_string()))?;
    let value = serde_json::to_value(settings).map_err(|e| AppError::Persistence(e.to_string()))?;
    store.set(SETTINGS_KEY, value);
    store
        .save()
        .map_err(|e| AppError::Persistence(e.to_string()))?;
    Ok(())
}
