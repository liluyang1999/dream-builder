# Unified cross-language task entrypoint for the Dream Builder monorepo.
# `just <task>` mirrors the root package.json scripts so local and CI use one set of commands.
# On Windows recipes run through PowerShell.
set windows-shell := ["powershell.exe", "-NoLogo", "-Command"]

# List available recipes.
default:
    @just --list

# Run the desktop app in the browser dev server (no native shell).
dev:
    pnpm dev

# Type-check + bundle the frontend.
build:
    pnpm build

# Format every language in place.
fmt:
    pnpm fmt
    cargo fmt

# Lint every language; fails on warnings.
lint:
    pnpm lint
    cargo clippy -- -D warnings

# Type-check all TypeScript packages.
typecheck:
    pnpm typecheck

# Run all tests (Vitest + cargo).
test:
    pnpm test
    cargo test

# Full local gate: lint -> typecheck -> test -> build.
check: lint typecheck test build

# Run the full native Tauri shell in dev.
tauri-dev:
    pnpm tauri dev

# Produce the native EXE + NSIS installer.
bundle:
    pnpm tauri build
