# Stella - [中文说明](README_CN.md)

Help OpenClaw generate persona-consistent selfie images with stable quality. Stella supports three providers: [Google Gemini (`gemini-3-pro-image-preview`)](https://aistudio.google.com/app/api-keys), [fal (xAI Grok Imagine)](https://fal.ai/dashboard/keys), and [laozhang.ai (`gemini-3-pro-image-preview`)](https://api.laozhang.ai/token). Multi-reference avatar blending is available to improve character consistency.

## Installation

```bash
clawhub install stella-selfie
```

> Or download the package from [ClawHub](https://clawhub.ai/skills/stella-selfie) and install it manually.

After installation, complete the configuration steps below before using the skill.

## Configuration

### 1. OpenClaw `openclaw.json`

Configure everything under `skills.entries.stella-selfie.env` in `~/.openclaw/openclaw.json` (provider keys + reference image options).

```json5
{
  skills: {
    entries: {
      "stella-selfie": {
        enabled: true,
        env: {
          // Required when Provider=gemini. For other providers, set to any placeholder value.
          GEMINI_API_KEY: "your_gemini_api_key",
          // Required when Provider=fal. For other providers, set to any placeholder value.
          FAL_KEY: "your_fal_api_key",
          // Required when Provider=laozhang. For other providers, set to any placeholder value.
          LAOZHANG_API_KEY: "sk-your_laozhang_api_key",

          // Optional
          Provider: "gemini",
          AvatarBlendEnabled: "true",
          AvatarMaxRefs: "3",
        },
      },
    },
  },
}
```

> **Sandbox tip**: If OpenClaw runs in a Docker sandbox, host-side `skills.entries.*.env` injection does not automatically propagate into the container. Also set the same environment variables in `agents.defaults.sandbox.docker.env` (or per-agent sandbox env).

| Option               | Default  | Description                                                                                                                                                      |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Provider`           | `gemini` | Image generation provider: `gemini`, `fal`, or `laozhang`                                                                                                       |
| `AvatarBlendEnabled` | `true`   | Whether to enable multi-reference blending (`false` ignores `AvatarsDir` and only uses `Avatar`; if `Avatar` is unavailable, generation is rejected)          |
| `AvatarMaxRefs`      | `3`      | Maximum number of reference images to blend (detailed behavior depends on your `IDENTITY.md` setup below)                                                     |

> **Note for `Provider=fal`**: fal image editing APIs only accept HTTP/HTTPS image URLs, not local file paths. To edit with fal, configure `AvatarsURLs` in `IDENTITY.md` with publicly accessible image URLs.

> **Note for `Provider=laozhang`**: laozhang.ai uses the native Google Gemini API format (`gemini-3.1-flash-image-preview`). It requires local reference images from `Avatar` / `AvatarsDir` (same behavior as `Provider=gemini`) and does not use `AvatarsURLs`.

### 2. IDENTITY.md

Add the following fields to `~/.openclaw/workspace/IDENTITY.md`:

```markdown
Avatar: avatars/avatar-main.png
AvatarsDir: avatars/
AvatarsURLs: https://cdn.example.com/ref1.jpg, https://cdn.example.com/ref2.jpg
```

- `Avatar`: Avatar image path (used as the primary reference image)
- `AvatarsDir`: Additional reference image directory (same character, different styles/scenes/outfits); required and used when `AvatarBlendEnabled=true` and `Provider=gemini | laozhang`
- `AvatarsURLs`: Public URLs for reference images, separated by English commas; required when `Provider=fal`

### 3. Reference Images (`avatars/` directory)

Put reference photos under the path configured by `AvatarsDir`:

- Supported formats: `jpg` / `jpeg` / `png` / `webp`
- All photos should be of the same character
- Different styles, scenes, and expressions improve consistency (as long as it is the **same person with stable key traits**)
- Images are selected by creation time (newest first), up to `AvatarMaxRefs`

### 4. SOUL.md

Copy and paste the following content into `~/.openclaw/workspace/SOUL.md`:

```markdown
## Image Capability

You have a physical appearance and can take selfies and photos.

Use the `stella-selfie` skill whenever the user asks for a picture of you — including but not limited to:
"send a pic", "send a selfie", "send me a photo", "show me what you look like", "发张照片", "发自拍"
```

## Usage

After configuration, talk to your OpenClaw agent in natural language:

- "Send a selfie"
- "Send a photo in a cafe"
- "Show me what you look like on the beach"
- "Send a rooftop party photo, 2K resolution"

### Supported Resolutions

| User says                           | Resolution |
| ----------------------------------- | ---------- |
| (default)                           | `1K`       |
| 2k, 2048, medium res, 中等分辨率    | `2K`       |
| 4k, high res, ultra, 超清, 高分辨率 | `4K`       |

### Reference Image Setup

To generate highly consistent character images, reference image setup is critical. Use Gemini or laozhang as the provider, set `AvatarBlendEnabled=true`, configure `AvatarsDir`, and place reference images of the same person there. At least three reference images are recommended for stronger identity consistency.

### Integration with `stella-timeline-plugin`

When the user has already clearly asked for a selfie or photo, but does not provide an explicit scene request (for example, just "send a selfie"), or only gives a partial scene such as "send a selfie by the window" or "send a photo outside", Stella can use the sibling plugin [`stella-timeline-plugin`](https://www.npmjs.com/package/stella-timeline-plugin) for context completion:

`stella-timeline-plugin` gives OpenClaw time awareness and continuity memory, so it can produce plausible and concrete descriptions for "this moment" or "that moment." In short, it first checks the memory system. If nothing is found, it combines OpenClaw's [persona setup](https://clawhub.ai/tower1229/persona-skill) (`SOUL` + `MEMORY` + `IDENTITY`) to weave a reasonable memory and preserve continuity. This creates a strong synergy with Stella.

- Session continuity: if you were just discussing something with OpenClaw, the selfie can naturally continue that scene, as if it were really experiencing it.
- Real memory integration: the system prioritizes memory retrieval (session + long-term + short-term) and turns real events into concrete visual context.
- Memory weaving: if no memory exists for the target time, it proactively creates a harmless, persona-consistent memory to maintain immersion.
- Partial-scene completion: as long as the user has already made the image intent clear, even requests like "send one from now", "by the window", or "outside somewhere" can be completed with reality anchors like location, activity, emotion, appearance, and time of day.
- Same-moment continuity: if chat says she is organizing files in her study, the selfie can stay in that study, in that mood, in that same-day outfit, instead of jumping to a disconnected generic scene.
- Richer scene details: timeline can contribute grounded props and spatial cues like a window seat, desk clutter, coffee cups, railings, books, or street-side details, making the image feel casually real instead of template-like.
- More natural light and framing: "afternoon in a cafe" can mean window backlight, warm indoor spill, mirror framing, or candid travel-photo composition. Timeline helps Stella choose a more believable visual language.
- Atmosphere adaptation: schedules, weekends, holidays, and social context can influence outfit, mood, and scene energy; persona traits also shape how the character feels across different moments.
- Real-world anchors: when timeline can provide a concrete city, date, and local time, Stella can pass those anchors to NanoBanana2 so outdoor scenes, or indoor scenes with visible outdoors, feel like they were really captured in that place at that moment.
- Real-world consistency: thanks to NanoBanana2's real-world perception, outdoor weather can sync with real-world conditions. Clothing is influenced by season, climate, and activity type, while same-day indoor outfits remain stable instead of changing randomly.
- Indoor/outdoor boundary awareness: if the subject is indoors by a window, the outdoors can stay weather-accurate while the outfit remains indoor-appropriate; if the subject is truly outside, weather can influence clothing much more directly.
- User intent stays first: if the user already specified the outfit, location, or style, timeline should not override it. It mainly fills the missing realistic details that make the final image feel more alive.
- Camera behavior: continuity scenes use selfie mode, while state-shift scenes use mirror mode or tourist mode.

Stella still works normally without `stella-timeline-plugin`; you just will not get these integration effects.

The detailed consumption and prompt-assembly rules for optional timeline enrichment live in [docs/timeline-integration.md](docs/timeline-integration.md).

## Failure Experience

When generation fails, Stella tries to send a short text notice to the same target. If the delivery path is available, this avoids a silent "no response" experience.

Common notification scenarios:

- Missing keys (`GEMINI_API_KEY` / `FAL_KEY` / `LAOZHANG_API_KEY`)
- Rate limits or temporary upstream outages (retry later)
- Safety interception (rewrite the prompt)
- fal reference image URL is not accessible (must be a public `http/https` image URL)

## Media File Handling (Gemini / laozhang)

When `Provider=gemini` or `Provider=laozhang`, generated images are written to:

- `~/.openclaw/workspace/stella-selfie/`

After each image is sent successfully, Stella immediately deletes the local file.

- If sending fails, the file is retained for troubleshooting.
- If deletion fails, Stella only logs a warning and continues.

## Security Notes

- Stella reads local reference files from `~/.openclaw/workspace/IDENTITY.md` and `~/.openclaw/workspace/avatars/`.
- Generated images are written to `~/.openclaw/workspace/stella-selfie/` and deleted only after successful delivery.
- The send path uses only `openclaw message send`.

## Direct Script Testing (without OpenClaw)

If you want to run script tests directly (without OpenClaw), you must provide environment variables manually, because OpenClaw normally injects them at runtime.

```bash
# Install dependencies
npm install

# Build runtime artifacts
npm run build

# Run the skill main entry directly
node dist/scripts/skill.js --prompt "test prompt" --target "@user" --channel "telegram"

# Smoke test: makes real API calls and saves images to ./out
npm run smoke
```

> **Note**: `.env.local` in the project root is only for local development/script testing. When running as an OpenClaw skill, it is recommended to provide keys via `~/.openclaw/openclaw.json` (or process environment variables), and OpenClaw injects them during each agent run.

## Unit Tests

```bash
npm test
```

The project includes multiple unit test suites covering the identity parser, avatar selector, Gemini provider, fal provider, sender, skill runtime, and more. All tests use mocks and do not call real APIs.

```bash
npm run test:watch   # watch mode
```

## Project Structure

```
Stella/
├── SKILL.md                  # ClawHub skill definition
├── scripts/
│   ├── skill.ts              # Skill main entry
│   ├── identity.ts           # IDENTITY.md parser
│   ├── avatars.ts            # Reference image selector
│   ├── smoke.ts              # Local smoke script entry
│   ├── release-clawhub.mjs   # ClawHub publish script
│   ├── sender.ts             # OpenClaw sender
│   └── providers/
│       ├── gemini.ts         # Gemini provider
│       ├── fal.ts            # fal.ai provider
│       └── laozhang.ts       # laozhang.ai provider
├── tests/                    # Unit tests (vitest)
│   └── providers/            # Provider unit tests
├── smoke/
│   └── avatars/              # Smoke test reference images
└── docs/
    └── timeline-integration.md # Optional timeline enrichment rules
```
