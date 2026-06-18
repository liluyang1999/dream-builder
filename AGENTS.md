# AGENTS.md

This file provides guidance to coding agents (Claude Code, Codex, Cursor, etc.) when working with code in this repository.

## Project

Dream Builder Fantasy Tree — a Tauri 2 desktop app that renders an interactive procedural 3D fantasy tree. Frontend (Vite + TypeScript + Three.js) handles WebGL rendering, picking, particles, and the UI. Backend (Rust) deterministically generates tree geometry, detail metadata, and a time-varying "magic field" exposed as Tauri commands.

> **Teaching refactor in progress.** This repo is being reshaped into a teaching-grade Tauri/React/Rust project. The plan and spec live under `docs/superpowers/`. The layout below is the current (post Phase-0) monorepo; the frontend is still vanilla TS until the React/R3F migration (Phase 2) lands.

## Layout

pnpm workspace (JS/TS) + Cargo workspace (Rust) monorepo:

```
dream-builder/
├── pnpm-workspace.yaml · package.json · tsconfig.base.json · biome.json
├── .editorconfig · .nvmrc · .gitattributes · vitest.workspace.ts · justfile
├── Cargo.toml (workspace) · rustfmt.toml
├── apps/
│   └── desktop/        # Vite + TypeScript + Three.js (pkg @dream-builder/desktop)
│       ├── index.html · package.json · tsconfig.json · vite.config.ts
│       └── src/
├── packages/           # shared/reusable TS packages (ipc-contracts, liquid-glass — added in P2/P3)
├── crates/
│   └── dream-builder/  # Rust + Tauri 2 (crate `dream-builder`)
│       ├── Cargo.toml · build.rs · tauri.conf.json · icons/ · src/
├── docs/
│   ├── design/         # legacy design notes
│   ├── superpowers/    # spec + implementation plan for the teaching refactor
│   └── teaching/       # teaching docs (added in P5)
├── README.md
├── CLAUDE.md → @AGENTS.md
└── AGENTS.md
```

Config is centralized: root `package.json` (shared dev tooling + script entrypoints), `tsconfig.base.json` (TS options, each package extends it), `biome.json` (lint + format in one tool), `vitest.workspace.ts` (test discovery), root `Cargo.toml` (`[workspace]` + shared lints/profile). The `justfile` is the unified cross-language task runner; root pnpm scripts mirror it for CI.

## Commands

This project is developed on Windows with **pnpm** (Node 24, pnpm 11). From PowerShell or bash, `pnpm` works directly.

```bash
pnpm install                  # installs all workspace packages
pnpm dev                      # Vite dev server on http://127.0.0.1:1420 (strict port)
pnpm test                     # Vitest across the workspace (single run)
pnpm test -- treeApi          # filter to one test file
pnpm typecheck                # tsc --noEmit across all TS packages
pnpm lint                     # biome check .
pnpm fmt                      # biome format --write .
pnpm build                    # tsc type-check then vite build → apps/desktop/dist
pnpm check                    # lint + typecheck + test + build gate
```

Rust backend (requires Rust toolchain + MSVC for Windows bundling), run from repo root:

```bash
cargo test                    # workspace tests
cargo clippy -- -D warnings   # lint, warnings as errors
cargo fmt                     # format
pnpm tauri dev                # full Tauri shell against the Rust backend
pnpm tauri build              # produces dream-builder.exe + NSIS installer under target/release/{,bundle/nsis/}
```

With `just` installed, `just check` / `just tauri-dev` / `just bundle` wrap the same commands.

If `pnpm tauri build` fails to find the MSVC linker, run inside an "x64 Native Tools" command prompt or set the MSVC/Windows SDK env vars first.

The root `tauri` script does `cd crates/dream-builder && tauri` so Tauri-CLI finds `tauri.conf.json` directly in CWD. Run from project root: `pnpm tauri dev` / `pnpm tauri build`.

**Tauri path-base quirk to remember:**
- `beforeDevCommand` / `beforeBuildCommand` are spawned from the **parent** of `tauri.conf.json` (i.e., `crates/dream-builder/`). That's why they read `pnpm -C ../.. dev` / `pnpm -C ../.. build` — `../..` resolves back to the repo root where the orchestrator scripts live.
- `frontendDist` is relative to `tauri.conf.json` itself (i.e., `crates/dream-builder/`), so it's `../../apps/desktop/dist`. Same base, but a different relative target than the `before*Command` working dir — easy to confuse.

## Architecture

### Two-process split with a graceful fallback

The frontend is built so it can run **without the Rust backend present** (plain `vite dev` in a browser). Runtime detection lives in `apps/desktop/src/tauri/treeApi.ts::isTauriRuntime` (checks `window.__TAURI_INTERNALS__`).

- In Tauri: calls `invoke('generate_tree' | 'detail_info' | 'magic_field', …)` defined in `crates/dream-builder/src/main.rs` and implemented in `crates/dream-builder/src/tree.rs`.
- In a plain browser (or if the Rust call throws / fails validation): falls back to `apps/desktop/src/data/fallbackTree.ts` and surfaces a warning via the UI panel.
- All Rust → JS payloads use `serde(rename_all = "camelCase")`. The TS types in `apps/desktop/src/types/tree.ts` must mirror that camelCase shape; `apps/desktop/src/data/validateTreeScene.ts` is the runtime guard at the boundary and rejects any scene that doesn't satisfy the invariants (non-empty arrays, finite Vec3s, positive radii, unique interactive ids, energy in [0,1], etc.).

When changing the wire format, update **all four** sites: the Rust struct(s) in `crates/dream-builder/src/tree.rs`, the TS interface in `apps/desktop/src/types/tree.ts`, the validator in `apps/desktop/src/data/validateTreeScene.ts`, and the fallback generator in `apps/desktop/src/data/fallbackTree.ts`. The Rust generator must remain deterministic for a given seed — `tree::tests::generation_is_deterministic_for_seed` enforces this.

### Frontend rendering pipeline

`apps/desktop/src/main.ts` boots a single `FantasyTreeApp` (`apps/desktop/src/scene/FantasyTreeApp.ts`) which composes:

- `Renderer` — owns the THREE WebGL renderer, scene, camera, OrbitControls, EffectComposer + UnrealBloom, and `resetCamera`.
- `TreeFactory.createTreeObjects(scene)` — builds the meshes from a validated `TreeScene`. Interactive objects (leaves, runes, crystals) are tagged with `userData.detailId` and `userData.baseScale`; the `interactive` array is what `InteractionController` raycasts against.
- `InteractionController` — handles pointer move/leave/click on the canvas, raycasts against the `interactive` list, walks parents to find `userData.detailId`, and drives hover/selection via the pure reducer in `apps/desktop/src/interaction/selectionState.ts`. It also animates scale/emissive boosts each frame via `update()`.
- `MagicParticles` — particle field; `update(elapsed, selectedId)` is called per frame, and `applyField(MagicField)` injects backend wind + pulse forces between frames.
- `DetailsPanel` (`apps/desktop/src/ui/DetailsPanel.ts`) — left-hand HUD; receives status, hover label, selected detail, errors, and exposes the seed input + screenshot/help buttons.
- `KeyboardShortcuts` (`apps/desktop/src/interaction/keyboardShortcuts.ts`) — `R` reset, `H` HUD toggle, `F` fullscreen, `S` screenshot, `Esc` deselect, `?` help.
- HUD also exposes **glTF export** (binary `.glb` via `THREE.GLTFExporter`) for taking the current tree mesh into other 3D tools.
- `OnboardingHint` (`apps/desktop/src/ui/OnboardingHint.ts`) — first-launch overlay; persists "seen" via `localStorage`.

The render loop in `FantasyTreeApp.animate` polls `loadMagicField` every ~350 ms in Tauri runtime and feeds the result into `MagicParticles.applyField` so wind biases drift and pulses pull nearby particles toward their centers.

### Selection state is a pure reducer

`reduceSelectionState` in `apps/desktop/src/interaction/selectionState.ts` is the single source of truth for hover/selection transitions. Don't mutate `SelectionState` directly elsewhere; dispatch an action through the reducer so `selectionState.test.ts` keeps covering the behavior.

## Conventions specific to this repo

- **Strict TS, ES modules, bundler resolution.** No JS files; tests are colocated under `apps/desktop/src/tests/` as `*.test.ts` and run in the `node` environment (no jsdom — don't write tests that need a DOM).
- **UI strings are Chinese.** Status, error, and detail copy is zh-CN both in Rust (`tree.rs`) and TS (`fallbackTree.ts`, `DetailsPanel.ts`, `main.ts`). Match that when editing user-visible text unless told otherwise.
- **Default seed is `424242`** in `apps/desktop/src/scene/FantasyTreeApp.ts`. The HUD seed input lets the user regenerate at runtime; the chosen seed persists via `localStorage` (`dream-builder.seed`). The Rust `detail_info` command takes `(seed, id)` and re-derives only the scene matching the live seed — keep these in sync if you ever expose multi-window sessions.
- **Vite env prefixes** are extended to include `TAURI_` (see `apps/desktop/vite.config.ts`).
- **Cargo package name is `dream-builder`**, so the binary is `dream-builder.exe` (Windows). The user-facing product name (`tauri.conf.json::productName`) is still "Dream Builder Fantasy Tree" — this only affects installer/Add-Remove-Programs labels.
- **Bundle target is NSIS only** (`tauri.conf.json::bundle.targets: ["nsis"]`) — one clean installer, not the full `.exe + .msi + NSIS` triple.
- **Single-instance lock**: `tauri-plugin-single-instance` is wired in `crates/dream-builder/src/main.rs`; double-clicking the exe focuses the existing window instead of opening a second one.
- **Win11 Mica window effect** is declared in `tauri.conf.json::app.windows[0].windowEffects.effects`; gracefully ignored on other OSes.
- **`docs/design/`** holds plans/specs from past design sessions; treat as design notes, not runnable code.
