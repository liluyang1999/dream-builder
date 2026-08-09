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

# Full local gate: contracts, pnpm layout, frontend, Rust, and release build prerequisites.
check:
    pnpm check
    cargo fmt --check
    cargo test --workspace --locked
    cargo clippy --workspace --all-targets --locked -- -D warnings

# Run the full native Tauri shell in dev.
tauri-dev:
    pnpm tauri dev

# Produce the native EXE + NSIS installer.
bundle:
    pnpm tauri build

# Run every release gate and assemble checksummed Windows deliverables.
release:
    pnpm release:build

# Run all gates and build a signed production release from a clean source tree.
release-signed:
    pnpm release:build:signed

# Recompute and verify the local Windows candidate manifest, hashes, and signatures.
release-verify:
    pnpm release:verify

# Require a clean source snapshot and valid Authenticode signatures.
release-verify-production:
    pnpm release:verify:production

# Verify registry, program files, shortcuts, and version after installing.
release-verify-installed:
    pnpm release:verify:installed

# Verify program files and integration entries are gone while user data remains allowed.
release-verify-uninstalled:
    pnpm release:verify:uninstalled

# Verify the archived native M2 report hash, provenance, phases, and budget.
m2-verify:
    pnpm m2:verify
