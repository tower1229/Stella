# Local Repo Checklists

## Use This Reference When

- The task targets a concrete OpenClaw repository rather than a greenfield design.
- You need to decide which local files to inspect before editing.
- You need a fast pre-flight check for a hybrid package that mixes plugin code and bundled skills.

## Inspect In This Order

1. Read `package.json` to confirm package name, output path, scripts, packed files, and any `openclaw` extension registration.
2. Read `openclaw.plugin.json` if present to confirm plugin identity, `entry`, bundled `skills`, and config schema.
3. Read the main plugin entrypoint such as `index.ts` or `src/index.ts` to confirm how tools and hooks are registered.
4. Read bundled skills such as `skills/*/SKILL.md` to confirm the runtime contract the plugin expects the agent to follow.
5. Read tests touching tools, hooks, runtime, or smoke flows before refactoring behavior.

## Plugin Package Checklist

- Confirm `package.json.main` matches the built entry file.
- Confirm `package.json.files` includes everything needed at publish/install time:
  - built output such as `dist`
  - bundled skills
  - `openclaw.plugin.json`
  - user-facing docs if the package intends to ship them
- Confirm `package.json.scripts` exposes at least build and verification commands.
- Confirm `openclaw.plugin.json.entry` points at the built JS file, not TS source.
- Confirm `openclaw.plugin.json.skills` paths actually exist in the published tree.
- Confirm the plugin id/name/version are consistent across manifest, package metadata, and source constants when the repo centralizes them.

## Skill Package Checklist

- Confirm every bundled skill has a valid `SKILL.md` and, if used, `agents/openai.yaml`.
- Confirm the skill description explains both what it does and when it should trigger.
- Confirm the skill does not re-implement runtime responsibilities that belong in tools, hooks, or plugin code.
- Confirm bundled references are split by task so the agent can load only the needed file.
- If the repo publishes to ClawHub, confirm `.clawhubignore` excludes maintainer-only files and keeps only runtime-required skill files.
- If the repo exposes a `publish:clawhub` script, confirm it pins `--workdir` and publishes the intended skill directory.

## Hybrid Repo Checklist

Use this when a repo ships both plugin code and skills, like a plugin that bundles routing guidance.

- Confirm the plugin manifest points at the bundled skill path.
- Confirm the skill instructs the agent to call plugin-provided tools rather than simulate them.
- Confirm source registration and skill guidance use the same tool names.
- Confirm tests cover the runtime behavior the skill assumes.
- Confirm packaging includes both built runtime code and the skill folder.

## Timeline Repo Example

The current timeline plugin repo is a good example of a hybrid package. Its minimum inspection set is:

- `package.json`: build, test, verify, and package scripts; `files`; `main`; `openclaw.extensions`
- `openclaw.plugin.json`: plugin metadata, built entry, bundled `skills/timeline`, and `configSchema`
- `index.ts`: tool registration, optional tools, and hook registration
- `skills/timeline/SKILL.md`: routing rules that force `timeline_resolve` before factual answers

## Verification Order

1. Run the fastest structural check first: file existence, manifest paths, frontmatter validity.
2. Run typecheck/build next if the repo is compiled.
3. Run targeted unit tests for touched tools/hooks/runtime modules.
4. Run smoke or packaging checks last if the repo provides them.
