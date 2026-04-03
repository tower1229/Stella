# OpenClaw Skills

## Source Map

- [创建 Skills](https://docs.openclaw.ai/zh-CN/tools/creating-skills): Read before scaffolding or rewriting a skill structure.
- [Skills](https://docs.openclaw.ai/zh-CN/tools/skills): Read before reasoning about discovery, packaging, or runtime expectations for a skill.
- [Skills 配置](https://docs.openclaw.ai/zh-CN/tools/skills-config): Read before editing skill discovery or registration config.
- [ClawHub](https://docs.openclaw.ai/zh-CN/tools/clawhub): Read before installing, publishing, or distributing skills through the hub workflow.

## Use This Reference When

- Creating or updating `SKILL.md`, `agents/openai.yaml`, or bundled skill resources.
- Deciding how a skill is discovered, enabled, or configured.
- Installing or publishing skills with OpenClaw tooling.
- Reviewing whether a repo's skill packaging matches the documented model.

## What To Extract

### Skill Structure

- Confirm the required files and metadata shape before editing the skill package.
- Confirm whether the task needs only `SKILL.md` or also references, scripts, or assets.
- Use the official examples before guessing naming or discovery behavior.

### Discovery And Config

- Read the config page before editing any skill config keys such as `skills.entries` or workspace-scoped registration.
- Copy the config shape from the docs rather than reconstructing it from memory.
- Treat local repo conventions as secondary to the documented config schema.

### Distribution

- Read ClawHub docs before installing or publishing a skill.
- Confirm the exact CLI flow and packaging expectations from the docs page.
- If the task is about repository-local release automation, also read [clawhub-publishing.md](clawhub-publishing.md).
- If a repo mixes local skills and hub-installed skills, inspect both the docs and the local configuration.

## Practical Checks

- Validate `SKILL.md` frontmatter and agent metadata after edits.
- Read `tools/creating-skills` before changing folder layout or trigger description behavior.
- Read `tools/skills-config` before editing config files that enable or mount skills.
- Read `tools/clawhub` before changing install/publish instructions or release flows.
