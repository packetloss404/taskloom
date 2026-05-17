# Backlog

This backlog keeps Taskloom aimed at one thing first: **describe an app or agent, review the plan, generate it, preview/test it, iterate, publish/run it, and keep ownership of the runtime**.

It is intentionally not a phase list. Items are grouped by product outcome so we can ship useful vertical slices.

## MVP Reliability

- Make the generated app preview feel like a real app session: open from the Builder without confusing API URLs, preserve selected checkpoint, and show clear reload/error states.
- Add one-click "open generated workspace" affordances where the platform supports it, while keeping the UI portable for hosted/container installs.
- Add a smoke-test transcript per generated app checkpoint: what ran, what passed, what failed, and how to rerun it.
- Tighten generated app empty/error/loading states so CRUD output feels deliberate, not template-ish.
- Add a focused end-to-end happy path: sign in, build app, approve, preview, iterate, publish handoff.
- Add a focused agent happy path: sign in, build agent, approve, run once with configured provider/tools, inspect result.

## Builder Depth

- Generate stronger app plans before code: route map, entity model, permissions notes, integration assumptions, and acceptance checks.
- Support editing the plan before generation without losing prompt context.
- Add file-level review UI for generated source files, with changed/unchanged/new/deleted grouping.
- Let users regenerate a single route, entity, or component instead of rerunning the whole app draft.
- Add export/download of the generated app workspace as a zip or git-ready folder.
- Add optional package-install planning for generated apps while keeping execution sandboxed.

## Agent Depth

- Improve provider readiness: show which provider, model, key, and tool permissions are required before first run.
- Add first-run evaluation: expected input, actual output, tool calls, and pass/fail notes.
- Add agent memory/input schema examples that users can edit from the Builder.
- Keep detailed editing in the existing agent editor, but make the Builder handoff obvious after creation.
- Add agent import/export so templates and generated agents can move between installs.

## Self-Host Publish

- Turn publish handoff into a clearer "run this generated app" path for local Docker Compose.
- Add generated app health endpoint and static asset manifest validation.
- Add signed or checksum-based artifact manifest verification for exported bundles.
- Document reverse-proxy examples for local network/VPN deployment.
- Add a minimal "public URL configured" check that verifies the configured URL actually reaches the published app.

## Product Fit

- Keep primary navigation focused on Build, Projects, Runs, and Settings.
- Continue moving deployment/admin surfaces behind Advanced without deleting compatibility routes.
- Add Projects as the unified home for generated apps and agents with status, latest checkpoint, and last run.
- Add clearer "what Taskloom does today" copy in-product: local builder, local preview, self-host handoff, not hosted SaaS.
- Remove or rewrite any stale enterprise-first language that distracts from the builder-first path.

## Quality Bar

- Search for placeholders, demo-only text, fake success language, and vague "coming soon" states before every release.
- Keep `npm run typecheck`, `npm test`, `npm run build:web`, and `npm audit --omit=dev` green.
- Add regression tests for generated workspace path traversal, preview route serving, publish artifact validation, and rollback.
- Add browser-level screenshots for Builder app mode and agent mode once a stable local browser test path exists.
- Keep generated artifacts out of git and document cleanup/reset commands.

## Later, Not MVP

> Hosted-only capabilities (managed deploy with free public subdomain, hosted browser-agent farm, one-click App Store / Play submission, hosted OAuth proxy with pre-wired connectors, cross-tenant user memory, shareable / remixable conversation URLs, managed credit meter) are intentionally out of scope for self-host. See [CLOUD.md](CLOUD.md) for the inventory and what a hypothetical Taskloom Cloud product would need to ship them.

- Collaborative multiplayer editing.
- Hosted cloud deployment managed by Taskloom.
- Full browser IDE with arbitrary repo editing.
- Marketplace templates and shared plugins.
- Multi-region active-active runtime.
- Distributed SQLite or custom database replication.
