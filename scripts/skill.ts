/**
 * Stella — OpenClaw image generation skill runtime.
 *
 * This is the entrypoint invoked by SKILL.md.
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
Usage: npx ts-node scripts/skill.ts \\
  --prompt "<assembled prompt>" \\
  --target "<channel destination>" \\
  --channel "<channel provider>" \\
  [--caption "<caption>"] \\
  [--resolution <1K|2K|4K>] \\
  [--count <number>]
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

  const provider: Provider = (process.env.Provider as Provider) || "gemini";
  const avatarBlendEnabled =
    (process.env.AvatarBlendEnabled || "true").toLowerCase() !== "false";
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || "http://localhost:18789";

  if (provider !== "gemini" && provider !== "fal") {
    console.error(`[stella] Unknown Provider: "${provider}". Use "gemini" or "fal".`);
    process.exit(1);
  }

  // Parse identity from the OpenClaw workspace on this machine
  const workspaceRoot = path.join(os.homedir(), ".openclaw", "workspace");
  const identity = parseIdentity(workspaceRoot);

  const envMaxRefs = process.env.AvatarMaxRefs ? parseInt(process.env.AvatarMaxRefs, 10) : null;
  const avatarMaxRefs =
    envMaxRefs && !isNaN(envMaxRefs) ? envMaxRefs : identity.avatarMaxRefs;

  const referenceImages = selectAvatars({
    avatar: identity.avatar,
    avatarsDir: identity.avatarsDir,
    avatarMaxRefs,
    avatarBlendEnabled,
  });

  if (provider === "gemini") {
    const results = await generateWithGemini({
      prompt: args.prompt,
      referenceImages,
      resolution: args.resolution as GeminiResolution,
      count: args.count,
    });

    for (const result of results) {
      await sendImage({
        channel: args.channel,
        target: args.target,
        media: result.outputPath,
        message: args.caption,
        gatewayToken,
        gatewayUrl,
      });
    }
  } else {
    // fal provider: reference images must be HTTP/HTTPS URLs
    const referenceImageUrls =
      identity.avatarsURLs.length > 0
        ? identity.avatarsURLs
        : referenceImages.filter((p) => p.startsWith("http://") || p.startsWith("https://"));

    const results = await generateWithFal({
      prompt: args.prompt,
      referenceImageUrls,
      resolution: args.resolution,
      count: args.count,
    });

    for (const result of results) {
      await sendImage({
        channel: args.channel,
        target: args.target,
        media: result.imageUrl,
        message: args.caption,
        gatewayToken,
        gatewayUrl,
      });
    }
  }
}

main().catch((err) => {
  console.error(`[stella] Fatal error: ${(err as Error).message}`);
  process.exit(1);
});

