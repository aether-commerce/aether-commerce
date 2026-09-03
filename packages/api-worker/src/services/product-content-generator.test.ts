import type { AIMessage } from "@langchain/core/messages";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../types";
import { generateProductContent } from "./product-content-generator";
import type * as AiProviderModule from "./ai-provider";
import { resolveChatModelChain } from "./ai-provider";

vi.mock("./ai-provider", async (importOriginal) => {
  const original = await importOriginal<typeof AiProviderModule>();
  return { ...original, resolveChatModelChain: vi.fn() };
});

const generated = {
  category: "Audio",
  subcategory: "Audífonos inalámbricos",
  shortDescription: "Audio cómodo para todos los días.",
  tags: ["audio", "inalámbrico", "audio"],
  highlights: ["Diseño cómodo", "Diseño cómodo"],
  seoTitle: "Audífonos inalámbricos cómodos",
  seoDescription: "Descubre audífonos inalámbricos cómodos para escuchar música cada día."
};

function fakeModel(result: unknown, error?: Error) {
  return {
    withStructuredOutput: vi.fn(() => ({
      invoke: vi.fn((messages: AIMessage[]) =>
        error ? Promise.reject(error) : Promise.resolve(result ?? messages)
      )
    }))
  };
}

describe("generateProductContent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when Gemini is not configured", async () => {
    vi.mocked(resolveChatModelChain).mockResolvedValue(null);
    await expect(
      generateProductContent(
        {} as Env,
        { name: "Headphones", description: "Wireless over-ear headphones.", locale: "en" },
        []
      )
    ).resolves.toBeNull();
  });

  it("normalizes the selected category to its canonical slug and removes duplicate copy", async () => {
    vi.mocked(resolveChatModelChain).mockResolvedValue([fakeModel(generated) as never]);

    const result = await generateProductContent(
      {} as Env,
      {
        name: "Audífonos",
        description: "Audífonos inalámbricos cómodos para música diaria.",
        locale: "es"
      },
      [{ slug: "audio", name: "Audio" }]
    );

    expect(result).toMatchObject({
      category: "audio",
      tags: ["audio", "inalámbrico"],
      highlights: ["Diseño cómodo"]
    });
  });

  it("falls through to the next configured model only for quota errors", async () => {
    vi.mocked(resolveChatModelChain).mockResolvedValue([
      fakeModel(null, Object.assign(new Error("quota exceeded"), { status: 429 })) as never,
      fakeModel({ ...generated, category: "audio" }) as never
    ]);

    await expect(
      generateProductContent(
        {} as Env,
        { name: "Audífonos", description: "Audífonos inalámbricos cómodos.", locale: "es" },
        [{ slug: "audio", name: "Audio" }]
      )
    ).resolves.toMatchObject({ category: "audio" });
  });
});
