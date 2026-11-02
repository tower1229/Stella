import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateForBili, type BiliImageRequest, type NativeImageResult, type StellaHost } from "../scripts/bili";
import * as images from "../scripts/images";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const provider = { id: "google", models: ["gemini-3-pro-image", "gemini-3.1-flash-image"], capabilities: {
  edit: { enabled: true, maxInputImages: 5, supportsResolution: true, supportsAspectRatio: true },
  geometry: { aspectRatios: ["1:1", "3:4"], resolutions: ["1K", "2K", "4K"] },
} };

describe("bili native in-memory integration", () => {
  let root: string;
  let workspace: string;
  let config: Record<string, unknown>;
  let host: StellaHost<Record<string, unknown>>;
  let generate: ReturnType<typeof vi.fn<StellaHost<Record<string, unknown>>["runtime"]["imageGeneration"]["generate"]>>;
  let warnings: string[];
  const request: BiliImageRequest = { schemaVersion: 1, prompt: 'A selfie of this person, 中文 "quote" & literal $text.\nLooking into the lens.' };
  const listAgentIds = () => ["main", "stella"];
  function call(r: BiliImageRequest = request) {
    return generateForBili(host, { listAgentIds, onWarning: m => warnings.push(m) }, r);
  }
  function options(value: Record<string, unknown>) {
    config.skills = { entries: { "stella-selfie": { config: value } } };
  }
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "stella-bili-"));
    workspace = path.join(root, "persona workspace");
    fs.mkdirSync(path.join(workspace, "assets"), { recursive: true });
    fs.writeFileSync(path.join(workspace, "assets", "main.png"), png);
    fs.writeFileSync(path.join(workspace, "IDENTITY.md"), "- **Avatar:** assets/main.png\n");
    config = {};
    warnings = [];
    for (const key of ["Provider", "AvatarBlendEnabled", "AvatarMaxRefs", "AvatarAllowedRoots"]) vi.stubEnv(key, undefined);
    generate = vi.fn().mockResolvedValue({ images: [{ buffer: png, mimeType: "image/png" }],
      provider: "google", model: "gemini-3-pro-image", ignoredOverrides: [] } satisfies NativeImageResult);
    host = { config, runtime: {
      agent: {
        resolveAgentWorkspaceDir: vi.fn(() => workspace),
        resolveAgentDir: vi.fn((_cfg, id) => path.join(root, "auth", id)),
      },
      imageGeneration: { listProviders: vi.fn(() => [provider]), generate },
    } };
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); fs.rmSync(root, { recursive: true, force: true }); });

  it("returns one image buffer with defaults, preserves prompt, and creates no material files", async () => {
    const before = fs.readdirSync(workspace);
    const result = await call();
    expect(result).toMatchObject({ ok: true, agentId: "main", image: { buffer: png, mimeType: "image/png" } });
    if (!result.ok) throw new Error("Expected success");
    expect(result.image.buffer).toBe(png);
    expect(result).not.toHaveProperty("material");
    expect(result).not.toHaveProperty("filePath");
    expect(Number.isNaN(Date.parse(result.generatedAt))).toBe(false);
    expect(fs.readdirSync(workspace)).toEqual(before);
    expect(generate).toHaveBeenCalledTimes(1);
    const params = generate.mock.calls[0][0];
    expect(params).toMatchObject({ cfg: config, prompt: request.prompt, count: 1, resolution: "2K",
      modelOverride: "google/gemini-3-pro-image", autoProviderFallback: false, agentDir: path.join(root, "auth", "main") });
    expect(params.inputImages).toEqual([{ buffer: png, mimeType: "image/png" }]);
    expect(params).not.toHaveProperty("aspectRatio");
    expect(params).not.toHaveProperty("size");
    expect(host.runtime.imageGeneration.listProviders).toHaveBeenCalledWith({ cfg: config });
  });
  it("uses the bound Agent for both workspace and auth and passes explicit image hints", async () => {
    expect(await call({ ...request, agentId: "stella", resolution: "4K", aspectRatio: "3:4" })).toMatchObject({ ok: true, agentId: "stella" });
    expect(host.runtime.agent.resolveAgentWorkspaceDir).toHaveBeenCalledWith(config, "stella");
    expect(generate.mock.calls[0][0]).toMatchObject({ agentDir: path.join(root, "auth", "stella"), resolution: "4K", aspectRatio: "3:4" });
  });
  it("fails if main is not configured; it does not select the sole other Agent", async () => {
    const missing = await generateForBili(host, { listAgentIds: () => ["stella"] }, request);
    expect(missing).toMatchObject({ ok: false, error: { code: "AGENT_NOT_FOUND", generationOutcome: "not_started" } });
    if (missing.ok) throw new Error("Expected failure");
    expect(missing.error.actionHint).not.toMatch(/Google|网络|network/i);
    expect(generate).not.toHaveBeenCalled();
    expect(host.runtime.agent.resolveAgentWorkspaceDir).not.toHaveBeenCalled();
  });
  it.each([{ count: 2 }, { target: "elsewhere" }, { saveDir: "anywhere" }, { description: true }, { schemaVersion: 2 }, { resolution: "8K" }, { aspectRatio: "0:0" }])(
    "rejects unsupported request fields and hints before generation: %j", async extra => {
      const result = await call({ ...request, ...extra } as BiliImageRequest);
      expect(result).toMatchObject({ ok: false, error: { code: "INPUT_INVALID" } });
      if (result.ok) throw new Error("Expected failure");
      expect(result.error.actionHint).not.toMatch(/Google|网络|network/i);
      expect(generate).not.toHaveBeenCalled();
    });
  it("retains a valid main reference when an optional directory is unavailable", async () => {
    fs.appendFileSync(path.join(workspace, "IDENTITY.md"), "AvatarsDir: missing\n");
    expect(await call()).toMatchObject({ ok: true });
    expect(warnings.join("\n")).toContain("AvatarsDir not found");
  });
  it("supports additional-only references and deduplicates a main reference in the same directory", async () => {
    fs.writeFileSync(path.join(workspace, "IDENTITY.md"), "AvatarsDir: assets\n");
    expect(await call()).toMatchObject({ ok: true });
    fs.appendFileSync(path.join(workspace, "IDENTITY.md"), "Avatar: assets/main.png\n");
    await call();
    expect(generate.mock.calls[1][0].inputImages).toHaveLength(1);
  });
  it("keeps blend disabled main-only even if valid extra pictures exist", async () => {
    options({ AvatarBlendEnabled: false });
    fs.writeFileSync(path.join(workspace, "IDENTITY.md"), "Avatar: missing.png\nAvatarsDir: assets\n");
    const result = await call();
    expect(result).toMatchObject({ ok: false, error: { code: "NO_VALID_REFERENCE" } });
    if (result.ok) throw new Error("Expected failure");
    expect(result.error.actionHint).not.toMatch(/Google|网络|network/i);
    expect(generate).not.toHaveBeenCalled();
  });
  it("honors custom allowed roots without mutating process environment", async () => {
    const external = path.join(root, "external"); fs.mkdirSync(external); fs.writeFileSync(path.join(external, "ref.png"), png);
    fs.writeFileSync(path.join(workspace, "IDENTITY.md"), `Avatar: ${path.join(external, "ref.png")}\n`);
    expect(await call()).toMatchObject({ ok: false, error: { code: "NO_VALID_REFERENCE" } });
    options({ AvatarAllowedRoots: [external] });
    expect(await call()).toMatchObject({ ok: true });
    expect(process.env.AvatarAllowedRoots).toBeUndefined();
  });
  it.each([null, [], {}, "bad-json", ["relative"], []])("fails closed for invalid root configuration: %j", async roots => {
    options({ AvatarAllowedRoots: roots });
    expect(await call()).toMatchObject({ ok: false, error: { code: "CONFIG_INVALID" } });
    expect(generate).not.toHaveBeenCalled();
  });
  it.each([{ model: "fal/model" }, { model: null }, { model: "google/unknown" }, { AvatarMaxRefs: 6 }, { AvatarMaxRefs: "3junk" }, { AvatarBlendEnabled: null }])(
    "rejects invalid Google configuration without calling native generation: %j", async value => {
      options(value);
      expect(await call()).toMatchObject({ ok: false, error: { code: "CONFIG_INVALID" } });
      expect(generate).not.toHaveBeenCalled();
    });
  it("uses explicit config before legacy env settings and supports another native Google model", async () => {
    vi.stubEnv("AvatarMaxRefs", "0");
    options({ model: "google/gemini-3.1-flash-image", AvatarMaxRefs: 1 });
    generate.mockResolvedValue({ images: [{ buffer: png, mimeType: "image/png" }], provider: "google", model: "gemini-3.1-flash-image", ignoredOverrides: [] });
    expect(await call()).toMatchObject({ ok: true });
    expect(generate.mock.calls[0][0].modelOverride).toBe("google/gemini-3.1-flash-image");
  });
  it("rejects an outside directory junction under the default roots", async () => {
    const external = path.join(root, "private"); fs.mkdirSync(external); fs.writeFileSync(path.join(external, "ref.png"), png);
    fs.rmSync(path.join(workspace, "assets"), { recursive: true });
    fs.symlinkSync(external, path.join(workspace, "assets"), "junction");
    fs.writeFileSync(path.join(workspace, "IDENTITY.md"), "Avatar: assets/ref.png\nAvatarsDir: assets\n");
    expect(await call()).toMatchObject({ ok: false, error: { code: "NO_VALID_REFERENCE" } });
    expect(generate).not.toHaveBeenCalled();
  });
  it("does not reopen reference paths after passing validated buffers", async () => {
    const spy = vi.spyOn(images, "readReferenceImage");
    generate.mockImplementationOnce(async params => {
      fs.writeFileSync(path.join(workspace, "assets/main.png"), "changed after dispatch");
      expect(params.inputImages[0].buffer).toEqual(png);
      return { images: [{ buffer: png, mimeType: "image/png" }], provider: "google", model: "gemini-3-pro-image", ignoredOverrides: [] };
    });
    expect(await call()).toMatchObject({ ok: true });
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it.each([
    { images: [] }, { images: [{ buffer: png, mimeType: "image/png" }, { buffer: png, mimeType: "image/png" }] },
    { images: [{ buffer: Buffer.alloc(0), mimeType: "image/png" }] },
    { images: [{ buffer: png, mimeType: "image/jpeg" }] },
    { provider: "fal" }, { ignoredOverrides: [{ key: "resolution", value: "2K" }] },
  ])("reports invalid native outputs without retrying or fabricating a file: %j", async override => {
    generate.mockResolvedValue({ images: [{ buffer: png, mimeType: "image/png" }], provider: "google", model: "gemini-3-pro-image", ignoredOverrides: [], ...override });
    expect(await call()).toMatchObject({ ok: false, error: { code: "OUTPUT_INVALID", generationOutcome: "succeeded" } });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(workspace, "stella-selfie"))).toBe(false);
  });
  it("returns an explicit timeout with uncertain outcome and never echoes the raw credential", async () => {
    generate.mockRejectedValue(new Error("request timed out; api_key=private-test-key"));
    const result = await call();
    expect(result).toMatchObject({ ok: false, error: { code: "TIMEOUT", stage: "generate", generationOutcome: "unknown" } });
    expect(JSON.stringify(result)).not.toContain("private-test-key");
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("keeps concurrent Agent references, settings and auth directories independent", async () => {
    const other = path.join(root, "other workspace");
    const references = path.join(root, "other approved references");
    fs.mkdirSync(other); fs.mkdirSync(references);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    fs.writeFileSync(path.join(references, "other.jpg"), jpeg);
    fs.writeFileSync(path.join(other, "IDENTITY.md"), `Avatar: ${path.join(references, "other.jpg")}\n`);
    const otherConfig = { skills: { entries: { "stella-selfie": { config: { AvatarAllowedRoots: [references], AvatarMaxRefs: 1 } } } } };
    const otherGenerate = vi.fn(async (params) => {
      await Promise.resolve();
      expect(params.inputImages[0].buffer).toEqual(jpeg);
      expect(params.agentDir).toBe(path.join(root, "auth/other"));
      return { images: [{ buffer: png, mimeType: "image/png" }], provider: "google", model: "gemini-3-pro-image", ignoredOverrides: [] };
    });
    const otherHost = { config: otherConfig, runtime: {
      agent: { resolveAgentWorkspaceDir: () => other, resolveAgentDir: () => path.join(root, "auth/other") },
      imageGeneration: { listProviders: () => [provider], generate: otherGenerate },
    } };
    const [first, second] = await Promise.all([
      call(), generateForBili(otherHost, { listAgentIds: () => ["other"] }, { ...request, agentId: "other" }),
    ]);
    expect(first).toMatchObject({ ok: true, agentId: "main" });
    expect(second).toMatchObject({ ok: true, agentId: "other" });
    expect(generate.mock.calls[0][0].inputImages[0].buffer).toEqual(png);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(otherGenerate).toHaveBeenCalledTimes(1);
    expect(fs.readdirSync(other)).toEqual(["IDENTITY.md"]);
    expect(process.env.AvatarAllowedRoots).toBeUndefined();
  });
});
