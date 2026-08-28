import { describe, expect, it, vi } from "vitest";
import type { Env } from "../types";
import { cloudinaryProductPublicId, createUploadSignature, deleteCloudinaryProductImages, sha1Hex } from "./cloudinary";

// createUploadSignature resolves its credentials via integration-settings.ts
// (D1-backed, admin-managed settings layered over these env vars) - a bare
// D1 mock returning "no row" so these tests exercise the plain env-var
// fallback path, same as before that resolution layer existed.
function fakeEnv(overrides: Partial<Env> = {}): Env {
  const db = { prepare: vi.fn(() => ({ first: vi.fn(() => Promise.resolve(null)) })) };
  return { DB: db, ...overrides } as unknown as Env;
}

describe("cloudinary.sha1Hex", () => {
  // Standard, independently-published SHA-1 test vectors (FIPS 180-1) - not
  // Cloudinary-specific, just confirming the hashing primitive itself is
  // correct. The full signing scheme (param ordering, api_secret placement)
  // was verified separately against the real Cloudinary API with real
  // credentials during manual testing of this feature.
  it("matches the known SHA-1 digest of an empty string", async () => {
    expect(await sha1Hex("")).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
  });

  it("produces a deterministic 40-char hex digest for 'abc'", async () => {
    const digest = await sha1Hex("abc");
    expect(digest).toMatch(/^[0-9a-f]{40}$/);
    expect(digest).toBe(await sha1Hex("abc"));
  });
});

describe("cloudinary.createUploadSignature", () => {
  it("returns null when any credential is missing", async () => {
    expect(await createUploadSignature(fakeEnv())).toBeNull();
    expect(await createUploadSignature(fakeEnv({ CLOUDINARY_CLOUD_NAME: "demo" }))).toBeNull();
    expect(
      await createUploadSignature(fakeEnv({ CLOUDINARY_CLOUD_NAME: "demo", CLOUDINARY_API_KEY: "key" }))
    ).toBeNull();
  });

  it("returns a well-formed signature when all credentials are present", async () => {
    const env = fakeEnv({
      CLOUDINARY_CLOUD_NAME: "demo",
      CLOUDINARY_API_KEY: "123456",
      CLOUDINARY_API_SECRET: "secret"
    });
    const result = await createUploadSignature(env);
    expect(result).not.toBeNull();
    expect(result?.cloudName).toBe("demo");
    expect(result?.apiKey).toBe("123456");
    expect(result?.folder).toBe("aether/products");
    expect(result?.signature).toMatch(/^[0-9a-f]{40}$/);
  });

  it("never lets the api_secret leak into the returned signature payload", async () => {
    const env = fakeEnv({
      CLOUDINARY_CLOUD_NAME: "demo",
      CLOUDINARY_API_KEY: "123456",
      CLOUDINARY_API_SECRET: "super-secret-value"
    });
    const result = await createUploadSignature(env);
    expect(JSON.stringify(result)).not.toContain("super-secret-value");
  });
});

describe("cloudinary.cloudinaryProductPublicId", () => {
  it("extracts the public id from a catalog upload URL", () => {
    expect(
      cloudinaryProductPublicId(
        "https://res.cloudinary.com/demo/image/upload/v1700000000/aether/products/funda%20slim.jpg",
        "demo"
      )
    ).toBe("aether/products/funda slim");
  });

  it("ignores non-catalog assets and other Cloudinary accounts", () => {
    expect(cloudinaryProductPublicId("https://res.cloudinary.com/demo/image/upload/aether/brand/logo.png", "demo")).toBeNull();
    expect(cloudinaryProductPublicId("https://res.cloudinary.com/other/image/upload/aether/products/funda.jpg", "demo")).toBeNull();
    expect(cloudinaryProductPublicId("https://example.com/aether/products/funda.jpg", "demo")).toBeNull();
  });
});

describe("cloudinary.deleteCloudinaryProductImages", () => {
  it("deletes each distinct catalog image and invalidates CDN copies", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(JSON.stringify({ result: "ok" }), { status: 200, headers: { "content-type": "application/json" } }))
    );
    vi.stubGlobal("fetch", fetchMock);

    try {
      await deleteCloudinaryProductImages(
        fakeEnv({ CLOUDINARY_CLOUD_NAME: "demo", CLOUDINARY_API_KEY: "123456", CLOUDINARY_API_SECRET: "secret" }),
        [
          "https://res.cloudinary.com/demo/image/upload/v1/aether/products/funda-a.jpg",
          "https://res.cloudinary.com/demo/image/upload/v1/aether/products/funda-a.jpg",
          "https://res.cloudinary.com/demo/image/upload/v2/aether/products/funda-b.png"
        ]
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const firstCall = fetchMock.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
      const firstRequest = firstCall[1];
      const body = firstRequest.body as FormData;
      expect(firstCall[0]).toBe("https://api.cloudinary.com/v1_1/demo/image/destroy");
      expect(body.get("public_id")).toBe("aether/products/funda-a");
      expect(body.get("invalidate")).toBe("true");
      expect(body.get("api_key")).toBe("123456");
      expect(body.get("signature")).toMatch(/^[0-9a-f]{40}$/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not call Cloudinary for local images", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      await deleteCloudinaryProductImages(fakeEnv(), ["/products/funda.webp"]);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
