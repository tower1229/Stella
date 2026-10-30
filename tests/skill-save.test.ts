import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const mocks = vi.hoisted(() => ({
  parseIdentity: vi.fn(),
  selectAvatars: vi.fn(),
  gemini: vi.fn(),
  laozhang: vi.fn(),
  fal: vi.fn(),
  sendImage: vi.fn(),
  sendMessage: vi.fn(),
  download: vi.fn(),
}));

vi.mock("../scripts/identity", () => ({ parseIdentity: mocks.parseIdentity }));
vi.mock("../scripts/avatars", () => ({ selectAvatars: mocks.selectAvatars }));
vi.mock("../scripts/providers/gemini", () => ({ generateWithGemini: mocks.gemini }));
vi.mock("../scripts/providers/laozhang", () => ({ generateWithLaozhang: mocks.laozhang }));
vi.mock("../scripts/providers/fal", () => ({ generateWithFal: mocks.fal }));
vi.mock("../scripts/sender", () => ({
  sendImage: mocks.sendImage,
  sendMessage: mocks.sendMessage,
}));
// Keep real disk I/O while allowing individual failure injection on Node exports.
vi.mock("fs", async (importOriginal) => ({
  ...await importOriginal<typeof fs>(),
}));

vi.mock("../scripts/media-download", async (importOriginal) => ({
  ...await importOriginal<typeof import("../scripts/media-download")>(),
  downloadImage: mocks.download,
}));

import { runSkill } from "../scripts/skill";

const argv = [
  "node", "skill.js", "--prompt", "test prompt", "--target", "@user",
  "--channel", "telegram", "--caption", "test caption", "--resolution", "2K",
  "--count", "2",
];
const imageBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const imageUrl = "https://cdn.example.com/output.jpg?signature=test";

describe("runSkill persistent image copies", () => {
  let root: string;
  let source: string;
  let log: MockInstance<typeof console.log>;
  let warn: MockInstance<typeof console.warn>;
  let downloadMock: ReturnType<typeof vi.fn>;

  function localResult(outputPath = source) {
    return { outputPath, imageData: imageBytes, mimeType: "image/png" };
  }

  function savedPaths(): string[] {
    return log.mock.calls
      .map(([message]) => String(message))
      .filter((message) => message.startsWith("[stella] Saved image copy: "))
      .map((message) => message.slice("[stella] Saved image copy: ".length));
  }

  function expectSaveFailure() {
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("SAVE_FAILED:"));
    expect(savedPaths()).toEqual([]);
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  }

  beforeEach(() => {
    vi.resetAllMocks();
    root = fs.mkdtempSync(path.join(os.tmpdir(), "stella-save-test-"));
    source = path.join(root, "original.png");
    fs.writeFileSync(source, imageBytes);
    vi.stubEnv("Provider", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "mock-key");
    vi.stubEnv("LAOZHANG_API_KEY", "mock-key");
    vi.stubEnv("FAL_KEY", "mock-key");
    vi.stubEnv("AvatarBlendEnabled", "true");
    mocks.parseIdentity.mockReturnValue({
      avatar: source,
      avatarsDir: root,
      avatarsURLs: ["https://cdn.example.com/ref.jpg"],
    });
    mocks.selectAvatars.mockReturnValue([source]);
    mocks.gemini.mockResolvedValue([localResult()]);
    mocks.laozhang.mockResolvedValue([localResult()]);
    mocks.fal.mockResolvedValue([{ imageUrl }]);
    mocks.sendImage.mockResolvedValue(undefined);
    log = vi.spyOn(console, "log").mockImplementation(() => {});
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    downloadMock = mocks.download;
    downloadMock.mockResolvedValue({ data: imageBytes, extension: ".png" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it.each(["gemini", "laozhang", "fal"])("keeps default %s delivery unchanged without saving or downloading", async (provider) => {
    vi.stubEnv("Provider", provider);
    const mkdir = vi.spyOn(fs, "mkdirSync");
    const write = vi.spyOn(fs, "writeFileSync");

    await runSkill(argv);

    expect(mocks.sendImage).toHaveBeenCalledExactlyOnceWith({
      channel: "telegram", target: "@user", message: "test caption",
      media: provider === "fal" ? imageUrl : source,
    });
    expect(fs.existsSync(source)).toBe(provider === "fal");
    expect(mkdir).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(downloadMock).not.toHaveBeenCalled();
    expect(savedPaths()).toEqual([]);
  });

  it.each(["gemini", "laozhang"])("saves a real %s copy before sending and keeps it after cleanup", async (provider) => {
    vi.stubEnv("Provider", provider);
    const directory = path.join(root, "new", "copies with spaces");
    mocks.sendImage.mockImplementation(async () => {
      expect(fs.existsSync(source)).toBe(true);
      expect(savedPaths()).toHaveLength(1);
      expect(fs.readFileSync(savedPaths()[0])).toEqual(imageBytes);
    });

    await runSkill([...argv, "--save-dir", directory]);

    const [copy] = savedPaths();
    expect(path.isAbsolute(copy)).toBe(true);
    expect(path.dirname(copy)).toBe(directory);
    expect(fs.readFileSync(copy)).toEqual(imageBytes);
    expect(fs.existsSync(source)).toBe(false);
    expect(mocks[provider as "gemini" | "laozhang"]).toHaveBeenCalledExactlyOnceWith({
      prompt: "test prompt", referenceImages: [source], resolution: "2K", count: 2,
    });
    expect(mocks.sendImage).toHaveBeenCalledExactlyOnceWith({
      channel: "telegram", target: "@user", message: "test caption", media: source,
    });
  });

  it("resolves a relative save directory to an absolute output path", async () => {
    const directory = path.join(root, "copies");
    await runSkill([...argv, "--save-dir", path.relative(process.cwd(), directory)]);
    expect(path.dirname(savedPaths()[0])).toBe(directory);
    expect(fs.readFileSync(savedPaths()[0])).toEqual(imageBytes);
  });

  it("saves all same-named images without overwriting existing files", async () => {
    const secondDir = path.join(root, "second");
    fs.mkdirSync(secondDir);
    const second = path.join(secondDir, "original.png");
    fs.writeFileSync(second, Buffer.concat([imageBytes, Buffer.from("second")]));
    const directory = path.join(root, "copies");
    fs.mkdirSync(directory);
    const existing = path.join(directory, "original.png");
    fs.writeFileSync(existing, "keep existing");
    mocks.gemini.mockResolvedValue([localResult(), localResult(second)]);

    await runSkill([...argv, "--save-dir", directory]);

    expect(savedPaths()).toHaveLength(2);
    expect(new Set(savedPaths()).size).toBe(2);
    expect(savedPaths().map((file) => fs.readFileSync(file, "utf8")))
      .toEqual([imageBytes.toString(), Buffer.concat([imageBytes, Buffer.from("second")]).toString()]);
    expect(fs.readFileSync(existing, "utf8")).toBe("keep existing");
    expect(fs.existsSync(source)).toBe(false);
    expect(fs.existsSync(second)).toBe(false);
    expect(mocks.sendImage).toHaveBeenCalledTimes(2);
  });

  it("keeps copies when save directory equals the provider temporary directory", async () => {
    await runSkill([...argv, "--save-dir", root]);
    expect(savedPaths()).toHaveLength(1);
    expect(savedPaths()[0]).not.toBe(source);
    expect(fs.readFileSync(savedPaths()[0])).toEqual(imageBytes);
    expect(fs.existsSync(source)).toBe(false);
  });

  it("downloads each fal image while continuing to send the original URLs", async () => {
    vi.stubEnv("Provider", "fal");
    const secondUrl = "https://other.example.com/output.jpg";
    mocks.fal.mockResolvedValue([{ imageUrl }, { imageUrl: secondUrl }]);


    await runSkill([...argv, "--save-dir", root]);

    expect(savedPaths()).toHaveLength(2);
    expect(new Set(savedPaths()).size).toBe(2);
    for (const copy of savedPaths()) {
      expect(path.isAbsolute(copy)).toBe(true);
      expect(fs.readFileSync(copy)).toEqual(imageBytes);
      expect(path.extname(copy)).toBe(".png");
    }
    expect(downloadMock).toHaveBeenCalledTimes(2);
    expect(downloadMock).toHaveBeenCalledWith(imageUrl);
    expect(mocks.sendImage.mock.calls.map(([options]) => options.media)).toEqual([imageUrl, secondUrl]);
    expect(mocks.fal).toHaveBeenCalledExactlyOnceWith({
      prompt: "test prompt", referenceImageUrls: ["https://cdn.example.com/ref.jpg"],
      resolution: "2K", count: 2,
    });
  });

  it("reports an HTTP download failure independently and still saves later fal images", async () => {
    vi.stubEnv("Provider", "fal");
    mocks.fal.mockResolvedValue([{ imageUrl }, { imageUrl: "https://cdn.example.com/next.jpg" }]);
    downloadMock.mockRejectedValueOnce(new Error("Download failed: HTTP 503"));

    await runSkill([...argv, "--save-dir", path.join(root, "copies")]);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("HTTP 503"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("SAVE_FAILED:"));
    expect(savedPaths()).toHaveLength(1);
    expect(fs.readFileSync(savedPaths()[0])).toEqual(imageBytes);
    expect(mocks.sendImage).toHaveBeenCalledTimes(2);
    expect(mocks.fal).toHaveBeenCalledTimes(1);
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it.each(["network", "body", "timeout"])("continues fal delivery after %s download interruption", async (failure) => {
    vi.stubEnv("Provider", "fal");
    downloadMock.mockRejectedValue(new Error(failure === "timeout" ? "download timed out" : "connection reset"));
    const directory = path.join(root, "copies");

    await runSkill([...argv, "--save-dir", directory]);

    expectSaveFailure();
    expect(fs.readdirSync(directory)).toEqual([]);
    expect(mocks.fal).toHaveBeenCalledTimes(1);
    expect(mocks.sendImage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ media: imageUrl }));
  });

  it.each(["gemini", "laozhang", "fal"])("continues %s delivery when the save directory is invalid", async (provider) => {
    vi.stubEnv("Provider", provider);
    await runSkill([...argv, "--save-dir", source]); // An existing file cannot be a directory.
    expectSaveFailure();
    expect(mocks[provider as "gemini" | "laozhang" | "fal"]).toHaveBeenCalledTimes(1);
    expect(mocks.sendImage).toHaveBeenCalledTimes(1);
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("reports a permission error and still sends without repeating generation", async () => {
    vi.spyOn(fs, "openSync").mockImplementation(() => {
      throw Object.assign(new Error("permission denied"), { code: "EACCES" });
    });
    await runSkill([...argv, "--save-dir", path.join(root, "copies")]);
    expectSaveFailure();
    expect(mocks.gemini).toHaveBeenCalledTimes(1);
    expect(mocks.sendImage).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(source)).toBe(false);
  });

  it("continues saving and sending later images after a source copy read failure", async () => {
    const missing = path.join(root, "missing.png");
    mocks.gemini.mockResolvedValue([localResult(missing), localResult()]);
    await runSkill([...argv, "--save-dir", path.join(root, "copies")]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("SAVE_FAILED:"));
    expect(savedPaths()).toHaveLength(1);
    expect(fs.readFileSync(savedPaths()[0])).toEqual(imageBytes);
    expect(mocks.sendImage.mock.calls.map(([options]) => options.media)).toEqual([missing, source]);
    expect(mocks.gemini).toHaveBeenCalledTimes(1);
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it("removes an incomplete copy after a write error and still sends", async () => {
    vi.spyOn(fs, "writeFileSync").mockImplementation((file) => {
      fs.writeSync(file as number, Buffer.from("partial"));
      throw new Error("disk full");
    });
    const directory = path.join(root, "copies");
    await runSkill([...argv, "--save-dir", directory]);
    expectSaveFailure();
    expect(fs.readdirSync(directory)).toEqual([]);
    expect(mocks.gemini).toHaveBeenCalledTimes(1);
    expect(mocks.sendImage).toHaveBeenCalledTimes(1);
  });

  it("does not delete an existing file when exclusive creation fails", async () => {
    const existing = path.join(root, "keep.png");
    fs.writeFileSync(existing, "keep existing");
    const originalOpen = fs.openSync;
    const open = vi.spyOn(fs, "openSync").mockImplementation((file, flags, mode) => {
      if (flags === "wx") throw Object.assign(new Error("file exists"), { code: "EEXIST" });
      return originalOpen(file, flags, mode);
    });
    await runSkill([...argv, "--save-dir", root]);
    expectSaveFailure();
    expect(open).toHaveBeenCalledWith(expect.stringContaining("stella-copy-"), "wx");
    expect(fs.readFileSync(existing, "utf8")).toBe("keep existing");
    expect(mocks.sendImage).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])("preserves SEND_FAILED semantics when copy saving succeeds=%s", async (saveSucceeds) => {
    mocks.sendImage.mockRejectedValue(new Error("gateway unavailable"));
    await expect(runSkill([...argv, "--save-dir", saveSucceeds ? path.join(root, "copies") : source]))
      .rejects.toMatchObject({ name: "StellaError", details: { provider: "openclaw", code: "SEND_FAILED" } });
    expect(mocks.gemini).toHaveBeenCalledTimes(1);
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(fs.readFileSync(source)).toEqual(imageBytes);
    if (saveSucceeds) {
      expect(fs.readFileSync(savedPaths()[0])).toEqual(imageBytes);
    } else {
      expectSaveFailure();
    }
  });

  it.each(["gemini", "laozhang", "fal"])("saves all %s copies even when the first send fails", async (provider) => {
    vi.stubEnv("Provider", provider);
    const second = path.join(root, "second.png");
    fs.writeFileSync(second, Buffer.concat([imageBytes, Buffer.from("second")]));
    mocks.gemini.mockResolvedValue([localResult(), localResult(second)]);
    mocks.laozhang.mockResolvedValue([localResult(), localResult(second)]);
    mocks.fal.mockResolvedValue([{ imageUrl }, { imageUrl: "https://cdn.example.com/next.jpg" }]);

    mocks.sendImage.mockRejectedValue(new Error("gateway unavailable"));

    await expect(runSkill([...argv, "--save-dir", path.join(root, "copies")]))
      .rejects.toMatchObject({ details: { provider: "openclaw", code: "SEND_FAILED" } });

    expect(savedPaths()).toHaveLength(2);
    for (const copy of savedPaths()) expect(fs.statSync(copy).size).toBeGreaterThan(0);
    expect(mocks.sendImage).toHaveBeenCalledTimes(1);
    expect(mocks[provider as "gemini" | "laozhang" | "fal"]).toHaveBeenCalledTimes(1);
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(fs.existsSync(source)).toBe(true);
    expect(fs.existsSync(second)).toBe(true);
  });

  it.each([{ value: [] }, { value: [""] }, { value: ["--count", "2"] }])("rejects a missing save directory before generation: $value", async ({ value }) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit:1"); });
    await expect(runSkill([...argv, "--save-dir", ...value])).rejects.toThrow("exit:1");
    expect(mocks.gemini).not.toHaveBeenCalled();
    expect(mocks.sendImage).not.toHaveBeenCalled();
  });
  it.each([false, true])("rejects a local fal result before copying or delivery (save=%s)", async (save) => {
    vi.stubEnv("Provider", "fal");
    mocks.fal.mockResolvedValue([{ imageUrl: source }]);
    await expect(runSkill(save ? [...argv, "--save-dir", root] : argv)).rejects.toThrow();
    expect(mocks.sendImage).not.toHaveBeenCalled();
    expect(downloadMock).not.toHaveBeenCalled();
    expect(fs.readFileSync(source)).toEqual(imageBytes);
  });

});
