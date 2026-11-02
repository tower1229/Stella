# Stella Selfie — [简体中文](README_CN.md)

Help OpenClaw generate **persona-consistent** photos of the assistant — the same face, the same character, not a random new person each time.

Three modes, multiple local references, Google's official native image provider. Say “send a selfie” and get one photo in the current conversation. A same-host plugin gets one image Buffer and owns preview, storage and publishing.

|                   Direct selfie                  |                   Mirror selfie                  |                 Third-person photo                |
| :--------------------------------------------: | :--------------------------------------------: | :--------------------------------------------: |
| ![Direct Selfie](./assets/Direct%20Selfie.jpg) | ![Mirror Selfie](./assets/Mirror%20Selfie.jpg) | ![Third-Person Photo](./assets/Third-Person%20Photo.jpg) |

Default: `google/gemini-3-pro-image`, 2K, one image, no aspect ratio. Stella does not keep a generated-image backup, even when an extra copy is explicitly requested.

## Installation

```bash
clawhub install stella-selfie
```

> Or download the package from [ClawHub](https://clawhub.ai/skills/stella-selfie) and install it manually.

Verified with OpenClaw 2026.10.9. Use a compatible host that exposes `image_generate`, provider inventory and Agent resolvers, plus a host-supported Node version (baseline `>=24.22.1 <25` or `>=26.12.1`). The runtime has no npm dependencies. Configure the selected Agent's native Google provider/auth through OpenClaw; old skill-only keys are not migrated automatically.

Install in the intended host / profile / workspace scope. The initiating turn needs `image_generate`, file writing for the request JSON, process execution for reference preparation/cleanup, and access to the actual Agent workspace.

> **Windows PowerShell**: prefix a full Node executable path with `&`, and delete request files with `Remove-Item -LiteralPath`. Finish preparation/cleanup processes before advancing; a process-completion notice is not an image-completion event.

## Configuration

### 1. OpenClaw `openclaw.json`

Put non-sensitive values under `skills.entries.stella-selfie.config`:

```json
{
  "model": "google/gemini-3-pro-image",
  "AvatarBlendEnabled": true,
  "AvatarMaxRefs": 3
}
```

| Option | Default | Description |
| --- | --- | --- |
| `model` | `google/gemini-3-pro-image` | A Google image model declared by the host native provider |
| `AvatarBlendEnabled` | `true` | Blend extra references from `AvatarsDir`. `false` uses only the main `Avatar` |
| `AvatarMaxRefs` | `3` | Maximum local references to blend (current Google host max is 5) |
| `AvatarAllowedRoots` | workspace `assets/` and `avatars/` | Nonempty absolute-directory array that **replaces** the defaults |

`AvatarBlendEnabled` / `AvatarMaxRefs` / `AvatarAllowedRoots` still accept legacy env values. Precedence: config → process env → skill env → defaults. Outward symlinks/junctions do not authorize their targets.

### 2. IDENTITY.md

In the actual Agent workspace:

```markdown
Avatar: ./assets/avatar-main.png
AvatarsDir: ./avatars
```

- `Avatar`: primary reference. One valid local image is enough.
- `AvatarsDir`: extra references of the **same person** in different styles, scenes and outfits. Optional.

`AvatarsURLs` is ignored. Use authorized local files only.

### 3. Reference images

Drop photos into `AvatarsDir`:

- JPEG / PNG / WebP, valid signatures, at most 20 MiB each
- Same character, stable key traits
- Variety in style, scene, outfit and expression improves consistency
- Main Avatar first, realpath-deduplicated; extras newest first (`birthtime`, then `mtime` / `ctime`)

Chat snapshots keep the validated input, but the native image tool may resize or re-encode references before upload, changing dimensions, format and fine detail. Original-byte upload is not guaranteed. Host media limits are separate from Stella's 20 MiB check and the requested output resolution. The in-process plugin path passes validated buffers directly to the runtime, without that chat-tool optimization.

### 4. Optional SOUL.md

Keep your own persona files. Merge `templates/SOUL.fragment.md` only if useful:

```markdown
## Image Capability

You can use the `stella-selfie` skill to generate persona-consistent selfies and photos.
When the user requests a picture of you, use their requested scene and camera style.
Examples: "send a pic", "send a selfie", "show me what you look like", "发张照片", "发自拍".

Follow the skill's configuration, image validation and delivery rules. If configuration
is incomplete, explain what is missing before generating or sending an image.
```

## Usage

Talk to the agent in natural language:

- “Send a selfie” — default mirror, or an eligible timeline scene
- “Send a cafe window selfie, 4K”
- “Send a third-person photo, 3:4”
- “Show me what you look like on the beach”

Explicit captions stay in the conversation reply, outside the image prompt.

### Resolutions

| User says | Resolution |
| --- | --- |
| (default), 2k, 2048, medium res, 中等分辨率 | `2K` |
| 1k, low res, 低分辨率 | `1K` |
| 4k, high res, ultra, 超清, 高分辨率 | `4K` |

Include an aspect ratio only when the user asked for one. Stella never infers it from the prompt.

### Timeline continuity

When the user makes a `Sparse` current-state request — “send a selfie”, “send a photo”, “show me what you look like now” — or clearly refers back to one recently resolved scene in this conversation, Stella can use `timeline_resolve` if it is available:

- **Same-moment continuity**: if chat says she is organizing work in her study, the photo can stay in that study, that outfit, that state.
- **Sparse prompts can bloom**: place, activity, mood, outfit and time of day can fill in, so you do not have to write the full prompt.
- **Details that feel casually snapped**: window seats, desk props, street railings, coffee cups — instead of a hollow template.
- **Light and framing**: the same “afternoon at a cafe” can be window backlight, warm indoor light, or a handheld close-up.
- **Your wording wins**: a clear standalone scene, outfit, location, activity or camera request is used as-is. Timeline does not take over.
- Works without timeline; you just will not get these extras.

Timeline is optional and best-effort. Missing or failed data falls back to normal defaults. City/date/time anchors are scene context, not proof of live weather; Stella enables no search-grounding tool. Full rules: [timeline integration](references/timeline-integration.md).

The helper validates references and supplies native `image_generate` arguments. Chat uses the current conversation's actual Agent ID; chat has no main fallback. The host generates asynchronously and delivers to this conversation. Input snapshots are released in the initiating turn after the tool reads them. Failed preparation cleans up files it created, including partial writes; incomplete cleanup reports the directory for explicit cleanup. No polling, second send, cross-channel target, batch or Stella retry. Host attachments follow host retention; Stella does not promise they stay forever.

## Same-host plugin

Need the photo as bytes for preview, storage or publishing? Call `generateForPlugin`. The caller supplies the Stella skill directory and an optional `agentId` (exact `main` when omitted; missing bindings fail). This plugin default does not apply to chat. The adapter resolves the actual Agent identity, workspace and auth directory, calls `api.runtime.imageGeneration.generate` once, and returns `Buffer` + MIME or a safe error with generation outcome. Stella creates no material ID, path or persistent file.

See [the in-process adapter guide](references/plugin-integration.md). Calling plugins live outside this repository.

## 2.0 notes

Retired: fal / laozhang, provider SDKs and skill-specific key install, the old sender, `channel` / `target` / `--save-dir` / `count`, generated-image backups and material-library management. `Provider=gemini` is accepted for migration; other legacy `Provider` values must be removed. Repeated requests are new generations.

```sh
npm ci
npm run build
npm test
npm run smoke -- --agent main
npm run sync:local -- --agent main
# Or choose an installation scope:
npm run sync:local -- --skills-dir /absolute/path/to/skills
npm run release:clawhub -- --prepare-only
```

Smoke only prepares/releases references for the three modes; it does not generate images or incur generation charges. Sync copies the runtime allowlist and retains user files, without WSL or runtime npm installation. Persona files are not synchronized. If CLI discovery fails, set `OPENCLAW_CLI_PATH` to the installed `openclaw.mjs`.

Release staging includes runtime files and a SHA256 manifest; preparing does not publish. Design and verification: [design](docs/google-native-design.md), [verification](docs/native-verification.md).

Official references: [image generation](https://docs.openclaw.ai/tools/image-generation), [plugin runtime](https://docs.openclaw.ai/plugins/sdk-runtime/media#api-runtime-imagegeneration), [skills config](https://docs.openclaw.ai/tools/skills-config).
