# Dream Builder 教学级改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 Tauri 2「奇幻树」改造为教学级、本地原生执行、iOS 26 液态玻璃风格的完整 3D 互动桌面程序,覆盖 Tauri/Rust/TypeScript+React 的核心知识点,并交付安装向导与教学文档。

**Architecture:** pnpm workspace(JS)+ Cargo workspace(Rust)单仓;前端全 React 19 + react-three-fiber,后端 Rust 模块化(trait/泛型/async/state/events/插件),Liquid Glass 做成可复用 React 组件库;统一配置真相源 + 统一任务入口(justfile/根脚本)。

**Tech Stack:** React 19, react-three-fiber v9, @react-three/drei, @react-three/postprocessing, three 0.170+, Zustand, zod, Vite 6, TypeScript 5.7(strict++), Biome, Vitest + Testing Library; Rust edition 2024, Tauri 2, tokio, thiserror, anyhow, serde, tauri-plugin-{store,dialog,fs,opener,log,single-instance}; NSIS。

设计来源:`docs/superpowers/specs/2026-06-18-dream-builder-teaching-refactor-design.md`。

## Global Constraints

- 不修改 `agent-standards/`(只读参考)。遵循其工程基线与 Rust/TS 语言规范。
- Rust:edition **2024**;`cargo clippy -- -D warnings` 零告警;rustfmt 干净;库代码不 `unwrap`/`expect`(除真不变量);错误用 thiserror,应用边界用 anyhow 加上下文;异步用 tokio,不跨 `.await` 持锁。
- TS:`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`;ESM;不用 `any`(用 `unknown` 收窄);IPC/外部输入边界用 zod 校验并反推类型;无游离 promise。
- 确定性不变量:给定 seed,Rust `build_tree_scene` 输出必须确定(保留 `generation_is_deterministic_for_seed`)。
- UI 文案为中文 zh-CN(沿用现状)。
- 默认 seed:`424242`;seed 持久化键 `dream-builder.seed`。
- 包标识符:`com.dreambuilder.fantasytree`;产品名 `Dream Builder Fantasy Tree`;二进制 `dream-builder.exe`;bundle 目标仅 `nsis`。
- 每阶段结束保持可构建、测试通过、可 dev 运行。
- 统一任务入口:`just <task>`(或根 `package.json` 脚本镜像),命令 = `fmt / lint / typecheck / test / build / dev / bundle / check`。
- 工具链:Node 24、pnpm 11、cargo 1.96(已确认本机可用)。

---

## 阶段总览与依赖

| 阶段 | 主题 | 依赖 | 产出可运行性 |
|---|---|---|---|
| P0 | 工程基线 + monorepo 骨架 + git | — | 迁移后旧逻辑仍可 `dev`/`test`/`build` |
| P1 | Rust 后端纵深(模块化/async/state/events/插件/菜单/能力) | P0 | 后端命令/事件齐备,`cargo test` 绿 |
| P2 | 前端全 React 19 + R3F 迁移与纵深 | P0,P1(契约) | React 应用可 dev,交互完整 |
| P3 | Liquid Glass 组件库 + 3D 精致化 | P2 | UI 玻璃化,3D shader 增强 |
| P4 | 构建与 NSIS 安装向导 | P1-P3 | 产出安装包与自包含安装目录 |
| P5 | 教学讲解文档 | P1-P4 | `docs/teaching/` 完整 |

> **执行说明**:本文件给出 **P0 的完整 bite-sized 步骤**。P1–P5 给出文件结构、接口契约与任务清单;其逐步骤细节在每阶段执行前 just-in-time 写入对应 `docs/superpowers/plans/` 子计划(因每阶段会重塑目录树,提前写死步骤会过期 — 这是有意为之的工程取舍)。

---

## 目标文件结构(最终)

见 spec §2。P0 负责把现状迁移到此骨架:

```
dream-builder/
├── pnpm-workspace.yaml · package.json · tsconfig.base.json · biome.json
├── .editorconfig · .nvmrc · .gitignore · vitest.workspace.ts · justfile
├── Cargo.toml(workspace) · rustfmt.toml
├── apps/desktop/        ← 由 frontend/ 迁移并 React 化
├── packages/liquid-glass/   ← 新建(P3)
├── packages/ipc-contracts/  ← 新建(zod 契约)
├── crates/dream-builder/    ← 由 backend/ 迁移
└── docs/{design,superpowers,teaching}/
```

---

# Phase 0 — 工程基线 + monorepo 骨架

**目标**:建立 pnpm+Cargo 双 workspace、统一配置、git、统一任务入口;把现有 frontend/backend 迁入新骨架且**保持旧逻辑可运行**(暂不改业务代码)。React 化在 P2。

### Task 0.1: 初始化 git 与忽略规则

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: 初始化仓库**

Run:
```bash
cd /d/Projects/dream-builder && git init -b main
```
Expected: `Initialized empty Git repository`

- [ ] **Step 2: 写 `.gitignore`**

```gitignore
# Node
node_modules/
**/dist/
.pnpm-store/
# Rust
target/
**/target/
# Tauri
crates/*/gen/
# OS / editor
.DS_Store
Thumbs.db
*.log
# Env
.env
.env.local
```

- [ ] **Step 3: 首次提交当前状态(迁移前快照)**

```bash
git add -A && git commit -m "chore: snapshot project before monorepo migration"
```
Expected: 提交成功(target/ 已忽略)。

> 注:若 `backend/target` 已被追踪过(本仓此前非 git,故不会),无需处理。

### Task 0.2: 迁移目录到 monorepo 布局

**Files:**
- Move: `frontend/` → `apps/desktop/`
- Move: `backend/` → `crates/dream-builder/`

- [ ] **Step 1: 移动目录**

```bash
cd /d/Projects/dream-builder
mkdir -p apps packages crates
git mv frontend apps/desktop
git mv backend crates/dream-builder
```
Expected: 两目录被移动且 git 记录为 rename。

- [ ] **Step 2: 删除迁移后的构建产物**

```bash
rm -rf crates/dream-builder/target apps/desktop/node_modules apps/desktop/dist
```
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add -A && git commit -m "refactor: move frontend->apps/desktop, backend->crates/dream-builder"
```

### Task 0.3: pnpm workspace + 根配置

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `.nvmrc`, `.editorconfig`
- Modify: `package.json`(根)
- Modify: `apps/desktop/package.json`

**Interfaces:**
- Produces: 根脚本 `dev/build/preview/test/typecheck/lint/fmt/check`,工作区包名 `@dream-builder/desktop`。

- [ ] **Step 1: `pnpm-workspace.yaml`**

```yaml
packages:
  - apps/*
  - packages/*
```

- [ ] **Step 2: `.nvmrc`**

```
24
```

- [ ] **Step 3: `.editorconfig`**

```ini
root = true
[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true
[*.rs]
indent_size = 4
[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 4: 重写根 `package.json`**

```json
{
  "name": "dream-builder",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@11.7.0",
  "engines": { "node": ">=24" },
  "scripts": {
    "dev": "pnpm --filter @dream-builder/desktop dev",
    "build": "pnpm --filter @dream-builder/desktop build",
    "preview": "pnpm --filter @dream-builder/desktop preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b --pretty",
    "lint": "biome check .",
    "fmt": "biome format --write .",
    "tauri": "tauri",
    "check": "pnpm lint && pnpm typecheck && pnpm test && pnpm build"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@tauri-apps/cli": "^2.1.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 5: 调整 `apps/desktop/package.json`**(改名、移除已上提到根的 devDeps 由 workspace 共享 — 保留本地需要的)

```json
{
  "name": "@dream-builder/desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1 --port 1420",
    "build": "tsc -p tsconfig.json && vite build",
    "preview": "vite preview --host 127.0.0.1 --port 4173"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.1.0",
    "three": "^0.170.0"
  },
  "devDependencies": {
    "@types/three": "^0.170.0"
  }
}
```

- [ ] **Step 6: 安装并验证**

```bash
cd /d/Projects/dream-builder && pnpm install
```
Expected: 工作区解析成功,生成 `pnpm-lock.yaml`。

- [ ] **Step 7: 提交**

```bash
git add -A && git commit -m "build: set up pnpm workspace and root config"
```

### Task 0.4: 统一 TS 配置(tsconfig.base + 引用)

**Files:**
- Create: `tsconfig.base.json`
- Create: `tsconfig.json`(根 solution,references)
- Modify: `apps/desktop/tsconfig.json`(extends base)

- [ ] **Step 1: `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "useDefineForClassFields": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  }
}
```

- [ ] **Step 2: 根 `tsconfig.json`(solution-style)**

```json
{
  "files": [],
  "references": [{ "path": "apps/desktop" }]
}
```

- [ ] **Step 3: `apps/desktop/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "tsBuildInfoFile": "./.tsbuildinfo"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: 验证类型检查通过(旧 vanilla 代码仍在)**

Run:
```bash
cd /d/Projects/dream-builder && pnpm typecheck
```
Expected: PASS(若 `exactOptionalPropertyTypes`/`noUncheckedIndexedAccess` 暴露旧代码问题,在本步修最小必要处使其通过 — 记录于提交信息)。

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "build: unify TypeScript config via tsconfig.base"
```

### Task 0.5: Biome(lint+format 合一)

**Files:**
- Create: `biome.json`

- [ ] **Step 1: `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "files": { "ignore": ["**/dist", "**/target", "**/node_modules", "**/*.gen.ts"] },
  "organizeImports": { "enabled": true },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": { "noExplicitAny": "error" },
      "style": { "useConst": "error", "useImportType": "error" }
    }
  },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "always" } }
}
```

- [ ] **Step 2: 运行并自动修复**

```bash
cd /d/Projects/dream-builder && pnpm fmt && pnpm lint
```
Expected: 格式化写入;lint 通过或仅余需手动处理项(本步修至通过)。

- [ ] **Step 3: 提交**

```bash
git add -A && git commit -m "build: add Biome for unified lint + format"
```

### Task 0.6: Vitest 工作区统一

**Files:**
- Create: `vitest.workspace.ts`
- Modify: `apps/desktop/vite.config.ts`(保留 test 配置或迁出)

- [ ] **Step 1: `vitest.workspace.ts`**

```ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'apps/*',
  'packages/*',
]);
```

- [ ] **Step 2: 确认 `apps/desktop/vite.config.ts` 仍含 test(node 环境)**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  clearScreen: false,
  server: { strictPort: true },
  envPrefix: ['VITE_', 'TAURI_'],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

- [ ] **Step 3: 运行测试(迁移后旧测试应仍绿)**

```bash
cd /d/Projects/dream-builder && pnpm test
```
Expected: 既有 4 个前端测试文件全部 PASS。

- [ ] **Step 4: 提交**

```bash
git add -A && git commit -m "test: unify Vitest via workspace config"
```

### Task 0.7: Cargo workspace + edition 2024 + lints

**Files:**
- Create: `Cargo.toml`(根 workspace)
- Create: `rustfmt.toml`
- Modify: `crates/dream-builder/Cargo.toml`(edition 2024, 继承 workspace lints)
- Modify: `crates/dream-builder/tauri.conf.json`(路径:`frontendDist`, before*Command)

**Interfaces:**
- Produces: workspace 成员 `crates/*`;`cargo test`/`clippy` 从根可运行。

- [ ] **Step 1: 根 `Cargo.toml`**

```toml
[workspace]
resolver = "2"
members = ["crates/*"]

[workspace.package]
edition = "2024"
version = "0.1.0"
authors = ["Dream Builder"]

[workspace.lints.clippy]
all = { level = "warn", priority = -1 }

[profile.release]
lto = true
codegen-units = 1
strip = true
```

- [ ] **Step 2: `rustfmt.toml`**

```toml
edition = "2024"
max_width = 100
```

- [ ] **Step 3: 改 `crates/dream-builder/Cargo.toml`**

```toml
[package]
name = "dream-builder"
description = "Interactive procedural 3D fantasy tree desktop app"
edition.workspace = true
version.workspace = true
authors.workspace = true

[lints]
workspace = true

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri = { version = "2", features = [] }
tauri-plugin-single-instance = "2"

[features]
custom-protocol = ["tauri/custom-protocol"]
```

- [ ] **Step 4: 修 `crates/dream-builder/tauri.conf.json` 路径**

`frontendDist` 改为 `../../apps/desktop/dist`;`beforeDevCommand` 改为 `pnpm --filter @dream-builder/desktop dev`(从 tauri.conf.json 的父目录 `crates/dream-builder/` spawn,需用 `-C`):
```json
  "build": {
    "beforeDevCommand": "pnpm -C ../.. dev",
    "devUrl": "http://127.0.0.1:1420",
    "beforeBuildCommand": "pnpm -C ../.. build",
    "frontendDist": "../../apps/desktop/dist"
  },
```
同时把 `"$schema"` 改为 `"../../node_modules/@tauri-apps/cli/config.schema.json"`(pnpm 会在根装 CLI;若被 hoist 到包内则相应调整)。

- [ ] **Step 5: 验证 Rust 构建与测试**

```bash
cd /d/Projects/dream-builder && cargo test && cargo clippy -- -D warnings
```
Expected: 7 个 Rust 测试 PASS;clippy 零告警(edition 2024 下若出现 lint,修最小必要处)。

- [ ] **Step 6: 提交**

```bash
git add -A && git commit -m "build: Cargo workspace, edition 2024, clippy lints"
```

### Task 0.8: justfile 统一任务入口

**Files:**
- Create: `justfile`

- [ ] **Step 1: `justfile`**

```just
set windows-shell := ["powershell.exe", "-NoLogo", "-Command"]

default:
    @just --list

dev:
    pnpm dev

build:
    pnpm build

fmt:
    pnpm fmt
    cargo fmt

lint:
    pnpm lint
    cargo clippy -- -D warnings

typecheck:
    pnpm typecheck

test:
    pnpm test
    cargo test

check: lint typecheck test build

tauri-dev:
    pnpm tauri dev

bundle:
    pnpm tauri build
```

- [ ] **Step 2: 验证(若已安装 just)**

```bash
just --list 2>/dev/null || echo "just not installed; root npm scripts mirror these"
```
Expected: 列出任务,或提示用根脚本镜像(justfile 为可选便捷层,CI 用根脚本)。

- [ ] **Step 3: 提交**

```bash
git add -A && git commit -m "build: add justfile as unified task entrypoint"
```

### Task 0.9: 更新 AGENTS.md 与 README 反映新布局

**Files:**
- Modify: `AGENTS.md`(命令、布局、路径 quirk 段落)
- Modify: `README.md`

- [ ] **Step 1:** 更新 `AGENTS.md` 的 Layout/Commands/Tauri path 段落为 monorepo 与 pnpm 命令(把 `npm.cmd`/`frontend/`/`backend/` 等替换为 pnpm/`apps/desktop`/`crates/dream-builder`)。保留中文 UI、确定性、seed 等约定段。

- [ ] **Step 2:** 更新 `README.md` 的安装/运行/构建命令为 pnpm + 新路径。

- [ ] **Step 3: 提交**

```bash
git add -A && git commit -m "docs: update AGENTS.md and README for monorepo layout"
```

### Task 0.10: Phase 0 验收门禁

- [ ] **Step 1: 全量门禁**

```bash
cd /d/Projects/dream-builder && pnpm lint && pnpm typecheck && pnpm test && cargo test && cargo clippy -- -D warnings && pnpm build
```
Expected: 全绿;`apps/desktop/dist` 产出。旧 vanilla 逻辑功能不变。

- [ ] **Step 2: dev 冒烟(可选,需人工)**

```bash
pnpm tauri dev
```
Expected: 窗口启动,旧奇幻树渲染如初。

- [ ] **Step 3: 提交里程碑**

```bash
git add -A && git commit -m "chore: Phase 0 complete — monorepo foundation green" --allow-empty
```

---

# Phase 1 — Rust 后端纵深(任务清单)

**目标**:把 `tree.rs` 单文件拆为高内聚模块,补齐 async/state/events/插件/菜单/能力,覆盖 Rust 知识点。详细步骤执行前写入 `docs/superpowers/plans/2026-06-18-phase1-rust-backend.md`。

**文件结构(crates/dream-builder/src/)**:见 spec §4.1(domain/、generation/、magic.rs、state.rs、events.rs、commands.rs、persistence.rs、menu.rs、errors.rs、lib.rs)。

**任务清单(每个含 TDD 循环)**:
1. 抽出 `lib.rs`,使集成测试可用;`main.rs` 仅引导。
2. `errors.rs`:引入 `thiserror`,定义 `AppError` 枚举(取代 `CommandError`),实现 `Serialize` 给前端。保留错误码 `invalid_detail`。
3. `domain/geometry.rs`:`Vec3` + newtype `Seed`/`Energy`/`Hue`,`From`/`Into`,`Add`/`Mul` 运算符重载;单测。
4. `domain/scene.rs`:迁移结构 + `TreeSceneBuilder`(builder 模式);单测 builder 产出。
5. `domain/detail.rs`:`DetailKind` 枚举 + 穷尽匹配辅助。
6. `generation/rng.rs`:`trait Rng` + `SeededRng impl`(泛型约束);迁移并单测确定性。
7. `generation/mod.rs`:`trait SceneGenerator`(泛型 + 生命周期 + 默认方法)。
8. `generation/fantasy_tree.rs`:`FantasyTreeGenerator: SceneGenerator`;迁移 `build_tree_scene` 逻辑,保留确定性与计数边界测试。
9. `magic.rs`:迁移 `compute_magic_field`,保留有限性/clamp 测试。
10. `state.rs`:`AppState { Arc<Mutex<Inner>> }`(设置/历史/缓存);单测。
11. `commands.rs`:命令改 `Result<_, AppError>`,注入 `State`,新增 async 命令;集成测试(`tests/`)。
12. `events.rs` + 后台任务:`magic_field` 通过 Channel/event 推送;`tokio` 运行时;不跨 `.await` 持锁。
13. 插件接线:`store`/`dialog`/`fs`/`opener`/`log`;`Cargo.toml` 加依赖与 feature。
14. `capabilities/default.json`:为各插件/命令声明最小权限。
15. `menu.rs`:原生菜单 + 托盘 + 事件分发。
16. `tauri.conf.json`:启用 CSP。
17. 阶段门禁:`cargo test` + `cargo clippy -D warnings` 绿。

**契约同步**:任何 wire 格式变化,需同步 `packages/ipc-contracts`(zod)与前端类型(P2);P1 阶段先以 Rust 为真相源并更新 `ipc-contracts` 的 zod schema。

---

# Phase 2 — 前端全 React 19 + R3F 迁移(任务清单)

**目标**:`apps/desktop` 从 vanilla 迁移到 React 19 + react-three-fiber,保留交互/降级/确定性语义,补齐 TS 纵深知识点。详细步骤写入 `docs/superpowers/plans/2026-06-18-phase2-react-frontend.md`。

**依赖新增**:`react@^19`、`react-dom@^19`、`@react-three/fiber@^9`、`@react-three/drei`、`@react-three/postprocessing`、`zustand`、`zod`;dev:`@vitejs/plugin-react`、`@testing-library/react`、`jsdom`。

**文件结构(apps/desktop/src/)**:`main.tsx`、`App.tsx`、`scene/*`(R3F 组件)、`ui/*`(React HUD)、`interaction/*`(hooks + 复用 `selectionState` reducer)、`ipc/*`(invoke/listen 封装 + 装饰器)、`state/*`(zustand store)、`workers/*`。`packages/ipc-contracts`(zod 契约,被 app 与测试共享)。

**任务清单**:
1. 建 `packages/ipc-contracts`:zod schema(TreeScene/DetailInfo/MagicField/IPC 消息可辨识联合)+ `z.infer` 导出类型;迁移并增强 `validateTreeScene` 测试到 schema 测试。
2. 加 React 依赖与 `@vitejs/plugin-react`;`index.html` 指向 `main.tsx`;`tsconfig` 加 `jsx: react-jsx`;测试加 jsdom 项目(组件)与 node 项目(纯逻辑)。
3. `state/` zustand store(种子/主题/动效/状态文案/历史);单测。
4. `ipc/` 桥接:`invoke`/`listen` 封装 + zod `safeParse` 边界校验 + `@measure`/`@logged` 标准装饰器 + 降级;迁移 `treeApi` 测试。
5. `interaction/`:`selectionState` reducer 保留 + `useSelection` hook;键盘快捷键 hook。
6. `scene/`:`<Canvas>` + `<TreeMesh>`/`<LeafClusters>`/`<Runes>`/`<Crystals>`/`<MagicParticles>`/`<Lighting>`/`<Effects>`(Bloom);R3F `onPointerOver/onClick` 接入选择;`useFrame` 动画;`prefers-reduced-motion`。
7. `ui/`:React HUD(状态/悬停/详情/能量条/种子表单/按钮/帮助/onboarding),暂用基础样式(玻璃化在 P3)。
8. `workers/`:Web Worker 化 fallback 生成,类型化消息协议(可辨识联合)。
9. magic_field 改为 `listen` 后端事件(对接 P1 events)。
10. 截图/导出 glTF:接 P1 的 dialog/fs 命令(Tauri 下原生保存;浏览器下回退下载)。
11. 阶段门禁:lint/typecheck/test/build 绿;dev 交互回归。

---

# Phase 3 — Liquid Glass 组件库 + 3D 精致化(任务清单)

**目标**:`packages/liquid-glass` 可复用 React 组件库 + iOS 26 玻璃主题,接入 `ui/`;3D 加 GLSL shader 精致化。详细步骤写入 `docs/superpowers/plans/2026-06-18-phase3-liquid-glass.md`。

**`packages/liquid-glass`**:
1. 包骨架(`@dream-builder/liquid-glass`,exports,tsconfig 继承,jsdom 测试)。
2. 主题令牌 + `ThemeProvider`(CSS 变量:blur/tint/specular/radius/refraction;明暗自适应)。
3. `GlassSurface` 原语(厚度/模糊/高光/折射 + 能力探测降级);测试降级分支。
4. 组件:`GlassPanel`/`GlassCard`/`GlassButton`/`GlassBadge`/`GlassSlider`/`GlassToggle`(forwardRef、受控、a11y、reduced-motion)。
5. 折射滤镜(SVG `feTurbulence`+`feDisplacementMap`)+ 质量档位 `high/balanced/low` + 自动降级;性能护栏(层数/模糊半径限制)。
6. 把 `apps/desktop/ui/` 全量换用玻璃组件;视觉打磨。
7. 3D 侧:水晶/叶片自定义 GLSL(菲涅尔高光/流光),与玻璃高光语言统一。
8. 阶段门禁:lint/typecheck/test/build 绿;性能冒烟(帧率不劣化明显)。

> 视觉先做 2–3 个玻璃面板方案确认再铺开(可用浏览器可视化对比)。

---

# Phase 4 — 构建与 NSIS 安装向导(任务清单)

**目标**:产出自包含安装目录(EXE + WebView2 依赖 + 资源)+ 定制中文 NSIS 向导。详细步骤写入 `docs/superpowers/plans/2026-06-18-phase4-packaging.md`。

**任务清单**:
1. `tauri.conf.json` bundle 收尾:icon、resources、version、identifier、CSP。
2. NSIS 定制:`bundle.windows.nsis`(installerHooks/template/语言含 zh-CN、品牌横幅/侧图、`installMode`、license)。提供欢迎→许可→路径→组件→安装→完成(可勾启动)。
3. `crates/dream-builder/installer/` 放模板与品牌资源、`LICENSE`。
4. `CHANGELOG.md` + 语义化版本。
5. 构建验证:`pnpm tauri build` 产出 `dream-builder.exe` 与 NSIS 安装包;文档化 MSVC/x64 Native Tools 前置与可复现命令(实际打包可能需用户本机执行)。

---

# Phase 5 — 教学讲解文档(任务清单)

**目标**:`docs/teaching/` 完整中文教学文档。详细步骤写入 `docs/superpowers/plans/2026-06-18-phase5-teaching-docs.md`。

**任务清单**:
1. `docs/teaching/README.md`:总览 + 知识点地图(链接各章 + 代码位置)。
2. `tauri.md`:命令/状态/事件/Channel/插件/能力权限/菜单托盘/窗口/打包,逐点「是什么/为什么/代码在哪/陷阱」。
3. `rust.md`:模块/trait/泛型/生命周期/枚举匹配/错误处理/newtype/builder/async/并发/测试。
4. `typescript-react.md`:strict 类型/泛型/可辨识联合/类型守卫/装饰器/工具类型/Worker;React 19/hooks/R3F/zustand。
5. `3d-shaders.md`:Three.js/R3F 管线、材质、后期、GLSL 基础、Liquid Glass CSS 技术。
6. `engineering.md`:monorepo/统一配置/测试金字塔/门禁/打包/ADR。
7. 与 `agent-standards` 规范对照表。
8. 校对与交叉链接(file:line 准确)。

---

## Self-Review(对照 spec)

- **Spec 覆盖**:P0=spec §2/§8 工程基线;P1=spec §4;P2=spec §3;P3=spec §5 + §3.1 shader;P4=spec §6;P5=spec §7。设计原则(§1)贯穿 Global Constraints。无遗漏章节。
- **占位符**:P0 步骤为完整可执行内容;P1–P5 为任务清单 + 契约,逐步骤细节按计划 JIT 写入子计划(已在阶段总览显式声明,非占位符遗漏)。
- **类型/命名一致**:包名 `@dream-builder/desktop`/`@dream-builder/liquid-glass`/`ipc-contracts`;错误码 `invalid_detail` 保留;seed 键 `dream-builder.seed`;默认 seed `424242` 全文一致。
- **风险**:大重构 + 打包依赖本机工具链,已在 spec §10 记录;每阶段保持可运行降低风险。

## Execution Handoff

见对话:用户已要求「整体连续推进、全部完整再回头 review」,等同选择**批量执行**。将以 executing-plans 方式从 P0 起连续推进,阶段间保持可运行,全部完成后统一 review。
