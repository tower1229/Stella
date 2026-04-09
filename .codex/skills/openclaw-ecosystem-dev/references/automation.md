# OpenClaw Automation

## Source Map

- [Hooks](https://docs.openclaw.ai/zh-CN/automation/hooks): Read before adding or debugging hook-based automation.
- [定时任务](https://docs.openclaw.ai/zh-CN/automation/cron-jobs): Read before adding cron jobs, delivery rules, or session selection.
- [定时任务与心跳对比](https://docs.openclaw.ai/zh-CN/automation/cron-vs-heartbeat): Read when choosing between precise scheduling and heartbeat-style checks.

## Use This Reference When

- Implementing or debugging hooks.
- Adding one-shot reminders or recurring cron automation.
- Choosing between main-session delivery and isolated-session work.
- Investigating why scheduled work did not run or delivered to the wrong place.

## What To Extract

### Hooks

- Read the hooks page before editing hook structure, lifecycle expectations, or eligibility requirements.
- Use the documented CLI to inspect runtime state:
  - `openclaw hooks list`
  - `openclaw hooks info <hook-name>`
  - `openclaw hooks check`
- Treat hook docs as the authority for installation and debugging flow.

### Cron Jobs

- Read the cron page before editing schedule syntax, `--at` vs `--cron`, or session mode.
- Use the docs to choose `main` versus `isolated` session behavior and delivery options such as announce/channel routing.
- When debugging, check the documented gateway API surface and failure modes before changing application logic.

### Cron Vs Heartbeat

- Use cron for precise scheduling, isolated execution, or tasks that should run without the main conversation staying active.
- Use heartbeat-style logic when the task should piggyback on an existing active agent/session rather than create standalone schedule state.
- Read the comparison page before implementing the wrong automation primitive.

## Practical Checks

- Confirm cron is enabled and the gateway is running before debugging "nothing runs" failures.
- Confirm timezone assumptions before declaring a scheduler bug.
- Prefer isolated sessions for heavy or noisy recurring jobs unless the task explicitly needs main-session context.
