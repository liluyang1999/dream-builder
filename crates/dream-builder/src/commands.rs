//! Tauri command handlers — the IPC surface the frontend calls via `invoke`.
//!
//! Teaching points:
//! - `#[tauri::command]` turns a plain function into an IPC endpoint.
//! - `State<'_, AppState>` injects shared state; commands stay thin and delegate
//!   to the domain/generation layers.
//! - Fallible commands return `Result<_, AppError>`; `Ok` serializes as the
//!   value, `Err` rejects the JS promise with `{ code, message }`.
//! - File commands use blocking workers so disk I/O never blocks the UI thread.

use crate::atomic_file;
use crate::domain::detail::DetailInfo;
use crate::domain::geometry::validate_wire_seed;
use crate::domain::scene::{MagicField, TreeScene};
use crate::errors::AppError;
use crate::generation::{FantasyTreeGenerator, SceneGenerator};
use crate::magic::compute_magic_field;
use crate::persistence;
use crate::state::{AppState, SceneRequest, Settings};
use tauri::{AppHandle, State};

/// Build (or return cached) scene for `seed`, making it active and recording it.
#[tauri::command]
pub async fn generate_tree(seed: u64, state: State<'_, AppState>) -> Result<TreeScene, AppError> {
    validate_wire_seed(seed).map_err(|_| AppError::InvalidSeed)?;
    let request = state.begin_scene_request(seed);
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || generate_scene_snapshot(request, &state))
        .await
        .map_err(|error| AppError::Generation(error.to_string()))
}

fn generate_scene_snapshot(request: SceneRequest, state: &AppState) -> TreeScene {
    let scene = state
        .cached_scene(request.seed)
        .unwrap_or_else(|| FantasyTreeGenerator.generate(request.seed.into()));
    state.finish_scene_request(request, &scene);
    scene
}

/// Look up the metadata for one interactive object.
#[tauri::command]
pub fn detail_info(
    seed: u64,
    id: String,
    state: State<'_, AppState>,
) -> Result<DetailInfo, AppError> {
    validate_wire_seed(seed).map_err(|_| AppError::InvalidSeed)?;
    if let Some(detail) = state.cached_detail(seed, &id) {
        return Ok(detail);
    }
    FantasyTreeGenerator.generate_detail(seed.into(), &id)
}

/// Compute the magic field on demand (the background emitter also pushes this).
#[tauri::command]
pub fn magic_field(seed: u64, tick: u32) -> Result<MagicField, AppError> {
    validate_wire_seed(seed).map_err(|_| AppError::InvalidSeed)?;
    Ok(compute_magic_field(seed, tick))
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
pub async fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: Settings,
) -> Result<(), AppError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        save_settings_snapshot(&state, settings, |settings| {
            persistence::save_settings(&app, settings)
        })
    })
    .await
    .map_err(|error| AppError::Persistence(error.to_string()))?
}

fn save_settings_snapshot(
    state: &AppState,
    settings: Settings,
    persist: impl FnOnce(&Settings) -> Result<(), AppError>,
) -> Result<(), AppError> {
    settings
        .validate()
        .map_err(|reason| AppError::InvalidSettings(reason.to_string()))?;
    state.commit_settings(settings, persist)
}

/// Serialize the scene for `seed` to a JSON file at `path` (async I/O).
#[tauri::command]
pub async fn export_scene(path: String, seed: u64) -> Result<(), AppError> {
    validate_wire_seed(seed).map_err(|_| AppError::InvalidSeed)?;
    tauri::async_runtime::spawn_blocking(move || {
        let scene = FantasyTreeGenerator.generate(seed.into());
        let json =
            serde_json::to_vec_pretty(&scene).map_err(|e| AppError::Export(e.to_string()))?;
        atomic_file::write(std::path::Path::new(&path), &json)
            .map_err(|error| AppError::Export(error.to_string()))
    })
    .await
    .map_err(|error| AppError::Export(error.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn older_scene_worker_cannot_replace_a_newer_request_snapshot() {
        let state = AppState::new(Settings::default());
        let older = state.begin_scene_request(11);
        let newer = state.begin_scene_request(22);

        // The executor can finish workers in the opposite order from requests.
        let current_scene = generate_scene_snapshot(newer, &state);
        let stale_scene = generate_scene_snapshot(older, &state);

        assert_eq!(stale_scene.seed, 11);
        assert_eq!(state.settings().seed, 22);
        assert_eq!(state.history().first(), Some(&22));
        assert!(!state.history().contains(&11));
        assert_eq!(state.cached_scene(22), Some(current_scene));
        assert!(state.cached_scene(11).is_none());
    }

    #[test]
    fn late_settings_snapshot_does_not_change_the_active_scene_effects() {
        let state = AppState::new(Settings::default());
        assert_eq!(state.active_scene_seed(), Settings::default().seed);
        let current = state.begin_scene_request(22);
        generate_scene_snapshot(current, &state);

        save_settings_snapshot(
            &state,
            Settings {
                seed: 11,
                ..Settings::default()
            },
            |_| Ok(()),
        )
        .unwrap();

        assert_eq!(state.settings().seed, 11);
        assert_eq!(state.active_scene_seed(), 22);
        let newer = state.begin_scene_request(33);
        generate_scene_snapshot(newer, &state);
        generate_scene_snapshot(current, &state);
        assert_eq!(state.active_scene_seed(), 33);
    }

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

    #[test]
    fn native_magic_command_rejects_unsafe_seeds_and_accepts_safe_boundary() {
        use crate::domain::geometry::MAX_SAFE_SEED;

        assert_eq!(
            magic_field(MAX_SAFE_SEED + 1, 0).unwrap_err().code(),
            "invalid_seed"
        );
        assert!(magic_field(MAX_SAFE_SEED, u32::MAX).is_ok());
    }

    #[test]
    fn export_command_validates_seed_and_replaces_complete_scene_json() {
        use crate::atomic_file::tests::TestDirectory;
        use crate::domain::geometry::MAX_SAFE_SEED;
        use std::fs;

        let directory = TestDirectory::new();
        let path = directory.path().join("scene.json");
        let export_path = path.to_string_lossy().into_owned();

        let error =
            tauri::async_runtime::block_on(export_scene(export_path.clone(), MAX_SAFE_SEED + 1))
                .unwrap_err();
        assert_eq!(error.code(), "invalid_seed");
        assert!(!path.exists());

        for seed in [424242, 77] {
            tauri::async_runtime::block_on(export_scene(export_path.clone(), seed)).unwrap();
            let exported: serde_json::Value =
                serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
            // Compare the actual JSON wire values: to_value widens f32 to f64,
            // while a JSON serializer emits the shorter round-trippable f32 text.
            let expected: serde_json::Value = serde_json::from_str(
                &serde_json::to_string(&FantasyTreeGenerator.generate(seed.into())).unwrap(),
            )
            .unwrap();
            assert_eq!(exported, expected);
            assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
        }
    }

    #[test]
    fn concurrent_settings_commits_leave_disk_and_memory_at_the_same_snapshot() {
        use std::sync::{Arc, Barrier, Mutex};

        let state = AppState::new(Settings::default());
        let disk = Arc::new(Mutex::new(Settings::default()));
        let ready = Arc::new(Barrier::new(8));
        std::thread::scope(|scope| {
            for volume in 0..8 {
                let state = state.clone();
                let disk = disk.clone();
                let ready = ready.clone();
                scope.spawn(move || {
                    ready.wait();
                    let settings = Settings {
                        master_volume: volume,
                        ..Settings::default()
                    };
                    let result = save_settings_snapshot(&state, settings, |settings| {
                        if volume == 3 {
                            return Err(AppError::Persistence("injected failure".into()));
                        }
                        *disk.lock().unwrap() = settings.clone();
                        // Give another ready writer a chance to enter between
                        // its disk operation and memory commit. No sleeps or
                        // timing assertion are needed for this invariant.
                        std::thread::yield_now();
                        Ok(())
                    });
                    assert_eq!(result.is_err(), volume == 3);
                });
            }
        });

        assert_eq!(state.settings(), *disk.lock().unwrap());
        assert_ne!(state.settings().master_volume, 3);
    }
}
