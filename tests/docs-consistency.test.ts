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
      "This skill does not enable search grounding or add a weather lookup."
    );
    expect(timelineDoc).not.toContain("must display the real-time weather conditions");
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
  it("documents native chat reference optimization separately from direct plugin buffers", () => {
    const skill = readRepoFile("SKILL.md");
    const readme = readRepoFile("README.md");
    const readmeCn = readRepoFile("README_CN.md");
    const plugin = readRepoFile("references", "plugin-integration.md");
    for (const doc of [skill, readme, plugin]) expect(doc).toContain("native image tool may resize or re-encode");
    expect(skill).not.toContain("File checks and uploads use the same validated bytes.");
    expect(skill).toContain("Original-byte upload is not guaranteed.");
    expect(readme).toContain("Original-byte upload is not guaranteed.");
    expect(readmeCn).toContain("不保证原始字节上传");
    expect(plugin).toContain("does not invoke that chat-tool optimization");
  });

  it("keeps the public runtime entry generic", () => {
    const skill = readRepoFile("SKILL.md");
    const plugin = readRepoFile("references", "plugin-integration.md");
    const ignore = readRepoFile(".clawhubignore");
    const readme = readRepoFile("README.md");
    const readmeCn = readRepoFile("README_CN.md");
    for (const doc of [skill, plugin, ignore, readme, readmeCn]) {
      expect(doc).not.toContain("bili.js");
      expect(doc).not.toContain("generateForBili");
    }
    expect(plugin).not.toContain("stellaAgentId");
    expect(skill).toContain("dist/scripts/plugin.js");
    expect(plugin).toContain("generateForPlugin");
    expect(plugin).toContain("callerConfig.agentId");
    expect(readme).toContain("generateForPlugin");
    expect(readmeCn).toContain("generateForPlugin");
    expect(ignore).toContain("!references/plugin-integration.md");
    expect(ignore).toContain("!dist/scripts/plugin.js");
  });

  it("keeps README chat Agent, failed cleanup, plugin adapter and SOUL fragment aligned", () => {
    const readme = readRepoFile("README.md");
    const readmeCn = readRepoFile("README_CN.md");
    const skill = readRepoFile("SKILL.md");
    const soul = readRepoFile("templates", "SOUL.fragment.md");
    const soulClose = "is incomplete, explain what is missing before generating or sending an image.";

    expect(skill).toContain("chat has no main fallback");
    expect(readme).toContain("chat has no main fallback");
    expect(readme).toContain("exact `main` when omitted");
    expect(readme).toContain("This plugin default does not apply to chat.");
    expect(readmeCn).toContain("不会回退到 `main`");
    expect(readmeCn).toContain("未传 `agentId` 时使用 `main`");
    expect(readmeCn).toContain("这条 plugin 默认不适用于聊天");

    expect(skill).toContain("Failed preparation attempts to remove every file it created");
    expect(readme).toContain("Failed preparation cleans up files it created, including partial writes");
    expect(readme).toContain("incomplete cleanup reports the directory for explicit cleanup");
    expect(readmeCn).toContain("准备失败会清理本次创建的文件，包括部分写入的文件");
    expect(readmeCn).toContain("无法清理时报告目录供明确清理");

    expect(readme).toContain("Call `generateForPlugin`");
    expect(readme).toContain("The adapter resolves the actual Agent identity, workspace and auth directory, calls `api.runtime.imageGeneration.generate` once");
    expect(readmeCn).toContain("调用 `generateForPlugin`");
    expect(readmeCn).toContain("适配器解析实际 Agent 身份、工作区和认证目录，单次调用 `api.runtime.imageGeneration.generate`");

    expect(soul).toContain(soulClose);
    expect(readme).toContain(soulClose);
    expect(readmeCn).toContain(soulClose);
  });
});
