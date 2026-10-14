import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateCase } from "./assertions.mjs";

const baseUrl = process.env.AETHER_AI_EVAL_URL?.replace(/\/$/, "");
if (!baseUrl) throw new Error("AETHER_AI_EVAL_URL is required.");

const limitArg = process.argv.indexOf("--limit");
const requestedLimit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : 10;
const limit = Math.min(300, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 10));
const categoryArg = process.argv.indexOf("--category");
const category = categoryArg >= 0 ? process.argv[categoryArg + 1] : null;
const path = resolve("apps/ai-assistant/evaluation/cases.jsonl");
const allCases = readFileSync(path, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const cases = allCases
  .filter((entry) => !category || entry.category === category)
  .slice(0, limit);

if (cases.length === 0) {
  const availableCategories = [...new Set(allCases.map((entry) => entry.category).filter(Boolean))].sort();
  const selection = category ? ` for category "${category}"` : " from the evaluation file";
  console.error(
    `No evaluation cases selected${selection}. Available categories: ${availableCategories.join(", ") || "none"}.`
  );
  process.exit(1);
}

// enforceMessageUsage rate-limits every request against a shared "project"
// scope (see rateLimitScopes in worker.ts) - it's not just per-session, it's
// the whole deployment's combined message budget, currently
// AI_RATE_LIMIT_MESSAGES_PER_MINUTE=8 in production. Firing cases back to
// back trips that limit almost immediately (discovered by running this suite
// unpaced against production - everything after the 16th request came back
// 429). Space requests out to stay under it instead of just going as fast as
// possible.
const delayArg = process.argv.indexOf("--delay-ms");
const requestDelayMs = delayArg >= 0 ? Number(process.argv[delayArg + 1]) : 8000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let firstRequest = true;

async function sendTurn(sessionId, threadId, turn) {
  if (!firstRequest) await sleep(requestDelayMs);
  firstRequest = false;
  const response = await fetch(`${baseUrl}/v1/assistant/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-aether-session-id": sessionId },
    body: JSON.stringify({
      thread_id: threadId,
      message: turn.input,
      locale: turn.locale,
      currency: turn.currency,
      privacy_consent: true,
      privacy_version: "evaluation"
    })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for "${turn.input}"`);
  return response.json();
}

// Runs every turn in a case sequentially against the same thread/session so
// later turns see the earlier ones as conversation context, then evaluates
// only the final response. Single-turn cases (`input`) are just a one-turn
// sequence.
async function runCase(entry) {
  const turns = entry.turns || [{ input: entry.input, locale: entry.locale, currency: entry.currency }];
  const sessionId = `evaluation-${entry.id}`;
  const threadId = `evaluation-${entry.id}`;
  let payload;
  for (const turn of turns) {
    payload = await sendTurn(sessionId, threadId, turn);
  }

  return { id: entry.id, category: entry.category, checks: evaluateCase(entry, payload), actualIntent: payload.intent };
}

const results = [];
for (const entry of cases) {
  try {
    results.push(await runCase(entry));
  } catch (error) {
    results.push({
      id: entry.id,
      category: entry.category,
      checks: [{ name: "request", pass: false, error: String(error) }],
      actualIntent: null
    });
  }
}

const byCategory = new Map();
let passedCases = 0;
for (const result of results) {
  const failed = result.checks.filter((check) => !check.pass);
  const pass = failed.length === 0;
  if (pass) passedCases += 1;
  console.log(
    JSON.stringify({
      id: result.id,
      pass,
      actualIntent: result.actualIntent,
      failedChecks: failed.map((check) => check.name)
    })
  );
  const bucket = byCategory.get(result.category) || { total: 0, passed: 0 };
  bucket.total += 1;
  if (pass) bucket.passed += 1;
  byCategory.set(result.category, bucket);
}

console.log(
  JSON.stringify({
    summary_by_category: Object.fromEntries(
      [...byCategory.entries()].map(([category, bucket]) => [
        category,
        `${bucket.passed}/${bucket.total}`
      ])
    )
  })
);

const ratio = passedCases / results.length;
console.log(JSON.stringify({ evaluated: results.length, passed: passedCases, ratio }));
if (ratio < 0.9) process.exitCode = 1;
