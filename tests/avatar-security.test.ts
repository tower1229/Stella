import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectAvatars } from "../scripts/avatars";
import { generateWithGemini } from "../scripts/providers/gemini";
import { generateWithLaozhang } from "../scripts/providers/laozhang";

const provider = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class {
  models = { generateContent: provider.generate };
} }));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");

describe("avatar upload boundary", () => {
  let root: string;
  let avatar: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "stella-avatar-boundary-"));
    fs.mkdirSync(path.join(root, "avatars"));
    avatar = path.join(root, "avatars", "main.png");
    fs.writeFileSync(avatar, png);
    vi.stubEnv("AvatarAllowedRoots", JSON.stringify([path.join(root, "avatars")]));
    vi.stubGlobal("fetch", vi.fn());
    provider.generate.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fs.rmSync(root, { recursive: true, force: true });
  });
  function select(file = avatar, dir: string | null = path.dirname(avatar)) {
    return selectAvatars({ avatar: file, avatarsDir: dir, avatarMaxRefs: 3, avatarBlendEnabled: true });
  }
  it("keeps authorized images selectable", () => {
    expect(select()).toEqual([avatar]);
  });
  it.each(["secret.txt", "disguised.png"])("rejects non-image primary avatars: %s", (name) => {
    const file = path.join(path.dirname(avatar), name);
    fs.writeFileSync(file, "private-not-an-image");
    expect(select(file, null)).toEqual([]);
  });
  it("rejects sibling-prefix traversal and external files even when they are images", () => {
    const sibling = path.join(root, "avatars-private");
    fs.mkdirSync(sibling);
    const file = path.join(sibling, "private.png");
    fs.writeFileSync(file, png);
    expect(select(file, sibling)).toEqual([]);
  });
  it("rejects primary symlinks escaping an authorized root", () => {
    const external = path.join(root, "private.png");
    fs.writeFileSync(external, png);
    fs.unlinkSync(avatar);
    fs.symlinkSync(external, avatar);
    expect(select(avatar, null)).toEqual([]);
  });
  it("rejects nonregular and oversized primary files", () => {
    expect(select(path.dirname(avatar), null)).toEqual([]);
    fs.truncateSync(avatar, 20 * 1024 * 1024 + 1);
    expect(select(avatar, null)).toEqual([]);
  });
  it.each(['not-json', '{}', '[]', '["relative/path"]'])("fails closed for invalid root authorization: %s", (roots) => {
    vi.stubEnv("AvatarAllowedRoots", roots);
    expect(select()).toEqual([]);
  });
  it.each(["gemini", "laozhang"])("%s revalidates a reference changed after selection", async (name) => {
    expect(select()).toEqual([avatar]);
    const external = path.join(root, "external.png");
    fs.writeFileSync(external, png);
    fs.unlinkSync(avatar);
    fs.symlinkSync(external, avatar);
    const generate = name === "gemini" ? generateWithGemini : generateWithLaozhang;
    await expect(generate({ prompt: "test", referenceImages: [avatar], count: 1, resolution: "1K", apiKey: "mock-key" }))
      .rejects.toThrow();
    expect(provider.generate).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["gemini", "laozhang"])("%s rejects invalid input before any API request", async (name) => {
    fs.writeFileSync(avatar, "private-not-an-image");
    const generate = name === "gemini" ? generateWithGemini : generateWithLaozhang;
    await expect(generate({ prompt: "test", referenceImages: [avatar], count: 1, resolution: "1K", apiKey: "mock-key" }))
      .rejects.toThrow();
    expect(provider.generate).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
