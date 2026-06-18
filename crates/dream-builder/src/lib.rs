//! Dream Builder backend library.
//!
//! Exposing the app as a library (separate from the thin `main.rs` binary) lets
//! integration tests in `tests/` and doctests exercise the domain + generation
//! layers directly. `run()` wires up Tauri: plugins, shared state, menu, tray,
//! the background event emitter, and the command handlers.

pub mod commands;
pub mod domain;
pub mod errors;
pub mod events;
pub mod generation;
pub mod magic;
pub mod menu;
pub mod persistence;
pub mod state;

use crate::state::AppState;
use tauri::Manager;

/// Build and run the Tauri application.
pub fn run() {
    tauri::Builder::default()
        // One running instance; a second launch focuses the existing window.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            menu::focus_main_window(app);
        }))
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .menu(menu::build_menu)
        .on_menu_event(|app, event| menu::handle_menu_event(app, event.id.as_ref()))
        .setup(|app| {
            let handle = app.handle();
            let settings = persistence::load_settings(handle);
            let state = AppState::new(settings);
            app.manage(state.clone());
            menu::build_tray(handle)?;
            events::spawn_magic_field_emitter(handle.clone(), state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::generate_tree,
            commands::detail_info,
            commands::magic_field,
            commands::get_settings,
            commands::seed_history,
            commands::save_settings,
            commands::export_scene,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Dream Builder Fantasy Tree");
}
