# agent-standards

A portable, tool-agnostic engineering standard for coding agents (Claude Code, Codex, Cursor,
…), in two parallel language sets (`en/`, `zh/`). It has **two layers**:

| Layer | File(s) | When loaded | Holds |
|-------|---------|-------------|-------|
| **Global** (universal) | `AGENTS.md` | **Always** — on every agent start | Conduct (how the agent behaves) + Craft (the engineering lifecycle, design → deliver) + the on-demand loading protocol |
| **Language** (specific) | `languages/{python, typescript-javascript, rust, jvm}.md` | **On demand** — only when a task touches that language | Per-language toolchain, idioms, build/packaging, pitfalls |

The split is deliberate. The universal layer is small and always needed, so it is always loaded.
The language layer is bulkier and situational, so the global `AGENTS.md` tells the agent to
**detect the tech stack and pull in only the guide(s) the current task needs** — never all of
them. Context is a finite budget; load the smallest set of guidance that fully covers the work.

## Deploying

Put `AGENTS.md` where your agent auto-loads global instructions, and keep the `languages/`
directory **beside it** so the on-demand reads resolve by relative path.

| Target | Place the global file at | Languages directory |
|--------|--------------------------|---------------------|
| Claude Code (global) | `~/.claude/CLAUDE.md` *or* `~/.claude/AGENTS.md` | `~/.claude/languages/` |
| Codex (global) | `~/.codex/AGENTS.md` | `~/.codex/languages/` |
| Other agents | `~/.agents/AGENTS.md` (or a repo root) | `…/languages/` |

Pick the `en/` or the `zh/` set per preference (e.g. `zh/` → `~/.codex/`). The global `AGENTS.md`
references `languages/<guide>.md` by relative path, so co-locating the two is all that's required.
A repo's own `AGENTS.md` and closer-scoped rules always override this set.

## Extending

Add a language by creating `languages/<lang>.md` in both `en/` and `zh/` — same shape (toolchain →
layout → types/safety → idioms → errors → concurrency → testing → build & packaging →
dependencies → pitfalls) — then add a row to the dispatch table in each `AGENTS.md` (*How to use
this standard*). Keep it opinionated and short; this set optimizes for signal, not coverage.

## 中文说明

本目录是面向编码智能体（Claude Code、Codex、Cursor 等）的、工具无关的工程规范，中英双份（`en/`
与 `zh/`），分**两层**：**全局层** `AGENTS.md` 始终加载，包含「行为准则 + 工程生命周期（设计→
交付）+ 按需加载协议」；**语言层** `languages/*.md` 仅当任务涉及该语言时按需加载。如此划分是有意
为之——通用内容小而常用，故始终加载；语言内容更厚且因任务而异，故由全局文件指示智能体「先识别
技术栈，再只拉取当前任务所需的语言指引」，而非一次性全部载入，因为上下文是有限预算。部署时把
`AGENTS.md` 放到智能体自动加载全局指令之处，并把 `languages/` 目录**放在其旁边**，使按需加载的
相对路径可解析（例如 `zh/AGENTS.md` → `~/.codex/AGENTS.md`，`languages/` → `~/.codex/languages/`）。
