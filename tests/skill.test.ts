import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";

const mockParseIdentity = vi.fn();
const mockSelectAvatars = vi.fn();
const mockGenerateWithGemini = vi.fn();
const mockGenerateWithFal = vi.fn();
const mockSendImage = vi.fn();
const mockSendMessage = vi.fn();

vi.mock("../scripts/identity", () => ({
  parseIdentity: mockParseIdentity,
}));

vi.mock("../scripts/avatars", () => ({
  selectAvatars: mockSelectAvatars,
}));

vi.mock("../scripts/providers/gemini", () => ({
  generateWithGemini: mockGenerateWithGemini,
}));

vi.mock("../scripts/providers/fal", () => ({
  generateWithFal: mockGenerateWithFal,
}));

vi.mock("../scripts/sender", () => ({
  sendImage: mockSendImage,
  sendMessage: mockSendMessage,
}));

vi.mock("fs");
const mockFs = vi.mocked(fs);

async function getModule() {
  const mod = await import("../scripts/skill");
  return mod;
}

function makeArgv(): string[] {
  return [
    "node",
    "scripts/skill.ts",
    "--prompt",
    "test prompt",
    "--target",
    "@user",
    "--channel",
    "telegram",
  ];
}

describe("runSkill", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.Provider = "gemini";
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.FAL_KEY = "test-fal-key";
    mockParseIdentity.mockReturnValue({
      avatar: null,
      avatarsDir: "/avatars",
      avatarsURLs: [],
    });
    mockSelectAvatars.mockReturnValue(["/avatars/main.png"]);
    mockGenerateWithFal.mockResolvedValue([]);
    mockSendImage.mockResolvedValue(undefined);
    mockSendMessage.mockResolvedValue(undefined);
    mockFs.unlinkSync.mockImplementation(() => undefined);
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([]);
  });

  function mockProcessExit() {
    return vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: string | number | null | undefined) => {
        throw new Error(`process.exit:${code}`);
      }) as never);
  }

  it("keeps success path unchanged and sends images", async () => {
    mockGenerateWithGemini.mockResolvedValue([
      {
        outputPath: "/tmp/out-1.png",
        mimeType: "image/png",
        imageData: Buffer.from("x"),
      },
    ]);
    const { runSkill } = await getModule();

    await runSkill(makeArgv());

    expect(mockSendImage).toHaveBeenCalledTimes(1);
    expect(mockFs.unlinkSync).toHaveBeenCalledWith("/tmp/out-1.png");
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("does not fail when generated file cleanup fails", async () => {
    mockGenerateWithGemini.mockResolvedValue([
      {
        outputPath: "/tmp/out-1.png",
        mimeType: "image/png",
        imageData: Buffer.from("x"),
      },
    ]);
    mockFs.unlinkSync.mockImplementation(() => {
      throw new Error("permission denied");
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { runSkill } = await getModule();

    await runSkill(makeArgv());

    expect(mockSendImage).toHaveBeenCalledTimes(1);
    expect(mockFs.unlinkSync).toHaveBeenCalledWith("/tmp/out-1.png");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to remove generated file")
    );
    warnSpy.mockRestore();
  });

  it("sends failure notification message when generation fails", async () => {
    const rateErr = Object.assign(new Error("RESOURCE_EXHAUSTED"), {
      status: 429,
    });
    mockGenerateWithGemini.mockRejectedValue(rateErr);
    const { runSkill } = await getModule();

    await expect(runSkill(makeArgv())).rejects.toMatchObject({
      name: "StellaError",
    });
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const firstCallArg = mockSendMessage.mock.calls[0][0];
    expect(firstCallArg.message).toContain("请求过于频繁");
  });

  it("keeps original error when failure notification also fails", async () => {
    mockGenerateWithGemini.mockRejectedValue(new Error("internal"));
    mockSendMessage.mockRejectedValue(new Error("notify failed"));
    const { runSkill } = await getModule();

    await expect(runSkill(makeArgv())).rejects.toMatchObject({
      name: "StellaError",
    });
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it("maps sendImage failures to openclaw errors and skips failure notification", async () => {
    mockGenerateWithGemini.mockResolvedValue([
      {
        outputPath: "/tmp/out-1.png",
        mimeType: "image/png",
        imageData: Buffer.from("x"),
      },
    ]);
    mockSendImage.mockRejectedValue(new Error("gateway unavailable"));
    const { runSkill } = await getModule();

    await expect(runSkill(makeArgv())).rejects.toMatchObject({
      name: "StellaError",
      details: expect.objectContaining({
        provider: "openclaw",
        code: "SEND_FAILED",
      }),
    });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("stops generation and guides user when AvatarsDir check fails", async () => {
    mockParseIdentity.mockReturnValue({
      avatar: null,
      avatarsDir: "/bad/avatars",
      avatarsURLs: ["https://cdn.example.com/ref1.jpg"],
    });
    mockFs.existsSync.mockImplementation((p: fs.PathLike) => p !== "/bad/avatars");

    const { runSkill } = await getModule();
    await runSkill(makeArgv());

    expect(mockGenerateWithGemini).not.toHaveBeenCalled();
    expect(mockGenerateWithFal).not.toHaveBeenCalled();
    expect(mockSendImage).not.toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage.mock.calls[0][0].message).toContain("参考图目录读取失败");
  });

  it("stops fal generation and guides user when AvatarsURLs is not configured", async () => {
    process.env.Provider = "fal";
    mockParseIdentity.mockReturnValue({
      avatar: null,
      avatarsDir: null,
      avatarsURLs: [],
    });

    const { runSkill } = await getModule();
    await runSkill(makeArgv());

    expect(mockGenerateWithFal).not.toHaveBeenCalled();
    expect(mockGenerateWithGemini).not.toHaveBeenCalled();
    expect(mockSendImage).not.toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage.mock.calls[0][0].message).toContain("AvatarsURLs");
    expect(mockSendMessage.mock.calls[0][0].message).toContain("http/https");
  });

  it("stops non-fal generation when AvatarsDir is not configured", async () => {
    process.env.Provider = "gemini";
    mockParseIdentity.mockReturnValue({
      avatar: "/avatar/main.png",
      avatarsDir: null,
      avatarsURLs: ["https://cdn.example.com/ref1.jpg"],
    });

    const { runSkill } = await getModule();
    await runSkill(makeArgv());

    expect(mockGenerateWithGemini).not.toHaveBeenCalled();
    expect(mockGenerateWithFal).not.toHaveBeenCalled();
    expect(mockSendImage).not.toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage.mock.calls[0][0].message).toContain("AvatarsDir");
  });

  it("allows non-fal generation without AvatarsDir when AvatarBlendEnabled is false", async () => {
    process.env.Provider = "gemini";
    process.env.AvatarBlendEnabled = "false";
    mockParseIdentity.mockReturnValue({
      avatar: "/avatar/main.png",
      avatarsDir: null,
      avatarsURLs: [],
    });
    mockSelectAvatars.mockReturnValue(["/avatar/main.png"]);
    mockGenerateWithGemini.mockResolvedValue([
      {
        outputPath: "/tmp/out-1.png",
        mimeType: "image/png",
        imageData: Buffer.from("x"),
      },
    ]);

    const { runSkill } = await getModule();
    await runSkill(makeArgv());

    expect(mockGenerateWithGemini).toHaveBeenCalledTimes(1);
    expect(mockSendImage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("stops non-fal generation when AvatarsDir exists but no valid local refs found", async () => {
    process.env.Provider = "gemini";
    mockParseIdentity.mockReturnValue({
      avatar: null,
      avatarsDir: "/avatars",
      avatarsURLs: ["https://cdn.example.com/ref1.jpg"],
    });
    mockSelectAvatars.mockReturnValue([]);

    const { runSkill } = await getModule();
    await runSkill(makeArgv());

    expect(mockGenerateWithGemini).not.toHaveBeenCalled();
    expect(mockGenerateWithFal).not.toHaveBeenCalled();
    expect(mockSendImage).not.toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage.mock.calls[0][0].message).toContain("AvatarsDir");
  });

  it("fails fast when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const exitSpy = mockProcessExit();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runSkill } = await getModule();

    await expect(runSkill(makeArgv())).rejects.toThrow("process.exit:1");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("GEMINI_API_KEY is not set"));
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("fails fast when FAL_KEY is missing under fal provider", async () => {
    process.env.Provider = "fal";
    delete process.env.FAL_KEY;
    const exitSpy = mockProcessExit();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runSkill } = await getModule();

    await expect(runSkill(makeArgv())).rejects.toThrow("process.exit:1");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("FAL_KEY is not set"));
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
