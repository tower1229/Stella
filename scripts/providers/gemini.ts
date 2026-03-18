import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const MODEL = "gemini-3.1-flash-image-preview";

export type Resolution = "1K" | "2K" | "4K";

export interface GeminiGenerateOptions {
  prompt: string;
  referenceImages: string[];
  resolution: Resolution;
  count: number;
  apiKey?: string;
}

export interface GeminiResult {
  imageData: Buffer;
  mimeType: string;
  revisedPrompt?: string;
  outputPath: string;
}

function getApiKey(provided?: string): string {
  const key = provided || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Configure it in .env.local or pass --api-key."
    );
  }
  return key;
}

function readImageAsBase64(
  filePath: string
): { data: string; mimeType: string } {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };
  const mimeType = mimeMap[ext] || "image/jpeg";
  const data = fs.readFileSync(filePath).toString("base64");
  return { data, mimeType };
}

function buildContents(
  prompt: string,
  referenceImages: string[]
): object[] {
  if (referenceImages.length === 0) {
    // Text-to-image: single text part
    return [{ text: prompt }];
  }

  // Image editing: reference images first, then prompt
  const parts: object[] = [];

  for (const imgPath of referenceImages) {
    const { data, mimeType } = readImageAsBase64(imgPath);
    parts.push({
      inlineData: { data, mimeType },
    });
  }

  parts.push({ text: prompt });

  return [{ parts }];
}

/**
 * Generate images using Gemini gemini-3.1-flash-image-preview.
 * Returns an array of results (one per requested image).
 */
export async function generateWithGemini(
  options: GeminiGenerateOptions
): Promise<GeminiResult[]> {
  const { prompt, referenceImages, resolution, count, apiKey } = options;
  const key = getApiKey(apiKey);

  // Dynamic import to avoid loading the SDK when not needed
  const { GoogleGenAI } = await import("@google/genai");

  const ai = new GoogleGenAI({ apiKey: key });

  const contents = buildContents(prompt, referenceImages);

  const results: GeminiResult[] = [];
  const tmpDir = os.tmpdir();

  for (let i = 0; i < count; i++) {
    const generateConfig = {
      responseModalities: ["TEXT", "IMAGE"],
      // imageConfig is a newer API field not yet reflected in SDK types
      imageConfig: { imageSize: resolution },
    };

    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: generateConfig as object,
    });

    let imageData: Buffer | null = null;
    let mimeType = "image/png";
    let revisedPrompt: string | undefined;

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      throw new Error("Gemini returned no content parts");
    }

    for (const part of candidate.content.parts) {
      if (part.text) {
        revisedPrompt = part.text;
      } else if (part.inlineData) {
        // The SDK types inlineData as Blob; at runtime the data field is base64 string
        const blob = part.inlineData as unknown as {
          data: string | Uint8Array;
          mimeType?: string;
        };
        mimeType = blob.mimeType || "image/png";
        if (typeof blob.data === "string") {
          imageData = Buffer.from(blob.data, "base64");
        } else if (blob.data) {
          imageData = Buffer.from(blob.data as Uint8Array);
        }
      }
    }

    if (!imageData) {
      throw new Error("Gemini returned no image data in response");
    }

    const ext = mimeType.split("/")[1] || "png";
    // Use process.hrtime for sub-millisecond uniqueness when count > 1
    const [, ns] = process.hrtime();
    const outputPath = path.join(
      tmpDir,
      `stella-${Date.now()}-${ns}-${i}.${ext}`
    );
    fs.writeFileSync(outputPath, imageData);

    results.push({ imageData, mimeType, revisedPrompt, outputPath });
  }

  return results;
}
