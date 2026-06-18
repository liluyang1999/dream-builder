# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-06-18

Teaching-grade rebuild of the Dream Builder Fantasy Tree.

### Added
- **Monorepo**: pnpm workspace + Cargo workspace with unified config
  (`tsconfig.base.json`, Biome, root scripts, `justfile`) and a green
  lint → typecheck → test → build gate.
- **Rust backend**: modular `domain` / `generation` / `state` / `events` /
  `commands` layers; `thiserror` errors; `Rng`/`SceneGenerator` traits;
  `Seed`/`Energy` newtypes; builder pattern; `Arc<Mutex>` managed state; async
  `tokio` magic-field event emitter; plugins (log, store, dialog, fs, opener,
  single-instance); native menu + tray; capability/ACL file; enabled CSP.
- **Frontend**: React 19 + react-three-fiber scene; Zustand store; typed IPC
  client with standard decorators + zod boundary validation; Web Worker fallback;
  backend event subscription; native dialog scene export.
- **Liquid Glass**: reusable `@dream-builder/liquid-glass` React component library
  (iOS 26-style surfaces, theme + quality tiers, graceful degradation); custom
  GLSL Fresnel crystal shader.
- **Packaging**: NSIS installer (per-user, zh-CN + English) producing a
  self-contained install directory with the `dream-builder.exe` entry point.
- **Docs**: teaching documentation under `docs/teaching/`.
