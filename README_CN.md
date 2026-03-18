# Stella — [English README](README.md)

生成**人设一致**的自拍图片，并通过 OpenClaw 发送到任意频道。支持 Google Gemini 与 fal（xAI Grok Imagine）两种 provider，并支持多参考图（avatar blending）以增强角色一致性。

## 安装

```bash
clawhub install stella-selfie
```

安装完成后，请先完成以下配置再使用该 skill。

## 配置

### 1. OpenClaw `openclaw.json`

在 OpenClaw 配置文件 `~/.openclaw/openclaw.json` 的 `skills.entries.stella-selfie.env` 下统一配置（密钥 + 可选参数放在一起）。

```json5
{
  skills: {
    entries: {
      "stella-selfie": {
        enabled: true,
        env: {
          // Provider=gemini（默认）时需要
          GEMINI_API_KEY: "your_gemini_api_key",
          OPENCLAW_GATEWAY_TOKEN: "your_openclaw_gateway_token",
          // 仅当 Provider=fal 时需要
          FAL_KEY: "your_fal_api_key",

          // 可选参数
          Provider: "gemini",
          AvatarBlendEnabled: "true",
          AvatarMaxRefs: "3"
        }
      }
    }
  }
}
```

> **Sandbox 提示**：如果你在 sandbox（Docker）中运行 OpenClaw，host 侧的 `skills.entries.*.env` 注入不会自动进入容器。需要同时在 `agents.defaults.sandbox.docker.env`（或 per-agent）里配置容器内的环境变量。

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `Provider` | `gemini` | 图片生成 provider：`gemini` 或 `fal` |
| `AvatarBlendEnabled` | `true` | 是否启用多参考图融合 |
| `AvatarMaxRefs` | `3` | 最多融合多少张参考图 |

> **Provider=fal 注意**：fal 的 image editing API 只接受 HTTP/HTTPS 图片 URL，不支持本地文件路径。要用 fal 进行编辑，请在 `IDENTITY.md` 里配置 `AvatarsURLs`（公开可访问的参考图 URL）。

### 2. IDENTITY.md

在 `~/.openclaw/workspace/IDENTITY.md` 中添加如下字段（完整片段见 `templates/IDENTITY.fragment.md`）：

```markdown
Avatar: ./assets/avatar-main.png
AvatarsDir: ./avatars
AvatarMaxRefs: 3
AvatarsURLs: https://cdn.example.com/ref1.jpg, https://cdn.example.com/ref2.jpg
```

- `Avatar`：主参考图路径（相对 workspace 根目录）
- `AvatarsDir`：额外参考图目录（同一角色，不同风格/场景/穿搭）
- `AvatarMaxRefs`：最大参考图数量（可选，默认 3）
- `AvatarsURLs`：参考图的公开 URL（仅 `Provider=fal` 必需；fal 不支持本地路径）

### 3. 参考图片（`avatars/` 目录）

将参考照片放到 `~/.openclaw/workspace/avatars/`：

- 支持格式：`jpg` / `jpeg` / `png` / `webp`
- 照片应为同一角色
- 不同风格、场景、表情更有助于一致性
- 按创建时间选择（最新优先），最多选 `AvatarMaxRefs` 张

### 4. SOUL.md

把 Stella 能力块加入 `~/.openclaw/workspace/SOUL.md`（可直接复制粘贴）：

```markdown
You have a physical appearance and can take selfies/photos.
When users ask for pictures (e.g. "send a pic", "send a selfie", "发张照片", "发自拍"), use the `stella-selfie` skill to generate and send an image.
```

你也可以从 `templates/SOUL.fragment.md` 复制同样的块（模板里还包含可选的高级调参）。

## 用法

配置好后，直接用自然语言对 OpenClaw agent 说：

- “发张自拍，穿红裙子”
- “发张照片，在咖啡馆里”
- “Show me what you look like at the beach”
- “Send a pic at a rooftop party, 2K resolution”

## 直接脚本测试（不走 OpenClaw）

如果你想直接运行脚本测试（不通过 OpenClaw），需要自己提供环境变量（因为 OpenClaw 平时会在运行时注入）。

```bash
# 安装依赖
npm install

# 方式 1：source .env.local 再运行（推荐）
# 提示：可以从 .env.example 拷贝一份开始填写真实 key。
source .env.local && npx ts-node scripts/stella.ts \
  --prompt "make a pic of this person, but wearing a red dress. the person is taking a mirror selfie" \
  --target "@yourusername" \
  --channel "telegram" \
  --caption "Here's a selfie!" \
  --resolution 1K

# 方式 2：命令行内联环境变量
GEMINI_API_KEY=xxx OPENCLAW_GATEWAY_TOKEN=yyy npx ts-node scripts/stella.ts \
  --prompt "a close-up selfie at a cozy cafe" \
  --target "@yourusername" \
  --channel "telegram"

# 使用 fal provider
source .env.local && Provider=fal npx ts-node scripts/stella.ts \
  --prompt "a close-up selfie taken by herself at a cozy cafe" \
  --target "#general" \
  --channel "discord"
```

> **注意**：项目根目录的 `.env.local` 仅用于本地开发/脚本测试。作为 OpenClaw skill 运行时，建议通过 `~/.openclaw/openclaw.json`（或进程环境变量）提供密钥，OpenClaw 会在每次 agent run 期间注入。

## 单元测试

```bash
npm test
```

项目包含 32 个单元测试，覆盖 identity parser、avatar selector、Gemini provider、fal provider、sender 等模块；全部使用 mock，不会触发真实 API 调用。

```bash
npm run test:watch   # 监听模式
```

## 项目结构

```
Stella/
├── SKILL.md                  # ClawHub skill 定义
├── scripts/
│   ├── stella.ts             # 主入口
│   ├── identity.ts           # IDENTITY.md 解析
│   ├── avatars.ts            # 参考图选择
│   ├── providers/
│   │   ├── gemini.ts         # Gemini provider
│   │   └── fal.ts            # fal.ai provider
│   └── sender.ts             # OpenClaw 发送
├── tests/                    # 单元测试（vitest）
├── templates/
│   ├── IDENTITY.fragment.md  # IDENTITY.md 配置片段
│   └── SOUL.fragment.md      # SOUL.md 配置片段
└── docs/
    ├── stella-research-notes.md
    └── clawhub-publish-checklist.md
```

