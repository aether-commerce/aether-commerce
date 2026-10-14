import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sha256, validateReleaseManifest } from "./release-manifest.mjs";

const MAX_DISPATCH_BYTES = 64 * 1024;

export function createReleaseDispatchPayload(input) {
  const manifestSha256 = sha256(input.manifestJson);
  if (manifestSha256 !== input.expectedManifestSha256) {
    throw new Error("Release manifest digest does not match the dispatch input.");
  }
  let manifest;
  try {
    manifest = JSON.parse(input.manifestJson);
  } catch {
    throw new Error("Release manifest is not valid JSON.");
  }
  const errors = validateReleaseManifest(manifest);
  if (errors.length) throw new Error(`Release manifest is invalid: ${errors.join("; ")}`);
  if (manifest.source.repository !== input.sourceRepository || manifest.source.sha !== input.releaseSha) {
    throw new Error("Release manifest source does not match the dispatch source.");
  }
  if (manifest.releaseTag !== input.manifestTag) {
    throw new Error("Release manifest tag does not match the dispatch tag.");
  }

  const payload = {
    event_type: "aether-release-v1",
    client_payload: {
      release_sha: input.releaseSha,
      source_repository: input.sourceRepository,
      manifest_tag: input.manifestTag,
      manifest_sha256: manifestSha256,
      manifest_url: input.manifestUrl,
      manifest_json: input.manifestJson
    }
  };
  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > MAX_DISPATCH_BYTES) {
    throw new Error(`Release manifest exceeds the ${MAX_DISPATCH_BYTES}-byte repository_dispatch limit.`);
  }
  return payload;
}

function run() {
  const input = {
    manifestJson: readFileSync(process.env.RELEASE_MANIFEST_PATH, "utf8"),
    expectedManifestSha256: process.env.RELEASE_MANIFEST_SHA256,
    releaseSha: process.env.RELEASE_SHA,
    sourceRepository: process.env.GITHUB_REPOSITORY,
    manifestTag: process.env.RELEASE_MANIFEST_TAG,
    manifestUrl: process.env.RELEASE_MANIFEST_URL
  };
  const payload = createReleaseDispatchPayload(input);
  const output = process.env.DISPATCH_PAYLOAD_PATH || resolve(dirname(fileURLToPath(import.meta.url)), "release-dispatch.json");
  writeFileSync(output, `${JSON.stringify(payload)}\n`, { flag: "wx" });
  console.log(`Prepared verified ${payload.event_type} payload (${Buffer.byteLength(JSON.stringify(payload))} bytes).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run();
  } catch (error) {
    console.error(`::error::Unable to prepare release dispatch: ${error.message}`);
    process.exitCode = 1;
  }
}
