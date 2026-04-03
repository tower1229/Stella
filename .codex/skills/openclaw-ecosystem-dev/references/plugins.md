# OpenClaw Plugins

## Source Map

- [插件](https://docs.openclaw.ai/zh-CN/tools/plugin): Read before changing plugin architecture, entrypoints, or packaging.
- [插件清单](https://docs.openclaw.ai/zh-CN/plugins/manifest): Read before editing `openclaw.plugin.json` or any manifest-derived fields.
- [插件智能体工具](https://docs.openclaw.ai/zh-CN/plugins/agent-tools): Read before exposing plugin-provided tools to the agent runtime.

## Use This Reference When

- Creating or updating an OpenClaw plugin package.
- Editing `openclaw.plugin.json` or reviewing manifest correctness.
- Implementing or debugging plugin-provided tools.
- Explaining how a plugin should connect to the OpenClaw tool/runtime model.

## What To Extract

### Architecture

- Confirm the documented plugin directory structure before adding new entrypoints.
- Confirm which behavior belongs in the plugin entrypoint, manifest, or tool provider.
- Distinguish plugin concerns from skill concerns before editing both in the same repo.

### Manifest

- Read the manifest page before changing required fields, metadata, capabilities, or tool declarations.
- Treat `openclaw.plugin.json` as a schema-owned file: do not guess keys or field semantics.
- Keep local naming and versioning consistent with the repo once the documented field shape is confirmed.

### Agent Tools

- Read the agent-tools page before adding read-only or mutating tools.
- Confirm how tools are registered, described, and surfaced to the runtime.
- Use the docs to decide whether a behavior belongs in a tool, a hook, or ordinary plugin code.

## Practical Checks

- Inspect `openclaw.plugin.json` and the plugin entrypoint side by side after reading the docs.
- Reconcile tool names, descriptions, and permissions with the agent-tools documentation.
- If a repo includes both plugin code and skill code, read both this file and [skills.md](skills.md) before changing shared metadata or packaging.
