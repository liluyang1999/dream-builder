# 2026-09-28 · 发布签名检查的 PowerShell 宿主兼容

此记录补充[本轮磁盘与质量复盘](2026-09-28-maintenance-review.md)，不改写初次检查结果。

在清空 target 后，从提交 `e7be57732bbd71c677b6f8b51d16fa7c3c975759` 执行完整
`pnpm release:build`，前端十阶段、31 项 Rust 测试、Clippy、EXE 与 NSIS 构建均成功。
随后 Authenticode 检查失败，说明“能构建 EXE”仍不能代替完整候选目录验收。

## 最小复现与原因

直接启动 Windows PowerShell 可读取签名；经 `pnpm exec powershell` 启动时，按模块名称
导入 `Microsoft.PowerShell.Security` 会报 ObjectSecurity 类型成员重复，自动加载签名命令失败。
同样的受限/非受限运行都可能出现，不能简单归因于文件权限。

环境对照显示：宿主均为 Windows PowerShell 5.1，但 pnpm 子进程的 PSModulePath 将
PowerShell 7 模块放在系统模块之前，从而选中了 7.0 版 Security 模块。
这个中间进程继承差异符合 [Microsoft 的模块路径说明](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_psmodulepath?view=powershell-7.6)。

## 修复与回归

构建与独立验证脚本在任何签名操作之前，按 `$PSHOME/Modules` 的绝对路径加载当前宿主
自带的 Security 模块。既不删除用户模块，也不修改用户级环境变量或放宽签名条件。

最小回归保持同一 pnpm 子进程环境：原来按名称导入失败，改用宿主路径后实际 EXE
签名读取成功，结果为 `NotSigned`，加载的是 Windows PowerShell 自带的 3.0 模块。
完整候选仍须经过原有文件集合、版本、来源指纹、哈希及签名状态检查；此项修复不赋予生产发布资格。
