use std::{env, fs, path::PathBuf};

fn main() {
    tauri_build::try_build(tauri_build::Attributes::new())
        .expect("failed to run Tauri build script");

    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        rewrite_windows_display_version();
    }
}

fn rewrite_windows_display_version() {
    let manifest_directory =
        PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is required"));
    let version_path = manifest_directory.join("../../version.json");
    println!("cargo:rerun-if-changed={}", version_path.display());

    let contract: serde_json::Value = serde_json::from_str(
        &fs::read_to_string(&version_path).expect("failed to read version.json"),
    )
    .expect("version.json must contain valid JSON");
    let display_version = contract
        .get("productVersion")
        .and_then(serde_json::Value::as_str)
        .filter(|value| {
            let parts = value.split('.').collect::<Vec<_>>();
            parts.len() == 2
                && parts.iter().all(|part| {
                    !part.is_empty()
                        && part.chars().all(|character| character.is_ascii_digit())
                        && (*part == "0" || !part.starts_with('0'))
                })
        })
        .expect("version.json productVersion must contain exactly two numeric components");

    let output_directory =
        PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR is required for Windows resources"));
    let resource_path = output_directory.join("resource.rc");
    let resource = fs::read_to_string(&resource_path)
        .expect("Tauri did not generate the expected Windows resource file");
    let mut rewritten = resource;
    for key in ["FileVersion", "ProductVersion"] {
        rewritten = replace_version_string(&rewritten, key, display_version);
    }
    fs::write(&resource_path, rewritten).expect("failed to rewrite Windows version strings");

    embed_resource::compile_for(
        &resource_path,
        std::iter::empty::<&str>(),
        embed_resource::NONE,
    )
    .manifest_required()
    .expect("failed to recompile Windows resources with the public display version");
}

fn replace_version_string(resource: &str, key: &str, display_version: &str) -> String {
    let prefix = format!("VALUE \"{key}\", \"");
    let mut replacements = 0;
    let rewritten = resource
        .lines()
        .map(|line| {
            if let Some(index) = line.find(&prefix) {
                replacements += 1;
                format!("{}{}{}\"", &line[..index], prefix, display_version)
            } else {
                line.to_owned()
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    if replacements != 1 {
        panic!("expected one {key} Windows string resource, found {replacements}");
    }
    rewritten + "\n"
}
