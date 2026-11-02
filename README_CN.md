# Stella Selfie — [English](README.md)

让 OpenClaw 助手真正「长得像自己」。

Stella 用 OpenClaw 原生生图，按人设拍出外观一致的自拍和照片——不是随机换脸，也不是每次都是另一个人。默认 Gemini Pro，也可换成宿主已配置且能做参考图编辑的其他原生模型。支持直接自拍、镜面自拍、第三人称照片三种模式，可叠加多张本地参考图。聊天里的普通请求会把一张图发到当前会话；同宿主 plugin 则直接拿到图片 Buffer，由调用方自己做预览、存储和发布。

|                     自拍照                     |                     镜像照                     |                       第三人称照片                       |
| :--------------------------------------------: | :--------------------------------------------: | :------------------------------------------------------: |
| ![Direct Selfie](./assets/Direct%20Selfie.jpg) | ![Mirror Selfie](./assets/Mirror%20Selfie.jpg) | ![Third-Person Photo](./assets/Third-Person%20Photo.jpg) |

默认 `google/gemini-3-pro-image`；模型支持时默认 2K、单图、不指定画幅。Stella 不额外保存生成图片，即使用户明确要求副本。

## 安装

```bash
clawhub install stella-selfie
```

> 或者从 [ClawHub](https://clawhub.ai/skills/stella-selfie) 下载安装包，手动安装。

已验证 OpenClaw 2026.10.9。宿主须兼容 `image_generate`、provider 清单和 Agent 解析接口，并使用宿主支持的 Node 版本（基线 `>=24.22.1 <25` 或 `>=26.12.1`）。运行包没有 npm 依赖。通过 OpenClaw 原生 provider/auth 配置所选 Agent 的生图认证，旧的 skill 专用 key 不会自动迁移。

请安装到目标宿主、profile 和工作区作用域。本次请求需要 `image_generate`、写入请求 JSON、运行参考图准备/清理脚本的权限，并能读取实际 Agent 工作区。

> **Windows PowerShell**：完整 Node 路径前加 `&`；临时请求文件用 `Remove-Item -LiteralPath` 清理。等准备/清理进程结束后再继续，不要把进程完成通知当成图片完成事件。

## 配置

### 1. OpenClaw `openclaw.json`

非敏感配置放在 `skills.entries.stella-selfie.config`：

```json
{
  "model": "google/gemini-3-pro-image",
  "AvatarBlendEnabled": true,
  "AvatarMaxRefs": 3
}
```

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `model` | `google/gemini-3-pro-image` | 宿主已声明、且支持参考图编辑的原生图片模型 |
| `AvatarBlendEnabled` | `true` | 是否融合 `AvatarsDir` 里的额外参考图；`false` 时只用主图 `Avatar` |
| `AvatarMaxRefs` | `3` | 最多融合多少张本地参考图，上限为所选模型的 `maxInputImages` |
| `AvatarAllowedRoots` | 工作区 `assets/`、`avatars/` | 非空绝对目录数组，**替换**默认允许根 |

`AvatarBlendEnabled` / `AvatarMaxRefs` / `AvatarAllowedRoots` 仍可读旧环境变量。优先级：config → 进程 env → skill env → 默认值。指向工作区外的符号链接 / junction 不会自动授权其目标。

### 2. IDENTITY.md

在实际 Agent 工作区写入：

```markdown
Avatar: ./assets/avatar-main.png
AvatarsDir: ./avatars
```

- `Avatar`：主参考图。一张有效本地图即可。
- `AvatarsDir`：同一角色、不同风格/场景/穿搭的额外参考图，可选。

`AvatarsURLs` 会被忽略，只使用授权的本地文件。

### 3. 参考图片

把参考照片放到 `AvatarsDir` 配置的路径下：

- JPEG / PNG / WebP，签名匹配，每张不超过 20 MiB
- 须为同一角色，关键特征稳定
- 不同风格、场景、穿搭和表情更有助于一致性
- 主图优先、真实路径去重；额外图按 `birthtime` 优先，再 `mtime` / `ctime`，新到旧

聊天快照会保留校验后的输入，但原生图片工具可能在上传前缩放或重新编码参考图，从而改变尺寸、格式和细节，不保证原始字节上传。宿主媒体限制、Stella 的 20 MiB 校验、以及请求的成品分辨率分开管理。同宿主 plugin 路径会直接传递校验后的 Buffer，不经过聊天工具的这一步优化。

### 4. 可选 SOUL.md

保留你自己的人格文件。`templates/SOUL.fragment.md` 仅供按需合并：

```markdown
## Image Capability

You can use the `stella-selfie` skill to generate persona-consistent selfies and photos.
When the user requests a picture of you, use their requested scene and camera style.
Examples: "send a pic", "send a selfie", "show me what you look like", "发张照片", "发自拍".

Follow the skill's configuration, image validation and delivery rules. If configuration
is incomplete, explain what is missing before generating or sending an image.
```

## 用法

配置好后，直接用自然语言对 OpenClaw agent 说：

- “发张自拍”：默认镜面自拍；没给场景细节且时间线可用时，也可能用时间线场景
- “发张窗边的自拍，4K”
- “发张第三人称照片，3:4”
- “让我看看你在海滩上的样子”

用户明确提供的配文留在会话回复里，不混进提示词。

### 分辨率

| 用户说 | 分辨率 |
| --- | --- |
| 2k、2048、medium res、中等分辨率 | `2K` |
| 1k、low res、低分辨率 | `1K` |
| 4k、high res、ultra、超清、高分辨率 | `4K` |

用户没提分辨率时不要写入请求；辅助脚本仅在所选模型支持时默认补 `2K`。只有用户明确指定画幅时才传入宽高比，不会从提示词里猜测。

### 与时间线联动

用户只说「发张自拍 / 发张照片 / 想看看你」，没给场景细节（文档里叫 `Sparse`）；或者明确回指当前会话里刚刚解析过的某个场景。这时如果环境里有 `timeline_resolve`，Stella 会尽量按「现在」补全画面，让照片看起来像刚拍的：

- **和刚才说的时刻对得上**：聊天里说她在书房整理工作，自拍也会尽量还是那个书房、那件衣服、那个状态。
- **没给细节也能补全**：地点、活动、情绪、穿着、时段可以自动填上，不必自己把提示词写全。
- **细节更像随手拍**：窗边座位、桌面物件、街边栏杆、咖啡杯，而不是空洞的模板图。
- **同一场景可以有不同光和构图**：同样是「下午在咖啡馆」，靠窗逆光、室内暖光、手持近景，其实是完全不同的画面。
- **用户已经指定的内容优先**：已经指定地点、穿着、风格或镜头时，直接按你的要求来，时间线不覆盖。
- 没有时间线也不影响正常使用，只是没有这些增强。

时间线可选，只做尽力增强。工具缺失、失败或空数据时回退默认规则。城市和时间只是场景锚点，不能证明真实天气；Stella 没有启用搜索 grounding。详细规则见 [timeline 说明](references/timeline-integration.md)。

辅助脚本校验参考图并准备原生 `image_generate` 参数。聊天必须使用当前会话的实际 Agent，不会回退到 `main`。宿主异步生成并交付到当前会话。参考图临时快照在工具读取后、于本次请求内清理。准备失败会清理本次创建的文件，包括部分写入的文件，无法清理时报告目录供明确清理。不增加轮询、二次发送、跨渠道目标、批量或 Stella 重试。附件保留期由宿主管理，不承诺永久可用。

## 同宿主 plugin

需要把照片当成字节去做预览、入库或发布？调用 `generateForPlugin`。调用方提供 Stella skill 目录和可选 `agentId`（未传 `agentId` 时使用 `main`，绑定不存在时报错）。这条 plugin 默认不适用于聊天。适配器解析实际 Agent 身份、工作区和认证目录，单次调用 `api.runtime.imageGeneration.generate`，返回 `Buffer` + MIME 或带生成结果状态的明确错误。Stella 不创建持久素材 ID、路径或文件。

接入说明见 [同进程适配](references/plugin-integration.md)。调用方 plugin 不在本仓库。

## 2.0 说明

已退役：skill 自带的 fal / laozhang SDK 和 skill 专用 key 安装、旧 sender、`channel` / `target` / `--save-dir` / `count`、生成图片备份和素材库管理。宿主原生 fal、OpenAI、MiniMax 等能做参考图编辑的模型可用 `config.model` 选择。删掉旧 `Provider` 字段，改用 `config.model`。重复请求会发起新生成。

```sh
npm ci
npm run build
npm test
npm run smoke -- --agent main
npm run sync:local -- --agent main
# 也可明确指定安装作用域：
npm run sync:local -- --skills-dir /absolute/path/to/skills
npm run release:clawhub -- --prepare-only
```

smoke 只准备并清理三种模式的参考图，不调用生图、不产生生图费用。本地同步只复制运行白名单、保留用户文件，不依赖 WSL 或运行时 npm 安装，也不覆盖人格文件。找不到 CLI 时，可设置 `OPENCLAW_CLI_PATH` 指向已安装的 `openclaw.mjs`。

暂存包只包含运行文件并生成 SHA256 清单，准备包不代表发布。设计与验证边界见 [设计文档](docs/google-native-design.md)、[验证记录](docs/native-verification.md)。

官方依据：[原生图片生成](https://docs.openclaw.ai/tools/image-generation)、[plugin runtime](https://docs.openclaw.ai/plugins/sdk-runtime/media#api-runtime-imagegeneration)、[skills 配置](https://docs.openclaw.ai/tools/skills-config)。
