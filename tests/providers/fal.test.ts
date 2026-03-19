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

  it("passes aspect_ratio 1:1 for text-to-image endpoint", async () => {
    mockSubscribe.mockResolvedValue(
      makeFalResponse(["https://example.com/img.jpg"])
    );

    const { generateWithFal } = await getModule();
    await generateWithFal({
      prompt: "test",
      referenceImageUrls: [],
      resolution: "1K",
      count: 1,
    });

    const input = mockSubscribe.mock.calls[0][1].input;
    expect(input.aspect_ratio).toBe("1:1");
    expect(input.image_size).toBeUndefined();
  });

  it("does not pass resolution parameters for image editing endpoint", async () => {
    mockSubscribe.mockResolvedValue(
      makeFalResponse(["https://example.com/edited.jpg"])
    );

    const { generateWithFal } = await getModule();
    await generateWithFal({
      prompt: "wearing a red dress",
      referenceImageUrls: ["https://example.com/ref1.jpg"],
      resolution: "2K",
      count: 1,
    });

    const input = mockSubscribe.mock.calls[0][1].input;
    expect(input.image_size).toBeUndefined();
    expect(input.aspect_ratio).toBeUndefined();
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
    ).rejects.toMatchObject({
      name: "StellaError",
      details: expect.objectContaining({
        code: "NO_OUTPUT",
      }),
    });
  });

  it("retries transient fal request errors", async () => {
    const transientErr = {
      status: 503,
      error_type: "runner_connection_timeout",
      message: "runner timeout",
    };
    mockSubscribe
      .mockRejectedValueOnce(transientErr)
      .mockRejectedValueOnce(transientErr)
      .mockResolvedValue(makeFalResponse(["https://example.com/img.jpg"]));

    const { generateWithFal } = await getModule();
    const results = await generateWithFal({
      prompt: "test",
      referenceImageUrls: [],
      resolution: "1K",
      count: 1,
    });

    expect(results).toHaveLength(1);
    expect(mockSubscribe).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-retryable 422 policy errors", async () => {
    const policyErr = {
      status: 422,
      detail: [
        {
          type: "content_policy_violation",
          msg: "blocked",
        },
      ],
      message: "blocked by content policy",
    };
    mockSubscribe.mockRejectedValue(policyErr);

    const { generateWithFal } = await getModule();
    await expect(
      generateWithFal({
        prompt: "test",
        referenceImageUrls: [],
        resolution: "1K",
        count: 1,
      })
    ).rejects.toMatchObject({
      name: "StellaError",
      details: expect.objectContaining({
        code: "SAFETY_BLOCKED",
        retryable: false,
      }),
    });
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });
});
