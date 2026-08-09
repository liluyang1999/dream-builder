//! Tauri command handlers — the IPC surface the frontend calls via `invoke`.
//!
//! Teaching points:
//! - `#[tauri::command]` turns a plain function into an IPC endpoint.
//! - `State<'_, AppState>` injects shared state; commands stay thin and delegate
//!   to the domain/generation layers.
//! - Fallible commands return `Result<_, AppError>`; `Ok` serializes as the
//!   value, `Err` rejects the JS promise with `{ code, message }`.
//! - `export_scene` is `async` and uses `tokio::fs` — real non-blocking I/O.

use crate::domain::detail::DetailInfo;
use crate::domain::scene::{MagicField, TreeScene};
use crate::errors::AppError;
use crate::generation::{FantasyTreeGenerator, SceneGenerator};
use crate::magic::compute_magic_field;
use crate::persistence;
use crate::state::{AppState, Settings};
use tauri::{AppHandle, State};

/// Build (or return cached) scene for `seed`, making it active and recording it.
#[tauri::command]
pub fn generate_tree(seed: u64, state: State<'_, AppState>) -> Result<TreeScene, AppError> {
    state.set_active_seed(seed);
    state.record_seed(seed);
    if let Some(cached) = state.cached_scene(seed) {
        return Ok(cached);
    }
    let scene = FantasyTreeGenerator.generate(seed.into());
    state.cache_scene(&scene);
    Ok(scene)
}

/// Look up the metadata for one interactive object.
#[tauri::command]
pub fn detail_info(seed: u64, id: String) -> Result<DetailInfo, AppError> {
    FantasyTreeGenerator.generate_detail(seed.into(), &id)
}

/// Compute the magic field on demand (the background emitter also pushes this).
#[tauri::command]
pub fn magic_field(seed: u64, tick: u32) -> MagicField {
    compute_magic_field(seed, tick)
}

/// Current persisted settings.
#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Settings {
    state.settings()
}

/// Recently used seeds, most recent first.
#[tauri::command]
pub fn seed_history(state: State<'_, AppState>) -> Vec<u64> {
    state.history()
}

/// Update settings in memory and persist them to disk.
#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: Settings,
) -> Result<(), AppError> {
    settings
        .validate()
        .map_err(|reason| AppError::InvalidSettings(reason.to_string()))?;
    state.set_settings(settings.clone());
    persistence::save_settings(&app, &settings)
}

/// Serialize the scene for `seed` to a JSON file at `path` (async I/O).
#[tauri::command]
pub async fn export_scene(path: String, seed: u64) -> Result<(), AppError> {
    let scene = FantasyTreeGenerator.generate(seed.into());
    let json = serde_json::to_string_pretty(&scene).map_err(|e| AppError::Export(e.to_string()))?;
    tokio::fs::write(&path, json)
        .await
        .map_err(|e| AppError::Export(e.to_string()))?;
    Ok(())
}
