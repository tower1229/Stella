import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";

vi.mock("fs");
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn(),
    },
  })),
}));

const mockFs = vi.mocked(fs);

async function getModule() {
  const mod = await import("../../scripts/providers/gemini");
  return mod;
}

function makeImagePart(base64Data: string, mimeType = "image/png") {
  return {
    inlineData: { data: base64Data, mimeType },
  };
}

function makeTextPart(text: string) {
  return { text };
}

function makeGeminiResponse(parts: object[], revisedText?: string) {
  const allParts = revisedText
    ? [...parts, makeTextPart(revisedText)]
    : parts;
  return {
    candidates: [
      {
        content: { parts: allParts },
      },
    ],
  };
}

describe("generateWithGemini", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("throws if GEMINI_API_KEY is not set", async () => {
    delete process.env.GEMINI_API_KEY;
    const { generateWithGemini } = await getModule();
    await expect(
      generateWithGemini({
        prompt: "test",
        referenceImages: [],
        resolution: "1K",
        count: 1,
      })
    ).rejects.toThrow("GEMINI_API_KEY");
  });

  it("generates a single image in text-to-image mode (no refs)", async () => {
    const fakeImageData = Buffer.from("fake-image-data").toString("base64");

    const { GoogleGenAI } = await import("@google/genai");
    const mockGenerateContent = vi.fn().mockResolvedValue(
      makeGeminiResponse([makeImagePart(fakeImageData)])
    );
    vi.mocked(GoogleGenAI).mockImplementation(
      () =>
        ({
          models: { generateContent: mockGenerateContent },
        }) as any
    );

    mockFs.readFileSync.mockReturnValue(Buffer.from("fake-image-data"));
    mockFs.writeFileSync.mockImplementation(() => {});

    const { generateWithGemini } = await getModule();
    const results = await generateWithGemini({
      prompt: "a selfie at the beach",
      referenceImages: [],
      resolution: "1K",
      count: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0].mimeType).toBe("image/png");
    expect(results[0].imageData).toBeInstanceOf(Buffer);

    // Verify text-to-image: contents should be a single text part
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.contents).toEqual([{ text: "a selfie at the beach" }]);
  });

  it("uses image editing mode when reference images are provided", async () => {
    const fakeImageData = Buffer.from("fake-image-data").toString("base64");

    const { GoogleGenAI } = await import("@google/genai");
    const mockGenerateContent = vi.fn().mockResolvedValue(
      makeGeminiResponse([makeImagePart(fakeImageData)])
    );
    vi.mocked(GoogleGenAI).mockImplementation(
      () =>
        ({
          models: { generateContent: mockGenerateContent },
        }) as any
    );

    mockFs.readFileSync.mockReturnValue(Buffer.from("ref-image-bytes"));
    mockFs.writeFileSync.mockImplementation(() => {});

    const { generateWithGemini } = await getModule();
    await generateWithGemini({
      prompt: "wearing a red dress",
      referenceImages: ["/mock/avatar.jpg"],
      resolution: "2K",
      count: 1,
    });

    const callArgs = mockGenerateContent.mock.calls[0][0];
    // Image editing: contents has parts array with inlineData + text
    expect(callArgs.contents[0].parts).toBeDefined();
    const parts = callArgs.contents[0].parts;
    expect(parts.some((p: any) => p.inlineData)).toBe(true);
    expect(parts.some((p: any) => p.text === "wearing a red dress")).toBe(true);
  });

  it("maps resolution to imageConfig.imageSize", async () => {
    const fakeImageData = Buffer.from("x").toString("base64");

    const { GoogleGenAI } = await import("@google/genai");
    const mockGenerateContent = vi.fn().mockResolvedValue(
      makeGeminiResponse([makeImagePart(fakeImageData)])
    );
    vi.mocked(GoogleGenAI).mockImplementation(
      () =>
        ({
          models: { generateContent: mockGenerateContent },
        }) as any
    );

    mockFs.writeFileSync.mockImplementation(() => {});

    const { generateWithGemini } = await getModule();
    await generateWithGemini({
      prompt: "test",
      referenceImages: [],
      resolution: "4K",
      count: 1,
    });

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config.imageConfig.imageSize).toBe("4K");
  });

  it("throws if response contains no image data", async () => {
    const { GoogleGenAI } = await import("@google/genai");
    const mockGenerateContent = vi.fn().mockResolvedValue(
      makeGeminiResponse([makeTextPart("No image generated")])
    );
    vi.mocked(GoogleGenAI).mockImplementation(
      () =>
        ({
          models: { generateContent: mockGenerateContent },
        }) as any
    );

    const { generateWithGemini } = await getModule();
    await expect(
      generateWithGemini({
        prompt: "test",
        referenceImages: [],
        resolution: "1K",
        count: 1,
      })
    ).rejects.toThrow("no image data");
  });

  it("captures revisedPrompt from text part", async () => {
    const fakeImageData = Buffer.from("x").toString("base64");

    const { GoogleGenAI } = await import("@google/genai");
    const mockGenerateContent = vi.fn().mockResolvedValue(
      makeGeminiResponse([makeImagePart(fakeImageData)], "Enhanced prompt text")
    );
    vi.mocked(GoogleGenAI).mockImplementation(
      () =>
        ({
          models: { generateContent: mockGenerateContent },
        }) as any
    );

    mockFs.writeFileSync.mockImplementation(() => {});

    const { generateWithGemini } = await getModule();
    const results = await generateWithGemini({
      prompt: "test",
      referenceImages: [],
      resolution: "1K",
      count: 1,
    });

    expect(results[0].revisedPrompt).toBe("Enhanced prompt text");
  });

  it("retries on rate-limit style errors and succeeds", async () => {
    const fakeImageData = Buffer.from("x").toString("base64");
    const rateLimitedErr = Object.assign(new Error("RESOURCE_EXHAUSTED"), {
      status: 429,
    });

    const { GoogleGenAI } = await import("@google/genai");
    const mockGenerateContent = vi
      .fn()
      .mockRejectedValueOnce(rateLimitedErr)
      .mockRejectedValueOnce(rateLimitedErr)
      .mockResolvedValue(makeGeminiResponse([makeImagePart(fakeImageData)]));
    vi.mocked(GoogleGenAI).mockImplementation(
      () =>
        ({
          models: { generateContent: mockGenerateContent },
        }) as any
    );

    mockFs.writeFileSync.mockImplementation(() => {});

    const { generateWithGemini } = await getModule();
    const results = await generateWithGemini({
      prompt: "test",
      referenceImages: [],
      resolution: "1K",
      count: 1,
    });

    expect(results).toHaveLength(1);
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  });

  it("does not retry on permission errors", async () => {
    const permissionErr = Object.assign(new Error("PERMISSION_DENIED"), {
      status: 403,
    });
    const { GoogleGenAI } = await import("@google/genai");
    const mockGenerateContent = vi.fn().mockRejectedValue(permissionErr);
    vi.mocked(GoogleGenAI).mockImplementation(
      () =>
        ({
          models: { generateContent: mockGenerateContent },
        }) as any
    );

    const { generateWithGemini } = await getModule();
    await expect(
      generateWithGemini({
        prompt: "test",
        referenceImages: [],
        resolution: "1K",
        count: 1,
      })
    ).rejects.toMatchObject({
      name: "StellaError",
      details: expect.objectContaining({
        code: "PERMISSION_DENIED",
        retryable: false,
      }),
    });
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("maps safety blocks to structured policy errors", async () => {
    const safetyErr = Object.assign(new Error("finishReason=SAFETY"), {
      status: 400,
    });
    const { GoogleGenAI } = await import("@google/genai");
    const mockGenerateContent = vi.fn().mockRejectedValue(safetyErr);
    vi.mocked(GoogleGenAI).mockImplementation(
      () =>
        ({
          models: { generateContent: mockGenerateContent },
        }) as any
    );

    const { generateWithGemini } = await getModule();
    await expect(
      generateWithGemini({
        prompt: "test",
        referenceImages: [],
        resolution: "1K",
        count: 1,
      })
    ).rejects.toMatchObject({
      name: "StellaError",
      details: expect.objectContaining({
        code: "SAFETY_BLOCKED",
        category: "policy",
      }),
    });
  });

  it("retries on transient network errors without status", async () => {
    const fakeImageData = Buffer.from("x").toString("base64");
    const networkErr = new Error("fetch failed: ECONNRESET");
    const { GoogleGenAI } = await import("@google/genai");
    const mockGenerateContent = vi
      .fn()
      .mockRejectedValueOnce(networkErr)
      .mockResolvedValue(makeGeminiResponse([makeImagePart(fakeImageData)]));
    vi.mocked(GoogleGenAI).mockImplementation(
      () =>
        ({
          models: { generateContent: mockGenerateContent },
        }) as any
    );

    mockFs.writeFileSync.mockImplementation(() => {});

    const { generateWithGemini } = await getModule();
    const results = await generateWithGemini({
      prompt: "test",
      referenceImages: [],
      resolution: "1K",
      count: 1,
    });

    expect(results).toHaveLength(1);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });
});
