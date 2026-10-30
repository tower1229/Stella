import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

// Single allowlist: source, tests, local configuration and images never enter staging.
export const RUNTIME_FILES = [
  "SKILL.md",
  "package.json",
  "references/timeline-integration.md",
  "templates/SOUL.fragment.md",
  ...[
    "avatars", "errors", "identity", "images", "media-download", "sender", "skill",
    "providers/fal", "providers/gemini", "providers/laozhang",
  ].map((name) => `dist/scripts/${name}.js`),
];

export function prepareSkillBundle(root, outputDirectory) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  for (const file of RUNTIME_FILES) {
    if (!fs.lstatSync(path.join(root, file)).isFile()) {
      throw new Error(`Required bundle file is not a regular file: ${file}`);
    }
  }
  fs.mkdirSync(outputDirectory, { recursive: true });
  const directory = fs.mkdtempSync(path.join(outputDirectory, "stella-selfie-"));
  const bundlePath = path.join(directory, "bundle");
  const files = [];
  for (const file of RUNTIME_FILES) {
    const destination = path.join(bundlePath, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    let data = fs.readFileSync(path.join(root, file));
    if (file === "package.json") {
      const { scripts, devDependencies, ...runtimePackage } = pkg;
      data = Buffer.from(`${JSON.stringify(runtimePackage, null, 2)}\n`);
    }
    fs.writeFileSync(destination, data, { flag: "wx" });
    files.push({ path: file, size: data.length, sha256: createHash("sha256").update(data).digest("hex") });
  }
  const fingerprint = createHash("sha256").update(JSON.stringify(files)).digest("hex");
  const manifestPath = path.join(directory, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify({ version: pkg.version, fingerprint, files }, null, 2)}\n`);
  return { bundlePath, manifestPath, fingerprint, files };
}
