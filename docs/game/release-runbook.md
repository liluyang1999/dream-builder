# 《智慧树之森》1.0 Windows 交付与恢复手册

## 交付内容

`pnpm release:build` 在完整前端、Rust 与 Tauri 门禁通过后，将以下文件放入
`output/release/<version>/`：

- `Dream-Builder-Fantasy-Tree_<version>_x64-setup.exe`：推荐的当前用户 NSIS 安装包；
- `Dream-Builder-Fantasy-Tree_<version>_x64.exe`：无需安装的便携入口；
- `SHA256SUMS.txt`：交付文件的 SHA-256；
- `release-manifest.json`：唯一的两段式产品版本、源提交、工作区状态、大小与哈希；
- 本手册和中英双语软件许可。

正式发布必须从干净的版本提交运行。开发中的本地候选包只有在明确传入
`-AllowDirty` 时才允许生成，并会在清单中记录 `sourceDirty: true`。
本地与 CI 默认生成的文件未经代码签名，只能称为“候选版”；生产分发必须在签名后重新计算并发布
新的校验和，不能沿用候选版清单。

## 交付校验

候选包生成后必须再运行独立校验器：

```powershell
pnpm release:verify
```

它要求交付目录只包含约定的六个文件，并重新核对四个载荷的产品版本、来源提交、源码树
SHA-256 指纹、字节数、文件 SHA-256、清单与校验和一致性、许可/手册副本以及两份 EXE
的 Authenticode 状态。源码树指纹覆盖所有受 Git 管理及未忽略文件；候选包构建后若又
改动源码，旧产物会被拒绝。候选包可以明确显示为 `NotSigned`，但损坏、无效或不受信任
的签名会直接失败。

生产分发在完成代码签名并重新生成清单与校验和后必须运行：

```powershell
pnpm release:verify:production
```

生产门禁额外要求当前工作区和清单均为干净源码，并要求便携 EXE 与 NSIS 安装包的
Authenticode 状态均为 `Valid`。任何一项未满足时都不得把文件标记为正式发布。

## 生产签名构建

先把带私钥、当前有效且包含代码签名 EKU 的证书安装到 `Cert:\CurrentUser\My`。不要把
PFX、私钥、密码或云签名凭据放入仓库、命令日志或发布目录。为当前 PowerShell 进程设置
非秘密的证书指纹和证书颁发机构时间戳地址，然后运行：

```powershell
$env:DREAM_BUILDER_CERTIFICATE_THUMBPRINT = "<40 位证书指纹>"
$env:DREAM_BUILDER_TIMESTAMP_URL = "<HTTP 或 HTTPS 时间戳 URL>"
pnpm release:build:signed
```

该入口拒绝 `-AllowDirty` 和 `-SkipQualityGate`，验证证书私钥、有效期与代码签名用途，并
通过 Tauri 的原生 `certificateThumbprint` / `digestAlgorithm` / `timestampUrl` 配置在
打包阶段签名应用、NSIS 内容和安装包。临时签名配置只写入系统临时目录并在结束时删除；
清单记录 `releaseKind: production` 和实际签名状态，最后自动执行生产验证。没有有效证书
时命令必须失败，不能用自签名证书或事后修改清单代替。

## 系统要求

- Windows 11 x64；
- 支持 DirectX 11 的显卡；
- Windows 自带或可由安装器按需引导安装的 Microsoft Edge WebView2 Evergreen Runtime；
- 键盘与鼠标，或采用标准映射的 XInput/兼容手柄。

游戏完全离线运行，不需要账号或游戏服务器。首次进入世界后的浏览器音频授权由第一次
键盘、鼠标或手柄操作安全触发。

## 安装与启动

1. 对照 `SHA256SUMS.txt` 校验安装包哈希。
2. 运行 `*_x64-setup.exe`，选择简体中文或 English，按向导完成当前用户安装。
3. 从开始菜单或桌面快捷方式启动“Dream Builder Fantasy Tree”。
4. 标题界面选择“继续旅程”或“开始新旅程”；确认可移动、可暂停、可打开设置，且不会出现第二个实例。

关闭游戏后运行 `pnpm release:verify:installed`。它必须找到唯一且 DisplayVersion 为 1.0 的
卸载项、版本字符串同为 1.0 的主 EXE 与卸载器、有效安装目录，以及至少一个开始菜单或桌面快捷方式；
输出同时记录产品版本 1.0 及用户数据是否存在，但
不会读取或删除其中的内容。

便携版可直接运行同目录中的 `*_x64.exe`。安装包使用 Tauri 的静默
`downloadBootstrapper` Evergreen 策略，不固定 WebView2 版本：系统已有运行时就直接使用，
缺失时由 Microsoft 引导安装，之后由 Evergreen 更新通道维护。便携版遇到缺失提示时，
应从 Microsoft 官方渠道安装 WebView2 Runtime。

## 覆盖升级

同一 `com.dreambuilder.fantasytree` 标识的新版安装包可覆盖旧版。升级前退出游戏；安装后
确认设置和章节存档仍能恢复。进度快照带版本号，当前版本会迁移一致的旧存档，并为最近一份
有效进度保留本机备份。不要把降级到旧版本当作受支持的存档迁移路径。

## 卸载与用户数据

通过 Windows“已安装的应用”卸载。卸载验收必须确认程序文件、开始菜单项和卸载项消失。
本地设置、WebView 数据或日志可能为了升级/诊断而保留；需要彻底清除时，应先在游戏内
开始新旅程并退出，再由用户明确删除与产品标识对应的应用数据目录。发布或支持人员不得
在没有备份和明确授权时删除玩家数据。

卸载并退出所有游戏进程后运行 `pnpm release:verify:uninstalled`。它要求卸载项、程序目录、
快捷方式和运行进程全部消失；`com.dreambuilder.fantasytree` 用户数据目录允许按上述策略保留。

## 故障恢复

- 存档损坏：游戏会隔离损坏快照，并优先恢复上一份可验证备份；界面会说明恢复结果。
- 画面或帧率异常：在设置中切换“流畅”画质并启用“减少动态效果”。
- 输入失去响应：按 `Esc` 打开菜单，选择“回到标题”后继续；`R` 可回到最近安全点。
- 启动崩溃：从制作信息页打开诊断日志目录；若无法进入界面，收集 Windows 应用日志与
  产品日志后再重新安装。
- 回滚：保留上一版安装包及其哈希。只有存档格式确认向后兼容时才回滚；否则优先发布
  修复版并保留当前存档。

## 发布前人工检查

- 在干净 Windows 11 x64 账户完成安装、首次启动、单实例、完整章节和退出。
- 用上一版安装包制造真实旧档，再覆盖升级并验证继续旅程。
- 卸载后检查快捷方式与程序文件；按既定数据保留策略检查玩家数据。
- 分别用键鼠和标准手柄完成光种、记忆、净化与结尾。
- 运行十分钟性能记录，确认平均帧率、1% Low、长帧率及场景阶段门禁。
- 完成五名首次接触玩家的无口头提示观察；自动化不能替代这项外部证据。
- 生产分发前使用受信任的 Windows 代码签名证书签名 EXE 与安装包，再重新计算哈希。
