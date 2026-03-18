# Stella Image Identity Configuration
#
# Add the following lines to your ~/.openclaw/workspace/IDENTITY.md
# Adjust paths to match your actual file locations.

# Primary reference image (used as the first reference in all image generation)
Avatar: ./assets/avatar-main.png

# Directory containing multiple reference photos of the same character
# (different styles, scenes, outfits, expressions)
# Images are selected by creation time (newest first), up to AvatarMaxRefs
AvatarsDir: ./avatars

# Maximum number of reference images to blend (optional, default: 3)
# fal provider supports up to 3 reference images
AvatarMaxRefs: 3

# Public URLs of reference images — required for Provider=fal
# (fal's API only accepts HTTP/HTTPS URLs, not local file paths)
# Comma-separated list, up to AvatarMaxRefs entries
AvatarsURLs: https://cdn.example.com/ref1.jpg, https://cdn.example.com/ref2.jpg, https://cdn.example.com/ref3.jpg
