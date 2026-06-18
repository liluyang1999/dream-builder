# 06 · 与 `agent-standards` 规范的对照

> 仓库里的 `agent-standards/`(只读)给出了三层规范:第 1 层行为(`AGENTS.md`)、
> 第 2 层工程通则(`engineering-baseline.md`)、第 3 层语言惯用法(`languages/*.md`)。
> 本章把这些条款落到本项目的具体代码,方便你“按规范读代码”。

## 工程通则(第 2 层)

| 规范要点 | 在本项目的落地 |
|---|---|
| 一次提交只做一件事,信息说明“为什么” | 见 git 历史:每个 Phase 拆成多个聚焦提交 |
| 不提交构建产物/依赖,维护 `.gitignore` | `.gitignore` 忽略 `node_modules`/`target`/`dist`;`.gitattributes` 统一 LF |
| “完成”=能构建、零告警、测试通过、文档更新 | `pnpm check` + `cargo clippy -- -D warnings` 门禁;本教学文档随代码更新 |
| 测试行为与契约,确定、隔离、快速 | `selectionState`/`store`/契约/`scene_contract` 测试;确定性生成测试 |
| 提交锁文件、固定版本 | `pnpm-lock.yaml`、`Cargo.lock`、`packageManager`、`.nvmrc` |
| 本地与 CI 同一组命令 | 根 `package.json` 脚本 + `justfile` |
| 绝不静默吞错;错误说清哪里/为何 | `AppError`(thiserror)+ 前端 zod `reason`;边界失败有告警文案 |
| 配置来自环境、与代码分离;启动校验 | 设置经 store 插件持久化;`persistence::load_settings` 失败回退默认 |
| 核心逻辑保持纯粹,副作用推到边缘 | `reduceSelectionState`、`build_tree_scene`、`compute_magic_field` 皆纯;副作用在 `App.tsx`/命令层 |
| 文档:README + 贴近代码的决策记录 | 根 `README.md`、`docs/superpowers/`(spec+plan)、本教学文档 |

## Rust(第 3 层)

| 规范要点 | 落地 |
|---|---|
| edition 2024、clippy 零告警、rustfmt | 根 `Cargo.toml`/`rustfmt.toml`;`[workspace.lints.clippy]` |
| 可失败 API 用 `Result`+`?`;库用 thiserror | `errors.rs::AppError`、`commands.rs`、`persistence.rs` |
| 库代码不滥用 `unwrap`/`expect` | 仅 `state.rs::lock()` 用带理由的 `expect` |
| 先借用再克隆;参数取 `&str`/`&[T]` | `generate_detail(id: &str)`、`build_*(rng: &mut impl Rng)` |
| 迭代器/组合子取代手写循环;`Option`/`Result` 组合 | `generate_detail` 的 `find().ok_or_else()`;`record_seed` 的 `retain` |
| newtype 承载领域含义;`From`/`Into`;builder | `Seed`/`Energy`;`TreeSceneBuilder` |
| 共享状态用 `Arc<Mutex>`;选定 tokio;不跨 `.await` 持锁 | `AppState`;`events.rs` 的异步发射器 |
| 单测放模块内,集成测试放 `tests/` | 各模块 `#[cfg(test)]` + `tests/scene_contract.rs` |

## TypeScript/JavaScript(第 3 层)

| 规范要点 | 落地 |
|---|---|
| strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` | `tsconfig.base.json` |
| 处处 ESM;具名导出;小模块 | 全仓 `type: module`;具名导出为主 |
| 不用 `any`,用 `unknown` 再收窄 | zod 边界(`treeApi.ts`/`ipc-contracts`) |
| 可辨识联合 + `as const` + `satisfies` + 穷尽 | `SceneLoadResult`、`SelectionAction`、worker 协议 |
| 边界用运行时模式校验并反推类型 | `packages/ipc-contracts`(zod + `z.infer`) |
| `async/await`,无游离 promise;`AbortController`/取消 | `App.tsx` 的 effect 用 `active` 标志;`void` 标注 |
| 抛 `Error` 而非字符串;保留 cause | `treeApi.ts`/`App.tsx` 的错误信息 |
| Vitest 测行为;不依赖真实时钟/网络 | 组件/逻辑/契约测试;Worker 在测试下同步降级 |

## 小结

规范不是束缚,而是把“好品味”显式化。把本表当成索引:想看某条规范的真实样子,直接跳到对应文件。
