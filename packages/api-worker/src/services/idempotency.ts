// Replays the exact response for a request that already completed under the
// same x-idempotency-key instead of re-running a mutating handler. Without
// this, a retried request (network blip, client retry, a duplicate click)
// re-executes the mutation - most visibly, POST /cart/:id/items increments
// an existing line's quantity rather than replacing it, so a retried "add to
// cart" silently doubles the quantity.
//
// Reuses the idempotency_keys table shipped in migration 0001 (key, route,
// request_hash, response_json, expires_at) - it existed from day one but no
// route ever read or wrote it, so x-idempotency-key was accepted (allow-listed
// in CORS) and completely ignored. Callers that don't send a key are
// unaffected.
async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function withIdempotency(
  db: D1Database,
  route: string,
  idempotencyKey: string | null | undefined,
  requestPayload: unknown,
  run: () => Promise<Response>
): Promise<Response> {
  if (!idempotencyKey) return run();
  if (idempotencyKey.length > 128) {
    return new Response(JSON.stringify({ success: false, error: { code: "INVALID_IDEMPOTENCY_KEY", message: "Idempotency key is too long." } }),
      { status: 400, headers: { "content-type": "application/json; charset=utf-8" } });
  }
  const payload = requestPayload && typeof requestPayload === "object" ? requestPayload as Record<string, unknown> : {};
  const rawScope = payload.actorId ?? payload.userId ?? payload.cartId;
  const scope = typeof rawScope === "string" || typeof rawScope === "number" ? String(rawScope) : "";
  const scopedKey = await digest(`${route}\0${scope}\0${idempotencyKey}`);
  const requestHash = await digest(JSON.stringify(requestPayload ?? null));

  await db
    .prepare("delete from idempotency_keys where expires_at <= current_timestamp")
    .run()
    .catch(() => {});

  const claim = await db
    .prepare(
      `insert into idempotency_keys (key, route, request_hash, expires_at)
       values (?, ?, ?, datetime('now', '+24 hours'))
       on conflict(key) do nothing`
    )
    .bind(scopedKey, route, requestHash)
    .run();

  if (claim.meta.changes === 0) {
    const existing = await db
      .prepare("select request_hash, response_json from idempotency_keys where key = ?")
      .bind(scopedKey)
      .first<{ request_hash: string; response_json: string | null }>();
    if (existing && existing.request_hash !== requestHash) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "IDEMPOTENCY_KEY_REUSED",
            message: "This idempotency key was already used with different request parameters."
          }
        }),
        { status: 409, headers: { "content-type": "application/json; charset=utf-8" } }
      );
    }
    if (existing?.response_json != null) {
      const cached = JSON.parse(existing.response_json) as { status: number; body: unknown };
      return new Response(JSON.stringify(cached.body), {
        status: cached.status,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-idempotent-replay": "true"
        }
      });
    }
    // A matching claim without a response is still running (or needs an
    // operator to reconcile after a crash). Never execute it twice.
    return new Response(JSON.stringify({ success: false, error: {
      code: "IDEMPOTENCY_IN_PROGRESS",
      message: "This request is still being processed. Retry shortly with the same key."
    } }), { status: 409, headers: { "content-type": "application/json; charset=utf-8", "retry-after": "2" } });
  }

  try {
    const response = await run();
    const body = await response.clone().json();
    await db.prepare("update idempotency_keys set response_json = ? where key = ?")
      .bind(JSON.stringify({ status: response.status, body }), scopedKey).run();
    return response;
  } catch (error) {
    // The side effect may have happened before the failure. Preserve the
    // claim for reconciliation instead of allowing an unsafe second run.
    await db.prepare("update idempotency_keys set response_json = ? where key = ?")
      .bind(JSON.stringify({ status: 500, body: { success: false, error: { code: "IDEMPOTENCY_RECONCILIATION_REQUIRED", message: "Request outcome requires reconciliation." } } }), scopedKey).run();
    throw error;
  }
}
