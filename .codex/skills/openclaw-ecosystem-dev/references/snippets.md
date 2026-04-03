# OpenClaw Starter Snippets

Use these as starting shapes only. Always reconcile the final version with the official docs and the target repository's conventions.

## Minimal Skill Frontmatter

```md
---
name: my-skill
description: Explain what the skill does and when to use it. Mention the concrete OpenClaw artifact or workflow it supports.
---
```

## Skill Trigger Pattern

```md
## Overview

State the capability in one or two sentences.

## Route The Task

- Read the smallest matching reference first.
- Inspect the owning local artifact before editing.

## Execute In Order

1. Classify the request.
2. Read the owning docs page.
3. Inspect the local file that implements the concept.
4. Apply the change.
5. Validate with the nearest test or CLI check.
```

## Minimal Plugin Manifest Shape

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "0.1.0",
  "description": "Short plugin description.",
  "entry": "dist/index.js",
  "skills": ["skills/my-skill"]
}
```

Add `configSchema` only when the plugin truly exposes configuration. Read the manifest docs before adding any extra keys.

## Minimal Plugin Entry Pattern

```ts
export default {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '0.1.0',
  description: 'Short plugin description.',
  register(api: {
    registerTool: (tool: unknown, options?: { optional?: boolean }) => void;
    registerHook?: (
      events: string | string[],
      handler: (...args: unknown[]) => unknown,
      options?: { name?: string; description?: string },
    ) => void;
  }) {
    api.registerTool(makePrimaryTool());
    if (typeof api.registerHook === 'function') {
      api.registerHook('event:name', async () => undefined, {
        name: 'my-hook',
        description: 'Short hook description.',
      });
    }
  },
};
```

## Bundled Skill Contract Pattern

When a plugin ships a skill that routes to plugin tools, keep the contract explicit:

```md
## First Rule

Call `my_tool` before giving a factual answer in this domain.

## This Skill Does

- Detect intent
- Choose tool inputs
- Align the final answer with tool results

## This Skill Does Not Do

- Re-implement runtime persistence
- Simulate tool output
- Invent state that the plugin did not return
```

## Package.json Checklist Snippet

```json
{
  "main": "dist/index.js",
  "files": ["dist", "skills", "openclaw.plugin.json"],
  "scripts": {
    "build": "tsc",
    "verify": "npm run build && npm test"
  },
  "openclaw": {
    "extensions": ["./dist/index.js"]
  }
}
```

## ClawHub Publish Script Pattern

Use a script wrapper when the repo publishes repeatedly or needs preflight checks:

```json
{
  "scripts": {
    "publish:clawhub": "node ./scripts/release-clawhub.mjs"
  }
}
```

Recommended behavior for `scripts/release-clawhub.mjs`:

- Run the nearest verification command before publishing.
- Read the default version from `package.json` when the skill project has one.
- Pin `--workdir` to the repo root so `clawhub publish` does not depend on the caller's current directory.
- Publish the intended skill folder, often `.` for a dedicated skill repo.
- Prefer `clawhub` if installed, otherwise fall back to `npx -y clawhub`.
- Surface registry-side errors clearly instead of swallowing stderr.

## .clawhubignore Pattern

Use `.clawhubignore` to ship only runtime-required skill files. Default to excluding maintainer-only material.

```gitignore
# VCS and editor noise
.git/
.github/
.vscode/
.idea/
.DS_Store
**/.DS_Store

# Local state and dependencies
node_modules/
coverage/
out/
sandbox/
.env
.env.*

# Maintainer-only files
docs/
tests/
.gitignore
.clawhubignore
README.md
package-lock.json
yarn.lock
pnpm-lock.yaml
scripts/release-clawhub.mjs
```

Then verify the remaining tree is only the skill's runtime contract, typically some combination of:

- `SKILL.md`
- `agents/openai.yaml`
- `references/**`
- `scripts/**` that are executed by the skill at runtime
- `assets/**`

## Validation Prompt Pattern

Use this shape when you need to sanity-check an ecosystem artifact:

```text
Use $openclaw-ecosystem-dev before editing this OpenClaw skill/plugin task. First identify which docs page owns the artifact, then inspect the local manifest/skill entrypoint, then make the smallest compatible change and verify it.
```
