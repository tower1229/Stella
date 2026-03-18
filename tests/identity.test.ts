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

  it("parses Avatar, AvatarsDir, and AvatarMaxRefs", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      `Name: Stella\nAvatar: ./assets/avatar.png\nAvatarsDir: ./avatars\nAvatarMaxRefs: 6\n`
    );
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatar).toBe(path.resolve(workspace, "./assets/avatar.png"));
    expect(result.avatarsDir).toBe(path.resolve(workspace, "./avatars"));
    expect(result.avatarMaxRefs).toBe(6);
  });

  it("returns null for missing Avatar and AvatarsDir, empty avatarsURLs", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(`Name: Stella\n`);
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatar).toBeNull();
    expect(result.avatarsDir).toBeNull();
    expect(result.avatarMaxRefs).toBe(3);
    expect(result.avatarsURLs).toEqual([]);
  });

  it("uses default AvatarMaxRefs of 3 when not specified", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(`Avatar: ./avatar.png\n`);
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatarMaxRefs).toBe(3);
  });

  it("ignores invalid AvatarMaxRefs and uses default of 3", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(`AvatarMaxRefs: abc\n`);
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatarMaxRefs).toBe(3);
  });

  it("resolves absolute Avatar path as-is", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(`Avatar: /absolute/path/avatar.png\n`);
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatar).toBe("/absolute/path/avatar.png");
  });

  it("strips inline comments from values", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      `AvatarMaxRefs: 2  # optional, default 3\n`
    );
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatarMaxRefs).toBe(2);
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

  it("respects AvatarMaxRefs limit when slicing AvatarsURLs", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      `AvatarMaxRefs: 2\nAvatarsURLs: https://a.com/1.jpg, https://a.com/2.jpg, https://a.com/3.jpg\n`
    );
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatarsURLs).toHaveLength(2);
    expect(result.avatarsURLs[0]).toBe("https://a.com/1.jpg");
    expect(result.avatarsURLs[1]).toBe("https://a.com/2.jpg");
  });
});
