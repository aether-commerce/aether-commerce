import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function nextBuildArguments(platform) {
  return platform === "win32" ? ["build", "--webpack"] : ["build"];
}

function run() {
  const require = createRequire(resolve(process.cwd(), "package.json"));
  const nextCli = require.resolve("next/dist/bin/next");
  const result = spawnSync(process.execPath, [nextCli, ...nextBuildArguments(process.platform)], {
    cwd: process.cwd(),
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
