import { describe, it, expect, vi, beforeEach } from "vitest";
import * as childProcess from "child_process";
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

  it("falls back to HTTP when CLI fails", async () => {
    mockExecAsync.mockRejectedValue(new Error("command not found: openclaw"));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "ok",
    });
    vi.stubGlobal("fetch", mockFetch);

    const { sendImage } = await getModule();
    await sendImage({
      channel: "telegram",
      target: "@myuser",
      media: "https://example.com/img.jpg",
      message: "Hello!",
      gatewayToken: "secret-token",
      gatewayUrl: "http://localhost:18789",
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:18789/message");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Authorization"]).toBe("Bearer secret-token");

    const body = JSON.parse(opts.body);
    expect(body.channel).toBe("telegram");
    expect(body.target).toBe("@myuser");
    expect(body.media).toBe("https://example.com/img.jpg");
    expect(body.message).toBe("Hello!");
  });

  it("throws if both CLI and HTTP fail", async () => {
    mockExecAsync.mockRejectedValue(new Error("CLI error"));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });
    vi.stubGlobal("fetch", mockFetch);

    const { sendImage } = await getModule();
    await expect(
      sendImage({
        channel: "telegram",
        target: "@myuser",
        media: "https://example.com/img.jpg",
      })
    ).rejects.toThrow("OpenClaw HTTP send failed");
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

  it("sends Authorization header only when gatewayToken is provided", async () => {
    mockExecAsync.mockRejectedValue(new Error("CLI unavailable"));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "ok",
    });
    vi.stubGlobal("fetch", mockFetch);

    const { sendImage } = await getModule();
    await sendImage({
      channel: "telegram",
      target: "@user",
      media: "https://example.com/img.jpg",
      // No gatewayToken
    });

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers["Authorization"]).toBeUndefined();
  });
});
