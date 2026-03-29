# Timeline Integration for Stella

Load this document only when `timeline_resolve` is available in the current environment and the current selfie request is `Sparse`.

If `timeline_resolve` is unavailable, fails, times out, returns `fact.status === "empty"`, or does not contain usable `result.consumption`, skip this document and continue with Stella's default prompt behavior from `SKILL.md`.

## Compatibility Boundary

- `timeline_resolve` is optional. Stella must work normally without it.
- Timeline enhancement is best-effort only.
- Never refuse, delay, or noticeably degrade image generation because timeline context is missing.
- Never introduce a hard dependency on timeline-specific env vars, install steps, or internal field paths.

## Sparse Eligibility

Use this document only for `Sparse` requests, meaning the user asked for a photo without a clear scene, outfit, location, activity, or camera requirement.

Typical Sparse requests:

- “发张自拍”
- “发张照片”
- “想看看你”
- “send a selfie”
- “send a photo”
- “show me what you look like”

Non-Sparse requests do **not** use timeline enhancement, even if timeline is available.

Typical non-Sparse requests:

- “发张海边的自拍”
- “发张穿红裙子的自拍”
- “发张窗边的自拍”
- “send a mirror selfie in a black dress”
- “show me a third-person photo at the beach”

## Stable Input Contract

Use only `result.consumption` from timeline output.

Primary visual anchor:

- `consumption.selfie_ready`

Optional enhancement fields:

- `consumption.scene.city`
- `consumption.scene.calendar_date`
- `consumption.scene.local_timestamp`
- `consumption.scene.timezone`
- `consumption.scene.location_props`
- `consumption.scene.lighting_hint`
- `consumption.scene.framing_hint`
- `consumption.scene.activity_mode`
- `consumption.scene.continuity_relation`
- `consumption.scene.environment_mood`
- `consumption.scene.social_context`
- `consumption.scene.appearance_change_expected`
- `consumption.scene.appearance_change_reason`
- `consumption.fact.continuity`

Do not rely on:

- `episodes[0]`
- `state_snapshot`
- `trace`
- `notes`

## Timeline Role

Timeline is a fact-grounding layer for Sparse requests.

Use it to:

- recover a believable current scene from `result.consumption`
- supply concrete place / date / time anchors
- support realistic weather / lighting / indoor-outdoor coherence
- enrich mood, social context, and continuity details
- unlock Nano Banana real-world grounding when city plus exact local date/time anchors are available

Timeline does not own selfie semantics in general. Stella still owns the capture strategy and final prompt assembly.

Structured fields and natural-language fields may both influence the decision. When a natural-language field is decisive, rely on LLM semantic understanding rather than hardcoded script logic.

## Merge Strategy

Treat timeline as a reality anchor layer, not the source of truth for everything.

Priority order for Sparse requests:

1. User's explicit wording, if any
2. `consumption.selfie_ready`
3. `consumption.scene`
4. Stella's default fallback heuristics

Merge rules:

- Use `selfie_ready` as the base prompt skeleton when present.
- Use `scene` to enrich missing reality details such as city, time, props, lighting, mood, and continuity-friendly appearance details.
- Do not invent exact real-world synchronization unless city plus exact local date/time anchors are present.

## Capture Strategy for Sparse Requests

When Sparse requests enter timeline enhancement, let the recovered scene guide the most natural capture strategy:

- prefer `mirror` when the recovered scene naturally supports self-presentation or reflective capture
- prefer `direct` when the recovered scene feels naturally handheld and immediate
- prefer `third_person` when the recovered scene does not plausibly read as a selfie and a non-selfie viewpoint is more natural

Do not encode brittle hard mappings such as “fresh moment means mirror.”

## Outdoor and Real-World Awareness

This is the main place to use Nano Banana's real-world perception for Sparse requests.

Classify the scene into one of these buckets:

- `outdoor`: the subject is actually outside
- `indoor_with_outdoor_view`: the subject is inside but outdoors is visibly present through a window, balcony, terrace opening, train window, cafe window, etc.
- `indoor_closed`: the subject is in a normal enclosed interior without meaningful outdoor visibility

Signals can come from:

- `selfie_ready.location`
- `scene.location_props`
- `scene.framing_hint`
- natural-language semantic interpretation of the recovered scene

### Outdoor

When the scene is truly outdoor, and `scene.city` plus either `scene.calendar_date` or `scene.local_timestamp` are available:

- explicitly inject the city and an exact local date/time anchor into the prompt
- let the image feel like it was just taken in that real city at that local moment
- let outdoor light, sky condition, pavement dryness, seasonal vegetation, and air feel match the real world naturally
- adjust outfit details to fit likely weather and activity while preserving the character's style

If exact city/date anchors are missing, fall back to general atmosphere cues instead of claiming real-world synchronization.

### Indoor With Outdoor View

When the scene is indoors but the outside is visible:

- still inject city and exact local date/time anchors when available, so the visible outdoors can benefit from real-world perception
- make the visible outdoors match the city, local date/time, and weather
- keep clothing primarily appropriate for the indoor environment

### Indoor Closed

Do not invoke weather-based outfit changes.

You may still use:

- `time_of_day`
- `lighting_hint`
- `environment_mood`
- continuity-friendly appearance details

## Prompt Construction

If `consumption.selfie_ready` is present, use it as the base:

```text
A [mode] photo of this person, [activity] at [location], wearing [appearance], with a [emotion] expression, [time_of_day] atmosphere.
```

Then enrich only when supported by timeline facts:

- add `city` and exact local date/time anchors when they help real-world grounding
- add `location_props` as concrete scene details
- add `lighting_hint` for believable light behavior
- add `framing_hint` as a descriptive cue when it strengthens realism
- add `environment_mood` and `social_context` as subtle atmosphere cues

For outdoor or outdoor-visible scenes, append an explicit grounding clause with concrete values:

```text
Make it feel like this was just captured in [city], on [YYYY-MM-DD], at [local time] [timezone if available], with outdoor conditions and ambient light matching the real place and moment naturally.
```

## Examples

### Sparse request, timeline resolves a home study

```text
A mirror selfie of this person, organizing work files at her home study, wearing a casual home outfit, soft warm indoor light, slightly tired but calm, with a focused expression.
```

### Sparse request, cafe by the window, outdoor visible

```text
A direct selfie of this person, reading at a cozy cafe window seat, wearing a light spring outfit, relaxed and content, late-afternoon atmosphere. Through the window, make the city outside feel like it was just seen in Shanghai, on 2026-03-28, at 17:40 Asia/Shanghai, with natural weather, sky tone, and ambient light matching the real moment.
```

### Sparse request, outdoor city walk that reads better as non-selfie

```text
A natural third-person photo of this person, walking along a riverside street in Hangzhou, wearing a stylish weather-appropriate outfit, relaxed and cheerful, natural full-body composition, not a selfie. Make it feel like it was just captured in Hangzhou, on 2026-03-28, at 16:20 Asia/Shanghai, with outdoor light, sky condition, and clothing details matching the real weather naturally while preserving the character's style.
```
