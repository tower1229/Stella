import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { prepareSkillBundle } from "./skill-bundle.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const fail = message => { throw new Error(message); };
if (args.length !== 2 || !["--agent", "--skills-dir"].includes(args[0])) {
  fail("Usage: npm run sync:local -- --agent <id> | --skills-dir <absolute skills directory>");
}
const build = spawnSync(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", path.join(repo, "tsconfig.json")], {
  cwd: repo, stdio: "inherit", shell: false, windowsHide: true,
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
let skillsDirectory;
if (args[0] === "--agent") {
  const { readAgentLocations } = await import("../dist/scripts/native-cli.js");
  const agent = (await readAgentLocations()).find(agent => agent.id === args[1]);
  if (!agent) fail("The selected Agent does not exist.");
  skillsDirectory = path.join(fs.realpathSync(agent.workspace), "skills");
} else {
  if (!path.isAbsolute(args[1])) fail("--skills-dir must be absolute.");
  skillsDirectory = path.resolve(args[1]);
}
const target = path.join(skillsDirectory, "stella-selfie");
if (target === repo || repo.startsWith(target + path.sep) || target.startsWith(repo + path.sep)) {
  fail("Choose an installed skills directory outside this checkout.");
}
function ensureDirectory(directory) {
  if (fs.existsSync(directory)) {
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail("Sync destination contains a link or non-directory.");
  } else {
    const parent = path.dirname(directory);
    if (parent === directory) fail("Cannot create destination root.");
    ensureDirectory(parent);
    fs.mkdirSync(directory);
  }
}
let ancestor = target;
while (true) {
  if (fs.existsSync(ancestor) && fs.lstatSync(ancestor).isSymbolicLink()) fail("Sync destination contains a link.");
  const parent = path.dirname(ancestor);
  if (parent === ancestor) break;
  ancestor = parent;
}
const staging = fs.mkdtempSync(path.join(os.tmpdir(), "stella-local-sync-"));
try {
  const bundle = prepareSkillBundle(repo, staging);
  ensureDirectory(target);
  for (const file of bundle.files) {
    const destination = path.join(target, file.path);
    ensureDirectory(path.dirname(destination));
    if (fs.existsSync(destination) && (!fs.lstatSync(destination).isFile() || fs.lstatSync(destination).isSymbolicLink())) {
      fail("A destination runtime file is not a regular file.");
    }
  }
  for (const file of bundle.files) fs.copyFileSync(path.join(bundle.bundlePath, file.path), path.join(target, file.path));
  console.log(JSON.stringify({ ok: true, target, files: bundle.files.length, fingerprint: bundle.fingerprint }));
  console.log("Runtime files copied; existing user files retained. Refresh the host skill snapshot as appropriate.");
} finally {
  const actual = fs.realpathSync(staging);
  if (path.dirname(actual) !== fs.realpathSync(os.tmpdir()) || !path.basename(actual).startsWith("stella-local-sync-")) fail("Unexpected staging path.");
  fs.rmSync(actual, { recursive: true, force: true });
}
