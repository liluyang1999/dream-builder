# JVM — Java 与 Scala（第 3 层）

现代 JVM 工程。在第 1 层与第 2 层之上应用；仓库自身规则优先。共享部分对两种语言都适用，随后是各语言的专门指引。

## 共享（Java 与 Scala）

- 面向当前 **LTS JVM（21+）**。固定工具链（构建工具的 toolchain 或 `.sdkmanrc`）以可复现地构建。
- 用 **BOM**/平台集中管理版本，提交解析 / 锁定后的状态。在 CI 中保留格式化、静态检查、测试与构建。
- 默认**不可变**与显式可空性。确定性地关闭资源（try-with-resources / bracket）。
  IO 并发优先用**结构化并发**与虚拟线程（21+），而非手搓线程池。
- 优化前先用 JFR / async-profiler 剖析。绝不泄漏资源，也绝不吞掉 `InterruptedException`。

## Java

- 用现代语言特性：数据用 **record**，封闭层级用 **sealed** 类型 + **模式匹配 `switch`**，
  显而易见的局部变量用 `var`，多行字符串用文本块。
- 「可能不存在」返回 **`Optional`**，绝不返回 `null`。字段设 `final`；对外暴露不可变集合。
  转换流水线用 stream——而非用来替代一个清晰的循环。
- 异常：编程错误用非受检异常；不要滥用或吞掉受检异常。始终保留 cause。
- 用 **Gradle（Kotlin DSL）** 或 Maven + BOM 构建。用 **JUnit 5 + AssertJ** 测试；
  克制地 mock（Mockito），且只在边界处。用 Spotless / google-java-format 格式化。可考虑 JSpecify 可空性注解。

## Scala

- 优先 **Scala 3**（受限时才用 2.13）。用 **sbt** 或 **mill** 构建。
- 不可变与表达式：`val` 优先于 `var`，ADT 用 `case class`/`enum`，用不可变集合与模式匹配。
  用 `Option`/`Either` 表达「不存在」与「失败」，而非 `null` 或异常。
- 用 `given`/`using` 审慎地实现类型类——别把行为埋进 implicit 的泥潭。保持函数为全函数；把副作用推到边缘。
- 若使用效果系统（**cats-effect** / **ZIO**），让效果留在边界、核心保持纯粹——但不要无谓地引入。
- 用 **scalafmt** 格式化；用 **scalafix**（+ wartremover）静态检查。用 **munit** 或 ScalaTest 测试。

## 构建与打包

- 用 Gradle 或 Maven 构建单一、带版本的产物。应用：优先可运行 jar，或经 `jlink` 裁剪的运行时镜像 /
  容器——在意启动速度处用 GraalVM **native-image**。库：发布带 sources 与 javadoc、且经签名的 POM。
- 用 BOM 集中管理版本，并力求可复现构建。Scala：产出 fat jar（sbt-assembly / sbt-native-packager）
  并发布跨版本产物。在 CI 中保留格式化、静态检查、测试与构建。

## 常见陷阱

- **Java**：返回或接受 `null`；`equals`/`hashCode` 写错；可变静态状态；滥用受检异常；
  在循环更清晰处硬上 stream；热循环中的意外装箱。
- **Scala**：滥用 implicit/`given` 与「运算符汤」；泄漏 `var`；非穷尽或偏函数式的 match；
  在效果或 `Future` 中阻塞；本该组合却用了继承。
