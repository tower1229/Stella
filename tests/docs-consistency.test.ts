import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

function readRepoFile(...parts: string[]): string {
  return fs.readFileSync(path.resolve(__dirname, "..", ...parts), "utf-8");
}

describe("selfie/timeline documentation contract", () => {
  it("keeps third_person as the canonical third mode in SKILL.md", () => {
    const skill = readRepoFile("SKILL.md");

    expect(skill).toContain("Mode 3: Third-Person Photo");
    expect(skill).toContain("`mirror`, `direct`, or `third_person`");
    expect(skill).toContain("[third_person] A natural third-person photo");
    expect(skill).not.toContain("Mode 3: Tourist Photo");
    expect(skill).not.toContain("[tourist]");
    expect(skill).toContain("Legacy keywords: travel photo, tourist photo, 旅拍, 打卡照, 风景合影 | `third_person`");
  });

  it("documents mirror as the default outfit/full-body mode and timeline as Sparse-only", () => {
    const skill = readRepoFile("SKILL.md");

    expect(skill).toContain(
      "Use `mirror` by default for outfit / full-body / self-presentation requests"
    );
    expect(skill).toContain("### Step 2: Enrich with Timeline Context (Sparse Requests Only)");
    expect(skill).toContain('If the request is `Sparse`');
    expect(skill).toContain(
      "If the user already provided a clear scene, outfit, location, activity, or camera requirement, do not use timeline enhancement."
    );
    expect(skill).not.toContain("when the user provided only partial scene details");
  });

  it("defines timeline enhancement as Sparse-only and removes brittle mode mappings", () => {
    const timelineDoc = readRepoFile("references", "timeline-integration.md");

    expect(timelineDoc).toContain("## Sparse Eligibility");
    expect(timelineDoc).toContain("Use this document only for `Sparse` requests");
    expect(timelineDoc).toContain("Non-Sparse requests do **not** use timeline enhancement");
    expect(timelineDoc).toContain("prefer `third_person`");
    expect(timelineDoc).not.toContain("partial scene details");
    expect(timelineDoc).not.toContain("fresh_moment");
    expect(timelineDoc).not.toContain("prefer `tourist`");
  });

  it("keeps README and README_CN aligned with third-person wording and Sparse-only timeline usage", () => {
    const readme = readRepoFile("README.md");
    const readmeCn = readRepoFile("README_CN.md");

    expect(readme).toContain("third-person photo");
    expect(readme).toContain("Sparse");
    expect(readme).not.toContain("tourist photo");
    expect(readmeCn).toContain("第三人称照片");
    expect(readmeCn).toContain("Sparse");
    expect(readmeCn).not.toContain("旅拍照");
  });

  it("uses third-person smoke prompts instead of generic travel-photo prompts", () => {
    const smoke = readRepoFile("scripts", "smoke.ts");

    expect(smoke).toContain("A natural third-person photo of this person");
    expect(smoke).not.toContain("A travel photo of this person");
  });
});
