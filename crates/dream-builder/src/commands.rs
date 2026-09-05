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
pub fn detail_info(
    seed: u64,
    id: String,
    state: State<'_, AppState>,
) -> Result<DetailInfo, AppError> {
    if let Some(detail) = state.cached_detail(seed, &id) {
        return Ok(detail);
    }
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
    save_settings_snapshot(&state, settings, |settings| {
        persistence::save_settings(&app, settings)
    })
}

fn save_settings_snapshot(
    state: &AppState,
    settings: Settings,
    persist: impl FnOnce(&Settings) -> Result<(), AppError>,
) -> Result<(), AppError> {
    settings
        .validate()
        .map_err(|reason| AppError::InvalidSettings(reason.to_string()))?;
    persist(&settings)?;
    state.set_settings(settings);
    Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn failed_settings_save_preserves_the_last_committed_snapshot() {
        let original = Settings::default();
        let state = AppState::new(original.clone());
        let updated = Settings {
            master_volume: 15,
            ..original.clone()
        };

        let error = save_settings_snapshot(&state, updated, |_| {
            Err(AppError::Persistence("test write failure".into()))
        })
        .expect_err("failed persistence must reject the command");

        assert_eq!(error.code(), "persistence_error");
        assert_eq!(state.settings(), original);
    }

    #[test]
    fn settings_are_committed_only_after_successful_persistence() {
        let original = Settings::default();
        let state = AppState::new(original.clone());
        let updated = Settings {
            high_contrast: true,
            ..original.clone()
        };

        save_settings_snapshot(&state, updated.clone(), |saved| {
            assert_eq!(saved, &updated);
            assert_eq!(state.settings(), original);
            Ok(())
        })
        .expect("successful persistence commits the snapshot");

        assert_eq!(state.settings(), updated);
    }

    #[test]
    fn invalid_settings_never_reach_persistence() {
        let original = Settings::default();
        let state = AppState::new(original.clone());
        let invalid = Settings {
            effects_volume: 101,
            ..original.clone()
        };

        let error = save_settings_snapshot(&state, invalid, |_| {
            panic!("invalid settings must not be persisted")
        })
        .expect_err("invalid settings must reject the command");

        assert_eq!(error.code(), "invalid_settings");
        assert_eq!(state.settings(), original);
    }
}
