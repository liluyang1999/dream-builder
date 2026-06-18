# 05 · 实时 3D 与着色器 / 液态玻璃

> 3D 场景在 `apps/desktop/src/scene/`,玻璃库在 `packages/liquid-glass/`。

## 一、Three.js / react-three-fiber 管线

### 1. 声明式 Canvas

`scene/SceneCanvas.tsx`:`<Canvas>` 配置相机、`dpr`、`gl`(开 `preserveDrawingBuffer` 以便截图)
与 `onCreated`(设置 ACES 色调映射与曝光)。子元素是普通 JSX,但标签是小写的 three 对象
(`<mesh>`/`<group>`/`<points>`/`<instancedMesh>`/`<cylinderGeometry>`/`<meshStandardMaterial>`…),
由 R3F 映射到真实的 Three.js 对象。

### 2. 组件即场景图

- `Lighting.tsx`:半球光 + 两盏方向光 + 核心点光。
- `Branches.tsx`:每段树枝是一根按 `branchTransform`(`sceneHelpers.ts`)定位/定向的锥形圆柱,
  共享一个材质。
- `LeafClusterMesh.tsx`:用 `InstancedMesh` 一次绘制几十片叶子(实例矩阵在 `useMemo` 里用
  确定性 hash RNG 生成,`useLayoutEffect` 写入)——**实例化**是性能关键。
- `RuneSprite.tsx`:把符文字形画到 canvas 纹理,作加色混合的 `Sprite`。
- `CrystalMesh.tsx`:自定义着色器(见下)+ 点光。
- `MagicParticles.tsx`:`<points>` + `BufferGeometry`,在 `useFrame` 里逐帧做风/脉冲模拟,
  从 `fieldRef` 读取后端魔法场。

### 3. 交互

R3F 给网格挂 `onPointerOver/onPointerOut/onClick`(`useInteractive.ts`),`stopPropagation` 避免
穿透;命中后驱动 Zustand 选择状态。每个可交互组件在 `useFrame` 里用 `damp`(指数趋近)平滑
缩放/发光,实现 hover/选中反馈。

### 4. 后期处理:Bloom

`@react-three/postprocessing` 的 `<EffectComposer><Bloom/></EffectComposer>` 让自发光物体
(叶簇、水晶、粒子)“辉光”。配合色调映射,营造梦幻夜色。

## 二、GLSL 着色器(水晶)

**代码在哪**:`scene/materials/crystalMaterial.ts`。

- **顶点着色器**:把法线变到视图空间(`normalMatrix * normal`),并算出视线方向 `vViewDir`,
  通过 `varying` 传给片元。
- **片元着色器**:核心是**菲涅尔项** `fresnel = pow(1 - dot(normal, viewDir), 2.5)`——
  边缘越接近掠射角越亮;再叠加 `uTime` 驱动的 `shimmer` 流光,与 `uBoost`(hover/选中提升)。
- **uniforms**:`uColor/uEmissive/uTime/uBoost`,在 `CrystalMesh.tsx` 的 `useFrame` 里更新。

**为什么用裸 `ShaderMaterial`**:演示最基础的 vertex/fragment/uniform/varying,不被高层封装遮蔽。

**陷阱**:`ShaderMaterial.uniforms` 是索引签名类型,严格档下属性访问会是 `T | undefined`——
本项目用一个 `CrystalUniforms` 类型断言来安全地读写。

## 三、iOS 26 液态玻璃(Liquid Glass)

**目标**:精美、标准的“液态玻璃”观感,且在性能与特效间取得平衡、可降级。

### 1. 组成这种“玻璃感”的层(`packages/liquid-glass/src/liquid-glass.css`)

1. `backdrop-filter: blur() saturate()` —— 背景的磨砂折射(玻璃之所以是玻璃)。
2. 半透明 tint —— 玻璃本体。
3. 顶部高光 `::before` —— 上缘的受光。
4. 指针跟随的高光 `::after` —— 跟着鼠标走的镜面反光(由 `GlassSurface` 写入 `--lg-mx/--lg-my`)。
5. 内/外阴影 —— 厚度与悬浮感。
6. 高画质档的焦散流光 —— 由 SVG `feTurbulence`+`feDisplacementMap` 滤镜驱动(`GlassProvider`
   注入 `#lg-caustics`)。

### 2. 主题与画质:数据属性集中调度

`GlassProvider` 在根 `.lg-root` 上写 `data-lg-theme` 与 `data-lg-quality`,CSS 据此切换变量与
启停效果。主题支持 `light/dark/auto`(`auto` 跟随 `prefers-color-scheme`)。

### 3. 画质分层与降级(性能护栏)

`useGlassQuality.ts::detectGlassQuality`:
- 不支持 `backdrop-filter` → `low`(退化为不透明 tint)。
- `prefers-reduced-motion` 或 CPU 核心少 → `balanced`(只保留模糊 + 高光,关掉焦散)。
- 否则 → `high`(全特效)。
另有 `@supports not (...)` 与 `prefers-reduced-motion` 媒体查询兜底。

### 4. 可复用组件

`GlassSurface`(原语)+ `GlassPanel`/`GlassCard`/`GlassButton`/`GlassBadge`,都 `forwardRef`、
可组合 `className`、注重可访问性(focus-within 触发高光、reduced-motion 降级)。桌面 HUD
(`apps/desktop/src/ui/*`)全部消费这些组件。

## 小结

3D 与玻璃共享同一套“光感语言”:水晶的菲涅尔边缘高光、Bloom 辉光,与玻璃面板的镜面高光彼此呼应,
整体形成一致、精致的视觉。性能上,实例化、ref 直读(避免重渲染)、画质分层与降级是关键手段。
