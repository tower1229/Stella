# Stella — [中文说明](README_CN.md)

Generate persona-consistent selfie images and send them to any OpenClaw channel. Supports Google Gemini, fal (xAI Grok Imagine), and laozhang.ai providers with multi-reference avatar blending.

## Protocol

- `docs/protocol.md`: `stella-selfie` final I/O contract (v1)

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
          // Only required when Provider=laozhang
          LAOZHANG_API_KEY: "sk-your_laozhang_api_key",

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
| `Provider`           | `gemini` | Image provider: `gemini`, `fal`, or `laozhang` |
| `AvatarBlendEnabled` | `true`   | Enable multi-reference avatar blending (when `false`, `AvatarsDir` is ignored and only `Avatar` is used as a reference; if `Avatar` is unavailable, generation runs without reference images) |
| `AvatarMaxRefs`      | `3`      | Maximum number of reference images to blend |

> **Note for `Provider=fal` users**: fal's image editing API only accepts HTTP/HTTPS image URLs. Local file paths are not supported. Configure `AvatarsURLs` in `IDENTITY.md` with public URLs of your reference images to enable image editing with fal.
>
> **Note for `Provider=laozhang` users**: laozhang.ai uses the Google-native Gemini API format (`gemini-3.1-flash-image-preview`). **Local files from `AvatarsDir` are used by default** (same behavior as `Provider=gemini`); `AvatarsURLs` is only used as a fallback when no local reference images are available. Get your API key at [api.laozhang.ai](https://api.laozhang.ai) — you must configure a billing mode in the token settings before the API will work.
>
> **Credential rules**:
> - Default `Provider=gemini`: requires `GEMINI_API_KEY`
> - `Provider=fal`: requires `FAL_KEY`
> - `Provider=laozhang`: requires `LAOZHANG_API_KEY`
> - Sending always requires `OPENCLAW_GATEWAY_TOKEN`
>
> **Gateway rule**:
> - `OPENCLAW_GATEWAY_URL` is only supported for a local gateway (`localhost`, `127.0.0.1`, `::1`). Remote overrides are intentionally rejected.

### 2. IDENTITY.md

Add the following to `~/.openclaw/workspace/IDENTITY.md`:

```markdown
Avatar: ./assets/avatar-main.png
AvatarsDir: ./avatars
AvatarsURLs: https://cdn.example.com/ref1.jpg, https://cdn.example.com/ref2.jpg
```

- `Avatar`: Path to your primary reference image (relative to workspace root)
- `AvatarsDir`: Directory of additional reference photos (same character, different styles/scenes/outfits); used by default for both `Provider=gemini` and `Provider=laozhang`
- `AvatarsURLs`: Comma-separated public URLs of reference images — required for `Provider=fal` (local files not supported); used as fallback for `Provider=laozhang` when no local images are available

### 3. Reference Images (`avatars/` directory)

Place reference photos in `~/.openclaw/workspace/avatars/`:

- Supported formats: `jpg`, `jpeg`, `png`, `webp`
- All photos should be of the same character
- Different styles, scenes, outfits, and expressions work best (as long as it’s the **same person with stable key traits**)
- Images are selected by creation time (newest first), up to `AvatarMaxRefs` (configured via skill env)

### 4. SOUL.md

Copy/paste the block below into your `~/.openclaw/workspace/SOUL.md`:

```markdown
## Image Capability

You have a physical appearance and can take selfies and photos.

Use the `stella-selfie` skill whenever the user asks for a picture of you — including but not limited to:
"send a pic", "send a selfie", "send me a photo", "show me what you look like", "发张照片", "发自拍", "你在哪里", "你在干嘛"
```

## Usage

Once configured, use natural language with your OpenClaw agent:

- "Send me a selfie wearing a red dress"
- "Send a photo in a cozy cafe"
- "Show me what you look like at the beach"
- "Send a pic at a rooftop party, 2K resolution"

## Failure Experience

When generation fails, Stella attempts to send a short text notification to the same target, so users are not left with a silent failure whenever the channel is reachable.

Typical failure messages include:
- Missing credentials (`GEMINI_API_KEY` / `FAL_KEY` / `LAOZHANG_API_KEY`)
- Rate limit / temporary upstream outage (retry recommended)
- Safety block (prompt rewrite recommended)
- fal reference URL issues (public `http/https` URL required)
- laozhang.ai token billing mode not configured (set it in the dashboard before use)

## Media File Handling (Gemini / laozhang)

When `Provider=gemini` or `Provider=laozhang`, generated images are written to:

- `~/.openclaw/workspace/stella-selfie/`

After each image is sent successfully, Stella immediately removes the local file.

- If send fails, the file is kept for debugging.
- If cleanup fails, Stella logs a warning and continues.

## Security Notes

- Stella reads local profile files from `~/.openclaw/workspace/IDENTITY.md` and `~/.openclaw/workspace/avatars/`.
- Generated files are written to `~/.openclaw/workspace/stella-selfie/` and removed only after successful send.
- Message delivery uses `openclaw message send` first, then falls back to a local HTTP gateway (`OPENCLAW_GATEWAY_URL`, default `http://localhost:18789`).
- `OPENCLAW_GATEWAY_URL` must stay on `localhost`, `127.0.0.1`, or `::1`; remote endpoint overrides are rejected by the runtime.

## Direct Script Testing

Test the script directly without going through OpenClaw. Since OpenClaw normally injects environment variables at runtime, you need to load them manually for local testing.

```bash
# Install dependencies
npm install

# Build runtime artifacts
npm run build

# Run the skill runtime directly
node dist/scripts/skill.js --prompt "test prompt" --target "@user" --channel "telegram"

# Smoke test: real API calls, saves images to ./out
npm run smoke
```

> **Note**: The project-root `.env.local` file is only for local development. When running as an OpenClaw skill, secrets should be configured via `~/.openclaw/openclaw.json` (or your process environment), and OpenClaw injects them for the agent run.

## Unit Tests

```bash
npm test
```

Runs unit tests covering all modules (identity parser, avatar selector, Gemini provider, fal provider, sender, skill runtime). All tests use mocks — no real API calls are made.

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
│       ├── fal.ts            # fal.ai provider
│       └── laozhang.ts       # laozhang.ai provider
├── tests/                    # Unit tests (vitest)
│   └── providers/            # Provider unit tests
├── smoke/
│   └── avatars/              # Reference images for smoke testing
└── docs/
    └── protocol.md               # I/O contract and timeline integration rules
```
