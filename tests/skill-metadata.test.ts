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

describe("SKILL metadata consistency", () => {
  it("declares all runtime credential env vars", () => {
    const skillPath = path.resolve(__dirname, "..", "SKILL.md");
    const skill = fs.readFileSync(skillPath, "utf-8");
    const env = extractRequiredEnv(skill);

    expect(env).toContain("GEMINI_API_KEY");
    expect(env).toContain("FAL_KEY");
    expect(env).toContain("OPENCLAW_GATEWAY_TOKEN");
  });
});
