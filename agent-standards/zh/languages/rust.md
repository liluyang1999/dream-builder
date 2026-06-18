# Rust — 语言层（按需加载）

地道、安全、无告警的 Rust。仅当任务涉及 Rust 时才读取本文件。它在全局 `AGENTS.md`（通用行为与
生命周期素养）之上应用；仓库自身规则优先。

## 工具链

- 当前 edition（2024）上的稳定版 `rustc`/Cargo。用 **rustfmt** 格式化；用 **clippy** 静态检查并保持干净
  （`cargo clippy -- -D warnings`）。若要发布，声明 MSRV 并对其测试。
- 多 crate 工作用 Cargo **workspace**。在 CI 中保留 `cargo fmt --check`、clippy 与 `cargo test`。

## 安全

- 默认安全 Rust。只有确有理由才动用 `unsafe`；把 unsafe 块压到最小，并记录它所维护的不变量。
  尽量用测试与 MIRI 检验 unsafe 代码。

## 错误

- 可失败的 API 返回 `Result<T, E>`，用 `?` 传播。库里用 **thiserror** 定义信息丰富的错误类型；
  应用层用 **anyhow** 补充上下文。
- 库代码中不用 `unwrap()`/`expect()`，除非基于真正的不变量——此时用带消息的 `expect()` 说明它为何不可能失败。
  `panic!` 表示 bug，而非控制流。

## 惯用法

- 先借用再克隆；参数取 `&str`/`&[T]`，而非你并不需要拥有的 `String`/`Vec`。不要为了哄过借用检查器而 `.clone()`——
  应重构。
- 用迭代器与组合子取代手写下标循环。用 `Option`/`Result` 组合子取代嵌套 match。为显而易见的 trait 派生 `derive`。
- 用 newtype 承载领域含义与类型安全；用 `From`/`Into` 做转换；多可选参数的构造用 builder 模式。
  在确实证明需要共享所有权之前，别急着上 `Rc<RefCell<…>>`。

## 并发

- 编译器会强制 `Send`/`Sync`——善用它。共享状态用通道或 `Arc<Mutex<…>>`；数据并行用 **rayon**。
- 异步：选定一个运行时（默认 **tokio**）并保持一致。绝不在异步中阻塞——执行器上不放同步 IO 或重 CPU，
  也绝不跨 `.await` 持有 `std` 锁。

## 测试

- 单元测试放模块内 `#[cfg(test)]`；集成测试放 `tests/`；示例用 doctest。热点路径用 **criterion** 基准测试；
  属性测试值得时用 `proptest`。

## 依赖

- 保持依赖树精简，并审计之（`cargo audit` / `cargo deny`）。把可选功能用 Cargo feature 开关控制，而非默认拉入重依赖。

## 构建与打包

- 二进制：`cargo build --release`（调好 release profile；在意体积就 strip）。要可移植分发，
  构建静态 `musl` 目标或最小化容器。
- crate：以正确的 semver `cargo publish`；先用 `cargo package` 检查。应用提交 `Cargo.lock`，
  库则保持其灵活。在 CI 中保留 `cargo fmt --check`、clippy 与 `cargo test`。

## 常见陷阱

- 生产路径上的 `unwrap()`/`expect()`。
- 习惯性克隆，而不去重构所有权。
- 阻塞异步执行器；跨 `.await` 持有锁。
- 整数溢出（release 下回绕）——要紧处用 checked/saturating 运算。
- 在尚无必要时就用 `Rc<RefCell>` 或 trait 对象过度设计。
