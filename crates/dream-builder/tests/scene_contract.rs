//! Integration tests: exercise the public library API the way the frontend
//! relies on it. These live in `tests/` (separate crate) and can only touch
//! `pub` items — proving the surface we expose is actually usable.

use dream_builder::generation::{FantasyTreeGenerator, SceneGenerator};

#[test]
fn scene_serializes_with_camel_case_wire_keys() {
    let scene = FantasyTreeGenerator.generate(424242u64.into());
    let json = serde_json::to_value(&scene).expect("scene serializes");

    // The TS contract expects camelCase keys.
    assert!(json.get("leafClusters").is_some());
    assert!(
        json.get("backgroundTop").is_none(),
        "palette is nested, not top-level"
    );
    assert!(json["palette"].get("backgroundTop").is_some());
    assert_eq!(json["seed"], serde_json::json!(424242));
}

#[test]
fn details_reference_real_interactive_ids() {
    let scene = FantasyTreeGenerator.generate(7u64.into());
    let interactive: std::collections::HashSet<&str> = scene
        .leaf_clusters
        .iter()
        .map(|l| l.id.as_str())
        .chain(scene.runes.iter().map(|r| r.id.as_str()))
        .chain(scene.crystals.iter().map(|c| c.id.as_str()))
        .collect();

    for detail in &scene.details {
        assert!(
            interactive.contains(detail.id.as_str()),
            "detail {} has no matching interactive object",
            detail.id
        );
    }
}

#[test]
fn detail_kind_serializes_lowercase_union() {
    let scene = FantasyTreeGenerator.generate(1u64.into());
    let first = scene.details.first().expect("at least one detail");
    let json = serde_json::to_value(first).expect("detail serializes");
    let kind = json["kind"].as_str().expect("kind is a string");
    assert!(matches!(kind, "rune" | "crystal" | "leaf"));
}

#[test]
fn native_menu_dispatch_has_one_global_registration() {
    // Tauri's tray menu callback also joins the global listener list. A second
    // registration runs every action twice, cancelling toggles and double-quitting.
    // Check the wiring without requiring a native window in the test process.
    let registrations = [
        include_str!("../src/lib.rs"),
        include_str!("../src/menu.rs"),
    ]
    .iter()
    .map(|source| source.matches(".on_menu_event(").count())
    .sum::<usize>();

    assert_eq!(
        registrations, 1,
        "native menus must share one global dispatcher"
    );
}
