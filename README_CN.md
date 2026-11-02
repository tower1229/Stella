# Stella Selfie

[English](README.md)

使用 Google 官方原生生图，为 OpenClaw 助手生成外观一致的照片。普通自拍交付当前会话的一张附件；同宿主 plugin 通过官方 runtime 接收图片 Buffer，自己管理预览、存储和发布。

保留镜面自拍、直接自拍、第三人称照片、可选 timeline 连续性、明确配文、1K/2K/4K 及多张本地参考图。默认 google/gemini-3-pro-image、2K、单图，不指定画幅。Stella 不额外保存生成图片，包括用户明确要求副本的情况。

## 安装

已核对 OpenClaw 2026.10.9。宿主须兼容 image_generate、provider 清单和 Agent 解析接口，使用宿主支持的 Node 版本（核对基线 >=24.22.1 <25 或 >=26.12.1）。

在目标宿主、profile 与工作区作用域中安装：

```sh
clawhub install stella-selfie
```

运行包没有 npm 依赖。通过 OpenClaw 原生 provider/auth 配置所选 Agent 的 Google 认证，旧 skill 专用 key 不会自动迁移。发起回合需要 image_generate、写请求 JSON、运行参考图准备/清理脚本的权限，且能读取实际 Agent 工作区。

Windows PowerShell 使用完整 Node 路径时需要调用运算符 `&`；临时请求文件使用 `Remove-Item -LiteralPath` 清理。准备/清理脚本的进程返回后再继续，不把进程完成通知当作图片完成事件。

实际工作区的 IDENTITY.md：

```markdown
Avatar: ./assets/avatar-main.png
AvatarsDir: ./avatars
```

一张有效参考图即可，额外目录可选。保留用户人格文件，templates/SOUL.fragment.md 仅供按需合并。

## 配置

非敏感配置放在 skills.entries.stella-selfie.config：

```json
{
  "model": "google/gemini-3-pro-image",
  "AvatarBlendEnabled": true,
  "AvatarMaxRefs": 3
}
```

可选 AvatarAllowedRoots 为非空绝对目录数组，**替换**默认允许根。默认允许实际工作区下 assets、avatars，外指 symlink/junction 不自动授权其目标。

AvatarBlendEnabled/AvatarMaxRefs/AvatarAllowedRoots 兼容旧配置，优先级为 config → 进程 env → skill env → 默认值。关闭混合时只用主图；主图优先、真实路径去重，额外图按 birthtime 优先再 mtime/ctime 新到旧，默认最多三张、当前 Google 上限五张。参考图须为普通 JPEG/PNG/WebP 文件，签名匹配，每张不超过 20 MiB。

聊天快照保留校验后的输入，但原生生图工具可能在上传前缩放或重新编码参考图，改变尺寸、格式和细节，不保证原始字节上传。宿主媒体限制和优化与 Stella 的 20 MiB 校验、请求的成品分辨率分别管理。同宿主 plugin 路径直接传递校验后的 Buffer，不经过聊天工具的这一步优化。

## 使用

- “发张自拍”：默认镜面自拍，或符合条件的 timeline 场景。
- “发张窗边的自拍，4K”：明确场景和分辨率。
- “发张第三人称照片，3:4”：明确构图与画幅。
- 用户明确提供的配文保留在会话回复，不混入提示词。

timeline 可选且尽力增强：仅 Sparse 当前状态请求，或对当前会话单个近期已解析场景的明确回指启用。独立明确场景直接服从用户；工具缺失、失败或空数据时回退默认规则。城市和时间不能证明真实天气；Stella 没有启用搜索 grounding。

辅助脚本校验参考图并准备 image_generate 参数，宿主异步生成并交付当前会话。参考图临时快照在工具读取后的发起回合清理；准备失败会清理本次创建的文件，包括部分写入的文件，无法清理时报告目录供明确清理。不增加轮询、二次发送、跨渠道目标、批量或 Stella 重试。附件保留期由宿主管理，不承诺永久可用。

## 同宿主 plugin

按 [内存交接说明](references/plugin-integration.md) 接入。调用方配置可选 agentId，未配置精确使用 main，绑定不存在时报错。适配器解析实际 Agent 身份、工作区和认证目录，单次调用 api.runtime.imageGeneration.generate，返回 Buffer + MIME 或带生成结果状态的明确错误。不创建持久素材 ID、路径、内容描述或文件。

## 迁移与开发

已退役 fal/laozhang、自有 provider SDK/skill 专用 key 安装、旧 sender、channel/target/save-dir/count 参数、生成图片备份和素材库管理。AvatarsURLs 忽略，改用授权本地参考图。旧 Provider=gemini 兼容，其他值须移除或迁移。重复请求会发起新生成。

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

smoke 只准备并清理三种模式的参考图，不调用生图、不产生生图费用。本地同步只复制运行白名单、保留用户文件，不依赖 WSL 或运行时 npm 安装，也不覆盖人格文件。找不到 CLI 时，可设置 OPENCLAW_CLI_PATH 指向已安装的 openclaw.mjs。

暂存包只包含运行文件并生成 SHA256 清单，准备包不代表发布。设计与验证边界见 [设计文档](docs/google-native-design.md)、[验证记录](docs/native-verification.md)。调用方 plugin 不在本仓库。

官方依据：[原生生图](https://docs.openclaw.ai/tools/image-generation)、[plugin runtime](https://docs.openclaw.ai/plugins/sdk-runtime/media#api-runtime-imagegeneration)、[skills 配置](https://docs.openclaw.ai/tools/skills-config)。
