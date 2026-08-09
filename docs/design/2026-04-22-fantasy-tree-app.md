# Fantasy Tree Desktop App Implementation Plan

> **Historical archive:** this implementation plan describes the pre-React prototype and is not an active
> instruction set. Use `docs/game/` for current product decisions and `knowledge/index.html` for the current
> architecture; the unchecked boxes below are preserved only as design history.

**Goal:** Build a complete Tauri desktop application that renders an interactive procedural 3D fantasy tree with a Rust backend and a Three.js frontend.

**Architecture:** Tauri 2 hosts a Vite TypeScript frontend in a desktop webview. Rust commands generate deterministic tree scene data, detail metadata, and magic field simulation values. Three.js renders and animates the scene, while pure TypeScript modules isolate validation, fallback, and interaction state for automated tests.

**Tech Stack:** Tauri 2, Rust, Vite, TypeScript, Three.js, Vitest, Windows desktop packaging.

---

## File Structure

- Create `D:\Projects\dream-builder\package.json`: npm scripts and frontend/Tauri dependencies.
- Create `D:\Projects\dream-builder\index.html`: Vite entry document.
- Create `D:\Projects\dream-builder\tsconfig.json`: TypeScript settings.
- Create `D:\Projects\dream-builder\vite.config.ts`: Vite and Vitest configuration.
- Create `D:\Projects\dream-builder\src\main.ts`: frontend bootstrapping.
- Create `D:\Projects\dream-builder\src\styles.css`: app surface and overlay styles.
- Create `D:\Projects\dream-builder\src\types\tree.ts`: shared frontend data types.
- Create `D:\Projects\dream-builder\src\data\validateTreeScene.ts`: runtime payload validation.
- Create `D:\Projects\dream-builder\src\data\fallbackTree.ts`: local fallback scene.
- Create `D:\Projects\dream-builder\src\interaction\selectionState.ts`: pure hover and selection reducer.
- Create `D:\Projects\dream-builder\src\interaction\InteractionController.ts`: Three.js raycast interactions.
- Create `D:\Projects\dream-builder\src\scene\FantasyTreeApp.ts`: scene orchestration.
- Create `D:\Projects\dream-builder\src\scene\Renderer.ts`: renderer, camera, lights, controls, composer.
- Create `D:\Projects\dream-builder\src\scene\TreeFactory.ts`: procedural mesh construction from backend data.
- Create `D:\Projects\dream-builder\src\scene\Particles.ts`: animated magic particle field.
- Create `D:\Projects\dream-builder\src\tauri\treeApi.ts`: typed Tauri command wrapper.
- Create `D:\Projects\dream-builder\src\ui\DetailsPanel.ts`: DOM overlay state.
- Create `D:\Projects\dream-builder\src\tests\validateTreeScene.test.ts`: frontend validation tests.
- Create `D:\Projects\dream-builder\src\tests\selectionState.test.ts`: interaction state tests.
- Create `D:\Projects\dream-builder\src\tests\fallbackTree.test.ts`: fallback tests.
- Create `D:\Projects\dream-builder\src-tauri\Cargo.toml`: Rust crate and Tauri dependencies.
- Create `D:\Projects\dream-builder\src-tauri\tauri.conf.json`: Tauri desktop packaging config.
- Create `D:\Projects\dream-builder\src-tauri\build.rs`: Tauri build script.
- Create `D:\Projects\dream-builder\src-tauri\src\main.rs`: command registration.
- Create `D:\Projects\dream-builder\src-tauri\src\errors.rs`: serializable command errors.
- Create `D:\Projects\dream-builder\src-tauri\src\tree.rs`: backend data generation and tests.

## Task 1: Scaffold Project Manifests

- [ ] **Step 1: Create package and TypeScript config files**

  Add Vite, TypeScript, Three.js, Tauri CLI, and Vitest scripts. Use `npm.cmd` on Windows because PowerShell blocks `npm.ps1` in this environment.

- [ ] **Step 2: Create Tauri Rust manifest and config**

  Add `src-tauri/Cargo.toml`, `build.rs`, `tauri.conf.json`, and `src/main.rs` with command registration stubs that will be filled by Task 4.

- [ ] **Step 3: Verify manifest parsing**

  Run `npm.cmd install` when network access is available. Run `npm.cmd run build` after implementation. Run `cargo test --manifest-path src-tauri/Cargo.toml` only after Rust is installed and in PATH.

## Task 2: Frontend Tests First

- [ ] **Step 1: Write failing validation tests**

  Test that valid scene payloads pass, malformed branch coordinates fail, and non-finite values fail.

- [ ] **Step 2: Write failing selection-state tests**

  Test that hover can clear independently from selection and that clicking an unknown target does not corrupt the selected detail.

- [ ] **Step 3: Write failing fallback tests**

  Test that the fallback scene has at least one branch, one rune, one crystal, one leaf cluster, and unique interactive ids.

- [ ] **Step 4: Run frontend tests and observe failures**

  Run `npm.cmd test -- --run` after dependencies are installed. Expected before implementation: missing module failures or assertion failures caused by absent behavior.

## Task 3: Frontend Pure Logic Implementation

- [ ] **Step 1: Implement `types/tree.ts`**

  Define finite vector, branch, leaf cluster, rune, crystal, detail, magic field, and tree scene interfaces.

- [ ] **Step 2: Implement runtime validation**

  Validate array presence, id uniqueness, numeric finiteness, minimum geometry counts, and required visual metadata.

- [ ] **Step 3: Implement fallback tree**

  Produce a deterministic minimal tree that passes validation when backend loading fails.

- [ ] **Step 4: Implement selection reducer**

  Preserve selection when hover clears; reject empty ids for click actions; expose a tiny pure API for tests and rendering.

- [ ] **Step 5: Run frontend tests**

  Run `npm.cmd test -- --run`. Expected after Task 3: frontend pure logic tests pass.

## Task 4: Rust Tests First and Backend Implementation

- [ ] **Step 1: Write Rust unit tests in `tree.rs`**

  Cover deterministic generation, bounded counts, valid detail lookup, invalid detail error, finite magic field values, and count limits.

- [ ] **Step 2: Implement serializable error type**

  Return typed errors with `code` and `message`; avoid panics for user-controllable ids.

- [ ] **Step 3: Implement deterministic generator**

  Use a small seeded PRNG implemented in Rust code, generate branch segments, leaves, runes, crystals, detail metadata, and visual settings.

- [ ] **Step 4: Register Tauri commands**

  Expose `generate_tree`, `detail_info`, and `magic_field` from `main.rs`.

- [ ] **Step 5: Run Rust tests**

  Run `cargo test --manifest-path src-tauri/Cargo.toml` when Rust is installed. Expected after Task 4: Rust tests pass.

## Task 5: Three.js Rendering and Interaction

- [ ] **Step 1: Implement renderer shell**

  Create WebGL renderer, perspective camera, orbit controls, ambient/key/rim lights, bloom composer, resize handling, and disposal.

- [ ] **Step 2: Implement tree mesh factory**

  Convert backend branches into tapered cylinders, leaves into instanced shapes, runes into emissive planes, and crystals into emissive polyhedra. Add interaction ids to userData.

- [ ] **Step 3: Implement particles**

  Build deterministic point cloud particles with bounded animation updates and no unbounded per-frame allocations.

- [ ] **Step 4: Implement raycast interaction**

  Track hover and selected targets; apply visual highlight and pulse without changing scene geometry counts.

- [ ] **Step 5: Implement details panel**

  Show backend status, hover label, selected detail, error messages, and reset action.

## Task 6: App Integration

- [ ] **Step 1: Implement typed Tauri API wrapper**

  Use `@tauri-apps/api/core` when available; fallback to local scene data in browser/dev contexts.

- [ ] **Step 2: Bootstrap app**

  Load backend scene with seed `424242`; validate payload; fall back locally with warning; initialize renderer; start animation loop.

- [ ] **Step 3: Handle edge cases**

  Show readable failure UI for WebGL creation errors, invalid backend payloads, backend command errors, resize edge cases, and missing DOM root.

- [ ] **Step 4: Run frontend build**

  Run `npm.cmd run build`. Expected: TypeScript and Vite production build complete without errors.

## Task 7: Packaging Attempt

- [ ] **Step 1: Check build prerequisites**

  Verify `node`, `npm.cmd`, `cargo`, and `rustc`. Current environment has Node and npm.cmd but does not have Cargo or rustc in PATH.

- [ ] **Step 2: Attempt Tauri build if prerequisites exist**

  Run `npm.cmd run tauri build`. Expected when Rust and Windows build prerequisites exist: Tauri produces a Windows executable or installer under `src-tauri/target/release/bundle`.

- [ ] **Step 3: Report exact blocker if packaging cannot run**

  If Cargo or Rust is unavailable, report that the source project is complete but final exe packaging requires installing/configuring Rust.

## Self-Review

- Spec coverage: architecture, visual direction, backend commands, frontend rendering, interactions, error handling, tests, and packaging are covered.
- Completion scan: no task uses open-ended gaps; known environment limits are explicit.
- Type consistency: frontend `TreeScene` and Rust `TreeScene` are intentionally mirrored; command names are consistent across plan and design.
