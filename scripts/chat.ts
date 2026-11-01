import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { InputError, prepareImageRequest, type BiliImageRequest, type StellaHost, type ImageProvider } from "./bili";
import { MissingConfigPathError, readAgentLocations, runOpenClawJson, type AgentLocation } from "./native-cli";

interface ChatRequest extends BiliImageRequest { agentId: string; caption?: string }
export interface ChatState { agents: AgentLocation[]; skills: unknown; providers: ImageProvider[] }
export async function readChatState(agentId: string): Promise<ChatState> {
  const agents = await readAgentLocations();
  if (!agents.some(a => a.id === agentId)) throw new InputError("AGENT_NOT_FOUND", "The current conversation Agent does not exist.");
  const [skills, inventory] = await Promise.all([
    runOpenClawJson(["config", "get", "skills", "--json"]).catch(error => {
      if (error instanceof MissingConfigPathError) return {};
      throw error;
    }),
    runOpenClawJson(["infer", "image", "providers", "--agent", agentId, "--json"]),
  ]);
  if (!Array.isArray(inventory)) throw new InputError("CONFIG_INVALID", "Unsupported native image provider inventory.");
  return { agents, skills, providers: inventory.filter(p => p.available && p.configured) };
}

function inside(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
function checkedDirectory(workspace: string, directory: string): string {
  if (fs.lstatSync(directory).isSymbolicLink() || !fs.statSync(directory).isDirectory()) {
    throw new InputError("CONFIG_INVALID", "Reference scratch directories must be real directories.");
  }
  const real = fs.realpathSync(directory);
  if (!inside(workspace, real)) throw new InputError("CONFIG_INVALID", "Reference scratch path leaves the Agent workspace.");
  return real;
}
function scratchRoot(workspace: string, create: boolean) {
  let current = fs.realpathSync(workspace);
  for (const segment of ["stella-selfie", ".references"]) {
    current = path.join(current, segment);
    if (create) {
      try { fs.mkdirSync(current, { mode: 0o700 }); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
    checkedDirectory(workspace, current);
  }
  return current;
}
function host(state: ChatState): StellaHost<{ skills: unknown }> {
  return { config: { skills: state.skills }, runtime: {
    agent: {
      resolveAgentWorkspaceDir: (_cfg, id) => state.agents.find(a => a.id === id)!.workspace,
      resolveAgentDir: (_cfg, id) => state.agents.find(a => a.id === id)!.agentDir,
    },
    imageGeneration: {
      listProviders: () => state.providers,
      generate: async () => { throw new Error("Chat preparation never generates images."); },
    },
  } };
}

export function prepareChat(request: ChatRequest, state: ChatState) {
  if (!request || typeof request.agentId !== "string" || !request.agentId ||
      (request.caption !== undefined && typeof request.caption !== "string")) {
    throw new InputError("INPUT_INVALID", "Specify the actual conversation Agent and an optional text caption.");
  }
  const { caption, ...imageRequest } = request;
  const prepared = prepareImageRequest(host(state), { listAgentIds: () => state.agents.map(a => a.id), onWarning: m => console.error(m) }, imageRequest);
  const root = scratchRoot(prepared.workspace, true);
  const id = randomUUID();
  const directory = fs.mkdtempSync(path.join(root, `${id}-`));
  const token = path.basename(directory);
  const createdFiles: string[] = [];
  const writeSnapshot = (name: string, data: Buffer | string) => {
    checkedDirectory(prepared.workspace, directory);
    const fd = fs.openSync(path.join(directory, name), "wx", 0o600);
    // Register ownership before writing: writeFileSync can fail after a partial write.
    createdFiles.push(name);
    try { fs.writeFileSync(fd, data); }
    catch (error) {
      try { fs.closeSync(fd); } catch { /* Preserve the original write failure. */ }
      throw error;
    }
    fs.closeSync(fd);
  };
  try {
    const files = prepared.params.inputImages.map((image, index) => {
      const extension = image.mimeType === "image/jpeg" ? "jpg" : image.mimeType === "image/webp" ? "webp" : "png";
      const name = `ref-${index}.${extension}`;
      writeSnapshot(name, image.buffer);
      return name;
    });
    writeSnapshot("manifest.json", JSON.stringify({ schemaVersion: 1, kind: "stella-reference-snapshot", agentId: request.agentId, token, files }));
    const { modelOverride, prompt, count, resolution, aspectRatio } = prepared.params;
    return { schemaVersion: 1, ok: true, agentId: request.agentId, referenceToken: token,
      toolInput: { model: modelOverride, prompt, count, resolution, images: files.map(name => path.join(directory, name)), ...(aspectRatio ? { aspectRatio } : {}) },
      ...(caption !== undefined ? { caption } : {}),
    };
  } catch (error) {
    // Try every owned file, including partial references/manifest, without masking the original error.
    let cleanupFailed = false;
    for (const name of createdFiles) {
      try {
        checkedDirectory(prepared.workspace, directory);
        const file = path.join(directory, name);
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || !inside(directory, fs.realpathSync(file))) {
          throw new Error("Reference file changed during cleanup.");
        }
        fs.unlinkSync(file);
      } catch (cleanupError) {
        if ((cleanupError as NodeJS.ErrnoException).code !== "ENOENT") cleanupFailed = true;
      }
    }
    try {
      checkedDirectory(prepared.workspace, directory);
      if (fs.readdirSync(directory).length === 0) fs.rmdirSync(directory);
      else cleanupFailed = true;
    } catch { cleanupFailed = true; }
    if (cleanupFailed) console.error(`[stella] Warning: Input scratch cleanup incomplete at ${JSON.stringify(directory)}; explicit cleanup is required.`);
    throw error;
  }
}

export function releaseReferences(agent: AgentLocation, token: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[A-Za-z0-9]{6}$/.test(token)) {
    throw new InputError("INPUT_INVALID", "Invalid reference token.");
  }
  const workspace = fs.realpathSync(agent.workspace);
  const directory = path.join(scratchRoot(workspace, false), token);
  if (!fs.existsSync(directory)) return { schemaVersion: 1, ok: true, released: false };
  checkedDirectory(workspace, directory);
  const manifestFile = path.join(directory, "manifest.json");
  const manifestStat = fs.lstatSync(manifestFile);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 8192) {
    throw new InputError("INPUT_INVALID", "Invalid reference manifest file.");
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  if (manifest.kind !== "stella-reference-snapshot" || manifest.schemaVersion !== 1 || manifest.agentId !== agent.id ||
      manifest.token !== token || !Array.isArray(manifest.files) || manifest.files.length < 1 || manifest.files.length > 5 ||
      !manifest.files.every((name: unknown) => typeof name === "string" && /^ref-[0-4]\.(jpg|png|webp)$/.test(name)) ||
      fs.readdirSync(directory).some(name => name !== "manifest.json" && !manifest.files.includes(name))) {
    throw new InputError("INPUT_INVALID", "Reference manifest does not match this Agent or contains unexpected files.");
  }
  for (const name of [...manifest.files, "manifest.json"]) {
    checkedDirectory(workspace, directory);
    const file = path.join(directory, name);
    if (!fs.existsSync(file)) continue;
    if (fs.lstatSync(file).isSymbolicLink() || !inside(directory, fs.realpathSync(file))) throw new InputError("INPUT_INVALID", "Reference file changed during cleanup.");
    fs.unlinkSync(file);
  }
  fs.rmdirSync(directory);
  return { schemaVersion: 1, ok: true, released: true };
}
