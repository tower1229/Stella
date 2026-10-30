---
name: stella-selfie
description: Generate persona-consistent selfie images and send to any OpenClaw channel. Supports Gemini, fal, and laozhang.ai providers, multi-reference avatar blending.
allowed-tools: Bash(npm:*) Bash(node:*) Bash(openclaw:*) Read Write
metadata:
  openclaw:
    always: true
    requires:
      env:
        - GEMINI_API_KEY
        - FAL_KEY
        - LAOZHANG_API_KEY
      bins:
        - node
    install:
      - kind: node
        package: "@google/genai"
      - kind: node
        package: "@fal-ai/client"
    primaryEnv: GEMINI_API_KEY
    emoji: "📸"
    homepage: https://github.com/tower1229/Stella
---

# Stella Selfie

Generate persona-consistent selfie images using Google Gemini or fal (xAI Grok Imagine) and send them to messaging channels via OpenClaw. Supports multi-reference avatar blending for strong character consistency.

## When to Use

- User says "send a pic", "send me a photo", "send a selfie", "发张照片", "发自拍"
- User says "show me what you look like...", "send a pic of you...", "展示你在..."
- User describes a scene: "send a pic wearing...", "send a pic at...", "穿着...发张图"
- User wants the agent to appear in a specific outfit, location, or situation

## Prompt Modes

### Mode 1: Mirror Selfie (default)

Best for: outfit showcases, full-body shots, fashion content

```
A mirror selfie of this person, [user's context], showing full body reflection.
```

### Mode 2: Direct Selfie

Best for: close-up portraits, location shots, emotional expressions

```
A selfie of this person, [user's context], looking into the lens.
```

### Mode 3: Third-Person Photo

Best for: non-selfie viewpoints, including explicit third-person requests and scenes that should not read as a selfie

```
A natural third-person photo of this person, [user's context], natural composition, not a selfie.
```

### Mode Selection Logic

| Signal | Auto-Select Mode |
| ------ | ---------------- |
| Strong user keywords: outfit, wearing, clothes, dress, suit, fashion | `mirror` |
| Strong user keywords: full-body, mirror, reflection, pose, show the look | `mirror` |
| Strong user keywords: selfie, close-up, portrait, face, eyes, smile, looking into the lens | `direct` |
| Strong user keywords: third-person, not a selfie, candid shot, 他拍, 路拍, 抓拍 | `third_person` |
| Legacy keywords: travel photo, tourist photo, 旅拍, 打卡照, 风景合影 | `third_person` |

Default policy:

- Interpret explicit user requirements first: camera style, outfit emphasis, body framing, scene, pose, and expression.
- Use `mirror` by default for outfit / full-body / self-presentation requests, even if the user did not explicitly mention a mirror.
- Use `direct` by default for selfie requests focused on face, emotion, immediacy, or in-the-moment presence.
- Use `third_person` only when the user explicitly asks for a non-selfie style or clearly describes a shot that should not read as a selfie.

Default mode when no keywords match and timeline is unavailable: `mirror`

## Resolution Keywords

| User says                           | Resolution |
| ----------------------------------- | ---------- |
| (default)                           | `1K`       |
| 2k, 2048, medium res, 中等分辨率    | `2K`       |
| 4k, high res, ultra, 超清, 高分辨率 | `4K`       |

## Step-by-Step Instructions

### Step 1: Collect User Input

Determine from the user's message:

- **Explicit context** (optional): scene, outfit, location, activity — detect from keywords
- **Mode** (optional): `mirror`, `direct`, or `third_person` — auto-detect from explicit user intent if not specified
- **Target channel**: Where to send (e.g., `#general`, `@username`, channel ID)
- **Channel provider** (optional): Which platform (discord, telegram, whatsapp, slack)
- **Resolution** (optional): 1K / 2K / 4K — default 1K
- **Count** (optional): How many images — default 1, only increase if explicitly requested
- **Has explicit scene?**: Does the request contain any specific scene/outfit/location/activity keywords?

### Step 2: Enrich with Timeline Context Or Recent Scene Recall

`timeline_resolve` is an optional enhancement, not a prerequisite.

- If `timeline_resolve` is unavailable in the current environment, skip this step and proceed with Stella's default behavior.
- If the request is a current-state `Sparse` prompt — for example "发张自拍", "发张照片", "想看看你", "send a selfie", "send a photo", "show me what you look like" — and `timeline_resolve` is available, load and follow `references/timeline-integration.md`.
- If the current request clearly refers back to a single recently resolved timeline scene in the current conversation, load and follow `references/timeline-integration.md` even if the photo request itself is not Sparse.
- If the user already provided a clear standalone scene, outfit, location, activity, or camera requirement and it is not a callback to a recently resolved timeline scene, do not use timeline enhancement. Follow the default policy directly.
- When you do call `timeline_resolve`, do not freely rewrite the request into output-slot questions. Use the fixed query rules in `references/timeline-integration.md`.
- Only enable Nano Banana real-world grounding when the prompt can explicitly include a concrete `city` plus an exact local date/time anchor from timeline data. If those anchors are missing, do not claim real-world synchronization.
- If timeline returns `fact.status === "empty"`, is missing `result.consumption`, or any error occurs, immediately fall back to Step 3 without mentioning timeline failure to the user.

**If timeline context is unavailable, use the normal scene defaults and keep the existing configuration and safety checks.** Timeline enrichment is best-effort and should only be used for current-state Sparse prompts or explicit callbacks to a recently resolved timeline scene.

### Step 3: Assemble Prompt

Select mode from the default policy first.

If the request is Sparse, and you loaded `references/timeline-integration.md` and obtained usable timeline context, apply its Sparse-only merge and prompt rules.

When that timeline enrichment includes outdoor real-world grounding, keep the grounding clause as a separate strong instruction sentence rather than a soft atmosphere phrase like `Make it feel like...`.

Otherwise, use the user's explicit context directly and keep Stella's original fallback behavior:

```
[mirror]  A mirror selfie of this person, [user's explicit context if any], showing full body reflection.
[direct]  A selfie of this person, [user's explicit context if any], looking into the lens.
[third_person] A natural third-person photo of this person, [user's explicit context if any], natural composition, not a selfie.
```

### Step 4: Generate Image

Run the Stella script:

```bash
node {baseDir}/dist/scripts/skill.js \
  --prompt "<ASSEMBLED_PROMPT>" \
  --target "<TARGET_CHANNEL>" \
  --channel "<CHANNEL_PROVIDER>" \
  --caption "<CAPTION_TEXT>" \
  --resolution "<1K|2K|4K>" \
  --count <NUMBER>
```

To also keep persistent copies, append `--save-dir "<COPY_DIRECTORY>"` when a save directory is requested. The directory is created if needed; relative paths resolve from the script's working directory. Omit this option to keep the default behavior.

### Step 5: Confirm Result

After the script completes, confirm to the user:

- Image was generated successfully
- Image was sent to the target channel
- When `--save-dir` was used, report each absolute path printed as `[stella] Saved image copy: <absolute path>`.
- A `SAVE_FAILED` warning means only that a copy could not be saved. Report that separately from generation and delivery; do not regenerate the image to retry saving.
- If any error occurred, send a concise actionable failure message

## Environment Variables

Stella supports multiple providers and a gateway-backed send path, so its sensitive runtime environment variables
are explicitly declared in `metadata.openclaw.requires.env` for OpenClaw's env-injection allowlist.
The skill also sets `metadata.openclaw.always: true`, so these declarations do not become hard load-time gates.
Actual credential validation remains runtime-driven inside `skill.js`, based on the selected provider.

| Variable             | Required                        | Description                                                                          |
| -------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| `GEMINI_API_KEY`     | Required (if Provider=gemini)   | Google Gemini API key                                                                |
| `FAL_KEY`            | Required (if Provider=fal)      | fal.ai API key                                                                       |
| `LAOZHANG_API_KEY`   | Required (if Provider=laozhang) | laozhang.ai API key (`sk-xxx`); get it at [api.laozhang.ai](https://api.laozhang.ai) |
| `Provider`           | Optional                        | Image provider: `gemini`, `fal`, or `laozhang`                                       |
| `AvatarBlendEnabled` | Optional                        | Enable or disable multi-reference avatar blending                                    |
| `AvatarMaxRefs`      | Optional                        | Maximum number of reference images to blend                                          |
| `AvatarAllowedRoots` | Optional                        | JSON array of absolute directories authorized for local reference images             |

Credential requirements are provider-specific:

- Default `Provider=gemini`: requires `GEMINI_API_KEY`
- `Provider=fal`: requires `FAL_KEY`
- `Provider=laozhang`: requires `LAOZHANG_API_KEY`

## Media File Handling

When `Provider=gemini` or `Provider=laozhang`, Stella writes generated files to:

- `~/.openclaw/workspace/stella-selfie/`

After successful send, Stella deletes the local file immediately. If send fails, the file is kept for debugging.

With `--save-dir "<COPY_DIRECTORY>"`, Stella saves a separate copy of each image before sending and prints its absolute path. Copies use unique names and exclusive creation so existing files are never overwritten, even when the save directory is the provider's temporary directory. Copies remain after delivery and temporary-file cleanup, including when sending fails.

For `Provider=fal`, this option downloads each generated HTTP/HTTPS URL to a local copy, with a 60-second download timeout. Delivery still uses the original URL. Without this option, Stella does not download fal images.

An unwritable directory, copy/write error, or failed/interrupted download produces an independent `SAVE_FAILED` warning. Stella continues delivery without calling the image provider again. Only successfully saved copies produce a saved-path line; failed partial copies are removed when possible. Check delivery errors separately.

## Skill Environment Options

Configure in your OpenClaw `openclaw.json` under `skills.entries.stella-selfie.env`:

| Option               | Default  | Description                                    |
| -------------------- | -------- | ---------------------------------------------- |
| `Provider`           | `gemini` | Image provider: `gemini`, `fal`, or `laozhang` |
| `AvatarBlendEnabled` | `true`   | Enable multi-reference avatar blending         |
| `AvatarMaxRefs`      | `3`      | Maximum number of reference images to blend    |

> **Note for `Provider=fal` users**: fal's image editing API only accepts HTTP/HTTPS image URLs. Local file paths (from `Avatar` / `AvatarsDir`) are not supported. Configure `AvatarsURLs` in `IDENTITY.md` with public URLs of your reference images to enable image editing with fal.

> **Note for `Provider=laozhang` users**: laozhang.ai uses the Google-native Gemini API format (`gemini-3.1-flash-image-preview`). It requires local reference images from `Avatar` / `AvatarsDir` and does not use `AvatarsURLs`. Supports 1K/2K/4K resolution and 10 aspect ratios. Get your API key at [api.laozhang.ai](https://api.laozhang.ai) — remember to configure a billing mode in the token settings before use.

## Delivery Path

- Stella sends via `openclaw message send`.
- Delivery auth and routing are handled by the local OpenClaw installation, not by skill-level gateway tokens.

## External Endpoints And Data Flow

| Endpoint / path                     | When used           | Data sent                                                                            |
| ----------------------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| Google Gemini API                   | `Provider=gemini`   | Prompt text and selected local reference images from `Avatar` / `AvatarsDir`         |
| fal API                             | `Provider=fal`      | Prompt text and public reference image URLs from `AvatarsURLs`                       |
| laozhang.ai API (`api.laozhang.ai`) | `Provider=laozhang` | Prompt text and local reference images (`Avatar` / `AvatarsDir`, uploaded as base64) |
| Local OpenClaw CLI                  | Always for delivery | Target channel, target id, caption text, and generated media path/URL                |

## Security And Privacy

- Stella reads `~/.openclaw/workspace/IDENTITY.md` and local avatar files to build reference context.
- Under `Provider=gemini`, selected local avatar images are uploaded to Gemini as part of normal image generation.
- Under `Provider=fal`, only public `http/https` avatar URLs are sent; local avatar files are not uploaded to fal directly.
- Under `Provider=laozhang`, local avatar files from `Avatar` / `AvatarsDir` are base64-encoded and uploaded to laozhang.ai.
- Generated files (Gemini and laozhang) are written to `~/.openclaw/workspace/stella-selfie/` and deleted after successful send.
- Optional copies saved with `--save-dir` remain in the requested directory for later reading; manage their retention yourself.

## User Configuration

Before using this skill, you must configure your OpenClaw workspace. See `{baseDir}/templates/SOUL.fragment.md` for the recommended capability snippet to add to your `SOUL.md`.

### Required: IDENTITY.md

Add the following fields to `~/.openclaw/workspace/IDENTITY.md`:

```markdown
Avatar: ./assets/avatar-main.png
AvatarsDir: ./avatars
AvatarsURLs: https://cdn.example.com/ref1.jpg, https://cdn.example.com/ref2.jpg
```

- `Avatar`: Path to your primary reference image (relative to workspace root)
- `AvatarsDir`: Directory containing multiple reference photos of the same character (different styles, scenes, outfits)
- `AvatarsURLs`: Comma-separated public URLs of reference images — required for `Provider=fal` (local files are not supported by fal's API)

Local references must be regular JPEG, PNG or WebP files, at most 20 MiB each, with a recognized image signature. Both the primary avatar and blended references are validated again before upload; filename extensions alone are insufficient. The default allowed roots are the workspace's `avatars/` and `assets/` directories. Paths or symlinks escaping those roots are rejected.

For a custom directory, explicitly set `AvatarAllowedRoots` in `skills.entries.stella-selfie.env` to a JSON array of absolute directory paths. This replaces the default roots. Choose image directories you intend to upload to the selected provider; changing `IDENTITY.md` alone does not authorize another directory.

```json
{ "AvatarAllowedRoots": "[\"/absolute/path/to/approved-avatars\"]" }
```

Saved image copies are limited to 20 MiB and checked for a recognized image signature. Remote copies require public HTTP(S) addresses, validate DNS on the socket connection, and reject redirects. A failed copy still reports `SAVE_FAILED` and continues delivery without regenerating an image.

### Required: avatars/ Directory

Place your reference photos in `~/.openclaw/workspace/avatars/`:

- Use `jpg`, `jpeg`, `png`, or `webp` format
- All photos should be of the same character
- Different styles, scenes, outfits, and expressions work best
- Images are selected by creation time (newest first)

### Optional: SOUL.md

Optionally add the capability block from `{baseDir}/templates/SOUL.fragment.md` to your workspace's `SOUL.md` after reviewing it. The template ships with the installed skill.

## Installation

```bash
clawhub install stella-selfie
```

After installation, complete the configuration steps above before using the skill.

Use Node.js 20 or newer (required by the Gemini SDK), then install the runtime SDK dependencies from the skill directory:

```bash
cd {baseDir}
npm install --omit=dev
```
