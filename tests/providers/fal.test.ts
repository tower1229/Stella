import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSubscribe = vi.fn();

vi.mock("@fal-ai/client", () => ({
  fal: {
    config: vi.fn(),
    subscribe: mockSubscribe,
  },
}));

async function getModule() {
  const mod = await import("../../scripts/providers/fal");
  return mod;
}

function makeFalResponse(imageUrls: string[], revisedPrompt?: string) {
  return {
    data: {
      images: imageUrls.map((url) => ({
        url,
        content_type: "image/jpeg",
        width: 1024,
        height: 1024,
      })),
      revised_prompt: revisedPrompt,
    },
  };
}

describe("generateWithFal", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.FAL_KEY = "test-fal-key";
  });

  it("throws if FAL_KEY is not set", async () => {
    delete process.env.FAL_KEY;
    const { generateWithFal } = await getModule();
    await expect(
      generateWithFal({
        prompt: "test",
        referenceImageUrls: [],
        resolution: "1K",
        count: 1,
      })
    ).rejects.toThrow("FAL_KEY");
  });

  it("uses text-to-image endpoint when no reference images", async () => {
    mockSubscribe.mockResolvedValue(
      makeFalResponse(["https://example.com/img.jpg"])
    );

    const { generateWithFal } = await getModule();
    await generateWithFal({
      prompt: "a selfie",
      referenceImageUrls: [],
      resolution: "1K",
      count: 1,
    });

    expect(mockSubscribe).toHaveBeenCalledWith(
      "xai/grok-imagine-image",
      expect.objectContaining({
        input: expect.objectContaining({ prompt: "a selfie" }),
      })
    );
    // Should NOT include image_urls
    const input = mockSubscribe.mock.calls[0][1].input;
    expect(input.image_urls).toBeUndefined();
  });

  it("uses image editing endpoint when reference images are provided", async () => {
    mockSubscribe.mockResolvedValue(
      makeFalResponse(["https://example.com/edited.jpg"])
    );

    const { generateWithFal } = await getModule();
    await generateWithFal({
      prompt: "wearing a red dress",
      referenceImageUrls: [
        "https://example.com/ref1.jpg",
        "https://example.com/ref2.jpg",
      ],
      resolution: "1K",
      count: 1,
    });

    expect(mockSubscribe).toHaveBeenCalledWith(
      "xai/grok-imagine-image/edit",
      expect.objectContaining({
        input: expect.objectContaining({
          image_urls: [
            "https://example.com/ref1.jpg",
            "https://example.com/ref2.jpg",
          ],
        }),
      })
    );
  });

  it("passes num_images and output_format correctly", async () => {
    mockSubscribe.mockResolvedValue(
      makeFalResponse([
        "https://example.com/img1.jpg",
        "https://example.com/img2.jpg",
      ])
    );

    const { generateWithFal } = await getModule();
    await generateWithFal({
      prompt: "test",
      referenceImageUrls: [],
      resolution: "1K",
      count: 2,
    });

    const input = mockSubscribe.mock.calls[0][1].input;
    expect(input.num_images).toBe(2);
    expect(input.output_format).toBe("jpeg");
  });

  it("returns array of results with imageUrl", async () => {
    mockSubscribe.mockResolvedValue(
      makeFalResponse(
        ["https://example.com/img.jpg"],
        "Enhanced prompt"
      )
    );

    const { generateWithFal } = await getModule();
    const results = await generateWithFal({
      prompt: "test",
      referenceImageUrls: [],
      resolution: "1K",
      count: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0].imageUrl).toBe("https://example.com/img.jpg");
    expect(results[0].revisedPrompt).toBe("Enhanced prompt");
  });

  it("throws if fal returns no images", async () => {
    mockSubscribe.mockResolvedValue({ data: { images: [] } });

    const { generateWithFal } = await getModule();
    await expect(
      generateWithFal({
        prompt: "test",
        referenceImageUrls: [],
        resolution: "1K",
        count: 1,
      })
    ).rejects.toThrow("no images");
  });
});
