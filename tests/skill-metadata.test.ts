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

function extractRequiredBins(skill: string): string[] {
  const lines = skill.split("\n");
  const binsIdx = lines.findIndex((line) => line.trim() === "bins:");
  if (binsIdx < 0) return [];

  const bins: string[] = [];
  for (let i = binsIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("        - ")) break;
    bins.push(line.replace("        - ", "").trim());
  }
  return bins;
}

function hasNodeInstallSpec(skill: string, packageName: string): boolean {
  const pattern = new RegExp(
    `-\\s+kind:\\s+node\\s*\\n\\s+package:\\s+"${packageName.replace("/", "\\/")}"`,
    "m"
  );
  return pattern.test(skill);
}

describe("SKILL metadata consistency", () => {
  it("declares provider secrets for OpenClaw env injection and keeps node runtime documented", () => {
    const skillPath = path.resolve(__dirname, "..", "SKILL.md");
    const skill = fs.readFileSync(skillPath, "utf-8");
    const requiredEnv = extractRequiredEnv(skill);
    const requiredBins = extractRequiredBins(skill);

    expect(skill).toContain("always: true");
    expect(requiredEnv).toEqual(["GEMINI_API_KEY", "FAL_KEY", "LAOZHANG_API_KEY"]);
    expect(requiredBins).toEqual(["node"]);

    expect(skill).toContain("GEMINI_API_KEY");
    expect(skill).toContain("FAL_KEY");
    expect(skill).toContain("LAOZHANG_API_KEY");
    expect(skill).toContain("Provider");
    expect(skill).toContain("AvatarBlendEnabled");
    expect(skill).toContain("AvatarMaxRefs");
    expect(skill).not.toContain("OPENCLAW_GATEWAY_TOKEN");
    expect(skill).not.toContain("OPENCLAW_GATEWAY_URL");
  });

  it("declares node install specs for runtime SDKs", () => {
    const skillPath = path.resolve(__dirname, "..", "SKILL.md");
    const skill = fs.readFileSync(skillPath, "utf-8");

    expect(hasNodeInstallSpec(skill, "@google/genai")).toBe(true);
    expect(hasNodeInstallSpec(skill, "@fal-ai/client")).toBe(true);
  });
});
