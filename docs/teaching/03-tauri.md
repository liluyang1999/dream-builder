# 03 · Tauri 2 桌面框架

> Tauri 把一个 Web 前端装进原生窗口(Windows 上是 WebView2),并提供 Rust 侧能力。
> 入口在 `crates/dream-builder/src/lib.rs::run`。

## 1. 应用引导:Builder

`lib.rs::run` 用 `tauri::Builder::default()` 链式装配:插件 → 菜单 → `on_menu_event` →
`setup`(状态/托盘/事件)→ `invoke_handler`(命令)→ `run(generate_context!())`。
`main.rs` 只调用它,保持入口极薄。

## 2. 命令(Command):前端可调用的 Rust 函数

**代码在哪**:`commands.rs`,用 `#[tauri::command]` 标注。

- `generate_tree(seed, state) -> Result<TreeScene, AppError>`:Ok 序列化为场景,Err 让 JS 的
  Promise 拒绝并带上 `{code,message}`。
- `detail_info`、`magic_field`、`get_settings`、`seed_history`、`save_settings`、`export_scene`。
- 注册在 `lib.rs` 的 `tauri::generate_handler![...]`。

**前端怎么调**:`apps/desktop/src/ipc/treeApi.ts` 用 `invoke('generate_tree', { seed })`。
参数名(camelCase)要与 Rust 形参对应。

## 3. 托管状态 `State`

`state.rs::AppState`(`Arc<Mutex<Inner>>`)在 `setup` 里 `app.manage(state.clone())`。命令通过
形参 `state: State<'_, AppState>` 注入,拿到共享状态(设置、生成历史、场景缓存)。命令保持“薄”,
把逻辑委托给 domain/generation 层。

## 4. 事件(Event):后端主动推送

**为什么**:与其让前端每 350ms 轮询魔法场,不如后端**推**。

- 后端:`events.rs::spawn_magic_field_emitter` 周期性 `app.emit("magic-field", &field)`。
- 前端:`treeApi.ts::listenMagicField` 用 `@tauri-apps/api/event` 的 `listen` 订阅,zod 校验后
  写入一个 ref;R3F 的 `MagicParticles` 在 `useFrame` 里读取该 ref(不触发 React 重渲染)。
- 同理,原生菜单/托盘点击通过 `menu:<id>` 事件转发给前端(`menu.rs::handle_menu_event` →
  `App.tsx` 的 `listenMenu`)。

## 5. 插件

`lib.rs` 接入官方插件:`single-instance`(二次启动聚焦窗口)、`log`、`store`(设置持久化,见
`persistence.rs` 通过 `StoreExt`)、`dialog`(原生保存对话框)、`fs`、`opener`(打开目录)。
前端对应的 JS 包(`@tauri-apps/plugin-dialog`/`-opener`)在 `App.tsx::exportSceneFile` 里被
**动态 import**(只有在 Tauri 运行时才加载,顺带做了代码分割)。

## 6. 能力与权限(ACL)

**是什么**:Tauri 2 默认“拒绝一切”,你必须在 `capabilities/*.json` 里**显式授权**某窗口可用哪些
命令/插件。

**代码在哪**:`crates/dream-builder/capabilities/default.json` 授予 `main` 窗口
`core:default` 加 `log/store/dialog/fs/opener` 各自的 `:default` 权限集。

**为什么**:最小权限原则——前端只能调用被授权的能力,缩小攻击面。

**陷阱**:命令注册了但没在能力里授权,前端 `invoke` 会被拒。注意区分:Rust 后端自身的文件
访问(如 `export_scene` 用 `tokio::fs`)不受 JS 能力限制;受限的是 JS→core/plugin 的 IPC。

## 7. 菜单与托盘

`menu.rs`:`build_menu` 构建窗口菜单(`Submenu`/`MenuItem`/`PredefinedMenuItem`,带快捷键与
稳定 id);`build_tray` 构建系统托盘 + 上下文菜单。点击统一转成 `menu:<id>` 事件交给前端处理,
把 UI 行为集中在 TS 一侧。

## 8. 窗口与 Win11 Mica

`tauri.conf.json::app.windows[0]`:尺寸/最小尺寸/居中/背景色 + `windowEffects: ["mica"]`
(Win11 云母材质;其它系统优雅忽略)。`menu.rs::focus_main_window` 用 `get_webview_window("main")`
显示/取消最小化/聚焦。

## 9. 安全:CSP 与 IPC 序列化

- `tauri.conf.json::app.security.csp`:从 `null` 收紧为显式策略(限制脚本/样式/连接来源),
  Tauri 会自动合并它自身 IPC 所需的来源。
- 所有 Rust→JS 载荷用 `#[serde(rename_all = "camelCase")]`,与 `packages/ipc-contracts` 的
  zod schema 一一对应。改 wire 格式要同时改:Rust 结构体、zod schema、(如有)前端用法。

## 10. 打包(见第 06 章工程 + `tauri.conf.json::bundle`)

`bundle.targets: ["nsis"]`、`windows.nsis.installMode: "currentUser"`、语言含简中,
产出自包含安装目录(EXE + WebView2 依赖 + 资源)。详见根 `CHANGELOG.md` 与构建命令
`pnpm tauri build`。

## 小结

Tauri 的心智模型:**前端发起、后端授权并执行、双向用命令(请求/响应)与事件(推送)通信**,
能力系统是安全闸门,插件是即插即用的原生能力。
