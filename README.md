# Stella — [中文说明](README_CN.md)

Help OpenClaw reliably generate **persona-consistent** selfie images. It supports three modes—direct selfie, mirror selfie, and tourist photo—and lets you configure multiple reference images to enhance character consistency.

|                   Direct selfie                  |                   Mirror selfie                  |                   Tourist photo                  |
| :--------------------------------------------: | :--------------------------------------------: | :--------------------------------------------: |
| ![Direct Selfie](./assets/Direct%20Selfie.jpg) | ![Mirror Selfie](./assets/Mirror%20Selfie.jpg) | ![Tourist Photo](./assets/Tourist%20Photo.jpg) |

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

| Option               | Default  | Description                                                                                                                                          |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Provider`           | `gemini` | Image generation provider: `gemini`, `fal`, or `laozhang`                                                                                            |
| `AvatarBlendEnabled` | `true`   | Whether to enable multi-reference blending (`false` ignores `AvatarsDir` and only uses `Avatar`; if `Avatar` is unavailable, generation is rejected) |
| `AvatarMaxRefs`      | `3`      | Maximum number of reference images to blend (detailed behavior depends on your `IDENTITY.md` setup below)                                            |

> **Note for `Provider=fal`**: fal image editing APIs only accept HTTP/HTTPS image URLs, not local file paths. To edit with fal, configure `AvatarsURLs` in `IDENTITY.md` with publicly accessible image URLs.

> **Note for `Provider=laozhang`**: laozhang.ai uses the native Google Gemini API format (`gemini-3.1-flash-image-preview`). It requires local reference images from `Avatar` / `AvatarsDir` (same behavior as `Provider=gemini`) and does not use `AvatarsURLs`.

### 2. IDENTITY.md

Add the following fields to `~/.openclaw/workspace/IDENTITY.md`:

```markdown
- Avatar: avatars/avatar-main.png
- AvatarsDir: avatars/
- AvatarsURLs: https://cdn.example.com/ref1.jpg, https://cdn.example.com/ref2.jpg
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

When the user has already clearly asked for a selfie or photo—for example "send a selfie", "send a photo", or "show me what you look like now"—but does not specify a scene, or only gives a partial scene such as "send a selfie, by the window" or "a photo, outside", Stella can try invoking the sibling plugin [`stella-timeline-plugin`](https://www.npmjs.com/package/stella-timeline-plugin) for context completion:

`stella-timeline-plugin` gives OpenClaw time awareness and continuous memory, so OpenClaw can offer plausible, concrete descriptions for "this moment" or "that moment" at any time. That pairs especially well with Stella.

- **Real memory integration**: prioritize memory retrieval (session + long-term + short-term) and turn what actually happened into concrete visual context.
- **Memory weaving**: if there is no memory for the target time, proactively weave a persona-consistent, harmless memory—fully safe, but much more immersive.
- **Partial prompts still work**: as long as the image intent is clear—for example "a selfie from right now", "a photo by the window", or "something outside"—timeline can still fill in key reality anchors such as place, activity, mood, outfit, and time of day, so you do not have to write the full prompt yourself.
- **Same-moment continuity**: if chat says she is organizing work in her study at home, the selfie can stay in that study, that outfit, that state, instead of jumping to an unrelated generic scene.
- **Richer, more believable details**: beyond place and activity, timeline can add window seats, desk props, street railings, book piles, coffee cups, and similar cues so the shot feels casually snapped rather than hollow and template-like.
- **More natural light and composition**: the same "afternoon at a cafe" can mean window backlight, warm indoor light, mirror selfie, or candid street capture—very different visual languages. Timeline can give Stella stable lighting and framing hints.
- **Atmosphere**: daily rhythm, weekends, holidays, and social context all influence outfit, expression, and scene mood; persona also shapes how the character feels across different events.
- **Real-world anchors**: when timeline can supply a concrete city, date, and local time, Stella can pass those anchors to NanoBanana2 so outdoor scenes, or indoor scenes where the outdoors is visible, feel like they were really taken in that city at that moment.
- **Real-world consistency**: thanks to NanoBanana2's real-world awareness, outdoor weather can stay in sync with reality. Outfits respond to season, climate, and activity, and same-day indoor looks stay continuous instead of changing at random.
- **Clearer indoor/outdoor boundaries**: if the subject is sitting indoors by a window, outside weather can stay realistic while clothing stays comfort-first indoors; if the subject is truly outside, outfit changes follow weather, wind, and temperature more strongly.
- **Respecting user intent**: if you already specified place, outfit, or style, timeline will not override it—it mainly fills the realistic details you did not mention but that the frame should still contain.
- **Shot mode**: continuity-heavy moments lean toward selfie mode; moments with a clear state shift fit mirror mode or tourist mode better—the same persona can naturally switch to what feels most authentic in context.

Of course, Stella works fine without `stella-timeline-plugin`; you just will not get these integration effects.

For detailed consumption and prompt-assembly rules for optional timeline enrichment, see [references/timeline-integration.md](references/timeline-integration.md).

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
│   ├── release-clawhub.mjs    # ClawHub publish script
│   ├── sender.ts             # OpenClaw sender
│   └── providers/
│       ├── gemini.ts         # Gemini provider
│       ├── fal.ts            # fal.ai provider
│       └── laozhang.ts       # laozhang.ai provider
├── tests/                    # Unit tests (vitest)
│   └── providers/            # Provider unit tests
├── smoke/
│   └── avatars/              # Smoke test reference images
└── references/
    └── timeline-integration.md   # Optional timeline enrichment rules
```
