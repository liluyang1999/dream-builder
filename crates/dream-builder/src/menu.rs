//! Native application menu + system tray.
//!
//! Teaching points:
//! - Tauri 2 builds menus programmatically (`Menu`, `Submenu`, `MenuItem`,
//!   `PredefinedMenuItem`). Items carry stable string ids.
//! - Menu/tray clicks are turned into frontend events (`menu:<id>`), keeping all
//!   UI behavior in one place (the React/TS side) instead of split across langs.
//! - Tray construction returns `tauri::Result`; errors propagate with `?`.

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, Runtime};

/// Build the window menu bar.
pub fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let regenerate = MenuItem::with_id(app, "regenerate", "随机重新生成", true, None::<&str>)?;
    let reset_view = MenuItem::with_id(app, "reset_view", "重置视角", true, Some("R"))?;
    let toggle_hud = MenuItem::with_id(app, "toggle_hud", "显示/隐藏面板", true, Some("H"))?;
    let screenshot = MenuItem::with_id(app, "screenshot", "保存截图", true, Some("S"))?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = PredefinedMenuItem::quit(app, Some("退出"))?;
    let file = Submenu::with_items(
        app,
        "智慧树",
        true,
        &[
            &regenerate,
            &reset_view,
            &toggle_hud,
            &screenshot,
            &separator,
            &quit,
        ],
    )?;

    let about = MenuItem::with_id(app, "about", "关于", true, None::<&str>)?;
    let help = Submenu::with_items(app, "帮助", true, &[&about])?;

    Menu::with_items(app, &[&file, &help])
}

/// Forward a menu click to the frontend as a `menu:<id>` event.
pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    // Predefined items (quit) are handled by the OS; only forward our own ids.
    let forwarded = [
        "regenerate",
        "reset_view",
        "toggle_hud",
        "screenshot",
        "about",
    ];
    if forwarded.contains(&id) {
        let _ = app.emit(&format!("menu:{id}"), ());
    }
}

/// Build the system tray icon with a small context menu.
pub fn build_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "tray_show", "显示窗口", true, None::<&str>)?;
    let regenerate = MenuItem::with_id(app, "regenerate", "随机重新生成", true, None::<&str>)?;
    let quit = PredefinedMenuItem::quit(app, Some("退出"))?;
    let menu = Menu::with_items(app, &[&show, &regenerate, &quit])?;

    let mut builder = TrayIconBuilder::new()
        .tooltip("Dream Builder Fantasy Tree")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray_show" => focus_main_window(app),
            other => handle_menu_event(app, other),
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder.build(app)?;
    Ok(())
}

/// Bring the main window to the foreground.
pub fn focus_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
