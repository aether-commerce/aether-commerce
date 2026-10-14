import { createHash } from "node:crypto";

const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const INTEGRITY_PATTERN = /^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}$/;

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function createReleaseManifest(input) {
  const packages = [...input.packages]
    .map((entry) => ({
      name: entry.name,
      version: entry.version,
      registry: entry.registry,
      integrity: entry.integrity,
      tarball: entry.tarball,
      tag: entry.tag
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const migrations = {
    manifestSha256: input.migrations.manifestSha256,
    files: [...input.migrations.files]
      .map((entry) => ({ path: entry.path, sha256: entry.sha256 }))
      .sort((left, right) => left.path.localeCompare(right.path))
  };

  const manifest = {
    schemaVersion: "release-manifest.v1",
    source: {
      repository: input.repository,
      branch: "main",
      sha: input.sha
    },
    createdAt: input.createdAt,
    clientContractVersion: 1,
    releaseTag: `aether-release-${input.sha}`,
    packages,
    migrations
  };
  const errors = validateReleaseManifest(manifest);
  if (errors.length) throw new Error(`Invalid release manifest: ${errors.join("; ")}`);
  return manifest;
}

export function validateReleaseManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object") return ["manifest must be an object"];
  if (manifest.schemaVersion !== "release-manifest.v1") errors.push("unsupported schemaVersion");
  if (!manifest.source || !/^[^/]+\/[^/]+$/.test(manifest.source.repository ?? "")) {
    errors.push("source.repository must be owner/repository");
  }
  if (manifest.source?.branch !== "main") errors.push("source.branch must be main");
  if (!SHA_PATTERN.test(manifest.source?.sha ?? "")) errors.push("source.sha must be a full commit SHA");
  if (!ISO_DATE_PATTERN.test(manifest.createdAt ?? "") || !Number.isFinite(Date.parse(manifest.createdAt))) {
    errors.push("createdAt must be an ISO date");
  }
  if (manifest.clientContractVersion !== 1) errors.push("clientContractVersion must be 1");
  if (manifest.releaseTag !== `aether-release-${manifest.source?.sha}`) errors.push("releaseTag must match source.sha");

  if (!Array.isArray(manifest.packages) || manifest.packages.length === 0) {
    errors.push("packages must contain at least one released package");
  } else {
    const names = new Set();
    const tags = new Set();
    for (const pkg of manifest.packages) {
      if (!pkg || typeof pkg !== "object") {
        errors.push("each package entry must be an object");
        continue;
      }
      if (!/^@aether-commerce\/[a-z0-9][a-z0-9._-]*$/.test(pkg.name ?? "")) errors.push(`invalid package name: ${pkg.name}`);
      if (names.has(pkg.name)) errors.push(`duplicate package: ${pkg.name}`);
      names.add(pkg.name);
      if (!SEMVER_PATTERN.test(pkg.version ?? "")) errors.push(`invalid package version: ${pkg.name}`);
      if (pkg.registry !== "https://npm.pkg.github.com") errors.push(`unexpected package registry: ${pkg.name}`);
      if (!INTEGRITY_PATTERN.test(pkg.integrity ?? "")) errors.push(`missing or invalid tarball integrity: ${pkg.name}`);
      try {
        const tarball = new URL(pkg.tarball);
        if (tarball.protocol !== "https:" || tarball.hostname !== "npm.pkg.github.com") {
          errors.push(`unexpected tarball URL: ${pkg.name}`);
        }
      } catch {
        errors.push(`invalid tarball URL: ${pkg.name}`);
      }
      const expectedTag = `${pkg.name}@${pkg.version}`;
      if (pkg.tag !== expectedTag) errors.push(`tag does not match package version: ${pkg.name}`);
      if (tags.has(pkg.tag)) errors.push(`duplicate package tag: ${pkg.tag}`);
      tags.add(pkg.tag);
    }
  }

  if (!manifest.migrations || !/^[0-9a-f]{64}$/.test(manifest.migrations.manifestSha256 ?? "")) {
    errors.push("migrations.manifestSha256 must be a SHA-256 digest");
  }
  if (!Array.isArray(manifest.migrations?.files)) {
    errors.push("migrations.files must be an array");
  } else {
    const paths = new Set();
    for (const migration of manifest.migrations.files) {
      if (!migration || !/^packages\/migrations\/migrations\/\d{4}_[a-z0-9_]+\.sql$/.test(migration.path ?? "")) {
        errors.push(`invalid migration path: ${migration?.path}`);
      }
      if (paths.has(migration.path)) errors.push(`duplicate migration: ${migration.path}`);
      paths.add(migration.path);
      if (!/^[0-9a-f]{64}$/.test(migration.sha256 ?? "")) errors.push(`invalid migration digest: ${migration.path}`);
    }
  }
  return errors;
}

export function serializeReleaseManifest(manifest) {
  const errors = validateReleaseManifest(manifest);
  if (errors.length) throw new Error(`Invalid release manifest: ${errors.join("; ")}`);
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
