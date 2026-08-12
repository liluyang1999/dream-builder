# Dream Builder Fantasy Tree

《智慧树之森》是一款单人离线第三人称卡通森林游戏。玩家作为能听见森林记忆的小小守林人，
探索中央林地、蘑菇坡、溪流与遗迹，收集三枚光种并完成方向净化，让失色的智慧树和周围生态重新发光。

当前产品版本为 **1.0**。标题—探索—净化—章节结尾闭环、自动存档与损坏恢复、键鼠与标准手柄、
音频、画质与无障碍设置、截图/场景导出、单实例及 Windows 安装工程均已实现。目标设备的原生十分钟
性能报告和当前用户安装—首次启动—卸载闭环已有归档；五名首次接触玩家观察、实体手柄完整听测、
干净账户覆盖升级和受信任代码签名仍是正式发布前的外部门槛。

- [完整中文全栈教学档案](docs/learn/index.html)（十五页专题 HTML，克隆后用浏览器打开）
- [文档目录索引](docs/README.md)
- [游戏愿景、当前状态与里程碑](docs/game/README.md)
- [Windows 交付与恢复手册](docs/game/release-runbook.md)

## 技术栈

- 桌面：Tauri 2、Rust 2024、Windows WebView2、NSIS
- 前端：React 19、TypeScript、Vite、Zustand
- 3D：Three.js、react-three-fiber、drei、postprocessing
- 边界：Zod IPC 契约、Rust 确定性生成、Web Worker 浏览器回退
- UI：工作区内可复用的 `@dream-builder/liquid-glass` 组件包

## Windows WebView2

Windows 安装版由 Tauri/Wry 创建 WebView2 原生窗口；React 前端不直接实例化或调用
CoreWebView2。安装器显式使用 `downloadBootstrapper` 的 **WebView2 Evergreen** 策略，但不固定
Runtime 版本：系统已有运行时就直接使用，缺失时由 Microsoft 引导安装，之后随 Evergreen 通道保持
安全更新。不同机器的 WebView2 补丁版本不要求完全相同，受支持行为由真实 Tauri 回归测试保证。

`pnpm dev` 只是浏览器开发模式，使用你打开页面的浏览器和 Web Worker 回退；只有
`pnpm tauri dev`、Tauri 构建产物及安装版使用 WebView2 和 Rust IPC。

## 仓库结构

```text
dream-builder/
├── apps/desktop/          # React + R3F 桌面前端与浏览器回退
├── packages/
│   ├── ipc-contracts/     # Rust/前端边界的 Zod 运行时契约
│   └── liquid-glass/      # 可复用玻璃主题组件
├── crates/dream-builder/  # Rust 领域、生成、状态、事件与 Tauri 外壳
├── docs/
│   ├── README.md          # 文档目录索引
│   ├── learn/             # 唯一的中文教学档案：十五页专题 HTML
│   ├── game/              # 当前产品方向、验收证据与交付手册
│   └── design/            # 历史设计札记，仅供追溯
├── scripts/               # 版本、安全、教学档案、依赖布局与发布验证
└── version.json           # 唯一的两段式公开版本源
```

## 环境与 pnpm 数据位置

需要 Node 24、pnpm 11 和 Rust 工具链。Windows 原生打包还需要 MSVC Build Tools。

pnpm 是本项目唯一的前端包管理器。内容寻址仓库、元数据缓存和虚拟依赖树分别固定在仓库根目录下：

- `.pnpm-store/`
- `.pnpm-cache/`
- `node_modules/.pnpm/`

本项目不会把 pnpm 依赖缓存写到磁盘根目录，也禁用用户级全局虚拟仓库。`pnpm pnpm:verify-layout`
会解析绝对路径独立校验，并已纳入完整门禁。

```powershell
pnpm install
pnpm dev          # 浏览器回退：http://127.0.0.1:1420
pnpm tauri dev    # 完整 Rust + Tauri + WebView2 桌面模式
```

M2 主持人证据工作台使用 `http://127.0.0.1:1420/?tool=m2-evidence`。它不出现在玩家 HUD，
只在本机汇总匿名五人观察与原生十分钟性能 JSON；协议见 [M2 无提示观察](docs/game/m2-playtest.md)。

## 版本规则

对玩家、文档、发布目录和交付文件只使用两段式版本 `主版本.功能版本`。当前版本从
**1.0** 开始；后续大版本增加第一段并把第二段归零，小版本增加第二段。npm、Cargo 与
Tauri 的机器清单必须满足各自的 SemVer 语法，因此构建时会从公开版本机械派生兼容值，
但该值不得再出现在游戏界面、Windows“已安装的应用”、EXE 版本字符串、发布清单或资料中。

根 [version.json](version.json) 是唯一真相源，`pnpm version:verify` 会核对所有工作区清单、
Cargo、Tauri、WebView2 策略和该映射。历史证据 JSON 中记录的旧技术版本保持原样。

## 质量门禁

```powershell
pnpm check
cargo fmt --check
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo check --workspace --all-targets --locked
```

`pnpm check` 依次验证版本/WebView2、桌面 CSP 与最小权限、教学 HTML、本地 pnpm 布局、
归档 M2 性能证据、Biome、TypeScript、Vitest、Vite 生产构建和 bundle 预算。GitHub Actions
在 Windows 上执行同一组前端与 Rust 门禁；可单独运行 `pnpm desktop:verify-security` 复核桌面边界。

## Windows 构建与发布候选

```powershell
pnpm tauri build
pnpm release:build
pnpm release:verify
```

Tauri 原始入口为 `target/release/dream-builder.exe`，NSIS 安装包位于
`target/release/bundle/nsis/`。发布脚本会把玩家可读的交付文件组装到
`output/release/1.0/`，并重新验证精确文件集、两段式产品版本、来源提交、源码树 SHA-256、
文件哈希、许可/手册副本和 Authenticode 状态。

未签名文件只能称为候选版。生产分发必须从干净提交运行 `pnpm release:build:signed`，使用
当前用户证书库中的有效受信任代码签名证书和时间戳服务；详细回滚、升级、安装与卸载步骤见
[交付手册](docs/game/release-runbook.md)。
