# Browser monitoring (EASYJET-14)

The shared Axios client generates an independent cryptographic request ID and W3C
trace context for each logical API request. Authentication/CSRF retries retain the
request/trace ID with a new attempt span ID. Headers are attached only to the API
origin. The backend returns the IDs through CORS; HTTP error reports use those IDs
so the failing API trace can be found in backend/queue logs and Jaeger.

Set `NEXT_PUBLIC_TELEMETRY_ENABLED=true` at build time only after the backend
`FRONTEND_TELEMETRY_ENABLED` flag is enabled. Both are false by default.
`NEXT_PUBLIC_TRACE_SAMPLE_RATIO` defaults to 0.1. Correlation headers are always
available; trace IDs exist even when export sampling is disabled.

The root client provider registers window error/unhandled-rejection listeners and
cleans them up. The app error boundary reports React rendering failures. Reports
contain **only** category, validated request ID/traceparent and HTTP status. No
message, stack, component props, URLs, query strings, browser storage, cookies,
credentials, customer data or response bodies are sent. Runtime/React errors without
a failing HTTP request do not claim a relationship to the last unrelated request.

Reports are limited to 20 per minute per tab with a five-second timeout. The report
transport requires initialized CSRF state/session, never seeds or refreshes auth,
never retries, and cannot report its own failure. Normal API responses, refresh,
CSRF retry and upload idempotency behaviors are retained. Older backends ignore the
extra request headers and reject the new report endpoint without affecting users.

Run `yarn test:security`, `yarn lint` and `yarn build`. The API client regressions
exercise auth/CSRF retries, concurrency and API-origin restrictions; telemetry tests
verify payload minimization, rate bounding and listener cleanup. Backend integration
checks browser-header → API → Redis → worker propagation and real trace ingestion.
See the backend `docs/observability-runbook.md` for local dashboards, alarm thresholds,
retention/access policy and first diagnosis steps.

Merge backend first, then frontend; enable local monitoring after both are ready.
No database migration or frontend dependency changes are required. Roll back by
setting the public monitoring flag false and reverting the client change. Production
deployment remains a separate action.
