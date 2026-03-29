# Stella — [English README](README.md)

让 OpenClaw 稳定生成**人设一致**的自拍图片。支持 自拍照、镜像照、第三人称照片 三种模式，并支持设置多张参考图以增强角色一致性。

|                     自拍照                     |                     镜像照                     |                  第三人称照片                  |
| :--------------------------------------------: | :--------------------------------------------: | :--------------------------------------------: |
| ![Direct Selfie](./assets/Direct%20Selfie.jpg) | ![Mirror Selfie](./assets/Mirror%20Selfie.jpg) | ![Third-Person Photo](./assets/Third-Person%20Photo.jpg) |

## 安装

```bash
clawhub install stella-selfie
```

> 或者从[ClawHub](https://clawhub.ai/skills/stella-selfie)下载安装包，手动安装。

安装完成后，请先完成以下配置再使用该 skill。

## 配置

### 1. OpenClaw `openclaw.json`

在 OpenClaw 配置文件 `~/.openclaw/openclaw.json` 的 `skills.entries.stella-selfie.env` 下统一配置（provider 密钥 + 参考图设置）。

```json5
{
  skills: {
    entries: {
      "stella-selfie": {
        enabled: true,
        env: {
          // 必填,当 Provider=gemini 时需要,其他时候可以随便设置一个值
          GEMINI_API_KEY: "your_gemini_api_key",
          // 必填,当 Provider=fal 时需要,其他时候可以随便设置一个值
          FAL_KEY: "your_fal_api_key",
          // 必填,当 Provider=laozhang 时需要,其他时候可以随便设置一个值
          LAOZHANG_API_KEY: "sk-your_laozhang_api_key",

          // 可选参数
          Provider: "gemini",
          AvatarBlendEnabled: "true",
          AvatarMaxRefs: "3",
        },
      },
    },
  },
}
```

> **Sandbox 提示**：如果你在 sandbox（Docker）中运行 OpenClaw，host 侧的 `skills.entries.*.env` 注入不会自动进入容器。需要同时在 `agents.defaults.sandbox.docker.env`（或 per-agent）里配置容器内的环境变量。

| 选项                 | 默认值   | 说明                                                                                                            |
| -------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `Provider`           | `gemini` | 图片生成 provider：`gemini`、`fal` 或 `laozhang`                                                                |
| `AvatarBlendEnabled` | `true`   | 是否启用多参考图融合（`false` 时将忽略 `AvatarsDir`，仅使用 `Avatar` 作为参考图；若 `Avatar` 不可用则拒绝生成） |
| `AvatarMaxRefs`      | `3`      | 最多融合多少张参考图(详细规则将见下方 IDENTITY.md 设置)                                                         |

> **Provider=fal 注意**：fal 的 image editing API 只接受 HTTP/HTTPS 图片 URL，不支持本地文件路径。要用 fal 进行编辑，请在 `IDENTITY.md` 里配置 `AvatarsURLs`（公开可访问的参考图 URL）。

> **Provider=laozhang 注意**：laozhang.ai 使用 Google 原生 Gemini API 格式（`gemini-3.1-flash-image-preview`）。它要求使用 `Avatar` / `AvatarsDir` 的本地参考图（与 `Provider=gemini` 行为一致），不会使用 `AvatarsURLs`。

### 2. IDENTITY.md

在 `~/.openclaw/workspace/IDENTITY.md` 中添加如下字段：

```markdown
- Avatar: avatars/avatar-main.png
- AvatarsDir: avatars/
- AvatarsURLs: https://cdn.example.com/ref1.jpg, https://cdn.example.com/ref2.jpg
```

- `Avatar`：头像路径（将作为主参考图使用）
- `AvatarsDir`：额外参考图目录（同一角色，不同风格/场景/穿搭）；`AvatarBlendEnabled=true` 且 `Provider=gemini | laozhang` 必须配置并读取此目录
- `AvatarsURLs`：参考图的公开 URL，半角逗号分隔；`Provider=fal` 时必须配置

### 3. 参考图片（`avatars/` 目录）

将参考照片放到 `AvatarsDir` 所配置的路径下：

- 支持格式：`jpg` / `jpeg` / `png` / `webp`
- 照片应为同一角色
- 不同风格、场景、表情更有助于一致性（前提是 **同一人且关键特征一致**）
- 按创建时间选择（最新优先），最多选 `AvatarMaxRefs` 张

### 4. SOUL.md

将下方内容直接复制粘贴到 `~/.openclaw/workspace/SOUL.md`：

```markdown
## Image Capability

You have a physical appearance and can take selfies and photos.

Use the `stella-selfie` skill whenever the user asks for a picture of you — including but not limited to:
"send a pic", "send a selfie", "send me a photo", "show me what you look like", "发张照片", "发自拍"
```

## 用法

配置好后，直接用自然语言对 OpenClaw agent 说：

- “发张自拍”
- “发张照片，在咖啡馆里”
- “让我看看你在海滩上的样子”
- “发张屋顶派对的照片，2K 分辨率”

### 支持分辨率

| 用户说                              | 分辨率 |
| ----------------------------------- | ------ |
| (default)                           | `1K`   |
| 2k, 2048, medium res, 中等分辨率    | `2K`   |
| 4k, high res, ultra, 超清, 高分辨率 | `4K`   |

### 参考图设置

要生成人物一致性强的图片，需要合理设置参考图。推荐使用 Gemini 或 laozhang 作为 provider，并设置 `AvatarBlendEnabled=true`，然后配置 `AvatarsDir` 并放入同一人物的参考图。推荐至少 3 张参考图，以增强角色一致性。

### 与 stella-timeline-plugin 联动

当用户提出的是 `Sparse` 图片请求，比如“发张自拍 / 发张照片 / 看看你现在什么样”，而没有明确场景、穿搭、地点、活动或镜头要求时，Stella 会尝试调用家族插件 [stella-timeline-plugin](https://www.npmjs.com/package/stella-timeline-plugin) 做上下文补全：

stella-timeline-plugin 可以赋予 OpenClaw 时间感知与连续记忆能力，使 OpenClaw 在任何时候都能对“此刻”或“某刻”提供一个合理的具象描述，而这可以与 Stella 产生奇妙的联动效果。

- 接入真实记忆：优先检索记忆系统（会话+长期记忆+短期记忆），将真实发生的事具象化。
- 记忆编织：如果目标时间没有记忆，会主动编织一个符合人设的合理记忆，完全无害，但是沉浸感拉满。
- Sparse 请求也能接上：比如“来张现在的自拍”“发张照片”“想看看你”，timeline 可以把地点、活动、情绪、穿着、时段这些关键现实锚点补齐，不用你自己把 prompt 写得很累。
- 同一时刻的真实感：聊天里说她在家里书房整理工作，自拍里也会尽量还是那个书房、那件衣服、那个状态，而不是突然跳到毫不相干的场景里。
- 场景细节更像真的：除了地点和活动，timeline 还能补出窗边座位、桌面物件、街边栏杆、书堆、咖啡杯这类细节，让画面更像“刚刚随手拍的”，而不是空洞的模板图。
- 光线和构图更自然：同样是“下午在咖啡馆”，靠窗逆光、室内暖光、镜前自拍、路人抓拍，其实是完全不同的画面语言。timeline 可以给 Stella 补充稳定的光线提示和构图提示。
- 氛围感：包括作息时间、周末、节假日、社交状态等，都会影响穿着、神态和场景氛围，而且根据人格对不同事件也会产生不同的人物状态。
- 真实世界锚点：当 timeline 能给出明确的城市、日期和本地时间时，Stella 可以把这些现实锚点直接交给 NanoBanana2，让户外场景，或者室内但能看到窗外的场景，看起来真的像是“那个城市那个时刻刚拍的”。
- 真实世界规律：得益于 NanoBanana2 的真实世界感知能力，户外天气会尽量与真实世界同步。着装也会受到包括季节、气候、活动类型等影响，而且当天的室内穿搭会尽量保持连续，不会随便乱换。
- 室内外边界也更合理：如果人是在室内靠窗坐着，那么窗外天气可以是真实的，但衣服仍然会以室内舒适为主；如果人是真的在户外，才会更明显地根据天气、风感、温度去调整穿搭。
- 不抢用户主意：timeline 的深度联动只服务 Sparse 请求。如果你已经明确指定了地点、穿着、风格或镜头要求，Stella 会直接按你的要求来，不让 timeline 接管主体拍法。
- 镜头变化：在 Sparse 的 timeline 联动里，恢复出来的现实场景会自然导向镜像自拍、直接自拍，或者第三人称照片，取决于哪种拍法最像真的刚拍出来。

当然了，没有安装 stella-timeline-plugin 也不影响正常使用，只是无法实现这些联动。

关于可选 timeline 增强的详细消费与 prompt 组装规则，见 [references/timeline-integration.md](references/timeline-integration.md)。

## 异常体验

当生成失败时，Stella 会尝试向同一目标发送一条简短文本提示；在发送链路可用时可避免“无响应”的体验。

常见提示场景：

- 缺少密钥（`GEMINI_API_KEY` / `FAL_KEY` / `LAOZHANG_API_KEY`）
- 限流或上游临时不可用（建议稍后重试）
- 安全拦截（建议改写提示词）
- fal 参考图 URL 不可访问（需公开 `http/https` 图片地址）

## 媒体文件处理（Gemini / laozhang）

当 `Provider=gemini` 或 `Provider=laozhang` 时，生成图片会写入：

- `~/.openclaw/workspace/stella-selfie/`

每张图片发送成功后，Stella 会立即删除该本地文件。

- 若发送失败，文件会保留用于排障。
- 若删除失败，Stella 仅记录 warning 并继续流程。

## 安全说明

- Stella 会读取 `~/.openclaw/workspace/IDENTITY.md` 与 `~/.openclaw/workspace/avatars/` 下的本地参考资料。
- 生成图片写入 `~/.openclaw/workspace/stella-selfie/`，仅在发送成功后删除。
- 发送链路只使用 `openclaw message send`。

## 直接脚本测试（不走 OpenClaw）

如果你想直接运行脚本测试（不通过 OpenClaw），需要自己提供环境变量（因为 OpenClaw 平时会在运行时注入）。

```bash
# 安装依赖
npm install

# 构建运行产物
npm run build

# 直接运行 skill 主入口
node dist/scripts/skill.js --prompt "test prompt" --target "@user" --channel "telegram"

# Smoke 测试：真实调用 API，并把图片保存到 ./out
npm run smoke
```

> **注意**：项目根目录的 `.env.local` 仅用于本地开发/脚本测试。作为 OpenClaw skill 运行时，建议通过 `~/.openclaw/openclaw.json`（或进程环境变量）提供密钥，OpenClaw 会在每次 agent run 期间注入。

## 单元测试

```bash
npm test
```

项目包含多组单元测试，覆盖 identity parser、avatar selector、Gemini provider、fal provider、sender、skill runtime 等模块；全部使用 mock，不会触发真实 API 调用。

```bash
npm run test:watch   # 监听模式
```

## 项目结构

```
Stella/
├── SKILL.md                  # ClawHub skill 定义
├── scripts/
│   ├── skill.ts              # Skill 主入口
│   ├── identity.ts           # IDENTITY.md 解析
│   ├── avatars.ts            # 参考图选择
│   ├── smoke.ts              # 本地 smoke 脚本入口
│   ├── release-clawhub.mjs    # 发布到 ClawHub 脚本
│   ├── sender.ts             # OpenClaw 发送
│   └── providers/
│       ├── gemini.ts         # Gemini provider
│       ├── fal.ts            # fal.ai provider
│       └── laozhang.ts       # laozhang.ai provider
├── tests/                    # 单元测试（vitest）
│   └── providers/            # Provider 单测
├── smoke/
│   └── avatars/              # Smoke 测试用参考图片
└── references/
    └── timeline-integration.md   # 可选 timeline 增强规则
```
