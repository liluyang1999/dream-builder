# 04 · TypeScript 纵深与 React 19

> 前端在 `apps/desktop/src/`,共享契约在 `packages/ipc-contracts/`,玻璃库在
> `packages/liquid-glass/`。

## 一、TypeScript

### 1. 严格档

`tsconfig.base.json` 开了 `strict` + `noUncheckedIndexedAccess` +
`exactOptionalPropertyTypes` + `noImplicitOverride` + `verbatimModuleSyntax`。
`noUncheckedIndexedAccess` 把 `arr[i]`/索引签名属性标成 `T | undefined`,逼你显式处理
(见 `scene/MagicParticles.tsx` 里 `positions[offset] ?? 0`、`CrystalMesh.tsx` 里对
`material.uniforms` 的窄化处理)。

### 2. 不用 `any`,用 `unknown` 再收窄

边界数据先当 `unknown`,经 zod `safeParse` 收窄成静态类型(`treeApi.ts`)。

### 3. zod = 运行时校验 + 静态类型,单一真相源

`packages/ipc-contracts/src/index.ts`:用 zod 定义 schema,再 `z.infer` **反推**类型。
`superRefine` 编码跨字段不变量(交互 id 唯一、details 必须引用真实对象)。`parseWith` 把
`safeParse` 包成可辨识联合 `ParseResult<T>`(`{ok:true,value} | {ok:false,reason}`)。

### 4. 可辨识联合 + 穷尽

- `SceneLoadResult.source: 'rust' | 'fallback'`(`treeApi.ts`)。
- `interaction/selectionState.ts::SelectionAction` 是 action 的可辨识联合,reducer 用 `switch`
  穷尽处理。

### 5. 标准装饰器(TC39 Stage 3)

`ipc/instrument.ts` 的 `@logged`/`@measure` 是**标准方法装饰器**:签名 `(target, context)`、
`ClassMethodDecoratorContext`,返回一个同签名的替换函数(包裹原方法记录日志/耗时,兼容同步与
Promise)。用在 `ipc/treeApi.ts::TreeApiClient` 的方法上。esbuild/Vite + TS 5.7 原生转译,无需
`experimentalDecorators`。

### 6. 工具类型与品牌

`Readonly`、映射/索引类型在契约与组件 props 中随处可见;`as const`(如 `HelpOverlay` 的
快捷键表、`Hud` 的状态文案)+ `satisfies`(worker `protocol`)让字面量“保持诚实”。

### 7. Web Worker:把计算移出主线程

`workers/`:`protocol.ts` 定义带 `id` 配对的请求/响应类型;`fallback.worker.ts` 在 worker 里
跑确定性回退生成;`fallbackClient.ts` 用 `new Worker(new URL(...), {type:'module'})` 封装成
Promise,并在 `Worker` 不可用时(jsdom/测试)**同步降级**。

### 8. 异步纪律

`async/await`,无游离 promise(用 `void` 显式忽略),effect 用 `let active` 标志防竞态
(`App.tsx`)。

## 二、React 19

### 1. 入口与组合

`main.tsx` 用 `createRoot(...).render(<StrictMode><App/></StrictMode>)`。`App.tsx` 是“编排层”:
集中放副作用(加载场景、取细节、订阅事件/菜单、键盘快捷键、截图/导出),让叶子组件保持纯。

### 2. hooks

- `useEffect`:按 `seed` 变化加载场景、按选择变化取细节、挂载时订阅事件。
- `useRef`:`fieldRef`(每帧读取的魔法场)、`sceneApiRef`(命令式截图/导出/重置)、
  `actionsRef`(让一次性订阅始终调用最新闭包,避免重复订阅)。
- `useCallback`:稳定回调身份。
- 自定义 hook:`interaction/useKeyboardShortcuts.ts`(用 ref 存 handlers,监听只绑定一次)、
  `interaction/useInteractive.ts`(把 3D 对象接到选择 store)。

### 3. 状态管理:Zustand

`state/store.ts`:单一 store,组件用**选择器**订阅切片(只在该切片变化时重渲染)。选择转移委托给
纯函数 `reduceSelectionState`——框架状态在边缘,核心逻辑保持纯净、可测。

### 4. react-three-fiber(见第 05 章)

`scene/SceneCanvas.tsx` 用声明式 `<Canvas>` 组织 3D;交互用 R3F 的 `onPointerOver/onClick`。

## 常见陷阱

- 漏写 `await` 或游离 promise;未处理的 rejection。
- `==`/隐式转换;用浮点表示需要精确的量。
- `this` 绑定(本项目用箭头函数/类方法 + 装饰器规避)。
- 经由无类型依赖渗入的 `any`;未校验的 `JSON.parse`/IPC 载荷(本项目用 zod 守边界)。
