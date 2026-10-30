import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createHash } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Release tooling is a maintainer-only ESM module, outside the skill runtime.
const modulePath = "../scripts/skill-bundle.mjs";
const repo = path.resolve(__dirname, "..");

describe("standalone ClawHub bundle", () => {
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "stella-bundle-test-")); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });
  it("ships only declared runtime files, with every installed instruction available", async () => {
    const { prepareSkillBundle, RUNTIME_FILES } = await import(modulePath);
    const fixture = path.join(root, "source");
    fs.mkdirSync(fixture);
    fs.copyFileSync(path.join(repo, "package.json"), path.join(fixture, "package.json"));
    for (const file of RUNTIME_FILES) {
      if (file === "package.json") continue;
      const destination = path.join(fixture, file);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, file.endsWith(".js") ? "module.exports = {};\n" : fs.readFileSync(path.join(repo, file)));
    }
    fs.writeFileSync(path.join(fixture, ".env"), "SECRET=do-not-ship");
    fs.writeFileSync(path.join(fixture, "private.png"), "do-not-ship");
    fs.writeFileSync(path.join(fixture, "unrelated.ts"), "do-not-ship");
    const result = prepareSkillBundle(fixture, root);
    expect(result.files.map((file: { path: string }) => file.path).sort()).toEqual([...RUNTIME_FILES].sort());
    for (const file of result.files) {
      const data = fs.readFileSync(path.join(result.bundlePath, file.path));
      expect(createHash("sha256").update(data).digest("hex")).toBe(file.sha256);
      expect(data.length).toBe(file.size);
    }
    const skill = fs.readFileSync(path.join(result.bundlePath, "SKILL.md"), "utf8");
    expect(skill).not.toContain('See README.md');
    expect(fs.existsSync(path.join(result.bundlePath, "templates/SOUL.fragment.md"))).toBe(true);
    const metadata = JSON.parse(fs.readFileSync(path.join(result.bundlePath, "package.json"), "utf8"));
    expect(metadata.scripts).toBeUndefined();
    expect(metadata.devDependencies).toBeUndefined();
    expect(metadata.dependencies).toEqual(JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8")).dependencies);
    expect(fs.existsSync(path.join(result.bundlePath, ".env"))).toBe(false);
    expect(fs.existsSync(path.join(result.bundlePath, "unrelated.ts"))).toBe(false);
    expect(JSON.parse(fs.readFileSync(result.manifestPath, "utf8")).files).toEqual(result.files);
  });
  it("fails when required runtime files are missing", async () => {
    const { prepareSkillBundle } = await import(modulePath);
    fs.copyFileSync(path.join(repo, "package.json"), path.join(root, "package.json"));
    expect(() => prepareSkillBundle(root, root)).toThrow();
  });
});
