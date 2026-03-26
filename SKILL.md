---
name: stella-selfie
description: Generate persona-consistent selfie images and send to any OpenClaw channel. Supports Gemini, fal, and laozhang.ai providers, multi-reference avatar blending.
allowed-tools: Bash(npm:*) Bash(node:*) Bash(openclaw:*) Read Write
metadata:
  openclaw:
    requires:
      env:
        - GEMINI_API_KEY
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
- User asks "what are you doing?", "where are you?", "你在哪里？", "你在干嘛？"
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

### Mode Selection Logic

| Signal                                                        | Auto-Select Mode |
| ------------------------------------------------------------- | ---------------- |
| Keywords: outfit, wearing, clothes, dress, suit, fashion      | `mirror`         |
| Keywords: cafe, restaurant, beach, park, city, location       | `direct`         |
| Keywords: close-up, portrait, face, eyes, smile               | `direct`         |
| Keywords: full-body, mirror, reflection                       | `mirror`         |
| Timeline `continuity.is_continuing: true` (same activity)    | `direct`         |
| Timeline `continuity.is_continuing: false` (state just changed) | `mirror`       |

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
- **Mode** (optional): `mirror` or `direct` — auto-detect from keywords if not specified
- **Target channel**: Where to send (e.g., `#general`, `@username`, channel ID)
- **Channel provider** (optional): Which platform (discord, telegram, whatsapp, slack)
- **Resolution** (optional): 1K / 2K / 4K — default 1K
- **Count** (optional): How many images — default 1, only increase if explicitly requested
- **Has explicit scene?**: Does the request contain any specific scene/outfit/location/activity keywords?

### Step 2: Enrich with Timeline Context (Optional)

**Only run this step when the request has no explicit scene keywords** (no outfit, location, activity, or scene description).

If `timeline_resolve` is available in the current environment, call it:

```
timeline_resolve({ query: "现在" })
```

Parse the result:

- If `result.consumption.selfie_ready` exists and `result.consumption.fact.status === "resolved"`:
  - Extract: `location`, `activity`, `emotion`, `appearance`, `time_of_day`, `summary`
  - Also read: `result.consumption.fact.continuity` for mode selection
  - Also read: `result.episodes[0].world_hooks` for atmosphere hints (if available)
  - Proceed to Step 3 with timeline context
- If timeline returns `fact.status === "empty"`, or `timeline_resolve` is not available, or any error occurs:
  - Proceed to Step 3 without timeline context (fallback to default behavior)

**Never block image generation on timeline availability.** Timeline enrichment is best-effort.

### Step 3: Assemble Prompt

#### When timeline context is available (`selfie_ready` resolved)

Build the prompt from `selfie_ready` fields:

```
A [mode] selfie of this person, [activity] at [location], wearing [appearance], [time_of_day] lighting, with a [emotion] expression.
```

Apply atmosphere hints from `world_hooks` if present:

| `world_hooks` condition                        | Add to prompt                                      |
| ---------------------------------------------- | -------------------------------------------------- |
| `weekday: false` (weekend)                     | "relaxed weekend vibe"                             |
| `holiday_key` is not null                      | Reference the holiday atmosphere naturally         |
| `weekday: true` + `time_of_day: "evening"`     | "soft warm indoor light, slightly tired but calm"  |

Apply mode from continuity if not overridden by keywords:

- `continuity.is_continuing: true` → use `direct` (candid, mid-activity)
- `continuity.is_continuing: false` → use `mirror` (showcasing new state)

**Example — timeline returns home study, evening, organizing work, focused, casual outfit, weekday:**

```
A mirror selfie of this person, organizing work files at her home study, wearing a casual home outfit, soft warm indoor light, slightly tired but calm, with a focused expression.
```

**Example — timeline returns cafe, afternoon, reading, content, light summer dress, weekend:**

```
A direct selfie of this person, reading at a cozy cafe, wearing a light summer dress, afternoon lighting, relaxed weekend vibe, with a content expression.
```

#### When timeline context is unavailable (fallback)

Use the user's explicit context directly, or generate a neutral prompt:

```
A mirror selfie of this person, [user's explicit context if any], showing full body reflection.
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

### Step 5: Confirm Result

After the script completes, confirm to the user:

- Image was generated successfully
- Image was sent to the target channel
- If any error occurred, send a concise actionable failure message

## Environment Variables

`metadata.openclaw.requires` is reserved for strict load-time gates. Stella's default runtime path uses
`Provider=gemini`, so `GEMINI_API_KEY` is declared as the minimal required credential. The variables below are
documented runtime inputs; some are conditional and are only needed when enabling specific providers or send paths.

| Variable                 | Required                                                    | Description                 |
| ------------------------ | ----------------------------------------------------------- | --------------------------- |
| `GEMINI_API_KEY`         | Required (if Provider=gemini)                               | Google Gemini API key       |
| `FAL_KEY`                | Required (if Provider=fal)                                  | fal.ai API key              |
| `LAOZHANG_API_KEY`       | Required (if Provider=laozhang)                             | laozhang.ai API key (`sk-xxx`); get it at [api.laozhang.ai](https://api.laozhang.ai) |
| `OPENCLAW_GATEWAY_TOKEN` | Required (for sending via OpenClaw Gateway / HTTP fallback) | OpenClaw gateway auth token |
| `OPENCLAW_GATEWAY_URL`   | Optional                                                    | Local OpenClaw gateway URL; must stay on localhost |
| `Provider`               | Optional                                                    | Image provider: `gemini`, `fal`, or `laozhang` |
| `AvatarBlendEnabled`     | Optional                                                    | Enable or disable multi-reference avatar blending |
| `AvatarMaxRefs`          | Optional                                                    | Maximum number of reference images to blend |

Credential requirements are provider-specific:

- Default `Provider=gemini`: requires `GEMINI_API_KEY`
- `Provider=fal`: requires `FAL_KEY`
- `Provider=laozhang`: requires `LAOZHANG_API_KEY`
- Sending path always requires `OPENCLAW_GATEWAY_TOKEN`
- HTTP fallback only supports `OPENCLAW_GATEWAY_URL` on `localhost` / `127.0.0.1` / `::1`

## Media File Handling (Gemini)

When `Provider=gemini`, Stella writes generated files to:

- `~/.openclaw/workspace/stella-selfie/`

After successful send, Stella deletes the local file immediately. If send fails, the file is kept for debugging.

## Skill Environment Options

Configure in your OpenClaw `openclaw.json` under `skills.entries.stella-selfie.env`:

| Option               | Default  | Description                                 |
| -------------------- | -------- | ------------------------------------------- |
| `Provider`           | `gemini` | Image provider: `gemini`, `fal`, or `laozhang` |
| `AvatarBlendEnabled` | `true`   | Enable multi-reference avatar blending      |
| `AvatarMaxRefs`      | `3`      | Maximum number of reference images to blend |

> **Note for `Provider=fal` users**: fal's image editing API only accepts HTTP/HTTPS image URLs. Local file paths (from `Avatar` / `AvatarsDir`) are not supported. Configure `AvatarsURLs` in `IDENTITY.md` with public URLs of your reference images to enable image editing with fal.

> **Note for `Provider=laozhang` users**: laozhang.ai uses the Google-native Gemini API format (`gemini-3-pro-image-preview`). It accepts both local file paths (from `Avatar` / `AvatarsDir`) and HTTP/HTTPS URLs (from `AvatarsURLs`). When `AvatarsURLs` is configured, URLs take priority over local files. Supports 1K/2K/4K resolution and 10 aspect ratios. Get your API key at [api.laozhang.ai](https://api.laozhang.ai) — remember to configure a billing mode in the token settings before use.

## Gateway Safety

- Stella sends via `openclaw message send` first.
- HTTP fallback is restricted to a local OpenClaw gateway on `localhost` / `127.0.0.1` / `::1`.
- Do not point `OPENCLAW_GATEWAY_URL` to remote endpoints; remote delivery should be handled by your OpenClaw installation itself, not by this skill override.

## External Endpoints And Data Flow

| Endpoint / path | When used | Data sent |
| --- | --- | --- |
| Google Gemini API | `Provider=gemini` | Prompt text and selected local reference images from `Avatar` / `AvatarsDir` |
| fal API | `Provider=fal` | Prompt text and public reference image URLs from `AvatarsURLs` |
| laozhang.ai API (`api.laozhang.ai`) | `Provider=laozhang` | Prompt text and reference images (local files as base64, or public URLs from `AvatarsURLs`) |
| Local OpenClaw gateway (`OPENCLAW_GATEWAY_URL`) | Only when `openclaw message send` is unavailable | Target channel, target id, caption text, and generated media path/URL |

## Security And Privacy

- Stella reads `~/.openclaw/workspace/IDENTITY.md` and local avatar files to build reference context.
- Under `Provider=gemini`, selected local avatar images are uploaded to Gemini as part of normal image generation.
- Under `Provider=fal`, only public `http/https` avatar URLs are sent; local avatar files are not uploaded to fal directly.
- Under `Provider=laozhang`, if `AvatarsURLs` is configured, public URLs are sent directly; otherwise, local avatar files are base64-encoded and uploaded to laozhang.ai.
- Generated files (Gemini and laozhang) are written to `~/.openclaw/workspace/stella-selfie/` and deleted after successful send.

## User Configuration

Before using this skill, you must configure your OpenClaw workspace. See `templates/SOUL.fragment.md` for the recommended capability snippet to add to your `SOUL.md`.

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

### Required: avatars/ Directory

Place your reference photos in `~/.openclaw/workspace/avatars/`:

- Use `jpg`, `jpeg`, `png`, or `webp` format
- All photos should be of the same character
- Different styles, scenes, outfits, and expressions work best
- Images are selected by creation time (newest first)

### Required: SOUL.md

Add the Stella capability block to `~/.openclaw/workspace/SOUL.md`. See README.md ("4. SOUL.md") for the copy/paste snippet.

## Installation

```bash
clawhub install stella-selfie
```

After installation, complete the configuration steps above before using the skill.
