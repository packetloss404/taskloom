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

The local app uses `data/taskloom.json` for file-backed persistence by default. If the file is missing, the server recreates it from the built-in seed data on first store load. To run the same store API against SQLite, start the app with `TASKLOOM_STORE=sqlite`; it targets `data/taskloom.sqlite` unless `TASKLOOM_DB_PATH=path/to/taskloom.sqlite` is set. SQLite mode persists the full app runtime through migrated `app_records` rows and query-indexed metadata while keeping JSON as the default contributor workflow.

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
- Keep `README.md`, `docs/roadmap.md`, and `docs/activation/*` aligned with any landed product milestone.
- Do not commit `data/taskloom.json`, `data/artifacts/`, `web/dist/`, logs, or environment files.

## API Endpoints

Available endpoints include:

- `GET /api/health`
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

Member-management APIs allow workspace members to be listed by any authenticated workspace member. Invitation tokens are only exposed to `admin` and `owner` list responses. Invitations, role updates, and member removals require `admin` or `owner`; only `owner` can grant or modify the `owner` role, and the backend prevents removing or demoting the final workspace owner. Invitation acceptance requires a signed-in user whose email matches the invitation.

Invitation delivery records `invitationEmailDeliveries` rows for create and resend, and responses include an `emailDelivery` summary. The default `TASKLOOM_INVITATION_EMAIL_MODE=dev` records local provider deliveries as `sent`; set `TASKLOOM_INVITATION_EMAIL_MODE=skip` to record them as skipped for local runs that should not simulate sending. Set `TASKLOOM_INVITATION_EMAIL_MODE=webhook` with `TASKLOOM_INVITATION_EMAIL_WEBHOOK_URL` to POST delivery requests to an HTTP provider; `TASKLOOM_INVITATION_EMAIL_PROVIDER` overrides the recorded provider name, and optional `TASKLOOM_INVITATION_EMAIL_WEBHOOK_SECRET` plus `TASKLOOM_INVITATION_EMAIL_WEBHOOK_SECRET_HEADER` add a shared-secret header. Webhook configuration errors and non-2xx responses are recorded as failed deliveries without rolling back invitation creation. Local testing can still copy the returned invitation token into `POST /api/app/invitations/:token/accept` while signed in as the matching invited email. Production handoff still needs sender/domain setup, secret handling, retries or dead-letter policy, and token-redaction policy for logs and admin surfaces.

Session cookies are HTTP-only, use `SameSite=Lax`, and are marked `Secure` when `NODE_ENV=production`. Login and registration also set a readable `taskloom_csrf` cookie. Private mutating app routes reject browser requests with an `Origin` host that does not match `Host` or `X-Forwarded-Host`; same-origin browser mutations must echo the CSRF cookie in `X-CSRF-Token`. Requests without `Origin`, such as same-process tests and non-browser local clients, are allowed.

Auth register/login and invitation create/accept/resend routes have store-backed rate limits of 20 attempts per client key per 60 seconds. The default client key is `local`; set `TASKLOOM_TRUST_PROXY=true` to trust `X-Forwarded-For`, then `X-Real-IP`. Stored bucket IDs include a SHA-256 hash salted by `TASKLOOM_RATE_LIMIT_KEY_SALT`, and expired or excess buckets are pruned with `TASKLOOM_RATE_LIMIT_MAX_BUCKETS` defaulting to 5000. Limited responses are `429` with `Retry-After`. In JSON mode the buckets live in `data/taskloom.json`; in SQLite mode they live in `app_records`. The window and attempt count are currently code constants, not environment knobs. Multi-process or multi-region production deployments should still add shared edge or database coordination before relying on them for abuse prevention.

Production deployments should terminate HTTPS before the Node server and run the scheduled `cleanup-sessions` job to remove expired sessions.

Workflow writes update the local workflow records, emit workflow activity, and refresh activation facts used by dashboard and activation views.

Product Workflow Expansion currently includes:

- Workspace brief editing with templates and version restore.
- Requirement and implementation plan capture, including Plan Mode suggestions.
- Blocker and open question tracking.
- Validation evidence capture and release confirmation.
- Prompt-generated workflow drafts that can be previewed or applied.

Share-token routes and frontend wiring exist for `brief`, `plan`, and `overview` scopes. Admins/owners can create and revoke tokens from Settings, viewers can read existing token metadata, and `/share/:token` renders public shared content.

## Jobs

Maintenance commands run against the active local store. By default that is `data/taskloom.json`; with `TASKLOOM_STORE=sqlite`, commands use `data/taskloom.sqlite` or `TASKLOOM_DB_PATH`.

```bash
npm run jobs:recompute-activation
npm run jobs:repair-activation
npm run jobs:cleanup-sessions
```

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

Webhook tokens are generated or rotated with `POST /api/app/webhooks/agents/:agentId/rotate` and removed with `DELETE /api/app/webhooks/agents/:agentId`. A webhook request accepts a JSON body and enqueues an `agent.run` job with `triggerKind: "webhook"`; the response includes `{ accepted: true, jobId }`.

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

- `docs/activation/activation-domain.md`
- `docs/activation/activation-signals.md`
- `docs/activation/activation-roadmap.md`
