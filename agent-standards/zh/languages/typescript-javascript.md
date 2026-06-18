# TypeScript 与 JavaScript — 语言层（按需加载）

默认使用严格模式的 TypeScript；把纯 JavaScript 视为约束，而非选择。仅当任务涉及 TS/JS 时才读取本文件。
它在全局 `AGENTS.md`（通用行为与生命周期素养）之上应用；仓库自身规则优先。

## 工具链与运行时

- **TypeScript** 开 `"strict": true`，并加上 `noUncheckedIndexedAccess` 与 `exactOptionalPropertyTypes`。
  面向当前 Node LTS（22+）；若用 Bun/Deno 则显式说明。
- 处处用 **ESM**（`"type": "module"`）。在 `package.json` 中定义 `exports`，声明 `engines`。
- 统一一个带锁文件的包管理器——优先 **pnpm**。**ESLint**（flat config）+ **Prettier**，或用 **Biome** 兼顾二者。
  测试用 **Vitest**（或 Jest）。按需用 tsup/esbuild/Vite 打包或转译。

## 类型

- 不用 `any`——用 `unknown` 再收窄。避免非空断言 `!` 与未经检查的 `as`；若要断言，给出理由。
- 用 `type`/`interface`、可辨识联合与 `as const` 建模数据；让 `switch` 穷尽（配合 `never` 检查）。
  用 `satisfies` 让字面量保持诚实。
- 一切外部输入（网络、环境、文件、用户）在边界处用运行时模式校验（**zod** / valibot），并由它推导静态类型。
  带类型的核心信任自己的类型。

## 惯用法

- 默认 `const`，优先不可变。严格相等（`===`）。可选链 `?.` 与空值合并 `??`。用提前返回取代深层嵌套。
- 优先具名导出而非默认导出。模块小巧、公共面清晰。可行处用纯函数。

## 异步

- 用 `async`/`await`，控制流不用裸 `.then` 链。独立工作用 `Promise.all` 并行；用 `AbortController` 限界与取消。
- 没有游离的 promise——每个都要 `await` 或显式处理。把未处理的 rejection 当作崩溃对待。

## 错误

- 抛出 `Error`（或其子类），绝不抛字符串或普通对象。保留 cause（`new Error(msg, { cause })`）。
  对边界处可预期的失败，返回带类型的 `Result` 风格结果也可。

## 测试

- Vitest：测试行为与公共契约。单元测试里不用真实网络或时钟——把它们 fake 掉（如 HTTP 用 MSW、注入时钟）。
  保持测试确定、可并行。

## 构建与打包

- 用 `tsc` / tsup / esbuild / Vite 构建。交付 ESM 并附带类型声明（`.d.ts`）；在 `package.json` 中
  设置 `exports`、`types` 与 `files`，让使用方拿到构建产物而非你的源码。
- 库：用 `npm publish --provenance` 发布，并用干净的 `files` 白名单（绝不含 `.env` 或机密）。
  应用：面向目标运行时打包。提交的锁文件驱动可复现安装；在 CI 中运行静态检查、类型检查、测试与构建。

## 常见陷阱

- `==` / 隐式转换的意外；`NaN`；用浮点表示金额（应用整数或十进制类型）。
- 日期与时区——优先 `Temporal` 或经过验证的日期库，别做裸 `Date` 运算。
- `this` 绑定；对共享状态的意外修改。
- `any` 经由无类型依赖渗入；未经校验的 `JSON.parse`。
- 未处理的 promise rejection；漏写的 `await`。
