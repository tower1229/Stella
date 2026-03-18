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

  it("returns null for missing Avatar and AvatarsDir", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(`Name: Stella\n`);
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatar).toBeNull();
    expect(result.avatarsDir).toBeNull();
    expect(result.avatarMaxRefs).toBe(4);
  });

  it("uses default AvatarMaxRefs of 4 when not specified", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(`Avatar: ./avatar.png\n`);
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatarMaxRefs).toBe(4);
  });

  it("ignores invalid AvatarMaxRefs and uses default", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(`AvatarMaxRefs: abc\n`);
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatarMaxRefs).toBe(4);
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
      `AvatarMaxRefs: 3  # optional, default 4\n`
    );
    const parseIdentity = await getParseIdentity();
    const result = parseIdentity(workspace);

    expect(result.avatarMaxRefs).toBe(3);
  });
});
