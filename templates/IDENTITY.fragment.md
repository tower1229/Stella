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

# Maximum number of reference images to blend (optional, default: 4)
AvatarMaxRefs: 4
