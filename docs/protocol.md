# stella-selfie 协议 (v1)

本文档定义了 `stella-selfie` 的输入/输出契约，以及与 `stella-timeline-plugin` 的集成规则。

## Skill 职责

`stella-selfie` 充当渲染/输出层（Rendering/Output Layer）：

- 接收用户发起的自拍/照片请求
- 判定是否需要调用 `timeline_resolve` 以获取时间现实锚点
- 将时间线事实（或用户显式约束）组装为图像 Prompt
- 生成图像并发送至目标渠道

注意：它绝不负责定义事实上的时间线真相。

## 输入 (Input)

### 显式输入 (Explicit Input - 来自用户请求)

- 自然语言形式的用户请求 (必填)
- 请求中可以附带明确的约束条件 (选填):
  - 地点 / 场景 (location / scene)
  - 穿搭 / 外观 (outfit / appearance)
  - 动作 (activity)
  - 分辨率 (`1K`, `2K`, `4K`)
  - 生成数量 (count)
  - 发送目标渠道 (channel target/provider)

### 基于时间线的内部输入 (仅在需要时收集)

当用户请求中缺乏明确的场景/穿搭信息时，若环境中存在 `timeline_resolve`，则调用它获取当前时间现实：

```
timeline_resolve({ query: "现在" })
```

消费 `result.consumption.selfie_ready` 作为 prompt 的现实锚点，同时读取：

- `result.consumption.fact.continuity` — 用于决定拍摄模式（direct / mirror）
- `result.episodes[0].world_hooks` — 用于补充环境氛围（weekday / holiday）

## 输出 (Output)

### 核心输出

- 图像生成提示词 Prompt（兼顾 direct / mirror 模式）
- 生成的图像文件本身
- 向目标渠道投递的成功反馈

### 上游契约：`selfie_ready` 字段 (来自 `stella-timeline-plugin`)

`result.consumption.selfie_ready` 的稳定字段如下，均为必填（由 timeline 保证）：

| 字段 | 说明 |
| --- | --- |
| `location` | 当前地点标签 |
| `activity` | 当前活动描述 |
| `emotion` | 主要情绪 |
| `appearance` | 穿搭风格 |
| `time_of_day` | 时段（morning / afternoon / evening / night）|
| `summary` | 当前状态摘要 |

辅助字段（可选，用于增强 prompt）：

| 字段 | 来源 | 说明 |
| --- | --- | --- |
| `fact.continuity.is_continuing` | `consumption.fact` | 是否延续上一状态，影响拍摄模式选择 |
| `world_hooks.weekday` | `episodes[0]` | 是否工作日，影响氛围描述 |
| `world_hooks.holiday_key` | `episodes[0]` | 节假日标识，影响氛围描述 |

## 智能编排规则 (Orchestration Rules)

1. 用户请求有显式场景关键词时：直接使用约束组装 prompt，跳过 timeline 调用。
2. 用户请求无显式场景关键词时：若 `timeline_resolve` 可用，先调用获取 `selfie_ready`，再组装 prompt。
3. `timeline_resolve` 不可用、返回 `fact.status === "empty"`，或任何调用错误：退回默认行为，不阻塞生图。
4. `fact.confidence < 0.5` 时：忽略 timeline 结果，退回默认行为。

## 触发策略 (Trigger Strategy)

- 有显式约束 → Stella 自身完成闭环，不调用 timeline。
- 无显式约束 → 优先调用 timeline 获取现实锚点；timeline 不可用时使用 mirror 模式默认 prompt。

## 异常回退行为 (Fallback Behavior)

- `timeline_resolve` 不可用或调用失败：退回 mirror 模式，使用无场景的默认 prompt。
- `selfie_ready` 字段缺失或不完整：退回 Stella 自身的默认模式选取规则。
- `continuity` 字段缺失：默认使用 mirror 模式。
- `world_hooks` 字段缺失：跳过氛围修饰，不影响其他字段的使用。

## （可选）家族技能生态配合 (Family Skill Integration)

`stella-selfie` 是通用的多模态生图消费节点，可选择性地与 `stella-timeline-plugin` 集成：当部署环境中安装了 `stella-timeline-plugin` 时，`stella-selfie` 会自动获得时间现实感知能力，形成强真实感、强时间锚点的自拍闭环。这种集成对 `stella-selfie` 的内部实现保持完全松耦合——未安装 timeline plugin 时行为不变。
