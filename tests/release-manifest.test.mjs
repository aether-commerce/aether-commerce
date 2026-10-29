import assert from "node:assert/strict";
import test from "node:test";
import { collectClientMigrations, shouldVerifyWorkspaceTarball } from "../scripts/create-release-manifest.mjs";
import { createReleaseDispatchPayload } from "../scripts/create-release-dispatch.mjs";
import { createReleaseManifest, serializeReleaseManifest, sha256, validateReleaseManifest } from "../scripts/release-manifest.mjs";

const baseInput = {
  repository: "aether-commerce/aether-commerce",
  sha: "a".repeat(40),
  createdAt: "2026-10-14T08:00:00+00:00",
  packages: [
    {
      name: "@aether-commerce/api-worker",
      version: "1.2.3",
      registry: "https://npm.pkg.github.com",
      integrity: "sha512-dGVzdA==",
      tarball: "https://npm.pkg.github.com/download/@aether-commerce/api-worker/1.2.3/abc",
      tag: "@aether-commerce/api-worker@1.2.3",
      changedInRelease: true
    }
  ],
  migrations: {
    manifestSha256: "b".repeat(64),
    files: [
      {
        path: "packages/migrations/migrations/0001_initial.sql",
        sha256: "c".repeat(64)
      }
    ]
  }
};

test("release manifest v1 is deterministic and sorts package/migration entries", () => {
  const manifest = createReleaseManifest({
    ...baseInput,
    packages: [
      ...baseInput.packages,
      {
        name: "@aether-commerce/core",
        version: "0.4.0",
        registry: "https://npm.pkg.github.com",
        integrity: "sha512-dGVzdA==",
        tarball: "https://npm.pkg.github.com/download/@aether-commerce/core/0.4.0/def",
        tag: "@aether-commerce/core@0.4.0",
        changedInRelease: false
      }
    ]
  });

  assert.equal(manifest.schemaVersion, "release-manifest.v1");
  assert.equal(manifest.clientContractVersion, 1);
  assert.equal(manifest.releaseTag, `aether-release-${baseInput.sha}`);
  assert.deepEqual(manifest.packages.map((entry) => entry.name), [
    "@aether-commerce/api-worker",
    "@aether-commerce/core"
  ]);
  assert.deepEqual(validateReleaseManifest(manifest), []);
  assert.equal(serializeReleaseManifest(manifest), serializeReleaseManifest(manifest));
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("release manifest rejects stale, duplicated, or unverifiable release inputs", () => {
  const manifest = createReleaseManifest(baseInput);
  manifest.source.sha = "short";
  manifest.packages.push({ ...manifest.packages[0] });
  manifest.packages[0].integrity = "";
  manifest.migrations.files[0].sha256 = "bad";

  const errors = validateReleaseManifest(manifest);
  assert.ok(errors.includes("source.sha must be a full commit SHA"));
  assert.ok(errors.includes("duplicate package: @aether-commerce/api-worker"));
  assert.ok(errors.includes("missing or invalid tarball integrity: @aether-commerce/api-worker"));
  assert.ok(errors.includes("invalid migration digest: packages/migrations/migrations/0001_initial.sql"));
});

test("release manifest carries unchanged public packages in the exact snapshot without inventing missing tags", () => {
  const manifest = createReleaseManifest({
    ...baseInput,
    packages: [
      { ...baseInput.packages[0], tag: null, changedInRelease: false },
      {
        name: "@aether-commerce/core",
        version: "0.4.0",
        registry: "https://npm.pkg.github.com",
        integrity: "sha512-dGVzdA==",
        tarball: "https://npm.pkg.github.com/download/@aether-commerce/core/0.4.0/def",
        tag: null,
        changedInRelease: false
      }
    ]
  });

  assert.equal(manifest.packages[0].version, "1.2.3");
  assert.equal(manifest.packages[0].changedInRelease, false);
  assert.equal(manifest.packages[0].tag, null);
  assert.deepEqual(validateReleaseManifest(manifest), []);
});

test("release manifest rejects a changed package whose version tag is missing", () => {
  assert.throws(() => createReleaseManifest({
    ...baseInput,
    packages: [{ ...baseInput.packages[0], tag: null, changedInRelease: true }]
  }), /newly released package must have its release tag/);
});

test("workspace tarball comparison also runs during manifest recovery", () => {
  assert.equal(shouldVerifyWorkspaceTarball(true), true);
  assert.equal(shouldVerifyWorkspaceTarball(false), false);
  assert.equal(shouldVerifyWorkspaceTarball(true, true), true);
});

test("client migration snapshot hashes the exact published migration set", () => {
  const snapshot = collectClientMigrations("HEAD");
  assert.ok(snapshot.files.length > 0);
  assert.equal(new Set(snapshot.files.map((migration) => migration.path)).size, snapshot.files.length);
  assert.match(snapshot.manifestSha256, /^[0-9a-f]{64}$/);
  assert.ok(snapshot.files.every((migration) => /^[0-9a-f]{64}$/.test(migration.sha256)));
});

test("v1 client dispatch carries the digest-verified manifest and exact source", () => {
  const manifest = createReleaseManifest(baseInput);
  const manifestJson = serializeReleaseManifest(manifest);
  const payload = createReleaseDispatchPayload({
    manifestJson,
    expectedManifestSha256: sha256(manifestJson),
    releaseSha: baseInput.sha,
    sourceRepository: baseInput.repository,
    manifestTag: manifest.releaseTag,
    manifestUrl: `https://github.com/${baseInput.repository}/releases/download/${manifest.releaseTag}/release-manifest.v1.json`
  });

  assert.equal(payload.event_type, "aether-release-v1");
  assert.equal(payload.client_payload.manifest_json, manifestJson);
  assert.equal(payload.client_payload.manifest_sha256, sha256(manifestJson));
});

test("v1 client dispatch rejects a different digest, source, tag, or an oversized manifest", () => {
  const manifest = createReleaseManifest(baseInput);
  const manifestJson = serializeReleaseManifest(manifest);
  const input = {
    manifestJson,
    expectedManifestSha256: sha256(manifestJson),
    releaseSha: baseInput.sha,
    sourceRepository: baseInput.repository,
    manifestTag: manifest.releaseTag,
    manifestUrl: "https://github.com/aether-commerce/aether-commerce/releases"
  };
  assert.throws(() => createReleaseDispatchPayload({ ...input, expectedManifestSha256: "0".repeat(64) }), /digest does not match/);
  assert.throws(() => createReleaseDispatchPayload({ ...input, sourceRepository: "other/repository" }), /source does not match/);
  assert.throws(() => createReleaseDispatchPayload({ ...input, manifestTag: "wrong-tag" }), /tag does not match/);

  const oversizedManifestJson = JSON.stringify({ ...manifest, padding: "x".repeat(65_000) });
  assert.throws(
    () => createReleaseDispatchPayload({ ...input, manifestJson: oversizedManifestJson, expectedManifestSha256: sha256(oversizedManifestJson) }),
    /exceeds the 65536-byte repository_dispatch limit/
  );
});
