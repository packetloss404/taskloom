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
- production storage topology readiness reporting for operators without changing the single-node SQLite posture
- deployment release-readiness gates layered over storage topology, backup/restore, persistent-path checks, managed database advisory findings, and runtime-guard findings
- deployment release evidence bundle exports for redacted readiness, topology, managed database advisory, runtime-guard, and environment handoff evidence
- managed database topology advisory reporting for production planning without adding a managed database adapter
- managed database runtime guardrails that block unsupported managed database and multi-writer runtime hints before startup/release automation
- managed database runtime boundary/foundation in the synchronous store path, with Phase 52 startup assertion limiting managed/Postgres acceptance to recognized Postgres adapter + managed database URL configurations
- async store boundary foundation plus Phase 50 managed Postgres adapter/backfill foundation; Phase 51 completes the tracked runtime call-site migration, and Phase 52 asserts/validates managed Postgres startup support for recognized Postgres adapter + managed database URL configurations
- Phase 53 multi-writer topology requirements/design gate, Phase 54 owned design-package gate, Phase 55 design-package review/implementation-authorization evidence gate, Phase 56 implementation-readiness/rollout-safety evidence gate, Phase 57 implementation-scope gate, Phase 58 runtime-implementation validation gate, Phase 59 release-enable approval gate, Phase 60 support-presence assertion gate, Phase 61 runtime activation controls gate, Phase 62 managed Postgres horizontal app-writer concurrency hardening, Phase 63 distributed dependency enforcement, and Phase 64 recovery validation that keep active-active multi-region writes, Taskloom-owned regional database failover/PITR runtime behavior, distributed SQLite, cutover automation, final release closure, and release approval blocked until later phases close those specific risks
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

The local app uses `data/taskloom.json` for file-backed persistence by default. If the file is missing, the server recreates it from the built-in seed data on first store load. To run the same store API against SQLite, start the app with `TASKLOOM_STORE=sqlite`; it targets `data/taskloom.sqlite` unless `TASKLOOM_DB_PATH=path/to/taskloom.sqlite` is set. SQLite mode persists the app runtime through migrated `app_records` rows plus dedicated relational tables for collections that have crossed the repository cutover (`jobMetricSnapshots`, `alertEvents`, `agentRuns`, `jobs`, `invitationEmailDeliveries`, `activities`, `providerCalls`, and `activationSignals`) while keeping JSON as the default contributor workflow. SQLite opens with `busy_timeout`, WAL mode, `synchronous=normal`, and `foreign_keys=on`; SQLite `mutateStore()` writes run inside `BEGIN IMMEDIATE` and reload fresh state before writing so local concurrent writers do not overwrite newer whole-store state from a stale cache.

Phase 50 documents the managed Postgres adapter/backfill foundation, Phase 51 completes the tracked runtime call-site migration needed after that foundation, and Phase 52 asserts/validates managed Postgres startup support after that migration. Phase 53 is the multi-writer topology requirements/design gate after Phase 52, Phase 54 turns that into an owned design-package gate, Phase 55 adds review plus implementation-authorization evidence, Phase 56 adds implementation-readiness plus rollout-safety evidence, Phase 57 adds the implementation-scope gate before any multi-writer implementation claim can proceed, Phase 58 adds a conservative runtime-implementation validation gate after Phase 57, Phase 59 adds a conservative release-enable approval gate after Phase 58, Phase 60 adds a conservative support-presence assertion gate after Phase 59, Phase 61 adds runtime activation controls plus activation-ready reporting after Phase 60, Phase 62 completes managed Postgres horizontal app-writer concurrency hardening, Phase 63 enforces production-safe shared dependencies before strict activation, and Phase 64 completes failover, PITR, and recovery validation for the supported posture: horizontal Taskloom app writers against one managed Postgres primary/cluster with provider-owned HA/PITR. It does not enable active-active multi-region writes, Taskloom-owned regional database failover, Taskloom-owned PITR runtime behavior, distributed SQLite, cutover automation, final release closure, runtime activation, or release approval. Phase 65 is next. `npm start` still runs the managed database runtime guard before the Hono server starts. The landed foundation adds the `pg` adapter dependency, the `TASKLOOM_MANAGED_DATABASE_ADAPTER` advisory/guard hint, and the `db:backfill-managed-postgres` / `db:verify-managed-postgres` CLIs. Managed/Postgres startup hints can be accepted only when a recognized Postgres adapter value (`postgres`, `postgresql`, `managed-postgres`, or `managed-postgresql`) is paired with a managed database URL hint (`TASKLOOM_MANAGED_DATABASE_URL`, `TASKLOOM_DATABASE_URL`, or `DATABASE_URL`) and the Phase 52 startup support assertion is present. Other managed store names, missing adapter/URL pairs, multi-writer topology hints, regional failover, PITR, and active/active writes remain blocked unless the explicit later-phase requirements are satisfied.

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
npm run db:backfill-managed-postgres -- --source=json --dry-run
npm run db:verify-managed-postgres -- --source=json
npm run db:backfill-job-metric-snapshots
npm run db:verify-job-metric-snapshots
npm run db:backfill-alert-events
npm run db:verify-alert-events
npm run db:backfill-agent-runs
npm run db:verify-agent-runs
npm run db:backfill-jobs
npm run db:verify-jobs
npm run db:backfill-invitation-email-deliveries
npm run db:verify-invitation-email-deliveries
npm run db:backfill-activities
npm run db:verify-activities
npm run db:backfill-provider-calls
npm run db:verify-provider-calls
npm run db:backfill-activation-signals
npm run db:verify-activation-signals
```

These commands target `data/taskloom.sqlite` by default. Pass `-- --db-path=path/to/taskloom.sqlite` to use a different database file. `db:seed-app` writes the built-in app seed data to SQLite, `db:backfill` imports an existing JSON store into SQLite, and `db:reset-app` recreates the SQLite app seed state without modifying `data/taskloom.json`. `db:backfill-job-metric-snapshots` populates the dedicated `job_metric_snapshots` table from existing `app_records` rows (idempotent via `INSERT OR REPLACE`; pass `-- --dry-run` to inspect counts without writing), and `db:verify-job-metric-snapshots` reports `{ jsonOnly, sqliteOnly, contentDrift, matched }` between the JSON-side collection and the dedicated table for cron-friendly drift detection. `db:backfill-alert-events` populates the dedicated `alert_events` table from existing `app_records` rows with the same idempotent `INSERT OR REPLACE` semantics and `-- --dry-run` flag, and `db:verify-alert-events` reports the same `{ jsonOnly, sqliteOnly, contentDrift, matched }` shape for the alert-events surface. `db:backfill-agent-runs` populates the dedicated `agent_runs` table from existing `app_records` rows with the same idempotent `INSERT OR REPLACE` semantics and `-- --dry-run` flag plus an optional `-- --check-orphans` flag that reports rows whose `agentId` references a missing `agents` row (orphans are surfaced but do not block the backfill), and `db:verify-agent-runs` reports the same `{ jsonOnly, sqliteOnly, contentDrift, matched }` shape for the agent-runs surface. `db:backfill-jobs` populates the dedicated `jobs` table from existing `app_records` rows with the same idempotent `INSERT OR REPLACE` semantics and `-- --dry-run` flag, and `db:verify-jobs` reports the same `{ jsonOnly, sqliteOnly, contentDrift, matched }` shape for the jobs surface. `db:backfill-invitation-email-deliveries` populates the dedicated `invitation_email_deliveries` table from existing `app_records` rows with the same idempotent `INSERT OR REPLACE` semantics and `-- --dry-run` flag, and `db:verify-invitation-email-deliveries` reports the same `{ jsonOnly, sqliteOnly, contentDrift, matched }` shape for the invitation-email-deliveries surface. See `docs/roadmap-relational-repositories.md` for the migration plan.

`db:backfill-managed-postgres` and `db:verify-managed-postgres` target the Phase 50 managed Postgres document-store foundation through the async store boundary. Configure the managed target with one database URL hint (`TASKLOOM_MANAGED_DATABASE_URL`, `TASKLOOM_DATABASE_URL`, or `DATABASE_URL`); set a recognized adapter hint such as `TASKLOOM_MANAGED_DATABASE_ADAPTER=postgres` when you want advisory/guard reports to show Phase 50 adapter evidence. Use `-- --source=json`, `-- --source=sqlite`, or `-- --source=seed` to choose the source, and pass `-- --dry-run` to the backfill before writing. These commands are adapter/backfill evidence; app startup accepts managed/Postgres hints only after the Phase 52 startup support assertion validates the same recognized adapter + managed database URL pairing.

`db:backfill-activities` populates the dedicated `activities` table from existing `app_records` rows with the same idempotent `INSERT OR REPLACE` semantics and `-- --dry-run` flag, and `db:verify-activities` reports the same `{ jsonOnly, sqliteOnly, contentDrift, matched }` shape for the activities surface.

`db:backfill-provider-calls` populates the dedicated `provider_calls` table from existing `app_records` rows with the same idempotent `INSERT OR REPLACE` semantics and `-- --dry-run` flag, and `db:verify-provider-calls` reports the same `{ jsonOnly, sqliteOnly, contentDrift, matched }` shape for old-backup recovery and drift audits. After the providerCalls mirror-retirement follow-up, fresh SQLite writes no longer create `app_records` mirror rows for provider calls.

`db:backfill-activation-signals` populates the dedicated `activation_signals` table from existing `app_records` rows with the same idempotent `INSERT OR REPLACE` semantics and `-- --dry-run` flag, and `db:verify-activation-signals` reports the same `{ jsonOnly, sqliteOnly, contentDrift, matched }` shape for old-backup recovery and drift audits. After the post-Phase-40 mirror-retirement follow-up, fresh SQLite writes use `activation_signals` and no longer create `app_records` mirror rows; `loadStore()` remains fully hydrated and JSON mode is unchanged.

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
- Run `npm run deployment:check-release -- --strict` and `npm run deployment:export-evidence -- --strict` so release handoff evidence includes storage topology, managed database advisory, runtime-guard findings, Phase 63 distributed dependency posture, and Phase 64 recovery validation posture.
- Prepare Phase 64 recovery artifacts using the canonical evidence names `TASKLOOM_MANAGED_POSTGRES_BACKUP_RESTORE_EVIDENCE`, `TASKLOOM_MANAGED_POSTGRES_PITR_REHEARSAL_EVIDENCE`, `TASKLOOM_MANAGED_POSTGRES_FAILOVER_REHEARSAL_EVIDENCE`, `TASKLOOM_MANAGED_POSTGRES_DATA_INTEGRITY_VALIDATION_EVIDENCE`, and `TASKLOOM_MANAGED_POSTGRES_RECOVERY_TIME_EXPECTATION`; operations status/health also recognizes `TASKLOOM_RECOVERY_*` aliases for report ingestion.
- Run `npm run deployment:check-runtime-guard -- --strict` in release automation that should fail before unsupported managed database or multi-writer runtime hints, or strict activation with missing/local-only distributed dependencies, reach startup.
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
- Run `npm run deployment:check-storage` before production handoff to generate the Phase 42 storage readiness report across CLI/API/UI surfaces; use `npm run deployment:check-storage -- --strict` in release gates. The report is advisory and does not provision managed Postgres, add managed database repositories, or make SQLite distributed. SQLite remains a single-node storage posture.
- Run `npm run deployment:check-release` before release handoff to generate the Phase 43/47/63/64 release-readiness gate over backup/restore readiness, persistent paths, the Phase 42 storage topology posture, the Phase 45 managed database advisory, the Phase 46 runtime guard, the distributed dependency posture required for strict activation, and Phase 64 recovery validation; use `npm run deployment:check-release -- --strict` in release automation that should fail on blocking findings. The gate does not perform backups, restore data, provision managed DBs, add managed database support, or make SQLite distributed.
- Run `npm run deployment:export-evidence` before release handoff to package the Phase 44/47/63/64 release evidence bundle across readiness, topology, managed database advisory, runtime-guard, distributed dependency, recovery validation, and environment evidence; use `npm run deployment:export-evidence -- --strict` in automation that should fail on blocking findings. The export redacts secrets and token-like values before handoff. It does not run backups, tests, or builds; restore data; provision managed DBs; add managed database support; or make SQLite distributed.
- Run `npm run deployment:check-managed-db` before managed production database planning handoff; use `npm run deployment:check-managed-db -- --strict` in automation that should fail on blocking topology findings. Operators can set advisory hints such as `TASKLOOM_MANAGED_DATABASE_URL`, `DATABASE_URL`, `TASKLOOM_DATABASE_URL`, `TASKLOOM_MANAGED_DATABASE_ADAPTER`, `TASKLOOM_DATABASE_TOPOLOGY`, and `TASKLOOM_STORE` so the report can classify intent. Phase 45 is reporting/planning, Phase 50 adds a managed Postgres adapter/backfill foundation, Phase 51 completes tracked call-site migration, Phase 52 asserts/validates managed Postgres startup support for recognized Postgres adapter + managed database URL configurations, Phase 53 records the multi-writer topology requirements/design gate, Phase 54 requires an owned design package before implementation, Phase 55 requires review plus implementation-authorization evidence for that package, Phase 56 requires implementation-readiness plus rollout-safety evidence before support can be claimed, Phase 57 requires implementation scope lock, runtime feature flag/deployment gate, validation evidence, migration/cutover lock, and release-owner signoff before implementation claims can proceed, Phase 58 requires Phase 57 complete plus runtime implementation evidence, consistency/failover/data-integrity validation evidence, operations runbook, and runtime release signoff before runtime-implementation validation can pass, Phase 59 requires Phase 58 complete plus release-enable decision, approver, rollout window, monitoring signoff, abort plan, and release ticket evidence before release-enable approval can pass, Phase 60 requires Phase 59 complete plus implementation-present assertion, explicit support statement, compatibility matrix, cutover evidence, release automation approval, and owner acceptance, Phase 61 requires Phase 60 complete plus activation controls before checks can report activation-ready controls, Phase 62 completes managed Postgres horizontal app-writer concurrency hardening, Phase 63 requires distributed rate limiting, HTTP scheduler coordination, durable job execution posture, access-log shipping, alert delivery, and health monitoring evidence before strict activation can pass, and Phase 64 requires managed Postgres backup restore, PITR, failover, data-integrity, and RTO/RPO evidence before recovery claims can pass. Distributed SQLite, active-active multi-region writes, Taskloom-owned regional database failover/PITR runtime behavior, cutover automation, final release closure, runtime activation, and release approval remain blocked. Phase 65 is next.
- Run `npm run deployment:check-runtime-guard` before startup/release automation; use `npm run deployment:check-runtime-guard -- --strict` in gates that must fail when unsupported runtime hints or strict activation with missing/local-only distributed dependencies are present. The Phase 46/63/64 guard allows local JSON/default runtime, single-node SQLite runtime, and Phase 52 managed Postgres startup only when a recognized `TASKLOOM_MANAGED_DATABASE_ADAPTER` Postgres value is paired with a managed database URL hint and the startup support assertion is present. It blocks unsupported `TASKLOOM_STORE` values, unpaired managed database URL hints (`TASKLOOM_MANAGED_DATABASE_URL`, `DATABASE_URL`, `TASKLOOM_DATABASE_URL`), managed/multi-writer topology hints (`TASKLOOM_DATABASE_TOPOLOGY`), and strict activation when distributed rate limiting (`TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL` + `TASKLOOM_DISTRIBUTED_RATE_LIMIT_EVIDENCE`, fail-closed), scheduler coordination (`TASKLOOM_SCHEDULER_LEADER_MODE=http` + `TASKLOOM_SCHEDULER_LEADER_HTTP_URL` + `TASKLOOM_SCHEDULER_COORDINATION_EVIDENCE`, fail-closed), durable job execution (`TASKLOOM_DURABLE_JOB_EXECUTION_POSTURE` + `TASKLOOM_DURABLE_JOB_EXECUTION_EVIDENCE`), access-log shipping (`TASKLOOM_ACCESS_LOG_SHIPPING_EVIDENCE`), alert delivery (`TASKLOOM_ALERT_EVALUATE_CRON`, `TASKLOOM_ALERT_WEBHOOK_URL`, and `TASKLOOM_ALERT_DELIVERY_EVIDENCE`), health monitoring (`TASKLOOM_HEALTH_MONITORING_EVIDENCE`), or Phase 64 managed Postgres recovery validation evidence are missing or local-only. It also reports Phase 50 adapter/backfill evidence, Phase 51 call-site migration evidence, Phase 52 startup support assertion status, Phase 53/54/55/56/57/58/59/60/61/62 multi-writer topology gate context, Phase 63 dependency state, and Phase 64 recovery-validation state so release gates can distinguish adapter availability, narrow startup readiness, design-package evidence, implementation authorization, rollout-safety readiness, implementation-scope lock, runtime-implementation validation evidence, release-enable approval evidence, support-presence assertion evidence, activation-ready controls, managed Postgres horizontal app-writer concurrency hardening, strict activation dependency posture, and provider-owned HA/PITR validation from unimplemented distributed topology. `TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS` is a break-glass/dev-only escape hatch for controlled experiments; it is not production support and must not be used to claim distributed SQLite, active-active multi-region writes, Taskloom-owned regional database failover/PITR runtime behavior, cutover automation, final release closure, runtime activation, or release approval. Phase 65 is next.
- For old SQLite backups created before the Phase 39 `providerCalls` migration, run `npm run db:backfill-provider-calls -- --dry-run` before the write backfill, then use `npm run db:verify-provider-calls` to audit drift. Fresh SQLite writes now use the dedicated `provider_calls` table without a JSON-side mirror.
- For old SQLite backups created before the Phase 40 `activationSignals` migration, run `npm run db:backfill-activation-signals -- --dry-run` before the write backfill, then use `npm run db:verify-activation-signals` to audit drift. Fresh SQLite writes now use the dedicated `activation_signals` table without a JSON-side mirror.
- Run `npm run jobs:cleanup-sessions` on a schedule to prune expired sessions.
- Run only one scheduler-active Node process against the current local store unless the Phase 21 leader-election gate is enabled. To run multiple Node processes safely, set `TASKLOOM_SCHEDULER_LEADER_MODE=file` (with `TASKLOOM_SCHEDULER_LEADER_FILE_PATH`, default `data/scheduler-leader.json`) for processes on the same host, or `TASKLOOM_SCHEDULER_LEADER_MODE=http` (with `TASKLOOM_SCHEDULER_LEADER_HTTP_URL`, optional `TASKLOOM_SCHEDULER_LEADER_HTTP_SECRET`, `TASKLOOM_SCHEDULER_LEADER_HTTP_TIMEOUT_MS` defaulting to 5000, and `TASKLOOM_SCHEDULER_LEADER_HTTP_FAIL_OPEN`) for cross-host coordination through a deployment-owned coordinator service. `TASKLOOM_SCHEDULER_LEADER_TTL_MS` (default 30000) and `TASKLOOM_SCHEDULER_LEADER_PROCESS_ID` tune lock takeover latency and identify each process. See `docs/deployment-scheduler-coordination.md` for the wire protocol, file-mode caveats, and validation checklist.
- Tune the per-type job-duration rolling window with `TASKLOOM_SCHEDULER_METRICS_WINDOW_SIZE` (default `50`, integer >= 1, read at module load). The window feeds the `jobMetrics` field on the operator-status endpoint and Operations "Production Status" tile, lives in process memory, and resets on restart by design.
- Set `TASKLOOM_JOB_METRICS_SNAPSHOT_CRON` to a five-field cron expression (e.g., `*/15 * * * *`) to enqueue a built-in recurring `metrics.snapshot` job that runs the same capture as `npm run jobs:snapshot-metrics` without external cron. When unset, no auto-snapshot runs. `TASKLOOM_JOB_METRICS_SNAPSHOT_RETENTION_DAYS` (default `30`) is passed to the job payload as `retentionDays`, and `TASKLOOM_JOB_METRICS_SNAPSHOT_WORKSPACE_ID` (default `"__system__"`) sets the workspace id used for the recurring job's bookkeeping. Invalid cron expressions log a warning and skip the bootstrap. See `docs/deployment-health-endpoints.md`.
- Set `TASKLOOM_ALERT_EVALUATE_CRON` to a five-field cron expression (e.g., `*/5 * * * *`) to enqueue a built-in recurring `alerts.evaluate` job that runs the rule evaluator against the latest `OperationsHealthReport` and `JobTypeMetrics[]` snapshot, optionally delivers the batch via webhook, and persists the alert rows. When unset, no scheduled evaluation runs. `TASKLOOM_ALERT_WEBHOOK_URL` is required to enable delivery; without it, evaluations still run and persist but no webhook fires. `TASKLOOM_ALERT_WEBHOOK_SECRET` (sent in `TASKLOOM_ALERT_WEBHOOK_SECRET_HEADER`, default `x-taskloom-alert-secret`) and `TASKLOOM_ALERT_WEBHOOK_TIMEOUT_MS` (default `5000`) control authentication and timeout. `TASKLOOM_ALERT_JOB_FAILURE_RATE_THRESHOLD` (default `0.5`) and `TASKLOOM_ALERT_JOB_FAILURE_MIN_SAMPLES` (default `5`) tune the `job-failure-rate` rule. `TASKLOOM_ALERT_RETENTION_DAYS` (default `30`) prunes older rows on each evaluation, and `TASKLOOM_ALERT_WORKSPACE_ID` (default `"__system__"`) sets the workspace id used for the recurring job's bookkeeping. `TASKLOOM_ALERT_DELIVER_MAX_ATTEMPTS` (default `3`, integer >= 1) caps total delivery attempts per alert; on inline delivery failure, an `alerts.deliver` retry job is enqueued per event with the remaining attempts, and exhaustion sets `deadLettered: true` on the alert row. Invalid cron expressions log a warning and skip the bootstrap. See `docs/deployment-alerting.md`.
- Enable `TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL` or add equivalent edge/shared distributed rate limiting for auth and invitation routes before relying on local buckets across multiple processes or regions. Phase 63 strict activation treats missing distributed rate limiting as a blocking local-only dependency for horizontally scaled production.
- For invitation email webhook retry/dead-letter operations, see `docs/invitation-email-operations.md`.
- Built-in API responses redact sensitive payload fields, route-token URLs, bearer values, job payload/result/error bodies, activity/run DTOs, and list/detail token surfaces. Keep any deployment access logs, reverse-proxy logs, exports, and telemetry aligned with the same redaction posture.
- Enable the in-app access log middleware with `TASKLOOM_ACCESS_LOG_MODE=stdout` or `TASKLOOM_ACCESS_LOG_MODE=file` (defaults to `off`), and set `TASKLOOM_ACCESS_LOG_PATH` to a managed log directory when mode is `file`. The middleware writes one JSON line per request with method, status, duration, userId, workspaceId, requestId, and a path/query that is passed through the same redaction helper used for DTO surfaces. Pair it with reverse-proxy access-log rewriting templates under `docs/deployment/proxy-access-log-redaction/` for traffic the app never sees, and validate proxy logs with `node --import tsx src/security/proxy-access-log-validator.ts <path-to-log>` after every config change.
- For file-mode access logging, bound local disk usage with `TASKLOOM_ACCESS_LOG_MAX_BYTES` (default `0` = rotation disabled) and `TASKLOOM_ACCESS_LOG_MAX_FILES` (default `5`, clamp to `>= 1`). When `MAX_BYTES > 0`, the middleware rotates the active file before writing a line that would exceed the threshold, cascading `<path>` to `<path>.1`, `<path>.1` to `<path>.2`, and pruning files beyond `MAX_FILES`. Run `npm run access-log:rotate -- --path=<file> [--max-files=<n>]` for cron-driven daily rotation, and pair the rotated files with a managed shipper (Vector, Fluent Bit, Promtail/Loki) using the recipes under `docs/deployment/access-log-shipping/`. See `docs/deployment-access-log-shipping.md` for the full rotation, shipping, and SIEM integration guidance.
- Use `npm run jobs:export-workspace -- --workspace-id=<id> > export.json` to produce a redacted per-workspace JSON snapshot for audit handoff, support escalation, or data-subject requests. See `docs/deployment-export-redaction.md` for redaction guarantees and the validation checklist.
- Wire orchestrator health checks to the public probes: `GET /api/health/live` for container liveness checks (no I/O, fixed 200) and `GET /api/health/ready` for load balancer readiness (200 when `loadStore()` resolves cleanly, 503 with a redacted error otherwise). Operators with admin/owner sessions can also call `GET /api/app/operations/status` for a single-call summary of store mode, storage topology readiness, managed database runtime boundary, Phase 49 async store boundary foundation, Phase 50 managed Postgres capability, Phase 51 call-site migration evidence, Phase 52 startup assertion status, Phase 53/54/55/56/57/58/59/60/61 multi-writer topology gate context, Phase 62 horizontal app-writer hardening state, Phase 63 `distributedDependencyEnforcement` state, Phase 64 `managedPostgresRecoveryValidation` state, scheduler leader configuration, jobs queue depth, access-log knobs, and Node version, and `GET /api/app/operations/health` for per-subsystem `ok`/`degraded`/`down`/`disabled` classifications across store, scheduler, access-log, distributed dependency posture, and managed Postgres recovery validation; both are rendered on the Operations page "Production Status" tile. Phase 52 is the point where recognized Postgres adapter + managed database URL hints can be accepted; Phases 53/54/55/56/57/58/59/60/61 make horizontal writers, regional failover, PITR, and active-active requirements blocking topology/design-package/review-authorization/rollout-safety/implementation-scope/runtime-validation/release-enable/support-presence/activation-control needs rather than implemented runtime support, Phase 62 hardens horizontal app writers for the supported managed Postgres posture, Phase 63 prevents strict activation from passing while any required shared dependency is missing or local-only, and Phase 64 requires recovery validation evidence before recovery claims pass. Internal monitoring dashboards that already authenticate as admin can scrape both endpoints alongside the public liveness/readiness probes. See `docs/deployment-health-endpoints.md` for probe wiring guidance and the validation checklist.

Current production guidance makes managed/Postgres hints normal startup configuration only under the Phase 52 assertion rule. The app includes an optional HTTP distributed rate-limit adapter, built-in invitation webhook retry jobs, an optional scheduler leader-election gate, built-in access-log rotation with shipping recipes, public liveness/readiness probes plus admin operator-status endpoints, the Phase 42 storage topology readiness report, the Phase 43 release-readiness gate, the Phase 44 release evidence export, the Phase 45 managed database topology advisory, the Phase 46 managed database runtime guard, the Phase 47 release handoff integration for those advisory/guard findings, the Phase 48 managed database runtime boundary/foundation in the synchronous store path, the Phase 49 async store boundary foundation, the Phase 50 managed Postgres document-store adapter/backfill foundation, Phase 51 runtime call-site migration evidence, Phase 52 managed Postgres startup support assertion/validation, Phase 61 activation-ready controls, Phase 62 managed Postgres horizontal app-writer concurrency hardening, Phase 63 distributed dependency enforcement, and Phase 64 recovery validation. Phase 64 validates provider-owned HA/PITR for the supported managed Postgres horizontal app-writer posture; it does not enable active-active multi-region writes, Taskloom-owned regional database failover/PITR runtime behavior, distributed SQLite, cutover automation, final release closure, runtime activation, or release approval. Phase 65 is next. See `docs/deployment-auth-hardening.md`, `docs/deployment-sqlite-topology.md`, `docs/deployment-storage-topology.md`, `docs/deployment-release-readiness.md`, `docs/deployment-release-evidence.md`, `docs/deployment-managed-database-topology.md`, `docs/deployment-managed-database-runtime-guard.md`, `docs/invitation-email-operations.md`, `docs/deployment-export-redaction.md`, `docs/deployment-scheduler-coordination.md`, `docs/deployment-access-log-shipping.md`, and `docs/deployment-health-endpoints.md` for focused deployment checks.

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

`GET /api/health/live` is a public, fixed-200 liveness probe that performs no I/O and always returns `{ "status": "live" }`; use it for container orchestrator liveness checks. `GET /api/health/ready` is a public readiness probe that returns `200` with `{ "status": "ready" }` when the local store loads cleanly and `503` with `{ "status": "not_ready", "error": "<redacted>" }` otherwise; use it for load balancer and Kubernetes readiness probes. The pre-existing `GET /api/health` route still returns `{ "ok": true }` for any consumer that depends on the older shape. `GET /api/app/operations/status` is admin-scoped and returns an `OperationsStatus` payload covering store mode, scheduler leader mode/TTL/`leaderHeldLocally`/`lockSummary` (file path or token-stripped URL, never the secret), grouped jobs queue depth, access-log mode/path/`maxBytes`/`maxFiles`, managed database runtime boundary, Phase 49 async store boundary foundation, Phase 50 `managedPostgresCapability`, Phase 51 call-site migration evidence, Phase 52 startup support assertion status, Phase 53/54/55/56/57/58/59/60/61 multi-writer topology gate context, and runtime Node version. Phase 52 is the point where recognized Postgres adapter + managed database URL hints can become accepted startup configuration; Phases 53/54/55/56/57/58/59/60/61 make clear that horizontal writers, regional failover, PITR, and active-active needs remain blocked until an owned topology design package exists, passes review, has implementation authorization recorded, includes implementation-readiness/rollout-safety evidence, has implementation scope locked with release-owner signoff, validates runtime implementation evidence, consistency, failover, data integrity, operations runbook, runtime release signoff, records release-enable approval evidence, records support-presence assertion evidence, and records activation controls. The response also includes `jobMetrics` (rolling per-type duration metrics with `lastDurationMs`, `averageDurationMs`, and `p95DurationMs`) so operators can spot scheduler latency regressions without scraping logs. The Operations page renders the same payload as a "Production Status" tile for admins. See `docs/deployment-health-endpoints.md` for probe wiring guidance and the post-deploy validation checklist.

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
- `docs/roadmap-relational-repositories.md`
- `docs/deployment-auth-hardening.md`
- `docs/deployment-sqlite-topology.md`
- `docs/deployment-storage-topology.md`
- `docs/deployment-release-readiness.md`
- `docs/deployment-release-evidence.md`
- `docs/deployment-managed-database-topology.md`
- `docs/deployment-managed-database-runtime-guard.md`
- `docs/invitation-email-operations.md`
- `docs/deployment-export-redaction.md`
- `docs/deployment-scheduler-coordination.md`
- `docs/deployment-access-log-shipping.md`
- `docs/deployment-health-endpoints.md`
- `docs/activation/activation-domain.md`
- `docs/activation/activation-signals.md`
- `docs/activation/activation-roadmap.md`

Deployment guidance lives in `README.md#production-deployment-guidance`, `docs/deployment-auth-hardening.md`, `docs/deployment-sqlite-topology.md`, `docs/deployment-storage-topology.md`, `docs/deployment-release-readiness.md`, `docs/deployment-release-evidence.md`, `docs/deployment-managed-database-topology.md`, `docs/deployment-managed-database-runtime-guard.md`, `docs/invitation-email-operations.md`, `docs/deployment-export-redaction.md`, `docs/deployment-scheduler-coordination.md`, `docs/deployment-access-log-shipping.md`, `docs/deployment-health-endpoints.md`, and `docs/roadmap-relational-repositories.md`, and is tracked across Phases 16 through 64 in `docs/roadmap.md`. Phases 32 through 40 moved high-value app collections into dedicated SQLite tables with operator backfill/verify CLIs while keeping SQLite single-node. Phases 42 through 61 add storage topology readiness, release readiness/evidence, managed database advisory and runtime guardrails, managed Postgres adapter/startup gates, multi-writer evidence gates, and activation-ready controls. Phase 62 completes managed Postgres horizontal app-writer concurrency hardening for the supported managed Postgres posture. Phase 63 enforces distributed rate limiting, scheduler coordination, durable job execution posture, access-log shipping, alert delivery, and health monitoring before strict activation can pass. Phase 64 validates provider-owned managed Postgres HA/PITR recovery evidence for the same posture, and it does not enable active-active multi-region writes, Taskloom-owned regional database failover/PITR runtime behavior, distributed SQLite, cutover automation, final release closure, runtime activation, or release approval. Phase 65 is next.
