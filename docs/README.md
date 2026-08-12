# Dream Builder 文档目录

《智慧树之森》的全部文档都在这里。本文件只是索引：它负责把你送到正确的位置，
不重复任何教学或产品内容。

## 三个子目录，各自负责一件事

| 位置 | 回答什么问题 | 什么时候看 |
|---|---|---|
| [`learn/`](learn/index.html) | 技术为什么这样组织？某个概念的代码在哪里？ | 学习这个项目、或改动前想弄清边界 |
| [`game/`](game/README.md) | 产品要做什么？验收到了哪一步？ | 决定做什么、判断能不能宣称完成 |
| [`design/`](design/README.md) | 早期是怎么设想的？ | 只在追溯历史演进时 |

## 教学档案 · [`learn/`](learn/index.html)

本项目涉及的全部技术框架与概念，按专题拆成十五页 HTML。
GitHub 不渲染 HTML，因此需要克隆仓库后在浏览器中打开 `docs/learn/index.html`，
或用 `file://` 直接打开任意一页——每一页都能独立打开、搜索和打印。

| 页面 | 内容 |
|---|---|
| [`index.html`](learn/index.html) | 总入口：阅读方式、专题导航与七段学习路线 |
| [`overview.html`](learn/overview.html) | 项目现状、总体架构、单仓工程与运行全链路 |
| [`frontend.html`](learn/frontend.html) | 严格 TypeScript、React 19 分层、状态与存档 |
| [`graphics.html`](learn/graphics.html) | Three.js、react-three-fiber、着色器与程序化音频 |
| [`accessibility.html`](learn/accessibility.html) | 无障碍设置契约、键鼠/手柄事件模型与焦点管理 |
| [`performance.html`](learn/performance.html) | 有界指标记录器与可复核的性能证据链 |
| [`ipc.html`](learn/ipc.html) | Rust ⇄ 前端 IPC 契约与 Web Worker 边界 |
| [`rust.html`](learn/rust.html) | 领域模型、trait 接缝、错误处理、持久化与确定性生成 |
| [`tauri.html`](learn/tauri.html) | Tauri 2 外壳、插件、路径基准与 WebView2 Evergreen 策略 |
| [`security.html`](learn/security.html) | Capability/ACL、CSP、边界校验与依赖供应链 |
| [`build.html`](learn/build.html) | Vite/Rollup 分块预算、`build.rs` 版本资源与两段式版本 |
| [`quality.html`](learn/quality.html) | 九阶段质量门禁与持续集成 |
| [`release.html`](learn/release.html) | Windows 打包、源码指纹、签名与安装卸载合同 |
| [`code-map.html`](learn/code-map.html) | 覆盖每一个源码模块的完整索引 |
| [`glossary.html`](learn/glossary.html) | 跨栈术语速查 |

## 产品真相源 · [`game/`](game/README.md)

| 文件 | 内容 |
|---|---|
| [`game/README.md`](game/README.md) | 愿景、当前全貌、产品支柱、核心循环、里程碑与完成定义 |
| [`game/release-1.0.md`](game/release-1.0.md) | 成品范围、不可妥协的发布条件与模块验收矩阵 |
| [`game/vertical-slice.md`](game/vertical-slice.md) | 十分钟体验脚本与 M1/M2 系统合同 |
| [`game/m2-playtest.md`](game/m2-playtest.md) | 五名首次接触玩家的无提示观察协议 |
| [`game/release-runbook.md`](game/release-runbook.md) | Windows 构建、签名、安装、升级、卸载与回滚手册 |
| [`game/evidence/`](game/evidence/README.md) | 归档的原始测量与生命周期证据，按记录时间不可改写 |

## 历史资料 · [`design/`](design/README.md)

2026-04 的早期设计札记，只用于追溯产品演进，不表达当前口径。

## 目录合同

- 教学内容只放在 `learn/`，其他位置不另起一份说明。
- `game/` 描述产品意图与验收状态；未通过的人工门槛必须保持可见，不能被自动化结果掩盖。
- `evidence/` 只追加，不改写；旧证据中的历史数值保持原样。
- `design/` 只读。

`pnpm docs:verify` 会检查教学档案每一页的结构、页面可达性、锚点、本地链接、源码模块覆盖，
以及本目录中每个 Markdown 文件的相对链接是否仍然有效。
