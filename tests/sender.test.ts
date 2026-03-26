import { describe, it, expect, vi, beforeEach } from "vitest";
import * as util from "util";

vi.mock("child_process");
vi.mock("util");

const mockExecAsync = vi.fn();
vi.mocked(util.promisify).mockReturnValue(mockExecAsync as any);

async function getModule() {
  const mod = await import("../scripts/sender");
  return mod;
}

describe("sendImage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.mocked(util.promisify).mockReturnValue(mockExecAsync as any);
  });

  it("calls openclaw CLI with correct 2026.3.13 format", async () => {
    mockExecAsync.mockResolvedValue({ stdout: "ok", stderr: "" });

    const { sendImage } = await getModule();
    await sendImage({
      channel: "telegram",
      target: "@myuser",
      media: "https://example.com/img.jpg",
      message: "Hello!",
    });

    expect(mockExecAsync).toHaveBeenCalledOnce();
    const cmd: string = mockExecAsync.mock.calls[0][0];
    expect(cmd).toContain("openclaw message send");
    expect(cmd).toContain("--channel");
    expect(cmd).toContain("telegram");
    expect(cmd).toContain("--target");
    expect(cmd).toContain("@myuser");
    expect(cmd).toContain("--media");
    expect(cmd).toContain("https://example.com/img.jpg");
    expect(cmd).toContain("--message");
    expect(cmd).toContain("Hello!");
  });

  it("omits --message flag when caption is empty", async () => {
    mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });

    const { sendImage } = await getModule();
    await sendImage({
      channel: "discord",
      target: "#general",
      media: "https://example.com/img.jpg",
      message: "",
    });

    const cmd: string = mockExecAsync.mock.calls[0][0];
    expect(cmd).not.toContain("--message");
  });

  it("supports sending text-only message (no media) via CLI", async () => {
    mockExecAsync.mockResolvedValue({ stdout: "ok", stderr: "" });

    const { sendMessage } = await getModule();
    await sendMessage({
      channel: "telegram",
      target: "@myuser",
      message: "generation failed",
    });

    const cmd: string = mockExecAsync.mock.calls[0][0];
    expect(cmd).toContain("openclaw message send");
    expect(cmd).toContain("--message");
    expect(cmd).toContain("generation failed");
    expect(cmd).not.toContain("--media");
  });
});
