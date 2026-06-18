# AGENTS.md

This file provides guidance to coding agents (Claude Code, Codex, Cursor, etc.) when working with code in this repository.

## Project

Dream Builder Fantasy Tree — a Tauri 2 desktop app that renders an interactive procedural 3D fantasy tree. Frontend (Vite + TypeScript + Three.js) handles WebGL rendering, picking, particles, and the UI. Backend (Rust) deterministically generates tree geometry, detail metadata, and a time-varying "magic field" exposed as Tauri commands.

## Layout

```
dream-builder/
├── frontend/          # Vite + TypeScript + Three.js
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
├── backend/           # Rust + Tauri 2
│   ├── Cargo.toml
│   ├── build.rs
│   ├── tauri.conf.json
│   ├── icons/
│   └── src/
├── docs/design/       # design notes / specs
├── package.json       # root orchestrator (dev/build/test/tauri delegates to frontend or tauri-cli)
├── README.md
├── CLAUDE.md → @AGENTS.md
└── AGENTS.md
```

The root `package.json` only holds `@tauri-apps/cli` as a devDep + script wrappers (`postinstall` chains `npm install` into `frontend/`). All frontend deps + tooling live in `frontend/package.json`. All Rust state lives in `backend/`.

## Commands

This project is developed on Windows. Use `npm.cmd` (not `npm`) when invoking from PowerShell; from bash/git-bash `npm` works.

```bash
npm install                                # installs root + frontend (postinstall hook)
npm run dev                                # Vite dev server on http://127.0.0.1:1420 (strict port)
npm test -- --run                          # Vitest, single run (tests live under frontend/src/tests)
npm test -- --run frontend/src/tests/treeApi.test.ts   # single file
npm run build                              # tsc type-check then `vite build` → frontend/dist
npm run preview                            # serve built dist on http://127.0.0.1:4173
```

Rust backend (requires Rust toolchain + MSVC for Windows bundling):

```bash
cargo test --manifest-path backend/Cargo.toml
npm run tauri -- dev      # full Tauri shell against the Rust backend
npm run tauri -- build    # produces dream-builder.exe + NSIS installer in backend/target/release/{,bundle/nsis/}
```

If `npm run tauri -- build` fails to find the MSVC linker, run inside an "x64 Native Tools" command prompt or set the MSVC/Windows SDK env vars first.

The `tauri` script at root does `cd backend && tauri` so Tauri-CLI finds `tauri.conf.json` + `Cargo.toml` directly in CWD. Run from project root: `npm run tauri -- dev` / `-- build`. Don't `cd backend` yourself — let the script do it; npm's PATH still points at root `node_modules/.bin` so `tauri` resolves.

**Tauri path-base quirk to remember:**
- `beforeDevCommand` / `beforeBuildCommand` are spawned from the **parent** of `tauri.conf.json` (i.e., project root in this layout). That's why these read `npm run dev` / `npm run build` — they call the root `package.json`'s scripts, which in turn delegate to `frontend/`. Never write `npm --prefix ../frontend run dev` here; that resolves one level too high.
- `frontendDist` is relative to `tauri.conf.json` itself (i.e., `backend/`), so it's `../frontend/dist`. Different base than the `before*Command` fields — easy to confuse.

## Architecture

### Two-process split with a graceful fallback

The frontend is built so it can run **without the Rust backend present** (plain `vite dev` in a browser). Runtime detection lives in `frontend/src/tauri/treeApi.ts::isTauriRuntime` (checks `window.__TAURI_INTERNALS__`).

- In Tauri: calls `invoke('generate_tree' | 'detail_info' | 'magic_field', …)` defined in `backend/src/main.rs` and implemented in `backend/src/tree.rs`.
- In a plain browser (or if the Rust call throws / fails validation): falls back to `frontend/src/data/fallbackTree.ts` and surfaces a warning via the UI panel.
- All Rust → JS payloads use `serde(rename_all = "camelCase")`. The TS types in `frontend/src/types/tree.ts` must mirror that camelCase shape; `frontend/src/data/validateTreeScene.ts` is the runtime guard at the boundary and rejects any scene that doesn't satisfy the invariants (non-empty arrays, finite Vec3s, positive radii, unique interactive ids, energy in [0,1], etc.).

When changing the wire format, update **all four** sites: the Rust struct(s) in `backend/src/tree.rs`, the TS interface in `frontend/src/types/tree.ts`, the validator in `frontend/src/data/validateTreeScene.ts`, and the fallback generator in `frontend/src/data/fallbackTree.ts`. The Rust generator must remain deterministic for a given seed — `tree::tests::generation_is_deterministic_for_seed` enforces this.

### Frontend rendering pipeline

`frontend/src/main.ts` boots a single `FantasyTreeApp` (`frontend/src/scene/FantasyTreeApp.ts`) which composes:

- `Renderer` — owns the THREE WebGL renderer, scene, camera, OrbitControls, EffectComposer + UnrealBloom, and `resetCamera`.
- `TreeFactory.createTreeObjects(scene)` — builds the meshes from a validated `TreeScene`. Interactive objects (leaves, runes, crystals) are tagged with `userData.detailId` and `userData.baseScale`; the `interactive` array is what `InteractionController` raycasts against.
- `InteractionController` — handles pointer move/leave/click on the canvas, raycasts against the `interactive` list, walks parents to find `userData.detailId`, and drives hover/selection via the pure reducer in `frontend/src/interaction/selectionState.ts`. It also animates scale/emissive boosts each frame via `update()`.
- `MagicParticles` — particle field; `update(elapsed, selectedId)` is called per frame, and `applyField(MagicField)` injects backend wind + pulse forces between frames.
- `DetailsPanel` (`frontend/src/ui/DetailsPanel.ts`) — left-hand HUD; receives status, hover label, selected detail, errors, and exposes the seed input + screenshot/help buttons.
- `KeyboardShortcuts` (`frontend/src/interaction/keyboardShortcuts.ts`) — `R` reset, `H` HUD toggle, `F` fullscreen, `S` screenshot, `Esc` deselect, `?` help.
- HUD also exposes **glTF export** (binary `.glb` via `THREE.GLTFExporter`) for taking the current tree mesh into other 3D tools.
- `OnboardingHint` (`frontend/src/ui/OnboardingHint.ts`) — first-launch overlay; persists "seen" via `localStorage`.

The render loop in `FantasyTreeApp.animate` polls `loadMagicField` every ~350 ms in Tauri runtime and feeds the result into `MagicParticles.applyField` so wind biases drift and pulses pull nearby particles toward their centers.

### Selection state is a pure reducer

`reduceSelectionState` in `frontend/src/interaction/selectionState.ts` is the single source of truth for hover/selection transitions. Don't mutate `SelectionState` directly elsewhere; dispatch an action through the reducer so `selectionState.test.ts` keeps covering the behavior.

## Conventions specific to this repo

- **Strict TS, ES modules, bundler resolution.** No JS files; tests are colocated under `frontend/src/tests/` as `*.test.ts` and run in the `node` environment (no jsdom — don't write tests that need a DOM).
- **UI strings are Chinese.** Status, error, and detail copy is zh-CN both in Rust (`tree.rs`) and TS (`fallbackTree.ts`, `DetailsPanel.ts`, `main.ts`). Match that when editing user-visible text unless told otherwise.
- **Default seed is `424242`** in `frontend/src/scene/FantasyTreeApp.ts`. The HUD seed input lets the user regenerate at runtime; the chosen seed persists via `localStorage` (`dream-builder.seed`). The Rust `detail_info` command takes `(seed, id)` and re-derives only the scene matching the live seed — keep these in sync if you ever expose multi-window sessions.
- **Vite env prefixes** are extended to include `TAURI_` (see `frontend/vite.config.ts`).
- **Cargo package name is `dream-builder`**, so the binary is `dream-builder.exe` (Windows). The user-facing product name (`tauri.conf.json::productName`) is still "Dream Builder Fantasy Tree" — this only affects installer/Add-Remove-Programs labels.
- **Bundle target is NSIS only** (`tauri.conf.json::bundle.targets: ["nsis"]`) — one clean installer, not the full `.exe + .msi + NSIS` triple.
- **Single-instance lock**: `tauri-plugin-single-instance` is wired in `backend/src/main.rs`; double-clicking the exe focuses the existing window instead of opening a second one.
- **Win11 Mica window effect** is declared in `tauri.conf.json::app.windows[0].windowEffects.effects`; gracefully ignored on other OSes.
- **`docs/design/`** holds plans/specs from past design sessions; treat as design notes, not runnable code.
