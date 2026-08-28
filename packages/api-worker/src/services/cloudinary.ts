import type { Env } from "../types";
import { resolveIntegrationSecrets } from "./integration-settings";

// Cloudinary's signed-upload algorithm: sort every param that will be sent
// to the upload API (except file/api_key/signature themselves) alphabetically
// by key, join as "key=value&key=value", append the api_secret directly (no
// separator), then SHA-1 hex-encode the result. Cloudinary recomputes this
// same string server-side and rejects the upload if it doesn't match - the
// secret itself never has to leave this Worker.
// https://cloudinary.com/documentation/authentication_signatures
export async function sha1Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type CloudinaryUploadSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
};

type CloudinaryCredentials = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

function signatureParams(params: Record<string, string | number | boolean>) {
  return Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

async function cloudinaryCredentials(env: Env): Promise<CloudinaryCredentials | null> {
  const { cloudinary } = await resolveIntegrationSecrets(env);
  if (!cloudinary.cloudName || !cloudinary.apiKey || !cloudinary.apiSecret) return null;
  return {
    cloudName: cloudinary.cloudName,
    apiKey: cloudinary.apiKey,
    apiSecret: cloudinary.apiSecret
  };
}

export async function createUploadSignature(env: Env): Promise<CloudinaryUploadSignature | null> {
  const cloudinary = await cloudinaryCredentials(env);
  if (!cloudinary) return null;

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "aether/products";
  const signature = await sha1Hex(`${signatureParams({ folder, timestamp })}${cloudinary.apiSecret}`);

  return {
    cloudName: cloudinary.cloudName,
    apiKey: cloudinary.apiKey,
    timestamp,
    folder,
    signature
  };
}

/**
 * Extracts only assets uploaded by the product form. We deliberately reject
 * other Cloudinary folders so deleting a product cannot delete a pasted URL
 * belonging to a different part of the store or another application.
 */
export function cloudinaryProductPublicId(imageUrl: string, cloudName: string): string | null {
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") return null;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 5 || segments[0] !== cloudName || segments[1] !== "image" || segments[2] !== "upload") return null;

  const deliverySegments = segments.slice(3);
  const versionIndex = deliverySegments.findIndex((segment) => /^v\d+$/.test(segment));
  const publicIdSegments = versionIndex >= 0 ? deliverySegments.slice(versionIndex + 1) : deliverySegments;
  if (publicIdSegments.length === 0) return null;

  let publicId: string;
  try {
    publicId = decodeURIComponent(publicIdSegments.join("/"));
  } catch {
    return null;
  }

  if (!publicId.startsWith("aether/products/") || publicId === "aether/products/") return null;
  return publicId.replace(/\.[^/.]+$/, "");
}

/** Permanently removes product images from Cloudinary and invalidates CDN copies. */
export async function deleteCloudinaryProductImages(env: Env, imageUrls: string[]): Promise<void> {
  const cloudinary = await cloudinaryCredentials(env);
  if (!cloudinary) {
    if (imageUrls.some((imageUrl) => /https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:v\d+\/)?aether\/products\//i.test(imageUrl))) {
      throw new Error("Cloudinary is not configured for product image deletion.");
    }
    return;
  }

  const publicIds = [...new Set(imageUrls.map((imageUrl) => cloudinaryProductPublicId(imageUrl, cloudinary.cloudName)).filter((publicId): publicId is string => Boolean(publicId)))];
  for (const publicId of publicIds) {
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { invalidate: true, public_id: publicId, timestamp };
    const signature = await sha1Hex(`${signatureParams(params)}${cloudinary.apiSecret}`);
    const body = new FormData();
    body.set("public_id", publicId);
    body.set("timestamp", String(timestamp));
    body.set("invalidate", "true");
    body.set("api_key", cloudinary.apiKey);
    body.set("signature", signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudinary.cloudName)}/image/destroy`, {
      method: "POST",
      body
    });
    const payload = (await response.json().catch(() => null)) as { result?: string; error?: { message?: string } } | null;
    if (!response.ok || (payload?.result !== "ok" && payload?.result !== "not found")) {
      throw new Error(payload?.error?.message ?? `Cloudinary could not delete product image ${publicId}.`);
    }
  }
}
