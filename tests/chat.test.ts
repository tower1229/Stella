import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fork } from "node:child_process";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareChat, releaseReferences, type ChatState } from "../scripts/chat";
import { runSkill } from "../scripts/skill";
// Mutable export facade for fault injection; ordinary operations still use the real filesystem.
vi.mock("node:fs", async importOriginal => ({ ...await importOriginal<typeof import("node:fs")>() }));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
describe("native chat preparation", () => {
  let root: string, state: ChatState;
  const request = { schemaVersion: 1 as const, agentId: "persona", prompt: 'A selfie of this person, 中文 "quoted" & text.\nLooking into the lens.' };
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "stella-chat-")); fs.mkdirSync(path.join(root, "assets"));
    fs.writeFileSync(path.join(root, "assets/main.png"), png); fs.writeFileSync(path.join(root, "IDENTITY.md"), "Avatar: assets/main.png\n");
    for (const key of ["Provider", "AvatarBlendEnabled", "AvatarMaxRefs", "AvatarAllowedRoots"]) vi.stubEnv(key, undefined);
    state = { agents: [{ id: "persona", workspace: root, agentDir: path.join(root, "auth") }], skills: {}, providers: [{ id: "google", models: ["gemini-3-pro-image"], capabilities: { edit: { enabled: true, maxInputImages: 5 }, geometry: { resolutions: ["1K", "2K", "4K"], aspectRatios: ["3:4"] } } }] };
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); fs.rmSync(root, { recursive: true, force: true }); });
  it("prepares validated reference snapshots and tool arguments, without generating or saving a result", () => {
    const result = prepareChat({ ...request, caption: "配文" }, state);
    expect(result).toMatchObject({ ok: true, agentId: "persona", caption: "配文", toolInput: { model: "google/gemini-3-pro-image", prompt: request.prompt, resolution: "2K", count: 1 } });
    expect(result.toolInput).not.toHaveProperty("aspectRatio");
    expect(result.toolInput).not.toHaveProperty("size");
    expect(result.toolInput).not.toHaveProperty("target");
    expect(fs.readFileSync(result.toolInput.images[0])).toEqual(png);
    fs.writeFileSync(path.join(root, "assets/main.png"), "changed");
    expect(fs.readFileSync(result.toolInput.images[0])).toEqual(png);
    expect(fs.existsSync(path.join(root, "stella-selfie/materials"))).toBe(false);
    expect(releaseReferences(state.agents[0], result.referenceToken).released).toBe(true);
    expect(releaseReferences(state.agents[0], result.referenceToken).released).toBe(false);
  });
  it("requires the current Agent, passes explicit hints and refuses removed save/target/batch fields", () => {
    expect(() => prepareChat({ ...request, agentId: undefined } as never, state)).toThrow("actual conversation Agent");
    for (const field of [{ saveDir: "x" }, { save: true }, { count: 2 }, { target: "x" }]) expect(() => prepareChat({ ...request, ...field }, state)).toThrow("single-image request");
    const result = prepareChat({ ...request, aspectRatio: "3:4", resolution: "4K" }, state);
    expect(result.toolInput).toMatchObject({ aspectRatio: "3:4", resolution: "4K" });
    releaseReferences(state.agents[0], result.referenceToken);
  });
  it("keeps overlapping preparations independent and only releases the matching Agent's scratch", () => {
    const a = prepareChat(request, state), b = prepareChat(request, state);
    expect(a.referenceToken).not.toBe(b.referenceToken);
    expect(() => releaseReferences({ ...state.agents[0], id: "other" }, a.referenceToken)).toThrow("does not match");
    releaseReferences(state.agents[0], a.referenceToken);
    expect(fs.existsSync(b.toolInput.images[0])).toBe(true);
    releaseReferences(state.agents[0], b.referenceToken);
  });
  it("allows two processes to prepare the same workspace on first use", async () => {
    // Build a fresh isolated runtime directly from current sources; npm test needs no existing dist.
    const runtime = path.join(root, "runtime");
    fs.mkdirSync(runtime);
    const scripts = path.resolve(__dirname, "../scripts");
    for (const name of fs.readdirSync(scripts).filter(name => name.endsWith(".ts"))) {
      const output = ts.transpileModule(fs.readFileSync(path.join(scripts, name), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      }).outputText;
      fs.writeFileSync(path.join(runtime, name.replace(/\.ts$/, ".js")), output);
    }
    const input = path.join(root, "worker-input.json");
    fs.writeFileSync(input, JSON.stringify({ request, state }));
    let ready = 0;
    type WorkerResult = { ok: boolean; referenceToken: string; images: string[]; ready?: boolean };
    const workers = [0, 1].map(() => fork(path.join(__dirname, "fixtures/chat-prepare-worker.cjs"), [path.join(runtime, "chat.js"), input], {
      execArgv: [], stdio: ["ignore", "ignore", "ignore", "ipc"],
    }));
    try {
      const results = await Promise.all(workers.map(child => new Promise<WorkerResult>((resolve, reject) => {
        let result: WorkerResult | undefined;
        const timer = setTimeout(() => { child.kill(); reject(new Error("Preparation worker timed out.")); }, 8000);
        child.on("message", value => {
          const message = value as WorkerResult;
          if (message.ready) {
            if (++ready === 2) fs.writeFileSync(path.join(root, "mkdir-start"), "go");
          } else result = message;
        });
        child.once("error", error => { clearTimeout(timer); reject(error); });
        child.once("exit", code => {
          clearTimeout(timer);
          if (code !== 0 || !result) reject(new Error("Preparation worker exited without a result."));
          else resolve(result);
        });
      })));
      expect(results.map(result => result.ok)).toEqual([true, true]);
      expect(results[0].referenceToken).not.toBe(results[1].referenceToken);
      for (const result of results) expect(fs.readFileSync(result.images[0])).toEqual(png);
      releaseReferences(state.agents[0], results[0].referenceToken);
      expect(fs.readFileSync(results[1].images[0])).toEqual(png);
      releaseReferences(state.agents[0], results[1].referenceToken);
      expect(fs.readdirSync(path.join(root, "stella-selfie/.references"))).toEqual([]);
    } finally {
      await Promise.all(workers.filter(child => child.exitCode === null && child.signalCode === null).map(child =>
        new Promise<void>(resolve => { child.once("exit", () => resolve()); child.kill(); })));
    }
  }, 15000);

  function failSnapshotWrite(name: string, failure: Error) {
    const opened = new Map<number, string>();
    const open = fs.openSync, write = fs.writeFileSync;
    vi.spyOn(fs, "openSync").mockImplementation((file, flags, mode) => {
      const fd = open(file, flags, mode);
      if (flags === "wx") opened.set(fd, path.basename(String(file)));
      return fd;
    });
    vi.spyOn(fs, "writeFileSync").mockImplementation((file, data, options) => {
      if (typeof file === "number" && opened.get(file) === name) {
        const bytes = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
        fs.writeSync(file, bytes.subarray(0, Math.max(1, bytes.length - 1)));
        throw failure;
      }
      write(file, data, options);
    });
    return opened;
  }
  it.each(["ref-0.png", "manifest.json"])("removes all owned files after a partial %s write fails", name => {
    const failure = Object.assign(new Error("Disk full after a partial write"), { code: "ENOSPC" });
    failSnapshotWrite(name, failure);
    expect(() => prepareChat(request, state)).toThrow(failure);
    expect(fs.readdirSync(path.join(root, "stella-selfie/.references"))).toEqual([]);
    expect(fs.readFileSync(path.join(root, "assets/main.png"))).toEqual(png);
  });
  it("preserves the write error and cleans other files when one cleanup fails", () => {
    fs.writeFileSync(path.join(root, "assets/extra.png"), png);
    fs.appendFileSync(path.join(root, "IDENTITY.md"), "AvatarsDir: assets\n");
    const failure = Object.assign(new Error("Original write failure"), { code: "ENOSPC" });
    failSnapshotWrite("ref-1.png", failure);
    const unlink = fs.unlinkSync;
    vi.spyOn(fs, "unlinkSync").mockImplementation(file => {
      if (path.basename(String(file)) === "ref-0.png") throw Object.assign(new Error("Cleanup denied"), { code: "EACCES" });
      unlink(file);
    });
    const warning = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => prepareChat(request, state)).toThrow(failure);
    const scratch = path.join(root, "stella-selfie/.references");
    const directory = path.join(scratch, fs.readdirSync(scratch)[0]);
    expect(fs.readdirSync(directory)).toEqual(["ref-0.png"]);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("Input scratch cleanup incomplete"));
  });
  it("preserves the write error when closing its descriptor also fails", () => {
    const failure = new Error("Original write failure");
    const opened = failSnapshotWrite("ref-0.png", failure);
    const close = fs.closeSync;
    vi.spyOn(fs, "closeSync").mockImplementation(fd => {
      close(fd);
      if (opened.has(fd)) throw new Error("Close also failed");
    });
    expect(() => prepareChat(request, state)).toThrow(failure);
    expect(fs.readdirSync(path.join(root, "stella-selfie/.references"))).toEqual([]);
  });
  it.each(["ref-0.png", "manifest.json"])("does not remove an unowned file when exclusive creation of %s fails", name => {
    const open = fs.openSync;
    let collision: string | undefined;
    vi.spyOn(fs, "openSync").mockImplementation((file, flags, mode) => {
      if (flags === "wx" && path.basename(String(file)) === name) {
        collision = String(file);
        fs.writeFileSync(file, "unrelated file", { flag: "wx" });
      }
      return open(file, flags, mode);
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => prepareChat(request, state)).toThrow();
    expect(collision).toBeDefined();
    expect(fs.readFileSync(collision!, "utf8")).toBe("unrelated file");
    expect(fs.readdirSync(path.dirname(collision!))).toEqual([name]);
  });
  it("does not swallow a shared-directory error other than EEXIST", () => {
    const mkdir = fs.mkdirSync;
    const failure = Object.assign(new Error("Cannot create scratch directory"), { code: "EACCES" });
    vi.spyOn(fs, "mkdirSync").mockImplementation((...args) => {
      if (args[0] === path.join(root, "stella-selfie")) throw failure;
      return mkdir(...args);
    });
    expect(() => prepareChat(request, state)).toThrow(failure);
    expect(fs.existsSync(path.join(root, "stella-selfie"))).toBe(false);
  });
  it("fails closed for traversal, unexpected files and a linked scratch root", () => {
    const prepared = prepareChat(request, state);
    expect(() => releaseReferences(state.agents[0], "../materials")).toThrow("Invalid reference token");
    const directory = path.dirname(prepared.toolInput.images[0]);
    fs.writeFileSync(path.join(directory, "keep.txt"), "unrelated");
    expect(() => releaseReferences(state.agents[0], prepared.referenceToken)).toThrow("unexpected");
    expect(fs.existsSync(path.join(directory, "keep.txt"))).toBe(true);
    fs.unlinkSync(path.join(directory, "keep.txt")); releaseReferences(state.agents[0], prepared.referenceToken);
    const scratch = path.join(root, "stella-selfie/.references"); fs.rmdirSync(scratch);
    const outside = path.join(root, "outside"); fs.mkdirSync(outside); fs.symlinkSync(outside, scratch, "junction");
    expect(() => prepareChat(request, state)).toThrow("real directories");
    expect(fs.readdirSync(outside)).toEqual([]);
  });
  it("rejects legacy CLI invocation before any host query", async () => {
    await expect(runSkill(["--prompt", "x", "--channel", "telegram", "--target", "x", "--save-dir", "x"])).rejects.toThrow("Legacy targets");
  });
});
