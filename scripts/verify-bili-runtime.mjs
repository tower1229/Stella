// Offline compatibility probe against an installed OpenClaw's public image runtime export.
// It injects a local provider fixture: no network, credentials, real photos, or paid generation.
// Usage: node scripts/verify-bili-runtime.mjs <absolute OpenClaw package directory> [Stella bundle directory]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageDir = process.argv[2];
if (!packageDir || !path.isAbsolute(packageDir)) throw new Error("Supply the installed OpenClaw package directory");
const requireHost = createRequire(path.join(packageDir, "package.json"));
const { generateImage } = await import(pathToFileURL(requireHost.resolve("openclaw/plugin-sdk/image-generation-runtime")).href);
const require = createRequire(import.meta.url);
const stellaDir = process.argv[3] ?? fileURLToPath(new URL("..", import.meta.url));
const { generateForBili } = require(path.join(stellaDir, "dist/scripts/bili.js"));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "stella-native-memory-"));
try {
  fs.mkdirSync(path.join(root, "assets"));
  fs.writeFileSync(path.join(root, "assets", "avatar.png"), png);
  fs.writeFileSync(path.join(root, "IDENTITY.md"), "Avatar: assets/avatar.png\n");
  let calls = 0;
  const provider = {
    id: "google", label: "Local probe fixture", defaultModel: "gemini-3-pro-image", models: ["gemini-3-pro-image"],
    isConfigured: () => true,
    capabilities: { generate: { maxCount: 1 }, edit: { enabled: true, maxCount: 1, maxInputImages: 5, supportsResolution: true, supportsAspectRatio: true },
      geometry: { resolutions: ["1K", "2K", "4K"], aspectRatios: ["3:4"] } },
    generateImage: async request => {
      calls++;
      assert.equal(request.prompt, 'A selfie of this person, 中文 "quote" & literal.');
      assert.equal(request.agentDir, path.join(root, "auth"));
      assert.equal(request.count, 1);
      assert.equal(request.resolution, "2K");
      assert.equal(request.aspectRatio, undefined);
      assert.deepEqual(request.inputImages[0].buffer, png);
      return { images: [{ buffer: png, mimeType: "image/png" }], model: request.model };
    },
  };
  const result = await generateForBili({
    config: {},
    runtime: {
      agent: { resolveAgentWorkspaceDir: () => root, resolveAgentDir: () => path.join(root, "auth") },
      imageGeneration: {
        listProviders: () => [provider],
        generate: params => generateImage(params, { getProvider: id => id === "google" ? provider : undefined, listProviders: () => [provider] }),
      },
    },
  }, { listAgentIds: () => ["main"] }, { schemaVersion: 1, prompt: 'A selfie of this person, 中文 "quote" & literal.' });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(calls, 1);
  assert.deepEqual(result.image.buffer, png);
  assert.deepEqual(fs.readdirSync(root).sort(), ["IDENTITY.md", "assets"]);
  console.log(JSON.stringify({ ok: true, hostVersion: JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8")).version,
    providerCalls: calls, nativeRuntimeReturnedBuffer: true, materialFilesCreated: false, networkUsed: false }));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
