# AGENTS.md

This file provides guidance to coding agents (Claude Code, Codex, Cursor, etc.) when working with code in this repository.

## Project

Dream Builder Fantasy Tree — a Tauri 2 desktop app evolving from an interactive procedural tree into a third-person cartoon forest game. The frontend is React 19 + react-three-fiber; the Rust backend deterministically generates scenes and owns native state, persistence, events, menus, and exports.

Documentation is split by audience. `docs/` is the teaching archive for humans: fifteen topic HTML pages plus `docs/assets/learn.css`, indexed by `docs/README.md` for GitHub. `loop/` is the Loop Engineering record for agents and maintainers: `loop/concepts.md` (working discipline), `loop/progress.md` (current status ledger), `loop/product/` (vision, scope, acceptance, runbook), `loop/evidence/` (append-only measurements), `loop/history/` (2026-04 notes, read-only). Teaching never goes in `loop/`; engineering state never goes in `docs/`.

## Layout

pnpm workspace (JS/TS) + Cargo workspace (Rust) monorepo:

```
dream-builder/
├── pnpm-workspace.yaml · package.json · tsconfig.base.json · biome.json
├── .editorconfig · .nvmrc · .gitattributes · justfile
├── Cargo.toml (workspace) · rustfmt.toml
├── apps/
│   └── desktop/        # Vite + React 19 + R3F (pkg @dream-builder/desktop)
│       ├── index.html · package.json · tsconfig.json · vite.config.ts
│       └── src/
├── packages/           # shared/reusable TS packages (ipc-contracts, liquid-glass)
├── crates/
│   └── dream-builder/  # Rust + Tauri 2 (crate `dream-builder`)
│       ├── Cargo.toml · build.rs · tauri.conf.json · icons/ · src/
├── docs/               # teaching archive (humans): 15 topic HTML pages
│   ├── README.md       # GitHub-facing index of the pages
│   ├── index.html      # hub; overview/frontend/graphics/... alongside it
│   └── assets/         # shared learn.css
├── loop/               # Loop Engineering record (agents + maintainers)
│   ├── README.md · concepts.md · progress.md
│   ├── product/        # vision, scope, acceptance matrix, playtest, runbook
│   ├── evidence/       # append-only measurements and lifecycle evidence
│   └── history/        # 2026-04 design notes, read-only
├── scripts/            # contract, security, docs, loop, layout, and release checks
├── version.json        # sole player-visible two-component product version
├── README.md
├── CLAUDE.md → @AGENTS.md
└── AGENTS.md
```

Config is centralized: root `package.json` (shared dev tooling + script entrypoints), `tsconfig.base.json` (TS options, each package extends it), `biome.json` (lint + format), per-package Vitest config, and root `Cargo.toml` (`[workspace]` + shared lints/profile). The `justfile` is the unified cross-language task runner; root pnpm scripts mirror it for CI.

## Commands

This project is developed on Windows with **pnpm** (Node 24, pnpm 11). From PowerShell or bash, `pnpm` works directly.

```bash
pnpm install                  # installs all workspace packages
pnpm version:verify           # public version display + tooling/WebView2 contracts
pnpm desktop:verify-security  # CSP + least-privilege Tauri capability contract
pnpm docs:verify              # teaching HTML structure, anchors, coverage, and local links
pnpm loop:verify              # Loop Engineering records, required files, and links
pnpm pnpm:verify-layout       # all pnpm stores/caches remain below the repository root
pnpm dev                      # Vite dev server on http://127.0.0.1:1420 (strict port)
pnpm test                     # Vitest across the workspace (single run)
pnpm test -- treeApi          # filter to one test file
pnpm typecheck                # tsc --noEmit across all TS packages
pnpm lint                     # biome check .
pnpm fmt                      # biome format --write .
pnpm build                    # tsc type-check then vite build → apps/desktop/dist
pnpm check                    # contracts + docs + loop + layout + lint + typecheck + test + build
pnpm m2:verify                # verify the archived native report hash and performance gates
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

**Tauri path-base quirk to remember (two different bases!):**
- `beforeDevCommand` / `beforeBuildCommand` are spawned with cwd = the **parent of the directory that contains `tauri.conf.json`**, i.e. `crates/` (not `crates/dream-builder/`). So to reach the repo root they read `pnpm -C .. dev` / `pnpm -C .. build` (`crates/.. = repo root`). Using `../..` overshoots to `D:\Projects` and fails with "No package.json found".
- `frontendDist` is relative to the `tauri.conf.json` **file** (i.e., `crates/dream-builder/`), so it's `../../apps/desktop/dist`. Different base than the `before*Command` cwd — easy to confuse.

## Architecture

### Two-process split with a graceful fallback

The frontend can run **without the Rust backend present** (`pnpm dev` in a browser). Runtime detection lives in `apps/desktop/src/ipc/runtime.ts`.

- In Tauri, `apps/desktop/src/ipc/treeApi.ts` invokes commands implemented by `crates/dream-builder/src/commands.rs` and subscribes to Rust events.
- In a browser, scene generation runs through `apps/desktop/src/workers/fallback.worker.ts`; IPC failure or invalid payloads also fall back and surface a Chinese warning in the HUD.
- `packages/ipc-contracts/src/index.ts` is the frontend type/runtime guard for camelCase payloads. Matching Rust domain structs live under `crates/dream-builder/src/domain/`.

When changing the wire format, update the Rust domain/serde shape, the Zod contract, the browser fallback generator, and cross-boundary tests. Rust generation must remain deterministic for a given seed.

### Frontend rendering pipeline

`apps/desktop/src/main.tsx` mounts `App.tsx`, the side-effect orchestration layer. `App` hydrates/persists settings, loads scenes/details, owns native subscriptions, and connects the HUD to the R3F scene API.

- `scene/SceneCanvas.tsx` owns `<Canvas>`, camera, OrbitControls, lighting, bloom, capture, and glTF export.
- `game/forestLayout.ts`, `game/playerInput.ts`, and `game/playerMotion.ts` are the data/pure-logic layer for the graybox grove. Keep movement rules and collision independent from R3F.
- `game/gameProgress.ts` is the pure, versioned state machine for light seeds, safe checkpoints, read memories, cleansing, tree growth, and gate unlock. `state/store.ts` persists committed v2 snapshots under `dream-builder.progress.v2` and migrates consistent v1 saves; rendering must not invent progress.
- `scene/PlayerController.tsx` adapts normalized input into tested motion and translates the third-person camera with the player; `scene/CartoonForest.tsx` renders the environment from the same stable layout consumed by collision.
- `scene/GameplayController.tsx` is the proximity/input adapter. `GameplayWorld.tsx`, `ui/QuestPanel.tsx`, `ui/MemoryOverlay.tsx`, and `ui/PurificationOverlay.tsx` are visual consumers of committed progress; the direction puzzle rules remain pure in `game/purificationPuzzle.ts`.
- `scene/TreeContent.tsx` composes branches, leaves, runes, crystals, and ground halo from a validated `TreeScene`.
- `scene/MagicParticles.tsx` reads the latest Rust magic field through a ref inside `useFrame`, avoiding React rerenders per tick.
- `scene/PerformanceProbe.tsx` feeds bounded aggregate frame/render statistics to `performance/`; the recorder stores a fixed-size histogram and capped state markers, never raw per-frame traces or player paths. The help overlay opens the user-controlled ten-minute recorder and JSON export.
- `interaction/useInteractive.ts` maps R3F pointer events into the pure reducer-backed Zustand selection state.
- `ui/Hud.tsx` and its child components render Chinese status, details, seed controls, help, screenshots, and exports with `@dream-builder/liquid-glass`.
- `ipc/asyncSubscriptionScope.ts` owns asynchronous Tauri unlisteners so React StrictMode and late promise resolution cannot leak listeners.

### Selection state is a pure reducer

`reduceSelectionState` in `apps/desktop/src/interaction/selectionState.ts` is the single source of truth for hover/selection transitions. Don't mutate `SelectionState` directly elsewhere; dispatch an action through the reducer so `selectionState.test.ts` keeps covering the behavior.

## Conventions specific to this repo

- **Strict TS, ES modules, bundler resolution.** No JS files; tests are colocated under `apps/desktop/src/tests/`. Pure tests use Node and component tests use jsdom through Vitest environment selection.
- **Two-component public versions.** `version.json::productVersion` is the sole product version and uses `major.feature`. npm, Cargo, and Tauri machine manifests receive a mechanically derived SemVer compatibility value, but player UI, docs, release manifests/files, Windows EXE version strings, and Installed Apps must show only `productVersion`. Never expose or maintain a second product version, and never edit one manifest in isolation.
- **Project-local pnpm data.** `storeDir`, `cacheDir`, and `virtualStoreDir` must resolve below the repository root, and the global virtual store stays disabled. Do not add user-level or drive-root pnpm configuration.
- **UI strings are Chinese.** Status, error, and detail copy is zh-CN in both Rust and TS. Match that when editing user-visible text unless told otherwise.
- **Default seed is `424242`** in both the Zustand store and Rust `Settings::default`. Settings hydrate before the first scene load; seed changes update the active Rust state immediately and persist as one settings snapshot.
- **Vite env prefixes** are extended to include `TAURI_` (see `apps/desktop/vite.config.ts`).
- **Cargo package name is `dream-builder`**, so the binary is `dream-builder.exe` (Windows). The user-facing product name (`tauri.conf.json::productName`) is still "Dream Builder Fantasy Tree" — this only affects installer/Add-Remove-Programs labels.
- **Bundle target is NSIS only** (`tauri.conf.json::bundle.targets: ["nsis"]`) — one clean installer, not the full `.exe + .msi + NSIS` triple.
- **WebView2 is Evergreen and unpinned.** Windows bundles use the silent `downloadBootstrapper` mode. Do not add a fixed WebView2 runtime path or version without an explicit product decision and size/security review. Browser `pnpm dev` is not proof of the Tauri/WebView2 path.
- **Single-instance lock**: `tauri-plugin-single-instance` is wired in `crates/dream-builder/src/lib.rs`; double-clicking the exe focuses the existing window instead of opening a second one.
- **Win11 Mica window effect** is declared in `tauri.conf.json::app.windows[0].windowEffects.effects`; gracefully ignored on other OSes.
- **Documentation boundaries.** `docs/` teaches (stable conclusions, human readers); `loop/` records engineering state (changes every iteration, agent readers). `pnpm docs:verify` enforces every page's structure, reachability from the hub, anchors, local links, the outbound links to `loop/`, and that every source module appears in `docs/code-map.html` — adding a page means adding it to the shared sidebar and to `docs/README.md`, and adding a source file means adding a line to the module inventory, or the gate fails. `pnpm loop:verify` enforces the required `loop/` records, their links, and that `loop/progress.md` keeps unmet external gates visible. Both refuse the other's content: no HTML in `loop/`, no non-teaching subdirectory in `docs/`.
- **Read `loop/concepts.md` before non-trivial changes.** It carries the working discipline: automated gates never substitute for the open human gates, evidence is append-only, every fact has exactly one writable source, and a new gate must be negative-tested before it counts.
