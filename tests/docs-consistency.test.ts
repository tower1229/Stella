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

  it("documents mirror as the default outfit/full-body mode and timeline recall paths", () => {
    const skill = readRepoFile("SKILL.md");

    expect(skill).toContain(
      "Use `mirror` by default for outfit / full-body / self-presentation requests"
    );
    expect(skill).toContain("### Step 2: Enrich with Timeline Context Or Recent Scene Recall");
    expect(skill).toContain('If the request is a current-state `Sparse` prompt');
    expect(skill).toContain("If the current request clearly refers back to a single recently resolved timeline scene");
    expect(skill).toContain(
      "If the user already provided a clear standalone scene, outfit, location, activity, or camera requirement and it is not a callback to a recently resolved timeline scene, do not use timeline enhancement."
    );
    expect(skill).not.toContain("when the user provided only partial scene details");
  });

  it("defines timeline query rules and recent-scene reuse", () => {
    const timelineDoc = readRepoFile("references", "timeline-integration.md");

    expect(timelineDoc).toContain("## Eligibility");
    expect(timelineDoc).toContain("Typical recent-scene callbacks");
    expect(timelineDoc).toContain("## Recent Scene Reuse");
    expect(timelineDoc).toContain("## Timeline Query Strategy");
    expect(timelineDoc).toContain("Use the fixed query `现在`.");
    expect(timelineDoc).toContain("do not introduce names such as `小刘`, `Leon`, or other third-person substitutions");
    expect(timelineDoc).not.toContain("prefer `third_person` when the recovered scene does not plausibly read as a selfie");
    expect(timelineDoc).toContain(
      "The outdoor environment must display the real-time weather conditions and natural lighting and shadow effects"
    );
    expect(timelineDoc).not.toContain("Make it feel like this was just captured");
    expect(timelineDoc).not.toContain("partial scene details");
    expect(timelineDoc).not.toContain("fresh_moment");
    expect(timelineDoc).not.toContain("prefer `tourist`");
  });

  it("keeps README and README_CN aligned with third-person wording and timeline usage", () => {
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
