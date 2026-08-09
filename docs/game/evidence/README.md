# M2 目标机性能证据

本目录归档 M2 灰盒在目标 Windows 设备上的原生性能证据。它只证明技术性能门禁，不替代 5 名首次接触玩家的无口头提示观察。

另见 [2026-08-08—09 · 1.1 Windows 当前用户安装生命周期](2026-08-08-release-1.1-lifecycle.md)：
安装、技术版本 1.1.0、首次启动、WebView2、单实例、正常关闭、卸载与数据保留边界。

## 2026-07-23 原生十分钟报告

- 五场待填观察包：[m2-observation-pack.md](m2-observation-pack.md)
- 目标构建清单：[m2-target-build.json](m2-target-build.json)
- 报告：[2026-07-23T15-28-24Z-m2-performance-tauri.json](2026-07-23T15-28-24Z-m2-performance-tauri.json)
- 1.0 最终复苏场景稳态报告：
  [2026-07-26T07-41-32Z-release-1.0-steady-state-tauri.json](2026-07-26T07-41-32Z-release-1.0-steady-state-tauri.json)

1.0 稳态报告在最终卡通森林的原生 Rust/Tauri 运行中记录满十分钟：平均 59.99 FPS、
1% Low 58.82 FPS，35,996 帧中 1 帧超过 50ms（0.0028%）。该会话从已经复苏的存档开始，
没有触发重新生成或净化阶段，因此只证明最终复苏场景的持续渲染预算；它不替代下方
M2 报告中的加载/净化阶段证据，也不替代真人完整流程。
- 运行时与数据源：Tauri / Rust
- 应用版本：`0.1.0`
- 工作树标识：`a54fc6503ec7-dirty`
- `dream-builder.exe` SHA-256：`90D3A1CDA1284EB761E54DC3DFA4B36A093A112B3DBEB3D19ACAB28473BD1910`
- 设备：Lenovo `20TKCTO1WW`
- CPU：Intel Core i7-10850H
- GPU：NVIDIA GeForce GTX 1650 Ti Max-Q
- GPU 驱动：`32.0.15.7357`
- 内存：31.8 GiB
- 显示器：3840×2160 @ 59 Hz，Windows 缩放 250%
- 窗口与渲染：默认 1280×800 Tauri 窗口；实测 1220×744 CSS px，DPR 2.625

| 指标 | 实测 | M2 门槛 | 结果 |
|---|---:|---:|---|
| 连续时长 | 600014.9 ms | ≥600000 ms | 通过 |
| 平均 FPS | 59.99 | ≥55 | 通过 |
| 1% Low | 57.14 FPS | ≥30 FPS | 通过 |
| 超过 50 ms 的帧 | 1 / 35997（约 0.0028%） | ≤1% | 通过 |
| P95 帧时 | 17 ms | 记录项 | 已记录 |
| 最长帧 | 50.70 ms | 记录项 | 已记录 |
| 加载峰值 | 26 ms | 必须存在 | 通过 |
| 净化峰值 | 50.70 ms | 必须存在 | 通过 |

报告同时包含 `scene-load` 与 `cleansing` 阶段，未丢弃标记或阶段。采样期间未人工观察到持续卡顿。WebGL 探针不提供 GPU 帧时间；报告中的帧间隔是浏览器主循环在 CPU 侧观察到的结果。

结论：本次构建通过 M2 目标设备性能门禁。M2 总门禁仍未完成，唯一尚未取得的外部证据是 5 名符合资格玩家的无提示观察记录。

每场观察前，在仓库根目录运行 `pnpm m2:verify`。该命令只读校验目标 EXE 与性能报告的 SHA-256；校验通过后运行 `pnpm m2:playtest` 启动同一份 EXE。若已有 `dream-builder` 进程，启动脚本会拒绝复用旧会话，不会代替主持人结束进程或清除数据。
