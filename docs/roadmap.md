# Taskloom Roadmap

Taskloom currently has a local activation domain, file-backed app services, auth/onboarding/activity/workflow flows, route-level RBAC, invitation/member APIs, command-driven maintenance jobs, queue-driven agent runs, public webhook/share links, and a React/Vite interface. The remaining roadmap is mainly about moving the local JSON-backed product into full database-backed storage without losing the clean activation boundaries already in place.

## Current Baseline

- Activation engine, checklist derivation, stage logic, risk calculation, and summary view model are implemented.
- Local file-backed storage lives in `data/taskloom.json`.
- App services connect auth, workspaces, onboarding, activation, activity, and workflow records.
- Workspace records now include membership rows, workflow briefs, requirements, implementation plan items, blockers/open questions, validation evidence, and release confirmations.
- Public activation endpoints and private app endpoints are available for activation, onboarding, workspace settings, activity, workflows, agents, runs, jobs, providers, API keys, webhooks, usage, LLM calls, and share tokens.
- The workflow route module implements private `/api/app/workflow` endpoints for briefs, templates, versions, requirements, plan items, blockers, questions, validation evidence, release confirmation, prompt-generated drafts, and Plan Mode.
- RBAC defines owner, admin, member, and viewer roles with view workspace data, edit workflow, and manage workspace/operations permissions.
- Private app, workflow, job, agent, provider, env-var, webhook, API-key, usage, LLM, and share routes enforce workspace membership and role-aware permissions.
- Jobs scripts can recompute activation read models, repair stale activation read models, and clean up expired sessions against the local store.
- Local persistence commands can seed/reset the JSON store and migrate/seed/reset the SQLite activation database foundation.
- The app runtime starts a persisted job scheduler for queued `agent.run` jobs, including cron re-enqueue after successful runs.
- Public agent webhooks enqueue `agent.run` jobs through tokenized `/api/public/webhooks/agents/:token` requests.
- React pages cover sign-in/sign-up, onboarding, dashboard, settings, activation, workflow, activity/detail, agents, runs, operations, integrations, and public share views.
- The frontend API layer has typed workflow calls for brief, requirements, plan items, blockers, questions, validation evidence, release confirmation, templates, prompt-generated drafts, Plan Mode, share tokens, and public share reads.
- Build, typecheck, and test scripts are available through `npm run build`.
- Local development uses an ignored `data/taskloom.json` file that is recreated from built-in seed data when missing, plus an ignored `data/taskloom.sqlite` file for activation migration work.
- README and activation docs cover local development, seed/reset, build, and release hygiene flows.

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

## Roadmap

Status markers: `[x]` is landed in this branch; `[ ]` remains future or ongoing work.

### 1. Persistence Foundation

Replace the JSON store with a real database-backed persistence layer while keeping activation logic storage-agnostic.

- [x] Add migration tooling around the existing activation schema.
- [ ] Extend the existing JSON-backed model into migrations for users, sessions, memberships, invitations, workspaces, workflow records, onboarding state, activities, activation facts, milestones, activation read models, agents, jobs, provider calls, and share tokens.
- [ ] Introduce database-backed repository implementations behind the existing services; the app runtime still uses `data/taskloom.json`.
- [x] Add formal seed and reset commands for local development.
- [x] Preserve deterministic activation recalculation for the local JSON runtime and SQLite activation seed path.

### 2. Auth And RBAC

Expand local auth from a single-owner workspace flow into a workspace membership model.

- [x] Apply owner/admin/member/viewer RBAC to private route policies.
- [x] Enforce workspace membership before workspace reads, workflow edits, or operational mutations.
- [x] Add backend invitation and member management APIs.
- [ ] Add member-management UI, invitation revoke/resend, and email delivery.
- [x] Add session cleanup for expired sessions.
- [x] Document production session cookie behavior and cleanup expectations.
- [ ] Add production hardening beyond local auth, such as rate limiting and CSRF review.

### 3. Real Activation Signals

Move activation snapshots from onboarding-derived facts toward product-observed signals.

- [ ] Implement a real normalized `ActivationSignalRepository`.
- [x] Wire runtime activation snapshots to durable workflow, validation, and release records through `buildSignalSnapshotFromProductRecords(...)`, with legacy facts used as fallback.
- [ ] Distinguish user-entered facts from system-observed facts.
- [x] Track durable workflow blockers, dependency blockers, open questions, and validation failures in runtime snapshots.
- [ ] Move retry and scope-change signals from legacy facts into durable product records.
- [x] Keep signal mapping outside the pure activation engine.

### 4. Jobs And Backfills

Make activation updates reliable outside request-time reads.

- [x] Run the local JSON-backed queue scheduler for `agent.run` jobs with cron re-enqueue, retries/backoff, cancellation, and stale-running-job sweep.
- [x] Expose private job queue routes for list, enqueue, read, and cancel.
- [ ] Add a database backfill command for existing workspaces after persistence moves out of JSON.
- [ ] Ensure activity emission is idempotent.
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
- [ ] Maintain local development, reset, seed, build, and release flow documentation as scripts change.
- [x] Keep generated `web/dist` assets ignored unless release packaging requirements change.

## Recommended Order

1. Full app persistence: database migrations and repositories for the non-activation app model.
2. Database backfills after repositories replace JSON runtime storage.
3. Remaining activation signals: durable retry and scope-change records plus a normalized `ActivationSignalRepository`.
4. Member-management UI, invitation revoke/resend, email delivery, rate limiting, and CSRF review.
5. Continued workflow/UI, test, and release hardening.

## Near-Term Definition Of Done

The next phase is complete when Taskloom can run the full app from database-backed repositories, migrate/seed/reset all app data formally, run database backfills after JSON migration, preserve the existing route-level RBAC/workflow/job/agent/share behavior on the new persistence layer, and keep activation derivation driven by durable product records rather than maintained facts wherever records exist.
