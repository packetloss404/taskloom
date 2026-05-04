# App Publish Readiness

Phase 70 Lane 1 defines the prompt-builder contract for one-click self-hosted publish. The helper is intentionally pure: it does not write files, inspect env, start containers, wire routes, or render frontend. It gives the builder flow stable metadata to show what will happen before a user promotes a generated app or agent from preview to published.

Phase 71 Lane 5 adds connector readiness to the publish contract. Missing integration secrets are reported against the affected generated feature, so the hosting package can still be prepared while that specific email, payment, webhook, browser, GitHub, model, custom API, or database feature stays blocked until setup is complete.

Use `buildAppPublishReadiness()` from `src/app-publish-readiness.ts` with the generated draft name, workspace slug, publish id, previous publish id, URL/env overrides, runtime env setup state, bundle kind, and optional generated deployment assumptions.

The same input returns the same:

- publish id, draft slug, workspace slug, and local publish path
- generated publish checklist
- feature-scoped connector readiness
- deployment/runtime assumptions
- app/agent package contract
- Hono/Vite packaging notes
- environment checklist
- Docker Compose export and handoff outline
- health and smoke checks with actionable failure guidance
- publish history and rollback semantics
- public/private URL handoff

## Publish Checklist

The generated checklist is the builder-facing contract for a one-click publish. Required items are:

- environment checklist reviewed
- integration readiness reviewed
- production build completed
- health check passed
- smoke checks passed
- Docker Compose export exists
- publish history recorded
- rollback target available

Each item includes an expectation and failure guidance. Failed required items keep the publish private and preserve the previous known-good publish.

Integration readiness is required as a review step, but connector secret gaps are feature scoped. The checklist names the connector, missing secret names, affected generated feature, and setup guidance without printing secret values. For example, a missing `STRIPE_WEBHOOK_SECRET` blocks Stripe payment flows, while unrelated static pages or already configured GitHub actions can still publish and smoke test.

## Connector Readiness

`inspectAppPublishIntegrations()` emits marketplace-style connector readiness for:

- OpenAI
- Anthropic
- Ollama/local model
- custom API
- Slack/webhook
- email
- GitHub webhook
- browser scraping
- Stripe/payments
- database

Each connector reports whether it is required, ready, connected/configured, which secret names are required or missing, setup guidance, and any connector test warning. `canPublish` remains true for feature-scoped connector gaps; `canUseAllRequestedIntegrations` is false until every requested connector-backed feature is ready.

## Deployment Assumptions

The base assumptions are:

- the existing Hono API/static server hosts generated publishes
- Vite output is served from the existing web build path
- private/local self-hosted URLs are validated before public URL handoff
- publish metadata names env requirements but never stores secret values
- each publish bundle is immutable, and rollback repoints hosting instead of mutating a failed bundle

Generated drafts can add assumptions for reverse proxies, scheduler needs, database posture, webhooks, email, payments, or agent triggers. These assumptions should be visible before publish and stored with the publish history entry.

## Local And Self-Hosted URLs

Default URL handoff:

- private URL: `http://localhost:8484/app/<workspace>/<draft>`
- public URL: `https://apps.taskloom.example/<workspace>/<draft>`

The private URL is the first validation target for health and smoke checks. The public URL should be shared only when required checks pass and the workspace approves public visibility.

## Env Checklist

Base required env entries:

- `NODE_ENV`
- `PORT`
- `TASKLOOM_STORE`

Base optional hosting entries:

- `TASKLOOM_ACCESS_LOG_MODE`
- `TASKLOOM_SCHEDULER_LEADER_MODE`
- `TASKLOOM_PUBLIC_APP_BASE_URL`
- `TASKLOOM_PRIVATE_APP_BASE_URL`

Draft-specific required or optional env keys can be passed to the helper. Entries are trimmed, deduplicated, and sorted so package metadata does not churn between runs. The checklist names required keys and affected features, but never includes raw provider keys, webhook tokens, bearer tokens, cookies, payment secrets, email credentials, or generated share tokens.

## Packaging Notes

The publish package assumes the existing Taskloom runtime:

- Hono remains the API and static host.
- Vite output is produced with `npm run build:web` and served from `web/dist`.
- Generated app or agent publish assets stay under the local publish path so package exports are reproducible.
- Focused build commands are `npm ci`, `npm run build:web`, and `npm run typecheck`.

## Docker Compose Handoff

The deterministic outline targets `docker-compose.publish.yml` with:

- `taskloom-app` built from the repository root on Node 22 or newer
- local publish path mounted read-only into the app container
- `PORT` exposed through the host, reverse proxy, or load balancer
- `taskloom-db` attached only when the selected `TASKLOOM_STORE` posture needs managed Postgres
- `/api/health/ready` checked before public traffic shifts

The handoff should include the compose file, redacted env placeholder guidance, private URL, public URL, health command, smoke command, and rollback command.

## Health And Smoke Expectations

Health check:

```bash
curl -fsS <private-url>/api/health/ready
```

Minimum health expectation:

- `GET /api/health/ready` returns 200 with status ready.

Smoke check:

```bash
curl -fsS <private-url>/api/health/live && curl -fsS <private-url>/api/health/ready
```

Minimum smoke expectations:

- `GET /api/health/live` returns 200 with status live.
- `GET /api/health/ready` returns 200 with status ready.
- The generated app route or generated agent entrypoint is reachable at the private handoff URL before public DNS is shared.

Generated app smoke checks should include the primary route and at least one generated workflow when available. Generated agent smoke checks should include provider readiness, enabled tool readiness, trigger/webhook readiness when applicable, and a safe generated sample input.

Failures should show the failed check name, URL, method, response status, redacted response body/logs, likely missing env/config/integration, and retry or rollback guidance.

## Publish History And Rollback

Publish history should record every attempt with:

- publish id
- source checkpoint
- generated bundle path
- private and public URLs
- status
- health and smoke results
- redacted logs
- Docker Compose export path
- current/previous marker
- rollback target

A publish becomes current only after required health and smoke checks pass, unless a user explicitly accepts a private failed preview state. The previous publish remains the rollback target until the new publish is current.

Rollback semantics:

- keep at least the current publish and the last known-good publish until the new checks pass
- rollback repoints hosting and URL handoff to the previous known-good bundle
- rollback restores health/smoke metadata and records a rollback event
- rollback reruns readiness checks after the pointer changes
- if rollback cannot find a previous publish, keep the current URL private and show the missing publish id

The helper emits a deterministic rollback command shape:

```bash
taskloom publish rollback --workspace <workspace> --app <draft> --to <previous-publish-id>
```
