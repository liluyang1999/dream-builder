# Rust (Tier 3)

Idiomatic, safe, warning-free Rust. Apply on top of Tier 1 and Tier 2; a repo's own rules win.

## Toolchain

- Stable `rustc`/Cargo on the current edition (2024). Format with **rustfmt**; lint with
  **clippy** and keep it clean (`cargo clippy -- -D warnings`). State an MSRV and test it if
  you publish.
- Multi-crate work uses a Cargo **workspace**. Keep `cargo fmt --check`, clippy, and
  `cargo test` in CI.

## Safety

- Safe Rust by default. Reach for `unsafe` only with a real reason; keep the block minimal
  and document the invariants it upholds. Exercise unsafe code with tests and MIRI where
  feasible.

## Errors

- Fallible APIs return `Result<T, E>`; propagate with `?`. Define rich error types with
  **thiserror** in libraries; use **anyhow** for application-level context.
- No `unwrap()`/`expect()` in library code except on a genuine invariant — and then
  `expect()` with a message explaining why it cannot fail. A `panic!` signals a bug, not
  control flow.

## Idioms

- Borrow before you clone; take `&str`/`&[T]` parameters, not `String`/`Vec` you don't need
  to own. Don't `.clone()` just to appease the borrow checker — restructure instead.
- Iterators and combinators over manual index loops. `Option`/`Result` combinators over
  nested matches. `derive` the obvious traits.
- Newtypes for domain meaning and type safety; `From`/`Into` for conversions; the builder
  pattern for many-optional construction. Avoid reaching for `Rc<RefCell<…>>` before you've
  shown shared ownership is truly needed.

## Concurrency

- The compiler enforces `Send`/`Sync` — lean on it. Channels or `Arc<Mutex<…>>` for shared
  state; **rayon** for data parallelism.
- Async: pick one runtime (**tokio** is the default) and stay on it. Never block in async —
  no sync IO or heavy CPU on the executor, and never hold a `std` lock across `.await`.

## Testing

- Unit tests in-module under `#[cfg(test)]`; integration tests in `tests/`; examples as
  doctests. Benchmark hot paths with **criterion**; reach for `proptest` where property
  tests pay.

## Dependencies

- Keep the tree lean; audit it (`cargo audit` / `cargo deny`). Gate optional functionality
  behind Cargo features rather than pulling heavy defaults.

## Build & packaging

- Binaries: `cargo build --release` (tune the release profile; strip if size matters). For
  portable distribution, build a static `musl` target or a minimal container.
- Crates: `cargo publish` with correct semver; inspect first with `cargo package`. Commit
  `Cargo.lock` for applications; libraries leave it flexible. Keep `cargo fmt --check`, clippy,
  and `cargo test` in CI.

## Common pitfalls

- `unwrap()`/`expect()` on production paths.
- Cloning reflexively instead of restructuring ownership.
- Blocking the async executor; holding a lock across `.await`.
- Integer overflow (it wraps in release) — use checked/saturating ops where it matters.
- Over-engineering with `Rc<RefCell>` or trait objects before they're warranted.
