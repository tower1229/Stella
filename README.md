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
          "AvatarMaxRefs": "4"
        }
      }
    }
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `Provider` | `gemini` | Image provider: `gemini` or `fal` |
| `AvatarBlendEnabled` | `true` | Enable multi-reference avatar blending |
| `AvatarMaxRefs` | `4` | Maximum number of reference images to blend |

### 3. IDENTITY.md

Add the following to `~/.openclaw/workspace/IDENTITY.md` (see `templates/IDENTITY.fragment.md` for the full snippet):

```markdown
Avatar: ./assets/avatar-main.png
AvatarsDir: ./avatars
AvatarMaxRefs: 4
```

- `Avatar`: Path to your primary reference image (relative to workspace root)
- `AvatarsDir`: Directory of additional reference photos (same character, different styles/scenes/outfits)
- `AvatarMaxRefs`: Max reference images to blend (optional, default 4)

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

Test the script directly without going through OpenClaw:

```bash
# Install dependencies
npm install

# Run with Gemini (default)
npx ts-node scripts/stella.ts \
  --prompt "make a pic of this person, but wearing a red dress. the person is taking a mirror selfie" \
  --target "@yourusername" \
  --channel "telegram" \
  --caption "Here's a selfie!" \
  --resolution 1K

# Run with fal provider
Provider=fal npx ts-node scripts/stella.ts \
  --prompt "a close-up selfie taken by herself at a cozy cafe" \
  --target "#general" \
  --channel "discord"
```

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

## Docs

- 调研结论（v0）：`docs/stella-research-notes.md`
- ClawHub 发布检查清单（v0）：`docs/clawhub-publish-checklist.md`
