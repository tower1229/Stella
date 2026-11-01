import { describe, expect, it } from "vitest";
import { normalizeNativeError } from "../scripts/errors";

describe("safe native errors", () => {
  it.each([
    [{ code: "HOST_QUERY_FAILED", message: "secret-key=private" }, "HOST_QUERY_FAILED"],
    [{ status: 401 }, "AUTH_FAILED"],
    [new Error('No API key found for provider "google"'), "AUTH_FAILED"],
    [{ statusCode: "403", message: "secret-key=private" }, "PERMISSION_DENIED"],
    [new Error("Blocked: resolves to private/internal/special-use IP address"), "PERMISSION_DENIED"],
    [{ error: { code: 429 } }, "RATE_LIMITED"],
    [new Error("deadline_exceeded: raw response"), "TIMEOUT"],
    [{ status: 504 }, "TIMEOUT"],
    [{ status: 400 }, "INPUT_INVALID"],
    [{ status: 404 }, "RESOURCE_NOT_FOUND"],
    [new Error("SAFETY blockedReason"), "SAFETY_BLOCKED"],
    [new Error("No images returned"), "NO_OUTPUT"],
    [new Error("fetch failed"), "UPSTREAM_UNAVAILABLE"],
    [new Error("unclassified secret-key=private"), "UNKNOWN"],
  ])("classifies %j without returning raw diagnostics", (error, code) => {
    const result = normalizeNativeError(error);
    expect(result.code).toBe(code);
    expect(result.message).toBeTruthy();
    expect(result.actionHint).toBeTruthy();
    expect(JSON.stringify(result)).not.toMatch(/secret-key|raw response|private|stack/);
  });
});
