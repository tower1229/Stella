import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

vi.mock("fs");

const mockFs = vi.mocked(fs);

// Re-import after mocking
async function getParseIdentity() {
  const { parseIdentity } = await import("../scripts/identity");
  return parseIdentity;
}

describe("parseIdentity", () => {
  const workspace = "/mock/workspace";

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("throws if IDENTITY.md does not exist", async () => {
    mockFs.existsSync.mockReturnValue(false);
    const parseIdentity = await getParseIdentity();
    expect(() => parseIdentity(workspace)).toThrow("IDENTITY.md not found");
  });

  it("parses Avatar and AvatarsDir", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      `Name: Stella\nAvatar: ./assets/avatar.png\nAvatarsDir: ./avatars\n`
    );
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatar).toBe(path.resolve(workspace, "./assets/avatar.png"));
    expect(result.avatarsDir).toBe(path.resolve(workspace, "./avatars"));
  });

  it("returns null for missing Avatar and AvatarsDir, empty avatarsURLs", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(`Name: Stella\n`);
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatar).toBeNull();
    expect(result.avatarsDir).toBeNull();
    expect(result.avatarsURLs).toEqual([]);
  });


  it("resolves absolute Avatar path as-is", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(`Avatar: /absolute/path/avatar.png\n`);
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatar).toBe("/absolute/path/avatar.png");
  });

  it("parses AvatarsURLs as comma-separated HTTP/HTTPS URLs", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      `AvatarsURLs: https://cdn.example.com/ref1.jpg, https://cdn.example.com/ref2.jpg, https://cdn.example.com/ref3.jpg\n`
    );
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatarsURLs).toEqual([
      "https://cdn.example.com/ref1.jpg",
      "https://cdn.example.com/ref2.jpg",
      "https://cdn.example.com/ref3.jpg",
    ]);
  });

  it("filters out non-HTTP/HTTPS entries from AvatarsURLs", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      `AvatarsURLs: https://cdn.example.com/ref1.jpg, /local/path/img.jpg, ftp://bad.example.com/img.jpg\n`
    );
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatarsURLs).toEqual(["https://cdn.example.com/ref1.jpg"]);
  });

  it("returns empty avatarsURLs when AvatarsURLs is not set", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(`Avatar: ./avatar.png\n`);
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatarsURLs).toEqual([]);
  });

  it("parses Markdown list+bold format: - **Key:** value", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      `- **Avatar:** avatars/stella.jpg\n- **AvatarsDir:** avatars/\n`
    );
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatar).toBe(path.resolve(workspace, "avatars/stella.jpg"));
    expect(result.avatarsDir).toBe(path.resolve(workspace, "avatars/"));
  });

  it("parses Markdown list+bold format: - **Key**: value (colon outside bold)", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      `- **Avatar**: avatars/stella.jpg\n- **AvatarsDir**: avatars/\n`
    );
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatar).toBe(path.resolve(workspace, "avatars/stella.jpg"));
    expect(result.avatarsDir).toBe(path.resolve(workspace, "avatars/"));
  });

  it("parses mixed formats in the same file", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      `Name: Stella\n- **Avatar:** avatars/stella.jpg\nAvatarsDir: ./avatars\n- **AvatarsURLs:** https://cdn.example.com/ref1.jpg\n`
    );
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatar).toBe(path.resolve(workspace, "avatars/stella.jpg"));
    expect(result.avatarsDir).toBe(path.resolve(workspace, "./avatars"));
    expect(result.avatarsURLs).toEqual(["https://cdn.example.com/ref1.jpg"]);
  });
});
