# Acceptance status

## Implemented

- LangGraph.js runs inside the free Cloudflare Worker runtime.
- The compressed bundle is below the free-plan Worker limit.
- Explicit graph stages cover validation, context, classification, authorization, tools, response, persistence, and audit.
- The storefront forwards the Clerk bearer only when a signed-in session exists.
- Own-order requests are verified and scoped by the Aether API.
- Spanish, English, French, and Italian interview requests have regression tests.
- Cross-user and injection requests are blocked before tools execute.
- Conversations are redacted, retained in D1, and deletable by the owning session.
- CI typechecks, lints, tests, and dry-run builds the production Worker.
- Purchase-decision regressions cover complete product comparisons, catalog-backed compatibility, strict currency matching, and two-item combined budgets. The live evaluation also checks distinct product identities, listed specification values, non-overclaiming, and the combined total in minor currency units.

The retired Python/FastAPI/Docker implementation was removed after the JavaScript Worker became the production target.

## Purchase-decision validation

The deterministic worker tests and evaluation assertions now require complete, distinct comparison results; compatibility claims backed by catalog specifications; matching product currencies; and a two-item total within the stated budget. The live evaluator is driven by `AETHER_AI_EVAL_URL` and the controlled cases in `evaluation/cases.jsonl`. These local checks validate the acceptance rules, but do not replace a model-backed run against an isolated test catalog. Do not count the purchase-decision findings as fully revalidated until that run passes.
