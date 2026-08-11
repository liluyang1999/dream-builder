# Dream Builder 文档目录

《智慧树之森》的全部文档都在这里。本文件只是索引：它负责把你送到正确的位置，
不重复任何教学或产品内容。

> GitHub 不会渲染 `index.html`，因此浏览仓库时先看到的是这一页。
> 教学档案需要下载后用浏览器打开，或在本地直接打开 `docs/index.html`。

## 三个入口，各自负责一件事

| 位置 | 回答什么问题 | 什么时候看 |
|---|---|---|
| [`index.html`](index.html) | 技术为什么这样组织？某个概念的代码在哪里？ | 学习这个项目、或改动前想弄清边界 |
| [`game/`](game/README.md) | 产品要做什么？验收到了哪一步？ | 决定做什么、判断能不能宣称完成 |
| [`design/`](design/README.md) | 早期是怎么设想的？ | 只在追溯历史演进时 |

## 全栈教学档案 · [`index.html`](index.html)

一份自包含的中文 HTML 档案，覆盖本项目实际用到的全部技术框架与概念：
Tauri 2、WebView2、TypeScript、React 19、react-three-fiber、Three.js、Zustand、Zod、
Rust、IPC、无障碍与输入设备、性能证据、安全边界、构建工具链、质量门禁、持续集成、
Windows 发布，以及一份覆盖每个源码模块的索引。

无远程脚本、字体或样式依赖，可离线打开、搜索和打印。共 23 个章节，含术语表与学习路线。

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

2026-04 的早期设计札记与技术演示海报，只用于追溯视觉与产品演进，不表达当前口径。

## 目录合同

- 教学内容只放在 `index.html`，不在别处另起一份说明。
- `game/` 描述产品意图与验收状态；未通过的人工门槛必须保持可见，不能被自动化结果掩盖。
- `evidence/` 只追加，不改写；旧证据中的历史数值保持原样。
- `design/` 只读。

`pnpm docs:verify` 会检查教学档案的结构、章节可达性、锚点、本地链接、源码模块覆盖，
以及本目录中每个 Markdown 文件的相对链接是否仍然有效。
