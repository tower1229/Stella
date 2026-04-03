# OpenClaw Core Concepts

## Source Map

- [系统提示词](https://docs.openclaw.ai/zh-CN/concepts/system-prompt): Read before changing prompt assembly, role behavior, or runtime-vs-prompt responsibilities.
- [上下文](https://docs.openclaw.ai/zh-CN/concepts/context): Read before reasoning about what the agent sees in-context and what is injected automatically.
- [智能体工作区](https://docs.openclaw.ai/zh-CN/concepts/agent-workspace): Read before assuming filesystem layout, persistence, or per-agent isolation.
- [会话](https://docs.openclaw.ai/zh-CN/concepts/session): Read before designing multi-session flows, state handoff, or session-aware behavior.
- [会话工具](https://docs.openclaw.ai/zh-CN/concepts/session-tool): Read before calling or exposing session-management tools.
- [记忆](https://docs.openclaw.ai/zh-CN/concepts/memory): Read before implementing recall, persistence, or memory-backed behavior.
- [工具](https://docs.openclaw.ai/zh-CN/tools): Read before changing tool exposure, permissions, or tool expectations.

## Use This Reference When

- A task changes how OpenClaw constructs model input.
- A feature depends on what survives across turns, sessions, or agents.
- The repo touches memory, session orchestration, or tool injection.
- The user asks for the boundary between prompt, runtime, memory, and tools.

## What To Extract

### Prompt And Context Boundary

- Confirm what belongs in the system prompt and what belongs in runtime or tool logic.
- Confirm which context layers are automatic and which are app- or repo-specific.
- Avoid encoding behavior in prompt text if the docs place it in runtime, memory, or tools.

### Workspace And Session Boundary

- Confirm whether the task acts inside the current agent workspace, another session, or an isolated session.
- Use session docs before designing shared state or session handoff.
- Use session-tool docs before inventing custom orchestration or spawn/switch semantics.

### Memory And Tool Boundary

- Confirm whether the feature should use session state, persisted memory, or an explicit tool call.
- Use tool results as the authoritative source when docs define a tool for that fact domain.
- Use memory docs before storing or retrieving long-lived facts.

## Practical Checks

- Before adding "remembered" behavior, decide whether it should come from memory, session state, or a tool.
- Before using relative paths or temp files, confirm the agent workspace lifecycle and isolation model.
- Before adding orchestration features, confirm whether session tools already define the control flow.
- Before editing tool policy or tool docs, read the top-level tools page and then the owning concept page.
