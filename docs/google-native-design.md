# Google 原生生图迁移设计

状态：同宿主 plugin 内存交接与普通聊天原生迁移均已实现，最终回归通过。日期：2026-11-01。原代码基线：v1.4.1 / `0a14e30`；已核对宿主：OpenClaw `2026.10.9`。设计决定与验证结果分别记录，不能将离线验证称为付费生图或完整消费端联调。第一个确认的消费方是 bili；Stella 公开入口按通用同宿主 plugin 定稿。

## 最新决定及其覆盖范围

用户确认：**同宿主 OpenClaw plugin 使用官方 `api.runtime.imageGeneration.generate(...)` 直接接收图片字节，默认不建立 Stella 持久副本。** 第一个确认的消费方是 bili。Stella 提供人物参考图准备及提示词规则；调用方自己管理预览、需要的存储、上传和发布。

该决定取代之前对 bili 的强制入库、等待生成加保存、返回持久素材 ID/文件路径，以及以 CLI JSON 为主接口的方案。新的成功条件是拿到一张有效图片字节；不创建素材 ID、文件路径、保存任务或领取接口。此前的 CLI 入库验证保留为技术证据，不再作为 plugin 内存接口的正式路径。

用户随后明确确认：**普通自拍不支持“用户明确要求保存副本”能力。** 因此聊天与同宿主 plugin 均不创建额外生成图片备份，不实现 CLI 保存分支。宿主为聊天交付管理的附件不属于 Stella 额外副本，保留期由宿主管理。历史测试产生的用户文件不自动删除。

## 保留的产品取舍

| 项目 | 决定 |
| --- | --- |
| 供应商 | 默认 Google 官方原生模型；允许换成宿主已配置且 `edit.enabled` 的其他原生生图模型。不维护 skill 自带供应商 SDK，不把旧 fal/laozhang skill 路径加回来 |
| Stella 形态 | 轻量 skill 加必要辅助模块，不新增 Stella plugin、队列或服务 |
| 普通自拍 | 原生 image_generate 异步返回当前请求会话；不指定 channel/target，不跨会话或跨渠道发送，不支持额外保存副本 |
| 同宿主 plugin | 能按自身任务请求生成新图；图片只返回调用方，不由 Stella 单独在聊天展示 |
| 发布 | 调用方自己预览、存储及发布；生成并不自动授权发布 |
| 人物绑定 | 调用方配置 agentId，未配置精确选择 main；不存在就报错，不切到其他 Agent |
| 普通聊天身份 | 使用当前请求会话 Agent，与 plugin 的 main 缺省规则不同 |
| 提示词 | 调用方按 Stella 格式给完整 prompt；执行层不改写、不补场景、不额外看图生成描述 |
| 数量 | 一次只生成一张；不提供批量、部分成功或自动补图 |
| 返回时机 | 调用方 await 单次生成完成，拿图片字节或明确错误；不新增任务 ID/状态查询/领取接口 |
| 重试 | Stella 不追加生成重试，不自动补图，不因后处理失败重新生成；宿主/provider 内部策略分别看待 |
| 默认模型 | google/gemini-3-pro-image，允许配置宿主 listProviders 中已声明、可参考图编辑的 `provider/model`；显式传模型，关闭 autoProviderFallback |
| 分辨率 | 模型支持时默认 2K；明确提供时支持 1K、2K、4K；不支持 resolution 的模型默认不传 |
| 画幅 | 默认不传 aspectRatio 或 size；只有明确提供比例才传，不从 prompt 推断 |
| 参考图 | 至少一张有效本地图；额外目录可选，主图优先、真实路径去重、额外图按时间新到旧，默认最多三张 |
| 描述 | 无内容描述字段，无额外图片理解调用 |

默认 Flash / 1K 改为 Pro / 2K 会改变费用与延迟。Google 将 Pro 定位于高质量复杂视觉任务，本机宿主声明支持且真实生成成功；这不是 Stella 已完成的绝对人像质量排名。[Google 模型定位](https://ai.google.dev/gemini-api/docs/image-generation#model_selection)

## 同宿主 plugin 的正式执行路径

```text
调用方准备完整 Stella prompt
  → Stella 模块校验请求、解析绑定 Agent、准备参考图字节
  → api.runtime.imageGeneration.generate
  → 一张有效图片 Buffer + MIME 返回调用方
  → 调用方自己的预览、存储、上传及发布流程
```

聊天工具 image_generate 会在宿主管理媒体中保存生成附件并进行会话完成交付；它不是可关闭聊天展示的 plugin RPC。plugin runtime 是公开的独立程序入口，复用相同生图核心，直接返回 images 中的 buffer/mimeType，不经过聊天工具的保存与完成交付封装。[官方 runtime](https://docs.openclaw.ai/plugins/sdk-runtime/media#api-runtime-imagegeneration)、[聊天生图工具](https://docs.openclaw.ai/tools/image-generation)

### 稳定模块入口

已实现 `dist/scripts/plugin.js` 的 `generateForPlugin(api, integration, request)`。调用方从自身配置的 Stella skill 安装绝对目录加载它，不从 cwd 或人物工作区猜安装路径。

- api 是调用方当前的 OpenClawPluginApi，提供 config、runtime.agent 和 runtime.imageGeneration。
- integration.listAgentIds 使用公开 `openclaw/plugin-sdk/agent-scope-runtime` 的 listAgentIds；先验证绑定存在，再调用宿主工作区与认证目录解析器。
- 两层不导入宿主哈希命名的私有 dist 模块，不复制 key，不建立新的供应商认证逻辑。
- 调用示例及完整说明在 [plugin 集成文档](../references/plugin-integration.md)。

### 请求 v1

```json
{
  "schemaVersion": 1,
  "agentId": "main",
  "prompt": "A selfie of this person, sitting by a cafe window, looking into the lens.",
  "resolution": "2K",
  "aspectRatio": "3:4"
}
```

prompt 必填；agentId 可省略，缺省 main；resolution 可省略，缺省 2K；aspectRatio 只有明确提供才出现。模型来自 Stella 配置。拒绝未知字段和无效类型，不接受后静默忽略 count、channel、target、saveDir 或 description。

### 成功返回

以下为同进程对象，不是要把 Buffer JSON/base64 化后交给聊天模型：

```ts
{
  schemaVersion: 1,
  ok: true,
  agentId: "main",
  generatedAt: "<观察到生成完成的 UTC ISO 时间>",
  image: { buffer: Buffer, mimeType: "image/jpeg" }
}
```

- 验证返回 provider/model、恰好一张、无忽略的显式参数、图片非空且签名与 MIME 一致；不猜文件扩展名，不伪造文件路径或长期素材 ID。
- 不把输出字节、人物原图或上游响应写入聊天、日志或 Stella 文件。生成字节的后续生命周期由调用方管理，调用方持有需要继续使用的同一结果。
- 每次生成调用是一次新请求，不承诺自动幂等。独立单张请求可并行，不依赖可变全局 Agent/授权目录状态，不新增 Stella 限流或队列。

### 错误与等待

```json
{
  "schemaVersion": 1,
  "ok": false,
  "error": {
    "code": "TIMEOUT",
    "stage": "generate",
    "message": "生成等待超时，结果尚无法确认。",
    "generationOutcome": "unknown"
  }
}
```

stage 为 validate/reference/generate；generationOutcome 为 not_started/succeeded/unknown。生成异常保守标记 unknown，不声称供应商一定未生成、取消或未计费；输出与要求不符时生成可能已完成，标记 succeeded 并报 OUTPUT_INVALID，不补生图。

保留认证、权限、限流、安全拒绝、超时和上游不可用等分类及可操作提示；本地校验另区分 INPUT_INVALID、CONFIG_INVALID、AGENT_NOT_FOUND、IDENTITY_UNREADABLE、NO_VALID_REFERENCE。错误不暴露原始响应、key、stack，也不建议切换已退役供应商。

调用方等待预算须覆盖宿主生成时限，不由短 RPC 超时提前切断正常生成。Stella 只调用一次 runtime，不在外层追加重试；宿主内部网络请求策略不等于 Stella 重试。

## 身份、认证与配置

- 调用方使用绑定 Agent 的实际 IDENTITY.md、工作区和参考图，认证通过同一绑定 Agent 的 agentDir 交给宿主解析。不把调用方运营 Agent、System Agent 或唯一 Agent 自动当成 Stella。
- 用 api.runtime.agent.resolveAgentWorkspaceDir / resolveAgentDir 解析路径；不写死 ~/.openclaw/workspace，不用 skill 安装目录、进程 cwd 或人物工作区互相推导。
- 绑定 Agent 或工作区不存在、身份不可读时失败，不换人物。Avatar/AvatarsDir 的相对路径以该工作区为根；普通文本、Markdown 列表、加粗字段写法继续支持。
- 同宿主文件与内存交接不等于支持远程宿主或路径不互通的 sandbox；无法读取身份时明确失败。
- 内存交接不创建 Agent 素材目录。聊天参考图快照使用独立随机目录及绑定 Agent 的清单；不混用其他请求的参考图或清理令牌。

共享非敏感配置位于 `skills.entries.stella-selfie.config`：

| 字段 | 默认和规则 |
| --- | --- |
| model | google/gemini-3-pro-image，可换成宿主已声明且支持参考图编辑的原生模型 |
| AvatarBlendEnabled | true；false 只用主图，主图无效失败，不转额外目录 |
| AvatarMaxRefs | 3；正整数，上限为所选模型 `maxInputImages`（未知时保守 5，已知不超过 16），越界明确报错，不自动裁剪 |
| AvatarAllowedRoots | 可选，非空绝对目录数组，替换默认允许根；默认仅实际工作区下 assets、avatars |

AvatarBlendEnabled / AvatarMaxRefs / AvatarAllowedRoots 兼容旧环境配置，优先级为新 config → 进程 env → skill env → 默认值。旧根目录字符串按 JSON 数组解析，无效显式值失败而非扩大授权。旧 Provider 不再是选择器：`Provider=gemini` 忽略通过，其他值要求删除并改用 `config.model`。

认证使用所选模型对应的宿主原生 provider/auth，不放请求字段、命令行、身份文件或日志。旧 skill 专用 apiKey/GEMINI_API_KEY 不被假定已经迁移到原生认证。[Skills config](https://docs.openclaw.ai/tools/skills-config)

## 提示词及参考图的兼容规则

### 提示词

- 保留 mirror / direct / third_person 三种模板、服装与全身/近景与表情的选择规则；用户明确镜头要求优先。无明确模式且 timeline 不可用时仍回退 mirror。
- 基础格式：`A mirror selfie of this person, [context], showing full body reflection.`、`A selfie of this person, [context], looking into the lens.`、`A natural third-person photo of this person, [context], natural composition, not a selfie.`；允许既有 timeline 融合，不用逐字正则限制自然语言。
- 拍摄主体为助手/绑定人物。明确自拍不得被 timeline 改成第三人称；普通聊天由当前 Agent 按 skill 组装，调用方根据任务及绑定资料组装；执行层原样传 prompt。
- caption 仍是当前会话回复配文，不混入 prompt、不变成生成描述；调用方的发布配文由调用方管理。
- 保留自然语言分辨率识别及明确 1K/2K/4K；默认 2K。Google 旧路径本来就不指定 aspectRatio，本次保留默认行为。

### 可选 timeline

保留 references/timeline-integration.md 中有效的场景规则：

- 仅 Sparse 当前状态或当前会话对单个近期已解析场景的明确回指启用；明确独立场景直接服从用户。
- 当前状态固定查询 现在；回指优先复用对应 result.consumption，需重查仅保留“你”与时间/事件锚点，不改写为输出槽位问题。
- 只消费 consumption 的 selfie_ready、scene 与连续性字段，保留外观变化判断；不依赖 episodes、trace 等内部结构。
- 工具不存在、异常、超时、空结果或无有效 consumption 时回退原有默认规则，不让自拍失败，不额外解释 timeline 内部失败。
- 保留地点、日期、时间、室内外与光照连贯性；旧实现没有开启 Google 搜索 grounding，不能仅凭天气提示句承诺真实天气同步。修正文案，不新增隐式天气查询或删除整个 timeline。

### 参考图

- 主图优先，开启混合后扫描可选目录；主图/额外图无效时跳过并诊断，最终至少一张。混合关闭只用主图。
- 按真实路径去重；额外图按 birthtime 优先、再 mtime/ctime 的既有时间策略新到旧，相同时间用稳定路径排序；默认最多三张。
- 保留 JPEG/PNG/WebP、单图不超过 20 MiB、普通文件、签名、大小和真实路径授权检查；签名检查不宣称是完整图片解码。
- 默认 assets/avatars 的外指 symlink/junction 不自动授权；继续支持显式 AvatarAllowedRoots，处理路径穿越和校验期间替换。
- 同宿主 plugin 把从已验证句柄读出的字节传给 runtime，不在检查后重新交原路径读取，不制作磁盘快照。输出上限交给宿主，参考图 20 MiB 不被误套为额外的 4K 成品限制。
- 普通聊天把校验后的字节写为输入快照，再交给原生 image_generate。快照保持原字节，但宿主读取后可能自动缩放、重新编码，改变参考图格式、像素及细节；不保证原始字节上传，也不把 4K 成品请求解释为保留 4K 参考图。plugin 的直接 Buffer 路径不经过聊天工具优化。
- Stella 的 20 MiB 本地校验与宿主媒体预算、优化分别处理；不声称 6–20 MiB 的参考图一定失败或一定原样上传。继续采用已确认的原生聊天架构，接受并明确该兼容边界，不新增 CLI 生图或自行保存分支。

## 普通自拍原生执行与临时文件

路径为 `完整 prompt → prepare 校验并快照参考图 → image_generate → 发起回合 release 输入快照 → 宿主完成回合交付当前会话附件`。task ID 仅代表提交，不代表生成或发送成功；不使用 message send 二次发图，不向用户泄露内部标识。Stella 不删除宿主管理附件。

scripts/chat.ts 复用 plugin 模块的参数、Agent 与参考图校验，通过宿主 CLI 只读获取实际 Agent 位置、skills 配置及原生 provider 清单。聊天必须显式提供当前 Agent，不使用 plugin 路径的 main 缺省。scripts/native-cli.ts 以 Node 参数数组启动已安装的 CLI，不将 prompt 插入 shell。

快照仅为输入文件，位于实际工作区的 stella-selfie/.references/ 随机目录。公共父目录创建只容忍 EEXIST，随后仍验证普通目录、链接和工作区边界，以支持首次跨进程并发；权限等其他错误原样失败。

每个参考图和 manifest 都先独占创建并登记本次所有权，再通过文件句柄写入。准备失败时尝试清理全部已登记文件，包括部分写入的参考图及清单；不删除独占创建失败的既有文件，不递归删除目录。单个清理失败不阻止其他已登记文件的清理，不覆盖最初的准备错误；残留目录有明确诊断供显式清理。成功后 release 仍依照 Agent/token 清单拒绝越界、符号链接及意外文件。

发布包不包含参考图。prepare/release 不生成图片，不创建成品库，不删除用户原始参考图。

本机 image_generate 在返回异步任务前读取全部参考图，因此输入快照在工具返回后即可于发起回合清理，无需完成回合写权限。清理错误不触发再次生成。完成回合只交付宿主附件和明确配文；异步失败由当前会话报告。不轮询、不新增查询接口。

旧设计的完成回合保存方案实测失败，但用户已明确取消额外副本能力，因而不再是当前方案的阻塞点。不以更改宿主权限绕过限制。该读取时序属于已核对版本的兼容要求，升级宿主时需要复核。

## 实现、发布与验收

### 已完成

- scripts/plugin.ts：稳定内存交接、Agent 绑定、按宿主 provider 能力校验、参考图 Buffer、单图输出验证、明确错误、不重试、不落盘。
- scripts/images.ts / avatars.ts：每次调用显式授权根和诊断通道，避免并行 Agent 配置互相污染。
- scripts/chat.ts / native-cli.ts / skill.ts：普通聊天 prepare/release、实际 Agent 路径、参考图快照和原生工具参数；不生成额外副本。
- references/plugin-integration.md：调用示例、成功/失败对象和调用方职责；发布白名单包含新模块与说明。
- 相关单元测试及本机官方 runtime 模块的无网络兼容验证；真实 Google 生成与聊天完成回合的证据见 [验证记录](native-verification.md)。

### 功能核对清单

| 原有能力 | 要求 |
| --- | --- |
| 三种拍摄模式、caption、timeline | 保留；SKILL、中英文 README、timeline 同步更新，保留可选 SOUL 片段 |
| 身份 Markdown 写法、主图/混合/排序/去重 | 保留；聊天与同宿主 plugin 使用共享实现 |
| 授权根、20 MiB、文件签名/替换检查 | 保留；不能以原生 SDK 存在为由删除 |
| 1K/2K/4K、默认未指定比例 | 保留；下一版默认 2K |
| 普通自拍显式持久副本 | 用户最新明确取消；不实现 CLI 保存分支 |
| 发布白名单、SHA256、安装与同步、可选 SOUL | 保留；不覆盖用户人格文件，不夹带参考图/素材/凭据 |
| fal/laozhang skill SDK、自有重试、旧 sender | 按已确认决定退役，移除运行依赖；宿主原生 fal 等可 edit 模型可通过 config.model 选用 |
| 批量、跨渠道目标、任意 save-dir | 已确认收窄；旧调用给明确迁移提示，不保留误导示例 |

首版以 OpenClaw 2026.10.9 为核对/验收基线，Node 版本与宿主一致。运行包无 npm 依赖，独立白名单暂存；本地同步支持明确 Agent 或 skills 安装目录，不再依赖 WSL、默认工作区或运行时 npm install。

聊天入口与文档、同宿主 plugin 适配器、依赖清理、打包与同步均已实现。2.0.0 已在本机 main Agent 实际安装，聊天原生异步单附件和官方 runtime 单张 Buffer 均已真实生成通过，发布状态见验证记录。当前仓库没有消费端 plugin 的实现，预览/上传联调需在调用方中完成。

验收覆盖 Agent 非 main/缺省 main/缺失绑定、自定义工作区、参数原样传递、授权边界、有效单图、错误脱敏、并行调用不污染、plugin 路径无落盘/无自动聊天交付、超时不自动重试；聊天覆盖输入快照与释放、拒绝旧字段、默认无画幅及实际宿主 smoke。安装验收的新增两次真实生成已另获用户明确批准，不据此前仅两次授权自行追加。具体证据见验证记录。
