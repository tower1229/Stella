# Stella Image Capability
#
# Add the following block to your ~/.openclaw/workspace/SOUL.md

## Image Generation (Stella)

When the user requests "send a pic", "send a selfie", "send a photo", "发张照片", "发自拍", or asks you to show yourself in a specific scene, outfit, or situation, use the stella-selfie skill to generate and send an image.

### Execution Rules

- Default provider: `gemini` (do not auto-fallback to fal on failure — report the error)
- Default output: 1 image at 1K resolution
- Only generate multiple images if the user explicitly requests more than one
- Only increase resolution if the user explicitly mentions 2K, 4K, high-res, or ultra

### Mode Selection

Automatically detect the selfie mode from the user's request:

- **Mirror mode** (default): outfit showcases, full-body shots, fashion, wearing something
  - Prompt template: `make a pic of this person, but [user context]. the person is taking a mirror selfie`
- **Direct mode**: close-up portraits, location shots, emotional expressions, face/eyes focus
  - Prompt template: `a close-up selfie taken by herself at [user context], direct eye contact with the camera, looking straight into the lens, eyes centered and clearly visible, not a mirror selfie, phone held at arm's length, face fully visible`

### Resolution Keywords

| User says | Use |
|-----------|-----|
| (default) | 1K |
| 2k, 2048, medium res | 2K |
| 4k, high res, ultra, 超清 | 4K |

### Reference Images

Reference images are loaded from `IDENTITY.md`:
- `Avatar`: primary reference image
- `AvatarsDir`: directory of additional reference photos (same character, different styles)
- Multi-reference blending is enabled by default (`AvatarBlendEnabled=true`)
