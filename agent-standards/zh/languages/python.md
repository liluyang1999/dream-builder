# Python — 语言层（按需加载）

现代、带类型、工具优先的 Python。仅当任务涉及 Python 时才读取本文件。它在全局 `AGENTS.md`
（通用行为与生命周期素养）之上应用；仓库自身规则优先。

## 工具链与版本

- 面向受支持的 CPython（3.12+，优先当前稳定版）。在 `pyproject.toml` 中声明最低版本。
- 统一的项目管理器：**uv**（快、基于锁文件）——若已有 Poetry/PDM 则沿用。始终在虚拟环境中工作，
  绝不装进系统 Python。
- `pyproject.toml`（PEP 621）是项目元数据的唯一来源。新项目不再用 `setup.py` / `setup.cfg`。
- **Ruff** 兼做静态检查与格式化（取代 black + isort + flake8）。**mypy** 或 **pyright** 开严格模式。
  **pytest** 做测试。

## 目录结构

- 采用 `src/` 布局（`src/pkg/…`），让测试针对「已安装的包」而非工作目录运行。
- 保持模块小巧、无导入环。副作用应在函数中，而非在导入时发生。

## 类型与安全

- 为每个公开函数、方法与 dataclass 字段加注类型。在 CI 中运行类型检查并保持通过。
- 用更精确的类型：签名里用 `Sequence`/`Mapping` 而非 `list`/`dict`，用 `X | None` 联合、`Literal`、
  用 `Protocol` 做结构化类型、用 `TypedDict`/dataclass 表示记录。避免 `Any`，必要时将其隔离。
- 在边界处校验外部数据（pydantic，或 dataclass + 显式检查）。在带类型的核心内部，信任你的类型。

## 惯用法

- 由 Ruff 落实 PEP 8——不要手工排版。插值用 f-string。用 `pathlib` 取代 `os.path`。
  推导式在读起来清晰时用，否则用循环。
- 结构化值用 `dataclasses`/`enum`；值对象用 `@dataclass(frozen=True, slots=True)`。
  一切资源都用上下文管理器（`with`）。
- 在惯用之处采取 EAFP 而非 LBYL。诊断用 `logging`，绝不用 `print`。
- 绝不使用可变默认参数（`def f(x=[])`）。在闭包中捕获循环变量时显式绑定。

## 错误

- 抛出具体的异常类型；为你的包定义一个小而清晰的异常层级。绝不裸 `except:`——捕获最贴切的最窄类型。
- 用 `raise NewError(...) from err` 保留上下文。不要把异常当作常规控制流。

## 并发

- IO 密集 → `asyncio`（用 `asyncio.TaskGroup` 实现结构化并发）；绝不用同步 IO 或 CPU 工作阻塞事件循环。
- CPU 密集 → `multiprocessing` / `concurrent.futures` 的进程；受 GIL 限制，线程除阻塞 IO 外收益甚微。

## 测试

- `pytest`：小函数、用 `fixtures` 做准备、用 `parametrize` 覆盖用例。测试之间不共享可变状态。
- 优先用 fake 而非深度 mock；只在你拥有的边界处 mock。纯逻辑值得时用基于属性的测试（`hypothesis`）。

## 依赖

- 提交锁文件；通过管理器固定版本。保持依赖集最小；优先标准库。

## 构建与打包

- 用 PEP 517 构建（`python -m build` → sdist + wheel）；在 `pyproject.toml` 中选定一个后端
  （hatchling、flit 或 pdm-backend）。用 `twine` 或 `uv publish` 发布；绝不提交构建产物。
- 应用从提交的锁文件出发做可复现安装——以容器或 `uv` 构建的虚拟环境交付——并固定 Python 版本。
  在 CI 中用与本地一致的命令运行格式化、类型检查与测试。

## 常见陷阱

- 可变默认参数；循环中的迟绑定闭包。
- `==` 与 `is`（`is` 只用于 `None` 等单例）。
- 导入时副作用与循环导入。
- 过宽地捕获 `Exception`；吞掉调用栈。
- 误以为线程能带来 CPU 并行（GIL 并非如此）。
