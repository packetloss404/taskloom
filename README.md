# Taskloom

Taskloom is an open source workspace portal for activation tracking, onboarding progress, and operational follow-through. The current repository includes:

- activation domain
- pure milestone engine
- checklist derivation
- stage + risk logic
- repository/service contracts
- SQL schema and SQLite app-runtime migration foundation
- signal adapters for legacy facts and durable workflow records
- in-memory repositories and local JSON store services
- read-only activation API wrapper
- UI-neutral activation summary view model
- workspace auth, onboarding, activity, and workflow flows
- workspace membership records, invitation/member-management APIs, and route-level RBAC for private workspace APIs
- command-driven maintenance jobs
- queue-driven agent runs, recurring job scheduling, and public webhook triggers
- Product Workflow Expansion surfaces for briefs, requirements, plans, blockers, questions, validation evidence, release confirmation, templates, prompt-generated drafts, and Plan Mode
- React/Vite pages for auth, onboarding, dashboard, settings, activation, workflow, activity/detail, agents, runs, operations, integrations, and public share links

## Run locally

Prerequisites:

- Node.js `>=22.5.0`
- npm

1. Install dependencies:

```bash
npm install
```

2. Start the app in development:

```bash
npm run dev
```

3. Open:

```text
http://localhost:7341
```

The local app uses `data/taskloom.json` for file-backed persistence by default. If the file is missing, the server recreates it from the built-in seed data on first store load. To run the same store API against SQLite, start the app with `TASKLOOM_STORE=sqlite`; it targets `data/taskloom.sqlite` unless `TASKLOOM_DB_PATH=path/to/taskloom.sqlite` is set. SQLite mode persists the full app runtime through migrated `app_records` rows and query-indexed metadata while keeping JSON as the default contributor workflow. SQLite opens with `busy_timeout`, WAL mode, `synchronous=normal`, and `foreign_keys=on`; SQLite `mutateStore()` writes run inside `BEGIN IMMEDIATE` and reload fresh state before writing so local concurrent writers do not overwrite newer whole-store state from a stale cache.

## Local Data

For local contributor access, the seed data includes these workspace accounts:

- `alpha@taskloom.local`
- `beta@taskloom.local`
- `gamma@taskloom.local`

Each uses the password `demo12345`. You can also create a new account from the sign-up page.

To reset local data back to the seed state, stop the dev server, then run:

```bash
npm run store:reset
```

`npm run store:seed` also writes the built-in seed data to the active local store. By default that is `data/taskloom.json`; with `TASKLOOM_STORE=sqlite`, it writes to SQLite instead.

To create or reset the local SQLite database:

```bash
npm run db:migrate
npm run db:seed
npm run db:reset
npm run db:seed-app
npm run db:reset-app
npm run db:backfill -- --json-path=data/taskloom.json
```

These commands target `data/taskloom.sqlite` by default. Pass `-- --db-path=path/to/taskloom.sqlite` to use a different database file. `db:seed-app` writes the built-in app seed data to SQLite, `db:backfill` imports an existing JSON store into SQLite, and `db:reset-app` recreates the SQLite app seed state without modifying `data/taskloom.json`.

To refresh or repair activation read models after editing local data manually:

```bash
npm run jobs:recompute-activation
npm run jobs:repair-activation
```

To clean expired sessions:

```bash
npm run jobs:cleanup-sessions
```

## Build And Release Checks

Run the full local release gate before handing off a change:

```bash
npm run build
```

This runs the Vite web build, TypeScript checks for the API and web app, backend API tests, and frontend smoke tests. The generated `web/dist/` output is ignored and should be rebuilt locally instead of committed.

Vite writes built assets to `web/dist/` with `emptyOutDir: true`; generated web assets, local state, runtime artifacts, logs, coverage, and environment files remain out of source control unless release packaging requirements change.

To run the test layers independently:

```bash
npm run test:api
npm run test:web
```

For a built local run:

```bash
npm run build:web
npm start
```

Then open:

```text
http://localhost:8484
```

Release hygiene checklist:

- Run `npm run build` from a clean working tree before release handoff.
- Run `npm run jobs:recompute-activation` or `npm run jobs:repair-activation` if seed data, workflow records, or activation facts changed.
- Keep `README.md`, `docs/roadmap.md`, and `docs/activation/*` aligned with any landed product, storage, or hardening milestone.
- Do not commit `data/taskloom.json`, `data/artifacts/`, `web/dist/`, logs, or environment files.

## Production Deployment Guidance

Taskloom is still optimized for local and single-node deployments. Before production handoff, treat the current runtime as a Node app that needs standard platform controls around HTTPS, secrets, shared abuse protection, persistence, and backups.

Recommended production posture:

- Run with `NODE_ENV=production` behind an HTTPS-terminating reverse proxy or platform load balancer so session cookies are sent with `Secure`.
- Set `TASKLOOM_TRUST_PROXY=true` only when the proxy is trusted to overwrite `X-Forwarded-Host`, `X-Forwarded-For`, and related forwarding headers.
- Keep `TASKLOOM_RATE_LIMIT_KEY_SALT`, invitation webhook secrets, provider keys, and environment files in the deployment secret store, not in source control or logs.
- Use `TASKLOOM_STORE=sqlite` with a durable `TASKLOOM_DB_PATH` for single-node persistence. Keep JSON storage for local contributor workflows unless a deployment explicitly accepts file-backed local state.
- Put `data/taskloom.sqlite`, `data/artifacts/`, and any deployment logs on backed-up persistent storage when they are needed across restarts.
- Run `npm run db:backup` before migrations or release handoff, and validate restore with `npm run db:restore` in a non-production environment.
- Run `npm run jobs:cleanup-sessions` on a schedule to prune expired sessions.
- Run only one scheduler-active Node process against the current local store unless the Phase 21 leader-election gate is enabled. To run multiple Node processes safely, set `TASKLOOM_SCHEDULER_LEADER_MODE=file` (with `TASKLOOM_SCHEDULER_LEADER_FILE_PATH`, default `data/scheduler-leader.json`) for processes on the same host, or `TASKLOOM_SCHEDULER_LEADER_MODE=http` (with `TASKLOOM_SCHEDULER_LEADER_HTTP_URL`, optional `TASKLOOM_SCHEDULER_LEADER_HTTP_SECRET`, `TASKLOOM_SCHEDULER_LEADER_HTTP_TIMEOUT_MS` defaulting to 5000, and `TASKLOOM_SCHEDULER_LEADER_HTTP_FAIL_OPEN`) for cross-host coordination through a deployment-owned coordinator service. `TASKLOOM_SCHEDULER_LEADER_TTL_MS` (default 30000) and `TASKLOOM_SCHEDULER_LEADER_PROCESS_ID` tune lock takeover latency and identify each process. See `docs/deployment-scheduler-coordination.md` for the wire protocol, file-mode caveats, and validation checklist.
- Tune the per-type job-duration rolling window with `TASKLOOM_SCHEDULER_METRICS_WINDOW_SIZE` (default `50`, integer >= 1, read at module load). The window feeds the `jobMetrics` field on the operator-status endpoint and Operations "Production Status" tile, lives in process memory, and resets on restart by design.
- Set `TASKLOOM_JOB_METRICS_SNAPSHOT_CRON` to a five-field cron expression (e.g., `*/15 * * * *`) to enqueue a built-in recurring `metrics.snapshot` job that runs the same capture as `npm run jobs:snapshot-metrics` without external cron. When unset, no auto-snapshot runs. `TASKLOOM_JOB_METRICS_SNAPSHOT_RETENTION_DAYS` (default `30`) is passed to the job payload as `retentionDays`, and `TASKLOOM_JOB_METRICS_SNAPSHOT_WORKSPACE_ID` (default `"__system__"`) sets the workspace id used for the recurring job's bookkeeping. Invalid cron expressions log a warning and skip the bootstrap. See `docs/deployment-health-endpoints.md`.
- Set `TASKLOOM_ALERT_EVALUATE_CRON` to a five-field cron expression (e.g., `*/5 * * * *`) to enqueue a built-in recurring `alerts.evaluate` job that runs the rule evaluator against the latest `OperationsHealthReport` and `JobTypeMetrics[]` snapshot, optionally delivers the batch via webhook, and persists the alert rows. When unset, no scheduled evaluation runs. `TASKLOOM_ALERT_WEBHOOK_URL` is required to enable delivery; without it, evaluations still run and persist but no webhook fires. `TASKLOOM_ALERT_WEBHOOK_SECRET` (sent in `TASKLOOM_ALERT_WEBHOOK_SECRET_HEADER`, default `x-taskloom-alert-secret`) and `TASKLOOM_ALERT_WEBHOOK_TIMEOUT_MS` (default `5000`) control authentication and timeout. `TASKLOOM_ALERT_JOB_FAILURE_RATE_THRESHOLD` (default `0.5`) and `TASKLOOM_ALERT_JOB_FAILURE_MIN_SAMPLES` (default `5`) tune the `job-failure-rate` rule. `TASKLOOM_ALERT_RETENTION_DAYS` (default `30`) prunes older rows on each evaluation, and `TASKLOOM_ALERT_WORKSPACE_ID` (default `"__system__"`) sets the workspace id used for the recurring job's bookkeeping. Invalid cron expressions log a warning and skip the bootstrap. See `docs/deployment-alerting.md`.
- Enable `TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL` or add equivalent edge/shared distributed rate limiting for auth and invitation routes before relying on local buckets across multiple processes or regions.
- For invitation email webhook retry/dead-letter operations, see `docs/invitation-email-operations.md`.
- Built-in API responses redact sensitive payload fields, route-token URLs, bearer values, job payload/result/error bodies, activity/run DTOs, and list/detail token surfaces. Keep any deployment access logs, reverse-proxy logs, exports, and telemetry aligned with the same redaction posture.
- Enable the in-app access log middleware with `TASKLOOM_ACCESS_LOG_MODE=stdout` or `TASKLOOM_ACCESS_LOG_MODE=file` (defaults to `off`), and set `TASKLOOM_ACCESS_LOG_PATH` to a managed log directory when mode is `file`. The middleware writes one JSON line per request with method, status, duration, userId, workspaceId, requestId, and a path/query that is passed through the same redaction helper used for DTO surfaces. Pair it with reverse-proxy access-log rewriting templates under `docs/deployment/proxy-access-log-redaction/` for traffic the app never sees, and validate proxy logs with `node --import tsx src/security/proxy-access-log-validator.ts <path-to-log>` after every config change.
- For file-mode access logging, bound local disk usage with `TASKLOOM_ACCESS_LOG_MAX_BYTES` (default `0` = rotation disabled) and `TASKLOOM_ACCESS_LOG_MAX_FILES` (default `5`, clamp to `>= 1`). When `MAX_BYTES > 0`, the middleware rotates the active file before writing a line that would exceed the threshold, cascading `<path>` to `<path>.1`, `<path>.1` to `<path>.2`, and pruning files beyond `MAX_FILES`. Run `npm run access-log:rotate -- --path=<file> [--max-files=<n>]` for cron-driven daily rotation, and pair the rotated files with a managed shipper (Vector, Fluent Bit, Promtail/Loki) using the recipes under `docs/deployment/access-log-shipping/`. See `docs/deployment-access-log-shipping.md` for the full rotation, shipping, and SIEM integration guidance.
- Use `npm run jobs:export-workspace -- --workspace-id=<id> > export.json` to produce a redacted per-workspace JSON snapshot for audit handoff, support escalation, or data-subject requests. See `docs/deployment-export-redaction.md` for redaction guarantees and the validation checklist.
- Wire orchestrator health checks to the public probes: `GET /api/health/live` for container liveness checks (no I/O, fixed 200) and `GET /api/health/ready` for load balancer readiness (200 when `loadStore()` resolves cleanly, 503 with a redacted error otherwise). Operators with admin/owner sessions can also call `GET /api/app/operations/status` for a single-call summary of store mode, scheduler leader configuration, jobs queue depth, access-log knobs, and Node version, and `GET /api/app/operations/health` for per-subsystem `ok`/`degraded`/`down`/`disabled` classifications across store, scheduler, and access-log; both are rendered on the Operations page "Production Status" tile. Internal monitoring dashboards that already authenticate as admin can scrape both endpoints alongside the public liveness/readiness probes. See `docs/deployment-health-endpoints.md` for probe wiring guidance and the validation checklist.

Current production guidance still does not add managed database repositories by itself. The app includes an optional HTTP distributed rate-limit adapter, built-in invitation webhook retry jobs, an optional scheduler leader-election gate, built-in access-log rotation with shipping recipes, and public liveness/readiness probes plus an admin operator-status endpoint, but the shared limiter service, scheduler coordinator service, edge provider, external email provider, and managed log retention storage remain deployment-owned. See `docs/deployment-auth-hardening.md`, `docs/deployment-sqlite-topology.md`, `docs/invitation-email-operations.md`, `docs/deployment-export-redaction.md`, `docs/deployment-scheduler-coordination.md`, `docs/deployment-access-log-shipping.md`, and `docs/deployment-health-endpoints.md` for focused deployment checks.

## API Endpoints

Available endpoints include:

- `GET /api/health`
- `GET /api/health/live`
- `GET /api/health/ready`
- `GET /api/app/operations/status`
- `GET /api/app/operations/health`
- `GET /api/app/operations/job-metrics/history`
- `GET /api/app/operations/alerts`
- `GET /api/activation`
- `GET /api/activation/:workspaceId`
- `GET /api/auth/session`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/app/bootstrap`
- `GET /api/app/onboarding`
- `POST /api/app/onboarding/steps/:stepKey/complete`
- `PATCH /api/app/profile`
- `PATCH /api/app/workspace`
- `GET /api/app/members`
- `POST /api/app/invitations`
- `POST /api/app/invitations/:token/accept`
- `PATCH /api/app/members/:userId`
- `DELETE /api/app/members/:userId`
- `GET /api/app/activity`
- `GET /api/app/activity/:id`
- `GET /api/app/agents`
- `POST /api/app/agents`
- `GET /api/app/agents/:agentId`
- `PATCH /api/app/agents/:agentId`
- `DELETE /api/app/agents/:agentId`
- `POST /api/app/agents/:agentId/runs`
- `GET /api/app/agent-templates`
- `POST /api/app/agents/from-template/:templateId`
- `GET /api/app/agent-runs`
- `POST /api/app/agent-runs/:runId/cancel`
- `POST /api/app/agent-runs/:runId/retry`
- `POST /api/app/agent-runs/:runId/record-as-playbook`
- `POST /api/app/agent-runs/:runId/diagnose`
- `GET /api/app/tools`
- `GET /api/app/providers`
- `POST /api/app/providers`
- `PATCH /api/app/providers/:providerId`
- `GET /api/app/env-vars`
- `POST /api/app/env-vars`
- `PATCH /api/app/env-vars/:envVarId`
- `DELETE /api/app/env-vars/:envVarId`
- `GET /api/app/release-history`
- `GET /api/app/api-keys`
- `POST /api/app/api-keys`
- `DELETE /api/app/api-keys/:keyId`
- `GET /api/app/usage/summary`
- `GET /api/app/usage/calls`
- `POST /api/app/llm/stream`
- `POST /api/app/llm/cancel/:streamId`
- `GET /api/app/share`
- `POST /api/app/share`
- `DELETE /api/app/share/:id`
- `GET /api/public/share/:token`
- `GET /api/app/jobs`
- `POST /api/app/jobs`
- `GET /api/app/jobs/:id`
- `POST /api/app/jobs/:id/cancel`
- `POST /api/app/webhooks/agents/:agentId/rotate`
- `DELETE /api/app/webhooks/agents/:agentId`
- `POST /api/public/webhooks/agents/:token`

Workflow route module endpoint shape under `/api/app/workflow`:

- `GET /api/app/workflow`
- `GET /api/app/workflow/brief`
- `PUT /api/app/workflow/brief`
- `GET /api/app/workflow/brief/templates`
- `POST /api/app/workflow/brief/templates/:templateId/apply`
- `GET /api/app/workflow/brief/versions`
- `POST /api/app/workflow/brief/versions/:versionId/restore`
- `GET /api/app/workflow/requirements`
- `PUT /api/app/workflow/requirements`
- `GET /api/app/workflow/plan-items`
- `PUT /api/app/workflow/plan-items`
- `POST /api/app/workflow/plan-items`
- `PATCH /api/app/workflow/plan-items/:itemId`
- `GET /api/app/workflow/blockers-questions`
- `PUT /api/app/workflow/blockers-questions`
- `GET /api/app/workflow/blockers`
- `POST /api/app/workflow/blockers`
- `PATCH /api/app/workflow/blockers/:blockerId`
- `GET /api/app/workflow/questions`
- `POST /api/app/workflow/questions`
- `PATCH /api/app/workflow/questions/:questionId`
- `GET /api/app/workflow/validation-evidence`
- `PUT /api/app/workflow/validation-evidence`
- `POST /api/app/workflow/validation-evidence`
- `PATCH /api/app/workflow/validation-evidence/:evidenceId`
- `GET /api/app/workflow/release-confirmation`
- `PUT /api/app/workflow/release-confirmation`
- `POST /api/app/workflow/release-confirmation`
- `GET /api/app/workflow/templates`
- `POST /api/app/workflow/templates/:templateId/apply`
- `POST /api/app/workflow/generate-from-prompt`
- `POST /api/app/workflow/plan-mode`
- `POST /api/app/workflow/plan-mode/apply`

Workflow endpoints are private app endpoints and require an authenticated session, current workspace membership, and permission-aware route policies. Role semantics are:

- `viewer`: can read workspace data.
- `member`: can read workspace data and edit workflow records.
- `admin`: can read, edit workflow records, and manage workspace settings/operations.
- `owner`: has admin-level workspace and operations management permissions and remains the default seeded workspace role.

Backend route policies are the security boundary. Frontend role-aware controls hide or disable actions for lower roles, but do not replace backend enforcement.

Member-management APIs allow workspace members to be listed by any authenticated workspace member. Invitation list responses return a masked `tokenPreview` and do not include the bearer token; full invitation tokens are returned only on the create and resend responses. Invitations, role updates, and member removals require `admin` or `owner`; only `owner` can grant or modify the `owner` role, and the backend prevents removing or demoting the final workspace owner. Invitation acceptance requires a signed-in user whose email matches the invitation.

Invitation delivery records `invitationEmailDeliveries` rows for create and resend, and responses include an `emailDelivery` summary. The default `TASKLOOM_INVITATION_EMAIL_MODE=dev` records local provider deliveries as `sent`; set `TASKLOOM_INVITATION_EMAIL_MODE=skip` to record them as skipped for local runs that should not simulate sending. Set `TASKLOOM_INVITATION_EMAIL_MODE=webhook` with `TASKLOOM_INVITATION_EMAIL_WEBHOOK_URL` to POST delivery requests to an HTTP provider; `TASKLOOM_INVITATION_EMAIL_PROVIDER` overrides the recorded provider name, optional `TASKLOOM_INVITATION_EMAIL_WEBHOOK_SECRET` plus `TASKLOOM_INVITATION_EMAIL_WEBHOOK_SECRET_HEADER` add a shared-secret header, and `TASKLOOM_INVITATION_EMAIL_WEBHOOK_TIMEOUT_MS` controls the provider request timeout. Webhook configuration errors, timeouts, and non-2xx responses are recorded as failed deliveries without rolling back invitation creation; recorded error strings are redacted before they are stored or returned. Failed webhook create/resend attempts enqueue `invitation.email` retry jobs that resolve the current invitation token at send time and dead-letter as failed jobs after `TASKLOOM_INVITATION_EMAIL_RETRY_MAX_ATTEMPTS` attempts, defaulting to 3. Local testing can still copy the returned invitation token into `POST /api/app/invitations/:token/accept` while signed in as the matching invited email. Production email operations guidance is tracked in `docs/invitation-email-operations.md`.

Set `TASKLOOM_INVITATION_EMAIL_RECONCILIATION_SECRET` to enable the inbound provider-status webhook at `POST /api/public/webhooks/invitation-email`; the route returns `503` until the env is configured. `TASKLOOM_INVITATION_EMAIL_RECONCILIATION_SECRET_HEADER` overrides the header name (default `x-taskloom-reconciliation-secret`). The webhook accepts `{deliveryId, providerStatus, providerDeliveryId?, providerError?, occurredAt?}` payloads with canonical statuses `delivered|bounced|complained|deferred|dropped|failed` plus common provider aliases, applies the latest status to the matching `invitationEmailDeliveries` row, and is safe to retry. See `docs/invitation-email-operations.md` for the wire contract, alias map, and reconciliation CLI flags.

Session cookies are HTTP-only, use `SameSite=Lax`, and are marked `Secure` when `NODE_ENV=production`. Login and registration also set a readable `taskloom_csrf` cookie. Private mutating app routes reject browser requests with an `Origin` host that does not match the request host. `X-Forwarded-Host` participates in that host comparison only when `TASKLOOM_TRUST_PROXY=true`; otherwise the app uses `Host` and does not trust forwarded host headers. Same-origin browser mutations must echo the CSRF cookie in `X-CSRF-Token`. Requests without `Origin`, such as same-process tests and non-browser local clients, are allowed.

Auth register/login and invitation create/accept/resend routes have store-backed rate limits. The default client key is `local`; set `TASKLOOM_TRUST_PROXY=true` to trust `X-Forwarded-For`, then `X-Real-IP`. Stored bucket IDs include a SHA-256 hash salted by `TASKLOOM_RATE_LIMIT_KEY_SALT`, and expired or excess buckets are pruned with `TASKLOOM_RATE_LIMIT_MAX_BUCKETS` defaulting to 5000. Limited responses are `429` with `Retry-After`. In JSON mode the buckets live in `data/taskloom.json`; in SQLite mode they live in dedicated `rate_limit_buckets` storage instead of `app_records`. Phase 15 adds deployment knobs for local-store-backed thresholds: `TASKLOOM_AUTH_RATE_LIMIT_MAX_ATTEMPTS`, `TASKLOOM_AUTH_RATE_LIMIT_WINDOW_MS`, `TASKLOOM_INVITATION_RATE_LIMIT_MAX_ATTEMPTS`, and `TASKLOOM_INVITATION_RATE_LIMIT_WINDOW_MS`. Set `TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL` to call an HTTP shared limiter before the local bucket backstop; optional `TASKLOOM_DISTRIBUTED_RATE_LIMIT_SECRET`, `TASKLOOM_DISTRIBUTED_RATE_LIMIT_TIMEOUT_MS`, and `TASKLOOM_DISTRIBUTED_RATE_LIMIT_FAIL_OPEN` control authentication, timeout, and outage behavior. Multi-process or multi-region production deployments should enable that adapter or equivalent edge/shared coordination before relying on rate limits for abuse prevention.

Production edge/distributed rate-limit guidance, topology caveats, and a validation checklist live in `docs/deployment-auth-hardening.md`.

`GET /api/health/live` is a public, fixed-200 liveness probe that performs no I/O and always returns `{ "status": "live" }`; use it for container orchestrator liveness checks. `GET /api/health/ready` is a public readiness probe that returns `200` with `{ "status": "ready" }` when the local store loads cleanly and `503` with `{ "status": "not_ready", "error": "<redacted>" }` otherwise; use it for load balancer and Kubernetes readiness probes. The pre-existing `GET /api/health` route still returns `{ "ok": true }` for any consumer that depends on the older shape. `GET /api/app/operations/status` is admin-scoped and returns an `OperationsStatus` payload covering store mode, scheduler leader mode/TTL/`leaderHeldLocally`/`lockSummary` (file path or token-stripped URL, never the secret), grouped jobs queue depth, access-log mode/path/`maxBytes`/`maxFiles`, and runtime Node version. The response also includes `jobMetrics` (rolling per-type duration metrics with `lastDurationMs`, `averageDurationMs`, and `p95DurationMs`) so operators can spot scheduler latency regressions without scraping logs. The Operations page renders the same payload as a "Production Status" tile for admins. See `docs/deployment-health-endpoints.md` for probe wiring guidance and the post-deploy validation checklist.

Production deployments should terminate HTTPS before the Node server and run the scheduled `cleanup-sessions` job to remove expired sessions.

Workflow writes update the local workflow records, emit workflow activity, and refresh activation facts used by dashboard and activation views.

Product Workflow Expansion currently includes:

- Workspace brief editing with templates and version restore.
- Requirement and implementation plan capture, including Plan Mode suggestions.
- Blocker and open question tracking.
- Validation evidence capture and release confirmation.
- Prompt-generated workflow drafts that can be previewed or applied.

Share-token routes and frontend wiring exist for `brief`, `plan`, and `overview` scopes. Admins/owners can create and revoke tokens from Settings, viewers can read existing token metadata, and `/share/:token` renders public shared content. Full share tokens are returned only in the create response; list responses expose `tokenPreview` metadata instead of bearer tokens.

## Jobs

Maintenance commands run against the active local store. By default that is `data/taskloom.json`; with `TASKLOOM_STORE=sqlite`, commands use `data/taskloom.sqlite` or `TASKLOOM_DB_PATH`.

```bash
npm run jobs:recompute-activation
npm run jobs:repair-activation
npm run jobs:cleanup-sessions
```

To export a single workspace as a redacted JSON snapshot for audit, support, or data-subject handoffs:

```bash
npm run jobs:export-workspace -- --workspace-id=alpha > export.json
```

The export masks invitation tokens, share tokens, agent webhook tokens, environment variable values, and provider credentials, and passes nested job/run/activity payloads through the shared redaction helpers; see `docs/deployment-export-redaction.md` for the full redaction guarantees and the post-deploy checklist.

To list failed invitation email deliveries and optionally mark them resolved or re-enqueue a Taskloom-side retry:

```bash
npm run jobs:reconcile-invitation-emails -- --workspace-id=alpha
```

Default behavior is read-only. Add `--invitation-id=<id>` or `--delivery-id=<id>` to scope further, `--mark-resolved` to apply a `delivered` provider status without an inbound webhook, or `--requeue` to enqueue a fresh `invitation.email` retry job. See `docs/invitation-email-operations.md` for flag semantics and the inbound provider-status webhook contract.

To rotate the file-mode access log out of band (cron-friendly, exits `0` when the file is missing):

```bash
npm run access-log:rotate -- --path=data/access.log --max-files=10
```

Falls back to `TASKLOOM_ACCESS_LOG_PATH` and `TASKLOOM_ACCESS_LOG_MAX_FILES` when the flags are omitted. See `docs/deployment-access-log-shipping.md` for built-in size-based rotation, stdout-mode shipping, and the Vector/Fluent Bit/Promtail recipes under `docs/deployment/access-log-shipping/`.

To capture a persisted snapshot of the in-memory job metrics so admins can see trends across process restarts:

```bash
npm run jobs:snapshot-metrics -- --retention-days=30
```

Default retention is 30 days; pass `--retention-days=0` to skip pruning, or any positive integer to override the window. Snapshots feed the admin `GET /api/app/operations/job-metrics/history` endpoint and the Operations page sparkline. See `docs/deployment-health-endpoints.md` for cadence guidance and the validation checklist.

To recompute or repair a subset of workspaces:

```bash
node --import tsx src/jobs.ts recompute-activation --workspace-ids=alpha,beta
node --import tsx src/jobs.ts repair-activation-read-models --workspace-ids=alpha,beta
```

The app runtime also starts a lightweight persisted job scheduler. Private job queue routes are available under `/api/app/jobs` for the signed-in workspace:

- `GET /api/app/jobs?status=queued&limit=50` lists recent jobs.
- `POST /api/app/jobs` enqueues a job with `type`, optional `payload`, optional ISO `scheduledAt`, optional five-field `cron`, and optional `maxAttempts`.
- `GET /api/app/jobs/:id` reads one job.
- `POST /api/app/jobs/:id/cancel` requests cancellation, or immediately cancels a queued job.

The registered runtime job type is `agent.run`. A scheduled agent runs when there is a queued `agent.run` job whose payload includes the `agentId`, normally with `triggerKind: "schedule"` and a matching `cron`. After a cron job succeeds, the scheduler enqueues the next occurrence. Agent `schedule` fields are display/configuration metadata; the queue entry is what actually drives execution.

Public webhooks enqueue agent runs through:

```text
POST /api/public/webhooks/agents/:token
```

Webhook tokens are generated or rotated with `POST /api/app/webhooks/agents/:agentId/rotate` and removed with `DELETE /api/app/webhooks/agents/:agentId`. The rotate response is the one-time full-token surface; agent list/detail responses expose only `hasWebhookToken` and `webhookTokenPreview`. A webhook request accepts a JSON body and enqueues an `agent.run` job with `triggerKind: "webhook"`; the response includes `{ accepted: true, jobId }`.

Browser-capable tools are available to agent runs, with operational caveats:

- Browser tools require a run-scoped `runId` and keep one headless browser session per run.
- Playwright is optional; if it or browser binaries are unavailable, browser tool calls return an error instead of launching.
- `browser_goto` only allows `http` and `https` URLs and blocks localhost/private loopback hostnames.
- Screenshots are written under `data/artifacts/:runId/` and served by the app from `/data/artifacts/*`.

## Frontend

Taskloom now uses a React/Vite GUI modeled on the Automate shell and patterns:

- guarded auth routes
- onboarding route
- dashboard shell with sidebar
- settings page
- activity page
- activation detail page
- activity detail page
- workflow page and API client types for brief, requirements, plan items, blockers, questions, validation evidence, release confirmation, templates, prompt-generated drafts, and Plan Mode
- agents, runs, operations, and integrations pages with role-aware controls
- failed-run diagnostics, agent enum options, and Plan Mode wiring in the UI/API seam
- settings share-token management and public `/share/:token` rendering

Key docs:

- `docs/roadmap.md`
- `docs/deployment-auth-hardening.md`
- `docs/deployment-sqlite-topology.md`
- `docs/invitation-email-operations.md`
- `docs/deployment-export-redaction.md`
- `docs/deployment-scheduler-coordination.md`
- `docs/deployment-access-log-shipping.md`
- `docs/deployment-health-endpoints.md`
- `docs/activation/activation-domain.md`
- `docs/activation/activation-signals.md`
- `docs/activation/activation-roadmap.md`

Deployment guidance lives in `README.md#production-deployment-guidance`, `docs/deployment-auth-hardening.md`, `docs/deployment-sqlite-topology.md`, `docs/invitation-email-operations.md`, `docs/deployment-export-redaction.md`, `docs/deployment-scheduler-coordination.md`, `docs/deployment-access-log-shipping.md`, and `docs/deployment-health-endpoints.md`, and is tracked across Phases 16 through 29 in `docs/roadmap.md`.
