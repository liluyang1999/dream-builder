# Dream Builder 教学讲解文档

这是一份围绕 **Dream Builder 智慧树** 项目的全栈教学文档。项目本身是一个由
**Tauri 2 + Rust + React 19 + react-three-fiber** 打造的本地原生 3D 互动桌面程序——
一棵程序化生成、可交互的奇幻智慧树。它被刻意设计成一个“知识点载体”:每一处技术选择都
对应一类可独立讲解的概念。

> 阅读方式:每章按「**是什么 / 为什么这样用 / 代码在哪 / 常见陷阱**」组织。代码位置用
> `路径::符号` 标注(例如 `crates/dream-builder/src/generation/rng.rs::Rng`),以便你边读边
> 跳转。建议配合源码阅读。

## 项目鸟瞰

```
dream-builder/                     # pnpm workspace + Cargo workspace 单仓
├── apps/desktop/                  # 前端:React 19 + R3F + Zustand(包 @dream-builder/desktop)
├── packages/ipc-contracts/        # 共享:zod 定义的 IPC 契约(前后端单一真相源)
├── packages/liquid-glass/         # 可复用:iOS 26 液态玻璃 React 组件库
├── crates/dream-builder/          # 后端:Rust + Tauri 2(确定性生成 + 命令/事件/状态)
└── docs/teaching/                 # 你正在读的文档
```

两进程模型:Rust 后端确定性地生成树的几何、细节元数据与时变“魔法场”,通过 Tauri 命令/
事件暴露;前端在 WebView2 中用 WebGL 渲染并交互。前端还能在**没有后端**时(纯浏览器)优雅
降级——这条“双轨”正是讲解边界、契约与容错的好素材。

## 知识点地图

| 章节 | 主题 | 覆盖的核心知识点 |
|---|---|---|
| [01 工程化](./01-engineering.md) | monorepo 与现代工程范式 | workspace、统一配置、测试金字塔、质量门禁、语义化版本、ADR |
| [02 Rust](./02-rust.md) | Rust 语言与 OOP 技巧 | 模块系统、trait/泛型/生命周期、枚举与穷尽匹配、`Result`/`?`/thiserror/anyhow、newtype、builder、迭代器组合子、`Arc<Mutex>`、async/tokio、测试 |
| [03 Tauri](./03-tauri.md) | Tauri 2 桌面框架 | 命令、托管状态 `State`、事件、插件、能力/权限(ACL)、菜单/托盘、窗口、CSP、IPC 序列化、打包 |
| [04 TS + React](./04-typescript-react.md) | TypeScript 纵深与 React 19 | strict 类型、泛型、可辨识联合、类型守卫与 zod、标准装饰器、工具类型、Web Worker;hooks、R3F、Zustand |
| [05 3D 与着色器](./05-3d-shaders.md) | 实时图形 | Three.js/R3F 管线、材质与实例化、后期 Bloom、GLSL 菲涅尔着色器、液态玻璃 CSS 技术 |
| [06 规范对照](./06-standards-map.md) | 与 `agent-standards` 的对应 | 把工程基线/语言规范落到具体代码 |

## 如何运行与验证

```bash
pnpm install         # 安装工作区依赖
pnpm dev             # 浏览器开发(无原生外壳,走前端回退)
pnpm tauri dev       # 完整 Tauri 原生外壳
pnpm check           # lint + typecheck + test + build 一站式门禁
cargo test           # Rust 测试
pnpm tauri build     # 产出 EXE + NSIS 安装包
```

## 一条请求的全链路(把各章串起来)

1. 用户在 HUD 输入种子并提交 → `apps/desktop/src/ui/SeedForm.tsx` 调 store 的 `setSeed`
   (第 04 章:React 受控表单 + Zustand)。
2. `apps/desktop/src/App.tsx` 的副作用监听 `seed` 变化,调用 IPC 客户端
   `treeApi.loadScene`(第 04 章:effect、装饰器、zod 边界校验)。
3. 在 Tauri 中,`invoke('generate_tree')` 进入 Rust 命令
   `crates/dream-builder/src/commands.rs::generate_tree`(第 03 章:命令 + `State`)。
4. 命令委托给 `generation::FantasyTreeGenerator`(第 02 章:trait/泛型/builder/确定性 RNG),
   结果按 camelCase 序列化回前端(第 03 章:serde 契约)。
5. 前端用 zod 校验后交给 R3F 场景渲染(第 05 章:R3F/材质/着色器),HUD 用液态玻璃组件展示
   (第 05 章:玻璃 CSS)。
6. 后台 `tokio` 任务周期性 `emit` 魔法场事件,前端 `listen` 后驱动粒子(第 03 章:事件;第 02 章:async)。
