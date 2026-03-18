export type Resolution = "1K" | "2K" | "4K";

export interface FalGenerateOptions {
  prompt: string;
  referenceImageUrls: string[];
  resolution: Resolution;
  count: number;
  apiKey?: string;
}

export interface FalResult {
  imageUrl: string;
  revisedPrompt?: string;
}

interface FalImage {
  url: string;
  content_type: string;
  width: number;
  height: number;
}

interface FalResponse {
  images: FalImage[];
  revised_prompt?: string;
}

function getApiKey(provided?: string): string {
  const key = provided || process.env.FAL_KEY;
  if (!key) {
    throw new Error(
      "FAL_KEY is not set. Set it in your environment (e.g. OpenClaw skills.entries.*.env) or for local testing use .env.local / --api-key."
    );
  }
  return key;
}

/**
 * Generate images using fal.ai xAI Grok Imagine.
 * - No reference images: uses text-to-image endpoint (supports aspect_ratio)
 * - With reference images: uses image editing endpoint (image_urls array)
 *   NOTE: fal only accepts HTTP/HTTPS URLs for reference images.
 *   The edit endpoint does not support resolution/aspect_ratio parameters.
 * No automatic fallback — errors are thrown directly.
 */
export async function generateWithFal(
  options: FalGenerateOptions
): Promise<FalResult[]> {
  const { prompt, referenceImageUrls, count, apiKey } = options;
  const key = getApiKey(apiKey);

  const hasRefs = referenceImageUrls.length > 0;
  const endpoint = hasRefs
    ? "xai/grok-imagine-image/edit"
    : "xai/grok-imagine-image";

  // Dynamic import to avoid loading the SDK when not needed
  const { fal } = await import("@fal-ai/client");
  fal.config({ credentials: key });

  const input: Record<string, unknown> = {
    prompt,
    num_images: count,
    output_format: "jpeg",
  };

  if (hasRefs) {
    // Edit endpoint: pass reference URLs, no resolution parameter supported
    input.image_urls = referenceImageUrls;
  } else {
    // Text-to-image endpoint: aspect_ratio is the only supported size control
    input.aspect_ratio = "1:1";
  }

  const result = await fal.subscribe(endpoint, { input });
  const data = result.data as FalResponse;

  if (!data.images || data.images.length === 0) {
    throw new Error(`fal.ai returned no images from endpoint: ${endpoint}`);
  }

  return data.images.map((img) => ({
    imageUrl: img.url,
    revisedPrompt: data.revised_prompt,
  }));
}
