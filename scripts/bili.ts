import * as fs from "node:fs";
import * as path from "node:path";
import { parseIdentity } from "./identity";
import { selectAvatars } from "./avatars";
import { inspectImage } from "./images";
import { localActionHint, normalizeNativeError } from "./errors";

export const AGENT_ID = /^[a-z0-9][a-z0-9_-]*$/;
export const RESOLUTIONS = ["1K", "2K", "4K"] as const;
export type Resolution = typeof RESOLUTIONS[number];
export interface ImageAsset { buffer: Buffer; mimeType: string; fileName?: string }
export interface NativeGenerateParams<C> {
  cfg: C;
  agentDir: string;
  prompt: string;
  modelOverride: string;
  autoProviderFallback: false;
  inputImages: ImageAsset[];
  count: number;
  resolution: Resolution;
  aspectRatio?: string;
}
export interface ImageProvider {
  id: string;
  models?: readonly string[];
  capabilities: {
    edit: { enabled: boolean; maxInputImages?: number; supportsResolution?: boolean; supportsAspectRatio?: boolean };
    geometry?: { aspectRatios?: readonly string[]; resolutions?: readonly string[] };
  };
}
export interface NativeImageResult {
  images: ImageAsset[];
  provider: string;
  model: string;
  ignoredOverrides: readonly { key: string; value?: unknown }[];
}
// Structural subset of OpenClawPluginApi: the consuming plugin supplies its live api.
// No import from private OpenClaw dist files, SDK install, or separate Stella plugin.
export interface StellaHost<C> {
  config: C;
  runtime: {
    agent: {
      resolveAgentWorkspaceDir(cfg: C, agentId: string): string;
      resolveAgentDir(cfg: C, agentId: string): string;
    };
    imageGeneration: {
      listProviders(params?: { cfg?: C }): readonly ImageProvider[];
      generate(params: NativeGenerateParams<C>): Promise<NativeImageResult>;
    };
  };
}
export interface ImagePreparationHost<C> {
  config: C;
  runtime: {
    agent: StellaHost<C>["runtime"]["agent"];
    imageGeneration: Pick<StellaHost<C>["runtime"]["imageGeneration"], "listProviders">;
  };
}
export interface BiliImageRequest {
  schemaVersion: 1;
  agentId?: string;
  prompt: string;
  resolution?: Resolution;
  aspectRatio?: string;
}
export type BiliImageResult = {
  schemaVersion: 1;
  ok: true;
  agentId: string;
  generatedAt: string;
  image: ImageAsset;
} | {
  schemaVersion: 1;
  ok: false;
  error: {
    code: string;
    stage: "validate" | "reference" | "generate";
    message: string;
    actionHint?: string;
    generationOutcome: "not_started" | "succeeded" | "unknown";
  };
};
export interface BiliIntegration<C> {
  // Use listAgentIds from openclaw/plugin-sdk/agent-scope-runtime.
  listAgentIds(cfg: C): readonly string[];
  onWarning?: (message: string) => void;
}

export class InputError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function validateRequest(value: unknown): BiliImageRequest {
  const r = object(value);
  const allowed = ["schemaVersion", "agentId", "prompt", "resolution", "aspectRatio"];
  if (Object.keys(r).some(key => !allowed.includes(key)) || r.schemaVersion !== 1 ||
      typeof r.prompt !== "string" || !r.prompt.trim() || r.prompt.includes("\0") ||
      (r.agentId !== undefined && (typeof r.agentId !== "string" || !AGENT_ID.test(r.agentId))) ||
      (r.resolution !== undefined && (typeof r.resolution !== "string" || !(RESOLUTIONS as readonly string[]).includes(r.resolution))) ||
      (r.aspectRatio !== undefined && (typeof r.aspectRatio !== "string" || !/^\d+:\d+$/.test(r.aspectRatio)))) {
    throw new InputError("INPUT_INVALID", "Use a v1 single-image request with prompt, optional agentId, resolution and aspectRatio.");
  }
  return r as unknown as BiliImageRequest;
}
function settings(config: unknown, workspace: string) {
  const cfg = object(config);
  const entry = object(object(object(cfg.skills).entries)["stella-selfie"]);
  if (entry.config !== undefined && (entry.config === null || typeof entry.config !== "object" || Array.isArray(entry.config))) {
    throw new InputError("CONFIG_INVALID", "Stella config must be an object.");
  }
  const options = object(entry.config), legacy = object(entry.env);
  const get = (key: string, fallback: unknown) => Object.hasOwn(options, key) ? options[key]
    : process.env[key] ?? legacy[key] ?? fallback;
  const provider = process.env.Provider ?? legacy.Provider;
  if (provider !== undefined && provider !== "gemini") {
    throw new InputError("CONFIG_INVALID", "This integration supports only Google's official image provider; migrate the legacy Provider setting.");
  }
  const model = Object.hasOwn(options, "model") ? options.model : "google/gemini-3-pro-image";
  const blend = get("AvatarBlendEnabled", true);
  const max = get("AvatarMaxRefs", 3);
  const rawRoots = get("AvatarAllowedRoots", undefined);
  if (typeof model !== "string" || !/^google\/[^/\s]+$/.test(model) ||
      !(typeof blend === "boolean" || (typeof blend === "string" && ["true", "false"].includes(blend.toLowerCase()))) ||
      !(typeof max === "number" || (typeof max === "string" && /^\d+$/.test(max))) ||
      !Number.isInteger(Number(max)) || Number(max) < 1 || Number(max) > 5) {
    throw new InputError("CONFIG_INVALID", "Use a Google image model, a boolean AvatarBlendEnabled and AvatarMaxRefs between 1 and 5.");
  }
  let roots: unknown = rawRoots;
  if (typeof roots === "string") {
    try { roots = JSON.parse(roots); } catch { throw new InputError("CONFIG_INVALID", "AvatarAllowedRoots must be a non-empty array of absolute directories."); }
  }
  if (roots !== undefined && (!Array.isArray(roots) || roots.length === 0 ||
      !roots.every(root => typeof root === "string" && path.isAbsolute(root)))) {
    throw new InputError("CONFIG_INVALID", "AvatarAllowedRoots must be a non-empty array of absolute directories.");
  }
  let allowedRoots: string[];
  try {
    // Do not realpath default children: an assets/avatars link must not authorize its outside target.
    allowedRoots = roots === undefined ? [path.join(workspace, "assets"), path.join(workspace, "avatars")]
      : (roots as string[]).map(root => {
        const real = fs.realpathSync(root);
        if (!fs.statSync(real).isDirectory()) throw new Error("Not a directory");
        return real;
      });
  } catch { throw new InputError("CONFIG_INVALID", "An authorized reference directory is unavailable."); }
  return { model, blend: String(blend).toLowerCase() !== "false", max: Number(max), allowedRoots };
}

/** Shared validated inputs for native chat tools and in-process plugin calls. */
export function prepareImageRequest<C>(
  api: ImagePreparationHost<C>, integration: BiliIntegration<C>, value: BiliImageRequest,
  onReference: () => void = () => {},
) {
    const request = validateRequest(value);
    const agentId = request.agentId ?? "main";
    if (!integration.listAgentIds(api.config).includes(agentId)) {
      throw new InputError("AGENT_NOT_FOUND", `The bound Agent '${agentId}' does not exist.`);
    }
    let workspace: string;
    try { workspace = fs.realpathSync(api.runtime.agent.resolveAgentWorkspaceDir(api.config, agentId)); }
    catch { throw new InputError("IDENTITY_UNREADABLE", "The bound Agent workspace is unavailable."); }
    const config = settings(api.config, workspace);
    const provider = api.runtime.imageGeneration.listProviders({ cfg: api.config }).find(p => p.id === "google");
    if (!provider?.capabilities.edit.enabled || !provider.models?.includes(config.model.slice("google/".length)) ||
        (provider.capabilities.edit.maxInputImages !== undefined && config.max > provider.capabilities.edit.maxInputImages)) {
      throw new InputError("CONFIG_INVALID", "The selected Google model or reference count is unsupported by this host.");
    }
    const resolution = request.resolution ?? "2K";
    if (provider.capabilities.edit.supportsResolution === false ||
        (provider.capabilities.geometry?.resolutions && !provider.capabilities.geometry.resolutions.includes(resolution)) ||
        (request.aspectRatio !== undefined && (provider.capabilities.edit.supportsAspectRatio === false ||
          !provider.capabilities.geometry?.aspectRatios?.includes(request.aspectRatio)))) {
      throw new InputError("INPUT_INVALID", "The selected model does not support the requested resolution or aspect ratio.");
    }
    const agentDir = api.runtime.agent.resolveAgentDir(api.config, agentId);
    if (!path.isAbsolute(agentDir)) throw new InputError("CONFIG_INVALID", "The host must resolve an absolute Agent authentication directory.");
    onReference();
    let identity: ReturnType<typeof parseIdentity>;
    try { identity = parseIdentity(workspace); }
    catch { throw new InputError("IDENTITY_UNREADABLE", "The bound Agent IDENTITY.md could not be read."); }
    const references = selectAvatars({
      ...identity, avatarMaxRefs: config.max, avatarBlendEnabled: config.blend,
      allowedRoots: config.allowedRoots, onWarning: integration.onWarning ?? (() => {}),
    });
    if (references.length === 0) throw new InputError("NO_VALID_REFERENCE", "At least one authorized JPEG, PNG or WebP reference is required.");
    // First-read bytes cross the runtime boundary; do not reopen the original path.
    const inputImages: ImageAsset[] = references.map(({ buffer, mimeType }) => ({ buffer, mimeType }));
    const params: NativeGenerateParams<C> = {
      cfg: api.config, agentDir, prompt: request.prompt, modelOverride: config.model,
      autoProviderFallback: false, count: 1, resolution, inputImages,
      ...(request.aspectRatio !== undefined ? { aspectRatio: request.aspectRatio } : {}),
    };
    return { agentId, workspace, params };
}

/** Generate one in-memory persona image. The caller owns preview, persistence and publishing. */
export async function generateForBili<C>(
  api: StellaHost<C>, integration: BiliIntegration<C>, value: BiliImageRequest,
): Promise<BiliImageResult> {
  let stage: "validate" | "reference" | "generate" = "validate";
  let generationOutcome: "not_started" | "succeeded" | "unknown" = "not_started";
  try {
    const { agentId, params } = prepareImageRequest(api, integration, value, () => { stage = "reference"; });
    stage = "generate";
    generationOutcome = "unknown";
    const result = await api.runtime.imageGeneration.generate(params);
    generationOutcome = "succeeded";
    if (result.provider !== "google" || result.model !== params.modelOverride.slice("google/".length) ||
        result.ignoredOverrides.length > 0 || result.images.length !== 1 || !Buffer.isBuffer(result.images[0].buffer)) {
      throw new InputError("OUTPUT_INVALID", "The native result did not satisfy the single-image Google request.");
    }
    const image = result.images[0];
    // Native output limits belong to the host; the 20 MiB reference cap is not an output cap.
    let format: ReturnType<typeof inspectImage>;
    try { format = inspectImage(image.buffer, image.buffer.length); }
    catch { throw new InputError("OUTPUT_INVALID", "The native provider returned an empty or invalid image."); }
    if (format.mimeType !== image.mimeType) throw new InputError("OUTPUT_INVALID", "The image content and MIME type disagree.");
    return { schemaVersion: 1, ok: true, agentId, generatedAt: new Date().toISOString(),
      image: { buffer: image.buffer, mimeType: format.mimeType } };
  } catch (error) {
    if (error instanceof InputError) {
      return { schemaVersion: 1, ok: false, error: {
        code: error.code, stage, generationOutcome, message: error.message,
        actionHint: localActionHint(error.code),
      } };
    }
    const details = normalizeNativeError(error);
    return { schemaVersion: 1, ok: false, error: {
      code: details.code, stage, generationOutcome,
      // Never expose the provider's raw response, key, original error or stack to the calling workflow.
      message: details.message, actionHint: details.actionHint,
    } };
  }
}
