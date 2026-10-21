# Unified cross-language task entrypoint for the Dream Builder monorepo.
# `just <task>` mirrors the root package.json scripts so local and CI use one set of commands.
# On Windows recipes run through PowerShell.
# Recipe-scoped environment variables require just 1.47 or newer.
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

# Preview or remove reproducible build outputs, preserving dependencies and releases.
clean-preview:
    pnpm clean:preview

clean:
    pnpm clean

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

# Verify the teaching archive and the Loop Engineering records.
docs:
    pnpm docs:verify
    pnpm loop:verify

# Full local gate: contracts, pnpm layout, frontend, Rust, and release build prerequisites.
[env('RUSTDOCFLAGS', '-D warnings')]
check:
    pnpm check
    cargo fmt --check
    cargo test --workspace --locked
    cargo clippy --workspace --all-targets --locked -- -D warnings
    cargo doc --workspace --no-deps --locked

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
release-verify-uninstalled $install_directory:
    pnpm release:verify:uninstalled -ExpectedInstallDirectory "$env:install_directory"

# Verify the archived native M2 report hash, provenance, phases, and budget.
m2-verify:
    pnpm m2:verify
