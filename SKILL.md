---
name: stella-selfie
description: Generate persona-consistent selfie images and send to any OpenClaw channel. Supports Gemini and fal providers, multi-reference avatar blending.
allowed-tools: Bash(npm:*) Bash(npx:*) Bash(openclaw:*) Bash(curl:*) Read Write
metadata:
  openclaw:
    requires:
      env:
        - GEMINI_API_KEY
      bins:
        - npx
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
make a pic of this person, but [user's context]. the person is taking a mirror selfie
```

### Mode 2: Direct Selfie

Best for: close-up portraits, location shots, emotional expressions

```
a close-up selfie taken by herself at [user's context], direct eye contact with the camera, looking straight into the lens, eyes centered and clearly visible, not a mirror selfie, phone held at arm's length, face fully visible
```

### Mode Selection Logic

| Keywords in Request | Auto-Select Mode |
|---------------------|------------------|
| outfit, wearing, clothes, dress, suit, fashion | `mirror` |
| cafe, restaurant, beach, park, city, location | `direct` |
| close-up, portrait, face, eyes, smile | `direct` |
| full-body, mirror, reflection | `mirror` |

Default mode when no keywords match: `mirror`

## Resolution Keywords

| User says | Resolution |
|-----------|-----------|
| (default) | `1K` |
| 2k, 2048, medium res, 中等分辨率 | `2K` |
| 4k, high res, ultra, 超清, 高分辨率 | `4K` |

## Step-by-Step Instructions

### Step 1: Collect User Input

Determine from the user's message:
- **User context**: What should the person be doing/wearing/where?
- **Mode** (optional): `mirror` or `direct` — auto-detect from keywords if not specified
- **Target channel**: Where to send (e.g., `#general`, `@username`, channel ID)
- **Channel provider** (optional): Which platform (discord, telegram, whatsapp, slack)
- **Resolution** (optional): 1K / 2K / 4K — default 1K
- **Count** (optional): How many images — default 1, only increase if explicitly requested

### Step 2: Generate Image

Run the Stella script:

```bash
npx ts-node {baseDir}/scripts/stella.ts \
  --prompt "<ASSEMBLED_PROMPT>" \
  --target "<TARGET_CHANNEL>" \
  --channel "<CHANNEL_PROVIDER>" \
  --caption "<CAPTION_TEXT>" \
  --resolution "<1K|2K|4K>" \
  --count <NUMBER>
```

**Assembled prompt examples:**

Mirror mode:
```
make a pic of this person, but wearing a red dress at a rooftop party. the person is taking a mirror selfie
```

Direct mode:
```
a close-up selfie taken by herself at a cozy cafe with warm lighting, direct eye contact with the camera, looking straight into the lens, eyes centered and clearly visible, not a mirror selfie, phone held at arm's length, face fully visible
```

### Step 3: Confirm Result

After the script completes, confirm to the user:
- Image was generated successfully
- Image was sent to the target channel
- If any error occurred, report it directly

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Required (if Provider=gemini) | Google Gemini API key |
| `FAL_KEY` | Required (if Provider=fal) | fal.ai API key |
| `OPENCLAW_GATEWAY_TOKEN` | Required | OpenClaw gateway auth token |

## Skill Environment Options

Configure in your OpenClaw `openclaw.json` under `skills.entries.stella-selfie.env`:

| Option | Default | Description |
|--------|---------|-------------|
| `Provider` | `gemini` | Image provider: `gemini` or `fal` |
| `AvatarBlendEnabled` | `true` | Enable multi-reference avatar blending |
| `AvatarMaxRefs` | `3` | Maximum number of reference images to blend |

> **Note for `Provider=fal` users**: fal's image editing API only accepts HTTP/HTTPS image URLs. Local file paths (from `Avatar` / `AvatarsDir`) are not supported. Configure `AvatarsURLs` in `IDENTITY.md` with public URLs of your reference images to enable image editing with fal.

## User Configuration

Before using this skill, you must configure your OpenClaw workspace. See `templates/IDENTITY.fragment.md` and `templates/SOUL.fragment.md` for the recommended configuration snippets to add to your `IDENTITY.md` and `SOUL.md`.

### Required: IDENTITY.md

Add the following fields to `~/.openclaw/workspace/IDENTITY.md`:

```markdown
Avatar: ./assets/avatar-main.png
AvatarsDir: ./avatars
AvatarMaxRefs: 3
AvatarsURLs: https://cdn.example.com/ref1.jpg, https://cdn.example.com/ref2.jpg
```

- `Avatar`: Path to your primary reference image (relative to workspace root)
- `AvatarsDir`: Directory containing multiple reference photos of the same character (different styles, scenes, outfits)
- `AvatarMaxRefs`: Maximum reference images to blend (optional, default 3)
- `AvatarsURLs`: Comma-separated public URLs of reference images — required for `Provider=fal` (local files are not supported by fal's API)

### Required: avatars/ Directory

Place your reference photos in `~/.openclaw/workspace/avatars/`:
- Use `jpg`, `jpeg`, `png`, or `webp` format
- All photos should be of the same character
- Different styles, scenes, outfits, and expressions work best
- Images are selected by creation time (newest first)

### Required: SOUL.md

Add the Stella capability block to `~/.openclaw/workspace/SOUL.md`. See `templates/SOUL.fragment.md` for the recommended snippet.

## Installation

```bash
clawhub install stella-selfie
```

After installation, complete the configuration steps above before using the skill.
