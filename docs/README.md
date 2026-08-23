# 《智慧树之森》全栈教学档案

本目录只放**教学内容**：本项目实际用到的每一项技术框架、每一个相关概念，以及它们在源码中的落点。
全部以 HTML 呈现，共十五页，共享一份 [`assets/learn.css`](assets/learn.css)。

> GitHub 不渲染 HTML，所以在网页上浏览仓库时看到的是这一页。
> 要真正阅读档案，克隆仓库后用浏览器打开 [`docs/index.html`](index.html)，
> 或直接以 `file://` 打开任意一页——每一页都能独立打开、搜索和打印，且无任何远程依赖。

工程记录（产品口径、进展、验收证据、历史设计）不在本目录，在 [`loop/`](../loop/README.md)。

## 阅读顺序

| # | 页面 | 内容 |
|---|---|---|
| — | [`index.html`](index.html) | 总入口：阅读方式、专题导航与七段学习路线 |
| 01 | [`overview.html`](overview.html) | 项目现状、总体架构、单仓工程与运行全链路 |
| 02 | [`frontend.html`](frontend.html) | 严格 TypeScript、React 19 分层、状态与存档 |
| 03 | [`graphics.html`](graphics.html) | Three.js、react-three-fiber、着色器与程序化音频 |
| 04 | [`accessibility.html`](accessibility.html) | 无障碍设置契约、键鼠/手柄事件模型与焦点管理 |
| 05 | [`performance.html`](performance.html) | 有界指标记录器与可复核的性能证据链 |
| 06 | [`ipc.html`](ipc.html) | Rust ⇄ 前端 IPC 契约与 Web Worker 边界 |
| 07 | [`rust.html`](rust.html) | 领域模型、trait 接缝、错误处理、持久化与确定性生成 |
| 08 | [`tauri.html`](tauri.html) | Tauri 2 外壳、插件、路径基准与 WebView2 Evergreen 策略 |
| 09 | [`security.html`](security.html) | Capability/ACL、CSP、边界校验与依赖供应链 |
| 10 | [`build.html`](build.html) | Vite/Rollup 分块预算、`build.rs` 版本资源与两段式版本 |
| 11 | [`quality.html`](quality.html) | 九阶段质量门禁与持续集成 |
| 12 | [`release.html`](release.html) | Windows 打包、源码指纹、签名与安装卸载合同 |
| 13 | [`code-map.html`](code-map.html) | 覆盖每一个源码模块的完整索引 |
| 14 | [`glossary.html`](glossary.html) | 跨栈术语速查 |

## 覆盖的技术与概念

- **桌面外壳**：Tauri 2、Wry、Windows WebView2 Evergreen、NSIS、单实例、Mica、托盘与菜单
- **前端**：TypeScript 严格模式、React 19、Hooks 职责边界、错误边界、Zustand、标准装饰器
- **3D 与音频**：Three.js、react-three-fiber、drei、postprocessing、实例化、Fresnel/GLSL、Web Audio
- **跨边界**：Tauri IPC 命令与事件、Zod 运行时契约、serde wire 格式、Web Worker 协议
- **Rust**：所有权与借用、newtype 不变量、trait 与泛型接缝、`thiserror`、`Arc<Mutex<T>>`、tokio、确定性 RNG
- **无障碍**：设置契约、`prefers-reduced-motion`、焦点陷阱、Gamepad 轮询与边沿检测
- **工程**：pnpm workspace、Cargo workspace、Vite/esbuild/Rollup、`build.rs`、Biome、Vitest、GitHub Actions
- **交付**：两段式产品版本、源码树指纹、SHA-256 清单、Authenticode、安装与卸载合同

## 档案的自我约束

- **自包含**：无远程脚本、字体或样式，离线可读、可打印、可随仓库归档。
- **可验证**：`pnpm docs:verify` 检查每页结构、页面可达性、锚点、本地链接，
  并枚举真实源码树，确认每一个源码模块都在 [`code-map.html`](code-map.html) 中有说明。
- **描述现状**：所有结论描述当前仓库的实际实现，不是理想化示例；
  未通过的人工门槛在档案中保持可见，不被自动化结果掩盖。
