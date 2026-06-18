//! Backend → frontend events.
//!
//! Teaching points:
//! - Instead of the frontend polling `magic_field` on a timer, the backend
//!   *pushes* it: a background async task emits an event the UI subscribes to.
//! - `tauri::async_runtime::spawn` + `tokio::time::interval` drive the loop.
//! - The shared lock is read **after** `.await` and released immediately, so we
//!   never hold a `std::sync::Mutex` guard across an await point.

use crate::magic::compute_magic_field;
use crate::state::AppState;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime};

/// Event name the frontend listens on for magic-field updates.
pub const MAGIC_FIELD_EVENT: &str = "magic-field";

/// Emit cadence — matches the previous frontend polling interval.
const EMIT_INTERVAL: Duration = Duration::from_millis(350);

/// Spawn the background task that periodically emits the magic field for the
/// currently selected seed. Stops when the app handle can no longer emit.
pub fn spawn_magic_field_emitter<R: Runtime>(app: AppHandle<R>, state: AppState) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(EMIT_INTERVAL);
        let mut tick: u32 = 0;
        loop {
            interval.tick().await;
            tick = tick.wrapping_add(1);
            // Lock acquired and dropped here, before the next await.
            let seed = state.settings().seed;
            let field = compute_magic_field(seed, tick);
            if app.emit(MAGIC_FIELD_EVENT, &field).is_err() {
                break; // window/app gone — stop the loop.
            }
        }
    });
}
