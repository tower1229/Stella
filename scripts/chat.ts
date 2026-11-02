import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { InputError, prepareImageRequest, type BiliImageRequest, type ImagePreparationHost, type ImageProvider } from "./bili";
import { inspectImage, isPathInside } from "./images";
import { MissingConfigPathError, readAgentLocations, runOpenClawJson, type AgentLocation } from "./native-cli";

export interface ChatRequest extends BiliImageRequest { agentId: string; caption?: string }
export interface ChatState { agents: AgentLocation[]; skills: unknown; providers: ImageProvider[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function optionalStringList(value: unknown, label: string): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every(item => typeof item === "string")) {
    throw new InputError("CONFIG_INVALID", `Unsupported native image provider inventory: ${label}.`);
  }
  return value;
}
export function parseProviderInventory(value: unknown): ImageProvider[] {
  const items = Array.isArray(value) ? value
    : isRecord(value) && Array.isArray(value.providers) ? value.providers
    : undefined;
  if (!items) throw new InputError("CONFIG_INVALID", "Unsupported native image provider inventory.");
  const providers: ImageProvider[] = [];
  for (const item of items) {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id) {
      throw new InputError("CONFIG_INVALID", "Unsupported native image provider inventory.");
    }
    if (Object.hasOwn(item, "available") && item.available !== true) continue;
    if (Object.hasOwn(item, "configured") && item.configured !== true) continue;
    if (!isRecord(item.capabilities) || !isRecord(item.capabilities.edit) || typeof item.capabilities.edit.enabled !== "boolean") {
      throw new InputError("CONFIG_INVALID", "Unsupported native image provider inventory.");
    }
    const edit = item.capabilities.edit;
    const enabled = edit.enabled;
    const maxInputImages = edit.maxInputImages;
    const supportsResolution = edit.supportsResolution;
    const supportsAspectRatio = edit.supportsAspectRatio;
    if (typeof enabled !== "boolean"
        || (maxInputImages !== undefined && (typeof maxInputImages !== "number" || !Number.isInteger(maxInputImages)))
        || (supportsResolution !== undefined && typeof supportsResolution !== "boolean")
        || (supportsAspectRatio !== undefined && typeof supportsAspectRatio !== "boolean")) {
      throw new InputError("CONFIG_INVALID", "Unsupported native image provider inventory.");
    }
    const geometry = item.capabilities.geometry === undefined ? undefined
      : isRecord(item.capabilities.geometry) ? {
        aspectRatios: optionalStringList(item.capabilities.geometry.aspectRatios, "aspectRatios"),
        resolutions: optionalStringList(item.capabilities.geometry.resolutions, "resolutions"),
      } : undefined;
    if (item.capabilities.geometry !== undefined && !geometry) {
      throw new InputError("CONFIG_INVALID", "Unsupported native image provider inventory.");
    }
    providers.push({
      id: item.id,
      models: optionalStringList(item.models, "models"),
      capabilities: {
        edit: {
          enabled,
          ...(maxInputImages !== undefined ? { maxInputImages } : {}),
          ...(supportsResolution !== undefined ? { supportsResolution } : {}),
          ...(supportsAspectRatio !== undefined ? { supportsAspectRatio } : {}),
        },
        ...(geometry ? { geometry } : {}),
      },
    });
  }
  return providers;
}
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
  return { agents, skills, providers: parseProviderInventory(inventory) };
}

function checkedDirectory(workspace: string, directory: string): string {
  if (fs.lstatSync(directory).isSymbolicLink() || !fs.statSync(directory).isDirectory()) {
    throw new InputError("CONFIG_INVALID", "Reference scratch directories must be real directories.");
  }
  const real = fs.realpathSync(directory);
  if (!isPathInside(workspace, real)) throw new InputError("CONFIG_INVALID", "Reference scratch path leaves the Agent workspace.");
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
function host(state: ChatState): ImagePreparationHost<{ skills: unknown }> {
  return { config: { skills: state.skills }, runtime: {
    agent: {
      resolveAgentWorkspaceDir: (_cfg, id) => state.agents.find(a => a.id === id)!.workspace,
      resolveAgentDir: (_cfg, id) => state.agents.find(a => a.id === id)!.agentDir,
    },
    imageGeneration: {
      listProviders: () => state.providers,
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
      const name = `ref-${index}${inspectImage(image.buffer).extension}`;
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
        if (!stat.isFile() || stat.isSymbolicLink() || !isPathInside(directory, fs.realpathSync(file))) {
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
  let parsed: unknown;
  try { parsed = JSON.parse(fs.readFileSync(manifestFile, "utf8")); }
  catch { throw new InputError("INPUT_INVALID", "Invalid reference manifest file."); }
  const files = isRecord(parsed)
    && parsed.kind === "stella-reference-snapshot"
    && parsed.schemaVersion === 1
    && parsed.agentId === agent.id
    && parsed.token === token
    && Array.isArray(parsed.files)
    && parsed.files.length >= 1 && parsed.files.length <= 5
    && parsed.files.every((name): name is string => typeof name === "string" && /^ref-[0-4]\.(jpg|png|webp)$/.test(name))
    ? parsed.files : undefined;
  if (!files || fs.readdirSync(directory).some(name => name !== "manifest.json" && !files.includes(name))) {
    throw new InputError("INPUT_INVALID", "Reference manifest does not match this Agent or contains unexpected files.");
  }
  for (const name of [...files, "manifest.json"]) {
    checkedDirectory(workspace, directory);
    const file = path.join(directory, name);
    if (!fs.existsSync(file)) continue;
    if (fs.lstatSync(file).isSymbolicLink() || !isPathInside(directory, fs.realpathSync(file))) throw new InputError("INPUT_INVALID", "Reference file changed during cleanup.");
    fs.unlinkSync(file);
  }
  fs.rmdirSync(directory);
  return { schemaVersion: 1, ok: true, released: true };
}
