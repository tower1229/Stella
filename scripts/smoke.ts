import * as fs from "fs";
import * as path from "path";

import { selectAvatars } from "./avatars";
import { generateWithGemini } from "./providers/gemini";

type Resolution = "1K" | "2K" | "4K";

function parseArgs(argv: string[]): {
  outdir: string;
  provider: "gemini";
  avatarsDir: string;
  avatarMaxRefs: number;
} {
  const args = argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) return undefined;
    return args[idx + 1];
  };

  const outdir = get("--outdir") || "./out";
  const provider = (get("--provider") || "gemini") as "gemini";
  const avatarsDir = get("--avatars-dir") || "./smoke/avatars";
  const avatarMaxRefsEnv = process.env.AvatarMaxRefs || process.env.AVATAR_MAX_REFS;
  const avatarMaxRefsRaw = get("--avatar-max-refs") || avatarMaxRefsEnv || "3";
  const avatarMaxRefs = Math.max(1, parseInt(avatarMaxRefsRaw, 10) || 3);
  return { outdir, provider, avatarsDir, avatarMaxRefs };
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeExtFromMime(mimeType: string): string {
  const normalized = (mimeType || "").toLowerCase();
  if (normalized.includes("jpeg")) return "jpg";
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  return "png";
}

function loadDotEnvLocalIfPresent(): void {
  // Convenience for local runs: load ./\.env.local if it exists.
  // We only set process.env keys that are not already present.
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function runGeminiSmoke(outdir: string): Promise<void> {
  const avatarsDir = parsedArgs.avatarsDir;
  const avatarMaxRefs = parsedArgs.avatarMaxRefs;

  const referenceImages = selectAvatars({
    avatar: null,
    avatarsDir,
    avatarMaxRefs,
    avatarBlendEnabled: true,
  });

  console.log(
    `[smoke] Reference images: ${referenceImages.length > 0 ? referenceImages.join(", ") : "(none — text-to-image mode)"}`,
  );

  const cases: Array<{ name: string; prompt: string; resolution: Resolution }> =
    [
      {
        name: "01-red-dress",
        prompt: "Send me a selfie wearing a red dress",
        resolution: "1K",
      },
      {
        name: "02-selfie",
        prompt: "给我发一张健身房里的自拍！",
        resolution: "1K",
      },
    ];

  const failures: Array<{ name: string; error: string }> = [];

  for (const c of cases) {
    console.log(`[smoke] Running: ${c.name} (${c.resolution})`);
    try {
      const results = await generateWithGemini({
        prompt: c.prompt,
        referenceImages,
        resolution: c.resolution,
        count: 1,
      });

      const r = results[0];
      const ext = safeExtFromMime(r.mimeType);
      const filename = `${c.name}-${Date.now()}.${ext}`;
      const outPath = path.join(outdir, filename);
      fs.copyFileSync(r.outputPath, outPath);
      console.log(`[smoke] Saved: ${outPath}`);
    } catch (err) {
      const msg = (err as Error)?.message || String(err);
      console.error(`[smoke] Failed: ${c.name}: ${msg}`);
      failures.push({ name: c.name, error: msg });
    }
  }

  if (failures.length > 0) {
    console.error(`[smoke] Failures: ${failures.length}/${cases.length}`);
    for (const f of failures) {
      console.error(`[smoke] - ${f.name}: ${f.error}`);
    }
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  loadDotEnvLocalIfPresent();
  parsedArgs = parseArgs(process.argv);
  const { outdir, provider, avatarsDir, avatarMaxRefs } = parsedArgs;
  ensureDir(outdir);

  if (provider !== "gemini") {
    throw new Error(`Unsupported provider for smoke test: ${provider}`);
  }

  console.log(`[smoke] Provider: ${provider}`);
  console.log(`[smoke] Outdir: ${outdir}`);
  console.log(`[smoke] AvatarsDir: ${avatarsDir}`);
  console.log(`[smoke] AvatarMaxRefs: ${avatarMaxRefs}`);
  await runGeminiSmoke(outdir);
  console.log("[smoke] Done.");
}

let parsedArgs: ReturnType<typeof parseArgs>;

main().catch((err) => {
  console.error(`[smoke] Fatal error: ${(err as Error).message}`);
  process.exit(1);
});
