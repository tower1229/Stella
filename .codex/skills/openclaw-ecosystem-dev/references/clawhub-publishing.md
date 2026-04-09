# ClawHub Publishing

## Source Map

- [ClawHub](https://docs.openclaw.ai/zh-CN/tools/clawhub): Read before automating publish/install/sync flows or relying on exact CLI flags.

## Use This Reference When

- The task adds or updates a `publish:clawhub` script.
- The task needs a repeatable release flow for a skill repository.
- The task adds `.clawhubignore` so published content includes only runtime-required skill files.
- The user asks how to publish a skill to ClawHub from a repo rather than by hand.

## Official CLI Facts To Preserve

From the ClawHub docs:

- Publish command shape: `clawhub publish <path> --slug <slug> --name <name> --version <version>`.
- `--workdir <dir>` controls which workspace the CLI resolves against.
- `clawhub sync` exists for multi-skill backup/update flows, but `clawhub publish <path>` is the simpler single-skill primitive.
- Installed skills live under the workspace `skills` directory and take effect in the next OpenClaw session.

## Recommended Repository Pattern

For a dedicated skill repo, add a script wrapper instead of asking maintainers to type the full CLI each time.

### Package Script

Add a package script like:

```json
{
  "scripts": {
    "publish:clawhub": "node ./scripts/release-clawhub.mjs"
  }
}
```

### Release Script Responsibilities

Model the wrapper after the proven pattern used in local skill repos:

- Read the default version from `package.json`.
- Accept overrides such as `--version`, `--slug`, `--name`, `--tag`, and `--changelog`.
- Run tests or the nearest verification command before publish.
- Pin `--workdir` to the repo root to avoid cwd-sensitive publishing mistakes.
- Publish `.` when the repo root itself is the skill bundle.
- Prefer the installed `clawhub` binary and fall back to `npx -y clawhub` if it is missing.
- Print stdout/stderr directly and keep registry-side failure details visible.

### Suggested Argument Shape

The wrapper should eventually invoke something equivalent to:

```bash
clawhub --workdir <repo-root> publish . --slug <slug> --name <name> --version <version> --tags <tag> --changelog <text>
```

When the local binary is unavailable, the same arguments can be passed through `npx -y clawhub`.

## .clawhubignore Rules

Treat `.clawhubignore` as a release boundary. The default goal is to publish only files the installed skill needs at runtime.

### Exclude By Default

- VCS and editor metadata: `.git/`, `.github/`, `.vscode/`, `.idea/`
- Local artifacts: `node_modules/`, coverage, smoke output, temp directories
- Secrets and overrides: `.env`, `.env.*`
- Maintainer docs and tests: `docs/`, `tests/`, repo `README.md`, lockfiles when not runtime-required
- Release helpers not needed by the installed skill, such as `scripts/release-clawhub.mjs`

### Keep Only Runtime Dependencies

For a plain documentation skill, the published tree usually needs only:

- `SKILL.md`
- `agents/openai.yaml` if present
- `references/**`
- `assets/**` if used
- `scripts/**` only when the skill actually instructs the agent to execute them

### Review Rule

After writing `.clawhubignore`, mentally inspect the remaining bundle. If the published tree still contains files that are useful only to maintainers, tighten the ignore file again.

## Decision Rules

- If the repo is a dedicated skill repo, prefer `clawhub publish .` behind a script wrapper.
- If the repo contains multiple skill folders, prefer a script that targets the exact skill directory or consider `clawhub sync`.
- If the repo also contains plugin code or unrelated assets, be stricter with `.clawhubignore`; do not rely on humans remembering what not to ship.
- If the repo has no tests, replace "run tests" with the nearest deterministic check, such as a validator or a smoke command.

## Practical Review Checklist

- Confirm `publish:clawhub` exists in `package.json`.
- Confirm the release script reads defaults from project metadata instead of hardcoding every field.
- Confirm `--workdir` is pinned to the repo root.
- Confirm the published path is correct for the repository layout.
- Confirm `.clawhubignore` excludes release helpers, tests, docs, local state, and unrelated repo content.
- Confirm the remaining published files are exactly the skill runtime contract.
