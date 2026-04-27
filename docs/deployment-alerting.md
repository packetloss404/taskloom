# Taskloom Webhook-Based Alerting

Phase 29 adds rule-based alert evaluation, optional webhook delivery, and persistent alert history on top of the Phase 26 subsystem health report and the Phase 25/27 per-type job metrics. The intent is operator visibility: instead of polling `/api/app/operations/health` and `/api/app/operations/job-metrics/history` from a separate dashboard, Taskloom evaluates a small set of built-in rules on a cron tick, persists every alert it produces, and optionally posts the new batch to an external webhook. Pair Phase 29 with the existing alerting pipelines an operator already runs (PagerDuty, Slack via incoming webhook, Opsgenie, custom on-call routers, a downstream rule engine, etc.) — Taskloom is the producer, the consumer chooses the routing topology.

The phase intentionally stays small: three built-in rules, one webhook adapter, one cron handler, one admin endpoint, and one frontend tile. No per-rule runtime suppression, no custom rule definitions, no retry/dead-letter for webhook delivery, no hosted alert routing infrastructure. The persistence model is deliberately simple so the admin endpoint can serve as a recovery surface when the webhook is misconfigured or down.

This doc covers the rule set, the webhook contract, the env knobs, the scheduled-evaluation lifecycle, persistence and retention, the admin endpoint, the frontend tile, recommended cadence, suppression guidance, and a validation checklist.

## Rules

Three rules are evaluated on each tick. Each emits zero or more `AlertEvent` records with a stable `ruleId`, a per-event `contextKey` for downstream deduplication, a `severity`, a human-readable `message`, and structured `details` describing the triggering subsystem or job type.

- **subsystem-degraded** — fires `severity: "warning"` for every subsystem in the Phase 26 `OperationsHealthReport` with `status === "degraded"`. The `details` block carries the subsystem name and the most recent classifier `detail` string. A `disabled` subsystem (e.g., access logging turned off) does NOT fire this rule, matching the operator-health rule that `disabled` never poisons overall health.
- **subsystem-down** — fires `severity: "critical"` for every subsystem with `status === "down"`. Pair this with the public readiness probe: `down` on the store subsystem means `/api/health/ready` is also returning 503, so an operator's existing readiness alerting will likely fire first; this rule adds the per-subsystem dimension for triage.
- **job-failure-rate** — for each entry in the Phase 25 `JobTypeMetrics[]` snapshot, the rule computes `(failedRuns + canceledRuns) / totalRuns` and fires when both `totalRuns >= TASKLOOM_ALERT_JOB_FAILURE_MIN_SAMPLES` (default `5`) and the ratio exceeds `TASKLOOM_ALERT_JOB_FAILURE_RATE_THRESHOLD` (default `0.5`). Severity is `warning` by default and escalates to `critical` when the ratio exceeds `0.8`. The min-samples gate prevents a single failed run on a quiet job type from paging an operator immediately after a process restart resets the rolling window.

The rule evaluator is pure: it consumes the latest `OperationsHealthReport` and `JobTypeMetrics[]` snapshot and returns `AlertEvent[]`. It does not call into the store or the network. The cron handler is responsible for taking that array, optionally delivering it via webhook, and persisting it.

## Webhook Contract

When `TASKLOOM_ALERT_WEBHOOK_URL` is set, the cron handler POSTs the batch to that URL after evaluation:

```http
POST <TASKLOOM_ALERT_WEBHOOK_URL>
Content-Type: application/json
x-taskloom-alert-secret: <TASKLOOM_ALERT_WEBHOOK_SECRET>
```

Body shape:

```json
{
  "alerts": [
    {
      "id": "<uuid>",
      "ruleId": "subsystem-degraded",
      "severity": "warning",
      "message": "scheduler subsystem is degraded",
      "contextKey": "subsystem-degraded:scheduler",
      "details": { "subsystem": "scheduler", "detail": "last tick 92s ago" },
      "evaluatedAt": "2026-04-26T12:00:00.000Z"
    },
    {
      "id": "<uuid>",
      "ruleId": "job-failure-rate",
      "severity": "critical",
      "message": "agent.run failure ratio 0.92 exceeds 0.8",
      "contextKey": "job-failure-rate:agent.run",
      "details": { "type": "agent.run", "ratio": 0.92, "totalRuns": 25, "failedRuns": 22, "canceledRuns": 1 },
      "evaluatedAt": "2026-04-26T12:00:00.000Z"
    }
  ],
  "deliveredAt": "2026-04-26T12:00:00.073Z"
}
```

Header semantics:

- The secret header name defaults to `x-taskloom-alert-secret` and is configurable via `TASKLOOM_ALERT_WEBHOOK_SECRET_HEADER`. The header is omitted entirely when `TASKLOOM_ALERT_WEBHOOK_SECRET` is unset.
- The request times out at `TASKLOOM_ALERT_WEBHOOK_TIMEOUT_MS` (default `5000`). Timeouts are recorded as delivery errors with the same redaction posture as other Taskloom outbound paths.

Response semantics:

- Any 2xx response is treated as a successful delivery and recorded as `delivered: true` on the persisted alert rows.
- Any non-2xx response, network error, or timeout is treated as a delivery failure. The error message is passed through `redactedErrorMessage` before storage so bearer tokens or token-bearing URLs in transport errors do not leak into persisted rows.
- Taskloom does NOT retry failed deliveries on its own. The persisted rows always reflect the evaluation outcome, so consumers can use the admin endpoint below to recover any missed alerts. Phase 29 deliberately does not own a retry/dead-letter loop; if a deployment needs guaranteed delivery, point the webhook at a queue (SQS, Cloud Tasks, Kafka producer, or a thin in-house HTTP-to-queue adapter) and let the queue handle retries.

The webhook adapter NEVER throws. Any error during delivery is captured, redacted, and returned as structured failure metadata so the cron handler can record it without taking the scheduler tick down.

## Configuration

| Env var | Default | Description |
| --- | --- | --- |
| `TASKLOOM_ALERT_EVALUATE_CRON` | unset | Five-field cron expression. Required to enable the recurring `alerts.evaluate` job. When unset, no scheduled evaluation runs. |
| `TASKLOOM_ALERT_WEBHOOK_URL` | unset | Webhook target. Required to enable delivery; without it, evaluations still run and persist but no webhook fires. |
| `TASKLOOM_ALERT_WEBHOOK_SECRET` | unset | Optional shared secret. When set, sent as the configured header on every request. |
| `TASKLOOM_ALERT_WEBHOOK_SECRET_HEADER` | `x-taskloom-alert-secret` | Header name for the shared secret. |
| `TASKLOOM_ALERT_WEBHOOK_TIMEOUT_MS` | `5000` | Per-request timeout in milliseconds. |
| `TASKLOOM_ALERT_JOB_FAILURE_RATE_THRESHOLD` | `0.5` | Failure-ratio cutoff for the `job-failure-rate` rule. Severity escalates to `critical` above `0.8`. |
| `TASKLOOM_ALERT_JOB_FAILURE_MIN_SAMPLES` | `5` | Minimum `totalRuns` before the `job-failure-rate` rule evaluates a job type. |
| `TASKLOOM_ALERT_RETENTION_DAYS` | `30` | Day window for `data.alertEvents`. Older rows are pruned on each evaluation tick. |
| `TASKLOOM_ALERT_WORKSPACE_ID` | `__system__` | Workspace id used for the recurring `alerts.evaluate` job's bookkeeping. The scheduler does not validate this against existing workspaces. |

## Scheduled Evaluation

The cron handler is wired into the existing job scheduler the same way Phase 28 wires `metrics.snapshot`. On startup, after `scheduler.start()`, Taskloom calls `ensureAlertEvaluateCronJob()`:

- When `TASKLOOM_ALERT_EVALUATE_CRON` is unset, the helper is a no-op. The handler remains registered so manual `alerts.evaluate` enqueues still work, but no recurring job is created.
- When the env is set, the helper checks `data.jobs` for a queued/running/success `alerts.evaluate` job whose `cron` field matches the configured expression. If one already exists, the helper does nothing — this prevents process restarts from enqueueing duplicates.
- Otherwise it enqueues a single recurring job whose first `scheduledAt` is computed from the cron. Subsequent runs are re-enqueued by the scheduler's existing recurring-job behavior after each successful tick.
- An invalid cron expression logs a warning and skips the bootstrap so the rest of startup proceeds. Fix the expression and restart to retry.

The handler itself runs the pipeline `evaluate -> deliver -> persist`:

1. Build the latest `OperationsHealthReport` (Phase 26) and capture the in-memory `JobTypeMetrics[]` snapshot (Phase 25).
2. Run the rule evaluator and collect zero or more `AlertEvent` rows.
3. If `TASKLOOM_ALERT_WEBHOOK_URL` is configured, call the webhook adapter and capture `{ delivered, deliveryError? }` per batch.
4. Persist every alert as an `AlertEventRecord` in `data.alertEvents`, regardless of webhook success.
5. Prune `data.alertEvents` rows older than `TASKLOOM_ALERT_RETENTION_DAYS`.

## Persistence And Retention

`data.alertEvents` lives in `app_records` JSON, so the SQLite mode requires no migration. Each row carries:

- `id` — uuid.
- `evaluatedAt` — ISO timestamp of the evaluation that produced the alert.
- `ruleId` — `subsystem-degraded`, `subsystem-down`, or `job-failure-rate`.
- `severity` — `warning` or `critical`.
- `message`, `contextKey`, `details` — copied from the `AlertEvent`.
- `delivered` — boolean. `true` when the webhook returned a 2xx, `false` when delivery failed or the webhook is not configured.
- `deliveryError` — redacted error string when `delivered` is `false` and a webhook delivery was attempted; `null` otherwise (including when no webhook is configured).
- `deliveredAt` — ISO timestamp of the delivery attempt; `null` when no webhook was configured.

Retention runs on every evaluation tick: rows whose `evaluatedAt` is older than `TASKLOOM_ALERT_RETENTION_DAYS` are pruned in the same call. At a five-minute cron and the 30-day default, expect roughly 8640 evaluation ticks of persisted history; most ticks produce zero rows when the deployment is healthy, so steady-state row count is much lower than the upper bound.

## Admin Endpoint (/api/app/operations/alerts)

`GET /api/app/operations/alerts` is admin-scoped and returns recent alert rows newest-first. Auth follows the standard Taskloom session model: 401 without a session, 403 for non-admin/non-owner sessions, 200 for admin or owner.

Query parameters:

- `severity` — filter to `warning` or `critical`.
- `since` — ISO timestamp; only rows at or after this `evaluatedAt`.
- `until` — ISO timestamp; only rows at or before this `evaluatedAt`.
- `limit` — integer, default `100`, capped at `500`. Values outside that range are clamped.

Sample response:

```json
{
  "alerts": [
    {
      "id": "f0e9c5c6-2a49-4a93-9f8e-0d8c7c72f5ab",
      "evaluatedAt": "2026-04-26T12:00:00.000Z",
      "ruleId": "subsystem-degraded",
      "severity": "warning",
      "message": "scheduler subsystem is degraded",
      "contextKey": "subsystem-degraded:scheduler",
      "details": { "subsystem": "scheduler", "detail": "last tick 92s ago" },
      "delivered": true,
      "deliveryError": null,
      "deliveredAt": "2026-04-26T12:00:00.073Z"
    }
  ]
}
```

Invalid `since` or `until` query values return `400 { "error": "invalid since" }` (or `until`).

## Frontend Recent Alerts Tile

The Operations page renders a "Recent alerts" sub-section inside the same admin-gated "Production Status" tile, fed by `GET /api/app/operations/alerts`. The tile shows the last 25 alerts with a severity badge, the rule id, the message, the evaluation timestamp, and a delivery-status icon (`delivered`, `not delivered`, or `no webhook configured`). The sub-section follows the same RBAC as the parent tile, so non-admin members do not see it.

The tile is intended for at-a-glance triage from a browser; production routing should still flow through the webhook (or, if the webhook is unset, through periodic admin-endpoint scrapes from a downstream dashboard).

## Recommended Cadence

A five-minute cron (`*/5 * * * *`) is reasonable for most deployments:

- More frequent (e.g., `*/1 * * * *`) increases webhook traffic and persisted-row volume linearly. Useful when an operator wants tight detection on a high-volume job type, but expect more `subsystem-degraded` flap during transient blips that resolve within a tick.
- Less frequent (e.g., `*/15 * * * *`) reduces traffic and storage but slows detection. A subsystem that goes down 30 seconds after a tick will not produce an alert for nearly 15 minutes.
- Match the cadence to the consumer's tolerance. Slack via incoming webhook tolerates a five-minute cadence comfortably; PagerDuty alert routing rules typically prefer the same cadence with downstream dedupe windows.

The rolling Phase 25 metrics window is in-memory and resets on process restart, so a freshly restarted process needs at least `TASKLOOM_ALERT_JOB_FAILURE_MIN_SAMPLES` job runs of a given type before the `job-failure-rate` rule can fire for that type. This is intentional — operators should not page on a rolling-window artifact.

## Suppressing Specific Rules

The current implementation does not expose per-rule runtime suppression. Operators tune behavior through env knobs:

- Raise `TASKLOOM_ALERT_JOB_FAILURE_RATE_THRESHOLD` to suppress `job-failure-rate` warnings on noisy job types until investigation is complete.
- Raise `TASKLOOM_ALERT_JOB_FAILURE_MIN_SAMPLES` to require more runs before the rule evaluates.
- Disable webhook delivery entirely by unsetting `TASKLOOM_ALERT_WEBHOOK_URL`; evaluations continue to persist and remain visible in the admin endpoint and tile.

For per-rule, per-subsystem, or per-job-type suppression at runtime, filter at the consumer side. A downstream router (PagerDuty event rules, Slack workflow filter, custom Hono adapter) can suppress by `ruleId`, `severity`, or `details` fields before paging an operator. Hosting that suppression logic outside Taskloom keeps the producer simple and lets operators evolve routing policy without redeploying the app.

## Validation Checklist

After deploying Phase 29, walk through:

- With `TASKLOOM_ALERT_EVALUATE_CRON=*/5 * * * *` and a synthetic degraded subsystem (e.g., set `TASKLOOM_ACCESS_LOG_MODE=file` with a non-existent `TASKLOOM_ACCESS_LOG_PATH` parent directory), an alert with `ruleId: "subsystem-degraded"` appears in `GET /api/app/operations/alerts` within the cron window.
- With `TASKLOOM_ALERT_WEBHOOK_URL` pointing at `https://httpbin.org/post` (or the operator's test endpoint), the same alert delivers and `delivered: true` shows in the admin endpoint response.
- With a deliberately broken webhook URL (e.g., `https://localhost:0/`), the alert is still persisted with `delivered: false` and a redacted `deliveryError` string. Confirm the error string contains no bearer token even when `TASKLOOM_ALERT_WEBHOOK_SECRET` is set.
- Restarting the process does not enqueue a duplicate `alerts.evaluate` job. Verify by listing `data.jobs` and confirming exactly one `alerts.evaluate` row with `status` in `queued|running|success` and the configured cron.
- An invalid cron expression logs a warning at startup and the alerts job is not enqueued.
- With `TASKLOOM_ALERT_WEBHOOK_URL` unset and the cron configured, evaluations still run and persist with `delivered: false`, `deliveryError: null`, and `deliveredAt: null`. The Operations page tile shows "no webhook configured" for those rows.
- After more than `TASKLOOM_ALERT_RETENTION_DAYS` of evaluations, older rows are pruned. Set the env to a small value (e.g., `1`) in a non-production environment to confirm.
- The `job-failure-rate` rule does not fire when `totalRuns < TASKLOOM_ALERT_JOB_FAILURE_MIN_SAMPLES`, even if the failure ratio is 1.0 over a small number of runs.
- Cross-link the rest of the production posture: `docs/deployment-health-endpoints.md` for the underlying `OperationsHealthReport` and job-metrics surfaces, `docs/deployment-scheduler-coordination.md` for leader-election context if the cron runs across multiple processes, and `docs/invitation-email-operations.md` for the parallel webhook/redaction posture used by invitation email delivery.
