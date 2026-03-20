# stella-selfie Protocol (v1)

This document defines the final input/output contract of `stella-selfie`
under the personality stack (`timeline -> persona -> stella`).

## Skill Role

`stella-selfie` is the rendering/output layer:

- Accept user selfie/photo requests
- Decide whether context-aware orchestration is required
- Consume expressive JSON from `persona-skill`
- Assemble image prompt and send generated image to channel

It does not define factual timeline truth.

## Input

### Explicit Input (from user/request)

- User natural-language request (required)
- Optional explicit constraints in request:
  - location / scene
  - outfit / appearance
  - activity
  - resolution (`1K`, `2K`, `4K`)
  - count
  - channel target/provider

### Context-Aware Internal Inputs (only when needed)

When user request lacks clear scene constraints:

1. Call `timeline-skill` first (factual state)
2. Call `persona-skill` second (expressive transformation)
3. Consume persona JSON for prompt assembly

## Output

### Primary Output

- Image generation prompt (mirror/direct mode)
- Generated image file(s)
- Delivery result to target channel

### Expected Upstream Contract (persona -> stella)

Required fields:

- `scene.location`
- `scene.activity`
- `scene.time_of_day`
- `emotion.primary`
- `appearance.outfit_style`
- `camera.suggested_mode`
- `camera.lighting`
- `confidence`

## Orchestration Rules (MUST)

1. If request has no scene keywords, call order must be:
   - `timeline-skill` -> `persona-skill`
2. Do not call persona directly before timeline in context-aware mode.
3. If `timeline-skill` or `persona-skill` is unavailable, fallback to Stella default behavior.
4. If `confidence < 0.5`, apply conservative/default fallback.

## Trigger Strategy

- With explicit scene/outfit/activity constraints in user request:
  - Stella may proceed with explicit user context directly.
- Without explicit constraints:
  - Stella must use context-aware chain (`timeline -> persona`) before rendering.

## Fallback Behavior

- Missing `camera.suggested_mode` or `confidence`: fallback to `mirror` mode.
- Missing/invalid expressive payload: fallback to Stella default mode selection rules.

## Versioning

- Track upstream schema version from timeline/persona payloads.
- On major incompatibility, fallback safely instead of producing undefined prompts.
- Keep this protocol aligned with:
  - `Her/docs/protocol.md`
  - `Zhuang-Yan/docs/protocol.md`
