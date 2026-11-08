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

fn magic_field_interval() -> tokio::time::Interval {
    let mut interval = tokio::time::interval(EMIT_INTERVAL);
    // The field is current visual state, not a history that must be replayed.
    // Resume at normal cadence instead of flooding IPC after an executor stall.
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    interval
}

/// Spawn the background task that periodically emits the magic field for the
/// currently selected seed. Stops when the app handle can no longer emit.
pub fn spawn_magic_field_emitter<R: Runtime>(app: AppHandle<R>, state: AppState) {
    tauri::async_runtime::spawn(async move {
        let mut interval = magic_field_interval();
        let mut tick: u32 = 0;
        loop {
            interval.tick().await;
            tick = tick.wrapping_add(1);
            // Lock acquired and dropped here, before the next await.
            let seed = state.active_scene_seed();
            let field = compute_magic_field(seed, tick);
            if app.emit(MAGIC_FIELD_EVENT, &field).is_err() {
                break; // window/app gone — stop the loop.
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::future::poll_fn;
    use std::task::Poll;

    #[test]
    fn stalled_emitter_resumes_without_replaying_missed_updates() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_time()
            .start_paused(true)
            .build()
            .unwrap();
        runtime.block_on(async {
            let mut interval = magic_field_interval();
            // Initial state is published immediately.
            assert!(
                poll_fn(|context| Poll::Ready(interval.poll_tick(context)))
                    .await
                    .is_ready()
            );

            tokio::time::advance(EMIT_INTERVAL * 20).await;
            // Publish one current state after the executor resumes.
            assert!(
                poll_fn(|context| Poll::Ready(interval.poll_tick(context)))
                    .await
                    .is_ready()
            );
            // A visual-state emitter must not flood IPC with missed history.
            assert!(
                poll_fn(|context| Poll::Ready(interval.poll_tick(context)))
                    .await
                    .is_pending()
            );

            tokio::time::advance(EMIT_INTERVAL).await;
            assert!(
                poll_fn(|context| Poll::Ready(interval.poll_tick(context)))
                    .await
                    .is_ready()
            );
        });
    }
}
