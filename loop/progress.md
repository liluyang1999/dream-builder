# 进展记录

本页是**当前状态的唯一可写位置**。任何影响范围、验收状态或门禁的改动都必须同步这里。
判定规则见 [`concepts.md`](concepts.md)：自动化门禁与外部人工门槛永远分开记账。

- 记录更新时间：2026-10-21
- 产品版本：1.0（两段式 `主版本.功能版本`，真相源 [`version.json`](../version.json)）
- 交付形态：Windows x64 单人离线第三人称卡通森林游戏，NSIS 安装包 + 便携 EXE

## 一、里程碑状态

| 阶段 | 交付结果 | 状态 | 依据 |
|---|---|---|---|
| M0 稳定基线 | 开发/生产可启动、前后端 seed 一致、CI 可复现 | **已闭合** | 全部 TS/Rust 门禁 + CI 配置入库 |
| M1 能走的森林 | 玩家、第三人称相机、统一输入、碰撞、灰盒林地 | **已闭合** | 运动/碰撞纯逻辑测试 + 真实运行 |
| M2 可玩的循环 | 光种、净化、成长反馈、目标 HUD、会话进度 | **技术闭合，验收未闭合** | 状态机测试与目标设备性能报告已归档；五人无提示观察未完成 |
| M3 美术垂直切片 | 卡通材质、植被层次、氛围、音频与动效 | **技术闭合** | 1.0 美术层与稳态性能报告已归档 |
| M4 首章内容 | 三条支路、记忆叙事、引导、设置与可访问性 | **技术闭合** | 组件测试 + 存档迁移/损坏恢复测试 |
| M5 可发布版本 | 性能、崩溃恢复、签名/安装/升级、发行素材 | **部分闭合** | 安装—首次启动—卸载闭环已归档；签名与覆盖升级未完成 |

> M2 尚未整体通过。按 [`product/README.md`](product/README.md) 的定义，
> 只有行为、测试与真实运行证据同时通过，阶段才能标为完成；因此 M2 及其之后的里程碑
> **不得**被写成正式通过。

## 二、已闭合的事实

| 事实 | 证据 |
|---|---|
| 历史构建的目标设备十分钟原生性能达标 | [`evidence/2026-07-23T15-28-24Z-m2-performance-tauri.json`](evidence/2026-07-23T15-28-24Z-m2-performance-tauri.json)，覆盖 `scene-load` 与 `cleansing` |
| 历史构建的复苏场景稳态性能 | [`evidence/2026-07-26T07-41-32Z-release-1.0-steady-state-tauri.json`](evidence/2026-07-26T07-41-32Z-release-1.0-steady-state-tauri.json) |
| 历史候选的当前用户安装—首次启动—单实例—退出—卸载闭环 | [`evidence/2026-08-10-release-1.0-lifecycle.md`](evidence/2026-08-10-release-1.0-lifecycle.md)，仅绑定其中记录的提交与 EXE/安装器 SHA-256 |
| 证据身份可复算 | `pnpm m2:verify` 复算报告哈希、时长、来源、阶段与帧率预算 |
| 产物精确文件集与来源指纹 | `pnpm release:verify` |
| 桌面最小权限与 CSP | `pnpm desktop:verify-security` |
| 教学档案覆盖全部源码模块 | `pnpm docs:verify` 枚举真实源码树，只认可 `docs/code-map.html` 中的完整清单 |
| UI、渲染、IPC 与导出复盘 | [`evidence/2026-09-05-ui-runtime-quality-review.md`](evidence/2026-09-05-ui-runtime-quality-review.md)：真实浏览器与隔离 Tauri 验证、失败回归和测试清理 |
| 发布文档、依赖与磁盘复盘 | [`evidence/2026-09-28-maintenance-review.md`](evidence/2026-09-28-maintenance-review.md)：发布路径失败回归、全量门禁、真实 UI/原生验证与首次缓存清理 |
| 原生持久化、并发状态与安装交付 | [`evidence/2026-10-21-engineering-delivery-review.md`](evidence/2026-10-21-engineering-delivery-review.md)：完整构建、安装版与便携版真实运行、同版重装、降级拒绝、卸载及原设置恢复 |

历史性能与安装记录继续有效地描述当时的构建，不能当成当前候选的新测量。
最终发行候选仍需重新绑定原生性能及受影响的安装/升级证据。

## 三、未闭合的外部门槛

这五项**只能由人在真实环境完成**，自动化不能替代。在它们全部关闭之前，不得宣称生产发布完成。

| 门槛 | 现状 | 关闭方式 |
|---|---|---|
| 五名首次接触玩家的无提示观察 | 未开始 | 按 [`product/m2-playtest.md`](product/m2-playtest.md) 执行，用 `?tool=m2-evidence` 汇总 |
| 实体手柄全流程听测 | 未完成 | 真实手柄跑完标题到章节结尾 |
| 干净 Windows 账户安装与完整章节 | 未完成 | 全新账户安装后完整通关 |
| 覆盖升级与回滚 | 未完成 | 按 [`product/release-runbook.md`](product/release-runbook.md) 演练 |
| 受信任代码签名 | 阻塞 | 当前用户证书库缺少可用代码签名私钥证书；SignTool 已就位，证书补齐后运行 `pnpm release:build:signed` |

## 四、当前门禁基线

以下为最近一次完整验证的结果，作为回归对照。任何一项下降都应视为回归而非新常态。

| 门禁 | 结果 |
|---|---|
| `pnpm check` | 十一阶段全部通过，包含工程脚本回归 |
| Vitest | 44 个测试文件、180 项测试通过 |
| 工程脚本 | 44 项通过：清理 18、发布目录 12、安装状态 9、来源指纹 5 |
| NSIS 原生版本比较 | 16 项真实编译/执行测试通过；不替代跨产品版本升级演练 |
| 测试工具依赖 | Vite 6.4.4、undici 8.10.2、source-map-js 1.2.2；`pnpm audit --audit-level low` 未发现已知 npm 公告 |
| `cargo test --workspace --locked` | 46 项通过（42 单元 + 4 跨边界） |
| `cargo clippy --workspace --all-targets --locked -- -D warnings` | 无告警 |
| `cargo fmt --check` | 通过 |
| `cargo doc --workspace --no-deps --locked` | `RUSTDOCFLAGS=-D warnings` 下通过，已加入 CI |
| 教学档案 | 15 页、100/100 源码模块覆盖、全部链接可解析；Edge 桌面/窄屏 30 项布局检查通过 |
| 发布手册路径 | 构建与验证脚本均指向 `loop/product/release-runbook.md`；两处旧路径均经失败回归确认 |
| 发布 PowerShell 宿主 | [模块路径继承问题](evidence/2026-09-28-release-host-compatibility.md)已做最小失败/成功对照；两份脚本显式加载宿主自带的安全模块 |
| 前端分块预算 | `three-engine` 687,920 / 700,000 字节，首屏不预加载 3D 块 |

## 五、结构约定（2026-08-23 起）

| 目录 | 职责 | 读者 |
|---|---|---|
| [`docs/`](../docs/index.html) | 教学：技术概念、原理与源码地图，十五页 HTML | 人 |
| `loop/` | 工程：产品口径、进展、证据与历史 | AGENT 与维护者 |

教学内容不再放在 `loop/`，工程记录也不再放进 `docs/`。两条门禁分别守住各自的完整性。

## 六、依赖维护跟进

2026-10-21 通过 OSV 对 Cargo.lock 的 479 个 registry 包逐一查询，发现 10 个带 RustSec
信息公告的包（9 项停止维护、1 项不健全 API），[原始结果](evidence/2026-10-21-dependency-audit.json)
已归档，不能写成“Rust 审计零发现”：

- `glib 0.18.5` 的 [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html)
  为潜在不健全 API；`proc-macro-error 1.0.4` 的
  [RUSTSEC-2024-0370](https://rustsec.org/advisories/RUSTSEC-2024-0370.html) 为停止维护。
  `cargo tree --locked --target x86_64-pc-windows-msvc -i` 确认两者不在当前 Windows 依赖树中。
- Windows 依赖链中的 `urlpattern 0.3.0 → tauri-utils 2.9.3 → Tauri` 使用五个停止维护的
  `unic-* 0.9.0` 包：RUSTSEC-2025-0075 / 0080 / 0081 / 0098 / 0100。
  公告没有提供这些包的修复版本；应跟进上游替换并完成 Tauri 平台回归，不用强制改锁文件掩盖它们。
- `zbus_names 4.3.4`、`zvariant 5.13.1`、`zvariant_derive 5.13.1` 分别对应
  [RUSTSEC-2026-0371](https://rustsec.org/advisories/RUSTSEC-2026-0371.html)、
  [RUSTSEC-2026-0370](https://rustsec.org/advisories/RUSTSEC-2026-0370.html)、
  [RUSTSEC-2026-0372](https://rustsec.org/advisories/RUSTSEC-2026-0372.html)。
  三者均已停止维护、没有同名修复版本；Linux 插件链需迁移到 zbus 6，当前 Windows 目标不包含它们。

这是依赖维护风险记录，不代表已证明游戏中存在可利用路径，也不替代今后的联网审计。

## 七、下一轮建议顺序

1. 组织五人无提示观察，关闭 M2 的最后一项。
2. 补齐代码签名证书，产出可宣称生产的签名候选。
3. 在干净 Windows 账户完成安装、完整章节与覆盖升级演练。
4. 跟进 Rust 传递依赖维护状态，并为最终候选重新采集性能、安装和升级证据。
5. 验收证据归档并回写本页，再讨论 1.x 的新功能。
