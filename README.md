# Dream Builder Fantasy Tree

一个 Tauri 2 + Rust + Vite + TypeScript + Three.js 的桌面 3D 奇幻树项目。前端负责 WebGL 渲染、鼠标交互、粒子和 UI；后端 Rust 负责确定性生成树木结构、交互细节和魔法场数据。

## 目录结构

```
dream-builder/
├── frontend/          # Vite + TypeScript + Three.js
├── backend/           # Rust + Tauri 2
├── docs/design/       # 设计与规划文档
├── package.json       # 根 orchestrator（dev/build/test/tauri 命令转发）
└── AGENTS.md          # 给所有编码代理（Claude / Codex / Cursor）的项目说明
```

## 安装与开发

```powershell
npm.cmd install         # 同时安装根与 frontend 依赖（postinstall 钩子）
npm.cmd run dev         # http://127.0.0.1:1420
```

## 测试与构建

```powershell
npm.cmd test -- --run
npm.cmd run build
cargo test --manifest-path backend/Cargo.toml
```

## 打包 Windows exe

安装 Rust、Cargo 和 Visual Studio C++ Build Tools 后执行：

```powershell
npm.cmd run tauri -- build
```

入口程序为 `backend/target/release/dream-builder.exe`，单一 NSIS 安装包输出到 `backend/target/release/bundle/nsis/Dream Builder Fantasy Tree_0.1.0_x64-setup.exe`。

如果普通 PowerShell 找不到 MSVC 链接器，可以在 x64 Native Tools 环境中运行，或临时补齐本机 MSVC/Windows SDK 环境变量后执行 Tauri 构建。
