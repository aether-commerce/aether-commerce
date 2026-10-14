import { setTimeout as delay } from "node:timers/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function requireHttpUrl(label, value) {
  if (!value) throw new Error(`${label} is required for deployment smoke checks.`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute HTTP(S) URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${label} must use HTTP or HTTPS.`);
  }
  return url;
}

function retryableError(message, retryable = false) {
  return Object.assign(new Error(message), { retryable });
}

async function getResponse(fetcher, url, { retryNotFound = false } = {}) {
  let response;
  try {
    response = await fetcher(url, {
      headers: { accept: "application/json, text/html;q=0.9" },
      signal: AbortSignal.timeout(10000)
    });
  } catch (error) {
    throw retryableError(
      `${url.href} could not be reached: ${error instanceof Error ? error.message : String(error)}`,
      true
    );
  }
  if (!response.ok) {
    throw retryableError(
      `${url.href} returned HTTP ${response.status}.`,
      TRANSIENT_HTTP_STATUSES.has(response.status) || (retryNotFound && response.status === 404)
    );
  }
  return response;
}

async function withRetry(label, operation, { attempts, retryDelayMs }) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!lastError.retryable || attempt === attempts) break;
      if (retryDelayMs > 0) await delay(retryDelayMs);
    }
  }
  throw new Error(`${label} failed: ${lastError?.message ?? "unknown error"}`);
}

async function readJson(fetcher, url, label, options) {
  return withRetry(
    label,
    async () => {
      const response = await getResponse(fetcher, url);
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error(`${url.href} did not return JSON.`);
      }
      try {
        return await response.json();
      } catch {
        throw new Error(`${url.href} returned invalid JSON.`);
      }
    },
    options
  );
}

async function checkHtml(fetcher, url, label, options) {
  return withRetry(
    label,
    async () => {
      const response = await getResponse(fetcher, url);
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) throw new Error(`${url.href} did not return HTML.`);
      const body = await response.text();
      if (body.trim().length < 40 || !/<html[\s>]/i.test(body)) {
        throw new Error(`${url.href} returned an empty or non-HTML page.`);
      }
      return { status: response.status, contentType };
    },
    options
  );
}

function assertRevision(actual, expected, service) {
  if (actual !== expected) {
    throw retryableError(
      `${service} serves revision ${actual ?? "unknown"}; expected ${expected}.`,
      true
    );
  }
}

async function checkBuildInfo(fetcher, baseUrl, service, environment, revision, options) {
  const url = new URL("/build-info.json", baseUrl);
  return withRetry(
    `${service} build metadata`,
    async () => {
      const response = await getResponse(fetcher, url, { retryNotFound: true });
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error(`${url.href} did not return JSON.`);
      }
      let info;
      try {
        info = await response.json();
      } catch {
        throw new Error(`${url.href} returned invalid JSON.`);
      }
      if (
        info.schemaVersion !== 1 ||
        info.service !== service ||
        info.environment !== environment
      ) {
        throw new Error(
          `${service} build metadata does not match the expected service and environment.`
        );
      }
      assertRevision(info.revision, revision, service);
      return {
        status: response.status,
        service,
        environment: info.environment,
        revision: info.revision
      };
    },
    options
  );
}

async function checkApi(fetcher, apiUrl, revision, options) {
  const url = new URL("/api/v1/health/ready", apiUrl);
  const body = await readJson(fetcher, url, "API readiness", options);
  if (body.success !== true || body.data?.status !== "ok") {
    throw new Error("API readiness did not report status=ok.");
  }
  assertRevision(body.data.revision, revision, "API");
  return { status: "ok", revision: body.data.revision };
}

async function checkAssistant(fetcher, assistantUrl, revision, options) {
  const healthUrl = new URL("/healthz", assistantUrl);
  const health = await readJson(fetcher, healthUrl, "assistant liveness", options);
  if (health.status !== "ok" || health.service !== "aether-ai") {
    throw new Error("Assistant liveness did not identify the healthy Aether assistant.");
  }
  assertRevision(health.revision, revision, "assistant");

  const readinessUrl = new URL("/readyz", assistantUrl);
  const readiness = await readJson(fetcher, readinessUrl, "assistant readiness", options);
  if (readiness.status !== "ready")
    throw new Error(`Assistant readiness reported ${readiness.status ?? "unknown"}.`);
  return { status: "ready", revision: health.revision };
}

export async function checkDeploymentSmoke(
  { environment, expectedRevision, storefrontUrl, apiUrl, assistantUrl, adminUrl, portfolioUrl },
  fetcher = fetch,
  options = {}
) {
  if (environment !== "development" && environment !== "production") {
    throw new Error("AETHER_DEPLOY_ENV must be development or production.");
  }
  if (!SHA_PATTERN.test(expectedRevision ?? "")) {
    throw new Error("DEPLOYED_COMMIT_SHA must be a full 40-character commit SHA.");
  }
  const urls = {
    storefront: requireHttpUrl("APP_ORIGIN_STORE", storefrontUrl),
    api: requireHttpUrl("NEXT_PUBLIC_AETHER_API_URL", apiUrl),
    assistant: requireHttpUrl("NEXT_PUBLIC_AETHER_AI_URL", assistantUrl),
    admin: requireHttpUrl("APP_ORIGIN_ADMIN", adminUrl),
    portfolio: requireHttpUrl("NEXT_PUBLIC_PORTFOLIO_URL", portfolioUrl)
  };
  const retryOptions = {
    attempts: options.attempts ?? 3,
    retryDelayMs: options.retryDelayMs ?? 3000
  };

  const storefront = await checkHtml(fetcher, urls.storefront, "storefront", retryOptions);
  const storefrontMetadata = await checkBuildInfo(
    fetcher,
    urls.storefront,
    "aether-storefront",
    environment,
    expectedRevision,
    retryOptions
  );
  const api = await checkApi(fetcher, urls.api, expectedRevision, retryOptions);
  const assistant = await checkAssistant(fetcher, urls.assistant, expectedRevision, retryOptions);
  const admin = await checkHtml(fetcher, urls.admin, "admin", retryOptions);
  const adminMetadata = await checkBuildInfo(
    fetcher,
    urls.admin,
    "aether-admin",
    environment,
    expectedRevision,
    retryOptions
  );
  const portfolio = await checkHtml(fetcher, urls.portfolio, "portfolio", retryOptions);

  return {
    status: "verified",
    environment,
    expectedRevision: expectedRevision.toLowerCase(),
    services: {
      storefront: { ...storefront, ...storefrontMetadata },
      api,
      assistant,
      admin: { ...admin, ...adminMetadata },
      portfolio: { ...portfolio, revision: "independent-service" }
    }
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await checkDeploymentSmoke({
      environment: process.env.AETHER_DEPLOY_ENV,
      expectedRevision: process.env.DEPLOYED_COMMIT_SHA,
      storefrontUrl: process.env.APP_ORIGIN_STORE,
      apiUrl: process.env.NEXT_PUBLIC_AETHER_API_URL,
      assistantUrl: process.env.NEXT_PUBLIC_AETHER_AI_URL,
      adminUrl: process.env.APP_ORIGIN_ADMIN,
      portfolioUrl: process.env.NEXT_PUBLIC_PORTFOLIO_URL
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
