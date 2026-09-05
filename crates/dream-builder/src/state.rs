//! Shared, mutable application state.
//!
//! Teaching points:
//! - `Arc<Mutex<Inner>>` is the canonical way to share owned, mutable state
//!   across Tauri command handlers (which may run on different threads).
//! - The public methods lock, do the smallest possible operation, and return
//!   owned clones — locks are never held across `.await` (these are all sync).
//! - `Settings` derives `Serialize`/`Deserialize` so it round-trips to disk.

use crate::domain::detail::DetailInfo;
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
}

/// Cheaply-cloneable handle to the shared state (clones share one `Mutex`).
#[derive(Clone)]
pub struct AppState {
    inner: Arc<Mutex<Inner>>,
}

impl AppState {
    pub fn new(settings: Settings) -> Self {
        let history = vec![settings.seed];
        Self {
            inner: Arc::new(Mutex::new(Inner {
                settings,
                history,
                cached_seed: None,
                cached_scene: None,
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

    pub fn set_settings(&self, settings: Settings) {
        self.lock().settings = settings;
    }

    /// Update the seed used by background systems without replacing the other
    /// persisted preferences in the same settings snapshot.
    pub fn set_active_seed(&self, seed: u64) {
        self.lock().settings.seed = seed;
    }

    /// Record a freshly generated seed at the front of the history (most recent
    /// first), de-duplicated, capped at 32 entries.
    pub fn record_seed(&self, seed: u64) {
        let mut inner = self.lock();
        inner.history.retain(|&existing| existing != seed);
        inner.history.insert(0, seed);
        inner.history.truncate(32);
    }

    pub fn history(&self) -> Vec<u64> {
        self.lock().history.clone()
    }

    /// Return the cached scene if it matches `seed`.
    pub fn cached_scene(&self, seed: u64) -> Option<TreeScene> {
        let inner = self.lock();
        match inner.cached_seed {
            Some(cached) if cached == seed => inner.cached_scene.clone(),
            _ => None,
        }
    }

    pub fn cache_scene(&self, scene: &TreeScene) {
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

    #[test]
    fn history_dedupes_and_orders_recent_first() {
        let state = AppState::new(Settings::default());
        state.record_seed(1);
        state.record_seed(2);
        state.record_seed(1);
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

        state.set_active_seed(99);

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
}
