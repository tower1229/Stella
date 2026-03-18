# Stella — [中文说明](README_CN.md)

Generate persona-consistent selfie images and send them to any OpenClaw channel. Supports Google Gemini and fal (xAI Grok Imagine) providers with multi-reference avatar blending.

## Installation

```bash
clawhub install stella-selfie
```

After installation, complete the configuration steps below before using the skill.

## Configuration

### 1. OpenClaw `openclaw.json`

Configure in your OpenClaw `~/.openclaw/openclaw.json` under `skills.entries.stella-selfie.env` (secrets + options in one place).

```json5
{
  skills: {
    entries: {
      "stella-selfie": {
        enabled: true,
        env: {
          // Required when Provider=gemini (default)
          GEMINI_API_KEY: "your_gemini_api_key",
          OPENCLAW_GATEWAY_TOKEN: "your_openclaw_gateway_token",
          // Only required when Provider=fal
          FAL_KEY: "your_fal_api_key",

          // Options
          Provider: "gemini",
          AvatarBlendEnabled: "true",
          AvatarMaxRefs: "3"
        }
      }
    }
  }
}
```

> **Sandbox note**: if you run OpenClaw in a sandbox (Docker), host `skills.entries.*.env` injection does not automatically apply inside the container. Configure sandbox envs under `agents.defaults.sandbox.docker.env` (or per-agent) as well.

| Option               | Default  | Description                                 |
| -------------------- | -------- | ------------------------------------------- |
| `Provider`           | `gemini` | Image provider: `gemini` or `fal`           |
| `AvatarBlendEnabled` | `true`   | Enable multi-reference avatar blending (when `false`, `AvatarsDir` is ignored and only `Avatar` is used as a reference; if `Avatar` is unavailable, generation runs without reference images) |
| `AvatarMaxRefs`      | `3`      | Maximum number of reference images to blend |

> **Note for `Provider=fal` users**: fal's image editing API only accepts HTTP/HTTPS image URLs. Local file paths are not supported. Configure `AvatarsURLs` in `IDENTITY.md` with public URLs of your reference images to enable image editing with fal.

### 2. IDENTITY.md

Add the following to `~/.openclaw/workspace/IDENTITY.md`:

```markdown
Avatar: ./assets/avatar-main.png
AvatarsDir: ./avatars
AvatarMaxRefs: 3
AvatarsURLs: https://cdn.example.com/ref1.jpg, https://cdn.example.com/ref2.jpg
```

- `Avatar`: Path to your primary reference image (relative to workspace root)
- `AvatarsDir`: Directory of additional reference photos (same character, different styles/scenes/outfits)
- `AvatarMaxRefs`: Max reference images to blend (optional, default 3)
- `AvatarsURLs`: Comma-separated public URLs of reference images — required for `Provider=fal` (local files are not supported by fal's API)

### 3. Reference Images (`avatars/` directory)

Place reference photos in `~/.openclaw/workspace/avatars/`:

- Supported formats: `jpg`, `jpeg`, `png`, `webp`
- All photos should be of the same character
- Different styles, scenes, outfits, and expressions work best for consistency
- Images are selected by creation time (newest first), up to `AvatarMaxRefs`

### 4. SOUL.md

Copy/paste the full Stella capability block from `templates/SOUL.fragment.md` into your `~/.openclaw/workspace/SOUL.md`.

## Usage

Once configured, use natural language with your OpenClaw agent:

- "Send me a selfie wearing a red dress"
- "Send a photo in a cozy cafe"
- "Show me what you look like at the beach"
- "Send a pic at a rooftop party, 2K resolution"

## Direct Script Testing

Test the script directly without going through OpenClaw. Since OpenClaw normally injects environment variables at runtime, you need to load them manually for local testing.

```bash
# Install dependencies
npm install

# Smoke test: real API calls, saves images to ./out
npm run smoke
```

> **Note**: The project-root `.env.local` file is only for local development. When running as an OpenClaw skill, secrets should be configured via `~/.openclaw/openclaw.json` (or your process environment), and OpenClaw injects them for the agent run.

## Unit Tests

```bash
npm test
```

Runs 32 unit tests covering all modules (identity parser, avatar selector, Gemini provider, fal provider, sender). All tests use mocks — no real API calls are made.

```bash
npm run test:watch   # Watch mode for development
```

## Project Structure

```
Stella/
├── SKILL.md                  # ClawHub skill definition
├── scripts/
│   ├── skill.ts              # Skill main entry point
│   ├── identity.ts           # IDENTITY.md parser
│   ├── avatars.ts            # Reference image selector
│   ├── smoke.ts              # Local smoke script entry
│   ├── release-clawhub.mjs    # ClawHub publish script
│   ├── sender.ts             # OpenClaw message sender
│   └── providers/
│       ├── gemini.ts         # Google Gemini provider
│       └── fal.ts            # fal.ai provider
├── tests/                    # Unit tests (vitest)
│   └── providers/            # Provider unit tests
├── templates/
│   └── SOUL.fragment.md      # SOUL.md configuration snippet
├── smoke/
│   └── avatars/              # Reference images for smoke testing
└── docs/
    ├── stella-research-notes.md
    └── clawhub-publish-checklist.md
```
