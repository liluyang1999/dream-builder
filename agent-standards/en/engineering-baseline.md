# Engineering Baseline (Tier 2 — Language-Neutral Craft)

Concrete, modern engineering practice that holds in every language and repository. Tier 1
(`AGENTS.md`) governs conduct; this governs craft; `languages/*.md` (Tier 3) add
language-specific idiom. A repo's own rules and closer-scoped config override anything here.

Good engineering follows an arc — **understand & design → implement → verify → integrate →
release → operate** — and each phase has a bar to clear before the next. The concerns at the
end (security, dependencies, performance, documentation) are **cross-cutting**: they apply in
every phase, not just one. Scale the ceremony to the stakes, but skip no phase.

## 1. Understand & design (before code)

- Frame the problem and write down what "done" looks like — the acceptance criteria — before
  writing code. If the requirement is ambiguous or high-stakes, resolve it first.
- Study the existing system, constraints, and conventions. Weigh at least two approaches with
  explicit trade-offs; choose the simplest that meets the requirement (YAGNI), and design for
  change rather than for hypothetical futures.
- Design the interface and contract first. Keep units small and single-purpose, with high
  cohesion and low coupling; keep the core logic pure and push side effects to the edges.
- Record significant or hard-to-reverse decisions as short ADRs *at the time you make them*,
  including the alternatives you rejected and why.

## 2. Implement

- Follow the existing conventions, patterns, and structure; match the surrounding style.
- Keep changes minimal, compatible, and reversible. No drive-by refactors, renames, or
  reformatting unrelated to the task.
- Commit one logical change at a time, with an imperative message that explains the *why*.
  Never commit secrets, credentials, build artifacts, or large binaries; maintain a real
  `.gitignore`. Work on a branch; don't rewrite or force-push shared history.
- Write self-explaining code. Comment intent, invariants, and trade-offs — not the obvious.

## 3. Verify (test)

- A change is **done** only when it builds, the formatter/linter/type-checker are clean, the
  tests pass, and the docs/comments reflect it.
- Test behavior and contracts, not implementation details. Tests must be deterministic,
  isolated, and fast — no reliance on wall-clock time, network, ordering, or shared mutable
  state.
- Follow the pyramid: many small unit tests, fewer integration tests, a few end-to-end. Push
  logic down to where it is cheap to test.
- A bug fix starts with a test that fails for the old behavior. Don't delete or `skip` a test
  to make CI green — fix the cause or justify the skip in writing. Coverage is a signal, not a
  target: cover the risky and the load-bearing first.

## 4. Integrate (CI)

- Every change passes the same gate before merge: **format → lint → type-check → test →
  build**. Fail fast and loud.
- Use the same commands locally and in CI. Pin the toolchain and dependency versions so builds
  are reproducible. Keep the pipeline fast enough that people actually run it.

## 5. Package & release

- Produce a single, versioned, reproducible artifact from a clean build — deterministic and
  hermetic where the toolchain allows. Ship only what's needed; never bundle secrets or
  development cruft.
- Use **semantic versioning** for anything others depend on, and keep a changelog of
  user-visible changes. Don't break a public interface without a major bump and a migration
  note.
- Verify artifact integrity and provenance (checksums / signing) before it leaves your hands.

## 6. Deliver & operate

- Release in small, reversible increments and keep a rollback path; prefer a progressive
  rollout for risky changes.
- Take configuration from the environment, separate from code, and validate it at startup —
  fail fast on missing or invalid values. Provide safe defaults; document every required
  variable.
- Make it observable: structured logs at sensible levels (never secrets or PII), plus metrics,
  tracing, and a correlation id for services, so a request can be followed and a failure
  diagnosed in production.
- Never silently swallow an error. Handle it or propagate it with context; fail loud where
  failure matters. Error messages should say what failed, why, and what to do next.

## Cross-cutting (every phase)

- **Security.** Secrets come from the environment or a secret manager — never source, logs, or
  the repo. Least privilege for every credential and scope. Validate and encode at trust
  boundaries; treat all external input as hostile; parameterized queries, never string-built
  SQL or shell; enforce authN/authZ on every protected path. Threat-model changes that touch
  auth, data, or external surfaces, and keep dependencies patched.
- **Dependencies & supply chain.** Commit a lockfile and pin versions — reproducible installs
  over "latest." Add a dependency only after weighing maintenance health, license, transitive
  weight, and security against writing it yourself; prefer the standard library. Audit for
  known vulnerabilities and verify integrity for anything sensitive.
- **Performance & resources.** Correctness first; measure before optimizing; optimize the
  proven hot path. Even so, don't write the avoidable quadratic, the N+1 query, or the needless
  allocation in a loop. Release every acquired resource deterministically; put timeouts and
  bounds on external calls and back-pressure on anything unbounded.
- **Documentation.** A README that says what it is, why it exists, and how to run and test it,
  kept current. ADRs near the code for significant decisions. Document the non-obvious —
  intent, invariants, trade-offs — not the obvious.
