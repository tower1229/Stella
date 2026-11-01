import * as path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseIdentity } from "../scripts/identity";
// identity.ts preserves the fs module's existing import spelling.
vi.mock("fs", () => ({ existsSync: vi.fn(), readFileSync: vi.fn() }));
import * as legacyFs from "fs";
describe("Agent identity fields", () => {
  const workspace = path.resolve("identity-fixture");
  beforeEach(() => { vi.mocked(legacyFs.existsSync).mockReturnValue(true); });
  it.each(["Avatar: assets/main.png", "- **Avatar:** assets/main.png", "- **Avatar**: assets/main.png", "* **Avatar:** assets/main.png"])("preserves accepted field syntax: %s", line => {
    vi.mocked(legacyFs.readFileSync).mockReturnValue(`${line}\nAvatarsDir: avatars\n`);
    expect(parseIdentity(workspace)).toEqual({ avatar: path.resolve(workspace, "assets/main.png"), avatarsDir: path.resolve(workspace, "avatars") });
  });
  it("keeps absolute paths and ignores retired URL-only fields", () => {
    const avatar = path.resolve("external/main.png");
    vi.mocked(legacyFs.readFileSync).mockReturnValue(`Avatar: ${avatar}\nAvatarsURLs: https://example.com/ref.png\n`);
    expect(parseIdentity(workspace)).toEqual({ avatar, avatarsDir: null });
  });
  it("allows either local field to be absent and fails for missing identity", () => {
    vi.mocked(legacyFs.readFileSync).mockReturnValue("Name: Stella\n");
    expect(parseIdentity(workspace)).toEqual({ avatar: null, avatarsDir: null });
    vi.mocked(legacyFs.existsSync).mockReturnValue(false);
    expect(() => parseIdentity(workspace)).toThrow("IDENTITY.md not found");
  });
});
