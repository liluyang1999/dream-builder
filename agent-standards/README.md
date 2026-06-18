# agent-standards

A portable, tool-agnostic set of engineering standards for coding agents (Claude Code,
Codex, Cursor, …), organized in three tiers and provided in two parallel language sets
(`en/`, `zh/`).

## The three tiers

| Tier | File | Scope | Answers |
|------|------|-------|---------|
| 1 — Law | `AGENTS.md` | Behavior & judgment, tool- and language-agnostic | *How should the agent conduct itself?* |
| 2 — Craft | `engineering-baseline.md` | Concrete but language-neutral practice | *What does "good engineering" mean in any repo?* |
| 3 — Idiom | `languages/{python,typescript-javascript,rust,jvm}.md` | Per-language modern defaults | *How is it done well in this language?* |

Each tier narrows the previous one (general → specific). Precedence runs the other way: a
user's explicit instruction and a repo's own closer-scoped rules override anything here
(see Tier 1 §0).

That is the **vertical** axis. **Horizontally**, Tier 2 and every language guide trace the
full lifecycle — understand & design → implement → verify → integrate → release → operate —
with security, dependencies, performance, and documentation as cross-cutting concerns. So a
change is covered from first thought to shipped artifact.

## Deploying

These are plain Markdown — drop them where your agent reads instructions.

| Target | Suggested placement |
|--------|---------------------|
| Claude Code (global) | `en/AGENTS.md` → `~/.claude/CLAUDE.md` |
| Codex (global) | `zh/AGENTS.md` → `~/.codex/AGENTS.md` |
| Any agent (cross-tool) | `AGENTS.md` at the user or repo root |
| A specific repo | paste/adapt the relevant tier(s) into the repo's own `AGENTS.md` |

Tier 1 references Tiers 2–3 by relative path and degrades gracefully: an `AGENTS.md`
deployed on its own is still complete. For the full stack, copy the tier files alongside it.

## Extending

Add a language by creating `languages/<lang>.md` in both `en/` and `zh/`, following the
existing shape (toolchain → layout → types/safety → idioms → errors → concurrency →
testing → dependencies → pitfalls). Keep it opinionated and short; this set optimizes for
signal, not coverage.

## 中文说明

本目录提供面向编码智能体（Claude Code、Codex、Cursor 等）的、工具无关的工程规范，分三层、
中英双份（`en/` 与 `zh/`）：第 1 层 `AGENTS.md` 是与语言无关的「行为准则」，第 2 层
`engineering-baseline.md` 是语言无关的「工程通则」，第 3 层 `languages/*.md` 是各语言的
「现代化实践」。纵向上三层由「通用」走向「具体」；优先级方向相反——用户的明确指令与仓库
自身的就近规则，高于本目录的任何内容。横向上，第 2 层与各语言指引都贯穿完整生命周期——
理解与设计 → 实现 → 验证 → 集成 → 发布 → 运维，并以安全、依赖、性能、文档为横切关注点，
覆盖一次改动从最初构思到交付产物的全过程。部署时把对应文件放到智能体读取指令的位置（例如
`zh/AGENTS.md` → `~/.codex/AGENTS.md`）。
