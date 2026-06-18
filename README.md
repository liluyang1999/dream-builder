# Dream Builder Fantasy Tree

一个 Tauri 2 + Rust + Vite + TypeScript + Three.js 的桌面 3D 奇幻树项目。前端负责 WebGL 渲染、鼠标交互、粒子和 UI；后端 Rust 负责确定性生成树木结构、交互细节和魔法场数据。

> 本仓库正在进行「教学级改造」（pnpm + Cargo 双 workspace 单仓、React 19 + react-three-fiber 前端、iOS 26 液态玻璃 UI、安装向导与教学文档）。规格与实现计划见 `docs/superpowers/`。

## 目录结构

pnpm workspace（前端）+ Cargo workspace（Rust）单仓：

```
dream-builder/
├── apps/desktop/        # Vite + TypeScript + Three.js（包名 @dream-builder/desktop）
├── packages/            # 可复用 TS 包（ipc-contracts、liquid-glass，将在 P2/P3 加入）
├── crates/dream-builder/# Rust + Tauri 2
├── docs/                # design / superpowers（规格+计划）/ teaching
├── package.json         # 根 orchestrator（统一脚本入口）
├── Cargo.toml           # Cargo workspace
├── justfile             # 跨语言统一任务入口
└── AGENTS.md            # 给所有编码代理的项目说明
```

## 环境要求

Node 24、pnpm 11、Rust 工具链（含 MSVC，用于 Windows 打包）。

## 安装与开发

```powershell
pnpm install            # 安装全部工作区依赖
pnpm dev                # http://127.0.0.1:1420（浏览器开发，无原生外壳）
pnpm tauri dev          # 完整 Tauri 原生外壳
```

## 测试、检查与构建

```powershell
pnpm test               # Vitest 全工作区
pnpm typecheck          # tsc --noEmit 全部 TS 包
pnpm lint               # biome check
pnpm build              # tsc 类型检查 + vite build → apps/desktop/dist
cargo test              # Rust 工作区测试
cargo clippy -- -D warnings
pnpm check              # lint + typecheck + test + build 一站式门禁
```

安装 [`just`](https://github.com/casey/just) 后可用 `just check` / `just tauri-dev` / `just bundle` 包裹同样的命令。

## 打包 Windows exe

安装 Rust、Cargo 和 Visual Studio C++ Build Tools 后执行：

```powershell
pnpm tauri build
```

入口程序为 `target/release/dream-builder.exe`，单一 NSIS 安装包输出到 `target/release/bundle/nsis/`。

如果普通 PowerShell 找不到 MSVC 链接器，可以在 x64 Native Tools 环境中运行，或临时补齐本机 MSVC/Windows SDK 环境变量后执行 Tauri 构建。
