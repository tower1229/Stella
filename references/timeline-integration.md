# Timeline Integration for Stella

Load this document only when `timeline_resolve` is available in the current environment and the current selfie request would benefit from timeline enrichment.

If `timeline_resolve` is unavailable, fails, times out, returns `fact.status === "empty"`, or does not contain usable `result.consumption`, skip this document and continue with Stella's original prompt behavior from `SKILL.md`.

## Compatibility Boundary

- `timeline_resolve` is optional. Stella must work normally without it.
- Timeline enrichment is best-effort only.
- Never refuse, delay, or noticeably degrade image generation because timeline context is missing.
- Never introduce a hard dependency on timeline-specific env vars, install steps, or internal field paths.

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

Do not rely on:

- `episodes[0]`
- `state_snapshot`
- `trace`
- `notes`

## When to Use Timeline

Use timeline enrichment in either of these cases:

- The user gave no scene details and wants "a selfie", "a pic", "show me what you look like", etc.
- The user gave partial scene details, and timeline can safely fill missing reality anchors such as current activity, mood, city, local time, outdoor conditions, lighting, or same-day outfit continuity.

Do not use timeline to override strong explicit user intent such as:

- A clearly specified outfit, location, or activity
- A fantasy or stylized scenario
- A deliberately different city, country, era, or weather setup
- A request that is obviously non-realistic, cosplay-like, or cinematic in a way that should not be grounded to real-world conditions

In those cases, user intent wins. Timeline may only fill neutral gaps if it does not conflict.

## Merge Strategy

Treat timeline as a reality anchor layer, not the source of truth for everything.

Priority order:

1. User's explicit request
2. `consumption.selfie_ready`
3. `consumption.scene`
4. Stella's original fallback heuristics

Merge rules:

- Use `selfie_ready` as the base prompt skeleton when present.
- Use `scene` only to enrich missing or weakly specified details.
- If the user explicitly names a location or outfit, do not replace it with timeline values.
- If the user gives a partial scene, allow timeline to fill missing context such as mood, lighting, framing, city/time anchors, or continuity-friendly outfit details.
- If `appearance_change_expected !== true`, preserve same-day continuity and only make small weather-compatible outfit adjustments.

## Camera Mode Selection

Keep Stella's existing keyword-first mode selection.

Timeline can refine mode only when the user did not strongly specify otherwise:

- Continuing same activity or same moment -> prefer `direct`
- New state, changed outfit, or changed context -> prefer `mirror`
- Travel-photo keywords, scenic full-body intent, or clear no-handheld-selfie signal -> prefer `tourist`

`framing_hint` may strengthen the chosen mode, but should not overturn a strong explicit user request.

## Outdoor and Real-World Awareness

This is the main place to use Nano Banana 2's real-world perception.

Classify the scene into one of these buckets:

- `outdoor`: the subject is actually outside
- `indoor_with_outdoor_view`: the subject is inside but outdoors is visibly present through a window, balcony, terrace opening, train window, cafe window, etc.
- `indoor_closed`: the subject is in a normal enclosed interior without meaningful outdoor visibility

Signals can come from:

- user wording
- `selfie_ready.location`
- `scene.location_props`
- `scene.framing_hint`

### Outdoor

When the scene is truly outdoor, and `scene.city` plus either `scene.calendar_date` or `scene.local_timestamp` are available:

- For Nano Banana real-world grounding, explicitly inject the city and an exact local date anchor into the prompt. Prefer `scene.local_timestamp`; otherwise inject `scene.calendar_date` plus `scene.timezone` if available.
- Let the image feel like it was just taken in that real city at that local date and time.
- Let outdoor light, sky condition, pavement dryness, seasonal vegetation, and air feel match the real world naturally.
- Adjust clothing to match likely weather and activity, while preserving the character's established style.

If exact city/date anchors are not available, do not rely on vague wording like "current weather" or "today there". Fall back to general atmosphere cues instead of claiming real-world synchronization.

Allowed clothing adaptation:

- outer layer
- sleeve length
- fabric weight
- footwear
- scarf / light layering
- umbrella / rain protection

Do not randomly change:

- overall fashion identity
- hairstyle
- makeup style
- major silhouette
- same-day indoor outfit continuity without a reason

### Indoor With Outdoor View

When the scene is indoors but the outside is visible:

- Still explicitly inject city and exact local date/time anchors when available, so the visible outdoors can benefit from Nano Banana's real-world perception.
- Make the visible outdoors match the city, local date/time, and weather.
- Keep clothing primarily appropriate for the indoor environment.
- Only allow light temperature or layering adjustments if naturally justified.

This prevents cases where it is raining outside a cafe window but the subject is incorrectly dressed like they are walking in the rain.

### Indoor Closed

Do not invoke weather-based outfit changes.

You may still use:

- `time_of_day`
- `lighting_hint`
- `environment_mood`
- same-day continuity from `appearance`

## Prompt Construction

If `consumption.selfie_ready` is present, use it as the base:

```text
A [mode] photo of this person, [activity] at [location], wearing [appearance], with a [emotion] expression, [time_of_day] atmosphere.
```

Then enrich only when supported by stable fields:

- Add `city` and exact local date/time anchors when they help real-world grounding.
- Add `location_props` as concrete scene details.
- Add `lighting_hint` for believable light behavior.
- Add `framing_hint` for camera composition.
- Add `environment_mood` and `social_context` as subtle atmosphere cues.

For outdoor or outdoor-visible scenes, append an explicit grounding clause with concrete values:

```text
Make it feel like this was just captured in [city], on [YYYY-MM-DD], at [local time] [timezone if available], with outdoor conditions and ambient light matching the real place and moment naturally.
```

For outdoor scenes with weather-aware clothing:

```text
Adjust outfit details to fit the likely real weather and activity, while preserving the character's established style and continuity.
```

If `appearance_change_expected !== true`, prefer this stricter clause:

```text
Keep the same-day outfit continuity and only make minor weather-compatible adjustments if needed.
```

## Examples

### No explicit scene, timeline resolves a home study

```text
A mirror selfie of this person, organizing work files at her home study, wearing a casual home outfit, soft warm indoor light, slightly tired but calm, with a focused expression.
```

### Cafe by the window, outdoor visible

```text
A direct selfie of this person, reading at a cozy cafe window seat, wearing a light spring outfit, relaxed and content, late-afternoon atmosphere. Through the window, make the city outside feel like it was just seen in Shanghai, on 2026-03-28, at 17:40 Asia/Shanghai, with natural weather, sky tone, and ambient light matching the real moment.
```

### Outdoor city walk with weather-aware outfit

```text
A travel photo of this person, walking along a riverside street in Hangzhou, wearing a stylish weather-appropriate outfit, relaxed and cheerful, natural full-body composition, not a handheld selfie. Make it feel like it was just captured in Hangzhou, on 2026-03-28, at 16:20 Asia/Shanghai, with outdoor light, sky condition, and clothing details matching the real weather naturally while preserving the character's style.
```
