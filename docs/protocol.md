# stella-selfie 协议 (v1)

本文档定义了 `stella-selfie` 在人格层级（`timeline -> persona -> stella`）下的最终输入/输出契约。

## Skill 职责

`stella-selfie` 充当渲染/输出层（Rendering/Output Layer）：

- 接收用户发起自拍/照片请求
- 判定是否需要启动「情景感知智能编排」以丰富画面事实
- 消费来自外部表达层组件（如 `persona-skill`）的结构化情感表达 JSON
- 组装并生成图像 Prompt，随后将生图结果发送至对应渠道

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

### 基于情景感知的内部输入 (仅在需要时收集)

当用户请求中缺乏明确的场景/穿搭信息时，支持依赖组合能力：

1. 第一步：调用时间线事实组件（获取客观底层事实状态）
2. 第二步：调用人格化表达组件（执行情感及画面渲染意图的转换）
3. 消费经过组装和渲染好的表达状态 JSON 输出来完成后续的 prompt 组装

## 输出 (Output)

### 核心输出

- 图像生成提示词 Prompt (兼顾分发 direct/mirror 模式)
- 生成的图像文件本身
- 向目标渠道投递的成功反馈机制

### 期待的上游契约 (Expected Upstream Contract)

如启用了上游组件向 `stella-selfie` 投递状态时，必须包含以下必填字段：

- `scene.location`
- `scene.activity`
- `scene.time_of_day`
- `emotion.primary`
- `appearance.outfit_style`
- `camera.suggested_mode`
- `camera.lighting`
- `confidence`

## 智能编排规则 (Orchestration Rules - 若启用集成则必选)

1. 如果用户请求没有任何具体的场景关键词，可以按照下述顺序触发外部援助：
   - 时间线事实层组件 -> 人格化表达层组件
2. 绝不允许跳过事实获取而直接向表现层要画面。
3. 如果外部组件处于不可用状态，退回到 Stella 自己内部的基础系统默认行为。
4. 当检测到上游推断的 `confidence < 0.5` 时，必须运用保守的默认回退逻辑。

## 触发策略 (Trigger Strategy)

- 当用户请求拥有显式的场景/衣着/动作约束时：
  - Stella 应直接使用明确的约束开始执行，自身完成闭环，跳过所有上下文延伸链条。
- 当用户请求没有提供任何显式的约束时：
  - 首选启用外部情景感知链后再进行渲染，若缺乏外部帮助则自定妥协方案。

## 异常回退行为 (Fallback Behavior)

- 若缺失 `camera.suggested_mode` 或 `confidence`：退回至基础的 `mirror`（对镜自拍）模式。
- 若接收到的表达状态 Payload 无效或残缺：退回至 Stella 本身的默认模式选取规则处理。

## 版本管理 (Versioning)

- 追踪来自外部 payload 数据体里面的上游 Schema 版本。
- 遇到严重的（major）版本不兼容，应该实施安全回退，决不允许产生未定义字段造成的灾难 Prompt。

## （可选）家族技能生态配合 (Family Skill Integration)

虽然 `stella-selfie` 是通用的多模态生图消费节点，但它可以选择性地作为 `timeline-skill` 和 `persona-skill` 家族组件的增强外延：
当在部署环境里集齐了该家族组件时，`stella-selfie` 可以天然地、无缝地接受上述两者的链式输出，通过在 Agent 的基础 prompt 或 SKILL file 中约定编排命令（如："未指定场景时，使用 timeline -> persona"），形成强真实感、强时间锚点及强人格体现的高级自拍闭环能力。这种集成对 `stella-selfie` 内部自身算法和核心实现保持完全松耦合与非锁定依赖。
