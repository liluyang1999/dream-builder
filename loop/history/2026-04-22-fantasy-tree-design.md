# 3D Fantasy Tree Desktop App Design

## Goal

Build a complete Windows desktop project that displays a polished interactive 3D fantasy tree. The frontend renders and handles user interaction with Three.js. The backend uses native Rust through Tauri commands to generate deterministic scene data and expose computation-heavy state.

## Scope

The first version is a self-contained offline application. It does not require downloaded 3D models, image textures, cloud services, or runtime network access. Tree geometry, leaves, runes, crystals, particles, glow effects, metadata, and interaction targets are generated procedurally from code.

The application must include:

- A Tauri desktop shell that can be built into a Windows executable.
- A Vite and TypeScript frontend.
- A Rust backend with explicit Tauri commands.
- A Three.js scene with animated tree, particles, lights, postprocessing, and mouse interaction.
- Automated tests for frontend data handling and Rust backend calculations.
- Clear error handling when backend calls fail or runtime data is malformed.

## Architecture

The project uses Tauri 2 as the application boundary. The frontend runs inside the Tauri webview and owns rendering, input handling, animation timing, and UI presentation. The Rust backend owns deterministic generation of tree structure, detail metadata, and simulation parameters that benefit from strong typing and native execution.

Frontend and backend communicate only through typed Tauri command payloads. The frontend does not duplicate Rust generation rules except for validation and graceful fallbacks.

## Frontend Design

The frontend uses Vanilla TypeScript to keep runtime overhead low. It is organized into focused modules:

- `main.ts` bootstraps the app and binds lifecycle events.
- `scene/FantasyTreeApp.ts` coordinates rendering, backend loading, resize handling, animation, and disposal.
- `scene/Renderer.ts` creates the Three.js renderer, camera, orbit controls, lights, and postprocessing pipeline.
- `scene/TreeFactory.ts` converts backend tree data into Three.js meshes and instanced leaves.
- `scene/Particles.ts` renders and animates glowing particles around the tree.
- `interaction/InteractionController.ts` performs raycasting and emits hover/click interaction changes.
- `ui/DetailsPanel.ts` updates DOM state for selected tree details.
- `tauri/treeApi.ts` isolates all Tauri command calls.
- `types/tree.ts` defines frontend-facing tree data contracts.

The first screen is the working 3D experience, not a marketing page. A compact overlay provides title, current hovered detail, selected detail, backend status, and reset controls without covering the tree.

## Rust Backend Design

The Rust backend exposes three commands:

- `generate_tree(seed: u64) -> TreeScene`
- `detail_info(id: String) -> DetailInfo`
- `magic_field(seed: u64, tick: u32) -> MagicField`

`TreeScene` contains branch segments, leaf clusters, runes, crystals, and high-level visual parameters. Data is deterministic for a given seed. Invalid detail ids return a typed error instead of panicking. Numeric output is clamped to finite ranges so malformed values do not break rendering.

Backend code is split into:

- `src-tauri/src/main.rs` for Tauri setup and command registration.
- `src-tauri/src/tree.rs` for data structures and generation logic.
- `src-tauri/src/errors.rs` for serializable command errors.

## Visual Direction

Visual thesis: a moonlit ancient tree with warm gold magic inside the bark, cool teal leaves, violet crystals, and slow floating firefly-like particles.

The scene should feel premium through lighting, depth, postprocessing, and motion rather than dense UI chrome. The tree is centered in a full-canvas view. The camera starts at a three-quarter angle and allows orbiting and zooming within bounded limits.

Expected visual elements:

- Twisted trunk built from tapered branch segments.
- Curved boughs with instanced leaf clusters.
- Glowing runes embedded along the trunk.
- Crystal ornaments hanging from selected branches.
- Particle rings and drifting motes around active details.
- Bloom and subtle vignette for fantasy lighting.

## Interaction Design

Mouse movement raycasts against explicit interaction targets. Hovering a rune, crystal, or special leaf cluster brightens it and updates the overlay. Clicking a target selects it, triggers a localized pulse, and updates the details panel with metadata from Rust.

Boundary behavior:

- If the pointer is outside the canvas, hover state is cleared.
- If no object is hit, the previous selection remains but hover state is cleared.
- If backend detail lookup fails, the UI shows a recoverable error and keeps the scene interactive.
- If WebGL initialization fails, the app shows a clear unsupported-renderer message.
- If the window is resized to a small viewport, the canvas and overlay remain usable.

## Error Handling

Frontend API calls return typed results. Startup attempts to load backend data first. If loading fails, the app creates a small local fallback tree and displays a backend warning. Rendering errors are caught during initialization and displayed in the root container.

Rust commands avoid panics for user-controllable input. Detail lookup validates ids against generated metadata. Simulation values are finite and clamped.

## Testing Strategy

Frontend tests use Vitest for pure TypeScript behavior:

- Runtime validation rejects malformed tree scene payloads.
- Interaction selection state preserves selected detail when hover clears.
- API fallback produces a usable minimal tree when backend loading fails.

Rust tests validate backend behavior:

- Tree generation is deterministic for a seed.
- Generated branch, rune, crystal, and leaf counts stay within expected bounds.
- Detail lookup returns metadata for valid ids and an error for invalid ids.
- Magic field output contains finite, clamped values.

Build verification:

- `npm test` for frontend tests.
- `cargo test --manifest-path src-tauri/Cargo.toml` for Rust tests.
- `npm run build` for frontend TypeScript and production assets.
- `npm run tauri build` for Windows executable packaging when local Tauri build prerequisites are available.

## Known Constraints

The project directory is currently not a git repository, so the design document cannot be committed unless the user explicitly asks to initialize git. Tauri packaging also depends on the machine having Node.js, Rust, Cargo, and Windows build prerequisites available. If those tools are missing, the project will still be written in a directly buildable structure and the missing prerequisite will be reported.
