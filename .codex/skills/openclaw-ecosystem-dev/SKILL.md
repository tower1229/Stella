---
name: openclaw-ecosystem-dev
description: Automatically use this skill for OpenClaw ecosystem development work. Consult official OpenClaw documentation before designing, implementing, reviewing, debugging, packaging, or publishing anything related to OpenClaw. Trigger when the task mentions OpenClaw or openclaw, `openclaw.plugin.json`, `SKILL.md`, `agents/openai.yaml`, skills, plugins, plugin manifests, agent tools, hooks, cron jobs, ClawHub, system prompt, context, agent workspace, sessions, session tools, memory, tool integration, or `openclaw` CLI commands such as `openclaw hooks`, `openclaw cron`, and skill/plugin setup.
---

# OpenClaw Ecosystem Dev

## Overview

Use this skill as a documentation router for OpenClaw ecosystem work. Read the smallest relevant reference file first, then inspect repository-local artifacts once the owning concept is clear.

## Route The Task

- For prompt assembly, context layering, agent workspace boundaries, sessions, session tools, memory, and built-in tool semantics, read [references/core-concepts.md](references/core-concepts.md).
- For creating, packaging, registering, or distributing OpenClaw skills, read [references/skills.md](references/skills.md).
- For publishing a skill to ClawHub, adding `publish:clawhub`, or defining `.clawhubignore`, read [references/clawhub-publishing.md](references/clawhub-publishing.md).
- For plugin architecture, `openclaw.plugin.json`, and plugin-provided agent tools, read [references/plugins.md](references/plugins.md).
- For hooks, cron jobs, delivery behavior, and scheduling choices, read [references/automation.md](references/automation.md).
- For repo-local implementation review, packaging checks, and file-by-file inspection order, read [references/local-checklists.md](references/local-checklists.md).
- For minimal starter snippets for skills and plugins, read [references/snippets.md](references/snippets.md).

## Execute In Order

1. Classify the request into `core concepts`, `skills`, `plugins`, or `automation`.
2. Read only the matching reference file first. Read additional references only if the task crosses boundaries.
3. If the task involves a real repository, read [references/local-checklists.md](references/local-checklists.md) before touching files.
4. Inspect repo-local artifacts that implement the same concept, such as `SKILL.md`, `openclaw.plugin.json`, hook/tool source files, or automation config.
5. Apply the change using the official docs as the source of truth for semantics and the local repo as the source of truth for project conventions.
6. Verify with the most direct check available: schema validation, existing tests, or the relevant `openclaw` CLI command.

## Working Rules

- Prefer official OpenClaw docs over memory when behavior, config keys, packaging details, or CLI semantics matter.
- Cite the exact docs page when giving architectural advice or explaining why a field or command is needed.
- Do not paste large documentation blocks into the conversation. Pull only the sections required for the current task.
- When the repo and docs appear to differ, record the discrepancy and keep the repo-compatible change unless the user explicitly asks for an upgrade or migration.
- Read the owning page before editing the owning artifact:
  - `plugins/manifest` before editing `openclaw.plugin.json`
  - `plugins/agent-tools` before exposing plugin tools
  - `tools/creating-skills` and `tools/skills-config` before packaging or registering a skill
  - `automation/hooks` or `automation/cron-jobs` before adding automation behavior

## Local Artifacts To Inspect

- Skill projects: `SKILL.md`, `agents/openai.yaml`, `references/`, bundled scripts/assets, and any skill config files.
- Plugin projects: `openclaw.plugin.json`, plugin entrypoints, tool registry code, generated schema helpers, and package metadata.
- Automation work: hook directories, cron config or CLI usage, delivery/channel configuration, and gateway-related runtime files.
- Runtime behavior: files touching prompt assembly, context injection, session management, memory, or tool wiring.

## Reuse Before Rewriting

- Use [references/snippets.md](references/snippets.md) for minimal starting shapes instead of inventing manifest keys or skill frontmatter from scratch.
- If the current repo already contains a working OpenClaw artifact, prefer adapting that artifact over introducing a second pattern.
