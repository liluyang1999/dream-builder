//! Shared, mutable application state.
//!
//! Teaching points:
//! - `Arc<Mutex<Inner>>` is the canonical way to share owned, mutable state
//!   across Tauri command handlers (which may run on different threads).
//! - The public methods lock, do the smallest possible operation, and return
//!   owned clones — locks are never held across `.await` (these are all sync).
//! - `Settings` derives `Serialize`/`Deserialize` so it round-trips to disk.

use crate::domain::detail::DetailInfo;
use crate::domain::geometry::validate_wire_seed;
use crate::domain::scene::TreeScene;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

/// UI/theme preference, persisted across launches.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Auto,
    Light,
    Dark,
}

/// Rendering cost preset shared with the frontend.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GraphicsQuality {
    Low,
    Balanced,
    High,
}

/// User-interface text size preset.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TextScale {
    Normal,
    Large,
}

/// User-facing settings persisted to the app config store.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub seed: u64,
    pub theme: Theme,
    pub reduced_motion: bool,
    pub graphics_quality: GraphicsQuality,
    pub master_volume: u8,
    pub music_volume: u8,
    pub effects_volume: u8,
    pub camera_sensitivity: u8,
    pub high_contrast: bool,
    pub text_scale: TextScale,
    pub show_hints: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            seed: 424242,
            theme: Theme::Auto,
            reduced_motion: false,
            graphics_quality: GraphicsQuality::Balanced,
            master_volume: 80,
            music_volume: 55,
            effects_volume: 75,
            camera_sensitivity: 100,
            high_contrast: false,
            text_scale: TextScale::Normal,
            show_hints: true,
        }
    }
}

impl Settings {
    pub fn validate(&self) -> Result<(), &'static str> {
        validate_wire_seed(self.seed)?;
        if self.master_volume > 100 {
            return Err("主音量必须在 0 到 100 之间");
        }
        if self.music_volume > 100 {
            return Err("音乐音量必须在 0 到 100 之间");
        }
        if self.effects_volume > 100 {
            return Err("音效音量必须在 0 到 100 之间");
        }
        if !(50..=150).contains(&self.camera_sensitivity) {
            return Err("镜头灵敏度必须在 50 到 150 之间");
        }
        Ok(())
    }
}

#[derive(Debug)]
struct Inner {
    settings: Settings,
    history: Vec<u64>,
    cached_seed: Option<u64>,
    cached_scene: Option<TreeScene>,
    scene_request_generation: u64,
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct SceneRequest {
    generation: u64,
    pub(crate) seed: u64,
}

/// Cheaply-cloneable handle to the shared state (clones share one `Mutex`).
#[derive(Clone)]
pub struct AppState {
    inner: Arc<Mutex<Inner>>,
    settings_commit: Arc<Mutex<()>>,
}

impl AppState {
    pub fn new(settings: Settings) -> Self {
        let history = vec![settings.seed];
        Self {
            settings_commit: Arc::new(Mutex::new(())),
            inner: Arc::new(Mutex::new(Inner {
                settings,
                history,
                cached_seed: None,
                cached_scene: None,
                scene_request_generation: 0,
            })),
        }
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Inner> {
        // Poisoning only occurs if another thread panicked while holding the
        // lock — that is a bug, so surfacing it loudly is correct.
        self.inner.lock().expect("app state mutex poisoned")
    }

    pub fn settings(&self) -> Settings {
        self.lock().settings.clone()
    }

    /// Seed of the scene currently committed for background effects.
    pub fn active_scene_seed(&self) -> u64 {
        let inner = self.lock();
        inner.cached_seed.unwrap_or(inner.settings.seed)
    }

    /// Serialize disk and memory commits without blocking read-only state access.
    /// Call this from a blocking worker; the inner state lock is never held
    /// during filesystem I/O, and a failed save leaves the snapshot untouched.
    pub(crate) fn commit_settings<E>(
        &self,
        settings: Settings,
        persist: impl FnOnce(&Settings) -> Result<(), E>,
    ) -> Result<(), E> {
        let _commit = self
            .settings_commit
            .lock()
            .expect("settings commit mutex poisoned");
        persist(&settings)?;
        self.lock().settings = settings;
        Ok(())
    }

    /// Commit only the newest request: an older worker may finish after it.
    /// Active seed, history and scene cache change together under one lock.
    pub(crate) fn finish_scene_request(&self, request: SceneRequest, scene: &TreeScene) {
        let _commit = self
            .settings_commit
            .lock()
            .expect("settings commit mutex poisoned");
        let mut inner = self.lock();
        if request.generation != inner.scene_request_generation {
            return;
        }
        inner.settings.seed = request.seed;
        inner.history.retain(|&existing| existing != request.seed);
        inner.history.insert(0, request.seed);
        inner.history.truncate(32);
        inner.cached_seed = Some(scene.seed);
        inner.cached_scene = Some(scene.clone());
    }

    pub fn history(&self) -> Vec<u64> {
        self.lock().history.clone()
    }

    pub(crate) fn begin_scene_request(&self, seed: u64) -> SceneRequest {
        let mut inner = self.lock();
        inner.scene_request_generation = inner.scene_request_generation.wrapping_add(1);
        SceneRequest {
            generation: inner.scene_request_generation,
            seed,
        }
    }

    /// Return the cached scene if it matches `seed`.
    pub fn cached_scene(&self, seed: u64) -> Option<TreeScene> {
        let inner = self.lock();
        match inner.cached_seed {
            Some(cached) if cached == seed => inner.cached_scene.clone(),
            _ => None,
        }
    }

    // Fixtures may populate a cache directly; production writes go exclusively
    // through finish_scene_request so stale workers cannot change active effects.
    #[cfg(test)]
    fn cache_scene(&self, scene: &TreeScene) {
        let mut inner = self.lock();
        inner.cached_seed = Some(scene.seed);
        inner.cached_scene = Some(scene.clone());
    }

    /// Reuse one cached detail without cloning or regenerating the whole scene.
    /// A lookup never changes the active seed or its history.
    pub fn cached_detail(&self, seed: u64, id: &str) -> Option<DetailInfo> {
        let inner = self.lock();
        let scene = inner
            .cached_scene
            .as_ref()
            .filter(|scene| scene.seed == seed)?;
        scene
            .details
            .iter()
            .find(|detail| detail.id == id.trim())
            .cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn activate_seed(state: &AppState, seed: u64) {
        use crate::generation::SceneGenerator;
        let request = state.begin_scene_request(seed);
        let scene = crate::generation::FantasyTreeGenerator.generate(seed.into());
        state.finish_scene_request(request, &scene);
    }

    #[test]
    fn history_dedupes_and_orders_recent_first() {
        let state = AppState::new(Settings::default());
        activate_seed(&state, 1);
        activate_seed(&state, 2);
        activate_seed(&state, 1);
        let history = state.history();
        assert_eq!(history.first(), Some(&1));
        assert_eq!(history.iter().filter(|&&s| s == 1).count(), 1);
    }

    #[test]
    fn cache_matches_only_same_seed() {
        let state = AppState::new(Settings::default());
        let scene = crate::generation::FantasyTreeGenerator;
        use crate::generation::SceneGenerator;
        let built = scene.generate(7u64.into());
        state.cache_scene(&built);
        assert!(state.cached_scene(7).is_some());
        assert!(state.cached_scene(8).is_none());
    }

    #[test]
    fn cached_detail_matches_seed_and_normalized_id_without_changing_state() {
        use crate::generation::SceneGenerator;
        let state = AppState::new(Settings::default());
        let settings = state.settings();
        let history = state.history();
        let scene = crate::generation::FantasyTreeGenerator.generate(7u64.into());
        assert!(state.cached_detail(7, "rune-0").is_none());
        state.cache_scene(&scene);

        for detail in &scene.details {
            assert_eq!(
                state.cached_detail(7, &format!(" {} ", detail.id)),
                Some(detail.clone())
            );
            assert!(state.cached_detail(8, &detail.id).is_none());
        }
        assert!(state.cached_detail(7, "missing-detail").is_none());
        assert!(state.cached_detail(7, " ").is_none());
        assert_eq!(state.settings(), settings);
        assert_eq!(state.history(), history);

        let replacement = crate::generation::FantasyTreeGenerator.generate(8u64.into());
        state.cache_scene(&replacement);
        assert!(state.cached_detail(7, "rune-0").is_none());
        assert_eq!(
            state.cached_detail(8, "rune-0"),
            replacement
                .details
                .iter()
                .find(|detail| detail.id == "rune-0")
                .cloned()
        );
    }

    #[test]
    fn active_seed_updates_without_losing_other_preferences() {
        let state = AppState::new(Settings {
            seed: 1,
            theme: Theme::Dark,
            reduced_motion: true,
            ..Settings::default()
        });

        activate_seed(&state, 99);

        assert_eq!(
            state.settings(),
            Settings {
                seed: 99,
                theme: Theme::Dark,
                reduced_motion: true,
                ..Settings::default()
            }
        );
    }

    #[test]
    fn legacy_settings_deserialize_with_product_defaults() {
        let settings: Settings =
            serde_json::from_str(r#"{"seed":77,"theme":"dark","reducedMotion":true}"#)
                .expect("legacy settings should remain readable");

        assert_eq!(settings.seed, 77);
        assert_eq!(settings.theme, Theme::Dark);
        assert!(settings.reduced_motion);
        assert_eq!(settings.graphics_quality, GraphicsQuality::Balanced);
        assert_eq!(settings.master_volume, 80);
        assert_eq!(settings.text_scale, TextScale::Normal);
        assert!(settings.show_hints);
    }

    #[test]
    fn settings_reject_values_outside_the_wire_contract() {
        let invalid_volume = Settings {
            master_volume: 101,
            ..Settings::default()
        };
        assert!(invalid_volume.validate().is_err());

        let invalid_camera = Settings {
            camera_sensitivity: 49,
            ..Settings::default()
        };
        assert!(invalid_camera.validate().is_err());
    }

    #[test]
    fn settings_reject_seeds_that_javascript_cannot_represent_exactly() {
        let unsafe_seed = Settings {
            seed: 9_007_199_254_740_992,
            ..Settings::default()
        };
        assert!(unsafe_seed.validate().is_err());

        let maximum = Settings {
            seed: 9_007_199_254_740_991,
            ..Settings::default()
        };
        assert!(maximum.validate().is_ok());
    }
}
