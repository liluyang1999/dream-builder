# 02 · Rust 语言与面向对象技巧

> 后端代码在 `crates/dream-builder/src/`。本章按概念走,每条都指到具体文件与符号。

## 1. 模块系统与可见性

**代码在哪**:`lib.rs` 用 `pub mod domain; pub mod generation; ...` 声明模块树;
`main.rs` 仅 `dream_builder::run()`。把库(`lib.rs`)与可执行入口(`main.rs`)分开,
集成测试(`tests/`)与 doctest 才能直接调用 `pub` API。

**为什么**:清晰的边界 + 最小可见性。只有需要跨模块用的才 `pub`;`state.rs::Inner` 保持私有,
只暴露 `AppState` 的方法。

## 2. trait:抽象的“接缝”

- `generation/rng.rs::Rng`:**带默认方法**的 trait。实现者只需提供 `next_u32`,
  `next_f32`/`range`/`range_u32` 由默认方法免费获得。`SeededRng` 是唯一实现。
- `generation/mod.rs::SceneGenerator`:`generate(seed)` 必须实现,`generate_detail`
  以默认方法基于 `generate` + 迭代器组合子实现。调用方依赖 trait 而非具体类型,便于替换/测试。

**陷阱**:默认方法里不要假设实现细节;它只能用 trait 自身的方法。

## 3. 泛型与生命周期

- 泛型:`fantasy_tree.rs` 的 `build_trunk(rng: &mut impl Rng)` 等用 `impl Trait` 接收任意
  RNG;`SceneGenerator` 是 trait 约束的天然泛型接缝。
- 生命周期:`generate_detail(&self, seed, id: &str)` 借用字符串切片而非获取 `String`
  所有权——“先借用,再克隆”。只有在确实要返回时才 `to_string()`。

## 4. 枚举与穷尽匹配

- `domain/detail.rs::DetailKind`(Rune/Crystal/Leaf)+ `label()` 用穷尽 `match`:
  新增变体会让编译器在每个 `match` 处报错,逼你处理。
- `errors.rs::AppError` 也是枚举,`code()` 用穷尽 `match` 给每个变体一个稳定字符串码。

## 5. 错误处理:thiserror + Result + `?`

- `errors.rs`:用 `thiserror::Error` 派生 `Display`/`Error`,并**手写 `Serialize`**,
  让前端始终收到 `{ code, message }` 形状(与既有 TS 契约一致)。
- 可失败 API 返回 `Result<_, AppError>`,用 `?` 传播(见 `commands.rs`、`persistence.rs`)。
- 库代码避免 `unwrap()`;`state.rs::lock()` 用带消息的 `expect`,且注释说明“仅当别处 panic
  导致锁中毒时触发,那本就是 bug”。

**陷阱**:不要把 `panic!` 当控制流;它表示 bug。

## 6. newtype:给裸数字以语义

`domain/geometry.rs`:
- `Seed(u64)`:防止把种子和任意 `u64` 混用;`From<u64>`/`From<Seed> for u64` 做转换。
- `Energy(f32)`:构造即夹紧到 `[0,1]`(`Energy::new`),所以任何 `Energy` 都合法;单字段
  元组结构体在 serde 下**透明序列化**为数字,wire 形状不变。
- `Vec3` 还实现了运算符重载 `Add`/`Mul<f32>`(值类型的“对象方法”)。

## 7. builder 模式

`domain/scene.rs::TreeSceneBuilder`:链式、移动 `self` 的 builder,`build()` 在未提供调色板时
套用 `TreePalette::default()`。`fantasy_tree.rs::generate` 末尾用它组装场景,读起来声明式。

## 8. 迭代器与组合子

- `generate_detail` 用 `into_iter().find(...).ok_or_else(...)` 取代手写循环 + 错误分支。
- `state.rs::record_seed` 用 `retain` 去重、`insert(0,...)` 置顶、`truncate(32)` 限长。

## 9. 共享可变状态:`Arc<Mutex<…>>`

`state.rs::AppState` 持有 `Arc<Mutex<Inner>>`,`Clone` 后共享同一把锁。方法都“加锁→做最小操作→
返回克隆”,绝不把锁守卫跨 `.await` 持有。

## 10. 异步与 tokio

`events.rs::spawn_magic_field_emitter`:用 `tauri::async_runtime::spawn` + `tokio::time::interval`
周期性 `emit` 魔法场事件。关键纪律:在 `.await` 之后才读 `state.settings()`(加锁→释放),
**不跨 await 持有 `std::sync::Mutex`**——否则可能死锁或破坏 `Send`。
`commands.rs::export_scene` 是 `async` 命令,用 `tokio::fs::write` 做非阻塞 IO。

## 11. 测试

- 单元:`#[cfg(test)] mod tests`(geometry/scene/detail/rng/magic/state/generation 各有)。
- 集成:`tests/scene_contract.rs` 验证序列化 wire 形状(camelCase 键、kind 小写联合、details 引用合法)。
- 不变量:确定性、计数边界、energy ∈ [0,1]、魔法场有限且夹紧。

## 常见陷阱清单

- 生产路径上的 `unwrap()/expect()`(除非真不变量,且写明理由)。
- 习惯性 `.clone()` 而不重构所有权。
- 整数溢出(release 下回绕)——要紧处用 checked/saturating。
- 在尚无必要时就上 `Rc<RefCell>`/trait 对象过度设计。
