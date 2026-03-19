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
| `AvatarBlendEnabled` | `true` | 是否启用多参考图融合（`false` 时将忽略 `AvatarsDir`，仅使用 `Avatar` 作为参考图；若 `Avatar` 不可用则不带参考图生成） |
| `AvatarMaxRefs` | `3` | 最多融合多少张参考图 |

> **Provider=fal 注意**：fal 的 image editing API 只接受 HTTP/HTTPS 图片 URL，不支持本地文件路径。要用 fal 进行编辑，请在 `IDENTITY.md` 里配置 `AvatarsURLs`（公开可访问的参考图 URL）。

### 2. IDENTITY.md

在 `~/.openclaw/workspace/IDENTITY.md` 中添加如下字段：

```markdown
Avatar: ./assets/avatar-main.png
AvatarsDir: ./avatars
AvatarsURLs: https://cdn.example.com/ref1.jpg, https://cdn.example.com/ref2.jpg
```

- `Avatar`：主参考图路径（相对 workspace 根目录）
- `AvatarsDir`：额外参考图目录（同一角色，不同风格/场景/穿搭）
- `AvatarsURLs`：参考图的公开 URL（仅 `Provider=fal` 必需；fal 不支持本地路径）

### 3. 参考图片（`avatars/` 目录）

将参考照片放到 `~/.openclaw/workspace/avatars/`：

- 支持格式：`jpg` / `jpeg` / `png` / `webp`
- 照片应为同一角色
- 不同风格、场景、表情更有助于一致性（前提是 **同一人且关键特征一致**）
- 按创建时间选择（最新优先），最多选 `AvatarMaxRefs` 张（该选项在 skill env 中配置）

#### 最佳实践（让一致性更稳）

- **数量建议**：
  - 建议放 **3–8 张**同一角色参考图；skill 默认最多融合 `AvatarMaxRefs=3` 张，如需要可调大（但收益会递减）
  - 尽量同时覆盖：正脸/半侧脸、不同表情、不同光照（室内暖光/室外自然光）、不同场景/穿搭
- **尺寸与清晰度（建议值）**：
  - 推荐单张参考图短边 **≥ 768 px**（更稳），最低不要低于 **512 px**
  - 建议用 **1:1** 或 **3:4（竖图）**，更符合头像/自拍分布；尽量避免超宽横幅图
  - JPG/WEBP 建议质量不要太低（避免糊脸、涂抹感）；PNG 也可以但注意体积
- **裁切与构图（最重要）**：
  - 至少保证 **一张“干净正脸/近景”**：脸部清晰、无遮挡（墨镜/口罩/手挡脸会让模型学不到关键特征）
  - 让脸部占画面高度大约 **30%–60%**（太小会丢特征，太大容易只学到局部）
  - 尽量避免强滤镜、重度美颜、夸张妆造变化（会导致“身份特征”不稳定）
- **背景与干扰项**：
  - 参考图里不要出现另外一张清晰人脸（多人合照、镜子反射、海报人脸），否则容易“串脸”
  - 避免同一张图里同时出现极强风格提示（大面积文字、夸张贴纸、强烈艺术滤镜），除非你就是希望固定这种风格
- **稳定风格 vs 稳定身份**：
  - 如果你更在意“像同一个人”，优先多放 **真实/自然光** 的照片
  - 如果你更在意“同一种画风”，可以额外放 1–2 张带目标画风的图，但要小心画风压过身份特征

### 4. SOUL.md

把 `templates/SOUL.fragment.md` 里的完整 Stella 能力块复制粘贴到 `~/.openclaw/workspace/SOUL.md` 中即可。

## 用法

配置好后，直接用自然语言对 OpenClaw agent 说：

- “发张自拍，穿红裙子”
- “发张照片，在咖啡馆里”
- “让我看看你在海滩上的样子”
- “发张屋顶派对的照片，2K 分辨率”

## 异常体验

当生成失败时，Stella 会尝试向同一目标发送一条简短文本提示；在发送链路可用时可避免“无响应”的体验。

常见提示场景：
- 缺少密钥（`GEMINI_API_KEY` / `FAL_KEY`）
- 限流或上游临时不可用（建议稍后重试）
- 安全拦截（建议改写提示词）
- fal 参考图 URL 不可访问（需公开 `http/https` 图片地址）

## 直接脚本测试（不走 OpenClaw）

如果你想直接运行脚本测试（不通过 OpenClaw），需要自己提供环境变量（因为 OpenClaw 平时会在运行时注入）。

```bash
# 安装依赖
npm install

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
│       └── fal.ts            # fal.ai provider
├── tests/                    # 单元测试（vitest）
│   └── providers/            # Provider 单测
├── templates/
│   └── SOUL.fragment.md      # SOUL.md 配置片段
├── smoke/
│   └── avatars/              # Smoke 测试用参考图片
└── docs/
    ├── stella-research-notes.md
    └── clawhub-publish-checklist.md
```

