import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [15_000, 30_000];

export function isRetryableCloudflareFailure(output) {
  const responses = [...output.matchAll(/(?:->|HTTP(?:\/\d(?:\.\d)?)?|status(?: code)?)\s*:?\s*(\d{3})\b/gi)];
  if (responses.length > 0) {
    return [502, 503, 504].includes(Number(responses.at(-1)[1]));
  }
  return /\b(?:502 Bad Gateway|503 Service Unavailable|504 Gateway Time-?out)\b/i.test(output);
}

export async function retryCloudflareCommand(run, { wait = sleep, log = console.error } = {}) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const { exitCode, output } = await run();
    if (exitCode === 0) return 0;
    if (!isRetryableCloudflareFailure(output) || attempt === MAX_ATTEMPTS) return exitCode;

    const delayMs = RETRY_DELAYS_MS[attempt - 1];
    log(`Cloudflare API returned a gateway error. Retrying ${attempt + 1}/${MAX_ATTEMPTS} in ${delayMs / 1000}s.`);
    await wait(delayMs);
  }
  return 1;
}

function runCommand(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { stdio: ["inherit", "pipe", "pipe"] });
    let output = "";
    const relay = (stream, destination) => {
      stream.on("data", (chunk) => {
        destination.write(chunk);
        output = (output + chunk.toString()).slice(-64_000);
      });
    };
    relay(child.stdout, process.stdout);
    relay(child.stderr, process.stderr);
    child.once("error", (error) => {
      console.error(error.message);
      resolveRun({ exitCode: 1, output: error.message });
    });
    child.once("close", (code) => resolveRun({ exitCode: code ?? 1, output }));
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [command, ...args] = process.argv.slice(2);
  if (!command) {
    console.error("Usage: node scripts/retry-cloudflare-command.mjs <command> [args...]");
    process.exitCode = 2;
  } else {
    process.exitCode = await retryCloudflareCommand(() => runCommand(command, args));
  }
}
