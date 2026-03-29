import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_TARGET = path.join(
  os.homedir(),
  ".openclaw",
  "workspace",
  "skills",
  "stella-selfie"
);

function usage(exitCode = 0) {
  console.log(`
Usage:
  node ./scripts/sync-local-openclaw.mjs [--target <dir>] [--skip-build] [--skip-install]

Behavior:
  1. Builds this repo unless --skip-build is set
  2. Rsyncs the latest repo files into the local WSL OpenClaw skill directory
  3. Runs npm install in the target unless --skip-install is set

Defaults:
  target: ${DEFAULT_TARGET}
`.trim());
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = {
    target: DEFAULT_TARGET,
    skipBuild: false,
    skipInstall: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--target") {
      out.target = argv[++i] || "";
      if (!out.target) {
        console.error("[sync] Missing value for --target");
        usage(2);
      }
    } else if (arg === "--skip-build") {
      out.skipBuild = true;
    } else if (arg === "--skip-install") {
      out.skipInstall = true;
    } else if (arg === "-h" || arg === "--help") {
      usage(0);
    } else {
      console.error(`[sync] Unknown argument: ${arg}`);
      usage(2);
    }
  }

  return out;
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: ROOT_DIR,
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.error) throw result.error;
  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

function ensureBuilt() {
  const distDir = path.join(ROOT_DIR, "dist");
  fs.rmSync(distDir, { recursive: true, force: true });

  console.log("[sync] Building local dist artifacts...");
  run("npm", ["run", "build"]);

  const distEntrypoint = path.join(ROOT_DIR, "dist", "scripts", "skill.js");
  if (!fs.existsSync(distEntrypoint)) {
    console.error(`[sync] Missing build output: ${distEntrypoint}`);
    process.exit(1);
  }
}

function syncRepo(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  const sourceDir = `${ROOT_DIR}/`;
  const targetWithSlash = `${targetDir}/`;
  const excludes = [
    ".git/",
    "node_modules/",
    "coverage/",
    "out/",
    "sandbox/",
    ".env",
    ".env.*",
    ".clawhub/",
    "_meta.json",
  ];

  const rsyncArgs = ["-a", "--delete"];
  for (const pattern of excludes) {
    rsyncArgs.push("--exclude", pattern);
  }
  rsyncArgs.push(sourceDir, targetWithSlash);

  console.log(`[sync] Syncing repo to ${targetDir} ...`);
  run("rsync", rsyncArgs);
}

function installDeps(targetDir) {
  console.log(`[sync] Installing target dependencies in ${targetDir} ...`);
  run("npm", ["install"], { cwd: targetDir });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetDir = path.resolve(args.target);

  console.log(`[sync] Source: ${ROOT_DIR}`);
  console.log(`[sync] Target: ${targetDir}`);

  if (!args.skipBuild) {
    ensureBuilt();
  } else {
    console.log("[sync] Skipping build.");
  }

  syncRepo(targetDir);

  if (!args.skipInstall) {
    installDeps(targetDir);
  } else {
    console.log("[sync] Skipping npm install in target.");
  }

  console.log("[sync] Done.");
}

main();
