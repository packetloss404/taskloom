# Taskloom Roadmap

Taskloom currently has a local activation domain, JSON-backed default storage, an opt-in SQLite app runtime with query-indexed route helpers for high-value records, local SQLite write/concurrency hardening, auth/onboarding/activity/workflow flows, route-level RBAC, invitation/member APIs, local invitation email delivery records with a delivery-adapter seam and webhook retry/dead-letter jobs, proxy-aware same-origin plus CSRF-token mutation checks, deployment-configurable store-backed auth/invitation rate limits with optional HTTP distributed limiter integration, command-driven maintenance jobs, queue-driven agent runs with an opt-in scheduler leader-election gate for multi-process runtimes, public webhook/share links, route/DTO token-redaction enforcement for sensitive list/detail/job/activity/run surfaces, public liveness/readiness probes plus an admin operator-status endpoint, production deployment guidance in `README.md`, `docs/deployment-auth-hardening.md`, `docs/deployment-sqlite-topology.md`, `docs/invitation-email-operations.md`, `docs/deployment-export-redaction.md`, `docs/deployment-scheduler-coordination.md`, `docs/deployment-access-log-shipping.md`, and `docs/deployment-health-endpoints.md`, and a React/Vite interface. The remaining roadmap is mainly about production/deployment implementation hardening and continued workflow polish without losing the clean activation boundaries already in place.

## Current Baseline

- Activation engine, checklist derivation, stage logic, risk calculation, and summary view model are implemented.
- Local file-backed storage lives in `data/taskloom.json` by default; `TASKLOOM_STORE=sqlite` runs the same store API against `data/taskloom.sqlite` or `TASKLOOM_DB_PATH`.
- App services connect auth, workspaces, onboarding, activation, activity, and workflow records.
- Workspace records now include membership rows, workflow briefs, requirements, implementation plan items, blockers/open questions, validation evidence, and release confirmations.
- Public activation endpoints and private app endpoints are available for activation, onboarding, workspace settings, activity, workflows, agents, runs, jobs, providers, API keys, webhooks, usage, LLM calls, and share tokens.
- The workflow route module implements private `/api/app/workflow` endpoints for briefs, templates, versions, requirements, plan items, blockers, questions, validation evidence, release confirmation, prompt-generated drafts, and Plan Mode.
- RBAC defines owner, admin, member, and viewer roles with view workspace data, edit workflow, and manage workspace/operations permissions.
- Private app, workflow, job, agent, provider, env-var, webhook, API-key, usage, LLM, and share routes enforce workspace membership and role-aware permissions.
- Private mutating app routes reject browser requests whose `Origin` host does not match the request host, and same-origin browser mutations must echo the readable `taskloom_csrf` cookie in `X-CSRF-Token`. `X-Forwarded-Host` is trusted for the origin host comparison only when `TASKLOOM_TRUST_PROXY=true`.
- Auth register/login and invitation create/accept/resend routes have store-backed rate limits in the active local store, with deployment knobs for `TASKLOOM_AUTH_RATE_LIMIT_MAX_ATTEMPTS`, `TASKLOOM_AUTH_RATE_LIMIT_WINDOW_MS`, `TASKLOOM_INVITATION_RATE_LIMIT_MAX_ATTEMPTS`, and `TASKLOOM_INVITATION_RATE_LIMIT_WINDOW_MS`. JSON keeps buckets in the default app store; SQLite uses dedicated `rate_limit_buckets` storage. `TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL` optionally calls a shared HTTP limiter before the local bucket backstop for multi-process or multi-region abuse-counter coordination.
- `docs/deployment-auth-hardening.md` documents the optional HTTP distributed limiter protocol, supported app envs, fail-open/fail-closed behavior, multi-process/multi-region caveats, and a validation checklist.
- Invitation webhook email delivery supports `TASKLOOM_INVITATION_EMAIL_WEBHOOK_TIMEOUT_MS` for provider request timeout control and `TASKLOOM_INVITATION_EMAIL_RETRY_MAX_ATTEMPTS` for queued retry attempts. Failed webhook create/resend attempts enqueue token-free `invitation.email` jobs that retry through the scheduler and dead-letter as failed jobs after exhaustion; see `docs/invitation-email-operations.md` for production email operations guidance.
- An optional inbound provider-status webhook at `POST /api/public/webhooks/invitation-email` (gated by `TASKLOOM_INVITATION_EMAIL_RECONCILIATION_SECRET`) records provider-reported delivery status onto `invitationEmailDeliveries` rows, and `npm run jobs:reconcile-invitation-emails` provides a read-only listing plus `--mark-resolved`/`--requeue` flags for stuck deliveries. `docs/invitation-email-operations.md` documents the wire contract, alias map, and CLI flags.
- Token-redaction helpers now mask known invitation/share/webhook tokens, bearer values, token-bearing routes, sensitive assignments, and sensitive object keys across job responses, agent runs, activities, provider errors, invitation delivery errors, share-token lists, invitation lists, webhook token previews, and frontend display paths. Full bearer tokens remain one-time surfaces on invitation create/resend, share-token create, and webhook rotate responses.
- An opt-in Hono access-log middleware writes redacted JSON access lines to stdout or a file based on `TASKLOOM_ACCESS_LOG_MODE`/`TASKLOOM_ACCESS_LOG_PATH`. A `jobs:export-workspace` CLI produces redacted per-workspace JSON snapshots, and `docs/deployment-export-redaction.md` plus `docs/deployment/proxy-access-log-redaction/` cover the proxy-level rewriting story with a validator at `src/security/proxy-access-log-validator.ts`.
- The file-mode access logger now supports built-in rotation through `TASKLOOM_ACCESS_LOG_MAX_BYTES` (default `0` = disabled) and `TASKLOOM_ACCESS_LOG_MAX_FILES` (default `5`), with a manual `npm run access-log:rotate` CLI for cron-driven daily rotation. `docs/deployment-access-log-shipping.md` documents the rotation knobs, the CLI, stdout-mode shipping under supervisors, and recipes for Vector, Fluent Bit, and Promtail/Loki under `docs/deployment/access-log-shipping/`.
- An optional scheduler leader-election gate is configurable through `TASKLOOM_SCHEDULER_LEADER_MODE` (`off|file|http`, default `off`), with `TASKLOOM_SCHEDULER_LEADER_TTL_MS`, `TASKLOOM_SCHEDULER_LEADER_PROCESS_ID`, file-mode `TASKLOOM_SCHEDULER_LEADER_FILE_PATH`, and http-mode `TASKLOOM_SCHEDULER_LEADER_HTTP_URL`/`SECRET`/`TIMEOUT_MS`/`FAIL_OPEN` knobs. `docs/deployment-scheduler-coordination.md` documents the wire protocol, file-mode caveats, and validation checklist.
- Public `GET /api/health/live` and `GET /api/health/ready` probes serve container orchestrator and load balancer health checks; admin `GET /api/app/operations/status` returns an `OperationsStatus` summary covering store mode, scheduler leader, jobs queue depth, access-log knobs, and runtime version. The Operations page renders the same payload as a "Production Status" tile for admins. `docs/deployment-health-endpoints.md` documents the wiring.
- The scheduler now registers a leader probe in `start()`/`stop()` so the operator-status `leaderHeldLocally` field reflects live lock state, and a rolling per-type metrics window (default 50, configurable via `TASKLOOM_SCHEDULER_METRICS_WINDOW_SIZE`) feeds `OperationsStatus.jobMetrics` with `lastDurationMs`/`averageDurationMs`/`p95DurationMs` so the Production Status tile can show scheduler health without log scraping.
- A new admin `GET /api/app/operations/health` endpoint returns per-subsystem `ok`/`degraded`/`down`/`disabled` classifications for store, scheduler, and access-log, derived from a Phase 26 scheduler-tick heartbeat module and existing access-log/store config. The Operations page renders the report as a "Subsystem health" sub-section. `docs/deployment-health-endpoints.md` documents the classification rules.
- Persisted job-metrics snapshots: `npm run jobs:snapshot-metrics` writes per-type snapshots into `data.jobMetricSnapshots` with default 30-day retention; admin `GET /api/app/operations/job-metrics/history` returns them filtered/sorted; the Operations page renders a small sparkline alongside the existing Job metrics table.
- Jobs scripts can recompute activation read models, repair stale activation read models, and clean up expired sessions against the local store.
- Local persistence commands can seed/reset the JSON store, migrate/status/backup/restore SQLite, seed/reset SQLite activation tables, seed/reset full SQLite app data, and backfill SQLite from a JSON store.
- `docs/deployment-sqlite-topology.md` defines the supported local SQLite posture, WAL/`busy_timeout`/`BEGIN IMMEDIATE` guarantees, backup/restore policy, network filesystem caveats, multi-process/multi-region limits, and thresholds for dedicated relational repositories/backfills beyond indexed `app_records`.
- The app runtime starts a persisted job scheduler for queued `agent.run` jobs, including cron re-enqueue after successful runs.
- Public agent webhooks enqueue `agent.run` jobs through tokenized `/api/public/webhooks/agents/:token` requests.
- React pages cover sign-in/sign-up, onboarding, dashboard, settings, activation, workflow, activity/detail, agents, runs, operations, integrations, and public share views.
- The frontend API layer has typed workflow calls for brief, requirements, plan items, blockers, questions, validation evidence, release confirmation, templates, prompt-generated drafts, Plan Mode, share tokens, and public share reads.
- Build, typecheck, and test scripts are available through `npm run build`.
- Local development uses ignored `data/taskloom.json` and `data/taskloom.sqlite` files that are recreated or migrated from built-in seed data and CLI commands.
- README, deployment auth hardening, SQLite topology, invitation email operations, and activation docs cover local development, seed/reset, build, release hygiene flows, and production deployment guidance for the current single-node/local-store posture plus optional shared rate-limit integration.
- Durable activation signal records exist in the local app model for retry and scope-change signals. Runtime snapshots prefer those records and activation-scoped activity events before falling back to legacy activation fact counters, and an app-store activation signal repository now provides JSON and opt-in SQLite list/upsert access with stable-key dedupe and first-class origin metadata.
- SQLite route and local write hardening is implemented for the current local runtime through `app_record_search` metadata, `app_records` workspace indexes, indexed helper functions for auth/session lookup, workspace membership/invitations, share tokens, workflow reads, activities, agents/runs, jobs, providers, and usage calls, and safer `mutateStore()` whole-store writes. SQLite opens with `busy_timeout`, WAL mode, `synchronous=normal`, and `foreign_keys=on`; SQLite `mutateStore()` writes use `BEGIN IMMEDIATE` and fresh state to avoid stale-cache whole-store overwrites. JSON remains the default runtime, and SQLite remains opt-in through `TASKLOOM_STORE=sqlite`.

## Landed In This Branch

### Workflow Records And Services

The JSON store now carries the product workflow records that feed activation:

- `workspaceBriefs`
- `requirements`
- `implementationPlanItems`
- `workflowConcerns`
- `validationEvidence`
- `releaseConfirmations`

Workflow service operations update these records, emit workflow activity events, and set activation facts such as brief captured, requirements defined, plan defined, implementation started, blockers, open questions, validation status, and release confirmation.

### Workflow API Shape

The workflow route module exposes private endpoints under `/api/app/workflow`:

- `GET /`
- `GET|PUT /brief`
- `GET|PUT /requirements`
- `GET|PUT|POST /plan-items`
- `PATCH /plan-items/:itemId`
- `GET|PUT /blockers-questions`
- `GET|POST /blockers`
- `PATCH /blockers/:blockerId`
- `GET|POST /questions`
- `PATCH /questions/:questionId`
- `GET|PUT|POST /validation-evidence`
- `PATCH /validation-evidence/:evidenceId`
- `GET|PUT|POST /release-confirmation`
- `GET /brief/templates`
- `POST /brief/templates/:templateId/apply`
- `GET /brief/versions`
- `POST /brief/versions/:versionId/restore`
- `GET /templates`
- `POST /templates/:templateId/apply`
- `POST /generate-from-prompt`
- `POST /plan-mode`
- `POST /plan-mode/apply`

These routes require an authenticated session, current workspace membership, and the route-specific permission for read or write actions.

### Route-Level RBAC And Membership Enforcement

Phase 7 is implemented in this branch. Private app APIs now require an authenticated session plus workspace membership, with route-level role checks:

- `viewer`: can view workspace data.
- `member`: can view workspace data and edit workflow records or run member-level actions.
- `admin`: can view, edit workflow records, and manage workspace settings, operations, agents, providers, env vars, jobs, API keys, and webhooks.
- `owner`: has admin-level workspace and operations management permissions and remains the seeded default membership role.

Backend route policies are the security boundary. Frontend role-aware controls hide or disable actions for lower roles, but do not replace backend enforcement.

### Jobs

Two maintenance commands are available:

- `npm run jobs:recompute-activation`
- `npm run jobs:repair-activation`
- `npm run jobs:cleanup-sessions`

The recompute job refreshes activation read models and milestone records for every workspace by default, with `--workspace-ids=alpha,beta` for targeted runs. The repair job reports stale read models it changed. The cleanup job removes expired or invalid sessions.

### Automation Scheduling And Operations

Phase 4 automation operations now have documented queue and webhook behavior:

- Private job queue routes live under `/api/app/jobs` for listing, enqueueing, reading, and canceling jobs in the signed-in workspace.
- Runtime scheduling is queue-driven. Active scheduled agents need a queued `agent.run` job with matching `cron`; the agent `schedule` field is metadata and does not start runs by itself.
- Successful cron jobs re-enqueue their next occurrence. Failed jobs retry with backoff until `maxAttempts`, and stale running jobs are swept back to queued on scheduler startup.
- Public webhook delivery is `POST /api/public/webhooks/agents/:token`; token rotation/removal lives under `/api/app/webhooks/agents/:agentId`.
- Seed data includes queued cron jobs for the active scheduled Alpha agents and leaves the paused Beta scheduled agent without an active queued job.

Browser tools are available to agent runs but remain operationally constrained: they require a run-scoped `runId`, depend on optional Playwright/browser binaries, block localhost/loopback navigation, and write screenshots under `data/artifacts/:runId/`.

### Product Workflow Expansion

Phase 5 product workflow surfaces are now wired through the private workflow API and React API client:

- Brief editor support includes reusable brief templates and brief version restore.
- Requirements, implementation plan items, blockers, open questions, validation evidence, and release confirmation write durable local records and activation facts.
- Workflow templates can seed a brief, requirements, and plan items together.
- Prompt-generated workflow drafts can be previewed or applied; applied drafts persist the LLM-shaped brief, requirements, and plan items.
- Plan Mode can suggest implementation plan items from the current brief and requirements, then apply those items back into the workflow plan.
- Agent input schemas support `string`, `number`, `boolean`, `url`, and `enum`; enum inputs require at least one option.
- Runs expose telemetry, logs, tool-call timelines, retry/cancel actions, playbook recording, and failed-run diagnostics.

Dashboard filtering and richer activity detail views are present in the UI/API seam, with backend activity context available for workflow-related events.

Share-token routes and frontend wiring exist for `brief`, `plan`, and `overview` scopes. Settings can list/create/revoke tokens, and `/share/:token` renders the public brief/plan/overview payload.

### Dev And Release Hygiene

Phase 6 dev and release hygiene is now in place:

- `README.md` documents prerequisites, dev server ports, seed accounts, local data reset, activation recompute, session cleanup, build checks, and release handoff hygiene.
- `docs/activation/*` describes the current activation boundary, signal mapping, and remaining persistence/backfill work without stale PR-only framing.
- Backend API route coverage now exercises auth/session/workspace/onboarding, member/invitation management, private activation/activity scoping, workflow route validation and permissions, jobs, DB CLI helpers, API keys, LLM route authorization, and public/private webhook behavior.
- Frontend smoke tests cover auth, onboarding, dashboard, activation, role-aware workspace controls, Plan Mode wiring, agent enum options, integrations gating, run diagnostics, and share-token/public-share wiring.
- Generated local artifacts remain ignored: `data/taskloom.json`, `data/artifacts/`, `web/dist/`, logs, and environment files.
- Vite outputs to `web/dist/` with `emptyOutDir: true`; generated web assets stay out of source control unless packaging policy changes.

### Phase 10 Activation Signal Repository And Idempotency

Phase 10 is implemented for the current app-store runtime:

- `activationSignals` is part of the JSON app model and is persisted through the opt-in SQLite app runtime because SQLite currently stores full app data in `app_records`.
- `activationSignalRepository()` provides normalized list/upsert access for JSON and SQLite modes; the SQLite implementation uses `app_records` plus activation-signal indexes/search metadata rather than a dedicated relational signal table.
- `source` identifies the producer category, such as `seed`, `workflow`, `agent_run`, `activity`, `user_fact`, or `system_fact`; `origin` separately identifies user-entered versus system-observed records.
- Retry actions write durable `retry` records with `source: "agent_run"`, `origin: "user_entered"`, the failed run as `sourceId`, stable-key dedupe, and stable activation activity ids.
- Brief scope changes write durable `scope_change` records with `source: "workflow"`, `origin: "user_entered"`, the brief version as `sourceId`, stable-key dedupe, and stable activation activity ids.
- Recompute jobs normalize legacy retry/scope-change counters into durable `user_fact` signals idempotently when no durable signal records exist for that kind.

### Phase 11 Query-Optimized SQLite Route Hardening

Phase 11 is implemented for the high-value routes that were still doing broad JSON-payload reads in SQLite mode:

- SQLite still persists app collections in `app_records`, but migrations `0005_app_record_search.sql` and `0007_workspace_app_record_reads.sql` add sidecar search metadata plus workspace/read-order indexes for records repeatedly needed by route security, workflow reads, operations, and public token flows.
- Indexed helpers now cover user lookup by id/email, session lookup/listing, workspace membership lookup/listing, invitation lookup/listing, share-token lookup/listing, workflow records, activity detail context, agents/runs, jobs, providers, and provider-call usage summaries.
- Route hardening in this codebase means those hot paths can use SQLite-indexed metadata or collection/workspace indexes in opt-in SQLite mode while preserving the same JSON-backed store API and behavior in default JSON mode.
- The app is not yet split into fully relational repositories for every collection; relational backfills remain future work only if later phases move high-value records out of `app_records` into dedicated tables.
- Coverage now includes direct helper synchronization checks plus JSON-default versus SQLite-opt-in route parity for auth/session, invitation listing, workflow, jobs, agents, and share-token public/private reads.

### Phase 13 Auth/Invitation Hardening Documentation And Parity

Phase 13 is landed for the local runtime, with webhook invitation delivery and hashed rate-limit buckets in place. Later phases add deployment knobs, proxy-aware origin checks, documentation, and optional distributed limiter integration:

- Invitation create, accept, resend, and revoke APIs are present. Create/resend record `invitationEmailDeliveries` rows and return an `emailDelivery` summary. `TASKLOOM_INVITATION_EMAIL_MODE=dev` records local sent deliveries, `skip` records skipped deliveries, and `webhook` posts delivery requests to `TASKLOOM_INVITATION_EMAIL_WEBHOOK_URL` with optional provider name and shared-secret header configuration. Delivery adapter and webhook failures are recorded without rolling back invitation state. Phase 18 adds built-in webhook retry/dead-letter jobs; token-redaction expectations are documented in `docs/invitation-email-operations.md`.
- Invitation acceptance requires a signed-in user whose normalized email matches the invitation. Revoked, expired, accepted, and stale rotated tokens are rejected.
- Store-backed rate limiting covers auth register/login and invitation create/accept/resend with 20 attempts per client key per 60 seconds. Buckets use `local` by default, trust forwarded IP headers only when `TASKLOOM_TRUST_PROXY=true`, and store salted SHA-256 bucket IDs. Buckets stay in JSON for the default runtime; after Phase 14, SQLite mode keeps them in dedicated `rate_limit_buckets` storage. Phase 15 adds deployment environment knobs for thresholds and windows.
- CSRF behavior is a same-origin `Origin` host check plus double-submit token for browser mutations. Login/register set `taskloom_csrf`; same-origin browser mutations must send `X-CSRF-Token`; requests without `Origin` are allowed for local clients/tests.
- Runtime parity coverage now checks JSON-default and SQLite-opt-in behavior for session reads, invitation create/list/resend/revoke/revoked-token rejection, local delivery rows including skip mode, share-token reads, CSRF rejection, cross-origin mutation rejection, and rate-limit bucket persistence.

### Phase 14 SQLite Local Storage And Concurrency Hardening

Phase 14 is landed for the opt-in local SQLite runtime. It makes SQLite safer for local concurrent writers without claiming distributed or production-grade multi-process coordination:

- SQLite connections open with `busy_timeout`, WAL mode, `synchronous=normal`, and `foreign_keys=on`.
- SQLite `mutateStore()` writes use `BEGIN IMMEDIATE` and reload fresh store state inside the write transaction before writing changed collections, avoiding stale-cache whole-store overwrites when another local writer has committed newer state.
- Auth and invitation rate-limit buckets use dedicated SQLite `rate_limit_buckets` storage in SQLite mode instead of `app_records`; JSON mode remains unchanged and keeps buckets in the default JSON app store.
- The hardening targets local SQLite runtime correctness and parity. Later phases add deployment-specific abuse controls and guidance, including optional distributed rate-limit integration, while broader production storage topology choices remain future work.

### Phase 15 Production/Deployment Auth Hardening

Phase 15 hardens deployment-facing auth configuration beyond the earlier local defaults, before Phase 17 adds optional distributed limiter integration:

- Auth route rate limits are configurable through `TASKLOOM_AUTH_RATE_LIMIT_MAX_ATTEMPTS` and `TASKLOOM_AUTH_RATE_LIMIT_WINDOW_MS`.
- Invitation route rate limits are configurable through `TASKLOOM_INVITATION_RATE_LIMIT_MAX_ATTEMPTS` and `TASKLOOM_INVITATION_RATE_LIMIT_WINDOW_MS`.
- Invitation webhook delivery timeout is configurable through `TASKLOOM_INVITATION_EMAIL_WEBHOOK_TIMEOUT_MS`, with failures recorded without rolling back invitation state.
- CSRF origin validation is proxy-aware: `X-Forwarded-Host` is trusted only when `TASKLOOM_TRUST_PROXY=true`; otherwise origin checks compare against `Host`.
- Rate-limit buckets remain local-store backed. Phase 16 adds full production topology guidance, and Phase 17 adds optional distributed rate-limit integration; email delivery operations are tracked separately in `docs/invitation-email-operations.md`.

### Phase 16 Production Deployment Guidance

Phase 16 lands documentation for production deployment handoff in `README.md#production-deployment-guidance`, focused auth/proxy/rate-limit checks in `docs/deployment-auth-hardening.md`, SQLite/database topology guidance in `docs/deployment-sqlite-topology.md`, and invitation email operations guidance in `docs/invitation-email-operations.md`. It defines the recommended posture for the current runtime without claiming new runtime capabilities:

- HTTPS termination and `NODE_ENV=production` cookie expectations.
- Proxy trust boundaries for `TASKLOOM_TRUST_PROXY` and forwarded host/IP headers.
- Secret handling for rate-limit salts, invitation webhook secrets, provider credentials, and environment files.
- Single-node SQLite persistence guidance with durable `TASKLOOM_DB_PATH`, persistent artifacts, backups, restore validation, network-filesystem caveats, and session cleanup scheduling.
- Scheduler constraints for the current local store: run one scheduler-active Node process unless external job coordination is added.
- Abuse-protection limits at that point: built-in auth/invitation buckets remained process/store scoped, so multi-process or multi-region deployments needed edge/shared distributed rate limiting; `docs/deployment-auth-hardening.md` now captures supported env knobs, optional distributed limiter integration, topology caveats, and validation checks.
- Invitation webhook operational requirements are tracked separately in `docs/invitation-email-operations.md`.
- Public share/webhook token, API-key, environment-variable, and audit/redaction review expectations for production handoff.

This phase itself is documentation-only. Later phases own implementation work such as distributed limiter integration, distributed locking, managed database repositories, email delivery workers, and broader token-redaction enforcement.

### Phase 17 Optional Distributed Rate Limiter Integration

Phase 17 implements the first production hardening item beyond documentation by adding an optional HTTP distributed rate-limit adapter for auth and invitation routes:

- `TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL` enables a shared limiter call before the local JSON/SQLite bucket backstop.
- The app sends hashed bucket ids, route scope, max attempts, window, and timestamp; it does not send raw client IPs to the limiter.
- `TASKLOOM_DISTRIBUTED_RATE_LIMIT_SECRET` adds an optional bearer secret, and `TASKLOOM_DISTRIBUTED_RATE_LIMIT_TIMEOUT_MS` controls the request timeout.
- Distributed limiter `429`, `{ "limited": true }`, or `{ "allowed": false }` responses return app-level `429` with `Retry-After` before local buckets are updated.
- Limiter outages fail closed with `503 rate limit service unavailable` by default; `TASKLOOM_DISTRIBUTED_RATE_LIMIT_FAIL_OPEN=true` allows requests to continue through the local bucket backstop.
- The existing local JSON/SQLite buckets remain enabled and continue to provide a final process/store-scoped guardrail when the distributed limiter allows or fail-open behavior is configured.

This phase does not add a hosted limiter service, distributed locking, managed database repositories, email delivery workers, scheduler leader election, or broader token-redaction enforcement.

### Phase 18 Invitation Email Retry And Dead-Letter Hardening

Phase 18 implements the next production hardening item by giving webhook invitation email delivery a Taskloom-owned retry/dead-letter path on top of the existing delivery audit rows:

- Failed webhook create/resend attempts enqueue persisted `invitation.email` jobs after recording the failed delivery row.
- Retry job payloads store `invitationId`, action, and requesting user id only; invitation tokens and recipient emails are intentionally excluded.
- Retry handlers resolve the current invitation token at send time, so resend token rotation does not leave stale tokens in queued job payloads.
- `TASKLOOM_INVITATION_EMAIL_RETRY_MAX_ATTEMPTS` controls queued retry attempts, defaulting to 3.
- Scheduler retry backoff and final `failed` job status provide the dead-letter path for exhausted app-side retries.
- Retries skipped because an invitation was accepted, revoked, or expired write a `skipped` delivery row instead of sending a stale invitation email.

This phase does not add a managed external email provider, provider-side dead-letter tooling, scheduler leader election for multi-process runtimes, or broader token-redaction enforcement.

### Phase 19 Token Redaction Enforcement

Phase 19 implements the first broad token-redaction pass across API DTOs, persisted error records, and frontend display paths:

- Invitation member lists now return `tokenPreview` without full invitation tokens; create and resend responses remain the one-time full-token surfaces.
- Share-token lists now return masked previews; share-token create responses remain the one-time full-token surface used to build the public link.
- Agent list/detail responses no longer expose stored webhook tokens and instead return `hasWebhookToken` plus `webhookTokenPreview`; webhook rotation remains the one-time full-token surface.
- Job route responses redact sensitive payload, result, and error fields, while stored job payloads remain available for scheduler execution.
- Scheduler, invitation delivery, provider ledger, LLM stream, app, webhook, and server error paths redact bearer values and token-bearing URLs before returning or recording error text.
- Agent run and activity DTOs redact sensitive fields before returning list/detail responses.
- Frontend Settings and Agent Editor views show full tokens only immediately after create/resend/rotate flows and otherwise display masked previews.

This phase does not add a general-purpose export redaction pipeline, reverse-proxy access-log rewriting, managed database topology, external scheduler coordination, or managed external provider operations.

### Phase 20 Export And Access-Log Redaction Controls

Phase 20 implements the next broad redaction pass beyond app-level DTOs by adding in-app access logging with built-in redaction, a workspace export redaction pipeline, and reverse-proxy access-log rewriting templates plus a validator:

- An optional Hono access-log middleware writes one JSON line per request to stdout or a file with the request path/query passed through `redactSensitiveString`. It is configurable via `TASKLOOM_ACCESS_LOG_MODE` (`stdout|file|off`, default `off`) and `TASKLOOM_ACCESS_LOG_PATH`, captures method/status/duration/userId/workspaceId/requestId, and intentionally omits request and response bodies.
- A `jobs:export-workspace` CLI command produces a per-workspace JSON snapshot with invitation tokens, share tokens, agent webhook tokens, env-var values, and provider credentials replaced by `*Preview` masked values, and remaining nested job/run/activity payloads passed through `redactSensitiveValue`.
- Reverse-proxy access-log rewriting examples for nginx, Caddy, and Apache live under `docs/deployment/proxy-access-log-redaction/`, with a Taskloom-shipped validator at `src/security/proxy-access-log-validator.ts` that scans a log file for raw bearer/whk_/share/invitation-accept/webhook tokens and sensitive query parameters and exits non-zero on a hit.
- `docs/deployment-export-redaction.md` documents configuration, redaction guarantees, validation cadence, and the post-deploy checklist.

This phase does not add a request-body access log, managed log shipping/retention, automated scheduled exports, managed database topology, external scheduler coordination, or managed external provider operations.

### Phase 21 External Scheduler Coordination

Phase 21 implements the next production hardening item by adding opt-in leader election to the local job scheduler so multi-process and multi-host deployments stop double-executing jobs:

- A `SchedulerLeaderLock` interface with `acquire()`, `release()`, and `isHeld()` methods gates the scheduler poll loop. The default `noopLeaderLock` keeps single-process behavior identical to today.
- `TASKLOOM_SCHEDULER_LEADER_MODE=file` selects an atomic file-based lock at `TASKLOOM_SCHEDULER_LEADER_FILE_PATH` (default `data/scheduler-leader.json`) for multi-process runtimes on a single host with a local filesystem.
- `TASKLOOM_SCHEDULER_LEADER_MODE=http` selects an HTTP coordinator client. The client POSTs `{processId, ttlMs, timestamp}` to `<TASKLOOM_SCHEDULER_LEADER_HTTP_URL>/acquire` and `<url>/release`, accepts `200 {leader: bool}` or `{acquired: bool}` responses, treats 401/403 as a config error, and fails closed on network/timeout errors. `TASKLOOM_SCHEDULER_LEADER_HTTP_SECRET` adds an optional bearer header; `TASKLOOM_SCHEDULER_LEADER_HTTP_TIMEOUT_MS` (default 5000) caps each request; `TASKLOOM_SCHEDULER_LEADER_HTTP_FAIL_OPEN=true` opts into preserving the prior leader belief on coordinator outages.
- `TASKLOOM_SCHEDULER_LEADER_TTL_MS` (default 30000) and `TASKLOOM_SCHEDULER_LEADER_PROCESS_ID` (default `${hostname}-${pid}-${randomShortHex}`) tune lock takeover latency and identify each process.
- The scheduler skips dequeues on a tick where `acquire()` returns false, never interrupts in-flight jobs, and calls `release()` on graceful stop so the next poller takes over without waiting for TTL expiry.
- `docs/deployment-scheduler-coordination.md` documents the wire protocol, file-mode caveats, multi-process operating guidance, and the post-deploy validation checklist.

This phase does not ship a hosted coordinator service, leader-aware in-flight job migration, managed database topology, dedicated relational repositories, managed external email provider operations, managed log shipping, or scheduled-export automation.

### Phase 22 Managed External Email Provider Operations

Phase 22 implements the next production hardening item by giving operators an inbound provider-status reconciliation surface and a replay/reconciliation CLI on top of the Phase 18 outbound retry jobs:

- A new public route `POST /api/public/webhooks/invitation-email` accepts `{deliveryId, providerStatus, providerDeliveryId?, providerError?, occurredAt?}` payloads from the external email provider or webhook worker. Auth is bearer via `TASKLOOM_INVITATION_EMAIL_RECONCILIATION_SECRET` (required to enable; absent returns 503), with the header name configurable via `TASKLOOM_INVITATION_EMAIL_RECONCILIATION_SECRET_HEADER` (default `x-taskloom-reconciliation-secret`).
- The route accepts canonical statuses `delivered|bounced|complained|deferred|dropped|failed` plus common provider aliases (`delivery`, `hard_bounce`, `soft_bounce`, `complaint`, `spam`, `defer`, `drop`, `fail`, `error`). `providerError` is passed through `redactedErrorMessage` before storage so bearer tokens or token-bearing URLs in provider errors do not leak into delivery rows.
- `InvitationEmailDeliveryRecord` gains optional `providerStatus`, `providerDeliveryId`, `providerStatusAt`, and `providerError` fields. The schema change is additive; SQLite already persists these inside the existing `app_records` JSON payload so no migration is required.
- `npm run jobs:reconcile-invitation-emails` lists `failed` deliveries grouped by recency with workspace/invitation/delivery filters. `--delivery-id=<id> --mark-resolved` applies a provider `delivered` status without an inbound webhook; `--delivery-id=<id> --requeue` enqueues a fresh Taskloom-side `invitation.email` retry job. Retry payloads continue to omit the invitation token and recipient email per the Phase 18 invariant.
- `docs/invitation-email-operations.md` documents the inbound webhook contract, the CLI flags, the alias map, and the redaction posture for `providerError`.

This phase does not ship a hosted reconciliation service, automated provider-status polling, dedicated relational repositories for delivery rows, managed log shipping, or scheduled-export automation.

### Phase 23 Access-Log Shipping And Retention Hardening

Phase 23 implements the next production hardening item by giving the Phase 20 file-mode access logger built-in rotation, an operator rotation CLI, and shipping recipes for common log destinations:

- The file-mode access logger now rotates when `TASKLOOM_ACCESS_LOG_MAX_BYTES` (default `0` = disabled) is set. On rotation, `<path>` shifts to `<path>.1` and prior numbered files cascade up to `TASKLOOM_ACCESS_LOG_MAX_FILES` (default `5`, clamp to >= 1); older files are pruned. Rotation runs before writing a line that would exceed the threshold so the active file always stays under the cap.
- `npm run access-log:rotate -- --path=<file> [--max-files=<n>]` triggers a rotation out of band (cron-friendly: exits 0 when the file is missing). Falls back to `TASKLOOM_ACCESS_LOG_PATH` and `TASKLOOM_ACCESS_LOG_MAX_FILES` env knobs when flags are omitted.
- Example shipper configs under `docs/deployment/access-log-shipping/` cover Vector (`vector.toml.example`), Fluent Bit (`fluent-bit.conf.example`), and Promtail/Loki (`promtail.yaml.example`).
- `docs/deployment-access-log-shipping.md` documents the rotation env knobs, manual CLI, stdout-mode shipping for supervised runtimes, the three shipper recipes, SIEM integration notes, and a validation checklist that pairs with `src/security/proxy-access-log-validator.ts`.

This phase does not ship managed log retention storage, hosted shipping infrastructure, content-based redaction enrichment, multi-process rotation coordination beyond `EBUSY` skip-and-retry semantics, managed database topology, or dedicated relational repositories.

### Phase 24 Operational Status And Health Endpoints

Phase 24 implements the next operator-visibility hardening item by adding public liveness/readiness probes for orchestrators and an admin operator-status endpoint that summarizes runtime configuration and queue state in a single call:

- `GET /api/health/live` is a public, fixed-200 liveness probe that does no I/O. Suitable for container orchestrator liveness checks.
- `GET /api/health/ready` is a public readiness probe that returns 200 when `loadStore()` resolves cleanly and 503 with a redacted error otherwise. Suitable for load balancer readiness checks and blue/green deploys.
- The existing `GET /api/health` route returning `{ "ok": true }` is preserved unchanged for any existing consumer.
- `GET /api/app/operations/status` (admin-scoped) returns a structured `OperationsStatus` payload covering store mode, scheduler leader mode and TTL, jobs queue depth grouped by type and status, access-log mode/path/rotation knobs, and runtime Node version. The `lockSummary` field reports the configured leader file path or http URL with any query string stripped, never the secret.
- The frontend Operations page renders the operator-status payload as an admin-gated "Production Status" tile so operators can spot store/scheduler/access-log misconfiguration without SSHing.
- `docs/deployment-health-endpoints.md` documents the probe wiring, the response shapes, the `leaderHeldLocally` limitation, and the post-deploy validation checklist.

This phase does not ship managed monitoring/alerting, request-rate or latency histograms, leader-state probes wired into the scheduler, managed database topology, or dedicated relational repositories.

### Phase 25 Scheduler Leader Probe And Per-Type Job Metrics

Phase 25 closes the Phase 24 limitation that `leaderHeldLocally` was always `false` for `file`/`http` scheduler modes, and adds rolling per-type job-duration metrics so the operator-status endpoint and Operations tile can summarize scheduler health without scraping logs:

- `JobScheduler.start()` now registers a probe with `__setSchedulerLeaderProbe(() => this.leaderLock.isHeld())` and clears it in `stop()`. The `OperationsStatus.scheduler.leaderHeldLocally` field now reflects the live `SchedulerLeaderLock` state when the scheduler is running.
- A new `src/jobs/scheduler-metrics.ts` module records per-type job runs in a rolling window (configurable via `TASKLOOM_SCHEDULER_METRICS_WINDOW_SIZE`, default `50`). The scheduler calls `recordJobRun` on each terminal outcome (`success`, `failed`, `canceled`); the retry-back-to-queued path does not record so retried-and-eventually-succeeded jobs aren't double counted.
- `OperationsStatus` gains a `jobMetrics: JobTypeMetrics[]` field with `totalRuns`, per-status counters, `lastRunStartedAt`/`lastRunFinishedAt`/`lastDurationMs`, and `averageDurationMs`/`p95DurationMs` computed over success runs only so a failure flood does not poison the latency metric. The metrics live in process memory and reset on restart by design.
- The Operations page "Production Status" tile renders the new `jobMetrics` payload as a small per-type table next to the existing queue-depth table.
- `docs/deployment-health-endpoints.md` documents the new field and refreshes the `leaderHeldLocally` notes.

This phase does not ship persisted historical job latency, SLO/SLA dashboards, alerting integration, scheduler-side circuit breakers, managed database topology, or dedicated relational repositories.

### Phase 26 Subsystem Health Probes

Phase 26 implements the next operator-visibility hardening item by adding per-subsystem health classifications to a dedicated admin endpoint and a complementary frontend tile, complementing the binary public readiness probe with actionable diagnostic detail:

- A new `src/jobs/scheduler-heartbeat.ts` module records `recordSchedulerStart`/`recordSchedulerStop`/`recordTickStart`/`recordTickEnd` so the operator-health helper can detect "scheduler has stopped polling" silently. The scheduler integration calls these from `start()`, `stop()`, and a try/finally around the existing `tick()` body.
- A new `src/operations-health.ts` helper computes per-subsystem `SubsystemHealth { name, status, detail, checkedAt, observedAt? }` for store, scheduler, and access-log, plus an `overall` worst-of classification with the rule that `disabled` never poisons overall.
- A new admin route `GET /api/app/operations/health` exposes the report. Returns 200 regardless of subsystem status; auth failures return 401/403.
- The Operations page "Production Status" tile renders the new payload as a "Subsystem health" sub-section with colored badges per subsystem and an overall summary.
- `docs/deployment-health-endpoints.md` documents the wire shape, classification rules, validation snippets, and the relationship to the existing `/api/health/ready` probe.

This phase does not ship subsystem-specific recovery actions, automated remediation, alerting integration, hosted health-check infrastructure, managed database topology, or dedicated relational repositories.

### Phase 27 Persisted Job Metrics History

Phase 27 implements the next operator-visibility hardening item by adding durable snapshots of the Phase 25 in-memory job metrics so admins can see trends across process restarts:

- A new `src/jobs/job-metrics-snapshot.ts` module exposes `snapshotJobMetrics({ retentionDays? })` (default 30-day retention), `listJobMetricSnapshots({ type?, since?, until?, limit? })` (sorted ascending by `capturedAt`, default limit 100, capped at 500), and `pruneJobMetricSnapshots({ retentionDays })` for explicit retention runs.
- A new `JobMetricSnapshotRecord` type is added to the store with `id`, `capturedAt`, and the same per-type rolling-window fields the in-memory metrics expose. The new `jobMetricSnapshots` collection lives in `app_records` JSON, so SQLite mode requires no migration.
- A new admin route `GET /api/app/operations/job-metrics/history` returns persisted snapshots with `type`/`since`/`until`/`limit` filters; invalid timestamps return 400.
- A new `npm run jobs:snapshot-metrics -- [--retention-days=<n>]` CLI captures a snapshot and prunes older rows in one call. The in-memory metrics are not cleared.
- The Operations page renders a small SVG sparkline alongside the existing Job metrics table so admins see the recent trend without leaving the page.
- `docs/deployment-health-endpoints.md` documents the wire shape, CLI usage, recommended cadence/retention, and the validation checklist.

This phase does not ship automated snapshot scheduling inside the Node process, SLO/SLA dashboards, alerting integration, downsampled long-term retention, managed database topology, or dedicated relational repositories.

## Roadmap

Status markers: `[x]` is landed in this branch; `[ ]` remains future or ongoing work.

### 1. Persistence Foundation

Replace the JSON-only runtime with a database-backed persistence layer while keeping activation logic storage-agnostic.

- [x] Add migration tooling around the existing activation schema.
- [x] Extend the existing JSON-backed model into SQLite migrations for users, sessions, memberships, invitations, workspaces, workflow records, onboarding state, activities, activation facts, milestones, activation read models, agents, jobs, provider calls, and share tokens.
- [x] Add an opt-in SQLite-backed runtime behind the existing `loadStore()` / `mutateStore()` surface.
- [x] Harden high-value SQLite route reads with query-indexed helpers while keeping JSON-payload `app_records` as the local compatibility layer.
- [x] Harden local SQLite mutating writes with `BEGIN IMMEDIATE`, fresh in-transaction state, and connection pragmas for `busy_timeout`, WAL, `synchronous=normal`, and `foreign_keys=on`.
- [x] Add formal seed and reset commands for local development.
- [x] Add JSON-to-SQLite app backfill commands.
- [x] Add local SQLite migration status plus validated backup/restore commands. Executable rollback remains intentionally unsupported; restore from a pre-migration backup is the rollback strategy.
- [x] Document the production deployment posture for the current JSON-default and single-node SQLite runtime, including persistence, backups, restore validation, network-filesystem caveats, relational-repository thresholds, and scheduler constraints.
- [x] Preserve deterministic activation recalculation for the local JSON runtime and SQLite activation seed path.

### 2. Auth And RBAC

Expand local auth from a single-owner workspace flow into a workspace membership model.

- [x] Apply owner/admin/member/viewer RBAC to private route policies.
- [x] Enforce workspace membership before workspace reads, workflow edits, or operational mutations.
- [x] Add backend invitation and member management APIs.
- [x] Add invitation email delivery recording for create/resend, including local dev/skip modes, webhook delivery, and failed delivery records.
- [x] Add webhook invitation email retry jobs and failed-job dead-letter behavior without storing invitation tokens in retry payloads.
- [x] Add session cleanup for expired sessions.
- [x] Document production session cookie behavior and cleanup expectations.
- [x] Add store-backed rate limiting for auth and invitation routes in JSON default and SQLite opt-in modes.
- [x] Keep SQLite rate-limit buckets in dedicated `rate_limit_buckets` storage while leaving the JSON default store shape unchanged.
- [x] Add local same-origin and CSRF-token checks for private app browser mutations.
- [x] Add deployment-specific auth/invitation rate-limit knobs, invitation webhook timeout control, and proxy-aware CSRF origin handling where `X-Forwarded-Host` is trusted only with `TASKLOOM_TRUST_PROXY=true`.
- [x] Document production deployment guidance for HTTPS/proxy trust, secrets, local-store rate-limit limits, edge/distributed limiter pairing expectations, persistence, backups, and scheduler constraints. Invitation email operations are cross-linked separately.
- [x] Add optional HTTP distributed rate-limit integration for auth and invitation routes before the local process/store-scoped bucket backstop.
- [x] Add route/DTO token-redaction enforcement for invitation/share/webhook tokens, API-key-like fields, environment variable display paths, jobs, activities, agent runs, provider errors, and invitation delivery errors.
- [x] Add export and access-log redaction controls beyond app-level DTO redaction through Phase 20: an opt-in Hono access-log middleware with built-in path/query redaction, a `jobs:export-workspace` CLI with masked tokens/credentials/env-var values and `redactSensitiveValue` for nested payloads, reverse-proxy access-log rewriting templates under `docs/deployment/proxy-access-log-redaction/`, and a `src/security/proxy-access-log-validator.ts` scanner for rotated proxy logs.
- [x] Add an opt-in scheduler leader-election gate so multi-process or multi-host deployments stop double-executing jobs, with `off`/`file`/`http` modes selectable via `TASKLOOM_SCHEDULER_LEADER_MODE` and the wire protocol, file-mode caveats, and validation checklist documented in `docs/deployment-scheduler-coordination.md`.
- [x] Add managed external email provider operations beyond the Phase 18 outbound retry jobs through Phase 22: an inbound provider-status webhook at `POST /api/public/webhooks/invitation-email` gated by `TASKLOOM_INVITATION_EMAIL_RECONCILIATION_SECRET`, additive `providerStatus`/`providerDeliveryId`/`providerStatusAt`/`providerError` fields on `InvitationEmailDeliveryRecord`, and a `jobs:reconcile-invitation-emails` CLI with read-only listing plus `--mark-resolved`/`--requeue` actions. See `docs/invitation-email-operations.md`.
- [x] Add managed log shipping, retention, and SIEM integration around the Phase 20 access-log middleware through Phase 23: built-in size-based rotation through `TASKLOOM_ACCESS_LOG_MAX_BYTES`/`TASKLOOM_ACCESS_LOG_MAX_FILES`, an out-of-band `npm run access-log:rotate` CLI for cron-driven rotation, example shipper configs under `docs/deployment/access-log-shipping/` for Vector, Fluent Bit, and Promtail/Loki, and SIEM integration plus a validation checklist in `docs/deployment-access-log-shipping.md`.
- [x] Add operational status and health endpoints for orchestrators and operators through Phase 24: public `GET /api/health/live` and `GET /api/health/ready` probes (with redacted readiness error), an admin `GET /api/app/operations/status` endpoint returning store mode, scheduler leader mode/TTL/`leaderHeldLocally`/`lockSummary` (token-stripped), grouped jobs queue depth, access-log mode/path/rotation knobs, and runtime Node version, an admin-gated "Production Status" tile on the Operations page, and `docs/deployment-health-endpoints.md` for probe wiring and the validation checklist.
- [ ] Continue production hardening implementation beyond process/store-scoped rate limiting, webhook email delivery, CSRF checks, app-level redaction, Phase 20 export/access-log controls, Phase 21 scheduler leader election, Phase 22 managed external email provider operations, Phase 23 access-log shipping/retention, and Phase 24 operational status/health endpoints, such as managed production database topology support and dedicated relational repositories where indexed `app_records` metadata is not enough. SQLite/database topology guidance lives in `docs/deployment-sqlite-topology.md`.

### 3. Real Activation Signals

Move activation snapshots from onboarding-derived facts toward product-observed signals.

- [x] Implement an app-store `ActivationSignalRepository` for JSON and opt-in SQLite activation signal list/upsert access.
- [x] Wire runtime activation snapshots to durable workflow, validation, and release records through `buildSignalSnapshotFromProductRecords(...)`, with legacy facts used as fallback.
- [x] Distinguish user-entered origin from system-observed origin as first-class activation signal metadata.
- [x] Track durable workflow blockers, dependency blockers, open questions, and validation failures in runtime snapshots.
- [x] Move retry signals and runtime scope-change writes toward durable records through `activationSignals` and activation-scoped activity mapping, while retaining legacy fact fallback.
- [x] Complete and verify runtime scope-change signal writes beyond seed data and activity fallback.
- [x] Add durable signal upsert idempotency by stable key for repository callers.
- [x] Ensure retry/scope-change service callers consistently provide stable keys or stable ids.
- [x] Keep signal mapping outside the pure activation engine.

### 4. Jobs And Backfills

Make activation updates reliable outside request-time reads.

- [x] Run the local JSON-backed queue scheduler for `agent.run` jobs with cron re-enqueue, retries/backoff, cancellation, and stale-running-job sweep.
- [x] Add an optional scheduler leader-election gate so multi-process or multi-host deployments stop double-executing jobs, with `off`/`file`/`http` modes selectable via `TASKLOOM_SCHEDULER_LEADER_MODE`. See `docs/deployment-scheduler-coordination.md`.
- [x] Expose private job queue routes for list, enqueue, read, and cancel.
- [x] Add a JSON-to-SQLite backfill command for existing local workspaces.
- [ ] Add relational database backfills if app records are later split from indexed `app_records` metadata into dedicated repository tables, using `docs/deployment-sqlite-topology.md` thresholds to decide when that split is justified.
- [x] Ensure activation-scoped retry and scope-change activity emission is idempotent enough to avoid double-counting repeated signal writes.
- [x] Add stale JSON read-model repair checks and a `jobs:repair-activation` command.
- [x] Add scheduler leader-probe wiring and rolling per-type job-duration metrics surfaced through the operator-status endpoint and Operations tile. See `docs/deployment-health-endpoints.md`.
- [x] Add a scheduler tick heartbeat (`src/jobs/scheduler-heartbeat.ts`) so silent scheduler stalls surface as a `degraded` subsystem in the operator-health endpoint.
- [x] Add persisted job-metrics snapshots and a history endpoint plus CLI so the Phase 25 in-memory metrics can be inspected across process restarts. See `docs/deployment-health-endpoints.md`.

### 5. Product Workflow Expansion

Build the day-to-day workflow surfaces that make activation useful.

- [ ] Continue hardening the workflow page UX around brief editor, requirements checklist, implementation plan tracker, blockers/open questions, validation evidence capture, release confirmation, templates, prompt-generated drafts, and Plan Mode.
- [ ] Keep dashboard filters for stage, risk, status, and recency aligned with backend activation summary metadata.
- [ ] Keep richer activity detail views aligned with workflow activity context emitted by backend services.
- [x] Build frontend share-token management and public share-page wiring for the server-side share routes.

### 6. Dev And Release Hygiene

Strengthen the project rails before larger product work accumulates.

- [x] Keep roadmap, README, and activation docs current as milestones land.
- [ ] Continue broadening API route coverage as new route policies and product surfaces land.
- [x] Maintain frontend smoke/static contract tests for auth, onboarding, dashboard, activation, role-aware controls, workflow wiring, integrations, agents, runs, and share routes.
- [x] Add SQLite runtime parity tests for auth, RBAC/member invitations, invitation resend/revoke and delivery-row behavior including skip mode, workflow activation, jobs, agents, share links, CSRF rejection, cross-origin mutation rejection, dedicated SQLite rate-limit bucket persistence, and local mutating-write concurrency behavior.
- [x] Add README cross-links for the roadmap, deployment auth hardening doc, SQLite topology doc, invitation email operations doc, activation docs, and Phase 16 production deployment guidance.
- [ ] Maintain local development, reset, seed, build, production deployment, and release flow documentation as scripts and deployment posture change.
- [x] Keep generated `web/dist` assets ignored unless release packaging requirements change.

## Recommended Order

1. Production storage implementation hardening: managed database topology and dedicated relational repositories/backfills where indexed `app_records` metadata is not enough.
2. Continued workflow/UI, test, and release hardening.

## Near-Term Definition Of Done

The near-term production hardening track is complete when app-level token-redaction enforcement, the Phase 20 export/access-log redaction controls (in-app middleware, workspace export pipeline, proxy templates, and validator), the Phase 21 scheduler leader-election gate (`off`/`file`/`http` modes with documented wire protocol and validation checklist), the Phase 22 managed external email provider operations (inbound provider-status webhook gated by `TASKLOOM_INVITATION_EMAIL_RECONCILIATION_SECRET` plus the `jobs:reconcile-invitation-emails` CLI), the Phase 23 access-log shipping and retention hardening (built-in rotation, the `access-log:rotate` CLI, and Vector/Fluent Bit/Promtail recipes documented in `docs/deployment-access-log-shipping.md`), the Phase 24 operational status and health endpoints (public `GET /api/health/live` and `GET /api/health/ready` probes plus the admin `GET /api/app/operations/status` endpoint and the Operations "Production Status" tile, documented in `docs/deployment-health-endpoints.md`), the Phase 25 scheduler leader-probe wiring plus per-type job-duration metrics (live `leaderHeldLocally` tracking and the rolling `jobMetrics` window surfaced through the operator-status endpoint and Operations tile, documented in `docs/deployment-health-endpoints.md`), the Phase 26 subsystem health probes (admin `GET /api/app/operations/health` endpoint with per-subsystem classifications for store, scheduler, and access-log driven by a scheduler-tick heartbeat module, plus the "Subsystem health" sub-section on the Operations "Production Status" tile, documented in `docs/deployment-health-endpoints.md`), and the Phase 27 persisted job-metrics history (admin `GET /api/app/operations/job-metrics/history` endpoint plus `npm run jobs:snapshot-metrics` CLI and the Operations page sparkline, documented in `docs/deployment-health-endpoints.md`) are paired with managed database topology where needed, dedicated relational repositories/backfills are added where indexed `app_records` metadata is not enough, and the existing route-level RBAC/workflow/job/agent/share parity suite continues to pass on both storage modes. The remaining gaps after Phase 27 are managed database topology, dedicated relational repositories, alerting integration, automated snapshot scheduling, and continued workflow/UI/test polish.
