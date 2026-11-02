# Stella Selfie

[简体中文](README_CN.md)

Persona-consistent photos for OpenClaw through Google's official native image provider. Ordinary requests deliver one attachment to the current conversation. A same-host plugin receives one image Buffer through the official runtime and owns preview, storage and publishing.

Stella keeps mirror, direct selfie and third-person photo modes, optional timeline continuity, explicit captions, 1K/2K/4K and multiple local references. Default: google/gemini-3-pro-image, 2K, one image, no aspect ratio. Stella creates no generated-image backup, including explicitly requested extra copies.

## Installation

Verified with OpenClaw 2026.10.9. Use a compatible host exposing image_generate, provider inventory and Agent resolvers, and a host-supported Node version (baseline >=24.22.1 <25 or >=26.12.1).

Install in the intended host/profile/workspace scope:

```sh
clawhub install stella-selfie
```

The runtime has no npm dependencies. Configure the selected Agent's native Google provider/auth through OpenClaw; old skill-only keys are not automatically migrated. The initiating turn needs image_generate, file writing for request JSON, process execution for reference preparation/cleanup, and access to the actual Agent workspace.

In Windows PowerShell, prefix a full Node executable path with `&` and clean request files with `Remove-Item -LiteralPath`. Finish preparation/cleanup processes before advancing; a process-completion notice is not an image-completion event.

Configure IDENTITY.md in that workspace:

```markdown
Avatar: ./assets/avatar-main.png
AvatarsDir: ./avatars
```

One valid reference is sufficient; AvatarsDir is optional. Keep your own persona files; merge templates/SOUL.fragment.md only if useful.

## Settings

Use skills.entries.stella-selfie.config for non-sensitive values:

```json
{
  "model": "google/gemini-3-pro-image",
  "AvatarBlendEnabled": true,
  "AvatarMaxRefs": 3
}
```

Optional AvatarAllowedRoots is a nonempty absolute-directory array **replacing** defaults. Default roots are assets and avatars inside the actual Agent workspace; outward symlinks/junctions do not authorize their targets.

AvatarBlendEnabled/AvatarMaxRefs/AvatarAllowedRoots retain legacy support: config → process env → skill env → defaults. Blend disabled uses only the main Avatar. Main first, realpath deduplication, extras newest first (birthtime, then mtime/ctime), default max three, current Google max five. References must be regular JPEG/PNG/WebP files with valid signatures, at most 20 MiB each.

Chat snapshots preserve the validated input, but the native image tool may resize or re-encode references before upload, changing dimensions, format and fine detail. Original-byte upload is not guaranteed. Host media limits and optimization are separate from Stella's 20 MiB validation and the requested output resolution. The in-process plugin path passes validated buffers directly to the runtime without chat-tool optimization.

## Use

- “发张自拍” — default mirror or an eligible timeline scene.
- “发张窗边的自拍，4K” — explicit scene and resolution.
- “发张第三人称照片，3:4” — third-person photo and explicit aspect ratio.
- Explicit captions stay in the conversation reply, outside the image prompt.

Timeline is optional and best-effort. Only Sparse current-state requests or clear callbacks to one recently resolved scene use it. Explicit standalone scenes take priority; missing or failed timeline data uses normal defaults. Location/time anchors do not prove real-time weather; Stella enables no search-grounding tool.

The helper validates references and supplies native image_generate arguments. The host generates asynchronously and delivers to the requesting conversation. Input snapshots are released in the initiating turn after the tool reads them. Failed preparation cleans up files it created, including partial writes; incomplete cleanup reports the directory for explicit cleanup. No polling, second send, cross-channel target, batch or Stella retry. Host attachments follow host retention, with no Stella promise of permanent availability.

## Same-host plugin

Follow [the in-process adapter guide](references/plugin-integration.md). The caller supplies the Stella skill directory and an optional agentId; absent means exactly main, missing bindings fail. The adapter resolves the actual Agent identity/workspace/auth directory, calls api.runtime.imageGeneration.generate once, and returns Buffer + MIME or a safe error with generation outcome. It creates no material ID, path, content description or persistent file.

## Migration and development

Retired: fal/laozhang, provider SDKs and skill-specific key installation, old sender, channel/target/save-dir/count flags, generated-image backups and material-library management. AvatarsURLs is ignored; use authorized local references. Provider=gemini is accepted for migration; other legacy Provider values must be removed or migrated. Repeated requests are new generations.

```sh
npm ci
npm run build
npm test
npm run smoke -- --agent main
npm run sync:local -- --agent main
# Alternatively, explicitly choose an installation scope:
npm run sync:local -- --skills-dir /absolute/path/to/skills
npm run release:clawhub -- --prepare-only
```

Smoke only prepares/releases references for three modes; it does not generate images or incur generation charges. Sync copies the runtime allowlist and retains user files, without WSL or runtime npm installation. Persona files are not synchronized. If CLI discovery fails, set OPENCLAW_CLI_PATH to the installed openclaw.mjs.

Release staging includes runtime files and a SHA256 manifest; preparing does not publish. See [design](docs/google-native-design.md) and [verification](docs/native-verification.md) for scope. Calling plugins are outside this repository.

Official references: [image generation](https://docs.openclaw.ai/tools/image-generation), [plugin runtime](https://docs.openclaw.ai/plugins/sdk-runtime/media#api-runtime-imagegeneration), [skills config](https://docs.openclaw.ai/tools/skills-config).
