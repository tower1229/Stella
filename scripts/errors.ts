export type StellaProvider = "gemini" | "fal" | "openclaw";

export type StellaErrorCategory =
  | "user_fixable"
  | "transient"
  | "policy"
  | "auth"
  | "config"
  | "unknown";

export type StellaErrorCode =
  | "CONFIG_MISSING"
  | "INPUT_INVALID"
  | "AUTH_INVALID_KEY"
  | "PERMISSION_DENIED"
  | "RESOURCE_NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "TIMEOUT"
  | "SAFETY_BLOCKED"
  | "NO_OUTPUT"
  | "SEND_FAILED"
  | "UNKNOWN";

export interface StellaErrorDetails {
  provider: StellaProvider;
  code: StellaErrorCode;
  category: StellaErrorCategory;
  retryable: boolean;
  userMessage: string;
  actionHint: string;
  statusCode?: number;
  upstreamType?: string;
  rawMessage?: string;
}

export class StellaError extends Error {
  public readonly details: StellaErrorDetails;
  public readonly cause?: unknown;

  constructor(details: StellaErrorDetails, cause?: unknown) {
    super(`[${details.provider}:${details.code}] ${details.rawMessage || details.userMessage}`);
    this.name = "StellaError";
    this.details = details;
    this.cause = cause;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return [];
}

function readMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  const rec = asRecord(err);
  if (typeof rec.message === "string") return rec.message;
  if (typeof rec.detail === "string") return rec.detail;
  return String(err);
}

function readStatus(err: unknown): number | undefined {
  const rec = asRecord(err);
  if (typeof rec.status === "number") return rec.status;
  const nested = asRecord(rec.error);
  if (typeof nested.code === "number") return nested.code;
  return undefined;
}

function readFalErrorType(err: unknown): string | undefined {
  const rec = asRecord(err);
  if (typeof rec.error_type === "string") return rec.error_type;
  const body = asRecord(rec.body);
  if (typeof body.error_type === "string") return body.error_type;
  return undefined;
}

function readFalModelErrorType(err: unknown): string | undefined {
  const rec = asRecord(err);
  const detail = asArray(rec.detail);
  if (detail.length > 0) {
    const first = asRecord(detail[0]);
    if (typeof first.type === "string") return first.type;
  }
  const body = asRecord(rec.body);
  const bodyDetail = asArray(body.detail);
  if (bodyDetail.length > 0) {
    const first = asRecord(bodyDetail[0]);
    if (typeof first.type === "string") return first.type;
  }
  return undefined;
}

function isTruthyStringFlag(value: unknown): boolean {
  return typeof value === "string" && value.toLowerCase() === "true";
}

function defaultUnknown(provider: StellaProvider, err: unknown): StellaErrorDetails {
  return {
    provider,
    code: "UNKNOWN",
    category: "unknown",
    retryable: false,
    userMessage: "这次图片没生成成功。",
    actionHint: "请稍后重试；若持续失败，请检查 provider 配置和网络连通性。",
    statusCode: readStatus(err),
    rawMessage: readMessage(err),
  };
}

export function normalizeGeminiError(err: unknown): StellaErrorDetails {
  const message = readMessage(err);
  const status = readStatus(err);
  const lower = message.toLowerCase();

  if (message.includes("GEMINI_API_KEY is not set")) {
    return {
      provider: "gemini",
      code: "CONFIG_MISSING",
      category: "config",
      retryable: false,
      userMessage: "这次图片没生成成功：缺少 Gemini API Key。",
      actionHint: "请在 skills.entries.stella-selfie.env 中配置 GEMINI_API_KEY 后重试。",
      statusCode: status,
      rawMessage: message,
    };
  }

  if (lower.includes("safety") || lower.includes("block_reason") || lower.includes("blockedreason")) {
    return {
      provider: "gemini",
      code: "SAFETY_BLOCKED",
      category: "policy",
      retryable: false,
      userMessage: "这次图片没生成成功：请求触发了内容安全限制。",
      actionHint: "请改用更中性、非敏感的描述后再试。",
      statusCode: status,
      rawMessage: message,
    };
  }

  if (status === 400) {
    return {
      provider: "gemini",
      code: "INPUT_INVALID",
      category: "user_fixable",
      retryable: false,
      userMessage: "这次图片没生成成功：请求参数不合法。",
      actionHint: "请简化提示词或调整参数后重试。",
      statusCode: status,
      rawMessage: message,
    };
  }

  if (status === 403 || lower.includes("permission_denied")) {
    return {
      provider: "gemini",
      code: "PERMISSION_DENIED",
      category: "auth",
      retryable: false,
      userMessage: "这次图片没生成成功：Gemini 鉴权失败或权限不足。",
      actionHint: "请检查 API Key 是否正确、可用并具备对应模型权限。",
      statusCode: status,
      rawMessage: message,
    };
  }

  if (status === 404 || lower.includes("not_found")) {
    return {
      provider: "gemini",
      code: "RESOURCE_NOT_FOUND",
      category: "user_fixable",
      retryable: false,
      userMessage: "这次图片没生成成功：请求引用的资源不存在。",
      actionHint: "请检查输入资源路径或链接后重试。",
      statusCode: status,
      rawMessage: message,
    };
  }

  if (status === 429 || lower.includes("resource_exhausted") || lower.includes("rate limit")) {
    return {
      provider: "gemini",
      code: "RATE_LIMITED",
      category: "transient",
      retryable: true,
      userMessage: "这次图片没生成成功：请求过于频繁。",
      actionHint: "请等待 1-2 分钟后重试。",
      statusCode: status,
      rawMessage: message,
    };
  }

  if (status === 504 || lower.includes("deadline_exceeded") || lower.includes("timeout")) {
    return {
      provider: "gemini",
      code: "TIMEOUT",
      category: "transient",
      retryable: true,
      userMessage: "这次图片没生成成功：Gemini 处理超时。",
      actionHint: "请稍后重试，或简化提示词后再试。",
      statusCode: status,
      rawMessage: message,
    };
  }

  if (
    lower.includes("econnreset") ||
    lower.includes("etimedout") ||
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("socket hang up") ||
    lower.includes("eai_again") ||
    lower.includes("enotfound")
  ) {
    return {
      provider: "gemini",
      code: "UPSTREAM_UNAVAILABLE",
      category: "transient",
      retryable: true,
      userMessage: "这次图片没生成成功：网络或上游服务暂时不可用。",
      actionHint: "请稍后重试。",
      statusCode: status,
      rawMessage: message,
    };
  }

  if (status === 500 || status === 503 || lower.includes("unavailable") || lower.includes("internal")) {
    return {
      provider: "gemini",
      code: "UPSTREAM_UNAVAILABLE",
      category: "transient",
      retryable: true,
      userMessage: "这次图片没生成成功：Gemini 服务暂时不可用。",
      actionHint: "请稍后重试，必要时切换 Provider=fal。",
      statusCode: status,
      rawMessage: message,
    };
  }

  if (lower.includes("no image data") || lower.includes("no content parts")) {
    return {
      provider: "gemini",
      code: "NO_OUTPUT",
      category: "transient",
      retryable: true,
      userMessage: "这次图片没生成成功：模型未返回有效图片。",
      actionHint: "请直接重试一次，或稍微改写提示词后再试。",
      statusCode: status,
      rawMessage: message,
    };
  }

  return defaultUnknown("gemini", err);
}

export function normalizeFalError(err: unknown): StellaErrorDetails {
  const message = readMessage(err);
  const status = readStatus(err);
  const lower = message.toLowerCase();
  const errorType = readFalErrorType(err);
  const modelType = readFalModelErrorType(err);
  const rec = asRecord(err);
  const retryableHeader = isTruthyStringFlag(rec["x-fal-retryable"]);
  const retryableField = isTruthyStringFlag(rec.retryable);
  const retryable = retryableHeader || retryableField;

  if (message.includes("FAL_KEY is not set")) {
    return {
      provider: "fal",
      code: "CONFIG_MISSING",
      category: "config",
      retryable: false,
      userMessage: "这次图片没生成成功：缺少 fal API Key。",
      actionHint: "请在 skills.entries.stella-selfie.env 中配置 FAL_KEY 后重试。",
      statusCode: status,
      rawMessage: message,
    };
  }

  if (status === 401 || status === 403) {
    return {
      provider: "fal",
      code: "AUTH_INVALID_KEY",
      category: "auth",
      retryable: false,
      userMessage: "这次图片没生成成功：fal 鉴权失败。",
      actionHint: "请检查 FAL_KEY 是否有效且有权限访问该模型。",
      statusCode: status,
      rawMessage: message,
    };
  }

  if (status === 429) {
    return {
      provider: "fal",
      code: "RATE_LIMITED",
      category: "transient",
      retryable: true,
      userMessage: "这次图片没生成成功：fal 当前请求较拥堵。",
      actionHint: "请稍后重试。",
      statusCode: status,
      upstreamType: errorType,
      rawMessage: message,
    };
  }

  if (
    modelType === "content_policy_violation" ||
    lower.includes("content policy") ||
    lower.includes("safety")
  ) {
    return {
      provider: "fal",
      code: "SAFETY_BLOCKED",
      category: "policy",
      retryable: false,
      userMessage: "这次图片没生成成功：请求触发了内容安全限制。",
      actionHint: "请改用更中性、非敏感的描述后再试。",
      statusCode: status,
      upstreamType: modelType || errorType,
      rawMessage: message,
    };
  }

  if (modelType === "file_download_error" || modelType === "image_load_error") {
    return {
      provider: "fal",
      code: "INPUT_INVALID",
      category: "user_fixable",
      retryable: false,
      userMessage: "这次图片没生成成功：参考图地址不可访问或无法读取。",
      actionHint: "请确认 AvatarsURLs 为公开可下载的 http/https 图片地址。",
      statusCode: status,
      upstreamType: modelType,
      rawMessage: message,
    };
  }

  if (
    modelType === "unsupported_image_format" ||
    modelType === "image_too_small" ||
    modelType === "image_too_large" ||
    modelType === "feature_not_supported"
  ) {
    return {
      provider: "fal",
      code: "INPUT_INVALID",
      category: "user_fixable",
      retryable: false,
      userMessage: "这次图片没生成成功：输入图片规格不符合要求。",
      actionHint: "请更换为支持格式并确保尺寸满足模型要求后重试。",
      statusCode: status,
      upstreamType: modelType,
      rawMessage: message,
    };
  }

  if (modelType === "no_media_generated" || lower.includes("no images")) {
    return {
      provider: "fal",
      code: "NO_OUTPUT",
      category: "user_fixable",
      retryable: false,
      userMessage: "这次图片没生成成功：模型未生成有效图片。",
      actionHint: "请简化提示词或调整描述后重试。",
      statusCode: status,
      upstreamType: modelType,
      rawMessage: message,
    };
  }

  const timeoutErrorTypes = new Set(["request_timeout", "startup_timeout", "generation_timeout"]);
  if (
    status === 504 ||
    (errorType && timeoutErrorTypes.has(errorType)) ||
    (modelType && timeoutErrorTypes.has(modelType))
  ) {
    return {
      provider: "fal",
      code: "TIMEOUT",
      category: "transient",
      retryable: true,
      userMessage: "这次图片没生成成功：fal 处理超时。",
      actionHint: "请稍后重试。",
      statusCode: status,
      upstreamType: errorType || modelType,
      rawMessage: message,
    };
  }

  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    (errorType && (errorType.startsWith("runner_") || errorType === "internal_error"))
  ) {
    return {
      provider: "fal",
      code: "UPSTREAM_UNAVAILABLE",
      category: "transient",
      retryable: true,
      userMessage: "这次图片没生成成功：fal 服务暂时不可用。",
      actionHint: "请稍后重试。",
      statusCode: status,
      upstreamType: errorType,
      rawMessage: message,
    };
  }

  if (status === 400 || status === 422 || errorType === "bad_request") {
    return {
      provider: "fal",
      code: "INPUT_INVALID",
      category: "user_fixable",
      retryable: false,
      userMessage: "这次图片没生成成功：请求参数不符合 fal 接口要求。",
      actionHint: "请检查提示词和参考图参数后重试。",
      statusCode: status,
      upstreamType: modelType || errorType,
      rawMessage: message,
    };
  }

  return defaultUnknown("fal", err);
}

export function normalizeOpenClawSendError(err: unknown): StellaErrorDetails {
  const message = readMessage(err);
  return {
    provider: "openclaw",
    code: "SEND_FAILED",
    category: "transient",
    retryable: true,
    userMessage: "消息发送失败。",
    actionHint: "请检查 OpenClaw CLI 与 Gateway 连通性后重试。",
    rawMessage: message,
  };
}

export function toStellaError(details: StellaErrorDetails, cause?: unknown): StellaError {
  return new StellaError(details, cause);
}

export function isStellaError(err: unknown): err is StellaError {
  return err instanceof StellaError;
}

export function asStellaError(provider: StellaProvider, err: unknown): StellaError {
  if (isStellaError(err)) return err;
  if (provider === "gemini") return toStellaError(normalizeGeminiError(err), err);
  if (provider === "fal") return toStellaError(normalizeFalError(err), err);
  return toStellaError(normalizeOpenClawSendError(err), err);
}

export function shouldRetryGemini(err: unknown): boolean {
  return normalizeGeminiError(err).retryable;
}

export function shouldRetryFal(err: unknown): boolean {
  return normalizeFalError(err).retryable;
}

export function formatFailureMessage(details: StellaErrorDetails): string {
  return `${details.userMessage} ${details.actionHint}`;
}
