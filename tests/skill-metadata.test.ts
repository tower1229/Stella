import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
describe("native-only skill packaging contract", () => {
  it("requires host tools rather than provider keys or SDK installs", () => {
    const skill = fs.readFileSync(path.resolve(__dirname, "../SKILL.md"), "utf8");
    const metadata = skill.split("---")[1];
    expect(metadata).toContain("- node"); expect(metadata).toContain("- openclaw");
    expect(metadata).not.toContain("requires:\n      env:");
    expect(metadata).not.toContain("primaryEnv"); expect(metadata).not.toContain("kind: node");
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8"));
    expect(pkg.dependencies).toEqual({});
    expect(skill).toContain("image_generate");
    expect(skill).toContain("release");
  });
});
