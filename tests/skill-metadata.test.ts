import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

function extractRequiredEnv(skill: string): string[] {
  const lines = skill.split("\n");
  const envIdx = lines.findIndex((line) => line.trim() === "env:");
  if (envIdx < 0) return [];

  const env: string[] = [];
  for (let i = envIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("        - ")) break;
    env.push(line.replace("        - ", "").trim());
  }
  return env;
}

function hasNodeInstallSpec(skill: string, packageName: string): boolean {
  const pattern = new RegExp(
    `-\\s+kind:\\s+node\\s*\\n\\s+package:\\s+"${packageName.replace("/", "\\/")}"`,
    "m"
  );
  return pattern.test(skill);
}

describe("SKILL metadata consistency", () => {
  it("declares all runtime env vars used by the skill", () => {
    const skillPath = path.resolve(__dirname, "..", "SKILL.md");
    const skill = fs.readFileSync(skillPath, "utf-8");
    const requiredEnv = extractRequiredEnv(skill);

    expect(requiredEnv).toEqual(
      expect.arrayContaining([
        "GEMINI_API_KEY",
        "FAL_KEY",
        "OPENCLAW_GATEWAY_TOKEN",
        "OPENCLAW_GATEWAY_URL",
        "Provider",
        "AvatarBlendEnabled",
        "AvatarMaxRefs",
      ])
    );
  });

  it("declares node install specs for runtime SDKs", () => {
    const skillPath = path.resolve(__dirname, "..", "SKILL.md");
    const skill = fs.readFileSync(skillPath, "utf-8");

    expect(hasNodeInstallSpec(skill, "@google/genai")).toBe(true);
    expect(hasNodeInstallSpec(skill, "@fal-ai/client")).toBe(true);
  });
});
