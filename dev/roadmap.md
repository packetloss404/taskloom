# Roadmap

This document describes where Taskloom is today and the tracks we think are most worth investing in next. It is suggestive, not a contract — real priority is set by issue activity, PRs, and what self-hosters are running into. Anything here can move, slip, or be reshaped by a better idea.

## Where we are

Taskloom is a self-hosted, MIT-licensed app and agent workbench. The builder loop — describe an internal app or agent in plain English, review a brief and plan, preview a clickable build, iterate with scoped change prompts, then publish — is the supported MVP and is used end-to-end. The same workbench that drafts the work also operates it: workflows, runs, integrations, operations, and settings all live behind one sign-in.

Concretely, today's surface includes:

- **Builder-first flow** at `/builder` for both prompt-to-app and prompt-to-agent, with diff-review on every apply and rollback to any prior checkpoint.
- **Six ready-to-edit agent templates** in [`src/agent-templates.ts`](../src/agent-templates.ts): support inbox triage, daily workspace brief, release audit, blocker watcher, weekly release notes, research summarizer.
- **Four model providers** routable per agent: Anthropic, OpenAI, MiniMax, Ollama. BYO keys, stored in the encrypted secrets vault.
- **Sandboxed code execution** via `/api/app/sandbox/*` and the `/sandbox` workbench view, with a Docker driver (default) and a clearly-marked-insecure native fallback. Opt-in routing of builder smoke checks through the sandbox.
- **Full operate surface** in the workbench: alerts, audit log, secrets vault (AES-256-GCM at rest), inbound + outbound webhooks with retry and dead-letter, persistent jobs queue with five-field cron, RBAC (viewer / member / admin / owner), rate limits, releases, backups, storage, SSE-streamed runs, command palette.
- **Self-host quick start** with three storage modes: file-backed JSON for contributor flow, single-node SQLite (WAL, foreign keys, busy_timeout) for production single-node, and managed Postgres for horizontal app writers.

Workbench screens that exist as of today (each one a file under [`web/src/workbench/views/`](../web/src/workbench/views/)): builder, agents, agent-editor, builder-agent, app-preview, run-detail, run-deep, runs, workflows, integrations, sandbox, operations, secrets, webhooks, rate-limits, releases, notifications, storage, backups, billing, roles, sso, settings, admin-controls, dashboard, activation.

## What's next

Five tracks, roughly in priority order. Each has a concrete first step that someone could pick up from an issue.

### 1. App template gallery

Today only the agent side has a curated template gallery. The app side has the type plumbing — [`AppDraftTemplateId`](../src/app-builder-service.ts) defines `crm`, `booking`, `internal_dashboard`, `task_tracker`, `customer_portal` — but no curated, fleshed-out app starters parallel to what `agent-templates.ts` does for agents. Self-hosters land at `/builder` and have to start from a blank prompt.

First step:

- [ ] Define an `AppTemplate` record analogous to `AgentTemplate`, with prompt, page map, schema, seed data, acceptance checks.
- [ ] Author the five existing IDs into full templates and surface them in the builder gallery alongside the agent templates.
- [ ] Add at least one acceptance test per template that runs the smoke pipeline end-to-end.

### 2. Integrations marketplace expansion

[`src/integration-marketplace.ts`](../src/integration-marketplace.ts) and the `integrations.tsx` view exist but the registry is small and integrations are mostly opaque from the workbench. Self-hosters need a clearer "here are the integrations available, here's how I configure and test one" flow.

First step:

- [ ] Audit the current registry and write a short README of the schema in `src/integration-marketplace.ts`.
- [ ] Add a per-integration setup-and-test panel in `web/src/workbench/views/integrations.tsx` with a connection-test button that proves credentials before saving them to the secrets vault.
- [ ] Expand the registry with the integrations the existing agent templates already use (mailbox, webhook out, HTTP fetch, calendar).

### 3. Per-agent and per-workflow cost tracking

Provider calls are already persisted — see [`src/provider-calls-read.ts`](../src/provider-calls-read.ts) — but the workbench has no rollup that answers "how much did this agent cost last week" or "which workflow is burning my Anthropic budget". With BYO keys this is a question every operator will eventually ask.

First step:

- [ ] Add a server-side aggregator over `provider-calls-read` that groups by agent ID, workflow ID, and time bucket, with per-provider unit-cost configuration.
- [ ] Surface the rollup in the agent detail and workflow detail views.
- [ ] Add a workspace-level "Cost" tile to `operations.tsx` showing month-to-date totals by provider.

### 4. Tighter builder iteration UX

Scoped change prompts already exist, but the diff-and-preview cycle could be smoother — multi-file diffs are read-only, there's no compact "what did this prompt actually change" summary, and rolling back to a checkpoint is a few clicks more than it should be.

First step:

- [ ] Group consecutive applies into a session in the builder timeline.
- [ ] Replace the per-file diff modal with a multi-file diff view that supports per-hunk accept/revert.
- [ ] Add a "rollback to this checkpoint" inline action on each timeline entry (the data is already persisted by the publish-history service).

### 5. Operator-facing observability rollup

The pieces are all there — `OperationsStatus`, subsystem health, job-metrics snapshots, alert events, rolling per-type metrics. They surface as separate tiles. A self-hoster running Taskloom on one Hetzner box still has to read several tiles to answer "is this thing healthy right now".

First step:

- [ ] Add a single "Health" header at the top of `operations.tsx` that summarises store, scheduler, access-log, jobs queue depth, and recent alerts into one green/amber/red verdict with a one-line reason.
- [ ] Wire the same verdict into `GET /api/app/operations/status` so external monitoring can poll one endpoint.

## Considered, deferred

Items we have looked at and explicitly chosen not to do right now. Worth revisiting later or worth a discussion issue first.

- **Public draft preview / anonymous "try it before installing"**. A rate-limited unsigned-in `/builder` preview would shorten the funnel from "saw the README" to "drafted my first app". Out of scope for now — the product is self-hosted and the trust boundary for prompt-to-execute is much cleaner with a real account on a real workspace. Reconsider only if there is a local demo path that preserves that boundary.
- **App / agent marketplace between workspaces**. Workspaces are isolated by design today. Sharing apps and agents across workspaces in a single node is plausible (one writer, multiple tenants); sharing across nodes is a much larger change that bumps into trust, signing, and update flow. Not worth designing until the in-node case is well-defined.
- **More builder modes** (test-driven, schema-first, mockup-first). The current freeform-prompt-plus-scoped-iteration is doing the job. Revisit only if a real user workflow keeps tripping over it.

## Non-goals

These are the things Taskloom is **not** going to become. Worth being explicit so contributors don't spend cycles proposing them.

- **Hosted SaaS run by us.** Taskloom is self-hosted by design. We will not run a managed Taskloom service or accept hosting funding that would tie the project to a single operator.
- **Active-active multi-region writes.** The supported topologies are single-node SQLite and managed-Postgres horizontal app writers. Active-active writes, regional failover orchestrated by Taskloom, and distributed SQLite are explicitly out of scope.
- **Vendor lock-in to one model provider.** Multi-provider routing (Anthropic, OpenAI, MiniMax, Ollama) is a feature, not a placeholder for picking a winner. New providers should slot into the existing routing surface.
- **Telemetry or phone-home.** No analytics, no anonymous usage pings, no "send error reports to us" toggle. Operators run this on their own infrastructure and that infrastructure stays theirs.
- **Closed-source companion services.** Anything that ships as part of Taskloom is MIT and lives in the repo. No proprietary cloud add-ons.

## How decisions are made

The roadmap above is suggestive. Real priority comes from what self-hosters are filing issues about, what PRs are landing, and what the maintainers can actually keep tested and supported. If a track on this list has been quiet for a release or two, assume it has slipped down the list.

The right place to push on priority, propose new tracks, or argue against a non-goal is the issue tracker:

<https://github.com/packetloss404/taskloom/issues>

For larger ideas, open a discussion-style issue first — describe the problem, the proposed shape of the solution, and what success looks like — before writing code. That is much more likely to land than a surprise PR.
