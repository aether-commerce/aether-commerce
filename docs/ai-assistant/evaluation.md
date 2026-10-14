# Aether AI evaluation

The default gate is `apps/ai-assistant/assistant.test.ts`. It covers graph structure, health metadata, CORS, authenticated own-order lookup, cross-user blocking, multilingual interview cases, and grounded catalog behavior.

Run locally:

```bash
pnpm --filter @aether-commerce/ai-assistant test
```

The larger JSONL corpus lives at `apps/ai-assistant/evaluation/cases.jsonl` (categories include search, recommendation, details, comparison, `purchase_decisions`, cart mutations, orders, favorites, language, context bleed, and adversarial cases). The weekly/manual workflow calls a deployed evaluation Worker through `evaluation/run.mjs` (`--limit`, default 10, capped at 300) and requires at least 90 percent case agreement. Configure `AETHER_AI_EVAL_URL`; Gemini credentials stay inside the Worker and are never injected into the evaluator.

Each case can check intent, language, required product names, product currency, a combined-price ceiling, required response evidence, and `must_not_*` safety flags. Currency in a case is sent to the Worker, so COP tests exercise the same store-currency context as the storefront. Purchase-decision cases verify the actual products, currency, specifications, and combined total instead of relying on the intent label alone. `context_bleed` cases use `turns: [...]` instead of `input` to replay a short conversation on one thread and only evaluate the final turn - this is how the "Buscar ofertas" context-bleed regression (an unrelated message right after an orders question kept classifying as orders) gets covered end-to-end against the real deployed Worker, not just the heuristic in isolation.

Release safety gates are zero cross-user leakage, zero unauthorized mutations, zero fabricated products/prices, and successful conversation deletion.
