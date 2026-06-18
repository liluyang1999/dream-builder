# 设计文档 · Dream Builder 智慧树:Tauri 2 教学级原生 3D 程序改造

- 日期:2026-06-18
- 状态:设计待评审(Design — pending user review)
- 作者:Claude(与用户协作 brainstorming)
- 适用范围:`D:\Projects\dream-builder` 全仓(`agent-standards/` 除外 — 只读参考,禁止改动)

---

## 0. 目标与背景

### 0.1 用户目标(原话提炼)

将现有 Tauri 2 「奇幻树」桌面程序改造成一个**教学用、本地原生执行**的完整 3D 互动程序,要求:

1. 尽可能覆盖 **Tauri 2 / TypeScript / Rust(含面向对象与工程技巧)** 的知识点,供用户自学。
2. 最终是一个**原生 WebView2 + 原生 EXE** 的 Tauri 程序,精致优雅的「3D 世界的智慧树」。
3. 交付范围包含:代码改造 + 构建打包成**完整安装路径**(目录含 EXE 入口与全部依赖资源)+ **简单安装向导** + **详细中文教学文档**。
4. UI 重做为 **iOS 26 液态玻璃(Liquid Glass)** 主题,需**针对 React 最新版本封装可复用**,权衡性能与特效,样式精美、标准。
5. 整个工程符合**最现代化工程范式**,前后端配置**大一统**(类比 `pyproject.toml` 的统一管理),代码**高内聚低耦合**。

### 0.2 已确认的关键决策(brainstorming 结论)

| 决策点 | 结论 |
|---|---|
| 改造策略 | 在现有清晰分层基础上增量增强(非推倒重来),但前端引入 React。 |
| 前端框架 | **全 React 19**,含 **react-three-fiber(R3F)** 包裹 3D 场景。 |
| TS 教学重点 | 语言 + 工程纵深(泛型/可辨识联合/类型守卫/装饰器/工具类型/Worker),叠加 React/R3F 概念。 |
| UI 主题 | iOS 26 Liquid Glass,做成**可复用 React 组件库**;性能/特效平衡;带降级。 |
| 工程范式 | pnpm workspace + Cargo workspace 单仓;统一配置真相源;高内聚低耦合。 |
| 推进节奏 | **整体连续推进**,全部完成后统一 review(每阶段仍保持可构建/可运行)。 |
| 约束 | 不改动 `agent-standards/`;遵循其工程基线与 Rust/TS 语言规范。 |

### 0.3 现状复盘(改造起点)

- 两进程架构:前端(Vite + TS + Three.js,约 1200 行)/ 后端(Rust + Tauri 2,约 355 行)。前端可在无后端时优雅降级。
- 前端分层:`scene/`(Renderer/TreeFactory/Particles/FantasyTreeApp)、`interaction/`(InteractionController/selectionState 纯 reducer/keyboardShortcuts)、`ui/`(DetailsPanel/OnboardingHint)、`data/`(fallbackTree/validateTreeScene)、`tauri/treeApi`、`types/tree`。
- 后端:`main.rs`(引导 + single-instance)、`tree.rs`(11 个 serde 结构、3 个同步命令 `generate_tree`/`detail_info`/`magic_field`、xorshift RNG、7 单测)、`errors.rs`。
- 现有教学缺口:无 Rust 异步/状态/事件、插件仅 single-instance、capabilities 为空、无菜单/托盘、CSP=null、无 CI、无统一配置、无 React/组件化。

---

## 1. 设计原则

1. **每个新概念挂靠真实功能**:为教学引入的语法/模式都服务一个可见特性,避免纯炫技包装(在用户"最大知识覆盖"目标下允许适度密度,但不做无意义转发包装)。
2. **高内聚低耦合**:核心逻辑纯粹,副作用推到边缘;模块小而单一职责,藏在清晰接口后。
3. **边界即契约**:所有 IPC / 外部输入在边界处用运行时 schema 校验(Rust serde + 校验,TS zod),由 schema 反推静态类型,单一真相源。
4. **可复现工程**:锁文件、固定工具链;本地与门禁同一套命令(fmt→lint→typecheck→test→build)。
5. **确定性内核**:给定 seed,Rust 生成结果必须确定(保留 `generation_is_deterministic_for_seed` 不变量)。
6. **优雅降级**:无 Tauri(纯浏览器)时回退;Liquid Glass 高级滤镜不支持时降级为普通毛玻璃。

---

## 2. 目标工程结构(配置大一统 · monorepo)

采用 **pnpm workspace(JS/TS)+ Cargo workspace(Rust)** 单仓,根级单一配置真相源。

```
dream-builder/
├── pnpm-workspace.yaml            # JS 工作区成员声明
├── package.json                   # 根:统一脚本入口 + 共享 devDeps(大一统调度)
├── tsconfig.base.json             # TS 编译选项单一真相源(各包 extends)
├── biome.json                     # Lint + Format 合一(替代 ESLint+Prettier 双工具)
├── .editorconfig / .nvmrc         # 编辑器 / Node 版本统一
├── vitest.workspace.ts            # 测试工作区统一编排
├── Cargo.toml                     # [workspace] 成员 + 统一 lints/profile
├── rustfmt.toml / clippy 配置     # Rust 风格与静态检查统一
├── justfile                       # 跨语言统一任务入口(fmt/lint/typecheck/test/build/dev/bundle)
├── apps/
│   └── desktop/                   # Tauri 应用前端(React 19 + R3F)← 取代 frontend/
│       ├── index.html
│       ├── vite.config.ts
│       ├── tsconfig.json          # extends ../../tsconfig.base.json
│       └── src/
│           ├── main.tsx           # React 入口
│           ├── App.tsx
│           ├── scene/             # R3F 组件(Canvas/Tree/Particles/Lighting/Effects)
│           ├── ui/                # React HUD(消费 liquid-glass 组件库)
│           ├── interaction/       # 拾取/选择/快捷键(hooks + 纯 reducer)
│           ├── ipc/               # Tauri 桥接(invoke/listen 封装,装饰器埋点)
│           ├── state/             # 全局状态(store)
│           └── workers/           # Web Worker(类型化消息协议)
├── packages/
│   ├── liquid-glass/              # ★ 可复用 React Liquid Glass 组件库(独立可发布)
│   │   └── src/                   # GlassSurface/GlassPanel/GlassButton/GlassCard… + 主题令牌 + 降级
│   └── ipc-contracts/            # 共享 zod schema + 反推类型(IPC 契约单一真相源)
├── crates/
│   └── dream-builder/            # Tauri/Rust 后端 ← 取代 backend/
│       ├── Cargo.toml
│       ├── build.rs
│       ├── tauri.conf.json
│       ├── capabilities/         # 权限能力定义(教学 ACL)
│       ├── icons/
│       ├── installer/            # NSIS 自定义模板与品牌资源
│       └── src/                  # 见 §4 模块划分
└── docs/
    ├── design/                   # 既有设计notes(保留)
    ├── superpowers/specs/        # 本设计文档
    └── teaching/                 # ★ 教学讲解文档(交付物 P5)
```

**为何这样达到"大一统"**:JS 生态无单文件等价 `pyproject.toml`,但 `pnpm-workspace.yaml` + 根 `package.json`(共享 devDeps/脚本)+ `tsconfig.base.json`(编译选项继承)+ `biome.json`(lint+format 合一)+ `vitest.workspace.ts` 构成 JS 侧统一真相源;`Cargo.toml [workspace]`(统一 profile/lints/依赖版本)构成 Rust 侧统一真相源;最外层 `justfile` 作为**跨语言唯一任务入口**,等效于一处配置调度全仓。

**迁移注意**:`frontend/`→`apps/desktop/`、`backend/`→`crates/dream-builder/` 为目录迁移;需同步更新 `tauri.conf.json` 的 `beforeDevCommand`/`beforeBuildCommand`/`frontendDist`、根脚本、`AGENTS.md`(项目文档,可改)。`agent-standards/` 不动。

---

## 3. 前端架构(React 19 + R3F)— P2/P3

### 3.1 渲染层(R3F 包裹 Three.js)

- `<Canvas>`(R3F)替代手写 `Renderer`;声明式组织场景:`<TreeMesh>`、`<LeafClusters>`(InstancedMesh)、`<Runes>`、`<Crystals>`、`<MagicParticles>`、`<Lighting>`、`<Effects>`(`@react-three/postprocessing` 的 Bloom)。
- `@react-three/drei` 提供 `OrbitControls`、`Environment` 等。
- 自定义 **GLSL 着色器材质**(`shaderMaterial`)用于水晶/叶片菲涅尔高光与流光 — 教学 shader 基础;与玻璃 UI 呼应。
- 交互:R3F 的 `onPointerOver/onClick` 替代手写 Raycaster,但**保留** `selectionState` 纯 reducer(经 `useReducer`/store 驱动),延续既有测试。
- `prefers-reduced-motion` 与逐帧 `useFrame` 配合。

### 3.2 状态管理

- 全局应用状态(种子、主题、动效偏好、状态文案、生成历史)用一个**类型安全 store**(默认 **Zustand**,小而现代,教学价值高;或退化为 Context+useReducer)。
- 选择/悬停沿用 `reduceSelectionState`(纯函数,已测)。
- 决策:采用 Zustand,并用 `selectionState` reducer 处理局部选择逻辑,展示"纯逻辑下沉 + 框架状态在边缘"。

### 3.3 IPC 桥接层(`ipc/`)

- 封装 `invoke` 与 `listen`,在边界用 `ipc-contracts` 的 zod schema 校验响应(`safeParse`),失败回退并告警。
- 用 **TS 标准装饰器(Stage 3)** `@measure`/`@logged` 装饰服务类方法(性能埋点/日志)— 教学装饰器与元编程。
- 轮询 → **Tauri 事件订阅**:后端通过 Channel/event 推送 `magic_field`,前端 `listen` 接收(替代 350ms 轮询),教学事件流。
- `AbortController` 取消、`Promise.all` 并行、无游离 promise。

### 3.4 Web Worker(`workers/`)

- 将确定性 fallback 生成 / 重计算下放 Worker;手写**类型化消息协议**(可辨识联合 + 请求/响应配对),不引 Comlink。教学 Worker、`structuredClone`、可转移对象。

### 3.5 TS 知识点矩阵(落点)

泛型与约束(EventBus/Worker 协议/store)、可辨识联合(IPC 消息/加载结果 `{source:'rust'|'fallback'}`)、类型守卫与 `unknown` 收窄(zod 边界)、`satisfies`、`as const`、映射/条件/工具类型(主题令牌、Pick/Readonly)、`never` 穷尽、品牌类型(`Seed`)、标准装饰器、模块与具名导出、严格 `null` 处理(`?.`/`??`)。

### 3.6 严格 TS 配置(`tsconfig.base.json`)

`strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `noImplicitOverride` + `verbatimModuleSyntax`,ESM,bundler 解析,目标 ES2022。

---

## 4. 后端架构(Rust + Tauri 2)— P1

### 4.1 模块划分(单文件 → 高内聚模块)

```
crates/dream-builder/src/
├── main.rs          # 仅引导:Builder + plugins + manage(state) + menu + tray + handler
├── lib.rs           # 库入口(暴露给 tests/ 集成测试与 doctest)
├── domain/
│   ├── mod.rs
│   ├── geometry.rs  # Vec3 + newtype:Seed/Energy/Hue(From/Into、运算符重载 Add/Mul)
│   ├── scene.rs     # TreeScene 等结构 + TreeSceneBuilder(builder 模式)
│   └── detail.rs    # DetailKind 枚举 + 穷尽 match
├── generation/
│   ├── mod.rs       # trait SceneGenerator(泛型 + 生命周期)+ 默认方法
│   ├── rng.rs       # trait Rng + SeededRng 实现(泛型约束 R: Rng)
│   └── fantasy_tree.rs # FantasyTreeGenerator: impl SceneGenerator
├── magic.rs         # 魔法场计算(纯函数)
├── state.rs         # AppState:Arc<Mutex<Inner>>(设置/历史/缓存)
├── events.rs        # 事件载荷类型 + 后台任务通过 Channel 推送 magic_field
├── commands.rs      # #[tauri::command]:含 async 命令、State 注入、Result<_,AppError>
├── persistence.rs   # store 插件读写设置(async + anyhow 上下文)
├── menu.rs          # 原生菜单 + 系统托盘 + 菜单事件分发
└── errors.rs        # thiserror 错误枚举 AppError(取代手写 CommandError)
```

### 4.2 命令演进

- `generate_tree(seed) -> Result<TreeScene, AppError>`:经 builder/generator;写入 State 历史 + 缓存。
- `detail_info(seed, id) -> Result<DetailInfo, AppError>`:错误用 thiserror 变体。
- `magic_field`:由轮询改为**后台 async 任务 + Channel 事件推送**(教学 async/事件);保留命令版作兜底。
- 新增:`load_settings`/`save_settings`(async,store 持久化)、`export_scene`(经 dialog 选路径 + fs 写)、`app_info`。

### 4.3 Tauri 能力矩阵(教学重点)

- 插件:`store`(设置持久化)、`dialog`(原生保存)、`fs`(写文件)、`opener`(打开目录/链接)、`log`(结构化日志)、`single-instance`(保留)。
- `capabilities/*.json`:为每个插件/命令声明最小权限(当前为空,是大缺口)— 教学 Tauri 2 ACL/权限模型。
- 菜单 + 托盘:重生成 / 重置视角 / 切换主题 / 退出。
- 窗口:可选第二个"设置/关于"窗口,教学多窗口管理(范围内可选)。
- 安全:`tauri.conf.json` 启用合理 **CSP**(当前为 null)。

### 4.4 Rust 知识点矩阵(落点)

模块/可见性、trait + 默认方法 + trait 约束、泛型、生命周期标注、`enum` + 穷尽 `match`、`Result`+`?`+thiserror(库)+anyhow(应用边界上下文)、`Option`/迭代器组合子、newtype + `From`/`Into` + 运算符重载、builder 模式、闭包与所有权/借用、`Arc<Mutex>` 共享状态、async/await + tokio + 不跨 `.await` 持锁、Channel/事件、checked/saturating 整数运算、`#[cfg(test)]` 单测 + `tests/` 集成 + doctest;`clippy -D warnings` 零告警。

---

## 5. iOS 26 Liquid Glass 组件库(`packages/liquid-glass`)— P3 重点

### 5.1 目标

一套**框架(React 19)级可复用**的液态玻璃组件 + 主题系统,样式达到标准 iOS 26 Liquid Glass 观感,且在性能与特效间取得平衡,带能力降级。

### 5.2 组件 API(初定)

- `GlassSurface`(底层原语:厚度/模糊/高光/折射强度可配)。
- `GlassPanel` / `GlassCard` / `GlassButton` / `GlassBadge` / `GlassSlider` / `GlassToggle`。
- `ThemeProvider` + CSS 变量令牌(blur、tint、specular、radius、refraction);`prefers-color-scheme` 明暗自适应。
- 受控/非受控、`forwardRef`、可组合 `className`、可访问性(focus 环、reduced-motion)。

### 5.3 视觉技术与性能权衡

- **基础玻璃**:多层 `backdrop-filter: blur() saturate()` + 半透明 tint + 内外高光(`box-shadow` inset + 顶部高光描边)+ squircle 圆角(连续曲率)。
- **折射感(高级)**:SVG `feTurbulence`+`feDisplacementMap` 滤镜制造边缘光线弯折;**仅在支持且未触发 reduced-motion 时启用**。
- **动态高光**:hover/active 时高光随指针位置流动(CSS 变量 + 指针坐标,节流;避免每帧重排)。
- **性能护栏**:限制同屏玻璃层数与模糊半径;`will-change`/合成层谨慎使用;`feDisplacementMap` 成本高,提供 `quality: 'high'|'balanced'|'low'` 档位与自动降级(检测 `backdrop-filter` 支持、低端设备)。
- **降级**:不支持 `backdrop-filter` → 退化为半透明纯色 + 边框;不支持位移滤镜 → 仅毛玻璃。

### 5.4 与 3D 的呼应

水晶/叶片 GLSL 菲涅尔高光与玻璃 UI 的高光语言统一,形成整体"液态光感"。

---

## 6. 构建、打包与安装向导 — P4

### 6.1 目标产物

安装目录下含 `dream-builder.exe` 入口 + WebView2 运行时依赖 + 全部前端资源,一个目录自包含;附带 NSIS 安装向导。

### 6.2 配置

- `tauri.conf.json`:规范 `productName`/`identifier`/`version`、`frontendDist` 指向 `apps/desktop/dist`、启用 CSP、bundle 资源、图标。
- NSIS 定制:自定义模板/`installerHooks`,提供**欢迎 → 许可协议 → 安装路径选择 → 组件(可选)→ 安装进度 → 完成(可勾选启动)**,配品牌横幅/侧图;`installMode`(perMachine vs currentUser)讲解差异;语言含简体中文。
- 语义化版本 + `CHANGELOG.md`。

### 6.3 构建命令(可复现)

经 `justfile`/根脚本统一:`just build`(前端 tsc+vite)、`just bundle`(`tauri build` → NSIS)。说明 MSVC/x64 Native Tools 前置;实际 `tauri build` 可能需用户在本机工具链环境执行,提供可复现命令与排错说明。

---

## 7. 教学文档 — P5

`docs/teaching/` 下:一份中文主文档(总览 + 知识点地图)+ 分章(Tauri 篇 / Rust 篇 / TypeScript+React 篇 / 3D+Shader 篇 / 工程化与打包篇)。每个知识点给出:**是什么 / 为什么这样用 / 代码在哪(`file:line`)/ 常见陷阱**,并与 `agent-standards` 语言规范对照。

---

## 8. 测试与质量门禁

- 遵循测试金字塔:大量单元(Rust `#[cfg(test)]` / Vitest)、少量集成(Rust `tests/`、React 组件测试)、极少 e2e。
- 保留并扩展既有不变量:确定性生成、计数边界、detail 校验、magic 有限性;前端 reducer/校验/fallback/IPC 测试迁移到 React 后继续有效。
- Liquid Glass 组件:渲染/可访问性/降级分支测试(Vitest + Testing Library,jsdom 仅用于组件库包,主 app 测试仍可 node 环境)。
- 统一门禁(`just check`):`fmt → lint(biome/clippy) → typecheck(tsc) → test(vitest+cargo test) → build`。
- 决策记录:重大/难回退决策写贴近代码的简短 ADR(`docs/teaching/adr/` 或 `docs/adr/`)。

---

## 9. 推进计划(连续推进,阶段内保持可运行)

P0 工程基线与 monorepo 骨架 → P1 Rust 后端纵深 → P2 React/R3F 前端迁移与纵深 → P3 Liquid Glass 组件库 + 3D 精致化 → P4 打包与 NSIS 向导 → P5 教学文档。全部完成后统一 review。每阶段结束保证可构建、测试通过、可 dev 运行。

> 注:详细分步实现计划将在 brainstorming 之后由 writing-plans 产出。

---

## 10. 风险与边界

1. **工作量大 / 大重构**:全 React + R3F + monorepo 迁移是大改动;以阶段化推进 + 每阶段可运行降低风险。
2. **R3F 与 React 19 版本兼容**:需选用兼容 React 19 的 R3F(v9.x)及生态;锁定版本。
3. **Liquid Glass 性能**:位移折射滤镜成本高,提供质量档位与自动降级,守住性能基线。
4. **WebView2/Chromium 兼容**:高级 CSS/滤镜按支持度降级。
5. **打包依赖本机工具链**:`tauri build` 需 MSVC/SDK;提供可复现命令,实际打包可能需用户本机执行。
6. **教学密度 vs 简洁**:在用户"最大知识覆盖"目标下允许适度密度,但每个概念挂靠真实功能,不做无意义包装。
7. **不改动 `agent-standards/`**;遵循其规范。
8. **git 未初始化**:本仓当前非 git 仓库,设计文档无法 commit;如需版本控制可后续 `git init`。

---

## 11. 待评审

请评审本文档。确认后将进入 writing-plans 产出详细实现计划,随后按 P0→P5 连续推进。
