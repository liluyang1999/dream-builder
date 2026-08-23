# Loop Engineering · AGENT 工作参考

本目录是 Dream Builder 的**工程循环记录**，供参与本项目开发的 AGENT 程序与人类维护者查阅。
它回答的是「产品要做什么、当前到了哪一步、凭什么这么说」，不承担教学职责。

> 教学内容全部在 [`docs/`](../docs/index.html)：那里解释每项技术是什么、为什么这样用、代码在哪里。
> 两个目录面向不同读者，也有不同的变化频率——教学结论力求稳定，工程记录随每次迭代改变。

## 开始工作前先读什么

| 你要做的事 | 先读 |
|---|---|
| 任何改动 | [`concepts.md`](concepts.md) 的循环纪律与四条硬规则 |
| 判断能不能说「做完了」 | [`progress.md`](progress.md) 与 [`product/release-1.0.md`](product/release-1.0.md) 的验收矩阵 |
| 改动玩法或范围 | [`product/README.md`](product/README.md)、[`product/vertical-slice.md`](product/vertical-slice.md) |
| 组织真人可玩性观察 | [`product/m2-playtest.md`](product/m2-playtest.md) |
| 构建、签名、安装、回滚 | [`product/release-runbook.md`](product/release-runbook.md) |
| 引用或新增证据 | [`evidence/README.md`](evidence/README.md) |
| 追溯早期设计意图 | [`history/README.md`](history/README.md) |

## 目录结构

```text
loop/
├── README.md      本页：入口与使用方式
├── concepts.md    Loop Engineering 概念与本项目的循环纪律
├── progress.md    进展记录：里程碑、已闭合事实与未闭合门槛
├── product/       产品真相源：愿景、范围、验收矩阵、观察协议、交付手册
├── evidence/      不可改写的原始测量与生命周期证据
└── history/       2026-04 的早期设计札记，只读
```

## 对 AGENT 的四条硬要求

1. **先读后写。** 改动前确认 [`concepts.md`](concepts.md) 与相关产品文档，不要从单个源文件推断意图。
2. **状态只能由证据推动。** 未通过的人工门槛必须保持可见；不得把自动化通过写成里程碑通过。
3. **证据只追加。** `evidence/` 中的历史数值、哈希与时间戳一律不改写，路径变更只更新指针。
4. **改完就更新记录。** 影响范围、验收状态或门禁的改动，必须同步 [`progress.md`](progress.md)。

`pnpm loop:verify` 会检查本目录的必备文件、目录结构与全部相对链接；它是 `pnpm check` 的固定阶段。
