import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const TARGETS = Object.freeze({
  storefront: {
    service: "aether-storefront",
    relativePath: "apps/storefront/.open-next/assets/build-info.json"
  },
  admin: {
    service: "aether-admin",
    relativePath: "apps/admin/out/build-info.json"
  }
});

const SHA_PATTERN = /^[0-9a-f]{40}$/i;

export function createDeployBuildInfo(service, environment, revision) {
  const target = TARGETS[service];
  if (!target) throw new Error(`Unknown deployment service: ${service}`);
  if (environment !== "development" && environment !== "production") {
    throw new Error("AETHER_DEPLOY_ENV must be development or production.");
  }
  if (!SHA_PATTERN.test(revision ?? "")) {
    throw new Error("DEPLOYED_COMMIT_SHA must be a full 40-character commit SHA.");
  }

  return {
    schemaVersion: 1,
    service: target.service,
    environment,
    revision: revision.toLowerCase()
  };
}

export function writeDeployBuildInfo(
  service,
  {
    root = process.cwd(),
    environment = process.env.AETHER_DEPLOY_ENV,
    revision = process.env.DEPLOYED_COMMIT_SHA
  } = {}
) {
  const info = createDeployBuildInfo(service, environment, revision);
  const target = TARGETS[service];
  const rootPath = resolve(root);
  const outputPath = resolve(rootPath, target.relativePath);
  if (!outputPath.startsWith(`${rootPath}${sep}`)) {
    throw new Error("Build metadata output must stay inside the repository.");
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(info, null, 2)}\n`, "utf8");
  return { ...info, path: outputPath };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = writeDeployBuildInfo(process.argv[2]);
    console.log(`Wrote ${result.service} deployment metadata for ${result.revision}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
