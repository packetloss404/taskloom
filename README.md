# Taskloom

Taskloom is an open source workspace portal for activation tracking, onboarding progress, and operational follow-through. The current repository includes:

- activation domain
- pure milestone engine
- checklist derivation
- stage + risk logic
- repository/service contracts
- future SQL schema
- signal adapter scaffold
- in-memory repositories
- read-only activation API wrapper
- UI-neutral activation summary view model
- workspace auth, onboarding, activity, and workflow flows
- workspace membership records and RBAC helper utilities
- command-driven maintenance jobs
- queue-driven agent runs, recurring job scheduling, and public webhook triggers
- Product Workflow Expansion surfaces for briefs, requirements, plans, blockers, questions, validation evidence, release confirmation, templates, prompt-generated drafts, and Plan Mode

## Run locally

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

For a built local run:

```bash
npm run build:web
npm start
```

Then open:

```text
http://localhost:8484
```

For local contributor access, the seed data includes these workspace accounts:

- `alpha@taskloom.local`
- `beta@taskloom.local`
- `gamma@taskloom.local`

Each uses the password `demo12345`. You can also create a new account from the sign-up page.

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
- `GET /api/app/activity`
- `GET /api/app/activity/:id`
- `GET /api/app/agents`
- `POST /api/app/agents`
- `GET /api/app/agents/:agentId`
- `PATCH /api/app/agents/:agentId`
- `DELETE /api/app/agents/:agentId`
- `POST /api/app/agents/:agentId/runs`
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

Workflow endpoints are private app endpoints and require an authenticated session. They operate on the signed-in user's current workspace. Workflow writes update the local workflow records, emit workflow activity, and refresh activation facts used by dashboard and activation views.

Product Workflow Expansion currently includes:

- Workspace brief editing with templates and version restore.
- Requirement and implementation plan capture, including Plan Mode suggestions.
- Blocker and open question tracking.
- Validation evidence capture and release confirmation.
- Prompt-generated workflow drafts that can be previewed or applied.

## Jobs

Maintenance commands run against the local `data/taskloom.json` store:

```bash
npm run jobs:recompute-activation
npm run jobs:cleanup-sessions
```

To recompute a subset of workspaces:

```bash
node --import tsx src/jobs.ts recompute-activation --workspace-ids=alpha,beta
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

Key docs:

- `docs/activation/activation-domain.md`
- `docs/activation/activation-signals.md`
- `docs/activation/activation-roadmap.md`
