# Stella ClawHub 发布检查清单（v0）

更新时间：2026-03-18

> 目标：在 `Stella` 开发完成后，可稳定发布到 ClawHub，并支持后续迭代升级。

## A. 发布前（结构与合规）

- [ ] **技能目录可独立打包**（至少包含 `SKILL.md`）。
- [ ] **不提供安装器**（不自动改写用户 `IDENTITY.md`/`SOUL.md`/`openclaw.json`）。
- [ ] **`SKILL.md` frontmatter 完整**：`name`、`description`，以及 `metadata.openclaw` 运行依赖声明。
- [ ] **仅包含文本文件**（ClawHub 只接受文本类文件；不要把 `png/jpg/webp` 打进发布包）。
- [ ] **将头像资产外置**：`IDENTITY.md` 中保留 `Avatar` / `AvatarsDir` 路径，运行时从本地读取。
- [ ] **文档说明环境变量**：`Provider`、`AvatarBlendEnabled`、`GEMINI_API_KEY`、`FAL_KEY`、`OPENCLAW_GATEWAY_TOKEN`。
- [ ] **文档提供建议片段**：给出可直接复制的 `IDENTITY.md` / `SOUL.md` 补充内容。
- [ ] **Provider 策略一致**：默认 `gemini`，支持 `fal`，不自动 fallback。
- [ ] **默认生成策略一致**：默认 `1K`、默认 `1` 张；用户明确要求时自动提升分辨率或张数。
- [ ] **发送链路验证**：生成后必须可调用 OpenClaw message 发送到目标 channel。

## B. 发布前（质量验证）

- [ ] **本地 dry-run 验证流程可跑通**：生成、选图、发送、错误返回。
- [ ] **配置缺失错误信息清晰**（例如缺少 API key、找不到 `Avatar`/`AvatarsDir`）。
- [ ] **`AvatarsDir` 筛选规则生效**：仅 `jpg/jpeg/png/webp`，并实现 `Avatar` 优先与去重。
- [ ] **时间排序兼容规则生效**：`birthtime -> mtime -> ctime`。
- [ ] **安全检查**：无可疑脚本行为（避免被风控标记）。
- [ ] **README / 使用文档可直接上手**（含示例命令、参数说明、常见故障）。

## C. ClawHub 账号与 CLI 准备

- [ ] 安装 CLI：`npm i -g clawhub`（或 `pnpm add -g clawhub`）。
- [ ] 登录：`clawhub login`。
- [ ] 验证登录：`clawhub whoami`。
- [ ] 确认账号满足发布门槛（建议按 14 天 GitHub 账号年龄准备）。

## D. 首次发布（1.0.0）

- [ ] 确定 `slug`（小写、URL-safe，建议与仓库/技能名一致）。
- [ ] 确定显示名 `name`（面向用户）。
- [ ] 确定语义化版本号（首次建议 `1.0.0`）。
- [ ] 准备 changelog（首次可写 `Initial release`）。

命令模板：

```bash
clawhub publish ./path/to/stella-skill \
  --slug stella-selfie \
  --name "Stella Selfie" \
  --version 1.0.0 \
  --tags latest \
  --changelog "Initial release"
```

## E. 发布后验证

- [ ] 通过页面或 `clawhub inspect stella-selfie` 检查元数据/版本信息。
- [ ] 新环境执行安装验证：

```bash
clawhub install stella-selfie
```

- [ ] 验证安装后可在 OpenClaw 会话中触发技能。
- [ ] 验证发布包不包含二进制图片文件（资产应由本地配置提供）。
- [ ] 验证在 OpenClaw `2026.3.13` 下发送参数兼容（`--channel <provider>` + `--target <destination>`）。

## F. 版本迭代策略

- [ ] `patch`：修复 bug / 文案 / 小兼容调整。
- [ ] `minor`：新增向后兼容能力（如新 prompt 模式、新可选参数）。
- [ ] `major`：配置协议或行为有不兼容变更。

迭代发布模板：

```bash
clawhub publish ./path/to/stella-skill \
  --slug stella-selfie \
  --name "Stella Selfie" \
  --version 1.0.1 \
  --tags latest \
  --changelog "Fix: improve avatar directory validation and error messages"
```

## G. 批量同步（可选）

若你将多个技能维护在同一工作区，可使用：

```bash
clawhub sync --all
```

仅演练不上传：

```bash
clawhub sync --all --dry-run --no-input
```

## H. 常见失败与处理

- `Unauthorized (401)`：重新登录，检查 token 是否过期。
- `Rate limit exceeded (429)`：按 `Retry-After` 重试，必要时降低并发。
- `No skills found`：确认技能目录含 `SKILL.md`，并检查 `--workdir/--root`。
- 发布被风控隐藏：检查技能脚本是否触发可疑行为特征，修复后重发版本。

## I. Stella 专项注意点

- `avatars/` 目录中的图片文件不要发布到 ClawHub 包内。
- 在 `SKILL.md` 明确告知用户：需在本地准备 `Avatar` 和 `AvatarsDir` 资产。
- 远程 OpenClaw 运行时，`AvatarsDir` 路径必须是远程实例可访问路径。

## 参考资料

- ClawHub（OpenClaw 文档）：https://docs.openclaw.ai/tools/clawhub.md
- ClawHub CLI 参考（源码文档）：https://raw.githubusercontent.com/openclaw/clawhub/main/docs/cli.md
- ClawHub Skill 格式：https://raw.githubusercontent.com/openclaw/clawhub/main/docs/skill-format.md
- ClawHub 安全/审核：https://raw.githubusercontent.com/openclaw/clawhub/main/docs/security.md
- ClawHub 故障排查：https://raw.githubusercontent.com/openclaw/clawhub/main/docs/troubleshooting.md

