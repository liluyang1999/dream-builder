# TypeScript & JavaScript — Language Layer (load on demand)

Default to TypeScript in strict mode; treat plain JavaScript as a constraint, not a choice. Read
this only when the task touches TS/JS. It applies on top of the global `AGENTS.md` (universal
conduct + lifecycle craft); a repo's own rules win.

## Toolchain & runtime

- **TypeScript** with `"strict": true`, plus `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. Target a current Node LTS (22+); note Bun/Deno explicitly
  if used.
- **ESM** everywhere (`"type": "module"`). Define `exports` in `package.json`; declare
  `engines`.
- One package manager with a committed lockfile — **pnpm** preferred. **ESLint** (flat
  config) + **Prettier**, or **Biome** for both. **Vitest** (or Jest) for tests. Bundle or
  transpile with tsup/esbuild/Vite as needed.

## Types

- No `any` — use `unknown` and narrow. Avoid the non-null `!` and unchecked `as`; if you
  assert, justify it.
- Model data with `type`/`interface`, discriminated unions, and `as const`; make `switch`
  exhaustive (with a `never` check). Use `satisfies` to keep literals honest.
- Validate all external input (network, env, files, user) at the boundary with a runtime
  schema (**zod** / valibot) and infer the static type from it. The typed core trusts its
  types.

## Idioms

- `const` by default; prefer immutability. Strict equality (`===`). Optional chaining `?.`
  and nullish coalescing `??`. Early returns over deep nesting.
- Named exports over default exports. Small modules with explicit public surfaces. Pure
  functions where practical.

## Async

- `async`/`await`, never raw `.then` chains for flow. Run independent work with
  `Promise.all`; bound and cancel with `AbortController`.
- No floating promises — `await` or explicitly handle every one. Treat an unhandled
  rejection as a crash.

## Errors

- Throw `Error` (or subclasses), never strings or plain objects. Preserve the cause
  (`new Error(msg, { cause })`). For expected failures at a boundary, a typed
  `Result`-style return is fine.

## Testing

- Vitest: test behavior and public contracts. No real network or clock in unit tests — fake
  them (e.g. MSW for HTTP, an injected clock). Keep tests deterministic and parallel-safe.

## Build & packaging

- Build with `tsc` / tsup / esbuild / Vite. Ship ESM plus type declarations (`.d.ts`); set
  `exports`, `types`, and `files` in `package.json` so consumers get the built output, not your
  source.
- Libraries: publish with `npm publish --provenance` and a clean `files` allowlist (never an
  `.env` or secrets). Applications: bundle for the target runtime. The committed lockfile drives
  reproducible installs; run lint, type-check, test, and build in CI.

## Common pitfalls

- `==` / coercion surprises; `NaN`; floating-point money (use integers or a decimal type).
- Dates and timezones — prefer `Temporal` or a vetted date library, not raw `Date` math.
- `this` binding; accidental mutation of shared state.
- `any` leaking in through an untyped dependency; unvalidated `JSON.parse`.
- Unhandled promise rejections; a forgotten `await`.
