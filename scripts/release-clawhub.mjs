import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage(exitCode = 0) {
  const msg = `
Usage:
  node ./scripts/release-clawhub.mjs [--changelog "..."] [--tag latest] [--skip-test]

Behavior:
  - Reads version from package.json
  - Runs unit tests (npm test) unless --skip-test
  - If --changelog is not provided, generates one from git history
  - Publishes this repo as a ClawHub skill using:
      slug: stella-selfie
      name: "Stella Selfie"

Requirements:
  - clawhub CLI installed and logged in (or available via npx)
`.trim();
  // eslint-disable-next-line no-console
  console.log(msg);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = { changelog: "", tag: "latest", skipTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--changelog") {
      out.changelog = argv[++i] ?? "";
    } else if (a === "--tag") {
      out.tag = argv[++i] ?? "latest";
    } else if (a === "--skip-test") {
      out.skipTest = true;
    } else if (a === "-h" || a === "--help") {
      usage(0);
    } else {
      // eslint-disable-next-line no-console
      console.error(`Unknown argument: ${a}`);
      usage(2);
    }
  }
  return out;
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: ROOT_DIR,
    shell: process.platform === "win32",
    ...opts,
  });
  if (r.error) throw r.error;
  if (typeof r.status === "number" && r.status !== 0) process.exit(r.status);
}

function canRun(cmd) {
  const r = spawnSync(cmd, ["--help"], {
    stdio: "ignore",
    cwd: ROOT_DIR,
    shell: process.platform === "win32",
  });
  return !r.error && r.status === 0;
}

function runCapture(cmd, args) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    cwd: ROOT_DIR,
    shell: process.platform === "win32",
  });
  if (r.error) return { ok: false, stdout: "", stderr: String(r.error) };
  if (r.status !== 0) return { ok: false, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  return { ok: true, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function generateChangelog(version) {
  // Prefer commits since last tag; fallback to recent commit subjects; final fallback to a simple release line.
  if (!canRun("git")) return `Release v${version}`;

  const lastTag = runCapture("git", ["describe", "--tags", "--abbrev=0"]);
  if (lastTag.ok) {
    const tag = lastTag.stdout.trim();
    const commits = runCapture("git", ["log", `${tag}..HEAD`, "--pretty=format:%s"]);
    const lines = commits.ok
      ? commits.stdout
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    if (lines.length > 0) return `v${version}\n\n- ${lines.join("\n- ")}`;
  }

  const recent = runCapture("git", ["log", "-n", "20", "--pretty=format:%s"]);
  const lines = recent.ok
    ? recent.stdout
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  if (lines.length > 0) return `v${version}\n\n- ${lines.join("\n- ")}`;
  return `Release v${version}`;
}

const { changelog: changelogArg, tag, skipTest } = parseArgs(process.argv.slice(2));

const pkgPath = path.join(ROOT_DIR, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const version = pkg?.version;
if (!version) {
  // eslint-disable-next-line no-console
  console.error("Failed to read version from package.json");
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log(`[release] Version: ${version}`);

const changelog = changelogArg || generateChangelog(version);
// eslint-disable-next-line no-console
console.log(`[release] Changelog:\n${changelog}\n`);

if (!skipTest) {
  // eslint-disable-next-line no-console
  console.log("[release] Running unit tests...");
  run("npm", ["test"]);
}

// eslint-disable-next-line no-console
console.log("[release] Publishing to ClawHub...");

const publishArgs = [
  "publish",
  ".",
  "--slug",
  "stella-selfie",
  "--name",
  "Stella Selfie",
  "--version",
  String(version),
  "--tags",
  String(tag),
  "--changelog",
  String(changelog),
];

if (canRun("clawhub")) {
  run("clawhub", publishArgs);
} else {
  const major = Number(String(process.versions.node).split(".")[0] || "0");
  if (major < 20) {
    // eslint-disable-next-line no-console
    console.error(
      "[release] clawhub CLI not found on PATH.\n" +
        "[release] Automatic fallback via npx requires Node.js >= 20 (your Node is " +
        process.versions.node +
        ").\n" +
        "[release] Please either:\n" +
        "  - install Node.js >= 20 and rerun, or\n" +
        "  - install clawhub globally in an environment where it works and ensure `clawhub` is on PATH."
    );
    process.exit(1);
  }

  // Fallback: use npx so users don't need global install
  run("npx", ["-y", "clawhub", ...publishArgs]);
}

// eslint-disable-next-line no-console
console.log("[release] Done.");

