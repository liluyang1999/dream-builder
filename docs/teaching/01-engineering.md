# 01 · 工程化与现代工程范式

> 目标:理解这个仓库为什么这样组织,以及“现代工程范式”在实践中长什么样。

## 1. Monorepo:两个 workspace 合体

**是什么**:一个仓库同时容纳前端(JS/TS)与后端(Rust),各用各自的 workspace 机制。

- JS 侧:`pnpm-workspace.yaml` 声明成员 `apps/*` 与 `packages/*`。pnpm 用硬链接/符号链接
  共享依赖,工作区内包之间用 `workspace:*` 互相引用(见
  `apps/desktop/package.json` 依赖里的 `@dream-builder/ipc-contracts` 与
  `@dream-builder/liquid-glass`)。
- Rust 侧:根 `Cargo.toml` 的 `[workspace]` 把 `crates/*` 纳入统一构建,并用
  `[workspace.package]`(edition/version/authors)与 `[workspace.lints]` 统一约束。

**为什么**:前后端共享一套版本、脚本与质量门禁,改动可以一次性跨语言验证;包之间直接引用源码,
免去“先发布再消费”的回路。

**陷阱**:Tauri 的 `before*Command` 与 `frontendDist` 基准目录不同(见 `AGENTS.md` 的
“Tauri path-base quirk”),迁移目录后最容易在这里翻车。

## 2. 配置“大一统”:单一真相源

JS 生态没有 Python `pyproject.toml` 那样的单文件,但可以用“继承 + 工作区”达到等效:

- `tsconfig.base.json`:编译选项的唯一真相源,各包 `extends` 它
  (`apps/desktop/tsconfig.json`、`packages/*/tsconfig.json`)。其中开启了
  `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` 等严格档。
- `biome.json`:Lint 与格式化合二为一(替代 ESLint+Prettier 两件套)。
- `vitest.config.ts`(根):用 Vitest 3 的 `projects` 模型发现各包测试。
- 根 `package.json` 的 `scripts`:统一入口(`dev/build/test/typecheck/lint/check`)。
- `justfile`:跨语言唯一任务入口(`just check` 串起 JS 与 Rust 的 fmt/lint/test/build)。

**为什么**:一处配置、处处生效;新人只需记住 `pnpm check` / `just check`。

## 3. 测试金字塔与质量门禁

**是什么**:大量小而快的单元测试,少量集成测试,极少端到端。

- Rust 单元测试就近放在模块的 `#[cfg(test)]` 里
  (如 `crates/dream-builder/src/generation/fantasy_tree.rs` 的确定性/计数测试);
  集成测试放 `crates/dream-builder/tests/scene_contract.rs`(只能触达 `pub` API,
  从而验证“对外可用面”)。
- 前端用 Vitest:纯逻辑(`apps/desktop/src/tests/selectionState.test.ts`、
  `store.test.ts`)、契约(`packages/ipc-contracts/src/index.test.ts`)、组件
  (`apps/desktop/src/tests/DetailsPanel.test.tsx`,jsdom + Testing Library)。

**门禁**:`pnpm check` = `lint → typecheck → test → build`;Rust 侧 `cargo clippy -- -D warnings`
把告警当错误。本地与 CI 用同一组命令,保证可复现。

**为什么**:测试行为与契约而非实现细节;把逻辑下沉到纯函数(如 `reduceSelectionState`、
`build_tree_scene`)让测试既廉价又确定。

**陷阱**:`noUncheckedIndexedAccess` 会把 `arr[i]` 标成 `T | undefined`——这是特性不是 bug,
它在编译期逼你处理越界(本仓在迁移旧代码时就借此修了若干潜在隐患)。

## 4. 确定性与可复现

- 给定种子,Rust 生成必须确定:`fantasy_tree.rs::generation_is_deterministic_for_seed`
  是守门测试。前端回退生成(`apps/desktop/src/data/fallbackTree.ts`)同样基于种子。
- 锁文件(`pnpm-lock.yaml`、`Cargo.lock`)固定依赖;`.nvmrc`/`packageManager` 固定工具链。

## 5. 版本与变更记录

- 语义化版本;`CHANGELOG.md` 面向用户记录每个版本做了什么。
- 重大、难回退的决策建议写成贴近代码的简短 ADR(本项目的设计与计划见
  `docs/superpowers/`)。

## 小结

工程化不是“配置很多”,而是“一处配置、统一命令、快速且确定的反馈”。本仓的每个工具选择
(pnpm/Cargo workspace、Biome、Vitest projects、justfile、严格 TS、clippy 零告警)都服务于
这条主线。
