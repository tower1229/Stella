import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";

export class HostQueryError extends Error { readonly code = "HOST_QUERY_FAILED"; }
export class MissingConfigPathError extends HostQueryError {}

/** Locate a trusted installed Node CLI entry; never execute a shell wrapper with user text. */
export function findOpenClawCli(env: NodeJS.ProcessEnv = process.env): string {
  if (env.OPENCLAW_CLI_PATH) {
    const entry = path.resolve(env.OPENCLAW_CLI_PATH);
    try { if (!fs.statSync(entry).isFile()) throw new Error(); }
    catch { throw new HostQueryError("OPENCLAW_CLI_PATH must identify the installed Node CLI entry."); }
    return entry;
  }
  const dirs = [path.dirname(process.execPath), ...(env.PATH ?? env.Path ?? "").split(path.delimiter)];
  for (const dir of dirs.filter(Boolean)) {
    for (const candidate of [path.join(dir, "node_modules/openclaw/openclaw.mjs"), path.join(dir, "openclaw.mjs"), path.join(dir, "openclaw")]) {
      try {
        if (!fs.statSync(candidate).isFile()) continue;
        const real = fs.realpathSync(candidate);
        // PATH can contain a shell forwarding wrapper, especially with nvm.
        if (/\.[cm]?js$/.test(real)) return real;
        const fd = fs.openSync(real, "r");
        try {
          const header = Buffer.alloc(128);
          const length = fs.readSync(fd, header, 0, header.length, 0);
          if (/^#![^\r\n]*\bnode\b/.test(header.toString("utf8", 0, length))) return real;
        } finally { fs.closeSync(fd); }
      } catch { /* Try next installed bin. */ }
    }
  }
  throw new HostQueryError("OpenClaw CLI entry was not found; install it on PATH or set OPENCLAW_CLI_PATH to openclaw.mjs.");
}

export function parseCliJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch {
    // A CLI startup notice may precede JSON. Do not accept arbitrary trailing output.
    for (const match of raw.matchAll(/^[\[{]/gm)) {
      try { return JSON.parse(raw.slice(match.index)); } catch { /* Keep looking for the result boundary. */ }
    }
    throw new HostQueryError("OpenClaw did not return valid JSON.");
  }
}

export async function runOpenClawJson(args: string[]): Promise<unknown> {
  const entry = findOpenClawCli();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "", diagnostics = "", bytes = 0, settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) reject(error);
      else { try { resolve(parseCliJson(output)); } catch (e) { reject(e); } }
    };
    const timer = setTimeout(() => { child.kill(); finish(new HostQueryError("OpenClaw metadata query timed out.")); }, 120000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (data: string) => {
      bytes += Buffer.byteLength(data);
      if (bytes > 32 * 1024 * 1024) { child.kill(); finish(new HostQueryError("OpenClaw metadata result is too large.")); }
      else output += data;
    });
    // Inspect only a bounded diagnostic; never expose raw config/provider output.
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (data: string) => { if (diagnostics.length < 8192) diagnostics += data.slice(0, 8192 - diagnostics.length); });
    child.once("error", () => finish(new HostQueryError("OpenClaw CLI could not be started.")));
    child.once("close", code => {
      const missingSkills = args.length === 4 && args.join(" ") === "config get skills --json" &&
        /^Config path not found: skills\s*$/m.test(diagnostics);
      finish(code === 0 ? undefined : missingSkills ? new MissingConfigPathError("Optional skills configuration is absent.")
        : new HostQueryError("OpenClaw metadata query failed; check host configuration and access."));
    });
  });
}

export interface AgentLocation { id: string; workspace: string; agentDir: string }
export async function readAgentLocations(): Promise<AgentLocation[]> {
  const value = await runOpenClawJson(["agents", "list", "--json"]);
  if (!Array.isArray(value) || !value.every(a => a && typeof a.id === "string" &&
      typeof a.workspace === "string" && path.isAbsolute(a.workspace) && typeof a.agentDir === "string" && path.isAbsolute(a.agentDir))) {
    throw new HostQueryError("Unsupported OpenClaw agents list result.");
  }
  return value.map(a => ({ id: a.id, workspace: a.workspace, agentDir: a.agentDir }));
}
