# Taskloom Roadmap

Taskloom currently has a local activation domain, JSON-backed default storage, an opt-in SQLite app runtime with query-indexed route helpers for high-value records, local SQLite write/concurrency hardening, auth/onboarding/activity/workflow flows, route-level RBAC, invitation/member APIs, local invitation email delivery records with a delivery-adapter seam and webhook retry/dead-letter jobs, proxy-aware same-origin plus CSRF-token mutation checks, deployment-configurable store-backed auth/invitation rate limits with optional HTTP distributed limiter integration, command-driven maintenance jobs, queue-driven agent runs with an opt-in scheduler leader-election gate for multi-process runtimes, public webhook/share links, route/DTO token-redaction enforcement for sensitive list/detail/job/activity/run surfaces, public liveness/readiness probes plus admin operator-status endpoints, a Phase 42 storage topology readiness report for CLI/API/UI operator review, Phase 43 release-readiness gates over backup/restore readiness, persistent paths, storage topology, managed database advisory findings, and runtime-guard findings, Phase 44 release evidence bundle exports for redacted readiness/topology/managed-database/runtime-guard/environment handoff evidence, Phase 45 managed database topology advisory reporting for production planning, Phase 46 managed database runtime guardrails that block unsupported managed database and multi-writer hints before startup/release automation, Phase 47 integration of Phase 45/46 findings into release readiness and evidence handoff, Phase 48 managed database runtime boundary/foundation in the synchronous store path, Phase 49 async store boundary foundation, Phase 50 managed Postgres adapter/backfill foundation, Phase 51 runtime call-site migration evidence with no remaining tracked sync call-site groups, Phase 52 managed Postgres startup support assertion/validation for recognized Postgres adapter + managed database URL configurations, Phase 53 multi-writer topology requirements/design gate after Phase 52, Phase 54 owned multi-writer topology design-package gate before any implementation, Phase 55 design-package review/implementation-authorization evidence gate before any runtime implementation, Phase 56 implementation-readiness/rollout-safety evidence gate before any runtime support claim, Phase 57 implementation-scope gate before implementation claims can proceed, Phase 58 runtime-implementation validation gate after Phase 57, Phase 59 release-enable approval gate after Phase 58, Phase 60 support-presence assertion gate after Phase 59, production deployment guidance in `README.md`, `docs/deployment-auth-hardening.md`, `docs/deployment-sqlite-topology.md`, `docs/deployment-storage-topology.md`, `docs/deployment-release-readiness.md`, `docs/deployment-release-evidence.md`, `docs/deployment-managed-database-topology.md`, `docs/deployment-managed-database-runtime-guard.md`, `docs/invitation-email-operations.md`, `docs/deployment-export-redaction.md`, `docs/deployment-scheduler-coordination.md`, `docs/deployment-access-log-shipping.md`, and `docs/deployment-health-endpoints.md`, and a React/Vite interface. The remaining roadmap is now bounded by Phases 61 through 66: turn the approved support package into explicit runtime activation controls, harden managed Postgres concurrency for horizontal app writers, require distributed operational dependencies before activation, validate failover/PITR and recovery behavior, complete cutover/rollback automation and observability, and close the release with documentation that no additional hidden phase is required for the supported production posture.

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
- Automated job-metrics snapshot scheduling: `TASKLOOM_JOB_METRICS_SNAPSHOT_CRON` enqueues a single recurring `metrics.snapshot` job (re-enqueued by the existing scheduler), with `TASKLOOM_JOB_METRICS_SNAPSHOT_RETENTION_DAYS` and `TASKLOOM_JOB_METRICS_SNAPSHOT_WORKSPACE_ID` knobs. `OperationsStatus.jobMetricsSnapshots` and the Operations page indicator surface freshness.
- Webhook-based alerting: `TASKLOOM_ALERT_EVALUATE_CRON` runs scheduled evaluations against subsystem health and job-failure rates; alerts persist in `data.alertEvents` with default 30-day retention and optionally deliver to `TASKLOOM_ALERT_WEBHOOK_URL`. Admin `GET /api/app/operations/alerts` and the Operations page "Recent alerts" tile surface recent history. `docs/deployment-alerting.md` documents the rule set and contract.
- Alert delivery retry and dead-letter: failed initial deliveries enqueue `alerts.deliver` retry jobs (`TASKLOOM_ALERT_DELIVER_MAX_ATTEMPTS` total attempts, default `3`); exhaustion sets `deadLettered: true` on the alert row. The Operations page surfaces delivered/retrying/dead-lettered states.
- Jobs scripts can recompute activation read models, repair stale activation read models, and clean up expired sessions against the local store.
- Local persistence commands can seed/reset the JSON store, migrate/status/backup/restore SQLite, seed/reset SQLite activation tables, seed/reset full SQLite app data, and backfill SQLite from a JSON store.
- `docs/deployment-sqlite-topology.md` defines the supported local SQLite posture, WAL/`busy_timeout`/`BEGIN IMMEDIATE` guarantees, backup/restore policy, network filesystem caveats, multi-process/multi-region limits, and thresholds for dedicated relational repositories/backfills beyond indexed `app_records`.
- `docs/deployment-storage-topology.md` documents the Phase 42 production storage topology readiness report exposed through `npm run deployment:check-storage`, `GET /api/app/operations/status`, and the Operations UI. The report is advisory; it does not add managed Postgres, distributed SQLite, or multi-writer SQLite support.
- `docs/deployment-release-readiness.md` documents the Phase 43/47 deployment release-readiness gate exposed through `npm run deployment:check-release` and `npm run deployment:check-release -- --strict`. The gate checks backup/restore readiness, persistent paths, storage topology, Phase 45 managed database advisory findings, and Phase 46 runtime-guard findings, but it does not perform backups, restore data, provision managed DBs, add managed database support, or make SQLite distributed.
- `docs/deployment-release-evidence.md` documents the Phase 44/47 release evidence bundle export exposed through `npm run deployment:export-evidence` and `npm run deployment:export-evidence -- --strict`. The export packages readiness, topology, managed database advisory, runtime-guard, and environment evidence for handoff, redacts secrets, and does not run backups, tests, or builds; restore data; provision managed DBs; add managed database support; or make SQLite distributed.
- `docs/deployment-managed-database-topology.md` documents the Phase 45 managed database topology advisory exposed through `npm run deployment:check-managed-db` and `npm run deployment:check-managed-db -- --strict`. The advisory accepts operator hints such as `TASKLOOM_MANAGED_DATABASE_URL`, `DATABASE_URL`, `TASKLOOM_DATABASE_URL`, `TASKLOOM_MANAGED_DATABASE_ADAPTER`, `TASKLOOM_DATABASE_TOPOLOGY`, and `TASKLOOM_STORE`, but it does not add distributed SQLite, multi-writer DB runtime, regional failover, PITR, or active/active writes. Phase 54 adds the owned design-package requirement before implementation, Phase 55 adds review/implementation-authorization evidence before runtime implementation can start, Phase 56 adds implementation-readiness/rollout-safety evidence before runtime support can be claimed, Phase 57 adds implementation-scope evidence before implementation claims can proceed, Phase 58 adds runtime-implementation validation evidence, Phase 59 adds release-enable approval evidence, Phase 60 adds support-presence assertion evidence, and Phases 61 through 66 are the bounded completion track for activation.
- `docs/deployment-managed-database-runtime-guard.md` documents the Phase 46 managed database runtime guard exposed through `npm run deployment:check-runtime-guard` and `npm run deployment:check-runtime-guard -- --strict`. The guard allows local JSON/default, single-node SQLite, and Phase 52 managed Postgres startup only when a recognized Postgres adapter hint is paired with a managed database URL and the startup support assertion is present. Unsupported `TASKLOOM_STORE` values, unpaired managed database URL hints, managed/multi-writer topology hints, and `TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS` remain blocked or break-glass/dev-only rather than production support. Phase 53 adds the explicit design gate, Phase 54 requires the topology design package, Phase 55 requires review/implementation-authorization evidence, Phase 56 requires implementation-readiness/rollout-safety evidence, Phase 57 requires implementation-scope lock and release-owner signoff, Phase 58 requires runtime-implementation validation evidence, Phase 59 requires release-enable approval evidence, and Phase 60 requires support-presence assertion evidence. Horizontal writers, regional failover, PITR, and active-active writes remain blocked until the bounded activation, concurrency, dependency, recovery, cutover, and release-closure work in Phases 61 through 66 is complete for the supported production posture.
- Phase 47 integrates the Phase 45 managed database advisory and Phase 46 runtime guard into Phase 43 release readiness and Phase 44 release evidence so release automation can hand off a complete storage/runtime story while still allowing only local JSON/default and supported single-node SQLite runtimes.
- Phase 48 adds the managed database runtime boundary/foundation inside the synchronous app-store backend selection: `TASKLOOM_STORE=managed`, `TASKLOOM_STORE=postgres`, and managed database URL hints are recognized as managed intent and rejected with the sync-adapter gap.
- Phase 49 lands the async store boundary foundation after that fail-closed managed-database boundary.
- Phase 50 lands the managed Postgres document-store adapter/backfill foundation with `pg`, `TASKLOOM_MANAGED_DATABASE_ADAPTER`, `db:backfill-managed-postgres`, and `db:verify-managed-postgres`. Phase 51 tracks runtime call-site migration evidence with no remaining tracked sync call-site groups. Phase 52 asserts and validates managed Postgres startup support after that migration; managed/Postgres hints are accepted only for recognized Postgres adapter + managed database URL configurations. Phase 53 is not runtime implementation; it captures and blocks horizontal writers, regional failover, PITR, and active-active needs until a real topology is designed and owned. Phase 54 is also not runtime implementation; it requires the owned design package before multi-writer/distributed work can be planned. Phase 55 is review/authorization evidence only; it requires design-package review and implementation authorization before runtime implementation can start. Phase 56 is readiness/rollout-safety evidence only; it requires implementer/work-item readiness, test and migration dry-run proof, staged rollout controls, rollback/recovery proof, observability proof, and release-claim boundaries before runtime support can be claimed. Phase 57 is implementation-scope evidence only; it requires Phase 56 dependency, implementation scope lock, runtime feature flag/deployment gate, validation evidence, migration/cutover lock, and release-owner signoff before implementation claims can proceed. Phase 58 is runtime-implementation validation evidence only, Phase 59 is release-enable approval evidence only, and Phase 60 is support-presence assertion evidence only. Phases 61 through 66 are the bounded completion track that must add activation controls, concurrency hardening, distributed dependency enforcement, recovery validation, cutover/rollback automation, and final release closure for the supported production posture.
- Dedicated relational repository for `jobMetricSnapshots`: SQLite migration `0010_job_metric_snapshots.sql` plus `src/repositories/job-metric-snapshots-repo.ts` with a JSON/SQLite-switching factory. Existing `listJobMetricSnapshots`, `snapshotJobMetrics`, and `pruneJobMetricSnapshots` use the dedicated table in SQLite mode after Phase 38 mirror retirement. Operator CLIs `db:backfill-job-metric-snapshots` and `db:verify-job-metric-snapshots` cover old-backup recovery and drift audits.
- Dedicated relational repository for `alertEvents`: SQLite migration `0011_alert_events.sql` plus `src/repositories/alert-events-repo.ts` with the same JSON/SQLite-switching factory pattern. `listAlerts`, `recordAlerts`, and `updateAlertDeliveryStatus` use the dedicated table in SQLite mode after Phase 38 mirror retirement. Operator CLIs `db:backfill-alert-events` and `db:verify-alert-events` cover old-backup recovery and drift audits.
- Dedicated relational repository for `agentRuns`: SQLite migration `0012_agent_runs.sql` plus `src/repositories/agent-runs-repo.ts`. The three indexed read helpers and `upsertAgentRun` use the dedicated table in SQLite mode after Phase 38 mirror retirement. Operator CLIs `db:backfill-agent-runs` (with optional `--check-orphans`) and `db:verify-agent-runs` cover old-backup recovery and drift audits.
- Dedicated relational repository and SQLite scheduler hot-path for `jobs`: SQLite migration `0013_jobs.sql` plus `src/repositories/jobs-repo.ts` with transactional `claimNext`/`sweepStaleRunning` primitives. The two indexed read helpers delegate through the repository; SQLite mode `claimNextJob` and `sweepStaleRunningJobs` now use the repository primitives directly, while JSON mode keeps the existing in-process `claimMutex` and load-store-loop behavior. Operator CLIs `db:backfill-jobs` and `db:verify-jobs` cover old-backup recovery and drift audits.
- Dedicated relational repository for `invitationEmailDeliveries`: SQLite migration `0014_invitation_email_deliveries_table.sql` plus `src/repositories/invitation-email-deliveries-repo.ts`. The indexed read helper and all five mutators use the dedicated table in SQLite mode after Phase 38 mirror retirement. Operator CLIs `db:backfill-invitation-email-deliveries` and `db:verify-invitation-email-deliveries` cover old-backup recovery and drift audits. The Phase 22 schema-additive trick stops working past this step — future field additions need an explicit `ALTER TABLE` migration.
- Dedicated relational repository for `activities`: SQLite migration `0015_activities.sql` plus `src/repositories/activities-repo.ts`. `listActivitiesForWorkspaceIndexed(workspaceId, limit?)` and activity writes use the dedicated table in SQLite mode after Phase 38 mirror retirement. Operator CLIs `db:backfill-activities` and `db:verify-activities` cover old-backup recovery and drift audits.
- Dedicated relational repository for `providerCalls`: SQLite migration `0016_provider_calls.sql` plus `src/repositories/provider-calls-repo.ts`. `listProviderCallsForWorkspaceIndexed(workspaceId, { since?, limit? })` delegates through the repository without changing the caller-facing signature, and provider ledger writes use the dedicated `provider_calls` table in SQLite mode after mirror retirement. Operator CLIs `db:backfill-provider-calls` and `db:verify-provider-calls` cover old-backup recovery and drift audits.
- Dedicated relational repository for `activationSignals`: SQLite migration `0017_activation_signals.sql` plus the existing `activationSignalRepository()` API now backed by `activation_signals` in SQLite mode after the post-Phase-40 mirror-retirement follow-up. JSON mode keeps the inline `data.activationSignals` collection; SQLite `loadStore()` remains fully hydrated, and operator CLIs `db:backfill-activation-signals` and `db:verify-activation-signals` cover old-backup recovery and drift audits.
- The app runtime starts a persisted job scheduler for queued `agent.run` jobs, including cron re-enqueue after successful runs.
- Public agent webhooks enqueue `agent.run` jobs through tokenized `/api/public/webhooks/agents/:token` requests.
- React pages cover sign-in/sign-up, onboarding, dashboard, settings, activation, workflow, activity/detail, agents, runs, operations, integrations, and public share views.
- The frontend API layer has typed workflow calls for brief, requirements, plan items, blockers, questions, validation evidence, release confirmation, templates, prompt-generated drafts, Plan Mode, share tokens, and public share reads.
- Build, typecheck, and test scripts are available through `npm run build`.
- Local development uses ignored `data/taskloom.json` and `data/taskloom.sqlite` files that are recreated or migrated from built-in seed data and CLI commands.
- README, deployment auth hardening, SQLite topology, storage topology readiness, release readiness, invitation email operations, and activation docs cover local development, seed/reset, build, release hygiene flows, and production deployment guidance for the current single-node/local-store posture plus optional shared rate-limit integration.
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

- `activationSignals` is part of the JSON app model and is persisted through the opt-in SQLite app runtime. Phase 40 added a dedicated `activation_signals` table for the SQLite repository path, and the post-Phase-40 mirror-retirement follow-up removed the SQLite `app_records` mirror without a new migration. JSON mode keeps the inline collection.
- `activationSignalRepository()` provides normalized list/upsert access for JSON and SQLite modes; the SQLite implementation now uses `activation_signals` for fresh writes, and `loadStore()` remains fully hydrated by reading those rows back into `data.activationSignals`.
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

### Phase 28 Automated Job Metrics Snapshot Scheduling

Phase 28 closes the Phase 27 remaining gap that snapshot capture required external cron, by registering a `metrics.snapshot` job handler that uses the existing scheduler's cron support:

- A new `src/jobs/metrics-snapshot-handler.ts` module exports `handleMetricsSnapshotJob(payload, deps)` (a thin wrapper over `snapshotJobMetrics`) and `ensureMetricsSnapshotCronJob(deps)` (a startup helper).
- The server bootstrap registers the handler with the JobScheduler and calls `ensureMetricsSnapshotCronJob()` after `scheduler.start()`. When `TASKLOOM_JOB_METRICS_SNAPSHOT_CRON` is set, a single recurring job is enqueued; the scheduler's existing recurring-job behavior re-enqueues subsequent runs after each success.
- `TASKLOOM_JOB_METRICS_SNAPSHOT_RETENTION_DAYS` (default `30`) and `TASKLOOM_JOB_METRICS_SNAPSHOT_WORKSPACE_ID` (default `"__system__"`) tune the job payload and bookkeeping.
- Existence is detected by matching type + cron among queued/running/success jobs so process restarts do not enqueue duplicates. Invalid cron expressions log a warning and skip the bootstrap.
- `OperationsStatus.jobMetricsSnapshots: { total, lastCapturedAt }` is derived from `data.jobMetricSnapshots`. The Operations page renders a "Last snapshot X ago (N total)" indicator next to the existing trend caption so admins can confirm the cron is firing.
- `docs/deployment-health-endpoints.md` documents the env knobs, the existence-check rule, and the validation checklist.

This phase does not ship per-workspace snapshot scoping, hosted scheduling, alerting on missed snapshots, downsampled long-term retention, managed database topology, or dedicated relational repositories.

### Phase 29 Webhook-Based Alerting

Phase 29 implements the next operator-visibility hardening item by adding rule-based alert evaluation, optional webhook delivery, and persistent alert history on top of the Phase 25/26/27/28 metrics and health surfaces:

- A new `src/alerts/alert-engine.ts` evaluates `OperationsHealthReport` and `JobTypeMetrics[]` against three built-in rules: `subsystem-degraded` (warning), `subsystem-down` (critical), and `job-failure-rate` (warning when failure ratio > threshold and >= minSamples runs; critical above 0.8).
- A new `src/alerts/alert-webhook.ts` adapter POSTs `{ alerts, deliveredAt }` to `TASKLOOM_ALERT_WEBHOOK_URL` with `TASKLOOM_ALERT_WEBHOOK_SECRET` bearer (header configurable via `TASKLOOM_ALERT_WEBHOOK_SECRET_HEADER`, default `x-taskloom-alert-secret`) and `TASKLOOM_ALERT_WEBHOOK_TIMEOUT_MS` (default `5000`). Errors are structured (never throw) with redacted detail.
- A new `alerts.evaluate` job handler runs the pipeline: evaluate → deliver → persist. `TASKLOOM_ALERT_EVALUATE_CRON` enqueues a single recurring job using the same scheduler/cron pattern Phase 28 uses for `metrics.snapshot`. Existence-check on type + cron prevents duplicate enqueues.
- Alerts persist to `data.alertEvents` regardless of webhook delivery outcome. `TASKLOOM_ALERT_RETENTION_DAYS` (default `30`) prunes older rows on each evaluation. Admin `GET /api/app/operations/alerts` returns recent rows newest-first with `severity`/`since`/`until`/`limit` filters.
- The Operations page renders a "Recent alerts" sub-section showing the last 25 alerts with severity badges and delivery status icons.
- `docs/deployment-alerting.md` documents the rule set, webhook contract, env knobs, scheduled evaluation, retention, and validation checklist.

This phase does not ship per-rule runtime suppression, custom rule definitions, alert deduplication beyond the per-evaluation context key, retry/dead-letter for webhook delivery, hosted alert routing infrastructure, managed database topology, or dedicated relational repositories.

### Phase 30 Alert Delivery Retry And Dead-Letter

Phase 30 hardens Phase 29 webhook delivery with Taskloom-owned retry on top of the existing scheduler retry-with-backoff path:

- A new `alerts.deliver` job handler in `src/alerts/alerts-deliver-handler.ts` delivers a single alert by id, increments `deliveryAttempts`, updates `lastDeliveryAttemptAt`, and dead-letters via `deadLettered: true` after `TASKLOOM_ALERT_DELIVER_MAX_ATTEMPTS` attempts (default `3`, integer >= 1; the inline attempt during evaluate counts as attempt 1).
- The Phase 29 evaluate handler now enqueues one `alerts.deliver` retry job per undelivered event with `maxAttempts = TASKLOOM_ALERT_DELIVER_MAX_ATTEMPTS - 1`. The scheduler's existing 30s/exponential backoff (capped at 1 hour) drives subsequent attempts.
- `AlertEventRecord` gains three optional fields: `deliveryAttempts`, `lastDeliveryAttemptAt`, `deadLettered`. Successful retries clear `deliveryError`.
- The Operations page Recent Alerts tile shows distinct visual states for delivered (with attempt count when > 1), retrying (amber), and dead-lettered (rose with explicit label).
- When `TASKLOOM_ALERT_WEBHOOK_URL` is unset, retry jobs short-circuit with a no-op success so explicitly-disabled webhooks don't generate background work.
- `docs/deployment-alerting.md` documents the retry semantics, the new env knob, and the dead-letter inspection workflow.

This phase does not ship per-rule retry overrides, alert deduplication beyond the per-evaluation context key, hosted retry infrastructure, managed database topology, or dedicated relational repositories.

### Phase 31 Workflow And Dashboard UX Polish

Phase 31 hardens the Section 5 workflow/UI polish items by making three additive frontend improvements without changing any backend behavior:

- **Dashboard filters are now URL-persisted.** Stage, risk, status, and recency filter state lives in `?stage=...&risk=...&status=...&recency=...` query params (defaults omitted) so refreshes preserve filters and admins can share filtered links. An active-filters chip bar renders above the existing filter controls with one removable chip per active filter and a "Clear all" reset.
- **Activity detail surfaces workflow context inline.** The `WorkflowPanel` in `ActivityDetail.tsx` now renders up to 3 active blockers (severity badge + title) and up to 3 open questions, plus a "View workflow" link to the full editor. Empty placeholders read "No active blockers." / "No open questions."
- **Workflow page empty states have explicit CTAs.** When Requirements, Plan items, or Blockers are empty and the user has edit permission, the page shows a friendly empty block with an "Add first ..." button that triggers the existing add flow. The brief header shows a small "N versions" badge when brief versions exist.

This phase does not change backend route behavior, modify activation signal mapping, alter the workflow record schema, or introduce new APIs.

### Phase 32 Relational Repository: Job Metric Snapshots

Phase 32 is the first step of the dedicated-relational-repositories migration plan documented in `docs/roadmap-relational-repositories.md`. It moves `jobMetricSnapshots` from the JSON-payload `app_records` row into a dedicated `job_metric_snapshots` SQLite table while preserving the JSON-default runtime and the existing read-path signature:

- New migration `src/db/migrations/0010_job_metric_snapshots.sql` creates the table (`WITHOUT ROWID`) with indexes on `(captured_at desc, id)` and `(type, captured_at desc, id)`.
- New repository module `src/repositories/job-metric-snapshots-repo.ts` exposes `createJobMetricSnapshotsRepository(deps?)` with `list`/`insertMany`/`prune`/`count`. The factory switches on `process.env.TASKLOOM_STORE`: SQLite mode reads/writes the dedicated table; JSON mode keeps reading/writing the inline `data.jobMetricSnapshots` array. Both implementations apply identical filter, sort, and limit semantics so JSON-mode and SQLite-mode tests assert behavioral parity.
- `listJobMetricSnapshots` in `src/jobs/job-metrics-snapshot.ts` now delegates to the repository through a thin `src/jobs/job-metrics-snapshot-read.ts` wrapper. Existing callers and tests are unchanged.
- In SQLite mode, `snapshotJobMetrics` and `pruneJobMetricSnapshots` dual-write to BOTH `app_records` (legacy JSON-side mirror) and the dedicated table during the cutover window so `db:restore` against a pre-cutover backup keeps working.
- Two new operator CLI commands: `npm run db:backfill-job-metric-snapshots [-- --dry-run]` for one-shot JSON-side-to-dedicated-table backfill (idempotent via `INSERT OR REPLACE`); `npm run db:verify-job-metric-snapshots` for cron-friendly drift detection between the two surfaces.
- The JSON-side mirror write is retained for now and will be retired in a later phase (Phase 38) once dual-write has run cleanly across at least one stable phase. Until then, `data.jobMetricSnapshots` continues to round-trip through `app_records`.

This phase does not migrate other collections (alert events, agent runs, jobs, invitation deliveries, activities — those are queued for Phases 33-37), retire the JSON-side mirror write, change `loadStore()` semantics, or introduce a feature flag for opt-out reads.

### Phase 33 Relational Repository: Alert Events

Phase 33 is the second step of the dedicated-relational-repositories migration plan. It moves `alertEvents` from the JSON-payload `app_records` row into a dedicated `alert_events` SQLite table while preserving the JSON-default runtime, the existing `listAlerts` signature, and Phase 30's retry/dead-letter mutation semantics:

- New migration `src/db/migrations/0011_alert_events.sql` creates the table (`WITHOUT ROWID`) with check constraints on `severity` and `delivered`, plus JSON validity on `context`. Indexes cover `(observed_at desc, id)` and `(severity, observed_at desc, id)`.
- New repository module `src/repositories/alert-events-repo.ts` exposes `createAlertEventsRepository(deps?)` with `list`/`insertMany`/`updateDeliveryStatus`/`prune`/`count`. The factory switches on `process.env.TASKLOOM_STORE`: SQLite mode reads/writes the dedicated table; JSON mode keeps reading/writing the inline `data.alertEvents` array. Both implementations sort by `observedAt` DESCENDING.
- `listAlerts` in `src/alerts/alert-store.ts` now delegates to the repository through a thin `src/alerts/alert-store-read.ts` wrapper. Existing callers and tests are unchanged.
- In SQLite mode, `recordAlerts` and `updateAlertDeliveryStatus` dual-write to BOTH `app_records` (legacy JSON-side mirror) and the dedicated table. The `updateDeliveryStatus` mutation pattern (increments `deliveryAttempts`, sets `lastDeliveryAttemptAt`, conditionally clears `deliveryError` on success, conditionally sets `deadLettered`) is the new wrinkle this phase exercises beyond Phase 32's append-only snapshots.
- Two new operator CLI commands: `npm run db:backfill-alert-events [-- --dry-run]` for one-shot JSON-side-to-dedicated-table backfill (idempotent via `INSERT OR REPLACE`); `npm run db:verify-alert-events` for cron-friendly drift detection.
- The JSON-side mirror write is retained for now and will be retired in a later phase (Phase 38) once dual-write has run cleanly across at least one stable phase.

This phase does not migrate the remaining queued collections (`agentRuns`, `jobs`, `invitationEmailDeliveries`, `activities` — Phases 34-37), retire the JSON-side mirror write, change `loadStore()` semantics, or introduce a feature flag for opt-out reads.

### Phase 34 Relational Repository: Agent Runs

Phase 34 is the third step of the dedicated-relational-repositories migration plan. It moves `agentRuns` from the JSON-payload `app_records` row into a dedicated `agent_runs` SQLite table while preserving the JSON-default runtime, the existing read-helper signatures, and Phase 11's indexed read patterns:

- New migration `src/db/migrations/0012_agent_runs.sql` creates the table (NOT `WITHOUT ROWID` because rows mutate during a run) with `json_valid` check constraints on `inputs`, `logs`, `tool_calls`, and `transcript`. Indexes cover `(workspace_id, created_at desc, id)` and `(workspace_id, agent_id, created_at desc, id)` to keep the existing read patterns hot.
- New repository module `src/repositories/agent-runs-repo.ts` exposes `createAgentRunsRepository(deps?)` with `list(workspaceId, limit?)`/`listForAgent(workspaceId, agentId, limit?)`/`find(workspaceId, runId)`/`upsert`/`count`. JSON and SQLite implementations share identical createdAt-DESC sort, default limit 50, cap 200.
- The three existing read helpers in `src/taskloom-store.ts` now delegate to the repository through a thin `src/agent-runs-read.ts` wrapper. Existing callers and tests are unchanged.
- In SQLite mode, `upsertAgentRun` dual-writes to BOTH `app_records` and the dedicated `agent_runs` table.
- Two new operator CLI commands: `npm run db:backfill-agent-runs [-- --dry-run] [-- --check-orphans]` for one-shot JSON-side-to-dedicated-table backfill (idempotent via `INSERT OR REPLACE`); `npm run db:verify-agent-runs` for cron-friendly drift detection. The `--check-orphans` flag reports rows whose `agentId` references a missing `agents` row but does not block the backfill — application-layer integrity remains the boundary.
- The JSON-side mirror write is retained for now and will be retired in Phase 38 once dual-write has run cleanly across at least one stable phase.

This phase does not migrate the remaining queued collections (`jobs`, `invitationEmailDeliveries`, `activities` — Phases 35-37), retire the JSON-side mirror write, change `loadStore()` semantics, normalize the run sub-arrays into separate tables (`logs`, `toolCalls`, `transcript` continue to live JSON-encoded inside the row per the design doc), or introduce a feature flag for opt-out reads.

### Phase 35 Relational Repository: Jobs

Phase 35 was the fourth step of the dedicated-relational-repositories migration plan. It moved `jobs` to a dedicated `jobs` SQLite table with an initially conservative cutover: the table, repository, dual-write, and CLI shipped first while the scheduler's `claimNextJob` and `sweepStaleRunningJobs` temporarily kept their existing load-store-loop pattern with `claimMutex`. After Phase 38 retired the legacy JSON-side mirrors, the no-migration follow-up cutover flipped those two SQLite-mode hot-path functions to the repository's transactional primitives.

- New migration `src/db/migrations/0013_jobs.sql` creates the table (NOT `WITHOUT ROWID`; rows mutate heavily through status churn and attempt increments) with check constraints on the `status` enum and `cancel_requested` tri-state, plus `json_valid` checks on `payload` and `result`. Indexes cover `(workspace_id, created_at desc, id)`, `(status, scheduled_at, id)`, and `(status, started_at)` for repository reads and scheduler maintenance.
- New repository module `src/repositories/jobs-repo.ts` exposes `createJobsRepository(deps?)` with `list({ workspaceId, status?, limit? })`/`find(id)`/`upsert(record)`/`update(id, patch)`/`count()`/`claimNext(now)`/`sweepStaleRunning(staleAfterMs, now)`. The `claimNext` and `sweepStaleRunning` SQLite implementations use `BEGIN IMMEDIATE` and update the dedicated table transactionally while preserving the existing `Date.parse` timestamp semantics. They are now the SQLite-mode scheduler hot path.
- The two indexed read helpers in `src/taskloom-store.ts` (`listJobsForWorkspaceIndexed`, `findJobIndexed`) now delegate to the repository through a thin `src/jobs-read.ts` wrapper. Existing signatures preserved. The wrapper applies the same defensive merge-and-fall-back pattern Phase 34 used so legacy `mutateStore`-direct test seeding continues to round-trip in SQLite mode.
- During the Phase 35-37 cutover window, every job write — `enqueueJob`, `updateJob`, `cancelJob`, `enqueueRecurringJob`, `maintainScheduledAgentJobs`, plus the state-change emissions from `claimNextJob` and `sweepStaleRunningJobs` — dual-wrote to BOTH `app_records` (legacy JSON-side) and the dedicated `jobs` table. Phase 38 retired that mirror in SQLite mode, and the post-retirement scheduler hot-path now updates the dedicated table through the repository primitives.
- The original conservative cutover kept scheduler concurrency semantics unchanged during the dual-write window. The post-Phase 38 follow-up now uses repository transactional `claimNext`/`sweepStaleRunning` in SQLite mode, so `BEGIN IMMEDIATE` and the dedicated `jobs` table own the local atomic claim/sweep behavior. JSON mode is unchanged and still uses the in-process `claimMutex` plus load-store-loop over `data.jobs`.
- Two new operator CLI commands: `npm run db:backfill-jobs [-- --dry-run]` for one-shot JSON-side-to-dedicated-table backfill (idempotent via `INSERT OR REPLACE`); `npm run db:verify-jobs` for cron-friendly drift detection.

Phase 35 itself did not migrate the remaining queued collections (`invitationEmailDeliveries`, `activities` — Phases 36-37), retire the JSON-side mirror write, change `loadStore()` semantics, or normalize `payload`/`result` into separate columns. The later no-migration follow-up only changes SQLite-mode scheduler claim/sweep routing; it does not change JSON mode or add a new migration.

### Phase 36 Relational Repository: Invitation Email Deliveries

Phase 36 is the fifth step of the dedicated-relational-repositories migration plan. It moves `invitationEmailDeliveries` to a dedicated SQLite table while preserving the JSON-default runtime, the existing `listInvitationEmailDeliveriesIndexed` signature, and the five mutator functions:

- New migration `src/db/migrations/0014_invitation_email_deliveries_table.sql` creates the table (`WITHOUT ROWID`) with indexes `(workspace_id, created_at desc, id)` and `(invitation_id, created_at desc, id)`. The existing `0008_invitation_email_deliveries.sql` (which only adds an `app_records` index) is preserved.
- New repository module `src/repositories/invitation-email-deliveries-repo.ts` exposes `createInvitationEmailDeliveriesRepository(deps?)` with `list({ workspaceId, invitationId?, limit? })`/`find(id)`/`upsert`/`count`. JSON and SQLite implementations share createdAt-DESC sort with default limit 50, cap 200.
- `listInvitationEmailDeliveriesIndexed` in `src/taskloom-store.ts` now delegates to the repository through a thin `src/invitation-email-deliveries-read.ts` wrapper. Existing signature preserved.
- In SQLite mode, all five mutators (`createInvitationEmailDelivery`, `markInvitationEmailDeliverySent`, `markInvitationEmailDeliverySkipped`, `markInvitationEmailDeliveryFailed`, `recordInvitationEmailProviderStatus`) dual-write to BOTH `app_records` and the dedicated table. The dual-write uses the deferred-queue mechanism inside `mutateSqliteStore` so the second connection only opens after the JSON-side `BEGIN IMMEDIATE` transaction commits, avoiding SQLite write-lock deadlock.
- Two new operator CLI commands: `npm run db:backfill-invitation-email-deliveries [-- --dry-run]` and `npm run db:verify-invitation-email-deliveries`.
- **The Phase 22 schema-additive trick stops working past this step.** Phase 22 added `providerStatus`, `providerDeliveryId`, `providerStatusAt`, and `providerError` as optional fields without a migration because the data lived inside the `app_records` JSON payload. After Phase 36, any future field on `InvitationEmailDeliveryRecord` requires an explicit `ALTER TABLE invitation_email_deliveries ADD COLUMN ...` migration.

This phase does not migrate the remaining queued collection (`activities` — Phase 37), retire the JSON-side mirror write, change `loadStore()` semantics, or normalize provider error strings into a separate audit table. The Phase 35 scheduler hot-path cutover landed later as a no-migration follow-up after mirror retirement.

### Phase 37 Relational Repository: Activities

Phase 37 is the sixth step of the dedicated-relational-repositories migration plan. It moves `activities` to a dedicated SQLite table while preserving the JSON-default runtime and the existing `listActivitiesForWorkspaceIndexed(workspaceId, limit?)` read signature:

- New migration `src/db/migrations/0015_activities.sql` creates the `activities` table with a workspace/occurred-at index for `occurredAt` DESC reads.
- New repository module `src/repositories/activities-repo.ts` provides the dedicated activities table/repository path in SQLite mode while JSON mode keeps using the inline `data.activities` collection.
- `listActivitiesForWorkspaceIndexed(workspaceId, limit?)` now delegates through the repository without changing the caller-facing signature or limit behavior.
- In SQLite mode, activity writes dual-write to BOTH `app_records` (legacy JSON-side mirror) and the dedicated `activities` table during the cutover window.
- Two new operator CLI commands: `npm run db:backfill-activities [-- --dry-run]` for one-shot JSON-side-to-dedicated-table backfill (idempotent via `INSERT OR REPLACE`); `npm run db:verify-activities` for cron-friendly drift detection.

This phase does not retire the JSON-side mirror write, change `loadStore()` semantics, normalize activity payload/data/actor into separate tables, or start Phase 38.

### Phase 38 Retire Legacy JSON-Side Mirrors

Phase 38 retires the SQLite `app_records` mirror for the six collections that now have dedicated relational repositories: `jobMetricSnapshots`, `alertEvents`, `agentRuns`, `jobs`, `invitationEmailDeliveries`, and `activities`.

- No new migration is required. The existing dedicated tables from Phases 32 through 37 remain the SQLite source of truth.
- `src/taskloom-store.ts` no longer writes those six collections into `app_records` or `app_record_search` during whole-store SQLite persistence.
- SQLite `loadStore()` still returns a fully hydrated `TaskloomData`; it now merges those six collections from their dedicated tables, falling back to legacy `app_records` rows only when a dedicated table is empty so old restored backups can still be recovered with the existing backfill commands.
- Whole-store seed/reset/import paths (`persistSqliteAppData`) synchronize those six collections directly into their dedicated tables, so fresh schemas no longer need JSON-side mirrors.
- The existing `db:backfill-<collection>` and `db:verify-<collection>` commands stay shipped as restore-from-old-backup and drift-audit tools.

This phase does not change the JSON-default runtime, remove the collection fields from `TaskloomData`, remove the backfill/verify CLIs, or make SQLite a multi-writer or distributed production topology. The Phase 35 scheduler hot path has now landed as a no-migration code/docs/test follow-up after mirror retirement.

### Phase 39 Relational Repository: Provider Calls

Phase 39 starts the next dedicated-relational-repository cutover by moving `providerCalls` from indexed `app_records` reads into a dedicated SQLite table while preserving the JSON-default runtime, provider usage semantics, and the existing `listProviderCallsForWorkspaceIndexed(workspaceId, { since?, limit? })` read signature:

- New migration `src/db/migrations/0016_provider_calls.sql` creates the `provider_calls` table for provider ledger rows, including workspace, route, provider/model, token/cost/duration, status/error, and started/completed timestamps.
- New repository module `src/repositories/provider-calls-repo.ts` provides the JSON/SQLite-switching repository path. JSON mode continues to use the inline `data.providerCalls` collection; SQLite mode reads from the dedicated table.
- `listProviderCallsForWorkspaceIndexed(workspaceId, { since?, limit? })` now delegates through the repository while preserving the caller-facing filter, sort, and limit behavior used by usage rollups.
- In SQLite mode, provider ledger writes dual-write to BOTH `app_records` (legacy JSON-side mirror) and the dedicated `provider_calls` table during the cutover window.
- Two new operator CLI commands: `npm run db:backfill-provider-calls [-- --dry-run]` for one-shot JSON-side-to-dedicated-table backfill (idempotent via `INSERT OR REPLACE`); `npm run db:verify-provider-calls` for cron-friendly drift detection.

This phase retires the JSON-side mirror write for `providerCalls` in SQLite mode after the dedicated table path is in place. It does not change `loadStore()` semantics, normalize provider usage into separate aggregate tables, or make SQLite a multi-writer or distributed production topology.

### Phase 40 Relational Repository: Activation Signals

Phase 40 lifts `activationSignals` from the `app_records` compatibility layer into a dedicated SQLite table while preserving the JSON-default runtime and the existing `activationSignalRepository()` API. The post-Phase-40 mirror-retirement follow-up (Phase 41, no new migration) retires the SQLite `app_records` mirror for activation signals:

- New migration `src/db/migrations/0017_activation_signals.sql` creates `activation_signals` with workspace/created-at and workspace/stable-key indexes.
- The SQLite implementation of `activationSignalRepository()` now reads/writes the dedicated table, while JSON mode continues to use the inline `data.activationSignals` collection.
- Direct service writes through `upsertActivationSignal(data, ...)` continue to mutate the hydrated `TaskloomData` shape; in SQLite mode, fresh writes persist through `activation_signals` instead of creating a legacy `app_records` mirror row.
- SQLite `loadStore()` still returns a fully hydrated `TaskloomData` by reading activation signal rows from `activation_signals` into `data.activationSignals`.
- Two operator CLI commands remain shipped: `npm run db:backfill-activation-signals [-- --dry-run]` for old-backup recovery and `npm run db:verify-activation-signals` for drift audits.

Phase 40 itself did not retire the JSON-side mirror write for `activationSignals`; the no-migration post-Phase-40 follow-up does. Neither step changes activation fact/read-model storage, normalizes signal `data` into separate columns, changes JSON mode, or makes SQLite a multi-writer or distributed production topology.

### Phase 42 Storage Topology Readiness Report

Phase 42 lands a production storage topology readiness/advisory layer for operators. It makes the current storage posture visible through CLI/API/UI surfaces while keeping the runtime boundaries unchanged:

- New operator command: `npm run deployment:check-storage`; use `npm run deployment:check-storage -- --strict` for release gates that should fail on deployment-blocking findings.
- The same readiness report is surfaced as `storageTopology` on the admin `GET /api/app/operations/status` response and in the Operations UI Production Status panel.
- The report calls out whether the deployment matches the supported posture: JSON for local contributor workflows, SQLite for single-node local/preview/production persistence, or deployment-owned managed database planning for horizontal writers, failover, PITR, or active/active requirements.
- Phase 42 does not provision managed Postgres, add managed database repositories, change `TASKLOOM_STORE`, introduce distributed SQLite, or make SQLite safe for multi-writer production topologies.
- SQLite remains single-node. Optional scheduler leader election and optional distributed rate limiting address their own coordination scopes only; they do not change database topology.

Docs for the operator workflow live in `docs/deployment-storage-topology.md`, with the SQLite-specific limits still covered by `docs/deployment-sqlite-topology.md`.

### Phase 43 Deployment Release Readiness Gates

Phase 43 lands deployment release-readiness gates once the code slices integrate. It layers a release-facing check on top of the Phase 42 storage topology report:

- New release gate command: `npm run deployment:check-release`; use `npm run deployment:check-release -- --strict` for CI and release automation that should fail on blocking findings.
- The gate checks backup/restore readiness, persistent SQLite/artifact/log paths, Phase 42 storage topology findings, Phase 45 managed database advisory findings, and Phase 46 runtime-guard findings before production handoff.
- The gate is inspection-only: it does not perform backups, restore data, provision managed DBs, add managed database repositories, or make SQLite distributed.
- SQLite remains a single-node storage posture. After Phase 52, narrow managed Postgres startup is supported only for recognized Postgres adapter + managed database URL configurations; regional failover, PITR, active/active writes, and any multi-writer database topology remain deployment-owned implementation work blocked by the Phase 53 requirements/design gate, Phase 54 design-package gate, Phase 55 review/authorization evidence gate, Phase 56 readiness/rollout-safety evidence gate, Phase 57 implementation-scope gate, and Phase 58 runtime-implementation validation gate.

Docs for the release gate live in `docs/deployment-release-readiness.md`.

### Phase 44 Deployment Release Evidence Bundle

Phase 44 lands the deployment release evidence bundle once the code slices integrate. It layers a handoff/export package on top of the Phase 42 storage topology report and the Phase 43 release-readiness gate:

- New evidence export command: `npm run deployment:export-evidence`; use `npm run deployment:export-evidence -- --strict` for CI and release automation that should fail on blocking readiness findings.
- The export packages readiness, topology, persistent-path, backup/restore-readiness, Phase 45 managed database advisory output, Phase 46 runtime-guard output, related attachments, and environment/runtime evidence for release handoff.
- The export redacts secrets and token-like values before they enter the bundle.
- The export is packaging-only: it does not run backups, tests, or builds; restore data; provision managed DBs; add managed database repositories; or make SQLite distributed.
- SQLite remains a single-node storage posture. After Phase 52, narrow managed Postgres startup is supported only for recognized Postgres adapter + managed database URL configurations; regional failover, PITR, active/active writes, and any multi-writer database topology remain deployment-owned implementation work blocked through Phase 58 and a later explicit release/runtime enablement phase.

Docs for the release evidence bundle live in `docs/deployment-release-evidence.md`.

### Phase 45 Managed Database Topology Advisory

Phase 45 lands managed production database topology readiness/advisory reporting once the code slices integrate. It makes the managed database gap explicit for operators without changing the runtime boundaries:

- New advisory command: `npm run deployment:check-managed-db`; use `npm run deployment:check-managed-db -- --strict` for CI and release automation that should fail on blocking topology findings.
- The advisory can use operator hints from `TASKLOOM_MANAGED_DATABASE_URL`, `DATABASE_URL`, `TASKLOOM_DATABASE_URL`, `TASKLOOM_DATABASE_TOPOLOGY`, and `TASKLOOM_STORE` to classify deployment intent.
- The advisory is reporting/planning-only: it does not add a managed Postgres adapter, add managed database repositories, introduce distributed SQLite, or make SQLite safe for multi-writer production topologies.
- After Phase 52, narrow managed Postgres startup is supported only for recognized Postgres adapter + managed database URL configurations. Regional failover, PITR, active/active writes, and any multi-writer database runtime remain future implementation work, with Phase 53 documenting the design gate, Phase 54 requiring the owned design package, Phase 55 requiring review/implementation-authorization evidence, Phase 56 requiring readiness/rollout-safety evidence, Phase 57 requiring implementation-scope evidence, and Phase 58 validating runtime implementation evidence without enabling runtime support or release approval.

Docs for the managed database topology advisory live in `docs/deployment-managed-database-topology.md`.

### Phase 46 Managed Database Runtime Guardrails

Phase 46 lands managed database runtime guardrails once the code slices integrate. It blocks unsupported runtime hints before startup/release automation can treat them as supported configuration:

- New guard command: `npm run deployment:check-runtime-guard`; use `npm run deployment:check-runtime-guard -- --strict` for CI, startup wrappers, and release automation that should fail on blocked runtime posture.
- The original guard allowed only the local JSON/default runtime and single-node SQLite runtime; after Phase 52 it also allows the narrow recognized Postgres adapter + managed database URL startup posture.
- The guard blocks unsupported `TASKLOOM_STORE` values, managed database URL hints from `TASKLOOM_MANAGED_DATABASE_URL`, `DATABASE_URL`, or `TASKLOOM_DATABASE_URL`, and managed/multi-writer topology hints from `TASKLOOM_DATABASE_TOPOLOGY`.
- `TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS` is break-glass/dev-only for controlled experiments. It is not production support and must not be used to claim managed Postgres, distributed SQLite, or multi-writer runtime support.
- Phase 46 does not add a managed Postgres adapter, managed database repositories, regional failover, PITR, active/active writes, distributed SQLite, or any multi-writer database runtime.

Docs for the runtime guard live in `docs/deployment-managed-database-runtime-guard.md`.

### Phase 47 Release Handoff Integration

Phase 47 lands the documentation and handoff integration that connects Phase 45/46 managed database reports into the Phase 43/44 release automation story:

- Phase 43 release readiness now includes managed database advisory findings and runtime-guard findings alongside backup/restore, persistent-path, and storage-topology checks.
- Phase 44 release evidence now includes managed database advisory output, runtime-guard output, and related attachments in the redacted handoff bundle.
- The integration keeps the support boundary explicit: local JSON/default storage and supported single-node SQLite remain allowed, Phase 52 later allows the narrow recognized Postgres adapter + managed database URL startup posture, and multi-writer topology hints remain blocked or advisory until separate deployment-owned topology support exists.
- Phase 47 does not add a managed Postgres adapter, managed database repositories, regional failover, PITR, active/active writes, distributed SQLite, or any multi-writer database runtime.

Docs for the integrated handoff live in `docs/deployment-release-readiness.md`, `docs/deployment-release-evidence.md`, and `docs/deployment-managed-database-runtime-guard.md`.

### Phase 48 Managed Database Runtime Boundary/Foundation

Phase 48 lands the managed database runtime boundary in the current synchronous app-store path. It is foundation work for a future managed database adapter, not managed Postgres runtime support:

- The store mode resolver now recognizes managed database intent from `TASKLOOM_STORE=managed`, `TASKLOOM_STORE=managed-db`, `TASKLOOM_STORE=managed-database`, `TASKLOOM_STORE=postgres`, `TASKLOOM_STORE=postgresql`, and managed database URL hints such as `DATABASE_URL`, `TASKLOOM_DATABASE_URL`, and `TASKLOOM_MANAGED_DATABASE_URL`.
- The synchronous `loadStore()` / `mutateStore()` backend selection fails closed with `ManagedDatabaseStoreBoundaryError` when those hints are present, because the current store API is synchronous and cannot honestly support managed database I/O yet.
- Local JSON/default storage and supported single-node SQLite remain the only implemented runtime postures.
- Phase 48 does not add an async store API migration, a managed Postgres adapter, managed database repositories/backfills, regional failover, PITR, active/active writes, distributed SQLite, or any multi-writer database topology.

This means Phase 47 completed the release-readiness/evidence handoff integration for managed-database advisory and guard findings, and Phase 48 completed the runtime boundary/foundation that prevents the synchronous app-store path from silently accepting managed database hints. Phase 49 follows by landing the async store boundary foundation; the actual managed Postgres adapter/repository/backfill work and any multi-writer topology story remain separate implementation phases.

### Phase 49 Async Store Boundary Foundation

Phase 49 lands the async store boundary foundation after the Phase 48 fail-closed managed database boundary. It is the next piece of foundation work for managed database support, not managed Postgres runtime support:

- `loadStoreAsync()` and `mutateStoreAsync()` are available as Promise-capable store boundary entry points, with JSON/default and SQLite backends adapted behind that surface.
- Before Phase 50, the async managed-database backend still rejected managed/Postgres store modes and managed database URL hints with `ManagedDatabaseStoreBoundaryError`; Phase 50 replaces that placeholder with the managed Postgres document-store adapter/backfill foundation.
- Local JSON/default storage and supported single-node SQLite remain implemented runtime postures.
- Phase 52 later asserts/validates managed Postgres startup support for recognized Postgres adapter + managed database URL configurations; other managed/Postgres store modes and managed database URL hints remain blocked or advisory.
- Phase 49 does not add a managed Postgres adapter, managed database repositories/backfills, managed database migrations, regional failover, PITR, active/active writes, distributed SQLite, or any multi-writer database topology.

This means Phase 50 can land the managed Postgres adapter/backfill foundation now that the async boundary foundation is in place, and Phase 52 can later assert startup support after the guarded runtime call sites move onto the managed database path.

### Phase 50 Managed Postgres Adapter/Backfill Foundation

Phase 50 lands the managed Postgres adapter/backfill foundation after the Phase 49 async store boundary. It is the first managed-database implementation foundation; Phase 52 is the later point where a narrow managed/Postgres startup assertion is validated:

- The milestone is documented as landed for the managed Postgres adapter/backfill foundation.
- The main app startup path still runs the Phase 46 runtime guard before serving traffic. After Phase 52, managed/Postgres hints can be accepted only for recognized Postgres adapter + managed database URL configurations.
- Phase 50 adds the `pg` package dependency, the `TASKLOOM_MANAGED_DATABASE_ADAPTER` advisory/guard hint, and the `npm run db:backfill-managed-postgres` / `npm run db:verify-managed-postgres` CLIs. Existing deployment checks remain `npm run deployment:check-managed-db`, `npm run deployment:check-runtime-guard`, `npm run deployment:check-release`, and `npm run deployment:export-evidence`.
- Phase 51 migrates tracked runtime call sites to the async/managed database path. Phase 52 then asserts and validates the startup support needed for the guard to allow the narrow managed/Postgres posture.
- Phase 50 does not add regional failover, PITR, active/active writes, distributed SQLite, or any multi-writer database topology.

### Phase 52 Managed Postgres Startup Support Assertion

Phase 52 lands after the Phase 51 call-site migration evidence and asserts/validates the guarded managed Postgres startup path.

- Managed/Postgres hints can be accepted only when `TASKLOOM_MANAGED_DATABASE_ADAPTER` is a recognized Postgres value (`postgres`, `postgresql`, `managed-postgres`, or `managed-postgresql`) and one managed database URL hint is present (`TASKLOOM_MANAGED_DATABASE_URL`, `TASKLOOM_DATABASE_URL`, or `DATABASE_URL`).
- The startup support assertion is required before release-readiness, release-evidence, topology advisory, or runtime-guard checks can treat those hints as supported startup configuration.
- Unsupported managed store names, missing adapter/URL pairs, managed/multi-writer topology hints, distributed SQLite, regional failover, PITR, and active-active writes remain blocked or deployment-owned future work.

This means managed Postgres startup support is documented as a narrow asserted posture after the adapter/backfill foundation and call-site migration, not as a blanket managed database or multi-writer topology claim.

### Phase 53 Multi-Writer Topology Requirements/Design Gate

Phase 53 lands after the Phase 52 startup assertion and makes the next boundary explicit: Taskloom does not yet implement multi-writer or distributed database runtime support.

- Horizontal database writers, regional failover, PITR, and active-active writes are blocking topology requirements, not implied capabilities of the Phase 52 managed/Postgres startup path.
- Release-readiness, release-evidence, topology advisory, and runtime-guard docs must keep those needs visible as blocked until a real topology is designed, owned, captured in a Phase 54 design package, reviewed and authorized through Phase 55 evidence, and later implemented.
- Scheduler leader election and distributed rate limiting coordinate their own scopes only; they do not provide database write coordination, replication conflict handling, failover, PITR, or active-active semantics.
- The accepted Phase 52 posture remains narrow: recognized Postgres adapter + managed database URL. Phase 53 does not add managed database repositories beyond the current adapter foundation, distributed SQLite, multi-writer runtime support, regional failover, PITR, or active-active writes.

This means Phase 53 is a requirements/design gate. It prevents horizontal scaling or resilience requirements from being smuggled in as runtime support before the topology has a named owner, a Phase 54 design package, and Phase 55 review/authorization evidence.

### Phase 54 Owned Multi-Writer Topology Design-Package Gate

Phase 54 lands after the Phase 53 requirements/design gate and documents the required package before any multi-writer/distributed runtime implementation can start. This is not multi-writer or distributed database runtime support.

The design package must include:

- Owner: accountable engineering/operations owner and approval path.
- Consistency model: write-leadership, read-after-write expectations, conflict handling, idempotency, and workspace/tenant isolation assumptions.
- Failover/PITR plan: RPO/RTO targets, provider controls, point-in-time restore process, failover authority, and validation cadence.
- Migration/backfill plan: source and target stores, dry-run/verify commands, cutover sequence, dual-write or freeze expectations, and drift handling.
- Observability requirements: metrics, logs, traces, replication lag, topology health, scheduler/queue signals, alert thresholds, and evidence export expectations.
- Rollback strategy: backup checkpoints, revert triggers, traffic cutback, data reconciliation, and restore/recovery decision points.

This means Phase 54 is a documentation and release-gate milestone. It keeps horizontal writers, regional failover, PITR, and active-active writes blocked until the design package exists and a later implementation phase explicitly ships runtime support.

### Phase 55 Multi-Writer Design Review/Implementation Authorization Gate

Phase 55 lands after the Phase 54 design-package gate and records the review plus implementation-authorization evidence required before any multi-writer/distributed runtime implementation can start. This is not multi-writer or distributed database runtime support.

The authorization evidence must include:

- Review outcome and reviewed design-package version.
- Reviewers and approvers for engineering, operations, data, and release ownership.
- Implementation authorization scope, including explicit exclusions from runtime support claims.
- Approval date, expiry, and re-review triggers.
- Release-readiness or release-evidence attachment location.

This means Phase 55 is evidence and governance only. It keeps horizontal writers, regional failover, PITR, and active-active writes blocked until a later implementation phase explicitly ships and validates runtime support.

### Phase 56 Multi-Writer Implementation Readiness/Rollout-Safety Evidence Gate

Phase 56 lands after the Phase 55 review/implementation-authorization gate and records the implementation-readiness plus rollout-safety evidence required before any multi-writer/distributed runtime support can be claimed. This is not multi-writer or distributed database runtime support.

The readiness and rollout-safety evidence must include:

- Implementation readiness: named implementers, scoped work items, dependency status, test plan, data-migration/backfill dry-run evidence, and operational runbook owner.
- Rollout controls: feature flag or deployment gate, staged rollout sequence, canary criteria, abort criteria, and approval path for widening exposure.
- Rollback and recovery proof: rollback rehearsal, backup/restore checkpoints, data reconciliation plan, and point where restore/recovery replaces code rollback.
- Observability proof: metrics, logs, traces, replication/topology health checks, scheduler/queue signals, alert thresholds, and dashboard/evidence bundle attachment.
- Release claim boundary: explicit statement that runtime support remains blocked until a later implementation phase ships code and validation evidence.

This means Phase 56 is implementation-readiness and rollout-safety evidence only. It keeps horizontal writers, regional failover, PITR, and active-active writes blocked until a later implementation phase explicitly ships and validates runtime support.

### Phase 57 Multi-Writer Implementation Scope Gate

Phase 57 lands after the Phase 56 implementation-readiness/rollout-safety evidence gate and records the implementation-scope controls required before any multi-writer/distributed implementation claim can proceed. This is not multi-writer or distributed database runtime support.

The implementation-scope evidence must include:

- Phase 56 dependency: the readiness and rollout-safety evidence bundle that this scope relies on.
- Implementation scope lock: included work items, excluded work, owner, dependency assumptions, expiry, and re-review triggers for any scope change.
- Runtime feature flag or deployment gate: the disabled-by-default switch or deployment gate that prevents accidental runtime exposure.
- Validation evidence: tests, migration dry-runs, rollback rehearsal, observability proof, and release-evidence attachment references.
- Migration/cutover lock: approved migration/backfill sequence, cutover window, freeze or dual-write expectations, abort path, and data-reconciliation owner.
- Release-owner signoff: named owner, signoff date, release conditions, and handoff evidence attachment location.

This means Phase 57 is implementation-scope evidence only. It keeps horizontal writers, regional failover, PITR, and active-active writes blocked until a later implementation phase explicitly ships and validates runtime support.

### Phase 58 Multi-Writer Runtime Implementation Validation Gate

Phase 58 lands after Phase 57 and validates that any proposed multi-writer runtime implementation evidence is complete enough for release review. This is still not active-active, regional failover, PITR, or multi-writer runtime enablement.

Phase 58 requires Phase 57 complete plus:

- `TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE`: evidence that the scoped runtime implementation exists and is tied to the Phase 57 scope lock.
- `TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE`: validation of consistency behavior, conflict handling, read-after-write expectations, idempotency, and workspace/tenant isolation assumptions.
- `TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE`: validation of failover behavior, RPO/RTO expectations, recovery procedure, and abort criteria.
- `TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE`: validation that migration, cutover, reconciliation, and rollback/recovery paths preserve data integrity.
- `TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK`: operator runbook for rollout, monitoring, incident response, rollback/recovery, and support handoff.
- `TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF`: release-owner signoff for the validated runtime implementation evidence bundle.

This means Phase 58 is runtime-implementation validation evidence only. It validates the evidence package after Phase 57, but it does not enable active-active writes, regional failover, PITR runtime support, multi-writer runtime support, or release approval. Those remain blocked until a later release/runtime enablement phase explicitly allows them.

### Phase 59 Multi-Writer Runtime Release-Enable Approval Gate

Phase 59 lands after Phase 58 and records the final release-enable approval evidence needed before any validated multi-writer runtime implementation can be considered for release. This is still not active-active, regional failover, PITR, or multi-writer runtime enablement by itself.

Phase 59 requires Phase 58 complete plus:

- `TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION`: explicit release-enable decision for the validated implementation package.
- `TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER`: named approver accountable for the enablement decision.
- `TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW`: approved rollout window or freeze exception for enablement.
- `TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF`: monitoring and alerting signoff for the release window.
- `TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN`: documented abort path and rollback/recovery decision owner.
- `TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET`: release ticket or change record that ties the approval package to release automation.

This means Phase 59 is release-enable approval evidence only. It records the approval package after Phase 58, but it does not implement active-active writes, regional failover, PITR runtime support, multi-writer runtime support, or release approval by itself. Those remain blocked until actual runtime support is present, explicitly supported, and approved by release automation.

### Phase 60 Multi-Writer Runtime Support-Presence Assertion Gate

Phase 60 lands after Phase 59 and records the support-presence assertion evidence needed before runtime activation can be considered. This is still not active-active, regional failover, PITR, or multi-writer runtime enablement by itself.

Phase 60 requires Phase 59 complete plus:

- `TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT`: explicit assertion that the implementation package is present.
- `TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT`: named support statement for the intended production posture.
- `TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX`: compatibility matrix for supported and unsupported topology modes.
- `TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE`: cutover evidence for the intended production posture.
- `TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL`: release automation approval evidence.
- `TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE`: owner acceptance evidence.

This means Phase 60 is support-presence assertion evidence only. It records that the implementation and support package are visible for audit, but it does not activate the runtime. Runtime activation must proceed through the bounded Phase 61 through Phase 66 completion track.

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
- [x] Land Phase 42 storage topology readiness reporting through `npm run deployment:check-storage`, `GET /api/app/operations/status`, and Operations UI advisory surfaces. This marks the readiness/reporting slice complete without adding managed Postgres, managed database repositories, distributed SQLite, or a multi-writer SQLite topology.
- [x] Land Phase 43 deployment release-readiness gates through `npm run deployment:check-release` and `npm run deployment:check-release -- --strict` once code slices integrate. The gate checks backup/restore readiness, persistent paths, and storage topology without performing backups, restoring data, provisioning managed DBs, or making SQLite distributed.
- [x] Land Phase 44 deployment release evidence bundle export through `npm run deployment:export-evidence` and `npm run deployment:export-evidence -- --strict` once code slices integrate. The export packages readiness, topology, and environment evidence for handoff with secret redaction, without running backups/tests/builds, restoring data, provisioning managed DBs, or making SQLite distributed.
- [x] Land Phase 45 managed database topology advisory reporting through `npm run deployment:check-managed-db` and `npm run deployment:check-managed-db -- --strict` once code slices integrate. The advisory documents managed database intent/gaps without adding a managed Postgres adapter, distributed SQLite, multi-writer DB runtime, regional failover, PITR, or active/active writes.
- [x] Land Phase 46 managed database runtime guardrails through `npm run deployment:check-runtime-guard` and `npm run deployment:check-runtime-guard -- --strict` once code slices integrate. The guard blocks unsupported store values, managed database URL hints, and managed/multi-writer topology hints before startup/release automation proceeds, without adding managed Postgres, managed database repositories, distributed SQLite, or multi-writer runtime support.
- [x] Land Phase 47 release readiness/evidence integration for Phase 45/46 findings, so release automation carries managed database advisory output, runtime-guard output, and related attachments in the handoff without claiming managed database runtime support.
- [x] Land Phase 48 managed database runtime boundary/foundation in the synchronous store path, so managed/Postgres store modes and managed database URL hints fail closed until an async managed database adapter is implemented. This does not add managed Postgres runtime support, managed database repositories/backfills, distributed SQLite, regional failover, PITR, active/active writes, or multi-writer database support.
- [x] Land Phase 49 async store boundary foundation after the fail-closed managed database boundary. This does not add managed Postgres runtime support, managed database repositories/backfills, distributed SQLite, regional failover, PITR, active/active writes, or multi-writer database support.
- [x] Land Phase 50 managed Postgres adapter/backfill foundation with the `pg` dependency, `TASKLOOM_MANAGED_DATABASE_ADAPTER`, `db:backfill-managed-postgres`, and `db:verify-managed-postgres`.
- [x] Land Phase 52 managed Postgres startup support assertion/validation after Phase 51, accepting managed/Postgres hints only for recognized Postgres adapter + managed database URL configurations.
- [x] Land Phase 53 multi-writer topology requirements/design gate after Phase 52, blocking horizontal writers, regional failover, PITR, and active-active needs until a real topology is designed and owned.
- [x] Land Phase 54 owned multi-writer topology design-package gate, requiring owner, consistency model, failover/PITR plan, migration/backfill plan, observability requirements, and rollback strategy before implementation.
- [x] Land Phase 55 multi-writer design-package review/implementation-authorization evidence gate, requiring reviewed package evidence, approvers, authorization scope, approval timing, and release-evidence attachment before runtime implementation can start.
- [x] Land Phase 56 multi-writer implementation-readiness/rollout-safety evidence gate, requiring implementation readiness, staged rollout controls, rollback/recovery proof, observability proof, and explicit release-claim boundaries before runtime support can be claimed.
- [x] Land Phase 57 multi-writer implementation-scope gate, requiring Phase 56 dependency, implementation scope lock, runtime feature flag/deployment gate, validation evidence, migration/cutover lock, and release-owner signoff before implementation claims can proceed.
- [x] Land Phase 58 multi-writer runtime-implementation validation gate, requiring Phase 57 completion plus runtime implementation evidence, consistency validation evidence, failover validation evidence, data-integrity validation evidence, operations runbook, and runtime release signoff while keeping active-active/regional/PITR runtime support and release approval blocked until a later enablement phase.
- [x] Land Phase 59 multi-writer release-enable approval gate, requiring Phase 58 completion plus release-enable decision, approver, rollout window, monitoring signoff, abort plan, and release ticket evidence while keeping active-active/regional/PITR runtime support and release approval blocked until actual runtime support is present and explicitly supported.
- [x] Land Phase 60 multi-writer support-presence assertion gate, requiring Phase 59 completion plus implementation-present assertion, explicit support statement, compatibility matrix, cutover evidence, release automation approval, and owner acceptance evidence while keeping runtime activation blocked until Phase 61 through Phase 66 complete.
- [x] Start the Phase 39 `providerCalls` relational-repository cutover with migration `0016_provider_calls.sql`, `src/repositories/provider-calls-repo.ts`, preserved `listProviderCallsForWorkspaceIndexed(workspaceId, { since?, limit? })` semantics, provider ledger dual-write, and backfill/verify CLIs. The JSON-side mirror remains active during this cutover.
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
- [x] Add Phase 42 production storage topology readiness reporting so operators can inspect the current storage posture through CLI/API/UI before production handoff. The advisory report keeps SQLite single-node and does not add managed Postgres, distributed SQLite, or managed database repositories.
- [x] Add Phase 43 deployment release-readiness gates on top of Phase 42 storage topology so release automation can check backup/restore readiness, persistent paths, and topology findings before handoff. The gate is inspection-only and does not perform backups, restore data, provision managed DBs, or make SQLite distributed.
- [x] Add Phase 44 deployment release evidence bundle export on top of Phases 42/43 so release handoffs can package redacted readiness, topology, and environment evidence without running backups/tests/builds, restoring data, provisioning managed DBs, or making SQLite distributed.
- [x] Add Phase 45 managed database topology advisory reporting so operators can document managed database intent and gaps through `npm run deployment:check-managed-db` without adding managed Postgres, distributed SQLite, multi-writer runtime support, regional failover, PITR, or active/active writes.
- [x] Add Phase 46 managed database runtime guardrails so startup/release automation can block unsupported `TASKLOOM_STORE`, managed database URL, and managed/multi-writer topology hints through `npm run deployment:check-runtime-guard` without adding managed Postgres, distributed SQLite, or multi-writer runtime support.
- [x] Add Phase 47 release readiness/evidence integration so Phase 45 managed database advisory findings and Phase 46 runtime-guard findings are included in release automation handoff evidence while local JSON/default and supported single-node SQLite remain the only allowed runtime postures.
- [x] Add Phase 48 managed database runtime boundary/foundation so the synchronous store path recognizes managed/Postgres intent and rejects it with the sync-adapter gap instead of treating it as supported runtime configuration.
- [x] Add Phase 49 async store boundary foundation before the managed database adapter/backfill foundation, without claiming managed Postgres startup support.
- [x] Add Phase 50 managed Postgres adapter/backfill foundation documentation while preserving the guarded startup boundary.
- [x] Add Phase 51 deployment/reporting evidence for runtime call-site migration.
- [x] Add Phase 52 managed Postgres startup support assertion/validation while keeping multi-writer/distributed topology out of scope.
- [x] Add Phase 53 multi-writer topology requirements/design gate documentation while keeping multi-writer/distributed database runtime support out of scope.
- [x] Add Phase 54 owned multi-writer topology design-package gate documentation while keeping multi-writer/distributed database runtime support out of scope.
- [x] Add Phase 55 multi-writer design-package review/implementation-authorization evidence gate documentation while keeping multi-writer/distributed database runtime support out of scope.
- [x] Add Phase 56 multi-writer implementation-readiness/rollout-safety evidence gate documentation while keeping multi-writer/distributed database runtime support out of scope.
- [x] Add Phase 57 multi-writer implementation-scope gate documentation while keeping multi-writer/distributed database runtime support out of scope.
- [ ] Continue production hardening implementation beyond process/store-scoped rate limiting, webhook email delivery, CSRF checks, app-level redaction, Phase 20 export/access-log controls, Phase 21 scheduler leader election, Phase 22 managed external email provider operations, Phase 23 access-log shipping/retention, Phase 24 operational status/health endpoints, Phase 42 storage topology readiness reporting, Phase 43 release-readiness gates, Phase 44 release evidence exports, Phase 45 managed database topology advisory reporting, Phase 46 runtime guardrails, Phase 47 handoff integration, Phase 48 runtime boundary/foundation, Phase 49 async store boundary foundation, Phase 50 managed Postgres adapter/backfill foundation, Phase 51 runtime call-site migration evidence, Phase 52 managed Postgres startup support assertion/validation, Phase 53 multi-writer topology requirements/design gate, Phase 54 owned topology design-package gate, Phase 55 review/authorization evidence gate, Phase 56 implementation-readiness/rollout-safety evidence gate, and Phase 57 implementation-scope gate. The remaining storage gaps are multi-writer/distributed topology implementation where horizontal writers, regional failover, PITR, or active/active writes are required. SQLite/database topology guidance lives in `docs/deployment-sqlite-topology.md`, the Phase 42 advisory workflow lives in `docs/deployment-storage-topology.md`, the Phase 43/47 release gate lives in `docs/deployment-release-readiness.md`, the Phase 44/47 evidence bundle lives in `docs/deployment-release-evidence.md`, the Phase 45 managed database advisory lives in `docs/deployment-managed-database-topology.md`, and the Phase 46/48/49/50/51/52/53/54/55/56/57 runtime boundary, guard, call-site migration, startup assertion, and multi-writer topology gate story lives in `docs/deployment-managed-database-runtime-guard.md`.

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
- [x] Complete the relational-repository migration through Phase 38 (`jobMetricSnapshots`, `alertEvents`, `agentRuns`, `jobs`, `invitationEmailDeliveries`, `activities`) with dedicated SQLite tables, JSON/SQLite-switching repositories, operator backfill/verify CLIs, and retired legacy `app_records` mirrors in SQLite mode. See `docs/roadmap-relational-repositories.md`.
- [x] Complete the Phase 39 `providerCalls` relational-repository cutover with a dedicated SQLite table, JSON/SQLite-switching repository, read delegation, provider ledger dedicated-table writes, mirror retirement in SQLite mode, and `db:backfill-provider-calls` / `db:verify-provider-calls` for old-backup recovery.
- [x] Complete the Phase 40 `activationSignals` relational-repository cutover plus the post-Phase-40 mirror-retirement follow-up: SQLite mode now uses `activation_signals` for fresh writes behind the existing repository API, `loadStore()` remains hydrated, JSON mode is unchanged, and `db:backfill-activation-signals` / `db:verify-activation-signals` remain old-backup recovery and drift-audit tools.
- [x] Flip the scheduler hot-path to the repository's transactional `claimNext`/`sweepStaleRunning` primitives in SQLite mode after Phase 38 mirror retirement; JSON mode keeps the in-process mutex/load-store loop.
- [x] Ensure activation-scoped retry and scope-change activity emission is idempotent enough to avoid double-counting repeated signal writes.
- [x] Add stale JSON read-model repair checks and a `jobs:repair-activation` command.
- [x] Add scheduler leader-probe wiring and rolling per-type job-duration metrics surfaced through the operator-status endpoint and Operations tile. See `docs/deployment-health-endpoints.md`.
- [x] Add a scheduler tick heartbeat (`src/jobs/scheduler-heartbeat.ts`) so silent scheduler stalls surface as a `degraded` subsystem in the operator-health endpoint.
- [x] Add persisted job-metrics snapshots and a history endpoint plus CLI so the Phase 25 in-memory metrics can be inspected across process restarts. See `docs/deployment-health-endpoints.md`.
- [x] Add a built-in `metrics.snapshot` cron job handler so the Phase 27 snapshot capture runs without external cron. See `docs/deployment-health-endpoints.md`.
- [x] Add a built-in `alerts.evaluate` cron job handler that evaluates subsystem health and job-failure rates against rules and optionally delivers via webhook. See `docs/deployment-alerting.md`.
- [x] Add an `alerts.deliver` retry job handler so webhook delivery failures retry through the existing scheduler backoff and dead-letter on exhaustion. See `docs/deployment-alerting.md`.

### 5. Product Workflow Expansion

Build the day-to-day workflow surfaces that make activation useful.

- [x] Phase 31 added empty-state CTAs for Requirements, Plan items, and Blockers sections plus a brief-versions count badge near the brief header.
- [ ] Continue further workflow page hardening (additional template surfaces, validation evidence editing flows, prompt-generated draft refinement, and remaining UX polish across blockers/open questions, release confirmation, and Plan Mode).
- [x] Phase 31 made dashboard filters URL-persisted with active-filter chips so refreshes preserve state and admins can share filtered links. Filter options continue to derive from current backend metadata.
- [x] Phase 31 expanded the activity-detail WorkflowPanel to surface top active blockers and open questions inline plus a "View workflow" link.
- [x] Build frontend share-token management and public share-page wiring for the server-side share routes.

### 6. Dev And Release Hygiene

Strengthen the project rails before larger product work accumulates.

- [x] Keep roadmap, README, and activation docs current as milestones land.
- [ ] Continue broadening API route coverage as new route policies and product surfaces land.
- [x] Maintain frontend smoke/static contract tests for auth, onboarding, dashboard, activation, role-aware controls, workflow wiring, integrations, agents, runs, and share routes.
- [x] Add SQLite runtime parity tests for auth, RBAC/member invitations, invitation resend/revoke and delivery-row behavior including skip mode, workflow activation, jobs, agents, share links, CSRF rejection, cross-origin mutation rejection, dedicated SQLite rate-limit bucket persistence, and local mutating-write concurrency behavior.
- [x] Add README cross-links for the roadmap, deployment auth hardening doc, SQLite topology doc, invitation email operations doc, activation docs, and Phase 16 production deployment guidance.
- [x] Add Phase 43 release-readiness documentation for gates layered over Phase 42 storage topology.
- [x] Add Phase 44 release evidence documentation for bundle exports layered over Phases 42/43.
- [x] Add Phase 45 managed database topology advisory documentation for reporting/planning without claiming managed database runtime support.
- [x] Add Phase 46 managed database runtime guard documentation for blocking unsupported managed database and multi-writer runtime hints without claiming managed database runtime support.
- [x] Add Phase 47 documentation that integrates Phase 45/46 managed database findings into release readiness and evidence handoffs without claiming managed database runtime support.
- [x] Add Phase 48 documentation that marks the managed database runtime boundary/foundation without claiming full managed Postgres runtime support.
- [x] Add Phase 49 documentation that marks the async store boundary foundation without claiming managed Postgres runtime support.
- [x] Add Phase 50 documentation that marks the managed Postgres adapter/backfill foundation as landed while calling out the guarded main app startup path.
- [x] Add Phase 51 documentation/reporting that separates runtime call-site migration evidence from full managed Postgres startup support.
- [x] Add Phase 52 documentation/reporting that asserts and validates managed Postgres startup support after Phase 51 for recognized Postgres adapter + managed database URL configurations.
- [x] Add Phase 53 documentation that captures multi-writer topology requirements as a design gate, not implementation of distributed database runtime support.
- [x] Add Phase 54 documentation that captures the owned multi-writer topology design package before implementation.
- [x] Add Phase 55 documentation that captures design-package review and implementation-authorization evidence before runtime implementation.
- [x] Add Phase 56 documentation that captures implementation readiness and rollout-safety evidence before runtime support can be claimed.
- [x] Add Phase 57 documentation that captures implementation scope lock, runtime feature flag/deployment gate, validation evidence, migration/cutover lock, and release-owner signoff before implementation claims can proceed.
- [x] Add Phase 58 documentation that captures multi-writer runtime-implementation validation evidence while keeping active-active/regional/PITR runtime support and release approval blocked until a later enablement phase.
- [x] Add Phase 59 documentation that captures release-enable approval evidence while keeping active-active/regional/PITR runtime support and release approval blocked until actual runtime support is present and explicitly supported.
- [x] Add Phase 60 documentation that captures support-presence assertion evidence while keeping active-active/regional/PITR runtime behavior blocked until the explicit activation track is complete.
- [ ] Complete Phase 61 runtime activation controls and release switch wiring.
- [ ] Complete Phase 62 managed Postgres horizontal-writer concurrency hardening.
- [ ] Complete Phase 63 distributed dependency enforcement for activation.
- [ ] Complete Phase 64 failover, PITR, and recovery validation.
- [ ] Complete Phase 65 cutover, rollback, and observability automation.
- [ ] Complete Phase 66 final release closure and documentation freeze.
- [ ] Maintain local development, reset, seed, build, production deployment, and release flow documentation as scripts and deployment posture change.
- [x] Keep generated `web/dist` assets ignored unless release packaging requirements change.

## Completion Phase Plan

Phases 61 through 66 are the bounded completion track for turning the Phase 53 through Phase 60 evidence gates into an explicitly supported production posture. These phases should not add more open-ended gates; each phase must either enable a concrete supported behavior or close a named remaining risk.

### Phase 61: Runtime Activation Controls

- Add explicit activation inputs for the approved production posture, including runtime activation decision, activation owner, activation window, activation flag, and release automation assertion.
- Teach topology, runtime guard, release readiness, release evidence, operations status, operations health, and CLI JSON output to distinguish inactive evidence-only support from activated support.
- Preserve fail-closed behavior: activation is denied unless Phases 53 through 60 are complete and the new activation inputs are present.
- Exit when strict release checks can report "activation ready" for the supported managed Postgres posture without enabling unsupported SQLite-distributed or unapproved active-active modes.

### Phase 62: Horizontal Writer Concurrency Hardening

- Audit managed Postgres writes for stale-document overwrite risks, transaction boundaries, idempotency, and optimistic concurrency behavior.
- Add repository/runtime tests that simulate concurrent app writers against the managed Postgres document store.
- Add any required compare-and-swap, row version, advisory lock, or transaction retry behavior needed for the supported horizontal-writer posture.
- Exit when managed Postgres can safely support multiple Taskloom app processes writing to the same managed Postgres database under the approved topology.

### Phase 63: Distributed Dependency Enforcement

- Require production-safe shared dependencies before activation: distributed rate limiting, scheduler coordination, durable job execution posture, access-log shipping, alert delivery, and health monitoring.
- Make release readiness and runtime guard checks fail strict activation when these dependencies are missing or configured in local-only modes.
- Surface dependency state in operations status and health so operators can see why activation is allowed or blocked.
- Exit when a horizontally scaled deployment cannot accidentally activate while still using local-only coordination paths.

### Phase 64: Failover, PITR, And Recovery Validation

- Add deployment evidence and tests for backup restore, PITR rehearsal, failover rehearsal, data-integrity validation, and recovery-time expectations.
- Extend release evidence exports with the validation artifacts needed for managed Postgres recovery claims.
- Keep active-active/regional behavior blocked unless the implementation truly supports it; otherwise document the supported posture as horizontal app writers against a managed Postgres topology with provider-owned HA/PITR.
- Exit when recovery claims are explicit, tested, and reflected in release readiness.

### Phase 65: Cutover, Rollback, And Observability Automation

- Add cutover preflight, activation dry-run, post-activation smoke checks, rollback command guidance, and monitoring thresholds.
- Wire activation/cutover status into operations health and release evidence.
- Add docs and tests proving failed preflight or failed smoke checks keeps activation blocked or rolls back to the prior safe posture.
- Exit when operators have a repeatable activate, verify, and rollback flow.

### Phase 66: Final Release Closure

- Remove contradictory "later phase" wording from roadmap and deployment docs for the supported production posture.
- Mark the supported production topology, unsupported topology boundaries, and final release checklist in one place.
- Run full typecheck, tests, build, deployment CLI checks, and docs consistency checks.
- Exit when the docs say the project is complete for the supported production posture and any remaining items are explicitly future product enhancements, not hidden completion phases.

## Recommended Order

1. Phase 61: add runtime activation controls on top of completed Phase 60 evidence.
2. Phase 62: harden managed Postgres horizontal-writer concurrency.
3. Phase 63: enforce distributed operational dependencies before activation.
4. Phase 64: validate failover, PITR, backup restore, and recovery behavior.
5. Phase 65: automate cutover, rollback, smoke checks, and observability.
6. Phase 66: close the release and freeze the docs so there is no implied follow-up phase for the supported production posture.

## Near-Term Definition Of Done

The production hardening track through Phase 60 is complete for the supported local JSON, single-node SQLite, and guarded single-writer managed Postgres postures when the existing route-level RBAC/workflow/job/agent/share parity suite continues to pass on supported storage modes. Phases 20 through 60 cover deployment observability, alerting, workflow polish, relational repositories, storage readiness, release readiness, release evidence, managed-database advisory reporting, runtime guardrails, handoff integration, runtime boundary/foundation, async-boundary foundation, managed Postgres adapter/backfill foundation, runtime call-site migration evidence, managed Postgres startup support assertion/validation, multi-writer design gates, runtime validation gates, release-enable approval evidence, and support-presence assertion evidence.

The final completion track is complete when Phases 61 through 66 have landed. At that point the supported production posture must have explicit activation controls, safe managed Postgres horizontal-writer behavior, enforced distributed dependencies, validated backup/restore/PITR/failover recovery behavior, repeatable cutover and rollback automation, operations visibility, full validation, and documentation that clearly says the project is complete for that supported posture.

Local JSON/default and supported single-node SQLite remain allowed. SQLite remains a local single-node posture, not a distributed production topology. Any topology beyond the supported managed Postgres horizontal-writer posture, such as true active-active multi-region writes, remains a future product enhancement unless a later roadmap explicitly chooses and implements it.
