# Taskloom Roadmap

Taskloom currently has a local activation domain, JSON-backed default storage, an opt-in SQLite app runtime with query-indexed route helpers for high-value records, local SQLite write/concurrency hardening, auth/onboarding/activity/workflow flows, route-level RBAC, invitation/member APIs, local invitation email delivery records with a delivery-adapter seam, proxy-aware same-origin plus CSRF-token mutation checks, deployment-configurable store-backed auth/invitation rate limits, command-driven maintenance jobs, queue-driven agent runs, public webhook/share links, production deployment guidance in `README.md`, `docs/deployment-auth-hardening.md`, `docs/deployment-sqlite-topology.md`, and `docs/invitation-email-operations.md`, and a React/Vite interface. The remaining roadmap is mainly about production/deployment implementation hardening and continued workflow polish without losing the clean activation boundaries already in place.

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
- Auth register/login and invitation create/accept/resend routes have store-backed rate limits in the active local store, with deployment knobs for `TASKLOOM_AUTH_RATE_LIMIT_MAX_ATTEMPTS`, `TASKLOOM_AUTH_RATE_LIMIT_WINDOW_MS`, `TASKLOOM_INVITATION_RATE_LIMIT_MAX_ATTEMPTS`, and `TASKLOOM_INVITATION_RATE_LIMIT_WINDOW_MS`. JSON keeps buckets in the default app store; SQLite uses dedicated `rate_limit_buckets` storage. These limits remain process/store scoped and still need production edge/distributed coordination for multi-process or multi-region deployments.
- `docs/deployment-auth-hardening.md` documents how to pair the process/store-scoped buckets with edge or shared distributed limits in production, including supported app envs, multi-process/multi-region caveats, and a validation checklist.
- Invitation webhook email delivery supports `TASKLOOM_INVITATION_EMAIL_WEBHOOK_TIMEOUT_MS` for provider request timeout control; see `docs/invitation-email-operations.md` for production email operations guidance.
- Jobs scripts can recompute activation read models, repair stale activation read models, and clean up expired sessions against the local store.
- Local persistence commands can seed/reset the JSON store, migrate/status/backup/restore SQLite, seed/reset SQLite activation tables, seed/reset full SQLite app data, and backfill SQLite from a JSON store.
- `docs/deployment-sqlite-topology.md` defines the supported local SQLite posture, WAL/`busy_timeout`/`BEGIN IMMEDIATE` guarantees, backup/restore policy, network filesystem caveats, multi-process/multi-region limits, and thresholds for dedicated relational repositories/backfills beyond indexed `app_records`.
- The app runtime starts a persisted job scheduler for queued `agent.run` jobs, including cron re-enqueue after successful runs.
- Public agent webhooks enqueue `agent.run` jobs through tokenized `/api/public/webhooks/agents/:token` requests.
- React pages cover sign-in/sign-up, onboarding, dashboard, settings, activation, workflow, activity/detail, agents, runs, operations, integrations, and public share views.
- The frontend API layer has typed workflow calls for brief, requirements, plan items, blockers, questions, validation evidence, release confirmation, templates, prompt-generated drafts, Plan Mode, share tokens, and public share reads.
- Build, typecheck, and test scripts are available through `npm run build`.
- Local development uses ignored `data/taskloom.json` and `data/taskloom.sqlite` files that are recreated or migrated from built-in seed data and CLI commands.
- README, deployment auth hardening, SQLite topology, invitation email operations, and activation docs cover local development, seed/reset, build, release hygiene flows, and production deployment guidance for the current single-node/local-store posture.
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

Phase 13 is landed for the local runtime, with webhook invitation delivery and hashed rate-limit buckets in place. Distributed rate limiting and deeper deployment-specific hardening remain future work:

- Invitation create, accept, resend, and revoke APIs are present. Create/resend record `invitationEmailDeliveries` rows and return an `emailDelivery` summary. `TASKLOOM_INVITATION_EMAIL_MODE=dev` records local sent deliveries, `skip` records skipped deliveries, and `webhook` posts delivery requests to `TASKLOOM_INVITATION_EMAIL_WEBHOOK_URL` with optional provider name and shared-secret header configuration. Delivery adapter and webhook failures are recorded without rolling back invitation state. Production retries, dead letters, and token-redaction expectations are documented in `docs/invitation-email-operations.md`.
- Invitation acceptance requires a signed-in user whose normalized email matches the invitation. Revoked, expired, accepted, and stale rotated tokens are rejected.
- Store-backed rate limiting covers auth register/login and invitation create/accept/resend with 20 attempts per client key per 60 seconds. Buckets use `local` by default, trust forwarded IP headers only when `TASKLOOM_TRUST_PROXY=true`, and store salted SHA-256 bucket IDs. Buckets stay in JSON for the default runtime; after Phase 14, SQLite mode keeps them in dedicated `rate_limit_buckets` storage. The threshold and window are currently code constants rather than deployment environment knobs.
- CSRF behavior is a same-origin `Origin` host check plus double-submit token for browser mutations. Login/register set `taskloom_csrf`; same-origin browser mutations must send `X-CSRF-Token`; requests without `Origin` are allowed for local clients/tests.
- Runtime parity coverage now checks JSON-default and SQLite-opt-in behavior for session reads, invitation create/list/resend/revoke/revoked-token rejection, local delivery rows including skip mode, share-token reads, CSRF rejection, cross-origin mutation rejection, and rate-limit bucket persistence.

### Phase 14 SQLite Local Storage And Concurrency Hardening

Phase 14 is landed for the opt-in local SQLite runtime. It makes SQLite safer for local concurrent writers without claiming distributed or production-grade multi-process coordination:

- SQLite connections open with `busy_timeout`, WAL mode, `synchronous=normal`, and `foreign_keys=on`.
- SQLite `mutateStore()` writes use `BEGIN IMMEDIATE` and reload fresh store state inside the write transaction before writing changed collections, avoiding stale-cache whole-store overwrites when another local writer has committed newer state.
- Auth and invitation rate-limit buckets use dedicated SQLite `rate_limit_buckets` storage in SQLite mode instead of `app_records`; JSON mode remains unchanged and keeps buckets in the default JSON app store.
- The hardening targets local SQLite runtime correctness and parity. Edge/distributed rate limiting, deployment-specific abuse controls, and broader production storage topology choices remain future work.

### Phase 15 Production/Deployment Auth Hardening

Phase 15 hardens deployment-facing auth configuration beyond the earlier local defaults without claiming distributed abuse protection:

- Auth route rate limits are configurable through `TASKLOOM_AUTH_RATE_LIMIT_MAX_ATTEMPTS` and `TASKLOOM_AUTH_RATE_LIMIT_WINDOW_MS`.
- Invitation route rate limits are configurable through `TASKLOOM_INVITATION_RATE_LIMIT_MAX_ATTEMPTS` and `TASKLOOM_INVITATION_RATE_LIMIT_WINDOW_MS`.
- Invitation webhook delivery timeout is configurable through `TASKLOOM_INVITATION_EMAIL_WEBHOOK_TIMEOUT_MS`, with failures recorded without rolling back invitation state.
- CSRF origin validation is proxy-aware: `X-Forwarded-Host` is trusted only when `TASKLOOM_TRUST_PROXY=true`; otherwise origin checks compare against `Host`.
- Rate-limit buckets remain local-store backed. Edge/distributed rate limiting and full production topology guidance remain future work; email delivery operations are tracked separately in `docs/invitation-email-operations.md`.

### Phase 16 Production Deployment Guidance

Phase 16 lands documentation for production deployment handoff in `README.md#production-deployment-guidance`, focused auth/proxy/rate-limit checks in `docs/deployment-auth-hardening.md`, SQLite/database topology guidance in `docs/deployment-sqlite-topology.md`, and invitation email operations guidance in `docs/invitation-email-operations.md`. It defines the recommended posture for the current runtime without claiming new runtime capabilities:

- HTTPS termination and `NODE_ENV=production` cookie expectations.
- Proxy trust boundaries for `TASKLOOM_TRUST_PROXY` and forwarded host/IP headers.
- Secret handling for rate-limit salts, invitation webhook secrets, provider credentials, and environment files.
- Single-node SQLite persistence guidance with durable `TASKLOOM_DB_PATH`, persistent artifacts, backups, restore validation, network-filesystem caveats, and session cleanup scheduling.
- Scheduler constraints for the current local store: run one scheduler-active Node process unless external job coordination is added.
- Abuse-protection limits: built-in auth/invitation buckets remain process/store scoped, so multi-process or multi-region deployments need edge/shared distributed rate limiting; `docs/deployment-auth-hardening.md` captures supported env knobs, topology caveats, and validation checks.
- Invitation webhook operational requirements are tracked separately in `docs/invitation-email-operations.md`.
- Public share/webhook token, API-key, environment-variable, and audit/redaction review expectations for production handoff.

This phase is documentation-only. Distributed locking, managed database repositories, email delivery workers, edge rate limiting, and broader token-redaction enforcement remain future work.

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
- [x] Add session cleanup for expired sessions.
- [x] Document production session cookie behavior and cleanup expectations.
- [x] Add store-backed rate limiting for auth and invitation routes in JSON default and SQLite opt-in modes.
- [x] Keep SQLite rate-limit buckets in dedicated `rate_limit_buckets` storage while leaving the JSON default store shape unchanged.
- [x] Add local same-origin and CSRF-token checks for private app browser mutations.
- [x] Add deployment-specific auth/invitation rate-limit knobs, invitation webhook timeout control, and proxy-aware CSRF origin handling where `X-Forwarded-Host` is trusted only with `TASKLOOM_TRUST_PROXY=true`.
- [x] Document production deployment guidance for HTTPS/proxy trust, secrets, local-store rate-limit limits, edge/distributed limiter pairing expectations, persistence, backups, and scheduler constraints. Invitation email operations are cross-linked separately.
- [ ] Add production hardening implementation beyond process/store-scoped rate limiting, webhook email delivery, and CSRF checks, such as edge/distributed rate limiting, token-redaction enforcement, and managed production topology support. SQLite/database topology guidance now lives in `docs/deployment-sqlite-topology.md`.

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
- [x] Expose private job queue routes for list, enqueue, read, and cancel.
- [x] Add a JSON-to-SQLite backfill command for existing local workspaces.
- [ ] Add relational database backfills if app records are later split from indexed `app_records` metadata into dedicated repository tables, using `docs/deployment-sqlite-topology.md` thresholds to decide when that split is justified.
- [x] Ensure activation-scoped retry and scope-change activity emission is idempotent enough to avoid double-counting repeated signal writes.
- [x] Add stale JSON read-model repair checks and a `jobs:repair-activation` command.

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

1. Implement or integrate edge/distributed rate limiting beyond the documented process/store-scoped auth and invitation bucket guidance.
2. Production invitation email provider implementation hardening tracked in `docs/invitation-email-operations.md`.
3. Production storage implementation hardening: managed database topology, external scheduler/job coordination for multi-process runtimes, and dedicated relational repositories/backfills where indexed `app_records` metadata is not enough.
4. Continued workflow/UI, test, and release hardening.

## Near-Term Definition Of Done

The next phase is complete when edge/distributed rate limiting is implemented or integrated for multi-process deployments, invitation delivery production hardening from `docs/invitation-email-operations.md` is implemented, managed database or external scheduler topology is implemented where needed, dedicated relational repositories/backfills are added where indexed `app_records` metadata is not enough, and the existing route-level RBAC/workflow/job/agent/share parity suite continues to pass on both storage modes.
