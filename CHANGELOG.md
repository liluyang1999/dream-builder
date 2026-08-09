# Changelog

All notable changes are documented here. Product releases use only the
two-component `major.feature` contract. Build tools may receive a mechanically
derived compatibility value, but that value is not a second product version and
must not appear in player-facing UI, Windows Installed Apps, release files, or docs.

## [1.0] - 2026-08-10

### Added

- A single root `version.json` contract for public version 1.0, with automated
  checks across npm workspaces, Cargo, Tauri, the player UI, release files,
  Windows executable strings, and Installed Apps metadata.
- An explicit unpinned WebView2 Evergreen bootstrapper policy and a regression
  check that rejects accidental fixed-runtime configuration.
- A self-contained Chinese HTML knowledge archive under `knowledge/` covering
  the current product, TypeScript/React/R3F frontend, Rust backend, Tauri IPC,
  WebView2, security, performance, testing, and Windows release workflow.
- Automated HTML structure, anchor, local-link, coverage, and offline-asset
  verification in the standard project gate.
- Automated desktop security checks for the fixed loopback origin, CSP,
  least-privilege WebView permissions, and scoped log-directory access.
- A shared modal-focus contract with initial focus, Tab containment, close-key
  routing, and focus restoration across menus, settings, help, story, and diagnostics.

### Changed

- Release manifest schema 5 records only the public two-component version;
  output directories, deliverable names, Windows executable strings, and the
  Installed Apps entry all display 1.0.
- pnpm's content store, metadata cache, and virtual dependency tree are enforced
  below the repository root, with the global virtual store disabled.
- The M2 evidence workbench initializes new evidence drafts from the current
  public version instead of a stale hard-coded version.
- Compatible workspace dependencies were refreshed within their existing major
  lines, including React 19, R3F 9, Tauri 2 tooling, and Vitest 3; the test-only
  jsdom dependency moved to 30 to remove its deprecated encoding subdependency.
- Cargo's compatible lockfile set was refreshed through Tauri 2.11.5 and the
  current Tauri 2 plugin patches, pruning obsolete transitive crates.
- The Windows candidate workflow now uses the current Node 24-based
  `actions/upload-artifact` v7 release.
- Current documentation now has one product source of truth under `docs/game/`
  and one teaching source of truth under `knowledge/`.
- Light and automatic-light themes now use semantic product colors, including
  dedicated high-contrast borders, so title, credits, chapter, and utility copy
  remain readable on pale glass surfaces.
- The historical M2 capture is verified as an immutable report-and-artifact
  identity archive; the workflow no longer pretends a mutable current EXE is the
  exact binary measured in 2026-07.
- The Tauri CLI is pinned exactly to the upstream version from which the custom
  two-component NSIS display-version template was derived.
- SHA-256 evidence and release verification use a repository-owned streaming
  .NET implementation so stripped Windows CI sessions do not depend on the
  optional `Get-FileHash` cmdlet being available.

### Security

- Pinned `nanoid` 3.3.17 and PostCSS 8.5.23 across the Vite/Vitest dependency
  graph to remove the current high-severity issues and the later advisory for
  PostCSS's incomplete earlier source-map fix.
- Removed the unused direct filesystem plugin from the desktop application and
  reduced WebView capabilities to core close, save dialog, export reveal, and
  log-directory opening with an explicit application-log scope.

### Initial foundation completed on 2026-07-25

First complete single-chapter release of **Wisdom Tree Forest / 智慧树之森**.

#### Added

- **Complete game session**: title, continue/new journey confirmation, pause,
  return-to-title, chapter ending, credits, safe quit, and automatic progress.
- **Cartoon forest**: layered terrain, paths, boundary woodland, creek,
  mushroom grove, ruins, stylized vegetation, keeper avatar, and restoration
  changes controlled by graphics quality.
- **Player experience**: keyboard/mouse and standard gamepad input, procedural
  ambient music and effects, visual/audio progression feedback, onboarding,
  objective HUD, checkpoints, memory story, direction purification, and photo mode.
- **Preferences and recovery**: audio mix, camera sensitivity, three graphics
  tiers, reduced motion, high contrast, larger text, hint control, versioned
  save migration, backup restore, corrupt-save quarantine, and recovery notice.
- **Release operations**: consistent 1.0 product metadata, game-oriented NSIS
  copy, reproducible Windows release assembly, SHA-256 manifest, CI artifact
  workflow, source-tree fingerprinting, certificate-store production signing,
  independent candidate/production/install-state verification, and an
  install/upgrade/uninstall/recovery runbook.

#### Changed

- Seed and scene/model export controls moved into a collapsed Forest Workshop,
  keeping the default HUD focused on the player objective.
- Browser-only fallback remained available for development while the packaged
  application used the deterministic Rust backend.
- The build toolchain pinned PostCSS 8.5.18 to remove the high-severity
  source-map path traversal advisory from every Vite/Vitest dependency path.
- The deferred 3D scene separated the stable Three engine, R3F/Drei runtime,
  post-processing effects, optional glTF exporter, and game scene code, with
  build-time size budgets for initial-shell isolation.
- The target Windows device completed a per-user NSIS lifecycle: install, first
  launch, single-instance focus, normal exit, uninstall, and retained player
  data with no program residue.

### Earlier engineering foundation completed on 2026-06-18

Pre-release teaching-grade rebuild of the Dream Builder Fantasy Tree. It is part
of the 1.0 product history and is not presented as a separate public version.

#### Added

- **Monorepo**: pnpm workspace + Cargo workspace with unified config and a
  lint → typecheck → test → build gate.
- **Rust backend**: modular domain/generation/state/events/commands layers,
  structured errors, deterministic generation, managed state, async events,
  native menu/tray, plugins, ACL, and CSP.
- **Frontend**: React 19 + R3F, Zustand, typed and validated IPC, Web Worker
  fallback, native events, scene export, reusable liquid-glass components, and
  a custom GLSL Fresnel crystal shader.
- **Packaging and teaching**: bilingual per-user NSIS packaging and a
  multi-chapter teaching set, now consolidated into the 1.0 HTML archive.
