# Python — Language Layer (load on demand)

Modern, typed, tooling-first Python. Read this only when the task touches Python. It applies on
top of the global `AGENTS.md` (universal conduct + lifecycle craft); a repo's own rules win.

## Toolchain & version

- Target a supported CPython (3.12+; prefer the current stable). State the floor in
  `pyproject.toml`.
- One project manager: **uv** (fast, lockfile-based) — or Poetry/PDM if already in use.
  Always work in a virtual environment; never install into system Python.
- `pyproject.toml` (PEP 621) is the single source of project metadata. No `setup.py` /
  `setup.cfg` for new work.
- **Ruff** for both lint and format (replaces black + isort + flake8). **mypy** or
  **pyright** in strict mode. **pytest** for tests.

## Layout

- `src/` layout (`src/pkg/…`) so tests run against the installed package, not the working
  directory.
- Keep modules small and free of import cycles. Side effects belong in functions, not at
  import time.

## Types & safety

- Annotate every public function, method, and dataclass field. Run the type-checker in CI
  and keep it green.
- Prefer precise types: `Sequence`/`Mapping` over `list`/`dict` in signatures, `X | None`
  unions, `Literal`, `Protocol` for structural typing, `TypedDict`/dataclasses for records.
  Avoid `Any`; isolate it where unavoidable.
- Validate external data at the boundary (pydantic, or dataclasses + explicit checks).
  Inside the typed core, trust your types.

## Idioms

- PEP 8 via Ruff — don't hand-format. f-strings for interpolation. `pathlib` over
  `os.path`. Comprehensions when they read clearly, loops when they don't.
- `dataclasses`/`enum` for structured values; `@dataclass(frozen=True, slots=True)` for
  value objects. Context managers (`with`) for every resource.
- EAFP over LBYL where it's idiomatic. Use `logging`, never `print`, for diagnostics.
- Never use a mutable default argument (`def f(x=[])`). Bind loop variables explicitly when
  capturing them in closures.

## Errors

- Raise specific exception types; define a small exception hierarchy for your package.
  Never a bare `except:` — catch the narrowest type that fits.
- Preserve context with `raise NewError(...) from err`. Don't use exceptions for normal
  control flow.

## Concurrency

- IO-bound → `asyncio` (use `asyncio.TaskGroup` for structured concurrency); never block
  the event loop with sync IO or CPU work.
- CPU-bound → `multiprocessing` / `concurrent.futures` processes; threads buy little under
  the GIL except for blocking IO.

## Testing

- `pytest`: small functions, `fixtures` for setup, `parametrize` for cases. No shared
  mutable state between tests.
- Prefer fakes over deep mocking; mock only at boundaries you own. Property-based tests
  (`hypothesis`) for pure logic where they pay.

## Dependencies

- Lockfile committed; pin via the manager. Keep the dependency set minimal; prefer the
  standard library.

## Build & packaging

- Build with PEP 517 (`python -m build` → sdist + wheel); pick one backend in `pyproject.toml`
  (hatchling, flit, or pdm-backend). Publish with `twine` or `uv publish`; never commit build
  artifacts.
- Applications ship from the committed lockfile for reproducible installs — as a container or a
  `uv`-built virtual environment — and pin the Python version. Run format, type-check, and tests
  in CI on the same commands you use locally.

## Common pitfalls

- Mutable default arguments; late-binding closures in loops.
- `==` vs `is` (use `is` only for `None` and other singletons).
- Import-time side effects and circular imports.
- Catching `Exception` too broadly; swallowing tracebacks.
- Assuming threads give CPU parallelism (the GIL says otherwise).
