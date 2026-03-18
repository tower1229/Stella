/**
 * Stella — OpenClaw image generation skill
 *
 * Generates persona-consistent selfie images and sends them to a target channel.
 * Supports Gemini and fal providers with multi-reference avatar blending.
 *
 * Usage:
 *   npx ts-node scripts/stella.ts \
 *     --prompt "<assembled prompt>" \
 *     --target "<channel destination>" \
 *     --channel "<channel provider, e.g. telegram>" \
 *     [--caption "<caption text>"] \
 *     [--resolution <1K|2K|4K>] \
 *     [--count <number>]
 *
 * Environment variables (from .env.local or skill env):
 *   GEMINI_API_KEY          - Required when Provider=gemini
 *   FAL_KEY                 - Required when Provider=fal
 *   OPENCLAW_GATEWAY_TOKEN  - Required for HTTP fallback
 *   Provider                - gemini (default) | fal
 *   AvatarBlendEnabled      - true (default) | false
 *   AvatarMaxRefs           - Override for max reference images (default: from IDENTITY.md or 3)
 */

import * as path from "path";
import * as os from "os";

import { parseIdentity } from "./identity";
import { selectAvatars } from "./avatars";
import { generateWithGemini, Resolution as GeminiResolution } from "./providers/gemini";
import { generateWithFal } from "./providers/fal";
import { sendImage } from "./sender";

type Provider = "gemini" | "fal";
type Resolution = "1K" | "2K" | "4K";

interface CliArgs {
  prompt: string;
  target: string;
  channel: string;
  caption: string;
  resolution: Resolution;
  count: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) return undefined;
    return args[idx + 1];
  };

  const prompt = get("--prompt");
  const target = get("--target");
  const channel = get("--channel");

  if (!prompt || !target || !channel) {
    console.error(`
Usage: npx ts-node scripts/stella.ts \\
  --prompt "<assembled prompt>" \\
  --target "<channel destination>" \\
  --channel "<channel provider>" \\
  [--caption "<caption>"] \\
  [--resolution <1K|2K|4K>] \\
  [--count <number>]

Required:
  --prompt      Image description / assembled selfie prompt
  --target      Destination (e.g. #general, @username, channel ID)
  --channel     Channel provider (e.g. telegram, discord, whatsapp)

Optional:
  --caption     Message caption (default: empty)
  --resolution  1K | 2K | 4K (default: 1K)
  --count       Number of images to generate (default: 1)

Environment:
  GEMINI_API_KEY          Required when Provider=gemini (default)
  FAL_KEY                 Required when Provider=fal
  OPENCLAW_GATEWAY_TOKEN  Required for HTTP fallback sending
  Provider                gemini (default) | fal
  AvatarBlendEnabled      true (default) | false
`);
    process.exit(1);
  }

  const resolutionRaw = get("--resolution") || "1K";
  const validResolutions: Resolution[] = ["1K", "2K", "4K"];
  if (!validResolutions.includes(resolutionRaw as Resolution)) {
    console.error(`[stella] Invalid resolution: ${resolutionRaw}. Use 1K, 2K, or 4K.`);
    process.exit(1);
  }

  const countRaw = get("--count");
  const count = countRaw ? parseInt(countRaw, 10) : 1;
  if (isNaN(count) || count < 1) {
    console.error(`[stella] Invalid count: ${countRaw}`);
    process.exit(1);
  }

  return {
    prompt,
    target,
    channel,
    caption: get("--caption") || "",
    resolution: resolutionRaw as Resolution,
    count,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  const provider: Provider =
    (process.env.Provider as Provider) || "gemini";
  const avatarBlendEnabled =
    (process.env.AvatarBlendEnabled || "true").toLowerCase() !== "false";
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;
  const gatewayUrl =
    process.env.OPENCLAW_GATEWAY_URL || "http://localhost:18789";

  if (provider !== "gemini" && provider !== "fal") {
    console.error(`[stella] Unknown Provider: "${provider}". Use "gemini" or "fal".`);
    process.exit(1);
  }

  console.log(`[stella] Provider: ${provider}`);
  console.log(`[stella] Prompt: ${args.prompt}`);
  console.log(`[stella] Target: ${args.target} (${args.channel})`);
  console.log(`[stella] Resolution: ${args.resolution}, Count: ${args.count}`);

  // Step 1: Parse IDENTITY.md
  const workspaceRoot = path.join(os.homedir(), ".openclaw", "workspace");
  let identity;
  try {
    identity = parseIdentity(workspaceRoot);
  } catch (err) {
    console.error(`[stella] Failed to parse IDENTITY.md: ${(err as Error).message}`);
    process.exit(1);
  }

  // Override AvatarMaxRefs from env if set
  const envMaxRefs = process.env.AvatarMaxRefs
    ? parseInt(process.env.AvatarMaxRefs, 10)
    : null;
  const avatarMaxRefs =
    envMaxRefs && !isNaN(envMaxRefs) ? envMaxRefs : identity.avatarMaxRefs;

  // Step 2: Select reference images
  const referenceImages = selectAvatars({
    avatar: identity.avatar,
    avatarsDir: identity.avatarsDir,
    avatarMaxRefs,
    avatarBlendEnabled,
  });

  console.log(
    `[stella] Reference images: ${referenceImages.length > 0 ? referenceImages.join(", ") : "(none — text-to-image mode)"}`
  );

  // Step 3: Generate image(s)
  if (provider === "gemini") {
    const results = await generateWithGemini({
      prompt: args.prompt,
      referenceImages,
      resolution: args.resolution as GeminiResolution,
      count: args.count,
    });

    // Step 4: Send each generated image
    for (const result of results) {
      console.log(`[stella] Generated: ${result.outputPath} (${result.mimeType})`);
      if (result.revisedPrompt) {
        console.log(`[stella] Revised prompt: ${result.revisedPrompt}`);
      }

      await sendImage({
        channel: args.channel,
        target: args.target,
        media: result.outputPath,
        message: args.caption,
        gatewayToken,
        gatewayUrl,
      });

      console.log(`[stella] Sent to ${args.channel}/${args.target}`);
    }
  } else {
    // fal provider: reference images must be HTTP/HTTPS URLs
    // Priority: AvatarsURLs from IDENTITY.md > local paths that happen to be URLs
    let referenceImageUrls: string[] = [];
    if (identity.avatarsURLs.length > 0) {
      referenceImageUrls = identity.avatarsURLs;
    } else {
      referenceImageUrls = referenceImages.filter(
        (p) => p.startsWith("http://") || p.startsWith("https://")
      );
    }

    if (referenceImages.length > 0 && referenceImageUrls.length === 0) {
      console.warn(
        "[stella] Warning: fal provider requires image URLs. " +
          "Local paths are not supported. Add AvatarsURLs to IDENTITY.md to enable image editing."
      );
    }

    const results = await generateWithFal({
      prompt: args.prompt,
      referenceImageUrls,
      resolution: args.resolution,
      count: args.count,
    });

    for (const result of results) {
      console.log(`[stella] Generated: ${result.imageUrl}`);
      if (result.revisedPrompt) {
        console.log(`[stella] Revised prompt: ${result.revisedPrompt}`);
      }

      await sendImage({
        channel: args.channel,
        target: args.target,
        media: result.imageUrl,
        message: args.caption,
        gatewayToken,
        gatewayUrl,
      });

      console.log(`[stella] Sent to ${args.channel}/${args.target}`);
    }
  }

  console.log("[stella] Done.");
}

main().catch((err) => {
  console.error(`[stella] Fatal error: ${(err as Error).message}`);
  process.exit(1);
});
