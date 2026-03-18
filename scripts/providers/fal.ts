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
      "FAL_KEY is not set. Configure it in .env.local or pass --api-key."
    );
  }
  return key;
}

/**
 * Generate images using fal.ai xAI Grok Imagine.
 * - No reference images: uses text-to-image endpoint
 * - With reference images: uses image editing endpoint (image_urls array)
 * No automatic fallback — errors are thrown directly.
 */
export async function generateWithFal(
  options: FalGenerateOptions
): Promise<FalResult[]> {
  const { prompt, referenceImageUrls, resolution, count, apiKey } = options;
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
    input.image_urls = referenceImageUrls;
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
