import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";

vi.mock("fs");

// Use `any` to avoid Dirent generic type mismatch between Node versions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFs = vi.mocked(fs) as any;

async function getSelectAvatars() {
  const { selectAvatars } = await import("../scripts/avatars");
  return selectAvatars;
}

function makeStat(birthtimeMs: number, mtimeMs = 0, ctimeMs = 0): fs.Stats {
  return {
    birthtimeMs,
    mtimeMs,
    ctimeMs,
    isFile: () => true,
  } as unknown as fs.Stats;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeDirent(name: string): any {
  return { name, isFile: () => true };
}

describe("selectAvatars", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns empty array when no avatar and blend disabled", async () => {
    const selectAvatars = await getSelectAvatars();
    const result = selectAvatars({
      avatar: null,
      avatarsDir: null,
      avatarMaxRefs: 4,
      avatarBlendEnabled: false,
    });
    expect(result).toEqual([]);
  });

  it("returns only Avatar when blend is disabled", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.realpathSync.mockReturnValue("/mock/avatar.png");
    const selectAvatars = await getSelectAvatars();

    const result = selectAvatars({
      avatar: "/mock/avatar.png",
      avatarsDir: "/mock/avatars",
      avatarMaxRefs: 4,
      avatarBlendEnabled: false,
    });

    expect(result).toEqual(["/mock/avatar.png"]);
  });

  it("warns and skips when AvatarsDir does not exist", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFs.existsSync.mockImplementation((p: string) => p !== "/mock/avatars");
    const selectAvatars = await getSelectAvatars();

    const result = selectAvatars({
      avatar: null,
      avatarsDir: "/mock/avatars",
      avatarMaxRefs: 4,
      avatarBlendEnabled: true,
    });

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("AvatarsDir not found")
    );
  });

  it("sorts files by birthtime descending", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.realpathSync.mockImplementation((p: string) => p);
    mockFs.readdirSync.mockReturnValue([
      makeDirent("old.jpg"),
      makeDirent("new.jpg"),
      makeDirent("mid.jpg"),
    ]);
    mockFs.statSync.mockImplementation((p: string) => {
      const name = p.split("/").pop()!;
      if (name === "old.jpg") return makeStat(1000);
      if (name === "new.jpg") return makeStat(3000);
      if (name === "mid.jpg") return makeStat(2000);
      return makeStat(0);
    });

    const selectAvatars = await getSelectAvatars();
    const result = selectAvatars({
      avatar: null,
      avatarsDir: "/mock/avatars",
      avatarMaxRefs: 4,
      avatarBlendEnabled: true,
    });

    expect(result.map((p) => (p as string).split("/").pop())).toEqual([
      "new.jpg",
      "mid.jpg",
      "old.jpg",
    ]);
  });

  it("deduplicates Avatar that also appears in AvatarsDir", async () => {
    const avatarPath = "/mock/avatars/main.jpg";
    mockFs.existsSync.mockReturnValue(true);
    mockFs.realpathSync.mockReturnValue(avatarPath);
    mockFs.readdirSync.mockReturnValue([
      makeDirent("main.jpg"),
      makeDirent("other.jpg"),
    ]);
    mockFs.statSync.mockReturnValue(makeStat(1000));

    const selectAvatars = await getSelectAvatars();
    const result = selectAvatars({
      avatar: avatarPath,
      avatarsDir: "/mock/avatars",
      avatarMaxRefs: 4,
      avatarBlendEnabled: true,
    });

    // Avatar appears once at position 0, not duplicated
    expect(result.filter((p) => p === avatarPath)).toHaveLength(1);
    expect(result[0]).toBe(avatarPath);
  });

  it("respects AvatarMaxRefs limit", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.realpathSync.mockImplementation((p: string) => p);
    mockFs.readdirSync.mockReturnValue(
      ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg"].map(makeDirent)
    );
    mockFs.statSync.mockReturnValue(makeStat(1000));

    const selectAvatars = await getSelectAvatars();
    const result = selectAvatars({
      avatar: null,
      avatarsDir: "/mock/avatars",
      avatarMaxRefs: 3,
      avatarBlendEnabled: true,
    });

    expect(result).toHaveLength(3);
  });

  it("skips non-image files", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.realpathSync.mockImplementation((p: string) => p);
    mockFs.readdirSync.mockReturnValue(
      ["photo.jpg", "readme.txt", "icon.gif", "shot.png"].map(makeDirent)
    );
    mockFs.statSync.mockReturnValue(makeStat(1000));

    const selectAvatars = await getSelectAvatars();
    const result = selectAvatars({
      avatar: null,
      avatarsDir: "/mock/avatars",
      avatarMaxRefs: 10,
      avatarBlendEnabled: true,
    });

    const names = result.map((p) => (p as string).split("/").pop()!);
    expect(names).toContain("photo.jpg");
    expect(names).toContain("shot.png");
    expect(names).not.toContain("readme.txt");
    expect(names).not.toContain("icon.gif");
  });

  it("falls back to mtime when birthtime is 0", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.realpathSync.mockImplementation((p: string) => p);
    mockFs.readdirSync.mockReturnValue(["a.jpg", "b.jpg"].map(makeDirent));
    mockFs.statSync.mockImplementation((p: string) => {
      const name = p.split("/").pop()!;
      // birthtime = 0 (unavailable), use mtime
      if (name === "a.jpg") return makeStat(0, 2000, 1000);
      return makeStat(0, 1000, 500);
    });

    const selectAvatars = await getSelectAvatars();
    const result = selectAvatars({
      avatar: null,
      avatarsDir: "/mock/avatars",
      avatarMaxRefs: 4,
      avatarBlendEnabled: true,
    });

    expect(result).toHaveLength(2);
    expect((result[0] as string).split("/").pop()).toBe("a.jpg");
  });
});
