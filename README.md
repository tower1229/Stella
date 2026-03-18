# Stella

Generate persona-consistent selfie images and send them to any OpenClaw channel. Supports Google Gemini and fal (xAI Grok Imagine) providers with multi-reference avatar blending.

## Installation

```bash
clawhub install stella-selfie
```

After installation, complete the configuration steps below before using the skill.

## Configuration

### 1. API Keys

Add to `~/.openclaw/.env.local` (or your OpenClaw environment config):

```bash
GEMINI_API_KEY=your_gemini_api_key       # Required for Provider=gemini (default)
FAL_KEY=your_fal_api_key                 # Required for Provider=fal
OPENCLAW_GATEWAY_TOKEN=your_token        # Required for HTTP fallback sending
```

### 2. Skill Environment Options

Configure in your OpenClaw `openclaw.json` under `skills.entries.stella-selfie.env`:

```json
{
  "skills": {
    "entries": {
      "stella-selfie": {
        "enabled": true,
        "env": {
          "Provider": "gemini",
          "AvatarBlendEnabled": "true",
          "AvatarMaxRefs": "3"
        }
      }
    }
  }
}
```

| Option               | Default  | Description                                 |
| -------------------- | -------- | ------------------------------------------- |
| `Provider`           | `gemini` | Image provider: `gemini` or `fal`           |
| `AvatarBlendEnabled` | `true`   | Enable multi-reference avatar blending      |
| `AvatarMaxRefs`      | `3`      | Maximum number of reference images to blend |

> **Note for `Provider=fal` users**: fal's image editing API only accepts HTTP/HTTPS image URLs. Local file paths are not supported. Configure `AvatarsURLs` in `IDENTITY.md` with public URLs of your reference images to enable image editing with fal.

### 3. IDENTITY.md

Add the following to `~/.openclaw/workspace/IDENTITY.md` (see `templates/IDENTITY.fragment.md` for the full snippet):

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

### 4. Reference Images (`avatars/` directory)

Place reference photos in `~/.openclaw/workspace/avatars/`:

- Supported formats: `jpg`, `jpeg`, `png`, `webp`
- All photos should be of the same character
- Different styles, scenes, outfits, and expressions work best for consistency
- Images are selected by creation time (newest first), up to `AvatarMaxRefs`

### 5. SOUL.md

Add the Stella capability block to `~/.openclaw/workspace/SOUL.md`. Copy the content from `templates/SOUL.fragment.md`.

## Usage

Once configured, use natural language with your OpenClaw agent:

- "Send me a selfie wearing a red dress"
- "发张照片，在咖啡馆里"
- "Show me what you look like at the beach"
- "Send a pic at a rooftop party, 2K resolution"

## Direct Script Testing

Test the script directly without going through OpenClaw. Since OpenClaw normally injects environment variables at runtime, you need to load them manually for local testing.

```bash
# Install dependencies
npm install

# Option 1: source .env.local then run (recommended)
source .env.local && npx ts-node scripts/stella.ts \
  --prompt "make a pic of this person, but wearing a red dress. the person is taking a mirror selfie" \
  --target "@yourusername" \
  --channel "telegram" \
  --caption "Here's a selfie!" \
  --resolution 1K

# Option 2: inline env vars
GEMINI_API_KEY=xxx OPENCLAW_GATEWAY_TOKEN=yyy npx ts-node scripts/stella.ts \
  --prompt "a close-up selfie at a cozy cafe" \
  --target "@yourusername" \
  --channel "telegram"

# Run with fal provider
source .env.local && Provider=fal npx ts-node scripts/stella.ts \
  --prompt "a close-up selfie taken by herself at a cozy cafe" \
  --target "#general" \
  --channel "discord"
```

> **Note**: The `.env.local` file is only for local development. When running as an OpenClaw skill, environment variables are injected automatically by OpenClaw via `openclaw.json`.

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
│   ├── stella.ts             # Main entry point
│   ├── identity.ts           # IDENTITY.md parser
│   ├── avatars.ts            # Reference image selector
│   ├── providers/
│   │   ├── gemini.ts         # Google Gemini provider
│   │   └── fal.ts            # fal.ai provider
│   └── sender.ts             # OpenClaw message sender
├── tests/                    # Unit tests (vitest)
├── templates/
│   ├── IDENTITY.fragment.md  # IDENTITY.md configuration snippet
│   └── SOUL.fragment.md      # SOUL.md configuration snippet
└── docs/
    ├── stella-research-notes.md
    └── clawhub-publish-checklist.md
```
