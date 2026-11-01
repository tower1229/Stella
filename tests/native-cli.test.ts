import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findOpenClawCli, MissingConfigPathError, parseCliJson, runOpenClawJson } from "../scripts/native-cli";
let root: string | undefined;
afterEach(() => { vi.unstubAllEnvs(); if (root) fs.rmSync(root, { recursive: true, force: true }); root = undefined; });
describe("native CLI transport", () => {
  it("accepts CLI notices followed by a complete JSON object and rejects trailing junk", () => {
    expect(parseCliJson('notice\n{"ok":true}')).toEqual({ ok: true });
    expect(() => parseCliJson('{"ok":true}\nnot-json')).toThrow("valid JSON");
  });
  it("preserves literal Unicode, spaces, quotes, ampersands and newlines without a shell", async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "stella cli "));
    const entry = path.join(root, "fake-host.cjs");
    fs.writeFileSync(entry, "process.stdout.write(JSON.stringify(process.argv.slice(2)))");
    vi.stubEnv("OPENCLAW_CLI_PATH", entry);
    const args = ['中文 "quoted" & literal', 'line1\nline2', 'path with spaces'];
    expect(await runOpenClawJson(args)).toEqual(args);
  });
  it("does not expose raw failed CLI diagnostics", async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "stella-cli-fail-"));
    const entry = path.join(root, "fake-host.cjs"); fs.writeFileSync(entry, 'process.stderr.write("api-key=private-value");process.exit(1)');
    vi.stubEnv("OPENCLAW_CLI_PATH", entry);
    await expect(runOpenClawJson([])).rejects.toThrow("metadata query failed");
  });
  it("recognizes only the missing optional skills path, without swallowing other query failures", async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "stella-cli-missing-"));
    const entry = path.join(root, "fake-host.cjs");
    fs.writeFileSync(entry, 'process.stderr.write("Config path not found: skills\\n");process.exit(1)');
    vi.stubEnv("OPENCLAW_CLI_PATH", entry);
    await expect(runOpenClawJson(["config", "get", "skills", "--json"])).rejects.toBeInstanceOf(MissingConfigPathError);
    await expect(runOpenClawJson(["agents", "list", "--json"])).rejects.not.toBeInstanceOf(MissingConfigPathError);
  });
  it("does not execute a shell forwarding wrapper as JavaScript", () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "stella-cli-wrapper-"));
    fs.writeFileSync(path.join(root, "openclaw"), '#!/bin/sh\nexec node "elsewhere" "$@"\n');
    // This runner may itself live next to a valid install; that entry is also acceptable.
    try { expect(findOpenClawCli({ PATH: root })).not.toBe(path.join(root, "openclaw")); }
    catch (error) { expect(String(error)).toContain("CLI entry was not found"); }
  });
});
