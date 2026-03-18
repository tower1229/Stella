# Stella 调研结论（v0）

更新时间：2026-03-18

## 1. 项目目标

`Stella` 是一个用于 OpenClaw 个人助理的图片技能，核心能力是：

- 根据用户描述生成/编辑人物图片（以“同一角色一致性”为重点）。
- 将生成结果发送到目标聊天渠道（参考 `clawra` 的闭环流程）。

## 2. 已确认技术路线

### 2.1 Provider 路线

- 采用方案 B：直连官方 API。
- `skill env.Provider`：
  - 支持值：`gemini | fal`
  - 默认值：`gemini`
- **不做自动 fallback**：
  - 当 `Provider=gemini`，失败后直接返回错误，不自动切 `fal`。
  - 当 `Provider=fal`，失败后直接返回错误。

### 2.2 发送逻辑

- 需要接入 channel 发送（不是仅本地生成）。
- 发送逻辑参考 `clawra`：
  1. 生成/编辑图片
  2. 获取图片结果（URL 或文件）
  3. 调用 OpenClaw message 能力发送到目标 channel
- 运行环境基线：OpenClaw `2026.3.13`（当前最新）。
- 命令约定（按新版本）：优先使用 `openclaw message send --channel <provider> --target <destination> ...`，
  避免旧式仅传 `--channel <destination>` 的歧义写法。

### 2.3 参考图与身份配置

- 参考图来源在仓库本地。
- 优先使用 `IDENTITY.md` 的 `Avatar`。
- 扩展 `IDENTITY.md`：新增 `AvatarsDir`，用于多图参考融合。
- `AvatarMaxRefs` 作为 skill env 配置项（默认值 `3`），用于限制最多融合多少张参考图。
- 新增 skill env：`AvatarBlendEnabled`（默认 `true`）。
- 资产责任边界：用户负责把 `avatars/` 部署到远端 OpenClaw workspace 并自行维护更新，skill 不负责资产同步。

### 2.4 多图融合与选图策略

- `avatars/` 中存放同一角色不同风格/场景/服饰/表情的参考图。
- 不需要 `AvatarSelection` 配置。
- 选图规则：
  1. 优先加入 `Avatar`（若存在）。
  2. 从 `AvatarsDir` 扫描图片文件（仅 `jpg`/`jpeg`/`png`/`webp`）。
  3. 按时间倒序选取前 `AvatarMaxRefs` 张。
  4. 去重后作为参考图输入。
- 目录/文件规则：
  - 若 `AvatarsDir` 不存在或不可读，记录警告并跳过目录，不中断流程。
  - 若 `Avatar` 存在且同时出现在目录扫描结果中，按同一路径去重，保留 `Avatar` 优先位。
- 时间排序兼容规则：
  - 优先 `birthtime`
  - 若不可用，回退 `mtime`
  - 再回退 `ctime`

### 2.5 图片参数策略

- 默认输出张数：`1` 张。
- 仅当用户 prompt 明确要求多张时，才生成多张。
- 默认分辨率：`1K`。
- 若用户明确提出更高分辨率需求，可自动提升：
  - `2K`：如用户提到 `2k`、`2048`、`中等分辨率`
  - `4K`：如用户提到 `4k`、`高分辨率`、`超清`、`ultra`

### 2.6 fal 参数映射（已定稿）

- Provider 固定为 `fal` 时使用以下接口：
  - 文生图：`xai/grok-imagine-image`（`https://fal.run/xai/grok-imagine-image`）
  - 图编辑：`xai/grok-imagine-image/edit`（`https://fal.run/xai/grok-imagine-image/edit`）
- 请求参数映射：
  - `prompt`：直接使用组装后的最终提示词。
  - `num_images`：默认 `1`；仅当用户明确要求多图时传入 `>1`。
  - `output_format`：默认 `jpeg`（可后续扩展配置）。
  - 编辑模式输入统一强制使用 `image_urls`（数组）；单图时传 1 个 URL。
- 错误处理：不做自动 fallback，fal 请求失败直接返回错误。

### 2.7 交付与安装策略（已定稿）

- `Stella` 不提供类似 `clawra` 的安装器（不自动写入/覆盖用户工作区文件）。
- 采用标准 ClawHub skill 交付方式（安装后由用户按文档完成配置）。
- skill 文档需明确给出：
  - 建议的 `IDENTITY.md` 追加/补充内容
  - 建议的 `SOUL.md` 追加/补充内容
  - 远端 workspace 中 `avatars/` 的放置与维护说明

## 3. 配置草案

## 3.1 IDENTITY.md（建议）

```md
# IDENTITY.md

Name: Stella
Avatar: ./assets/avatar-main.png
AvatarsDir: ./avatars
```

### 3.2 openclaw.json skill env（建议）

```json
{
  "skills": {
    "entries": {
      "stella-selfie": {
        "enabled": true,
        "env": {
          "Provider": "gemini",
          "AvatarBlendEnabled": "true",
          "GEMINI_API_KEY": "...",
          "FAL_KEY": "...",
          "OPENCLAW_GATEWAY_TOKEN": "..."
        }
      }
    }
  }
}
```

### 3.3 SOUL.md（建议补充片段）

```md
## Stella Image Capability

当用户请求“发图/自拍/展示你在某场景”时，使用 stella skill 生成并发送图片。

执行规则：
- 默认 `Provider=gemini`，不自动 fallback。
- 默认输出 `1` 张、`1K` 分辨率。
- 用户明确要求多图或更高分辨率时再提升。
- 参考图优先使用 `IDENTITY.md` 中的 `Avatar`，并可融合 `AvatarsDir` 中的多图。
```

## 4. 运行流程（v0）

1. 解析用户请求（意图、风格、张数、是否需要发送）。
2. 读取身份配置（`Avatar`, `AvatarsDir`, `AvatarMaxRefs`）。
3. 根据 `AvatarBlendEnabled` 组装参考图列表。
4. 根据 `Provider` 走单一生成通道（`gemini` 或 `fal`）。
5. 生成完成后，按目标 channel 发送图片。
6. 返回执行结果（含 provider、模型、输出位置、发送状态）。

## 5. 与 clawra 的对照结论

- 相同点：
  - 都是“人物图生成 + 消息发送”闭环。
  - 都通过 OpenClaw 渠道发送能力完成投递。
- 差异点（Stella）：
  - 以 `gemini` 为默认 provider。
  - 保留 `fal` 作为可选 provider，但不自动回退。
  - 引入本地多参考图融合（`AvatarsDir` + `AvatarBlendEnabled`）。
  - 不提供安装器，按 ClawHub 标准 skill 安装 + 文档引导配置。

## 6. 实现细节借鉴与注意事项

- 借鉴 `nano-banana-pro`：
  - CLI 参数化清晰（prompt/filename/input-image/resolution/api-key）。
  - API key 优先级建议：命令参数 > 环境变量。
  - 明确错误输出与退出码，便于自动化调用。
- 借鉴 `clawra`：
  - “生成 -> 发送”闭环明确，用户体验直接。
  - skill 文案对触发条件和模式提示较完整。
- 注意规避（基于复盘）：
  - 避免文档与实现不一致（文档说 edit，代码却走 generate）。
  - 避免覆盖用户 `IDENTITY.md`/`SOUL.md`（改为文档引导手工补充）。
  - 避免旧版发送参数写法在新 OpenClaw 版本中产生歧义。

## 7. 参考资料

- Clawra 仓库：[https://github.com/SumeLabs/clawra](https://github.com/SumeLabs/clawra)
- Gemini 图片 API（官方）：[https://ai.google.dev/gemini-api/docs/image-generation?hl=zh-cn#gemini-image-editing](https://ai.google.dev/gemini-api/docs/image-generation?hl=zh-cn#gemini-image-editing)
- OpenClaw message CLI：[https://docs.openclaw.ai/cli/message.md](https://docs.openclaw.ai/cli/message.md)
- OpenClaw Skills Config：[https://docs.openclaw.ai/tools/skills-config.md](https://docs.openclaw.ai/tools/skills-config.md)
- ClawHub 发布清单（本项目）：[`docs/clawhub-publish-checklist.md`](docs/clawhub-publish-checklist.md)

