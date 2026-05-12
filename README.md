# Taskloom

**Self-hosted, open-source app and agent workbench. Describe what you want, ship it, own it.**

Taskloom is an OSS, self-hosted workbench for building internal apps and agents from plain-language prompts. Sign in, open `/builder`, describe an internal tool or agent, get a brief, plan, and clickable preview, iterate with scoped change prompts, then publish to a workspace you operate end-to-end. Bring your own model keys (Anthropic, OpenAI, MiniMax, Ollama). MIT licensed. No telemetry.

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](#license)
[![Version](https://img.shields.io/badge/version-v0.1.0-blue.svg)](https://github.com/packetloss404/taskloom/releases)
[![Node](https://img.shields.io/badge/node-%3E%3D22.5.0-brightgreen.svg)](https://nodejs.org)
[![Built with TypeScript](https://img.shields.io/badge/built%20with-TypeScript-blue.svg)](https://www.typescriptlang.org)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![Hono](https://img.shields.io/badge/API-Hono-orange.svg)](https://hono.dev)

- **Website:** https://packetloss404.github.io/taskloom/
- **Source:** https://github.com/packetloss404/taskloom
- **License:** MIT

## Why Taskloom

Most prompt-to-app builders are hosted SaaS that own your data, your runtime, and your users. Taskloom is the opposite: a single Node app you can run on your laptop, in a container, or behind your VPN. The same workbench you use to draft an idea is the workbench your team uses to operate the result — agents, runs, secrets, webhooks, RBAC, and audit included.

If you have used v0, Bolt, Lovable, Replit Agents, or Base44 and wished you could host the whole thing yourself: that is what this is.

## Quick start

```bash
git clone https://github.com/packetloss404/taskloom.git
cd taskloom
npm install
npm run dev
```

Then open **http://localhost:7341**. Two processes start:

| Port | Process | Purpose |
| ---- | ------- | ------- |
| `7341` | Vite (web) | React workbench UI, proxies `/api/*` to the API |
| `8484` | Hono (api) | REST + SSE endpoints, jobs scheduler, sandbox |

For a built-and-served run on a single port (`8484`):

```bash
npm run build:web
npm start
```

### Seed accounts (development only)

The local seed includes three workspace accounts; password is `demo12345` for each. **Do not use these in any production environment.**

- `alpha@taskloom.local`
- `beta@taskloom.local`
- `gamma@taskloom.local`

You can also register a new account from the sign-up page. To reset local data back to the seed state, stop the dev server and run `npm run store:reset`.

## Features

### Build

- **Prompt-to-app and prompt-to-agent.** Describe an internal app or agent in plain language; Taskloom drafts a brief, page map, data model, and acceptance checks.
- **Draft, preview, iterate, publish.** Diff-review every change before applying. Each apply creates a checkpoint you can preview, smoke-test, and roll back to.
- **Template gallery.** Six ready-to-edit agent templates ship in the box (see below). Use them as starting points or compose from scratch.
- **First-class scoped iteration.** Targeted change prompts edit one slice of the app instead of regenerating everything.

### Run

- **Workflows.** Briefs, requirements, plans, blockers, open questions, validation evidence, and release confirmation — all editable in the workbench, all versioned.
- **Agent runs and runs activity.** Drilldown view at `/runs/:id` with transcript, tool-call timeline, logs, and a one-click failure-diagnostic helper.
- **Multi-provider routing.** Anthropic, OpenAI, MiniMax, and Ollama. Switch per-agent; bring your own keys.
- **Browser tools.** Optional Playwright-backed `browser_goto`, screenshots, and DOM tools for agent runs (artifacts persisted under `data/artifacts/`).

### Operate

- **Encrypted secrets vault** with AES-256-GCM at rest.
- **Audit log** for workspace actions, role changes, and sensitive mutations.
- **Webhooks in and out.** Inbound public webhooks trigger agent runs; outbound webhooks deliver alerts and invitation events with retry, dead-letter, and shared-secret signing.
- **Persistent jobs queue + cron.** Five-field cron expressions for any registered job type, with scheduler leader election for multi-process deployments.
- **SSE run streaming** for live transcripts and tool-call output.
- **RBAC** with viewer / member / admin / owner roles, enforced server-side.
- **Rate limits, releases, backups, storage.** All exposed in the workbench under Operations and Settings.
- **Command palette** (Cmd/Ctrl-K) for fast navigation and run shortcuts.

### Self-host

- **MIT licensed**, single-binary friendly, runs anywhere Node 22 runs.
- **No telemetry.** Nothing phones home.
- **BYO keys.** No vendored model relationships; no proxy in the middle.
- **JSON, SQLite, or managed Postgres.** Default is file-backed JSON for contributor flow; flip to SQLite for single-node deployments or managed Postgres for horizontal app writers.

## Agent templates

Six templates ship in `src/agent-templates.ts` and appear in the workbench template gallery:

| Template | Category | Schedule | What it does |
| -------- | -------- | -------- | ------------ |
| **Support inbox triage** | Support | `*/15 * * * *` | Watches a shared mailbox, classifies severity, drafts replies, escalates urgent threads. |
| **Daily workspace brief** | Operations | `0 8 * * 1-5` | Composes a 5-line morning brief from workspace activity, blockers, questions, and validations. |
| **Release audit** | Release | _on demand_ | Verifies validation evidence and release confirmation; blocks if required evidence is missing. |
| **Blocker watcher** | Operations | `0 9 * * 1-5` | Tracks unresolved blockers and prepares escalation notes for owners of critical items. |
| **Weekly release notes** | Comms | `0 16 * * 5` | Drafts customer-facing release notes from completed plan items and validation evidence. |
| **Research summarizer** | Research | _on demand_ | Reads a URL, returns a structured summary with key findings, risks, and follow-up questions. |

Every template is editable; instantiate one and tune the instructions, tools, schedule, and input schema for your workspace.

## Sandboxed code execution

A first-class sandbox runtime ships under `/api/app/sandbox/*` with a `/sandbox` view in the workbench. It powers ad-hoc command execution and (opt-in) the app-builder smoke pipeline that verifies generated apps before publish.

- **Drivers.** `docker` (default) runs `docker run --rm -i --network=none --cpus --memory --read-only --tmpfs /tmp` against runtimes `node-20`, `python-3.11`, `ubuntu-22`. A `native` host-process fallback is available and clearly marked **insecure** in the UI.
- **Endpoints.** `GET /status`, `GET /runtimes`, `POST /exec`, `GET /exec`, `GET /exec/:id`, `POST /exec/:id/cancel`, `GET /exec/:id/stream` (SSE).
- **Workbench UI.** Status panel, runtime readiness, command composer, exec history, and a live log viewer with stdout / stderr tabs and follow-tail. The Builder also gains a per-app Sandbox tab.
- **Smoke integration.** With `TASKLOOM_SANDBOX_SMOKE_ENABLED=1`, draft-apply, change-apply, and preview-refresh route every smoke check through the sandbox. Per-check details get `sandbox: exit N · Mms` appended and the message is suffixed with `(verified via sandbox · driver=…)`. Off by default — enable once Docker is available.

## Configuration

Common environment variables:

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `NODE_ENV` | `development` | Set to `production` to mark cookies `Secure` and disable dev shortcuts. |
| `PORT` | `8484` | API server port. |
| `TASKLOOM_STORE` | `json` | `json` (file-backed) or `sqlite`. |
| `TASKLOOM_DB_PATH` | `data/taskloom.sqlite` | SQLite database path when store is `sqlite`. |
| `TASKLOOM_TRUST_PROXY` | `false` | Trust `X-Forwarded-Host` / `X-Forwarded-For` from a known proxy. |
| `TASKLOOM_RATE_LIMIT_KEY_SALT` | _unset_ | Salt for hashed rate-limit bucket IDs. Set in production. |
| `TASKLOOM_SANDBOX_DRIVER` | `auto` | `docker`, `native`, or `auto`. |
| `TASKLOOM_SANDBOX_DEFAULT_RUNTIME` | `node-20` | Default container image. |
| `TASKLOOM_SANDBOX_DEFAULT_TIMEOUT_MS` | `30000` | Per-exec timeout. |
| `TASKLOOM_SANDBOX_MEMORY_MB` | `512` | Container memory limit. |
| `TASKLOOM_SANDBOX_CPUS` | `1` | Container CPU limit. |
| `TASKLOOM_SANDBOX_SMOKE_ENABLED` | `0` | Route builder smoke checks through the sandbox. |

Provider keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) are configured per-workspace in the Providers view, stored in the encrypted secrets vault, and never logged.

## Architecture

- **Frontend.** React 19 + Vite, mounted at `/`. Tailwind CSS, Geist fonts, a silver / grey / green-light theme. 30+ workbench views covering builder, agents, workflows, runs, integrations, operations, settings, billing, roles, SSO, secrets, webhooks, rate limits, releases, notifications, storage, backups, and sandbox.
- **Backend.** Hono on `@hono/node-server`. Routes for `/api/health`, `/api/auth/*`, `/api/app/*` (with cross-origin and CSRF enforcement), `/api/public/share`, public webhooks, and sandbox.
- **Persistence.** File-backed JSON for contributor flow; SQLite (WAL, foreign keys on, busy_timeout) for single-node deployments; managed Postgres for horizontal app writers.
- **Jobs.** Persisted queue with five-field cron, exponential retry, dead-letter, and optional file- or HTTP-based scheduler leader election.

## Development

```bash
# Run API + web together
npm run dev

# Or separately
npm run dev:api   # Hono on :8484
npm run dev:web   # Vite on :7341

# Type-check the entire workspace (API + web)
npm run typecheck

# Tests
npm run test       # API + web
npm run test:api
npm run test:web

# Full release gate (build + typecheck + tests)
npm run build
```

Generated `web/dist/` is gitignored; rebuild locally rather than committing it.

### SQLite mode

```bash
TASKLOOM_STORE=sqlite npm run dev
npm run db:migrate
npm run db:seed
```

`npm run db:reset` recreates the schema and reseeds. `npm run db:backup` and `npm run db:restore` snapshot and restore the SQLite file. See `npm run` for the full list of database commands, including managed-Postgres backfill helpers.

## Project status

Taskloom is in active development. The builder loop (prompt-to-agent, prompt-to-app, scoped iteration, preview, publish) and the operate surface (workflows, runs, jobs, audit, secrets, webhooks, RBAC, sandbox) are stable and used end-to-end. Managed Postgres for horizontal app writers is supported behind explicit startup gates; active-active multi-region writes, Taskloom-owned regional failover, and distributed SQLite are not.

For the current roadmap and sprint plan, see the [project website](https://packetloss404.github.io/taskloom/) and the [GitHub Issues](https://github.com/packetloss404/taskloom/issues) tab.

## Contributing

PRs welcome. Please open an issue first for non-trivial changes so we can align on scope. Run `npm run build` before opening a PR — it runs the web build, full TypeScript typecheck, API tests, and frontend smoke tests.

## License

Released under the [MIT License](https://opensource.org/licenses/MIT). Copyright (c) Taskloom contributors.
