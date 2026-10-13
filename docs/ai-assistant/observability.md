# Aether AI Assistant Observability

The assistant exposes Prometheus text metrics at `GET /metrics` and optional OTLP traces when `OTEL_ENABLED=true`.

On the Cloudflare Worker deployment, `/metrics` is backed by D1 tables used by the assistant. It reports project-level request counts from `ai_usage_daily`, LLM classification attempts, audited tool calls and failed outcomes, blocked mutations, D1 rate-limit buckets, rate-limit events, and daily budget gauges. The tool-audit query is bounded to the current UTC day and uses the existing `created_at` index.

## Signals

Use these signals as the minimum production dashboard:

- Request volume: `rate(ai_requests_total[5m])`
- Active requests: `ai_requests_active`
- Error rate: `rate(ai_request_errors_total[5m]) / rate(ai_requests_total[5m])`
- Request latency: `ai_request_duration_seconds_max`
- LLM call volume: `rate(ai_llm_calls_total[5m])`
- Tool call volume: `rate(ai_tool_calls_total[5m])`
- Failed tool outcomes: `rate(ai_tool_errors_total[5m])`
- Rate limits: `rate(ai_rate_limit_errors_total[5m])`
- Active short-window rate buckets: `ai_rate_limit_buckets_active`
- Cart mutations: `rate(ai_cart_mutations_total[5m])`
- Cart mutation failures: `rate(ai_cart_mutation_failures_total[5m])`
- Clarifications: `rate(ai_clarifications_total[5m])`
- Gemini fallback activity: `rate(ai_fallback_total[5m])`
- Daily budget usage: `ai_daily_budget_usage_ratio`
- Whether a daily project ceiling is enabled: `ai_daily_budget_configured`
- Configured daily project ceiling: `ai_daily_budget_limit_requests`
- Daily budget remaining requests: `ai_daily_budget_requests_remaining`
- Daily budget thresholds: `ai_daily_budget_threshold_70_reached`, `ai_daily_budget_threshold_85_reached`, `ai_daily_budget_threshold_95_reached`

Token counters are exported as `ai_llm_tokens_input_total` and `ai_llm_tokens_output_total`. They remain zero until the configured LangChain/Gemini response includes supported usage metadata.

## Provided Artifacts

- `docs/ai-assistant/observability/prometheus-alerts.yml`: baseline alert rules.
- `docs/ai-assistant/observability/grafana-dashboard.json`: starter dashboard panels.

## Alert Policy

Production should page or notify on:

- Assistant endpoint unavailable.
- Error rate above 5 percent for 10 minutes.
- Request latency above the target window.
- Repeated Gemini fallback or rate-limit spikes.
- Cart mutation failures above zero for sustained periods.
- Daily budget usage reaching 70, 85 and 95 percent.

`ai_requests_total`, `ai_tool_errors_total`, and related usage values are current-UTC-day counters and reset at midnight UTC. The service emits meaningful budget gauges only when `AI_DAILY_REQUEST_BUDGET` is configured; `ai_daily_budget_configured` distinguishes an unset ceiling from an exhausted one.

## Daily request ceiling

Set the positive integer GitHub Actions environment variable `AI_DAILY_REQUEST_BUDGET` in the `production` and/or `development` environment to enable a project-wide daily ceiling. Leave it unset to disable that ceiling; per-session and short-window rate limits still apply. The deployment config generator rejects zero, negative, fractional, and non-numeric values.

The ceiling counts accepted shopper messages before assistant processing. It protects the deployment from unbounded request volume, but it is not a dollar-cost estimate: one message can trigger multiple model calls and tool calls. Cost reporting must use provider token usage when available; the token metrics remain zero until the configured LangChain/Gemini response includes supported usage metadata. The ceiling is shared by the whole deployment, not apportioned per merchant or plan.

## Structured Logs

Cloudflare observability captures Worker request logs. Application persistence records operational fields in D1 without storing authentication secrets:

- `request_id`
- `thread_id`
- `session_hash`
- `intent`
- `confidence`
- `tool_name`
- `status`
- `error_code`
- daily LLM and tool call counters

They do not include full user messages, prompts, tool arguments, authentication tokens or payment data by default.
