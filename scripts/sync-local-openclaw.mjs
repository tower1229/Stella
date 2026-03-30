import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET_DIR = '~/.openclaw/workspace/skills/stella-selfie';

function ensureBuilt() {
  const distDir = path.join(ROOT_DIR, "dist");
  fs.rmSync(distDir, { recursive: true, force: true });

  console.log("🛠️ Building local dist artifacts...");
  const isWindows = os.platform() === 'win32';
  
  const result = spawnSync(isWindows ? "npm.cmd" : "npm", ["run", "build"], {
    cwd: ROOT_DIR,
    stdio: "inherit",
    shell: isWindows,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);

  const distEntrypoint = path.join(ROOT_DIR, "dist", "scripts", "skill.js");
  if (!fs.existsSync(distEntrypoint)) {
    console.error(`❌ Missing build output: ${distEntrypoint}`);
    process.exit(1);
  }
}

function syncRepo() {
  const isWSL = os.release().toLowerCase().includes('microsoft');
  const isWindows = os.platform() === 'win32';
  
  const excludes = [
    ".git",
    "node_modules",
    "coverage",
    "out",
    "sandbox",
    ".env",
    ".env.*",
    ".clawhub",
    "_meta.json"
  ];
  const excludeStr = excludes.map(e => `--exclude '${e}'`).join(" ");

  let cmd = '';
  
  if (isWSL || !isWindows) {
      console.log(`📡 Detected Native/WSL environment. Syncing to ${TARGET_DIR}...`);
      cmd = `mkdir -p ${TARGET_DIR} && rsync -av ${excludeStr} ./ ${TARGET_DIR}/ && cd ${TARGET_DIR} && npm install`;
  } else if (isWindows) {
      console.log(`📡 Detected Windows environment. Calling WSL rsync to sync to ${TARGET_DIR}...`);
      try {
          const cwd = ROOT_DIR.replace(/\\/g, '/');
          const wslPathStr = execSync(`wsl wslpath -u "${cwd}"`).toString().trim();
          cmd = `wsl bash -c "mkdir -p ${TARGET_DIR} && rsync -av ${excludeStr} ${wslPathStr}/ ${TARGET_DIR}/ && cd ${TARGET_DIR} && npm install"`;
      } catch (e) {
          console.error('❌ Failed to construct WSL command. Are you sure WSL is installed and running?');
          process.exit(1);
      }
  }

  try {
      execSync(cmd, { stdio: 'inherit', cwd: ROOT_DIR });
      console.log('✅ Successfully synced stella-selfie files to your local OpenClaw workspace!');
  } catch (e) {
      console.error('❌ Sync failed:', e.message);
      process.exit(1);
  }
}

function main() {
  ensureBuilt();
  syncRepo();
}

main();
