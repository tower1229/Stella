import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawnSync } from "child_process";
import { afterEach, describe, expect, it } from "vitest";

const bundleModule = "../scripts/skill-bundle.mjs";
const repo = path.resolve(__dirname, "..");
let fixture: string;
afterEach(() => { if (fixture) fs.rmSync(fixture, { recursive: true, force: true }); });

describe("release command transport", () => {
  it.skipIf(process.platform === "win32")("publishes only the staged bundle and preserves changelog newlines", async () => {
    fixture = fs.mkdtempSync(path.join(os.tmpdir(), "stella-release-command-"));
    const { RUNTIME_FILES } = await import(bundleModule);
    for (const file of [...RUNTIME_FILES, "scripts/release-clawhub.mjs", "scripts/skill-bundle.mjs"]) {
      const target = path.join(fixture, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.endsWith(".js") ? "module.exports = {};" : fs.readFileSync(path.join(repo, file)));
    }
    const bin = path.join(fixture, "bin");
    fs.mkdirSync(bin);
    const receipt = path.join(fixture, "args.json");
    fs.writeFileSync(path.join(bin, "npm"), `#!${process.execPath}\nprocess.exit(0);\n`, { mode: 0o755 });
    fs.writeFileSync(path.join(bin, "clawhub"), `#!${process.execPath}\nif (!process.argv.includes('--help')) require('fs').writeFileSync(${JSON.stringify(receipt)}, JSON.stringify(process.argv.slice(2)));\n`, { mode: 0o755 });
    const changelog = "line one\nline two";
    const result = spawnSync(process.execPath, [path.join(fixture, "scripts/release-clawhub.mjs"), "--skip-test", "--changelog", changelog], {
      encoding: "utf8", env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
    });
    expect(result.status, result.stderr).toBe(0);
    const args = JSON.parse(fs.readFileSync(receipt, "utf8"));
    expect(args.slice(0, 4)).toEqual(["--workdir", fs.realpathSync(fixture), "skill", "publish"]);
    expect(args[4]).toMatch(/clawhub-candidates.*bundle$/);
    expect(fs.existsSync(path.join(args[4], "SKILL.md"))).toBe(true);
    expect(args[args.indexOf("--changelog") + 1]).toBe(changelog);
    expect(result.stdout).toContain("Verify normal checks");
  });
});
